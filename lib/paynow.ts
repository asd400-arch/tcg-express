// ============================================================
// Singapore PayNow QR Code Generation (SGQR / EMVCo Standard)
// ============================================================

import type { PayNowQRData } from '@/types/wallet';
import { WALLET_CONSTANTS } from '@/types/wallet';

// --- TCG PayNow Configuration ---

const PAYNOW_CONFIG = {
  UEN: '202600001A',
  COMPANY_NAME: 'TECH CHAIN GLOBAL',
  PROXY_TYPE: '2',        // UEN
  CURRENCY: '702',        // SGD
  COUNTRY: 'SG',
  MERCHANT_CATEGORY: '4215', // Courier services
  POINT_OF_INITIATION: '12', // Dynamic QR
  CITY: 'SINGAPORE',
  CHANNEL: 'SG.COM.NETS',
} as const;

// --- CRC16-CCITT (0xFFFF) ---

/**
 * Compute CRC16-CCITT checksum per SGQR/EMVCo spec.
 * Polynomial 0x1021, initial value 0xFFFF.
 * Returns uppercase 4-character hex string.
 */
export function crc16ccitt(str: string): string {
  let crc = 0xffff;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// --- TLV Encoding ---

/**
 * Build a Tag-Length-Value string per EMVCo QR spec.
 * Tag: 2-digit string, Length: 2-digit zero-padded, Value: raw string.
 */
export function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

// --- Reference Generation ---

/**
 * Generate a unique PayNow reference for a top-up.
 * Format: TCG + base36 timestamp + 4 random alphanumeric chars.
 */
export function generatePayNowReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Array.from({ length: 4 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(
      Math.floor(Math.random() * 36)
    )
  ).join('');
  return `TCG${timestamp}${random}`;
}

// --- QR String Builder ---

interface QRStringParams {
  amount: number;
  reference: string;
  expiryDate?: Date;
  editable?: boolean;
}

/**
 * Generate a full EMVCo-compliant PayNow QR payload string.
 *
 * Tag structure:
 *   00 - Payload Format Indicator ("01")
 *   01 - Point of Initiation Method ("12" = dynamic)
 *   26 - Merchant Account Information (PayNow)
 *        └ 00: Channel (SG.COM.NETS)
 *        └ 01: Proxy type (2 = UEN)
 *        └ 02: Proxy value (UEN number)
 *        └ 03: Editable flag (0 = fixed, 1 = editable)
 *        └ 04: Expiry date (YYYYMMDD)
 *   52 - Merchant Category Code
 *   53 - Transaction Currency
 *   54 - Transaction Amount
 *   58 - Country Code
 *   59 - Merchant Name
 *   60 - Merchant City
 *   62 - Additional Data Field Template
 *        └ 05: Reference
 *   63 - CRC (computed over entire payload including "6304")
 */
export function generatePayNowQRString({
  amount,
  reference,
  expiryDate,
  editable = false,
}: QRStringParams): string {
  // Format expiry as YYYYMMDD
  const expiry = expiryDate
    ? expiryDate.getFullYear().toString() +
      (expiryDate.getMonth() + 1).toString().padStart(2, '0') +
      expiryDate.getDate().toString().padStart(2, '0')
    : '';

  // Tag 26: Merchant Account Information (PayNow sub-tags)
  const tag26Value =
    tlv('00', PAYNOW_CONFIG.CHANNEL) +
    tlv('01', PAYNOW_CONFIG.PROXY_TYPE) +
    tlv('02', PAYNOW_CONFIG.UEN) +
    tlv('03', editable ? '1' : '0') +
    (expiry ? tlv('04', expiry) : '');

  // Tag 62: Additional Data Field Template
  const tag62Value = tlv('05', reference);

  // Format amount to 2 decimal places
  const amountStr = amount.toFixed(2);

  // Build payload (without CRC)
  const payload =
    tlv('00', '01') +                                    // Payload Format Indicator
    tlv('01', PAYNOW_CONFIG.POINT_OF_INITIATION) +      // Point of Initiation
    tlv('26', tag26Value) +                              // Merchant Account Info
    tlv('52', PAYNOW_CONFIG.MERCHANT_CATEGORY) +         // MCC
    tlv('53', PAYNOW_CONFIG.CURRENCY) +                  // Currency (SGD)
    tlv('54', amountStr) +                               // Amount
    tlv('58', PAYNOW_CONFIG.COUNTRY) +                   // Country
    tlv('59', PAYNOW_CONFIG.COMPANY_NAME) +              // Merchant Name
    tlv('60', PAYNOW_CONFIG.CITY) +                      // City
    tlv('62', tag62Value);                               // Additional Data

  // Append CRC tag skeleton, compute checksum over it, then fill in
  const payloadWithCrcTag = payload + '6304';
  const checksum = crc16ccitt(payloadWithCrcTag);

  return payloadWithCrcTag + checksum;
}

// --- Top-up QR Generator ---

/**
 * Generate a complete PayNow QR for a wallet top-up.
 * QR expires after PAYNOW_QR_EXPIRY_MINUTES (default 30 min).
 */
export function generatePayNowTopupQR(amount: number): PayNowQRData {
  const reference = generatePayNowReference();
  const expiry = new Date(
    Date.now() + WALLET_CONSTANTS.PAYNOW_QR_EXPIRY_MINUTES * 60 * 1000
  );

  const qr_string = generatePayNowQRString({
    amount,
    reference,
    expiryDate: expiry,
    editable: false,
  });

  return {
    qr_string,
    reference,
    amount,
    expiry: expiry.toISOString(),
    recipient_name: PAYNOW_CONFIG.COMPANY_NAME,
    uen: PAYNOW_CONFIG.UEN,
  };
}

// --- Validation ---

/**
 * Validate a PayNow reference matches the TCG format.
 * Expected: "TCG" followed by alphanumeric characters.
 */
export function isValidPayNowReference(ref: string): boolean {
  return /^TCG[A-Z0-9]{8,20}$/.test(ref);
}

// --- Currency Formatting ---

/**
 * Format a numeric amount as SGD currency string.
 * e.g. 1234.50 → "$1,234.50"
 */
export function formatSGD(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(amount);
}
