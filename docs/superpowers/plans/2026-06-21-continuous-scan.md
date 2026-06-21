# 實作計畫:連續掃描模式 (2026-06-21)

Spec: `docs/superpowers/specs/2026-06-21-continuous-scan-design.md`

## 順序

1. **`web/src/scanner.js`** — 移除單次 `start`,改 `startContinuous(video, {onDetect, onIdle, onError})` + `stop()`。stable reader 保留,加「從有碼變無碼」邊沿通知 `onIdle`。
2. **`web/src/continuous.js`**(新)— 純狀態機 `createContinuousController`,依賴全注入。
3. **`web/src/ui.js`** — 加 `beep`/`vibrate`/`appendRecentRow`/`clearRecent`/`setScanStatus`。
4. **`web/index.html`** — 移除單筆表單欄位/submit/voice-btn,加連掃按鈕/語音 toggle/狀態/重送/跳過/最近清單。
5. **`web/styles.css`** — toggle、清單、狀態樣式。
6. **`web/src/main.js`** — 組裝 scanner + continuous + 事件綁定,移除單筆 init。
7. **`apps-script/Code.gs`** — token 改讀 Script Properties。
8. **`apps-script/README.md`** — 更新遷移步驟(Script Properties)。
9. **`web/public/config.example.js`** — 更新註釋(token 與 Script Properties 一致)。
10. **`tests/continuous.test.js`**(新)— 狀態機測試。
11. **`README.md`** — 更新手動測試清單。
12. **驗證**:`pnpm test`(全綠)、`pnpm build`(dist 產出)。
13. **commit**:spec + plan + 實作。

## 風險與驗證對照

- 防重複寫入:自動測 `handleDetect 同碼忽略` + `handleIdle 後可重掃`;手動測「不移開只一列」。
- 送出等回應:自動測 `submit 失敗→locked→retry`;手動測斷線重送。
- 語音分支:自動測 `voiceMode→voice.start→onResult→submit` + `skipVoice`;手動測收音。
- Token:手動測 Script Properties 遷移;`api.test.js` 仍用 stub token 不受影響。
- 不破壞既有:`api/validation/operator/scan-stability` 測試不動,必須全綠。