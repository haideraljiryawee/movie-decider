// /script/ui/header-page.js
// Page-aware nav highlighting + search submit + safe hash links
(() => {
  const getFile = () => {
    const p = window.location.pathname;
    return p.split('/').pop() || 'index.html';
  };

  const setActiveNav = () => {
    const file = getFile().toLowerCase();
    const navItems = document.querySelectorAll('header .nav-item');
    if (!navItems.length) return;

    navItems.forEach(a => a.classList.remove('active'));

    // Determine active by current file
    let activeHref = 'index.html';
    if (file === 'movies.html') activeHref = 'movies.html';
    if (file === 'series.html') activeHref = 'series.html';
    if (file === 'contact.html') activeHref = 'contact.html';
    // details & search pages: no main active (or keep Home)
    if (file === 'details.html' || file === 'p_search.html' || file === 'offline.html') activeHref = 'index.html';

    navItems.forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href.endsWith(activeHref)) a.classList.add('active');
    });
  };

  const fixHashLinks = () => {
    const file = getFile().toLowerCase();
    const isIndex = file === 'index.html' || file === '';
    document.querySelectorAll('header a[href^="#"]').forEach(a => {
      const hash = a.getAttribute('href');
      if (!isIndex) a.setAttribute('href', `index.html${hash}`);
    });
  };

  const setupSearchSubmit = () => {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const go = () => {
      const q = (input.value || '').trim();
      if (!q) return;
      window.location.href = `p_search.html?q=${encodeURIComponent(q)}`;
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
    if (window.location.hash && (getFile().toLowerCase() === 'index.html')) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
