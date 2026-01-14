// Custom Dropdown Component (syncs with native <select>) - StreamFinder
// Usage: import { initCustomDropdowns } from '../components/customDropdown.js'; initCustomDropdowns();
export function initCustomDropdowns(selector = '.filter-select') {
  const selects = Array.from(document.querySelectorAll(selector));
  selects.forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.dataset.customized === '1') return;

    // Build wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-dropdown';
    wrapper.tabIndex = -1;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-dropdown__button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const buttonLabel = document.createElement('span');
    buttonLabel.className = 'custom-dropdown__label';

    const chevron = document.createElement('span');
    chevron.className = 'custom-dropdown__chevron';
    chevron.innerHTML = '<i class="fas fa-chevron-down" aria-hidden="true"></i>';

    button.appendChild(buttonLabel);
    button.appendChild(chevron);

    const menu = document.createElement('div');
    menu.className = 'custom-dropdown__menu';
    menu.setAttribute('role', 'listbox');

    // Build options
    const buildOptions = () => {
      menu.innerHTML = '';
      const opts = Array.from(select.options);
      opts.forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'custom-dropdown__option';
        item.setAttribute('role', 'option');
        item.dataset.value = opt.value;
        item.textContent = opt.textContent;

        if (opt.disabled) {
          item.classList.add('is-disabled');
          item.setAttribute('aria-disabled', 'true');
        }
        if (opt.selected) {
          item.classList.add('is-selected');
          item.setAttribute('aria-selected', 'true');
        }
        item.addEventListener('click', () => {
          if (opt.disabled) return;
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });

        menu.appendChild(item);
      });
    };

    const syncLabel = () => {
      const selected = select.options[select.selectedIndex];
      buttonLabel.textContent = selected ? selected.textContent : 'Select';
      Array.from(menu.children).forEach((el) => {
        el.classList.remove('is-selected');
        el.removeAttribute('aria-selected');
        if (el.dataset.value === select.value) {
          el.classList.add('is-selected');
          el.setAttribute('aria-selected', 'true');
        }
      });
    };

    const open = () => {
      wrapper.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      // Ensure on top
      wrapper.style.zIndex = '9999';
    };

    const close = () => {
      wrapper.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      wrapper.style.zIndex = '';
    };

    // Hide native select but keep it in DOM for logic
    select.dataset.customized = '1';
    select.classList.add('custom-dropdown__native');
    select.tabIndex = -1;

    // Mount
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(button);
    wrapper.appendChild(menu);

    buildOptions();
    syncLabel();

    // Events
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrapper.classList.contains('is-open')) close();
      else {
        // close others
        document.querySelectorAll('.custom-dropdown.is-open').forEach((d) => {
          if (d !== wrapper) d.classList.remove('is-open');
        });
        open();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) close();
    });

    // Keyboard
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (wrapper.classList.contains('is-open')) close();
        else open();
      }
    });

    select.addEventListener('change', () => {
      syncLabel();
    });

    // If options updated dynamically later
    const observer = new MutationObserver(() => {
      buildOptions();
      syncLabel();
    });
    observer.observe(select, { childList: true, subtree: true });
  });
}
