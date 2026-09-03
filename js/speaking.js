/**
 * SpeakingModule - Expression Orale, DELF Speaking Assessment & Phonetics Coach
 * Integrates Web Speech Recognition, French TTS, IPA Phonetic Diagnosis, and Repetition Scorer
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const SpeakingModule = {
  conversation: [],
  isProcessing: false,
  activePracticeTarget: null,
  audioCtx: null,

  init() {
    this.bindEvents();
    this.loadHistory();
    this.renderTopics();
    this.renderAtelierPhonétique();
    this.initTopicsCarousel();
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
    const toggleAtelierBtn = document.getElementById('btn-toggle-atelier-phonetique');

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
          const evalResult = document.getElementById('speaking-eval-result');
          if (evalResult) evalResult.classList.add('hidden');
        }
      });
    }

    if (toggleAtelierBtn) {
      toggleAtelierBtn.addEventListener('click', () => {
        const atelierSection = document.getElementById('atelier-phonetique-section');
        if (atelierSection) {
          atelierSection.classList.toggle('hidden');
          const isHidden = atelierSection.classList.contains('hidden');
          toggleAtelierBtn.innerHTML = isHidden
            ? `${window.Icons.get('sparkles', '', 14)} Xưởng IPA`
            : `${window.Icons.get('sparkles', '', 14)} Đóng Xưởng`;
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
      feedbackVi: 'Đang phân tích ngữ pháp, từ vựng và ngữ âm phát âm...',
      phoneticsRaw: '',
      phonetics: [],
      turnEvalRaw: '',
      turnEval: null
    };

    this.conversation.push(newTurn);
    this.renderConversation();
    this.isProcessing = true;

    // Show loading indicator
    const chatContainer = document.getElementById('conversation-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      const response = await window.AIService.chatWithTutor(frenchText, this.conversation.slice(0, -1), level);

      // Update turn with 4 components: French reply, grammar feedback, phonetics diagnostic, and real-time turn evaluation
      newTurn.frenchReply = response.frenchReply;
      newTurn.feedbackVi = response.feedbackVi;
      newTurn.phoneticsRaw = response.phoneticsRaw || '';
      newTurn.phonetics = response.phonetics || [];
      newTurn.turnEvalRaw = response.turnEvalRaw || '';
      newTurn.turnEval = response.turnEval || null;

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
    this.updateCumulativeScoreMeter();

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

    container.innerHTML = this.conversation.map((turn, index) => {
      // Build Turn-by-Turn Real-time Assessment Card
      let turnEvalHTML = '';
      if (turn.turnEval) {
        const ev = turn.turnEval;
        turnEvalHTML = `
          <div class="turn-eval-card">
            <div class="turn-eval-header">
              <div class="turn-eval-title-wrap">
                <span class="turn-eval-icon">${window.Icons.get('award', '', 14)}</span>
                <span class="turn-eval-title">Đánh giá tức thì:</span>
                <span class="turn-eval-stars">${ev.stars || '⭐⭐⭐⭐'}</span>
              </div>
              <div class="turn-eval-score-wrap">
                <span class="turn-eval-badge ${ev.badgeClass || 'score-good'}">${this.escapeHTML(ev.badge || 'Đạt chuẩn')}</span>
                <span class="turn-eval-score">${ev.score != null ? ev.score.toFixed(1) : '4.0'}/5.0</span>
                <span class="turn-eval-delf">(${ev.delfEquivalent != null ? ev.delfEquivalent.toFixed(1) : '20.0'}/25 DELF)</span>
              </div>
            </div>
            <div class="turn-eval-details">
              ${ev.grammarNote ? `
                <div class="turn-eval-row">
                  <span class="eval-tag eval-tag-grammar">Ngữ pháp</span>
                  <span class="eval-text">${this.escapeHTML(ev.grammarNote)}</span>
                </div>
              ` : ''}
              ${ev.lexiqueNote ? `
                <div class="turn-eval-row">
                  <span class="eval-tag eval-tag-lexique">Từ vựng</span>
                  <span class="eval-text">${this.escapeHTML(ev.lexiqueNote)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Build Phonetics Section if available
      let phoneticsHTML = '';
      if (turn.phonetics && turn.phonetics.length > 0) {
        phoneticsHTML = `
          <div class="phonetics-diagnostic-card">
            <div class="phonetics-header">
              <span class="phonetics-badge-title">
                ${window.Icons.get('sparkles', '', 14)} Chữa phát âm & Ngữ âm (Phonétique):
              </span>
              <span class="phonetics-sub">Phiên âm IPA & Mẹo khẩu hình chuẩn</span>
            </div>
            <div class="phonetics-items-grid">
              ${turn.phonetics.map((p, pIdx) => {
                const uniquePracticeId = `practice_${turn.id}_${pIdx}`;
                const wordToTest = p.word || turn.userText;
                return `
                  <div class="phonetic-word-item">
                    <div class="phonetic-word-top">
                      <div class="phonetic-word-name">
                        <strong>${this.escapeHTML(p.word || 'Ngữ âm')}</strong>
                        ${p.ipa ? `<span class="ipa-tag">${this.escapeHTML(p.ipa)}</span>` : ''}
                      </div>
                      <div class="phonetic-actions">
                        ${p.word ? `
                          <button class="btn-sound-mini" onclick="window.SpeechService.speak('${this.escapeQuotes(p.word)}', { rate: 0.85 })" title="Nghe người Pháp phát âm mẫu chậm">
                            ${window.Icons.get('volume', '', 12)} Nghe mẫu
                          </button>
                          <button class="btn-record-mini" onclick="SpeakingModule.startWordPractice('${this.escapeQuotes(p.word)}', '${uniquePracticeId}')" title="Luyện đọc lại từ này để AI chấm điểm">
                            ${window.Icons.get('mic', '', 12)} Luyện nói
                          </button>
                        ` : ''}
                      </div>
                    </div>
                    <div class="phonetic-tip-text">
                      ${this.escapeHTML(p.tip)}
                    </div>
                    <!-- Live Practice Feedback Slot -->
                    <div id="${uniquePracticeId}" class="practice-result-slot hidden"></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else if (turn.phoneticsRaw) {
        phoneticsHTML = `
          <div class="phonetics-diagnostic-card">
            <div class="phonetics-header">
              <span class="phonetics-badge-title">
                ${window.Icons.get('sparkles', '', 14)} Chữa phát âm & Ngữ âm (Phonétique):
              </span>
            </div>
            <div class="phonetic-tip-text" style="margin-top: 0.4rem; line-height: 1.5;">
              ${this.escapeHTML(turn.phoneticsRaw)}
            </div>
          </div>
        `;
      }

      return `
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
            <!-- Quick audio playback of what user spoke -->
            <div style="margin-top: 0.45rem; display: flex; justify-content: flex-end;">
              <button class="btn-user-listen" onclick="window.SpeechService.speak('${this.escapeQuotes(turn.userText)}', { rate: 0.85 })" title="Nghe lại phát âm chuẩn tiếng Pháp của câu bạn vừa nói">
                ${window.Icons.get('volume', '', 11)} Nghe phát âm mẫu chuẩn
              </button>
            </div>
          </div>

          <!-- Tutor response (Frosted Glass Card) -->
          <div class="tutor-bubble">
            <div class="bubble-header">
              <span class="tutor-badge-title">
                ${window.Icons.get('frenchCockade', '', 15)} Giáo viên AI
              </span>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn-icon-speak" onclick="window.SpeechService.speak('${this.escapeQuotes(turn.frenchReply)}', { rate: 0.85 })" title="Nghe phát âm chậm 0.85x">
                  ${window.Icons.get('volume', '', 12)} 0.85x
                </button>
                <button class="btn-icon-speak" onclick="window.SpeechService.speak('${this.escapeQuotes(turn.frenchReply)}', { rate: 1.0 })" title="Nghe tốc độ bình thường">
                  ${window.Icons.get('volume', '', 12)} 1.0x
                </button>
              </div>
            </div>
            <div class="bubble-text french-highlight">${this.escapeHTML(turn.frenchReply)}</div>

            <!-- Turn-by-Turn Instant Assessment Card -->
            ${turnEvalHTML}

            <!-- Feedback note card (Grammar & Lexique) -->
            <div class="feedback-card">
              <div class="feedback-title">
                ${window.Icons.get('lightbulb', '', 15)} Nhận xét Ngữ pháp & Từ vựng:
              </div>
              <div class="feedback-content">${this.escapeHTML(turn.feedbackVi)}</div>
            </div>

            <!-- Phonetics & Pronunciation Diagnostic Card -->
            ${phoneticsHTML}
          </div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  },

  // Update Live Cumulative Score Meter on the top bar
  updateCumulativeScoreMeter() {
    const valEl = document.getElementById('live-score-val');
    const pillEl = document.getElementById('live-score-pill');
    if (!valEl || !pillEl) return;

    const evaluatedTurns = this.conversation.filter(t => t.turnEval && typeof t.turnEval.score === 'number');
    if (evaluatedTurns.length === 0) {
      valEl.textContent = '--/25';
      pillEl.textContent = 'Sẵn sàng';
      pillEl.className = 'live-score-pill score-neutral';
      return;
    }

    const totalDelf = evaluatedTurns.reduce((sum, t) => sum + (t.turnEval.delfEquivalent != null ? t.turnEval.delfEquivalent : (t.turnEval.score * 5)), 0);
    const avgDelf = +(totalDelf / evaluatedTurns.length).toFixed(1);

    valEl.textContent = `${avgDelf}/25`;

    if (avgDelf >= 21.0) {
      pillEl.textContent = 'Xuất sắc (B1+)';
      pillEl.className = 'live-score-pill score-perfect';
    } else if (avgDelf >= 16.0) {
      pillEl.textContent = 'Đạt chuẩn (B1)';
      pillEl.className = 'live-score-pill score-good';
    } else if (avgDelf >= 10.0) {
      pillEl.textContent = 'Khá (A2+)';
      pillEl.className = 'live-score-pill score-medium';
    } else {
      pillEl.textContent = avgDelf === 0 ? 'Tiếng Việt (0đ)' : 'Cần cố gắng';
      pillEl.className = 'live-score-pill score-low';
    }
  },

  /* ================= Interactive Word Pronunciation Practice & Tester ================= */
  startWordPractice(targetWord, resultContainerId) {
    if (!targetWord) return;

    const resultBox = document.getElementById(resultContainerId);
    if (!resultBox) return;

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <div class="practice-box-listening">
        <div class="practice-live-wave">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="practice-live-text">
          Đang lắng nghe... Hãy phát âm rõ: <strong>"${this.escapeHTML(targetWord)}"</strong>
        </div>
      </div>
    `;

    window.SpeechService.startListening({
      onStart: () => {},
      onResult: (spokenText) => {
        const scoreResult = this.evaluatePronunciationMatch(targetWord, spokenText);
        this.renderPracticeResult(resultBox, targetWord, spokenText, scoreResult);
        if (scoreResult.score >= 80) {
          this.playSuccessChime();
        }
      },
      onError: (err) => {
        resultBox.innerHTML = `
          <div class="practice-box-result result-error">
            ${window.Icons.get('alertCircle', '', 14)} Lỗi nhận diện giọng nói: ${err.error || 'Vui lòng thử lại'}.
          </div>
        `;
      }
    });
  },

  evaluatePronunciationMatch(targetWord, spokenWord) {
    const cleanTarget = this.normalizeFrenchText(targetWord);
    const cleanSpoken = this.normalizeFrenchText(spokenWord);

    // Exact match
    if (cleanTarget === cleanSpoken || cleanSpoken.includes(cleanTarget) || cleanTarget.includes(cleanSpoken)) {
      return {
        score: 100,
        status: 'Parfait ! (Xuất sắc)',
        badgeClass: 'score-perfect',
        stars: '⭐⭐⭐⭐⭐',
        feedback: 'Phát âm cực kỳ chuẩn xác! Âm sắc rõ ràng và ngữ điệu tự nhiên.'
      };
    }

    // Levenshtein similarity distance calculation
    const distance = this.levenshtein(cleanTarget, cleanSpoken);
    const maxLen = Math.max(cleanTarget.length, cleanSpoken.length, 1);
    const similarity = Math.max(0, Math.round((1 - distance / maxLen) * 100));

    if (similarity >= 75) {
      return {
        score: similarity,
        status: 'Très bien ! (Rất tốt)',
        badgeClass: 'score-good',
        stars: '⭐⭐⭐⭐',
        feedback: 'Phát âm rất tốt, người bản xứ hiểu rõ. Hãy tiếp tục giữ vững khẩu hình!'
      };
    } else if (similarity >= 45) {
      return {
        score: similarity,
        status: 'Presque ! (Gần chuẩn)',
        badgeClass: 'score-medium',
        stars: '⭐⭐⭐',
        feedback: 'Gần đúng rồi! Hãy chú ý nguyên âm và phụ âm cuối (âm câm hoặc âm mũi).'
      };
    } else {
      return {
        score: similarity,
        status: 'À retravailler (Cần thử lại)',
        badgeClass: 'score-low',
        stars: '⭐⭐',
        feedback: 'Chưa chuẩn. Hãy bấm nút "Nghe mẫu" để nghe lại người Pháp đọc rồi thử nói lại nhé!'
      };
    }
  },

  renderPracticeResult(container, targetWord, spokenWord, scoreResult) {
    container.innerHTML = `
      <div class="practice-box-result ${scoreResult.badgeClass}">
        <div class="practice-score-row">
          <span class="practice-score-badge">${scoreResult.score}% — ${scoreResult.status}</span>
          <span class="practice-stars">${scoreResult.stars}</span>
        </div>
        <div class="practice-details">
          <div>Từ mục tiêu: <strong>${this.escapeHTML(targetWord)}</strong></div>
          <div>Bạn đã phát âm: <span class="spoken-echo">"${this.escapeHTML(spokenWord)}"</span></div>
        </div>
        <p class="practice-feedback-text">${scoreResult.feedback}</p>
        <div class="practice-retry-row">
          <button class="btn-sound-mini" onclick="window.SpeechService.speak('${this.escapeQuotes(targetWord)}', { rate: 0.8 })">
            ${window.Icons.get('volume', '', 11)} Nghe lại âm mẫu
          </button>
          <button class="btn-record-mini" onclick="SpeakingModule.startWordPractice('${this.escapeQuotes(targetWord)}', '${container.id}')">
            ${window.Icons.get('repeat', '', 11)} Thử phát âm lại
          </button>
        </div>
      </div>
    `;
  },

  normalizeFrenchText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  },

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  },

  playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  },

  /* ================= Gợi ý chủ đề trò chuyện theo ngữ cảnh (Thèmes de conversation) ================= */
  renderTopics() {
    const container = document.getElementById('speaking-topics-container');
    if (!container || !window.CONFIG || !window.CONFIG.SPEAKING_TOPICS) return;

    const topics = window.CONFIG.SPEAKING_TOPICS;
    container.innerHTML = topics.map(t => {
      const iconSvg = window.Icons && window.Icons.get ? window.Icons.get(t.icon, '', 14) : '';
      return `
        <button class="topic-chip-pill" onclick="SpeakingModule.selectTopic('${t.id}')" title="${this.escapeHTML(t.starterVi)}">
          <span class="topic-chip-icon">${iconSvg}</span>
          <span class="topic-chip-name">${this.escapeHTML(t.label)}</span>
        </button>
      `;
    }).join('');

    this.initTopicsCarousel();
  },

  initTopicsCarousel() {
    const container = document.getElementById('speaking-topics-container');
    const prevBtn = document.getElementById('btn-topic-prev');
    const nextBtn = document.getElementById('btn-topic-next');
    if (!container) return;

    const updateControls = () => {
      if (!prevBtn || !nextBtn) return;
      const atStart = container.scrollLeft <= 5;
      const atEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 5;
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
      prevBtn.style.opacity = atStart ? '0.35' : '1';
      nextBtn.style.opacity = atEnd ? '0.35' : '1';
      prevBtn.style.pointerEvents = atStart ? 'none' : 'auto';
      nextBtn.style.pointerEvents = atEnd ? 'none' : 'auto';
    };

    if (prevBtn && !prevBtn._bound) {
      prevBtn._bound = true;
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        container.scrollBy({ left: -240, behavior: 'smooth' });
      });
    }

    if (nextBtn && !nextBtn._bound) {
      nextBtn._bound = true;
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        container.scrollBy({ left: 240, behavior: 'smooth' });
      });
    }

    // Convert vertical wheel to horizontal scroll on desktop
    if (!container._wheelBound) {
      container._wheelBound = true;
      container.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          container.scrollLeft += e.deltaY * 1.2;
        }
      }, { passive: false });

      // Drag to scroll with mouse
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let hasDragged = false;

      container.addEventListener('mousedown', (e) => {
        isDown = true;
        hasDragged = false;
        container.classList.add('is-dragging');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          container.classList.remove('is-dragging');
        }
      });

      container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) {
          hasDragged = true;
        }
        container.scrollLeft = scrollLeft - walk;
      });

      // Prevent accidental click if user was dragging
      container.addEventListener('click', (e) => {
        if (hasDragged) {
          e.stopPropagation();
          hasDragged = false;
        }
      }, true);

      container.addEventListener('scroll', updateControls, { passive: true });
      window.addEventListener('resize', updateControls);
    }

    setTimeout(updateControls, 100);
  },

  selectTopic(topicId) {
    const topic = (window.CONFIG.SPEAKING_TOPICS || []).find(t => t.id === topicId);
    if (!topic) return;

    const textInput = document.getElementById('speaking-text-input');
    if (textInput) {
      textInput.value = topic.starterFr;
      textInput.focus();
    }

    // Scroll to input dock smoothly
    const inputDock = document.querySelector('.chat-dock-container');
    if (inputDock && inputDock.scrollIntoView) {
      inputDock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  /* ================= Dedicated Atelier Phonétique (Xưởng Luyện Ngữ Âm) ================= */
  renderAtelierPhonétique() {
    const container = document.getElementById('atelier-phonetique-container');
    if (!container) return;

    const presets = (window.CONFIG && window.CONFIG.FRENCH_PHONETICS_PRESETS) || [];
    if (presets.length === 0) return;

    container.innerHTML = presets.map((preset, index) => {
      const cardId = `atelier_card_${index}`;
      return `
        <div class="atelier-card">
          <div class="atelier-card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="badge-atelier-category">${this.escapeHTML(preset.category)}</span>
              <span class="badge-atelier-pill">${this.escapeHTML(preset.badge)}</span>
            </div>
            <h4 class="atelier-title">${this.escapeHTML(preset.title)}</h4>
            <p class="atelier-desc">${this.escapeHTML(preset.description)}</p>
            <div class="atelier-mouth-guide">
              <span style="font-weight: 700; color: var(--primary); display: inline-flex; align-items: center; gap: 0.3rem;">
                ${window.Icons.get('lightbulb', '', 14)} Khẩu hình miệng chuẩn:
              </span>
              <span>${this.escapeHTML(preset.mouthGuide)}</span>
            </div>
          </div>

          <div class="atelier-pairs-list">
            ${preset.pairs.map((pair, pIdx) => {
              const pairPracticeId = `atelier_test_${index}_${pIdx}`;
              return `
                <div class="atelier-pair-item">
                  <div class="atelier-pair-left">
                    <div class="atelier-french-word">
                      <strong>${this.escapeHTML(pair.french)}</strong>
                      <span class="ipa-tag">${this.escapeHTML(pair.ipa)}</span>
                    </div>
                    <div class="atelier-meaning">${this.escapeHTML(pair.meaning)}</div>
                    <div class="atelier-compare-note">${this.escapeHTML(pair.compareWith)}</div>
                  </div>
                  <div class="atelier-pair-actions">
                    <button class="btn-sound-mini" onclick="window.SpeechService.speak('${this.escapeQuotes(pair.french)}', { rate: 0.85 })" title="Nghe người Pháp phát âm mẫu chậm">
                      ${window.Icons.get('volume', '', 12)} Nghe 0.85x
                    </button>
                    <button class="btn-record-mini" onclick="SpeakingModule.startWordPractice('${this.escapeQuotes(pair.french)}', '${pairPracticeId}')" title="Thu âm và chấm điểm">
                      ${window.Icons.get('mic', '', 12)} Luyện đọc
                    </button>
                  </div>
                  <!-- Feedback Slot -->
                  <div id="${pairPracticeId}" class="practice-result-slot hidden" style="width: 100%; margin-top: 0.5rem;"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  /* ================= DELF Assessment Evaluation ================= */
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
          <h4>Đang phân tích ngữ pháp, từ vựng và ngữ âm theo Grille DELF ${level}...</h4>
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
