/* ===== Cosmic Pong — Multiplayer Game Engine ===== */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────
  const WIN_SCORE = 10;
  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const PADDLE_W = 10;
  const PADDLE_H = 90;
  const PADDLE_GAP = 20;
  const BALL_R = 7;
  const BALL_SPEED = 3.5;
  const PADDLE_SPEED = 5.5;
  const TRAIL_LEN = 12;
  const BG = '#0a0a2e';

  // ── DOM refs ─────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('pong-hud');
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
  let animFrameId = null;
  let myRematchVote = false;
  let opponentRematchVote = false;

  // Game state (authoritative on host, mirrored on guest)
  let state = null;

  function initState() {
    return {
      ball: { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: BALL_SPEED, vy: BALL_SPEED * 0.6 },
      paddles: {
        left: { y: CANVAS_H / 2 - PADDLE_H / 2 },
        right: { y: CANVAS_H / 2 - PADDLE_H / 2 },
      },
      scores: { left: 0, right: 0 },
      trail: [],
      particles: [],
      screenShake: 0,
    };
  }

  // Input tracking
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.key] = true; });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // ── Helpers ──────────────────────────────────────────
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function hideAll() {
    [lobbyOverlay, waitingOverlay, connectingOverlay, countdownOverlay, gameoverOverlay, disconnectOverlay].forEach(hide);
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
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

    // Prefix peer ID to avoid collision
    peer = new Peer('cpong-' + roomCode, { debug: 0 });

    peer.on('open', () => {
      displayCode.textContent = roomCode;
    });

    peer.on('connection', dataConn => {
      conn = dataConn;
      setupConnection();
    });

    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        // Room code already taken, regenerate
        peer.destroy();
        roomCode = generateRoomCode();
        peer = new Peer('cpong-' + roomCode, { debug: 0 });
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
      conn = peer.connect('cpong-' + roomCode, { reliable: true });

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

    // Timeout
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
    // Exchange names
    conn.on('open', () => {
      conn.send({ type: 'hello', name: myName });
    });

    // If connection is already open (host side)
    if (conn.open) {
      conn.send({ type: 'hello', name: myName });
    }

    conn.on('data', data => {
      handleMessage(data);
    });

    conn.on('close', () => {
      if (gameRunning) {
        gameRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        hideAll();
        show(disconnectOverlay);
      }
    });

    conn.on('error', () => {
      gameRunning = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      hideAll();
      show(disconnectOverlay);
    });
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'hello':
        opponentName = data.name;
        // Both connected — start countdown
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

      case 'paddle':
        // Receive opponent paddle position
        if (isHost) {
          // Guest controls right paddle
          if (state) state.paddles.right.y = data.y;
        } else {
          // Host controls left paddle — but guest receives full state
        }
        break;

      case 'state':
        // Guest receives authoritative state from host
        if (!isHost && state) {
          state.ball = data.ball;
          state.paddles = data.paddles;
          state.scores = data.scores;
          updateHUD();
        }
        break;

      case 'score':
        if (!isHost && state) {
          state.scores = data.scores;
          updateHUD();
        }
        break;

      case 'gameover':
        gameRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        showGameOver(data.winner);
        break;

      case 'rematch':
        opponentRematchVote = data.vote;
        if (data.vote) {
          rematchStatus.textContent = opponentName + ' wants a rematch!';
          if (myRematchVote && opponentRematchVote) {
            // Both agree — restart
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
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  // ── Countdown ────────────────────────────────────────
  function startCountdown() {
    hideAll();
    show(countdownOverlay);

    // Show game elements behind overlay
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

    // Randomize ball direction
    state.ball.vx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
    state.ball.vy = (Math.random() - 0.5) * BALL_SPEED;

    updateHUD();
    gameLoop();
  }

  function gameLoop() {
    if (!gameRunning) return;

    update();
    drawFrame();

    // Host sends state to guest ~30fps (every other frame)
    if (isHost && state) {
      send({
        type: 'state',
        ball: state.ball,
        paddles: state.paddles,
        scores: state.scores,
      });
    }

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function update() {
    if (!state) return;

    // ── Paddle input ──
    const myPaddle = isHost ? state.paddles.left : state.paddles.right;
    if (keys['w'] || keys['W'] || keys['ArrowUp']) {
      myPaddle.y = Math.max(0, myPaddle.y - PADDLE_SPEED);
    }
    if (keys['s'] || keys['S'] || keys['ArrowDown']) {
      myPaddle.y = Math.min(CANVAS_H - PADDLE_H, myPaddle.y + PADDLE_SPEED);
    }

    // Send paddle position
    send({ type: 'paddle', y: myPaddle.y });

    // Only host runs physics
    if (!isHost) return;

    const ball = state.ball;

    // ── Trail ──
    state.trail.push({ x: ball.x, y: ball.y });
    if (state.trail.length > TRAIL_LEN) state.trail.shift();

    // ── Move ball ──
    ball.x += ball.vx;
    ball.y += ball.vy;

    // ── Wall bounce (top/bottom) ──
    if (ball.y - BALL_R <= 0) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.y + BALL_R >= CANVAS_H) {
      ball.y = CANVAS_H - BALL_R;
      ball.vy = -Math.abs(ball.vy);
    }

    // ── Paddle collision ──
    const lp = state.paddles.left;
    const rp = state.paddles.right;

    // Left paddle
    if (ball.vx < 0 &&
      ball.x - BALL_R <= PADDLE_GAP + PADDLE_W &&
      ball.x - BALL_R >= PADDLE_GAP - 2 &&
      ball.y >= lp.y && ball.y <= lp.y + PADDLE_H) {
      ball.x = PADDLE_GAP + PADDLE_W + BALL_R;
      const hitPos = (ball.y - lp.y) / PADDLE_H; // 0..1
      const angle = (hitPos - 0.5) * Math.PI * 0.6; // -54° to 54°
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + 0.2;
      ball.vx = Math.abs(Math.cos(angle) * speed);
      ball.vy = Math.sin(angle) * speed;
      spawnParticles(ball.x, ball.y, '#00ff88');
    }

    // Right paddle
    if (ball.vx > 0 &&
      ball.x + BALL_R >= CANVAS_W - PADDLE_GAP - PADDLE_W &&
      ball.x + BALL_R <= CANVAS_W - PADDLE_GAP + 2 &&
      ball.y >= rp.y && ball.y <= rp.y + PADDLE_H) {
      ball.x = CANVAS_W - PADDLE_GAP - PADDLE_W - BALL_R;
      const hitPos = (ball.y - rp.y) / PADDLE_H;
      const angle = (hitPos - 0.5) * Math.PI * 0.6;
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + 0.2;
      ball.vx = -Math.abs(Math.cos(angle) * speed);
      ball.vy = Math.sin(angle) * speed;
      spawnParticles(ball.x, ball.y, '#00f0ff');
    }

    // Cap ball speed
    const maxSpeed = 9;
    const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (currentSpeed > maxSpeed) {
      ball.vx = (ball.vx / currentSpeed) * maxSpeed;
      ball.vy = (ball.vy / currentSpeed) * maxSpeed;
    }

    // ── Scoring ──
    if (ball.x < -BALL_R * 2) {
      state.scores.right++;
      state.screenShake = 8;
      send({ type: 'score', scores: state.scores });
      updateHUD();
      if (state.scores.right >= WIN_SCORE) {
        gameRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        const winner = isHost ? opponentName : myName;
        send({ type: 'gameover', winner });
        showGameOver(winner);
        return;
      }
      resetBall(-1);
    }

    if (ball.x > CANVAS_W + BALL_R * 2) {
      state.scores.left++;
      state.screenShake = 8;
      send({ type: 'score', scores: state.scores });
      updateHUD();
      if (state.scores.left >= WIN_SCORE) {
        gameRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        const winner = isHost ? myName : opponentName;
        send({ type: 'gameover', winner });
        showGameOver(winner);
        return;
      }
      resetBall(1);
    }

    // ── Update particles ──
    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      p.vx *= 0.97;
      p.vy *= 0.97;
      return p.life > 0;
    });

    // ── Screen shake decay ──
    if (state.screenShake > 0) state.screenShake *= 0.85;
    if (state.screenShake < 0.5) state.screenShake = 0;
  }

  function resetBall(dir) {
    state.ball.x = CANVAS_W / 2;
    state.ball.y = CANVAS_H / 2;
    state.ball.vx = dir * BALL_SPEED;
    state.ball.vy = (Math.random() - 0.5) * BALL_SPEED;
    state.trail = [];
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
    }
  }

  // ── Renderer ─────────────────────────────────────────
  function drawFrame() {
    if (!state) return;

    ctx.save();

    // Screen shake
    if (state.screenShake > 0) {
      const sx = (Math.random() - 0.5) * state.screenShake;
      const sy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(sx, sy);
    }

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Background scores (large, faded)
    ctx.save();
    ctx.font = '900 120px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 255, 136, 0.04)';
    ctx.fillText(state.scores.left.toString(), CANVAS_W / 4, CANVAS_H / 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.fillText(state.scores.right.toString(), (CANVAS_W / 4) * 3, CANVAS_H / 2);
    ctx.restore();

    // ── Ball trail ──
    state.trail.forEach((p, i) => {
      const alpha = (i / state.trail.length) * 0.4;
      const r = BALL_R * (0.3 + (i / state.trail.length) * 0.7);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ── Ball ──
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    // Outer glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_R + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Paddles ──
    drawPaddle(PADDLE_GAP, state.paddles.left.y, '#00ff88');
    drawPaddle(CANVAS_W - PADDLE_GAP - PADDLE_W, state.paddles.right.y, '#00f0ff');

    // ── Particles ──
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  function drawPaddle(x, y, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, PADDLE_W, PADDLE_H, 5);
    ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 4, PADDLE_W - 4, PADDLE_H - 8, 3);
    ctx.fill();
    ctx.restore();
  }

  // ── HUD ──────────────────────────────────────────────
  function updateHUD() {
    if (!state) return;
    hudScoreL.textContent = state.scores.left;
    hudScoreR.textContent = state.scores.right;
  }

  // ── Game Over ────────────────────────────────────────
  function showGameOver(winnerName) {
    hideAll();
    show(gameoverOverlay);

    const isWinner = winnerName === myName;
    gameoverTitle.textContent = isWinner ? 'Victory!' : 'Defeat';
    gameoverTitle.style.background = isWinner
      ? 'linear-gradient(135deg, #00ff88, #ffd700)'
      : 'linear-gradient(135deg, #ff4444, #ff6b9d)';
    gameoverTitle.style.webkitBackgroundClip = 'text';
    gameoverTitle.style.webkitTextFillColor = 'transparent';
    gameoverTitle.style.backgroundClip = 'text';

    const leftName = isHost ? myName : opponentName;
    const rightName = isHost ? opponentName : myName;
    gameoverText.innerHTML = `${leftName} <span class="highlight">${state.scores.left}</span> — <span class="highlight">${state.scores.right}</span> ${rightName}`;

    myRematchVote = false;
    opponentRematchVote = false;
    rematchStatus.textContent = '';
    rematchBtn.style.display = '';
    rematchBtn.textContent = 'Play Again';
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

  // Enter key support in lobby
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

  // Auto-uppercase room code input
  joinCodeInput.addEventListener('input', () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase();
  });

  // Prevent default on game keys so page doesn't scroll
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key) && gameRunning) {
      e.preventDefault();
    }
  });

  // Auto-connect from Global Lobby
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  const roomParam = urlParams.get('room');

  if (roleParam && roomParam) {
    hideAll();
    roomCode = roomParam.toUpperCase();
    
    if (roleParam === 'host') {
      isHost = true;
      myName = 'P1';
      show(waitingOverlay);
      displayCode.textContent = roomCode;
      peer = new Peer('cpong-' + roomCode, { debug: 0 });
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
      myName = 'P2';
      show(connectingOverlay);
      peer = new Peer(undefined, { debug: 0 });
      peer.on('open', () => {
        conn = peer.connect('cpong-' + roomCode, { reliable: true });
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
