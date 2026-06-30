#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decodeNcm } from "../src/vox/ncm.js";

const fixtures = [
  "public/media/vox/chr_peasant_girl_orangehair.ncm",
  "public/media/vox/chr_peasant_guy_blackhair.ncm",
];

const results = [];
for (const fixture of fixtures) {
  const code = (await readFile(resolve(fixture), "utf8")).trim();
  const decoded = decodeNcm(code);
  if (!decoded.boxes.length) throw new Error(`${fixture} decoded without boxes.`);
  results.push({ fixture, boxes: decoded.boxes.length, chars: code.length });
}

const truncated = (await readFile(resolve(fixtures[0]), "utf8")).trim().slice(0, -2);
let rejectedTruncatedPayload = false;
try {
  decodeNcm(truncated);
} catch {
  rejectedTruncatedPayload = true;
}

if (!rejectedTruncatedPayload) throw new Error("Truncated NCM payload was accepted.");

console.log(JSON.stringify({ fixtures: results, rejectedTruncatedPayload }, null, 2));
