import { sql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;

  try {
    if (req.method === 'GET') {
      const pages = await sql`
        SELECT id, slug, title, content, published, show_in_nav, updated_at
        FROM pages ORDER BY updated_at DESC`;
      return res.json({ pages });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const { id, title = '', slug = '', content = '', published = false, show_in_nav = false } = req.body || {};
      const t = String(title).trim();
      const s = slugify(slug || title);
      if (!t) return res.status(400).json({ error: 'Enter a page title.' });
      if (!s) return res.status(400).json({ error: 'Enter a URL slug using letters or numbers.' });
      if (String(content).length > 100000) return res.status(400).json({ error: 'Content is too long.' });

      let rows;
      if (req.method === 'POST') {
        rows = await sql`
          INSERT INTO pages (slug, title, content, published, show_in_nav, author_id)
          VALUES (${s}, ${t}, ${String(content)}, ${!!published}, ${!!show_in_nav}, ${me.id})
          RETURNING id, slug, title, content, published, show_in_nav, updated_at`;
      } else {
        if (!id) return res.status(400).json({ error: 'Missing page id.' });
        rows = await sql`
          UPDATE pages SET slug = ${s}, title = ${t}, content = ${String(content)},
                 published = ${!!published}, show_in_nav = ${!!show_in_nav}, updated_at = now()
          WHERE id = ${Number(id)}
          RETURNING id, slug, title, content, published, show_in_nav, updated_at`;
        if (!rows.length) return res.status(404).json({ error: 'Page not found.' });
      }
      return res.status(req.method === 'POST' ? 201 : 200).json({ page: rows[0] });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM pages WHERE id = ${Number(req.query.id)}`;
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That URL slug is already used by another page.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
