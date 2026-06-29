/* ===== Kid-Friendly Tooltips ===== */
(function () {
  const tooltip = document.createElement('div');
  tooltip.className = 'kid-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltip);

  let activeEl = null;

  function show(e) {
    const el = e.currentTarget;
    const tip = el.getAttribute('data-tip');
    if (!tip) return;
    activeEl = el;
    tooltip.textContent = tip;
    tooltip.classList.add('visible');
    position(e);
  }

  function position(e) {
    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    const rect = tooltip.getBoundingClientRect();
    let left = x + 16;
    let top = y - rect.height - 10;

    // Keep on screen
    if (left + rect.width > window.innerWidth - 10) {
      left = x - rect.width - 16;
    }
    if (top < 10) {
      top = y + 20;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function move(e) {
    if (!activeEl) return;
    position(e);
  }

  function hide() {
    activeEl = null;
    tooltip.classList.remove('visible');
  }

  // Attach to all elements with data-tip
  function bind() {
    document.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('mouseenter', show);
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', hide);
      el.addEventListener('focus', show);
      el.addEventListener('blur', hide);
    });
  }

  // Bind on load and observe for dynamically added elements
  bind();
  const observer = new MutationObserver(bind);
  observer.observe(document.body, { childList: true, subtree: true });
})();
