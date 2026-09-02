/**
 * SpeechService - Web Speech API Wrapper
 * SpeechRecognition (fr-FR) & SpeechSynthesis (French Voice & Rate control)
 */

const SpeechService = {
  recognition: null,
  isListening: false,
  frenchVoices: [],
  selectedVoice: null,
  currentRate: 1.0,

  init() {
    this.initVoices();
    this.initRecognition();
  },

  isRecognitionSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  isSynthesisSupported() {
    return 'speechSynthesis' in window;
  },

  initVoices() {
    if (!this.isSynthesisSupported()) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      this.frenchVoices = voices.filter(v => v.lang.startsWith('fr'));

      // Preference matching for natural French voices
      const prefs = (window.CONFIG && window.CONFIG.VOICE_NAME_PREFERENCES) || ['Thomas', 'Amelie', 'Nicolas', 'Virginie', 'Google français', 'French'];
      let matched = null;
      for (const pref of prefs) {
        matched = this.frenchVoices.find(v => v.name.toLowerCase().includes(pref.toLowerCase()));
        if (matched) break;
      }
      this.selectedVoice = matched || this.frenchVoices[0] || null;
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  },

  initRecognition() {
    if (!this.isRecognitionSupported()) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = (window.CONFIG && window.CONFIG.SPEECH_LANG) || 'fr-FR';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
  },

  startListening({ onResult, onInterim, onStart, onEnd, onError }) {
    if (!this.isRecognitionSupported()) {
      if (onError) onError(new Error('Trình duyệt của bạn không hỗ trợ Web SpeechRecognition (Hãy dùng Chrome hoặc Edge).'));
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.initRecognition();

    this.recognition.onstart = () => {
      this.isListening = true;
      if (onStart) onStart();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      if (interimTranscript && onInterim) {
        onInterim(interimTranscript);
      }

      if (finalTranscript && onResult) {
        onResult(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      console.warn('Speech recognition error:', event.error);
      if (onError) onError(event);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      if (onError) onError(e);
    }
  },

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error(e);
      }
      this.isListening = false;
    }
  },

  // Speech Synthesis (Text-to-Speech)
  speak(text, { rate = 1.0, pitch = 1.0, onStart, onEnd, onError } = {}) {
    if (!this.isSynthesisSupported()) {
      if (onError) onError(new Error('Trình duyệt không hỗ trợ SpeechSynthesis'));
      return;
    }

    this.stopSpeaking();

    // Clean text: strip markdown, parenthetical notes, or Vietnamese remarks if any leaked
    const cleanText = text
      .replace(/Nhận xét:[\s\S]*$/i, '')
      .replace(/Remarque:[\s\S]*$/i, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = (window.CONFIG && window.CONFIG.SPEECH_LANG) || 'fr-FR';
    utterance.rate = rate || this.currentRate || 1.0;
    utterance.pitch = pitch || 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else if (this.frenchVoices.length > 0) {
      utterance.voice = this.frenchVoices[0];
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    window.speechSynthesis.speak(utterance);
  },

  stopSpeaking() {
    if (this.isSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  },

  setVoice(voiceName) {
    const voice = this.frenchVoices.find(v => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice;
    }
  }
};

window.SpeechService = SpeechService;
