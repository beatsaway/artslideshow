import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const CERAMIC_HOLLOW_DIR = path.join(ROOT, "ceramic_hollow");
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const MAX_SIDE_PX = 900;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await fs.readdir(CERAMIC_HOLLOW_DIR, { withFileTypes: true });
  const images = entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return SOURCE_EXTENSIONS.has(ext);
    })
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (images.length === 0) {
    console.log("No ceramic_hollow JPG/JPEG/PNG files found.");
    return;
  }

  let converted = 0;
  let skipped = 0;

  for (const filename of images) {
    const src = path.join(CERAMIC_HOLLOW_DIR, filename);
    const dest = path.join(
      CERAMIC_HOLLOW_DIR,
      filename.replace(/\.[^.]+$/i, ".webp")
    );

    if (await fileExists(dest)) {
      skipped++;
      continue;
    }

    const img = sharp(src);
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    const pipeline =
      Math.max(w, h) > MAX_SIDE_PX
        ? img.resize({
            width: MAX_SIDE_PX,
            height: MAX_SIDE_PX,
            fit: "inside",
            withoutEnlargement: true,
          })
        : img;

    await pipeline.webp({ quality: 82, effort: 6 }).toFile(dest);
    converted++;
  }

  console.log(
    `Converted ${converted} image(s) to WebP. Skipped ${skipped} existing WebP(s).`
  );
  console.log(
    "If everything looks good, you can optionally delete the original source images."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

