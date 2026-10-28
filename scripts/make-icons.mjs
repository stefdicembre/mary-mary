// Draws the app icons (only needed if the icon design changes).
// Run with: node scripts/make-icons.mjs   (needs the "sharp" package)
import sharp from "sharp";

const leaf = (scale) => `
  <g transform="translate(512 540) scale(${scale}) translate(-12 -13)" fill="none" stroke="#F1EFE8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 21V11"/>
    <path d="M12 13C12 9 9 7 5 7C5 11 8 13 12 13Z" fill="#C0DD97"/>
    <path d="M12 11C12 7.5 14.5 5 19 5C19 9 16 11 12 11Z" fill="#C0DD97"/>
  </g>`;

const svg = (scale, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="${rounded ? 220 : 0}" fill="#3B6D11"/>
  ${leaf(scale)}
</svg>`;

const make = (file, size, scale, rounded = false) =>
  sharp(Buffer.from(svg(scale, rounded))).resize(size, size).png().toFile(`public/icons/${file}`);

await make("apple-touch-icon.png", 180, 34); // iPhone rounds the corners itself
await make("icon-192.png", 192, 34, true);
await make("icon-512.png", 512, 34, true);
await make("icon-maskable-512.png", 512, 26); // extra margin for Android masks
console.log("Icons written to public/icons/");
