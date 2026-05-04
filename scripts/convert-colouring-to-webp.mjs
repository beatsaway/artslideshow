import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const COLOURING_DIR = path.join(ROOT, "colouring");
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await fs.readdir(COLOURING_DIR, { withFileTypes: true });
  const images = entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return SOURCE_EXTENSIONS.has(ext);
    })
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (images.length === 0) {
    console.log("No colouring JPG/JPEG/PNG files found.");
    return;
  }

  let converted = 0;
  let skipped = 0;

  for (const filename of images) {
    const src = path.join(COLOURING_DIR, filename);
    const dest = path.join(
      COLOURING_DIR,
      filename.replace(/\.[^.]+$/i, ".webp")
    );

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
