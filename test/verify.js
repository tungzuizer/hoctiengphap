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
  assert.ok(CONFIG.DEFAULT_OMNIROUTE_BASE_URL.includes('20128') || CONFIG.DEFAULT_OMNIROUTE_BASE_URL.includes('omniroute'), 'Base URL OmniRoute đúng chuẩn');
  assert.ok(CONFIG.DEFAULT_MODEL.includes('gemini-3.7-flash-tiered') || CONFIG.DEFAULT_MODEL.includes('sonnet'), 'Model AI mặc định được cấu hình đúng');
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
  assert.ok(tutorReply.phonetics, 'Có danh sách phân tích ngữ âm phonetics');

  // Test 4.1: Kiểm tra phản xạ khi học viên nói/gõ tiếng Việt
  const vnTutorReply = await AIService.chatWithTutor('bạn có thể chỉnh phát âm cho tôi không', [], 'B1');
  assert.ok(vnTutorReply.frenchReply.includes('Pouvez-vous corriger ma prononciation'), 'Gợi ý đúng câu tiếng Pháp mẫu khi học viên hỏi tiếng Việt');
  assert.ok(vnTutorReply.phonetics.length >= 2, 'Cung cấp thẻ phát âm IPA và mẹo khẩu hình miệng');

  // Test 4.1b: Kiểm tra câu nói tiếng Việt về ăn uống -> Không được gợi ý lạc đề (như xe đạp)
  const vnFoodReply = await AIService.chatWithTutor('Tôi sẽ ăn bây giờ', [], 'B1');
  assert.ok(vnFoodReply.frenchReply.includes('manger') || vnFoodReply.frenchReply.includes('repas'), 'Phản hồi tiếng Pháp về chủ đề ăn uống');
  assert.ok(!vnFoodReply.feedbackVi.includes('xe đạp'), 'Không được gợi ý lạc đề sang xe đạp khi người học nói về ăn uống');
  assert.ok(vnFoodReply.phonetics.some(p => p.word.includes('manger') || p.word.includes('maintenant')), 'Chữa phát âm đúng từ trong câu (manger/maintenant)');

  // Test 4.1c: Kiểm tra câu nói tiếng Pháp về du lịch -> Bắt đúng chủ đề du lịch
  const frTravelReply = await AIService.chatWithTutor('J\'aimerais voyager en France et visiter Paris pendant mes vacances.', [], 'B1');
  assert.ok(frTravelReply.frenchReply.includes('destination') || frTravelReply.frenchReply.includes('voyage'), 'AI phản hồi theo đúng ngữ cảnh du lịch');
  assert.ok(!frTravelReply.feedbackVi.includes('xe đạp'), 'Không gợi ý sai chủ đề');

  // Test 4.1d: Kiểm tra danh mục các chủ đề hội thoại phong phú
  assert.ok(CONFIG.SPEAKING_TOPICS && CONFIG.SPEAKING_TOPICS.length >= 6, 'Có sẵn ít nhất 6 chủ đề hội thoại phong phú');

  // Test 4.2: Barem DELF B1 - Thí sinh nói Tiếng Việt -> 0.0 / 25 điểm
  const vnEvalResult = await AIService.evaluateSpeakingSession([
    { userText: 'bạn có thể chỉnh phát âm cho tôi không', frenchReply: '...' }
  ], 'B1');
  assert.strictEqual(vnEvalResult.tong_diem, 0.0, 'Nói tiếng Việt phải bị 0.0/25 điểm theo quy chế thi DELF');
  assert.strictEqual(vnEvalResult.lexique.score, 0.0, 'Từ vựng = 0 khi nói tiếng Việt');
  assert.strictEqual(vnEvalResult.phonologie.score, 0.0, 'Phát âm = 0 khi nói tiếng Việt');

  // Test 4.3: Barem DELF B1 - Thí sinh nói 1 câu tiếng Pháp ngắn (< 12 từ) -> Điểm rút gọn chuẩn xác (<= 5.0 / 25)
  const shortEvalResult = await AIService.evaluateSpeakingSession([
    { userText: 'Je m\'appelle Tung et j\'aime le sport.', frenchReply: 'Très bien.' }
  ], 'B1');
  assert.ok(shortEvalResult.tong_diem <= 5.0, 'Nói 1 câu ngắn không được vượt quá 5.0/25 điểm');
  assert.ok(shortEvalResult.tong_diem > 0.0, 'Nói câu tiếng Pháp hợp lệ có điểm');

  // Test 4.4: Barem DELF B1 - Hội thoại đầy đủ
  const evalResult = await AIService.evaluateSpeakingSession([
    { userText: 'Bonjour, je voudrais parler de mon travail et de mes loisirs en France.', frenchReply: 'D\'accord.' },
    { userText: 'Chaque week-end, je fais du sport et je visite des musées historiques à Paris.', frenchReply: 'Très intéressant.' },
    { userText: 'À mon avis, le développement des transports en commun est essentiel pour réduire la pollution.', frenchReply: 'Bien argumenté.' },
    { userText: 'En conclusion, c\'est un sujet important pour notre avenir.', frenchReply: 'Merci beaucoup.' }
  ], 'B1');

  assert.ok(typeof evalResult.tong_diem === 'number', 'Có tổng điểm số');
  assert.ok(evalResult.tong_diem >= 15.0, 'Hội thoại đầy đủ B1 đạt điểm chuẩn');
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

  // Test 4.5: Khắc phục lỗi sinh bài từ Kho đề thật nhảy sang bài xe đạp
  const customArticle = "Le festival d'Avignon est l'une des plus importantes manifestations internationales du spectacle vivant contemporain.";
  const seedReadingEx = await AIService.generateReadingExercise({
    level: 'B1',
    seedText: customArticle,
    seedTitle: "Festival d'Avignon"
  });
  assert.strictEqual(seedReadingEx.passage, customArticle, 'Bài đọc sinh từ kho đề phải giữ nguyên vẹn 100% văn bản bài báo được chọn');
  assert.strictEqual(seedReadingEx.questions.length, 3, 'Bài đọc từ kho đề có 3 câu trắc nghiệm');

  const seedListeningEx = await AIService.generateListeningExercise({
    level: 'B1',
    seedText: customArticle,
    seedTitle: "Festival d'Avignon"
  });
  assert.strictEqual(seedListeningEx.passage, customArticle, 'Bài nghe sinh từ kho đề phải giữ nguyên vẹn 100% văn bản bài báo được chọn');
  assert.strictEqual(seedListeningEx.questions.length, 3, 'Bài nghe từ kho đề có 3 câu trắc nghiệm');

  console.log('  ✅ AIService: Phản xạ hội thoại, chấm điểm Grille DELF B1 (/25) và bảo toàn chính xác bài báo khi sinh từ Kho Đề Thật.');

  // Test 5: French Phonetics & Pronunciation Scorer
  console.log('\n5. Kiểm tra Hệ thống Sửa Phát Âm & Ngữ Âm Chuyên Sâu (Phonétique & Scorer):');
  assert.ok(CONFIG.FRENCH_PHONETICS_PRESETS.length >= 5, 'Phải có ít nhất 5 bộ chuyên đề ngữ âm chuẩn');
  const uPair = CONFIG.FRENCH_PHONETICS_PRESETS.find(p => p.id === 'ph_u_vs_ou');
  assert.ok(uPair && uPair.mouthGuide, 'Có hướng dẫn khẩu hình cho cặp âm [y] vs [u]');

  // Test Phonetics Parser
  const samplePhoneticsText = `
- **tu** (/ty/) : Chu tròn môi như huýt sáo nhưng giữ khẩu hình chữ i, tránh đọc nhầm thành tout /tu/.
- **restaurant** (/ʁɛstoʁɑ̃/) : Âm mũi an mở miệng rộng, không khép môi tạo âm n/m.
- liaison : Nối âm bắt buộc với nguyên âm kế tiếp.
  `;
  const parsedPhonetics = AIService.parsePhoneticsList(samplePhoneticsText);
  assert.strictEqual(parsedPhonetics.length, 3, 'Phải parse được 3 mục ngữ âm');
  assert.strictEqual(parsedPhonetics[0].word, 'tu');
  assert.strictEqual(parsedPhonetics[0].ipa, '/ty/');
  assert.ok(parsedPhonetics[0].tip.includes('huýt sáo'));

  console.log('  ✅ Phonétique: Bộ dữ liệu khẩu hình miệng chuẩn và bộ phân tích IPA parsing hoạt động chính xác.');

  console.log('\n✨ TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐÃ ĐẠT (100% PASS)!');
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
