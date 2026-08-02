import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'node:crypto';
import multer from 'multer';
import { createRequire } from 'module';
import {
  getAllowedOrigins,
  getAppOrigin,
  requireConfiguredMastodonOrigin,
} from './server-security.js';
const require = createRequire(import.meta.url);
const FormDataLib = require('form-data');
const OAuth = require('oauth-1.0a');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const fetchWithTimeout = (url, options = {}) => fetch(url, {
  ...options,
  signal: AbortSignal.timeout(30_000),
});

const isValidPostRequest = (content, accessToken, maxLength) => (
  typeof content === 'string'
  && content.trim().length > 0
  && content.length <= maxLength
  && typeof accessToken === 'string'
  && accessToken.length > 0
  && accessToken.length <= 8192
);

// Configure multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4,
    fields: 10,
    parts: 14,
    fieldSize: 100 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const allowedOrigins = getAllowedOrigins();

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://bsky.social'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests; please try again later' },
}));
app.use(express.static('dist'));

// Serve static files from public directory (favicon, manifest, etc.)
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

// OAuth configuration endpoint
app.get('/api/oauth/config', (req, res) => {
  const appOrigin = getAppOrigin();
  const mastodonInstanceUrl = requireConfiguredMastodonOrigin(
    process.env.MASTODON_INSTANCE_URL || 'https://mastodon.social',
  );

  const config = {
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      redirectUri: appOrigin,
      scope: 'w_member_social',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization'
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      redirectUri: appOrigin,
      scope: 'tweet.read tweet.write users.read',
      authUrl: 'https://twitter.com/i/oauth2/authorize'
    },
    mastodon: {
      clientId: process.env.MASTODON_CLIENT_ID || '',
      redirectUri: appOrigin,
      scope: 'read write',
      instanceUrl: mastodonInstanceUrl
    },
    bluesky: {
      server: 'https://bsky.social'
    }
  };

  res.json(config);
});

// OAuth token exchange endpoint
app.post('/api/oauth/token', async (req, res) => {
  const { platform, code, clientId, redirectUri, instanceUrl, codeVerifier } = req.body;
  const clientIds = {
    linkedin: process.env.LINKEDIN_CLIENT_ID,
    twitter: process.env.TWITTER_CLIENT_ID,
    mastodon: process.env.MASTODON_CLIENT_ID,
  };

  if (!Object.hasOwn(clientIds, platform) || typeof code !== 'string' || !code || code.length > 4096) {
    return res.status(400).json({ error: 'Invalid OAuth token exchange request' });
  }

  const configuredClientId = clientIds[platform];
  if (!configuredClientId) {
    return res.status(503).json({ error: `${platform} OAuth is not configured` });
  }
  if (clientId !== configuredClientId || redirectUri !== getAppOrigin()) {
    return res.status(400).json({ error: 'OAuth client or redirect URI does not match server configuration' });
  }
  if (platform === 'twitter' && (typeof codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier))) {
    return res.status(400).json({ error: 'Invalid Twitter PKCE code verifier' });
  }

  let mastodonOrigin;
  if (platform === 'mastodon') {
    try {
      mastodonOrigin = requireConfiguredMastodonOrigin(instanceUrl);
    } catch {
      return res.status(400).json({ error: 'Mastodon instance does not match server configuration' });
    }
  }

  try {
    let tokenData;

    if (platform === 'linkedin') {
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      if (!clientSecret) {
        return res.status(503).json({ error: 'LinkedIn OAuth is not configured' });
      }

      const response = await fetchWithTimeout('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: configuredClientId,
          client_secret: clientSecret,
          redirect_uri: getAppOrigin(),
        }),
      });
      tokenData = await response.json();
      if (!response.ok) {
        throw new Error(`LinkedIn token exchange returned ${response.status}`);
      }

      try {
        const profileResponse = await fetchWithTimeout('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        tokenData.userProfile = profileResponse.ok
          ? await profileResponse.json()
          : { authenticated: true };
      } catch {
        tokenData.userProfile = { authenticated: true };
      }
    } else if (platform === 'twitter') {
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (!clientSecret) {
        return res.status(503).json({ error: 'Twitter OAuth is not configured' });
      }

      const response = await fetchWithTimeout('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${configuredClientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: configuredClientId,
          redirect_uri: getAppOrigin(),
          code_verifier: codeVerifier,
        }),
      });
      tokenData = await response.json();
      if (!response.ok) {
        throw new Error(`Twitter token exchange returned ${response.status}`);
      }

      try {
        const profileResponse = await fetchWithTimeout('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        tokenData.userProfile = profileResponse.ok ? await profileResponse.json() : null;
      } catch {
        tokenData.userProfile = null;
      }
    } else {
      const clientSecret = process.env.MASTODON_CLIENT_SECRET;
      if (!clientSecret) {
        return res.status(503).json({ error: 'Mastodon OAuth is not configured' });
      }

      const response = await fetchWithTimeout(`${mastodonOrigin}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: configuredClientId,
          client_secret: clientSecret,
          redirect_uri: getAppOrigin(),
          scope: 'read write',
        }),
      });
      tokenData = await response.json();
      if (!response.ok) {
        throw new Error(`Mastodon token exchange returned ${response.status}`);
      }

      try {
        const profileResponse = await fetchWithTimeout(`${mastodonOrigin}/api/v1/accounts/verify_credentials`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        tokenData.userProfile = profileResponse.ok ? await profileResponse.json() : null;
      } catch {
        tokenData.userProfile = null;
      }
      tokenData.instanceUrl = mastodonOrigin;
    }

    res.json(tokenData);
  } catch (error) {
    console.error('OAuth token exchange failed:', error.message);
    res.status(502).json({ error: 'OAuth provider rejected the token exchange' });
  }
});

// OAuth token refresh endpoint
app.post('/api/oauth/refresh', async (req, res) => {
  const { platform, refreshToken } = req.body;

  if (!['linkedin', 'twitter', 'mastodon', 'bluesky'].includes(platform)
      || typeof refreshToken !== 'string'
      || !refreshToken
      || refreshToken.length > 8192) {
    return res.status(400).json({ error: 'Invalid token refresh request' });
  }
  
  try {
    let tokenUrl;
    let tokenData;
    
    if (platform === 'linkedin') {
      tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      if (!clientSecret) {
        throw new Error('LinkedIn client secret not configured');
      }
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: clientSecret,
      });
      
      const response = await fetchWithTimeout(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
      
      tokenData = await response.json();
      
      if (!response.ok) {
        throw new Error(`LinkedIn token refresh failed: ${tokenData.error_description || tokenData.error}`);
      }
      
    } else if (platform === 'twitter') {
      // Twitter OAuth 2.0 with PKCE does support refresh tokens
      tokenUrl = 'https://api.twitter.com/2/oauth2/token';
      
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (!clientSecret) {
        throw new Error('Twitter client secret not configured');
      }
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.TWITTER_CLIENT_ID,
      });
      
      const response = await fetchWithTimeout(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${clientSecret}`).toString('base64')}`
        },
        body: params
      });
      
      tokenData = await response.json();
      
      if (!response.ok) {
        throw new Error(`Twitter token refresh failed: ${tokenData.error_description || tokenData.error}`);
      }
      
    } else if (platform === 'mastodon') {
      // Mastodon supports refresh tokens
      const instanceUrl = requireConfiguredMastodonOrigin(
        process.env.MASTODON_INSTANCE_URL || 'https://mastodon.social',
      );
      
      tokenUrl = `${instanceUrl}/oauth/token`;
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.MASTODON_CLIENT_ID,
        client_secret: process.env.MASTODON_CLIENT_SECRET,
      });
      
      const response = await fetchWithTimeout(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
      
      tokenData = await response.json();
      
      if (!response.ok) {
        throw new Error(`Mastodon token refresh failed: ${tokenData.error_description || tokenData.error}`);
      }
      
    } else if (platform === 'bluesky') {
      // Bluesky uses session-based authentication with refresh tokens
      const response = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Bluesky token refresh failed: ${errorData.message || 'Unknown error'}`);
      }
      
      const refreshData = await response.json();
      
      // Transform Bluesky response to match our expected format
      tokenData = {
        access_token: refreshData.accessJwt,
        refresh_token: refreshData.refreshJwt,
      };
      
    } else {
      throw new Error(`Token refresh not supported for platform: ${platform}`);
    }
    
    console.log(`✅ Successfully refreshed ${platform} token`);
    res.json(tokenData);
    
  } catch (error) {
    console.error(`Token refresh failed for ${platform}:`, error.message);
    res.status(502).json({ error: 'Token refresh failed' });
  }
});

// LinkedIn posting endpoint
app.post('/api/linkedin/post', upload.any(), async (req, res) => {
  try {
    const { content, accessToken, imageCount } = req.body;
    
    if (!isValidPostRequest(content, accessToken, 3000)) {
      return res.status(400).json({ error: 'Invalid content or access token' });
    }
    
    console.log('📤 Posting to LinkedIn via server...');
    
    // Try to get the authenticated user's profile to get their URN
    let userUrn = 'urn:li:person:~'; // Default fallback
    
    try {
      // Try the /v2/people/~ endpoint first
      const profileResponse = await fetchWithTimeout('https://api.linkedin.com/v2/people/~', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202506'
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        userUrn = profileData.id;
        console.log('✅ Got LinkedIn user profile');
      } else {
        console.log('⚠️ Could not get user profile, trying /v2/userinfo...');
        
        // Try the userinfo endpoint as backup
        const userinfoResponse = await fetchWithTimeout('https://api.linkedin.com/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202506'
          }
        });
        
        if (userinfoResponse.ok) {
          const userinfoData = await userinfoResponse.json();
          userUrn = userinfoData.sub;
          console.log('✅ Got LinkedIn user info');
        } else {
          console.log('⚠️ Could not get user info, using fallback URN');
        }
      }
    } catch (profileError) {
      console.log('⚠️ Profile fetch error, using fallback:', profileError.message);
    }
    
    const postData = {
      author: userUrn,
      commentary: content,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false
    };
    
    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      console.log(`📷 Uploading ${req.files.length} images to LinkedIn...`);
      
      // Note: LinkedIn image upload is complex and requires multiple API calls
      // For now, we'll just post without images and log a warning
      console.warn('⚠️ LinkedIn image uploads not yet implemented on server side');
    }
    
    // Use the newer LinkedIn Posts API with correct format
    const response = await fetchWithTimeout('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202506'
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      console.error('❌ LinkedIn API error:', response.status, response.statusText);
      console.error('🔍 Request details:', {
        url: 'https://api.linkedin.com/rest/posts',
        method: 'POST',
        author: userUrn,
        contentLength: content.length
      });
      return res.status(response.status).json({ 
        error: 'LinkedIn API error', 
        status: response.status,
        statusText: response.statusText
      });
    }
    
    const result = await response.json();
    console.log('✅ LinkedIn post successful');
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('❌ LinkedIn posting error:', error);
    res.status(500).json({ error: 'LinkedIn posting failed' });
  }
});

// Twitter posting endpoint
app.post('/api/twitter/post', upload.any(), async (req, res) => {
  try {
    const { content, accessToken, replyToTweetId, imageCount } = req.body;
    
    if (!isValidPostRequest(content, accessToken, 25000)) {
      return res.status(400).json({ error: 'Invalid content or access token' });
    }
    
    console.log('📤 Posting to Twitter via server...');
    
    const mediaIds = [];
    
    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      console.log(`📷 Uploading ${req.files.length} images to Twitter using OAuth 1.0a...`);
      
      // Check if OAuth 1.0a credentials are configured
      const consumerKey = process.env.TWITTER_API_KEY || process.env.TWITTER_CONSUMER_KEY;
      const consumerSecret = process.env.TWITTER_API_SECRET || process.env.TWITTER_CONSUMER_SECRET;
      const accessTokenKey = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
      
      if (!consumerKey || !consumerSecret || !accessTokenKey || !accessTokenSecret) {
        console.warn('⚠️ OAuth 1.0a credentials not configured for Twitter media uploads');
        console.warn('⚠️ Required env vars: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET');
        console.warn('⚠️ Images will not be uploaded. Text-only tweet will be posted.');
      } else {
        // Configure OAuth 1.0a
        const oauth = OAuth({
          consumer: { key: consumerKey, secret: consumerSecret },
          signature_method: 'HMAC-SHA1',
          hash_function(base_string, key) {
            return createHmac('sha1', key).update(base_string).digest('base64');
          },
        });
        
        const token = {
          key: accessTokenKey,
          secret: accessTokenSecret,
        };
        
        for (const file of req.files) {
          try {
            // Upload media to Twitter using OAuth 1.0a
            const mediaFormData = new FormDataLib();
            mediaFormData.append('media', file.buffer, {
              filename: file.originalname,
              contentType: file.mimetype
            });
            
            const requestData = {
              url: 'https://upload.twitter.com/1.1/media/upload.json',
              method: 'POST',
            };
            
            // Generate OAuth 1.0a authorization header
            const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
            
            const mediaResponse = await fetchWithTimeout('https://upload.twitter.com/1.1/media/upload.json', {
              method: 'POST',
              headers: {
                ...authHeader,
                ...mediaFormData.getHeaders()
              },
              body: mediaFormData
            });
            
            if (mediaResponse.ok) {
              const mediaData = await mediaResponse.json();
              mediaIds.push(mediaData.media_id_string);
              console.log(`✅ Uploaded image to Twitter: ${mediaData.media_id_string}`);
            } else {
              console.error(`❌ Failed to upload image to Twitter (${mediaResponse.status})`);
            }
          } catch (uploadError) {
            console.error('❌ Error uploading image to Twitter:', uploadError);
          }
        }
      }
    }
    
    const tweetData = {
      text: content
    };
    
    // Add media if any were uploaded successfully
    if (mediaIds.length > 0) {
      tweetData.media = {
        media_ids: mediaIds
      };
    }
    
    // Add reply field if this is a reply to another tweet
    if (replyToTweetId) {
      tweetData.reply = {
        in_reply_to_tweet_id: replyToTweetId
      };
    }
    
    const response = await fetchWithTimeout('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });
    
    if (!response.ok) {
      console.error('❌ Twitter API error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Twitter API error', 
        status: response.status,
        statusText: response.statusText
      });
    }
    
    const result = await response.json();
    console.log('✅ Twitter post successful');
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('❌ Twitter posting error:', error);
    res.status(500).json({ error: 'Twitter posting failed' });
  }
});

// Mastodon posting endpoint
app.post('/api/mastodon/post', upload.any(), async (req, res) => {
  try {
    const { content, accessToken, instanceUrl, replyToStatusId } = req.body;
    
    if (!isValidPostRequest(content, accessToken, 10000) || typeof instanceUrl !== 'string') {
      return res.status(400).json({ error: 'Invalid content, access token, or instance URL' });
    }
    
    const mastodonOrigin = requireConfiguredMastodonOrigin(instanceUrl);
    console.log('📤 Posting to Mastodon via server...');
    
    const mediaIds = [];
    
    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      console.log(`📷 Uploading ${req.files.length} images to Mastodon...`);
      
      for (const file of req.files) {
        try {
          // Upload media to Mastodon - use form-data library for Node.js
          const mediaFormData = new FormDataLib();
          
          // Append the file buffer directly with proper options
          mediaFormData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
          });
          mediaFormData.append('description', 'Image uploaded via social-media-kit');
          
          const uploadUrl = `${mastodonOrigin}/api/v1/media`;
          
          const mediaResponse = await fetchWithTimeout(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              ...mediaFormData.getHeaders()
            },
            body: mediaFormData
          });
          
          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            mediaIds.push(mediaData.id);
            console.log(`✅ Uploaded image to Mastodon: ${mediaData.id}`);
          } else {
            console.warn(`❌ Failed to upload image to Mastodon (${mediaResponse.status} ${mediaResponse.statusText})`);
          }
        } catch (uploadError) {
          console.warn('❌ Error uploading image to Mastodon:', uploadError);
        }
      }
    }
    
    const statusData = {
      status: content
    };
    
    // Add media if any were uploaded successfully
    if (mediaIds.length > 0) {
      statusData.media_ids = mediaIds;
    }
    
    // Add reply field if this is a reply to another status
    if (replyToStatusId) {
      statusData.in_reply_to_id = replyToStatusId;
    }
    
    const response = await fetchWithTimeout(`${mastodonOrigin}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(statusData)
    });
    
    if (!response.ok) {
      console.error('❌ Mastodon API error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Mastodon API error', 
        status: response.status,
        statusText: response.statusText
      });
    }
    
    const result = await response.json();
    console.log('✅ Mastodon post successful');
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    const invalidInstance = error.message.includes('MASTODON_INSTANCE_URL');
    if (!invalidInstance) {
      console.error('❌ Mastodon posting error:', error.message);
    }
    const status = invalidInstance ? 400 : 500;
    res.status(status).json({ error: 'Mastodon posting failed' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: 'Invalid file upload' });
  }

  console.error('Unhandled request error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
  console.log(`Application origin: ${getAppOrigin()}`);
});
