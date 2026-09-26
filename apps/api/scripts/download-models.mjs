// Downloads the free/local ML models used by the API (not committed to git).
// u2netp: U²-Net portable salient-object segmentation, Apache-2.0
// (https://github.com/xuebinqin/U-2-Net), ONNX export hosted by the rembg project.
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const here = dirname(fileURLToPath(import.meta.url));
const modelsDir = resolve(here, '../models');

const MODELS = [
  {
    file: 'u2netp.onnx',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
  },
];

mkdirSync(modelsDir, { recursive: true });

for (const model of MODELS) {
  const target = resolve(modelsDir, model.file);
  if (existsSync(target)) {
    console.log(`✓ ${model.file} already present`);
    continue;
  }
  console.log(`↓ ${model.file} ...`);
  const res = await fetch(model.url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed for ${model.file}: HTTP ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  console.log(`✓ ${model.file}`);
}
