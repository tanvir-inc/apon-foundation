// Shared client helpers for login, signup and dashboards
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

const homeFor = (user) => (user.role === 'admin' ? '/admin.html' : '/dashboard.html');

async function currentUser() {
  try { return (await api('/auth/me')).user; } catch { return null; }
}

// Redirects away if not logged in (or wrong role). Returns the user otherwise.
async function guard(role) {
  const user = await currentUser();
  if (!user) { location.href = '/login.html'; return null; }
  if (role && user.role !== role) { location.href = homeFor(user); return null; }
  return user;
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  location.href = '/login.html';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// Wires a login/signup form to an endpoint
function bindAuthForm(form, endpoint) {
  const msg = form.querySelector('.msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button.primary');
    btn.disabled = true; msg.textContent = '';
    try {
      const { user } = await api(endpoint, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      location.href = homeFor(user);
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
}

const GOOGLE_ERRORS = {
  google: 'Google sign-in failed. Try again.',
  google_email: 'Your Google email is not verified.',
};
