(() => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('overlay');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const closeMenu = () => {
    sidebar.classList.remove('open'); overlay.classList.remove('show');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };
  hamburger.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('show', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
  });
  overlay.addEventListener('click', closeMenu);
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  const sections = [...document.querySelectorAll('main section[id]')];
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));

  const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.target);
      const duration = 1300;
      const start = performance.now();
      const tick = now => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.45 });
  document.querySelectorAll('.count').forEach(el => countObserver.observe(el));

  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = encodeURIComponent(`[APON Foundation website] ${data.get('subject')}`);
    const body = encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`);
    status.textContent = 'Opening your email app with the message prepared…';
    window.location.href = `mailto:info@aponfoundation.org?subject=${subject}&body=${body}`;
  });
  document.getElementById('year').textContent = new Date().getFullYear();
})();
