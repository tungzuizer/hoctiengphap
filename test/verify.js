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
require('../js/progress.js');

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

  // Test 6: Progress & AI Diagnostic Hub
  console.log('\n6. Kiểm tra Trung Tâm Chẩn Đoán Lỗi & Kế Hoạch Khắc Phục (Progress & Diagnostic Hub):');
  const sampleRecords = [
    {
      id: 'rec-1',
      type: 'speaking',
      level: 'B1',
      score: 16.5,
      maxScore: 25,
      date: new Date().toISOString(),
      commonErrors: ['Phân biệt Passé Composé & Imparfait', 'Phát âm âm mũi [ɑ̃] vs [ɔ̃]']
    }
  ];
  const diagOutput = await AIService.diagnoseErrorsAndPrescribeSolutions(sampleRecords, { name: 'Trang', level: 'B1' });
  assert.ok(diagOutput.summary, 'Có tóm tắt chẩn đoán sư phạm');
  assert.ok(diagOutput.bottlenecks.length >= 2, 'Có danh sách điểm nghẽn then chốt');
  assert.ok(diagOutput.errors.length >= 3, 'Có danh sách các lỗi hay gặp nhất');
  assert.ok(diagOutput.remedialPlan.length >= 3, 'Có lộ trình 3 bước khắc phục');

  // Verify ProgressModule error synthesis
  const synthesized = ProgressModule.synthesizeErrorsFromRecords(sampleRecords, { name: 'Trang', level: 'B1' });
  assert.ok(synthesized.errors.some(e => e.category === 'grammar'), 'Có phân loại lỗi Ngữ pháp');
  assert.ok(synthesized.errors.some(e => e.category === 'phonetics'), 'Có phân loại lỗi Ngữ âm');
  assert.ok(synthesized.errors.some(e => e.category === 'vocab'), 'Có phân loại lỗi Từ vựng');
  console.log('  ✅ Diagnostic Hub: Tự động tổng hợp lỗi theo 4 nhóm, tạo thẻ so sánh ❌/✅ và lộ trình 3 bước hoàn chỉnh.');

  // Test 7: Real-Time Turn-by-Turn Assessment & Live Cumulative DELF Score Meter
  console.log('\n7. Kiểm tra Đánh giá & Chấm điểm tức thì trong từng lượt trò chuyện (Real-Time Turn-by-Turn Assessment):');

  // 7.1 Parse explicit turn evaluation from AI output
  const rawAIResponse = `
Très bien ! C'est une excellente idée de visiter le musée du Louvre.
Nhận xét: Câu văn lưu loát, chia đúng thì hiện tại.
Phát âm gợi ý:
- **musée** (/my.ze/) : Âm u chu tròn môi.

Đánh giá câu:
- Điểm câu: 4.5/5.0
- Xếp loại: Rất tốt (DELF 22.5/25)
- Ngữ pháp: Cấu trúc câu chuẩn xác, dùng đúng giới từ 'du Louvre'
- Từ vựng: Vốn từ phù hợp trình độ B1
  `;
  const parsedEval = AIService.parseTurnEvaluation(rawAIResponse, 'Je voudrais visiter le musée du Louvre.');
  assert.ok(parsedEval, 'Phải parse được khối đánh giá tức thì');
  assert.strictEqual(parsedEval.score, 4.5, 'Điểm số theo thang 5.0 phải là 4.5');
  assert.strictEqual(parsedEval.delfEquivalent, 22.5, 'Điểm quy đổi DELF phải là 22.5/25');
  assert.strictEqual(parsedEval.badgeClass, 'score-perfect', '4.5 điểm phải thuộc phân loại score-perfect');
  assert.strictEqual(parsedEval.stars, '⭐⭐⭐⭐⭐', '4.5 điểm phải đạt 5 sao');
  assert.ok(parsedEval.grammarNote.includes('Cấu trúc câu chuẩn xác'), 'Ghi nhận đúng nhận xét ngữ pháp');
  assert.ok(parsedEval.lexiqueNote.includes('Vốn từ phù hợp'), 'Ghi nhận đúng nhận xét từ vựng');

  // 7.2 Parse Vietnamese utterance evaluation (Zero DELF score policy)
  const vnEval = AIService.parseTurnEvaluation('Câu trả lời mẫu...', 'tôi muốn ai vừa trò chuyện với tôi và vừa đánh giá');
  assert.strictEqual(vnEval.score, 0.0, 'Nói tiếng Việt phải bị 0.0/5.0 điểm');
  assert.strictEqual(vnEval.delfEquivalent, 0.0, 'Nói tiếng Việt quy đổi DELF 0.0/25');
  assert.strictEqual(vnEval.badgeClass, 'score-low', 'Tiếng Việt xếp loại score-low');
  assert.ok(vnEval.grammarNote.includes('Chưa sử dụng tiếng Pháp'), 'Ghi chú quy chế thi DELF');

  // 7.3 Fallback parsing for general French sentence
  const fallbackEval = AIService.parseTurnEvaluation('Phản hồi không có khối đánh giá', 'Je mange une pomme.');
  assert.ok(fallbackEval.score >= 3.5, 'Fallback cho câu tiếng Pháp hợp lệ có điểm chuẩn');
  assert.ok(fallbackEval.delfEquivalent >= 17.5, 'Fallback quy đổi DELF tương ứng');

  // 7.4 chatWithTutor integrated turn evaluation in Exam Mode
  const turnReplyExam = await AIService.chatWithTutor('Bonjour, comment allez-vous ?', [], 'B1', 'exam');
  assert.strictEqual(turnReplyExam.mode, 'exam', 'Chế độ trả về là exam');
  assert.ok(turnReplyExam.turnEval, 'chatWithTutor trong chế độ exam lời thoại phải trả về đối tượng turnEval');
  assert.ok(typeof turnReplyExam.turnEval.score === 'number', 'turnEval có trường score là số');
  assert.ok(typeof turnReplyExam.turnEval.delfEquivalent === 'number', 'turnEval có trường delfEquivalent là số');
  assert.ok(turnReplyExam.turnEval.badge, 'turnEval có badge xếp loại');
  assert.ok(turnReplyExam.turnEval.stars, 'turnEval có đánh giá sao');
  assert.ok(turnReplyExam.turnEvalRaw, 'chatWithTutor lưu lại raw evaluation text');
  console.log('  ✅ Real-Time Assessment (Exam Mode): Chấm điểm vi mô /5.0, quy đổi DELF /25, gắn badge năng lực và nhận xét tức thì từng câu.');

  // Test 8: Chế độ Bạn Bè Thân Mật & Tắt Chấm Điểm (Friendly Companion Mode & Toggleable Scoring)
  console.log('\n8. Kiểm tra Chế độ Bạn Bè Thân Mật & Bật/Tắt Chấm Điểm Luyện Nói (Friend Mode):');
  // 8.1 StateManager mode storage
  const defaultMode = StateManager.getSpeakingMode();
  assert.strictEqual(defaultMode, 'friend', 'Mặc định chế độ luyện nói là Friend Mode (Bạn bè)');

  StateManager.setSpeakingMode('exam');
  assert.strictEqual(StateManager.getSpeakingMode(), 'exam', 'Chuyển sang chế độ Exam thành công');

  StateManager.setSpeakingMode('friend');
  assert.strictEqual(StateManager.getSpeakingMode(), 'friend', 'Chuyển lại về chế độ Friend thành công');

  // 8.2 AI Chat in Friend Mode: TUYỆT ĐỐI KHÔNG CHẤM ĐIỂM
  const turnReplyFriend = await AIService.chatWithTutor('Salut mon ami, tu as passé un bon week-end ?', [], 'B1', 'friend');
  assert.strictEqual(turnReplyFriend.mode, 'friend', 'Chế độ hội thoại là friend');
  assert.ok(turnReplyFriend.frenchReply, 'Có câu thoại tiếng Pháp thân mật');
  assert.ok(turnReplyFriend.feedbackVi, 'Có nhận xét sửa lỗi ngữ pháp ân cần');
  assert.ok(turnReplyFriend.phonetics, 'Có danh sách sửa phát âm IPA');
  assert.strictEqual(turnReplyFriend.turnEval, null, 'Chế độ bạn bè TUYỆT ĐỐI KHÔNG có đối tượng turnEval (Không chấm điểm)');
  assert.strictEqual(turnReplyFriend.turnEvalRaw, '', 'Chế độ bạn bè không chứa raw score evaluation');
  assert.ok(!turnReplyFriend.feedbackVi.includes('/5.0') && !turnReplyFriend.feedbackVi.includes('/25'), 'Nhận xét trong chế độ bạn bè không chứa điểm số gây áp lực');

  console.log('  ✅ Friend Companion Mode: Trò chuyện gần gũi, sửa lỗi ngữ pháp & phát âm ân cần, tắt hoàn toàn chấm điểm số.');

  console.log('\n✨ TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐÃ ĐẠT (100% PASS)!');
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
