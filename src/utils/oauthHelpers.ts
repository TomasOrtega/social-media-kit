// OAuth helper utilities

const toBase64Url = (bytes: Uint8Array) => btoa(
  Array.from(bytes, byte => String.fromCharCode(byte)).join('')
)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

export const generateOAuthState = () => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(randomBytes);
};

/**
 * Generate PKCE (Proof Key for Code Exchange) parameters for OAuth 2.0
 * Used for Twitter/X OAuth flow to enhance security
 * @returns Object containing codeVerifier and codeChallenge
 */
export const generatePKCE = async () => {
  const array = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = toBase64Url(array);

  // Generate code challenge using SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);

  const codeChallenge = toBase64Url(new Uint8Array(hash));

  return { codeVerifier, codeChallenge };
};
