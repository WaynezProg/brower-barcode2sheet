/**
 * 連續掃描狀態機。純邏輯,不碰 DOM / 相機,依賴全注入,可獨立測。
 * 狀態:idle → scanning → locked → submitting → done → scanning
 *
 * 防重複寫入由 scanner.js 的 observer 邊沿去抖負責(同碼不移開只 onDetect 一次);
 * 這裡只管狀態推進:非 scanning 時忽略 detect(送出中不收新碼)。
 */

export function createContinuousController({ submit, voice, ui, getOperator }) {
  let state = 'idle';
  let pendingCode = '';
  let pendingDesc = '';
  let voiceMode = false;

  function start() {
    if (!getOperator()?.trim()) {
      ui.toast('請先輸入作業者名字', 'error');
      return false;
    }
    state = 'scanning';
    ui.setScanStatus('掃描中…');
    return true;
  }

  function handleDetect(code) {
    if (state !== 'scanning') return;
    pendingCode = code;
    pendingDesc = '';
    state = 'locked';
    if (voiceMode) {
      ui.setScanStatus('收音中…說出商品描述');
      voice.start({
        onResult: (text) => {
          pendingDesc = text;
          submitPending();
        },
        onError: (err) => {
          ui.toast(err.message || '語音失敗', 'error');
          ui.setScanStatus('語音失敗,可跳過或重試');
        },
      });
    } else {
      submitPending();
    }
  }

  // scanner 去抖已防重複,onIdle 這裡不需動作;保留介面供未來擴充。
  function handleIdle() {}

  async function submitPending() {
    state = 'submitting';
    ui.setScanStatus('寫入中…');
    const res = await submit({
      operator: getOperator(),
      barcode: pendingCode,
      description: pendingDesc,
      note: '',
    });
    if (res.ok) {
      ui.beep();
      ui.vibrate();
      ui.appendRecentRow(pendingCode, '✓');
      state = 'scanning';
      ui.setScanStatus('掃描中…');
    } else {
      state = 'locked';
      ui.toast(res.error || '寫入失敗', 'error');
      ui.setScanStatus('寫入失敗,可重送');
    }
  }

  function retry() {
    if (state !== 'locked') return;
    submitPending();
  }

  function skipVoice() {
    if (state !== 'locked' || !voiceMode) return;
    voice.stop?.();
    pendingDesc = '';
    submitPending();
  }

  function setVoiceMode(enabled) {
    voiceMode = enabled;
  }

  function stop() {
    voice.stop?.();
    state = 'idle';
    ui.setScanStatus('');
  }

  return {
    start,
    stop,
    handleDetect,
    handleIdle,
    setVoiceMode,
    retry,
    skipVoice,
    getState: () => state,
  };
}