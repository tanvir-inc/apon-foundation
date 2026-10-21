import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { sql } from '../_lib/db.js';
import {
  addCookie, appUrl, clearSession, getUser, parseCookies,
  redirect, roleFor, setSession, validEmail,
} from '../_lib/auth.js';

// One function that serves /api/auth/signup, login, logout, me, google and google-callback
const routes = { signup, login, logout, me, google, 'google-callback': googleCallback };

export default async function handler(req, res) {
  const fn = routes[req.query.action];
  if (!fn) return res.status(404).json({ error: 'Not found' });
  return fn(req, res);
}

async function signup(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name = '', email = '', password = '', confirmPassword = '' } = req.body || {};
    const n = String(name).trim();
    const e = String(email).trim().toLowerCase();
    if (!n) return res.status(400).json({ error: 'Enter your name.' });
    if (!validEmail(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

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

async function login(req, res) {
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

function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSession(res);
  res.json({ ok: true });
}

async function me(req, res) {
  const user = await getUser(req);
  if (!user) {
    // GET is used by the site nav to check login state, so logged-out is not an error
    return req.method === 'GET' ? res.json({ user: null }) : res.status(401).json({ error: 'Not logged in.' });
  }
  if (req.method === 'PATCH') {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Enter your name.' });
    const rows = await sql`UPDATE users SET name = ${name} WHERE id = ${user.id} RETURNING id, name, email, role, created_at`;
    return res.json({ user: rows[0] });
  }
  res.json({ user });
}

function google(req, res) {
  const state = randomUUID();
  addCookie(res, `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600`);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appUrl(req)}/api/auth/google-callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function googleCallback(req, res) {
  const fail = (code) => redirect(res, `/login.html?error=${code}`);
  try {
    const { code, state, error } = req.query;
    if (error || !code || !state || state !== parseCookies(req).oauth_state) return fail('google');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${appUrl(req)}/api/auth/google-callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('google');
    const { access_token } = await tokenRes.json();

    const g = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })).json();
    if (!g.email || !g.email_verified) return fail('google_email');

    const email = g.email.toLowerCase();
    let [user] = await sql`SELECT id, name, email, role FROM users WHERE email = ${email}`;
    if (user) {
      await sql`UPDATE users SET google_id = COALESCE(google_id, ${g.sub}) WHERE id = ${user.id}`;
    } else {
      [user] = await sql`
        INSERT INTO users (name, email, google_id, role)
        VALUES (${g.name || email.split('@')[0]}, ${email}, ${g.sub}, ${roleFor(email)})
        RETURNING id, name, email, role`;
    }

    await setSession(res, user);
    addCookie(res, 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0');
    redirect(res, user.role === 'admin' ? '/admin.html' : '/dashboard.html');
  } catch (err) {
    console.error(err);
    fail('google');
  }
}
