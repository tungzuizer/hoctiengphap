// Vercel Serverless Function: POST /api/ai
// Handles secure AI proxy without leaking API Key to frontend

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    if (!body && req.on) {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
        });
      });
    }

    const { systemPrompt, messages = [], temperature = 0.7, jsonMode = false, model, profileConfig } = body || {};

    const OMNIROUTE_BASE_URL = (process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || 'sk-f3574d44ab943de1-3dc839-53b3b863';
    const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'antigravity/gemini-3.7-flash-tiered';

    const targetBaseUrl = (profileConfig?.baseUrl || OMNIROUTE_BASE_URL).replace(/\/+$/, '');
    const targetApiKey = profileConfig?.apiKey?.trim() || OMNIROUTE_API_KEY;
    const targetModel = model || profileConfig?.model || DEFAULT_MODEL;

    if (!targetApiKey) {
      return res.status(400).json({
        error: 'Chưa cấu hình OMNIROUTE_API_KEY trên Vercel Environment Variables.'
      });
    }

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

    const payload = {
      model: targetModel,
      messages: formattedMessages,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      max_tokens: 2500
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const endpoint = `${targetBaseUrl}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${targetApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return res.status(200).json({
        success: true,
        content,
        model: data.model || targetModel
      });
    } else {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `OmniRoute Gateway Error (${response.status}): ${errText}`
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: `Lỗi kết nối tới OmniRoute Gateway: ${err.message}`
    });
  }
};
