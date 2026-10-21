import { sql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;
  try {
    if (req.method === 'GET') {
      const [{ count }] = await sql`SELECT count(*)::int AS count FROM messages WHERE NOT is_read`;
      if (req.query.summary) return res.json({ unread: count });
      const messages = await sql`
        SELECT id, name, email, subject, message, is_read, created_at
        FROM messages ORDER BY created_at DESC LIMIT 500`;
      return res.json({ messages, unread: count });
    }

    if (req.method === 'PATCH') {
      const { id, is_read, all } = req.body || {};
      if (all) {
        await sql`UPDATE messages SET is_read = true WHERE NOT is_read`;
        return res.json({ ok: true });
      }
      if (!id) return res.status(400).json({ error: 'Missing message id.' });
      await sql`UPDATE messages SET is_read = ${!!is_read} WHERE id = ${Number(id)}`;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM messages WHERE id = ${Number(req.query.id)}`;
      return res.json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
