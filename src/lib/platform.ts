// The one place that touches device capabilities, so Capacitor plugins can replace these later.
export const mapsUrl = (query: string) => {
  const q = encodeURIComponent(query);
  return /iPhone|iPad|Macintosh/.test(navigator.userAgent) ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
};
export const openExternal = (url: string) => { window.open(url, '_blank', 'noopener'); };
export const openMaps = (query: string) => openExternal(mapsUrl(query));
export async function copyText(text: string) { await navigator.clipboard.writeText(text); }
/** Returns true if the native share sheet handled it. */
export async function shareLink(data: { title: string; text: string; url: string }) {
  if (navigator.share) {
    try { await navigator.share(data); return true; }
    catch (e) { if ((e as Error).name === 'AbortError') return true; }
  }
  return false;
}
export const authRedirectUrl = (path = '/auth/callback') => `${window.location.origin}${path}`;
