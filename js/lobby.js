/* ===== Global Multiplayer Lobby ===== */
(function () {
  'use strict';

  // Overlays
  const globalLobbyOverlay = document.getElementById('global-lobby-overlay');
  const waitingOverlay = document.getElementById('waiting-overlay');
  const connectingOverlay = document.getElementById('connecting-overlay');
  const roomUiOverlay = document.getElementById('room-ui-overlay');
  const disconnectOverlay = document.getElementById('disconnect-overlay');

  // Triggers
  const openLobbyBtn = document.getElementById('open-lobby-btn');
  const closeLobbyBtn = document.getElementById('close-lobby-btn');

  // Lobby Inputs
  const createNameInput = document.getElementById('create-name');
  const createBtn = document.getElementById('create-btn');
  const createError = document.getElementById('create-error');
  
  const joinNameInput = document.getElementById('join-name');
  const joinCodeInput = document.getElementById('join-code');
  const joinBtn = document.getElementById('join-btn');
  const joinError = document.getElementById('join-error');

  // Waiting
  const displayCode = document.getElementById('display-code');
  const cancelWaitBtn = document.getElementById('cancel-wait-btn');
  const cancelConnectBtn = document.getElementById('cancel-connect-btn');

  // Room UI
  const p1NameEl = document.getElementById('room-p1-name');
  const p1StatusEl = document.getElementById('room-p1-status');
  const p2NameEl = document.getElementById('room-p2-name');
  const p2StatusEl = document.getElementById('room-p2-status');
  const gameSelect = document.getElementById('game-select');
  const gameSelectHint = document.getElementById('game-select-hint');
  const readyBtn = document.getElementById('ready-btn');
  const launchBtn = document.getElementById('launch-game-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  const backLobbyBtn = document.getElementById('back-lobby-btn');

  // State
  let peer = null;
  let conn = null;
  let isHost = false;
  let myName = '';
  let opponentName = '';
  let roomCode = '';
  
  let iAmReady = false;
  let opponentIsReady = false;
  let selectedGame = 'pong';

  // ─── UI Helpers ─────────────────────────────────────
  function hideAllOverlays() {
    globalLobbyOverlay.classList.add('hidden');
    waitingOverlay.classList.add('hidden');
    connectingOverlay.classList.add('hidden');
    roomUiOverlay.classList.add('hidden');
    disconnectOverlay.classList.add('hidden');
  }

  function showOverlay(overlay) {
    hideAllOverlays();
    overlay.classList.remove('hidden');
  }

  function updateRoomUI() {
    p1NameEl.textContent = isHost ? myName : opponentName;
    p1StatusEl.textContent = (isHost ? iAmReady : opponentIsReady) ? "READY" : "Not Ready";
    p1StatusEl.style.color = (isHost ? iAmReady : opponentIsReady) ? "var(--neon-green)" : "var(--text-muted)";
    
    p2NameEl.textContent = isHost ? opponentName : myName;
    p2StatusEl.textContent = (isHost ? opponentIsReady : iAmReady) ? "READY" : "Not Ready";
    p2StatusEl.style.color = (isHost ? opponentIsReady : iAmReady) ? "var(--neon-green)" : "var(--text-muted)";

    gameSelect.value = selectedGame;
    
    if (isHost) {
      gameSelect.disabled = false;
      gameSelectHint.textContent = "Select a game to play.";
      if (iAmReady && opponentIsReady) {
        launchBtn.classList.remove('hidden');
      } else {
        launchBtn.classList.add('hidden');
      }
    } else {
      gameSelect.disabled = true;
      gameSelectHint.textContent = "Only the host can change the game.";
      launchBtn.classList.add('hidden');
    }

    readyBtn.textContent = iAmReady ? "Cancel Ready" : "I'm Ready";
    readyBtn.className = iAmReady ? "btn btn-secondary" : "btn btn-primary";
    readyBtn.style.width = "100%";
  }

  // ─── PeerJS Helpers ─────────────────────────────────
  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function cleanupPeer() {
    if (conn) { conn.close(); conn = null; }
    if (peer) { peer.destroy(); peer = null; }
    isHost = false;
    iAmReady = false;
    opponentIsReady = false;
    selectedGame = 'pong';
  }

  function setupConnectionListeners(connection) {
    conn = connection;
    conn.on('open', () => {
      // We are connected! Send our name
      conn.send({ type: 'HANDSHAKE', name: myName });
    });

    conn.on('data', (data) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case 'HANDSHAKE':
          opponentName = data.name || 'Player';
          showOverlay(roomUiOverlay);
          updateRoomUI();
          break;
        
        case 'GAME_SELECT':
          selectedGame = data.game;
          // When game changes, everyone unreadies
          iAmReady = false;
          opponentIsReady = false;
          updateRoomUI();
          break;

        case 'READY':
          opponentIsReady = data.ready;
          updateRoomUI();
          break;

        case 'LAUNCH':
          // Host says launch!
          const gameToLaunch = data.game;
          const sessionId = data.sessionId;
          cleanupPeer(); // Disconnect lobby peer
          const roleStr = isHost ? 'host' : 'guest';
          window.location.href = `games/${gameToLaunch}.html?role=${roleStr}&room=${sessionId}`;
          break;
      }
    });

    conn.on('close', () => {
      cleanupPeer();
      showOverlay(disconnectOverlay);
    });

    conn.on('error', (err) => {
      console.error("Connection error:", err);
      cleanupPeer();
      showOverlay(disconnectOverlay);
    });
  }

  // ─── Event Listeners ────────────────────────────────
  if (openLobbyBtn) openLobbyBtn.addEventListener('click', () => showOverlay(globalLobbyOverlay));
  if (closeLobbyBtn) closeLobbyBtn.addEventListener('click', hideAllOverlays);

  // Host Logic
  createBtn.addEventListener('click', () => {
    myName = createNameInput.value.trim().toUpperCase() || 'HOST';
    roomCode = generateRoomCode();
    createError.textContent = 'Creating room...';

    peer = new Peer('space-arcade-' + roomCode);

    peer.on('open', (id) => {
      isHost = true;
      displayCode.textContent = roomCode;
      showOverlay(waitingOverlay);
    });

    peer.on('connection', (connection) => {
      setupConnectionListeners(connection);
    });

    peer.on('error', (err) => {
      createError.textContent = 'Failed to create room. Try again.';
      cleanupPeer();
    });
  });

  // Guest Logic
  joinBtn.addEventListener('click', () => {
    myName = joinNameInput.value.trim().toUpperCase() || 'GUEST';
    roomCode = joinCodeInput.value.trim().toUpperCase();

    if (roomCode.length !== 6) {
      joinError.textContent = 'Room code must be 6 characters.';
      return;
    }

    joinError.textContent = 'Connecting...';
    peer = new Peer();

    peer.on('open', (id) => {
      isHost = false;
      showOverlay(connectingOverlay);
      const connection = peer.connect('space-arcade-' + roomCode, { reliable: true });
      setupConnectionListeners(connection);
    });

    peer.on('error', (err) => {
      joinError.textContent = 'Failed to connect. Invalid code?';
      cleanupPeer();
      showOverlay(globalLobbyOverlay);
    });
  });

  // Room UI Logic
  gameSelect.addEventListener('change', (e) => {
    if (isHost) {
      selectedGame = e.target.value;
      iAmReady = false;
      opponentIsReady = false;
      conn.send({ type: 'GAME_SELECT', game: selectedGame });
      updateRoomUI();
    }
  });

  readyBtn.addEventListener('click', () => {
    iAmReady = !iAmReady;
    conn.send({ type: 'READY', ready: iAmReady });
    updateRoomUI();
  });

  launchBtn.addEventListener('click', () => {
    if (isHost && iAmReady && opponentIsReady) {
      const sessionId = generateRoomCode(); // Generate new session ID for the actual game
      const msg = { type: 'LAUNCH', game: selectedGame, sessionId: sessionId };
      conn.send(msg);
      // Wait a tiny bit for the message to send before leaving page
      setTimeout(() => {
        cleanupPeer();
        window.location.href = `games/${selectedGame}.html?role=host&room=${sessionId}`;
      }, 200);
    }
  });

  leaveRoomBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  backLobbyBtn.addEventListener('click', () => {
    showOverlay(globalLobbyOverlay);
  });

  cancelWaitBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  cancelConnectBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  document.getElementById('room-code-box')?.addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    const hint = document.querySelector('.copy-hint');
    if (hint) {
      hint.textContent = 'Copied!';
      setTimeout(() => hint.textContent = 'Click to copy', 2000);
    }
  });

})();
