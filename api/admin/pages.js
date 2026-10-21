import { sql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const safeUrl = (u) => (/^(\/|https?:\/\/)/.test(String(u || '').trim()) ? String(u).trim().slice(0, 500) : '');

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;

  try {
    if (req.method === 'GET') {
      const pages = await sql`
        SELECT id, slug, title, content, meta_description, cover_image, nav_order, published, show_in_nav, updated_at
        FROM pages ORDER BY updated_at DESC`;
      return res.json({ pages });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const b = req.body || {};
      const title = String(b.title || '').trim();
      const slug = slugify(b.slug || b.title);
      const content = String(b.content || '');
      const meta = String(b.meta_description || '').trim().slice(0, 300);
      const cover = safeUrl(b.cover_image);
      const order = Math.max(0, Math.min(999, parseInt(b.nav_order, 10) || 0));
      const published = !!b.published;
      const inNav = !!b.show_in_nav;

      if (!title) return res.status(400).json({ error: 'Enter a page title.' });
      if (!slug) return res.status(400).json({ error: 'Enter a URL slug using letters or numbers.' });
      if (content.length > 100000) return res.status(400).json({ error: 'Content is too long.' });

      let rows;
      if (req.method === 'POST') {
        rows = await sql`
          INSERT INTO pages (slug, title, content, meta_description, cover_image, nav_order, published, show_in_nav, author_id)
          VALUES (${slug}, ${title}, ${content}, ${meta}, ${cover}, ${order}, ${published}, ${inNav}, ${me.id})
          RETURNING id, slug, title, content, meta_description, cover_image, nav_order, published, show_in_nav, updated_at`;
      } else {
        if (!b.id) return res.status(400).json({ error: 'Missing page id.' });
        rows = await sql`
          UPDATE pages SET slug = ${slug}, title = ${title}, content = ${content},
                 meta_description = ${meta}, cover_image = ${cover}, nav_order = ${order},
                 published = ${published}, show_in_nav = ${inNav}, updated_at = now()
          WHERE id = ${Number(b.id)}
          RETURNING id, slug, title, content, meta_description, cover_image, nav_order, published, show_in_nav, updated_at`;
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
