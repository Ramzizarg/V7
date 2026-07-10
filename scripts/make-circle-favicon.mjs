import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcLogo = path.join(root, "public", "vero7-logo.png");

async function makeCircle(size, outPath) {
  const r = size / 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
  );

  // Medium size — between the small and large versions
  const pad = Math.round(size * 0.11);
  const inner = size - pad * 2;

  const logo = await sharp(srcLogo)
    .trim({ threshold: 20 })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const composed = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toBuffer();

  await sharp(composed)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(outPath);

  console.log("wrote", outPath, `(${size}x${size})`);
}

await makeCircle(512, path.join(root, "public", "vero7-favicon-circle.png"));
await makeCircle(180, path.join(root, "public", "apple-touch-icon.png"));
await makeCircle(32, path.join(root, "public", "favicon-32.png"));
await makeCircle(512, path.join(root, "src", "app", "icon.png"));
await makeCircle(180, path.join(root, "src", "app", "apple-icon.png"));
