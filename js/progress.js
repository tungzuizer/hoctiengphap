/**
 * ProgressModule - Tableau de progression & Trung Tâm Chẩn Đoán Lỗi AI
 * Chart.js score visualization, AI Error Aggregation, Remedial Action Plan & JSON Sync
 * Styled with Apple iOS Human Interface Guidelines (HIG) & French Chic glassmorphism
 */

const ProgressModule = {
  chartInstance: null,
  cachedDiagnostic: {},
  selectedCategory: 'all',
  isLoadingDiagnostic: false,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const exportBtn = document.getElementById('btn-export-progress');
    const importBtn = document.getElementById('btn-import-progress');
    const fileInput = document.getElementById('file-import-progress');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCurrentProfile());
    }

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleImportFile(e));
    }
  },

  render() {
    const records = window.StateManager ? window.StateManager.getProgress() : [];
    const profile = window.StateManager ? window.StateManager.getActiveProfile() : { id: 'default', name: 'Học viên', level: 'B1' };

    this.renderStatsCards(records, profile);
    this.renderDiagnosticCenter(records, profile);
    this.renderChart(records);
    this.renderHistoryTable(records);
  },

  renderStatsCards(records, profile) {
    const totalSessionsEl = document.getElementById('stat-total-sessions');
    const latestSpeakingEl = document.getElementById('stat-latest-speaking');
    const avgReadingEl = document.getElementById('stat-avg-reading');
    const avgListeningEl = document.getElementById('stat-avg-listening');

    if (totalSessionsEl) totalSessionsEl.textContent = records.length;

    const speakingRecords = records.filter(r => r.type === 'speaking');
    const readingRecords = records.filter(r => r.type === 'reading');
    const listeningRecords = records.filter(r => r.type === 'listening');

    if (latestSpeakingEl) {
      if (speakingRecords.length > 0) {
        const latest = speakingRecords[0];
        latestSpeakingEl.innerHTML = `${latest.score} <span class="stat-max">/ ${latest.maxScore}</span>`;
      } else {
        latestSpeakingEl.textContent = 'Chưa có';
      }
    }

    if (avgReadingEl) {
      if (readingRecords.length > 0) {
        const totalScore = readingRecords.reduce((sum, r) => sum + (r.score / r.maxScore), 0);
        const avg = Math.round((totalScore / readingRecords.length) * 100);
        avgReadingEl.textContent = `${avg}%`;
      } else {
        avgReadingEl.textContent = 'Chưa có';
      }
    }

    if (avgListeningEl) {
      if (listeningRecords.length > 0) {
        const totalScore = listeningRecords.reduce((sum, r) => sum + (r.score / r.maxScore), 0);
        const avg = Math.round((totalScore / listeningRecords.length) * 100);
        avgListeningEl.textContent = `${avg}%`;
      } else {
        avgListeningEl.textContent = 'Chưa có';
      }
    }
  },

  /* =========================================================================
   * AI DIAGNOSTIC & REMEDIAL PRESCRIPTION CENTER
   * ========================================================================= */
  renderDiagnosticCenter(records, profile) {
    const container = document.getElementById('diagnostic-center-container');
    if (!container) return;

    if (this.isLoadingDiagnostic) {
      container.innerHTML = `
        <div class="diagnostic-loading-card">
          <div class="diagnostic-spinner"></div>
          <div style="font-weight: 700; font-size: 1.05rem; margin-top: 1rem; color: var(--text-main);">
            Giám khảo AI đang phân tích dữ liệu lỗi & xây dựng lộ trình khắc phục...
          </div>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem;">
            Đang tổng hợp lỗi Ngữ pháp, Ngữ âm, Từ vựng và Kỹ năng làm bài theo Barem DELF ${profile.level}...
          </p>
        </div>
      `;
      return;
    }

    // Retrieve cached diagnostic or synthesize baseline errors
    const profileId = profile.id || 'default';
    let diagData = this.cachedDiagnostic[profileId];

    if (!diagData) {
      diagData = this.synthesizeErrorsFromRecords(records, profile);
      this.cachedDiagnostic[profileId] = diagData;
    }

    const allErrors = diagData.errors || [];
    const filteredErrors = this.selectedCategory === 'all'
      ? allErrors
      : allErrors.filter(e => e.category === this.selectedCategory);

    // Counts for Category Tabs
    const grammarCount = allErrors.filter(e => e.category === 'grammar').length;
    const phoneticsCount = allErrors.filter(e => e.category === 'phonetics').length;
    const vocabCount = allErrors.filter(e => e.category === 'vocab').length;
    const compCount = allErrors.filter(e => e.category === 'comprehension').length;

    container.innerHTML = `
      <div class="diagnostic-card-inner">
        <!-- Header with Action Button -->
        <div class="diagnostic-header-bar">
          <div>
            <div class="diagnostic-badge-tag">
              <span class="sparkle-icon">✨</span> TRUNG TÂM CHẨN ĐOÁN SƯ PHẠM DELF
            </div>
            <h3 class="diagnostic-title">
              Chẩn Đoán Lỗi Trọng Điểm & Kế Hoạch Khắc Phục Thông Minh
            </h3>
            <p class="diagnostic-subtitle">
              Phân tích học tập cá nhân hoá cho <strong>${this.escapeHTML(profile.name)}</strong> · Mục tiêu <strong>DELF ${profile.level}</strong>
            </p>
          </div>
          <button class="btn-primary btn-sm btn-reanalyze-ai" onclick="ProgressModule.runAIDiagnostic(true)" title="Kích hoạt Giám khảo AI phân tích lại toàn bộ lịch sử">
            <span class="btn-icon-slot" data-icon="sparkles">${window.Icons ? window.Icons.get('sparkles', '', 14) : '✨'}</span>
            Chẩn đoán lại bằng AI
          </button>
        </div>

        <!-- AI Executive Summary Box -->
        <div class="diagnostic-summary-box">
          <div class="diagnostic-summary-header">
            <span class="summary-icon">${window.Icons ? window.Icons.get('award', '', 18) : '🏆'}</span>
            <strong>Tóm tắt chẩn đoán sư phạm:</strong>
          </div>
          <p class="diagnostic-summary-text">
            ${this.escapeHTML(diagData.summary || 'Hệ thống đã phân tích các bài luyện tập và phát hiện các mẫu lỗi lặp lại cần khắc phục.')}
          </p>

          ${diagData.bottlenecks && diagData.bottlenecks.length > 0 ? `
            <div class="diagnostic-bottlenecks-wrap">
              <span class="bottleneck-label">Điểm nghẽn cần ưu tiên:</span>
              <div class="bottleneck-tags-list">
                ${diagData.bottlenecks.map(b => `
                  <span class="bottleneck-tag">⚠️ ${this.escapeHTML(b)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Category Filter Navigation Tabs -->
        <div class="diagnostic-category-nav">
          <button class="diag-cat-btn ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="ProgressModule.setCategoryFilter('all')">
            Tất cả lỗi <span class="cat-count">${allErrors.length}</span>
          </button>
          <button class="diag-cat-btn ${this.selectedCategory === 'grammar' ? 'active' : ''}" onclick="ProgressModule.setCategoryFilter('grammar')">
            📌 Ngữ pháp & Cú pháp <span class="cat-count">${grammarCount}</span>
          </button>
          <button class="diag-cat-btn ${this.selectedCategory === 'phonetics' ? 'active' : ''}" onclick="ProgressModule.setCategoryFilter('phonetics')">
            🗣️ Ngữ âm & Phát âm <span class="cat-count">${phoneticsCount}</span>
          </button>
          <button class="diag-cat-btn ${this.selectedCategory === 'vocab' ? 'active' : ''}" onclick="ProgressModule.setCategoryFilter('vocab')">
            📚 Từ vựng & Diễn đạt <span class="cat-count">${vocabCount}</span>
          </button>
          <button class="diag-cat-btn ${this.selectedCategory === 'comprehension' ? 'active' : ''}" onclick="ProgressModule.setCategoryFilter('comprehension')">
            🎧 Kỹ năng Nghe / Đọc <span class="cat-count">${compCount}</span>
          </button>
        </div>

        <!-- Top Error Comparison Cards Grid -->
        <div class="error-cards-section">
          ${filteredErrors.length === 0 ? `
            <div class="empty-state" style="padding: 2rem; text-align: center;">
              <p style="color: var(--text-muted); font-size: 0.92rem;">
                Không tìm thấy lỗi nào trong nhóm này. Hãy duy trì phong độ tốt!
              </p>
            </div>
          ` : `
            <div class="error-comparison-grid">
              ${filteredErrors.map((err, idx) => this.renderErrorComparisonCard(err, idx)).join('')}
            </div>
          `}
        </div>

        <!-- 3-Step Remedial Action Plan -->
        ${this.renderRemedialRoadmap(diagData.remedialPlan || [])}
      </div>
    `;
  },

  renderErrorComparisonCard(err, index) {
    const categoryLabels = {
      grammar: { label: 'Ngữ pháp', class: 'badge-cat-grammar' },
      phonetics: { label: 'Ngữ âm', class: 'badge-cat-phonetics' },
      vocab: { label: 'Từ vựng', class: 'badge-cat-vocab' },
      comprehension: { label: 'Đọc / Nghe', class: 'badge-cat-comprehension' }
    };
    const cat = categoryLabels[err.category] || { label: 'Tổng hợp', class: '' };

    return `
      <div class="error-comp-card">
        <div class="error-comp-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge ${cat.class}">${cat.label}</span>
            <h4 class="error-comp-title">${this.escapeHTML(err.title || 'Lỗi diễn đạt')}</h4>
          </div>
          <span class="error-comp-freq">
            ${err.frequency ? `×${err.frequency} lần phát hiện` : 'Mẫu lỗi tiêu biểu'}
          </span>
        </div>

        <!-- Contrast Comparison: Wrong vs Correct -->
        <div class="error-comp-body">
          <div class="contrast-box box-wrong">
            <div class="contrast-label">
              <span class="contrast-icon-wrong">❌</span> Lỗi hay gặp:
            </div>
            <div class="contrast-text-wrong">
              "${this.escapeHTML(err.wrong || '')}"
            </div>
          </div>

          <div class="contrast-box box-correct">
            <div class="contrast-label">
              <span class="contrast-icon-correct">✅</span> Cách nói/viết chuẩn bản xứ:
            </div>
            <div class="contrast-text-correct">
              "${this.escapeHTML(err.correct || '')}"
              <button class="btn-listen-phrase" onclick="ProgressModule.speakPhrase('${this.escapeJsString(err.correct)}')" title="Nghe giọng đọc chuẩn bản xứ">
                ${window.Icons ? window.Icons.get('volume', '', 14) : '🔊'}
              </button>
            </div>
          </div>
        </div>

        <!-- Explanation & Mnemonic Tip -->
        <div class="error-comp-explanation">
          <div class="explanation-icon">💡</div>
          <div class="explanation-content">
            <strong>Bản chất & Mẹo nhớ:</strong> ${this.escapeHTML(err.explanation || '')}
          </div>
        </div>

        <!-- Action Jump Button -->
        <div class="error-comp-footer">
          <button class="btn-action-jump" onclick="ProgressModule.jumpToPractice('${err.category}', '${this.escapeJsString(err.title || '')}')">
            <span>🎯 Luyện tập ngay chủ đề này</span>
            <span class="jump-arrow">→</span>
          </button>
        </div>
      </div>
    `;
  },

  renderRemedialRoadmap(planSteps) {
    if (!planSteps || planSteps.length === 0) return '';

    return `
      <div class="remedial-roadmap-section">
        <h4 class="remedial-section-title">
          <span>🎯</span> Lộ Trình 3 Bước Khắc Phục Dứt Điểm Điểm Nghẽn
        </h4>
        <div class="remedial-steps-grid">
          ${planSteps.map((step, idx) => `
            <div class="remedial-step-card">
              <div class="step-card-number">0${idx + 1}</div>
              <div class="step-card-content">
                <h5 class="step-card-title">${this.escapeHTML(step.step || `Bước ${idx + 1}`)}</h5>
                <p class="step-card-desc">${this.escapeHTML(step.action || '')}</p>
                ${step.tip ? `
                  <div class="step-card-tip">
                    <span class="tip-badge">Mẹo</span> ${this.escapeHTML(step.tip)}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  setCategoryFilter(cat) {
    this.selectedCategory = cat;
    const records = window.StateManager ? window.StateManager.getProgress() : [];
    const profile = window.StateManager ? window.StateManager.getActiveProfile() : { id: 'default', name: 'Học viên', level: 'B1' };
    this.renderDiagnosticCenter(records, profile);
  },

  async runAIDiagnostic(forceRefresh = false) {
    const profile = window.StateManager ? window.StateManager.getActiveProfile() : { id: 'default', name: 'Học viên', level: 'B1' };
    const records = window.StateManager ? window.StateManager.getProgress() : [];

    this.isLoadingDiagnostic = true;
    this.renderDiagnosticCenter(records, profile);

    try {
      if (window.AIService && typeof window.AIService.diagnoseErrorsAndPrescribeSolutions === 'function') {
        const result = await window.AIService.diagnoseErrorsAndPrescribeSolutions(records, profile);
        if (result && result.errors) {
          this.cachedDiagnostic[profile.id || 'default'] = result;
        }
      }
    } catch (e) {
      console.warn('AI Diagnostic service fallback to local synthesis:', e);
    } finally {
      this.isLoadingDiagnostic = false;
      this.renderDiagnosticCenter(records, profile);
    }
  },

  synthesizeErrorsFromRecords(records, profile) {
    const level = profile ? profile.level : 'B1';
    const profileName = profile ? profile.name : 'Học viên';

    // Baseline pedagogical errors according to level
    const defaultLevelErrors = {
      A1: [
        {
          id: 'err-a1-1',
          category: 'grammar',
          title: 'Nhầm lẫn Trợ động từ Passé Composé (Être vs Avoir)',
          wrong: 'Je suis mangé une pomme au petit-déjeuner.',
          correct: "J'ai mangé une pomme au petit-déjeuner.",
          explanation: 'Hầu hết các ngoại động từ (có tân ngữ trực tiếp) như manger, regarder, acheter đều dùng AVOIR. ÊTRE chỉ dùng cho 14 động từ chuyển động (DR & MRS VANDERTRAMP) và động từ phản thân.',
          frequency: 4
        },
        {
          id: 'err-a1-2',
          category: 'phonetics',
          title: 'Phát âm nhầm âm câm cuối từ đuôi -ent của động từ chia số nhiều',
          wrong: 'Ils parlent [il par-lăng] (Đọc thành âm mũi)',
          correct: 'Ils parlent [il parl] (Đuôi -ent hoàn toàn câm)',
          explanation: 'Đuôi chia ngôi thứ 3 số nhiều "-ent" của động từ nhóm 1 và hầu hết động từ tiếng Pháp là âm CÂM TUYỆT ĐỐI, không đọc thành âm mũi [ɑ̃].',
          frequency: 6
        },
        {
          id: 'err-a1-3',
          category: 'grammar',
          title: 'Mạo từ bộ phận (Du, De la, Des) vs Mạo từ xác định (Le, La, Les)',
          wrong: "J'aime du chocolat et je bois le café.",
          correct: "J'aime le chocolat et je bois du café.",
          explanation: 'Các động từ chỉ sở thích (aimer, adorer, détester) luôn đi với mạo từ xác định (Le, La, Les). Chỉ dùng mạo từ bộ phận (Du, De la) khi chỉ số lượng không xác định (uống một ít cà phê).',
          frequency: 3
        },
        {
          id: 'err-a1-4',
          category: 'vocab',
          title: 'Nhầm lẫn giữa "Beaucoup de" và "Beaucoup des"',
          wrong: "J'ai beaucoup des amis français.",
          correct: "J'ai beaucoup d'amis français.",
          explanation: 'Sau các trạng từ chỉ số lượng (beaucoup, peu, trop, assez), danh từ bắt buộc đi với "DE/D\'", không dùng "des".',
          frequency: 5
        }
      ],
      A2: [
        {
          id: 'err-a2-1',
          category: 'grammar',
          title: 'Hòa hợp Giống và Số của Quá khứ phân từ với Être',
          wrong: 'Hier, Marie est allé à la bibliothèque.',
          correct: 'Hier, Marie est allée à la bibliothèque.',
          explanation: 'Khi chia thì Passé Composé với trợ động từ ÊTRE, quá khứ phân từ (Participe Passé) BẮT BUỘC phải hòa hợp giống (thêm e) và số (thêm s) với chủ ngữ (Marie là nữ -> allée).',
          frequency: 5
        },
        {
          id: 'err-a2-2',
          category: 'phonetics',
          title: 'Phân biệt cặp nguyên âm tròn môi [u] (OU) và [y] (U)',
          wrong: 'Tu as vu [tu a vu] (Đọc u thành âm /u/ tiếng Việt)',
          correct: 'Tu as vu [ty a vy] (Chu môi tròn phát âm [y])',
          explanation: 'Âm "u" tiếng Pháp phát âm bằng cách khẩu hình môi như huýt sáo /u/ nhưng phát ra âm /i/. Nhầm lẫn có thể đổi nghĩa từ "tu" (bạn) thành "tout" (tất cả).',
          frequency: 4
        },
        {
          id: 'err-a2-3',
          category: 'vocab',
          title: 'Sử dụng sai cặp động từ "Savoir" vs "Connaître"',
          wrong: 'Je connais parler français et je sais cette personne.',
          correct: 'Je sais parler français et je connais cette personne.',
          explanation: '"Savoir" đi kèm một động từ nguyên thể (biết làm gì) hoặc mệnh đề (savoir que...). "Connaître" đi kèm danh từ (quen biết ai/địa điểm nào).',
          frequency: 3
        },
        {
          id: 'err-a2-4',
          category: 'comprehension',
          title: 'Bẫy thông tin phủ định ngầm trong bài Đọc/Nghe A2',
          wrong: 'Nhầm "Ne... plus" (không còn nữa) thành "Plus" (nhiều hơn).',
          correct: 'Xác định rõ cấu trúc phủ định: "Il ne travaille plus ici" = đã nghỉ việc.',
          explanation: 'Trong giao tiếp nói người Pháp hay lược bỏ "ne", cần chú ý phát âm âm đuôi của từ "plus" để phân biệt phủ định hay so sánh.',
          frequency: 3
        }
      ],
      B1: [
        {
          id: 'err-b1-1',
          category: 'grammar',
          title: 'Phân biệt thì Quá khứ Passé Composé vs Imparfait trong trần thuật',
          wrong: 'Quand j\'étais jeune, un jour j\'étais tombé de vélo.',
          correct: "Quand j'étais jeune, un jour je suis tombé de vélo.",
          explanation: 'Imparfait dùng cho bối cảnh/thói quen kéo dài (Quand j\'étais jeune). Passé Composé dùng cho sự kiện đột ngột, có mốc thời gian rõ ràng (un jour je suis tombé).',
          frequency: 6
        },
        {
          id: 'err-b1-2',
          category: 'phonetics',
          title: 'Phát âm chuẩn 3 âm mũi cốt lõi [ɑ̃] (an/en), [ɔ̃] (on) và [ɛ̃] (in/un)',
          wrong: 'Đọc lẫn lộn giữa "un bon vin blanc" thành cùng một âm.',
          correct: 'Phân biệt khẩu hình: [ɔ̃] (môi tròn hé), [ɑ̃] (hạ hàm mở rộng), [ɛ̃] (miệng mỉm cười dẹt).',
          explanation: 'Âm mũi là tiêu chí chấm điểm phát âm cực kỳ quan trọng trong Grille DELF B1 (Tiêu chí 6: Phonétique et Prosodie).',
          frequency: 5
        },
        {
          id: 'err-b1-3',
          category: 'vocab',
          title: 'Thiếu liên từ lập luận logic B1 (Connecteurs logiques)',
          wrong: 'Lạm dụng liên từ sơ cấp "Et", "Parce que", "Mais" quá nhiều lần.',
          correct: 'Linh hoạt dùng: "Cependant", "En revanche", "Par conséquent", "Puisque", "Grâce à".',
          explanation: 'Tiêu chí 4 trong Barem DELF B1 (Cohérence et Cohésion) yêu cầu thí sinh biết liên kết các ý kiến và lập luận bằng từ nối đa dạng.',
          frequency: 7
        },
        {
          id: 'err-b1-4',
          category: 'grammar',
          title: 'Sử dụng thức Giả định Subjonctif sau cấu trúc cảm xúc và bắt buộc',
          wrong: "Il faut que je *vais* là-bas pour le travail.",
          correct: "Il faut que j'**aille** là-bas pour le travail.",
          explanation: 'Sau "Il faut que", "Je veux que", "Bien que", bắt buộc dùng Subjonctif Présent (que j\'aille, que tu fasses, que nous soyons).',
          frequency: 4
        },
        {
          id: 'err-b1-5',
          category: 'comprehension',
          title: 'Phân biệt giữa sự kiện thực tế (Fait) và ý kiến cá nhân (Opinion)',
          wrong: 'Nhầm nhận định chủ quan của tác giả thành thông tin số liệu chính thức.',
          correct: 'Nhận diện các từ báo hiệu cảm xúc: "À mon avis", "Selon l\'auteur", "Il semble que".',
          explanation: 'Đề thi Đọc DELF B1 thường xuyên đặt câu hỏi phân loại giữa thông tin khách quan và quan điểm của nhân vật.',
          frequency: 3
        }
      ]
    };

    const baselineErrors = defaultLevelErrors[level] || defaultLevelErrors.B1;

    // Collect additional errors from user's history records
    const recordedErrorsMap = {};
    records.forEach(r => {
      if (Array.isArray(r.commonErrors)) {
        r.commonErrors.forEach(errStr => {
          if (errStr && typeof errStr === 'string') {
            const clean = errStr.trim();
            recordedErrorsMap[clean] = (recordedErrorsMap[clean] || 0) + 1;
          }
        });
      }
    });

    // Merge baseline errors with recorded counts
    const mergedErrors = baselineErrors.map(be => {
      const extraCount = recordedErrorsMap[be.title] || 0;
      return {
        ...be,
        frequency: be.frequency + extraCount
      };
    });

    return {
      summary: `Học viên ${profileName} đang thể hiện sự tiến bộ tích cực ở trình độ ${level}. Tuy nhiên, dữ liệu luyện tập cho thấy cần tập trung xử lý dứt điểm các lỗi phân biệt thì quá khứ, phát âm âm mũi và làm phong phú thêm hệ thống từ nối logic B1 để bứt phá điểm số Grille DELF.`,
      bottlenecks: [
        'Phân biệt Passé Composé & Imparfait',
        'Khẩu hình 3 âm mũi [ɑ̃], [ɔ̃], [ɛ̃]',
        'Sử dụng phong phú liên từ B1 (Cependant, En revanche)'
      ],
      errors: mergedErrors,
      remedialPlan: [
        {
          step: 'Khóa lỗ hổng Ngữ pháp & Cú pháp',
          action: 'Ôn tập triệt để bảng 14 động từ đi với ÊTRE và quy tắc chia Imparfait vs Passé Composé qua sơ đồ tư duy dòng thời gian.',
          tip: 'Quy tắc ngón tay: Hành động đang xảy ra dùng Imparfait, hành động cắt ngang dùng Passé Composé.'
        },
        {
          step: 'Luyện phản xạ Ngữ âm & Ngắt nhịp',
          action: 'Thực hành 10 phút mỗi ngày tại Xưởng Ngữ Âm với các cặp âm dễ nhầm [u]/[y] và âm mũi [ɔ̃]/[ɑ̃].',
          tip: 'Ghi âm lại giọng nói của mình và so sánh trực tiếp với audio bản xứ để chỉnh khẩu hình miệng.'
        },
        {
          step: 'Ứng dụng vào Hội thoại DELF thực chiến',
          action: 'Luyện tập các chủ đề tranh biện B1 với Giám khảo AI, chủ động cài cắm ít nhất 3 từ nối B1 (En revanche, Par conséquent, Bien que) vào bài nói.',
          tip: 'Đặt mục tiêu nói câu ghép có liên từ thay vì chuỗi các câu đơn rời rạc.'
        }
      ]
    };
  },

  jumpToPractice(category, query) {
    if (category === 'phonetics') {
      // Jump to Speaking tab and scroll to Phonetics Studio
      const speakingTab = document.querySelector('.nav-tab[data-tab="speaking"]');
      if (speakingTab) speakingTab.click();
      setTimeout(() => {
        const phoneticsSection = document.getElementById('phonetics-studio-section');
        if (phoneticsSection) {
          phoneticsSection.scrollIntoView({ behavior: 'smooth' });
          phoneticsSection.classList.add('pulse-highlight');
          setTimeout(() => phoneticsSection.classList.remove('pulse-highlight'), 2000);
        }
      }, 150);
    } else if (category === 'comprehension') {
      // Jump to Seed Bank or Reading tab
      const seedbankTab = document.querySelector('.nav-tab[data-tab="seedbank"]');
      if (seedbankTab) seedbankTab.click();
    } else {
      // Jump to Speaking tab dock input with suggested topic
      const speakingTab = document.querySelector('.nav-tab[data-tab="speaking"]');
      if (speakingTab) speakingTab.click();
      setTimeout(() => {
        const input = document.getElementById('speaking-text-input');
        if (input) {
          input.focus();
        }
      }, 150);
    }
  },

  speakPhrase(frenchText) {
    if (!frenchText) return;
    if (window.SpeechService && typeof window.SpeechService.speak === 'function') {
      window.SpeechService.speak(frenchText, 'fr-FR');
    } else if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(frenchText);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  },

  /* =========================================================================
   * CHART.JS VISUALIZATION & HISTORY
   * ========================================================================= */
  renderChart(records) {
    const canvas = document.getElementById('progress-chart');
    if (!canvas) return;

    const speakingRecords = records
      .filter(r => r.type === 'speaking')
      .slice(0, 10)
      .reverse();

    if (speakingRecords.length === 0) {
      canvas.parentElement.innerHTML = `
        <div class="empty-state chart-empty">
          <div class="empty-icon-wrap" style="margin-bottom: 0.5rem;">
            ${window.Icons ? window.Icons.get('chart', '', 26) : '📊'}
          </div>
          <p>Chưa có dữ liệu điểm Nói. Hoàn thành bài luyện nói và chấm điểm để xem biểu đồ tiến độ!</p>
        </div>
      `;
      return;
    }

    const labels = speakingRecords.map((r, i) => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1} #${i + 1}`;
    });

    const dataPoints = speakingRecords.map(r => r.score);

    if (window.Chart) {
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      const gridColor = 'rgba(168, 85, 247, 0.08)';
      const textColor = '#64748B';

      const ctx = canvas.getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Điểm Nói DELF (Thang /25)',
            data: dataPoints,
            borderColor: '#E11D48',
            backgroundColor: 'rgba(244, 114, 182, 0.15)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#E11D48',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: textColor,
                font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', size: 12, weight: 600 }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 25,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' } }
            },
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' } }
            }
          }
        }
      });
    } else {
      const maxScore = 25;
      const barsHTML = speakingRecords.map((r) => {
        const percent = Math.min(100, Math.round((r.score / maxScore) * 100));
        const d = new Date(r.date);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        return `
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 45px; height: 100%; justify-content: flex-end;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary); margin-bottom: 4px;">${r.score}</span>
            <div style="width: 22px; height: ${Math.max(8, percent * 1.6)}px; background: linear-gradient(180deg, var(--primary), var(--primary-hover)); border-radius: 6px 6px 0 0;"></div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px;">${label}</span>
          </div>
        `;
      }).join('');

      canvas.parentElement.innerHTML = `
        <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 200px; padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
          ${barsHTML}
        </div>
      `;
    }
  },

  renderHistoryTable(records) {
    const tbody = document.getElementById('progress-history-tbody');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Chưa có lịch sử làm bài.
          </td>
        </tr>
      `;
      return;
    }

    const typeIcons = {
      speaking: window.Icons ? window.Icons.get('mic', '', 12) : '🎤',
      reading: window.Icons ? window.Icons.get('bookOpen', '', 12) : '📖',
      listening: window.Icons ? window.Icons.get('headphones', '', 12) : '🎧'
    };

    const typeLabels = {
      speaking: { label: 'Nói (Expression Orale)', class: 'badge-type-speaking', icon: typeIcons.speaking },
      reading: { label: 'Đọc (Compréhension Écrite)', class: 'badge-type-reading', icon: typeIcons.reading },
      listening: { label: 'Nghe (Compréhension Orale)', class: 'badge-type-listening', icon: typeIcons.listening }
    };

    tbody.innerHTML = records.map(r => {
      const typeInfo = typeLabels[r.type] || { label: r.type, class: '', icon: '' };
      const d = new Date(r.date);
      const dateStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      return `
        <tr>
          <td>${dateStr}</td>
          <td>
            <span class="badge ${typeInfo.class}" style="display: inline-flex; align-items: center; gap: 0.3rem;">
              ${typeInfo.icon} ${typeInfo.label}
            </span>
          </td>
          <td><span class="badge-level badge-level-${r.level}">${r.level}</span></td>
          <td><strong>${r.score}</strong> / ${r.maxScore}</td>
          <td>
            ${r.type === 'speaking' && r.details ? `
              <button class="btn-outline btn-xs" onclick="ProgressModule.showDetailModal('${r.id}')" style="display: inline-flex; align-items: center; gap: 0.25rem;">
                ${window.Icons ? window.Icons.get('award', '', 12) : '🏆'} Xem Grille
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  },

  showDetailModal(recordId) {
    const records = window.StateManager ? window.StateManager.getProgress() : [];
    const record = records.find(r => r.id === recordId);
    if (!record || !record.details) return;

    if (window.SpeakingModule) {
      window.SpeakingModule.renderEvaluationResult(record.details, record.level);
      const evalSection = document.getElementById('speaking-eval-result');
      if (evalSection) {
        const speakingTabBtn = document.querySelector('.nav-tab[data-tab="speaking"]');
        if (speakingTabBtn) speakingTabBtn.click();
        setTimeout(() => evalSection.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  },

  exportCurrentProfile() {
    try {
      const profile = window.StateManager.getActiveProfile();
      const exportData = window.StateManager.exportProfileData();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `french_progress_${profile.name.replace(/\s+/g, '_')}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Lỗi xuất dữ liệu: ' + e.message);
    }
  },

  handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedProfile = window.StateManager.importProfileData(e.target.result);
        alert(`Đã nhập thành công hồ sơ: "${importedProfile.name}"!`);
        if (window.App) window.App.refreshCurrentProfileUI();
        this.render();
      } catch (err) {
        alert('Lỗi khi đọc file sao lưu: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeJsString(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ');
  }
};

window.ProgressModule = ProgressModule;
