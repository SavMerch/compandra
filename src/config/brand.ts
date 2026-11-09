// Change these env values to rebrand; nothing else hardcodes the name.
const name = import.meta.env.VITE_BRAND_NAME || 'compandra.';
export const brand = {
  name,
  /** For use mid-sentence, without the wordmark's period. */
  plainName: name.replace(/\.$/, ''),
  storagePrefix: 'compandra',
  companyName: 'Merch Labs',
  companyLogo: '/merch-labs-logo.png',
};
export const authProviders = {
  google: import.meta.env.VITE_AUTH_GOOGLE !== 'false',
  apple: import.meta.env.VITE_AUTH_APPLE !== 'false',
};
