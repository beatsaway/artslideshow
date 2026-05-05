/**
 * One-off: reassign pasted_images1..N.webp to a random permutation of the same N images.
 * Safe staging folder avoids overwrite clobbering sources.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";

const ROOT = path.resolve(process.cwd());
const DIR = path.join(ROOT, "ceramic_hollow");
const LAST = 140;
const TMP = path.join(DIR, ".shuffle_staging");

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  await fs.mkdir(TMP, { recursive: true });

  for (let i = 1; i <= LAST; i++) {
    const src = path.join(DIR, `pasted_images${i}.webp`);
    const staged = path.join(TMP, `slot_${String(i).padStart(3, "0")}.webp`);
    await fs.copyFile(src, staged);
  }

  /** permutation[k] = old index (1..LAST) whose image goes to new slot k+1 */
  const permutation = fisherYatesShuffle(
    Array.from({ length: LAST }, (_, i) => i + 1)
  );

  for (let newSlot = 1; newSlot <= LAST; newSlot++) {
    const oldIndex = permutation[newSlot - 1];
    const src = path.join(
      TMP,
      `slot_${String(oldIndex).padStart(3, "0")}.webp`
    );
    const dest = path.join(DIR, `pasted_images${newSlot}.webp`);
    await fs.copyFile(src, dest);
  }

  await fs.rm(TMP, { recursive: true, force: true });
  console.log(
    `Shuffled ceramic_hollow: ${LAST} images reassigned to slots 1..${LAST} (random permutation).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
