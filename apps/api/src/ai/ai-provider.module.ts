import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AI_PROVIDER } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { AnimeGanAiProvider } from './animegan-ai.provider';
import { UnavailableAiProvider } from './unavailable-ai.provider';
import { FaceDetector } from './face-detector';
import { CaricatureWarper } from './caricature-warp';
import { FalAiProvider } from './fal-ai.provider';
import { GeminiAiProvider } from './gemini-ai.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER') ?? 'mock';
        const faceModelPath =
          config.get<string>('FACE_DETECTION_MODEL_PATH') || resolve(process.cwd(), 'models/ultraface-rfb-320.onnx');
        const caricature = new CaricatureWarper(new FaceDetector(faceModelPath));
        if (provider === 'mock') return new MockAiProvider(caricature);
        if (provider === 'animegan') {
          const modelPath =
            config.get<string>('ANIMEGAN_MODEL_PATH') || resolve(process.cwd(), 'models/face_paint_512_v2_0.onnx');
          return new AnimeGanAiProvider(modelPath, new MockAiProvider(caricature), caricature);
        }
        const cost = (name: string, fallback: number) => parseFloat(config.get<string>(name) ?? '') || fallback;
        if (provider === 'fal') {
          const apiKey = config.get<string>('FAL_KEY');
          if (!apiKey) return new UnavailableAiProvider('AI_PROVIDER=fal needs FAL_KEY.');
          return new FalAiProvider({
            apiKey,
            model: config.get<string>('FAL_MODEL') || 'fal-ai/flux-pro/kontext',
            costUsd: cost('FAL_COST_USD', 0.04),
          });
        }
        if (provider === 'gemini') {
          const apiKey = config.get<string>('GEMINI_API_KEY');
          if (!apiKey) return new UnavailableAiProvider('AI_PROVIDER=gemini needs GEMINI_API_KEY.');
          return new GeminiAiProvider({
            apiKey,
            model: config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash-image',
            costUsd: cost('GEMINI_COST_USD', 0.039),
          });
        }
        return new UnavailableAiProvider(`Unknown AI_PROVIDER "${provider}" (mock, animegan, fal or gemini).`);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
