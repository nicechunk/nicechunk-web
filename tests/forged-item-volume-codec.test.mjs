import assert from "node:assert/strict";

import {
  NCF1_LEGACY_VERSION,
  NCF1_VERSION,
  encodeForgeVolumeMm3,
} from "../src/forgeVolumeCodec.js";
import { decodeForgeCode, forgeBytesToCode } from "../src/forgedItems.js";

class BitWriter {
  buffer = [];
  current = 0;
  bitCount = 0;

  write(value, bits) {
    for (let index = bits - 1; index >= 0; index -= 1) {
      this.current = (this.current << 1) | ((value >> index) & 1);
      this.bitCount += 1;
      if (this.bitCount === 8) {
        this.buffer.push(this.current);
        this.current = 0;
        this.bitCount = 0;
      }
    }
  }

  bytes() {
    if (this.bitCount) this.buffer.push(this.current << (8 - this.bitCount));
    return Uint8Array.from(this.buffer);
  }
}

const fineVolume = decodeForgeCode(forgeBytesToCode(equipmentOnlyCode({
  version: NCF1_VERSION,
  encodedVolume: encodeForgeVolumeMm3(310),
})));
assert.equal(fineVolume.version, NCF1_VERSION);
assert.equal(fineVolume.equipmentStats.massGrams, 5);
assert.equal(fineVolume.equipmentStats.volumeMm3, 310);
assert.equal(fineVolume.equipmentStats.volumeCm3, 0.31);
assert.equal(fineVolume.equipmentStats.volumeM3, 0.00000031);

const legacyVolume = decodeForgeCode(forgeBytesToCode(equipmentOnlyCode({
  version: NCF1_LEGACY_VERSION,
  encodedVolume: 5,
})));
assert.equal(legacyVolume.version, NCF1_LEGACY_VERSION);
assert.equal(legacyVolume.equipmentStats.volumeMm3, 5_000);
assert.equal(legacyVolume.equipmentStats.volumeCm3, 5);

for (const [input, expected] of [
  [1, 1],
  [8_191, 8_191],
  [8_192, 8_192],
  [8_193, 8_192],
]) {
  const decoded = decodeForgeCode(forgeBytesToCode(equipmentOnlyCode({
    version: NCF1_VERSION,
    encodedVolume: encodeForgeVolumeMm3(input),
  })));
  assert.equal(decoded.equipmentStats.volumeMm3, expected);
  assert.ok(expected <= input, "fine-volume quantization must not exceed input capacity");
}

console.log("web forged-item fine-volume tests passed");

function equipmentOnlyCode({ version, encodedVolume }) {
  const writer = new BitWriter();
  writer.write(version, 4);
  writer.write(1, 16);
  writer.write(encodedVolume, 16);
  for (let index = 0; index < 12; index += 1) writer.write(0, 6);
  writer.write(0, 1);
  writer.write(0, 5);
  return writer.bytes();
}
