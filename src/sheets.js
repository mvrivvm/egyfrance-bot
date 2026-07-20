const { google } = require('googleapis');

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const authOptions = { scopes: ['https://www.googleapis.com/auth/spreadsheets'] };

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else {
    authOptions.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const auth = new google.auth.GoogleAuth(authOptions);

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
