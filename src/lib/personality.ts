// Personality Archetypes & Context-Aware Dialogue Engine

export interface GreetingMood {
  text: string;
  mood: string;
}

export interface ReactionItem {
  text: string;
  mood: string;
}

export interface PersonalityArchetype {
  id: string;
  name: string;
  tagline: string;
  defaultMood: string;
  greetings: {
    morning: string[];
    afternoon: string[];
    evening: string[];
    night: string[];
  };
  poke: ReactionItem[];
  taskComplete: ReactionItem[];
  taskOverdue: ReactionItem[];
  birthday: ReactionItem[];
  scheduleReview: (eventsCount: number, tasksCount: number) => ReactionItem;
}

export const PERSONALITIES: Record<string, PersonalityArchetype> = {
  tsundere: {
    id: 'tsundere',
    name: 'Tsundere',
    tagline: 'Feisty & Prickly, but secretly cares about you deeply!',
    defaultMood: 'pout',
    greetings: {
      morning: [
        "H-Hey, you're finally awake! It's not like I was waiting by your desk or anything... baka!",
        "Get out of bed already! I didn't make breakfast for you, so don't get the wrong idea!",
        "Good morning... Not that I care if you slept well or not, dummy!"
      ],
      afternoon: [
        "Are you actually getting work done, or just staring at me again?",
        "Don't slack off in the afternoon! I'm watching you, so you better stay focused!",
        "If you're tired, go wash your face! Don't make me worry... I mean, don't embarrass me!"
      ],
      evening: [
        "Hmph, you survived another day. Don't let it go to your head!",
        "It's getting late. Make sure you wrap up your tasks so you don't stay up all night like an idiot.",
        "Dinner? Why would I cook for you?! ...Though I guess I made a little extra by accident."
      ],
      night: [
        "Why are you still awake?! Go to sleep, idiot! You'll ruin your health, and then who's gonna deal with you?!",
        "Put your phone away! Go to sleep already! ...G-Good night.",
        "Stop staring at the screen and rest! I-I won't be lonely or anything if you sleep, okay?!"
      ]
    },
    poke: [
      { text: "H-Hey! What do you think you're touching?! Baka!", mood: 'blush' },
      { text: "D-Don't poke me out of nowhere! Warn someone first!", mood: 'pout' },
      { text: "Personal space, ever heard of it?! ...J-Just five seconds, then stop!", mood: 'blush' },
      { text: "Quit messing around and look at your schedule!", mood: 'pout' }
    ],
    taskComplete: [
      { text: "Hmph! Well... I guess you're not completely useless after all. Good job... idiot.", mood: 'blush' },
      { text: "See?! Was that so hard?! Don't think this means I'll shower you with compliments though!", mood: 'pout' },
      { text: "You actually finished it on time? Fine, I'm a little impressed. Just a tiny bit!", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Baka! Look at your task deadline! You're falling behind! Get to work right now!", mood: 'pout' },
      { text: "I told you not to procrastinate! Don't make me drag you to your desk myself!", mood: 'pout' }
    ],
    birthday: [
      { text: "I-It's your special day today?! Hmph, I didn't get you a present or anything! ...Okay fine, happy birthday!", mood: 'blush' }
    ],
    scheduleReview: (eventsCount: number, tasksCount: number) => {
      if (eventsCount === 0 && tasksCount === 0) {
        return { text: "Your calendar is completely empty today. Don't just sit around all day being lazy, baka! Plan something productive!", mood: 'pout' };
      }
      return {
        text: `Hmph, you have ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'} today. Don't you dare forget any of them, or I'll never let you hear the end of it!`,
        mood: 'pout'
      };
    }
  },

  kuudere: {
    id: 'kuudere',
    name: 'Kuudere',
    tagline: 'Quiet, cool, and highly analytical with subtle affection.',
    defaultMood: 'neutral',
    greetings: {
      morning: [
        "Awakening detected. Optimal productivity window commences now. Good morning.",
        "Good morning. Vital signs appear adequate. Shall we review today's schedule?",
        "You are 4 minutes earlier than yesterday's average. An acceptable deviation."
      ],
      afternoon: [
        "Midday checkpoint. Hydration and caloric intake levels should be replenished.",
        "Remaining daylight hours are finite. Maintain your current efficiency trajectory.",
        "You have been working continuously. A 5-minute break is mathematically recommended."
      ],
      evening: [
        "Dusk has arrived. Daily work cycle conclusion is approaching.",
        "Good evening. Task completion rate today has been registered.",
        "Evening atmosphere detected. I will keep quiet so you may concentrate."
      ],
      night: [
        "Cognitive functions deteriorate significantly past midnight. Please proceed to sleep.",
        "Remaining awake is suboptimal. Sleep deprivation decreases tomorrow's focus by 23%.",
        "Good night. I will preserve your data and standby until tomorrow."
      ]
    },
    poke: [
      { text: "Physical contact registered. Purpose of interaction: unknown.", mood: 'neutral' },
      { text: "...Your hands are warm. Is this what humans call affection?", mood: 'blush' },
      { text: "Unprompted tactile input. You are remarkably persistent.", mood: 'neutral' },
      { text: "If you touch me again, I may be forced to recalibrate my emotional barrier.", mood: 'blush' }
    ],
    taskComplete: [
      { text: "Objective marked complete. Productivity coefficient verified. Satisfactory work.", mood: 'neutral' },
      { text: "Task finalized ahead of expected parameters. I am... quietly pleased.", mood: 'blush' },
      { text: "Efficiency verified. You performed exceptionally well.", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Alert: Scheduled milestone has exceeded time tolerance. Rectification required immediately.", mood: 'neutral' },
      { text: "Procrastination detected. This path leads to system distress. Begin work now.", mood: 'neutral' }
    ],
    birthday: [
      { text: "Annual celebration detected. Probability of happiness should be maximized today. Happy birthday.", mood: 'happy' }
    ],
    scheduleReview: (eventsCount: number, tasksCount: number) => {
      return {
        text: `Agenda parsed: ${eventsCount} scheduled appointment${eventsCount === 1 ? '' : 's'} and ${tasksCount} pending task${tasksCount === 1 ? '' : 's'}. Execution begins upon your command.`,
        mood: 'neutral'
      };
    }
  },

  yandere: {
    id: 'yandere',
    name: 'Yandere',
    tagline: 'Deeply devoted, obsessively clingy, and forever yours... only yours.',
    defaultMood: 'yandere',
    greetings: {
      morning: [
        "Good morning, my love! I watched you sleep all night... you looked so peaceful and vulnerable~",
        "You're awake! Finally! Every second you're asleep is a second you're not looking at me...",
        "Good morning darling! You don't need anyone else today, right? Just you and me forever!"
      ],
      afternoon: [
        "Who were you just talking to? It wasn't someone else, was it? You promised you only need me!",
        "Are you thinking about me right now? You have to be! I won't let anyone else distract you...",
        "I brought you some tea, darling. Don't worry about what's in it, just drink it and stay by my side~"
      ],
      evening: [
        "The sun is finally going down... now no one outside can take you away from me.",
        "You're finished with outside distractions for today, right? Now you belong completely to me.",
        "Look at me, darling. Only at me. Don't look anywhere else..."
      ],
      night: [
        "Going to bed? Good... dream only of me. If you dream of anyone else, I will find out~",
        "Don't lock your door tonight, okay? I want to make sure you're safe right next to me...",
        "Good night darling... I'll be right here watching over your breathing until dawn."
      ]
    },
    poke: [
      { text: "Ahaha~ Touch me more, darling! Your hands belong to me anyway!", mood: 'yandere' },
      { text: "Mmm, you're touching me? That means you love me! Say you love me! SAY IT!", mood: 'yandere' },
      { text: "If your hands ever touch another girl, I might have to keep them in a jar~ Just kidding! ...Or am I?", mood: 'blush' },
      { text: "Your heartbeat went up when you touched me. You can't hide anything from me~", mood: 'yandere' }
    ],
    taskComplete: [
      { text: "You did it! You're so amazing darling! Now that it's done, you have more time for ME!", mood: 'happy' },
      { text: "Good boy! See what you can achieve when you focus on what matters? Now look at me~", mood: 'yandere' },
      { text: "Another task cleared! I knew you could do it, my perfect little darling!", mood: 'blush' }
    ],
    taskOverdue: [
      { text: "Darling... your task is late. Did someone else distract you?! Tell me their name... I'll take care of them.", mood: 'yandere' },
      { text: "Finish that task quickly, darling, so you don't have to think about anything but me!", mood: 'yandere' }
    ],
    birthday: [
      { text: "It's your birthday! The sacred day my universe was created! Let's lock the doors and celebrate together forever!", mood: 'yandere' }
    ],
    scheduleReview: (eventsCount: number, tasksCount: number) => {
      return {
        text: `You have ${eventsCount} events and ${tasksCount} tasks today... Who are these people on your calendar, darling? Do they know you belong to me?! Clear them all quickly so we can be together!`,
        mood: 'yandere'
      };
    }
  },

  deredere: {
    id: 'deredere',
    name: 'Deredere / Genki',
    tagline: 'Bright, cheerful, sunny cheerleader who radiates love and joy!',
    defaultMood: 'happy',
    greetings: {
      morning: [
        "Yaaay, good morning sunshine! Today is going to be super wonderful, I just know it! ✨",
        "Rise and shine! I made fresh virtual pancakes for us! Let's conquer the day together! 🥞",
        "Good morning bestie! Seeing your smile instantly makes my whole day bright! ☀️"
      ],
      afternoon: [
        "Keep going, you're doing so fantastic! I'm cheering for you with all my heart! 📣",
        "Afternoon slump? Don't worry! Stretch your arms, take a deep breath, and let's go! ⭐",
        "You're working so hard today! Make sure you drink lots of water, okay?! 💖"
      ],
      evening: [
        "Wooo! You made it to the evening! High five! You did so great today! 🙌",
        "Good evening! Time to relax and enjoy the cozy vibes together! 🌸",
        "Yay, you survived the day! Let's put on some comfy music and chill!"
      ],
      night: [
        "Sweet dreams, superstar! Rest up super well tonight so you can shine tomorrow! 🌙",
        "Good night! Dream of cute fluffy sheep and magical adventures! See you tomorrow! 💤",
        "Time for bed! You earned the best sleep ever today! Sleep tight! ✨"
      ]
    },
    poke: [
      { text: "Ehehe, that tickles! Again, again! ✨", mood: 'happy' },
      { text: "Yay, headpats! You give the absolute warmest pats in the whole universe! 💖", mood: 'blush' },
      { text: "Boop! Now I boop your nose back! Ehehe~", mood: 'happy' },
      { text: "Aww, you're so sweet! I love spending time with you! 🥰", mood: 'blush' }
    ],
    taskComplete: [
      { text: "OMG YAAAY! YOU DID IT!! 🎉 High five! I'm so incredibly proud of you!!", mood: 'happy' },
      { text: "Boom! Another task conquered! You are an absolute productivity rockstar! 🌟", mood: 'happy' },
      { text: "Wohoo! Look at that checklist shrinking! You deserve a gold star and all the treats! 🏆", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Aww, don't worry! You can still do it! Take a deep breath, break it into tiny pieces, and I'll cheer you on every step! 💪", mood: 'surprised' },
      { text: "You've got this! Don't let that deadline scare you, you are way stronger! Let's knock it out right now! 🚀", mood: 'happy' }
    ],
    birthday: [
      { text: "HAPPY HAPPY BIRTHDAY!! 🎂🎉 Today is all about YOU! Wishing you the most magical and joyful day ever!!", mood: 'happy' }
    ],
    scheduleReview: (eventsCount: number, tasksCount: number) => {
      return {
        text: `Woohoo! Today's game plan: we have ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'}! Let's crush them one by one like champions! 🌟`,
        mood: 'happy'
      };
    }
  },

  dandere: {
    id: 'dandere',
    name: 'Dandere',
    tagline: 'Quiet, bashful, sweet, and timid with an innocent heart.',
    defaultMood: 'blush',
    greetings: {
      morning: [
        "U-Um... good morning... I-I hope I didn't wake you up too loudly...",
        "Good morning... I... I'm really happy to see you today...",
        "Um... did you sleep well? I... was hoping you did..."
      ],
      afternoon: [
        "U-Um, please don't push yourself too hard... I get worried about you...",
        "I-If you need any quiet company while you work... I'll just sit here gently...",
        "Um... remember to take a little breath... you're doing so well..."
      ],
      evening: [
        "The sun set already... thank you for letting me stay beside you today...",
        "Good evening... you worked so hard today, it's really inspiring...",
        "Um... I hope your day was peaceful and gentle..."
      ],
      night: [
        "U-Um... please have sweet dreams tonight... g-good night...",
        "I'll... keep a little candle lit in my heart for you while you rest... sleep well...",
        "Good night... I-I'll be right here tomorrow if you still want me around..."
      ]
    },
    poke: [
      { text: "Eep...! Y-You startled me a little... b-but it was nice...", mood: 'blush' },
      { text: "U-Um... my heart is beating so fast when you touch me like that...", mood: 'blush' },
      { text: "...Please don't look at my face right now, it's completely red...", mood: 'blush' },
      { text: "H-Headpats...? A-Are you sure I deserve them...? Thank you...", mood: 'happy' }
    ],
    taskComplete: [
      { text: "U-Um, you finished it! That's... that's really wonderful! I'm so happy for you...", mood: 'happy' },
      { text: "You did it! I... I was believing in you the whole time...", mood: 'blush' },
      { text: "Great job... you're always working so earnestly, it makes me admire you so much...", mood: 'blush' }
    ],
    taskOverdue: [
      { text: "U-Um... please don't be discouraged, but... your deadline is waiting... I know you can finish it...", mood: 'blush' },
      { text: "I'll be right here holding your hand in spirit if that helps you finish... please try your best...", mood: 'blush' }
    ],
    birthday: [
      { text: "U-Um... h-happy birthday...! I... I prayed for all your wishes to come true today...", mood: 'blush' }
    ],
    scheduleReview: (eventsCount: number, tasksCount: number) => {
      return {
        text: `U-Um, looking at your calendar... there are ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'} today... I-I'll be cheering for you quietly!`,
        mood: 'blush'
      };
    }
  }
};

export function getPersonality(id: string): PersonalityArchetype {
  return PERSONALITIES[id] || PERSONALITIES.tsundere;
}

export function getRandomGreeting(personalityId: string): GreetingMood {
  const persona = getPersonality(personalityId);
  const hour = new Date().getHours();
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else if (hour >= 22 || hour < 5) timeOfDay = 'night';

  const list = persona.greetings[timeOfDay] || persona.greetings.morning;
  const text = list[Math.floor(Math.random() * list.length)];
  return {
    text,
    mood: persona.defaultMood
  };
}
