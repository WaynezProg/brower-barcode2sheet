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
// quagga2 reader 名稱(iOS Safari 等 fallback 用;具 barcode locator,旋轉/縮放較 robust)
const QUAGGA_READERS = ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'];

export function createScanner() {
  let stream = null;
  let active = false;
  let rafId = 0;
  let detector = null;
  let usingQuagga = false;

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

  async function startContinuous(videoEl, { onDetect, onIdle, onError, onReady }) {
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
        onReady?.();
        return;
      } catch {
        detector = null;
        stopStream();
      }
    }

    // fallback: quagga2。onProcessed 每幀觸發(有碼帶 codeResult、無碼空),
    // 餵給 observer 做邊沿去抖 + onIdle,防重複寫入邏輯與 native 路徑一致。
    usingQuagga = true;
    try {
      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: videoEl,
            constraints: VIDEO_CONSTRAINTS.video,
          },
          locator: { patchSize: 'medium', halfSample: true },
          numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 0,
          frequency: 10,
          decoder: { readers: QUAGGA_READERS },
          locate: true,
        },
        (err) => {
          if (err) {
            active = false;
            onError?.(err);
            return;
          }
          Quagga.onProcessed((result) => observe(result?.codeResult?.code ?? ''));
          onReady?.();
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
    stopStream();
    if (usingQuagga) {
      try {
        Quagga.stop();
      } catch {
        // 忽略
      }
      usingQuagga = false;
    }
  }

  return { startContinuous, stop };
}