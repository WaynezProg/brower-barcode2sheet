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

  function startNativeLoop(videoEl, emit) {
    const tick = async () => {
      if (!active) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes.length > 0) {
          emit(codes[0].rawValue);
        }
      } catch {
        // 單幀失敗忽略，下一幀再試
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  async function start(videoEl, onResult, onError) {
    if (active) return;
    active = true;
    const emit = createStableReader(2);
    const onStable = (code) => {
      const accepted = emit(code);
      if (accepted) onResult(accepted);
    };

    if (typeof BarcodeDetector !== 'undefined') {
      try {
        detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
        stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        videoEl.srcObject = stream;
        await videoEl.play();
        startNativeLoop(videoEl, onStable);
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
          if (result) onStable(result.getText());
          if (err && err.name !== 'NotFoundException') {
            onError?.(err);
          }
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

  return { start, stop };
}
