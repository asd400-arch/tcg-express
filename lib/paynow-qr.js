// PayNow QR generator using paynowqr package.
// Reference number is stored in DB only — not embedded in QR.

const PaynowQR = require('paynowqr');

function generatePayNowQR(amount) {
  // Set expiry to 1 year from now in YYYYMMDDHHMMSS format (14 chars)
  const now = new Date();
  const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expiryStr = expiry.getFullYear().toString() +
    String(expiry.getMonth() + 1).padStart(2, '0') +
    String(expiry.getDate()).padStart(2, '0') +
    String(expiry.getHours()).padStart(2, '0') +
    String(expiry.getMinutes()).padStart(2, '0') +
    String(expiry.getSeconds()).padStart(2, '0');

  const qrcode = new PaynowQR({
    uen: '202005872W',
    amount: parseFloat(amount).toFixed(2),
    editable: true,
    company: 'HHI Solutions Pte Ltd',
    expiry: expiryStr,
  });
  return qrcode.output();
}

module.exports = { generatePayNowQR };
