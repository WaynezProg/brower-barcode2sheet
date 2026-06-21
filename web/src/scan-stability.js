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

/**
 * 邊沿去抖 observer:同一條碼只在「進入框」時 onDetect 一次;
 * 從有碼變連續無碼(2 幀)才 onIdle,用來解除「同碼不再採信」狀態。
 * 連掃防重複寫入靠這層:條碼不移開只 onDetect 一次 → 只寫一筆;
 * 移開(onIdle)再掃同碼 → 再 onDetect → 寫第二筆。
 *
 * 純函式,不依賴相機或任何 decode library,可獨立測。
 */
export function makeObserver(onDetect, onIdle) {
  const stable = createStableReader(2);
  let lastEmitted = '';
  let emptyStreak = 0;

  return (code) => {
    const text = (code ?? '').trim();
    if (text) {
      emptyStreak = 0;
      const accepted = stable(text);
      if (accepted && accepted !== lastEmitted) {
        lastEmitted = accepted;
        onDetect(accepted);
      }
      return;
    }
    stable('');
    emptyStreak += 1;
    if (emptyStreak >= 2 && lastEmitted) {
      lastEmitted = '';
      emptyStreak = 0;
      onIdle();
    }
  };
}