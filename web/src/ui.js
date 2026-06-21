export function $(id) {
  return document.getElementById(id);
}

export function showToast(message, type = 'success', durationMs = 2500) {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), durationMs);
}

export function syncOperatorLabel(name) {
  $('operator-label').textContent = name || '（未設定）';
}

let audioCtx = null;

/** Web Audio 短嗶聲,確認掃到/寫入成功。無 AudioContext 則靜默失敗。 */
export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch {
    // 靜默
  }
}

export function vibrate(ms = 80) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 靜默
  }
}

export function appendRecentRow(code, status) {
  const list = $('recent-list');
  if (!list) return;
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  li.textContent = `${time}　${code}　${status}`;
  list.prepend(li);
  while (list.children.length > 10) list.removeChild(list.lastChild);
}

export function setScanStatus(text) {
  const el = $('scan-status');
  if (el) el.textContent = text;
}