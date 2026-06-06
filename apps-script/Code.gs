/** @OnlyCurrentDoc */

const WRITE_TOKEN = 'f59928067e7ba7dfb1b773d6cbddaabe';
const SHEET_NAME = '掃碼紀錄'; // or your tab name

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== WRITE_TOKEN) {
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
    const scannedAt = new Date().toISOString();
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
