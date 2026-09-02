/**
 * App - Main Controller & Application Orchestrator
 * Coordinates profile switching, navigation tabs, theme toggling & module lifecycles
 * Formatted with Apple iOS Human Interface Guidelines (HIG) & vector SVG icons
 */

const App = {
  activeTab: 'speaking',

  init() {
    // 1. Render all SVG Icons in Static Slots
    this.renderStaticIcons();

    // 2. Initialize State & Speech services
    if (window.StateManager) window.StateManager.init();
    if (window.SpeechService) window.SpeechService.init();

    // 3. Initialize Theme
    this.initTheme();

    // 4. Bind Global Events & Touch Gestures
    this.bindEvents();
    this.initTouchGestures();

    // 5. Update Profile Badge
    this.refreshCurrentProfileUI();

    // 6. Initialize Sub-modules
    if (window.SpeakingModule) window.SpeakingModule.init();
    if (window.ReadingModule) window.ReadingModule.init();
    if (window.ListeningModule) window.ListeningModule.init();
    if (window.SeedBankModule) window.SeedBankModule.init();
    if (window.ProgressModule) window.ProgressModule.init();

    // 7. Check if initial user needs to configure API Key
    this.checkInitialConfig();
  },

  renderStaticIcons() {
    if (!window.Icons) return;

    // Brand Logo Slot
    const logoSlot = document.getElementById('brand-logo-slot');
    if (logoSlot) logoSlot.innerHTML = window.Icons.get('frenchCockade', '', 28);

    // Avatar Slot
    const avatarSlot = document.getElementById('header-avatar-slot');
    if (avatarSlot) avatarSlot.innerHTML = window.Icons.get('user', '', 14);

    // Settings Slot
    const settingsSlot = document.getElementById('settings-icon-slot');
    if (settingsSlot) settingsSlot.innerHTML = window.Icons.get('settings', '', 18);

    // Mic Slot (Dock Input)
    const micSlot = document.getElementById('mic-icon-slot');
    if (micSlot) micSlot.innerHTML = window.Icons.get('mic', '', 20);

    // Send Slot
    const sendSlot = document.getElementById('send-icon-slot');
    if (sendSlot) sendSlot.innerHTML = window.Icons.get('send', '', 15);

    // Empty state icons
    const readingEmpty = document.getElementById('reading-empty-icon');
    if (readingEmpty) readingEmpty.innerHTML = window.Icons.get('bookOpen', '', 30);

    const listeningEmpty = document.getElementById('listening-empty-icon');
    if (listeningEmpty) listeningEmpty.innerHTML = window.Icons.get('headphones', '', 30);

    // Progress stat icons
    const statTotal = document.getElementById('stat-icon-total');
    if (statTotal) statTotal.innerHTML = window.Icons.get('target', '', 20);

    const statSpeaking = document.getElementById('stat-icon-speaking');
    if (statSpeaking) statSpeaking.innerHTML = window.Icons.get('mic', '', 20);

    const statReading = document.getElementById('stat-icon-reading');
    if (statReading) statReading.innerHTML = window.Icons.get('bookOpen', '', 20);

    const statListening = document.getElementById('stat-icon-listening');
    if (statListening) statListening.innerHTML = window.Icons.get('headphones', '', 20);

    // Tab icons
    document.querySelectorAll('.tab-icon-slot').forEach(el => {
      const iconName = el.dataset.icon;
      if (iconName) el.innerHTML = window.Icons.get(iconName, '', 17);
    });

    // Header icons
    document.querySelectorAll('.header-icon-slot').forEach(el => {
      const iconName = el.dataset.icon;
      if (iconName) el.innerHTML = window.Icons.get(iconName, '', 18);
    });

    // Welcome Banner Icons
    const welcomeAvatar = document.getElementById('welcome-avatar-icon');
    if (welcomeAvatar) welcomeAvatar.innerHTML = window.Icons.get('heart', '', 24);

    document.querySelectorAll('.welcome-sparkle-slot').forEach(el => {
      const iconName = el.dataset.icon || 'sparkles';
      el.innerHTML = window.Icons.get(iconName, '', 18);
    });

    document.querySelectorAll('.chip-icon-slot').forEach(el => {
      const iconName = el.dataset.icon;
      if (iconName) el.innerHTML = window.Icons.get(iconName, '', 14);
    });

    // Button icon slots
    document.querySelectorAll('.btn-icon-slot').forEach(el => {
      const iconName = el.dataset.icon;
      if (iconName) el.innerHTML = window.Icons.get(iconName, '', 15);
    });
  },

  bindEvents() {
    // Tab switching
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        if (targetTab) this.switchTab(targetTab);
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Profile Switcher button
    const profileBtn = document.getElementById('btn-profile-badge');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.openProfileModal());
    }

    // Profile Modal buttons
    const closeProfileModalBtn = document.getElementById('btn-close-profile-modal');
    if (closeProfileModalBtn) {
      closeProfileModalBtn.addEventListener('click', () => this.closeProfileModal());
    }

    const formCreateProfile = document.getElementById('form-create-profile');
    if (formCreateProfile) {
      formCreateProfile.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateProfile();
      });
    }
  },

  initTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    let isTracking = false;

    const container = document.querySelector('.app-container') || document.body;

    container.addEventListener('touchstart', (e) => {
      // Strictly disabled on desktop / wide screens (width > 768px) to prevent interfering with mouse/trackpad
      if (window.innerWidth > 768) {
        isTracking = false;
        return;
      }

      const target = e.target;
      // Skip gesture handling when interacting with interactive UI elements or scrollable areas
      if (
        target.closest('.modal') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('button') ||
        target.closest('.chat-messages-container') ||
        target.closest('.topics-bento-grid') ||
        target.closest('.phonetics-items-grid') ||
        target.closest('.rate-buttons') ||
        target.closest('.options-list') ||
        target.closest('.seeds-grid') ||
        target.closest('.seed-grid') ||
        target.closest('.table-responsive')
      ) {
        isTracking = false;
        return;
      }

      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        touchStartTime = Date.now();
        isTracking = true;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isTracking) return;
      if (e.touches && e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
      }
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isTracking) return;
      isTracking = false;

      // Only on mobile screens
      if (window.innerWidth > 768) return;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const duration = Date.now() - touchStartTime;

      // Must be a deliberate, fast swipe (duration < 450ms, distance >= 75px, horizontal dominance > 2.2x vertical)
      if (duration < 450 && duration > 50 && Math.abs(deltaX) >= 75 && Math.abs(deltaX) > Math.abs(deltaY) * 2.2) {
        if (deltaX < 0) {
          // Swipe Left -> Next Tab
          this.switchAdjacentTab(1);
        } else {
          // Swipe Right -> Prev Tab
          this.switchAdjacentTab(-1);
        }
      }
    }, { passive: true });
  },

  switchAdjacentTab(direction) {
    const tabs = ['speaking', 'reading', 'listening', 'seedbank', 'progress'];
    const currentIndex = tabs.indexOf(this.activeTab);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < tabs.length) {
      this.switchTab(tabs[nextIndex]);
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update Tab Buttons
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
        // Scroll active tab into view on mobile
        if (tab.scrollIntoView) {
          tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else {
        tab.classList.remove('active');
      }
    });

    // Update Tab Panels
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
      if (panel.id === `tab-${tabId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Trigger tab-specific refresh
    if (tabId === 'progress' && window.ProgressModule) {
      window.ProgressModule.render();
    } else if (tabId === 'seedbank' && window.SeedBankModule) {
      window.SeedBankModule.render();
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem('delf_app_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButtonIcon(savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('delf_app_theme', next);
    this.updateThemeButtonIcon(next);
  },

  updateThemeButtonIcon(theme) {
    const iconEl = document.getElementById('theme-icon');
    if (iconEl && window.Icons) {
      iconEl.innerHTML = theme === 'dark' ? window.Icons.get('sun', '', 18) : window.Icons.get('moon', '', 18);
    }
  },

  refreshCurrentProfileUI() {
    const profile = window.StateManager.getActiveProfile();
    if (!profile) return;

    const nameEl = document.getElementById('header-profile-name');
    const levelEl = document.getElementById('header-profile-level');
    const welcomeNameEl = document.getElementById('welcome-profile-name');
    const welcomeLevelBadgeEl = document.getElementById('welcome-profile-level-badge');
    const welcomeSessionCountEl = document.getElementById('welcome-session-count');

    if (nameEl) nameEl.textContent = profile.name;
    if (levelEl) levelEl.textContent = profile.level;
    if (welcomeNameEl) welcomeNameEl.textContent = profile.name;
    if (welcomeLevelBadgeEl) welcomeLevelBadgeEl.textContent = `Objectif DELF ${profile.level}`;

    if (welcomeSessionCountEl && window.StateManager.getProgress) {
      const count = window.StateManager.getProgress(profile.id).length;
      welcomeSessionCountEl.textContent = `${count} buổi học`;
    }
  },

  checkInitialConfig() {
    const profile = window.StateManager.getActiveProfile();
    if (!profile) return;

    const config = window.StateManager.getProfileConfig(profile.id);
    if (!config || !config.apiKey) {
      console.log('No API key configured for profile. Ready for OmniRoute / Mock test mode.');
    }
  },

  /* ================= Profile Modal Management ================= */
  openProfileModal() {
    const modal = document.getElementById('modal-profile-switcher');
    if (!modal) return;
    this.renderProfileList();
    modal.classList.remove('hidden');
  },

  closeProfileModal() {
    const modal = document.getElementById('modal-profile-switcher');
    if (modal) modal.classList.add('hidden');
  },

  renderProfileList() {
    const listContainer = document.getElementById('modal-profile-list');
    if (!listContainer) return;

    const profiles = window.StateManager.getProfiles();
    const activeProfile = window.StateManager.getActiveProfile();

    listContainer.innerHTML = profiles.map(p => `
      <div class="profile-card-item ${activeProfile && activeProfile.id === p.id ? 'active' : ''}" onclick="App.switchProfile('${p.id}')">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="badge-level badge-level-${p.level}">${p.level}</span>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${this.escapeHTML(p.name)}</div>
            <small style="color: var(--text-muted); font-size: 0.78rem;">Tạo ngày ${new Date(p.createdAt).toLocaleDateString()}</small>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${activeProfile && activeProfile.id === p.id ? `<span style="color: var(--primary); font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 0.25rem;">${window.Icons.get('check', '', 14)} Đang dùng</span>` : ''}
          ${profiles.length > 1 ? `
            <button class="btn-outline btn-xs" onclick="event.stopPropagation(); App.deleteProfile('${p.id}')" title="Xóa hồ sơ">
              ${window.Icons.get('trash', '', 13)}
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  switchProfile(profileId) {
    window.StateManager.setActiveProfileId(profileId);
    this.refreshCurrentProfileUI();
    this.closeProfileModal();

    // Re-initialize speaking conversation
    if (window.SpeakingModule) window.SpeakingModule.loadHistory();
    if (window.ProgressModule) window.ProgressModule.render();
    if (window.ReadingModule) window.ReadingModule.populateSeedOptions();
    if (window.ListeningModule) window.ListeningModule.populateSeedOptions();
  },

  handleCreateProfile() {
    const nameInput = document.getElementById('new-profile-name');
    const levelSelect = document.getElementById('new-profile-level');

    const name = nameInput?.value.trim();
    const level = levelSelect?.value || 'B1';

    if (!name) {
      alert('Vui lòng nhập tên người học!');
      return;
    }

    const config = {
      provider: 'omniroute',
      apiKey: '',
      baseUrl: window.CONFIG.DEFAULT_OMNIROUTE_BASE_URL,
      model: window.CONFIG.DEFAULT_MODEL
    };

    const newProf = window.StateManager.createProfile(name, level, config);
    this.switchProfile(newProf.id);

    // Reset Form
    if (nameInput) nameInput.value = '';
  },

  deleteProfile(profileId) {
    if (confirm('Bạn có chắc muốn xóa hồ sơ này và toàn bộ dữ liệu học tập của họ?')) {
      window.StateManager.deleteProfile(profileId);
      this.refreshCurrentProfileUI();
      this.renderProfileList();
      if (window.SpeakingModule) window.SpeakingModule.loadHistory();
      if (window.ProgressModule) window.ProgressModule.render();
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
  }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
