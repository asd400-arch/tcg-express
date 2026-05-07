// PayNow QR generator using paynowqr package.
// Reference number is stored in DB only — not embedded in QR.

const PaynowQR = require('paynowqr');

function generatePayNowQR(amount) {
  const qrcode = new PaynowQR({
    uen: '202005872W',
    amount: amount,
    editable: false,
    company: 'HHI Solutions Pte Ltd',
  });
  return qrcode.output();
}

module.exports = { generatePayNowQR };
