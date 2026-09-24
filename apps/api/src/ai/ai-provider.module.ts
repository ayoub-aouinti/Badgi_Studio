import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
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
        return new UnavailableAiProvider(provider);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
