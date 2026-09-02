/**
 * AIService - OmniRoute Gateway & Direct AI Client
 * Handles AI chat, reading/listening comprehension generation & DELF speaking evaluation
 */

const AIService = {
  // Main API Dispatcher
  async request({ systemPrompt, messages, temperature = 0.7, jsonMode = false, profileConfig = null }) {
    const config = profileConfig || window.StateManager.getProfileConfig();
    const apiKey = config?.apiKey?.trim();

    // If no API key is provided, use high-fidelity simulated response for testing & demonstration
    if (!apiKey) {
      console.warn('No API key provided. Falling back to Mock Demo Mode.');
      return this.mockResponse({ systemPrompt, messages, jsonMode });
    }

    const provider = config.provider || 'omniroute';
    let baseUrl = config.baseUrl || 'https://api.omniroute.io/v1';
    const model = config.model || (window.CONFIG ? window.CONFIG.DEFAULT_MODEL : 'claude-3-7-sonnet');

    // Clean baseUrl
    baseUrl = baseUrl.replace(/\/+$/, '');

    try {
      if (provider === 'anthropic' && baseUrl.includes('anthropic.com')) {
        return await this.callAnthropicDirect({ baseUrl, apiKey, model, systemPrompt, messages, temperature, jsonMode });
      } else {
        // OmniRoute / OpenAI-compatible endpoint
        return await this.callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, messages, temperature, jsonMode });
      }
    } catch (err) {
      console.error('API Request Failed:', err);
      throw new Error(`Lỗi kết nối AI (${provider}): ${err.message || 'Kiểm tra lại API Key hoặc Endpoint Base URL'}`);
    }
  },

  // OmniRoute & OpenAI-Compatible Gateway Call
  async callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, messages, temperature, jsonMode }) {
    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    messages.forEach(msg => {
      formattedMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    const endpoint = `${baseUrl}/chat/completions`;
    const payload = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: 2000
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      let errDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        errDetail = parsed.error?.message || parsed.message || errText;
      } catch (e) {}
      throw new Error(`HTTP ${res.status}: ${errDetail}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content;
  },

  // Direct Anthropic API Call (if user selects direct Anthropic)
  async callAnthropicDirect({ baseUrl, apiKey, model, systemPrompt, messages, temperature }) {
    const endpoint = `${baseUrl}/v1/messages`;
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const payload = {
      model,
      system: systemPrompt,
      messages: formattedMessages,
      temperature,
      max_tokens: 2000
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic Error HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  },

  // Helper to safely parse JSON from AI response (extracting json block if markdown wrapped)
  cleanAndParseJSON(rawText) {
    if (!rawText) throw new Error('Phản hồi trống từ AI');

    let cleaned = rawText.trim();
    // Remove markdown code blocks ```json ... ```
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
    }

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Find first { and last }
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(cleaned.substring(start, end + 1));
      }
      throw new Error('Không thể phân tích dữ liệu JSON từ AI: ' + e.message);
    }
  },

  // 1. Module Luyện Nói: Trò chuyện với giáo viên bản ngữ + Nhận xét lỗi + Sửa phát âm & Ngữ âm (Phonétique)
  async chatWithTutor(userFrenchText, conversationHistory = [], level = 'B1') {
    const systemPrompt = `Bạn là giáo viên tiếng Pháp bản ngữ kiêm chuyên gia luyện ngữ âm & phát âm (Phonétique & Prononciation) cho học viên Việt Nam trình độ [${level}].
Yêu cầu bắt buộc:
1. Chỉ dùng từ vựng, cấu trúc câu và các thì ngữ pháp hoàn toàn phù hợp với chuẩn trình độ CEFR [${level}].
2. Luôn trả lời bằng TIẾNG PHÁP một cách ngắn gọn, thân thiện, tự nhiên và đặt thêm 1 câu hỏi gợi mở để học viên tiếp tục nói.
3. Sau câu trả lời tiếng Pháp, hãy xuống 2 dòng, ghi chính xác "Nhận xét:" rồi phân tích ngắn gọn 1-2 lỗi từ vựng, ngữ pháp hoặc diễn đạt mà học viên vừa mắc phải trong câu vừa rồi bằng TIẾNG VIỆT (nếu câu nói của học viên hoàn toàn chuẩn xác, hãy khen ngợi và gợi ý một cách diễn đạt hay hơn nâng cao).
4. Xuống tiếp 2 dòng, ghi chính xác "Phát âm & Ngữ âm:" rồi hướng dẫn chi tiết bằng TIẾNG VIỆT về các điểm phát âm trong câu của học viên:
   - Liệt kê 1-3 từ/cụm từ quan trọng kèm phiên âm IPA chuẩn Pháp (ví dụ: "beaucoup" /boku/, "les‿amis" /lez‿ami/, "tu" /ty/).
   - Phân tích cạm bẫy phát âm người Việt hay mắc (âm câm lettre muette, âm mũi nasale [ɑ̃]/[ɔ̃]/[ɛ̃], âm [y] vs [u], âm R rung họng [ʁ], nối âm liaison bắt buộc).
   - Hướng dẫn khẩu hình miệng, vị trí lưỡi và cách bật hơi để phát âm chuẩn người Paris.
   Định dạng mỗi dòng phát âm:
   - [Từ/Cụm từ] (/phiên âm IPA/): Lời khuyên phát âm & khẩu hình cụ thể.`;

    const messages = [];
    // Include last 6 turns for context
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(item => {
      messages.push({ role: 'user', content: item.userText });
      const assistantFullContent = `${item.frenchReply}\n\nNhận xét:\n${item.feedbackVi || ''}${item.phoneticsRaw ? `\n\nPhát âm & Ngữ âm:\n${item.phoneticsRaw}` : ''}`;
      messages.push({ role: 'assistant', content: assistantFullContent });
    });

    messages.push({ role: 'user', content: userFrenchText });

    const rawResponse = await this.request({
      systemPrompt,
      messages,
      temperature: 0.6
    });

    // Parse the 3 parts: French reply, Vietnamese feedback, Phonetics feedback
    let frenchReply = rawResponse;
    let feedbackVi = '';
    let phoneticsRaw = '';

    const splitPhonetics = rawResponse.match(/\n\s*Phát âm\s*(?:&|và)\s*Ngữ âm\s*:\s*/i) || rawResponse.match(/Phát âm\s*(?:&|và)\s*Ngữ âm\s*:\s*/i);
    let textBeforePhonetics = rawResponse;

    if (splitPhonetics) {
      const pIdx = splitPhonetics.index;
      textBeforePhonetics = rawResponse.substring(0, pIdx).trim();
      phoneticsRaw = rawResponse.substring(pIdx + splitPhonetics[0].length).trim();
    }

    const splitFeedback = textBeforePhonetics.match(/\n\s*Nhận xét\s*:\s*/i) || textBeforePhonetics.match(/Nhận xét\s*:\s*/i);
    if (splitFeedback) {
      const fIdx = splitFeedback.index;
      frenchReply = textBeforePhonetics.substring(0, fIdx).trim();
      feedbackVi = textBeforePhonetics.substring(fIdx + splitFeedback[0].length).trim();
    } else {
      frenchReply = textBeforePhonetics.trim();
    }

    // Parse structured phonetic items
    const parsedPhonetics = this.parsePhoneticsList(phoneticsRaw);

    return {
      frenchReply: frenchReply || 'Très bien, continuons la conversation !',
      feedbackVi: feedbackVi || 'Rất tốt! Câu nói của bạn tự nhiên và không mắc lỗi ngữ pháp đáng kể.',
      phoneticsRaw,
      phonetics: parsedPhonetics
    };
  },

  // Helper to parse phonetic items into structured cards
  parsePhoneticsList(rawText) {
    if (!rawText) return [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const items = [];

    lines.forEach(line => {
      const cleanLine = line.replace(/^[-*•\d.]+\s*/, '').trim();
      if (!cleanLine) return;

      // Match patterns like: "beaucoup (/boku/): Chú ý..." or "les amis /lez‿ami/ : Nối âm..."
      const match = cleanLine.match(/^(?:\*\*)?([^(/:*]+)(?:\*\*)?\s*(?:\((?:\/)?([^)/]+)(?:\/)?\)|\/(.+?)\/)\s*:\s*(.*)$/i);
      if (match) {
        const word = (match[1] || '').trim().replace(/\*\*/g, '');
        const ipa = (match[2] || match[3] || '').trim();
        const tip = (match[4] || '').trim();
        items.push({
          word,
          ipa: ipa.startsWith('/') ? ipa : `/${ipa}/`,
          tip
        });
      } else {
        // Fallback for unstructured lines
        items.push({
          word: '',
          ipa: '',
          tip: cleanLine
        });
      }
    });

    return items;
  },

  // 2. Module Chấm Điểm Buổi Luyện Nói Chuẩn Grille DELF B1 (25 điểm)
  async evaluateSpeakingSession(conversationHistory = [], level = 'B1') {
    if (!conversationHistory || conversationHistory.length === 0) {
      throw new Error('Chưa có hội thoại nào trong phiên này để chấm điểm.');
    }

    const transcript = conversationHistory
      .map((turn, i) => `Học viên: "${turn.userText}"\nGiáo viên: "${turn.frenchReply}"`)
      .join('\n\n');

    let systemPrompt = '';

    if (level === 'B1') {
      systemPrompt = `Bạn là một giám khảo chấm thi Nói DELF B1 chính thức của France Éducation International.
Nhiệm vụ: Dựa trên toàn bộ nội dung học viên đã nói trong phiên hội thoại tiếng Pháp dưới đây, hãy áp dụng đúng Grille d'évaluation de la production orale DELF B1 (Tổng 25 điểm).

Thang điểm 6 tiêu chí:
1. entretien_dirige (max 4 điểm): Giới thiệu bản thân, nói về kinh nghiệm cá nhân.
2. exercice_interaction (max 4 điểm): Tương tác, phản xạ xử lý tình huống hội thoại.
3. expression_point_de_vue (max 4 điểm): Trình bày ý kiến cá nhân, lập luận.
4. lexique (max 5 điểm): Vốn từ vựng, độ chính xác từ ngữ B1.
5. morphosyntaxe (max 4 điểm): Ngữ pháp, cấu trúc câu, liên từ B1.
6. phonologie (max 4 điểm): Đánh giá qua cách diễn đạt, ngắt nghỉ, chính tả ngữ âm.

Hãy trả về DUY NHẤT một JSON theo cấu trúc sau (không kèm markdown thừa):
{
  "entretien_dirige": { "level": "B1", "score": 3.0, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "exercice_interaction": { "level": "B1", "score": 3.0, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "expression_point_de_vue": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "lexique": { "level": "B1", "score": 3.5, "max": 5, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "morphosyntaxe": { "level": "B1", "score": 3.0, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "phonologie": { "level": "B1", "score": 3.0, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "tong_diem": 18.0,
  "overall_feedback": "2-3 câu tổng kết điểm mạnh và những điểm cần cải thiện nhất bằng tiếng Việt.",
  "frequent_errors": ["Lỗi 1", "Lỗi 2"]
}`;
    } else {
      // A1 or A2 simplified criteria
      systemPrompt = `Bạn là giám khảo chấm thi Nói DELF trình độ [${level}].
Áp dụng tiêu chí đánh giá tiếng Pháp cho trình độ ${level} (Tổng 15 điểm):
1. lexique (max 5 điểm): Từ vựng cơ bản.
2. morphosyntaxe (max 5 điểm): Ngữ pháp câu đơn giản.
3. phonologie (max 5 điểm): Phát âm và độ lưu loát.

Trả về JSON:
{
  "lexique": { "level": "${level}", "score": 3.5, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "morphosyntaxe": { "level": "${level}", "score": 3.5, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "phonologie": { "level": "${level}", "score": 4.0, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "tong_diem": 11.0,
  "overall_feedback": "Nhận xét tổng quan bằng tiếng Việt",
  "frequent_errors": ["Lỗi 1", "Lỗi 2"]
}`;
    }

    const userMessage = `Dưới đây là trích đoạn hội thoại trong buổi luyện nói của tôi:\n\n${transcript}\n\nHãy chấm điểm chi tiết theo thang điểm.`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      jsonMode: true
    });

    const parsedResult = this.cleanAndParseJSON(rawResponse);
    return parsedResult;
  },

  // 3. Module Luyện Đọc: Sinh đoạn văn + 3 câu hỏi trắc nghiệm
  async generateReadingExercise({ level = 'B1', seedText = null, topic = null }) {
    let contextInstruction = '';
    if (seedText) {
      contextInstruction = `Dựa trên văn bản mẫu thực tế sau đây:\n"""\n${seedText}\n"""\nHãy viết một bài đọc MỚI HOÀN TOÀN (không sao chép nguyên văn), mang phong cách báo chí/đời sống tương tự, chuẩn trình độ CEFR [${level}].`;
    } else {
      contextInstruction = `Hãy tạo một đoạn văn đọc hiểu tiếng Pháp mới về chủ đề: ${topic || 'Đời sống, văn hóa hoặc xã hội Pháp'}, chuẩn trình độ CEFR [${level}]. Độ dài khoảng 80-150 từ.`;
    }

    const systemPrompt = `Bạn là chuyên gia biên soạn đề thi DELF tiếng Pháp.
${contextInstruction}

Sau đoạn văn, tạo 3 câu hỏi trắc nghiệm kiểm tra độ hiểu bài (Compréhension écrite). Mỗi câu hỏi có 4 lựa chọn (A, B, C, D).
Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:
{
  "title": "Tiêu đề bài đọc tiếng Pháp",
  "topic": "Chủ đề",
  "passage": "Toàn bộ đoạn văn tiếng Pháp...",
  "questions": [
    {
      "id": 1,
      "question": "Câu hỏi trắc nghiệm bằng tiếng Pháp?",
      "options": [
        "Lựa chọn A",
        "Lựa chọn B",
        "Lựa chọn C",
        "Lựa chọn D"
      ],
      "correct_index": 0,
      "explanation": "Giải thích chi tiết bằng tiếng Việt vì sao đáp án này đúng dựa vào câu nào trong bài đọc."
    }
  ]
}`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: 'Hãy tạo bài đọc hiểu trắc nghiệm DELF mới.' }],
      temperature: 0.6,
      jsonMode: true
    });

    return this.cleanAndParseJSON(rawResponse);
  },

  // 4. Module Luyện Nghe: Sinh đoạn hội thoại/bài phát thanh + trắc nghiệm
  async generateListeningExercise({ level = 'B1', seedText = null, topic = null }) {
    let contextInstruction = '';
    if (seedText) {
      contextInstruction = `Dựa trên chủ đề và phong cách của văn bản thực tế sau:\n"""\n${seedText}\n"""\nHãy soạn một đoạn văn hoặc bài phỏng vấn/tin tức ngắn (60-120 từ) phù hợp để đọc to luyện nghe tiếng Pháp cho học viên trình độ [${level}].`;
    } else {
      contextInstruction = `Hãy soạn một đoạn tin tức radio hoặc hội thoại tiếng Pháp đời sống ngắn gọn (60-120 từ) phù hợp để luyện nghe trình độ [${level}] về chủ đề ${topic || 'Công việc, du lịch hoặc cuộc sống hàng ngày'}.`;
    }

    const systemPrompt = `Bạn là chuyên gia biên soạn bài thi Nghe DELF (Compréhension de l'oral).
${contextInstruction}

Kèm theo đó là 3 câu hỏi trắc nghiệm kiểm tra khả năng nghe hiểu. Mỗi câu hỏi có 4 lựa chọn.
Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:
{
  "title": "Tiêu đề bài nghe",
  "topic": "Chủ đề",
  "passage": "Nội dung tiếng Pháp hoàn chỉnh để SpeechSynthesis đọc to...",
  "questions": [
    {
      "id": 1,
      "question": "Câu hỏi trắc nghiệm bằng tiếng Pháp?",
      "options": [
        "Lựa chọn A",
        "Lựa chọn B",
        "Lựa chọn C",
        "Lựa chọn D"
      ],
      "correct_index": 1,
      "explanation": "Giải thích chi tiết bằng tiếng Việt dựa vào nội dung bài nghe."
    }
  ]
}`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: 'Hãy tạo bài luyện nghe trắc nghiệm DELF mới.' }],
      temperature: 0.6,
      jsonMode: true
    });

    return this.cleanAndParseJSON(rawResponse);
  },

  // Realistic Simulation / Demo Mode for testing when API key is not entered
  mockResponse({ systemPrompt, messages, jsonMode }) {
    // If request was for DELF speaking evaluation
    if (systemPrompt.includes('giám khảo chấm thi Nói DELF')) {
      return JSON.stringify({
        entretien_dirige: { level: 'B1', score: 3.5, max: 4, notes: 'Bạn giới thiệu bản thân tự tin, nêu được thông tin cá nhân rõ ràng.' },
        exercice_interaction: { level: 'B1', score: 3.0, max: 4, notes: 'Phản hồi tình huống khá nhanh, biết cách hỏi lại khi chưa rõ ý.' },
        expression_point_de_vue: { level: 'B1', score: 3.0, max: 4, notes: 'Nêu được quan điểm cá nhân, có ví dụ minh họa thực tế.' },
        lexique: { level: 'B1', score: 3.5, max: 5, notes: 'Vốn từ vựng tương đối phong phú cho các chủ đề hàng ngày.' },
        morphosyntaxe: { level: 'B1', score: 3.0, max: 4, notes: 'Cần chú ý chia thì Passé Composé và Imparfait chính xác hơn.' },
        phonologie: { level: 'B1', score: 3.5, max: 4, notes: 'Phát âm rõ ràng, ngữ điệu tự nhiên.' },
        tong_diem: 19.5,
        overall_feedback: 'Buổi luyện tập rất hiệu quả! Bạn có phản xạ giao tiếp tốt, vốn từ B1 vững. Hãy rèn luyện thêm sự phối hợp giữa Passé composé và Imparfait.',
        frequent_errors: ['Nhầm lẫn giữa Imparfait và Passé Composé', 'Giống của danh từ (le/la)']
      });
    }

    // If request was for Reading exercise
    if (systemPrompt.includes('Compréhension écrite') || systemPrompt.includes('bài đọc hiểu')) {
      return JSON.stringify({
        title: 'Le vélo en ville : un nouveau mode de vie',
        topic: 'Giao thông & Đô thị',
        passage: 'Depuis quelques năm, le vélo devient le moyen de transport préféré des habitants des grandes villes. Pratique, écologique et économique, il permet d\'éviter les embouteillages aux heures de pointe. Les municipalités aménagent de nouvelles pistes cyclables sécurisées pour encourager cette pratique.',
        questions: [
          {
            id: 1,
            question: 'Pourquoi les citadins choisissent-ils le vélo ?',
            options: [
              'Parce qu\'il permet d\'éviter les embouteillages.',
              'Parce qu\'il est plus rapide que l\'avion.',
              'Parce que les voitures sont totalement interdites.',
              'Parce qu\'il n\'y a plus de bus.'
            ],
            correct_index: 0,
            explanation: 'Đoạn văn có câu "il permet d\'éviter les embouteillages aux heures de pointe" (giúp tránh tắc đường giờ cao điểm).'
          },
          {
            id: 2,
            question: 'Que font les municipalités pour encourager les cyclistes ?',
            options: [
              'Elles vendent des vélos gratuits.',
              'Elles créent de nouvelles pistes cyclables sécurisées.',
              'Elles ferment toutes les routes.',
              'Elles organisent des courses de vélo.'
            ],
            correct_index: 1,
            explanation: 'Trong bài có câu "Les municipalités aménagent de nouvelles pistes cyclables sécurisées".'
          },
          {
            id: 3,
            question: 'Quel est l\'un des avantages du vélo mentionnés dans le texte ?',
            options: [
              'Il est très cher.',
              'Il est écologique et économique.',
              'Il est réservé aux sportifs professionnels.',
              'Il fonctionne à l\'électricité uniquement.'
            ],
            correct_index: 1,
            explanation: 'Đoạn đầu nêu rõ các ưu điểm: "Pratique, écologique et économique".'
          }
        ]
      });
    }

    // If request was for Listening exercise
    if (systemPrompt.includes('Compréhension de l\'oral') || systemPrompt.includes('luyện nghe')) {
      return JSON.stringify({
        title: 'Une invitation au restaurant',
        topic: 'Đời sống & Ẩm thực',
        passage: 'Bonjour Sophie ! Ce soir, avec quelques collègues du bureau, nous allons dîner dans un nouveau restaurant italien près de la gare. Nous avons réservé une table pour vingt heures. Est-ce que tu es libre pour venir với chúng tôi ? Fais-moi savoir avant seize heures pour que je confirme le nombre de personnes.',
        questions: [
          {
            id: 1,
            question: 'Où les collègues vont-ils dîner ce soir ?',
            options: [
              'Dans un restaurant français au centre-ville.',
              'Dans un restaurant italien près de la gare.',
              'Chez Sophie.',
              'Au bureau.'
            ],
            correct_index: 1,
            explanation: 'Người nói mời: "dans un nouveau restaurant italien près de la gare".'
          },
          {
            id: 2,
            question: 'À quelle heure est la réservation ?',
            options: ['18h00', '19h00', '20h00', '21h00'],
            correct_index: 2,
            explanation: 'Người nói thông báo: "Nous avons réservé une table pour vingt heures" (20h00).'
          },
          {
            id: 3,
            question: 'Avant quelle heure Sophie doit-elle répondre ?',
            options: ['12h00', '15h00', '16h00', '19h00'],
            correct_index: 2,
            explanation: 'Người nói dặn: "Fais-moi savoir avant seize heures" (trước 16h00).'
          }
        ]
      });
    }

    // Default conversational response with comprehensive phonetics & tips
    return `Bonjour ! C'est un plaisir d'échanger avec vous en français. Votre phrase est très claire. Pouvez-vous me parler un peu plus de vos activités préférées pendant le week-end ?

Nhận xét:
Bạn đã diễn đạt ý tốt. Hãy chú ý chia động từ ở ngôi thứ nhất (Je) và sử dụng mạo từ phù hợp khi nói về sở thích nhé. (Ví dụ: "J'aime faire du vélo").

Phát âm & Ngữ âm:
- Bonjour (/bɔ̃ʒuʁ/): Chú ý âm mũi [ɔ̃] chu môi tròn nhỏ và âm rung họng [ʁ], không phát âm thành "bông-dua".
- activité (/aktivite/): Âm "é" phát âm sắc và dứt khoát, không kéo dài như tiếng Việt.
- faire du vélo (/fɛʁ dy velo/): Chữ "du" mang âm [y], hãy đặt khẩu hình chữ "i" rồi chu tròn môi như huýt sáo.`;
  }
};

window.AIService = AIService;
