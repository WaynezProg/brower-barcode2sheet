import { describe, it, expect, vi } from 'vitest';
import { makeObserver } from '../web/src/scanner.js';

describe('makeObserver (連掃防重複去抖)', () => {
  it('同一條碼需連續 2 幀才 onDetect 一次,之後同碼不再 onDetect', () => {
    const onDetect = vi.fn();
    const onIdle = vi.fn();
    const observe = makeObserver(onDetect, onIdle);

    observe('4710000000017'); // 第 1 幀:stable 尚未達標
    expect(onDetect).not.toHaveBeenCalled();
    observe('4710000000017'); // 第 2 幀:達標,onDetect
    expect(onDetect).toHaveBeenCalledTimes(1);
    expect(onDetect).toHaveBeenCalledWith('4710000000017');
    observe('4710000000017'); // 第 3 幀:同碼,去抖不再 onDetect
    expect(onDetect).toHaveBeenCalledTimes(1);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('連續 2 幀無碼才 onIdle 並清除,清除後同碼可再 onDetect(移開再掃寫第二筆)', () => {
    const onDetect = vi.fn();
    const onIdle = vi.fn();
    const observe = makeObserver(onDetect, onIdle);

    observe('4710000000017');
    observe('4710000000017');
    expect(onDetect).toHaveBeenCalledTimes(1);

    observe(''); // 空幀 1:還不 onIdle
    expect(onIdle).not.toHaveBeenCalled();
    observe(''); // 空幀 2:onIdle + 清除
    expect(onIdle).toHaveBeenCalledTimes(1);

    observe('4710000000017'); // 清除後第 1 幀
    expect(onDetect).toHaveBeenCalledTimes(1); // 仍未達標
    observe('4710000000017'); // 清除後第 2 幀:可再 onDetect
    expect(onDetect).toHaveBeenCalledTimes(2);
  });

  it('單幀空碼不誤觸 onIdle(避免條碼瞬間模糊造成過早清除)', () => {
    const onDetect = vi.fn();
    const onIdle = vi.fn();
    const observe = makeObserver(onDetect, onIdle);

    observe('4710000000017');
    observe('4710000000017');
    observe(''); // 單幀模糊
    observe('4710000000017'); // 條碼還在 → 不該重新 onDetect(lastEmitted 未清)
    expect(onIdle).not.toHaveBeenCalled();
    expect(onDetect).toHaveBeenCalledTimes(1);
  });

  it('不同碼入框會 onDetect(連掃不同商品不被擋)', () => {
    const onDetect = vi.fn();
    const onIdle = vi.fn();
    const observe = makeObserver(onDetect, onIdle);

    observe('4710000000017');
    observe('4710000000017');
    expect(onDetect).toHaveBeenCalledWith('4710000000017');

    observe('4710000000024');
    observe('4710000000024');
    expect(onDetect).toHaveBeenCalledWith('4710000000024');
    expect(onDetect).toHaveBeenCalledTimes(2);
    expect(onIdle).not.toHaveBeenCalled();
  });
});