# P2 本機 CSV 掃碼機模式 — 設計規格

> 狀態：已核准（brainstorming 2026-06-06）
> 方案：單一本機 Node server（靜態前端 + CSV API），與 P1 雲端模式並存

## 一句話摘要

在 Mac 本機啟動 `pnpm local`，讓 iPhone Safari 透過區網連線，以連續掃碼機體驗直接 append 寫入 `data/entries.csv`；開 GitHub Pages 時自動走既有 Apps Script 雲端流程。

---

## 決策紀錄

| 議題 | 決策 |
|------|------|
| 裝置 | iPhone Safari 連 Mac 本機 server（同 WiFi） |
| 寫入目標 | 本機 `data/entries.csv`；雲端 Google Sheet 保留 |
| 雙模式 | 並存；依網址自動判斷，不做 UI 切換鈕 |
| 條碼流程 | 連續掃碼、直接寫入、不跳確認 Modal |
| 語音/手動 | 仍走確認 Modal（本機/雲端相同） |
| 條碼附帶欄位 | 掃碼前已填的描述/備註一併寫入 |
| 掃碼後清空 | 只清空條碼欄；描述/備註保留 |
| 多人本機 | 2～3 人同時連同一 Mac；server queue 序列化 append |
| 防連發 | 同一條碼 1.5 秒內不重複寫入 |
| 回饋 | 成功嗶一聲 + 綠 flash；失敗雙聲低音 + 紅 flash；震動有則用 |
| CSV 路徑 | 專案內固定 `data/entries.csv` |
| 作業者 | 延續 P1：手動輸入 + localStorage |

---

## 架構

```
┌─────────────────────────────────────────────────────────┐
│  Mac: pnpm local (0.0.0.0:5173)                         │
│  ┌──────────────┐    POST /api/entries    ┌───────────┐ │
│  │ Vite 靜態 UI │ ──────────────────────▶│ CSV Writer │ │
│  │ (連續掃碼)    │◀────── JSON response ──│ + queue   │ │
│  └──────────────┘                          └─────┬─────┘ │
│                                                   ▼       │
│                                          data/entries.csv │
└─────────────────────────────────────────────────────────┘
         ▲
         │ WiFi (http://192.168.x.x:5173)
    [iPhone Safari]

┌─────────────────────────────────────────────────────────┐
│  GitHub Pages (P1 不變)                                  │
│  iPhone → Apps Script → Google Sheet                     │
└─────────────────────────────────────────────────────────┘
```

### 模式自動判斷

```javascript
function getMode() {
  return window.location.hostname.endsWith('github.io') ? 'cloud' : 'local';
}
```

| 開啟方式 | hostname 範例 | 模式 | 寫入端點 |
|----------|---------------|------|----------|
| `pnpm local` 書籤 | `192.168.1.10` | local | `POST /api/entries` |
| GitHub Pages 書籤 | `waynezprog.github.io` | cloud | Apps Script URL |

---

## 本機 API

### `POST /api/entries`

**Request body:**

```json
{
  "operator": "小明",
  "barcode": "4711234567890",
  "description": "",
  "note": "盒損"
}
```

**成功回應:** `{ "ok": true }`

**失敗回應:** `{ "ok": false, "error": "描述性錯誤" }`

| HTTP | 條件 | error |
|------|------|-------|
| 400 | operator 空白 | `operator required` |
| 400 | barcode 與 description 皆空 | `barcode or description required` |
| 500 | 寫檔失敗 | `write failed` |

**Server 行為:**
1. 驗證欄位
2. 進入 append queue（FIFO，一次一筆）
3. `scannedAt = new Date().toISOString()`
4. append CSV row：`掃描時間,作業者,條碼,商品名稱/描述,備註`
5. 回 JSON

### CSV 格式

- 路徑：`data/entries.csv`（`data/` 與檔案不存在時自動建立）
- 編碼：UTF-8 with BOM（Excel 開啟中文不亂碼）
- 第一列標題：`掃描時間,作業者,條碼,商品名稱/描述,備註`
- 欄位值含逗號/換行時以 RFC 4180 規則加雙引號

---

## 使用者流程

### 本機 — 連續掃碼（掃碼機模式）

1. Mac 執行 `pnpm local`，終端機顯示區網 URL
2. iPhone Safari 開書籤（例 `http://192.168.1.10:5173`）
3. 確認/輸入作業者
4. 點「開始掃碼」→ 相機常開
5. 對準條碼 → 自動辨識：
   - 若與上次成功寫入的條碼相同且未滿 1.5 秒 → 提示「剛掃過」，不寫入
   - 否則帶入目前表單的描述/備註 → POST → 成功嗶 + 綠 flash → 清空條碼欄
6. 繼續掃下一個（相機不關）
7. 點「結束掃碼」關閉相機

### 本機 — 語音/手動

1. 填寫描述（語音或手打），可選填條碼、備註
2. 點「送出」→ 確認 Modal →「寫入」→ POST
3. 成功 toast；失敗保留表單

### 雲端模式（P1）

- 維持既有流程：條碼/語音/手動皆走確認 Modal 後寫 Apps Script
- 本階段不變更雲端 UX（連續掃碼僅本機模式）

---

## 畫面變更

### 新增/調整

| 元素 | 本機模式 | 雲端模式 |
|------|----------|----------|
| 模式指示 | 頂部 badge「本機」 | badge「雲端」 |
| 掃碼按鈕 | 「開始掃碼」/「結束掃碼」切換 | 「掃描條碼」單次（P1） |
| 送出按鈕 | 語音/手動用 | 全部用（P1） |
| Flash overlay | 成功綠/失敗紅 300ms | 無 |
| 音效 | Web Audio beep | 無 |

### 連續掃碼狀態機

```
idle → scanning → (decode) → cooldown-check → writing → feedback → scanning
                      ↓ fail                                    ↓ error
                   stay scanning                          stay scanning
```

---

## 回饋規格

| 事件 | 音效 | 震動 | 視覺 |
|------|------|------|------|
| 寫入成功 | 880Hz, 120ms | `vibrate(40)` 若支援 | 綠色 flash |
| 寫入失敗 | 440Hz ×2, 各 100ms, 間隔 80ms | `vibrate(80)` 若支援 | 紅色 flash |
| 1.5s 內重複條碼 | 無 | 無 | 小字提示「剛掃過」 |

- 音效透過 Web Audio API（不依賴外部音檔）
- 首次掃碼按鈕點擊時初始化 AudioContext（iOS 需使用者手勢）
- 震動為加分項；iPhone Safari 不支援時靜默略過

---

## 防連發（本機連續掃碼）

- 記錄 `{ lastBarcode, lastWrittenAt }`
- 新掃描成功 decode 後：
  - 若 `barcode === lastBarcode` 且 `now - lastWrittenAt < 1500ms` → 跳過寫入
  - 否則寫入並更新記錄
- 只擋連續掃碼模式；語音/手動不受此限

---

## 本機 Server 設計

### 檔案

```
server/
  index.js       # HTTP server：靜態檔 + API
  csv-writer.js  # queue + appendFile + CSV escape
  lan-url.js     # 印出區網 IP URL
```

### `pnpm local` 腳本

- 開發模式：Vite middleware + API middleware 同一 port
- `host: 0.0.0.0`，port `5173`
- 啟動時 console 輸出：
  ```
  Local:   http://localhost:5173
  Network: http://192.168.x.x:5173  ← iPhone 用這個
  CSV:     data/entries.csv
  ```

### 多人並發

- 單一 process 內 Promise chain queue
- 每筆 append 完成才處理下一筆
- 2～3 人同時掃：各自 POST 獨立排隊，不會 CSV 行交錯

---

## 前端模組變更

| 模組 | 變更 |
|------|------|
| `mode.js` | `getMode()` 依 hostname 判斷 |
| `api.js` | `submitEntry()` 依 mode 分流 local/cloud |
| `scanner.js` | 新增 `createContinuousScanner()` 不自動關相機 |
| `feedback.js` | beep / vibrate / flash |
| `main.js` | 本機連續掃碼流程 + 雲端 P1 流程分支 |

---

## 錯誤處理

| 狀況 | 處理 |
|------|------|
| 作業者空白 | 不允許寫入；掃碼模式亦不 POST |
| 條碼與描述皆空 | 不 POST；連續掃碼忽略此次 decode |
| 本機 server 未啟動 | iPhone 無法連線（瀏覽器錯誤頁） |
| 寫入失敗 | 失敗回饋；連續掃碼保持開啟 |
| Mac 睡著/斷 WiFi | 寫入失敗；提示檢查連線 |
| CSV 權限錯誤 | server log + 回 500 |

---

## 安全

- 本機 server 僅 bind 區網；不暴露公網
- 無 token（信任區網內使用者）
- `data/entries.csv` 加入 `.gitignore`（不 commit 實際資料）

---

## 不在本階段

- CSV 自動同步 Google Sheet
- 離線佇列
- UI 手動切換本機/雲端
- 實體掃碼槍鍵盤 wedge 模式
- 雲端模式連續掃碼
- PWA / 主畫面安裝

---

## 測試計畫

| 案例 | 預期 |
|------|------|
| 連續掃 5 個不同條碼 | CSV 5 列；每次嗶一聲 |
| 1.5s 內重掃同條碼 | 不新增列；提示「剛掃過」 |
| 掃碼前填備註 | 該列備註有值 |
| 成功後 | 條碼欄空；備註保留 |
| 2 台 iPhone 同時掃 | CSV 兩列正確；無行交錯 |
| 語音/手動本機 | Modal 確認後寫入 |
| github.io 開啟 | 走雲端 API；無連續掃碼 |
| CSV 不存在 | 自動建檔 + header |
| Excel 開 CSV | 中文正常 |

---

## 與 P1 關係

- P1 雲端路徑**不刪除**；GitHub Pages + Apps Script 維持
- P2 為增量：新增 `server/`、`pnpm local`、本機 UX 分支
- 共用：`validation.js`、`operator.js`、`ui.js`、表單欄位
