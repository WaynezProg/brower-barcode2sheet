import { getOperator, saveOperator } from './operator.js';
import { submitEntry } from './api.js';
import { createScanner } from './scanner.js';
import { createVoiceInput } from './voice.js';
import { createContinuousController } from './continuous.js';
import {
  $, showToast, syncOperatorLabel,
  beep, vibrate, appendRecentRow, setScanStatus,
} from './ui.js';

const scanner = createScanner();
const voice = createVoiceInput();
const continuous = createContinuousController({
  submit: submitEntry,
  voice,
  ui: { toast: showToast, beep, vibrate, appendRecentRow, setScanStatus },
  getOperator,
});

function initOperator() {
  const saved = getOperator();
  if (saved) {
    $('operator-input').value = saved;
    syncOperatorLabel(saved);
  }
  $('operator-input').addEventListener('input', () => {
    const name = saveOperator($('operator-input').value);
    syncOperatorLabel(name);
  });
}

function initScan() {
  $('start-scan-btn').addEventListener('click', async () => {
    const overlay = $('scanner-overlay');
    const video = $('scanner-video');
    overlay.classList.remove('hidden');

    if (!continuous.start()) {
      overlay.classList.add('hidden');
      return;
    }

    try {
      await scanner.startContinuous(video, {
        onDetect: continuous.handleDetect,
        onIdle: continuous.handleIdle,
        onReady: () => showToast('掃描就緒，對準條碼', 'success', 1500),
        onError: (err) => {
          showToast(`相機錯誤：${err?.message || err?.name || '請檢查權限'}`, 'error', 6000);
          continuous.stop();
          overlay.classList.add('hidden');
        },
      });
    } catch (err) {
      showToast(`相機錯誤：${err?.message || err?.name || '請檢查權限'}`, 'error', 6000);
      continuous.stop();
      overlay.classList.add('hidden');
    }
  });

  $('scanner-cancel').addEventListener('click', async () => {
    await scanner.stop();
    continuous.stop();
    $('scanner-overlay').classList.add('hidden');
  });

  $('voice-toggle').addEventListener('change', (e) => {
    continuous.setVoiceMode(e.target.checked);
  });

  $('retry-btn').addEventListener('click', () => continuous.retry());
  $('skip-voice-btn').addEventListener('click', () => continuous.skipVoice());
}

initOperator();
initScan();