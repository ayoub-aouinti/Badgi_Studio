import { Injectable, NotImplementedException } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';

// Placeholder adapters for the paid providers (CLAUDE.md AI_PROVIDER=fal|gemini), wired later.
@Injectable()
export class UnavailableAiProvider implements AiProvider {
  constructor(private readonly providerName: string) {}

  async generate(): Promise<Buffer> {
    throw new NotImplementedException(
      `AI_PROVIDER=${this.providerName} is not implemented yet, use AI_PROVIDER=mock.`,
    );
  }
}
