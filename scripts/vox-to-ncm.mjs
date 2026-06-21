#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { decodeNcm, voxToNcm } from "../src/vox/ncm.js";

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
if (!input) {
  console.error("Usage: node scripts/vox-to-ncm.mjs input.vox --out output.ncm --json output.json --mode merge --height 300");
  process.exit(1);
}

const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value = "1"] = arg.slice(2).split("=");
      return [key, value];
    }),
);

const inputPath = resolve(input);
const mode = options.mode === "raw" ? "raw" : "merge";
const targetHeight = Number(options.height) || 300;
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
