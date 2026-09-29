import { redis } from './redis.js';
import { K } from './keys.js';

export async function isValidSession(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const token = m[1].trim();
  if (!token) return false;
  try {
    const ok = await redis.get(K.session(token));
    return !!ok;
  } catch {
    return false;
  }
}