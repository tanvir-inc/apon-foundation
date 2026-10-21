import { sql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;
  try {
    if (req.method === 'GET') {
      const media = await sql`SELECT id, filename, mime, size, created_at FROM media ORDER BY created_at DESC LIMIT 200`;
      return res.json({ media });
    }

    if (req.method === 'POST') {
      const { filename = 'image', mime, data } = req.body || {};
      if (!ALLOWED.includes(mime)) return res.status(400).json({ error: 'Use a JPG, PNG, WebP or GIF image.' });
      if (typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({ error: 'Invalid image data.' });
      if (data.length > 3200000) return res.status(413).json({ error: 'Image is too large (about 2 MB max).' });
      const rows = await sql`
        INSERT INTO media (filename, mime, data, size)
        VALUES (${String(filename).slice(0, 200)}, ${mime}, ${data}, ${Math.floor((data.length * 3) / 4)})
        RETURNING id`;
      return res.status(201).json({ media: { id: rows[0].id, url: `/api/media?id=${rows[0].id}` } });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM media WHERE id = ${Number(req.query.id)}`;
      return res.json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
