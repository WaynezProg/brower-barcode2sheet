const COOLDOWN_MS = 1500;

export function shouldSkipBarcode(barcode, state, now = Date.now()) {
  if (!barcode) return false;
  if (barcode === state.lastBarcode && now - state.lastWrittenAt < COOLDOWN_MS) {
    return true;
  }
  return false;
}

export function recordBarcodeWrite(barcode, state, now = Date.now()) {
  state.lastBarcode = barcode;
  state.lastWrittenAt = now;
  return state;
}

export { COOLDOWN_MS };
