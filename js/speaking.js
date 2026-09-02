/**
 * SpeakingModule - Expression Orale & DELF Speaking Assessment Grille
 * Integrates Web Speech Recognition, French TTS, and DELF B1 evaluation
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const SpeakingModule = {
  conversation: [],
  isProcessing: false,

  init() {
    this.bindEvents();
    this.loadHistory();
  },

  loadHistory() {
    this.conversation = window.StateManager.getConversationHistory();
    this.renderConversation();
  },

  bindEvents() {
    const micBtn = document.getElementById('btn-mic-toggle');
    const sendTextBtn = document.getElementById('btn-send-text');
    const textInput = document.getElementById('speaking-text-input');
    const evalBtn = document.getElementById('btn-evaluate-speaking');
    const clearBtn = document.getElementById('btn-clear-conversation');

    if (micBtn) {
      micBtn.addEventListener('click', () => this.toggleMic());
    }

    if (sendTextBtn && textInput) {
      sendTextBtn.addEventListener('click', () => {
        const val = textInput.value.trim();
        if (val) {
          this.handleUserUtterance(val);
          textInput.value = '';
        }
      });

      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendTextBtn.click();
        }
      });
    }

    if (evalBtn) {
      evalBtn.addEventListener('click', () => this.evaluateSession());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử hội thoại của buổi luyện này?')) {
          this.conversation = [];
          window.StateManager.clearConversationHistory();
          this.renderConversation();
          document.getElementById('speaking-eval-result').classList.add('hidden');
        }
      });
    }
  },

  toggleMic() {
    const micBtn = document.getElementById('btn-mic-toggle');
    const micStatus = document.getElementById('mic-status-text');

    if (window.SpeechService.isListening) {
      window.SpeechService.stopListening();
      this.updateMicUI(false);
      return;
    }

    if (this.isProcessing) return;

    this.updateMicUI(true);
    if (micStatus) micStatus.textContent = 'Đang lắng nghe tiếng Pháp... Hãy nói vào micro!';

    window.SpeechService.startListening({
      onStart: () => {
        this.updateMicUI(true);
      },
      onInterim: (interim) => {
        const liveBox = document.getElementById('live-transcript');
        if (liveBox) {
          liveBox.textContent = interim;
          liveBox.classList.remove('hidden');
        }
      },
      onResult: (finalText) => {
        const liveBox = document.getElementById('live-transcript');
        if (liveBox) {
          liveBox.textContent = finalText;
        }
        this.updateMicUI(false);
        this.handleUserUtterance(finalText);
      },
      onError: (err) => {
        this.updateMicUI(false);
        if (micStatus) {
          if (err.error === 'not-allowed') {
            micStatus.textContent = 'Micro bị chặn. Vui lòng cho phép quyền truy cập Micro trên trình duyệt.';
          } else {
            micStatus.textContent = `Lỗi ghi âm (${err.error || 'không nhận dạng được'})`;
          }
        }
      },
      onEnd: () => {
        this.updateMicUI(false);
      }
    });
  },

  updateMicUI(isListening) {
    const micBtn = document.getElementById('btn-mic-toggle');
    const micStatus = document.getElementById('mic-status-text');
    const soundWave = document.getElementById('sound-wave-bars');

    if (isListening) {
      micBtn?.classList.add('recording');
      soundWave?.classList.remove('hidden');
      if (micStatus) micStatus.textContent = 'Đang nghe... Nhấn lại để kết thúc câu';
    } else {
      micBtn?.classList.remove('recording');
      soundWave?.classList.add('hidden');
      if (micStatus) micStatus.textContent = 'Nhấn Micro để nói tiếng Pháp (hoặc gõ phím bên dưới)';
    }
  },

  async handleUserUtterance(frenchText) {
    if (!frenchText || this.isProcessing) return;

    const profile = window.StateManager.getActiveProfile();
    const level = profile ? profile.level : 'B1';

    // Append user message immediately
    const tempId = 'turn_' + Date.now();
    const newTurn = {
      id: tempId,
      timestamp: new Date().toISOString(),
      userText: frenchText,
      frenchReply: '...',
      feedbackVi: 'Đang phân tích và tạo phản hồi...'
    };

    this.conversation.push(newTurn);
    this.renderConversation();
    this.isProcessing = true;

    // Show loading indicator
    const chatContainer = document.getElementById('conversation-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      const response = await window.AIService.chatWithTutor(frenchText, this.conversation.slice(0, -1), level);

      // Update turn
      newTurn.frenchReply = response.frenchReply;
      newTurn.feedbackVi = response.feedbackVi;

      // Save history
      window.StateManager.saveConversationHistory(this.conversation);
      this.renderConversation();

      // Read French reply out loud
      window.SpeechService.speak(response.frenchReply);
    } catch (err) {
      console.error(err);
      newTurn.frenchReply = 'Désolé, une erreur est survenue.';
      newTurn.feedbackVi = `Lỗi: ${err.message}. Hãy kiểm tra lại API Key hoặc Endpoint OmniRoute trong phần Cấu hình.`;
      this.renderConversation();
    } finally {
      this.isProcessing = false;
      const liveBox = document.getElementById('live-transcript');
      if (liveBox) liveBox.classList.add('hidden');
    }
  },

  renderConversation() {
    const container = document.getElementById('conversation-container');
    if (!container) return;

    if (this.conversation.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            ${window.Icons.get('mic', '', 28)}
          </div>
          <h3>Chưa có hội thoại nào</h3>
          <p>Nhấn nút Micro và nói một câu tiếng Pháp (hoặc gõ phím) để bắt đầu luyện tập với giáo viên bản ngữ.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.conversation.map((turn) => `
      <div class="chat-message-group" data-id="${turn.id}">
        <!-- User bubble (iOS Blue) -->
        <div class="user-bubble">
          <div class="bubble-header">
            <span style="font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem;">
              ${window.Icons.get('user', '', 12)} Bạn
            </span>
            <span class="bubble-time">${new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="bubble-text">${this.escapeHTML(turn.userText)}</div>
        </div>

        <!-- Tutor response (Frosted Glass Card) -->
        <div class="tutor-bubble">
          <div class="bubble-header">
            <span class="tutor-badge-title">
              ${window.Icons.get('frenchCockade', '', 15)} Giáo viên AI
            </span>
            <button class="btn-icon-speak" onclick="window.SpeechService.speak('${this.escapeQuotes(turn.frenchReply)}')">
              ${window.Icons.get('volume', '', 13)} Nghe lại
            </button>
          </div>
          <div class="bubble-text french-highlight">${this.escapeHTML(turn.frenchReply)}</div>

          <!-- Feedback note card -->
          <div class="feedback-card">
            <div class="feedback-title">
              ${window.Icons.get('lightbulb', '', 15)} Nhận xét & Chữa lỗi:
            </div>
            <div class="feedback-content">${this.escapeHTML(turn.feedbackVi)}</div>
          </div>
        </div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  },

  // Evaluate the entire speaking session with official DELF grid
  async evaluateSession() {
    if (this.conversation.length === 0) {
      alert('Vui lòng thực hiện ít nhất 1-2 câu hội thoại trước khi chấm điểm buổi luyện!');
      return;
    }

    const evalBtn = document.getElementById('btn-evaluate-speaking');
    const resultContainer = document.getElementById('speaking-eval-result');
    const profile = window.StateManager.getActiveProfile();
    const level = profile ? profile.level : 'B1';

    if (evalBtn) {
      evalBtn.disabled = true;
      evalBtn.innerHTML = `${window.Icons.get('refresh', '', 15)} Giám khảo đang chấm điểm DELF...`;
    }

    if (resultContainer) {
      resultContainer.classList.remove('hidden');
      resultContainer.innerHTML = `
        <div class="eval-loading-card">
          <div class="spinner"></div>
          <h4>Đang phân tích ngữ pháp, từ vựng và phản xạ theo Grille DELF ${level}...</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem;">France Éducation International — Grille d'évaluation officielle</p>
        </div>
      `;
      resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    try {
      const evaluation = await window.AIService.evaluateSpeakingSession(this.conversation, level);
      this.renderEvaluationResult(evaluation, level);

      // Save to Progress Records
      const maxScore = level === 'B1' ? 25 : 15;
      window.StateManager.addProgressRecord({
        type: 'speaking',
        level,
        score: evaluation.tong_diem || 0,
        maxScore,
        details: evaluation,
        commonErrors: evaluation.frequent_errors || []
      });

    } catch (err) {
      console.error('Eval error', err);
      if (resultContainer) {
        resultContainer.innerHTML = `
          <div class="feedback-card" style="background: var(--danger-light); border-color: rgba(255, 59, 48, 0.3);">
            <div class="feedback-title" style="color: var(--danger);">
              ${window.Icons.get('alertCircle', '', 16)} Không thể chấm điểm
            </div>
            <p style="color: var(--text-main); margin-top: 0.25rem;">${err.message}</p>
          </div>
        `;
      }
    } finally {
      if (evalBtn) {
        evalBtn.disabled = false;
        evalBtn.innerHTML = `${window.Icons.get('award', '', 15)} Chấm điểm buổi luyện (Grille DELF)`;
      }
    }
  },

  renderEvaluationResult(evaluation, level = 'B1') {
    const resultContainer = document.getElementById('speaking-eval-result');
    if (!resultContainer) return;

    const maxScore = level === 'B1' ? 25 : 15;
    const score = evaluation.tong_diem || 0;
    const percentage = Math.round((score / maxScore) * 100);

    let statusLabel = 'Đạt chuẩn DELF';
    if (percentage < 50) {
      statusLabel = 'Cần luyện tập thêm';
    } else if (percentage >= 80) {
      statusLabel = 'Xuất sắc / Vượt chuẩn';
    }

    const criteriaConfig = level === 'B1' ? window.CONFIG.DELF_B1_CRITERIA : window.CONFIG.DELF_A1_A2_CRITERIA;

    const criteriaRows = criteriaConfig.map(crit => {
      const critData = evaluation[crit.id] || { score: 0, max: crit.maxPoints, notes: 'Không có ghi chú' };
      const critScore = critData.score || 0;
      const critMax = critData.max || crit.maxPoints;
      const critPercent = Math.round((critScore / critMax) * 100);

      return `
        <div class="criteria-row">
          <div class="criteria-info">
            <div class="criteria-name">${crit.label}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${crit.description}</div>
            <div class="criteria-notes">${window.Icons.get('messageSquare', '', 13)} ${this.escapeHTML(critData.notes || '')}</div>
          </div>
          <div class="criteria-score-block">
            <div class="score-display">${critScore} <span style="font-size: 0.85rem; color: var(--text-muted);">/ ${critMax}</span></div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${critPercent}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const frequentErrorsHTML = evaluation.frequent_errors && evaluation.frequent_errors.length > 0 ? `
      <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color);">
        <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--danger); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
          ${window.Icons.get('alertCircle', '', 15)} Các điểm lỗi cần lưu ý:
        </h5>
        <div class="error-badge-grid">
          ${evaluation.frequent_errors.map(err => `
            <div class="error-freq-item">
              <span class="error-freq-name">${this.escapeHTML(err)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    resultContainer.innerHTML = `
      <div class="eval-result-card">
        <div class="eval-header">
          <div class="eval-title-group">
            <h3 style="display: flex; align-items: center; gap: 0.5rem;">
              ${window.Icons.get('award', '', 22)} Phiếu Đánh Giá Nói DELF ${level}
            </h3>
            <span class="eval-subtitle">Grille d'évaluation de la production orale — France Éducation International</span>
          </div>
          <div class="eval-score-ring">
            <div class="eval-score-large">${score} <span class="eval-score-max">/ ${maxScore}</span></div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--primary); margin-top: 0.2rem;">${statusLabel} (${percentage}%)</div>
          </div>
        </div>

        <div class="criteria-list">
          ${criteriaRows}
        </div>

        <div class="eval-summary-card">
          <h4>${window.Icons.get('lightbulb', '', 16)} Nhận xét tổng thể của giám khảo:</h4>
          <p style="color: var(--text-main); font-size: 0.92rem; line-height: 1.5;">${this.escapeHTML(evaluation.overall_feedback || 'Bạn có phản xạ giao tiếp khá tốt. Tiếp tục phát huy!')}</p>
          ${frequentErrorsHTML}
        </div>
      </div>
    `;

    resultContainer.scrollIntoView({ behavior: 'smooth' });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
  }
};

window.SpeakingModule = SpeakingModule;
