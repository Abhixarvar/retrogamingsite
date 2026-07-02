/* ===== Game Card Preview Renderer ===== */
/* Draws static game screenshots on the home-page card canvases */
(function () {
  const BG = '#0a0a2e';

  // ---- Utility ----
  function star(ctx, cx, cy, spikes, outerR, innerR, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
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
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ==== SNAKE PREVIEW ====
  function drawSnake(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const GRID = 15;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Snake body
    const snake = [
      { x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 },
      { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 4, y: 7 },
      { x: 5, y: 7 }, { x: 6, y: 7 },
    ];
    const headColor = '#00f0ff';
    const bodyColors = ['#00c9ff', '#00a8e8', '#0088cc', '#0068aa'];

    snake.forEach((seg, i) => {
      const sx = seg.x * GRID;
      const sy = seg.y * GRID;
      if (i === 0) {
        ctx.save();
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, GRID - 2, GRID - 2, 4);
        ctx.fill();
        ctx.restore();
        // Eyes
        ctx.fillStyle = BG;
        ctx.fillRect(sx + GRID - 5, sy + 3, 2, 2);
        ctx.fillRect(sx + GRID - 5, sy + GRID - 5, 2, 2);
      } else {
        const ratio = i / snake.length;
        const ci = Math.min(Math.floor(ratio * bodyColors.length), bodyColors.length - 1);
        ctx.save();
        ctx.globalAlpha = 1 - ratio * 0.5;
        ctx.shadowColor = bodyColors[ci];
        ctx.shadowBlur = 5;
        ctx.fillStyle = bodyColors[ci];
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, GRID - 4, GRID - 4, 3);
        ctx.fill();
        ctx.restore();
      }
    });

    // Food star
    star(ctx, 12 * GRID + GRID / 2, 5 * GRID + GRID / 2, 5, 5, 2.5, '#ffd700');
  }

  // ==== PACMAN PREVIEW ====
  function drawPacman(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const T = 14; // tile size for preview

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Simple maze walls
    const walls = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
      [0,1,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,0],
      [0,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,0],
      [0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0],
      [0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const offX = Math.floor((W - 20 * T) / 2);
    const offY = Math.floor((H - 9 * T) / 2);

    // Draw walls and dots
    for (let r = 0; r < walls.length; r++) {
      for (let c = 0; c < walls[0].length; c++) {
        const x = offX + c * T;
        const y = offY + r * T;
        if (walls[r][c] === 1) {
          ctx.fillStyle = '#1a1a5e';
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = '#3333aa';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        } else {
          // Dot
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(x + T / 2, y + T / 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Power pellets
    [[1, 1], [18, 1], [1, 7], [18, 7]].forEach(([c, r]) => {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(offX + c * T + T / 2, offY + r * T + T / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Pac-Man
    const px = offX + 10 * T + T / 2;
    const py = offY + 5 * T + T / 2;
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(px, py, T / 2 + 1, 0.25, Math.PI * 2 - 0.25);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Ghosts
    const ghostColors = ['#ff4444', '#ffb8ff', '#00ffff'];
    const ghostPositions = [[6, 3], [13, 3], [8, 6]];
    ghostPositions.forEach(([gc, gr], gi) => {
      const gx = offX + gc * T + T / 2;
      const gy = offY + gr * T + T / 2;
      ctx.save();
      ctx.shadowColor = ghostColors[gi];
      ctx.shadowBlur = 6;
      ctx.fillStyle = ghostColors[gi];
      ctx.beginPath();
      ctx.arc(gx, gy - 1, T / 2, Math.PI, 0);
      ctx.lineTo(gx + T / 2, gy + T / 2 - 2);
      ctx.lineTo(gx + T / 3, gy + T / 3);
      ctx.lineTo(gx, gy + T / 2 - 2);
      ctx.lineTo(gx - T / 3, gy + T / 3);
      ctx.lineTo(gx - T / 2, gy + T / 2 - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(gx - 2, gy - 2, 2, 0, Math.PI * 2);
      ctx.arc(gx + 2, gy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(gx - 1, gy - 2, 1, 0, Math.PI * 2);
      ctx.arc(gx + 3, gy - 2, 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ==== SPACE TROOPERS PREVIEW ====
  function drawTroopers(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Enemies — row of diamonds
    const enemyColors = ['#ff4444', '#ff6b9d', '#b44aff', '#ff8800', '#ff3366'];
    const enemyPositions = [
      { x: 60, y: 30 }, { x: 110, y: 25 }, { x: 160, y: 35 },
      { x: 210, y: 28 }, { x: 80, y: 65 }, { x: 140, y: 70 },
      { x: 200, y: 60 },
    ];
    enemyPositions.forEach((e, i) => {
      ctx.save();
      ctx.translate(e.x, e.y);
      const c = enemyColors[i % enemyColors.length];
      ctx.shadowColor = c;
      ctx.shadowBlur = 8;
      ctx.fillStyle = c;
      const s = 12;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(10,10,46,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Bullets flying upward
    const bulletYs = [85, 60, 35, 105];
    bulletYs.forEach(by => {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(W / 2 - 2, by, 4, 10);
      ctx.fillStyle = '#fff';
      ctx.fillRect(W / 2 - 0.5, by + 1, 1, 8);
      ctx.restore();
    });

    // Player ship at bottom
    const px = W / 2, py = H - 20;
    ctx.save();
    ctx.translate(px, py);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-14, 12);
    ctx.lineTo(-7, 5);
    ctx.lineTo(0, 16);
    ctx.lineTo(7, 5);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    // Cockpit
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.ellipse(0, -2, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,240,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, -3, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Thruster particles
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.random() * 0.3;
      ctx.fillStyle = i % 2 === 0 ? '#00f0ff' : '#0088cc';
      ctx.beginPath();
      ctx.arc(
        px + (Math.random() - 0.5) * 6,
        py + 18 + Math.random() * 8,
        1.5 + Math.random() * 1.5,
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Explosion particles near one enemy
    const expX = 80, expY = 65;
    const expColors = ['#ff4444', '#ff8800', '#ffd700', '#ff6b9d'];
    for (let i = 0; i < 12; i++) {
      ctx.save();
      const angle = (Math.PI * 2 / 12) * i;
      const dist = 6 + Math.random() * 10;
      ctx.globalAlpha = 0.5 + Math.random() * 0.4;
      ctx.fillStyle = expColors[i % expColors.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(expX + Math.cos(angle) * dist, expY + Math.sin(angle) * dist, 1.5 + Math.random(), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==== TETRIS PREVIEW ====
  function drawTetris(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const T = 12; // tile size for preview
    const boardCols = 10;
    const boardRows = 11;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const offX = Math.floor((W - boardCols * T) / 2);
    const offY = H - boardRows * T - 5;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= boardCols; x++) {
      ctx.beginPath(); ctx.moveTo(offX + x * T, offY); ctx.lineTo(offX + x * T, offY + boardRows * T); ctx.stroke();
    }
    for (let y = 0; y <= boardRows; y++) {
      ctx.beginPath(); ctx.moveTo(offX, offY + y * T); ctx.lineTo(offX + boardCols * T, offY + y * T); ctx.stroke();
    }

    // Locked blocks — a visually interesting mid-game board
    const colors = {
      I: '#00f0ff', O: '#ffd700', T: '#b44aff',
      S: '#00ff88', Z: '#ff4444', J: '#4488ff', L: '#ff8800',
    };

    // Row data: each char = piece type, '.' = empty
    const boardData = [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '......S...',
      '.....SS...',
      'JJ..LS....',
      'J..LLLOOZZ',
      'JIITTOOIZZ',
      'JIISTTIIIZ',
    ];

    boardData.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '.') {
          const color = colors[row[c]] || '#888';
          const x = offX + c * T;
          const y = offY + r * T;

          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
          ctx.fill();

          // Highlight
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x + 2, y + 2, T - 5, 1);
          ctx.restore();
        }
      }
    });

    // Falling T-piece
    const tBlocks = [[3,3],[4,3],[5,3],[4,4]];
    tBlocks.forEach(([bx, by]) => {
      const x = offX + bx * T;
      const y = offY + by * T;
      ctx.save();
      ctx.shadowColor = '#b44aff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#b44aff';
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 2, y + 2, T - 5, 1);
      ctx.restore();
    });

    // Ghost piece (where the T would land)
    const ghostBlocks = [[3,6],[4,6],[5,6],[4,7]];
    ghostBlocks.forEach(([bx, by]) => {
      const x = offX + bx * T;
      const y = offY + by * T;
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#b44aff';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#b44aff';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
      ctx.stroke();
      ctx.restore();
    });

    // Next piece label area on the right
    const npX = offX + boardCols * T + 12;
    const npY = offY + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '7px Outfit, sans-serif';
    ctx.fillText('NEXT', npX, npY);

    // Next piece: I-piece
    const nextColor = '#00f0ff';
    [[0,0],[1,0],[2,0],[3,0]].forEach(([nx, ny]) => {
      ctx.save();
      ctx.shadowColor = nextColor;
      ctx.shadowBlur = 3;
      ctx.fillStyle = nextColor;
      ctx.beginPath();
      ctx.roundRect(npX + nx * 8, npY + 4 + ny * 8, 7, 7, 1);
      ctx.fill();
      ctx.restore();
    });
  }

  // ==== PONG PREVIEW ====
  function drawPong(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Dashed center line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left paddle (green glow)
    const padW = 8, padH = 50;
    const lx = 30, ly = H / 2 - padH / 2 - 10;
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.roundRect(lx, ly, padW, padH, 4);
    ctx.fill();
    ctx.restore();

    // Right paddle (cyan glow)
    const rx = W - 30 - padW, ry = H / 2 - padH / 2 + 15;
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.roundRect(rx, ry, padW, padH, 4);
    ctx.fill();
    ctx.restore();

    // Ball trail
    const ballPath = [
      { x: W / 2 + 60, y: H / 2 - 20 },
      { x: W / 2 + 40, y: H / 2 - 10 },
      { x: W / 2 + 20, y: H / 2 },
      { x: W / 2, y: H / 2 + 10 },
      { x: W / 2 - 20, y: H / 2 + 20 },
    ];
    ballPath.forEach((p, i) => {
      ctx.save();
      ctx.globalAlpha = 0.1 + (i / ballPath.length) * 0.3;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (i / ballPath.length) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Ball
    const bx = W / 2 + 80, by = H / 2 - 30;
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Scores
    ctx.save();
    ctx.font = '900 28px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
    ctx.fillText('7', W / 2 - 50, 40);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.fillText('5', W / 2 + 50, 40);
    ctx.restore();

    // Spark particles near left paddle
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.random() * 0.4;
      ctx.fillStyle = i % 2 === 0 ? '#00ff88' : '#ffd700';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const dist = 12 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(lx + padW + Math.cos(angle) * dist, ly + padH / 2 + Math.sin(angle) * dist, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==== BLOCK BLAST PREVIEW ====
  function drawBlockBlast(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const T = 12;
    const boardCols = 10;
    const boardRows = 10;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const offX = Math.floor((W - boardCols * T) / 2) - 30;
    const offY = Math.floor((H - boardRows * T) / 2);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= boardCols; x++) {
      ctx.beginPath(); ctx.moveTo(offX + x * T, offY); ctx.lineTo(offX + x * T, offY + boardRows * T); ctx.stroke();
    }
    for (let y = 0; y <= boardRows; y++) {
      ctx.beginPath(); ctx.moveTo(offX, offY + y * T); ctx.lineTo(offX + boardCols * T, offY + y * T); ctx.stroke();
    }

    // Pre-placed obstacle blocks (grey)
    const obstacles = [
      [9,0],[9,1],[9,3],[9,4],[9,6],[9,7],[9,8],
      [8,0],[8,4],[8,7],[8,8],
      [7,3],[7,8],
    ];
    obstacles.forEach(([r, c]) => {
      const x = offX + c * T;
      const y = offY + r * T;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#3a3a6e';
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
      ctx.fill();
      ctx.restore();
    });

    // Placed colored blocks
    const colors = {
      I: '#00f0ff', O: '#ffd700', T: '#b44aff',
      S: '#00ff88', Z: '#ff4444', L: '#ff8800',
    };

    const placed = [
      // Almost-full bottom row (about to clear!)
      { r: 9, c: 2, p: 'I' }, { r: 9, c: 5, p: 'S' }, { r: 9, c: 9, p: 'O' },
      // Some scattered blocks
      { r: 8, c: 1, p: 'T' }, { r: 8, c: 2, p: 'T' }, { r: 8, c: 3, p: 'T' },
      { r: 8, c: 5, p: 'L' }, { r: 8, c: 6, p: 'L' },
      { r: 7, c: 4, p: 'S' }, { r: 7, c: 5, p: 'S' }, { r: 7, c: 6, p: 'Z' }, { r: 7, c: 7, p: 'Z' },
      { r: 6, c: 1, p: 'I' }, { r: 6, c: 2, p: 'I' }, { r: 6, c: 3, p: 'I' },
    ];

    placed.forEach(({ r, c, p }) => {
      const x = offX + c * T;
      const y = offY + r * T;
      const color = colors[p];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 2, y + 2, T - 5, 1);
      ctx.restore();
    });

    // Ghost piece being placed (L-shape)
    const ghostBlocks = [[4,7],[5,7],[5,8],[5,9]];
    ghostBlocks.forEach(([r, c]) => {
      const x = offX + c * T;
      const y = offY + r * T;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, T - 2, T - 2, 2);
      ctx.stroke();
      ctx.fillStyle = '#ff8800';
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.restore();
    });

    // Piece tray on the right side
    const trayX = offX + boardCols * T + 16;
    const trayY = offY + 20;

    // Tray slot 1: T-piece
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY, 40, 28, 4);
    ctx.stroke();
    // T-piece blocks
    [[0,0],[1,0],[2,0],[1,1]].forEach(([bc, br]) => {
      ctx.save();
      ctx.shadowColor = '#b44aff';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#b44aff';
      ctx.beginPath();
      ctx.roundRect(trayX + 6 + bc * 9, trayY + 4 + br * 9, 8, 8, 1);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Tray slot 2: highlighted (selected)
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY + 36, 40, 28, 4);
    ctx.stroke();
    // L-piece (selected, being placed)
    [[0,0],[0,1],[0,2],[1,2]].forEach(([br, bc]) => {
      ctx.save();
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.roundRect(trayX + 6 + bc * 9, trayY + 40 + br * 9, 8, 8, 1);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Tray slot 3: Square
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY + 72, 40, 28, 4);
    ctx.stroke();
    [[0,0],[0,1],[1,0],[1,1]].forEach(([br, bc]) => {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.roundRect(trayX + 10 + bc * 9, trayY + 76 + br * 9, 8, 8, 1);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Star particles near the board (explosions)
    const starColors = ['#ffd700', '#ffaa00', '#ff8800', '#fff'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const dist = 10 + Math.random() * 8;
      const sx = offX + 5 * T + Math.cos(angle) * dist;
      const sy = offY + 9 * T + T / 2 + Math.sin(angle) * dist;
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.fillStyle = starColors[i % starColors.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 + Math.random(), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stars counter label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '7px Outfit, sans-serif';
    ctx.fillText('⭐ 5 / 8', trayX + 2, offY + 12);
  }

  // ---- Render all previews ----
  function renderAll() {
    const pongCanvas = document.getElementById('preview-pong');
    const snakeCanvas = document.getElementById('preview-snake');
    const pacmanCanvas = document.getElementById('preview-pacman');
    const troopersCanvas = document.getElementById('preview-troopers');
    const tetrisCanvas = document.getElementById('preview-tetris');
    const blockblastCanvas = document.getElementById('preview-blockblast');

    if (pongCanvas) drawPong(pongCanvas);
    if (snakeCanvas) drawSnake(snakeCanvas);
    if (pacmanCanvas) drawPacman(pacmanCanvas);
    if (troopersCanvas) drawTroopers(troopersCanvas);
    if (tetrisCanvas) drawTetris(tetrisCanvas);
    if (blockblastCanvas) drawBlockBlast(blockblastCanvas);
  }

  // Render on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
})();

