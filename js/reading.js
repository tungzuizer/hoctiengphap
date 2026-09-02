/**
 * ReadingModule - Compréhension Écrite
 * Generates CEFR/DELF French reading passages, MCQs & explanations
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const ReadingModule = {
  currentExercise: null,
  userAnswers: {},
  isSubmitted: false,
  isLoading: false,

  init() {
    this.bindEvents();
    this.populateSeedOptions();
  },

  bindEvents() {
    const generateBtn = document.getElementById('btn-generate-reading');
    const submitBtn = document.getElementById('btn-submit-reading');

    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateNewExercise());
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitAnswers());
    }
  },

  populateSeedOptions() {
    const selectEl = document.getElementById('reading-seed-select');
    if (!selectEl) return;

    const seeds = window.StateManager.getSeeds();
    selectEl.innerHTML = `
      <option value="">Tự động chọn ngẫu nhiên theo trình độ</option>
      ${seeds.map(s => `<option value="${s.id}">[${s.level}] ${s.title} (${s.source})</option>`).join('')}
    `;
  },

  async generateNewExercise() {
    if (this.isLoading) return;

    const generateBtn = document.getElementById('btn-generate-reading');
    const contentArea = document.getElementById('reading-content-area');
    const profile = window.StateManager.getActiveProfile();
    const level = profile ? profile.level : 'B1';

    const seedSelect = document.getElementById('reading-seed-select');
    const selectedSeedId = seedSelect ? seedSelect.value : '';

    let seedText = null;
    if (selectedSeedId) {
      const seeds = window.StateManager.getSeeds();
      const seedObj = seeds.find(s => s.id === selectedSeedId);
      if (seedObj) seedText = seedObj.transcript;
    }

    this.isLoading = true;
    this.isSubmitted = false;
    this.userAnswers = {};

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.innerHTML = `${window.Icons.get('refresh', '', 15)} Đang biên soạn bài đọc...`;
    }

    if (contentArea) {
      contentArea.innerHTML = `
        <div class="eval-loading-card">
          <div class="spinner"></div>
          <h4>AI đang biên soạn bài đọc tiếng Pháp chuẩn ${level}...</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem;">Tạo văn bản và bộ câu hỏi trắc nghiệm Compréhension écrite</p>
        </div>
      `;
    }

    try {
      this.currentExercise = await window.AIService.generateReadingExercise({
        level,
        seedText
      });
      this.renderExercise();
    } catch (err) {
      console.error(err);
      if (contentArea) {
        contentArea.innerHTML = `
          <div class="feedback-card" style="background: var(--danger-light); border-color: rgba(255, 59, 48, 0.3);">
            <div class="feedback-title" style="color: var(--danger);">
              ${window.Icons.get('alertCircle', '', 16)} Không thể tạo bài đọc
            </div>
            <p style="color: var(--text-main); margin-top: 0.25rem;">${err.message}</p>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `${window.Icons.get('sparkles', '', 15)} Sinh bài đọc mới`;
      }
    }
  },

  renderExercise() {
    const contentArea = document.getElementById('reading-content-area');
    const submitBtn = document.getElementById('btn-submit-reading');
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
              <input type="radio" name="reading_q_${qIdx}" value="${optIdx}" onchange="ReadingModule.onSelectAnswer(${qIdx}, ${optIdx})" ${this.userAnswers[qIdx] === optIdx ? 'checked' : ''}>
              <span class="option-letter">${String.fromCharCode(65 + optIdx)}</span>
              <span class="option-text">${this.escapeHTML(opt)}</span>
            </label>
          `).join('')}
        </div>
        <div class="explanation-box hidden" id="reading-exp-${qIdx}"></div>
      </div>
    `).join('');

    contentArea.innerHTML = `
      <div class="reading-article-card">
        <div class="article-header">
          <div class="article-badge">
            ${window.Icons.get('bookOpen', '', 13)} Compréhension Écrite
          </div>
          <h3 class="article-title">${this.escapeHTML(title || 'Texte de compréhension')}</h3>
          <span class="article-topic">Chủ đề: ${this.escapeHTML(topic || 'Đời sống')}</span>
        </div>

        <div class="article-body">
          <p class="article-passage">${this.escapeHTML(passage)}</p>
        </div>
      </div>

      <div class="reading-questions-container">
        <h4 style="font-size: 1.05rem; font-weight: 700; margin: 1.5rem 0 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
          ${window.Icons.get('checkCircle', '', 17)} Câu hỏi hiểu bài:
        </h4>
        ${questionsHTML}
      </div>

      <div class="reading-score-summary hidden" id="reading-result-box"></div>
    `;

    if (submitBtn) {
      submitBtn.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${window.Icons.get('checkCircle', '', 17)} Nộp bài & Chấm điểm`;
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
      const expBox = document.getElementById(`reading-exp-${qIdx}`);

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
    const resultBox = document.getElementById('reading-result-box');
    const submitBtn = document.getElementById('btn-submit-reading');
    const total = questions.length;
    const percent = Math.round((correctCount / total) * 100);

    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div class="eval-result-card" style="margin-top: 1.5rem; text-align: center;">
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">Kết quả Luyện Đọc:</div>
          <div class="eval-score-large" style="font-size: 2.2rem; color: var(--primary);">${correctCount} / ${total}</div>
          <div style="font-weight: 600; font-size: 0.95rem; margin-top: 0.25rem; color: var(--text-main);">${percent}% chính xác</div>
          <p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.9rem;">
            ${percent >= 66 ? 'Rất tốt! Bạn đã nắm vững nội dung bài đọc.' : 'Cần chú ý đọc kỹ các từ khóa và chi tiết trong đoạn văn.'}
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
      type: 'reading',
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

window.ReadingModule = ReadingModule;
