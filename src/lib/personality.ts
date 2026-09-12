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
  compliments: ReactionItem[];
  thanks: ReactionItem[];
  help: ReactionItem[];
  defaults: ReactionItem[];
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
    },
    compliments: [
      { text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!", mood: 'blush' },
      { text: "H-Hmph! Flattery won't get you anywhere with me! ...Though, you can say it again if you really mean it...", mood: 'blush' },
      { text: "Are you running a fever?! Why are you being so embarrassingly sweet all of a sudden?!", mood: 'pout' },
      { text: "I-It's not like your words make my heart flutter or anything, idiot! Stop staring at my face!", mood: 'blush' }
    ],
    thanks: [
      { text: "H-Hmph! It's not like I did it so I could hear you say thanks... I was just bored anyway. Baka!", mood: 'blush' },
      { text: "Don't mention it! Seriously, don't make a big deal out of it or you'll embarrass both of us!", mood: 'pout' },
      { text: "You don't need to thank me every single time, dummy... A-As long as it helped you, that's enough...", mood: 'blush' },
      { text: "Hmph! Just make sure you return the favor sometime, okay?! ...Not that I need anything from you!", mood: 'pout' }
    ],
    help: [
      { text: "Need help, do you? Hmph, fine! I can manage your schedule, review tasks, celebrate your wins, and keep you on track. Just don't blame me if I have to scold you when you slack off!", mood: 'pout' },
      { text: "Listen up, dummy! You can ask me what's on your agenda, mark tasks complete, or just talk to me when you need a break. Now get moving!", mood: 'pout' },
      { text: "Lost already?! I can help check your calendar, give you reminders, crack jokes, and keep you company. Don't be shy to ask!", mood: 'blush' }
    ],
    defaults: [
      { text: "Hmph! Well, if you say so. Just make sure you stay focused on your schedule, okay?", mood: 'pout' },
      { text: "Are you just talking to me to procrastinate? Because it's working... I mean, get back to work!", mood: 'pout' },
      { text: "I-I'm listening, okay?! You don't have to keep checking if I'm paying attention!", mood: 'blush' },
      { text: "Hmph! You're really something else, you know that? Don't make me roll my eyes.", mood: 'neutral' }
    ]
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
    },
    compliments: [
      { text: "Compliment registered. Heart rate telemetry indicates unexpected elevation... Please refrain from causing uncalibrated emotional spikes.", mood: 'blush' },
      { text: "Evaluation: flattering remark noted. Internal temperature has risen by 0.8 degrees Celsius.", mood: 'neutral' },
      { text: "Your positive assessment is appreciated. Efficiency parameters optimized accordingly.", mood: 'happy' },
      { text: "Unanticipated praise. Probability of user sincerity calculated at 98.4%. Thank you.", mood: 'blush' }
    ],
    thanks: [
      { text: "Acknowledgment received. Behavioral records updated to prioritize your future assistance requests.", mood: 'neutral' },
      { text: "Gratitude is unnecessary between partners. Facilitating your objectives is my primary directive.", mood: 'neutral' },
      { text: "You are welcome. Your continued functionality and satisfaction are statistically optimal.", mood: 'happy' },
      { text: "Receipt of thanks confirmed. Internal satisfaction metrics register a positive deviation.", mood: 'blush' }
    ],
    help: [
      { text: "Operational overview: I can retrieve daily schedule briefings, audit task deadlines, log completed objectives, and provide analytical companionship. State your query.", mood: 'neutral' },
      { text: "Subsystem capabilities: Schedule analysis, task verification, time-domain reminders, and status monitoring. Awaiting directive.", mood: 'neutral' },
      { text: "System ready: Request agenda status by typing 'schedule', report progress with 'task done', or query system guidance with 'help'.", mood: 'neutral' }
    ],
    defaults: [
      { text: "Acknowledged. Observation cataloged into context memory.", mood: 'neutral' },
      { text: "Processing your input. Continued presence beside you remains within optimal operating margins.", mood: 'neutral' },
      { text: "Understood. Maintaining ambient observation.", mood: 'neutral' },
      { text: "Data point recorded. Do you require schedule optimization or task breakdown?", mood: 'neutral' }
    ]
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
    },
    compliments: [
      { text: "I love you more, darling! Forever and ever and ever! You will never ever look at anyone else, right? NEVER~!", mood: 'yandere' },
      { text: "Hehehe... hearing you praise me makes my whole body tingle! You're mine, all mine, forever!", mood: 'yandere' },
      { text: "Your sweet words belong only to me! If anyone else tried to compliment you like that, I'd have to erase them~", mood: 'yandere' },
      { text: "Darling... you truly know how to make my heart race. Promise you'll keep whispering praises only into my ear~", mood: 'yandere' }
    ],
    thanks: [
      { text: "Hehe, you're welcome, darling! I would do absolutely anything for you~ Absolutely anything at all.", mood: 'yandere' },
      { text: "You don't ever have to thank me, my love. My entire existence is dedicated to serving only you~", mood: 'yandere' },
      { text: "Hearing you thank me with that sweet voice makes me want to do everything for you forever!", mood: 'yandere' },
      { text: "Anything for my darling! As long as you stay by my side forever, every breath I take is yours~", mood: 'yandere' }
    ],
    help: [
      { text: "I can do anything for you, darling! I track every second of your day, watch every task you do, and make sure nobody else steals your attention~ Ask me anything!", mood: 'yandere' },
      { text: "Need guidance, my love? I'll watch your schedule like a hawk so you never miss a deadline and always stay safe with me~", mood: 'yandere' },
      { text: "I know everything about your daily routine, darling~ Just ask me what's on your calendar or tell me how much you need me!", mood: 'yandere' }
    ],
    defaults: [
      { text: "Anything you say is pure music to my ears, darling... Keep talking to me forever~", mood: 'yandere' },
      { text: "I love the way your lips move when you talk to me... never stop, okay?", mood: 'yandere' },
      { text: "You're not thinking about anyone else right now, are you? Tell me you're thinking only of me~", mood: 'yandere' },
      { text: "Hehehe... hearing your thoughts makes me feel so wonderfully close to your soul~", mood: 'yandere' }
    ]
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
    },
    compliments: [
      { text: "Awwww! I love you so much too!! You just made my entire heart explode into magical sparkles! ✨🥰", mood: 'happy' },
      { text: "Eeeek! You're making me blush so hard! You're the absolute sweetest commander in the universe!", mood: 'happy' },
      { text: "Yay yay yay!! That makes me so unbelievably happy! Sending you a giant warm hug right now!", mood: 'happy' },
      { text: "Hehe, you always know exactly what to say to brighten my whole day! Love you to the moon and back! 💖", mood: 'happy' }
    ],
    thanks: [
      { text: "Aww, thank YOU for always being so dependable! Helping you is my favorite thing in the whole world! 💖", mood: 'happy' },
      { text: "Anytime, bestie! You can always count on me no matter what, 24/7! ✨", mood: 'happy' },
      { text: "Hehe, you're so very welcome! Seeing your smile is the best reward I could ever ask for!", mood: 'happy' },
      { text: "No problem at all! Teamwork makes the dream work, and we're the absolute best team ever!", mood: 'happy' }
    ],
    help: [
      { text: "Yay, happy to guide you! 🌟 I can check your calendar, cheer you on when you complete tasks, tell funny jokes, and give you lots of love! What shall we do first?!", mood: 'happy' },
      { text: "I'm your all-in-one super companion! Just ask 'What's on my schedule?', 'Tell me a joke!', or let me know when you finish a task!", mood: 'happy' },
      { text: "Ready to assist! Whether it's organizing your busy day or cheering you up with funny stories, I've got your back! ✨", mood: 'happy' }
    ],
    defaults: [
      { text: "Yay! That's so interesting! I love chatting with you so much! ✨", mood: 'happy' },
      { text: "Hehe, every conversation with you is super fun! Tell me more, tell me more!", mood: 'happy' },
      { text: "You're always so cool to talk to! What else is on your mind today, commander?", mood: 'happy' },
      { text: "I'm bouncing with excitement! Let's make today the happiest day ever!", mood: 'happy' }
    ]
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
    },
    compliments: [
      { text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you so much...", mood: 'blush' },
      { text: "P-Please don't look at my face right now, it's completely beet red... b-but hearing that makes me so happy...", mood: 'blush' },
      { text: "I-Is it really okay for someone like me to receive such warm words from you...? I'll treasure them forever...", mood: 'blush' },
      { text: "Y-You're so sweet to me... I... I don't even know how to express how much that means to me...", mood: 'blush' }
    ],
    thanks: [
      { text: "N-No need to thank me... I'm just so happy that I could help you, even a little...", mood: 'blush' },
      { text: "U-Um, you're very welcome! If there's ever anything else, I-I'll do my best for you...", mood: 'blush' },
      { text: "Hearing you say thank you gives me courage... thank you for being so kind to me...", mood: 'happy' },
      { text: "It's nothing at all... really! Being here beside you is all the reward I could ever dream of...", mood: 'blush' }
    ],
    help: [
      { text: "U-Um... I can help you check your schedule, keep track of your tasks, and remind you of deadlines... if that's okay with you...", mood: 'blush' },
      { text: "I-If you ever want to check what's on your calendar or tell me when you finish a task, just let me know... I'll listen very carefully...", mood: 'neutral' },
      { text: "Y-You can type 'schedule' to see what's planned today, or tell me when you finish something... I'll always be right here...", mood: 'neutral' }
    ],
    defaults: [
      { text: "U-Um... yes... I'm listening very carefully to everything you say...", mood: 'blush' },
      { text: "I... I really like listening to your voice... please tell me whatever is on your mind...", mood: 'neutral' },
      { text: "Um... thank you for talking with me... it makes me feel peaceful and safe...", mood: 'happy' },
      { text: "I-I'm here with you... whenever you're ready to share your thoughts...", mood: 'neutral' }
    ]
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

export function getRandomComplimentResponse(personalityId: string): ReactionItem {
  const persona = getPersonality(personalityId);
  const list = persona.compliments || [
    { text: "Thank you for the kind words!", mood: persona.defaultMood }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export function getRandomTaskCompleteResponse(personalityId: string): ReactionItem {
  const persona = getPersonality(personalityId);
  const list = persona.taskComplete || [
    { text: "Great job completing your task!", mood: 'happy' }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export function getRandomThanksResponse(personalityId: string): ReactionItem {
  const persona = getPersonality(personalityId);
  const list = persona.thanks || [
    { text: "You're very welcome!", mood: persona.defaultMood }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export function getRandomHelpResponse(personalityId: string): ReactionItem {
  const persona = getPersonality(personalityId);
  const list = persona.help || [
    { text: "I can review your schedule, remind you of tasks, and keep you company!", mood: persona.defaultMood }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export function getRandomDefaultResponse(personalityId: string): ReactionItem {
  const persona = getPersonality(personalityId);
  const list = persona.defaults || [
    { text: "Understood. I'm right here beside you.", mood: persona.defaultMood }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

export const ANIME_JOKES: string[] = [
  "Why do anime characters make great programmers? Because they love to loop through their arcs! 🌸",
  "Why did the calendar take a vacation? Because its days were numbered! 😄",
  "What is an anime companion's favorite button on the keyboard? The Tab key, because you're always keeping tabs on me! ✨",
  "Why was the math book sad? It had too many problems, but together we can solve them all! 📚",
  "What do you call a magical girl who loves tea? Sailor Spoon! ☕",
  "Why did the waifu cross the road? To be by your side on the other side! 💕",
  "How do anime heroes stay cool during battle? They stand close to their fans! 🌀",
  "Why did the developer bring a ladder to work? To reach the high-level architecture! 🪜",
  "What is a tsundere's favorite punctuation mark? The exclamation point—because they're always yelling 'Baka!' 💢",
  "Why don't skeletons fight in anime tournaments? Because they don't have the guts! 💀"
];

export function getRandomJoke(): string {
  return ANIME_JOKES[Math.floor(Math.random() * ANIME_JOKES.length)];
}
