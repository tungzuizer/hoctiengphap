// 1. Importers/Callers: Node.js runtime (node server.js / npm start), browser clients
// 2. Affected API: HTTP Server, Static File Server, Secure OmniRoute AI Proxy (/api/ai, /api/health)
// 3. Data Schemas: POST /api/ai -> { systemPrompt, messages, temperature, jsonMode, model }
// 4. User's Verbatim Instruction: "tôi dùng api của omniroute và bạn không được để nó ở fontend và api omniroute của tôi http://localhost:20128/v1 sk-f3574d44ab943de1-3dc839-53b3b863"

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 1. Simple zero-dependency .env loader
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          // Strip surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('[Server] Không thể đọc file .env:', e.message);
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const OMNIROUTE_BASE_URL = (process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || '';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'antigravity/gemini-3.7-flash-tiered';

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

// Helper: send JSON response with CORS headers
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

// 2. Main HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // API Route: Health & Proxy Status Check (Safe: never leaks API key)
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      proxyEnabled: true,
      hasServerKey: Boolean(OMNIROUTE_API_KEY),
      baseUrl: OMNIROUTE_BASE_URL,
      defaultModel: DEFAULT_MODEL,
      version: '2.0.0'
    });
  }

  // API Route: Secure AI Completion Proxy (Protects API Key on Server)
  if (pathname === '/api/ai' && req.method === 'POST') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      // Prevent flood (max 5MB)
      if (bodyData.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyData || '{}');
        const { systemPrompt, messages = [], temperature = 0.7, jsonMode = false, model, profileConfig } = body;

        // Resolve credentials (server-side priority or fallback)
        const targetBaseUrl = (profileConfig?.baseUrl && !profileConfig.baseUrl.includes('localhost') ? profileConfig.baseUrl : OMNIROUTE_BASE_URL).replace(/\/+$/, '');
        const targetApiKey = profileConfig?.apiKey?.trim() || OMNIROUTE_API_KEY;
        let targetModel = model || profileConfig?.model || DEFAULT_MODEL;

        // If target is Google Gemini endpoint, ensure model is compatible with Google AI Studio
        if (targetBaseUrl.includes('googleapis.com')) {
          if (targetModel.includes('antigravity') || targetModel.includes('claude') || targetModel.includes('gpt-') || targetModel.includes('2.0-flash') || targetModel.includes('2.5-flash')) {
            targetModel = (DEFAULT_MODEL && !DEFAULT_MODEL.includes('antigravity') && !DEFAULT_MODEL.includes('claude')) ? DEFAULT_MODEL : 'gemini-3.5-flash';
          }
        }

        if (!targetApiKey) {
          return sendJson(res, 400, {
            error: 'Chưa cấu hình OMNIROUTE_API_KEY trong file .env trên server hoặc trong hồ sơ.'
          });
        }

        // Format messages for OpenAI-compatible endpoint
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

        const payloadStr = JSON.stringify(payload);
        const endpointUrl = `${targetBaseUrl}/chat/completions`;
        const parsedEndpoint = url.parse(endpointUrl);
        const isHttps = parsedEndpoint.protocol === 'https:';
        const client = isHttps ? https : http;

        const proxyReq = client.request({
          hostname: parsedEndpoint.hostname,
          port: parsedEndpoint.port || (isHttps ? 443 : 80),
          path: parsedEndpoint.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${targetApiKey}`,
            'Content-Length': Buffer.byteLength(payloadStr)
          },
          timeout: 45000
        }, (proxyRes) => {
          let responseData = '';
          proxyRes.on('data', c => responseData += c);
          proxyRes.on('end', () => {
            if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
              try {
                const parsedJson = JSON.parse(responseData);
                const replyContent = parsedJson.choices?.[0]?.message?.content || '';
                return sendJson(res, 200, {
                  success: true,
                  content: replyContent,
                  model: parsedJson.model || targetModel
                });
              } catch (parseErr) {
                return sendJson(res, 200, {
                  success: true,
                  content: responseData,
                  model: targetModel
                });
              }
            } else {
              console.error('[Proxy Error]', proxyRes.statusCode, responseData);
              return sendJson(res, proxyRes.statusCode || 500, {
                error: `OmniRoute Error (${proxyRes.statusCode}): ${responseData}`
              });
            }
          });
        });

        proxyReq.on('error', (err) => {
          console.error('[Proxy Network Error]', err.message);
          return sendJson(res, 502, {
            error: `Không thể kết nối đến OmniRoute gateway (${targetBaseUrl}): ${err.message}`
          });
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          return sendJson(res, 504, {
            error: 'Hết thời gian chờ phản hồi từ OmniRoute gateway (Timeout 45s).'
          });
        });

        proxyReq.write(payloadStr);
        proxyReq.end();
      } catch (err) {
        return sendJson(res, 400, {
          error: `Dữ liệu yêu cầu không hợp lệ: ${err.message}`
        });
      }
    });
    return;
  }

  // 3. Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security check: prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If requested path doesn't exist, fallback to 404
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });

    const readStream = fs.createReadStream(normalizedPath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🇫🇷 Français DELF Studio v2.0 is running!`);
  console.log(`  🌐 Local URL:       http://localhost:${PORT}`);
  console.log(`  🛡️ OmniRoute Proxy: ${OMNIROUTE_BASE_URL}`);
  console.log(`  🔑 Server API Key:  ${OMNIROUTE_API_KEY ? 'Đã kích hoạt bảo mật (Ẩn khỏi Frontend)' : 'Chưa thiết lập'}`);
  console.log(`  🤖 Default Model:   ${DEFAULT_MODEL}`);
  console.log(`======================================================\n`);
});
