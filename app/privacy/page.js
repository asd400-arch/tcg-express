'use client';

export default function PrivacyPage() {
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '32px 0 12px' };
  const h3 = { fontSize: '15px', fontWeight: '700', color: '#334155', margin: '20px 0 8px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 12px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>← Back to Home</a>

        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: '20px 0 8px' }}>Privacy Policy</h1>
        <p style={{ ...p, color: '#94a3b8' }}>Last updated: 1 March 2026</p>

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #f1f5f9', marginTop: '20px' }}>

          <h2 style={h2}>1. Introduction</h2>
          <p style={p}>Tech Chain Global Pte Ltd ("TCG", "we", "us") is committed to protecting the personal data of our users in accordance with the Personal Data Protection Act 2012 ("PDPA") of Singapore. This Privacy Policy explains how we collect, use, disclose, and protect your personal data when you use the TCG Express platform ("Platform").</p>

          <h2 style={h2}>2. Data We Collect</h2>
          <h3 style={h3}>2.1 Account Information</h3>
          <p style={p}>Name, email address, phone number, company name, UEN (for business accounts), and account credentials.</p>
          <h3 style={h3}>2.2 Driver Information</h3>
          <p style={p}>Driving licence details, vehicle type and plate number, bank account/PayNow details for payouts.</p>
          <h3 style={h3}>2.3 Transaction Data</h3>
          <p style={p}>Job details (addresses, item descriptions, pricing), bid history, payment records, wallet transactions, and invoices.</p>
          <h3 style={h3}>2.4 Location Data</h3>
          <p style={p}>Real-time GPS location of Drivers during active deliveries for live tracking. Location data is only collected when Drivers have an active job and have granted permission through their device.</p>
          <h3 style={h3}>2.5 Device &amp; Usage Data</h3>
          <p style={p}>Device type, browser, IP address, pages visited, and interaction patterns for Platform improvement and security.</p>
          <h3 style={h3}>2.6 Communication Data</h3>
          <p style={p}>In-app messages between Clients and Drivers, support tickets, and email correspondence.</p>

          <h2 style={h2}>3. How We Use Your Data</h2>
          <p style={p}>We use your personal data for the following purposes:</p>
          <p style={p}>(a) <strong>Service Delivery</strong> — To facilitate job matching, bidding, payments, tracking, and invoicing.</p>
          <p style={p}>(b) <strong>Account Management</strong> — To verify identity, manage accounts, and process registrations.</p>
          <p style={p}>(c) <strong>Payments</strong> — To process wallet top-ups, job payments, driver payouts, and refunds.</p>
          <p style={p}>(d) <strong>Safety &amp; Security</strong> — To detect fraud, resolve disputes, and ensure Platform integrity.</p>
          <p style={p}>(e) <strong>Communication</strong> — To send job notifications, payment confirmations, and important service updates.</p>
          <p style={p}>(f) <strong>Improvement</strong> — To analyse usage patterns and improve Platform features and performance.</p>
          <p style={p}>(g) <strong>Legal Compliance</strong> — To comply with applicable laws, regulations, and legal processes.</p>

          <h2 style={h2}>4. Data Sharing &amp; Disclosure</h2>
          <p style={p}>We may share your personal data with:</p>
          <p style={p}>(a) <strong>Other Users</strong> — Clients can see Driver name, vehicle details, and real-time location during active jobs. Drivers can see Client company name and job details.</p>
          <p style={p}>(b) <strong>Service Providers</strong> — Third-party services that help us operate the Platform, including Supabase (database), Vercel (hosting), Sentry (error monitoring), and payment processors.</p>
          <p style={p}>(c) <strong>Legal Requirements</strong> — When required by law, court order, or government authority.</p>
          <p style={p}>We do not sell your personal data to third parties for marketing purposes.</p>

          <h2 style={h2}>5. Data Retention</h2>
          <p style={p}>We retain your personal data for as long as your account is active and for a reasonable period thereafter for legal, tax, and audit purposes. Transaction records are retained for a minimum of 5 years as required by Singapore regulations. Location data from completed deliveries is retained for 90 days, then anonymised.</p>

          <h2 style={h2}>6. Data Security</h2>
          <p style={p}>We implement appropriate technical and organisational measures to protect your personal data, including encrypted data transmission (TLS/SSL), secure database access controls (Row Level Security), encrypted storage of sensitive credentials, and regular security reviews.</p>

          <h2 style={h2}>7. Your Rights Under PDPA</h2>
          <p style={p}>Under the PDPA, you have the right to:</p>
          <p style={p}>(a) <strong>Access</strong> — Request a copy of the personal data we hold about you.</p>
          <p style={p}>(b) <strong>Correction</strong> — Request correction of inaccurate or incomplete personal data.</p>
          <p style={p}>(c) <strong>Withdrawal of Consent</strong> — Withdraw consent for the collection, use, or disclosure of your personal data, subject to legal and contractual restrictions.</p>
          <p style={p}>To exercise these rights, please contact our Data Protection Officer at the contact details below. We will respond to your request within 30 business days.</p>

          <h2 style={h2}>8. Cookies &amp; Analytics</h2>
          <p style={p}>The Platform uses essential cookies for authentication and session management. We may use analytics tools to understand Platform usage patterns. No third-party advertising cookies are used.</p>

          <h2 style={h2}>9. International Transfers</h2>
          <p style={p}>Your data may be processed on servers located outside of Singapore (e.g., cloud hosting providers). Where such transfers occur, we ensure appropriate safeguards are in place to protect your data in accordance with the PDPA.</p>

          <h2 style={h2}>10. Children's Privacy</h2>
          <p style={p}>The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal data from minors.</p>

          <h2 style={h2}>11. Changes to This Policy</h2>
          <p style={p}>We may update this Privacy Policy from time to time. Material changes will be notified via email or Platform notification. The "Last updated" date at the top indicates the latest revision.</p>

          <h2 style={h2}>12. Contact &amp; Data Protection Officer</h2>
          <p style={p}>For questions, data access requests, or complaints regarding your personal data:</p>
          <p style={p}>Data Protection Officer<br />Tech Chain Global Pte Ltd<br />Email: privacy@techchainglobal.com<br />General: support@techchainglobal.com<br />Website: www.techchainglobal.com</p>

          <p style={p}>If you are not satisfied with our response, you may lodge a complaint with the Personal Data Protection Commission (PDPC) of Singapore at www.pdpc.gov.sg.</p>
        </div>
      </div>
    </div>
  );
}
