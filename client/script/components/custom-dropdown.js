// /script/components/custom-dropdown.js
// Lightweight custom dropdown that syncs with a native <select> (kept for accessibility + existing code).
// Usage: enhanceSelect(document.getElementById('genre-filter'));

export function enhanceSelect(selectEl, options = {}) {
  if (!selectEl || selectEl.dataset.enhanced === 'true') return null;

  const cfg = {
    placeholder: selectEl.options?.[0]?.textContent || 'Select…',
    maxHeight: options.maxHeight || 280,
  };

  selectEl.dataset.enhanced = 'true';

  // Wrapper
  const wrap = document.createElement('div');
  wrap.className = 'sf-select';
  wrap.tabIndex = -1;

  // Button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sf-select__btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');

  const btnLabel = document.createElement('span');
  btnLabel.className = 'sf-select__label';

  const btnValue = document.createElement('span');
  btnValue.className = 'sf-select__value';

  const btnChevron = document.createElement('span');
  btnChevron.className = 'sf-select__chev';
  btnChevron.innerHTML = '<i class="fas fa-chevron-down" aria-hidden="true"></i>';

  btnLabel.textContent = selectEl.getAttribute('data-label') || '';
  btn.append(btnValue, btnChevron);

  // Panel
  const panel = document.createElement('div');
  panel.className = 'sf-select__panel';
  panel.setAttribute('role', 'listbox');
  panel.style.maxHeight = `${cfg.maxHeight}px`;

  // Build options
  const buildOptions = () => {
    panel.innerHTML = '';
    [...selectEl.options].forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sf-select__opt';
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;

      if (opt.disabled) {
        item.disabled = true;
        item.classList.add('is-disabled');
      }
      if (opt.selected) item.classList.add('is-selected');

      item.addEventListener('click', () => {
        setValue(opt.value, true);
        close();
      });

      panel.appendChild(item);
    });
  };

  const getSelectedText = () => {
    const sel = selectEl.options[selectEl.selectedIndex];
    return sel ? sel.textContent : cfg.placeholder;
  };

  const setValue = (val, trigger = false) => {
    selectEl.value = val;
    // Sync selected state
    [...selectEl.options].forEach(o => (o.selected = (o.value === val)));
    btnValue.textContent = getSelectedText();

    // Mark selected button
    [...panel.querySelectorAll('.sf-select__opt')].forEach(b => {
      b.classList.toggle('is-selected', b.dataset.value === val);
    });

    if (trigger) {
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const open = () => {
    wrap.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    wrap.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };

  const toggle = () => (wrap.classList.contains('is-open') ? close() : open());

  // Mount
  const parent = selectEl.parentElement;
  parent.insertBefore(wrap, selectEl);
  wrap.appendChild(btn);
  wrap.appendChild(panel);
  wrap.appendChild(selectEl);

  // Hide native select but keep it in DOM for forms/JS
  selectEl.classList.add('sf-select__native');
  selectEl.setAttribute('tabindex', '-1');

  // Initial
  buildOptions();
  setValue(selectEl.value || selectEl.options?.[0]?.value, false);

  // Events
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  // Keyboard
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  // If underlying select changes programmatically, reflect it
  selectEl.addEventListener('change', () => setValue(selectEl.value, false));

  return { open, close, setValue };
}

export function enhanceSelects(selector = '.filter-select') {
  document.querySelectorAll(selector).forEach(s => enhanceSelect(s));
}
