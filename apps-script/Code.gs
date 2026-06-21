/** @OnlyCurrentDoc */

const SHEET_NAME = '掃碼紀錄'; // 你的 tab 名稱

function getToken() {
  // 從 Script Properties 讀,不寫死在程式碼裡。
  // 設定方式:Apps Script 編輯器 → 專案設定 → Script Properties → 新增 WRITE_TOKEN
  return PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN');
}

function doPost(e) {
  try {
    const token = getToken();
    if (!token) {
      return jsonResponse({ ok: false, error: 'server token not configured' }, 500);
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== token) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 403);
    }

    const operator = (payload.operator || '').trim();
    const barcode = (payload.barcode || '').trim();
    const description = (payload.description || '').trim();
    const note = (payload.note || '').trim();

    if (!operator) {
      return jsonResponse({ ok: false, error: 'operator required' }, 400);
    }
    if (!barcode && !description) {
      return jsonResponse({ ok: false, error: 'barcode or description required' }, 400);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const scannedAt = Utilities.formatDate(new Date(), 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ss");
    sheet.appendRow([scannedAt, operator, barcode, description, note]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'write failed' }, 500);
  }
}

function jsonResponse(body, _statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}