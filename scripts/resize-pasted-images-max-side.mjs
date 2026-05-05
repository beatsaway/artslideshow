import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Longest side (width or height) must not exceed this; larger images are scaled down proportionally. */
const MAX_SIDE_PX = Number(process.env.MAX_SIDE_PX ?? 900);

const ROOT = path.resolve(process.cwd());
const FOLDERS = ["Op art", "artsy", "ceramic_hollow", "sba1"];

const PASTED_IMAGE_RE = /^pasted_images\d+\.(webp|jpg|jpeg|png)$/i;

function isPastedImage(filename) {
  return PASTED_IMAGE_RE.test(filename);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replace `destPath` with the file at `tmpPath`.
 * Reads source into memory first so Sharp does not keep `destPath` open while encoding (Windows EBUSY on unlink).
 * Retries a few times for indexer / cloud locks.
 */
async function replaceWithTempFile(destPath, tmpPath) {
  const attempts = 12;
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.rm(destPath, { force: true });
      await fs.rename(tmpPath, destPath);
      return;
    } catch (err) {
      const code = err && err.code;
      const retryable =
        code === "EBUSY" || code === "EPERM" || code === "EACCES" || code === "UNKNOWN";

      if (code === "ENOENT" && i > 0) {
        try {
          await fs.rename(tmpPath, destPath);
          return;
        } catch {
          // fall through
        }
      }

      if (retryable && i < attempts - 1) {
        await delay(100 + i * 45);
        continue;
      }

      try {
        await fs.copyFile(tmpPath, destPath);
        await fs.unlink(tmpPath);
        return;
      } catch {
        throw err;
      }
    }
  }
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const input = await fs.readFile(filePath);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (Math.max(w, h) <= MAX_SIDE_PX) {
    return "skipped_fit";
  }

  const pipeline = sharp(input).resize({
    width: MAX_SIDE_PX,
    height: MAX_SIDE_PX,
    fit: "inside",
    withoutEnlargement: true,
  });

  const tmp = `${filePath}.part-${process.pid}`;
  try {
    if (ext === ".webp") {
      await pipeline.webp({ quality: 82, effort: 6 }).toFile(tmp);
    } else if (ext === ".jpg" || ext === ".jpeg") {
      await pipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(tmp);
    } else if (ext === ".png") {
      await pipeline.png({ compressionLevel: 9 }).toFile(tmp);
    } else {
      return "skipped_ext";
    }

    await replaceWithTempFile(filePath, tmp);
  } catch (err) {
    try {
      await fs.unlink(tmp);
    } catch {
      // ignore
    }
    throw err;
  }
  return "resized";
}

async function main() {
  let resized = 0;
  let skippedFit = 0;
  let skippedExt = 0;
  const errors = [];

  for (const rel of FOLDERS) {
    const dir = path.join(ROOT, rel);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code === "ENOENT") {
        console.warn(`Skip missing folder: ${rel}`);
        continue;
      }
      throw err;
    }

    const files = entries
      .filter((e) => e.isFile() && isPastedImage(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const name of files) {
      const filePath = path.join(dir, name);
      try {
        const result = await processFile(filePath);
        if (result === "resized") resized++;
        else if (result === "skipped_fit") skippedFit++;
        else if (result === "skipped_ext") skippedExt++;
      } catch (err) {
        errors.push({ filePath, err });
      }
    }
  }

  console.log(
    `Max side ${MAX_SIDE_PX}px: resized ${resized}, already within limit ${skippedFit}, skipped (ext) ${skippedExt}.`
  );
  if (errors.length) {
    for (const { filePath, err } of errors) {
      console.error(filePath, err);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
