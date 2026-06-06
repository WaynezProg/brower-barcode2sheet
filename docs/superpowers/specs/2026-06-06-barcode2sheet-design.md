# 手機商品資料輸入工具 — 設計規格

> 狀態：已核准（brainstorming 2026-06-06）
> 方案：A — 靜態網頁 + Google Apps Script

## 一句話摘要

建立一個 iPhone Safari 書籤可用的商品資料輸入網頁，支援條碼掃描與語音/手動輸入，確認後透過 Google Apps Script 寫入固定 Google Sheet，並記錄作業者與時間。

---

## 決策紀錄

| 議題 | 決策 |
|------|------|
| 作業者辨識 | 每次手動輸入名字，無驗證；`localStorage` 記住方便下次使用 |
| Google Sheet | 固定一張 Sheet，Sheet ID 寫在 Apps Script 設定 |
| 裝置 | 僅 iPhone |
| 開啟方式 | Safari 書籤開固定 HTTPS 網址 |
| 網路 | 現場穩定；寫入失敗提示重試，不做離線佇列 |
| 語音 | 偶爾使用；Web Speech API 為輔，手動輸入為主要備援 |
| 防重複 | 僅靠確認畫面，不額外擋重複條碼 |
| 技術維護 | 使用者能照教學操作，不想碰 Google Cloud |
| 架構方案 | 靜態網頁負責 UI/相機；Apps Script 僅作寫入 API |

---

## 架構

```
[iPhone Safari 書籤]
    ↓ HTTPS
[靜態網頁 — GitHub Pages]
    │  相機掃碼、語音輸入、確認 UI
    ↓ POST JSON + shared token
[Apps Script Web App — doPost]
    ↓ appendRow
[固定 Google Sheet]
```

### 元件職責

| 元件 | 職責 | 不做的事 |
|------|------|----------|
| 靜態前端 | 作業者輸入、條碼掃描、語音/手動填欄、確認、POST | 不直接存取 Sheet API |
| Apps Script | 驗證 token、驗證欄位、append row、回傳結果 | 不開相機、不提供 UI |
| Google Sheet | 儲存紀錄 | — |

### 多人同時作業

2～3 人各自開啟同一書籤 URL，獨立 POST。Apps Script 每次請求獨立 `appendRow`，不會互相覆蓋。每筆紀錄帶各自輸入的作業者名字。

---

## 資料模型

### Sheet 欄位（第一列為標題）

| 欄位 | 來源 | 必填 |
|------|------|------|
| 掃描時間 | Apps Script 收到請求時產生（ISO 8601 字串） | 是 |
| 作業者 | 使用者手動輸入 | 是 |
| 條碼 | 掃碼或手動輸入 | 條碼或商品描述擇一 |
| 商品名稱/描述 | 語音、手動輸入，或條碼商品的補充 | 條碼或商品描述擇一 |
| 備註 | 手動輸入 | 否 |

### POST payload（前端 → Apps Script）

```json
{
  "token": "<shared-secret>",
  "operator": "小明",
  "barcode": "4711234567890",
  "description": "角色公仔 A",
  "note": "盒損"
}
```

`scannedAt` 由 Apps Script 以 `new Date()` 寫入，避免客戶端時鐘偏差。

### Apps Script 回應

成功：`{ "ok": true }`

失敗：`{ "ok": false, "error": "描述性錯誤訊息" }`

---

## 使用者流程

### 有條碼

1. 開啟書籤 → 確認/輸入作業者
2. 點「掃描條碼」→ 全螢幕相機
3. 辨識成功 → 條碼帶入欄位，關閉相機
4. 可補充描述、備註
5. 點「送出」→ 確認 Modal
6. 確認 → POST → 成功提示，清空條碼/描述/備註

### 無條碼

1. 確認作業者
2. 點「語音輸入」或直接在描述欄手動打字
3. 其餘同上有條碼流程第 4～6 步

### 掃碼失敗

顯示失敗提示 → 重掃或改手動輸入條碼/描述 → 確認送出

---

## 畫面結構

### 進入頁 / 作業者區

- 文字輸入框：作業者名字
- 若 `localStorage` 有值則預填
- 作業者空白時，主畫面送出按鈕 disabled

### 主畫面

- 顯示目前作業者（可點擊修改）
- 按鈕：掃描條碼、語音輸入
- 欄位：條碼、商品名稱/描述、備註
- 按鈕：送出

### 掃碼畫面（全螢幕 overlay）

- 相機預覽 + 掃描框
- 成功自動關閉並帶入條碼
- 取消按鈕關閉相機

### 確認 Modal

- 顯示五欄（時間唯讀預覽為「送出時自動產生」）
- 條碼、描述、備註可編輯
- 「寫入」/「取消」

### 結果提示

- 成功：簡短 toast，清空可重複輸入下一筆
- 失敗：錯誤訊息，保留表單內容可重送

---

## 驗證規則

### 前端（送出前）

| 規則 | 訊息 |
|------|------|
| 作業者為空 | 請輸入作業者名字 |
| 條碼與描述皆空 | 請至少填寫條碼或商品描述 |

### Apps Script（doPost）

| 規則 | HTTP | 訊息 |
|------|------|------|
| token 不符 | 403 | Unauthorized |
| 作業者為空 | 400 | operator required |
| 條碼與描述皆空 | 400 | barcode or description required |
| Sheet 寫入例外 | 500 | write failed |

---

## 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| 前端 | HTML + CSS + JS（可選 Vite 打包） | 輕量、易部署 |
| 條碼掃描 | `@zxing/library` | iOS Safari 相容性優於 `BarcodeDetector` |
| 語音 | Web Speech API（`zh-TW`） | 免費；iOS 支援不穩，手動備援 |
| 部署 | GitHub Pages | 免費 HTTPS，符合 Safari 書籤 |
| 寫入後端 | Google Apps Script Web App | 免 Google Cloud、設定簡單 |
| 相機 | `getUserMedia` | iPhone Safari 在獨立 HTTPS 網域可正常運作 |

### iPhone Safari 限制與因應

- 相機需使用者手勢觸發（按鈕點擊後才 `getUserMedia`）
- 語音辨識在 iOS Safari 可能不可用或不穩 → UI 上語音按鈕旁明確提示可手動輸入
- 不做 PWA 主畫面安裝；以書籤存取

---

## 安全

- Apps Script 部署為 Web App，`execute as: me`，`who has access: anyone`
- 前後端共用一組 `WRITE_TOKEN`（寫在 `config.js` 與 Script `PropertiesService` 或常數）
- token 不符拒絕寫入
- Sheet ID 僅存在 Apps Script，不暴露給前端

> 注意：token 在前端可被查看，僅防路人誤觸，非高安全性場景。若未來需要可升級 OAuth 或 Service Account。

---

## 設定清單（部署時）

### Google Sheet

1. 建立 Sheet，第一列標題：掃描時間、作業者、條碼、商品名稱/描述、備註
2. 記下 Sheet ID

### Apps Script

1. 建立專案，綁定上述 Sheet
2. 實作 `doPost`：驗證 token → 驗證欄位 → `appendRow` → 回 JSON
3. 部署為 Web App，取得 URL
4. 設定 `WRITE_TOKEN`

### 靜態前端

1. `config.js` 填入 `APPS_SCRIPT_URL`、`WRITE_TOKEN`
2. 部署至 GitHub Pages
3. 作業者將 URL 加入 Safari 書籤

---

## 不在本階段範圍

- 離線佇列與自動補寫
- 掃條碼後自動帶出商品名稱
- 庫存扣增
- 商品主檔比對
- 自動分類
- 圖片辨識
- 發票/訂單串接
- Google Cloud Service Account
- PWA 主畫面安裝
- 實體掃碼機
- 作業者身份驗證（登入系統）
- 條碼重複自動阻擋

---

## 測試計畫

| 案例 | 預期 |
|------|------|
| 掃碼成功寫入 | Sheet 新增一列，時間/作業者/條碼正確 |
| 手動描述寫入（無條碼） | 描述欄有值，條碼空白 |
| 作業者空白送出 | 前端擋下 |
| 條碼描述皆空送出 | 前端擋下 |
| 寫入失敗（斷網） | 顯示錯誤，表單保留 |
| 2 台 iPhone 同時寫入 | 兩列都正確 append，無覆蓋 |
| 語音不可用 | 可改手動輸入並正常寫入 |
| token 錯誤 | Script 回 403 |

---

## 未來擴充方向（僅記錄，不實作）

- 數量、作業類型欄位
- 條碼查詢商品主檔
- 離線暫存佇列
- 作業者固定名單下拉
