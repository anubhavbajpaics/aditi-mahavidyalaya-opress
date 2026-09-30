import { redis } from '../lib/redis.js';
import { isValidSession } from '../lib/auth.js';
import { K } from '../lib/keys.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' }
  }
};

const STATUSES = ['received', 'review', 'resolved'];
const ID_RE = /^ARC-[A-Z0-9]{6}$/;

export default async function handler(req, res) {
  const id = String(req.query.id || '').toUpperCase().trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    if (req.method === 'GET') {
      const entry = await redis.get(K.entry(id));
      if (!entry) return res.status(404).json({ error: 'not found' });

      const admin = await isValidSession(req);
      const out = { ...entry };
      if (!admin) delete out.contact;
      return res.status(200).json(out);
    }

    if (req.method === 'PATCH') {
      if (!(await isValidSession(req))) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const entry = await redis.get(K.entry(id));
      if (!entry) return res.status(404).json({ error: 'not found' });

      const patch = req.body && typeof req.body === 'object' ? req.body : {};
      const updated = { ...entry };

      if ('status' in patch) {
        if (!STATUSES.includes(patch.status)) {
          return res.status(400).json({ error: 'invalid status' });
        }
        updated.status = patch.status;
      }

      if ('reply' in patch) {
        if (patch.reply === null || patch.reply === '') {
          updated.reply = null;
        } else if (typeof patch.reply === 'string') {
          updated.reply = patch.reply.trim().slice(0, 1000);
        } else {
          return res.status(400).json({ error: 'invalid reply' });
        }
      }

      updated.updatedAt = Date.now();
      await redis.set(K.entry(id), updated);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (!(await isValidSession(req))) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const entry = await redis.get(K.entry(id));
      if (!entry) return res.status(404).json({ error: 'not found' });

      await redis.del(K.entry(id));
      const ids = (await redis.get(K.index())) || [];
      const newIds = Array.isArray(ids) ? ids.filter((x) => x !== id) : [];
      await redis.set(K.index(), newIds);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}