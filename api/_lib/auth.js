import { SignJWT, jwtVerify } from 'jose';
import { sql } from './db.js';

export const ROLES = ['user', 'admin'];
const COOKIE = 'apon_session';
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const roleFor = (email) =>
  process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.trim().toLowerCase() ? 'admin' : 'user';
export const appUrl = (req) => process.env.APP_URL || `https://${req.headers.host}`;

export function addCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [].concat(prev, cookie));
}

export function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    })
  );
}

export async function setSession(res, user) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setExpirationTime('7d')
    .sign(secret());
  addCookie(res, `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
}

export const clearSession = (res) =>
  addCookie(res, `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);

// Always reads the user (and role) fresh from the DB, so role changes apply immediately.
export async function getUser(req) {
  try {
    const token = parseCookies(req)[COOKIE];
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    const rows = await sql`SELECT id, name, email, role, created_at FROM users WHERE id = ${Number(payload.sub)}`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function requireAdmin(req, res) {
  const user = await getUser(req);
  if (!user) return void res.status(401).json({ error: 'Please log in.' });
  if (user.role !== 'admin') return void res.status(403).json({ error: 'Admins only.' });
  return user;
}

export const redirect = (res, to) => {
  res.statusCode = 302;
  res.setHeader('Location', to);
  res.end();
};
