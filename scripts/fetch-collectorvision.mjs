#!/usr/bin/env node
// Prepares public/collectorvision/ with the CollectorVision web scanner runtime:
// the forked source modules in collectorvision/ plus the prebuilt
// model/catalog/onnxruntime bundle published as a CollectorVision GitHub release.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forkDir = join(root, "collectorvision");
const outDir = join(root, "public", "collectorvision");
const cacheDir = join(root, ".cache", "collectorvision");
const force = process.argv.includes("--force");

const SOURCE_FILES = [
  "scanner.worker.mjs",
  "lib/collectorvision-scanner-applet.mjs",
  "lib/collectorvision-catalog-v2.mjs",
  "LICENSE",
];

function fail(message) {
  console.error(`[collectorvision] ${message}`);
  process.exit(1);
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const partial = `${destination}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, destination);
}

async function prepareBundle(release) {
  const stampFile = join(outDir, ".bundle.json");
  if (!force && existsSync(stampFile)) {
    const current = JSON.parse(await readFile(stampFile, "utf8"));
    if (current.release === release && existsSync(join(outDir, "assets", "manifest.json"))) {
      return false;
    }
  }

  await mkdir(cacheDir, { recursive: true });
  const archive = join(cacheDir, `${release}.tar.zst`);
  if (force || !existsSync(archive)) {
    const url = `https://github.com/HanClinto/CollectorVision/releases/download/${release}/web-scanner-assets.tar.zst`;
    console.log(`[collectorvision] downloading ${url}`);
    await download(url, archive);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  console.log("[collectorvision] extracting model/catalog bundle");
  try {
    execFileSync("tar", ["--zstd", "-xf", archive, "-C", outDir], { stdio: "inherit" });
  } catch {
    fail("Extraction failed. A `tar` with zstd support is required (bsdtar on Windows/macOS, GNU tar + zstd on Linux).");
  }
  if (!existsSync(join(outDir, "assets", "manifest.json"))) {
    fail("Bundle did not contain assets/manifest.json");
  }
  await writeFile(stampFile, `${JSON.stringify({ release }, null, 2)}\n`);
  return true;
}

async function main() {
  if (!existsSync(join(forkDir, "scanner.worker.mjs"))) {
    fail("collectorvision/scanner.worker.mjs is missing.");
  }

  const bundle = JSON.parse(await readFile(join(forkDir, "assets.bundle.json"), "utf8"));
  const release = process.env.COLLECTORVISION_RELEASE ?? bundle.release;
  const extracted = await prepareBundle(release);

  // Content hash of the forked sources busts browser/IndexedDB caches whenever they change.
  const sources = await Promise.all(SOURCE_FILES.map((file) => readFile(join(forkDir, file), "utf8")));
  const hash = createHash("sha256");
  for (const source of sources) hash.update(source);
  const buildId = hash.digest("hex").slice(0, 10);

  await mkdir(join(outDir, "lib"), { recursive: true });
  await Promise.all(
    SOURCE_FILES.map((file, i) => writeFile(join(outDir, file), sources[i].replaceAll("__BUILD_ID__", buildId))),
  );
  await copyFile(join(forkDir, "assets.bundle.json"), join(outDir, "assets.bundle.json"));
  console.log(`[collectorvision] ready in public/collectorvision (${buildId}, ${release}${extracted ? ", extracted" : ""})`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
