// /script/ui/header-page.js
// Page-aware nav highlighting + search submit + safe hash links
(() => {
  const getPath = () => window.location.pathname || '/';

  const setActiveNav = () => {
    const path = getPath().toLowerCase();
    const navItems = document.querySelectorAll('header .nav-item');
    if (!navItems.length) return;

    navItems.forEach(a => a.classList.remove('active'));

    // Determine active by current file
    let activeHref = '/';
    if (path.startsWith('/movies')) activeHref = '/movies';
    if (path.startsWith('/series')) activeHref = '/series';
    if (path.startsWith('/contact')) activeHref = '/contact';
    // details & search pages: no main active (or keep Home)
    if (path.startsWith('/details') || path.startsWith('/movie/') || path.startsWith('/tv/') || path.startsWith('/search') || path.startsWith('/offline')) {
      activeHref = '/';
    }

    navItems.forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href === activeHref) a.classList.add('active');
    });
  };

  const fixHashLinks = () => {
    const path = getPath().toLowerCase();
    const isIndex = path === '/' || path.endsWith('/index.html');
    document.querySelectorAll('header a[href^="#"]').forEach(a => {
      const hash = a.getAttribute('href');
      if (!isIndex) a.setAttribute('href', `/${hash}`);
    });
  };

  const setupSearchSubmit = () => {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const go = () => {
      const q = (input.value || '').trim();
      if (!q) return;
      window.location.href = `/search?q=${encodeURIComponent(q)}`;
    };

    // Enter submits
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    });

    // Click search icon submits (icon is a <i> with class 'search-icon')
    const icon = document.querySelector('.search-icon');
    if (icon) {
      icon.style.cursor = 'pointer';
      icon.addEventListener('click', (e) => {
        e.preventDefault();
        go();
      });
    }

    // Voice search button: after header.js fills input, we also auto-search when it ends
    const voiceBtn = document.getElementById('voiceSearchBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('voice-search-complete', go);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    fixHashLinks();
    setActiveNav();
    setupSearchSubmit();

    // If we landed on index.html#something, smooth scroll nicely (no "stays at home" confusion for page links)
    if (window.location.hash && (getPath().toLowerCase() === '/' || getPath().toLowerCase().endsWith('/index.html'))) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
