/* ===== Block Blast — Puzzle Game ===== */
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const levelEl = document.getElementById('level');
  const starsEl = document.getElementById('stars');
  const targetEl = document.getElementById('target');
  const highScoreEl = document.getElementById('high-score');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverText = document.getElementById('gameover-text');
  const levelOverlay = document.getElementById('level-overlay');
  const levelText = document.getElementById('level-text');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');
  const nextBtn = document.getElementById('next-btn');
  const pieceTray = document.getElementById('piece-tray');

  // Board
  const COLS = 10;
  const ROWS = 10;
  const CELL = canvas.width / COLS; // 30px

  // Piece shapes — each is a list of [row, col] offsets
  const PIECE_DEFS = [
    // 1x1 dot
    { blocks: [[0,0]], color: '#ffd700', glow: 'rgba(255,215,0,0.4)', name: 'dot' },
    // 1x2 horizontal
    { blocks: [[0,0],[0,1]], color: '#00f0ff', glow: 'rgba(0,240,255,0.4)', name: 'h2' },
    // 1x3 horizontal
    { blocks: [[0,0],[0,1],[0,2]], color: '#00ff88', glow: 'rgba(0,255,136,0.4)', name: 'h3' },
    // 1x4 horizontal
    { blocks: [[0,0],[0,1],[0,2],[0,3]], color: '#00f0ff', glow: 'rgba(0,240,255,0.4)', name: 'h4' },
    // 1x5 horizontal
    { blocks: [[0,0],[0,1],[0,2],[0,3],[0,4]], color: '#4488ff', glow: 'rgba(68,136,255,0.4)', name: 'h5' },
    // 2x1 vertical
    { blocks: [[0,0],[1,0]], color: '#ff8800', glow: 'rgba(255,136,0,0.4)', name: 'v2' },
    // 3x1 vertical
    { blocks: [[0,0],[1,0],[2,0]], color: '#b44aff', glow: 'rgba(180,74,255,0.4)', name: 'v3' },
    // 4x1 vertical
    { blocks: [[0,0],[1,0],[2,0],[3,0]], color: '#ff8800', glow: 'rgba(255,136,0,0.4)', name: 'v4' },
    // 2x2 square
    { blocks: [[0,0],[0,1],[1,0],[1,1]], color: '#ffd700', glow: 'rgba(255,215,0,0.4)', name: 'sq2' },
    // 3x3 square
    { blocks: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], color: '#ff4444', glow: 'rgba(255,68,68,0.4)', name: 'sq3' },
    // L-shape
    { blocks: [[0,0],[1,0],[2,0],[2,1]], color: '#ff8800', glow: 'rgba(255,136,0,0.4)', name: 'L' },
    // Reverse L
    { blocks: [[0,1],[1,1],[2,0],[2,1]], color: '#4488ff', glow: 'rgba(68,136,255,0.4)', name: 'rL' },
    // T-shape
    { blocks: [[0,0],[0,1],[0,2],[1,1]], color: '#b44aff', glow: 'rgba(180,74,255,0.4)', name: 'T' },
    // S-shape
    { blocks: [[0,1],[0,2],[1,0],[1,1]], color: '#00ff88', glow: 'rgba(0,255,136,0.4)', name: 'S' },
    // Z-shape
    { blocks: [[0,0],[0,1],[1,1],[1,2]], color: '#ff4444', glow: 'rgba(255,68,68,0.4)', name: 'Z' },
    // Corner 2x2
    { blocks: [[0,0],[0,1],[1,0]], color: '#ff6b9d', glow: 'rgba(255,107,157,0.4)', name: 'corner' },
  ];

  // Game state
  let board = [];
  let level, stars, totalStars, targetStars, highLevel;
  let pieces = []; // 3 pieces in tray
  let selectedPiece = -1; // index in pieces[]
  let ghostPos = null; // {row, col} for placement preview
  let running = false;
  let clearEffects = []; // [{row, col, frame, maxFrames}]
  let starParticles = []; // [{x, y, vx, vy, life, maxLife, color}]

  // Pre-placed blocks for each level (obstacles)
  let prePlaced = [];

  // Load high level
  highLevel = parseInt(localStorage.getItem('blockBlastHighLevel') || '0');
  highScoreEl.textContent = highLevel;

  // ========== LEVEL GENERATION ==========

  function getTargetForLevel(lvl) {
    // Level 1: 3 stars, slowly ramp up
    return Math.min(3 + Math.floor((lvl - 1) * 1.5), 20);
  }

  function generatePrePlaced(lvl) {
    const blocks = [];
    if (lvl <= 1) return blocks; // Level 1 is clean

    // Number of pre-placed blocks scales with level
    const count = Math.min(Math.floor(lvl * 1.8) + 2, 35);

    // Strategy: place blocks in patterns that make it harder
    const seed = lvl * 13 + 7;
    const rng = mulberry32(seed);

    // Different patterns per level
    const pattern = lvl % 5;

    if (pattern === 0) {
      // Scattered random blocks
      for (let i = 0; i < count; i++) {
        const r = Math.floor(rng() * ROWS);
        const c = Math.floor(rng() * COLS);
        if (!blocks.some(b => b[0] === r && b[1] === c)) {
          blocks.push([r, c]);
        }
      }
    } else if (pattern === 1) {
      // Partial rows with gaps
      const numRows = Math.min(Math.floor(lvl / 2) + 1, 5);
      for (let i = 0; i < numRows; i++) {
        const row = ROWS - 1 - i;
        for (let c = 0; c < COLS; c++) {
          // Leave 2-3 gaps per row
          if (rng() > 0.3) {
            blocks.push([row, c]);
          }
        }
      }
    } else if (pattern === 2) {
      // Checkerboard bottom
      const numRows = Math.min(Math.floor(lvl / 3) + 2, 4);
      for (let i = 0; i < numRows; i++) {
        const row = ROWS - 1 - i;
        for (let c = 0; c < COLS; c++) {
          if ((row + c) % 2 === 0) {
            blocks.push([row, c]);
          }
        }
      }
    } else if (pattern === 3) {
      // Wall columns
      const numCols = Math.min(Math.floor(lvl / 3) + 1, 3);
      for (let i = 0; i < numCols; i++) {
        const col = Math.floor(rng() * COLS);
        const height = Math.min(Math.floor(rng() * 4) + 3, ROWS - 2);
        for (let r = ROWS - 1; r >= ROWS - height; r--) {
          if (!blocks.some(b => b[0] === r && b[1] === col)) {
            blocks.push([r, col]);
          }
        }
      }
    } else {
      // Mixed: partial rows + some scattered
      const numRows = Math.min(Math.floor(lvl / 3) + 1, 3);
      for (let i = 0; i < numRows; i++) {
        const row = ROWS - 1 - i;
        for (let c = 0; c < COLS; c++) {
          if (rng() > 0.4) {
            blocks.push([row, c]);
          }
        }
      }
      // Extra scattered
      const extra = Math.floor(lvl / 2);
      for (let i = 0; i < extra; i++) {
        const r = Math.floor(rng() * (ROWS - numRows));
        const c = Math.floor(rng() * COLS);
        if (!blocks.some(b => b[0] === r && b[1] === c)) {
          blocks.push([r, c]);
        }
      }
    }

    return blocks;
  }

  // Seeded RNG for reproducible levels
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ========== PIECE TRAY ==========

  function getRandomPiece() {
    // Higher levels get bigger / harder pieces more often
    let pool = PIECE_DEFS;
    if (level >= 5) {
      // Weight towards larger pieces
      pool = [...PIECE_DEFS, ...PIECE_DEFS.filter(p => p.blocks.length >= 4)];
    }
    const idx = Math.floor(Math.random() * pool.length);
    return { ...pool[idx], blocks: pool[idx].blocks.map(b => [...b]) };
  }

  function refillTray() {
    pieces = [];
    for (let i = 0; i < 3; i++) {
      pieces.push(getRandomPiece());
    }
    selectedPiece = -1;
    ghostPos = null;
    renderTray();
  }

  function renderTray() {
    pieceTray.innerHTML = '';
    pieces.forEach((piece, idx) => {
      if (!piece) {
        const empty = document.createElement('div');
        empty.className = 'tray-slot empty';
        pieceTray.appendChild(empty);
        return;
      }

      const slot = document.createElement('div');
      slot.className = 'tray-slot' + (idx === selectedPiece ? ' selected' : '');
      slot.setAttribute('data-idx', idx);

      const slotCanvas = document.createElement('canvas');
      const maxR = Math.max(...piece.blocks.map(b => b[0])) + 1;
      const maxC = Math.max(...piece.blocks.map(b => b[1])) + 1;
      const cellSize = Math.min(20, 70 / Math.max(maxR, maxC));
      slotCanvas.width = maxC * cellSize + 4;
      slotCanvas.height = maxR * cellSize + 4;
      const sCtx = slotCanvas.getContext('2d');

      piece.blocks.forEach(([r, c]) => {
        sCtx.save();
        sCtx.shadowColor = piece.color;
        sCtx.shadowBlur = 4;
        sCtx.fillStyle = piece.color;
        sCtx.beginPath();
        sCtx.roundRect(c * cellSize + 2, r * cellSize + 2, cellSize - 2, cellSize - 2, 2);
        sCtx.fill();
        // Highlight
        sCtx.shadowBlur = 0;
        sCtx.fillStyle = 'rgba(255,255,255,0.2)';
        sCtx.fillRect(c * cellSize + 4, r * cellSize + 4, cellSize - 6, 1);
        sCtx.restore();
      });

      slot.appendChild(slotCanvas);

      // Click to select
      slot.addEventListener('click', () => {
        if (!running) return;
        selectedPiece = idx;
        ghostPos = null;
        renderTray();
        SFX.step();
      });

      // Drag & drop
      slot.draggable = true;
      slot.addEventListener('dragstart', (e) => {
        if (!running) return;
        selectedPiece = idx;
        renderTray();
        e.dataTransfer.setData('text/plain', idx.toString());
        SFX.step();
      });

      pieceTray.appendChild(slot);
    });
  }

  // ========== BOARD LOGIC ==========

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function canPlace(piece, row, col) {
    return piece.blocks.every(([br, bc]) => {
      const r = br + row;
      const c = bc + col;
      return r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === null;
    });
  }

  function placePiece(piece, row, col) {
    piece.blocks.forEach(([br, bc]) => {
      const r = br + row;
      const c = bc + col;
      board[r][c] = { color: piece.color, glow: piece.glow };
    });
    SFX.eat();
  }

  function clearLines() {
    let cleared = 0;
    const rowsToClear = [];
    const colsToClear = [];

    // Check full rows
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(cell => cell !== null)) {
        rowsToClear.push(r);
      }
    }

    // Check full columns
    for (let c = 0; c < COLS; c++) {
      let full = true;
      for (let r = 0; r < ROWS; r++) {
        if (board[r][c] === null) { full = false; break; }
      }
      if (full) colsToClear.push(c);
    }

    if (rowsToClear.length === 0 && colsToClear.length === 0) return 0;

    // Create clear effects
    rowsToClear.forEach(r => {
      for (let c = 0; c < COLS; c++) {
        clearEffects.push({ row: r, col: c, frame: 0, maxFrames: 20 });
        spawnStarBurst(c * CELL + CELL / 2, r * CELL + CELL / 2);
      }
    });
    colsToClear.forEach(c => {
      for (let r = 0; r < ROWS; r++) {
        if (!rowsToClear.includes(r)) {
          clearEffects.push({ row: r, col: c, frame: 0, maxFrames: 20 });
          spawnStarBurst(c * CELL + CELL / 2, r * CELL + CELL / 2);
        }
      }
    });

    // Clear the cells after a brief delay
    setTimeout(() => {
      rowsToClear.forEach(r => {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = null;
        }
      });
      colsToClear.forEach(c => {
        for (let r = 0; r < ROWS; r++) {
          board[r][c] = null;
        }
      });
    }, 150);

    cleared = rowsToClear.length + colsToClear.length;

    // Sound
    if (cleared >= 3) {
      SFX.levelUp();
    } else {
      SFX.powerup();
    }

    return cleared;
  }

  function spawnStarBurst(x, y) {
    const colors = ['#ffd700', '#ffaa00', '#ff8800', '#fff', '#00f0ff'];
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 / 4) * i + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2;
      starParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 25 + Math.random() * 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 2,
      });
    }
  }

  // Check if any of the remaining pieces can be placed
  function canAnyPieceFit() {
    for (let i = 0; i < pieces.length; i++) {
      if (!pieces[i]) continue;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (canPlace(pieces[i], r, c)) return true;
        }
      }
    }
    return false;
  }

  // ========== DRAWING ==========

  function drawCell(x, y, size, color, glow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha || 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, size - 2, size - 2, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 3, y + 3, size - 8, 2);
    ctx.fillRect(x + 3, y + 3, 2, size - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 3, y + size - 5, size - 6, 2);
    ctx.fillRect(x + size - 5, y + 3, 2, size - 6);
    ctx.restore();
  }

  function drawPrePlacedCell(x, y, size) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.shadowColor = '#8888bb';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#3a3a6e';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, size - 2, size - 2, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Cross-hatch pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < size; i += 5) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x, y + i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + size - i, y + size); ctx.lineTo(x + size, y + size - i); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    // Clear
    ctx.fillStyle = 'rgba(10, 10, 46, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
    }

    // Draw board cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          // Check for clear effect flash
          const effect = clearEffects.find(e => e.row === r && e.col === c);
          let alpha = 1;
          if (effect) {
            alpha = effect.frame % 4 < 2 ? 1 : 0.2;
          }

          if (board[r][c].prePlaced) {
            drawPrePlacedCell(c * CELL, r * CELL, CELL);
          } else {
            drawCell(c * CELL, r * CELL, CELL, board[r][c].color, board[r][c].glow, alpha);
          }
        }
      }
    }

    // Draw ghost (preview of where piece will be placed)
    if (ghostPos && selectedPiece >= 0 && pieces[selectedPiece]) {
      const piece = pieces[selectedPiece];
      const valid = canPlace(piece, ghostPos.row, ghostPos.col);
      piece.blocks.forEach(([br, bc]) => {
        const r = br + ghostPos.row;
        const c = bc + ghostPos.col;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          ctx.save();
          ctx.globalAlpha = valid ? 0.4 : 0.15;
          ctx.strokeStyle = valid ? piece.color : '#ff4444';
          ctx.lineWidth = 2;
          ctx.shadowColor = valid ? piece.color : '#ff4444';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4, 3);
          ctx.stroke();
          if (valid) {
            ctx.fillStyle = piece.color;
            ctx.globalAlpha = 0.15;
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // Star particles
    starParticles.forEach(p => {
      ctx.save();
      const progress = p.life / p.maxLife;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ========== GAME LOOP ==========

  let animFrame;

  function gameStep() {
    // Update clear effects
    clearEffects.forEach(e => e.frame++);
    clearEffects = clearEffects.filter(e => e.frame < e.maxFrames);

    // Update star particles
    starParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life++;
    });
    starParticles = starParticles.filter(p => p.life < p.maxLife);

    draw();

    if (running) {
      animFrame = requestAnimationFrame(gameStep);
    }
  }

  // ========== INTERACTION: MOUSE & TOUCH ==========

  let isDragging = false;

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    updateGhost(row, col);
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if (ghostPos && selectedPiece >= 0 && pieces[selectedPiece]) {
      tryPlace();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (selectedPiece < 0 || !running) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    updateGhost(row, col);
  });

  canvas.addEventListener('click', (e) => {
    if (selectedPiece < 0 || !running) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    updateGhost(row, col);
    tryPlace();
  });

  // Touch support for mobile
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (selectedPiece < 0 || !running) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    updateGhost(row, col);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (ghostPos && selectedPiece >= 0 && pieces[selectedPiece]) {
      tryPlace();
    }
  });

  function updateGhost(row, col) {
    if (selectedPiece < 0 || !pieces[selectedPiece]) return;
    const piece = pieces[selectedPiece];
    // Center piece on cursor
    const minR = Math.min(...piece.blocks.map(b => b[0]));
    const minC = Math.min(...piece.blocks.map(b => b[1]));
    const maxR = Math.max(...piece.blocks.map(b => b[0]));
    const maxC = Math.max(...piece.blocks.map(b => b[1]));
    const centerR = Math.floor((maxR - minR) / 2);
    const centerC = Math.floor((maxC - minC) / 2);
    ghostPos = { row: row - centerR, col: col - centerC };
  }

  function tryPlace() {
    if (selectedPiece < 0 || !pieces[selectedPiece] || !ghostPos) return;
    const piece = pieces[selectedPiece];

    if (canPlace(piece, ghostPos.row, ghostPos.col)) {
      placePiece(piece, ghostPos.row, ghostPos.col);
      pieces[selectedPiece] = null;

      // Check for line clears
      const cleared = clearLines();
      if (cleared > 0) {
        stars += cleared;
        starsEl.textContent = stars;
        totalStars += cleared;
      }

      selectedPiece = -1;
      ghostPos = null;

      // Check if all 3 pieces used — refill
      if (pieces.every(p => p === null)) {
        refillTray();
      } else {
        renderTray();
      }

      // Check if target reached
      if (stars >= targetStars) {
        setTimeout(() => levelComplete(), 300);
        return;
      }

      // Check if any remaining piece can fit
      if (!canAnyPieceFit()) {
        setTimeout(() => gameOver(), 500);
      }
    } else {
      SFX.hit();
      // Flash red briefly on canvas
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // ========== KEYBOARD CONTROLS ==========

  let kbRow = 0, kbCol = 0;

  document.addEventListener('keydown', (e) => {
    if (!running) return;

    switch (e.key) {
      case '1': selectedPiece = pieces[0] ? 0 : selectedPiece; renderTray(); SFX.step(); e.preventDefault(); break;
      case '2': selectedPiece = pieces[1] ? 1 : selectedPiece; renderTray(); SFX.step(); e.preventDefault(); break;
      case '3': selectedPiece = pieces[2] ? 2 : selectedPiece; renderTray(); SFX.step(); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A':
        kbCol = Math.max(0, kbCol - 1);
        updateGhost(kbRow, kbCol);
        SFX.step();
        e.preventDefault();
        break;
      case 'ArrowRight': case 'd': case 'D':
        kbCol = Math.min(COLS - 1, kbCol + 1);
        updateGhost(kbRow, kbCol);
        SFX.step();
        e.preventDefault();
        break;
      case 'ArrowUp': case 'w': case 'W':
        kbRow = Math.max(0, kbRow - 1);
        updateGhost(kbRow, kbCol);
        SFX.step();
        e.preventDefault();
        break;
      case 'ArrowDown': case 's': case 'S':
        kbRow = Math.min(ROWS - 1, kbRow + 1);
        updateGhost(kbRow, kbCol);
        SFX.step();
        e.preventDefault();
        break;
      case ' ': case 'Enter':
        tryPlace();
        e.preventDefault();
        break;
    }
  });

  // ========== GAME FLOW ==========

  function initLevel() {
    board = createBoard();
    stars = 0;
    targetStars = getTargetForLevel(level);
    clearEffects = [];
    starParticles = [];
    kbRow = 4;
    kbCol = 4;

    // Place pre-placed obstacle blocks
    prePlaced = generatePrePlaced(level);
    prePlaced.forEach(([r, c]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        board[r][c] = { color: '#3a3a6e', glow: 'rgba(58,58,110,0.3)', prePlaced: true };
      }
    });

    levelEl.textContent = level;
    starsEl.textContent = stars;
    targetEl.textContent = targetStars;

    refillTray();
  }

  function startGame() {
    level = 1;
    totalStars = 0;
    initLevel();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    levelOverlay.classList.add('hidden');
    running = true;
    animFrame = requestAnimationFrame(gameStep);
    document.activeElement && document.activeElement.blur();
  }

  function levelComplete() {
    running = false;
    cancelAnimationFrame(animFrame);
    SFX.levelUp();

    // Big star burst in center
    for (let i = 0; i < 30; i++) {
      spawnStarBurst(canvas.width / 2, canvas.height / 2);
    }
    // One more draw to show particles
    draw();

    levelText.innerHTML = `⭐ You earned <span class="highlight">${stars}</span> stars on Level <span class="highlight">${level}</span>!`;
    levelOverlay.classList.remove('hidden');
  }

  function nextLevel() {
    level++;
    if (level > highLevel) {
      highLevel = level;
      highScoreEl.textContent = highLevel;
      localStorage.setItem('blockBlastHighLevel', highLevel);
    }
    levelOverlay.classList.add('hidden');
    initLevel();
    running = true;
    animFrame = requestAnimationFrame(gameStep);
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animFrame);
    SFX.hit();
    setTimeout(() => SFX.gameOver(), 200);

    if (level > highLevel) {
      highLevel = level;
      highScoreEl.textContent = highLevel;
      localStorage.setItem('blockBlastHighLevel', highLevel);
    }

    gameoverText.innerHTML = `You reached Level <span class="highlight">${level}</span> with <span class="highlight">${totalStars}</span> total ⭐${level > highLevel ? '  🏆 New Best!' : ''}`;
    gameoverOverlay.classList.remove('hidden');
  }

  // ========== BUTTONS ==========
  startBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', startGame);
  nextBtn.addEventListener('click', nextLevel);

  // Initial draw
  initLevel();
  draw();

  // Auto-start if launched from Lobby
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('room')) {
    setTimeout(startGame, 500);
  }
})();
