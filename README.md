# 🌸 WaifuSpace

> **Your personal anime companion & Google Calendar planner dashboard.**
> **Zero dependencies. No Node.js. No npm. Just open `index.html` in your browser!**

---

## ⚡ How to Run (Instant & Zero Setup)

You **do not** need Node.js, npm, or any terminal commands. 

### Method 1: Just Double-Click (Recommended)
1. Open this folder in your File Explorer.
2. Double-click **`index.html`** (or right-click -> Open with Chrome / Edge / Firefox / Brave).
3. That's it! The application automatically loads all CSS styles, animations, Japanese wallpapers, audio synthesis, personality engine, and the Google Calendar planner.

### Method 2: GitHub Pages (Online)
1. In your GitHub repository settings, go to **Settings > Pages**.
2. Under **Build and deployment > Branch**, select `main` and `/ (root)`, then click **Save**.
3. Your companion dashboard will be live on the web at `https://<username>.github.io/waifu-space/`.

### Method 3: Optional Local HTTP Server (If desired)
If you prefer running through a local web server:
```bash
# Python (built into Windows, macOS, Linux):
python -m http.server 8080
```
Then visit `http://localhost:8080`.

---

## ✨ Features Breakdown

### 1. 🌸 Interactive Companion Stage (Main Page)
- **Layered Anime Vector Avatar**:
  - Modular SVG avatar with switchable hairstyles (*Twintails*, *Long Straight*, *Short Bob*, *Ponytail*, *Wavy Hair*).
  - Customizable hair and eye color palettes.
  - Outfits: *🏫 Sailor Seifuku*, *☕ Maid Uniform*, *🛋️ Cozy Hoodie*, *👘 Summer Kimono/Yukata*, *🥀 Gothic Lolita*.
  - Accessories: *🎀 Ribbon*, *🐱 Nekomimi Cat Ears*, *👓 Red-rim Glasses*, *🎧 Cyber Headphones*.
  - Reactive facial expressions: *Blush*, *Tsundere Pout*, *Yandere Eyes*, *Sparkling Happy*, *Surprised*, *Neutral*.
  - Realistic idle animations: gentle breathing, random natural blinking, and mouth-moving speech animation.
  - Custom Sprite Upload: upload your own character image or animated GIF.
- **Affection & Progression**:
  - Earn Bond EXP and level up as you chat (+5 EXP), interact/poke (+8 EXP), and complete tasks (+15 EXP).
- **Interactive Chat & Poke Stage**:
  - Tap or click avatar for tactile reactions and bounce animation.
  - Floating anime speech bubble with pointer tail that updates with her dialogue.
  - Quick action chips for instant interactions (*Headpat*, *Poke*, *Review Schedule*, *Compliment*).
- **Voice Synthesis (Web Speech API)**:
  - Waifu speaks out loud with configurable voice, pitch, and speed.

---

### 2. 📅 Google Calendar Clone with Companion Integration (Calendar Page)
- **Google Calendar Experience**:
  - **Month View**: Full monthly grid with multi-day layout, event pills, overflow badges, and date switching.
  - **Week View**: Full 7-day 24-hour time grid with current-time red indicator bar and hourly time slots.
  - **Day View**: Detailed single-day agenda planner with hourly time slots.
  - Navigation: Previous (`◀`), Next (`▶`), and `Today` quick jumps.
- **Drag & Drop Rescheduling**:
  - Drag events between days in Month view to reschedule dates.
  - Drag events across hours and days in Week view.
  - Drag tasks directly from the To-Do sidebar onto the calendar grid.
- **Event Types**:
  - **Events**: Timed appointments with color tags, locations, and descriptions.
  - **Tasks**: Checkbox items that cross out when marked complete, rewarding bond EXP and triggering companion praise.
  - **Birthdays**: Annual birthday events with cake icons and waifu celebrations.
- **Companion Integration**:
  - **Waifu Briefing Button**: Companion evaluates today's agenda and gives a customized daily briefing in her archetype voice.
  - **Proactive Reminders**: Companion alerts you when a task deadline is approaching within 15 minutes.
- **Import & Export**:
  - Standard `.ics` (iCalendar) export and import.
  - Full JSON backup export and restore.

---

### 3. ⚙️ Settings Studio & Customization (Settings Page)
- **5 Personality Archetypes**:
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
  - *🌸 Sakura Blossom* (Soft pink & rose gold)
  - *⚡ Cyberpunk Tokyo* (Neon cyan & hot magenta)
  - *🌌 Midnight Lavender* (Deep violet & indigo)
  - *🍵 Matcha Zen* (Sage green & warm cream)
  - *🌇 Sunset Amber* (Warm coral & orange)
  - *🖤 AMOLED Dark* (Pure deep black)
  - Custom accent color picker.
- **Optional AI LLM Integration**:
  - Built-in instant offline persona dialogue engine by default (zero configuration required).
  - Optional support for Google Gemini, OpenAI, or OpenRouter API keys for limitless natural AI conversations.
- **Data Backup & Restore**:
  - Full JSON configuration export and restore.
  - One-click factory reset.

---

## 📁 File Structure

```
waifu-space/
├── index.html               # Main application entrypoint (double-click to run!)
├── css/
│   ├── themes.css           # Color themes, variables, glassmorphism
│   ├── style.css            # Base layouts, navigation, forms, modals, toasts
│   ├── waifu.css            # Waifu stage, avatar animations, chat bubbles
│   ├── calendar.css         # Google calendar clone: month, week, day views, tasks
│   └── settings.css         # Personality studio, wardrobe, wallpaper gallery
├── js/
│   ├── bundle.js            # Standalone browser bundle (no node/npm required)
│   ├── app.js               # Application bootstrap
│   ├── state.js             # Global state manager with LocalStorage & bond EXP
│   ├── waifu/               # Avatar generator, personalities, dialogue, speech, LLM
│   ├── calendar/            # Google calendar views, drag-and-drop, iCal import/export
│   ├── ui/                  # Chat stage, settings controller, sakura particles
│   └── assets/              # Curated Japanese aesthetic wallpapers
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
