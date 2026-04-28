import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const ARTSY_DIR = path.join(ROOT, "artsy");

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isPastedPng(name) {
  return /^pasted_images\d+\.png$/i.test(name);
}

async function main() {
  const entries = await fs.readdir(ARTSY_DIR, { withFileTypes: true });
  const pngs = entries
    .filter((e) => e.isFile() && isPastedPng(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const an = Number(a.match(/\d+/)?.[0] ?? 0);
      const bn = Number(b.match(/\d+/)?.[0] ?? 0);
      return an - bn;
    });

  if (pngs.length === 0) {
    console.log("No artsy/pasted_images*.png files found.");
    return;
  }

  let converted = 0;
  let skipped = 0;

  for (const filename of pngs) {
    const src = path.join(ARTSY_DIR, filename);
    const dest = path.join(ARTSY_DIR, filename.replace(/\.png$/i, ".webp"));

    if (await fileExists(dest)) {
      skipped++;
      continue;
    }

    await sharp(src)
      .webp({ quality: 82, effort: 6 })
      .toFile(dest);

    converted++;
  }

  console.log(
    `Converted ${converted} PNG(s) to WebP. Skipped ${skipped} existing WebP(s).`
  );
  console.log(
    "If everything looks good, you can optionally delete the original PNGs."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

