import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';

export class FetchUrlTool implements Tool {
  name = 'fetch_url';
  description = 'Fetch content from a URL';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'string', description: 'Request body' },
    },
    required: ['url'],
  };

  async execute(params: Record<string, unknown>, _context: AgentContext) {
    const url = params.url as string;
    const method = (params.method as string) || 'GET';
    const headers = (params.headers as Record<string, string>) || {};
    const body = params.body as string | undefined;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    return {
      output: text,
      metadata: { url, status: response.status, contentType: response.headers.get('content-type') },
    };
  }
}
