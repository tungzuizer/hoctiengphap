/**
 * ListeningModule - Compréhension Orale
 * Audio-first French listening exercises with Web Speech TTS, rate control & MCQs
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const ListeningModule = {
  currentExercise: null,
  userAnswers: {},
  isSubmitted: false,
  isLoading: false,
  isPlaying: false,
  speechRate: 1.0,

  init() {
    this.bindEvents();
    this.populateSeedOptions();
  },

  bindEvents() {
    const generateBtn = document.getElementById('btn-generate-listening');
    const submitBtn = document.getElementById('btn-submit-listening');
    const playBtn = document.getElementById('btn-play-audio');
    const toggleTranscriptBtn = document.getElementById('btn-toggle-transcript');
    const rateBtns = document.querySelectorAll('.btn-rate-option');

    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateNewExercise());
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitAnswers());
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => this.playAudio());
    }

    if (toggleTranscriptBtn) {
      toggleTranscriptBtn.addEventListener('click', () => this.toggleTranscript());
    }

    if (rateBtns) {
      rateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          rateBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.speechRate = parseFloat(btn.dataset.rate) || 1.0;
        });
      });
    }
  },

  populateSeedOptions() {
    const selectEl = document.getElementById('listening-seed-select');
    if (!selectEl) return;

    const seeds = window.StateManager.getSeeds();
    selectEl.innerHTML = `
      <option value="">Tự động chọn ngẫu nhiên theo trình độ</option>
      ${seeds.map(s => `<option value="${s.id}">[${s.level}] ${s.title} (${s.source})</option>`).join('')}
    `;
  },

  async generateNewExercise(forcedSeedId) {
    if (this.isLoading) return;

    const generateBtn = document.getElementById('btn-generate-listening');
    const contentArea = document.getElementById('listening-content-area');
    const profile = window.StateManager.getActiveProfile();
    const level = profile ? profile.level : 'B1';

    const seedSelect = document.getElementById('listening-seed-select');
    const targetSeedId = (forcedSeedId !== undefined && forcedSeedId !== null) ? forcedSeedId : (seedSelect ? seedSelect.value : '');

    let seedText = null;
    let seedTitle = null;

    if (targetSeedId) {
      const seeds = window.StateManager.getSeeds();
      const seedObj = seeds.find(s => s.id === targetSeedId);
      if (seedObj) {
        seedText = seedObj.transcript;
        seedTitle = seedObj.title;
        if (seedSelect) seedSelect.value = targetSeedId;
      }
    }

    this.isLoading = true;
    this.isSubmitted = false;
    this.userAnswers = {};

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.innerHTML = `${window.Icons.get('refresh', '', 15)} Đang tạo bài nghe...`;
    }

    if (contentArea) {
      contentArea.innerHTML = `
        <div class="eval-loading-card">
          <div class="spinner"></div>
          <h4>AI đang biên soạn đoạn audio tiếng Pháp chuẩn ${level}...</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem;">${seedTitle ? 'Bám sát văn bản từ kho đề: ' + this.escapeHTML(seedTitle) : 'Tạo văn bản phát thanh và bộ câu hỏi trắc nghiệm Compréhension de l\'oral'}</p>
        </div>
      `;
    }

    try {
      this.currentExercise = await window.AIService.generateListeningExercise({
        level,
        seedText,
        seedTitle
      });
      this.renderExercise();
      // Auto-play audio once ready
      setTimeout(() => this.playAudio(), 500);
    } catch (err) {
      console.error(err);
      if (contentArea) {
        contentArea.innerHTML = `
          <div class="feedback-card" style="background: var(--danger-light); border-color: rgba(255, 59, 48, 0.3);">
            <div class="feedback-title" style="color: var(--danger);">
              ${window.Icons.get('alertCircle', '', 16)} Không thể tạo bài nghe
            </div>
            <p style="color: var(--text-main); margin-top: 0.25rem;">${err.message}</p>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `${window.Icons.get('sparkles', '', 15)} Sinh bài nghe mới`;
      }
    }
  },

  renderExercise() {
    const contentArea = document.getElementById('listening-content-area');
    const submitBtn = document.getElementById('btn-submit-listening');
    if (!contentArea || !this.currentExercise) return;

    const { title, topic, passage, questions } = this.currentExercise;

    const questionsHTML = questions.map((q, qIdx) => `
      <div class="question-card" data-qindex="${qIdx}">
        <div class="question-title">
          <span class="question-num">Câu ${qIdx + 1}:</span> ${this.escapeHTML(q.question)}
        </div>
        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <label class="option-item" data-optindex="${optIdx}">
              <input type="radio" name="listening_q_${qIdx}" value="${optIdx}" onchange="ListeningModule.onSelectAnswer(${qIdx}, ${optIdx})" ${this.userAnswers[qIdx] === optIdx ? 'checked' : ''}>
              <span class="option-letter">${String.fromCharCode(65 + optIdx)}</span>
              <span class="option-text">${this.escapeHTML(opt)}</span>
            </label>
          `).join('')}
        </div>
        <div class="explanation-box hidden" id="listening-exp-${qIdx}"></div>
      </div>
    `).join('');

    contentArea.innerHTML = `
      <div class="audio-player-card">
        <div class="audio-header">
          <div class="audio-badge">
            ${window.Icons.get('headphones', '', 13)} Compréhension Orale
          </div>
          <h3 class="audio-title">${this.escapeHTML(title || 'Document audio')}</h3>
          <span class="audio-topic">Chủ đề: ${this.escapeHTML(topic || 'Đời sống')}</span>
        </div>

        <div class="audio-controls-box">
          <button class="btn-play-large" id="btn-play-audio" onclick="ListeningModule.playAudio()">
            <span id="play-icon-slot" style="display: inline-flex; align-items: center;">
              ${window.Icons.get('play', '', 18)}
            </span>
            <span id="play-btn-text">Phát âm thanh</span>
          </button>

          <div class="rate-control-group">
            <span class="rate-label">Tốc độ đọc:</span>
            <div class="rate-buttons">
              <button class="btn-rate-option ${this.speechRate === 0.8 ? 'active' : ''}" onclick="ListeningModule.setRate(0.8, this)">0.8x (Chậm)</button>
              <button class="btn-rate-option ${this.speechRate === 1.0 ? 'active' : ''}" onclick="ListeningModule.setRate(1.0, this)">1.0x (Chuẩn)</button>
              <button class="btn-rate-option ${this.speechRate === 1.2 ? 'active' : ''}" onclick="ListeningModule.setRate(1.2, this)">1.2x (Nhanh)</button>
            </div>
          </div>
        </div>

        <!-- Hidden Transcript Toggle -->
        <div class="transcript-wrapper">
          <button class="btn-secondary btn-sm" id="btn-toggle-transcript" onclick="ListeningModule.toggleTranscript()">
            <span id="transcript-icon-slot" style="display: inline-flex; align-items: center;">${window.Icons.get('eye', '', 14)}</span>
            <span id="transcript-btn-text">Hiện nội dung văn bản (Transcript)</span>
          </button>
          <div class="transcript-content hidden" id="listening-transcript-box">
            <p class="article-passage">${this.escapeHTML(passage)}</p>
          </div>
        </div>
      </div>

      <div class="listening-questions-container">
        <h4 style="font-size: 1.05rem; font-weight: 700; margin: 1.5rem 0 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
          ${window.Icons.get('checkCircle', '', 17)} Câu hỏi nghe hiểu:
        </h4>
        ${questionsHTML}
      </div>

      <div class="reading-score-summary hidden" id="listening-result-box"></div>
    `;

    if (submitBtn) {
      submitBtn.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${window.Icons.get('checkCircle', '', 17)} Nộp bài & Chấm điểm`;
    }
  },

  setRate(rate, btnEl) {
    this.speechRate = rate;
    const allRateBtns = document.querySelectorAll('.btn-rate-option');
    allRateBtns.forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
  },

  playAudio() {
    if (!this.currentExercise || !this.currentExercise.passage) return;

    const playBtn = document.getElementById('btn-play-audio');
    const playText = document.getElementById('play-btn-text');
    const playIcon = document.getElementById('play-icon-slot');

    if (this.isPlaying) {
      window.SpeechService.stopSpeaking();
      this.isPlaying = false;
      if (playText) playText.textContent = 'Phát âm thanh';
      if (playIcon) playIcon.innerHTML = window.Icons.get('play', '', 18);
      if (playBtn) playBtn.classList.remove('playing');
      return;
    }

    this.isPlaying = true;
    if (playText) playText.textContent = 'Đang đọc... (Nhấn để dừng)';
    if (playIcon) playIcon.innerHTML = window.Icons.get('pause', '', 18);
    if (playBtn) playBtn.classList.add('playing');

    window.SpeechService.speak(this.currentExercise.passage, {
      rate: this.speechRate,
      onEnd: () => {
        this.isPlaying = false;
        if (playText) playText.textContent = 'Nghe lại';
        if (playIcon) playIcon.innerHTML = window.Icons.get('play', '', 18);
        if (playBtn) playBtn.classList.remove('playing');
      },
      onError: (err) => {
        this.isPlaying = false;
        if (playText) playText.textContent = 'Lỗi phát âm (Thử lại)';
        if (playIcon) playIcon.innerHTML = window.Icons.get('play', '', 18);
        if (playBtn) playBtn.classList.remove('playing');
        console.error(err);
      }
    });
  },

  toggleTranscript() {
    const box = document.getElementById('listening-transcript-box');
    const btnText = document.getElementById('transcript-btn-text');
    const iconSlot = document.getElementById('transcript-icon-slot');
    if (!box) return;

    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Ẩn nội dung văn bản (Transcript)';
      if (iconSlot) iconSlot.innerHTML = window.Icons.get('eyeOff', '', 14);
    } else {
      box.classList.add('hidden');
      if (btnText) btnText.textContent = 'Hiện nội dung văn bản (Transcript)';
      if (iconSlot) iconSlot.innerHTML = window.Icons.get('eye', '', 14);
    }
  },

  onSelectAnswer(qIdx, optIdx) {
    if (this.isSubmitted) return;
    this.userAnswers[qIdx] = optIdx;
  },

  submitAnswers() {
    if (!this.currentExercise || this.isSubmitted) return;

    const questions = this.currentExercise.questions || [];
    if (Object.keys(this.userAnswers).length < questions.length) {
      if (!confirm('Bạn chưa trả lời hết các câu hỏi. Bạn vẫn muốn nộp bài?')) {
        return;
      }
    }

    this.isSubmitted = true;
    let correctCount = 0;

    questions.forEach((q, qIdx) => {
      const selected = this.userAnswers[qIdx];
      const correct = q.correct_index;
      const qCard = document.querySelector(`.question-card[data-qindex="${qIdx}"]`);
      const expBox = document.getElementById(`listening-exp-${qIdx}`);

      if (qCard) {
        const optionItems = qCard.querySelectorAll('.option-item');
        optionItems.forEach((item, optIdx) => {
          const radio = item.querySelector('input');
          if (radio) radio.disabled = true;

          if (optIdx === correct) {
            item.classList.add('correct-answer');
          } else if (optIdx === selected && selected !== correct) {
            item.classList.add('wrong-answer');
          }
        });
      }

      if (selected === correct) {
        correctCount++;
      }

      if (expBox) {
        expBox.classList.remove('hidden');
        expBox.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 0.4rem;">
            <span style="color: var(--success); flex-shrink: 0;">${window.Icons.get('lightbulb', '', 15)}</span>
            <div><strong>Giải thích:</strong> ${this.escapeHTML(q.explanation || 'Đáp án đúng là lựa chọn ' + String.fromCharCode(65 + correct))}</div>
          </div>
        `;
      }
    });

    // Score Summary
    const resultBox = document.getElementById('listening-result-box');
    const submitBtn = document.getElementById('btn-submit-listening');
    const total = questions.length;
    const percent = Math.round((correctCount / total) * 100);

    // Also auto-reveal transcript on submit
    const transcriptBox = document.getElementById('listening-transcript-box');
    if (transcriptBox) transcriptBox.classList.remove('hidden');

    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div class="eval-result-card" style="margin-top: 1.5rem; text-align: center;">
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">Kết quả Luyện Nghe:</div>
          <div class="eval-score-large" style="font-size: 2.2rem; color: var(--primary);">${correctCount} / ${total}</div>
          <div style="font-weight: 600; font-size: 0.95rem; margin-top: 0.25rem; color: var(--text-main);">${percent}% chính xác</div>
          <p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.9rem;">
            ${percent >= 66 ? 'Rất tốt! Khả năng nghe hiểu tiếng Pháp của bạn rất vững.' : 'Hãy nghe lại kết hợp đọc transcript để làm quen với ngữ điệu và nối âm.'}
          </p>
        </div>
      `;
      resultBox.scrollIntoView({ behavior: 'smooth' });
    }

    if (submitBtn) {
      submitBtn.classList.add('hidden');
    }

    // Save progress
    const profile = window.StateManager.getActiveProfile();
    const level = profile ? profile.level : 'B1';
    window.StateManager.addProgressRecord({
      type: 'listening',
      level,
      score: correctCount,
      maxScore: total,
      details: {
        title: this.currentExercise.title,
        percent
      }
    });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.ListeningModule = ListeningModule;
