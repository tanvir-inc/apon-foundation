import { sql } from './_lib/db.js';
import { getUser } from './_lib/auth.js';

// Public: GET /api/pages            -> published pages shown in the nav
//         GET /api/pages?slug=about -> one page (drafts are visible to admins only)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const slug = req.query.slug;
    if (slug) {
      const rows = await sql`
        SELECT slug, title, content, meta_description, cover_image, published, updated_at
        FROM pages WHERE slug = ${String(slug)}`;
      const page = rows[0];
      const user = page && !page.published ? await getUser(req) : null;
      if (!page || (!page.published && user?.role !== 'admin')) {
        return res.status(404).json({ error: 'Page not found.' });
      }
      return res.json({ page });
    }
    const pages = await sql`
      SELECT slug, title FROM pages
      WHERE published AND show_in_nav ORDER BY nav_order, created_at`;
    res.json({ pages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load pages.' });
  }
}
