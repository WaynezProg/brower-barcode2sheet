export const OPERATOR_KEY = 'barcode2sheet:operator';

export function getOperator() {
  return (localStorage.getItem(OPERATOR_KEY) ?? '').trim();
}

export function saveOperator(name) {
  const trimmed = (name ?? '').trim();
  if (trimmed) {
    localStorage.setItem(OPERATOR_KEY, trimmed);
  } else {
    localStorage.removeItem(OPERATOR_KEY);
  }
  return trimmed;
}
