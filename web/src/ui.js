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
