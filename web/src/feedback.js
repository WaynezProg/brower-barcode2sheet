let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq, durationMs) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), durationMs);
  } catch { /* silent */ }
}

export function feedbackSuccess() {
  beep(880, 120);
  navigator.vibrate?.(40);
  flash('success');
}

export function feedbackError() {
  beep(440, 100);
  setTimeout(() => beep(440, 100), 180);
  navigator.vibrate?.(80);
  flash('error');
}

export function initFeedback() {
  getAudioContext();
}

function flash(type) {
  const el = document.getElementById('flash-overlay');
  if (!el) return;
  el.className = `flash-overlay flash-${type}`;
  setTimeout(() => { el.className = 'flash-overlay hidden'; }, 300);
}
