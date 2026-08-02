import { getJwtExpiresAt } from './tokenExpiration';

const makeJwt = (payload: object) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
};

describe('getJwtExpiresAt', () => {
  it('converts the JWT expiration to milliseconds', () => {
    expect(getJwtExpiresAt(makeJwt({ exp: 1_700_000_300 })))
      .toBe(1_700_000_300_000);
  });

  it.each([
    'not-a-jwt',
    makeJwt({}),
    makeJwt({ exp: 'soon' }),
  ])('rejects a token without a numeric expiration', (token) => {
    expect(getJwtExpiresAt(token)).toBeNull();
  });
});
