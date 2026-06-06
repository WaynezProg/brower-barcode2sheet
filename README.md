# brower-barcode2sheet

iPhone Safari 商品輸入工具：掃條碼 / 語音 / 手動輸入 → 確認 → 寫入 Google Sheet 或本機 CSV。

## 開發

```bash
cp web/public/config.example.js web/public/config.js
pnpm install
pnpm dev
pnpm test
```

## 部署（雲端）

1. 依 `apps-script/README.md` 設定 Google Sheet + Apps Script。
2. GitHub repo Settings → Secrets → `APPS_SCRIPT_URL`, `WRITE_TOKEN`。
3. Settings → Pages → Source: **GitHub Actions**。
4. Push to `main` → iPhone 書籤開 GitHub Pages URL。

---

## 本機掃碼機模式（P2）

### 啟動（兩個終端機）

**終端機 1 — 本機 server：**
```bash
cd /Users/waynetu/claw_prog/projects/04-kurisu-github/brower-barcode2sheet
pnpm install
pnpm local
```

**終端機 2 — HTTPS 隧道（iPhone 推薦）：**
```bash
pnpm tunnel
```

複製 ngrok 印的 `https://….ngrok-free.app` → iPhone Safari 書籤。

> iPhone 相機需要 **HTTPS**（`http://192.168.x.x` 即使能開頁面，掃碼也可能被 Safari 擋）。

### 診斷連線問題

```bash
pnpm diagnose
```

### 常見原因：iPhone 同 WiFi 仍連不到

| 原因 | 解法 |
|------|------|
| **macOS 防火牆**擋住 mise 的 node | 系統設定 → 網路 → 防火牆 → 選項 → 允許傳入連線：`which node` 印出的路徑 |
| 路由器 **AP 隔離**（裝置互不相通） | 用 `pnpm tunnel`（ngrok），不走區網 |
| 用了 `pnpm dev` 而非 `pnpm local` | 必須 `pnpm local` 才有 CSV API |
| iPhone 開 **行動數據** | 關掉，只用 WiFi |
| URL 用錯 | 區網用 `http://192.168.x.x:5173`；隧道用 ngrok 的 **https** |

### 功能

- 連續掃碼、直接寫入 `data/entries.csv`、成功嗶一聲
- 語音/手動仍要確認 Modal
- GitHub Pages 書籤仍走雲端 Google Sheet

---

## 手動測試（iPhone）

- [ ] `pnpm local` + `pnpm tunnel`，HTTPS 書籤可開
- [ ] 輸入作業者，重新開啟仍記住
- [ ] 連續掃條碼寫入 CSV
- [ ] 語音或手動輸入 + 確認寫入
- [ ] GitHub Pages 雲端寫入 Sheet 仍正常
