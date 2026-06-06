# Apps Script Setup

1. Open your Google Sheet → Extensions → Apps Script.
2. Paste `Code.gs` contents. Set `WRITE_TOKEN` and `SHEET_NAME`.
3. First row headers: `掃描時間 | 作業者 | 條碼 | 商品名稱/描述 | 備註`
4. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL into `web/config.js` as `APPS_SCRIPT_URL`.
6. Test with curl:

```bash
curl -X POST 'YOUR_APPS_SCRIPT_URL' \
  -H 'Content-Type: text/plain' \
  -d '{"token":"YOUR_TOKEN","operator":"測試","barcode":"123","description":"","note":""}'
```

Expected: `{"ok":true}` and a new row in the Sheet.
