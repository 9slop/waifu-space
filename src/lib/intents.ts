// Intent detection engine for the offline dialogue system.
//
// Replaces brittle `str.includes('...')` keyword matching with a small,
// token-aware intent parser: phrases (single and multi-word) are matched
// against synonym dictionaries, weighted by specificity, and a confidence
// score is produced so callers can fall back gracefully when the intent is
// ambiguous or below a threshold.

export type DialogIntent =
  | 'schedule'
  | 'taskComplete'
  | 'greeting'
  | 'compliment'
  | 'joke'
  | 'thanks'
  | 'help'
  | 'default';

export interface IntentMatch {
  intent: DialogIntent;
  /** Normalized confidence in the 0..1 range. 0 means no intent matched. */
  confidence: number;
  /** The specific trigger phrases that fired, for debugging/lexical branching. */
  matchedPhrases: string[];
  /** Normalized (lowercased, punctuation-stripped) input text. */
  normalized: string;
}

export interface IntentDefinition {
  id: DialogIntent;
  /** Trigger phrases (lowercase). Multi-word phrases are weighted higher. */
  phrases: string[];
}

export const INTENT_THRESHOLD = 0.34;

export const INTENT_DEFINITIONS: IntentDefinition[] = [
  {
    id: 'schedule',
    phrases: [
      'schedule',
      'calendar',
      'my agenda',
      'the agenda',
      'my day',
      'plan for today',
      'what is on my calendar',
      "what's on my calendar",
      'what do i have today',
      'today',
      'agenda',
      'tasks today',
      'task list',
      'to do list',
      'todo list',
      'to-do list',
      'what should i do next',
      'whats next',
      "what's next",
      'whats on my schedule',
      'up next',
      'events today',
      'review my day',
      'how many events',
      'how many tasks'
    ]
  },
  {
    id: 'taskComplete',
    phrases: [
      'task done',
      'i finished',
      'i am done',
      "i'm done",
      'i did it',
      'just finished',
      'finished my task',
      'completed my task',
      'completed the task',
      'finished the task',
      'done with that task',
      'done with the task',
      'all done',
      'i got it done',
      'knocked it out',
      'checked it off',
      'accomplished',
      'finished it',
      'completed it',
      'done it',
      'finished all my tasks',
      'task complete'
    ]
  },
  {
    id: 'greeting',
    phrases: [
      'hello',
      'hi there',
      'hey there',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'konnichiwa',
      'ohayo',
      'greetings',
      'welcome back',
      'yo',
      'hi',
      'how are you',
      'how are you doing',
      'whats up',
      "what's up"
    ]
  },
  {
    id: 'compliment',
    phrases: [
      'you look cute',
      'you re cute',
      'you are cute',
      'so cute',
      'you look pretty',
      'you re pretty',
      'you are pretty',
      'beautiful',
      'gorgeous',
      'adorable',
      'i love you',
      'love you',
      'marry me',
      'you re the best',
      'you are the best',
      'you re amazing',
      'you re adorable',
      'pretty',
      'cute',
      'kawaii',
      'you look nice'
    ]
  },
  {
    id: 'joke',
    phrases: [
      'tell me a joke',
      'a joke',
      'make me laugh',
      'say something funny',
      'joke',
      'funny',
      'make me smile',
      'a funny story'
    ]
  },
  {
    id: 'thanks',
    phrases: [
      'thank you',
      'thank you so much',
      'thanks a lot',
      'thanks',
      'thx',
      'i appreciate',
      'you re the best for helping'
    ]
  },
  {
    id: 'help',
    phrases: [
      'what can you do',
      'what do you do',
      'help me',
      'can you help',
      'help',
      'how do i use this',
      'how does this work',
      'what are you capable of'
    ]
  }
];

/** Normalizes raw user input into a lowercase, punctuation-stripped string. */
export function normalizeText(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\u0027\u2018\u2019]/gu, ' ')
    .replace(/['\u2018\u2019]+/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips possessive contractions so "i'm done" and "i m done" both match "i m done"-style phrases. */
function normalizePhrase(phrase: string): string {
  return phrase.replace(/['’]/g, "'").trim();
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function matchesPhrase(text: string, tokens: string[], phrase: string): boolean {
  const p = normalizePhrase(phrase);
  const words = p.split(' ');
  if (words.length === 1) {
    return tokens.includes(p);
  }
  // Multi-word phrases match if they appear verbatim...
  if (text.includes(p)) return true;
  // ...or if every word of the phrase shows up somewhere in the input. This
  // makes "tasks for today" recognize the "tasks today" intent, etc.
  return words.every(w => tokens.includes(w));
}

function phraseWeight(phrase: string): number {
  const words = phrase.split(' ').length;
  return Math.min(4, 1 + Math.ceil(words / 2));
}

/**
 * Parses raw user input into an intent with a confidence score.
 *
 * - Confidence is derived from the weighted phrase hits of the best intent.
 * - Longer / more specific phrases weigh more than single throwaway words.
 * - When nothing matches, the `default` intent is returned with 0 confidence.
 */
export function parseIntent(raw: string): IntentMatch {
  const normalized = normalizeText(raw);
  const tokens = tokenize(normalized);

  let bestId: DialogIntent = 'default';
  let bestScore = 0;
  let bestPhrases: string[] = [];

  for (const def of INTENT_DEFINITIONS) {
    let score = 0;
    const hits: string[] = [];
    for (const phrase of def.phrases) {
      if (matchesPhrase(normalized, tokens, phrase)) {
        hits.push(phrase);
        score += phraseWeight(phrase);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = def.id;
      bestPhrases = hits;
    }
  }

  if (bestScore === 0) {
    return { intent: 'default', confidence: 0, matchedPhrases: [], normalized };
  }

  // Confidence saturates quickly for specific multi-word triggers but stays
  // low for single, generic words so ambiguous chatter still falls back.
  const confidence = Math.min(1, bestScore / 2);

  return {
    intent: bestId,
    confidence,
    matchedPhrases: bestPhrases,
    normalized
  };
}

/** True when the parsed intent is strong enough to act on. */
export function hasIntent(match: IntentMatch, intent: DialogIntent): boolean {
  return match.intent === intent && match.confidence >= INTENT_THRESHOLD;
}