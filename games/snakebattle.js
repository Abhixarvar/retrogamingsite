/* ===== Snake Battle — Multiplayer Snake Game Engine ===== */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────
  const WIN_SCORE = 3;
  const CANVAS_W = 700;
  const CANVAS_H = 700;
  const GRID = 20;
  const COLS = CANVAS_W / GRID;   // 35
  const ROWS = CANVAS_H / GRID;   // 35
  const TICK_MS = 110;            // ms per game tick
  const FOOD_COUNT = 5;           // number of simultaneous food items
  const INITIAL_LENGTH = 4;
  const BG = '#0a0a2e';

  // Player colors
  const P1_HEAD = '#00ff88';
  const P1_BODY = ['#00dd77', '#00bb66', '#009955', '#007744'];
  const P2_HEAD = '#00f0ff';
  const P2_BODY = ['#00c9ff', '#00a8e8', '#0088cc', '#0068aa'];
  const FOOD_COLORS = ['#ffd700', '#ff6b9d', '#b44aff', '#00ff88', '#ff4466'];

  // ── DOM refs ─────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('snake-hud');
  const canvasWrap = document.getElementById('canvas-wrap');
  const controlsHint = document.getElementById('controls-hint');
  const hudNameL = document.getElementById('hud-name-left');
  const hudNameR = document.getElementById('hud-name-right');
  const hudScoreL = document.getElementById('hud-score-left');
  const hudScoreR = document.getElementById('hud-score-right');

  // Overlays
  const lobbyOverlay = document.getElementById('lobby-overlay');
  const waitingOverlay = document.getElementById('waiting-overlay');
  const connectingOverlay = document.getElementById('connecting-overlay');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const disconnectOverlay = document.getElementById('disconnect-overlay');

  // Lobby
  const createNameInput = document.getElementById('create-name');
  const createBtn = document.getElementById('create-btn');
  const createError = document.getElementById('create-error');
  const joinNameInput = document.getElementById('join-name');
  const joinCodeInput = document.getElementById('join-code');
  const joinBtn = document.getElementById('join-btn');
  const joinError = document.getElementById('join-error');

  // Waiting
  const displayCode = document.getElementById('display-code');
  const roomCodeBox = document.getElementById('room-code-box');
  const cancelWaitBtn = document.getElementById('cancel-wait-btn');

  // Connecting
  const cancelConnectBtn = document.getElementById('cancel-connect-btn');

  // Countdown
  const countdownNum = document.getElementById('countdown-num');

  // Game Over
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverText = document.getElementById('gameover-text');
  const rematchBtn = document.getElementById('rematch-btn');
  const rematchStatus = document.getElementById('rematch-status');

  // Disconnect
  const backLobbyBtn = document.getElementById('back-lobby-btn');

  // ── State ────────────────────────────────────────────
  let peer = null;
  let conn = null;
  let isHost = false;
  let myName = '';
  let opponentName = '';
  let roomCode = '';
  let gameRunning = false;
  let tickTimer = null;
  let animFrameId = null;
  let myRematchVote = false;
  let opponentRematchVote = false;
  let roundBannerTimeout = null;

  // Authoritative game state (host manages, guest mirrors)
  let state = null;

  function initState() {
    // P1 starts top-left going right, P2 starts bottom-right going left
    const p1Snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      p1Snake.push({ x: 5 - i, y: 5 });
    }
    const p2Snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      p2Snake.push({ x: COLS - 6 + i, y: ROWS - 6 });
    }

    const s = {
      snakes: [p1Snake, p2Snake],
      dirs: [{ x: 1, y: 0 }, { x: -1, y: 0 }],
      nextDirs: [{ x: 1, y: 0 }, { x: -1, y: 0 }],
      alive: [true, true],
      scores: [0, 0],
      food: [],
      particles: [],
      deathFlash: 0,
      roundCooldown: 0,
    };

    // Spawn food
    for (let i = 0; i < FOOD_COUNT; i++) {
      spawnFood(s);
    }

    return s;
  }

  function spawnFood(s) {
    const occupied = new Set();
    s.snakes.forEach(snake => {
      snake.forEach(seg => occupied.add(seg.x + ',' + seg.y));
    });
    s.food.forEach(f => occupied.add(f.x + ',' + f.y));

    let pos;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (occupied.has(pos.x + ',' + pos.y) && attempts < 200);

    pos.color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)];
    pos.pulse = Math.random() * Math.PI * 2; // animation phase offset
    s.food.push(pos);
  }

  // Input tracking
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.key] = true; });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // ── Helpers ──────────────────────────────────────────
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }
  function hideAll() {
    [lobbyOverlay, waitingOverlay, connectingOverlay, countdownOverlay, gameoverOverlay, disconnectOverlay].forEach(hide);
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ── Networking ───────────────────────────────────────
  function createRoom() {
    const name = createNameInput.value.trim();
    if (!name) { createError.textContent = 'Enter your name!'; return; }
    createError.textContent = '';
    myName = name;
    isHost = true;
    roomCode = generateRoomCode();

    hideAll();
    show(waitingOverlay);
    displayCode.textContent = roomCode;

    peer = new Peer('snkbtl-' + roomCode, { debug: 0 });

    peer.on('open', () => {
      displayCode.textContent = roomCode;
    });

    peer.on('connection', dataConn => {
      conn = dataConn;
      setupConnection();
    });

    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        roomCode = generateRoomCode();
        peer = new Peer('snkbtl-' + roomCode, { debug: 0 });
        displayCode.textContent = roomCode;
        peer.on('open', () => { displayCode.textContent = roomCode; });
        peer.on('connection', dataConn => { conn = dataConn; setupConnection(); });
        peer.on('error', err2 => {
          console.error('PeerJS error:', err2);
          hideAll();
          show(lobbyOverlay);
          createError.textContent = 'Connection error. Try again.';
        });
      } else {
        console.error('PeerJS error:', err);
      }
    });
  }

  function joinRoom() {
    const name = joinNameInput.value.trim();
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!name) { joinError.textContent = 'Enter your name!'; return; }
    if (!code || code.length < 4) { joinError.textContent = 'Enter a valid room code!'; return; }
    joinError.textContent = '';
    myName = name;
    isHost = false;
    roomCode = code;

    hideAll();
    show(connectingOverlay);

    peer = new Peer(undefined, { debug: 0 });

    peer.on('open', () => {
      conn = peer.connect('snkbtl-' + roomCode, { reliable: true });

      conn.on('open', () => {
        setupConnection();
      });

      conn.on('error', () => {
        hideAll();
        show(lobbyOverlay);
        joinError.textContent = 'Could not connect. Check the code.';
        cleanup();
      });
    });

    peer.on('error', err => {
      console.error('PeerJS error:', err);
      hideAll();
      show(lobbyOverlay);
      joinError.textContent = 'Room not found. Check the code.';
      cleanup();
    });

    setTimeout(() => {
      if (!conn || !conn.open) {
        hideAll();
        show(lobbyOverlay);
        joinError.textContent = 'Connection timed out. Try again.';
        cleanup();
      }
    }, 10000);
  }

  function setupConnection() {
    conn.on('open', () => {
      conn.send({ type: 'hello', name: myName });
    });

    if (conn.open) {
      conn.send({ type: 'hello', name: myName });
    }

    conn.on('data', data => {
      handleMessage(data);
    });

    conn.on('close', () => {
      if (gameRunning) {
        gameRunning = false;
        stopTick();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        hideAll();
        show(disconnectOverlay);
      }
    });

    conn.on('error', () => {
      gameRunning = false;
      stopTick();
      if (animFrameId) cancelAnimationFrame(animFrameId);
      hideAll();
      show(disconnectOverlay);
    });
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'hello':
        opponentName = data.name;
        if (isHost) {
          hudNameL.textContent = myName;
          hudNameR.textContent = opponentName;
          conn.send({ type: 'names', host: myName, guest: opponentName });
        }
        startCountdown();
        break;

      case 'names':
        hudNameL.textContent = data.host;
        hudNameR.textContent = data.guest;
        break;

      case 'dir':
        // Guest sends direction input to host
        if (isHost && state) {
          const nd = data.dir;
          const cd = state.dirs[1];
          // Prevent 180° reversal
          if (nd.x !== -cd.x || nd.y !== -cd.y) {
            state.nextDirs[1] = nd;
          }
        }
        break;

      case 'state':
        // Guest receives authoritative state from host
        if (!isHost && state) {
          state.snakes = data.snakes;
          state.dirs = data.dirs;
          state.alive = data.alive;
          state.scores = data.scores;
          state.food = data.food;
          updateHUD();
        }
        break;

      case 'death':
        if (!isHost && state) {
          state.scores = data.scores;
          state.alive = data.alive;
          state.deathFlash = 15;
          updateHUD();
          spawnDeathParticles(data.deathX, data.deathY, data.who);
        }
        break;

      case 'round':
        // New round starting after a death
        if (!isHost) {
          showRoundBanner(data.text);
        }
        break;

      case 'gameover':
        gameRunning = false;
        stopTick();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        showGameOver(data.winner);
        break;

      case 'rematch':
        opponentRematchVote = data.vote;
        if (data.vote) {
          rematchStatus.textContent = opponentName + ' wants a rematch!';
          if (myRematchVote && opponentRematchVote) {
            conn.send({ type: 'rematch-go' });
            startCountdown();
          }
        } else {
          rematchStatus.textContent = opponentName + ' declined.';
          setTimeout(() => {
            hideAll();
            show(lobbyOverlay);
            cleanup();
          }, 2000);
        }
        break;

      case 'rematch-go':
        startCountdown();
        break;

      case 'countdown':
        countdownNum.textContent = data.num;
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
        break;
    }
  }

  function send(data) {
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  function cleanup() {
    if (conn) { try { conn.close(); } catch (e) { } conn = null; }
    if (peer) { try { peer.destroy(); } catch (e) { } peer = null; }
    gameRunning = false;
    stopTick();
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  // ── Countdown ────────────────────────────────────────
  function startCountdown() {
    hideAll();
    show(countdownOverlay);

    hudEl.style.display = '';
    canvasWrap.style.display = '';
    controlsHint.style.display = '';

    state = initState();
    myRematchVote = false;
    opponentRematchVote = false;
    updateHUD();
    drawFrame();

    let count = 3;
    countdownNum.textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
        if (isHost) send({ type: 'countdown', num: count });
      } else if (count === 0) {
        countdownNum.textContent = 'GO!';
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
        if (isHost) send({ type: 'countdown', num: 'GO!' });
      } else {
        clearInterval(interval);
        hideAll();
        startGame();
      }
    }, 800);
  }

  // ── Game Loop ────────────────────────────────────────
  function startGame() {
    gameRunning = true;
    state = initState();
    updateHUD();
    startTick();
    renderLoop();
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(gameTick, TICK_MS);
  }

  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function gameTick() {
    if (!gameRunning || !state) return;

    // ── Gather local input ──
    if (isHost) {
      // Host controls P1 (WASD)
      const cd = state.dirs[0];
      if (keys['w'] || keys['W']) { if (cd.y !== 1) state.nextDirs[0] = { x: 0, y: -1 }; }
      if (keys['s'] || keys['S']) { if (cd.y !== -1) state.nextDirs[0] = { x: 0, y: 1 }; }
      if (keys['a'] || keys['A']) { if (cd.x !== 1) state.nextDirs[0] = { x: -1, y: 0 }; }
      if (keys['d'] || keys['D']) { if (cd.x !== -1) state.nextDirs[0] = { x: 1, y: 0 }; }
    } else {
      // Guest controls P2 (Arrow keys)
      const cd = state.dirs ? state.dirs[1] || { x: -1, y: 0 } : { x: -1, y: 0 };
      let nd = null;
      if (keys['ArrowUp']) { if (cd.y !== 1) nd = { x: 0, y: -1 }; }
      if (keys['ArrowDown']) { if (cd.y !== -1) nd = { x: 0, y: 1 }; }
      if (keys['ArrowLeft']) { if (cd.x !== 1) nd = { x: -1, y: 0 }; }
      if (keys['ArrowRight']) { if (cd.x !== -1) nd = { x: 1, y: 0 }; }
      // Also support WASD for guest
      if (keys['w'] || keys['W']) { if (cd.y !== 1) nd = { x: 0, y: -1 }; }
      if (keys['s'] || keys['S']) { if (cd.y !== -1) nd = { x: 0, y: 1 }; }
      if (keys['a'] || keys['A']) { if (cd.x !== 1) nd = { x: -1, y: 0 }; }
      if (keys['d'] || keys['D']) { if (cd.x !== -1) nd = { x: 1, y: 0 }; }

      if (nd) {
        send({ type: 'dir', dir: nd });
      }
    }

    // Only host runs physics
    if (!isHost) return;

    // Round cooldown (pause after a death before new round)
    if (state.roundCooldown > 0) {
      state.roundCooldown--;
      if (state.roundCooldown === 0) {
        // Reset snakes for new round, keep scores
        const scores = state.scores.slice();
        const food = state.food.slice();
        state = initState();
        state.scores = scores;
        state.food = food;
        // Respawn food to FOOD_COUNT
        while (state.food.length < FOOD_COUNT) {
          spawnFood(state);
        }
        send({
          type: 'state',
          snakes: state.snakes,
          dirs: state.dirs,
          alive: state.alive,
          scores: state.scores,
          food: state.food,
        });
        updateHUD();
      }
      return;
    }

    // Apply directions
    for (let i = 0; i < 2; i++) {
      if (state.alive[i]) {
        state.dirs[i] = state.nextDirs[i];
      }
    }

    // Move snakes
    const newHeads = [];
    for (let i = 0; i < 2; i++) {
      if (!state.alive[i]) { newHeads.push(null); continue; }
      const head = state.snakes[i][0];
      const d = state.dirs[i];
      newHeads.push({ x: head.x + d.x, y: head.y + d.y });
    }

    // Check collisions before applying
    const deaths = [false, false];
    for (let i = 0; i < 2; i++) {
      if (!state.alive[i] || !newHeads[i]) continue;
      const h = newHeads[i];

      // Wall collision
      if (h.x < 0 || h.x >= COLS || h.y < 0 || h.y >= ROWS) {
        deaths[i] = true;
        continue;
      }

      // Self collision (check against own body, excluding tail which will move)
      for (let j = 0; j < state.snakes[i].length - 1; j++) {
        if (state.snakes[i][j].x === h.x && state.snakes[i][j].y === h.y) {
          deaths[i] = true;
          break;
        }
      }

      // Collision with opponent's body (full body, since opponent might also eat food)
      const opp = 1 - i;
      if (state.alive[opp]) {
        for (let j = 0; j < state.snakes[opp].length; j++) {
          if (state.snakes[opp][j].x === h.x && state.snakes[opp][j].y === h.y) {
            deaths[i] = true;
            break;
          }
        }
      }
    }

    // Head-on collision (both die)
    if (newHeads[0] && newHeads[1] &&
        newHeads[0].x === newHeads[1].x && newHeads[0].y === newHeads[1].y) {
      deaths[0] = true;
      deaths[1] = true;
    }

    // Process deaths
    for (let i = 0; i < 2; i++) {
      if (deaths[i] && state.alive[i]) {
        state.alive[i] = false;
        const opp = 1 - i;
        // Award point to opponent (only if opponent is still alive, or head-on = no points)
        if (!deaths[opp]) {
          state.scores[opp]++;
        }
        state.deathFlash = 15;
        const deathPos = newHeads[i] || state.snakes[i][0];
        spawnDeathParticles(deathPos.x * GRID + GRID / 2, deathPos.y * GRID + GRID / 2, i);
        send({
          type: 'death',
          scores: state.scores,
          alive: state.alive,
          who: i,
          deathX: deathPos.x * GRID + GRID / 2,
          deathY: deathPos.y * GRID + GRID / 2,
        });
        updateHUD();
        triggerScoreAnim(opp === 0 ? 'left' : 'right');
      }
    }

    // Check for match win
    for (let i = 0; i < 2; i++) {
      if (state.scores[i] >= WIN_SCORE) {
        gameRunning = false;
        stopTick();
        const winner = i === 0 ? (isHost ? myName : opponentName) : (isHost ? opponentName : myName);
        send({ type: 'gameover', winner });
        showGameOver(winner);
        return;
      }
    }

    // If someone died, start round cooldown
    if (deaths[0] || deaths[1]) {
      state.roundCooldown = 20; // ~2 seconds of cooldown
      const roundNum = state.scores[0] + state.scores[1] + 1;
      const bannerText = deaths[0] && deaths[1] ? 'DOUBLE KO!' : `${state.scores[0]} — ${state.scores[1]}`;
      showRoundBanner(bannerText);
      send({ type: 'round', text: bannerText });
      return;
    }

    // Move surviving snakes and check food
    for (let i = 0; i < 2; i++) {
      if (!state.alive[i] || !newHeads[i]) continue;
      state.snakes[i].unshift(newHeads[i]);

      // Check food consumption
      let ate = false;
      for (let f = state.food.length - 1; f >= 0; f--) {
        if (state.food[f].x === newHeads[i].x && state.food[f].y === newHeads[i].y) {
          state.food.splice(f, 1);
          spawnFood(state);
          ate = true;
          // Spawn eat particles
          spawnEatParticles(newHeads[i].x * GRID + GRID / 2, newHeads[i].y * GRID + GRID / 2, i);
          break;
        }
      }

      if (!ate) {
        state.snakes[i].pop();
      }
    }

    // Broadcast state to guest
    send({
      type: 'state',
      snakes: state.snakes,
      dirs: state.dirs,
      alive: state.alive,
      scores: state.scores,
      food: state.food,
    });
  }

  function renderLoop() {
    if (!gameRunning && !state) return;
    drawFrame();
    // Update particles
    if (state && state.particles) {
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        p.vx *= 0.96;
        p.vy *= 0.96;
        return p.life > 0;
      });
    }
    if (state && state.deathFlash > 0) state.deathFlash--;
    animFrameId = requestAnimationFrame(renderLoop);
  }

  function spawnDeathParticles(x, y, playerIdx) {
    if (!state) return;
    const color = playerIdx === 0 ? P1_HEAD : P2_HEAD;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnEatParticles(x, y, playerIdx) {
    if (!state) return;
    const color = playerIdx === 0 ? '#ffd700' : '#ffd700';
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  function showRoundBanner(text) {
    // Remove old banner
    const old = document.querySelector('.round-banner');
    if (old) old.remove();
    if (roundBannerTimeout) clearTimeout(roundBannerTimeout);

    const banner = document.createElement('div');
    banner.className = 'round-banner';
    banner.textContent = text;
    canvasWrap.style.position = 'relative';
    canvasWrap.appendChild(banner);

    roundBannerTimeout = setTimeout(() => {
      banner.remove();
    }, 1800);
  }

  // ── Renderer ─────────────────────────────────────────
  function drawFrame() {
    if (!state) return;

    ctx.save();

    // Death flash
    if (state.deathFlash > 0) {
      const shake = state.deathFlash * 0.5;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * GRID, 0); ctx.lineTo(x * GRID, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * GRID); ctx.lineTo(CANVAS_W, y * GRID); ctx.stroke();
    }

    // Border walls (glowing)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;
    ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);
    ctx.restore();

    // Background scores
    ctx.save();
    ctx.font = '900 120px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 255, 136, 0.04)';
    ctx.fillText(state.scores[0].toString(), CANVAS_W / 4, CANVAS_H / 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.fillText(state.scores[1].toString(), (CANVAS_W / 4) * 3, CANVAS_H / 2);
    ctx.restore();

    // ── Draw food ──
    const time = Date.now() * 0.003;
    state.food.forEach(f => {
      const fx = f.x * GRID + GRID / 2;
      const fy = f.y * GRID + GRID / 2;
      const pulse = 0.8 + Math.sin(time + (f.pulse || 0)) * 0.2;

      // Glow
      ctx.save();
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = f.color + '40';
      ctx.beginPath();
      ctx.arc(fx, fy, GRID * 0.4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Star shape
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(time * 0.5 + (f.pulse || 0));
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      drawStar(ctx, 0, 0, 5, GRID * 0.35 * pulse, GRID * 0.15 * pulse);
      ctx.restore();
    });

    // ── Draw snakes ──
    for (let p = 0; p < 2; p++) {
      if (!state.snakes[p] || state.snakes[p].length === 0) continue;
      const headColor = p === 0 ? P1_HEAD : P2_HEAD;
      const bodyColors = p === 0 ? P1_BODY : P2_BODY;
      const alive = state.alive[p];
      const dir = state.dirs[p];

      state.snakes[p].forEach((seg, i) => {
        const sx = seg.x * GRID;
        const sy = seg.y * GRID;
        const pad = 1;

        if (!alive) {
          // Dead snake fades
          ctx.save();
          ctx.globalAlpha = 0.3;
        }

        if (i === 0) {
          // Head
          ctx.save();
          ctx.shadowColor = headColor;
          ctx.shadowBlur = alive ? 14 : 4;
          ctx.fillStyle = headColor;
          ctx.beginPath();
          ctx.roundRect(sx + pad, sy + pad, GRID - pad * 2, GRID - pad * 2, 5);
          ctx.fill();
          ctx.restore();

          // Eyes
          if (alive) {
            const eyeSize = 3;
            ctx.fillStyle = BG;
            if (dir.x === 1) {
              ctx.fillRect(sx + GRID - 7, sy + 5, eyeSize, eyeSize);
              ctx.fillRect(sx + GRID - 7, sy + GRID - 8, eyeSize, eyeSize);
            } else if (dir.x === -1) {
              ctx.fillRect(sx + 4, sy + 5, eyeSize, eyeSize);
              ctx.fillRect(sx + 4, sy + GRID - 8, eyeSize, eyeSize);
            } else if (dir.y === -1) {
              ctx.fillRect(sx + 5, sy + 4, eyeSize, eyeSize);
              ctx.fillRect(sx + GRID - 8, sy + 4, eyeSize, eyeSize);
            } else {
              ctx.fillRect(sx + 5, sy + GRID - 7, eyeSize, eyeSize);
              ctx.fillRect(sx + GRID - 8, sy + GRID - 7, eyeSize, eyeSize);
            }
          }
        } else {
          // Body
          const ratio = i / state.snakes[p].length;
          const colorIdx = Math.min(Math.floor(ratio * bodyColors.length), bodyColors.length - 1);
          const alpha = (alive ? 1 : 0.3) - ratio * 0.4;
          ctx.save();
          ctx.globalAlpha = Math.max(0.1, alpha);
          ctx.shadowColor = bodyColors[colorIdx];
          ctx.shadowBlur = alive ? 6 : 2;
          ctx.fillStyle = bodyColors[colorIdx];
          ctx.beginPath();
          ctx.roundRect(sx + pad + 1, sy + pad + 1, GRID - (pad + 1) * 2, GRID - (pad + 1) * 2, 4);
          ctx.fill();
          ctx.restore();
        }

        if (!alive && i === 0) {
          // Death X on head
          ctx.save();
          ctx.strokeStyle = '#ff4466';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(sx + 5, sy + 5);
          ctx.lineTo(sx + GRID - 5, sy + GRID - 5);
          ctx.moveTo(sx + GRID - 5, sy + 5);
          ctx.lineTo(sx + 5, sy + GRID - 5);
          ctx.stroke();
          ctx.restore();
        }

        if (!alive) {
          ctx.restore();
        }
      });
    }

    // ── Particles ──
    if (state.particles) {
      state.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size || 2) * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    ctx.restore();
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

  // ── HUD ──────────────────────────────────────────────
  function updateHUD() {
    if (!state) return;
    hudScoreL.textContent = state.scores[0];
    hudScoreR.textContent = state.scores[1];
  }

  function triggerScoreAnim(side) {
    const el = side === 'left' ? hudScoreL : hudScoreR;
    el.classList.remove('score-bump');
    void el.offsetWidth;
    el.classList.add('score-bump');
  }

  // ── Game Over ────────────────────────────────────────
  function showGameOver(winnerName) {
    hideAll();
    show(gameoverOverlay);

    const isWinner = winnerName === myName;
    gameoverTitle.textContent = isWinner ? '🏆 Victory!' : '💀 Defeat';
    gameoverTitle.style.background = isWinner
      ? 'linear-gradient(135deg, #00ff88, #ffd700)'
      : 'linear-gradient(135deg, #ff4444, #ff6b9d)';
    gameoverTitle.style.webkitBackgroundClip = 'text';
    gameoverTitle.style.webkitTextFillColor = 'transparent';
    gameoverTitle.style.backgroundClip = 'text';

    const p1Name = isHost ? myName : opponentName;
    const p2Name = isHost ? opponentName : myName;
    gameoverText.innerHTML = `<span style="color:${P1_HEAD}">${p1Name}</span> <span class="highlight">${state.scores[0]}</span> — <span class="highlight">${state.scores[1]}</span> <span style="color:${P2_HEAD}">${p2Name}</span>`;

    myRematchVote = false;
    opponentRematchVote = false;
    rematchStatus.textContent = '';
    rematchBtn.style.display = '';
    rematchBtn.textContent = 'Play Again';
    rematchBtn.style.pointerEvents = '';
    rematchBtn.style.opacity = '';
  }

  // ── Rematch ──────────────────────────────────────────
  function handleRematch() {
    myRematchVote = true;
    rematchBtn.textContent = 'Waiting…';
    rematchBtn.style.pointerEvents = 'none';
    rematchBtn.style.opacity = '0.6';
    send({ type: 'rematch', vote: true });
    rematchStatus.textContent = 'Waiting for ' + opponentName + '…';

    if (myRematchVote && opponentRematchVote) {
      if (isHost) send({ type: 'rematch-go' });
      startCountdown();
    }
  }

  // ── Room code copy ───────────────────────────────────
  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      const hint = roomCodeBox.querySelector('.copy-hint');
      hint.textContent = 'Copied!';
      setTimeout(() => { hint.textContent = 'Click to copy'; }, 1500);
    }).catch(() => { });
  }

  // ── Event listeners ──────────────────────────────────
  createBtn.addEventListener('click', createRoom);
  joinBtn.addEventListener('click', joinRoom);

  createNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });
  joinCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  joinNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinCodeInput.focus(); });

  cancelWaitBtn.addEventListener('click', () => {
    hideAll();
    show(lobbyOverlay);
    cleanup();
  });

  cancelConnectBtn.addEventListener('click', () => {
    hideAll();
    show(lobbyOverlay);
    cleanup();
  });

  rematchBtn.addEventListener('click', handleRematch);

  backLobbyBtn.addEventListener('click', () => {
    hideAll();
    show(lobbyOverlay);
    hudEl.style.display = 'none';
    canvasWrap.style.display = 'none';
    controlsHint.style.display = 'none';
    cleanup();
  });

  roomCodeBox.addEventListener('click', copyRoomCode);

  joinCodeInput.addEventListener('input', () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase();
  });

  // Prevent default on game keys so page doesn't scroll
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key) && gameRunning) {
      e.preventDefault();
    }
  });

  // ── Auto-connect from Global Lobby (party.html) ─────
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  const roomParam = urlParams.get('room');
  const nameParam = urlParams.get('name');

  if (roleParam && roomParam) {
    hideAll();
    roomCode = roomParam.toUpperCase();

    if (roleParam === 'host') {
      isHost = true;
      myName = nameParam ? decodeURIComponent(nameParam) : 'P1';
      show(waitingOverlay);
      displayCode.textContent = roomCode;
      peer = new Peer('snkbtl-' + roomCode, { debug: 0 });
      peer.on('open', () => { displayCode.textContent = roomCode; });
      peer.on('connection', dataConn => { conn = dataConn; setupConnection(); });
      peer.on('error', err => {
        console.error('PeerJS error:', err);
        hideAll();
        show(lobbyOverlay);
        createError.textContent = 'Connection error from Lobby.';
      });
    } else {
      isHost = false;
      myName = nameParam ? decodeURIComponent(nameParam) : 'P2';
      show(connectingOverlay);
      peer = new Peer(undefined, { debug: 0 });
      peer.on('open', () => {
        conn = peer.connect('snkbtl-' + roomCode, { reliable: true });
        conn.on('open', () => { setupConnection(); });
        conn.on('error', () => {
          hideAll();
          show(lobbyOverlay);
          joinError.textContent = 'Could not connect from Lobby.';
          cleanup();
        });
      });
      peer.on('error', err => {
        console.error('PeerJS error:', err);
        hideAll();
        show(lobbyOverlay);
        joinError.textContent = 'Room not found from Lobby.';
        cleanup();
      });
      setTimeout(() => {
        if (!conn || !conn.open) {
          hideAll();
          show(lobbyOverlay);
          joinError.textContent = 'Connection timed out from Lobby.';
          cleanup();
        }
      }, 10000);
    }
  }

  // Draw initial empty canvas
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

})();
