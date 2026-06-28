/* ===== Spaceship Cursor ===== */
(function () {
  const cursor = document.createElement('img');
  cursor.id = 'spaceship-cursor';
  // Determine path: game pages are in /games/, main page is root
  const isGamePage = window.location.pathname.includes('/games/');
  cursor.src = isGamePage ? '../assets/spaceship.svg' : 'assets/spaceship.svg';
  cursor.alt = '';
  cursor.draggable = false;
  document.body.appendChild(cursor);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;
  let prevX = mouseX;
  let prevY = mouseY;
  let angle = 0;

  // Track mouse position
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Hide cursor when it leaves the window
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
  });

  // Particle trail colors
  const trailColors = ['#00f0ff', '#b44aff', '#ff6b9d', '#ffd700'];
  let trailIndex = 0;

  function spawnTrail(x, y) {
    const dot = document.createElement('div');
    dot.className = 'cursor-trail';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dot.style.background = trailColors[trailIndex % trailColors.length];
    trailIndex++;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }

  // Animation loop
  let frameCount = 0;
  function animate() {
    // Lerp toward mouse
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;

    // Calculate movement angle
    const dx = cursorX - prevX;
    const dy = cursorY - prevY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    if (speed > 1) {
      const targetAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
      // Smooth angle transition
      let diff = targetAngle - angle;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      angle += diff * 0.12;
    }

    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    cursor.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

    // Spawn trail particles on fast movement
    if (speed > 4 && frameCount % 3 === 0) {
      spawnTrail(cursorX, cursorY);
    }

    prevX = cursorX;
    prevY = cursorY;
    frameCount++;

    requestAnimationFrame(animate);
  }

  animate();
})();
