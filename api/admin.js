const { redis, send, readBody, ip, limited, makeToken, isAdmin, cookieHeader, safeEqual, SESSION_SEC } = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'ADMIN_PASSWORD nu e setata pe server.' });

    if (req.method === 'GET') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Neautorizat.' });
      const flat = (await redis('HGETALL', 'messages')) || [];
      const list = [];
      for (let i = 1; i < flat.length; i += 2) { try { list.push(JSON.parse(flat[i])); } catch {} }
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return send(res, 200, { messages: list });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Metoda nepermisa.' });
    const b = await readBody(req);

    if (b.action === 'login') {
      if (await limited(`rl:login:${ip(req)}`, 8, 900)) return send(res, 429, { error: 'Prea multe incercari. Revino peste 15 minute.' });
      if (!safeEqual(b.password ?? '', process.env.ADMIN_PASSWORD)) return send(res, 401, { error: 'Parola gresita.' });
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(makeToken(), SESSION_SEC) });
    }
    if (b.action === 'logout') return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0) });

    if (!isAdmin(req)) return send(res, 401, { error: 'Neautorizat.' });
    const id = String(b.id || '');
    if (!/^[a-z0-9]{6,32}$/.test(id)) return send(res, 400, { error: 'ID invalid.' });

    if (b.action === 'delete') { await redis('HDEL', 'messages', id); return send(res, 200, { ok: true }); }
    if (b.action === 'read' || b.action === 'unread') {
      const raw = await redis('HGET', 'messages', id);
      if (!raw) return send(res, 404, { error: 'Mesajul nu mai exista.' });
      const m = JSON.parse(raw); m.read = b.action === 'read';
      await redis('HSET', 'messages', id, JSON.stringify(m));
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { error: 'Actiune necunoscuta.' });
  } catch (e) {
    console.error('admin:', e.message);
    return send(res, 500, { error: 'Eroare de server.' });
  }
};
