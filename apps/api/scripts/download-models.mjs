// Downloads the free/local ML models used by the API (not committed to git).
// u2netp: U²-Net portable salient-object segmentation, Apache-2.0
// (https://github.com/xuebinqin/U-2-Net), ONNX export hosted by the rembg project.
// face_paint_512_v2: AnimeGAN2 "face paint" portrait model from bryandlee/animegan2-pytorch
// (repo licensed MIT), ONNX export hosted on Hugging Face (akhaliq/AnimeGANv2-ONNX). Used by
// AI_PROVIDER=animegan — confirm the weights' licence before commercial use.
// version-RFB-320: Ultra-Light-Fast-Generic-Face-Detector-1MB (Linzaer, MIT), ONNX export from
// the ONNX Model Zoo. Locates the face for the local caricature warp (bigger head and eyes).
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
  {
    file: 'face_paint_512_v2_0.onnx',
    url: 'https://huggingface.co/akhaliq/AnimeGANv2-ONNX/resolve/main/face_paint_512_v2_0.onnx',
  },
  {
    file: 'ultraface-rfb-320.onnx',
    url: 'https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx',
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
