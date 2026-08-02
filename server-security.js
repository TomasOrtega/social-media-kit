const parseOrigin = (value, name, httpsOnly = false) => {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL origin`);
  }

  if (url.username || url.password) {
    throw new Error(`${name} must not include credentials`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must not include a path, query, or fragment`);
  }
  if (httpsOnly && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }
  if (!httpsOnly && !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  const isLocalhost = url.hostname === 'localhost'
    || url.hostname.endsWith('.localhost')
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]';
  if (!httpsOnly && url.protocol === 'http:' && !isLocalhost) {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }

  return url.origin;
};

export const getAppOrigin = () => {
  const value = process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
  return parseOrigin(value, 'APP_ORIGIN');
};

export const getAllowedOrigins = () => {
  const origins = new Set([getAppOrigin()]);

  for (const value of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    if (value.trim()) {
      origins.add(parseOrigin(value.trim(), 'ALLOWED_ORIGINS entry'));
    }
  }

  return origins;
};

export const requireConfiguredMastodonOrigin = (requestedOrigin) => {
  const configuredOrigin = parseOrigin(
    process.env.MASTODON_INSTANCE_URL || 'https://mastodon.social',
    'MASTODON_INSTANCE_URL',
    true,
  );

  let normalizedRequestedOrigin;
  try {
    normalizedRequestedOrigin = parseOrigin(requestedOrigin, 'Mastodon instance', true);
  } catch {
    throw new Error('Mastodon instance must match MASTODON_INSTANCE_URL');
  }

  if (normalizedRequestedOrigin !== configuredOrigin) {
    throw new Error('Mastodon instance must match MASTODON_INSTANCE_URL');
  }

  return configuredOrigin;
};
