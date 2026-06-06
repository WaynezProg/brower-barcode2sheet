import { getOperator, saveOperator } from './operator.js';
import { validateEntry } from './validation.js';
import { submitEntry } from './api.js';
import { createScanner } from './scanner.js';
import { createVoiceInput } from './voice.js';
import { getMode } from './mode.js';
import { shouldSkipBarcode, recordBarcodeWrite } from './debounce.js';
import { feedbackSuccess, feedbackError, initFeedback } from './feedback.js';
import {
  $, showToast, showModal, hideModal, setSubmitEnabled,
  clearEntryFields, readFormFields, syncOperatorLabel,
  fillConfirmModal, readConfirmModal, setModeBadge,
} from './ui.js';

const scanner = createScanner();
const voice = createVoiceInput();
const cooldownState = { lastBarcode: '', lastWrittenAt: 0 };
let continuousActive = false;

function refreshSubmitState() {
  const entry = readFormFields();
  const result = validateEntry(entry);
  setSubmitEnabled(result.ok);
  return result;
}

function initMode() {
  const mode = getMode();
  setModeBadge(mode);
  $('scan-btn').textContent = mode === 'local' ? '開始掃碼' : '掃描條碼';
}

async function handleLocalScan(code) {
  const operator = getOperator() || $('operator-input').value.trim();
  if (!operator) {
    showToast('請輸入作業者', 'error');
    return;
  }
  if (shouldSkipBarcode(code, cooldownState)) {
    showToast('剛掃過', 'error', 800);
    return;
  }
  scanner.pause();
  const fields = readFormFields();
  const entry = { operator, barcode: code, description: fields.description, note: fields.note };
  const response = await submitEntry(entry);
  if (!response.ok) {
    feedbackError();
    showToast(response.error, 'error');
    scanner.resume();
    return;
  }
  recordBarcodeWrite(code, cooldownState);
  feedbackSuccess();
  $('barcode-input').value = '';
  refreshSubmitState();
  scanner.resume();
}

function initOperator() {
  const saved = getOperator();
  if (saved) {
    $('operator-input').value = saved;
    syncOperatorLabel(saved);
  }
  $('operator-input').addEventListener('input', () => {
    const name = saveOperator($('operator-input').value);
    syncOperatorLabel(name);
    refreshSubmitState();
  });
}

function initForm() {
  ['barcode-input', 'description-input', 'note-input'].forEach((id) => {
    $(id).addEventListener('input', refreshSubmitState);
  });
}

function initScanner() {
  const mode = getMode();
  const overlay = $('scanner-overlay');
  const video = $('scanner-video');

  $('scan-btn').addEventListener('click', async () => {
    initFeedback();

    if (mode === 'local') {
      if (continuousActive) {
        continuousActive = false;
        await scanner.stop();
        overlay.classList.add('hidden');
        $('scan-btn').textContent = '開始掃碼';
        return;
      }
      continuousActive = true;
      $('scan-btn').textContent = '結束掃碼';
      overlay.classList.remove('hidden');
      try {
        await scanner.start(video, handleLocalScan, () => {});
      } catch {
        continuousActive = false;
        overlay.classList.add('hidden');
        $('scan-btn').textContent = '開始掃碼';
        showToast('無法開啟相機，請手動輸入條碼', 'error');
      }
      return;
    }

    overlay.classList.remove('hidden');

    try {
      await scanner.start(
        video,
        async (code) => {
          await scanner.stop();
          overlay.classList.add('hidden');
          $('barcode-input').value = code;
          refreshSubmitState();
          showToast('條碼已帶入');
        },
        () => {},
      );
    } catch {
      overlay.classList.add('hidden');
      showToast('無法開啟相機，請手動輸入條碼', 'error');
    }
  });

  $('scanner-cancel').addEventListener('click', async () => {
    continuousActive = false;
    await scanner.stop();
    overlay.classList.add('hidden');
    if (mode === 'local') {
      $('scan-btn').textContent = '開始掃碼';
    }
  });
}

function initVoice() {
  $('voice-btn').addEventListener('click', () => {
    if (!voice.isSupported()) {
      showToast('語音不可用，請手動輸入', 'error');
      $('description-input').focus();
      return;
    }
    showToast('請開始說話…', 'success', 1500);
    voice.start({
      onResult: (text) => {
        $('description-input').value = text;
        refreshSubmitState();
        showToast('語音已帶入');
      },
      onError: (err) => {
        showToast(err.message, 'error');
        $('description-input').focus();
      },
    });
  });
}

function initConfirmFlow() {
  $('submit-btn').addEventListener('click', () => {
    const entry = readFormFields();
    const result = validateEntry(entry);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    fillConfirmModal(entry);
    showModal('confirm-modal');
  });

  $('confirm-cancel').addEventListener('click', () => hideModal('confirm-modal'));

  $('confirm-submit').addEventListener('click', async () => {
    const operator = getOperator() || $('operator-input').value.trim();
    const entry = readConfirmModal(operator);
    const result = validateEntry(entry);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }

    $('confirm-submit').disabled = true;
    const response = await submitEntry(entry);
    $('confirm-submit').disabled = false;

    if (!response.ok) {
      showToast(response.error, 'error');
      return;
    }

    hideModal('confirm-modal');
    clearEntryFields();
    refreshSubmitState();
    showToast('寫入成功');
  });
}

initMode();
initOperator();
initForm();
initScanner();
initVoice();
initConfirmFlow();
refreshSubmitState();
