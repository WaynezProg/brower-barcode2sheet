# brower-barcode2sheet

iPhone Safari 商品輸入工具:連續掃條碼 → 掃到即寫入 Google Sheet(像條碼機)。語音可選補描述。

## 開發

```bash
cp web/public/config.example.js web/public/config.js
# 填入 APPS_SCRIPT_URL 與 WRITE_TOKEN(需與 Apps Script Script Properties 一致)
pnpm install
pnpm dev
pnpm test
```

## 部署

1. 依 `apps-script/README.md` 設定 Google Sheet + Apps Script(token 放 Script Properties)。
2. GitHub repo Settings → Secrets → `APPS_SCRIPT_URL`, `WRITE_TOKEN`。
3. Settings → Pages → Source: **GitHub Actions**。
4. Push to `main` → 取得 Pages URL → iPhone Safari 加入書籤。

## 使用流程

1. 進入頁面,先填作業者名字(記 localStorage,之後免重填)。
2. 按「開始連續掃描」開相機(常駐)。
3. 條碼置於框內,穩定 1~2 幀即寫入,嗶聲+震動回饋。
4. 條碼移開後再掃下一件(同一條碼不移開只寫一筆,防重複)。
5. 開「語音補描述」開關:掃到後先說出商品描述再寫入;不開就送純條碼,描述/備註事後在 Sheet 補。
6. 寫入失敗(斷線)會顯示「可重送」,按「重送」即可。

## 手動測試(iPhone Safari)

- [ ] HTTPS 書籤開啟,輸入作業者,重開仍記住
- [ ] 未設作業者按「開始連續掃描」被擋住
- [ ] 連掃三件不同條碼 → Sheet 三列,每件嗶+震動
- [ ] 同一條碼不移開 → 只一列;移開再掃同一件 → 第二列
- [ ] 開語音補描述 → 掃到顯示收音中 → 說出描述 → 該列含描述
- [ ] 語音模式按「跳過語音」→ 送純條碼
- [ ] 斷線送出 → toast 錯誤 + 「重送」後成功
- [ ] Token 遷移:Script Properties 設 WRITE_TOKEN + 重新 Deploy 後仍可寫入