import * as Quagga from '@ericblade/quagga2';
import { makeObserver } from './scan-stability.js';

const VIDEO_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
  },
  audio: false,
};

// native BarcodeDetector(Android Chrome / 桌面 Safari 17.4+ 用;iOS Safari 不支援)
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
// quagga2 reader 名稱(iOS Safari 等 fallback;具 barcode locator,旋轉/縮放較 robust)
const QUAGGA_READERS = ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'];

export function createScanner() {
  let stream = null;
  let active = false;
  let rafId = 0;
  let detector = null;
  let canvas = null;
  let ctx = null;
  let decoding = false;

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  // native: rAF + BarcodeDetector.detect
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

  // fallback(iOS): rAF + canvas + quagga decodeSingle。
  // 自己管相機顯示(第一版模式,證明正常),quagga2 只 decode,避開其 LiveStream 在 iOS 黑屏 bug。
  function startQuaggaLoop(videoEl, observe) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    const tick = () => {
      if (!active) return;
      if (!decoding && videoEl.videoWidth) {
        decoding = true;
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        Quagga.decodeSingle(
          {
            src: canvas.toDataURL('image/jpeg', 0.6),
            numOfWorkers: 0,
            inputStream: { size: 800 },
            locator: { patchSize: 'medium', halfSample: true },
            decoder: { readers: QUAGGA_READERS },
            locate: true,
          },
          (result) => {
            observe(result?.codeResult?.code ?? '');
            decoding = false;
          },
        );
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  async function startContinuous(videoEl, { onDetect, onIdle, onError, onReady }) {
    if (active) return;
    active = true;
    const observe = makeObserver(onDetect, onIdle);

    // 兩條路徑都自己 getUserMedia 顯示 video(避開 quagga2 LiveStream 在 iOS 的黑屏 bug)
    try {
      stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (err) {
      active = false;
      onError?.(err);
      throw err;
    }
    onReady?.();

    if (typeof BarcodeDetector !== 'undefined') {
      try {
        detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
        startNativeLoop(videoEl, observe);
        return;
      } catch {
        detector = null;
      }
    }

    startQuaggaLoop(videoEl, observe);
  }

  async function stop() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    detector = null;
    canvas = null;
    ctx = null;
    decoding = false;
    stopStream();
  }

  return { startContinuous, stop };
}