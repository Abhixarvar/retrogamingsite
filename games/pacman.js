/* ===== Pac-Man Game ===== */
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverText = document.getElementById('gameover-text');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');

  const TILE = 20;
  // 21 columns x 23 rows
  // 0=empty, 1=wall, 2=dot, 3=power pellet, 4=ghost house
  const MAP_TEMPLATE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,1,1,0,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,4,4,4,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,4,4,4,4,4,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  const COLS = MAP_TEMPLATE[0].length;
  const ROWS = MAP_TEMPLATE.length;
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  // Ghost colors
  const GHOST_COLORS = ['#ff4444', '#ffb8ff', '#00ffff', '#ffb852'];
  const GHOST_SCARED_COLOR = '#2244ff';

  let map, dots, pacman, ghosts, score, lives, running, mouthOpen, mouthAngle;
  let powerTimer, powerMode, animFrame, lastTime, moveAccumulator;
  const MOVE_INTERVAL = 220; // ms per move

  function deepCopyMap() {
    return MAP_TEMPLATE.map(row => [...row]);
  }

  function countDots() {
    let count = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (map[r][c] === 2 || map[r][c] === 3) count++;
    return count;
  }

  function init() {
    map = deepCopyMap();
    dots = countDots();
    score = 0;
    lives = 3;
    scoreEl.textContent = '0';
    livesEl.textContent = '3';
    powerMode = false;
    powerTimer = 0;
    mouthOpen = 0;
    mouthAngle = 0;
    moveAccumulator = 0;
    lastTime = 0;

    resetPositions();
  }

  function resetPositions() {
    pacman = {
      x: 10, y: 15,
      dx: 0, dy: 0,
      nextDx: 0, nextDy: 0,
    };
    ghosts = [
      { x: 9, y: 9, dx: 0, dy: -1, color: GHOST_COLORS[0], scared: false, home: true, homeTimer: 0 },
      { x: 10, y: 9, dx: 0, dy: -1, color: GHOST_COLORS[1], scared: false, home: true, homeTimer: 30 },
      { x: 11, y: 9, dx: 0, dy: -1, color: GHOST_COLORS[2], scared: false, home: true, homeTimer: 60 },
    ];
  }

  function isWalkable(x, y) {
    // Tunnel wrap
    if (x < 0 || x >= COLS) return true;
    if (y < 0 || y >= ROWS) return false;
    const tile = map[y][x];
    return tile !== 1;
  }

  function isWalkableGhost(x, y) {
    if (x < 0 || x >= COLS) return true;
    if (y < 0 || y >= ROWS) return false;
    const tile = map[y][x];
    return tile !== 1;
  }

  function wrapX(x) {
    if (x < 0) return COLS - 1;
    if (x >= COLS) return 0;
    return x;
  }

  function movePacman() {
    // Try next direction first
    const nextX = wrapX(pacman.x + pacman.nextDx);
    const nextY = pacman.y + pacman.nextDy;
    if (isWalkable(nextX, nextY) && map[nextY] && map[nextY][nextX] !== 4) {
      pacman.dx = pacman.nextDx;
      pacman.dy = pacman.nextDy;
    }

    const newX = wrapX(pacman.x + pacman.dx);
    const newY = pacman.y + pacman.dy;

    if (isWalkable(newX, newY) && map[newY] && map[newY][newX] !== 4) {
      pacman.x = newX;
      pacman.y = newY;
    }

    // Eat dot
    if (map[pacman.y] && map[pacman.y][pacman.x] === 2) {
      map[pacman.y][pacman.x] = 0;
      score += 10;
      dots--;
      scoreEl.textContent = score;
      SFX.eat();
    }

    // Power pellet
    if (map[pacman.y] && map[pacman.y][pacman.x] === 3) {
      map[pacman.y][pacman.x] = 0;
      score += 50;
      dots--;
      scoreEl.textContent = score;
      powerMode = true;
      powerTimer = 60; // ticks
      ghosts.forEach(g => { if (!g.home) g.scared = true; });
      SFX.powerup();
    }

    // Check win
    if (dots <= 0) {
      win();
      return;
    }
  }

  function moveGhosts() {
    ghosts.forEach(ghost => {
      if (ghost.home) {
        ghost.homeTimer--;
        if (ghost.homeTimer <= 0) {
          ghost.home = false;
          ghost.x = 10;
          ghost.y = 8;
          ghost.dy = -1;
          ghost.dx = 0;
        }
        return;
      }

      // Simple AI: random turns with bias toward pacman
      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];

      // Filter out reverse and unwalkable
      const possible = dirs.filter(d => {
        if (d.dx === -ghost.dx && d.dy === -ghost.dy) return false;
        const nx = wrapX(ghost.x + d.dx);
        const ny = ghost.y + d.dy;
        return isWalkableGhost(nx, ny);
      });

      if (possible.length === 0) {
        // Reverse if stuck
        ghost.dx = -ghost.dx;
        ghost.dy = -ghost.dy;
      } else if (possible.length === 1) {
        ghost.dx = possible[0].dx;
        ghost.dy = possible[0].dy;
      } else {
        // Bias toward pacman (or away if scared)
        const target = ghost.scared
          ? { x: Math.random() * COLS, y: Math.random() * ROWS }
          : { x: pacman.x, y: pacman.y };

        // Randomly choose: 60% chase, 40% random
        if (Math.random() < 0.6) {
          possible.sort((a, b) => {
            const dA = Math.abs(wrapX(ghost.x + a.dx) - target.x) + Math.abs(ghost.y + a.dy - target.y);
            const dB = Math.abs(wrapX(ghost.x + b.dx) - target.x) + Math.abs(ghost.y + b.dy - target.y);
            return ghost.scared ? dB - dA : dA - dB;
          });
          ghost.dx = possible[0].dx;
          ghost.dy = possible[0].dy;
        } else {
          const pick = possible[Math.floor(Math.random() * possible.length)];
          ghost.dx = pick.dx;
          ghost.dy = pick.dy;
        }
      }

      ghost.x = wrapX(ghost.x + ghost.dx);
      ghost.y = ghost.y + ghost.dy;
    });

    // Power timer
    if (powerMode) {
      powerTimer--;
      if (powerTimer <= 0) {
        powerMode = false;
        ghosts.forEach(g => g.scared = false);
      }
    }

    // Check collisions
    ghosts.forEach(ghost => {
      if (ghost.home) return;
      if (ghost.x === pacman.x && ghost.y === pacman.y) {
        if (ghost.scared) {
          // Eat ghost
          score += 200;
          scoreEl.textContent = score;
          ghost.home = true;
          ghost.homeTimer = 30;
          ghost.x = 10;
          ghost.y = 9;
          ghost.scared = false;
          SFX.ghostEat();
        } else {
          // Lose life
          lives--;
          livesEl.textContent = lives;
          if (lives <= 0) {
            gameOver();
          } else {
            SFX.hit();
            resetPositions();
          }
        }
      }
    });
  }

  function draw() {
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw map
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = map[r][c];
        const x = c * TILE;
        const y = r * TILE;

        if (tile === 1) {
          // Wall
          ctx.fillStyle = '#1a1a5e';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#3333aa';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else if (tile === 2) {
          // Dot
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 3) {
          // Power pellet
          ctx.save();
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Draw Pac-Man
    mouthAngle = (Math.sin(mouthOpen) * 0.3) + 0.3;
    mouthOpen += 0.3;

    let angle = 0;
    if (pacman.dx === 1) angle = 0;
    else if (pacman.dx === -1) angle = Math.PI;
    else if (pacman.dy === -1) angle = -Math.PI / 2;
    else if (pacman.dy === 1) angle = Math.PI / 2;

    const px = pacman.x * TILE + TILE / 2;
    const py = pacman.y * TILE + TILE / 2;

    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(px, py, TILE / 2 - 1, angle + mouthAngle, angle + Math.PI * 2 - mouthAngle);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw Ghosts
    ghosts.forEach(ghost => {
      if (ghost.home) return;
      const gx = ghost.x * TILE + TILE / 2;
      const gy = ghost.y * TILE + TILE / 2;
      const color = ghost.scared ? GHOST_SCARED_COLOR : ghost.color;
      const flashScare = ghost.scared && powerTimer < 15 && powerTimer % 4 < 2;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = flashScare ? '#ffffff' : color;

      // Ghost body
      ctx.beginPath();
      ctx.arc(gx, gy - 2, TILE / 2 - 1, Math.PI, 0);
      ctx.lineTo(gx + TILE / 2 - 1, gy + TILE / 2 - 1);
      // Wavy bottom
      const w = TILE - 2;
      const bottom = gy + TILE / 2 - 1;
      const left = gx - TILE / 2 + 1;
      ctx.lineTo(left + w * 0.8, bottom - 3);
      ctx.lineTo(left + w * 0.6, bottom);
      ctx.lineTo(left + w * 0.4, bottom - 3);
      ctx.lineTo(left + w * 0.2, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Eyes
      if (!ghost.scared) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 3, 3, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#111';
        const pupX = ghost.dx * 1.5;
        const pupY = ghost.dy * 1.5;
        ctx.beginPath();
        ctx.arc(gx - 3 + pupX, gy - 3 + pupY, 1.5, 0, Math.PI * 2);
        ctx.arc(gx + 3 + pupX, gy - 3 + pupY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Scared face
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 3, 2, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  let tickAccumulator = 0;
  const TICK_RATE = 150;

  function gameLoopFn(timestamp) {
    if (!running) return;

    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    tickAccumulator += dt;

    while (tickAccumulator >= TICK_RATE) {
      movePacman();
      moveGhosts();
      tickAccumulator -= TICK_RATE;
      if (!running) return;
    }

    draw();
    animFrame = requestAnimationFrame(gameLoopFn);
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animFrame);
    SFX.gameOver();
    gameoverTitle.textContent = 'Game Over';
    gameoverText.innerHTML = `Score: <span class="highlight">${score}</span>`;
    gameoverOverlay.classList.remove('hidden');
  }

  function win() {
    running = false;
    cancelAnimationFrame(animFrame);
    SFX.levelUp();
    gameoverTitle.textContent = 'You Win!';
    gameoverText.innerHTML = `Score: <span class="highlight">${score}</span> ⭐ All dots collected!`;
    gameoverOverlay.classList.remove('hidden');
  }

  function startGame() {
    init();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    running = true;
    lastTime = 0;
    tickAccumulator = 0;
    animFrame = requestAnimationFrame(gameLoopFn);
    document.activeElement && document.activeElement.blur();
  }

  // Controls
  document.addEventListener('keydown', (e) => {
    if (!running) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        pacman.nextDx = 0; pacman.nextDy = -1; e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S':
        pacman.nextDx = 0; pacman.nextDy = 1; e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A':
        pacman.nextDx = -1; pacman.nextDy = 0; e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D':
        pacman.nextDx = 1; pacman.nextDy = 0; e.preventDefault(); break;
    }
  });

  startBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', startGame);

  // Initial draw
  init();
  draw();

  // Auto-start if launched from Lobby
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('room')) {
    setTimeout(startGame, 500);
  }
})();
