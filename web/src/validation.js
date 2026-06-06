export function validateEntry({ operator, barcode, description }) {
  const op = (operator ?? '').trim();
  const bc = (barcode ?? '').trim();
  const desc = (description ?? '').trim();

  if (!op) {
    return { ok: false, error: '請輸入作業者名字' };
  }
  if (!bc && !desc) {
    return { ok: false, error: '請至少填寫條碼或商品描述' };
  }
  return { ok: true };
}

export function normalizeEntry({ operator, barcode, description, note }) {
  return {
    operator: (operator ?? '').trim(),
    barcode: (barcode ?? '').trim(),
    description: (description ?? '').trim(),
    note: (note ?? '').trim(),
  };
}
