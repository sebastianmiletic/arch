import type { ProviderConfig, Message } from './types.js';
export declare function chatWithProvider(provider: ProviderConfig, messages: Message[]): Promise<{
    content: string;
    model: string;
    tokens?: number;
}>;
export declare function sendSingleMessage(provider: ProviderConfig, systemPrompt: string, userPrompt: string, modelOverride?: string, temperatureOverride?: number): Promise<{
    content: string;
    model: string;
    tokens?: number;
}>;
export declare function listOllamaModels(baseUrl: string): Promise<string[]>;
export declare function listProviderModels(provider: ProviderConfig): Promise<string[]>;
export declare function testProvider(config: ProviderConfig): Promise<{
    ok: boolean;
    latency: number;
    models?: string[];
    error?: string;
}>;
