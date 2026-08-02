export const getSafeExternalUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export const openExternalUrl = (value: string) => {
  const url = getSafeExternalUrl(value);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
