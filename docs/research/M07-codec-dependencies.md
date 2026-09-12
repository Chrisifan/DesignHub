# M07 Codec Dependency Record

Validated 2026-09-12 with the local Node toolchain:

| Package | Version | License | Source and role |
| --- | --- | --- | --- |
| [sharp](https://github.com/lovell/sharp) | 0.34.3 | Apache-2.0 | Node image decode/encode for PNG, JPEG, and WebP; uses prebuilt libvips binaries. |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | Creates ordinary PDF pages and embeds raster PNG/JPEG output. |

The renderer only depends on the structural `CodecAdapter` type. `node-codec.ts` is a main-process adapter and is the only implementation that imports these Node dependencies. No PDF/X, CMYK, or font embedding capability is claimed.
