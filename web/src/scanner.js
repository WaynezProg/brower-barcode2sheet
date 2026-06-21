import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from '@zxing/library';
import { createStableReader } from './scan-stability.js';

const VIDEO_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
  },
  audio: false,
};

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function createZxingReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

/**
 * 邊沿去抖 observer:同一條碼只在「進入框」時 onDetect 一次;
 * 從有碼變連續無碼(2 幀)才 onIdle,用來解除「同碼不再採信」狀態。
 * 連掃防重複寫入靠這層:條碼不移開只 onDetect 一次 → 只寫一筆;
 * 移開(onIdle)再掃同碼 → 再 onDetect → 寫第二筆。
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

export function createScanner() {
  const reader = createZxingReader();
  let stream = null;
  let active = false;
  let rafId = 0;
  let detector = null;

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function startNativeLoop(videoEl, observe) {
    const tick = async () => {
      if (!active) return;
      try {
        const codes = await detector.detect(videoEl);
        observe(codes[0]?.rawValue ?? '');
      } catch {
        observe('');
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  async function startContinuous(videoEl, { onDetect, onIdle, onError }) {
    if (active) return;
    active = true;
    const observe = makeObserver(onDetect, onIdle);

    if (typeof BarcodeDetector !== 'undefined') {
      try {
        detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
        stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        videoEl.srcObject = stream;
        await videoEl.play();
        startNativeLoop(videoEl, observe);
        return;
      } catch {
        detector = null;
        stopStream();
      }
    }

    try {
      await reader.decodeFromConstraints(
        VIDEO_CONSTRAINTS,
        videoEl,
        (result, err) => {
          if (result) observe(result.getText());
          else if (err && err.name === 'NotFoundException') observe('');
          else if (err) onError?.(err);
        },
      );
    } catch (err) {
      active = false;
      onError?.(err);
      throw err;
    }
  }

  async function stop() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    detector = null;
    reader.reset();
    stopStream();
  }

  return { startContinuous, stop };
}