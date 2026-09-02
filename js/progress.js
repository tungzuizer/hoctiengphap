/**
 * ProgressModule - Tableau de progression & Statistiques
 * Chart.js score visualization, frequent error aggregator & profile JSON export/import
 * Styled with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const ProgressModule = {
  chartInstance: null,

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
    const records = window.StateManager.getProgress();
    const profile = window.StateManager.getActiveProfile();

    this.renderStatsCards(records, profile);
    this.renderChart(records);
    this.renderFrequentErrors(records);
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
            ${window.Icons.get('chart', '', 26)}
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

    // If Chart.js is loaded from CDN
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
            borderColor: '#0071E3',
            backgroundColor: 'rgba(0, 113, 227, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#0071E3',
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
      // Clean SVG/HTML Fallback when running offline or CDN unavailable
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

  renderFrequentErrors(records) {
    const container = document.getElementById('frequent-errors-container');
    if (!container) return;

    const errorCountMap = {};
    records.forEach(r => {
      if (Array.isArray(r.commonErrors)) {
        r.commonErrors.forEach(err => {
          if (err && typeof err === 'string') {
            const cleanErr = err.trim();
            errorCountMap[cleanErr] = (errorCountMap[cleanErr] || 0) + 1;
          }
        });
      }
    });

    const errorEntries = Object.entries(errorCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    if (errorEntries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Chưa phát hiện lỗi lặp lại. Hệ thống sẽ tự động tổng hợp lỗi ngữ pháp sau các buổi luyện nói.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="error-badge-grid">
        ${errorEntries.map(([err, count]) => `
          <div class="error-freq-item">
            <span class="error-freq-count">×${count}</span>
            <span class="error-freq-name">${this.escapeHTML(err)}</span>
          </div>
        `).join('')}
      </div>
    `;
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
      speaking: window.Icons.get('mic', '', 12),
      reading: window.Icons.get('bookOpen', '', 12),
      listening: window.Icons.get('headphones', '', 12)
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
                ${window.Icons.get('award', '', 12)} Xem Grille
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  },

  showDetailModal(recordId) {
    const records = window.StateManager.getProgress();
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
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.ProgressModule = ProgressModule;
