'use client';

export default function PrivacyPage() {
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '32px 0 12px' };
  const h3 = { fontSize: '15px', fontWeight: '700', color: '#334155', margin: '20px 0 8px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 12px' };
  const li = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 6px' };
  const table = { width: '100%', borderCollapse: 'collapse', margin: '12px 0 20px', fontSize: '13px' };
  const th = { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#334155', fontWeight: '700', fontSize: '13px' };
  const td = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '13px', verticalAlign: 'top' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>← Back to Home</a>

        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: '20px 0 8px' }}>Privacy Policy</h1>
        <p style={{ ...p, color: '#94a3b8' }}>Effective date: 4 August 2026</p>

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #f1f5f9', marginTop: '20px' }}>

          <h2 style={h2}>1. Introduction</h2>
          <p style={p}>Tech Chain Global Pte Ltd (&quot;TCG&quot;, &quot;we&quot;, &quot;us&quot;) operates the TCG Express delivery platform (&quot;Platform&quot;), including the mobile application and web portal at app.techchainglobal.com. We are committed to protecting personal data in accordance with the Personal Data Protection Act 2012 (&quot;PDPA&quot;) of Singapore.</p>
          <p style={p}>This Privacy Policy explains what data we collect, why we collect it, who we share it with, and how you can exercise your rights — including how to delete your account.</p>

          <h2 style={h2}>2. Data We Collect</h2>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Category</th>
                <th style={th}>Data collected</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Account &amp; identity</td>
                <td style={td}>Full name (contact name), email address, phone number, company name, UEN (business accounts), password (hashed)</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Delivery addresses</td>
                <td style={td}>Pickup address, delivery address, and any special instructions provided per job</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Location data</td>
                <td style={td}>Real-time GPS location of Drivers during active deliveries (latitude, longitude, heading, speed). Collected only when the Driver has an active job and has granted device permission.</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Photos</td>
                <td style={td}>Pickup proof photos, delivery proof photos, customer signatures, and images shared in chat messages</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Push notification token</td>
                <td style={td}>Expo push token for delivering notifications about jobs, chat messages, and payment updates to your device</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Payment &amp; transaction records</td>
                <td style={td}>Wallet balance, top-up history, job payment records, driver payouts, Stripe payment intents and customer IDs</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Driver documents</td>
                <td style={td}>Driving licence, vehicle type and plate number, bank/PayNow details for payouts, KYC verification documents</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Device &amp; usage data</td>
                <td style={td}>Device type, operating system, IP address, and interaction patterns for security and improvement</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Communications</td>
                <td style={td}>In-app chat messages between Clients and Drivers, inquiry messages, and support correspondence</td>
              </tr>
            </tbody>
          </table>

          <h2 style={h2}>3. How We Use Your Data</h2>
          <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
            <li style={li}><strong>Delivery service</strong> — Job matching, bidding, driver assignment, live tracking, proof of delivery, and invoicing.</li>
            <li style={li}><strong>Payments</strong> — Processing wallet top-ups, escrow holds, driver payouts, and refunds via Stripe.</li>
            <li style={li}><strong>Notifications</strong> — Sending push notifications for new jobs, bids, chat messages, payment confirmations, and delivery status updates.</li>
            <li style={li}><strong>Customer support</strong> — Resolving disputes, answering enquiries, and processing complaints.</li>
            <li style={li}><strong>Safety &amp; security</strong> — Fraud detection, identity verification, and platform integrity.</li>
            <li style={li}><strong>Improvement</strong> — Analysing usage patterns to improve Platform features and performance.</li>
            <li style={li}><strong>Legal compliance</strong> — Meeting regulatory requirements and responding to lawful requests.</li>
          </ul>

          <h2 style={h2}>4. Third-Party Service Providers</h2>
          <p style={p}>We share data with the following third-party services, solely for the purposes described:</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Provider</th>
                <th style={th}>Purpose</th>
                <th style={th}>Data shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Stripe</td>
                <td style={td}>Payment processing</td>
                <td style={td}>Name, email, payment details, transaction amounts</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Supabase</td>
                <td style={td}>Database &amp; file storage</td>
                <td style={td}>All account and transaction data, uploaded photos</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Expo (EAS)</td>
                <td style={td}>Push notifications</td>
                <td style={td}>Push tokens, notification content</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Vercel</td>
                <td style={td}>Web hosting &amp; API</td>
                <td style={td}>API requests, server logs</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Google Maps</td>
                <td style={td}>Address autocomplete &amp; geocoding</td>
                <td style={td}>Address strings, coordinates</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: '600' }}>Sentry</td>
                <td style={td}>Error monitoring</td>
                <td style={td}>Error logs, device info (no PII)</td>
              </tr>
            </tbody>
          </table>
          <p style={p}>We do not sell your personal data to third parties for marketing or advertising purposes.</p>

          <h2 style={h2}>5. Data Retention</h2>
          <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
            <li style={li}><strong>Account data</strong> — Retained while your account is active, plus 30 days after deletion request to allow recovery.</li>
            <li style={li}><strong>Transaction records</strong> — Retained for 5 years as required by Singapore tax and audit regulations.</li>
            <li style={li}><strong>Location data</strong> — Retained for 90 days after delivery completion, then deleted.</li>
            <li style={li}><strong>Chat messages &amp; photos</strong> — Retained for 1 year after the related job is completed.</li>
            <li style={li}><strong>Push tokens</strong> — Deleted immediately when you log out or delete your account.</li>
          </ul>

          <h2 style={h2}>6. Account Deletion</h2>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '16px 20px', margin: '12px 0 16px' }}>
            <p style={{ ...p, margin: '0 0 8px', fontWeight: '600', color: '#0c4a6e' }}>You can request full deletion of your account and associated personal data at any time.</p>
            <p style={{ ...p, margin: '0 0 8px' }}>To delete your account, email us at <strong>support@techchainglobal.com</strong> with the subject line &quot;Account Deletion Request&quot; and the email address associated with your account.</p>
            <p style={{ ...p, margin: 0 }}>Upon receiving your request, we will: (1) verify your identity, (2) cancel any active jobs, (3) process any pending wallet balance refund, and (4) permanently delete your account and personal data within 30 days. Transaction records required by law will be retained in anonymised form.</p>
          </div>

          <h2 style={h2}>7. Data Security</h2>
          <p style={p}>We implement appropriate technical and organisational measures to protect your personal data, including: encrypted data transmission (TLS/SSL), secure database access controls (Row Level Security), hashed password storage, JWT-based authentication with expiry, and regular security reviews.</p>

          <h2 style={h2}>8. Your Rights Under PDPA</h2>
          <p style={p}>Under the PDPA, you have the right to:</p>
          <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
            <li style={li}><strong>Access</strong> — Request a copy of the personal data we hold about you.</li>
            <li style={li}><strong>Correction</strong> — Request correction of inaccurate or incomplete personal data.</li>
            <li style={li}><strong>Withdrawal of consent</strong> — Withdraw consent for collection, use, or disclosure of your data, subject to legal and contractual restrictions.</li>
            <li style={li}><strong>Deletion</strong> — Request deletion of your account and personal data (see Section 6 above).</li>
          </ul>
          <p style={p}>To exercise these rights, contact our Data Protection Officer at the details below. We will respond within 30 business days.</p>

          <h2 style={h2}>9. Cookies</h2>
          <p style={p}>The web platform uses essential cookies for authentication and session management only. No third-party advertising or tracking cookies are used.</p>

          <h2 style={h2}>10. International Transfers</h2>
          <p style={p}>Your data may be processed on servers located outside Singapore through our cloud service providers. Where such transfers occur, we ensure appropriate safeguards are in place in accordance with the PDPA.</p>

          <h2 style={h2}>11. Children&apos;s Privacy</h2>
          <p style={p}>The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal data from minors.</p>

          <h2 style={h2}>12. Changes to This Policy</h2>
          <p style={p}>We may update this Privacy Policy from time to time. Material changes will be notified via email or in-app notification. The &quot;Effective date&quot; at the top indicates the latest revision.</p>

          <h2 style={h2}>13. Contact &amp; Data Protection Officer</h2>
          <p style={p}>For questions, data access requests, deletion requests, or complaints:</p>
          <p style={p}>
            Data Protection Officer<br />
            Tech Chain Global Pte Ltd<br />
            Email: <a href="mailto:support@techchainglobal.com" style={{ color: '#3b82f6' }}>support@techchainglobal.com</a><br />
            Website: <a href="https://www.techchainglobal.com" style={{ color: '#3b82f6' }}>www.techchainglobal.com</a>
          </p>
          <p style={p}>If you are not satisfied with our response, you may lodge a complaint with the Personal Data Protection Commission (PDPC) of Singapore at <a href="https://www.pdpc.gov.sg" style={{ color: '#3b82f6' }}>www.pdpc.gov.sg</a>.</p>
        </div>
      </div>
    </div>
  );
}
