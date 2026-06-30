# NCM Format Notes

NCM is a compact text envelope for small cuboid-based voxel assets. The current production converter emits `NCM2:` records, while the decoder still accepts older `NCM1:` records for compatibility.

## NCM2 Envelope

An `NCM2:` payload is base64url text with no required padding. The decoded byte stream stores:

1. Source model size: `x`, `y`, and `z` dimensions as unsigned varints.
2. Unit scale as an unsigned varint. Browser previews currently map values into the shared NiceChunk character box unit.
3. Cuboid count as an unsigned varint.
4. Palette count as an unsigned varint.
5. Palette entries as `r`, `g`, `b` byte triples.
6. Bit-packed cuboids. Each cuboid stores palette index, `x`, `y`, `z`, `w - 1`, `h - 1`, and `d - 1`.

The bit width for each field is derived from the model size or palette size. This keeps tiny assets small without requiring a separate schema table.

## Coordinate Mapping

MagicaVoxel stores cells as `x`, `y`, and `z`. NCM keeps that source-space cuboid data in the encoded payload, then maps it into NiceChunk preview boxes during decode:

- `x` is centered around the model width.
- `z` becomes vertical height.
- `y` is centered and inverted into preview depth.

Consumers that need the original voxel-space cuboids should decode the NCM2 payload before converting it into render boxes.

## Compatibility Rules

- New encoders should emit `NCM2:` unless a caller explicitly needs legacy `NCM1:`.
- Decoders should reject truncated payloads instead of silently filling missing bits with zeroes.
- Palette indexes outside the palette should fall back to white only after the payload has passed structural validation.
- Unknown future prefixes should be treated as unsupported formats, not as NCM1 data.

## Size Expectations

NCM is intended for small game assets such as props, characters, equipment, and block decorations. It is not a replacement for full scene formats. Review generated `.ncm` files before committing them and prefer merge mode for production-style assets.
