import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, LLMState } from '../../src/lib/llm';

describe('LLM Integration (llm.ts)', () => {
  const baseState: LLMState = {
    settings: {
      llmProvider: 'none',
      llmApiKey: '',
      llmModel: ''
    },
    waifu: {
      personality: 'tsundere',
      name: 'Akari'
    }
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null immediately when provider is none or apiKey is empty', async () => {
    const res1 = await callLLM('Hello', baseState);
    expect(res1).toBeNull();

    const stateWithProviderNoKey: LLMState = {
      ...baseState,
      settings: { ...baseState.settings, llmProvider: 'gemini', llmApiKey: '' }
    };
    const res2 = await callLLM('Hello', stateWithProviderNoKey);
    expect(res2).toBeNull();
  });

  it('formats Gemini payload correctly and parses candidate reply', async () => {
    const geminiState: LLMState = {
      ...baseState,
      settings: {
        llmProvider: 'gemini',
        llmApiKey: 'test-gemini-key',
        llmModel: 'gemini-1.5-flash'
      }
    };

    let capturedUrl = '';
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "B-Baka! Don't look at me like that!" }]
              }
            }
          ]
        })
      };
    });

    const reply = await callLLM('You look cute', geminiState);

    expect(reply).toBe("B-Baka! Don't look at me like that!");
    expect(capturedUrl).toContain('test-gemini-key');
    expect(capturedBody.contents[0].parts[0].text).toBe('You look cute');
    expect(capturedBody.systemInstruction.parts[0].text).toContain('Akari');
  });

  it('formats OpenAI payload correctly and parses message reply', async () => {
    const openaiState: LLMState = {
      ...baseState,
      settings: {
        llmProvider: 'openai',
        llmApiKey: 'test-openai-key',
        llmModel: 'gpt-4o-mini'
      }
    };

    let capturedHeaders: any = null;
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Are you ready for your tasks today?' }
            }
          ]
        })
      };
    });

    const reply = await callLLM('Morning!', openaiState);

    expect(reply).toBe('Are you ready for your tasks today?');
    expect(capturedHeaders['Authorization']).toBe('Bearer test-openai-key');
    expect(capturedBody.model).toBe('gpt-4o-mini');
    expect(capturedBody.messages[1].content).toBe('Morning!');
  });

  it('gracefully returns null fallback when fetch encounters network error', async () => {
    const errorState: LLMState = {
      ...baseState,
      settings: {
        llmProvider: 'gemini',
        llmApiKey: 'test-key',
        llmModel: 'gemini-1.5-flash'
      }
    };

    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const reply = await callLLM('Hello', errorState);
    expect(reply).toBeNull();
  });
});
