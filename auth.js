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
    const body = Object.fromEntries(new FormData(form));
    msg.textContent = '';
    if ('confirmPassword' in body && body.confirmPassword !== body.password) {
      msg.textContent = 'Passwords do not match.';
      return;
    }
    btn.disabled = true;
    try {
      const { user } = await api(endpoint, { method: 'POST', body });
      location.href = homeFor(user);
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
}

function renderMarkdown(src) {
  const inline = (s) => esc(s)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => (/^(https?:\/\/|mailto:|\/|#)/.test(u) ? `<a href="${u}">${t}</a>` : m))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const out = []; let para = [], list = null;
  const flush = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const open = (t) => { if (list !== t) { close(); out.push(`<${t}>`); list = t; } };
  for (const raw of String(src).split('\n')) {
    const line = raw.trimEnd(); let m;
    if (!line.trim()) { flush(); close(); }
    else if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); close(); out.push('<hr>'); }
    else if ((m = line.match(/^(#{1,3})\s+(.*)/))) { flush(); close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { flush(); open('ul'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else if ((m = line.match(/^\d+\.\s+(.*)/))) { flush(); open('ol'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else if ((m = line.match(/^>\s?(.*)/))) { flush(); close(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); }
    else { close(); para.push(line); }
  }
  flush(); close();
  return out.join('');
}

const GOOGLE_ERRORS = {
  google: 'Google sign-in failed. Try again.',
  google_email: 'Your Google email is not verified.',
};
