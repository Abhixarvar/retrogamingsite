/* ===== Space Troopers — Galactic Shooter ===== */
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const livesEl = document.getElementById('lives');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverText = document.getElementById('gameover-text');
  const waveOverlay = document.getElementById('wave-overlay');
  const waveTitle = document.getElementById('wave-title');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');

  const W = canvas.width;
  const H = canvas.height;

  // ---- STATE ----
  let player, bullets, enemies, particles, powerups;
  let score, wave, lives, running, keys, lastShot;
  let enemySpeed, enemySpawnTimer, enemySpawnRate;
  let frameId, shakeTimer, shakeMag;
  let highScore = parseInt(localStorage.getItem('spaceTroopersHigh') || '0');

  // ---- COLORS ----
  const COLORS = {
    player: '#00f0ff',
    bullet: '#ffd700',
    enemyBullet: '#ff4444',
    enemies: ['#ff4444', '#ff6b9d', '#b44aff', '#ff8800', '#ff3366'],
    particle: ['#ff4444', '#ff8800', '#ffd700', '#ff6b9d', '#00f0ff', '#b44aff'],
    shield: '#00ff88',
    rapid: '#ffd700',
  };

  // ---- PLAYER SHIP ----
  function createPlayer() {
    return {
      x: W / 2,
      y: H - 60,
      w: 36,
      h: 40,
      speed: 4.5,
      fireRate: 150,
      shieldTimer: 0,
      rapidTimer: 0,
      thrusterPhase: 0,
    };
  }

  // ---- INIT ----
  function init() {
    player = createPlayer();
    bullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    score = 0;
    wave = 1;
    lives = 3;
    running = false;
    keys = {};
    lastShot = 0;
    enemySpeed = 0.6;
    enemySpawnRate = 900;
    enemySpawnTimer = 0;
    shakeTimer = 0;
    shakeMag = 0;
    scoreEl.textContent = '0';
    waveEl.textContent = '1';
    livesEl.textContent = '♥'.repeat(3);
  }

  // ---- ENEMIES ----
  function spawnEnemy() {
    const type = Math.random();
    let enemy;
    if (type < 0.12 && wave >= 3) {
      // Heavy enemy — big, slow, more HP
      enemy = {
        x: 40 + Math.random() * (W - 80),
        y: -50,
        w: 44, h: 44,
        hp: 3, maxHp: 3,
        speed: enemySpeed * 0.5,
        color: COLORS.enemies[2],
        type: 'heavy',
        canShoot: true,
        shootTimer: 1200 + Math.random() * 1500,
        phase: Math.random() * Math.PI * 2,
        points: 30,
      };
    } else if (type < 0.3) {
      // Fast enemy — small, quicker
      enemy = {
        x: 30 + Math.random() * (W - 60),
        y: -30,
        w: 24, h: 24,
        hp: 1, maxHp: 1,
        speed: enemySpeed * 1.2,
        color: COLORS.enemies[3],
        type: 'fast',
        canShoot: false,
        phase: Math.random() * Math.PI * 2,
        points: 15,
      };
    } else {
      // Standard enemy
      enemy = {
        x: 30 + Math.random() * (W - 60),
        y: -36,
        w: 32, h: 32,
        hp: 1 + (wave >= 5 ? 1 : 0),
        maxHp: 1 + (wave >= 5 ? 1 : 0),
        speed: enemySpeed,
        color: COLORS.enemies[Math.floor(Math.random() * 3)],
        type: 'standard',
        canShoot: wave >= 2,
        shootTimer: 2000 + Math.random() * 2500,
        phase: Math.random() * Math.PI * 2,
        points: 10,
      };
    }
    enemies.push(enemy);
  }

  // ---- POWERUPS ----
  function spawnPowerup(x, y) {
    if (Math.random() > 0.18) return;
    const type = Math.random() < 0.5 ? 'shield' : 'rapid';
    powerups.push({
      x, y, w: 18, h: 18,
      speed: 1.2,
      type,
      color: type === 'shield' ? COLORS.shield : COLORS.rapid,
      pulse: 0,
    });
  }

  // ---- PARTICLES ----
  function emitExplosion(x, y, count, colors) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 30,
        maxLife: 30 + Math.random() * 30,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function emitThruster(x, y) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 2 + Math.random() * 2,
        life: 15 + Math.random() * 10,
        maxLife: 15 + Math.random() * 10,
        size: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#00f0ff' : '#0088cc',
      });
    }
  }

  // ---- COLLISION ----
  function rectCollide(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  function triggerShake(duration, magnitude) {
    shakeTimer = duration;
    shakeMag = magnitude;
  }

  // ---- WAVE SYSTEM ----
  let lastTime = 0;
  let waveEnemiesRemaining = 0;
  let waveEnemiesSpawned = 0;
  let waveEnemyTotal = 0;
  let betweenWaves = false;
  let betweenWaveTimer = 0;

  function startWave(num) {
    wave = num;
    waveEl.textContent = wave;
    enemySpeed = 0.6 + (wave - 1) * 0.12;
    enemySpawnRate = Math.max(350, 900 - (wave - 1) * 60);
    waveEnemyTotal = 10 + wave * 4;
    waveEnemiesSpawned = 0;
    waveEnemiesRemaining = waveEnemyTotal;
    enemySpawnTimer = 0;
    betweenWaves = false;
  }

  // ---- UPDATE ----
  function update(timestamp) {
    if (!running) return;
    const dt = Math.min(timestamp - lastTime, 33);
    lastTime = timestamp;

    // --- Between waves ---
    if (betweenWaves) {
      betweenWaveTimer -= dt;
      if (betweenWaveTimer <= 0) {
        waveOverlay.classList.add('hidden');
        startWave(wave + 1);
      }
      draw();
      frameId = requestAnimationFrame(update);
      return;
    }

    // --- Spawn enemies ---
    if (waveEnemiesSpawned < waveEnemyTotal) {
      enemySpawnTimer -= dt;
      if (enemySpawnTimer <= 0) {
        spawnEnemy();
        waveEnemiesSpawned++;
        enemySpawnTimer = enemySpawnRate;
      }
    }

    // --- Player movement ---
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) player.y -= player.speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += player.speed;
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
    player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));

    // --- Shooting (auto-fire while holding Space) ---
    const fireRate = player.rapidTimer > 0 ? 60 : player.fireRate;
    if (keys[' '] && timestamp - lastShot >= fireRate) {
      lastShot = timestamp;
      SFX.shoot();
      if (player.rapidTimer > 0) {
        bullets.push({ x: player.x, y: player.y - player.h / 2, vx: 0, vy: -9, isPlayer: true, w: 6, h: 14 });
        bullets.push({ x: player.x - 12, y: player.y - player.h / 2 + 5, vx: -0.6, vy: -9, isPlayer: true, w: 6, h: 14 });
        bullets.push({ x: player.x + 12, y: player.y - player.h / 2 + 5, vx: 0.6, vy: -9, isPlayer: true, w: 6, h: 14 });
      } else {
        bullets.push({ x: player.x, y: player.y - player.h / 2, vx: 0, vy: -9, isPlayer: true, w: 6, h: 14 });
      }
    }

    // --- Powerup timers ---
    if (player.shieldTimer > 0) player.shieldTimer -= dt;
    if (player.rapidTimer > 0) player.rapidTimer -= dt;
    player.thrusterPhase += dt * 0.01;

    emitThruster(player.x, player.y + player.h / 2);

    // --- Update bullets ---
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
      }
    }

    // --- Update enemies ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.phase += 0.015;
      e.y += e.speed;
      if (e.type === 'fast') {
        e.x += Math.sin(e.phase) * 1.5;
      } else {
        e.x += Math.sin(e.phase) * 0.8;
      }
      e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));

      // Enemy shooting
      if (e.canShoot) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const bSpeed = 3;
            bullets.push({
              x: e.x, y: e.y + e.h / 2,
              vx: (dx / dist) * bSpeed,
              vy: (dy / dist) * bSpeed,
              isPlayer: false, w: 8, h: 8,
            });
          }
          e.shootTimer = 2500 + Math.random() * 2500;
        }
      }

      // Off-screen removal
      if (e.y > H + 60) {
        enemies.splice(i, 1);
        waveEnemiesRemaining--;
      }
    }

    // --- Bullet → Enemy collisions ---
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (!b.isPlayer) continue;
      let hit = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        // Generous collision: bullet rect vs enemy rect
        if (rectCollide(
          { x: b.x, y: b.y, w: b.w + 4, h: b.h + 4 },
          { x: e.x, y: e.y, w: e.w, h: e.h }
        )) {
          bullets.splice(bi, 1);
          e.hp--;
          if (e.hp <= 0) {
            score += e.points;
            scoreEl.textContent = score;
            emitExplosion(e.x, e.y, 22, COLORS.particle);
            triggerShake(8, 4);
            SFX.explode();
            spawnPowerup(e.x, e.y);
            enemies.splice(ei, 1);
            waveEnemiesRemaining--;
          } else {
            emitExplosion(b.x, b.y, 6, ['#fff', e.color]);
            SFX.eat();
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // --- Enemy bullet → Player collisions ---
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.isPlayer) continue;
      if (rectCollide(
        { x: b.x, y: b.y, w: b.w, h: b.h },
        { x: player.x, y: player.y, w: player.w * 0.7, h: player.h * 0.7 }
      )) {
        bullets.splice(bi, 1);
        if (player.shieldTimer <= 0) {
          hitPlayer();
        } else {
          emitExplosion(b.x, b.y, 8, [COLORS.shield]);
        }
      }
    }

    // --- Enemy → Player collisions ---
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (rectCollide(
        { x: player.x, y: player.y, w: player.w * 0.6, h: player.h * 0.6 },
        { x: e.x, y: e.y, w: e.w, h: e.h }
      )) {
        emitExplosion(e.x, e.y, 22, COLORS.particle);
        SFX.explode();
        enemies.splice(ei, 1);
        waveEnemiesRemaining--;
        if (player.shieldTimer <= 0) {
          hitPlayer();
        }
      }
    }

    // --- Powerups ---
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.speed;
      p.pulse += dt * 0.005;
      if (p.y > H + 20) { powerups.splice(i, 1); continue; }
      if (rectCollide(
        { x: player.x, y: player.y, w: player.w, h: player.h },
        { x: p.x, y: p.y, w: p.w * 2.5, h: p.h * 2.5 }
      )) {
        if (p.type === 'shield') player.shieldTimer = 5000;
        else player.rapidTimer = 5000;
        emitExplosion(p.x, p.y, 10, [p.color, '#fff']);
        SFX.powerup();
        powerups.splice(i, 1);
      }
    }

    // --- Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (shakeTimer > 0) shakeTimer--;

    // --- Wave complete ---
    if (waveEnemiesRemaining <= 0 && waveEnemiesSpawned >= waveEnemyTotal && !betweenWaves) {
      betweenWaves = true;
      betweenWaveTimer = 2000;
      waveTitle.textContent = `Wave ${wave} Clear!`;
      waveOverlay.classList.remove('hidden');
      SFX.levelUp();
    }

    draw();
    frameId = requestAnimationFrame(update);
  }

  function hitPlayer() {
    lives--;
    livesEl.textContent = lives > 0 ? '♥'.repeat(lives) : '✕';
    emitExplosion(player.x, player.y, 30, COLORS.particle);
    triggerShake(14, 7);
    SFX.hit();
    if (lives <= 0) {
      gameOver();
    } else {
      player.shieldTimer = 2000;
    }
  }

  // ---- DRAW ----
  function draw() {
    ctx.save();
    if (shakeTimer > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakeMag * 2,
        (Math.random() - 0.5) * shakeMag * 2
      );
    }

    ctx.fillStyle = 'rgba(10, 10, 46, 0.92)';
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // --- Particles ---
    particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // --- Powerups ---
    powerups.forEach(p => {
      ctx.save();
      const pulse = 1 + Math.sin(p.pulse * 4) * 0.15;
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.h);
      ctx.lineTo(p.w, 0);
      ctx.lineTo(0, p.h);
      ctx.lineTo(-p.w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0a0a2e';
      ctx.font = 'bold 10px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type === 'shield' ? 'S' : 'R', 0, 1);
      ctx.restore();
    });

    // --- Enemies ---
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = e.color;

      if (e.type === 'heavy') {
        drawHexagon(ctx, 0, 0, e.w / 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(10, 10, 46, 0.5)';
        drawHexagon(ctx, 0, 0, e.w / 4);
        ctx.fill();
        if (e.hp < e.maxHp) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(-e.w / 2, e.h / 2 + 4, e.w, 3);
          ctx.fillStyle = e.color;
          ctx.fillRect(-e.w / 2, e.h / 2 + 4, e.w * (e.hp / e.maxHp), 3);
        }
      } else if (e.type === 'fast') {
        ctx.beginPath();
        ctx.moveTo(0, e.h / 2);
        ctx.lineTo(-e.w / 2, -e.h / 2);
        ctx.lineTo(e.w / 2, -e.h / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -e.h / 2);
        ctx.lineTo(e.w / 2, 0);
        ctx.lineTo(0, e.h / 2);
        ctx.lineTo(-e.w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(10,10,46,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        if (e.hp > 1 && e.hp < e.maxHp) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(-e.w / 2, e.h / 2 + 4, e.w, 3);
          ctx.fillStyle = e.color;
          ctx.fillRect(-e.w / 2, e.h / 2 + 4, e.w * (e.hp / e.maxHp), 3);
        }
      }
      ctx.restore();
    });

    // --- Bullets ---
    bullets.forEach(b => {
      ctx.save();
      if (b.isPlayer) {
        ctx.shadowColor = COLORS.bullet;
        ctx.shadowBlur = 10;
        ctx.fillStyle = COLORS.bullet;
        ctx.fillRect(b.x - 2.5, b.y - 7, 5, 14);
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 1, b.y - 5, 2, 10);
      } else {
        ctx.shadowColor = COLORS.enemyBullet;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.enemyBullet;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // --- Player Ship ---
    if (lives > 0) {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Shield bubble
      if (player.shieldTimer > 0) {
        ctx.save();
        const flicker = player.shieldTimer < 1000 ? (Math.sin(Date.now() * 0.02) * 0.3 + 0.4) : 0.35;
        ctx.globalAlpha = flicker;
        ctx.strokeStyle = COLORS.shield;
        ctx.shadowColor = COLORS.shield;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, player.w * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Rapid fire glow
      if (player.rapidTimer > 0) {
        ctx.save();
        const glow = Math.sin(Date.now() * 0.01) * 0.3 + 0.5;
        ctx.globalAlpha = glow;
        ctx.fillStyle = COLORS.rapid;
        ctx.shadowColor = COLORS.rapid;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, -player.h / 2 - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Ship
      ctx.shadowColor = COLORS.player;
      ctx.shadowBlur = 15;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.moveTo(0, -player.h / 2);
      ctx.lineTo(-player.w / 2, player.h / 2 - 4);
      ctx.lineTo(-player.w / 4, player.h / 4);
      ctx.lineTo(0, player.h / 2);
      ctx.lineTo(player.w / 4, player.h / 4);
      ctx.lineTo(player.w / 2, player.h / 2 - 4);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#0a0a2e';
      ctx.beginPath();
      ctx.ellipse(0, -4, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, -5, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-player.w / 3, player.h / 3 - 2);
      ctx.lineTo(-6, -player.h / 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(player.w / 3, player.h / 3 - 2);
      ctx.lineTo(6, -player.h / 6);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  function drawHexagon(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ---- GAME OVER ----
  function gameOver() {
    running = false;
    cancelAnimationFrame(frameId);
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('spaceTroopersHigh', highScore);
    }
    SFX.gameOver();
    gameoverText.innerHTML = `Score: <span class="highlight">${score}</span>  ·  Wave ${wave}${score >= highScore && score > 0 ? '  ⭐ New Best!' : ''}`;
    gameoverOverlay.classList.remove('hidden');
  }

  // ---- START ----
  function startGame() {
    init();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    waveOverlay.classList.add('hidden');
    running = true;
    startWave(1);
    lastTime = performance.now();
    lastShot = performance.now();
    frameId = requestAnimationFrame(update);
    // Remove focus from button so Space doesn't re-trigger start
    document.activeElement && document.activeElement.blur();
  }

  // ---- CONTROLS ----
  document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
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
