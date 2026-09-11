import { describe, it, expect } from 'vitest';
import {
  parseIntent,
  hasIntent,
  normalizeText,
  INTENT_THRESHOLD
} from '../../src/lib/intents';

describe('Intent detection engine (intents.ts)', () => {
  it('normalizes casing, punctuation, and whitespace', () => {
    expect(normalizeText('  Review MY Day!! ')).toBe('review my day');
    expect(normalizeText('What’s on my calendar?')).toBe("what's on my calendar");
    expect(normalizeText('')).toBe('');
  });

  it('detects schedule intent from explicit phrases', () => {
    for (const phrase of ['review my day', "what's on my calendar", 'agenda', 'tasks today', 'my day']) {
      const match = parseIntent(phrase);
      expect(match.intent).toBe('schedule');
      expect(hasIntent(match, 'schedule')).toBe(true);
    }
  });

  it('detects task completion from completed-action phrases', () => {
    for (const phrase of ['i finished my task', "i'm done", 'task complete', 'all done', 'i did it']) {
      expect(parseIntent(phrase).intent).toBe('taskComplete');
    }
  });

  it('detects greetings, compliments, jokes, thanks, and help', () => {
    expect(parseIntent('good morning').intent).toBe('greeting');
    expect(parseIntent('you are cute').intent).toBe('compliment');
    expect(parseIntent('tell me a joke').intent).toBe('joke');
    expect(parseIntent('thank you').intent).toBe('thanks');
    expect(parseIntent('what can you do').intent).toBe('help');
  });

  it('falls back to default with zero confidence for unrelated input', () => {
    const match = parseIntent('the sky is purple');
    expect(match.intent).toBe('default');
    expect(match.confidence).toBe(0);
    expect(match.matchedPhrases).toEqual([]);
  });

  it('reports confidence scores in the 0..1 range', () => {
    const match = parseIntent('you look cute');
    expect(match.confidence).toBeGreaterThanOrEqual(0);
    expect(match.confidence).toBeLessThanOrEqual(1);
  });

  it('exposes matched phrases for debugging', () => {
    const match = parseIntent('help me');
    expect(match.matchedPhrases.length).toBeGreaterThan(0);
  });

  it('hasIntent requires both the intent and the confidence threshold', () => {
    const none = parseIntent('potato salad');
    expect(hasIntent(none, 'default')).toBe(false);
    expect(INTENT_THRESHOLD).toBeGreaterThan(0);
  });

  it('empty or whitespace-only input resolves to default', () => {
    expect(parseIntent('   ').intent).toBe('default');
    expect(parseIntent('').confidence).toBe(0);
  });
});