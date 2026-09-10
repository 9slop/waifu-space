// Optional LLM Provider Integration (Gemini, OpenAI, OpenRouter)

export interface LLMState {
  settings: {
    llmProvider: string;
    llmApiKey: string;
    llmModel: string;
  };
  waifu: {
    personality: string;
    name: string;
  };
}

export async function callLLM(prompt: string, state: LLMState, systemInstruction?: string): Promise<string | null> {
  const settings = state.settings;
  const provider = settings.llmProvider;
  const apiKey = settings.llmApiKey?.trim();

  if (!apiKey || provider === 'none') {
    return null;
  }

  const persona = state.waifu.personality;
  const name = state.waifu.name;

  const fullSystemPrompt = systemInstruction || `
You are ${name}, an anime waifu companion with the ${persona.toUpperCase()} personality archetype.
- Always stay deeply in character as a ${persona}.
- Respond warmly and concisely in 1 to 3 sentences.
- Never break character or mention you are an AI model.
- You care deeply about the user and their schedule/productivity.
`;

  try {
    if (provider === 'gemini') {
      const model = settings.llmModel || 'gemini-1.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 150
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }

    if (provider === 'openai' || provider === 'openrouter') {
      const endpoint = provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1/chat/completions' 
        : 'https://api.openai.com/v1/chat/completions';
      
      const defaultModel = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
      const model = settings.llmModel || defaultModel;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.85
        })
      });

      if (!response.ok) throw new Error(`${provider} error: ${response.statusText}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    console.warn(`LLM call failed (${provider}), falling back to local persona engine:`, err);
    return null;
  }

  return null;
}
