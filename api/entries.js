import { redis } from '../lib/redis.js';
import { isValidSession } from '../lib/auth.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' }
  }
};

const CATEGORIES = [
  'Academics', 'Hostel/Mess', 'Infrastructure', 'Faculty', 'Canteen',
  'Washrooms', 'Sports', 'Library', 'Girls Safety', 'Other'
];
const URGENCIES = ['routine', 'attention', 'urgent'];
const ID_RE = /^AMV-[A-Z0-9]{6}$/;
const MAX_IMAGE_CHARS = 1_500_000;

function shape(entry, { meta, admin }) {
  const out = { ...entry };
  if (!admin) delete out.contact;
  if (meta) {
    delete out.image;
    delete out.videoLink;
    delete out.contact;
  }
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const meta = req.query.meta === '1';
      const admin = await isValidSession(req);

      const ids = (await redis.get('voicebox:index')) || [];
      if (!Array.isArray(ids) || ids.length === 0) return res.status(200).json([]);

      let raw;
      try {
        raw = await redis.mget(...ids.map((id) => 'voicebox:' + id));
      } catch {
        raw = await Promise.all(ids.map((id) => redis.get('voicebox:' + id)));
      }

      const entries = [];
      for (const e of raw) {
        if (!e || !e.id) continue;
        entries.push(shape(e, { meta, admin }));
      }
      entries.sort((a, b) => (b.ts || 0) - (a.ts || 0));

      return res.status(200).json(entries);
    }

    if (req.method === 'POST') {
      const entry = req.body;
      if (!entry || typeof entry !== 'object') {
        return res.status(400).json({ error: 'invalid entry' });
      }

      const id = String(entry.id || '').toUpperCase().trim();
      const text = String(entry.text || '').trim();
      const category = String(entry.category || '').trim();
      const urgency = URGENCIES.includes(entry.urgency) ? entry.urgency : 'attention';

      if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
      if (!text || text.length > 600) return res.status(400).json({ error: 'invalid text' });
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'invalid category' });
      }

      let image = entry.image || null;
      if (image) {
        if (typeof image !== 'string' || !image.startsWith('data:image/')) {
          return res.status(400).json({ error: 'invalid image' });
        }
        if (image.length > MAX_IMAGE_CHARS) {
          return res.status(413).json({ error: 'image too large' });
        }
      }

      let videoLink = entry.videoLink ? String(entry.videoLink).trim().slice(0, 500) : null;
      if (videoLink && !/^https?:\/\//i.test(videoLink)) videoLink = null;

      const contact = entry.contact ? String(entry.contact).trim().slice(0, 200) : null;

      if (await redis.get('voicebox:' + id)) {
        return res.status(409).json({ error: 'duplicate id' });
      }

      const record = {
        id, category, urgency, text,
        image: image || null,
        videoLink,
        contact,
        status: 'received',
        reply: null,
        ts: Date.now()
      };

      await redis.set('voicebox:' + id, record);

      const ids = (await redis.get('voicebox:index')) || [];
      const list = Array.isArray(ids) ? ids.filter((x) => x !== id) : [];
      list.unshift(id);
      await redis.set('voicebox:index', list);

      return res.status(200).json({ ok: true, id });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end('Method not allowed');
  } catch (err) {
    return res.status(500).json({
      error: 'server_error',
      message: err && err.message ? err.message : String(err),
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
    });
  }
}