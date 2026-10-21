import { sql } from './_lib/db.js';
import { validEmail } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name = '', email = '', subject = '', message = '', website = '' } = req.body || {};
    if (website) return res.json({ ok: true }); // honeypot: bots fill this hidden field

    const n = String(name).trim().slice(0, 120);
    const e = String(email).trim().toLowerCase().slice(0, 200);
    const s = String(subject).trim().slice(0, 200);
    const m = String(message).trim();
    if (!n) return res.status(400).json({ error: 'Enter your name.' });
    if (!validEmail(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (m.length < 5) return res.status(400).json({ error: 'Write a short message.' });
    if (m.length > 5000) return res.status(400).json({ error: 'Message is too long (5000 characters max).' });

    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM messages
      WHERE email = ${e} AND created_at > now() - interval '1 hour'`;
    if (count >= 5) return res.status(429).json({ error: 'Too many messages. Please try again later.' });

    await sql`INSERT INTO messages (name, email, subject, message) VALUES (${n}, ${e}, ${s}, ${m})`;
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
}
