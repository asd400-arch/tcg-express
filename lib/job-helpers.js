import { VEHICLE_MODES, legacyVehicleLabel } from './fares';
import { formatCurrency } from './locale/config';

// Singapore postal code first-2-digits → area name
export const SG_POSTAL_AREAS = {
  '01': 'Raffles Place', '02': 'Cecil',
  '03': 'Telok Blangah', '04': 'Harbourfront',
  '05': 'Pasir Panjang',
  '06': 'Beach Road', '07': 'Bugis',
  '08': 'Little India',
  '09': 'Orchard', '10': 'River Valley',
  '11': 'Newton', '12': 'Novena',
  '13': 'Macpherson', '14': 'Toa Payoh',
  '15': 'Serangoon', '16': 'Bishan',
  '17': 'Changi',
  '18': 'Tampines', '19': 'Pasir Ris',
  '20': 'Ayer Rajah', '21': 'Buona Vista',
  '22': 'Boon Lay', '23': 'Jurong',
  '24': 'Kranji', '25': 'Woodlands',
  '26': 'Upper Thomson', '27': 'Mandai',
  '28': 'Yishun',
  '29': 'Admiralty', '30': 'Woodlands',
  '31': 'Bukit Batok', '32': 'Choa Chu Kang',
  '33': 'Bukit Timah', '34': 'Holland',
  '35': 'Ang Mo Kio', '36': 'Bishan',
  '37': 'Serangoon Garden', '38': 'Hougang',
  '39': 'Punggol', '40': 'Sengkang',
  '41': 'Bedok', '42': 'Chai Chee',
  '43': 'Katong', '44': 'Marine Parade',
  '45': 'Paya Lebar',
  '46': 'Simei', '47': 'Tampines',
  '48': 'Changi', '49': 'Loyang',
  '50': 'Bukit Merah', '51': 'Queenstown', '52': 'Queenstown',
  '53': 'Bukit Merah', '56': 'Bishan', '57': 'Ang Mo Kio',
  '58': 'Upper Bukit Timah', '59': 'Clementi',
  '60': 'Jurong', '61': 'Jurong', '62': 'Jurong', '63': 'Jurong', '64': 'Jurong',
  '65': 'Bukit Panjang', '66': 'Choa Chu Kang', '67': 'Bukit Panjang', '68': 'Choa Chu Kang',
  '69': 'Lim Chu Kang', '70': 'Tengah', '71': 'Tengah',
  '72': 'Kranji', '73': 'Woodgrove',
  '75': 'Yishun', '76': 'Sembawang',
  '77': 'Upper Thomson', '78': 'Springleaf',
  '79': 'Seletar', '80': 'Seletar', '81': 'Changi', '82': 'Punggol',
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
