/**
 * SeedBankModule - Banque de sujets authentiques (RFI, TV5MONDE, DELF B1)
 * Manages authentic French transcripts, user additions, and test generation triggers
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const SeedBankModule = {
  activeFilterLevel: 'ALL',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const addSeedForm = document.getElementById('form-add-seed');
    const filterBtns = document.querySelectorAll('.btn-seed-filter');

    if (addSeedForm) {
      addSeedForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddSeed();
      });
    }

    if (filterBtns) {
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeFilterLevel = btn.dataset.level || 'ALL';
          this.render();
        });
      });
    }
  },

  render() {
    const listContainer = document.getElementById('seed-list-container');
    if (!listContainer) return;

    let seeds = window.StateManager.getSeeds();
    if (this.activeFilterLevel !== 'ALL') {
      seeds = seeds.filter(s => s.level === this.activeFilterLevel);
    }

    if (seeds.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            ${window.Icons.get('folder', '', 28)}
          </div>
          <h3>Không có đề thi nào</h3>
          <p>Không tìm thấy đề thi mẫu trong phân loại này. Bạn có thể thêm đề mới bằng biểu mẫu bên cạnh.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = seeds.map(seed => `
      <div class="seed-card" data-id="${seed.id}">
        <div class="seed-card-header">
          <div class="seed-badges">
            <span class="badge-level badge-level-${seed.level}">${seed.level}</span>
            <span class="badge-topic">${this.escapeHTML(seed.topic || 'Tổng hợp')}</span>
          </div>
          ${seed.isCustom ? `
            <button class="btn-delete-seed" onclick="SeedBankModule.deleteSeed('${seed.id}')" title="Xóa đề này">
              ${window.Icons.get('trash', '', 14)}
            </button>
          ` : `
            <span class="badge-official">
              ${window.Icons.get('star', '', 12)} Nguồn Chuẩn
            </span>
          `}
        </div>

        <h4 class="seed-title">${this.escapeHTML(seed.title)}</h4>
        <div class="seed-source">
          Nguồn: <strong>${this.escapeHTML(seed.source)}</strong>
          ${seed.sourceUrl ? ` · <a href="${seed.sourceUrl}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 0.25rem; color: var(--primary);">Truy cập ${window.Icons.get('externalLink', '', 11)}</a>` : ''}
        </div>

        <div class="seed-transcript-preview">
          ${this.escapeHTML(seed.transcript)}
        </div>

        <div class="seed-actions">
          <button class="btn-primary btn-sm" onclick="SeedBankModule.useForReading('${seed.id}')">
            ${window.Icons.get('bookOpen', '', 14)} Sinh bài Đọc từ đề này
          </button>
          <button class="btn-secondary btn-sm" onclick="SeedBankModule.useForListening('${seed.id}')">
            ${window.Icons.get('headphones', '', 14)} Sinh bài Nghe từ đề này
          </button>
          <button class="btn-outline btn-sm" onclick="window.SpeechService.speak('${this.escapeQuotes(seed.transcript)}')">
            ${window.Icons.get('volume', '', 14)} Nghe thử
          </button>
        </div>
      </div>
    `).join('');
  },

  handleAddSeed() {
    const titleInput = document.getElementById('seed-input-title');
    const sourceInput = document.getElementById('seed-input-source');
    const sourceUrlInput = document.getElementById('seed-input-url');
    const levelSelect = document.getElementById('seed-input-level');
    const topicInput = document.getElementById('seed-input-topic');
    const transcriptTextarea = document.getElementById('seed-input-transcript');

    const title = titleInput?.value.trim();
    const source = sourceInput?.value.trim();
    const sourceUrl = sourceUrlInput?.value.trim();
    const level = levelSelect?.value || 'B1';
    const topic = topicInput?.value.trim();
    const transcript = transcriptTextarea?.value.trim();

    if (!transcript) {
      alert('Vui lòng nhập nội dung transcript tiếng Pháp!');
      return;
    }

    window.StateManager.addSeed({
      title: title || 'Bài mẫu tiếng Pháp ' + level,
      source: source || 'Tự thêm',
      sourceUrl,
      level,
      topic: topic || 'Đời sống',
      transcript
    });

    // Reset form
    if (titleInput) titleInput.value = '';
    if (sourceInput) sourceInput.value = '';
    if (sourceUrlInput) sourceUrlInput.value = '';
    if (topicInput) topicInput.value = '';
    if (transcriptTextarea) transcriptTextarea.value = '';

    // Update selectors in other modules
    if (window.ReadingModule) window.ReadingModule.populateSeedOptions();
    if (window.ListeningModule) window.ListeningModule.populateSeedOptions();

    this.render();
    alert('Đã thêm đề thi mới vào Ngân hàng đề thành công!');
  },

  deleteSeed(id) {
    if (confirm('Bạn có chắc muốn xóa đề thi này khỏi kho đề?')) {
      window.StateManager.deleteSeed(id);
      if (window.ReadingModule) window.ReadingModule.populateSeedOptions();
      if (window.ListeningModule) window.ListeningModule.populateSeedOptions();
      this.render();
    }
  },

  useForReading(seedId) {
    if (window.App && window.App.switchTab) {
      window.App.switchTab('reading');
    } else {
      const tabBtn = document.querySelector('.nav-tab[data-tab="reading"]');
      if (tabBtn) tabBtn.click();
    }

    if (window.ReadingModule) {
      window.ReadingModule.populateSeedOptions();
      window.ReadingModule.generateNewExercise(seedId);
    }
  },

  useForListening(seedId) {
    if (window.App && window.App.switchTab) {
      window.App.switchTab('listening');
    } else {
      const tabBtn = document.querySelector('.nav-tab[data-tab="listening"]');
      if (tabBtn) tabBtn.click();
    }

    if (window.ListeningModule) {
      window.ListeningModule.populateSeedOptions();
      window.ListeningModule.generateNewExercise(seedId);
    }
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

window.SeedBankModule = SeedBankModule;
