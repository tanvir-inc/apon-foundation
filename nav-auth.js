// Adds Log in / Sign up (or Dashboard / Log out) and published CMS pages to the site's existing nav.
// It copies the style of your existing "Contact" nav link, so no changes to index.html markup are needed.
(async () => {
  const anchor =
    document.querySelector('header a[href="#contact"], nav a[href="#contact"]') ||
    document.querySelector('a[href="#contact"]');
  if (!anchor) return;
  const slot = anchor.parentElement.tagName === 'LI' ? anchor.parentElement : anchor;
  const container = slot.parentElement;

  const style = document.createElement('style');
  style.textContent =
    '.nav-pill{border:1px solid var(--accent,#3ddc84);border-radius:999px;padding:.35rem .9rem;color:var(--accent,#3ddc84)!important}' +
    '.nav-pill:hover{background:var(--accent,#3ddc84);color:#06130b!important}';
  document.head.appendChild(style);

  // returns [nodeToInsert, anchorElement]
  const make = (href, text, pill) => {
    const a = anchor.cloneNode(false);
    a.classList.remove('active', 'is-active', 'current');
    a.removeAttribute('aria-current');
    a.href = href;
    a.textContent = text;
    if (pill) a.classList.add('nav-pill');
    if (slot === anchor) return [a, a];
    const li = slot.cloneNode(false);
    li.appendChild(a);
    return [li, a];
  };

  const get = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [me, pages] = await Promise.all([get('/api/auth/me'), get('/api/pages')]);

  // Published CMS pages go before "Contact"
  (pages?.pages || []).forEach((p) => container.insertBefore(make('/p/' + encodeURIComponent(p.slug), p.title)[0], slot));

  // Account links go after "Contact"
  const items = [];
  const user = me?.user;
  if (user) {
    items.push(make(user.role === 'admin' ? '/admin.html' : '/dashboard.html', user.role === 'admin' ? 'Admin' : 'Dashboard', true)[0]);
    const [logoutNode, logoutLink] = make('#', 'Log out');
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      location.reload();
    });
    items.push(logoutNode);
  } else {
    items.push(make('/login.html', 'Log in')[0], make('/signup.html', 'Sign up', true)[0]);
  }
  slot.after(...items);
})();
