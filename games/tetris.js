/* ===== Cosmic Blocks (Tetris) Game ===== */
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold-canvas');
  const holdCtx = holdCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const highScoreEl = document.getElementById('high-score');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverText = document.getElementById('gameover-text');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');

  // Board dimensions
  const COLS = 10;
  const ROWS = 20;
  const CELL = canvas.width / COLS; // 30px
  const NEXT_CELL = 22;
  const HOLD_CELL = 22;

  // Tetromino definitions (SRS standard rotations)
  const SHAPES = {
    I: { blocks: [[0,0],[1,0],[2,0],[3,0]], color: '#00f0ff', glow: 'rgba(0,240,255,0.4)' },
    O: { blocks: [[0,0],[1,0],[0,1],[1,1]], color: '#ffd700', glow: 'rgba(255,215,0,0.4)' },
    T: { blocks: [[0,0],[1,0],[2,0],[1,1]], color: '#b44aff', glow: 'rgba(180,74,255,0.4)' },
    S: { blocks: [[1,0],[2,0],[0,1],[1,1]], color: '#00ff88', glow: 'rgba(0,255,136,0.4)' },
    Z: { blocks: [[0,0],[1,0],[1,1],[2,1]], color: '#ff4444', glow: 'rgba(255,68,68,0.4)' },
    J: { blocks: [[0,0],[0,1],[1,1],[2,1]], color: '#4488ff', glow: 'rgba(68,136,255,0.4)' },
    L: { blocks: [[2,0],[0,1],[1,1],[2,1]], color: '#ff8800', glow: 'rgba(255,136,0,0.4)' },
  };

  const PIECE_NAMES = Object.keys(SHAPES);

  // Game state
  let board, score, level, totalLines, highScore;
  let currentPiece, nextPiece, holdPiece, canHold;
  let dropTimer, dropInterval, gameLoop, running;
  let lockDelay, lockTimer, lockMoves;
  let bag = [];

  // Ghost / effects
  let lineClearEffect = null;

  // Load high score
  highScore = parseInt(localStorage.getItem('cosmicBlocksHighScore') || '0');
  highScoreEl.textContent = highScore;

  // ========== PIECE MANAGEMENT ==========

  function randomBag() {
    // 7-bag randomizer: ensures all 7 pieces appear before repeating
    const shuffled = [...PIECE_NAMES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function nextFromBag() {
    if (bag.length === 0) bag = randomBag();
    return bag.pop();
  }

  function createPiece(name) {
    const shape = SHAPES[name];
    return {
      name,
      blocks: shape.blocks.map(b => [...b]),
      color: shape.color,
      glow: shape.glow,
      x: Math.floor(COLS / 2) - 2,
      y: 0,
    };
  }

  function rotatePiece(piece, dir) {
    // dir: 1 = clockwise, -1 = counter-clockwise
    const blocks = piece.blocks.map(b => [...b]);
    // Find bounding box center
    let maxX = 0, maxY = 0;
    blocks.forEach(b => { maxX = Math.max(maxX, b[0]); maxY = Math.max(maxY, b[1]); });

    const size = Math.max(maxX, maxY) + 1;
    const rotated = blocks.map(b => {
      if (dir === 1) return [size - 1 - b[1], b[0]];
      return [b[1], size - 1 - b[0]];
    });
    return rotated;
  }

  // ========== BOARD ==========

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function isValid(blocks, offX, offY) {
    return blocks.every(([bx, by]) => {
      const x = bx + offX;
      const y = by + offY;
      return x >= 0 && x < COLS && y < ROWS && (y < 0 || board[y][x] === null);
    });
  }

  function lockPiece() {
    currentPiece.blocks.forEach(([bx, by]) => {
      const x = bx + currentPiece.x;
      const y = by + currentPiece.y;
      if (y >= 0 && y < ROWS) {
        board[y][x] = { color: currentPiece.color, glow: currentPiece.glow };
      }
    });

    SFX.eat();
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(cell => cell !== null)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length === 0) return;

    // Sound effects
    if (fullRows.length === 4) {
      SFX.levelUp();
    } else {
      SFX.powerup();
    }

    // Score: original Nintendo scoring
    const linePoints = [0, 100, 300, 500, 800];
    score += linePoints[fullRows.length] * level;
    totalLines += fullRows.length;
    level = Math.floor(totalLines / 10) + 1;

    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = totalLines;

    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem('cosmicBlocksHighScore', highScore);
    }

    // Line clear flash effect
    lineClearEffect = { rows: fullRows, frame: 0, maxFrames: 12 };

    // Remove lines after brief delay for visual effect
    setTimeout(() => {
      fullRows.sort((a, b) => b - a).forEach(r => {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
      });
      lineClearEffect = null;
    }, 200);

    // Update speed
    dropInterval = Math.max(50, 800 - (level - 1) * 50);
  }

  function spawnPiece() {
    currentPiece = createPiece(nextPiece || nextFromBag());
    nextPiece = nextFromBag();
    canHold = true;
    lockMoves = 0;

    drawNext();

    // Game over check
    if (!isValid(currentPiece.blocks, currentPiece.x, currentPiece.y)) {
      gameOver();
    }
  }

  // ========== HOLD ==========

  function holdCurrentPiece() {
    if (!canHold) return;
    canHold = false;
    SFX.step();

    const name = currentPiece.name;
    if (holdPiece) {
      const heldName = holdPiece;
      holdPiece = name;
      currentPiece = createPiece(heldName);
    } else {
      holdPiece = name;
      spawnPiece();
    }
    drawHold();
  }

  // ========== GHOST PIECE ==========

  function getGhostY() {
    let gy = currentPiece.y;
    while (isValid(currentPiece.blocks, currentPiece.x, gy + 1)) {
      gy++;
    }
    return gy;
  }

  // ========== MOVEMENT ==========

  function moveLeft() {
    if (isValid(currentPiece.blocks, currentPiece.x - 1, currentPiece.y)) {
      currentPiece.x--;
      resetLockDelay();
      return true;
    }
    return false;
  }

  function moveRight() {
    if (isValid(currentPiece.blocks, currentPiece.x + 1, currentPiece.y)) {
      currentPiece.x++;
      resetLockDelay();
      return true;
    }
    return false;
  }

  function softDrop() {
    if (isValid(currentPiece.blocks, currentPiece.x, currentPiece.y + 1)) {
      currentPiece.y++;
      score += 1;
      scoreEl.textContent = score;
      resetLockDelay();
      return true;
    }
    return false;
  }

  function hardDrop() {
    let dropped = 0;
    while (isValid(currentPiece.blocks, currentPiece.x, currentPiece.y + 1)) {
      currentPiece.y++;
      dropped++;
    }
    score += dropped * 2;
    scoreEl.textContent = score;
    SFX.shoot();
    lockPiece();
  }

  function rotate(dir) {
    const rotated = rotatePiece(currentPiece, dir);
    // Wall kick: try offsets
    const kicks = [0, -1, 1, -2, 2];
    const yKicks = [0, -1];
    for (const ky of yKicks) {
      for (const kx of kicks) {
        if (isValid(rotated, currentPiece.x + kx, currentPiece.y + ky)) {
          currentPiece.blocks = rotated;
          currentPiece.x += kx;
          currentPiece.y += ky;
          resetLockDelay();
          SFX.step();
          return true;
        }
      }
    }
    return false;
  }

  function resetLockDelay() {
    if (!isValid(currentPiece.blocks, currentPiece.x, currentPiece.y + 1)) {
      lockMoves++;
      if (lockMoves < 15) {
        lockTimer = 0;
      }
    }
  }

  // ========== DRAWING ==========

  function drawCell(context, x, y, size, color, glow, alpha) {
    context.save();
    context.globalAlpha = alpha || 1;

    // Outer glow
    context.shadowColor = color;
    context.shadowBlur = 6;

    // Main block
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x + 1, y + 1, size - 2, size - 2, 3);
    context.fill();

    // Inner highlight (top-left shine)
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(x + 3, y + 3, size - 8, 2);
    context.fillRect(x + 3, y + 3, 2, size - 8);

    // Inner shadow (bottom-right)
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.fillRect(x + 3, y + size - 5, size - 6, 2);
    context.fillRect(x + size - 5, y + 3, 2, size - 6);

    context.restore();
  }

  function draw() {
    // Clear canvas
    ctx.fillStyle = 'rgba(10, 10, 46, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvas.width, y * CELL);
      ctx.stroke();
    }

    // Draw locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          // Line clear flash
          let alpha = 1;
          if (lineClearEffect && lineClearEffect.rows.includes(r)) {
            alpha = lineClearEffect.frame % 4 < 2 ? 1 : 0.3;
          }
          drawCell(ctx, c * CELL, r * CELL, CELL, board[r][c].color, board[r][c].glow, alpha);
        }
      }
    }

    if (!currentPiece || !running) return;

    // Draw ghost piece
    const ghostY = getGhostY();
    if (ghostY !== currentPiece.y) {
      currentPiece.blocks.forEach(([bx, by]) => {
        const x = (bx + currentPiece.x) * CELL;
        const y = (by + ghostY) * CELL;
        if (by + ghostY >= 0) {
          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.strokeStyle = currentPiece.color;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = currentPiece.color;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 3);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // Draw current piece
    currentPiece.blocks.forEach(([bx, by]) => {
      const x = (bx + currentPiece.x) * CELL;
      const y = (by + currentPiece.y) * CELL;
      if (by + currentPiece.y >= 0) {
        drawCell(ctx, x, y, CELL, currentPiece.color, currentPiece.glow);
      }
    });
  }

  function drawPieceOnCanvas(context, pieceName, canvasW, canvasH, cellSize) {
    context.fillStyle = 'rgba(10, 10, 46, 0.95)';
    context.fillRect(0, 0, canvasW, canvasH);

    if (!pieceName) return;

    const shape = SHAPES[pieceName];
    const blocks = shape.blocks;

    // Center the piece
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    blocks.forEach(([bx, by]) => {
      minX = Math.min(minX, bx); maxX = Math.max(maxX, bx);
      minY = Math.min(minY, by); maxY = Math.max(maxY, by);
    });

    const pw = (maxX - minX + 1) * cellSize;
    const ph = (maxY - minY + 1) * cellSize;
    const offX = (canvasW - pw) / 2 - minX * cellSize;
    const offY = (canvasH - ph) / 2 - minY * cellSize;

    blocks.forEach(([bx, by]) => {
      drawCell(context, offX + bx * cellSize, offY + by * cellSize, cellSize, shape.color, shape.glow);
    });
  }

  function drawNext() {
    drawPieceOnCanvas(nextCtx, nextPiece, nextCanvas.width, nextCanvas.height, NEXT_CELL);
  }

  function drawHold() {
    drawPieceOnCanvas(holdCtx, holdPiece, holdCanvas.width, holdCanvas.height, HOLD_CELL);
  }

  // ========== GAME LOOP ==========

  let lastTime = 0;

  function gameStep(timestamp) {
    if (!running) return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // Gravity
    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!softDropAuto()) {
        // Piece has landed — lock delay
        lockTimer += dropInterval;
        if (lockTimer >= 500 || lockMoves >= 15) {
          lockPiece();
          lockTimer = 0;
        }
      }
    }

    // Line clear animation
    if (lineClearEffect) {
      lineClearEffect.frame++;
    }

    draw();
    gameLoop = requestAnimationFrame(gameStep);
  }

  function softDropAuto() {
    if (isValid(currentPiece.blocks, currentPiece.x, currentPiece.y + 1)) {
      currentPiece.y++;
      lockTimer = 0;
      return true;
    }
    return false;
  }

  // ========== INIT / GAME OVER ==========

  function init() {
    board = createBoard();
    score = 0;
    level = 1;
    totalLines = 0;
    dropInterval = 800;
    dropTimer = 0;
    lockTimer = 0;
    lockMoves = 0;
    holdPiece = null;
    canHold = true;
    bag = [];
    lineClearEffect = null;

    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    linesEl.textContent = '0';

    nextPiece = nextFromBag();
    spawnPiece();
    drawHold();
  }

  function startGame() {
    init();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    running = true;
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(gameStep);
    document.activeElement && document.activeElement.blur();
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(gameLoop);
    SFX.hit();
    setTimeout(() => SFX.gameOver(), 200);
    gameoverText.innerHTML = `Score: <span class="highlight">${score}</span> &nbsp;|&nbsp; Lines: <span class="highlight">${totalLines}</span>${score >= highScore && score > 0 ? '  ⭐ New Best!' : ''}`;
    gameoverOverlay.classList.remove('hidden');
  }

  // ========== CONTROLS ==========

  // Key repeat handling for smooth movement
  const keyState = {};
  let dasTimer = 0;
  let dasDirection = 0;
  const DAS_DELAY = 170; // ms before auto-repeat starts
  const DAS_RATE = 50;   // ms between auto-repeat moves

  document.addEventListener('keydown', (e) => {
    if (!running) return;

    // Prevent repeated keydown events from triggering
    if (keyState[e.key]) return;
    keyState[e.key] = true;

    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        moveLeft();
        dasDirection = -1;
        dasTimer = 0;
        e.preventDefault();
        break;
      case 'ArrowRight': case 'd': case 'D':
        moveRight();
        dasDirection = 1;
        dasTimer = 0;
        e.preventDefault();
        break;
      case 'ArrowDown': case 's': case 'S':
        softDrop();
        e.preventDefault();
        break;
      case 'ArrowUp': case 'w': case 'W':
        rotate(1);
        e.preventDefault();
        break;
      case 'z': case 'Z':
        rotate(-1);
        e.preventDefault();
        break;
      case ' ':
        hardDrop();
        e.preventDefault();
        break;
      case 'c': case 'C':
        holdCurrentPiece();
        e.preventDefault();
        break;
    }
  });

  document.addEventListener('keyup', (e) => {
    keyState[e.key] = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ||
        e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      dasDirection = 0;
    }
  });

  // DAS (Delayed Auto Shift) — handles held arrow keys
  setInterval(() => {
    if (!running || dasDirection === 0) return;
    dasTimer += 16;
    if (dasTimer >= DAS_DELAY) {
      if (dasDirection === -1) moveLeft();
      else if (dasDirection === 1) moveRight();
    }
  }, DAS_RATE);

  // Soft drop repeat while held
  setInterval(() => {
    if (!running) return;
    if (keyState['ArrowDown'] || keyState['s'] || keyState['S']) {
      softDrop();
    }
  }, 50);

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
