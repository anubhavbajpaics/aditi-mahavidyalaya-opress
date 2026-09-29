import { redis } from '../lib/redis.js';
import { K } from '../lib/keys.js';
import crypto from 'crypto';

const MAX_ATTEMPTS = 8;
const LOCK_SECONDS = 60 * 15; // 15 min

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  try {
    const real = process.env.ADMIN_PASSWORD;
    if (!real) {
      return res.status(500).json({ error: 'ADMIN_PASSWORD not set on server' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const password = (body && body.password) || '';

    const ip = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0].trim() || 'unknown';
    const failKey = K.loginFail(ip);

    let fails = 0;
    try { fails = (await redis.get(failKey)) || 0; } catch { fails = 0; }

    if (fails >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: 'too_many_attempts',
        retryInSeconds: LOCK_SECONDS
      });
    }

    if (!password || !safeEqual(password, real)) {
      try { await redis.set(failKey, fails + 1, { ex: LOCK_SECONDS }); } catch {}
      return res.status(401).json({ error: 'wrong password' });
    }

    try { await redis.del(failKey); } catch {}

    const token = crypto.randomBytes(24).toString('hex');
    await redis.set(K.session(token), true, { ex: 60 * 60 * 12 });

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}