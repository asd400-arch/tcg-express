import { VEHICLE_MODES, legacyVehicleLabel } from './fares';
import { formatCurrency } from './locale/config';

// Singapore postal SECTOR (first 2 digits of the 6-digit postal code) -> area name.
// Based on the SingPost/URA postal district table (e.g. 45xxxx = Siglap/Katong, 51xxxx = Pasir Ris,
// 18xxxx = Bugis/Middle Road). Keep in sync with lib/job-helpers.ts in the mobile app.
export const SG_POSTAL_AREAS = {
  '01': 'Raffles Place',
  '02': 'Marina Bay',
  '03': 'Marina Centre',
  '04': 'Raffles Place',
  '05': 'Chinatown',
  '06': 'Telok Ayer',
  '07': 'Shenton Way',
  '08': 'Tanjong Pagar',
  '09': 'Harbourfront',
  '10': 'Telok Blangah',
  '11': 'Pasir Panjang',
  '12': 'Clementi',
  '13': 'Buona Vista',
  '14': 'Queenstown',
  '15': 'Bukit Merah',
  '16': 'Tiong Bahru',
  '17': 'City Hall',
  '18': 'Bugis',
  '19': 'Beach Road',
  '20': 'Little India',
  '21': 'Jalan Besar',
  '22': 'Orchard',
  '23': 'River Valley',
  '24': 'Tanglin',
  '25': 'Tanglin',
  '26': 'Bukit Timah',
  '27': 'Holland Village',
  '28': 'Bukit Timah',
  '29': 'Novena',
  '30': 'Novena',
  '31': 'Toa Payoh',
  '32': 'Balestier',
  '33': 'Boon Keng',
  '34': 'Macpherson',
  '35': 'Potong Pasir',
  '36': 'Braddell',
  '37': 'Macpherson',
  '38': 'Geylang',
  '39': 'Geylang',
  '40': 'Paya Lebar',
  '41': 'Eunos',
  '42': 'Joo Chiat',
  '43': 'Katong',
  '44': 'Marine Parade',
  '45': 'Siglap',
  '46': 'Bedok',
  '47': 'Bedok',
  '48': 'Upper East Coast',
  '49': 'Loyang',
  '50': 'Changi',
  '51': 'Pasir Ris',
  '52': 'Tampines',
  '53': 'Hougang',
  '54': 'Sengkang',
  '55': 'Serangoon',
  '56': 'Ang Mo Kio',
  '57': 'Bishan',
  '58': 'Upper Bukit Timah',
  '59': 'Clementi',
  '60': 'Jurong East',
  '61': 'Jurong',
  '62': 'Jurong Industrial',
  '63': 'Tuas',
  '64': 'Jurong West',
  '65': 'Bukit Batok',
  '66': 'Hillview',
  '67': 'Bukit Panjang',
  '68': 'Choa Chu Kang',
  '69': 'Lim Chu Kang',
  '70': 'Tengah',
  '71': 'Tengah',
  '72': 'Kranji',
  '73': 'Woodlands',
  '75': 'Sembawang',
  '76': 'Yishun',
  '77': 'Upper Thomson',
  '78': 'Springleaf',
  '79': 'Seletar',
  '80': 'Seletar',
  '81': 'Changi Airport',
  '82': 'Punggol',
};

export function getAreaName(addr) {
  if (!addr) return '\u2014';
  const match = addr.match(/(?:Singapore\s*)?(\d{6})(?:\s|,|$)/i);
  if (match) {
    const area = SG_POSTAL_AREAS[match[1].substring(0, 2)];
    if (area) return area;
  }
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return addr.length > 35 ? addr.slice(0, 32) + '...' : addr;
}

/** Convert a Date/timestamp to a datetime-local input string (local timezone) */
export function toLocalDatetime(date) {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatPickupTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const mon = d.toLocaleDateString('en', { month: 'short' });
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${mon}, ${time}`;
}

export function formatBudgetRange(job, locale = 'sg') {
  const max = parseFloat(job.budget_max);
  const min = parseFloat(job.budget_min);
  if (min > 0 && max > 0) return `${formatCurrency(min, locale)} - ${formatCurrency(max, locale)}`;
  if (max > 0) return formatCurrency(max, locale);
  if (min > 0) return formatCurrency(min, locale);
  return 'Open bid';
}

export function getCountdown(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= -3600000) return 'Overdue';
  if (diff <= 0) return 'Now';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/** Sort by pickup urgency: future pickup_by ASC, null after, past at bottom */
export function sortByPickupUrgency(a, b) {
  const now = Date.now();
  const aTime = a.pickup_by ? new Date(a.pickup_by).getTime() : null;
  const bTime = b.pickup_by ? new Date(b.pickup_by).getTime() : null;
  const aPast = aTime && aTime < now;
  const bPast = bTime && bTime < now;
  if (aPast && !bPast) return 1;
  if (!aPast && bPast) return -1;
  if (aPast && bPast) return bTime - aTime;
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;
  if (!aTime && !bTime) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return aTime - bTime;
}

export function getVehicleLabel(key) {
  if (!key || key === 'any') return null;
  const mode = VEHICLE_MODES.find(v => v.key === key);
  if (mode) return `${mode.icon} ${mode.label}`;
  return legacyVehicleLabel(key);
}

/** Get the instant-accept price for a job (minimum budget = base rate) */
export function getJobBudget(job) {
  const min = parseFloat(job.budget_min);
  const max = parseFloat(job.budget_max);
  if (min > 0) return min;
  if (max > 0) return max;
  return null;
}
