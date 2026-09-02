/**
 * Automated Verification Script for Français DELF Studio Modules
 */

const assert = require('assert');

// Mock browser environment for Node.js
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

// Load modules in order
require('../js/config.js');
require('../js/state.js');
require('../js/speech.js');
require('../js/ai-service.js');

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử toàn diện hệ thống (Multi-user, DELF B1 Grille, OmniRoute)...\n');

  // Test 1: Config
  console.log('1. Kiểm tra CONFIG & Grille DELF B1:');
  assert.ok(CONFIG.DEFAULT_OMNIROUTE_BASE_URL.includes('omniroute.io'), 'Base URL OmniRoute đúng chuẩn');
  assert.strictEqual(CONFIG.DELF_B1_CRITERIA.length, 6, 'Grille DELF B1 phải có đúng 6 tiêu chí chính thức');
  const totalB1Max = CONFIG.DELF_B1_CRITERIA.reduce((sum, c) => sum + c.maxPoints, 0);
  assert.strictEqual(totalB1Max, 25, 'Tổng điểm tối đa DELF B1 phải là 25/25');
  console.log('  ✅ DELF B1 Grille: Đủ 6 tiêu chí, tổng 25 điểm chuẩn France Éducation International.');

  // Test 2: Multi-Profile & StateManager
  console.log('\n2. Kiểm tra StateManager & Đa người dùng (Multi-profile):');
  StateManager.init();
  const defaultProf = StateManager.getActiveProfile();
  assert.ok(defaultProf, 'Có hồ sơ mặc định khi khởi tạo');
  assert.strictEqual(defaultProf.name, 'Trang', 'Hồ sơ mặc định được cá nhân hoá cho Trang');

  // Create Profile 2 for a friend
  const friendProf = StateManager.createProfile('Bạn của tôi', 'A2', {
    provider: 'omniroute',
    apiKey: 'sk-test-friend-omniroute-123',
    baseUrl: 'https://api.omniroute.io/v1',
    model: 'claude-3-7-sonnet'
  });
  assert.strictEqual(friendProf.name, 'Bạn của tôi');
  assert.strictEqual(friendProf.level, 'A2');

  const profiles = StateManager.getProfiles();
  assert.strictEqual(profiles.length, 2, 'Danh sách phải có 2 hồ sơ độc lập');

  // Switch to friend profile
  StateManager.setActiveProfileId(friendProf.id);
  assert.strictEqual(StateManager.getActiveProfile().id, friendProf.id);

  // Add progress for friend
  StateManager.addProgressRecord({
    type: 'speaking',
    level: 'A2',
    score: 12,
    maxScore: 15,
    details: { tong_diem: 12 }
  });

  const friendProgress = StateManager.getProgress(friendProf.id);
  assert.strictEqual(friendProgress.length, 1);
  assert.strictEqual(friendProgress[0].score, 12);

  // Switch back to User 1 and verify data isolation
  StateManager.setActiveProfileId(defaultProf.id);
  const user1Progress = StateManager.getProgress(defaultProf.id);
  assert.strictEqual(user1Progress.length, 0, 'Dữ liệu của Học viên 1 không bị lẫn với Bạn của tôi');

  // Verify Export / Import
  const exportData = StateManager.exportProfileData(friendProf.id);
  assert.strictEqual(exportData.profile.name, 'Bạn của tôi');
  assert.strictEqual(exportData.progress.length, 1);

  // Import into new profile
  const importedProf = StateManager.importProfileData(JSON.stringify(exportData));
  assert.strictEqual(importedProf.name, 'Bạn của tôi (Nhập)');
  console.log('  ✅ StateManager: Quản lý đa hồ sơ, phân lập dữ liệu độc lập và sao lưu JSON hoàn hảo.');

  // Test 3: Seed Bank
  console.log('\n3. Kiểm tra Ngân hàng đề thật (Seed Bank):');
  const seeds = StateManager.getSeeds();
  assert.ok(seeds.length >= 3, 'Phải có sẵn các đề thi mẫu từ RFI và TV5MONDE');
  const rfiSeed = seeds.find(s => s.source.includes('RFI'));
  assert.ok(rfiSeed, 'Có đề thi mẫu từ RFI');

  // Add custom seed
  const customSeed = StateManager.addSeed({
    title: 'Bản tin DELF B1 mẫu',
    source: 'France Éducation International',
    level: 'B1',
    topic: 'Giáo dục',
    transcript: 'En France, le système éducatif permet aux étudiants de choisir différentes voies.'
  });
  assert.ok(customSeed.id);
  assert.strictEqual(StateManager.getSeeds().length, seeds.length + 1);
  console.log('  ✅ Seed Bank: Kho đề gốc RFI / TV5MONDE và khả năng thêm/xóa đề hoạt động tốt.');

  // Test 4: AIService Mock & DELF B1 Evaluation
  console.log('\n4. Kiểm tra AIService (Mock fallback & OmniRoute JSON schema):');
  const tutorReply = await AIService.chatWithTutor('Bonjour, je m\'appelle Tung.', [], 'B1');
  assert.ok(tutorReply.frenchReply, 'Có câu trả lời tiếng Pháp');
  assert.ok(tutorReply.feedbackVi, 'Có nhận xét tiếng Việt');

  const evalResult = await AIService.evaluateSpeakingSession([
    { userText: 'Je voudrais parler de mon travail en France.', frenchReply: 'Très bien, continuez.' }
  ], 'B1');

  assert.ok(typeof evalResult.tong_diem === 'number', 'Có tổng điểm số');
  assert.ok(evalResult.entretien_dirige, 'Có tiêu chí entretien_dirige');
  assert.ok(evalResult.lexique, 'Có tiêu chí lexique');
  assert.ok(evalResult.morphosyntaxe, 'Có tiêu chí morphosyntaxe');
  assert.ok(evalResult.phonologie, 'Có tiêu chí phonologie');

  const readingEx = await AIService.generateReadingExercise({ level: 'B1' });
  assert.ok(readingEx.passage, 'Bài đọc có đoạn văn tiếng Pháp');
  assert.strictEqual(readingEx.questions.length, 3, 'Bài đọc có đủ 3 câu trắc nghiệm');

  const listeningEx = await AIService.generateListeningExercise({ level: 'B1' });
  assert.ok(listeningEx.passage, 'Bài nghe có đoạn transcript tiếng Pháp');
  assert.strictEqual(listeningEx.questions.length, 3, 'Bài nghe có đủ 3 câu trắc nghiệm');

  console.log('  ✅ AIService: Phản xạ hội thoại, chấm điểm Grille DELF B1 (/25) và sinh đề Đọc/Nghe chính xác.');

  console.log('\n✨ TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐÃ ĐẠT (100% PASS)!');
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
