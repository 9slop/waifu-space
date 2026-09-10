import { describe, it, expect } from 'vitest';
import { PERSONALITIES, getPersonality } from '../../src/lib/personality';

describe('Character Personalities & Dialogue Engine (personality.ts)', () => {
  const archetypes = ['tsundere', 'kuudere', 'yandere', 'deredere', 'dandere'];

  it('defines all 5 character archetypes with full reaction suites', () => {
    archetypes.forEach(arch => {
      const persona = PERSONALITIES[arch];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(arch);
      expect(persona.name).toBeTruthy();
      expect(persona.tagline).toBeTruthy();
      expect(persona.defaultMood).toBeTruthy();

      // Greetings
      expect(persona.greetings.morning.length).toBeGreaterThan(0);
      expect(persona.greetings.afternoon.length).toBeGreaterThan(0);
      expect(persona.greetings.evening.length).toBeGreaterThan(0);
      expect(persona.greetings.night.length).toBeGreaterThan(0);

      // Reactions
      expect(persona.poke.length).toBeGreaterThan(0);
      expect(persona.taskComplete.length).toBeGreaterThan(0);
      expect(persona.taskOverdue.length).toBeGreaterThan(0);
      expect(persona.birthday.length).toBeGreaterThan(0);
    });
  });

  it('falls back to tsundere when requested archetype is unknown', () => {
    const unknown = getPersonality('nonexistent_persona');
    expect(unknown).toBeDefined();
    expect(unknown.id).toBe('tsundere');
  });

  it('generates contextual schedule review dialogue based on counts', () => {
    archetypes.forEach(arch => {
      const persona = getPersonality(arch);

      // No events or tasks
      const emptyReview = persona.scheduleReview(0, 0);
      expect(emptyReview.text).toBeTruthy();
      expect(emptyReview.mood).toBeTruthy();

      // Active schedule
      const busyReview = persona.scheduleReview(3, 2);
      expect(busyReview.text).toBeTruthy();
      expect(busyReview.mood).toBeTruthy();
    });
  });
});
