#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { decodeNcm, voxToNcm } from "../src/vox/ncm.js";

const args = process.argv.slice(2);
const { input, options } = parseArgs(args);
if (!input) {
  console.error("Usage: node scripts/vox-to-ncm.mjs input.vox --out output.ncm --json output.json --mode merge --height 300");
  process.exit(1);
}

const inputPath = resolve(input);
const mode = options.mode === "raw" ? "raw" : "merge";
const targetHeight = normalizeHeight(options.height);
const outputPath = resolve(options.out || inputPath.replace(/\.vox$/i, ".ncm"));
const jsonPath = options.json ? resolve(options.json) : "";
const bytes = await readFile(inputPath);
const result = voxToNcm(bytes, { mode, targetHeight });
const decoded = decodeNcm(result.ncm);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${result.ncm}\n`);
if (jsonPath) {
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(result.character, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      input: basename(inputPath),
      output: outputPath,
      json: jsonPath || null,
      mode,
      targetHeight,
      voxels: result.source.voxelCount,
      boxes: result.source.boxCount,
      ncmChars: result.ncm.length,
      decodedBoxes: decoded.boxes.length,
      size: result.source.size,
    },
    null,
    2,
  ),
);

function parseArgs(argv) {
  const options = {};
  let input = "";
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      input ||= arg;
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = argv[index + 1];
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }
    if (nextValue && !nextValue.startsWith("--")) {
      options[rawKey] = nextValue;
      index++;
      continue;
    }
    options[rawKey] = "1";
  }
  return { input, options };
}

function normalizeHeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.max(80, Math.min(900, Math.round(parsed)));
}
