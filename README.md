# 🌸 WaifuSpace

> **Your personal anime companion & Google Calendar planner dashboard.**  
> **Re-engineered with [SolidStart](https://start.solidjs.com/) & [Bun](https://bun.sh/) for ultra-fast reactive performance, SSR/client hydration, and modular component architecture.**

---

## ⚡ Quick Start with Bun

### Prerequisites
- [Bun](https://bun.sh/) (v1.1+) installed on your system.

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Development Server
```bash
bun run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 3. Production Build & Start
```bash
bun run build
bun run start
```

---

## ✨ Features

### 1. 🌸 Interactive Companion Stage (`/`)
- **Layered Anime Vector Avatar (`WaifuAvatar.tsx`)**:
  - Pure SVG vector avatar with switchable hairstyles (*Twintails*, *Long Straight*, *Short Bob*, *Ponytail*, *Wavy Hair*).
  - Customizable hair and eye color palettes with custom color picker.
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

### 2. 📅 Google Calendar Clone with Companion Integration (`/calendar`)
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

### 3. ⚙️ Settings Studio & Customization (`/settings`)
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

## 📁 Architecture & File Structure

```
waifu-space/
├── app.config.ts            # SolidStart configuration
├── package.json             # Bun dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── src/
│   ├── app.tsx              # Root shell layout with navigation, live clock & wallpaper
│   ├── entry-client.tsx     # Client hydration entry
│   ├── entry-server.tsx     # SSR server entry
│   ├── routes/
│   │   ├── index.tsx        # Companion stage route (/)
│   │   ├── calendar.tsx     # Google Calendar planner route (/calendar)
│   │   └── settings.tsx     # Settings studio route (/settings)
│   ├── components/
│   │   ├── WaifuAvatar.tsx         # Reactive layered SVG avatar
│   │   ├── ChatStage.tsx           # Interactive chat & suggestion chips
│   │   ├── CompanionStage.tsx      # Avatar stage layout + affection meter
│   │   ├── CalendarPlanner.tsx     # Calendar shell + sidebar + toolbar
│   │   ├── CalendarMonthView.tsx   # Month grid with drag & drop
│   │   ├── CalendarWeekView.tsx    # Week 24h grid
│   │   ├── CalendarDayView.tsx     # Day 24h agenda
│   │   ├── MiniCalendar.tsx        # Mini calendar sidebar widget
│   │   ├── EventModal.tsx          # Create/edit event modal
│   │   ├── CalendarPopover.tsx     # Quick event popover
│   │   ├── SettingsStudio.tsx      # Settings tabs & appearance customizer
│   │   ├── WallpaperBackground.tsx # Dynamic wallpaper & blur/dim layer
│   │   ├── SakuraCanvas.tsx        # Cherry blossom particle canvas
│   │   └── ToastNotification.tsx   # Floating toast notification
│   ├── lib/
│   │   ├── store.ts         # Solid reactive state store + LocalStorage sync
│   │   ├── personality.ts   # Archetypes & dialogue datasets
│   │   ├── dialogue.ts      # Contextual dialogue engine & schedule checks
│   │   ├── speech.ts        # Web Speech API engine
│   │   ├── wallpapers.ts    # Curated aesthetic wallpapers
│   │   ├── ical.ts          # RFC 5545 iCalendar import/export
│   │   └── llm.ts           # Optional Gemini / OpenAI / OpenRouter API
│   └── styles/
│       ├── themes.css       # Themes, color variables, glassmorphism
│       ├── style.css        # Base layout, nav, toast, scrollbars
│       ├── waifu.css        # Avatar stage, animations, chat bubbles
│       ├── calendar.css     # Google Calendar layout & grid
│       └── settings.css     # Settings studio styles
├── LICENSE
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
