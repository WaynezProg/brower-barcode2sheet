import { BrowserMultiFormatReader } from '@zxing/library';

export function createScanner() {
  const reader = new BrowserMultiFormatReader();
  let stream = null;
  let active = false;
  let paused = false;

  async function start(videoEl, onResult, onError) {
    if (active) return;
    active = true;
    paused = false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      reader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
        if (paused) return;
        if (result) {
          onResult(result.getText());
        }
        if (err && err.name !== 'NotFoundException') {
          onError?.(err);
        }
      });
    } catch (err) {
      active = false;
      onError?.(err);
      throw err;
    }
  }

  async function stop() {
    active = false;
    paused = false;
    reader.reset();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
  }

  return { start, stop, pause, resume };
}
