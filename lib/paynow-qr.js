// PayNow dynamic SGQR (EMVCo) payload generator.
// Native implementation — no external packages, Vercel-compatible.
// Reference number is stored in DB only — not embedded in QR.

const { createHash } = require('crypto');

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePayNowQR(amount) {
  const amountStr = parseFloat(amount).toFixed(2);

  // Expiry: 1 year from now in YYYYMMDDHHMMSS format
  const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const expiry = exp.getFullYear().toString() +
    String(exp.getMonth() + 1).padStart(2, '0') +
    String(exp.getDate()).padStart(2, '0') +
    String(exp.getHours()).padStart(2, '0') +
    String(exp.getMinutes()).padStart(2, '0') +
    String(exp.getSeconds()).padStart(2, '0');

  // ID 26: PayNow merchant account info
  const paynowFields =
    field('00', 'SG.PAYNOW') +
    field('01', '2') +
    field('02', '202005872W') +
    field('03', '1') +
    field('04', expiry);

  const payload =
    field('00', '01') +
    field('01', '12') +
    field('26', paynowFields) +
    field('52', '0000') +
    field('53', '702') +
    field('54', amountStr) +
    field('58', 'SG') +
    field('59', 'HHI Solutions Pte Ltd') +
    field('60', 'Singapore') +
    '6304';

  return payload + crc16(payload);
}

module.exports = { generatePayNowQR };
