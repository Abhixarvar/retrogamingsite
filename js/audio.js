/* ===== Space Arcade — Retro Audio Engine ===== */
/* Web Audio API synth — no external files needed */
window.SFX = (function () {
  let ctx = null;
  let masterGain = null;
  let bgmOsc = null;
  let bgmGain = null;
  let isBgmPlaying = false;
  let bgmInterval = null;
  let currentVol = parseFloat(localStorage.getItem('spaceArcadeVolume') || '0.5');

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = currentVol;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Utility: quick oscillator + gain envelope
  function tone(freq, type, duration, volume, rampEnd) {
    const c = ensure();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (rampEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(rampEnd, 20), c.currentTime + duration);
    }
    gain.gain.setValueAtTime(Math.min(volume || 0.15, 0.3), c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(masterGain);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  // Utility: noise burst
  function noise(duration, volume) {
    const c = ensure();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(Math.min(volume || 0.12, 0.25), c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    // Bandpass for crunch
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;
    src.connect(filter).connect(gain).connect(masterGain);
    src.start();
  }

  // Procedural BGM Sequence
  const sequence = [220, 261.63, 329.63, 392.00, 329.63, 261.63]; // A Minor Pentatonic
  let seqIndex = 0;

  function playBGMNote() {
    if (!isBgmPlaying) return;
    const c = ensure();
    const freq = sequence[seqIndex] / 2; // Deep spacey bass tone
    seqIndex = (seqIndex + 1) % sequence.length;

    const osc = c.createOscillator();
    const gain = c.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    
    // Spacey envelope
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    
    osc.connect(gain).connect(masterGain);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.4);
  }

  return {
    setVolume(val) {
      currentVol = Math.max(0, Math.min(1, val));
      localStorage.setItem('spaceArcadeVolume', currentVol.toString());
      if (masterGain) {
        masterGain.gain.setTargetAtTime(currentVol, ctx.currentTime, 0.1);
      }
    },

    getVolume() {
      return currentVol;
    },

    startBGM() {
      if (isBgmPlaying) return;
      ensure(); // init context if needed
      isBgmPlaying = true;
      if (bgmInterval) clearInterval(bgmInterval);
      bgmInterval = setInterval(playBGMNote, 400); // 150 BPM
    },

    stopBGM() {
      isBgmPlaying = false;
      if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
      }
    },

    /** Laser / shoot */
    shoot() { tone(880, 'square', 0.08, 0.1, 440); },
    /** Small hit / eat / collect dot */
    eat() { tone(600, 'sine', 0.06, 0.1, 900); },
    /** Power pellet / power-up pickup */
    powerup() {
      tone(440, 'square', 0.08, 0.12);
      setTimeout(() => tone(660, 'square', 0.08, 0.12), 60);
      setTimeout(() => tone(880, 'square', 0.12, 0.12), 120);
    },
    /** Explosion / enemy destroyed */
    explode() {
      noise(0.2, 0.15);
      tone(200, 'sawtooth', 0.15, 0.1, 40);
    },
    /** Player hit / lose life */
    hit() {
      noise(0.15, 0.12);
      tone(300, 'square', 0.2, 0.12, 80);
    },
    /** Game over */
    gameOver() {
      tone(440, 'square', 0.15, 0.1, 200);
      setTimeout(() => tone(330, 'square', 0.15, 0.1, 150), 150);
      setTimeout(() => tone(220, 'square', 0.3, 0.1, 80), 300);
    },
    /** Level up / wave clear */
    levelUp() {
      tone(523, 'square', 0.1, 0.12);
      setTimeout(() => tone(659, 'square', 0.1, 0.12), 100);
      setTimeout(() => tone(784, 'square', 0.1, 0.12), 200);
      setTimeout(() => tone(1047, 'square', 0.18, 0.12), 300);
    },
    /** Ghost eaten in pacman */
    ghostEat() {
      tone(300, 'square', 0.06, 0.1, 800);
      setTimeout(() => tone(600, 'square', 0.1, 0.12), 60);
    },
    /** Move / step (very subtle) */
    step() { tone(200, 'sine', 0.03, 0.04, 250); },
  };
})();

