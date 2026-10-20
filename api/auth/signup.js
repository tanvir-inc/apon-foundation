import bcrypt from 'bcryptjs';
import { sql } from '../_lib/db.js';
import { setSession, roleFor, validEmail } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name = '', email = '', password = '' } = req.body || {};
    const n = String(name).trim();
    const e = String(email).trim().toLowerCase();
    if (!n) return res.status(400).json({ error: 'Enter your name.' });
    if (!validEmail(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${n}, ${e}, ${hash}, ${roleFor(e)})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email, role`;
    if (!rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });

    await setSession(res, rows[0]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create the account. Try again.' });
  }
}
