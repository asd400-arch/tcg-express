export const LOCALES = {
  sg: {
    currency: 'SGD',
    currencySymbol: 'S$',
    phonePrefix: '+65',
    timezone: 'Asia/Singapore',
    utcOffset: '+08:00',
    language: 'en',
    country: 'Singapore',
    addressFormat: 'sg', // Block/Unit, Postal Code
    payment: ['stripe', 'paynow'],
    areaLabel: 'Postal District',
  },
  id: {
    currency: 'IDR',
    currencySymbol: 'Rp',
    phonePrefix: '+62',
    timezone: 'Asia/Jakarta',
    utcOffset: '+07:00',
    language: 'id',
    country: 'Indonesia',
    addressFormat: 'id', // Jalan, RT/RW, Kode Pos
    payment: ['gopay', 'ovo', 'dana'],
    areaLabel: 'Kelurahan / Kecamatan',
  },
};

export const DEFAULT_LOCALE = 'sg';

export function getLocaleConfig(locale) {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function formatCurrency(amount, locale) {
  const { currency } = getLocaleConfig(locale);
  if (currency === 'IDR') {
    return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
  }
  return 'S$' + Number(amount).toFixed(2);
}

export function formatPhone(phone, locale) {
  const { phonePrefix } = getLocaleConfig(locale);
  // Strip existing prefix if present, re-attach correct one
  const stripped = phone.replace(/^\+\d{1,3}/, '').replace(/^0/, '');
  return phonePrefix + stripped;
}
