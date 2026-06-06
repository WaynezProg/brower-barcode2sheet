# Apps Script Setup

1. Open your Google Sheet → Extensions → Apps Script.
2. Paste `Code.gs` contents. Set `WRITE_TOKEN`（自己發明的密碼，非 Google 提供）與 `SHEET_NAME`。
   - 例：`const WRITE_TOKEN = 'f59928067e7ba7dfb1b773d6cbddaabe';`
   - 必須與 `web/config.js` 的 `WRITE_TOKEN` **完全相同**
3. First row headers: `掃描時間 | 作業者 | 條碼 | 商品名稱/描述 | 備註`
4. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL into `web/config.js` as `APPS_SCRIPT_URL`.
6. Test with curl（Apps Script POST 會先 302，直接 curl 會看到 HTML「Moved Temporarily」是正常的）:

```bash
URL='YOUR_APPS_SCRIPT_URL'
BODY='{"token":"YOUR_TOKEN","operator":"測試","barcode":"123","description":"","note":""}'
LOCATION=$(curl -s -D - -o /dev/null -X POST "$URL" \
  -H 'Content-Type: text/plain' -d "$BODY" \
  | grep -i '^location:' | cut -d' ' -f2- | tr -d '\r')
curl -s "$LOCATION"
```

Expected: `{"ok":true}` and a new row in the Sheet（掃描時間為 Asia/Taipei）。

若回 `{"ok":false,"error":"Unauthorized"}` → `Code.gs` 的 `WRITE_TOKEN` 與 `web/config.js` 不一致，或改完 Code 後**未重新 Deploy**。
