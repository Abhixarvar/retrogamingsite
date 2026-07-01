/* ===== Discord-Style Multiplayer Lobby & Watch Lounge ===== */
(function () {
  'use strict';

  // Overlays
  const globalLobbyOverlay = document.getElementById('global-lobby-overlay');
  const connectingOverlay = document.getElementById('connecting-overlay');
  const roomUiOverlay = document.getElementById('room-ui-overlay');
  const disconnectOverlay = document.getElementById('disconnect-overlay');

  // Inputs & Controls
  const createNameInput = document.getElementById('create-name');
  const createBtn = document.getElementById('create-btn');
  const createError = document.getElementById('create-error');
  
  const joinNameInput = document.getElementById('join-name');
  const joinCodeInput = document.getElementById('join-code');
  const joinBtn = document.getElementById('join-btn');
  const joinError = document.getElementById('join-error');

  const cancelConnectBtn = document.getElementById('cancel-connect-btn');

  // Sidebar / Room UI
  const displayCode = document.getElementById('display-code');
  const memberListEl = document.getElementById('member-list');
  const memberCountEl = document.getElementById('member-count');
  const gameSelect = document.getElementById('game-select');
  const readyBtn = document.getElementById('ready-btn');
  const launchBtn = document.getElementById('launch-game-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  const backLobbyBtn = document.getElementById('back-lobby-btn');

  // Viewport states
  const viewportStatusText = document.getElementById('viewport-status-text');
  const statusIndicatorDot = document.getElementById('status-indicator-dot');
  const hostGameControls = document.getElementById('host-game-controls');
  const playSingleplayerBtn = document.getElementById('play-singleplayer-btn');
  const stopSingleplayerBtn = document.getElementById('stop-singleplayer-btn');

  const stateLobbyScreen = document.getElementById('state-lobby-screen');
  const stateGameIframeWrap = document.getElementById('state-game-iframe-wrap');
  const gameIframe = document.getElementById('game-iframe');

  const stateSpectatorScreen = document.getElementById('state-spectator-screen');
  const spectatorImg = document.getElementById('spectator-img');
  const spectatorPlaceholder = document.getElementById('spectator-placeholder');
  const spectateTargetName = document.getElementById('spectate-target-name');

  // State Variables
  let peer = null;
  let isHost = false;
  let myName = '';
  let roomCode = '';
  let selectedGame = 'pong';
  let myReady = false;

  // Host state
  let guestConnections = []; // Array of guest PeerJS connection objects
  let members = []; // Array of member objects: { peerId, name, role, ready, status }

  // Guest state
  let hostConn = null; // Connection to the host

  // ─── UI Rendering ────────────────────────────────────
  function hideAllOverlays() {
    globalLobbyOverlay.classList.add('hidden');
    connectingOverlay.classList.add('hidden');
    roomUiOverlay.classList.add('hidden');
    disconnectOverlay.classList.add('hidden');
  }

  function showOverlay(overlay) {
    hideAllOverlays();
    overlay.classList.remove('hidden');
  }

  function renderMembers() {
    memberListEl.innerHTML = '';
    memberCountEl.textContent = members.length;

    members.forEach((m) => {
      const isMe = (isHost && m.role === 'host') || (!isHost && m.peerId === peer.id);

      const slot = document.createElement('div');
      slot.className = 'member-slot' + (isMe ? ' active-member' : '');

      // Avatar emoji based on role
      const avatarEmoji = m.role === 'host' ? '👑' : '🛸';

      // Status text
      let statusText = m.status;
      if (m.ready) {
        statusText = 'READY';
      }

      slot.innerHTML = `
        <div class="avatar-wrap">
          <span class="avatar-icon">${avatarEmoji}</span>
          <span class="status-dot online"></span>
        </div>
        <div class="member-info">
          <div class="member-name">
            ${escapeHTML(m.name)} 
            ${m.role === 'host' ? '<span class="role-tag">Host</span>' : ''}
          </div>
          <div class="member-status" style="color: ${m.ready ? '#00ff88' : 'var(--text-muted)'}">${statusText}</div>
        </div>
        <span class="mic-icon" style="opacity: ${m.status.includes('Playing') ? '1' : '0.2'}">🎙️</span>
      `;
      memberListEl.appendChild(slot);
    });

    // Update buttons visibility
    if (isHost) {
      gameSelect.disabled = false;
      playSingleplayerBtn.style.display = 'inline-block';
      
      // Show Launch button if all members are ready
      const allReady = members.every(m => m.ready || m.role === 'host'); // Host is always ready implicitly or ready when readyBtn clicked
      const hasGuests = members.length > 1;
      const isMultiplayer = selectedGame === 'pong' || selectedGame === 'molehammer';

      if (allReady && hasGuests && isMultiplayer) {
        launchBtn.classList.remove('hidden');
      } else {
        launchBtn.classList.add('hidden');
      }
    } else {
      gameSelect.disabled = true;
      playSingleplayerBtn.style.display = 'none';
      launchBtn.classList.add('hidden');
    }
  }

  function updateViewportHeader(status, active = true) {
    viewportStatusText.textContent = status.toUpperCase();
    if (active) {
      statusIndicatorDot.classList.add('active');
    } else {
      statusIndicatorDot.classList.remove('active');
    }
  }

  function showViewportState(stateEl) {
    stateLobbyScreen.classList.add('hidden');
    stateGameIframeWrap.classList.add('hidden');
    stateSpectatorScreen.classList.add('hidden');
    stateEl.classList.remove('hidden');
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // ─── Host Logic ──────────────────────────────────────
  function initHost(name) {
    myName = name;
    isHost = true;
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    displayCode.textContent = roomCode;

    // Reset list
    members = [{ peerId: 'host', name: myName, role: 'host', ready: false, status: 'Lobby' }];
    guestConnections = [];

    peer = new Peer('space-arcade-' + roomCode);

    peer.on('open', () => {
      showOverlay(roomUiOverlay);
      renderMembers();
      updateViewportHeader('Host Lobby - Waiting for players');
    });

    peer.on('connection', (conn) => {
      // Reject if full (max 4 players total: 1 host + 3 guests)
      if (members.length >= 4) {
        conn.on('open', () => {
          conn.send({ type: 'REJECT', reason: 'Lobby is full (Max 4 players)' });
          setTimeout(() => conn.close(), 500);
        });
        return;
      }

      setupHostConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      createError.textContent = 'Failed to create room. Room name taken?';
      cleanupPeer();
    });
  }

  function setupHostConnection(conn) {
    conn.on('open', () => {
      guestConnections.push(conn);
    });

    conn.on('data', (data) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case 'HANDSHAKE':
          // Add player
          members.push({
            peerId: conn.peer,
            name: data.name || 'GUEST',
            role: 'guest',
            ready: false,
            status: 'Lobby'
          });
          broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
          renderMembers();
          break;

        case 'READY':
          const member = members.find(m => m.peerId === conn.peer);
          if (member) {
            member.ready = data.ready;
            broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
            renderMembers();
          }
          break;
      }
    });

    conn.on('close', () => {
      // Remove guest connection
      guestConnections = guestConnections.filter(c => c !== conn);
      members = members.filter(m => m.peerId !== conn.peer);
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
    });

    conn.on('error', () => {
      conn.close();
    });
  }

  function broadcast(msg) {
    guestConnections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  // ─── Guest Logic ─────────────────────────────────────
  function initGuest(name, code) {
    myName = name;
    isHost = false;
    roomCode = code.toUpperCase();

    showOverlay(connectingOverlay);

    peer = new Peer();

    peer.on('open', () => {
      const conn = peer.connect('space-arcade-' + roomCode, { reliable: true });
      setupGuestConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      joinError.textContent = 'Failed to connect. Invalid Room Code?';
      cleanupPeer();
      showOverlay(globalLobbyOverlay);
    });
  }

  function setupGuestConnection(conn) {
    hostConn = conn;

    conn.on('open', () => {
      conn.send({ type: 'HANDSHAKE', name: myName });
    });

    conn.on('data', (data) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case 'REJECT':
          joinError.textContent = data.reason;
          cleanupPeer();
          showOverlay(globalLobbyOverlay);
          break;

        case 'ROOM_UPDATE':
          members = data.members;
          selectedGame = data.game;
          displayCode.textContent = roomCode;
          showOverlay(roomUiOverlay);
          
          // Sync dropdown selection
          gameSelect.value = selectedGame;
          renderMembers();
          
          // If the host status indicates they are playing singleplayer, show spectator
          const hostMember = members.find(m => m.role === 'host');
          if (hostMember && hostMember.status.includes('Playing')) {
            spectateTargetName.textContent = hostMember.name;
            showViewportState(stateSpectatorScreen);
            updateViewportHeader(hostMember.status);
          } else {
            showViewportState(stateLobbyScreen);
            updateViewportHeader('Lobby Lounge', false);
            spectatorImg.style.display = 'none';
            spectatorPlaceholder.style.display = 'block';
          }
          break;

        case 'ARCADE_FRAME':
          spectatorImg.src = data.dataUrl;
          spectatorImg.style.display = 'block';
          spectatorPlaceholder.style.display = 'none';
          break;

        case 'LAUNCH':
          // Redirect to multiplayer page
          cleanupPeer();
          const roleStr = 'guest';
          window.location.href = `games/${data.game}.html?role=${roleStr}&room=${data.sessionId}&name=${encodeURIComponent(myName)}`;
          break;
      }
    });

    conn.on('close', () => {
      cleanupPeer();
      showOverlay(disconnectOverlay);
    });

    conn.on('error', () => {
      cleanupPeer();
      showOverlay(disconnectOverlay);
    });
  }

  // ─── General Controls ────────────────────────────────
  function cleanupPeer() {
    if (hostConn) { hostConn.close(); hostConn = null; }
    guestConnections.forEach(c => c.close());
    guestConnections = [];
    if (peer) { peer.destroy(); peer = null; }
    
    // Stop any singleplayer frame
    stopSingleplayerGame();
    
    isHost = false;
    myReady = false;
    members = [];
  }

  function stopSingleplayerGame() {
    gameIframe.src = '';
    showViewportState(stateLobbyScreen);
    playSingleplayerBtn.style.display = 'inline-block';
    stopSingleplayerBtn.style.display = 'none';
    
    if (isHost && members.length > 0) {
      members[0].status = 'Lobby';
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
      updateViewportHeader('Host Lobby');
    }
  }

  // Handle messages from the iframe (singleplayer frame capture)
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'ARCADE_FRAME') return;

    if (isHost && guestConnections.length > 0) {
      // Broadcast frame to all guests
      broadcast({
        type: 'ARCADE_FRAME',
        dataUrl: e.data.dataUrl
      });
    }
  });

  // ─── Button Events ───────────────────────────────────

  // Host: Create
  createBtn.addEventListener('click', () => {
    const name = createNameInput.value.trim().toUpperCase() || 'HOST';
    initHost(name);
  });

  // Guest: Join
  joinBtn.addEventListener('click', () => {
    const name = joinNameInput.value.trim().toUpperCase() || 'GUEST';
    const code = joinCodeInput.value.trim().toUpperCase();

    if (code.length !== 6) {
      joinError.textContent = 'Room code must be 6 characters.';
      return;
    }

    initGuest(name, code);
  });

  // Host: Game Select change
  gameSelect.addEventListener('change', (e) => {
    if (isHost) {
      selectedGame = e.target.value;
      // Reset all ready status
      members.forEach(m => m.ready = false);
      myReady = false;
      readyBtn.textContent = "I'm Ready";
      readyBtn.className = "btn btn-primary";
      
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();

      // Auto stop singleplayer game when changing selected launch target
      stopSingleplayerGame();
    }
  });

  // Host: Launch singleplayer iframe
  playSingleplayerBtn.addEventListener('click', () => {
    if (isHost) {
      const isMulti = selectedGame === 'pong' || selectedGame === 'molehammer';
      const filePrefix = selectedGame;
      
      // Load game html inside iframe
      gameIframe.src = `games/${filePrefix}.html`;
      showViewportState(stateGameIframeWrap);

      playSingleplayerBtn.style.display = 'none';
      stopSingleplayerBtn.style.display = 'inline-block';

      // Update status
      const gameLabel = gameSelect.options[gameSelect.selectedIndex].text.split(' (')[0];
      members[0].status = `Playing ${gameLabel}`;
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
      updateViewportHeader(`Playing ${gameLabel}`);
    }
  });

  // Host: Exit singleplayer iframe
  stopSingleplayerBtn.addEventListener('click', stopSingleplayerGame);

  // Ready click
  readyBtn.addEventListener('click', () => {
    myReady = !myReady;
    
    if (isHost) {
      members[0].ready = myReady;
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
    } else {
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'READY', ready: myReady });
      }
    }

    readyBtn.textContent = myReady ? "Cancel Ready" : "I'm Ready";
    readyBtn.className = myReady ? "btn btn-secondary" : "btn btn-primary";
    readyBtn.style.width = "100%";
  });

  // Host: Launch Game
  launchBtn.addEventListener('click', () => {
    if (isHost) {
      const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      broadcast({
        type: 'LAUNCH',
        game: selectedGame,
        sessionId: sessionId
      });

      // Wait a moment for messages to deliver then redirect
      setTimeout(() => {
        cleanupPeer();
        window.location.href = `games/${selectedGame}.html?role=host&room=${sessionId}&name=${encodeURIComponent(myName)}`;
      }, 300);
    }
  });

  leaveRoomBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  backLobbyBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  cancelConnectBtn.addEventListener('click', () => {
    cleanupPeer();
    showOverlay(globalLobbyOverlay);
  });

  // Room Code Click to Copy
  document.getElementById('room-code-box').addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    const hint = document.querySelector('.copy-hint');
    if (hint) {
      hint.textContent = 'Copied!';
      setTimeout(() => hint.textContent = 'Click to copy room code', 2000);
    }
  });

})();
