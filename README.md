# 🌸 WaifuSpace

> **Your personal anime companion & Google Calendar planner dashboard.**

**WaifuSpace** is an all-in-one personal anime companion web application featuring an interactive Waifu with configurable personality archetypes (Tsundere, Kuudere, Yandere, Deredere, Dandere), appearance/clothing customization, a full Google Calendar-style drag-and-drop schedule and task organizer, Japanese aesthetic wallpapers, and rich interface theming.

---

## ✨ Features

### 1. 🌸 Interactive Companion Stage (Main Page)
- **Layered Anime Avatar**: Customizable hairstyles, hair colors, eye colors, outfits (Seifuku, Maid dress, Cozy Hoodie, Kimono/Yukata, Gothic Lolita), and cute accessories (Cat ears, glasses, headphones, ribbons).
- **Dynamic Emotion & Idle Animations**: Gentle breathing, realistic random blinking, talking mouth movement, and contextual facial expressions (blush, angry tsundere pout, eerie yandere gaze, smiling, surprised).
- **Click / Poke Reactions**: Tap or click your companion to prompt live reactions and voice lines.
- **Affection & Bond Progression**: Gain bond EXP as you complete scheduled tasks, chat, and spend time together.
- **Interactive Chat**: Instant offline conversational NLP tailored to her personality archetype, plus quick action chips ("Review Today's Schedule", "Headpat", "Poke", "Compliment").
- **Voice Synthesis (Web Speech API)**: Speaks aloud with configurable voice, pitch, and speed.
- **Custom Avatar Upload**: Upload your own image or animated GIF sprite.

### 2. 📅 Google Calendar Clone with Companion Integration (Calendar Page)
- **Google Calendar Experience**:
  - **Month View**: Complete monthly grid with multi-day layout, event pills, overflow badges, and date switching.
  - **Week View**: Full 7-day 24-hour time grid with current-time red indicator bar and hourly time slots.
  - **Day View**: Detailed single-day agenda planner with hourly time slots.
- **Drag & Drop Rescheduling**:
  - Drag events between days in Month view to reschedule dates.
  - Drag events between time slots and days in Week view.
  - Drag tasks directly from the To-Do sidebar onto the calendar grid.
- **Event Types**: Timed Events, Tasks (with interactive checkboxes and completion strikethrough), Birthdays (with special cake icon and waifu celebration), and Reminders.
- **Waifu Daily Briefing**: Click the "🌸 Waifu Briefing" button to have your companion summarize today's events and tasks in her personality archetype.
- **Task Nagging & Praise**: Companion reminds you when deadlines approach, scolds you if you procrastinate, and showers you with praise when you check off tasks.
- **Import & Export**: Export to standard `.ics` (iCalendar) or JSON backups, and import `.ics` files.

### 3. ⚙️ Settings Studio & Customization (Settings Page)
- **Personality Archetypes**:
  - **Tsundere**: Feisty, calls you "baka", secretly cares deeply about you and your productivity.
  - **Kuudere**: Cold, robotic, analytical, treats your schedule with mathematical precision.
  - **Yandere**: Devoted, possessive, jealous of calendar events with other people ("Who is this person at 3 PM?!").
  - **Deredere / Genki**: Cheerful cheerleader who celebrates every victory with excitement.
  - **Dandere**: Bashful, timid, and sweet encouragement.
- **Japanese Aesthetic Wallpapers**:
  - Curated stock wallpapers: Sakura Shrine, Shibuya Cyber Neon, Mt. Fuji & Pagoda, Rainy Shinjuku, Fushimi Inari Torii, Arashiyama Bamboo, Anime Starry Sky, Cozy Lo-Fi Sunset.
  - Custom image upload / URL support.
  - Adjustable background blur and darkness/dim overlay sliders.
  - Ambient falling cherry blossom (Sakura) petal particle canvas animation.
- **Color Palettes**:
  - *Sakura Blossom* (Soft pink & rose gold)
  - *Cyberpunk Tokyo* (Neon cyan & hot magenta)
  - *Midnight Lavender* (Deep violet & indigo)
  - *Matcha Zen* (Sage green & warm cream)
  - *Sunset Amber* (Warm coral & orange)
  - *AMOLED Dark* (Pure deep black)
  - Custom accent color picker.
- **Optional AI LLM Integration**:
  - Built-in instant offline persona dialogue engine by default (zero configuration required).
  - Optional support for Google Gemini, OpenAI, or OpenRouter API keys for limitless natural AI conversations.
- **Data Backup & Restore**:
  - Full JSON configuration export and restore.
  - One-click factory reset.

---

## 🚀 Getting Started

### Run Locally

WaifuSpace is built with modern ES6+ standards and requires no build steps or heavy dependencies. You can run it with any static web server:

**Using Python (built into Windows/macOS/Linux):**
```bash
# In the project directory:
python -m http.server 8080
```
Then open your browser to [http://localhost:8080](http://localhost:8080).

**Using VS Code Live Server:**
Right-click `index.html` and select **"Open with Live Server"**.

**Using GitHub Pages:**
1. Push to GitHub.
2. Go to **Settings > Pages**.
3. Set Source to **Deploy from branch** (`main` / `/root`).
4. Your companion is live online!

---

## 📁 Project Architecture

```
waifuspace/
├── index.html               # Main single-page application entrypoint
├── css/
│   ├── themes.css           # Color themes, variables, glassmorphism
│   ├── style.css            # Base layouts, navigation, forms, modals, toasts
│   ├── waifu.css            # Waifu stage, avatar animations, chat bubbles
│   ├── calendar.css         # Google calendar clone: month, week, day views, tasks
│   └── settings.css         # Personality studio, wardrobe, wallpaper gallery
├── js/
│   ├── app.js               # Application bootstrap and router
│   ├── state.js             # Global state manager with LocalStorage & bond EXP
│   ├── waifu/
│   │   ├── avatar.js        # Layered SVG avatar renderer with clothes & expressions
│   │   ├── personality.js   # Tsundere, Kuudere, Yandere, Deredere, Dandere profiles
│   │   ├── dialogue.js      # Context-aware chat processor & schedule intent handler
│   │   ├── speech.js        # Web Speech API TTS voice engine
│   │   └── llm.js           # Optional Google Gemini / OpenAI / OpenRouter connector
│   ├── calendar/
│   │   ├── calendar.js      # Google Calendar engine (Month, Week, Day views)
│   │   ├── dragdrop.js      # Drag-and-drop event movement and task rescheduling
│   │   └── ical.js          # .ics iCalendar import and export
│   ├── ui/
│   │   ├── chat.js          # Chat UI, speech bubbles, poking interactions
│   │   ├── settings.js      # Settings page controller
│   │   └── particles.js     # Sakura falling petal particle canvas
│   └── assets/
│       └── wallpapers.js    # Curated Japanese aesthetic wallpapers
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
