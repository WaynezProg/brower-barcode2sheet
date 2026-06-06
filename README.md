# brower-barcode2sheet

iPhone Safari 商品輸入工具：掃條碼 / 語音 / 手動輸入 → 確認 → 寫入 Google Sheet。

## 開發

```bash
cp web/public/config.example.js web/public/config.js
# 填入 APPS_SCRIPT_URL 與 WRITE_TOKEN
pnpm install
pnpm dev
pnpm test
```

## 部署

1. 依 `apps-script/README.md` 設定 Google Sheet + Apps Script。
2. GitHub repo Settings → Secrets → `APPS_SCRIPT_URL`, `WRITE_TOKEN`。
3. Settings → Pages → Source: **GitHub Actions**。
4. Push to `main` → 取得 Pages URL → iPhone Safari 加入書籤。

## 本機掃碼機模式（P2）

```bash
pnpm local
# iPhone Safari 開啟 Network URL 書籤
```

- 連續掃碼、直接寫入 `data/entries.csv`
- 語音/手動仍要確認
- GitHub Pages 書籤仍走雲端模式

## 手動測試（iPhone）

- [ ] 書籤開啟 HTTPS 頁面
- [ ] 輸入作業者，重新開啟仍記住
- [ ] 掃條碼成功帶入欄位
- [ ] 語音或手動輸入描述
- [ ] 確認 Modal 寫入成功
- [ ] 兩台手機同時寫入，Sheet 兩列正確
