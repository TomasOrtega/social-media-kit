import {
  getAllowedOrigins,
  getAppOrigin,
  requireConfiguredMastodonOrigin,
} from '../../server-security.js';

describe('server security configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.APP_ORIGIN;
    delete process.env.MASTODON_INSTANCE_URL;
    process.env.PORT = '3000';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses one configured application origin for OAuth redirects', () => {
    process.env.APP_ORIGIN = 'https://social.example.com/path';

    expect(() => getAppOrigin()).toThrow('APP_ORIGIN must not include a path');
  });

  it('requires HTTPS for a non-local application origin', () => {
    process.env.APP_ORIGIN = 'http://social.example.com';

    expect(() => getAppOrigin()).toThrow('APP_ORIGIN must use HTTPS outside localhost');
  });

  it('allows the configured app and explicit development origins', () => {
    process.env.APP_ORIGIN = 'https://social.example.com';
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173, https://preview.example.com';

    expect(getAllowedOrigins()).toEqual(new Set([
      'https://social.example.com',
      'http://localhost:5173',
      'https://preview.example.com',
    ]));
  });

  it('rejects a Mastodon request to an unconfigured origin', () => {
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social';

    expect(() => requireConfiguredMastodonOrigin('http://127.0.0.1:3000'))
      .toThrow('Mastodon instance must match MASTODON_INSTANCE_URL');
    expect(() => requireConfiguredMastodonOrigin('https://attacker.example'))
      .toThrow('Mastodon instance must match MASTODON_INSTANCE_URL');
  });

  it('normalizes an allowed Mastodon origin', () => {
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social/';

    expect(requireConfiguredMastodonOrigin('https://mastodon.social'))
      .toBe('https://mastodon.social');
  });

  it('requires HTTPS for the configured Mastodon instance', () => {
    process.env.MASTODON_INSTANCE_URL = 'http://mastodon.example.com';

    expect(() => requireConfiguredMastodonOrigin('http://mastodon.example.com'))
      .toThrow('MASTODON_INSTANCE_URL must use HTTPS');
  });
});
