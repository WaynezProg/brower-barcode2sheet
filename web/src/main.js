import { getOperator, saveOperator } from './operator.js';
import { validateEntry } from './validation.js';
import { submitEntry } from './api.js';
import { createScanner } from './scanner.js';
import { createVoiceInput } from './voice.js';
import {
  $, showToast, setSubmitEnabled,
  clearEntryFields, readFormFields, syncOperatorLabel,
} from './ui.js';

const scanner = createScanner();
const voice = createVoiceInput();

function refreshSubmitState() {
  const entry = readFormFields();
  const result = validateEntry(entry);
  setSubmitEnabled(result.ok);
  return result;
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
  $('scan-btn').addEventListener('click', async () => {
    const overlay = $('scanner-overlay');
    const video = $('scanner-video');
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
    await scanner.stop();
    $('scanner-overlay').classList.add('hidden');
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

async function handleSubmit() {
  const operator = getOperator() || $('operator-input').value.trim();
  const fields = readFormFields();
  const entry = {
    operator,
    barcode: fields.barcode,
    description: fields.description,
    note: fields.note,
  };
  const result = validateEntry(entry);
  if (!result.ok) {
    showToast(result.error, 'error');
    return;
  }

  $('submit-btn').disabled = true;
  const response = await submitEntry(entry);
  $('submit-btn').disabled = false;

  if (!response.ok) {
    showToast(response.error, 'error');
    return;
  }

  clearEntryFields();
  refreshSubmitState();
  showToast('寫入成功');
}

function initSubmit() {
  $('submit-btn').addEventListener('click', handleSubmit);
}

initOperator();
initForm();
initScanner();
initVoice();
initSubmit();
refreshSubmitState();
