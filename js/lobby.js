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
  let isPlayingInIframe = false; // Track whether this player has a game loaded in their iframe

  // Host state
  let guestConnections = [];
  let members = [];

  // Guest state
  let hostConn = null;

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
    if (!memberListEl) return;
    memberListEl.innerHTML = '';
    if (memberCountEl) memberCountEl.textContent = members.length;

    members.forEach((m) => {
      const isMe = (isHost && m.role === 'host') || (!isHost && peer && m.peerId === peer.id);

      const slot = document.createElement('div');
      slot.className = 'member-slot' + (isMe ? ' active-member' : '');

      const avatarEmoji = m.role === 'host' ? '👑' : '🛸';

      let statusText = m.status || 'Lobby';
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
        <span class="mic-icon" style="opacity: ${m.status && m.status.includes('Playing') ? '1' : '0.2'}">🎙️</span>
      `;
      memberListEl.appendChild(slot);
    });

    // Update buttons visibility
    if (isHost) {
      gameSelect.disabled = false;
      if (!isPlayingInIframe) {
        playSingleplayerBtn.style.display = 'inline-block';
      }
      
      const allReady = members.every(m => m.ready || m.role === 'host');
      const hasGuests = members.length > 1;
      const isMultiplayer = selectedGame === 'pong' || selectedGame === 'molehammer';

      if (allReady && hasGuests && isMultiplayer && !isPlayingInIframe) {
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
    if (viewportStatusText) viewportStatusText.textContent = status.toUpperCase();
    if (statusIndicatorDot) {
      if (active) {
        statusIndicatorDot.classList.add('active');
      } else {
        statusIndicatorDot.classList.remove('active');
      }
    }
  }

  function showViewportState(stateEl) {
    if (stateLobbyScreen) stateLobbyScreen.classList.add('hidden');
    if (stateGameIframeWrap) stateGameIframeWrap.classList.add('hidden');
    if (stateSpectatorScreen) stateSpectatorScreen.classList.add('hidden');
    if (stateEl) stateEl.classList.remove('hidden');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // ─── Host Logic ──────────────────────────────────────
  function initHost(name) {
    if (typeof Peer === 'undefined') {
      createError.textContent = 'Matchmaking server offline. Check internet connection.';
      return;
    }

    myName = name;
    isHost = true;
    
    try {
      peer = new Peer();
    } catch (e) {
      createError.textContent = 'Failed to initialize peer client.';
      return;
    }

    peer.on('open', (id) => {
      roomCode = id.substring(0, 6).toUpperCase();
      displayCode.textContent = roomCode;

      peer.destroy();
      
      setTimeout(() => {
        try {
          peer = new Peer('space-arcade-' + roomCode);
          
          peer.on('open', () => {
            members = [{ peerId: 'host', name: myName, role: 'host', ready: false, status: 'Lobby' }];
            guestConnections = [];
            showOverlay(roomUiOverlay);
            renderMembers();
            updateViewportHeader('Host Lobby - Waiting for players');
          });

          peer.on('connection', (conn) => {
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
            createError.textContent = 'Lobby connection error. Try again.';
            cleanupPeer();
          });
        } catch (e) {
          createError.textContent = 'Error starting lobby listener.';
        }
      }, 300);
    });

    peer.on('error', (err) => {
      console.error(err);
      createError.textContent = 'Lobby creation failed.';
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
    if (typeof Peer === 'undefined') {
      joinError.textContent = 'Matchmaking server offline. Check internet connection.';
      return;
    }

    myName = name;
    isHost = false;
    roomCode = code.toUpperCase();

    showOverlay(connectingOverlay);

    try {
      peer = new Peer();
    } catch (e) {
      joinError.textContent = 'Failed to initialize peer client.';
      showOverlay(globalLobbyOverlay);
      return;
    }

    peer.on('open', () => {
      const conn = peer.connect('space-arcade-' + roomCode, { reliable: true });
      setupGuestConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      joinError.textContent = 'Connection failed. Invalid Room Code?';
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
          
          gameSelect.value = selectedGame;
          renderMembers();
          
          // IMPORTANT: If we are already playing in the iframe, do NOT
          // reset the viewport. Just update the sidebar and leave the game running.
          if (isPlayingInIframe) {
            break;
          }

          const hostMember = members.find(m => m.role === 'host');
          if (hostMember && hostMember.status && hostMember.status.includes('Playing')) {
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
          if (!isPlayingInIframe) {
            spectatorImg.src = data.dataUrl;
            spectatorImg.style.display = 'block';
            spectatorPlaceholder.style.display = 'none';
          }
          break;

        case 'LAUNCH':
          // Load the multiplayer game inside the guest's iframe
          isPlayingInIframe = true;
          gameIframe.src = `games/${data.game}.html?role=guest&room=${data.sessionId}&name=${encodeURIComponent(myName)}`;
          showViewportState(stateGameIframeWrap);
          updateViewportHeader(`Playing ${data.game}`);
          break;

        case 'GAME_ENDED':
          // Host told us the game session ended; return to lobby view
          isPlayingInIframe = false;
          gameIframe.src = '';
          showViewportState(stateLobbyScreen);
          updateViewportHeader('Lobby Lounge', false);
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
    if (hostConn) { try { hostConn.close(); } catch(e){} hostConn = null; }
    guestConnections.forEach(c => { try{ c.close(); } catch(e){} });
    guestConnections = [];
    if (peer) { try { peer.destroy(); } catch(e){} peer = null; }
    
    stopSingleplayerGame();
    
    isHost = false;
    myReady = false;
    isPlayingInIframe = false;
    members = [];
  }

  function stopSingleplayerGame() {
    isPlayingInIframe = false;
    if (gameIframe) gameIframe.src = '';
    showViewportState(stateLobbyScreen);
    if (playSingleplayerBtn) playSingleplayerBtn.style.display = 'inline-block';
    if (stopSingleplayerBtn) stopSingleplayerBtn.style.display = 'none';
    
    if (isHost && members.length > 0) {
      members[0].status = 'Lobby';
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      broadcast({ type: 'GAME_ENDED' });
      renderMembers();
      updateViewportHeader('Host Lobby');
    }
  }

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'ARCADE_FRAME') return;

    if (isHost && guestConnections.length > 0) {
      const hostMember = members[0];
      if (hostMember && hostMember.status && !hostMember.status.includes('Pong') && !hostMember.status.includes('Mole')) {
        broadcast({
          type: 'ARCADE_FRAME',
          dataUrl: e.data.dataUrl
        });
      }
    }
  });

  // ─── Button Events ───────────────────────────────────
  createBtn.addEventListener('click', () => {
    const name = createNameInput.value.trim().toUpperCase() || 'HOST';
    initHost(name);
  });

  joinBtn.addEventListener('click', () => {
    const name = joinNameInput.value.trim().toUpperCase() || 'GUEST';
    const code = joinCodeInput.value.trim().toUpperCase();

    if (code.length !== 6) {
      joinError.textContent = 'Room code must be 6 characters.';
      return;
    }

    initGuest(name, code);
  });

  gameSelect.addEventListener('change', (e) => {
    if (isHost) {
      selectedGame = e.target.value;
      members.forEach(m => m.ready = false);
      myReady = false;
      readyBtn.textContent = "I'm Ready";
      readyBtn.className = "btn btn-primary";
      
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
      stopSingleplayerGame();
    }
  });

  playSingleplayerBtn.addEventListener('click', () => {
    if (isHost) {
      isPlayingInIframe = true;
      const filePrefix = selectedGame;
      gameIframe.src = `games/${filePrefix}.html`;
      showViewportState(stateGameIframeWrap);

      playSingleplayerBtn.style.display = 'none';
      stopSingleplayerBtn.style.display = 'inline-block';

      const gameLabel = gameSelect.options[gameSelect.selectedIndex].text.split(' (')[0];
      members[0].status = `Playing ${gameLabel}`;
      broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
      renderMembers();
      updateViewportHeader(`Playing ${gameLabel}`);
    }
  });

  stopSingleplayerBtn.addEventListener('click', stopSingleplayerGame);

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

  launchBtn.addEventListener('click', () => {
    if (isHost) {
      const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Send LAUNCH to all guests FIRST, before any ROOM_UPDATE
      broadcast({
        type: 'LAUNCH',
        game: selectedGame,
        sessionId: sessionId
      });

      // Load for host
      isPlayingInIframe = true;
      gameIframe.src = `games/${selectedGame}.html?role=host&room=${sessionId}&name=${encodeURIComponent(myName)}`;
      showViewportState(stateGameIframeWrap);
      
      playSingleplayerBtn.style.display = 'none';
      stopSingleplayerBtn.style.display = 'inline-block';

      const gameLabel = gameSelect.options[gameSelect.selectedIndex].text.split(' (')[0];
      members[0].status = `Playing ${gameLabel}`;

      // Delay ROOM_UPDATE slightly so guests process LAUNCH first
      setTimeout(() => {
        broadcast({ type: 'ROOM_UPDATE', members: members, game: selectedGame });
        renderMembers();
      }, 500);

      updateViewportHeader(`Playing ${gameLabel}`);
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

  document.getElementById('room-code-box').addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    const hint = document.querySelector('.copy-hint');
    if (hint) {
      hint.textContent = 'Copied!';
      setTimeout(() => hint.textContent = 'Click to copy room code', 2000);
    }
  });

})();
