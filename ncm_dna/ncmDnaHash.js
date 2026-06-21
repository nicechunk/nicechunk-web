const textEncoder = new TextEncoder();

export function hashString(value) {
  const bytes = textEncoder.encode(String(value));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function byteLength(value) {
  return textEncoder.encode(String(value)).length;
}
