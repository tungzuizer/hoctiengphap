/**
 * StateManager - Multi-profile & LocalStorage State Management
 * Supports isolated storage for each user profile + shared seed bank
 */

const StateManager = {
  KEYS: {
    PROFILES: 'delf_profiles',
    ACTIVE_PROFILE_ID: 'delf_active_profile_id',
    SEED_BANK: 'delf_seed_bank',
    THEME: 'delf_app_theme'
  },

  // Initialize storage with default profile if none exists
  init() {
    let profiles = this.getProfiles();
    if (!profiles || profiles.length === 0) {
      const defaultProfile = {
        id: 'prof_' + Date.now(),
        name: 'Học viên 1',
        level: 'B1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      profiles = [defaultProfile];
      this.saveProfiles(profiles);
      this.setActiveProfileId(defaultProfile.id);

      // Save default OmniRoute config for this profile
      this.saveProfileConfig(defaultProfile.id, {
        provider: 'omniroute',
        baseUrl: window.CONFIG ? window.CONFIG.DEFAULT_OMNIROUTE_BASE_URL : 'https://api.omniroute.io/v1',
        apiKey: '',
        model: window.CONFIG ? window.CONFIG.DEFAULT_MODEL : 'claude-3-7-sonnet'
      });
    }

    // Ensure active profile is valid
    const activeId = this.getActiveProfileId();
    if (!activeId || !profiles.some(p => p.id === activeId)) {
      this.setActiveProfileId(profiles[0].id);
    }

    // Init Seed Bank if empty
    this.initSeedBank();
  },

  // Profiles CRUD
  getProfiles() {
    try {
      const raw = localStorage.getItem(this.KEYS.PROFILES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading profiles from localStorage', e);
      return [];
    }
  },

  saveProfiles(profiles) {
    try {
      localStorage.setItem(this.KEYS.PROFILES, JSON.stringify(profiles));
    } catch (e) {
      console.error('Error saving profiles to localStorage', e);
    }
  },

  createProfile(name, level = 'B1', config = {}) {
    const profiles = this.getProfiles();
    const newProfile = {
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name.trim() || 'Học viên ' + (profiles.length + 1),
      level: level || 'B1',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    profiles.push(newProfile);
    this.saveProfiles(profiles);

    // Save profile config
    const profileConfig = {
      provider: config.provider || 'omniroute',
      baseUrl: config.baseUrl || (window.CONFIG ? window.CONFIG.DEFAULT_OMNIROUTE_BASE_URL : 'https://api.omniroute.io/v1'),
      apiKey: config.apiKey || '',
      model: config.model || (window.CONFIG ? window.CONFIG.DEFAULT_MODEL : 'claude-3-7-sonnet')
    };
    this.saveProfileConfig(newProfile.id, profileConfig);

    return newProfile;
  },

  updateProfile(id, updates) {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx !== -1) {
      profiles[idx] = { ...profiles[idx], ...updates, lastActive: new Date().toISOString() };
      this.saveProfiles(profiles);
      return profiles[idx];
    }
    return null;
  },

  deleteProfile(id) {
    let profiles = this.getProfiles();
    if (profiles.length <= 1) {
      throw new Error('Cần giữ lại ít nhất 1 hồ sơ người dùng!');
    }
    profiles = profiles.filter(p => p.id !== id);
    this.saveProfiles(profiles);

    // Cleanup keys
    localStorage.removeItem(`profile_${id}_config`);
    localStorage.removeItem(`profile_${id}_progress`);
    localStorage.removeItem(`profile_${id}_history`);

    // If active profile was deleted, switch to the first remaining profile
    if (this.getActiveProfileId() === id) {
      this.setActiveProfileId(profiles[0].id);
    }
    return profiles;
  },

  // Active Profile
  getActiveProfileId() {
    return localStorage.getItem(this.KEYS.ACTIVE_PROFILE_ID);
  },

  setActiveProfileId(id) {
    localStorage.setItem(this.KEYS.ACTIVE_PROFILE_ID, id);
    const profiles = this.getProfiles();
    const p = profiles.find(item => item.id === id);
    if (p) {
      this.updateProfile(id, { lastActive: new Date().toISOString() });
    }
  },

  getActiveProfile() {
    const id = this.getActiveProfileId();
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === id) || profiles[0] || null;
  },

  // Profile-specific API & AI Configuration
  getProfileConfig(profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return null;
    try {
      const raw = localStorage.getItem(`profile_${id}_config`);
      if (raw) {
        return JSON.parse(raw);
      }
      return {
        provider: 'omniroute',
        baseUrl: window.CONFIG ? window.CONFIG.DEFAULT_OMNIROUTE_BASE_URL : 'https://api.omniroute.io/v1',
        apiKey: '',
        model: window.CONFIG ? window.CONFIG.DEFAULT_MODEL : 'claude-3-7-sonnet'
      };
    } catch (e) {
      console.error('Error reading profile config', e);
      return null;
    }
  },

  saveProfileConfig(profileId, config) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return;
    try {
      localStorage.setItem(`profile_${id}_config`, JSON.stringify(config));
    } catch (e) {
      console.error('Error saving profile config', e);
    }
  },

  // Profile-specific Study Progress
  getProgress(profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return [];
    try {
      const raw = localStorage.getItem(`profile_${id}_progress`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading progress', e);
      return [];
    }
  },

  addProgressRecord(record, profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return null;
    const progressList = this.getProgress(id);
    const newRecord = {
      id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
      ...record
    };
    progressList.unshift(newRecord);
    try {
      localStorage.setItem(`profile_${id}_progress`, JSON.stringify(progressList));
    } catch (e) {
      console.error('Error saving progress record', e);
    }
    return newRecord;
  },

  // Conversation History per profile (Speaking session)
  getConversationHistory(profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return [];
    try {
      const raw = localStorage.getItem(`profile_${id}_history`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveConversationHistory(history, profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return;
    try {
      localStorage.setItem(`profile_${id}_history`, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving conversation history', e);
    }
  },

  clearConversationHistory(profileId = null) {
    const id = profileId || this.getActiveProfileId();
    if (!id) return;
    localStorage.removeItem(`profile_${id}_history`);
  },

  // Seed Bank Management
  initSeedBank() {
    const existing = this.getSeeds();
    if (!existing || existing.length === 0) {
      const defaults = window.CONFIG && window.CONFIG.DEFAULT_SEEDS ? window.CONFIG.DEFAULT_SEEDS : [];
      this.saveSeeds(defaults);
    }
  },

  getSeeds() {
    try {
      const raw = localStorage.getItem(this.KEYS.SEED_BANK);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading seed bank', e);
      return [];
    }
  },

  saveSeeds(seeds) {
    try {
      localStorage.setItem(this.KEYS.SEED_BANK, JSON.stringify(seeds));
    } catch (e) {
      console.error('Error saving seed bank', e);
    }
  },

  addSeed(seed) {
    const seeds = this.getSeeds();
    const newSeed = {
      id: 'seed_' + Date.now(),
      title: seed.title || 'Chủ đề tiếng Pháp',
      source: seed.source || 'Người dùng đóng góp',
      sourceUrl: seed.sourceUrl || '',
      level: seed.level || 'B1',
      topic: seed.topic || 'Tổng hợp',
      transcript: seed.transcript.trim(),
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    seeds.unshift(newSeed);
    this.saveSeeds(seeds);
    return newSeed;
  },

  deleteSeed(id) {
    let seeds = this.getSeeds();
    seeds = seeds.filter(s => s.id !== id);
    this.saveSeeds(seeds);
    return seeds;
  },

  // Export and Import Data
  exportProfileData(profileId = null) {
    const id = profileId || this.getActiveProfileId();
    const profile = this.getProfiles().find(p => p.id === id);
    if (!profile) throw new Error('Profile not found');

    const config = this.getProfileConfig(id);
    const progress = this.getProgress(id);
    const history = this.getConversationHistory(id);

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      profile,
      config: {
        provider: config?.provider || 'omniroute',
        baseUrl: config?.baseUrl || '',
        model: config?.model || '',
        hasApiKey: Boolean(config?.apiKey)
      },
      progress,
      history
    };
  },

  importProfileData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.profile || !data.profile.name) {
        throw new Error('Định dạng dữ liệu sao lưu không hợp lệ!');
      }

      const importedProfile = this.createProfile(
        data.profile.name + ' (Nhập)',
        data.profile.level || 'B1',
        data.config || {}
      );

      if (Array.isArray(data.progress)) {
        localStorage.setItem(`profile_${importedProfile.id}_progress`, JSON.stringify(data.progress));
      }

      if (Array.isArray(data.history)) {
        localStorage.setItem(`profile_${importedProfile.id}_history`, JSON.stringify(data.history));
      }

      this.setActiveProfileId(importedProfile.id);
      return importedProfile;
    } catch (e) {
      console.error('Import error', e);
      throw e;
    }
  }
};

window.StateManager = StateManager;
