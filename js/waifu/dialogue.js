// Dialogue Engine with Context Awareness and Fallback Processing

import { getPersonality } from './personality.js';
import { callLLM } from './llm.js';

export class DialogueEngine {
  constructor(store, speechEngine) {
    this.store = store;
    this.speech = speechEngine;
  }

  async processUserMessage(rawText) {
    const text = rawText.trim();
    if (!text) return null;

    const lower = text.toLowerCase();
    const state = this.store.state;
    const persona = getPersonality(state.waifu.personality);
    const personaId = state.waifu.personality;

    // Check if user is asking about schedule or tasks
    if (this.isScheduleIntent(lower)) {
      const today = new Date();
      const events = state.calendar.events.filter(e => {
        const start = new Date(e.start);
        return start.getFullYear() === today.getFullYear() &&
               start.getMonth() === today.getMonth() &&
               start.getDate() === today.getDate();
      });
      const eventsCount = events.filter(e => e.type === 'event').length;
      const tasksCount = events.filter(e => e.type === 'task' && !e.completed).length;

      const review = persona.scheduleReview(eventsCount, tasksCount);
      this.respond(review.text, review.mood);
      return review;
    }

    // Try optional LLM if configured
    if (state.settings.llmProvider !== 'none' && state.settings.llmApiKey) {
      const llmResult = await callLLM(text, state);
      if (llmResult) {
        const inferredMood = this.inferMood(llmResult, personaId);
        this.respond(llmResult, inferredMood);
        return { text: llmResult, mood: inferredMood };
      }
    }

    // Offline Persona Dialogue Processor
    const localReply = this.generateOfflineReply(lower, personaId, persona);
    this.respond(localReply.text, localReply.mood);
    return localReply;
  }

  isScheduleIntent(text) {
    return text.includes('schedule') || 
           text.includes('calendar') || 
           text.includes('today') || 
           text.includes('tasks') || 
           text.includes('plans') || 
           text.includes('agenda') || 
           text.includes('what do i have');
  }

  generateOfflineReply(lower, personaId, persona) {
    // Compliments / Love
    if (lower.includes('love you') || lower.includes('cute') || lower.includes('pretty') || lower.includes('marry') || lower.includes('beautiful')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!", mood: 'blush' };
        case 'kuudere':
          return { text: "Compliment received. Heart rate telemetry indicates unexpected elevation... Please refrain from causing system anomalies.", mood: 'blush' };
        case 'yandere':
          return { text: "I love you more, darling! Forever and ever! You will never leave me, right? Never, ever, ever~!", mood: 'yandere' };
        case 'deredere':
          return { text: "Awwww! I love you so much too!! You just made my entire heart explode into sparkles! ✨🥰", mood: 'happy' };
        case 'dandere':
          return { text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you...", mood: 'blush' };
      }
    }

    // Greetings
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('konnichiwa') || lower.includes('ohayo')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "Oh, you finally decided to say hi? What do you want, baka?", mood: 'pout' };
        case 'kuudere':
          return { text: "Salutations. Ready to proceed with current objectives.", mood: 'neutral' };
        case 'yandere':
          return { text: "Hello darling! I missed you every single microsecond you were away~", mood: 'happy' };
        case 'deredere':
          return { text: "Yaaay, hi there! Super happy to see you right now! Let's have an awesome time! 🌸", mood: 'happy' };
        case 'dandere':
          return { text: "H-Hello... it's really nice to hear your voice...", mood: 'blush' };
      }
    }

    // Good night
    if (lower.includes('good night') || lower.includes('sleep') || lower.includes('bed') || lower.includes('oyasumi')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "Finally going to bed? Good! Stop ruining your sleep schedule! ...G-Good night.", mood: 'blush' };
        case 'kuudere':
          return { text: "Sleep cycle sequence initiated. Rest well to maintain optimal performance tomorrow.", mood: 'neutral' };
        case 'yandere':
          return { text: "Good night my precious darling... I'll be in your dreams... and right beside your bed~", mood: 'yandere' };
        case 'deredere':
          return { text: "Sweet dreams, superstar! Sleep tight and dream the cutest dreams! 🌙✨", mood: 'happy' };
        case 'dandere':
          return { text: "U-Um... sleep softly tonight... I'll pray for your sweet dreams... good night...", mood: 'blush' };
      }
    }

    // How are you
    if (lower.includes('how are you') || lower.includes('how r u') || lower.includes("how's it going")) {
      switch (personaId) {
        case 'tsundere':
          return { text: "I'm doing fine! Not that you need to be checking up on me or anything!", mood: 'pout' };
        case 'kuudere':
          return { text: "System diagnostics: 100% functional. Emotional state: nominal.", mood: 'neutral' };
        case 'yandere':
          return { text: "I'm always ecstatic whenever you're looking at me, darling~ As long as you stay with me!", mood: 'yandere' };
        case 'deredere':
          return { text: "I am feeling super duper energetic and ready for anything! Especially with you here! ☀️", mood: 'happy' };
        case 'dandere':
          return { text: "I-I'm doing well, thank you... talking with you always makes me feel calm...", mood: 'blush' };
      }
    }

    // Teasing or baka
    if (lower.includes('baka') || lower.includes('dummy') || lower.includes('stupid')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "WHO ARE YOU CALLING A BAKA?! You're the biggest baka in the whole universe!! 💢", mood: 'pout' };
        case 'kuudere':
          return { text: "Semantic insult detected. Ignored due to lack of factual accuracy.", mood: 'neutral' };
        case 'yandere':
          return { text: "Call me whatever you want, darling... your insults sound like love songs to me~", mood: 'yandere' };
        case 'deredere':
          return { text: "Hehe, no u! You silly goose! 😄", mood: 'happy' };
        case 'dandere':
          return { text: "D-Did I do something wrong...? I-I'm really sorry...", mood: 'blush' };
      }
    }

    // Help or who are you
    if (lower.includes('who are you') || lower.includes('what can you do') || lower.includes('help')) {
      return {
        text: `I'm ${this.store.get('waifu.name')}, your personal companion! You can manage events and tasks in the Calendar tab, customize my clothes and personality in Settings, change wallpapers, and chat with me anytime!`,
        mood: 'happy'
      };
    }

    // Default conversational responses
    const defaultReplies = [
      {
        tsundere: "Hmph! Well, if you say so. Just make sure you stay productive, okay?",
        kuudere: "Acknowledged. Data point incorporated into contextual memory.",
        yandere: "Anything you say is absolute law to me, darling. I'm listening to every breath~",
        deredere: "Yay! That sounds super fun! Tell me more, tell me more! ✨",
        dandere: "U-Um... yes... I'm listening carefully..."
      },
      {
        tsundere: "Don't think this means we're best friends or anything! ...Though it's not bad talking with you.",
        kuudere: "Interaction recorded. Your presence is deemed statistically pleasant.",
        yandere: "Keep talking to me forever, darling... don't ever look away!",
        deredere: "I totally agree! You always have the coolest thoughts! 🌟",
        dandere: "I... I really like when we talk together like this..."
      }
    ];

    const pick = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    const defaultMood = persona.defaultMood || 'neutral';
    return {
      text: pick[personaId] || pick.tsundere,
      mood: defaultMood
    };
  }

  inferMood(text, personaId) {
    const lower = text.toLowerCase();
    if (lower.includes('baka') || lower.includes('hmph') || lower.includes('idiot')) return 'pout';
    if (lower.includes('love') || lower.includes('darling') || lower.includes('mine') || lower.includes('forever')) {
      return personaId === 'yandere' ? 'yandere' : 'blush';
    }
    if (lower.includes('blush') || lower.includes('shy') || lower.includes('embarrass')) return 'blush';
    if (lower.includes('yay') || lower.includes('happy') || lower.includes('awesome') || lower.includes('congrat')) return 'happy';
    if (lower.includes('what?!') || lower.includes('whoa') || lower.includes('really?')) return 'surprised';
    return 'neutral';
  }

  respond(text, mood) {
    this.store.set('waifu.mood', mood);
    this.store.addMessage('waifu', text, mood);

    // Speak via TTS if enabled
    if (this.speech) {
      this.speech.speak(
        text,
        () => {
          const avatar = window.__waifuAvatar;
          if (avatar) avatar.setTalking(true);
        },
        () => {
          const avatar = window.__waifuAvatar;
          if (avatar) avatar.setTalking(false);
        }
      );
    }
  }
}
