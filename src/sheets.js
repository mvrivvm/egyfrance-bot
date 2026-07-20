const { google } = require('googleapis');

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: client });
  return sheetsClient;
}

async function appendCustomerRow({ name, phone, product, notes }) {
  const sheets = await getSheetsClient();
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${sheetName}!A:E`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
        name || '',
        phone || '',
        product || '',
        notes || ''
      ]]
    }
  });
}

module.exports = { appendCustomerRow };
