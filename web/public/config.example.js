// Copy to web/public/config.js (本機) 或由 CI 從 Secrets 產生,填入實際值。
// WRITE_TOKEN 必須與 Apps Script「專案設定 → Script Properties」的 WRITE_TOKEN 完全相同。
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  WRITE_TOKEN: 'your-shared-secret-token',
};