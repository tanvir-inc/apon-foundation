import { sql } from '../_lib/db.js';
import { getUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'PATCH') {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Enter your name.' });
    const rows = await sql`UPDATE users SET name = ${name} WHERE id = ${user.id} RETURNING id, name, email, role, created_at`;
    return res.json({ user: rows[0] });
  }
  res.json({ user });
}
