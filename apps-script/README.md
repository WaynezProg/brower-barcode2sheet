# Apps Script Setup

1. Open your Google Sheet → Extensions → Apps Script.
2. 貼入 `Code.gs` 內容。`WRITE_TOKEN` **不寫在程式碼裡**,改放 Script Properties。
3. 設定 Script Properties:Apps Script 編輯器左下「專案設定」(齒輪) → **Script Properties** → 新增一筆:
   - 欄位名:`WRITE_TOKEN`
   - 值:你自己發明的密碼(`openssl rand -hex 16` 產一組)
   - 必須與 `web/config.js` 的 `WRITE_TOKEN` **完全相同**
4. 第一列標頭:`掃描時間 | 作業者 | 條碼 | 商品名稱/描述 | 備註`
5. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL into `web/config.js` as `APPS_SCRIPT_URL`.
7. Test with curl（Apps Script POST 會先 302，直接 curl 會看到 HTML「Moved Temporarily」是正常的）:

```bash
URL='YOUR_APPS_SCRIPT_URL'
BODY='{"token":"YOUR_TOKEN","operator":"測試","barcode":"123","description":"","note":""}'
LOCATION=$(curl -s -D - -o /dev/null -X POST "$URL" \
  -H 'Content-Type: text/plain' -d "$BODY" \
  | grep -i '^location:' | cut -d' ' -f2- | tr -d '\r')
curl -s "$LOCATION"
```

Expected: `{"ok":true}` and a new row in the Sheet（掃描時間為 Asia/Taipei）。

## 常見錯誤

- `{"ok":false,"error":"server token not configured"}` → 還沒設 Script Properties 的 `WRITE_TOKEN`。
- `{"ok":false,"error":"Unauthorized"}` → 前端 `WRITE_TOKEN` 與 Script Properties 不一致,或改完 Code 後**未重新 Deploy**。
- 改 `Code.gs` 後必須重新 Deploy,否則舊 URL 仍跑舊版。

## 從舊版(硬編 token)遷移

舊版 `Code.gs` 把 `WRITE_TOKEN` 寫死在檔內(已進 git history)。遷移步驟:

1. 按上面步驟在 Script Properties 設一組新 token(`openssl rand -hex 16`),前端 `web/config.js` 換成同值。
2. 貼新版 `Code.gs`(讀 Script Properties)+ 重新 Deploy。舊 token 隨即失效 → git history 內的舊 token 變無害。
3. git history 不需 rewrite(舊 token 已無效);若仍要清理需 `git filter-repo` + force push,會影響 GitHub Pages 部署,風險高、收益接近零,不建議自動執行。