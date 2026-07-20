/**
 * One-shot: recompress public/V7 (+ root) photos/logos to WebP.
 * Does not touch public/uploads (DB URLs may still use .png/.jpg).
 *
 * Run from vero7-store: node scripts/compress-public-images.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC = path.resolve("public");
const PHOTO_MAX_WIDTH = 1920;
const PHOTO_QUALITY = 82;
const LOGO_MAX = 512;

const LOGO_FILES = new Set([
  "V7/V7-2.png",
  "V7/logo-top.png",
  "V7/logo top.png",
  "V7/club-crew.png",
]);

const SKIP = new Set([
  "favicon-32.png",
  "apple-touch-icon.png",
  "vero7-favicon-circle.png",
]);

async function walk(dir, { recursive }) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) files.push(...(await walk(full, { recursive: true })));
      continue;
    }
    if (/\.(png|jpe?g)$/i.test(e.name)) {
      const rel = path.relative(PUBLIC, full).replaceAll("\\", "/");
      if (!SKIP.has(rel)) files.push(full);
    }
  }
  return files;
}

async function encodeToWebp(filePath, rel) {
  const buf = await fs.readFile(filePath);
  const isLogo = LOGO_FILES.has(rel);
  const maxW = isLogo ? LOGO_MAX : PHOTO_MAX_WIDTH;

  if (isLogo) {
    return sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: maxW, height: maxW, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toBuffer();
  }

  return sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: maxW, withoutEnlargement: true })
    .webp({ quality: PHOTO_QUALITY, effort: 6 })
    .toBuffer();
}

const files = [
  ...(await walk(path.join(PUBLIC, "V7"), { recursive: true })),
  ...(await walk(PUBLIC, { recursive: false })),
];

/** Group sources that would write the same .webp path. */
const byOut = new Map();
for (const filePath of files) {
  const rel = path.relative(PUBLIC, filePath).replaceAll("\\", "/");
  const outRel = rel.replace(/\.(png|jpe?g)$/i, ".webp");
  const outPath = path.join(PUBLIC, outRel);
  if (!byOut.has(outPath)) byOut.set(outPath, []);
  byOut.get(outPath).push({ filePath, rel, outRel });
}

const results = [];
for (const [outPath, sources] of byOut) {
  try {
    let best = null;
    for (const src of sources) {
      const before = (await fs.stat(src.filePath)).size;
      const outBuf = await encodeToWebp(src.filePath, src.rel);
      if (!best || outBuf.length < best.outBuf.length) {
        best = { ...src, before, outBuf };
      }
    }

    await fs.writeFile(outPath, best.outBuf);
    for (const src of sources) {
      if (src.filePath !== outPath) await fs.unlink(src.filePath).catch(() => {});
    }

    results.push({
      sources: sources.map((s) => s.rel).join(" + "),
      out: best.outRel,
      before: best.before,
      after: best.outBuf.length,
    });
  } catch (err) {
    console.error("FAIL", sources.map((s) => s.rel).join(", "), err.message);
  }
}

let saved = 0;
for (const r of results) {
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  saved += Math.max(0, r.before - r.after);
  console.log(`${kb(r.before).padStart(7)} → ${kb(r.after).padStart(6)}  ${r.sources} → ${r.out}`);
}
console.log(`\nSaved ~${Math.round(saved / 1024)}KB across ${results.length} outputs`);
