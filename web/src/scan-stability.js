/** 連續讀到相同條碼 N 次才採信，降低誤判。 */
export function createStableReader(requiredHits = 2) {
  let lastCode = '';
  let hitCount = 0;

  return (code) => {
    const text = (code ?? '').trim();
    if (!text) {
      lastCode = '';
      hitCount = 0;
      return null;
    }
    if (text === lastCode) {
      hitCount += 1;
    } else {
      lastCode = text;
      hitCount = 1;
    }
    return hitCount >= requiredHits ? text : null;
  };
}
