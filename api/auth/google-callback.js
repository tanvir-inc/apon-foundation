import { sql } from '../_lib/db.js';
import { addCookie, appUrl, parseCookies, redirect, roleFor, setSession } from '../_lib/auth.js';

export default async function handler(req, res) {
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
