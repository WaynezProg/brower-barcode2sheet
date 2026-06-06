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

export function showModal(modalId) {
  $(modalId).classList.remove('hidden');
}

export function hideModal(modalId) {
  $(modalId).classList.add('hidden');
}

export function setSubmitEnabled(enabled) {
  $('submit-btn').disabled = !enabled;
}

export function clearEntryFields() {
  $('barcode-input').value = '';
  $('description-input').value = '';
  $('note-input').value = '';
}

export function readFormFields() {
  return {
    operator: $('operator-input').value,
    barcode: $('barcode-input').value,
    description: $('description-input').value,
    note: $('note-input').value,
  };
}

export function syncOperatorLabel(name) {
  $('operator-label').textContent = name || '（未設定）';
}

export function fillConfirmModal(entry) {
  $('confirm-operator').textContent = entry.operator;
  $('confirm-barcode').value = entry.barcode;
  $('confirm-description').value = entry.description;
  $('confirm-note').value = entry.note;
}

export function readConfirmModal(operator) {
  return {
    operator,
    barcode: $('confirm-barcode').value,
    description: $('confirm-description').value,
    note: $('confirm-note').value,
  };
}
