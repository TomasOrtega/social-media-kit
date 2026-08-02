import { attemptTokenRefresh, ensureValidAuth } from './platformPosting';

const makeJwt = (expiresAtSeconds: number) => {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtSeconds }))
    .toString('base64url');
  return `header.${payload}.signature`;
};

describe('Bluesky token refresh', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the access JWT expiration instead of a fixed 24-hour window', async () => {
    const now = 1_700_000_000_000;
    const expiresAt = now + 5 * 60 * 1000;
    const accessToken = makeJwt(expiresAt / 1000);
    jest.useFakeTimers().setSystemTime(now);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: accessToken,
        refresh_token: 'new-refresh-token',
        expires_in: 24 * 60 * 60,
      }),
    } as Response);

    const onAuthUpdate = jest.fn();
    const refreshed = await attemptTokenRefresh(
      'bluesky',
      {
        isAuthenticated: true,
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
        expiresAt: now,
        userInfo: {},
      },
      onAuthUpdate,
      jest.fn(),
    );

    expect(refreshed).toBe(true);
    expect(onAuthUpdate).toHaveBeenCalledWith({
      accessToken,
      refreshToken: 'new-refresh-token',
      expiresAt,
    });
  });

  it('returns the refreshed token for the pending post', async () => {
    const now = 1_700_000_000_000;
    const accessToken = makeJwt((now + 5 * 60 * 1000) / 1000);
    jest.useFakeTimers().setSystemTime(now);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: accessToken,
        refresh_token: 'new-refresh-token',
      }),
    } as Response);

    const validToken = await ensureValidAuth(
      'bluesky',
      {
        isAuthenticated: true,
        accessToken: 'expired-access-token',
        refreshToken: 'old-refresh-token',
        expiresAt: now,
        userInfo: {},
      },
      jest.fn(),
      jest.fn(),
    );

    expect(validToken).toBe(accessToken);
  });
});
