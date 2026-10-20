import bcrypt from 'bcryptjs';
import { sql } from '../_lib/db.js';
import { requireAdmin, validEmail, ROLES } from '../_lib/auth.js';

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;

  try {
    if (req.method === 'GET') {
      const users = await sql`
        SELECT id, name, email, role, created_at,
               (password_hash IS NOT NULL) AS has_password, (google_id IS NOT NULL) AS has_google
        FROM users ORDER BY created_at DESC`;
      return res.json({ users, meId: me.id });
    }

    if (req.method === 'POST') {
      const { name = '', email = '', password = '', role = 'user' } = req.body || {};
      const e = String(email).trim().toLowerCase();
      if (!String(name).trim()) return res.status(400).json({ error: 'Enter a name.' });
      if (!validEmail(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role.' });
      const hash = await bcrypt.hash(password, 10);
      const rows = await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (${String(name).trim()}, ${e}, ${hash}, ${role})
        ON CONFLICT (email) DO NOTHING RETURNING id, name, email, role`;
      if (!rows.length) return res.status(409).json({ error: 'That email is already registered.' });
      return res.status(201).json({ user: rows[0] });
    }

    if (req.method === 'PATCH') {
      const { id, name, role, password } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id.' });
      if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role.' });
      if (Number(id) === me.id && role && role !== 'admin') {
        return res.status(400).json({ error: "You can't remove your own admin role." });
      }
      if (password) {
        if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        const hash = await bcrypt.hash(String(password), 10);
        await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${Number(id)}`;
      }
      const rows = await sql`
        UPDATE users SET name = COALESCE(${name?.trim() || null}, name), role = COALESCE(${role || null}, role)
        WHERE id = ${Number(id)} RETURNING id, name, email, role`;
      if (!rows.length) return res.status(404).json({ error: 'User not found.' });
      return res.json({ user: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (id === me.id) return res.status(400).json({ error: "You can't delete your own account." });
      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
