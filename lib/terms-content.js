// Shared terms content — single source of truth for Terms page + modals
export const TC_VERSION = '1.1';

// Liability cap per vehicle type (SGD)
export const LIABILITY_CAPS = [
  { vehicle: 'Motorcycle', cap: 500, icon: '🏍️' },
  { vehicle: 'Car', cap: 1000, icon: '🚗' },
  { vehicle: 'MPV', cap: 2000, icon: '🚙' },
  { vehicle: '1.7m Van', cap: 5000, icon: '🚐' },
  { vehicle: '2.4m Van', cap: 8000, icon: '🚐' },
  { vehicle: '10ft Lorry', cap: 12000, icon: '🚚' },
  { vehicle: '14ft Lorry', cap: 18000, icon: '🚚' },
  { vehicle: '24ft Lorry', cap: 25000, icon: '🚛' },
];

export const TERMS_SECTIONS = [
  {
    number: 1,
    title: 'Service Description',
    body: 'TCG Express is a B2B express delivery marketplace that connects businesses ("Clients") with delivery service providers ("Drivers"). We facilitate job posting, bidding, payment processing, and real-time delivery tracking.',
  },
  {
    number: 2,
    title: 'Account Registration',
    body: 'To use our Platform, you must register an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials. Driver accounts require admin approval and valid documentation (NRIC, license, vehicle insurance).',
  },
  {
    number: 3,
    title: 'Client Obligations',
    body: 'Clients agree to: (a) provide accurate job descriptions, pickup/delivery addresses, and item details; (b) ensure items are legal and properly packaged; (c) pay the agreed bid amount through our secure payment system; (d) confirm delivery upon receipt of items in satisfactory condition.',
  },
  {
    number: 4,
    title: 'Driver Obligations',
    body: 'Drivers agree to: (a) maintain valid licenses, insurance, and vehicle registration; (b) handle items with care and provide photo proof of pickup and delivery; (c) complete deliveries within agreed timeframes; (d) comply with all applicable traffic and safety regulations.',
  },
  {
    number: 5,
    title: 'Driver Compensation & Liability',
    body: 'By accepting a delivery job, the Driver assumes FULL RESPONSIBILITY for all goods in their care from the point of pickup to the point of delivery. In the event of any loss, damage, or destruction of goods — whether partial or total — the Driver shall be liable up to the CAPPED LIABILITY AMOUNT corresponding to their vehicle type (see Liability Cap Table). This obligation applies regardless of fault, unless the loss or damage is caused by an act of God, war, or government action. Liability caps: Motorcycle $500, Car $1,000, MPV $2,000, 1.7m Van $5,000, 2.4m Van $8,000, 10ft Lorry $12,000, 14ft Lorry $18,000, 24ft Lorry $25,000. Drivers are strongly encouraged to maintain adequate insurance coverage. The Platform may deduct compensation amounts from the Driver\'s wallet balance or future earnings.',
  },
  {
    number: 6,
    title: 'Payments & Escrow',
    body: 'All payments are processed securely through Stripe. When a Client accepts a bid, the payment is held in escrow. Funds are released to the Driver upon confirmed delivery, minus the platform commission. Refunds are issued automatically upon job cancellation before delivery.',
  },
  {
    number: 7,
    title: 'Commission',
    body: 'The Platform charges a commission on each completed delivery. The current rate is displayed in the platform settings and may be updated from time to time. Drivers are paid the bid amount minus the commission.',
  },
  {
    number: 8,
    title: 'Disputes',
    body: 'Either party may raise a dispute through the Platform. Disputes freeze the escrow until resolved by an admin. We aim to resolve disputes fairly based on evidence provided by both parties, including photo proof and chat records.',
  },
  {
    number: 9,
    title: 'Cancellation',
    body: 'Clients may cancel jobs before delivery. Cancellation triggers a full refund of the escrowed amount. Excessive cancellations may result in account review. Admins reserve the right to cancel jobs and issue refunds at their discretion.',
  },
  {
    number: 10,
    title: 'Limitation of Liability',
    body: 'TCG Express acts as a marketplace facilitator. We are not liable for: (a) damage, loss, or delay of items during delivery; (b) disputes between Clients and Drivers; (c) accuracy of information provided by users. Our total liability is limited to the commission earned on the relevant transaction.',
  },
  {
    number: 11,
    title: 'Account Termination',
    body: 'We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or receive repeated complaints. Users may close their accounts by contacting support.',
  },
  {
    number: 12,
    title: 'Modifications',
    body: 'We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms. We will notify registered users of material changes via email.',
  },
  {
    number: 13,
    title: 'Governing Law',
    body: 'These Terms are governed by the laws of the Republic of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.',
  },
  {
    number: 14,
    title: 'Contact',
    body: 'For questions about these Terms, contact us at admin@techchainglobal.com.',
  },
];
