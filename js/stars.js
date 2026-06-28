/* ===== Animated Starfield ===== */
(function () {
  const container = document.getElementById('starfield');
  if (!container) return;

  const STAR_COUNT = 150;

  // Create twinkling stars
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const duration = Math.random() * 4 + 2;
    const delay = Math.random() * 4;
    const minOp = Math.random() * 0.3 + 0.1;
    const maxOp = Math.random() * 0.5 + 0.5;

    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = x + '%';
    star.style.top = y + '%';
    star.style.setProperty('--duration', duration + 's');
    star.style.setProperty('--min-opacity', minOp);
    star.style.setProperty('--max-opacity', maxOp);
    star.style.animationDelay = delay + 's';

    // Bigger stars get a subtle color tint
    if (size > 2) {
      const colors = ['#00f0ff', '#b44aff', '#ff6b9d', '#ffd700'];
      star.style.background = colors[Math.floor(Math.random() * colors.length)];
    }

    container.appendChild(star);
  }

  // Shooting stars
  function createShootingStar() {
    const star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left = Math.random() * 60 + '%';
    star.style.top = Math.random() * 40 + '%';
    star.style.transform = `rotate(${30 + Math.random() * 20}deg)`;
    container.appendChild(star);
    setTimeout(() => star.remove(), 1500);
  }

  // Random shooting stars every 3-8 seconds
  function scheduleShootingStar() {
    const delay = Math.random() * 5000 + 3000;
    setTimeout(() => {
      createShootingStar();
      scheduleShootingStar();
    }, delay);
  }

  scheduleShootingStar();
})();
