// Dialogue Engine with Rich Offline Fallbacks, Context Awareness & Dynamic Reply Chips

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

    // 1. Check if user is asking about schedule or tasks
    if (this.isScheduleIntent(lower)) {
      const scheduleResult = this.generateScheduleResponse(state, personaId, persona);
      this.respond(scheduleResult.text, scheduleResult.mood, scheduleResult.suggestions);
      return scheduleResult;
    }

    // 2. Try optional LLM if configured and an API key exists
    if (state.settings.llmProvider !== 'none' && state.settings.llmApiKey) {
      const llmResult = await callLLM(text, state);
      if (llmResult) {
        const inferredMood = this.inferMood(llmResult, personaId);
        const dynamicSuggestions = this.generateContextualSuggestions(lower, personaId);
        this.respond(llmResult, inferredMood, dynamicSuggestions);
        return { text: llmResult, mood: inferredMood, suggestions: dynamicSuggestions };
      }
    }

    // 3. Fallback to Extensive Pre-Made Responses and Replies
    const localReply = this.generateOfflineReply(lower, personaId, persona);
    this.respond(localReply.text, localReply.mood, localReply.suggestions);
    return localReply;
  }

  isScheduleIntent(text) {
    return text.includes('schedule') || 
           text.includes('calendar') || 
           text.includes('today') || 
           text.includes('task') || 
           text.includes('plans') || 
           text.includes('agenda') || 
           text.includes('what do i have');
  }

  generateScheduleResponse(state, personaId, persona) {
    const today = new Date();
    const isSameDay = (d1, d2) => 
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const todayEvents = state.calendar.events.filter(e => isSameDay(new Date(e.start), today));
    const events = todayEvents.filter(e => e.type === 'event');
    const tasks = todayEvents.filter(e => e.type === 'task');
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    let details = '';
    if (todayEvents.length > 0) {
      const titles = todayEvents.map(e => `• ${e.title} (${e.type}${e.completed ? ' - Done' : ''})`).slice(0, 3).join(' ');
      details = ` Upcoming: ${titles}`;
    }

    let text = '';
    let mood = persona.defaultMood;

    switch (personaId) {
      case 'tsundere':
        if (todayEvents.length === 0) {
          text = "Your calendar is completely empty today! Don't you dare slack off all day, baka! Go add something productive right now!";
          mood = 'pout';
        } else {
          text = `H-Hmph! You have ${events.length} event${events.length === 1 ? '' : 's'} and ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'} today.${details} Don't make me nag you about them, idiot!`;
          mood = 'pout';
        }
        break;

      case 'kuudere':
        text = `Agenda parsed: ${events.length} event(s), ${pendingTasks.length} pending task(s), and ${completedTasks.length} completed task(s).${details} Execution status: pending user action.`;
        mood = 'neutral';
        break;

      case 'yandere':
        text = `You have ${todayEvents.length} items on your calendar today...${details} Make sure you finish them all swiftly, darling, so nobody steals your attention from ME~`;
        mood = 'yandere';
        break;

      case 'deredere':
        text = `Woohoo! Today's mission: ${events.length} fun event(s) and ${pendingTasks.length} exciting task(s) to conquer!${details} You've got this, superstar! I'm cheering for you! 🌟`;
        mood = 'happy';
        break;

      case 'dandere':
        text = `U-Um... looking at today's schedule... you have ${events.length} event(s) and ${pendingTasks.length} task(s)...${details} P-Please do your best, I'll be quietly supporting you...`;
        mood = 'blush';
        break;
    }

    return {
      text,
      mood,
      suggestions: [
        "I finished a task!",
        "Cheer me on!",
        "What should I do next?",
        "You look cute today"
      ]
    };
  }

  generateOfflineReply(lower, personaId, persona) {
    // Compliments / Love
    if (lower.includes('love') || lower.includes('cute') || lower.includes('pretty') || lower.includes('marry') || lower.includes('beautiful') || lower.includes('adorable')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!",
            mood: 'blush',
            suggestions: ["You're blushing!", "It's true though", "Review my schedule", "Headpat"]
          };
        case 'kuudere':
          return {
            text: "Compliment registered. Heart rate telemetry indicates unexpected elevation... Please refrain from causing uncalibrated emotional spikes.",
            mood: 'blush',
            suggestions: ["Did I make you nervous?", "You're doing great", "Check schedule", "Thank you"]
          };
        case 'yandere':
          return {
            text: "I love you more, darling! Forever and ever and ever! You will never ever look at anyone else, right? NEVER~!",
            mood: 'yandere',
            suggestions: ["Only you, darling", "What are you doing today?", "Review schedule", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Awwww! I love you so much too!! You just made my entire heart explode into magical sparkles! ✨🥰",
            mood: 'happy',
            suggestions: ["High five!", "Let's do our best!", "Check calendar", "Tell me a joke"]
          };
        case 'dandere':
          return {
            text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you so much...",
            mood: 'blush',
            suggestions: ["You're precious", "Headpat", "Review schedule", "Are you happy?"]
          };
      }
    }

    // Task completion feedback
    if (lower.includes('done') || lower.includes('finished') || lower.includes('completed') || lower.includes('i did it')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Hmph! Well... I guess you're not completely useless after all. Good job... dummy. Don't let it go to your head!",
            mood: 'blush',
            suggestions: ["Give me praise!", "What's next on calendar?", "Headpat", "Thanks Akari!"]
          };
        case 'kuudere':
          return {
            text: "Task completion logged into telemetry. Productivity quotient increased. Outstanding performance.",
            mood: 'happy',
            suggestions: ["Check next task", "Time for a break?", "Review schedule", "Headpat"]
          };
        case 'yandere':
          return {
            text: "You finished it for ME?! Ahaha, you're the most wonderful darling in existence! Now give all your attention to me~",
            mood: 'yandere',
            suggestions: ["All for you~", "Check calendar", "You're cute", "Headpat"]
          };
        case 'deredere':
          return {
            text: "OMG YAAAY!! 🎉 Look at you go, absolute productivity champion! High five!! I'm so proud of you!!",
            mood: 'happy',
            suggestions: ["High five!", "What's my next task?", "You're the best!", "Time for coffee"]
          };
        case 'dandere':
          return {
            text: "U-Um, you finished it! That's... that's so impressive! You always work so earnestly, I admire you so much...",
            mood: 'blush',
            suggestions: ["Thank you!", "Headpat", "Check calendar", "How are you feeling?"]
          };
      }
    }

    // Greetings
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('konnichiwa') || lower.includes('ohayo')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Oh, you finally decided to say hi? What do you want, baka? Don't tell me you forgot your tasks already!",
            mood: 'pout',
            suggestions: ["What's my schedule today?", "You look cute!", "Poke", "Just wanted to say hi"]
          };
        case 'kuudere':
          return {
            text: "Salutations. System ready to assist with daily operations and schedule tracking.",
            mood: 'neutral',
            suggestions: ["Review today's schedule", "How are my tasks?", "Check efficiency", "Headpat"]
          };
        case 'yandere':
          return {
            text: "Hello darling! I missed you every single microsecond you were away~ You didn't talk to any other girls, right?",
            mood: 'happy',
            suggestions: ["Only you!", "Review today's schedule", "You're cute", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Yaaay, hello superstar! Super happy to see you right now! Let's have an amazing and productive day! 🌸✨",
            mood: 'happy',
            suggestions: ["What's on my calendar?", "Let's conquer today!", "Tell me a joke", "You're awesome"]
          };
        case 'dandere':
          return {
            text: "H-Hello... it's really gentle and nice to hear your voice today... u-um, how are you...?",
            mood: 'blush',
            suggestions: ["I'm doing well!", "Review schedule", "Headpat", "You look adorable"]
          };
      }
    }

    // Tired / Stressed / Motivation
    if (lower.includes('tired') || lower.includes('stressed') || lower.includes('exhausted') || lower.includes('motivation') || lower.includes('help me')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Tired already?! ...Fine, take a short breather! Drink some water! It's not like I'm worried about you or anything, but don't collapse on me!",
            mood: 'blush',
            suggestions: ["Thanks for caring", "Check tasks", "Headpat", "I feel better now"]
          };
        case 'kuudere':
          return {
            text: "Bio-telemetry indicates fatigue. Recommended protocol: 5 minutes of mindful respiration and hydration intake. I will maintain your post.",
            mood: 'neutral',
            suggestions: ["Taking a break now", "Review schedule", "Thanks for watching out", "Headpat"]
          };
        case 'yandere':
          return {
            text: "Tired, darling? Lean your head right on my lap... I will stroke your hair forever and keep the outside world away from you~",
            mood: 'yandere',
            suggestions: ["Lap pillow sounds nice", "Check calendar", "You're sweet", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Aww, you've been working so hard! Take a big stretch and a deep breath! You are doing amazing, and I'm sending you all my energy! 💖💪",
            mood: 'happy',
            suggestions: ["Thanks for cheering me up!", "Review calendar", "High five", "Headpat"]
          };
        case 'dandere':
          return {
            text: "U-Um... please don't push yourself beyond your limits... I-If you want, I can sit quietly beside you until you feel refreshed...",
            mood: 'blush',
            suggestions: ["Please stay with me", "Headpat", "Check schedule", "Thank you"]
          };
      }
    }

    // Joke / Entertainment
    if (lower.includes('joke') || lower.includes('funny') || lower.includes('laugh')) {
      const jokes = [
        "Why do anime characters make great programmers? Because they love to loop through their arcs! 🌸",
        "Why did the calendar take a vacation? Because its days were numbered! 😄",
        "What is an anime companion's favorite button on the keyboard? The Tab key, because you're always keeping tabs on me! ✨"
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      return {
        text: joke,
        mood: 'happy',
        suggestions: ["Haha that was good!", "Tell another!", "Review schedule", "You're cute"]
      };
    }

    // Anime / Hobbies
    if (lower.includes('anime') || lower.includes('manga') || lower.includes('game') || lower.includes('watch')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Anime recommendations? H-Hmph, Toradora is a classic masterpiece, obviously! Not that I relate to Taiga Aisaka or anything, baka!",
            mood: 'pout',
            suggestions: ["You're totally a tsundere!", "Check schedule", "What about gaming?", "Headpat"]
          };
        case 'kuudere':
          return {
            text: "Analysis indicates Steins;Gate, Violet Evergarden, and Frieren maintain optimal narrative and emotional coherence ratings.",
            mood: 'neutral',
            suggestions: ["Great choices", "Review schedule", "Headpat", "Tell me more"]
          };
        case 'yandere':
          return {
            text: "Future Diary (Mirai Nikki)! Gasai Yuno knows true devoted love! But my love for you is ten billion times stronger, darling~",
            mood: 'yandere',
            suggestions: ["A little scary but cute", "Check calendar", "You're sweet", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Bocchi the Rock! and Spy x Family! They are so heartwarming and hilarious, they always put me in the best mood! 🍿✨",
            mood: 'happy',
            suggestions: ["I love those too!", "Check schedule", "High five!", "What's next?"]
          };
        case 'dandere':
          return {
            text: "U-Um... A Silent Voice (Koe no Katachi) and Komi Can't Communicate... they touch my heart so deeply...",
            mood: 'blush',
            suggestions: ["Beautiful picks", "Headpat", "Review schedule", "You have good taste"]
          };
      }
    }

    // Good night / Sleep
    if (lower.includes('good night') || lower.includes('sleep') || lower.includes('bed') || lower.includes('oyasumi')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Finally going to bed? Good! Don't you dare stay up on your phone! ...G-Good night. Sleep well, idiot.",
            mood: 'blush',
            suggestions: ["Good night Akari", "See you tomorrow!", "Headpat", "Sweet dreams"]
          };
        case 'kuudere':
          return {
            text: "Sleep cycle sequence initiated. Sleep deprivation degrades next-day analytical throughput. Good night.",
            mood: 'neutral',
            suggestions: ["Good night", "See you tomorrow", "Headpat", "Rest well"]
          };
        case 'yandere':
          return {
            text: "Good night my precious darling... Dream only of me. I'll be watching over your soft breathing all night long~",
            mood: 'yandere',
            suggestions: ["Good night darling", "Sweet dreams", "Headpat", "See you tomorrow"]
          };
        case 'deredere':
          return {
            text: "Sweet dreams, superstar! Sleep super cozy and rest up for another awesome day tomorrow! 🌙✨💤",
            mood: 'happy',
            suggestions: ["Good night!", "Sweet dreams", "See you tomorrow!", "High five"]
          };
        case 'dandere':
          return {
            text: "U-Um... please have the sweetest dreams tonight... I'll pray for your peaceful rest... g-good night...",
            mood: 'blush',
            suggestions: ["Good night", "Sweet dreams", "Headpat", "Thank you"]
          };
      }
    }

    // Default conversational fallbacks
    const conversationalPool = [
      {
        tsundere: "Hmph! Well, if you say so. Just make sure you stay focused on your schedule, okay?",
        kuudere: "Acknowledged. Observation cataloged into context memory.",
        yandere: "Anything you say is pure music to my ears, darling... Keep talking to me forever~",
        deredere: "Yay! That's so interesting! I love chatting with you so much! ✨",
        dandere: "U-Um... yes... I'm listening very carefully to everything you say..."
      },
      {
        tsundere: "Don't think chatting with me gives you an excuse to slack off! But... it's not the worst thing in the world.",
        kuudere: "Query evaluated. Interaction status: constructive and pleasant.",
        yandere: "Your voice belongs to me, darling... Never speak to another girl like this~",
        deredere: "Hehe! You always have the coolest thoughts! What should we tackle next?! 🌟",
        dandere: "I... I really treasure when we share moments like this together..."
      }
    ];

    const pick = conversationalPool[Math.floor(Math.random() * conversationalPool.length)];
    return {
      text: pick[personaId] || pick.tsundere,
      mood: persona.defaultMood,
      suggestions: [
        "Review today's schedule",
        "How are you doing?",
        "You look cute today",
        "Tell me an anime recommendation"
      ]
    };
  }

  generateContextualSuggestions(text, personaId) {
    return [
      "Review today's schedule",
      "I finished a task!",
      "You look cute today",
      "Tell me a joke"
    ];
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

  respond(text, mood, suggestions = null) {
    this.store.set('waifu.mood', mood);
    const msg = this.store.addMessage('waifu', text, mood);

    // If suggestions provided, broadcast to UI
    if (suggestions && suggestions.length > 0) {
      this.store.notify('chat.suggestions', suggestions);
    }

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
