import type { ProviderConfig, Message } from './types.js';

export async function chatWithProvider(
  provider: ProviderConfig,
  messages: Message[]
): Promise<{ content: string; model: string }> {
  if (!provider.baseUrl) throw new Error('No base URL');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

  const body = JSON.stringify({
    model: provider.defaultModel,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: provider.temperature,
    max_tokens: provider.maxTokens,
    stream: false,
  });

  // Ollama uses different endpoint
  const url = provider.id === 'ollama'
    ? `${provider.baseUrl}/api/chat`
    : `${provider.baseUrl}/chat/completions`;

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Provider error ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (provider.id === 'ollama' && data.message) {
    return { content: data.message.content, model: data.model };
  }
  if (data.choices?.[0]?.message) {
    return { content: data.choices[0].message.content, model: data.model || provider.defaultModel };
  }

  return { content: JSON.stringify(data), model: provider.defaultModel };
}

export async function sendSingleMessage(
  provider: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string,
  temperatureOverride?: number
): Promise<{ content: string; model: string; tokens?: number }> {
  if (!provider.baseUrl) throw new Error('No base URL');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

  const model = modelOverride || provider.defaultModel;
  const temperature = temperatureOverride !== undefined ? temperatureOverride : provider.temperature;

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: provider.maxTokens,
    stream: false,
  });

  const url = provider.id === 'ollama'
    ? `${provider.baseUrl}/api/chat`
    : `${provider.baseUrl}/chat/completions`;

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Provider error ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (provider.id === 'ollama' && data.message) {
    return { content: data.message.content, model: data.model || model, tokens: data.eval_count };
  }
  if (data.choices?.[0]?.message) {
    return {
      content: data.choices[0].message.content,
      model: data.model || model,
      tokens: data.usage?.total_tokens,
    };
  }

  return { content: JSON.stringify(data), model };
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.models || []).map((m: any) => m.name || m.model || m.id);
  } catch {
    return [];
  }
}

export async function testProvider(config: ProviderConfig): Promise<{ ok: boolean; latency: number; models?: string[] }> {
  const start = Date.now();
  try {
    let models: string[] | undefined;
    if (config.id === 'ollama' && config.baseUrl) {
      models = await listOllamaModels(config.baseUrl);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    const url = config.id === 'ollama'
      ? `${config.baseUrl}/api/generate`
      : `${config.baseUrl}/chat/completions`;
    const body = config.id === 'ollama'
      ? JSON.stringify({ model: config.defaultModel, prompt: 'hi', stream: false })
      : JSON.stringify({ model: config.defaultModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 });

    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    const latency = Date.now() - start;
    if (!res.ok) return { ok: false, latency };
    return { ok: true, latency, models };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}
