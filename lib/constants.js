export const JOB_CATEGORIES = [
  // Standard
  { key: 'general', label: 'General', icon: '📦', group: 'standard' },
  { key: 'documents', label: 'Documents', icon: '📄', group: 'standard' },
  { key: 'electronics', label: 'Electronics', icon: '💻', group: 'standard' },
  { key: 'fragile', label: 'Fragile', icon: '⚠️', group: 'standard' },
  { key: 'food', label: 'Food/Perishable', icon: '🍱', group: 'standard' },
  { key: 'heavy', label: 'Heavy/Bulky', icon: '🏋️', group: 'standard' },
  // Premium
  { key: 'rack_server', label: 'Rack/Server Delivery', icon: '🖥️', group: 'premium' },
  { key: 'white_glove', label: 'White Glove Delivery', icon: '🧤', group: 'premium' },
  { key: 'project', label: 'Project Delivery', icon: '🏗️', group: 'premium' },
  { key: 'installation', label: 'Delivery + Installation/Test', icon: '🔧', group: 'premium' },
];

export const EQUIPMENT_OPTIONS = [
  // Basic Service
  { key: 'trolley', label: 'Trolley' },
  { key: 'wrapping', label: 'Wrapping' },
  { key: 'dismantlement', label: 'Dismantlement' },
  { key: 'installation', label: 'Installation' },
  // Special Equipment
  { key: 'pallet_jack', label: 'Pallet Jack' },
  { key: 'lift_truck', label: 'Lift Truck' },
  { key: 'crane', label: 'Crane' },
  { key: 'other_request', label: 'Other Request' },
  // Legacy keys
  { key: 'forklift', label: 'Forklift' },
  { key: 'hand_truck', label: 'Hand Truck' },
  { key: 'stair_climber', label: 'Stair Climber' },
  { key: 'lift', label: 'Lift' },
];

export function getCategoryByKey(key) {
  return JOB_CATEGORIES.find(c => c.key === key) || { key, label: key, icon: '📦', group: 'standard' };
}

export function getEquipmentLabel(key) {
  const eq = EQUIPMENT_OPTIONS.find(e => e.key === key);
  return eq ? eq.label : key;
}
