// Sends the contact form to the admin inbox instead of opening the visitor's email app.
(() => {
  const isContactForm = (f) =>
    f instanceof HTMLFormElement && f.querySelector('textarea') && f.querySelector('input[type="email"]');

  // Hidden honeypot field that catches bots, and an updated note under the form
  document.querySelectorAll('form').forEach((f) => {
    if (!isContactForm(f) || f.querySelector('[name="website"]')) return;
    const hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;opacity:0';
    f.appendChild(hp);
  });
  const oldNote = [...document.querySelectorAll('p')].find((p) => /opens your email app/i.test(p.textContent));
  if (oldNote) oldNote.textContent = 'Your message goes straight to the APON team.';

  // Capture phase on document: runs before script.js's own submit handler
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!isContactForm(form)) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const fields = [...form.querySelectorAll('input, textarea')].filter(
      (el) => !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(el.type) && el.name !== 'website'
    );
    const keyOf = (el) => `${el.name} ${el.id} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    const emailEl = form.querySelector('input[type="email"]');
    const msgEl = form.querySelector('textarea');
    const texts = fields.filter((el) => el.tagName === 'INPUT' && el !== emailEl);
    const subjectEl = texts.find((el) => keyOf(el).includes('subject')) || texts[1];
    const nameEl = texts.find((el) => el !== subjectEl && keyOf(el).includes('name')) || texts.find((el) => el !== subjectEl);

    let status = form.nextElementSibling;
    if (!status || !status.classList.contains('contact-status')) {
      status = document.createElement('p');
      status.className = 'contact-status';
      status.setAttribute('role', 'status');
      status.style.cssText = 'margin:.75rem 0 0;font-size:.95rem';
      form.insertAdjacentElement('afterend', status);
    }
    const btn = form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
    if (btn) btn.disabled = true;
    status.style.color = ''; status.textContent = 'Sending…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameEl?.value || '',
          email: emailEl.value,
          subject: subjectEl?.value || '',
          message: msgEl.value,
          website: form.querySelector('[name="website"]')?.value || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send your message.');
      form.reset();
      status.style.color = '#3ddc84';
      status.textContent = 'Thank you! Your message has been sent to the APON team.';
    } catch (err) {
      status.style.color = '#ff6b6b';
      status.textContent = err.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  }, true);
})();
