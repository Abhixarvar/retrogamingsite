/* ===== Space Worm (Snake) Game ===== */
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverText = document.getElementById('gameover-text');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');

  const GRID = 20;
  const COLS = canvas.width / GRID;
  const ROWS = canvas.height / GRID;
  const BASE_SPEED = 150; // ms per tick

  let snake, direction, nextDirection, food, score, highScore, speed, gameLoop, running;

  // Load high score
  highScore = parseInt(localStorage.getItem('spaceWormHighScore') || '0');
  highScoreEl.textContent = highScore;

  // Colors
  const headColor = '#00f0ff';
  const bodyColors = ['#00c9ff', '#00a8e8', '#0088cc', '#0068aa'];
  const foodColor = '#ffd700';
  const foodGlow = 'rgba(255, 215, 0, 0.4)';

  function init() {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    speed = BASE_SPEED;
    scoreEl.textContent = '0';
    placeFood();
  }

  function placeFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function update() {
    direction = nextDirection;
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      gameOver();
      return;
    }

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver();
      return;
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = score;
      SFX.eat();
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('spaceWormHighScore', highScore);
      }
      // Speed up every 5 points
      if (score % 5 === 0 && speed > 60) {
        speed -= 10;
        clearInterval(gameLoop);
        gameLoop = setInterval(update, speed);
      }
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    // Clear
    ctx.fillStyle = 'rgba(10, 10, 46, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID, 0);
      ctx.lineTo(x * GRID, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID);
      ctx.lineTo(canvas.width, y * GRID);
      ctx.stroke();
    }

    // Draw food (star)
    const fx = food.x * GRID + GRID / 2;
    const fy = food.y * GRID + GRID / 2;

    // Food glow
    ctx.save();
    ctx.shadowColor = foodColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = foodGlow;
    ctx.beginPath();
    ctx.arc(fx, fy, GRID * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Food star shape
    ctx.save();
    ctx.translate(fx, fy);
    ctx.fillStyle = foodColor;
    drawStar(ctx, 0, 0, 5, GRID * 0.35, GRID * 0.15);
    ctx.restore();

    // Draw snake
    snake.forEach((seg, i) => {
      const sx = seg.x * GRID;
      const sy = seg.y * GRID;
      const pad = 1;

      if (i === 0) {
        // Head
        ctx.save();
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.roundRect(sx + pad, sy + pad, GRID - pad * 2, GRID - pad * 2, 5);
        ctx.fill();
        ctx.restore();

        // Eyes
        const eyeSize = 3;
        ctx.fillStyle = '#0a0a2e';
        if (direction.x === 1) {
          ctx.fillRect(sx + GRID - 7, sy + 5, eyeSize, eyeSize);
          ctx.fillRect(sx + GRID - 7, sy + GRID - 8, eyeSize, eyeSize);
        } else if (direction.x === -1) {
          ctx.fillRect(sx + 4, sy + 5, eyeSize, eyeSize);
          ctx.fillRect(sx + 4, sy + GRID - 8, eyeSize, eyeSize);
        } else if (direction.y === -1) {
          ctx.fillRect(sx + 5, sy + 4, eyeSize, eyeSize);
          ctx.fillRect(sx + GRID - 8, sy + 4, eyeSize, eyeSize);
        } else {
          ctx.fillRect(sx + 5, sy + GRID - 7, eyeSize, eyeSize);
          ctx.fillRect(sx + GRID - 8, sy + GRID - 7, eyeSize, eyeSize);
        }
      } else {
        // Body — gradient fading
        const ratio = i / snake.length;
        const colorIdx = Math.min(Math.floor(ratio * bodyColors.length), bodyColors.length - 1);
        const alpha = 1 - ratio * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = bodyColors[colorIdx];
        ctx.shadowBlur = 6;
        ctx.fillStyle = bodyColors[colorIdx];
        ctx.beginPath();
        ctx.roundRect(sx + pad + 1, sy + pad + 1, GRID - (pad + 1) * 2, GRID - (pad + 1) * 2, 4);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
  }

  function gameOver() {
    running = false;
    clearInterval(gameLoop);
    SFX.hit();
    setTimeout(() => SFX.gameOver(), 200);
    gameoverText.innerHTML = `Score: <span class="highlight">${score}</span>${score >= highScore && score > 0 ? '  ⭐ New Best!' : ''}`;
    gameoverOverlay.classList.remove('hidden');
  }

  function startGame() {
    init();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    running = true;
    draw();
    gameLoop = setInterval(update, speed);
    document.activeElement && document.activeElement.blur();
  }

  // Controls
  document.addEventListener('keydown', (e) => {
    if (!running) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
        e.preventDefault();
        break;
      case 'ArrowDown': case 's': case 'S':
        if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
        e.preventDefault();
        break;
      case 'ArrowLeft': case 'a': case 'A':
        if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
        e.preventDefault();
        break;
      case 'ArrowRight': case 'd': case 'D':
        if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
        e.preventDefault();
        break;
    }
  });

  // Buttons
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
