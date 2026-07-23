export const NCF1_LEGACY_VERSION = 14;
export const NCF1_VERSION = 15;

const volumeMantissaBits = 13;
const volumeMantissaMax = (1 << volumeMantissaBits) - 1;
const volumeExponentMax = 7;
const volumeExponentBase = 16;

export function encodeForgeVolumeMm3(value) {
  const volumeMm3 = unsignedSafeInteger(value, "forge volumeMm3");
  let exponent = 0;
  let scale = 1;
  while (volumeMm3 > volumeMantissaMax * scale && exponent < volumeExponentMax) {
    exponent += 1;
    scale *= volumeExponentBase;
  }
  if (volumeMm3 > volumeMantissaMax * scale) {
    throw new RangeError("Forge volume exceeds the NCF1 v15 range.");
  }
  return exponent * (1 << volumeMantissaBits) + Math.floor(volumeMm3 / scale);
}

export function decodeForgeVolumeMm3(value) {
  const packed = integerInRange(value, 0, 0xffff, "packed forge volume");
  const exponent = packed >>> volumeMantissaBits;
  const mantissa = packed & volumeMantissaMax;
  return mantissa * volumeExponentBase ** exponent;
}

export function decodeForgeEquipmentVolumeMm3(version, encodedVolume) {
  const codecVersion = integerInRange(version, 0, 0xf, "forge code version");
  const packed = integerInRange(encodedVolume, 0, 0xffff, "packed forge volume");
  return codecVersion === NCF1_VERSION ? decodeForgeVolumeMm3(packed) : packed * 1_000;
}

function unsignedSafeInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return numeric;
}

function integerInRange(value, min, max, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}.`);
  }
  return numeric;
}
