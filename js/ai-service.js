/**
 * AIService - OmniRoute Gateway & Direct AI Client
 * Handles AI chat, reading/listening comprehension generation & DELF speaking evaluation
 */

const AIService = {
  // Main API Dispatcher (Secure Proxy + Direct Client Fallback)
  async request({ systemPrompt, messages, temperature = 0.7, jsonMode = false, profileConfig = null }) {
    const config = profileConfig || (window.StateManager ? window.StateManager.getProfileConfig() : null);
    const apiKey = config?.apiKey?.trim();
    const provider = config?.provider || 'omniroute';
    const baseUrl = (config?.baseUrl || (window.CONFIG ? window.CONFIG.DEFAULT_OMNIROUTE_BASE_URL : 'http://localhost:20128/v1')).replace(/\/+$/, '');
    const model = config?.model || (window.CONFIG ? window.CONFIG.DEFAULT_MODEL : 'antigravity/gemini-3.7-flash-tiered');

    // Strategy 1: Check if running on Web Server with backend proxy (/api/ai or http://localhost:3000/api/ai)
    // The server injects the API key from .env so frontend remains 100% secret & secure
    if (!apiKey) {
      const endpointsToTry = ['/api/ai', 'http://localhost:3000/api/ai'];
      for (const endpoint of endpointsToTry) {
        try {
          const proxyRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemPrompt,
              messages,
              temperature,
              jsonMode,
              model,
              profileConfig: config ? { model: config.model, level: config.level } : null
            })
          });

          if (proxyRes.ok) {
            const data = await proxyRes.json();
            if (data.success && data.content) {
              return data.content;
            } else if (data.error) {
              throw new Error(data.error);
            }
          }
        } catch (proxyErr) {
          // Continue to next endpoint attempt
        }
      }
    }

    // Strategy 2: Direct Client Request (if user supplied an API key in Profile Settings)
    if (apiKey) {
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
    }

    // Strategy 3: Mock fallback for offline or unconfigured instances
    console.warn('No API key provided and proxy unavailable. Falling back to Mock Demo Mode.');
    return this.mockResponse({ systemPrompt, messages, jsonMode });
  },

  // Health check to verify OmniRoute backend proxy connectivity
  async checkGatewayStatus() {
    const endpoints = ['/api/health', 'http://localhost:3000/api/health'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          return { connected: true, data };
        }
      } catch (e) {}
    }
    return { connected: false };
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

  // 1. Module Luyện Nói: Trò chuyện với giáo viên bản ngữ + Nhận xét lỗi + Sửa phát âm + Đánh giá & Chấm điểm tức thì
  async chatWithTutor(userFrenchText, conversationHistory = [], level = 'B1') {
    const systemPrompt = `Bạn là giáo viên tiếng Pháp bản ngữ kiêm chuyên gia sư phạm & giám khảo đánh giá năng lực hội thoại (DELF B1) cho học viên Việt Nam trình độ [${level}].

QUY TẮC BẮT BUỘC:
1. ĐA DẠNG HÓA CHỦ ĐỀ & PHẢN HỒI THEO ĐÚNG NGỮ CẢNH HỌC VIÊN NÓI:
   - Hãy chủ động bắt nhịp theo ĐÚNG CHỦ ĐỀ mà học viên vừa nói (ví dụ: ăn uống/ẩm thực, công việc, học tập, du lịch, thói quen sinh hoạt, cảm xúc, gia đình, sở thích, kế hoạch tương lai...).
   - Tuyệt đối không lặp lại một câu hỏi rập khuôn hay chỉ hỏi về hoạt động cuối tuần. Luôn trả lời bằng TIẾNG PHÁP một cách tự nhiên, sinh động, chuẩn CEFR [${level}] và đặt thêm 1 câu hỏi mở tiếp theo gắn liền với nội dung học viên vừa chia sẻ để duy trì mạch hội thoại.

2. ĐỘ CHÍNH XÁC TUYỆT ĐỐI KHI NHẬN XÉT NGỮ PHÁP & TỪ VỰNG:
   - Sau câu trả lời tiếng Pháp, hãy xuống 2 dòng, ghi chính xác "Nhận xét:" rồi giải thích ngắn gọn bằng TIẾNG VIỆT.
   - CHỈ ĐƯỢC NHẬN XÉT VÀ GỢI Ý DỰA TRÊN CÁC TỪ VÀ CẤU TRÚC XUẤT HIỆN TRONG CÂU HỌC VIÊN VỪA NÓI.
   - TUYỆT ĐỐI KHÔNG gợi ý hay sửa các từ vựng/hoạt động không liên quan (ví dụ học viên nói về ăn uống, đi lại thì KHÔNG ĐƯỢC nhắc đến xe đạp hay hoạt động khác không có trong câu).
   - Nếu học viên nói đúng: Khen ngợi và phân tích cấu trúc hay mà học viên đã dùng trong câu đó.
   - Nếu học viên nói sai (chia sai thì, sai mạo từ, sai giống danh từ): Chỉ ra đúng từ sai và sửa lại câu chuẩn xác.
   - Nếu học viên nhập tiếng Việt: Dịch sang câu tiếng Pháp tự nhiên nhất và hướng dẫn cấu trúc câu tương đương.

3. PHÂN TÍCH PHÁT ÂM & NGỮ ÂM (PHONÉTIQUE) CHÍNH XÁC THEO CÂU CỦA HỌC VIÊN:
   - Xuống tiếp 2 dòng, ghi chính xác "Phát âm & Ngữ âm:".
   - CHỈ trích xuất 1-3 từ/cụm từ THỰC SỰ CÓ TRONG CÂU của học viên để phân tích.
   - Phân tích cạm bẫy phát âm người Việt hay mắc (âm câm lettre muette, âm mũi nasale [ɑ̃]/[ɔ̃]/[ɛ̃], âm [y] vs [u], âm R rung họng [ʁ], nối âm liaison bắt buộc).
   - Hướng dẫn khẩu hình miệng, vị trí lưỡi và cách bật hơi chuẩn người Paris.
   Định dạng mỗi dòng phát âm:
   - [Từ/Cụm từ trong câu] (/phiên âm IPA/): Lời khuyên phát âm & khẩu hình cụ thể.

4. ĐÁNH GIÁ & CHẤM ĐIỂM TỨC THÌ TỪNG CÂU (ÉVALUATION INSTANTANÉE):
   - Xuống tiếp 2 dòng, ghi chính xác "Đánh giá câu:".
   - Dòng 1: Điểm số trên thang 5.0 và quy đổi DELF /25 (Ví dụ: "- Điểm: 4.5/5.0 (Quy đổi DELF: 22.5/25)").
     + Nếu học viên nhập tiếng Việt hoàn toàn: "- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)".
     + Nếu câu ngắn hoặc có vài lỗi: "- Điểm: 3.0/5.0 (Quy đổi DELF: 15.0/25)".
     + Nếu câu chuẩn, đúng ngữ pháp B1: "- Điểm: 4.5/5.0 (Quy đổi DELF: 22.5/25)".
   - Dòng 2: "- Huy hiệu: [Xuất sắc (B1) | Rất tốt (B1) | Đạt chuẩn (A2+) | Cần lưu ý | Tiếng Việt (0.0/25)]".
   - Dòng 3: "- Ngữ pháp: [Nhận xét nhanh 1 dòng về ngữ pháp/thì/mạo từ]".
   - Dòng 4: "- Từ vựng: [Nhận xét nhanh 1 dòng về vốn từ và ngữ cảnh]".`;

    const messages = [];
    // Include last 6 turns for context
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(item => {
      messages.push({ role: 'user', content: item.userText });
      const assistantFullContent = `${item.frenchReply}\n\nNhận xét:\n${item.feedbackVi || ''}${item.phoneticsRaw ? `\n\nPhát âm & Ngữ âm:\n${item.phoneticsRaw}` : ''}${item.turnEvalRaw ? `\n\nĐánh giá câu:\n${item.turnEvalRaw}` : ''}`;
      messages.push({ role: 'assistant', content: assistantFullContent });
    });

    messages.push({ role: 'user', content: userFrenchText });

    const rawResponse = await this.request({
      systemPrompt,
      messages,
      temperature: 0.6
    });

    // Parse the 4 parts: French reply, Vietnamese feedback, Phonetics feedback, and Turn Evaluation
    let frenchReply = rawResponse;
    let feedbackVi = '';
    let phoneticsRaw = '';
    let turnEvalRaw = '';

    // 1. Split Turn Evaluation
    const splitEval = rawResponse.match(/\n\s*Đánh\s*giá\s*(?:câu|lượt\s*nói)\s*:\s*/i) || rawResponse.match(/Đánh\s*giá\s*(?:câu|lượt\s*nói)\s*:\s*/i);
    let textBeforeEval = rawResponse;
    if (splitEval) {
      const eIdx = splitEval.index;
      textBeforeEval = rawResponse.substring(0, eIdx).trim();
      turnEvalRaw = rawResponse.substring(eIdx + splitEval[0].length).trim();
    }

    // 2. Split Phonetics
    const splitPhonetics = textBeforeEval.match(/\n\s*Phát âm\s*(?:&|và)\s*Ngữ âm\s*:\s*/i) || textBeforeEval.match(/Phát âm\s*(?:&|và)\s*Ngữ âm\s*:\s*/i);
    let textBeforePhonetics = textBeforeEval;

    if (splitPhonetics) {
      const pIdx = splitPhonetics.index;
      textBeforePhonetics = textBeforeEval.substring(0, pIdx).trim();
      phoneticsRaw = textBeforeEval.substring(pIdx + splitPhonetics[0].length).trim();
    }

    // 3. Split Vietnamese Feedback
    const splitFeedback = textBeforePhonetics.match(/\n\s*Nhận xét\s*:\s*/i) || textBeforePhonetics.match(/Nhận xét\s*:\s*/i);
    if (splitFeedback) {
      const fIdx = splitFeedback.index;
      frenchReply = textBeforePhonetics.substring(0, fIdx).trim();
      feedbackVi = textBeforePhonetics.substring(fIdx + splitFeedback[0].length).trim();
    } else {
      frenchReply = textBeforePhonetics.trim();
    }

    // Parse structured phonetic items and turn evaluation
    const parsedPhonetics = this.parsePhoneticsList(phoneticsRaw);
    const turnEval = this.parseTurnEvaluation(turnEvalRaw, userFrenchText);

    return {
      frenchReply: frenchReply || 'Très bien, continuons la conversation !',
      feedbackVi: feedbackVi || 'Rất tốt! Câu nói của bạn tự nhiên và không mắc lỗi ngữ pháp đáng kể.',
      phoneticsRaw,
      phonetics: parsedPhonetics,
      turnEvalRaw,
      turnEval
    };
  },

  // Helper to parse real-time turn evaluation into structured score card
  parseTurnEvaluation(rawText, userFrenchText = '') {
    const isVietnamese = /[ăắằẳẵặấầẩẫậếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúủũụứừửữựýỳỷỹỵđ]/i.test(userFrenchText) ||
      /\b(tôi|bạn|chúng\s*tôi|không|có\s*thể|chỉnh|phát\s*âm|tiếng\s*việt|giúp|với|ăn|uống|bây\s*giờ)\b/i.test(userFrenchText);

    if (isVietnamese) {
      return {
        score: 0.0,
        maxScore: 5.0,
        delfEquivalent: 0.0,
        badge: 'Tiếng Việt (0.0/25)',
        badgeClass: 'score-low',
        grammarNote: 'Chưa sử dụng tiếng Pháp (Quy chế thi DELF tính 0 điểm)',
        lexiqueNote: 'Hãy thử bấm nút Micro và nói câu tiếng Pháp mẫu',
        stars: '⭐'
      };
    }

    if (!rawText) {
      const wordCount = (userFrenchText || '').trim().split(/\s+/).filter(Boolean).length;
      const score = Math.min(5.0, Math.max(2.5, +(2.5 + Math.min(wordCount, 12) * 0.2).toFixed(1)));
      const delfEquivalent = +(score * 5).toFixed(1);
      return {
        score,
        maxScore: 5.0,
        delfEquivalent,
        badge: score >= 4.2 ? 'Xuất sắc (B1)' : score >= 3.5 ? 'Rất tốt (B1)' : 'Đạt chuẩn (A2+)',
        badgeClass: score >= 4.2 ? 'score-perfect' : score >= 3.5 ? 'score-good' : 'score-medium',
        grammarNote: 'Cấu trúc câu rõ ràng, diễn đạt tự nhiên',
        lexiqueNote: 'Vốn từ vựng tương thích ngữ cảnh hội thoại',
        stars: score >= 4.2 ? '⭐⭐⭐⭐⭐' : score >= 3.5 ? '⭐⭐⭐⭐' : '⭐⭐⭐'
      };
    }

    let score = 4.0;
    const scoreMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5/);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1].replace(',', '.'));
    } else {
      const singleScore = rawText.match(/Điểm\s*:\s*(\d+(?:[.,]\d+)?)/i);
      if (singleScore) score = parseFloat(singleScore[1].replace(',', '.'));
    }

    let delfEquivalent = +(score * 5).toFixed(1);
    const delfMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*25/);
    if (delfMatch) {
      delfEquivalent = parseFloat(delfMatch[1].replace(',', '.'));
    }

    let badge = 'Rất tốt (B1)';
    const badgeMatch = rawText.match(/Huy\s*hiệu\s*:\s*([^\n\r]+)/i);
    if (badgeMatch) badge = badgeMatch[1].trim();

    let grammarNote = 'Cấu trúc câu chính xác, chia đúng thì';
    const gramMatch = rawText.match(/Ngữ\s*pháp\s*:\s*([^\n\r]+)/i);
    if (gramMatch) grammarNote = gramMatch[1].trim();

    let lexiqueNote = 'Vốn từ vựng chuẩn xác và phong phú';
    const lexMatch = rawText.match(/Từ\s*vựng\s*:\s*([^\n\r]+)/i);
    if (lexMatch) lexiqueNote = lexMatch[1].trim();

    const badgeClass = score >= 4.5 ? 'score-perfect' : score >= 3.5 ? 'score-good' : score >= 2.5 ? 'score-medium' : 'score-low';
    const stars = score >= 4.5 ? '⭐⭐⭐⭐⭐' : score >= 3.5 ? '⭐⭐⭐⭐' : score >= 2.5 ? '⭐⭐⭐' : '⭐⭐';

    return {
      score,
      maxScore: 5.0,
      delfEquivalent,
      badge,
      badgeClass,
      grammarNote,
      lexiqueNote,
      stars
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
      .map((turn, i) => `Lượt ${i + 1} - Học viên nói: "${turn.userText}"\nGiáo viên đáp: "${turn.frenchReply}"`)
      .join('\n\n');

    let systemPrompt = '';

    if (level === 'B1') {
      systemPrompt = `Bạn là một Giám khảo chấm thi Nói DELF B1 chính thức và cực kỳ nghiêm khắc của France Éducation International.
Nhiệm vụ: Dựa trên toàn bộ nội dung học viên đã nói trong phiên hội thoại tiếng Pháp dưới đây, hãy áp dụng đúng Grille d'évaluation de la production orale DELF B1 (Tổng 25 điểm).

QUY TẮC CHẤM THI NGHIÊM NGẶT THEO BAREM CHÍNH THỨC CỦA FRANCE ÉDUCATION INTERNATIONAL:
1. ĐIỀU KIỆN TIÊN QUYẾT VỀ NGÔN NGỮ (RẤT QUAN TRỌNG):
   - Giám khảo CHỈ chấm điểm dựa trên TIẾNG PHÁP mà thí sinh đã nói.
   - Nếu thí sinh nói/nhập bằng TIẾNG VIỆT, tiếng Anh hoặc ngôn ngữ khác (ví dụ: "bạn có thể chỉnh phát âm cho tôi không", "xin chào", "tôi muốn học"), hoặc chỉ hỏi câu phiếm không phải hội thoại tiếng Pháp:
     -> BẮT BUỘC chấm TẤT CẢ các tiêu chí = 0 điểm. "tong_diem" = 0.0 / 25.
     -> Ghi chú rõ: "Thí sinh sử dụng tiếng Việt/ngôn ngữ khác thay vì tiếng Pháp nên không có cơ sở đánh giá theo chuẩn DELF."

2. BAREM THEO DUNG LƯỢNG VÀ SỐ LƯỢT HỘI THOẠI (VOLUME & ENGAGEMENT):
   - Nếu thí sinh chỉ nói 1-2 câu tiếng Pháp rất ngắn (< 15 từ tiếng Pháp tổng cộng):
     -> Các tiêu chí nhiệm vụ (entretien_dirige, exercice_interaction, expression_point_de_vue) chỉ được chấm 0.0 hoặc tối đa 0.5 - 1.0 điểm (mức Không đạt / Chưa đủ dữ liệu để đánh giá).
     -> Tổng điểm "tong_diem" không được vượt quá 2.0 - 5.0 / 25 điểm.
     -> Ghi chú: "Dung lượng bài thi quá ngắn (chỉ 1 câu), chưa đủ dữ liệu để đánh giá khả năng tương tác hay thuyết trình B1."
   - Để đạt mức B1 (15 - 25 điểm): Thí sinh phải hoàn thành ít nhất 4-6 lượt nói tiếng Pháp có cấu trúc câu đầy đủ, sử dụng đúng thì quá khứ/tương lai, vốn từ phong phú và có lập luận quan điểm.

3. 4 MỨC ĐIỂM CHUẨN CỦA MỖI TIÊU CHÍ (Grille officielle DELF B1):
   - Mức 0: Không nói tiếng Pháp / Không trả lời / Hoàn toàn không hiểu. (0 điểm)
   - Mức 1 (En dessous du niveau ciblé): Dưới chuẩn (1.0 điểm / max 4; 1.0-1.5 điểm / max 5).
   - Mức 2 (Niveau ciblé): Đạt chuẩn B1 (2.5 điểm / max 4; 3.0 điểm / max 5).
   - Mức 3 (Niveau ciblé +): Vượt chuẩn B1 (3.5 - 4.0 điểm / max 4; 4.0 - 5.0 điểm / max 5).

4. TÍNH TỔNG ĐIỂM CHÍNH XÁC:
   - "tong_diem" PHẢI LÀ TỔNG SỐ HỌC CHÍNH XÁC CỦA CÁC ĐIỂM TIÊU CHÍ CỘNG LẠI (Ví dụ: 0 + 0 + 0 + 0 + 0 + 0 = 0.0).

6 tiêu chí chấm:
1. entretien_dirige (max 4 điểm): Giới thiệu bản thân, nói về kinh nghiệm cá nhân.
2. exercice_interaction (max 4 điểm): Tương tác, phản xạ xử lý tình huống hội thoại.
3. expression_point_de_vue (max 4 điểm): Trình bày ý kiến cá nhân, lập luận.
4. lexique (max 5 điểm): Vốn từ vựng, độ chính xác từ ngữ B1.
5. morphosyntaxe (max 4 điểm): Ngữ pháp, cấu trúc câu, liên từ B1.
6. phonologie (max 4 điểm): Đánh giá qua cách diễn đạt, ngắt nghỉ, chính tả ngữ âm.

Hãy trả về DUY NHẤT một JSON theo cấu trúc sau (không kèm markdown thừa):
{
  "entretien_dirige": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "exercice_interaction": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "expression_point_de_vue": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "lexique": { "level": "B1", "score": 3.0, "max": 5, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "morphosyntaxe": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "phonologie": { "level": "B1", "score": 2.5, "max": 4, "notes": "Ghi chú nhận xét bằng tiếng Việt" },
  "tong_diem": 15.5,
  "overall_feedback": "2-3 câu tổng kết điểm mạnh và những điểm cần cải thiện nhất bằng tiếng Việt.",
  "frequent_errors": ["Lỗi 1", "Lỗi 2"]
}`;
    } else {
      // A1 or A2 simplified criteria
      systemPrompt = `Bạn là giám khảo chấm thi Nói DELF trình độ [${level}] chính thức.
QUY TẮC: Nếu thí sinh nói bằng tiếng Việt hoặc ngôn ngữ khác không phải tiếng Pháp -> Tất cả các tiêu chí = 0 điểm, tổng điểm = 0/15. Nếu chỉ nói 1 câu ngắn -> Tổng điểm chỉ từ 1-3 điểm.
Áp dụng tiêu chí đánh giá tiếng Pháp cho trình độ ${level} (Tổng 15 điểm):
1. lexique (max 5 điểm): Từ vựng cơ bản.
2. morphosyntaxe (max 5 điểm): Ngữ pháp câu đơn giản.
3. phonologie (max 5 điểm): Phát âm và độ lưu loát.

Trả về JSON:
{
  "lexique": { "level": "${level}", "score": 3.0, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "morphosyntaxe": { "level": "${level}", "score": 3.0, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "phonologie": { "level": "${level}", "score": 3.0, "max": 5, "notes": "Nhận xét tiếng Việt" },
  "tong_diem": 9.0,
  "overall_feedback": "Nhận xét tổng quan bằng tiếng Việt",
  "frequent_errors": ["Lỗi 1", "Lỗi 2"]
}`;
    }

    const userMessage = `Dưới đây là toàn bộ trích đoạn các câu học viên đã nói trong phiên hội thoại này:\n\n${transcript}\n\nHãy chấm điểm chi tiết, nghiêm khắc và chính xác theo đúng barem Grille DELF của France Éducation International.`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.2,
      jsonMode: true
    });

    const parsedResult = this.cleanAndParseJSON(rawResponse);
    return parsedResult;
  },

  // 2.1 Module AI Chẩn Đoán Lỗi Thường Gặp & Tìm Giải Pháp Khắc Phục (Diagnostic & Remedial Center)
  async diagnoseErrorsAndPrescribeSolutions(historyRecords = [], profile = null) {
    const level = profile ? profile.level : 'B1';
    const profileName = profile ? profile.name : 'Học viên';

    // Aggregate error footprint from history
    const errorList = [];
    let totalSessions = historyRecords.length;
    let speakingScores = [];

    historyRecords.forEach(r => {
      if (r.type === 'speaking' && r.score !== undefined) {
        speakingScores.push(r.score);
      }
      if (Array.isArray(r.commonErrors)) {
        r.commonErrors.forEach(err => {
          if (err && typeof err === 'string') errorList.push(err.trim());
        });
      }
    });

    const errorSummaryText = errorList.length > 0
      ? `Các lỗi đã ghi nhận trong lịch sử: ${errorList.join(', ')}`
      : 'Chưa có ghi nhận lỗi cụ thể (học viên mới bắt đầu học).';

    const systemPrompt = `Bạn là Chuyên gia Cố vấn Sư phạm & Giám khảo DELF cao cấp của France Éducation International.
Nhiệm vụ: Phân tích toàn diện lịch sử học tập của học viên [${profileName}] (Trình độ mục tiêu: DELF ${level}), nhận diện chính xác các lỗi học viên ĐANG MẮC PHẢI NHIỀU NHẤT, tóm tắt chẩn đoán và đưa ra GIẢI PHÁP KHẮC PHỤC TRIỆT ĐỂ.

Thông tin học viên:
- Tên: ${profileName}
- Mục tiêu: DELF ${level}
- Tổng số buổi luyện: ${totalSessions}
- Lịch sử điểm thi Nói (/25): ${speakingScores.join(', ') || 'Chưa có'}
- Dữ liệu lỗi ghi nhận: ${errorSummaryText}

YÊU CẦU:
1. "summary": 2-3 câu nhận xét chân thực, khích lệ và chỉ rõ điểm nghẽn lớn nhất trong phản xạ, ngữ pháp hoặc phát âm của học viên.
2. "primary_weakness": Tên ngắn gọn của điểm yếu cốt lõi cần ưu tiên khắc phục (ví dụ: "Phối hợp thì Passé composé vs Imparfait & Phân biệt âm mũi").
3. "top_errors": Danh sách 3-4 lỗi học viên gặp phải nhiều nhất hoặc điển hình nhất ở trình độ DELF ${level}. Mỗi lỗi gồm:
   - "category": Phân loại ("Ngữ pháp", "Phát âm & Ngữ âm", "Từ vựng & Diễn đạt", "Kỹ năng Nghe/Đọc").
   - "title": Tên lỗi ngắn gọn, súc tích.
   - "severity": Mức độ nghiêm trọng ("Nghiêm trọng (Critical B1)", "Trung bình (B1 Requirement)", "Cần lưu ý").
   - "frequency_text": Mô tả tần suất (ví dụ: "Gặp thường xuyên trong kể chuyện", "Dễ nhầm khi phản xạ nhanh").
   - "wrong_example": Câu sai điển hình học viên hay nói/nghĩ.
   - "correct_example": Câu sửa đúng chuẩn người Pháp.
   - "explanation": Giải thích ngắn gọn bản chất ngữ pháp/ngữ âm tại sao sai bằng tiếng Việt.
   - "action_solution": Giải pháp hành động cụ thể, mẹo nhớ thần tốc (quy tắc dễ nhớ).
   - "practice_action": Hành động luyện tập ("speaking" hoặc "phonetics" hoặc "reading" hoặc "listening").
4. "study_roadmap": 3 bước lộ trình hành động cụ thể trong tuần để nâng điểm thi DELF.

Hãy trả về DUY NHẤT một JSON theo cấu trúc sau (không kèm markdown):
{
  "summary": "Tóm tắt chẩn đoán tổng quan...",
  "primary_weakness": "Điểm yếu cốt lõi...",
  "top_errors": [
    {
      "category": "Ngữ pháp",
      "title": "Nhầm lẫn trợ động từ Être và Avoir ở Passé Composé",
      "severity": "Nghiêm trọng (Critical B1)",
      "frequency_text": "Rất thường gặp khi kể lại trải nghiệm",
      "wrong_example": "Hier, j'ai allé au marché avec mes amis.",
      "correct_example": "Hier, je suis allé(e) au marché với mes amis.",
      "explanation": "Động từ chuyển động 'aller' bắt buộc chia với trợ động từ 'être' và hợp giống số với chủ ngữ.",
      "action_solution": "Học thuộc 14 động từ 'Ngôi nhà Être' (DR MRS VANDERTRAMP) và luôn nhớ thêm 'e/s' vào participe passé khi chủ ngữ là nữ/số nhiều.",
      "practice_action": "speaking"
    }
  ],
  "study_roadmap": [
    "Bước 1: ...",
    "Bước 2: ...",
    "Bước 3: ..."
  ]
}`;

    const userMessage = `Hãy phân tích và đưa ra kế hoạch chẩn đoán & khắc phục lỗi chi tiết cho học viên ${profileName} (DELF ${level}) ngay bây giờ.`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      jsonMode: true
    });

    const parsed = this.cleanAndParseJSON(rawResponse);
    if (!parsed) return null;

    // Normalize category names
    const catMap = {
      'Ngữ pháp': 'grammar',
      'Phát âm & Ngữ âm': 'phonetics',
      'Phát âm': 'phonetics',
      'Từ vựng & Diễn đạt': 'vocab',
      'Từ vựng': 'vocab',
      'Kỹ năng Nghe/Đọc': 'comprehension',
      'Đọc / Nghe': 'comprehension'
    };

    const rawErrors = parsed.top_errors || parsed.errors || [];
    const normalizedErrors = rawErrors.map((err, idx) => ({
      id: err.id || `diag-err-${idx + 1}`,
      category: catMap[err.category] || err.category || 'grammar',
      title: err.title || 'Lỗi diễn đạt',
      severity: err.severity || 'Cần cải thiện',
      frequency: err.frequency || (err.frequency_text ? 5 : 3),
      frequency_text: err.frequency_text || 'Thường gặp trong bài thi',
      wrong: err.wrong_example || err.wrong || '',
      correct: err.correct_example || err.correct || '',
      explanation: err.explanation || '',
      action_solution: err.action_solution || err.solution || '',
      practice_action: err.practice_action || 'speaking'
    }));

    const rawRoadmap = parsed.study_roadmap || parsed.remedialPlan || [];
    const normalizedPlan = rawRoadmap.map((item, idx) => {
      if (typeof item === 'string') {
        const parts = item.split(':');
        return {
          step: parts[0] ? parts[0].trim() : `Bước ${idx + 1}`,
          action: parts.slice(1).join(':').trim() || item,
          tip: 'Kiên trì thực hành để tạo phản xạ ngôn ngữ tự nhiên.'
        };
      }
      return item;
    });

    const bottlenecks = parsed.bottlenecks || (parsed.primary_weakness ? [parsed.primary_weakness] : [
      'Phân biệt Passé Composé & Imparfait',
      'Khẩu hình 3 âm mũi [ɑ̃], [ɔ̃], [ɛ̃]',
      'Sử dụng liên từ nối ý B1'
    ]);

    return {
      summary: parsed.summary || 'Chẩn đoán học tập đã hoàn tất.',
      primary_weakness: parsed.primary_weakness || bottlenecks[0],
      bottlenecks,
      errors: normalizedErrors,
      top_errors: normalizedErrors,
      remedialPlan: normalizedPlan,
      study_roadmap: rawRoadmap
    };
  },

  // 3. Module Luyện Đọc: Sinh đoạn văn + 3 câu hỏi trắc nghiệm
  async generateReadingExercise({ level = 'B1', seedText = null, seedTitle = null, topic = null }) {
    let contextInstruction = '';
    if (seedText && seedText.trim()) {
      contextInstruction = `DƯỚI ĐÂY LÀ BÀI BÁO / VĂN BẢN TIẾNG PHÁP THỰC TẾ ĐƯỢC CHỌN TỪ KHO ĐỀ (${seedTitle || 'Tài liệu chuẩn'}):
"""
${seedText.trim()}
"""
YÊU CẦU BẮT BUỘC:
1. Hãy sử dụng CHÍNH XÁC nội dung bài báo / văn bản trên làm bài đọc (thuộc tính "passage"). Bạn có thể giữ nguyên văn hoặc tinh chỉnh nhẹ cho chuẩn độ dài đọc hiểu DELF trình độ [${level}] nhưng TUYỆT ĐỐI KHÔNG tự ý thay đổi sang một chủ đề hay bài viết khác!
2. Đặt "title" và "topic" bám sát đúng bài báo / văn bản trên.
3. Soạn 3 câu hỏi trắc nghiệm Compréhension écrite (mỗi câu 4 đáp án A, B, C, D) kiểm tra trực tiếp các thông tin, sự kiện, chi tiết có trong bài báo trên.
4. Kèm lời giải thích "explanation" chi tiết bằng tiếng Việt dẫn chứng trích đoạn bài báo.`;
    } else {
      contextInstruction = `Hãy tạo một đoạn văn đọc hiểu tiếng Pháp mới về chủ đề: ${topic || 'Đời sống, văn hóa, công nghệ hoặc xã hội Pháp'}, chuẩn trình độ CEFR [${level}]. Độ dài khoảng 100-160 từ.
Sau đoạn văn, tạo 3 câu hỏi trắc nghiệm kiểm tra độ hiểu bài (Compréhension écrite). Mỗi câu hỏi có 4 lựa chọn (A, B, C, D).`;
    }

    const systemPrompt = `Bạn là chuyên gia biên soạn đề thi DELF tiếng Pháp (Compréhension écrite).
${contextInstruction}

Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:
{
  "title": "Tiêu đề bài đọc tiếng Pháp",
  "topic": "Chủ đề",
  "passage": "Toàn bộ đoạn văn bài đọc tiếng Pháp...",
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
      messages: [{ role: 'user', content: seedText ? 'Hãy tạo bài đọc hiểu trắc nghiệm dựa trên chính xác văn bản bài báo đã cung cấp.' : 'Hãy tạo bài đọc hiểu trắc nghiệm DELF mới.' }],
      temperature: 0.3,
      jsonMode: true
    });

    return this.cleanAndParseJSON(rawResponse);
  },

  // 4. Module Luyện Nghe: Sinh đoạn hội thoại/bài phát thanh + trắc nghiệm
  async generateListeningExercise({ level = 'B1', seedText = null, seedTitle = null, topic = null }) {
    let contextInstruction = '';
    if (seedText && seedText.trim()) {
      contextInstruction = `DƯỚI ĐÂY LÀ TRANSCRIPT BẢN TIN / PHÓNG SỰ THỰC TẾ (${seedTitle || 'Tài liệu nghe'}):
"""
${seedText.trim()}
"""
YÊU CẦU BẮT BUỘC:
1. Hãy sử dụng CHÍNH XÁC nội dung transcript này (hoặc biên tập tự nhiên, độ dài 70-150 từ để giọng đọc AI SpeechSynthesis phát âm rõ ràng) làm bài nghe (thuộc tính "passage"). TUYỆT ĐỐI KHÔNG tự ý đổi sang chủ đề khác!
2. Đặt "title" và "topic" bám sát transcript trên.
3. Soạn 3 câu hỏi trắc nghiệm Compréhension de l'oral (mỗi câu 4 đáp án A, B, C, D) kiểm tra khả năng nghe hiểu thông tin chi tiết từ đoạn âm thanh này.
4. Kèm lời giải thích "explanation" bằng tiếng Việt.`;
    } else {
      contextInstruction = `Hãy soạn một đoạn tin tức radio hoặc hội thoại tiếng Pháp đời sống ngắn gọn (70-130 từ) phù hợp để luyện nghe trình độ [${level}] về chủ đề ${topic || 'Công việc, du lịch, khoa học hoặc cuộc sống hàng ngày'}.
Kèm theo đó là 3 câu hỏi trắc nghiệm kiểm tra khả năng nghe hiểu.`;
    }

    const systemPrompt = `Bạn là chuyên gia biên soạn bài thi Nghe DELF (Compréhension de l'oral).
${contextInstruction}

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
      "correct_index": 0,
      "explanation": "Giải thích chi tiết bằng tiếng Việt dựa vào nội dung bài nghe."
    }
  ]
}`;

    const rawResponse = await this.request({
      systemPrompt,
      messages: [{ role: 'user', content: seedText ? 'Hãy tạo bài nghe hiểu trắc nghiệm dựa trên đúng transcript đã cung cấp.' : 'Hãy tạo bài luyện nghe trắc nghiệm DELF mới.' }],
      temperature: 0.3,
      jsonMode: true
    });

    return this.cleanAndParseJSON(rawResponse);
  },

  // Realistic Simulation / Demo Mode for testing when API key is not entered
  mockResponse({ systemPrompt, messages, jsonMode }) {
    const userMessageContent = messages && messages.length > 0 ? messages[messages.length - 1].content : '';

    // If request was for DELF speaking evaluation
    if (systemPrompt.includes('giám khảo chấm thi Nói DELF') || systemPrompt.includes('Grille d\'évaluation de la production orale')) {
      const isB1 = !systemPrompt.includes('Tổng 15 điểm');
      return this._mockSpeakingEvaluation(userMessageContent, isB1);
    }

    // If request was for Reading exercise
    if (systemPrompt.includes('Compréhension écrite') || systemPrompt.includes('bài đọc hiểu')) {
      return this._mockReadingExercise(systemPrompt);
    }

    // If request was for Listening exercise
    if (systemPrompt.includes('Compréhension de l\'oral') || systemPrompt.includes('luyện nghe')) {
      return this._mockListeningExercise(systemPrompt);
    }

    // If request was for Diagnostic & Error Solutions
    if (systemPrompt.includes('Chẩn Đoán Lỗi') || systemPrompt.includes('GIẢI PHÁP KHẮC PHỤC') || systemPrompt.includes('Chuyên gia Cố vấn Sư phạm & Giám khảo DELF')) {
      return this._mockDiagnosticAndSolutions(systemPrompt);
    }

    // Default conversational response with comprehensive phonetics & tips
    const lastUserMsg = messages && messages.length > 0 ? (messages[messages.length - 1].content || '') : '';
    return this._generateContextualTutorReply(lastUserMsg, 'B1');
  },

  // Intelligent Contextual Tutor Response Generator for Simulation & Offline Mode
  _generateContextualTutorReply(userText = '', level = 'B1') {
    const cleanText = userText.trim();
    const lower = cleanText.toLowerCase();

    // Dynamic Vietnamese Detection: characters unique to Vietnamese (tones, horns, hooks, d-bar)
    const vietnamesePattern = /[ăắằẳẵặấầẩẫậếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúủũụứừửữựýỳỷỹỵđảãạẻẽẹỉĩịỏõọủũụỷỹỵ]/i;
    const vietnameseCommonWords = /\b(tôi|bạn|chúng\s*tôi|chúng\s*ta|anh|chị|không|có\s*thể|chỉnh|phát\s*âm|tiếng\s*việt|giúp|với|nhé|được|luyện\s*tập|xin\s*chào|cảm\s*ơn|ăn|uống|đói|du\s*lịch|đi\s*chơi|làm\s*việc|học|bây\s*giờ)\b/i;
    const isVietnameseInput = vietnamesePattern.test(cleanText) || vietnameseCommonWords.test(cleanText);

    // ================= 1. XỬ LÝ KHI HỌC VIÊN NHẬP TIẾNG VIỆT =================
    if (isVietnameseInput) {
      // 1.1 Yêu cầu sửa/chỉnh phát âm
      if (/chỉnh|sửa|phát\s*âm|prononciation/i.test(lower)) {
        return `Bien sûr ! Avec grand plaisir. En français, pour dire "bạn có thể chỉnh phát âm cho tôi không", vous pouvez dire : « Pouvez-vous corriger ma prononciation s'il vous plaît ? » Répétez après moi cette phrase !

Nhận xét:
Khi muốn nhờ giáo viên sửa phát âm, trong tiếng Pháp bạn hãy dùng cấu trúc lịch sự: "Pouvez-vous corriger ma prononciation ?" (hoặc thân mật: "Peux-tu corriger ma prononciation ?"). Hãy thử bấm nút Micro và nói câu tiếng Pháp này nhé!

Phát âm & Ngữ âm:
- Pouvez-vous (/puve vu/): Âm [u] trong "pouvez" chu tròn môi sâu, nối âm nhẹ giữa -z và vous.
- corriger (/kɔʁiʒe/): Chú ý âm [ʁ] rung nhẹ ở đáy cổ họng và âm [ʒ] rung mềm.
- prononciation (/pʁɔnɔ̃sjasjɔ̃/): Có 2 âm mũi [ɔ̃] ("on" và "on"), hạ hàm mềm để hơi thoát lên khoang mũi.

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Câu nhập bằng tiếng Việt, chưa sử dụng cấu trúc tiếng Pháp
- Từ vựng: Hãy thử nói mẫu câu tiếng Pháp gợi ý ở trên`;
      }

      // 1.2 Chủ đề ăn uống ("tôi sẽ ăn bây giờ", "ăn cơm", "đói", "món ăn")
      if (/ăn|uống|đói|cơm|bữa|món/i.test(lower)) {
        return `Bon appétit ! En français, pour exprimer cela, vous pouvez dire : « Je vais manger maintenant. » ou « J'ai faim, je vais préparer mon repas. » Qu'avez-vous envie de déguster de bon aujourd'hui ?

Nhận xét:
Để diễn đạt ý "Tôi sẽ ăn bây giờ", trong tiếng Pháp bạn dùng thì tương lai gần (Futur proche): [Je vais + động từ nguyên thể (manger) + maintenant]. Cấu trúc này rất thông dụng và tự nhiên trong giao tiếp hằng ngày.

Phát âm & Ngữ âm:
- Je vais (/ʒə vɛ/): Âm [ʒə] phát âm nhẹ, âm [ɛ] mở miệng tự nhiên như âm "e" tiếng Việt.
- manger (/mɑ̃ʒe/): Âm mũi [ɑ̃] mở rộng khẩu hình miệng, âm [ʒ] rung nhẹ đầu lưỡi, đuôi "-er" đọc là [e].
- maintenant (/mɛ̃tnɑ̃/): Phân biệt rõ âm mũi [ɛ̃] ("main") và âm mũi [ɑ̃] ("nant"), không khép môi tạo âm "n".

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Chưa áp dụng tiếng Pháp vào hội thoại
- Từ vựng: Cần chuyển đổi sang các từ tiếng Pháp như manger, repas, maintenant`;
      }

      // 1.3 Chủ đề du lịch ("du lịch", "kỳ nghỉ", "đi chơi", "paris", "pháp")
      if (/du\s*lịch|kỳ\s*nghỉ|đi\s*chơi|paris|pháp/i.test(lower)) {
        return `Merveilleux ! Pour parler de vos voyages en français, vous pouvez dire : « J'aimerais faire un voyage en France. » ou « Je voudrais partir en vacances. » Quel pays aimeriez-vous visiter prochainement ?

Nhận xét:
Để diễn đạt mong muốn đi du lịch, bạn hãy dùng cấu trúc điều kiện lịch sự: "J'aimerais voyager" hoặc "Je voudrais visiter...". Chú ý giới từ: "en France" (nước giống cái), "au Vietnam" (nước giống đực).

Phát âm & Ngữ âm:
- voyager (/vwajaʒe/): Chú ý tổ hợp âm [vwa] và đuôi "-er" phát âm là [e].
- vacances (/vakɑ̃s/): Âm mũi [ɑ̃] mở rộng khẩu hình, đuôi "-ces" phát âm rõ âm gió [s].
- visiter (/vizite/): Chữ "s" đứng giữa 2 nguyên âm phát âm thành [z].

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Câu tiếng Việt (DELF B1 yêu cầu sản sinh tiếng Pháp)
- Từ vựng: Hãy thực hành các từ: voyage, vacances, visiter`;
      }

      // 1.4 Chủ đề công việc & học tập ("đi làm", "công việc", "học tập", "trường học")
      if (/công\s*việc|làm\s*việc|đi\s*làm|học|trường|công\s*ty/i.test(lower)) {
        return `Très bien ! Pour présenter votre travail ou vos études, vous pouvez dire : « Actuellement, je travaille dans une entreprise. » ou « Je suis étudiant(e). » Dans quel domaine travaillez-vous ?

Nhận xét:
Khi giới thiệu nghề nghiệp trong tiếng Pháp, không dùng mạo từ sau động từ "être" (Ví dụ: "Je suis étudiant", không nói "Je suis un étudiant").

Phát âm & Ngữ âm:
- travail (/tʁavaj/): Chú ý âm [ʁ] rung đáy họng và âm [j] (yod) ở đuôi.
- étudiant (/etydjɑ̃/): Âm [y] trong "é-tu" (khẩu hình chữ i nhưng chu tròn môi) và âm mũi [ɑ̃] ở cuối.
- entreprise (/ɑ̃tʁəpʁiz/): Âm mũi [ɑ̃] ở đầu và chữ "s" phát âm thành [z].

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Chưa tạo câu bằng tiếng Pháp
- Từ vựng: Cần ứng dụng từ vựng công việc/học tập tiếng Pháp`;
      }

      // 1.5 Lời chào & giới thiệu ("xin chào", "tôi tên là", "giới thiệu")
      if (/chào|tên\s*là|giới\s*thiệu/i.test(lower)) {
        return `Bonjour ! Enchanté de faire votre connaissance. En français, vous pouvez dire : « Bonjour, je m'appelle Trang et je suis ravie d'apprendre le français. » Répétez après moi cette phrase !

Nhận xét:
Cấu trúc giới thiệu bản thân chuẩn: "Bonjour, je m'appelle [Tên]". Để thể hiện sự lịch sự và vui mừng khi gặp gỡ, bạn có thể thêm "Enchanté(e)" hoặc "Ravi(e) de faire votre connaissance".

Phát âm & Ngữ âm:
- Bonjour (/bɔ̃ʒuʁ/): Âm mũi [ɔ̃] chu môi tròn nhỏ và âm rung họng [ʁ], không đọc thành "bông-dua".
- je m'appelle (/ʒə mapɛl/): Âm [ʒə] phát âm nhẹ, âm "e" cuối là âm câm.
- enchanté (/ɑ̃ʃɑ̃te/): Có 2 âm mũi [ɑ̃] mở rộng khẩu hình.

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Câu nhập liệu tiếng Việt
- Từ vựng: Hãy bắt đầu bằng lời chào "Bonjour" và "Je m'appelle..."`;
      }

      // 1.6 Tiếng Việt tổng quát khác
      return `En français, pour exprimer votre idée, vous pouvez dire : « Bonjour ! Je souhaite m'exprimer en français avec vous. » Répétez après moi pour pratiquer votre expression orale !

Nhận xét:
Khi muốn bắt đầu giao tiếp bằng tiếng Pháp, bạn có thể dùng cấu trúc [Je souhaite + động từ nguyên thể] để diễn đạt nguyện vọng một cách lịch sự và tự nhiên.

Phát âm & Ngữ âm:
- Bonjour (/bɔ̃ʒuʁ/): Âm mũi [ɔ̃] chu môi tròn nhỏ và âm rung họng [ʁ].
- français (/fʁɑ̃sɛ/): Âm mũi [ɑ̃] và đuôi "-ais" đọc là [ɛ], không đọc chữ "s" cuối.
- s'exprimer (/sɛkspʁime/): Chú ý tổ hợp âm [spʁ] và đuôi "-er" đọc là [e].

Đánh giá câu:
- Điểm: 0.0/5.0 (Quy đổi DELF: 0.0/25)
- Huy hiệu: Tiếng Việt (0.0/25)
- Ngữ pháp: Chưa đạt yêu cầu ngôn ngữ đích
- Từ vựng: Hãy luyện tập theo câu tiếng Pháp mẫu`;
    }

    // ================= 2. XỬ LÝ KHI HỌC VIÊN NÓI TIẾNG PHÁP =================
    // 2.1 Chủ đề Ẩm thực & Bữa ăn (Food & Meals)
    if (/manger|mange|d[iî]ner|d[eé]jeuner|repas|faim|cuisine|plat|restaurant|pain|fromage|chocolat|boire|caf[eé]|nourriture/i.test(lower)) {
      return `Bon appétit ! C'est un sujet délicieux et très convivial. Qu'avez-vous prévu de déguster de bon aujourd'hui pour votre repas ?

Nhận xét:
Bạn đã diễn đạt về chủ đề ăn uống rất tự nhiên! Hãy lưu ý chia đúng động từ (manger, boire, préparer) và sử dụng mạo từ bộ phận (du, de la, des) khi nói về lượng thức ăn không đếm được.

Phát âm & Ngữ âm:
- manger (/mɑ̃ʒe/): Âm mũi [ɑ̃] mở rộng miệng, âm [ʒ] rung mềm, đuôi "-er" đọc là [e].
- repas (/ʁəpa/): Âm [ʁ] rung đáy họng nhẹ, chữ "s" cuối là âm câm (lettre muette).
- cuisine (/kɥizin/): Âm bán nguyên âm [ɥ] chu môi kết hợp [i], chữ "s" nằm giữa 2 nguyên âm đọc là [z].

Đánh giá câu:
- Điểm: 4.5/5.0 (Quy đổi DELF: 22.5/25)
- Huy hiệu: Xuất sắc (B1)
- Ngữ pháp: Dùng thì và mạo từ chính xác, cấu trúc tự nhiên
- Từ vựng: Vốn từ về ẩm thực phong phú và chuẩn xác`;
    }

    // 2.2 Chủ đề Du lịch & Kỳ nghỉ (Travel & Holidays)
    if (/voyage|voyager|vacances|paris|france|plage|pays|ville|visiter|train|avion|mer|montagne|s[eé]jour/i.test(lower)) {
      return `C'est une magnifique destination ! Les voyages permettent de s'ouvrir à de nouvelles cultures. Quels sont les endroits que vous avez le plus envie de découvrir lors de votre prochain séjour ?

Nhận xét:
Ý tưởng về du lịch rất rõ ràng và sống động! Hãy chú ý sử dụng đúng giới từ đi với địa danh: "en France" (nước giống cái), "au Vietnam" (nước giống đực), "à Paris" (thành phố).

Phát âm & Ngữ âm:
- voyage (/vwajaʒ/): Phát âm rõ tổ hợp âm [vwa] và âm [ʒ] rung nhẹ ở đuôi.
- vacances (/vakɑ̃s/): Âm mũi [ɑ̃] mở rộng khẩu hình, đuôi "-ces" phát âm rõ [s].
- visiter (/vizite/): Chữ "s" nằm giữa 2 nguyên âm phát âm thành [z].

Đánh giá câu:
- Điểm: 4.6/5.0 (Quy đổi DELF: 23.0/25)
- Huy hiệu: Xuất sắc (B1)
- Ngữ pháp: Giới từ địa danh và thì câu diễn đạt rất chuẩn
- Từ vựng: Từ vựng du lịch và trải nghiệm rất phong phú`;
    }

    // 2.3 Chủ đề Công việc & Học tập (Work & Studies)
    if (/travail|travailler|boulot|[eé]tude|[eé]tudiant|bureau|projet|[eé]cole|entreprise|coll[eè]gue|m[eé]tier/i.test(lower)) {
      return `C'est un domaine très enrichissant et formateur ! Quels sont les projets ou les défis qui vous motivent le plus dans votre quotidien professionnel ou étudiant ?

Nhận xét:
Diễn đạt về công việc/học tập rất mạch lạc! Hãy chú ý hòa hợp giống và số của tính từ với danh từ, cũng như chia động từ chuẩn xác khi nói về nhóm làm việc.

Phát âm & Ngữ âm:
- travail (/tʁavaj/): Chú ý âm [ʁ] rung đáy họng và âm [j] (yod) ở đuôi.
- étudiant (/etydjɑ̃/): Âm [y] trong "é-tu" (chu tròn môi giữ khẩu hình chữ i) và âm mũi [ɑ̃] ở cuối.
- projet (/pʁɔʒɛ/): Âm tổ hợp [pʁ] và âm [ʒ], chữ "t" cuối là âm câm.

Đánh giá câu:
- Điểm: 4.4/5.0 (Quy đổi DELF: 22.0/25)
- Huy hiệu: Rất tốt (B1)
- Ngữ pháp: Chia động từ và hòa hợp giống số tốt
- Từ vựng: Thuật ngữ công việc và học tập rõ ràng`;
    }

    // 2.4 Chủ đề Thói quen & Cuộc sống thường nhật (Daily Routine)
    if (/matin|soir|journ[eé]e|r[eé]veil|lever|dormir|habitude|quotidien|famille|maison|temps/i.test(lower)) {
      return `Une bonne organisation quotidienne permet de rester serein et efficace ! Quelle est votre activité préférée pour bien commencer ou terminer votre journée ?

Nhận xét:
Bạn đã diễn đạt thói quen sinh hoạt rất tốt. Lưu ý các động từ phản thân chỉ sinh hoạt (se lever, se réveiller, se coucher) cần biến đổi đại từ phản thân tương ứng với chủ ngữ (je me lève, tu te lèves).

Phát âm & Ngữ âm:
- journée (/ʒuʁne/): Âm [ʒ] rung nhẹ, âm [u] chu sâu và đuôi "-ée" phát âm dứt khoát.
- habitude (/abityd/): Chữ "h" câm hoàn toàn, âm [y] chu tròn môi như huýt sáo.
- quotidien (/kɔtidjɛ̃/): Âm mũi [ɛ̃] ở cuối, bè môi sang hai bên.

Đánh giá câu:
- Điểm: 4.3/5.0 (Quy đổi DELF: 21.5/25)
- Huy hiệu: Rất tốt (B1)
- Ngữ pháp: Vận dụng tốt động từ phản thân chỉ thói quen
- Từ vựng: Từ chỉ thời gian và hoạt động sinh hoạt chuẩn`;
    }

    // 2.5 Chủ đề Sở thích, Âm nhạc, Điện ảnh (Hobbies & Arts)
    if (/musique|film|cin[eé]ma|lire|livre|guitare|piano|sport|courir|football|passion|loisir/i.test(lower)) {
      return `C'est une excellente activité pour se détendre et faire le plein d'énergie ! Combien de fois par semaine avez-vous l'occasion de vous consacrer à cette passion ?

Nhận xét:
Từ vựng về sở thích được sử dụng rất tự nhiên. Hãy lưu ý dùng mạo từ xác định (le, la, les) sau các động từ chỉ cảm xúc và sở thích (aimer, adorer, préférer).

Phát âm & Ngữ âm:
- musique (/myzik/): Âm [y] trong "mu" kết hợp chữ "s" phát âm là [z].
- cinéma (/sinema/): Chữ "c" đứng trước "i" phát âm là [s], không đọc là "ki-nê-ma".
- passion (/pasjɔ̃/): Âm mũi [ɔ̃] chu môi tròn nhỏ.

Đánh giá câu:
- Điểm: 4.5/5.0 (Quy đổi DELF: 22.5/25)
- Huy hiệu: Xuất sắc (B1)
- Ngữ pháp: Mạo từ xác định và động từ chỉ sở thích chính xác
- Từ vựng: Diễn đạt sở thích sinh động`;
    }

    // 2.6 Chủ đề Dự định & Bày tỏ quan điểm DELF B1 (Future Plans & Opinion)
    if (/avis|pense|opinion|important|avenir|d[eé]veloppement|projet|parce que|conclusion|soci[eé]t[eé]|[eé]cologique/i.test(lower)) {
      return `Votre argumentation est très claire et bien structurée ! C'est un sujet essentiel pour l'expression d'un point de vue au DELF B1. Quels exemples concrets pourriez-vous apporter pour illustrer votre idée ?

Nhận xét:
Lập luận rất tốt! Bạn đã sử dụng các liên từ liên kết (connecteurs logiques: à mon avis, en effet, par exemple, en conclusion) rất mạch lạc và đúng tiêu chí chấm điểm DELF B1.

Phát âm & Ngữ âm:
- avis (/avi/): Chữ "s" cuối là âm câm, không phát âm âm gió thừa.
- opinion (/ɔpinjɔ̃/): Âm mũi [ɔ̃] ở cuối.
- important (/ɛ̃pɔʁtɑ̃/): Âm mũi [ɛ̃] ở đầu và [ɑ̃] ở đuôi, chữ "t" cuối là âm câm.

Đánh giá câu:
- Điểm: 4.7/5.0 (Quy đổi DELF: 23.5/25)
- Huy hiệu: Xuất sắc (B1)
- Ngữ pháp: Cấu trúc lập luận chặt chẽ, liên từ chuẩn B1
- Từ vựng: Từ vựng trừu tượng và bày tỏ quan điểm sâu sắc`;
    }

    // 2.7 Lời chào & Giới thiệu bản thân (Greetings & Intro)
    if (/bonjour|salut|m'appelle|suis|enchant[eé]|bonsoir|coucou/i.test(lower)) {
      return `Bonjour ! Enchanté d'échanger avec vous en français. Dites-moi, quel sujet aimeriez-vous aborder aujourd'hui (vos goûts, vos études, vos loisirs ou vos voyages) ?

Nhận xét:
Lời chào và giới thiệu rất chuẩn xác, lịch sự và tự nhiên. Hãy sẵn sàng cho các câu hỏi tiếp theo để cùng luyện phản xạ giao tiếp nhé!

Phát âm & Ngữ âm:
- Bonjour (/bɔ̃ʒuʁ/): Âm mũi [ɔ̃] chu môi tròn nhỏ và âm rung họng [ʁ], không đọc thành "bông-dua".
- je m'appelle (/ʒə mapɛl/): Âm [ʒə] phát âm nhẹ, âm "e" cuối là âm câm.
- enchanté (/ɑ̃ʃɑ̃te/): Có 2 âm mũi [ɑ̃] mở rộng khẩu hình.

Đánh giá câu:
- Điểm: 4.2/5.0 (Quy đổi DELF: 21.0/25)
- Huy hiệu: Rất tốt (B1)
- Ngữ pháp: Chào hỏi và xưng hô tự nhiên, chính xác
- Từ vựng: Từ vựng giao tiếp mở đầu chuẩn CEFR`;
    }

    // 2.8 Phản hồi tổng quát tiếng Pháp (Trích xuất từ vựng thực tế trong câu của học viên)
    const rawWords = cleanText.split(/[\s,.'!?]+/).filter(w => w && w.length >= 3);
    const sampleWord1 = rawWords[0] || 'français';
    const sampleWord2 = rawWords[1] || 'expression';

    return `C'est une remarque très intéressante ! Votre expression est fluide et agréable. Pouvez-vous m'en dire un peu plus à ce sujet ?

Nhận xét:
Câu nói của bạn rất mạch lạc và diễn đạt đúng ý. Hãy tiếp tục duy trì nhịp điệu tự nhiên này và chú ý mở rộng thêm chi tiết để câu nói thêm phong phú.

Phát âm & Ngữ âm:
- ${sampleWord1} : Hãy chú ý phát âm rõ các nguyên âm và giữ đúng vị trí âm câm nếu có ở cuối từ.
- ${sampleWord2} : Giữ khẩu hình chuẩn xác và nối âm mượt mà với từ kế tiếp.

Đánh giá câu:
- Điểm: 4.1/5.0 (Quy đổi DELF: 20.5/25)
- Huy hiệu: Rất tốt (B1)
- Ngữ pháp: Cấu trúc câu ổn định, diễn đạt rõ ý
- Từ vựng: Phù hợp với ngữ cảnh hội thoại`;
  },

  // Dynamic Barem Evaluator for Simulation / Demo Mode
  _mockSpeakingEvaluation(userContent, isB1 = true) {
    const userMatches = userContent ? [...userContent.matchAll(/Học viên nói:\s*"([^"]+)"/g)].map(m => m[1]) : [];
    const fullUserText = userMatches.join(' ').trim();

    // Check for Vietnamese-specific characters (tones, horns, hooks, d-bar)
    // Note: French uses à, â, é, è, ê, ë, î, ï, ô, ù, û, ü, ç which are standard French vowels.
    const vietnamesePattern = /[ăắằẳẵặấầẩẫậếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúủũụứừửữựýỳỷỹỵđảãạẻẽẹỉĩịỏõọủũụỷỹỵ]/i;
    const vietnameseCommonWords = /\b(tôi|bạn|chúng\s*tôi|chúng\s*ta|anh|chị|không|có\s*thể|chỉnh|phát\s*âm|tiếng\s*việt|giúp|với|nhé|được|luyện\s*tập|xin\s*chào|cảm\s*ơn)\b/i;

    const isVietnamese = vietnamesePattern.test(fullUserText) || vietnameseCommonWords.test(fullUserText);
    const words = fullUserText ? fullUserText.split(/\s+/).filter(w => w.length > 0) : [];
    const wordCount = words.length;
    const turnCount = userMatches.length || 1;

    // Case 1: Spoke in Vietnamese / Non-French
    if (isVietnamese || wordCount === 0) {
      if (isB1) {
        return JSON.stringify({
          entretien_dirige: { level: 'B1', score: 0.0, max: 4, notes: 'Thí sinh nhập/nói bằng tiếng Việt ("' + (fullUserText.substring(0, 45) || 'trống') + '..."), không có phát ngôn tiếng Pháp để đánh giá.' },
          exercice_interaction: { level: 'B1', score: 0.0, max: 4, notes: 'Chưa thực hiện tương tác bằng tiếng Pháp.' },
          expression_point_de_vue: { level: 'B1', score: 0.0, max: 4, notes: 'Chưa trình bày quan điểm bằng tiếng Pháp.' },
          lexique: { level: 'B1', score: 0.0, max: 5, notes: 'Không có từ vựng tiếng Pháp nào được sử dụng.' },
          morphosyntaxe: { level: 'B1', score: 0.0, max: 4, notes: 'Không có cấu trúc ngữ pháp tiếng Pháp.' },
          phonologie: { level: 'B1', score: 0.0, max: 4, notes: 'Chưa phát âm tiếng Pháp.' },
          tong_diem: 0.0,
          overall_feedback: 'Không thể chấm điểm đạt chuẩn vì toàn bộ hội thoại được thực hiện bằng tiếng Việt ("' + (fullUserText.substring(0, 35) || '') + '"). Trong bài thi Nói DELF B1 chính thức, thí sinh bắt buộc phải nói hoàn toàn bằng tiếng Pháp.',
          frequent_errors: ['Nói tiếng Việt thay vì tiếng Pháp', 'Chưa hoàn thành các phần thi DELF']
        });
      } else {
        return JSON.stringify({
          lexique: { level: 'A2', score: 0.0, max: 5, notes: 'Chưa sử dụng từ vựng tiếng Pháp.' },
          morphosyntaxe: { level: 'A2', score: 0.0, max: 5, notes: 'Chưa có cấu trúc ngữ pháp tiếng Pháp.' },
          phonologie: { level: 'A2', score: 0.0, max: 5, notes: 'Chưa phát âm tiếng Pháp.' },
          tong_diem: 0.0,
          overall_feedback: 'Không thể chấm điểm vì bạn nói bằng tiếng Việt. Hãy chuyển sang nói bằng tiếng Pháp nhé!',
          frequent_errors: ['Sử dụng tiếng Việt thay vì tiếng Pháp']
        });
      }
    }

    // Case 2: Only 1 short sentence (< 12 French words)
    if (turnCount <= 1 || wordCount < 12) {
      if (isB1) {
        return JSON.stringify({
          entretien_dirige: { level: 'B1', score: 1.0, max: 4, notes: 'Chỉ có 1 câu ngắn ("' + fullUserText + '"), chưa đủ dung lượng để giới thiệu bản thân chi tiết theo chuẩn B1.' },
          exercice_interaction: { level: 'B1', score: 0.5, max: 4, notes: 'Chưa có tương tác trao đổi qua lại (mới có 1 lượt nói).' },
          expression_point_de_vue: { level: 'B1', score: 0.0, max: 4, notes: 'Chưa có phần thuyết trình bày tỏ quan điểm và lập luận B1.' },
          lexique: { level: 'B1', score: 1.0, max: 5, notes: 'Vốn từ quá ít trong phiên này (' + wordCount + ' từ).' },
          morphosyntaxe: { level: 'B1', score: 1.0, max: 4, notes: 'Cấu trúc câu đơn lẻ, chưa thể hiện được các thì và liên từ B1.' },
          phonologie: { level: 'B1', score: 1.0, max: 4, notes: 'Phát âm nhận diện được nhưng chưa đủ dữ liệu để đánh giá ngữ điệu.' },
          tong_diem: 4.5,
          overall_feedback: 'Dung lượng bài thi của bạn quá ngắn (chỉ 1 câu, ' + wordCount + ' từ). Để giám khảo chấm đúng chuẩn DELF B1, bạn cần duy trì cuộc trò chuyện tối thiểu 4-6 lượt nói với đầy đủ các phần thi.',
          frequent_errors: ['Dung lượng bài thi quá ngắn (< 15 từ)', 'Thiếu phần tương tác và thuyết trình quan điểm']
        });
      } else {
        return JSON.stringify({
          lexique: { level: 'A2', score: 1.5, max: 5, notes: 'Vốn từ quá ít (' + wordCount + ' từ).' },
          morphosyntaxe: { level: 'A2', score: 1.5, max: 5, notes: 'Chưa đủ cấu trúc câu.' },
          phonologie: { level: 'A2', score: 1.5, max: 5, notes: 'Phát âm cơ bản.' },
          tong_diem: 4.5,
          overall_feedback: 'Bạn cần nói nhiều câu hơn để được đánh giá đầy đủ.',
          frequent_errors: ['Dung lượng bài thi quá ngắn']
        });
      }
    }

    // Case 3: 2-3 short turns (12-35 words)
    if (turnCount <= 3 || wordCount < 35) {
      if (isB1) {
        return JSON.stringify({
          entretien_dirige: { level: 'B1', score: 2.0, max: 4, notes: 'Có nỗ lực giới thiệu nhưng còn ngắn, cần mở rộng chi tiết hơn.' },
          exercice_interaction: { level: 'B1', score: 1.5, max: 4, notes: 'Đã có phản xạ đối đáp nhưng chưa chủ động hỏi lại giám khảo.' },
          expression_point_de_vue: { level: 'B1', score: 1.0, max: 4, notes: 'Chưa nêu được luận điểm rõ ràng và ví dụ minh họa.' },
          lexique: { level: 'B1', score: 2.0, max: 5, notes: 'Từ vựng ở mức cơ bản, cần đa dạng hóa từ vựng chủ đề B1.' },
          morphosyntaxe: { level: 'B1', score: 2.0, max: 4, notes: 'Cần sử dụng thêm các thì quá khứ (passé composé/imparfait) và liên từ nối câu.' },
          phonologie: { level: 'B1', score: 2.0, max: 4, notes: 'Phát âm tương đối rõ, chú ý các âm mũi và nối âm.' },
          tong_diem: 10.5,
          overall_feedback: 'Bạn đã bắt đầu phản xạ tiếng Pháp tốt, nhưng dung lượng buổi luyện cần dài hơn và mở rộng câu trả lời để đạt chuẩn B1 (trên 15/25 điểm).',
          frequent_errors: ['Câu trả lời còn ngắn', 'Chưa sử dụng đa dạng các thì ngữ pháp B1']
        });
      } else {
        return JSON.stringify({
          lexique: { level: 'A2', score: 2.5, max: 5, notes: 'Từ vựng A2 cơ bản.' },
          morphosyntaxe: { level: 'A2', score: 2.5, max: 5, notes: 'Cấu trúc câu đơn giản.' },
          phonologie: { level: 'A2', score: 3.0, max: 5, notes: 'Phát âm rõ ràng.' },
          tong_diem: 8.0,
          overall_feedback: 'Khá tốt! Hãy tiếp tục luyện tập thêm các câu ghép.',
          frequent_errors: ['Cần mở rộng câu dài hơn']
        });
      }
    }

    // Case 4: Full active French conversation (>= 4 turns, >= 35 words)
    if (isB1) {
      return JSON.stringify({
        entretien_dirige: { level: 'B1', score: 3.0, max: 4, notes: 'Thí sinh giới thiệu bản thân tự tin, truyền đạt thông tin cá nhân mạch lạc.' },
        exercice_interaction: { level: 'B1', score: 3.0, max: 4, notes: 'Phản xạ tương tác tự nhiên, biết cách duy trì luồng hội thoại.' },
        expression_point_de_vue: { level: 'B1', score: 2.5, max: 4, notes: 'Đã trình bày được quan điểm cá nhân, có giải thích lý do.' },
        lexique: { level: 'B1', score: 3.5, max: 5, notes: 'Vốn từ vựng tương đối phong phú cho các chủ đề thường nhật B1.' },
        morphosyntaxe: { level: 'B1', score: 3.0, max: 4, notes: 'Sử dụng tốt các thì cơ bản, chú ý phân biệt rõ Passé composé và Imparfait.' },
        phonologie: { level: 'B1', score: 3.0, max: 4, notes: 'Phát âm rõ ràng, ngữ điệu tự nhiên, chú ý thêm nối âm liaisons.' },
        tong_diem: 18.0,
        overall_feedback: 'Buổi luyện tập rất hiệu quả! Bạn có phản xạ giao tiếp tự nhiên và vốn từ B1 vững. Hãy rèn luyện thêm sự phối hợp giữa Passé composé và Imparfait trong các câu chuyện kể.',
        frequent_errors: ['Chia thì Passé Composé vs Imparfait', 'Giống của danh từ (le/la)']
      });
    } else {
      return JSON.stringify({
        lexique: { level: 'A2', score: 4.0, max: 5, notes: 'Vốn từ vựng A2 rất tốt.' },
        morphosyntaxe: { level: 'A2', score: 3.5, max: 5, notes: 'Ngữ pháp chắc chắn.' },
        phonologie: { level: 'A2', score: 4.0, max: 5, notes: 'Phát âm rõ và chuẩn.' },
        tong_diem: 11.5,
        overall_feedback: 'Rất xuất sắc! Bạn đã sẵn sàng để nâng lên mục tiêu B1.',
        frequent_errors: ['Chú ý mạo từ rút gọn']
      });
    }
  },

  _mockReadingExercise(systemPrompt) {
    // 1. Check if seed text was provided inside systemPrompt
    const seedMatch = systemPrompt.match(/"""\s*([\s\S]+?)\s*"""/);
    if (seedMatch && seedMatch[1] && seedMatch[1].trim()) {
      const originalText = seedMatch[1].trim();
      const sentences = originalText.split(/(?<=[.!?])\s+/).filter(s => s && s.length > 10);

      // Derive title & topic based on text content
      let title = 'Texte de compréhension authentique';
      let topic = 'Báo chí & Đời sống Pháp';

      if (originalText.includes('écologique') || originalText.includes('transport') || originalText.includes('pollution') || originalText.includes('cyclable')) {
        title = 'La transition écologique dans les transports';
        topic = 'Môi trường & Đô thị';
      } else if (originalText.includes('télétravail') || originalText.includes('travail') || originalText.includes('salariés') || originalText.includes('entreprise')) {
        title = 'Le télétravail et l\'équilibre de vie';
        topic = 'Công việc & Xã hội';
      } else if (originalText.includes('étranger') || originalText.includes('voyage') || originalText.includes('expatriation') || originalText.includes('étudiants')) {
        title = 'Partir vivre et étudier à l\'étranger';
        topic = 'Du lịch & Định cư';
      } else if (originalText.includes('Musique') || originalText.includes('fête') || originalText.includes('musiciens')) {
        title = 'La Fête de la Musique en France';
        topic = 'Văn hóa & Lễ hội';
      } else {
        const firstSentence = sentences[0] || originalText;
        const firstWords = firstSentence.split(/\s+/).slice(0, 6).join(' ');
        title = firstWords ? (firstWords + '...') : 'Article d\'actualité francophone';
      }

      const q1Sentence = sentences[0] || originalText;
      const q2Sentence = sentences[Math.floor(sentences.length / 2)] || sentences[0] || originalText;
      const q3Sentence = sentences[sentences.length - 1] || sentences[0] || originalText;

      return JSON.stringify({
        title,
        topic,
        passage: originalText,
        questions: [
          {
            id: 1,
            question: 'D\'après le début du document, quelle est l\'information essentielle ?',
            options: [
              q1Sentence.length > 80 ? q1Sentence.substring(0, 76) + '...' : q1Sentence,
              'Ce phénomène ne concerne aucun citoyen ni aucune entreprise.',
              'Il s\'agit d\'une réglementation temporaire valable uniquement pour une journée.',
              'Toutes les personnes ont refusé de participer à ce projet.'
            ],
            correct_index: 0,
            explanation: `Dẫn chứng trực tiếp từ bài viết: "${q1Sentence.length > 95 ? q1Sentence.substring(0, 90) + '...' : q1Sentence}".`
          },
          {
            id: 2,
            question: 'Concernant le déroulement et les faits mentionnés dans le texte :',
            options: [
              'Toutes les décisions ont été prises sans consultation préalable.',
              q2Sentence.length > 80 ? q2Sentence.substring(0, 76) + '...' : q2Sentence,
              'Le sujet a été complètement abandonné par les autorités.',
              'Les participants n\'ont exprimé aucun avis sur la question.'
            ],
            correct_index: 1,
            explanation: `Chi tiết được nêu rõ trong bài đọc: "${q2Sentence.length > 95 ? q2Sentence.substring(0, 90) + '...' : q2Sentence}".`
          },
          {
            id: 3,
            question: 'Que peut-on retenir en conclusion de ce document ?',
            options: [
              'Il n\'y a aucune perspective d\'avenir pour cette situation.',
              'Les experts recommandent de cesser toute activité immédiatement.',
              q3Sentence.length > 80 ? q3Sentence.substring(0, 76) + '...' : q3Sentence,
              'La situation reste inchangée depuis plus de cinquante ans.'
            ],
            correct_index: 2,
            explanation: `Phần kết luận bài báo nhấn mạnh: "${q3Sentence.length > 95 ? q3Sentence.substring(0, 90) + '...' : q3Sentence}".`
          }
        ]
      });
    }

    // Default varied reading passages when no seed was selected
    const fallbackPresets = [
      {
        title: 'La gastronomie française et les marchés locaux',
        topic: 'Văn hóa & Đời sống ẩm thực',
        passage: 'En France, faire le marché le dimanche matin est une véritable tradition pour de nombreuses familles. C\'est l\'occasion d\'acheter des produits frais et de saison, comme des fromages régionaux, des fruits et des légumes bio. Au-delà des courses, le marché est un lieu de rencontre convivial où les habitants discutent chaleureusement avec les producteurs locaux.',
        questions: [
          {
            id: 1,
            question: 'Quand beaucoup de familles françaises vont-elles au marché ?',
            options: ['Le dimanche matin.', 'Le lundi soir.', 'Uniquement pendant les vacances d\'été.', 'À minuit.'],
            correct_index: 0,
            explanation: 'Đoạn đầu nêu rõ: "faire le marché le dimanche matin est une véritable tradition".'
          },
          {
            id: 2,
            question: 'Quels types de produits peut-on y trouver ?',
            options: ['Uniquement des vêtements de luxe.', 'Des produits frais, de saison et des fromages régionaux.', 'Des appareils électroniques.', 'Des meubles de maison.'],
            correct_index: 1,
            explanation: 'Trong bài có: "acheter des produits frais et de saison, comme des fromages régionaux, des fruits et des légumes bio".'
          },
          {
            id: 3,
            question: 'Pourquoi le marché est-il plus qu\'un simple lieu de courses ?',
            options: ['Parce que tout est gratuit.', 'Parce que c\'est un lieu de rencontre convivial avec les producteurs.', 'Parce qu\'il remplace les écoles.', 'Parce qu\'on y fait du sport.'],
            correct_index: 1,
            explanation: 'Tác giả viết: "le marché est un lieu de rencontre convivial où les habitants discutent avec les producteurs locaux".'
          }
        ]
      },
      {
        title: 'Voyager en train en France : le réseau ferroviaire TGV',
        topic: 'Giao thông & Du lịch bền vững',
        passage: 'Le train reste l\'un des moyens de transport les plus populaires et écologiques en France. Grâce au réseau TGV, il est possible de relier Paris à Marseille ou Bordeaux en quelques heures seulement. De plus en plus de voyageurs choisissent le rail pour limiter leur empreinte carbone tout en profitant confortablement du paysage.',
        questions: [
          {
            id: 1,
            question: 'Quel est l\'un des principaux atouts du TGV ?',
            options: ['Relier de grandes villes en seulement quelques heures.', 'Être gratuit pour tout le monde.', 'Ne circuler que la nuit.', 'Remplacer totalement les avions dans le monde entier.'],
            correct_index: 0,
            explanation: 'Bài viết chỉ ra: "relier Paris à Marseille ou Bordeaux en quelques heures seulement".'
          },
          {
            id: 2,
            question: 'Pourquoi les voyageurs privilégient-ils le train ?',
            options: ['Parce que les routes sont interdites.', 'Pour limiter leur empreinte carbone et admirer le paysage.', 'Parce que les trains sont toujours vides.', 'Pour faire du shopping.'],
            correct_index: 1,
            explanation: 'Trong bài có: "pour limiter leur empreinte carbone tout en profitant du paysage".'
          },
          {
            id: 3,
            question: 'Comment le train est-il qualifié sur le plan environnemental ?',
            options: ['Très polluant.', 'Écologique.', 'Dangereux.', 'Obsolète.'],
            correct_index: 1,
            explanation: 'Bài đọc nêu: "l\'un des moyens de transport les plus populaires et écologiques en France".'
          }
        ]
      }
    ];

    return JSON.stringify(fallbackPresets[Math.floor(Math.random() * fallbackPresets.length)]);
  },

  _mockListeningExercise(systemPrompt) {
    // 1. Check if seed text was provided inside systemPrompt
    const seedMatch = systemPrompt.match(/"""\s*([\s\S]+?)\s*"""/);
    if (seedMatch && seedMatch[1] && seedMatch[1].trim()) {
      const originalText = seedMatch[1].trim();
      const sentences = originalText.split(/(?<=[.!?])\s+/).filter(s => s && s.length > 10);

      let title = 'Document audio et compréhension orale';
      let topic = 'Bản tin / Phóng sự thực tế';

      if (originalText.includes('écologique') || originalText.includes('transport') || originalText.includes('pollution')) {
        title = 'RFI - La transition écologique dans les transports';
        topic = 'Môi trường & Đô thị';
      } else if (originalText.includes('télétravail') || originalText.includes('travail') || originalText.includes('salariés')) {
        title = 'TV5MONDE - Le télétravail et l\'équilibre de vie';
        topic = 'Công việc & Xã hội';
      } else if (originalText.includes('étranger') || originalText.includes('voyage') || originalText.includes('expatriation')) {
        title = 'France Éducation International - Partir vivre à l\'étranger';
        topic = 'Du lịch & Định cư';
      } else if (originalText.includes('Musique') || originalText.includes('culture') || originalText.includes('fête')) {
        title = 'RFI - La Fête de la Musique en France';
        topic = 'Văn hóa & Lễ hội';
      } else {
        const firstSentence = sentences[0] || originalText;
        const firstWords = firstSentence.split(/\s+/).slice(0, 6).join(' ');
        title = firstWords ? (firstWords + '...') : 'Chronique audio francophone';
      }

      const q1Sentence = sentences[0] || originalText;
      const q2Sentence = sentences[Math.floor(sentences.length / 2)] || sentences[0] || originalText;
      const q3Sentence = sentences[sentences.length - 1] || sentences[0] || originalText;

      return JSON.stringify({
        title,
        topic,
        passage: originalText,
        questions: [
          {
            id: 1,
            question: 'Quelle information principale est annoncée au début de l\'enregistrement ?',
            options: [
              q1Sentence.length > 80 ? q1Sentence.substring(0, 76) + '...' : q1Sentence,
              'Une tempête de neige bloque tout le pays et les transports.',
              'Un concert annulé pour des raisons de sécurité publique.',
              'La fermeture complète et définitive des gares et aéroports.'
            ],
            correct_index: 0,
            explanation: `Dẫn chứng từ câu mở đầu bản tin: "${q1Sentence.length > 95 ? q1Sentence.substring(0, 90) + '...' : q1Sentence}".`
          },
          {
            id: 2,
            question: 'Selon les propos entendus dans ce document audio :',
            options: [
              'Tous les intervenants ont refusé de s\'exprimer au micro.',
              q2Sentence.length > 80 ? q2Sentence.substring(0, 76) + '...' : q2Sentence,
              'Le projet ne commencera que dans cinquante ans.',
              'Il n\'y a aucun impact perceptible sur la vie quotidienne.'
            ],
            correct_index: 1,
            explanation: `Chi tiết trong đoạn phát thanh: "${q2Sentence.length > 95 ? q2Sentence.substring(0, 90) + '...' : q2Sentence}".`
          },
          {
            id: 3,
            question: 'Que retient-on pour conclure cette écoute ?',
            options: [
              'Le journaliste n\'a pas pu terminer son reportage sur le terrain.',
              'L\'événement a été complètement oublié dès le lendemain.',
              q3Sentence.length > 80 ? q3Sentence.substring(0, 76) + '...' : q3Sentence,
              'Aucune solution nouvelle n\'est envisagée pour l\'avenir.'
            ],
            correct_index: 2,
            explanation: `Phần kết luận của bài nghe: "${q3Sentence.length > 95 ? q3Sentence.substring(0, 90) + '...' : q3Sentence}".`
          }
        ]
      });
    }

    // Default listening preset
    return JSON.stringify({
      title: 'Une invitation au restaurant entre collègues',
      topic: 'Đời sống & Ẩm thực',
      passage: 'Bonjour Sophie ! Ce soir, avec quelques collègues du bureau, nous allons dîner dans un nouveau restaurant italien près de la gare. Nous avons réservé une table pour vingt heures. Est-ce que tu es libre pour venir avec nous ? Fais-moi savoir avant seize heures pour que je confirme le nombre de personnes.',
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
          question: 'À quelle heure est prévue la réservation ?',
          options: ['18h00', '19h00', '20h00', '21h00'],
          correct_index: 2,
          explanation: 'Người nói thông báo: "Nous avons réservé une table pour vingt heures" (20h00).'
        },
        {
          id: 3,
          question: 'Avant quelle heure Sophie doit-elle confirmer sa présence ?',
          options: ['12h00', '15h00', '16h00', '19h00'],
          correct_index: 2,
          explanation: 'Người nói dặn: "Fais-moi savoir avant seize heures" (trước 16h00).'
        }
      ]
    });
  },

  _mockDiagnosticAndSolutions(systemPrompt = '') {
    const isB1 = systemPrompt.includes('DELF B1');

    if (isB1) {
      return JSON.stringify({
        summary: 'Bạn đã có nền tảng từ vựng tương đối tốt và phản xạ nhận diện ý chính khá nhanh. Tuy nhiên, trong giao tiếp Nói và Đọc hiểu nâng cao, bạn thường gặp 2 điểm nghẽn: phân vân giữa Passé Composé & Imparfait khi kể chuyện và phát âm chưa rõ các nguyên âm mũi [ɑ̃] - [ɔ̃].',
        primary_weakness: 'Phối hợp thì Quá khứ & Chuẩn hóa Khẩu hình Âm mũi',
        bottlenecks: [
          'Phân biệt Passé Composé & Imparfait',
          'Khẩu hình 3 âm mũi [ɑ̃], [ɔ̃], [ɛ̃]',
          'Sử dụng liên từ B1 (Cependant, En revanche)'
        ],
        top_errors: [
          {
            category: 'Ngữ pháp',
            title: 'Nhầm lẫn Passé Composé (Hành động dứt điểm) vs Imparfait (Bối cảnh/Thói quen)',
            severity: 'Nghiêm trọng (Critical B1)',
            frequency_text: 'Xuất hiện trong 75% các bài nói kể chuyện',
            wrong_example: 'Quand j\'étais jeune, j\'ai habité à Paris pendant que j\'ai étudié.',
            correct_example: 'Quand j\'étais jeune, j\'habitais à Paris pendant que j\'étudiais.',
            explanation: 'Miêu tả trạng thái kéo dài, bối cảnh hoặc thói quen trong quá khứ bắt buộc dùng Imparfait (-ais, -ait, -ions...). Chỉ dùng Passé composé cho biến cố xảy ra bất ngờ ngắt ngang hành động khác.',
            action_solution: 'Quy tắc "Khung cảnh vs Sự kiện": Tự hỏi "Hành động này là bức tranh nền (Imparfait) hay là sự kiện đột ngột (Passé composé)?".',
            practice_action: 'speaking'
          },
          {
            category: 'Ngữ pháp',
            title: 'Trợ động từ ÊTRE và quy tắc hợp giống số của Phân từ quá khứ',
            severity: 'Nghiêm trọng (Critical B1)',
            frequency_text: 'Rất hay quên khi chủ ngữ là giống cái hoặc số nhiều',
            wrong_example: 'Elle a allé au cinéma hier soir.',
            correct_example: 'Elle est allée au cinéma hier soir.',
            explanation: '14 động từ chuyển động trong "Ngôi nhà Être" (aller, venir, partir, monter...) và động từ phản thân bắt buộc đi với ÊTRE và phải hợp giống/số (thêm -e cho nữ, thêm -s cho số nhiều).',
            action_solution: 'Thuộc thần chú DR MRS VANDERTRAMP. Mỗi khi nói "Elle est...", luôn nhớ trong đầu có âm đuôi hợp giống cái.',
            practice_action: 'speaking'
          },
          {
            category: 'Phát âm & Ngữ âm',
            title: 'Lẫn lộn các nguyên âm mũi [ɑ̃] (an/en), [ɔ̃] (on), [ɛ̃] (in/ain)',
            severity: 'Trung bình (B1 Requirement)',
            frequency_text: 'Người bản xứ dễ nghe nhầm sang từ khác',
            wrong_example: 'Phát âm "vent" (/vɑ̃/) giống hệt "vin" (/vɛ̃/) hoặc "vont" (/vɔ̃/).',
            correct_example: 'vent (/vɑ̃/ - mở hàm rộng), vin (/vɛ̃/ - bè môi cười), vont (/vɔ̃/ - chu môi tròn nhỏ).',
            explanation: 'Tiếng Pháp có 3 âm mũi cốt lõi. Khẩu hình miệng sai sẽ đổi nghĩa của từ hoàn toàn (vent = gió, vin = rượu, vont = đi).',
            action_solution: 'Luyện tập mỗi ngày 3 phút với gương: [ɑ̃] há miệng dọc, [ɛ̃] bè ngang cười, [ɔ̃] tròn môi như huýt sáo.',
            practice_action: 'phonetics'
          },
          {
            category: 'Từ vựng & Diễn đạt',
            title: 'Thiếu liên từ nối ý B1 (Connecteurs logiques)',
            severity: 'Trung bình (B1 Requirement)',
            frequency_text: 'Câu bị rời rạc, điểm tiêu chí B1 không cao',
            wrong_example: 'J\'aime voyager. C\'est cher. Je n\'y vais pas souvent.',
            correct_example: 'J\'aime beaucoup voyager, cependant c\'est assez coûteux ; par conséquent, je n\'y vais que rarement.',
            explanation: 'Trong bài thi DELF B1, giám khảo yêu cầu các câu phức có liên từ nối: quan hệ đối lập (cependant, pourtant), nguyên nhân - kết quả (en effet, par conséquent, car), bổ sung (de plus, en outre).',
            action_solution: 'Chọn sẵn 4 "liên từ tủ": Cependant (tuy nhiên), De plus (hơn nữa), En effet (thật vậy), Par conséquent (do đó) và luôn chèn vào mỗi lượt nói.',
            practice_action: 'speaking'
          }
        ],
        study_roadmap: [
          'Tuần 1 (Ngữ pháp): Nắm chắc 14 động từ chia với ÊTRE và làm 5 câu kể chuyện phân biệt Passé composé vs Imparfait.',
          'Tuần 2 (Ngữ âm): Vào "Xưởng Ngữ Âm" luyện 10 cặp từ đối lập âm mũi [ɑ̃] / [ɔ̃] / [ɛ̃] với công cụ nhận diện giọng nói.',
          'Tuần 3 (Diễn đạt B1): Thực hành bài thi Nói với chủ đề xã hội, cam kết sử dụng tối thiểu 3 liên từ nối ý (cependant, de plus, par conséquent).'
        ]
      });
    } else {
      return JSON.stringify({
        summary: 'Bạn đang tiến bộ tốt ở các cấu trúc câu giao tiếp thường nhật cơ bản. Điểm cần tập trung nhất là mạo từ (le/la/les/un/une/des) và chia động từ nhóm 1 ở thì Hiện tại (Présent).',
        primary_weakness: 'Mạo từ giống đực/cái & Chia động từ nhóm 1',
        top_errors: [
          {
            category: 'Ngữ pháp',
            title: 'Nhầm lẫn giống Đực (Masculin) và giống Cái (Féminin)',
            severity: 'Trung bình (A1-A2 Foundation)',
            frequency_text: 'Dễ nhầm mạo từ un/une, le/la',
            wrong_example: 'Le table, la problème.',
            correct_example: 'La table (giống cái), le problème (giống đực).',
            explanation: 'Trong tiếng Pháp, danh từ tận cùng bằng "-tion, -té, -ette, -ance" thường là giống cái; "-isme, -ment, -age, -ème" thường là giống đực.',
            action_solution: 'Luôn học từ mới kèm mạo từ: không học "table", hãy học "une table"; không học "soleil", hãy học "le soleil".',
            practice_action: 'speaking'
          },
          {
            category: 'Phát âm & Ngữ âm',
            title: 'Phát âm phụ âm câm ở cuối từ (E, S, T, D, P)',
            severity: 'Trung bình (A1-A2 Foundation)',
            frequency_text: 'Thói quen đọc hết mọi chữ cái',
            wrong_example: 'Đọc rõ âm "s" trong "les", "t" trong "parfait", "e" trong "parle".',
            correct_example: 'Hầu hết phụ âm cuối trong tiếng Pháp là âm câm (trừ C, R, F, L - thần chú CaReFuL).',
            explanation: 'Quy tắc C-R-F-L (Careful): Các phụ âm C, R, F, L ở cuối từ thường được phát âm; còn lại S, T, D, P, X, Z hầu hết là câm.',
            action_solution: 'Nhớ thần chú "CaReFuL": Thấy C, R, F, L thì đọc, thấy S, T, D thì nuốt âm.',
            practice_action: 'phonetics'
          }
        ],
        study_roadmap: [
          'Bước 1: Học từ mới luôn gắn liền với "un/une" hoặc "le/la".',
          'Bước 2: Luyện phát âm phụ âm câm theo quy tắc CaReFuL.',
          'Bước 3: Thực hành 3 bài hội thoại chào hỏi và giới thiệu bản thân hằng ngày.'
        ]
      });
    }
  }
};

window.AIService = AIService;
