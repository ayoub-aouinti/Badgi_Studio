import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';

// Selected when AI_PROVIDER is unknown or a paid provider has no API key: every generation
// fails with the reason (the job is marked FAILED), instead of the API refusing to start.
@Injectable()
export class UnavailableAiProvider implements AiProvider {
  constructor(private readonly reason: string) {}

  async generate(): Promise<GeneratedPortrait> {
    throw new ServiceUnavailableException(this.reason);
  }
}
