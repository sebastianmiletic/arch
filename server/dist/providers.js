const USER_AGENT = 'Arch-Code-Studio/1.0';
// ─── Helper: build request based on provider type ───
function buildRequest(provider, messages) {
    const headers = { 'Content-Type': 'application/json' };
    let url;
    let body;
    switch (provider.id) {
        case 'ollama': {
            if (!provider.baseUrl)
                throw new Error('No base URL for Ollama');
            // Support both native /api/chat and OpenAI-compatible /v1/chat/completions
            const isOpenAICompat = provider.baseUrl.endsWith('/v1');
            url = isOpenAICompat
                ? `${provider.baseUrl}/chat/completions`
                : `${provider.baseUrl}/api/chat`;
            if (isOpenAICompat) {
                body = JSON.stringify({
                    model: provider.defaultModel,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    temperature: provider.temperature,
                    max_tokens: provider.maxTokens,
                    stream: false,
                });
            }
            else {
                body = JSON.stringify({
                    model: provider.defaultModel,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    stream: false,
                    options: {
                        temperature: provider.temperature,
                        num_predict: provider.maxTokens,
                    },
                });
            }
            break;
        }
        case 'anthropic': {
            if (!provider.baseUrl)
                throw new Error('No base URL for Anthropic');
            url = `${provider.baseUrl}/v1/messages`;
            if (provider.apiKey)
                headers['x-api-key'] = provider.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            // Anthropic uses system as top-level field, not in messages
            const systemMsg = messages.find(m => m.role === 'system');
            const chatMessages = messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));
            const payload = {
                model: provider.defaultModel,
                max_tokens: provider.maxTokens || 4096,
                messages: chatMessages,
                temperature: provider.temperature,
            };
            if (systemMsg)
                payload.system = systemMsg.content;
            body = JSON.stringify(payload);
            break;
        }
        case 'gemini': {
            if (!provider.baseUrl)
                throw new Error('No base URL for Gemini');
            // Gemini uses API key as query param
            const key = provider.apiKey || '';
            url = `${provider.baseUrl}/v1beta/models/${provider.defaultModel}:generateContent?key=${key}`;
            // Convert messages to Gemini contents format
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            }));
            // System instruction is separate
            const systemMsg = messages.find(m => m.role === 'system');
            const payload = { contents };
            if (systemMsg) {
                payload.systemInstruction = { parts: [{ text: systemMsg.content }] };
            }
            body = JSON.stringify(payload);
            break;
        }
        case 'openrouter': {
            if (!provider.baseUrl)
                throw new Error('No base URL for OpenRouter');
            url = `${provider.baseUrl}/chat/completions`;
            if (provider.apiKey)
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
            headers['HTTP-Referer'] = 'https://arch.studio';
            headers['X-Title'] = 'Arch Code Studio';
            body = JSON.stringify({
                model: provider.defaultModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: provider.temperature,
                max_tokens: provider.maxTokens,
                stream: false,
            });
            break;
        }
        case 'nvidia': {
            if (!provider.baseUrl)
                throw new Error('No base URL for NVIDIA');
            url = `${provider.baseUrl}/chat/completions`;
            if (provider.apiKey)
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
            body = JSON.stringify({
                model: provider.defaultModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: provider.temperature,
                max_tokens: provider.maxTokens,
                stream: false,
            });
            break;
        }
        default: {
            // OpenAI-compatible (OpenAI, Local, Custom)
            if (!provider.baseUrl)
                throw new Error('No base URL');
            url = `${provider.baseUrl}/chat/completions`;
            if (provider.apiKey)
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
            body = JSON.stringify({
                model: provider.defaultModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: provider.temperature,
                max_tokens: provider.maxTokens,
                stream: false,
            });
        }
    }
    return { url, headers, body };
}
function parseResponse(providerId, data, fallbackModel) {
    switch (providerId) {
        case 'ollama': {
            // Native Ollama format
            if (data.message?.content) {
                return { content: data.message.content, model: data.model || fallbackModel, tokens: data.eval_count };
            }
            // OpenAI-compatible format (when using /v1 endpoints)
            if (data.choices?.[0]?.message?.content) {
                return { content: data.choices[0].message.content, model: data.model || fallbackModel, tokens: data.usage?.total_tokens };
            }
            break;
        }
        case 'anthropic': {
            if (data.content?.[0]?.text) {
                return { content: data.content[0].text, model: data.model || fallbackModel, tokens: data.usage?.output_tokens };
            }
            break;
        }
        case 'gemini': {
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return { content: data.candidates[0].content.parts[0].text, model: fallbackModel, tokens: data.usageMetadata?.totalTokenCount };
            }
            break;
        }
        default: {
            if (data.choices?.[0]?.message?.content) {
                return { content: data.choices[0].message.content, model: data.model || fallbackModel, tokens: data.usage?.total_tokens };
            }
        }
    }
    return { content: JSON.stringify(data), model: fallbackModel };
}
// ─── Chat ───
export async function chatWithProvider(provider, messages) {
    const { url, headers, body } = buildRequest(provider, messages);
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`Provider error ${res.status}: ${text}`);
    }
    const data = await res.json();
    return parseResponse(provider.id, data, provider.defaultModel);
}
// ─── Single-shot message (system + user) ───
export async function sendSingleMessage(provider, systemPrompt, userPrompt, modelOverride, temperatureOverride) {
    const messages = [
        { id: 'sys', role: 'system', content: systemPrompt, timestamp: new Date().toISOString() },
        { id: 'usr', role: 'user', content: userPrompt, timestamp: new Date().toISOString() },
    ];
    const tempProvider = {
        ...provider,
        defaultModel: modelOverride || provider.defaultModel,
        temperature: temperatureOverride !== undefined ? temperatureOverride : provider.temperature,
    };
    return chatWithProvider(tempProvider, messages);
}
// ─── List Ollama models ───
export async function listOllamaModels(baseUrl) {
    try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok)
            return [];
        const data = await res.json();
        return (data.models || []).map((m) => m.name || m.model || m.id);
    }
    catch {
        return [];
    }
}
// ─── List models for any provider ───
export async function listProviderModels(provider) {
    // Ollama
    if (provider.id === 'ollama' && provider.baseUrl) {
        return listOllamaModels(provider.baseUrl);
    }
    // OpenRouter model list
    if (provider.id === 'openrouter' && provider.apiKey) {
        try {
            const res = await fetch(`${provider.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${provider.apiKey}` },
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok)
                return provider.models || [];
            const data = await res.json();
            return (data.data || []).map((m) => m.id || m.name).filter(Boolean);
        }
        catch {
            return provider.models || [];
        }
    }
    // For others, return the known models from config
    return provider.models || [];
}
// ─── Test provider connection ───
export async function testProvider(config) {
    const start = Date.now();
    try {
        let models;
        let useModel = config.defaultModel;
        if (config.id === 'ollama' && config.baseUrl) {
            models = await listOllamaModels(config.baseUrl);
            if (models.length > 0 && !models.includes(config.defaultModel)) {
                useModel = models[0]; // fall back to first installed model
            }
        }
        if (config.id === 'openrouter' && config.apiKey) {
            models = await listProviderModels(config);
        }
        const testMessages = [
            { id: 'test', role: 'user', content: 'Say "ok" and nothing else.', timestamp: new Date().toISOString() },
        ];
        if (config.id === 'anthropic') {
            testMessages.unshift({ id: 'sys', role: 'system', content: 'You are a test assistant.', timestamp: new Date().toISOString() });
        }
        const tempConfig = { ...config, defaultModel: useModel };
        const { url, headers, body } = buildRequest(tempConfig, testMessages);
        const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        const latency = Date.now() - start;
        if (!res.ok) {
            const text = await res.text().catch(() => 'Unknown error');
            return { ok: false, latency, error: `HTTP ${res.status}: ${text}` };
        }
        const data = await res.json();
        const parsed = parseResponse(config.id, data, useModel);
        return { ok: true, latency, models, error: parsed.content.includes('ok') ? undefined : 'Unexpected response' };
    }
    catch (err) {
        return { ok: false, latency: Date.now() - start, error: err.message };
    }
}
//# sourceMappingURL=providers.js.map