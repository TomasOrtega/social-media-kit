import { getSafeExternalUrl } from './urlSafety';

describe('getSafeExternalUrl', () => {
  it('allows HTTPS links', () => {
    expect(getSafeExternalUrl('https://social.example/post/1'))
      .toBe('https://social.example/post/1');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://social.example/post/1',
    '/relative/path',
    'not a URL',
  ])('rejects unsafe external link %s', (url) => {
    expect(getSafeExternalUrl(url)).toBeNull();
  });
});
