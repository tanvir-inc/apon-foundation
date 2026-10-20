import bcrypt from 'bcryptjs';
import { sql } from '../_lib/db.js';
import { setSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email = '', password = '' } = req.body || {};
    const e = String(email).trim().toLowerCase();
    const rows = await sql`SELECT id, name, email, role, password_hash FROM users WHERE email = ${e}`;
    const u = rows[0];
    if (u && !u.password_hash) {
      return res.status(400).json({ error: 'This account uses Google. Choose "Continue with Google".' });
    }
    if (!u || !(await bcrypt.compare(String(password), u.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    await setSession(res, u);
    res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not log in. Try again.' });
  }
}
