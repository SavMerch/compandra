// Regenerates PWA icons from an inline mark. Change colors here when rebranding.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const mark = (pad, r) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${r}" fill="#1B2A41"/><g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})"><circle cx="256" cy="196" r="74" fill="#E2725B"/><path d="M0 512V356c70-74 128-102 190-70 44 22 76 26 118 2 74-42 140-16 204 58v166z" fill="#2F8F8B"/><path d="M0 512v-84c84-44 168-44 256-14s172 28 256-14v112z" fill="#FBFAF6"/></g></svg>`;
writeFileSync('public/favicon.svg', mark(0, 112));
for (const [n, s, p, r] of [['icon-192', 192, 0, 0], ['icon-512', 512, 0, 0], ['icon-maskable-512', 512, 56, 0], ['apple-touch-icon', 180, 0, 0]]) {
  await sharp(Buffer.from(mark(p, r))).resize(s, s).png().toFile(`public/${n}.png`);
}
