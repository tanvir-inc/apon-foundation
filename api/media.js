import { sql } from './_lib/db.js';

export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (!id) return res.status(404).end();
  try {
    const rows = await sql`SELECT mime, data FROM media WHERE id = ${id}`;
    if (!rows.length) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(rows[0].data, 'base64'));
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
}
