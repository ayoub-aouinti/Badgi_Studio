import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AI_PROVIDER } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { AnimeGanAiProvider } from './animegan-ai.provider';
import { UnavailableAiProvider } from './unavailable-ai.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER') ?? 'mock';
        if (provider === 'mock') return new MockAiProvider();
        if (provider === 'animegan') {
          const modelPath =
            config.get<string>('ANIMEGAN_MODEL_PATH') || resolve(process.cwd(), 'models/face_paint_512_v2_0.onnx');
          return new AnimeGanAiProvider(modelPath, new MockAiProvider());
        }
        return new UnavailableAiProvider(provider);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
