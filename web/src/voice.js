export function createVoiceInput() {
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  function start({ onResult, onError, onEnd }) {
    if (!isSupported()) {
      onError?.(new Error('此瀏覽器不支援語音輸入，請手動輸入'));
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? '';
      onResult?.(text);
    };
    recognition.onerror = (event) => onError?.(new Error(event.error || '語音辨識失敗'));
    recognition.onend = () => onEnd?.();

    recognition.start();
    return recognition;
  }

  return { isSupported, start };
}
