import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { CONTENT_MODERATOR, ContentModerator } from './content-moderator.interface';
import { NsfwOnnxModerator } from './nsfw-onnx.moderator';

const acceptAll: ContentModerator = { check: async () => ({ flagged: false }) };

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CONTENT_MODERATOR,
      useFactory: (config: ConfigService): ContentModerator => {
        const driver = config.get<string>('MODERATION_DRIVER') ?? 'local';
        if (driver === 'none') return acceptAll;
        if (driver !== 'local') throw new Error(`Unsupported MODERATION_DRIVER "${driver}" (expected: local or none)`);
        const modelPath = config.get<string>('NSFW_MODEL_PATH') || resolve(process.cwd(), 'models/nsfw-vit-quantized.onnx');
        const threshold = parseFloat(config.get<string>('NSFW_THRESHOLD') ?? '') || 0.8;
        return new NsfwOnnxModerator(modelPath, threshold);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CONTENT_MODERATOR],
})
export class ModerationModule {}
