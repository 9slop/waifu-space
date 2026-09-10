// Web Speech API Text-to-Speech Engine

export class SpeechEngine {
  constructor(store) {
    this.store = store;
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.speaking = false;

    if (this.synth) {
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  getVoices() {
    if (!this.synth) return [];
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  speak(text, onStart, onEnd) {
    const settings = this.store.get('settings');
    if (!this.synth || !settings.ttsEnabled) {
      return;
    }

    try {
      this.synth.cancel(); // Stop any pending speech

      // Clean markdown or emojis for smoother TTS audio
      const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                            .replace(/[*_~`#]/g, '')
                            .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.pitch = settings.ttsPitch !== undefined ? settings.ttsPitch : 1.25;
      utterance.rate = settings.ttsRate !== undefined ? settings.ttsRate : 1.0;

      // Try selecting preferred voice or anime/female matching voice
      const voices = this.getVoices();
      if (settings.ttsVoice) {
        const matched = voices.find(v => v.name === settings.ttsVoice || v.voiceURI === settings.ttsVoice);
        if (matched) utterance.voice = matched;
      } else {
        // Auto-detect a pleasant female / Japanese or English voice
        const femaleVoice = voices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Female') || 
          v.name.includes('Ayumi') || 
          v.name.includes('Haruka') || 
          v.name.includes('Zira') || 
          v.name.includes('Jenny')
        );
        if (femaleVoice) utterance.voice = femaleVoice;
      }

      utterance.onstart = () => {
        this.speaking = true;
        if (onStart) onStart();
      };

      utterance.onend = () => {
        this.speaking = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.speaking = false;
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed', e);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.speaking = false;
    }
  }
}
