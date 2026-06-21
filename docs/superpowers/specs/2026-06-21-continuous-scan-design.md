# 連續掃描模式設計 (2026-06-21)

## 問題

現有流程是「單筆表單」節奏:點掃描 → 開相機 → 掃到 → 關相機 → 填描述 → 按 submit → 清空 → 再點掃描。每件商品 6+ 步且每件重開相機(iPhone `getUserMedia` 啟動有明顯延遲)。與目標「手機瀏覽器像條碼機一樣快速記錄商品到 Google Sheet」有結構性落差。

另一問題:`apps-script/Code.gs` 硬編 `WRITE_TOKEN` 且已 commit 進 git history,任何能讀 repo 的人都拿得到 Sheet 寫入權。

## 目標 / 成功條件

- 相機常駐,掃到穩定條碼即送出(等 Apps Script 回應),嗶聲+震動回饋,不用按 submit、不用關再開相機。
- 防同一條碼重複寫入(條碼不移開只寫一次,移開再掃才寫下一筆)。
- 語音模式可選(畫面 toggle,預設關):開啟時掃到條碼先等語音補描述再一起送;關閉時送純條碼,描述/備註事後在 Sheet 補。
- operator 進入連續掃描前設定一次(已存 localStorage),未設則擋住。
- 送出失敗可重送同一筆。
- `WRITE_TOKEN` 不再寫死於 `Code.gs`,改讀 Apps Script Script Properties。
- 既有單筆表單模式移除;語音輸入保留為連掃內的子狀態。

## 考慮的方案

### 連掃狀態管理擺放
- **A(選)**:`scanner.js` 改持續偵測(相機不關、stable reader、邊沿通知),新增 `continuous.js` 純狀態機(防連發/送出/語音/清單),`main.js` 組裝。職責單一、可獨立測、符合既有模組風格。
- B:狀態機內聯 `main.js`。`main.js` 膨脹、難測。**斃**:職責混雜。
- C:連掃獨立頁面 route。過度工程。**斃**:YAGNI,無框架還要手搞路由。

### 防重複寫入
- **選:條碼必須先離開鏡頭**,由 `scanner.js` 的 observer 邊沿去抖負責(最底層、最自然)。observer 記 `lastEmitted`,同一條碼只在「進入框」時 `onDetect` 一次;從有碼變連續 2 幀無碼才 `onIdle` 清 `lastEmitted`。結果:條碼不移開只 `onDetect` 一次 → 只寫一筆;移開(`onIdle`)再掃同碼 → 再 `onDetect` → 寫第二筆。等同條碼機「掃完要移開才能掃下一件」的程式強制防呆。`continuous.js` 不重複查 `lastSubmittedCode`,只在非 `scanning` 狀態忽略 detect(送出中不收新碼)。
- 時間冷卻(掃完 N 秒內不再採同碼):冷卻過後同一條碼還在鏡頭內會重複寫入。**斃**:語意不正確。
- 不防呆靠人移開:不可靠。**斃**。

### 送出節奏
- **選:等回應再下一件**。每筆確認寫入成功才解鎖,失敗 toast + 停在 `locked` 可重送。可靠,免本機重送暫存邏輯。
- 樂觀送出(掃到即放行,fetch 背景跑,失敗標記重送):最快但需本機暫存 + 重送佇列,複雜度高。使用者選可靠。**斃**。

### 描述/備註
- **選:事後在 Sheet 補**。不動 Apps Script 寫入邏輯(`doPost`/`appendRow` 不變),不需重新 Deploy 後端、不需 update row 能力。
- App 內重送更新同一列:需改 Code.gs 加 update + 重新 Deploy + 前端記 row key。**斃**:範圍大、收益低(補描述在 Sheet key 更快)。

### 手動條碼後門
- **選:不留**。條碼機場景手動 key 13 碼不切實際,相機壞是罕見,真要補去 Sheet key。YAGNI。
- 留後門:多一個輸入框 + 送出鈕 + 分支,稀釋「最像條碼機」。**斃**。

### Token 修復
- **選:`Code.gs` 改讀 `PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN')`**,沒設回 `Unauthorized: server token not configured`。repo 的 `Code.gs` 是「要貼進 Apps Script 的範本」,改範本不影響已部署版本(使用者主動重新貼 + Deploy 才切換),故不破壞現狀。遷移步驟寫進 `apps-script/README.md`:去 Project Settings → Script Properties 設 `WRITE_TOKEN`(可沿用舊值或 rotate 新值)+ 重新貼 Code.gs + Deploy。
- rotate:讓 history 內舊 token 失效即解除實質風險。實際 rotate 需使用者在 Apps Script 端同步設新值,給 `openssl rand -hex 16` 指令。
- **git history 不 rewrite**:rotate 已使舊 token 無害;rewrite 要 force push,影響 GitHub Pages 部署與任何 clone,破壞性高、收益接近零。**斃**:rewrite history。

## 架構

### 前端 `web/src/`

**`scanner.js`(改)** — 相機 + 偵測 + 穩定性 + 邊沿通知,不做狀態決策。
- `startContinuous(videoEl, { onDetect, onIdle, onError })`:開相機(`BarcodeDetector` 優先,zxing fallback),rAF loop + `createStableReader(2)`。
  - 每幀 stable read 有碼 → `onDetect(code)`。
  - 從「上一幀有 stable 碼」變「無碼」時 → `onIdle()`(邊沿通知,不每幀灌)。
- `stop()`:關相機、cancel rAF、reset reader。
- 移除原單次 `start`(單筆模式移除)。

**`continuous.js`(新增)** — 純狀態機,不碰 DOM/相機,依賴全注入,可獨立測。
- `createContinuousController({ submit, voice, ui, getOperator })` → `{ start, stop, handleDetect, handleIdle, setVoiceMode, retry, skipVoice }`。
- 狀態:`idle → scanning → locked → submitting → done → scanning`。
  - `start()`:擋 operator(空→`ui.toast` 錯、return);state=`scanning`;`ui.setScanStatus('掃描中…')`。
  - `handleDetect(code)`:若非 `scanning` → 忽略(送出中不收新碼);否則 state=`locked`、`pendingCode=code`;voiceMode → `ui.setScanStatus('收音中…')`、`voice.start({onResult: (d)=>submit(code,d), onError, onEnd})`;否則 `submit(code,'')`。防重複寫入(同碼不移開)由 `scanner` observer 邊沿去抖負責,不在此查。
  - `handleIdle()`:`scanner` observer 邊沿通知;本控制器無需動作(保留介面)。
  - `submit(code, desc)`:state=`submitting`;`res=await submit({operator:getOperator(),barcode:code,description:desc,note:''})`;ok→state=`done`、`ui.beep()+ui.vibrate()+ui.appendRecent(時間,code,'✓')`、`lastSubmittedCode=code`、state=`scanning`、`ui.setScanStatus('掃描中…')`;fail→`ui.toast(err,'error')`、state=`locked`、`ui.setScanStatus('寫入失敗,可重送')`。
  - `retry()`:state==`locked` → 重送 `pendingCode`(+`pendingDesc` 若有)。
  - `skipVoice()`:state==`locked` 且 voiceMode → `voice.stop()`、`submit(pendingCode,'')`。
  - `setVoiceMode(bool)`、`stop()`:voice.stop + state=`idle` + `ui.setScanStatus('')`。

**`main.js`(改薄)** — 組裝 + 事件綁定。
- 建 `scanner`、`continuous`(注入 `submitEntry`、`voice`、`ui` 介面、`getOperator`)。
- 「開始連續掃描」按鈕 → 顯示 overlay → `scanner.startContinuous(video, {onDetect:continuous.handleDetect, onIdle:continuous.handleIdle, onError})` + `continuous.start()`。
- 語音 toggle → `continuous.setVoiceMode`。
- 「停止」按鈕 → `continuous.stop()` + `scanner.stop()` + 關 overlay。
- 「重送」「跳過語音」按鈕 → `continuous.retry()` / `continuous.skipVoice()`。
- operator 輸入 → `saveOperator` + `syncOperatorLabel`(既有邏輯)。
- 移除單筆表單相關 init。

**`ui.js`(改)** — 加:
- `beep()`:Web Audio `AudioContext` 短音(880Hz, 80ms),包在 try/catch + 有無 `AudioContext` guard。
- `vibrate(ms=80)`:`navigator.vibrate` guard。
- `appendRecentRow(time, code, status)` / `clearRecent()`:最近 10 筆清單,新筆插頂。
- `setScanStatus(text)`:掃描 overlay 上的狀態文字。
- 既有 `$`、`showToast`、`syncOperatorLabel`、`readFormFields` 保留(`readFormFields`/`clearEntryFields` 用不到可移,但保留無害;為最小改動保留)。

**`voice.js`、`api.js`、`validation.js`、`operator.js`** — 不動。

### 後端 `apps-script/Code.gs`(改 token 來源)
- 移除 `const WRITE_TOKEN = '...'` 硬編。
- 改 `const WRITE_TOKEN = PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN');`
- `doPost`:token 檢查改為 `if (!WRITE_TOKEN) return jsonResponse({ok:false,error:'server token not configured'},500);` 再 `if (payload.token !== WRITE_TOKEN) ...`。
- `appendRow` 邏輯不動。

### UI `web/index.html`(改)
- 移除:單筆表單的 description / note 欄位、「送出寷入」按鈕、`voice-btn`(語音改 overlay 內 toggle)。
- 保留:operator 設定區、scanner overlay(內含 video、狀態文字、取消鈕)。
- 新增:主畫面「開始連續掃描」按鈕;overlay 內語音 toggle 開關、狀態文字(`#scan-status`)、「重送」「跳過語音」按鈕;主畫面最近清單區(`#recent-list`)。
- `scanner-overlay` 不再只是掃描框,是連掃主操作區(相機持續顯示 + 狀態 + 控制鈕)。

### `web/styles.css`(改)
- 加 toggle 開關、最近清單、掃描狀態文字樣式。

## 資料流(連掃一件純條碼)

```
按「開始連續掃描」
 → continuous.start():擋 operator ok → state=scanning → ui.setScanStatus('掃描中…')
 → scanner.startContinuous 開相機 rAF loop
 → 條碼入框 stable 2 幀 → scanner onDetect('471...')
 → continuous.handleDetect('471...'):state==scanning → state=locked
   voiceMode 關 → submit('471...','')
 → continuous.submit: state=submitting → fetch APPS_SCRIPT_URL (text/plain)
 →Apps Script doPost: Properties token 校驗 → appendRow → {ok:true}
 → 回 ok → state=done → ui.beep+vibrate+appendRecent('471...','✓') → state=scanning
 → 條碼還在框內 → scanner observer 的 lastEmitted 仍='471...' → 不再 onDetect(防重複)
 → 使用者移開 → scanner 偵測連續 2 幀無碼 → onIdle() → 清 lastEmitted
 → 掃下一件 '472...' → onDetect('472...') ≠ lastEmitted('') → handleDetect('472...') → locked → submit …
```

語音模式:locked 時改走 `voice.start`,`onResult` 拿到描述才 `submit(code, desc)`;期間顯示「收音中…」+「跳過」鈕;`onError` → toast + 回 locked 可重試/跳過。

## 錯誤處理

- 相機開失敗:`scanner` `onError` → `continuous` `ui.toast('無法開啟相機','error')` + `state=idle` + 關 overlay。
- fetch 失敗(網路/伺服器):`submit` 回 `{ok:false,error}` → toast + state=`locked` + `setScanStatus('寫入失敗,可重送')` + 顯示重送鈕。
- Apps Script 未 Deploy / 回非 JSON:`api.js` 既有邏輯回「伺服器回應異常」→ 同失敗路徑。
- 語音失敗/不支援:`voice` `onError` → toast + state=`locked`(可跳過或重試)。
- operator 未設:`start()` 擋住 + toast,不開相機。
- token 不一致(前端/Script Properties):`doPost` 回 `Unauthorized` → 前端 toast「寫入失敗」+ 可重送(但重送也會失敗,使用者會去檢 token)。

## 測試

### 自動測(vitest + jsdom)
- **新增 `tests/continuous.test.js`**:測狀態機,stub `submit`/`voice`/`ui`/`getOperator`。
  - 掃到純條碼 → submit 被呼叫、成功 → beep/appendRecent 被呼叫、回 scanning。
  - 非 scanning 狀態的 detect 被忽略(送出中不收新碼)。
  - voiceMode 開 → 掃到後 voice.start 被呼叫、onResult 帶描述才 submit。
  - skipVoice → voice.stop + submit(code,'')。
  - submit 失敗 → state=locked + toast;retry 重送成功。
  - operator 空 → start 擋住、回 false。
- **新增 `tests/observer.test.js`**:測 `scanner.js` 的 `makeObserver` 邊沿去抖(防重複寫入核心,純函式可測)。
  - 同一條碼需連續 2 幀才 onDetect 一次;同碼再 observe 不再 onDetect。
  - 連續 2 幀無碼才 onIdle 並清除;清除後同碼再入框可再 onDetect(移開再掃寫第二筆)。
  - 不同碼入框會 onDetect(連掃不同商品不被擋)。
- **保留**:`api.test.js`、`validation.test.js`、`operator.test.js`、`scan-stability.test.js`(介面沒動)。
- **不自動測**:`scanner.js` 的相機/`BarcodeDetector`/zxing 部分(`getUserMedia`)、`ui.beep/vibrate`(副作用)、`main.js` 組裝 → iPhone Safari 手動驗。

### 手動測試(更新 README)
- [ ] operator 設定後重開仍記住;未設時按連掃被擋住
- [ ] 連掃三件不同條碼 → Sheet 三列、每件嗶+震動
- [ ] 同一條碼不移開 → 只一列;移開再掃同一件 → 第二列
- [ ] 語音模式開 → 掃到顯示收音中 → 說出描述 → 送出含描述
- [ ] 語音模式跳過 → 純條碼送出
- [ ] 斷線送出 → toast 錯誤 + 重送成功
- [ ] 語音失敗 → toast + 可跳過
- [ ] Token 遷移:Apps Script Script Properties 設 WRITE_TOKEN + 重新 Deploy 後仍可寫入

## 範圍與非目標

- 不做 App 內補描述 / 撤銷 / 編輯歷史筆(去 Sheet)。
- 不做本機暫存重送佇列(送出失敗靠當場重送,使用者不離開 overlay)。
- 不做離線佇列 / Service Worker。
- 不動 GitHub Pages 部署流程。
- 不 rewrite git history(rotate 已使舊 token 失效)。
- 不復活 `server/`、`scripts/`、`data/` 或 local CSV mode。