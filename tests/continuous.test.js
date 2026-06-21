import { describe, it, expect, vi } from 'vitest';
import { createContinuousController } from '../web/src/continuous.js';

function makeDeps() {
  const calls = { submit: [], beep: 0, vibrate: 0, recent: [], toast: [], status: [] };
  let operator = '小明';
  let submitResult = { ok: true };

  let voiceHandlers = null;
  const voice = {
    start: vi.fn((h) => { voiceHandlers = h; }),
    stop: vi.fn(),
  };
  const ui = {
    toast: vi.fn((m, t) => calls.toast.push({ m, t })),
    beep: vi.fn(() => { calls.beep += 1; }),
    vibrate: vi.fn(() => { calls.vibrate += 1; }),
    appendRecentRow: vi.fn((code, status) => calls.recent.push({ code, status })),
    setScanStatus: vi.fn((text) => calls.status.push(text)),
  };
  const submit = vi.fn(async (entry) => {
    calls.submit.push(entry);
    return submitResult;
  });

  const controller = createContinuousController({ submit, voice, ui, getOperator: () => operator });
  return {
    controller,
    calls,
    getVoiceHandlers: () => voiceHandlers,
    voiceStop: voice.stop,
    setOperator: (v) => { operator = v; },
    setSubmitResult: (r) => { submitResult = r; },
  };
}

// 等待 submit 期間所有 microtask 完成
function flush() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

describe('createContinuousController', () => {
  it('start 擋住未設 operator,不進 scanning', () => {
    const d = makeDeps();
    d.setOperator('   ');
    expect(d.controller.start()).toBe(false);
    expect(d.calls.toast[0]).toEqual({ m: '請先輸入作業者名字', t: 'error' });
    expect(d.controller.getState()).toBe('idle');
  });

  it('掃到純條碼 → submit → 成功 → beep/vibrate/recent → 回 scanning', async () => {
    const d = makeDeps();
    d.controller.start();
    d.controller.handleDetect('4710000000017');
    await flush();
    expect(d.calls.submit).toHaveLength(1);
    expect(d.calls.submit[0]).toMatchObject({ operator: '小明', barcode: '4710000000017', description: '', note: '' });
    expect(d.calls.beep).toBe(1);
    expect(d.calls.vibrate).toBe(1);
    expect(d.calls.recent).toEqual([{ code: '4710000000017', status: '✓' }]);
    expect(d.controller.getState()).toBe('scanning');
  });

  it('非 scanning 狀態的 detect 被忽略(idle 不送)', async () => {
    const d = makeDeps();
    d.controller.handleDetect('4710000000017');
    await flush();
    expect(d.calls.submit).toHaveLength(0);
  });

  it('submit 失敗 → locked + toast,不嗶;retry 切成功後重送成功', async () => {
    const d = makeDeps();
    d.setSubmitResult({ ok: false, error: '網路錯誤：timeout' });
    d.controller.start();
    d.controller.handleDetect('4710000000017');
    await flush();
    expect(d.controller.getState()).toBe('locked');
    expect(d.calls.beep).toBe(0);
    expect(d.calls.toast.some((t) => t.m.includes('網路'))).toBe(true);

    d.setSubmitResult({ ok: true });
    d.controller.retry();
    await flush();
    expect(d.calls.submit).toHaveLength(2);
    expect(d.calls.beep).toBe(1);
    expect(d.controller.getState()).toBe('scanning');
  });

  it('語音模式:掃到 → voice.start → onResult 帶描述 → submit 帶描述', async () => {
    const d = makeDeps();
    d.controller.setVoiceMode(true);
    d.controller.start();
    d.controller.handleDetect('4710000000017');
    expect(d.controller.getState()).toBe('locked');
    const h = d.getVoiceHandlers();
    expect(h).not.toBeNull();
    h.onResult('可樂 350ml');
    await flush();
    expect(d.calls.submit[0]).toMatchObject({ barcode: '4710000000017', description: '可樂 350ml' });
    expect(d.controller.getState()).toBe('scanning');
  });

  it('語音模式 skipVoice → voice.stop + 送純條碼', async () => {
    const d = makeDeps();
    d.controller.setVoiceMode(true);
    d.controller.start();
    d.controller.handleDetect('4710000000017');
    d.controller.skipVoice();
    expect(d.voiceStop).toHaveBeenCalled();
    await flush();
    expect(d.calls.submit[0]).toMatchObject({ barcode: '4710000000017', description: '' });
    expect(d.controller.getState()).toBe('scanning');
  });

  it('stop → idle + 清狀態文字', () => {
    const d = makeDeps();
    d.controller.start();
    d.controller.stop();
    expect(d.controller.getState()).toBe('idle');
  });
});