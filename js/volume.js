/* ===== Lightsaber Volume Control ===== */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('lightsaber-volume');
  if (!container) return;

  const slider = container.querySelector('.volume-slider');
  const hiltBtn = container.querySelector('.hilt-btn');
  
  if (!slider || !hiltBtn) return;

  // Initialize from saved volume
  const savedVol = window.SFX ? window.SFX.getVolume() : 0.5;
  slider.value = savedVol;
  updateBladeColor(savedVol);

  // Mute toggle
  let lastVol = savedVol > 0 ? savedVol : 0.5;
  hiltBtn.addEventListener('click', () => {
    if (slider.value > 0) {
      lastVol = slider.value;
      slider.value = 0;
    } else {
      slider.value = lastVol;
    }
    applyVolume(slider.value);
  });

  // Slider change
  slider.addEventListener('input', (e) => {
    applyVolume(e.target.value);
  });

  function applyVolume(val) {
    const v = parseFloat(val);
    updateBladeColor(v);
    if (window.SFX) {
      window.SFX.setVolume(v);
    }
  }

  function updateBladeColor(val) {
    if (val == 0) {
      container.classList.add('muted');
      container.style.setProperty('--blade-length', '0%');
    } else {
      container.classList.remove('muted');
      container.style.setProperty('--blade-length', `${val * 100}%`);
    }
  }

  // Start BGM on first interaction
  const startBGM = () => {
    if (window.SFX && slider.value > 0) {
      window.SFX.startBGM();
    }
    document.removeEventListener('click', startBGM);
    document.removeEventListener('keydown', startBGM);
  };
  document.addEventListener('click', startBGM);
  document.addEventListener('keydown', startBGM);
});
