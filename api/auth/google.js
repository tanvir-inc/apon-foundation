import { randomUUID } from 'crypto';
import { addCookie, appUrl, redirect } from '../_lib/auth.js';

export default function handler(req, res) {
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
