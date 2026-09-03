// Vercel Serverless Function: GET /api/health

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const OMNIROUTE_BASE_URL = (process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
  const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || 'sk-f3574d44ab943de1-3dc839-53b3b863';
  const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'antigravity/gemini-3.7-flash-tiered';

  return res.status(200).json({
    status: 'ok',
    proxyEnabled: true,
    hasServerKey: Boolean(OMNIROUTE_API_KEY),
    baseUrl: OMNIROUTE_BASE_URL,
    defaultModel: DEFAULT_MODEL,
    platform: 'vercel-serverless',
    version: '2.0.0'
  });
};
