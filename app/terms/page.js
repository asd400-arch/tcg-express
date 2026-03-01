'use client';

export default function TermsPage() {
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '32px 0 12px' };
  const h3 = { fontSize: '15px', fontWeight: '700', color: '#334155', margin: '20px 0 8px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 12px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>← Back to Home</a>

        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: '20px 0 8px' }}>Terms of Service</h1>
        <p style={{ ...p, color: '#94a3b8' }}>Last updated: 1 March 2026</p>

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #f1f5f9', marginTop: '20px' }}>

          <h2 style={h2}>1. Introduction</h2>
          <p style={p}>Welcome to TCG Express, a B2B express delivery platform operated by Tech Chain Global Pte Ltd ("TCG", "we", "us", "our"), registered in Singapore. By accessing or using our platform at express.techchainglobal.com ("Platform"), you agree to be bound by these Terms of Service ("Terms").</p>

          <h2 style={h2}>2. Definitions</h2>
          <p style={p}><strong>"Client"</strong> means a registered user who posts delivery jobs on the Platform.</p>
          <p style={p}><strong>"Driver"</strong> means a registered user who bids on and fulfils delivery jobs.</p>
          <p style={p}><strong>"Job"</strong> means a delivery request posted by a Client on the Platform.</p>
          <p style={p}><strong>"Bid"</strong> means a price offer submitted by a Driver for a Job.</p>
          <p style={p}><strong>"Wallet"</strong> means the digital wallet associated with each user account for payments.</p>

          <h2 style={h2}>3. Eligibility &amp; Registration</h2>
          <p style={p}>You must be at least 18 years old and a registered business entity or authorised representative to use the Platform. You agree to provide accurate, current, and complete registration information. TCG reserves the right to suspend or terminate accounts that provide false information.</p>

          <h2 style={h2}>4. Platform Services</h2>
          <p style={p}>TCG Express is a marketplace that connects Clients with independent Drivers for the delivery of technology equipment and related goods. TCG acts as an intermediary and is not a carrier, freight forwarder, or logistics operator. We facilitate the matching, payment, and tracking of deliveries.</p>

          <h2 style={h2}>5. Jobs, Bidding &amp; Payments</h2>
          <h3 style={h3}>5.1 Job Posting</h3>
          <p style={p}>Clients may post Jobs specifying pickup/delivery addresses, item details, vehicle requirements, and budget range. Clients are responsible for the accuracy of all Job information provided.</p>
          <h3 style={h3}>5.2 Bidding</h3>
          <p style={p}>Drivers may submit Bids on available Jobs. Clients may accept or reject Bids at their discretion. Acceptance of a Bid creates a binding agreement between the Client and Driver.</p>
          <h3 style={h3}>5.3 Payments</h3>
          <p style={p}>Payment is processed through the Platform Wallet. Clients must maintain sufficient Wallet balance before accepting a Bid. Upon Bid acceptance, the agreed amount is held in escrow. After successful delivery confirmation, funds are released to the Driver's Wallet, less the Platform commission of 15%.</p>
          <h3 style={h3}>5.4 Wallet Top-up</h3>
          <p style={p}>Wallet top-ups via PayNow are subject to verification and manual approval by TCG. Top-up bonuses, where offered, are promotional credits and may be withdrawn or modified at TCG's discretion.</p>

          <h2 style={h2}>6. Driver Obligations</h2>
          <p style={p}>Drivers must hold a valid Singapore driving licence appropriate for their registered vehicle type. Drivers are independent contractors, not employees of TCG. Drivers are responsible for maintaining valid insurance, vehicle roadworthiness, and compliance with all applicable traffic and transport regulations.</p>

          <h2 style={h2}>7. Liability &amp; Disclaimers</h2>
          <h3 style={h3}>7.1 Limitation of Liability</h3>
          <p style={p}>TCG acts solely as a platform facilitator. We are not liable for any loss, damage, delay, or injury arising from the delivery services performed by Drivers. Our total liability to any user shall not exceed the Platform commission earned on the relevant transaction.</p>
          <h3 style={h3}>7.2 Item Coverage</h3>
          <p style={p}>TCG does not provide insurance for items being delivered. Clients are responsible for ensuring adequate insurance coverage for high-value technology equipment. TCG recommends that Clients declare item values accurately and obtain appropriate insurance.</p>
          <h3 style={h3}>7.3 Disputes</h3>
          <p style={p}>In the event of disputes between Clients and Drivers, TCG may mediate at its discretion but is not obligated to resolve disputes. TCG reserves the right to hold, refund, or release funds as deemed appropriate during dispute resolution.</p>

          <h2 style={h2}>8. Prohibited Conduct</h2>
          <p style={p}>Users shall not: (a) use the Platform for illegal purposes; (b) transport prohibited, hazardous, or illegal items; (c) misrepresent item details, weight, or value; (d) harass, threaten, or abuse other users; (e) manipulate Bids, ratings, or reviews; (f) attempt to circumvent Platform payments; (g) create multiple accounts.</p>

          <h2 style={h2}>9. Intellectual Property</h2>
          <p style={p}>All content, branding, software, and technology on the Platform are owned by Tech Chain Global Pte Ltd. Users may not reproduce, modify, or distribute any Platform content without prior written consent.</p>

          <h2 style={h2}>10. Termination</h2>
          <p style={p}>TCG may suspend or terminate your account at any time for violation of these Terms or for any reason deemed necessary to protect the Platform and its users. Upon termination, any Wallet balance (excluding promotional credits) will be refunded within 30 business days.</p>

          <h2 style={h2}>11. Modifications</h2>
          <p style={p}>TCG reserves the right to modify these Terms at any time. Material changes will be notified via email or Platform notification. Continued use of the Platform after modifications constitutes acceptance of the updated Terms.</p>

          <h2 style={h2}>12. Governing Law</h2>
          <p style={p}>These Terms are governed by and construed in accordance with the laws of the Republic of Singapore. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

          <h2 style={h2}>13. Contact</h2>
          <p style={p}>For questions regarding these Terms, please contact us at:</p>
          <p style={p}>Tech Chain Global Pte Ltd<br />Email: support@techchainglobal.com<br />Website: www.techchainglobal.com</p>
        </div>
      </div>
    </div>
  );
}
