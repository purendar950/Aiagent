import type { LLMResponse, Message } from '../agent/types.js';

export interface LLMRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Record<string, unknown>[];
  stream?: boolean;
}

export interface LLMProvider {
  name: string;
  models: string[];
  chat(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncGenerator<string>;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private fallbackChain: string[] = ['claude-3-5-sonnet', 'gpt-4o', 'deepseek-coder'];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider());
    }
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider());
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.providers.set('deepseek', new DeepSeekProvider());
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model;
    const provider = this.getProviderForModel(model);

    if (!provider) {
      throw new Error(`No provider available for model: ${model}`);
    }

    try {
      return await provider.chat(request);
    } catch (error) {
      for (const fallbackModel of this.fallbackChain) {
        if (fallbackModel === model) continue;
        try {
          const fallbackProvider = this.getProviderForModel(fallbackModel);
          if (fallbackProvider) {
            return await fallbackProvider.chat({ ...request, model: fallbackModel });
          }
        } catch { /* continue to next fallback */ }
      }
      throw error;
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const model = request.model;
    const provider = this.getProviderForModel(model);

    if (!provider) {
      throw new Error(`No provider available for model: ${model}`);
    }

    yield* provider.stream(request);
  }

  private getProviderForModel(model: string): LLMProvider | undefined {
    if (model.startsWith('claude-')) return this.providers.get('anthropic');
    if (model.startsWith('gpt-')) return this.providers.get('openai');
    if (model.startsWith('deepseek-')) return this.providers.get('deepseek');
    return undefined;
  }

  getAvailableModels(): string[] {
    const models: string[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.models);
    }
    return models;
  }
}

// ─── Provider Implementations ──────────────────────────────────────

class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  models = ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'];

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      tools: request.tools as any,
    });

    const content = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const toolCalls = response.content
      .filter((b: any) => b.type === 'tool_use')
      .map((b: any) => ({
        id: b.id,
        tool: b.name,
        params: b.input,
        riskLevel: 'medium' as const,
        status: 'pending' as const,
      }));

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: request.model,
      finishReason: response.stop_reason || 'end_turn',
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = request.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: (m.metadata?.toolCallId as string) || 'unknown',
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const response = await client.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: messages as any,
      tools: request.tools as any,
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      tool: tc.function.name,
      params: JSON.parse(tc.function.arguments),
      riskLevel: 'medium' as const,
      status: 'pending' as const,
    }));

    return {
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      model: request.model,
      finishReason: choice.finish_reason || 'stop',
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = request.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: (m.metadata?.toolCallId as string) || 'unknown',
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const stream = await client.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: messages as any,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';
  models = ['deepseek-coder', 'deepseek-chat'];

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    const messages = request.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: (m.metadata?.toolCallId as string) || 'unknown',
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const response = await client.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: messages as any,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || '',
      usage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      model: request.model,
      finishReason: choice.finish_reason || 'stop',
    };
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    const messages = request.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: (m.metadata?.toolCallId as string) || 'unknown',
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const stream = await client.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      messages: messages as any,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
