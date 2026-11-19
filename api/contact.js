const crypto = require('crypto');
const { redis, send, readBody, ip, limited } = require('./_lib');

const TYPES = ['Site de prezentare', 'Panou de administrare', 'Sistem de licentiere', 'Logo / identitate vizuala', 'Altceva'];
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metoda nepermisa.' });
  try {
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true }); // honeypot: boturile completeaza campul ascuns

    const name = clean(b.name, 80), email = clean(b.email, 120), type = clean(b.type, 60), message = clean(b.message, 2000);
    if (name.length < 2) return send(res, 400, { error: 'Scrie-ti numele.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'Emailul nu pare valid.' });
    if (!TYPES.includes(type)) return send(res, 400, { error: 'Alege ce site vrei.' });
    if (message.length < 5) return send(res, 400, { error: 'Scrie un comentariu scurt.' });

    if (await limited(`rl:contact:${ip(req)}`, 5, 600)) return send(res, 429, { error: 'Prea multe mesaje. Incearca peste cateva minute.' });

    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const msg = { id, name, email, type, message, createdAt: new Date().toISOString(), read: false };
    await redis('HSET', 'messages', id, JSON.stringify(msg));
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('contact:', e.message);
    return send(res, 500, { error: 'Nu am putut salva mesajul. Incearca din nou.' });
  }
};
