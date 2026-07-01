/* ===== Watch Lounge Frame Synchronizer (Cursor Removed) ===== */
(function () {
  'use strict';

  // ─── Iframe Environment Detection & Canvas Streaming ─────────────────
  if (window.self !== window.top) {
    // Inject stylesheet to clean up the game page layout inside iframe
    const style = document.createElement('style');
    style.textContent = `
      body {
        background: transparent !important;
        overflow: hidden !important;
      }
      #starfield,
      #lightsaber-volume,
      .back-btn,
      .arcade-header,
      .game-arcade-header,
      .game-header,
      #lobby-overlay,
      #waiting-overlay,
      #connecting-overlay,
      #countdown-overlay,
      #gameover-overlay,
      #disconnect-overlay {
        display: none !important;
      }
      .page-content {
        min-height: unset !important;
        height: 100vh !important;
        justify-content: center !important;
        padding: 0 !important;
        gap: 0 !important;
      }
      .game-canvas-wrap {
        box-shadow: none !important;
        border: none !important;
        background: transparent !important;
      }
      .game-controls-hint {
        display: none !important;
      }
      canvas {
        max-height: 95vh !important;
        max-width: 95vw !important;
      }
    `;
    document.head.appendChild(style);

    // Canvas frame sending loop
    let lastFrameTime = 0;
    function sendFrames() {
      const now = performance.now();
      if (now - lastFrameTime > 80) { // Stream around 12 FPS (80ms interval) to keep it fast & smooth
        const canvas = document.querySelector('canvas');
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.4); // compressed JPEG for performance
            window.parent.postMessage({ type: 'ARCADE_FRAME', dataUrl: dataUrl }, '*');
            lastFrameTime = now;
          } catch (e) {
            // Silence security errors if canvas has tainted data
          }
        }
      }
      requestAnimationFrame(sendFrames);
    }
    // Start sending frames after page loads
    window.addEventListener('load', sendFrames);
    // Fallback if load already fired
    if (document.readyState === 'complete') {
      sendFrames();
    }
  }

})();
