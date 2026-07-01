/* ===== Mole Hammer — 2-Player Whack-a-Mole Battle with Watch Lounge Spectating ===== */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────
  const WIN_SCORE = 10;
  const CANVAS_W = 750;
  const CANVAS_H = 500;
  const COLS = 5;
  const ROWS = 3;
  const TOTAL_HOLES = COLS * ROWS; // 15
  const MOLE_SHOW_MIN = 800;
  const MOLE_SHOW_MAX = 2000;
  const MOLE_INTERVAL_MIN = 400;
  const MOLE_INTERVAL_MAX = 1200;
  const MAX_ACTIVE_MOLES = 4;
  const HOLE_RADIUS = 30;

  // Colors
  const RED = '#ff4466';
  const RED_DARK = '#cc2244';
  const RED_GLOW = 'rgba(255, 68, 102, 0.4)';
  const BLUE = '#44aaff';
  const BLUE_DARK = '#2277cc';
  const BLUE_GLOW = 'rgba(68, 170, 255, 0.4)';
  const BG = '#0a0a2e';
  const HOLE_COLOR = '#1a1a3e';
  const HOLE_RIM = '#2a2a5e';
  const GROUND_COLOR = '#12122e';

  // ── DOM refs ─────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('mole-hud');
  const arenaWrap = document.getElementById('arena-wrap');
  const controlsHint = document.getElementById('controls-hint');
  const roleBadgeWrap = document.getElementById('role-badge-wrap');
  const roleBadge = document.getElementById('role-badge');
  const hudNameRed = document.getElementById('hud-name-red');
  const hudNameBlue = document.getElementById('hud-name-blue');
  const hudScoreRed = document.getElementById('hud-score-red');
  const hudScoreBlue = document.getElementById('hud-score-blue');

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
  let isHost = false;
  let myName = '';
  let opponentName = 'BLUE PLAYER';
  let roomCode = '';
  let gameRunning = false;
  let animFrameId = null;
  let myRematchVote = false;
  let opponentRematchVote = false;

  // Connection management
  let conn = null; // Guest's connection to the host
  let guestConns = []; // Host's array of connected guest connections
  let blueConn = null; // Host: connection representing the Blue player

  // My role: 'red' (host), 'blue' (guest 1), or 'spectator' (other guests)
  let myRole = 'red';

  // Hole positions (computed once)
  let holes = [];

  // Game state (authoritative on host)
  let state = null;

  // Particles for visual effects
  let particles = [];

  // Hammer animation state
  let hammerEffects = []; // { x, y, time, color }

  // ── Audio context for SFX ────────────────────────────
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playWhack(freq) {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* silent */ }
  }

  function playScore() {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) { /* silent */ }
  }

  function playWin() {
    try {
      const ctx = getAudioCtx();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch (e) { /* silent */ }
  }

  // ── Compute hole positions ───────────────────────────
  function computeHoles() {
    holes = [];
    const marginX = 75;
    const marginY = 60;
    const spacingX = (CANVAS_W - 2 * marginX) / (COLS - 1);
    const spacingY = (CANVAS_H - 2 * marginY) / (ROWS - 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = marginX + c * spacingX;
        const y = marginY + r * spacingY;
        holes.push({ x, y });
      }
    }
  }
  computeHoles();

  // ── Game State Init ──────────────────────────────────
  function initState() {
    return {
      moles: Array.from({ length: TOTAL_HOLES }, () => ({
        active: false,
        color: 'red',     // 'red' or 'blue'
        showTime: 0,       // when it appeared
        duration: 1500,    // how long it stays
        animPhase: 0,      // 0-1 pop-up animation
        whacked: false,
        whackTime: 0,
      })),
      scores: { red: 0, blue: 0 },
      nextSpawnTime: 0,
      gameOver: false,
      winner: null,
    };
  }

  // ── Overlay Helpers ──────────────────────────────────
  function hideAllOverlays() {
    lobbyOverlay.classList.add('hidden');
    waitingOverlay.classList.add('hidden');
    connectingOverlay.classList.add('hidden');
    countdownOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    disconnectOverlay.classList.add('hidden');
  }

  function showOverlay(overlay) {
    hideAllOverlays();
    overlay.classList.remove('hidden');
  }

  function showGameUI() {
    hudEl.style.display = 'flex';
    arenaWrap.style.display = 'block';
    controlsHint.style.display = 'block';
    roleBadgeWrap.style.display = 'block';
  }

  function hideGameUI() {
    hudEl.style.display = 'none';
    arenaWrap.style.display = 'none';
    controlsHint.style.display = 'none';
    roleBadgeWrap.style.display = 'none';
  }

  function updateHUD() {
    if (!state) return;
    hudScoreRed.textContent = state.scores.red;
    hudScoreBlue.textContent = state.scores.blue;
  }

  function bumpScore(color) {
    const el = color === 'red' ? hudScoreRed : hudScoreBlue;
    el.classList.remove('score-bump');
    void el.offsetWidth;
    el.classList.add('score-bump');
  }

  // ── PeerJS Helpers ───────────────────────────────────
  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function cleanupPeer() {
    gameRunning = false;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (conn) { try { conn.close(); } catch (e) {} conn = null; }
    guestConns.forEach(c => c.close());
    guestConns = [];
    blueConn = null;
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  }

  // ── Host: Broadcast to all guests ────────────────────
  function broadcast(msg) {
    guestConns.forEach((c) => {
      if (c.open) {
        c.send(msg);
      }
    });
  }

  // ── Check if launched from party lounge ──────────────
  function checkPartyLaunch() {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const room = params.get('room');
    if (role && room) {
      myName = params.get('name') || (role === 'host' ? 'HOST' : 'GUEST');
      if (role === 'host') {
        isHost = true;
        myRole = 'red';
        roomCode = room;
        peer = new Peer('mole-' + roomCode);
        peer.on('open', () => {
          showOverlay(waitingOverlay);
          displayCode.textContent = roomCode;
        });
        peer.on('connection', (connection) => {
          setupConnectionListeners(connection);
        });
        peer.on('error', (err) => {
          console.error(err);
          showOverlay(lobbyOverlay);
          createError.textContent = 'Room failed. Try again.';
        });
      } else {
        isHost = false;
        roomCode = room;
        peer = new Peer();
        peer.on('open', () => {
          showOverlay(connectingOverlay);
          
          let retries = 0;
          function connectToHost() {
            const connection = peer.connect('mole-' + roomCode, { reliable: true });
            setupConnectionListeners(connection);
            
            let opened = false;
            connection.on('open', () => { opened = true; });
            
            setTimeout(() => {
              if (!opened && retries < 4) {
                retries++;
                connection.close();
                connectToHost();
              } else if (!opened) {
                showOverlay(lobbyOverlay);
                joinError.textContent = 'Failed to connect. Retried multiple times.';
              }
            }, 1200);
          }
          connectToHost();
        });
        peer.on('error', (err) => {
          console.error(err);
          showOverlay(lobbyOverlay);
          joinError.textContent = 'Connection error.';
        });
      }
      return true;
    }
    return false;
  }

  // ── Connection Listeners ─────────────────────────────
  function setupConnectionListeners(connection) {
    if (isHost) {
      connection.on('open', () => {
        guestConns.push(connection);
        
        // Hand out role assignment
        let roleToAssign = 'spectator';
        if (!blueConn) {
          blueConn = connection;
          roleToAssign = 'blue';
        }
        
        connection.send({
          type: 'ROLE_ASSIGN',
          role: roleToAssign,
          hostName: myName
        });
      });
    } else {
      conn = connection;
    }

    connection.on('data', (data) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case 'ROLE_ASSIGN':
          myRole = data.role;
          opponentName = data.hostName || 'HOST';
          
          // Show role badge
          if (myRole === 'spectator') {
            roleBadge.textContent = 'YOU ARE SPECTATING';
            roleBadge.className = 'role-badge red';
            controlsHint.textContent = 'Spectating match. Watch and cheer!';
          } else {
            roleBadge.textContent = 'YOU ARE BLUE';
            roleBadge.className = 'role-badge blue';
            controlsHint.textContent = 'Click or Tap on your blue moles to whack them!';
          }
          
          hudNameRed.textContent = opponentName;
          hudNameBlue.textContent = myRole === 'blue' ? myName : 'BLUE PLAYER';
          startCountdown();
          break;

        case 'BLUE_HANDSHAKE':
          // Host receives Blue player's name
          if (isHost && connection === blueConn) {
            opponentName = data.name || 'BLUE PLAYER';
            hudNameRed.textContent = myName;
            hudNameBlue.textContent = opponentName;
            broadcast({ type: 'SYNC_NAMES', redName: myName, blueName: opponentName });
            startCountdown();
          }
          break;

        case 'SYNC_NAMES':
          if (!isHost) {
            hudNameRed.textContent = data.redName;
            hudNameBlue.textContent = data.blueName;
          }
          break;

        case 'STATE':
          if (!isHost) {
            state = data.state;
            updateHUD();
          }
          break;

        case 'WHACK':
          // Host receives whack attempt from guest
          if (isHost && connection === blueConn) {
            handleWhack(data.holeIndex, 'blue');
          }
          break;

        case 'WHACK_RESULT':
          // Guest receives feedback about a whack
          if (!isHost) {
            spawnHammerEffect(holes[data.holeIndex].x, holes[data.holeIndex].y, data.color);
            spawnParticles(holes[data.holeIndex].x, holes[data.holeIndex].y, data.color);
            playWhack(data.color === 'red' ? 300 : 500);
            if (data.scored) {
              playScore();
              bumpScore(data.color);
            }
          }
          break;

        case 'GAME_OVER':
          state.gameOver = true;
          state.winner = data.winner;
          state.scores = data.scores;
          endGame();
          break;

        case 'REMATCH_VOTE':
          opponentRematchVote = true;
          rematchStatus.textContent = 'Opponent wants a rematch!';
          if (myRematchVote && opponentRematchVote) {
            startCountdown();
          }
          break;

        case 'COUNTDOWN':
          if (!isHost) {
            countdownNum.textContent = data.num;
            countdownNum.classList.remove('score-bump');
            void countdownNum.offsetWidth;
            countdownNum.style.animation = 'none';
            void countdownNum.offsetWidth;
            countdownNum.style.animation = '';
          }
          break;

        case 'START':
          if (!isHost) {
            state = data.state;
            gameRunning = true;
            hideAllOverlays();
            showGameUI();
            updateHUD();
            if (!animFrameId) gameLoop();
          }
          break;
      }
    });

    connection.on('close', () => {
      if (isHost) {
        guestConns = guestConns.filter(c => c !== connection);
        if (connection === blueConn) {
          blueConn = null;
          // Reassign blue role to another guest if available
          if (guestConns.length > 0) {
            blueConn = guestConns[0];
            blueConn.send({ type: 'ROLE_ASSIGN', role: 'blue', hostName: myName });
          }
        }
      } else {
        gameRunning = false;
        showOverlay(disconnectOverlay);
      }
    });

    connection.on('error', () => {
      connection.close();
    });
  }

  // ── Guest triggers Blue Handshake after role assignment ──────────────
  function triggerBlueHandshake() {
    if (!isHost && myRole === 'blue' && conn) {
      conn.send({ type: 'BLUE_HANDSHAKE', name: myName });
    }
  }

  // ── Countdown ────────────────────────────────────────
  function startCountdown() {
    myRematchVote = false;
    opponentRematchVote = false;
    rematchStatus.textContent = '';

    state = initState();
    particles = [];
    hammerEffects = [];
    updateHUD();
    showGameUI();

    // Trigger Blue Handshake so Host gets Guest 1's name
    triggerBlueHandshake();

    showOverlay(countdownOverlay);
    let count = 3;
    countdownNum.textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
        if (isHost) broadcast({ type: 'COUNTDOWN', num: count });
      } else {
        clearInterval(interval);
        countdownNum.textContent = 'GO!';
        if (isHost) broadcast({ type: 'COUNTDOWN', num: 'GO!' });
        setTimeout(() => {
          hideAllOverlays();
          showGameUI();
          gameRunning = true;
          state.nextSpawnTime = performance.now() + 500;
          if (isHost) broadcast({ type: 'START', state: state });
          if (!animFrameId) gameLoop();
        }, 500);
      }
    }, 800);
  }

  // ── Mole Spawning (Host Only) ────────────────────────
  function spawnMole(now) {
    if (!isHost || !state) return;

    const activeMoles = state.moles.filter(m => m.active && !m.whacked).length;
    if (activeMoles >= MAX_ACTIVE_MOLES) return;

    // Find empty holes
    const emptyHoles = [];
    state.moles.forEach((m, i) => {
      if (!m.active) emptyHoles.push(i);
    });

    if (emptyHoles.length === 0) return;

    const idx = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
    const color = Math.random() < 0.5 ? 'red' : 'blue';
    const duration = MOLE_SHOW_MIN + Math.random() * (MOLE_SHOW_MAX - MOLE_SHOW_MIN);

    state.moles[idx] = {
      active: true,
      color: color,
      showTime: now,
      duration: duration,
      animPhase: 0,
      whacked: false,
      whackTime: 0,
    };
  }

  // ── Whack Handler (Host Only) ────────────────────────
  function handleWhack(holeIndex, playerColor) {
    if (!isHost || !state || state.gameOver) return;
    if (holeIndex < 0 || holeIndex >= TOTAL_HOLES) return;

    const mole = state.moles[holeIndex];
    if (!mole.active || mole.whacked) return;

    // Player can only whack moles of their own color
    if (mole.color !== playerColor) return;

    mole.whacked = true;
    mole.whackTime = performance.now();
    state.scores[playerColor]++;

    // Spawn effects locally
    spawnHammerEffect(holes[holeIndex].x, holes[holeIndex].y, playerColor);
    spawnParticles(holes[holeIndex].x, holes[holeIndex].y, playerColor);
    playWhack(playerColor === 'red' ? 300 : 500);

    const scored = true;
    bumpScore(playerColor);
    playScore();

    // Broadcast results to all guests
    broadcast({
      type: 'WHACK_RESULT',
      holeIndex: holeIndex,
      color: playerColor,
      success: true,
      scored: scored,
    });

    // Check win
    if (state.scores[playerColor] >= WIN_SCORE) {
      state.gameOver = true;
      state.winner = playerColor;
      broadcast({
        type: 'GAME_OVER',
        winner: playerColor,
        scores: state.scores,
      });
      setTimeout(() => endGame(), 300);
    }

    updateHUD();
  }

  // ── End Game ─────────────────────────────────────────
  function endGame() {
    gameRunning = false;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

    const winner = state.winner;
    
    if (myRole === 'spectator') {
      gameoverTitle.textContent = winner === 'red' ? 'RED WINS!' : 'BLUE WINS!';
    } else {
      const iWon = winner === myRole;
      if (iWon) {
        gameoverTitle.textContent = '🏆 YOU WIN!';
        playWin();
      } else {
        gameoverTitle.textContent = '💀 YOU LOSE';
      }
    }

    gameoverText.innerHTML = `<span class="highlight" style="color:${RED}">${state.scores.red}</span> — <span class="highlight" style="color:${BLUE}">${state.scores.blue}</span>`;
    rematchStatus.textContent = '';
    showOverlay(gameoverOverlay);
  }

  // ── Visual Effects ───────────────────────────────────
  function spawnHammerEffect(x, y, color) {
    hammerEffects.push({ x, y, time: performance.now(), color });
  }

  function spawnParticles(x, y, color) {
    const clr = color === 'red' ? RED : BLUE;
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 4,
        color: clr,
      });
    }
    // Star burst
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        life: 1,
        decay: 0.015,
        size: 2,
        color: '#ffffff',
        isStar: true,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ── Drawing ──────────────────────────────────────────
  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#080820');
    grad.addColorStop(0.5, '#0d0d30');
    grad.addColorStop(1, '#1a0a30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = 'rgba(30, 15, 50, 0.3)';
    ctx.fillRect(0, CANVAS_H * 0.7, CANVAS_W, CANVAS_H * 0.3);

    ctx.strokeStyle = 'rgba(112, 0, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
  }

  function drawHole(x, y) {
    ctx.beginPath();
    ctx.ellipse(x, y + 5, HOLE_RADIUS + 6, HOLE_RADIUS * 0.5 + 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x, y, HOLE_RADIUS + 4, HOLE_RADIUS * 0.55 + 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = HOLE_RIM;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x, y, HOLE_RADIUS, HOLE_RADIUS * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = HOLE_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x, y + 2, HOLE_RADIUS - 4, HOLE_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
  }

  function drawMole(x, y, mole, now) {
    if (!mole.active) return;

    const elapsed = now - mole.showTime;
    let popUp = 0;

    if (mole.whacked) {
      const whackElapsed = now - mole.whackTime;
      popUp = Math.max(0, 1 - whackElapsed / 300);
      if (popUp <= 0) {
        mole.active = false;
        return;
      }
    } else {
      if (elapsed < 150) {
        popUp = elapsed / 150;
        popUp = popUp * popUp * (3 - 2 * popUp);
      } else if (elapsed > mole.duration - 200) {
        popUp = Math.max(0, (mole.duration - elapsed) / 200);
      } else {
        popUp = 1;
      }

      if (elapsed > mole.duration) {
        mole.active = false;
        return;
      }
    }

    const isRed = mole.color === 'red';
    const mainColor = isRed ? RED : BLUE;
    const darkColor = isRed ? RED_DARK : BLUE_DARK;

    const offsetY = (1 - popUp) * 35;
    const moleY = y - 20 + offsetY;
    const scale = 0.7 + 0.3 * popUp;

    ctx.save();
    ctx.translate(x, moleY);
    ctx.scale(scale, scale);

    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.ellipse(-5, -8, 10, 12, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-8, -6, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -6, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-7, -5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-8, -7, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 2, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = darkColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 6, 8, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (mole.whacked) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, -10); ctx.lineTo(-4, -2);
      ctx.moveTo(-4, -10); ctx.lineTo(-12, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, -10); ctx.lineTo(12, -2);
      ctx.moveTo(12, -10); ctx.lineTo(4, -2);
      ctx.stroke();

      const starAngle = (now / 200) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const sa = starAngle + (Math.PI * 2 * i) / 3;
        const sx = Math.cos(sa) * 28;
        const sy = -18 + Math.sin(sa) * 8;
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px sans-serif';
        ctx.fillText('✦', sx - 4, sy + 4);
      }
    }

    ctx.restore();
  }

  function drawHammerEffects(now) {
    for (let i = hammerEffects.length - 1; i >= 0; i--) {
      const h = hammerEffects[i];
      const elapsed = now - h.time;
      if (elapsed > 400) {
        hammerEffects.splice(i, 1);
        continue;
      }

      const progress = elapsed / 400;
      const clr = h.color === 'red' ? RED : BLUE;

      ctx.beginPath();
      ctx.arc(h.x, h.y, 15 + progress * 35, 0, Math.PI * 2);
      ctx.strokeStyle = clr;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.globalAlpha = 1 - progress;
      ctx.stroke();

      if (elapsed < 100) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5 * (1 - elapsed / 100);
        ctx.fill();
      }

      if (elapsed < 300) {
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.font = 'bold 18px "Outfit", sans-serif';
        ctx.fillStyle = clr;
        ctx.textAlign = 'center';
        ctx.fillText('BAM!', h.x, h.y - 35 - progress * 15);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      if (p.isStar) {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size * 4}px sans-serif`;
        ctx.fillText('✦', p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawScoreIndicators() {
    if (!state) return;

    const barY = CANVAS_H - 14;
    const barH = 8;
    const barW = CANVAS_W / 2 - 20;

    ctx.fillStyle = 'rgba(255, 68, 102, 0.15)';
    ctx.fillRect(10, barY, barW, barH);
    ctx.fillStyle = RED;
    ctx.fillRect(10, barY, barW * (state.scores.red / WIN_SCORE), barH);

    ctx.fillStyle = 'rgba(68, 170, 255, 0.15)';
    ctx.fillRect(CANVAS_W / 2 + 10, barY, barW, barH);
    ctx.fillStyle = BLUE;
    const blueWidth = barW * (state.scores.blue / WIN_SCORE);
    ctx.fillRect(CANVAS_W / 2 + 10 + barW - blueWidth, barY, blueWidth, barH);

    ctx.font = '10px "Outfit", sans-serif';
    ctx.fillStyle = RED;
    ctx.textAlign = 'left';
    ctx.fillText(`RED ${state.scores.red}/${WIN_SCORE}`, 10, barY - 4);
    ctx.fillStyle = BLUE;
    ctx.textAlign = 'right';
    ctx.fillText(`BLUE ${state.scores.blue}/${WIN_SCORE}`, CANVAS_W - 10, barY - 4);
    ctx.textAlign = 'left';
  }

  function render(now) {
    drawBackground();

    for (const h of holes) {
      drawHole(h.x, h.y);
    }

    if (state) {
      for (let i = 0; i < TOTAL_HOLES; i++) {
        drawMole(holes[i].x, holes[i].y, state.moles[i], now);
      }
    }

    drawHammerEffects(now);
    drawParticles();
    drawScoreIndicators();
    updateParticles();
  }

  // ── Game Loop ────────────────────────────────────────
  let lastStateSend = 0;

  function gameLoop() {
    const now = performance.now();

    if (gameRunning && state && !state.gameOver) {
      if (isHost) {
        if (now >= state.nextSpawnTime) {
          spawnMole(now);
          state.nextSpawnTime = now + MOLE_INTERVAL_MIN + Math.random() * (MOLE_INTERVAL_MAX - MOLE_INTERVAL_MIN);
        }

        for (const mole of state.moles) {
          if (mole.active && !mole.whacked && (now - mole.showTime > mole.duration)) {
            mole.active = false;
          }
          if (mole.whacked && (now - mole.whackTime > 300)) {
            mole.active = false;
          }
        }

        if (now - lastStateSend > 50) {
          lastStateSend = now;
          broadcast({ type: 'STATE', state: state });
        }
      }
    }

    render(now);

    if (gameRunning) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function onCanvasClick(e) {
    e.preventDefault();
    if (!gameRunning || !state || state.gameOver) return;

    // Spectators cannot play/whack moles
    if (myRole === 'spectator') return;

    const pos = getCanvasPos(e);

    for (let i = 0; i < TOTAL_HOLES; i++) {
      const h = holes[i];
      const dx = pos.x - h.x;
      const dy = pos.y - (h.y - 10);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < HOLE_RADIUS + 15) {
        const mole = state.moles[i];
        if (mole.active && !mole.whacked) {
          if (isHost) {
            handleWhack(i, myRole);
          } else {
            if (conn) conn.send({ type: 'WHACK', holeIndex: i });
          }
          break;
        }
      }
    }
  }

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchstart', onCanvasClick, { passive: false });
  canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><text y=\'28\' font-size=\'28\'>🔨</text></svg>") 16 16, pointer';

  // ── Lobby Event Listeners ────────────────────────────
  createBtn.addEventListener('click', () => {
    myName = createNameInput.value.trim().toUpperCase() || 'HOST';
    roomCode = generateRoomCode();
    isHost = true;
    myRole = 'red';
    createError.textContent = 'Creating room...';

    peer = new Peer('mole-' + roomCode);
    peer.on('open', () => {
      displayCode.textContent = roomCode;
      showOverlay(waitingOverlay);
    });
    peer.on('connection', (connection) => {
      setupConnectionListeners(connection);
    });
    peer.on('error', () => {
      createError.textContent = 'Failed to create room. Try again.';
      cleanupPeer();
    });
  });

  joinBtn.addEventListener('click', () => {
    myName = joinNameInput.value.trim().toUpperCase() || 'GUEST';
    roomCode = joinCodeInput.value.trim().toUpperCase();
    isHost = false;

    if (roomCode.length !== 6) {
      joinError.textContent = 'Room code must be 6 characters.';
      return;
    }

    joinError.textContent = 'Connecting...';
    peer = new Peer();
    peer.on('open', () => {
      showOverlay(connectingOverlay);
      const connection = peer.connect('mole-' + roomCode, { reliable: true });
      setupConnectionListeners(connection);
    });
    peer.on('error', () => {
      joinError.textContent = 'Failed to connect. Invalid code?';
      cleanupPeer();
      showOverlay(lobbyOverlay);
    });
  });

  cancelWaitBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(lobbyOverlay);
  });

  cancelConnectBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(lobbyOverlay);
  });

  backLobbyBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(lobbyOverlay);
  });

  roomCodeBox?.addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    const hint = document.querySelector('.copy-hint');
    if (hint) {
      hint.textContent = 'Copied!';
      setTimeout(() => hint.textContent = 'Click to copy', 2000);
    }
  });

  // Rematch
  rematchBtn.addEventListener('click', () => {
    myRematchVote = true;
    rematchStatus.textContent = 'Waiting for opponent...';
    
    if (isHost) {
      if (myRematchVote && opponentRematchVote) {
        startCountdown();
      }
    } else {
      if (conn) conn.send({ type: 'REMATCH_VOTE' });
    }
  });

  // ── Init ─────────────────────────────────────────────
  if (!checkPartyLaunch()) {
    showOverlay(lobbyOverlay);
  }

})();
