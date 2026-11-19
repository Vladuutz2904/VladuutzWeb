// Utilitare comune pentru functiile serverless (fisierele cu _ nu devin rute in Vercel).
const crypto = require('crypto');

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(...cmd) {
  const url = REDIS_URL(), token = REDIS_TOKEN();
  if (!url || !token) throw new Error('Redis neconfigurat (lipsesc variabilele de mediu).');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) {
    for await (const chunk of req) { raw += chunk; if (raw.length > 20000) break; }
  }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();

// limita simpla pe IP: maxim `max` cereri / `windowSec` secunde
async function limited(key, max, windowSec) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, String(windowSec));
  return n > max;
}

// ---- sesiune admin: cookie semnat HMAC, fara stocare pe server ----
const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const SESSION_SEC = 60 * 60 * 12;

function makeToken() {
  const p = String(Date.now() + SESSION_SEC * 1000);
  return `${p}.${sign(p)}`;
}
function validToken(tok) {
  if (!tok || !secret()) return false;
  const [p, sig] = String(tok).split('.');
  if (!p || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(p));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(p) > Date.now();
}
function cookieOf(req) {
  const m = /(?:^|;\s*)adm=([^;]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
const isAdmin = (req) => validToken(cookieOf(req));
const cookieHeader = (val, maxAge) => `adm=${val}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = { redis, send, readBody, ip, limited, makeToken, isAdmin, cookieHeader, safeEqual, SESSION_SEC };
