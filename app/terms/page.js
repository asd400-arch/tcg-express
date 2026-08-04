'use client';

export default function TermsPage() {
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '32px 0 12px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 12px' };
  const li = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 6px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>← Back to Home</a>

        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', margin: '20px 0 8px' }}>Terms of Service</h1>
        <p style={{ ...p, color: '#94a3b8' }}>Effective date: 4 August 2026</p>

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #f1f5f9', marginTop: '20px' }}>

          <h2 style={h2}>1. About TCG Express</h2>
          <p style={p}>TCG Express is a B2B express delivery platform operated by Tech Chain Global Pte Ltd (&quot;TCG&quot;), registered in Singapore. The Platform connects Clients who need items delivered with independent Drivers who fulfil those deliveries. By using our platform at app.techchainglobal.com or the TCG Express mobile app, you agree to these Terms of Service (&quot;Terms&quot;).</p>

          <h2 style={h2}>2. Eligibility</h2>
          <p style={p}>You must be at least 18 years old to use the Platform. Business accounts require a valid company registration. Drivers must hold a valid Singapore driving licence appropriate for their registered vehicle type. TCG reserves the right to suspend or terminate accounts that provide false information.</p>

          <h2 style={h2}>3. How the Platform Works</h2>
          <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
            <li style={li}><strong>Clients</strong> post delivery jobs specifying pickup/delivery addresses, item details, vehicle requirements, and budget range.</li>
            <li style={li}><strong>Drivers</strong> browse available jobs and submit price bids.</li>
            <li style={li}><strong>Clients accept a bid</strong>, which creates a binding delivery agreement. The agreed amount is held in escrow.</li>
            <li style={li}><strong>Driver completes delivery</strong>, uploads proof photos and captures the customer signature.</li>
            <li style={li}><strong>Client confirms receipt</strong>, and funds are released to the Driver&apos;s wallet (less platform commission).</li>
          </ul>
          <p style={p}>TCG acts as a marketplace intermediary. We are not a carrier, freight forwarder, or logistics operator.</p>

          <h2 style={h2}>4. Payments &amp; Wallet</h2>
          <p style={p}>All payments are processed through the Platform Wallet. Clients must maintain sufficient balance before accepting a bid. Wallet top-ups are processed via Stripe (credit/debit card) or PayNow (subject to manual verification). The platform commission is 15% of the agreed job amount, deducted from the Driver payout. Wallet balances (excluding promotional credits) are refundable upon account closure.</p>

          <h2 style={h2}>5. User Obligations</h2>
          <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
            <li style={li}>Provide accurate registration information and keep it up to date.</li>
            <li style={li}>Maintain the security of your account credentials.</li>
            <li style={li}>Comply with all applicable laws and regulations.</li>
            <li style={li}>Drivers: maintain valid insurance, vehicle roadworthiness, and driving licence.</li>
            <li style={li}>Clients: declare item details, weight, and value accurately.</li>
          </ul>

          <h2 style={h2}>6. Prohibited Conduct</h2>
          <p style={p}>Users shall not: (a) use the Platform for illegal purposes; (b) transport prohibited, hazardous, or illegal items; (c) harass, threaten, or abuse other users; (d) manipulate bids, ratings, or reviews; (e) attempt to circumvent Platform payments; (f) create multiple accounts; (g) misrepresent item details or value.</p>

          <h2 style={h2}>7. Liability</h2>
          <p style={p}>TCG acts solely as a platform facilitator. We are not liable for loss, damage, delay, or injury arising from delivery services performed by Drivers. Our total liability shall not exceed the platform commission earned on the relevant transaction. TCG does not provide insurance for items being delivered — Clients should obtain appropriate coverage for high-value items.</p>

          <h2 style={h2}>8. Disputes</h2>
          <p style={p}>In the event of disputes between Clients and Drivers, TCG may mediate at its discretion but is not obligated to do so. TCG reserves the right to hold, refund, or release funds as deemed appropriate during dispute resolution.</p>

          <h2 style={h2}>9. Account Termination</h2>
          <p style={p}>TCG may suspend or terminate your account for violation of these Terms or to protect the Platform and its users. You may also request account deletion at any time by emailing <a href="mailto:support@techchainglobal.com" style={{ color: '#3b82f6' }}>support@techchainglobal.com</a>. Upon termination, any wallet balance (excluding promotional credits) will be refunded within 30 business days. See our <a href="/privacy" style={{ color: '#3b82f6' }}>Privacy Policy</a> for details on data deletion.</p>

          <h2 style={h2}>10. Intellectual Property</h2>
          <p style={p}>All content, branding, software, and technology on the Platform are owned by Tech Chain Global Pte Ltd. Users may not reproduce, modify, or distribute any Platform content without prior written consent.</p>

          <h2 style={h2}>11. Changes to These Terms</h2>
          <p style={p}>TCG may modify these Terms at any time. Material changes will be notified via email or in-app notification. Continued use of the Platform after modifications constitutes acceptance of the updated Terms.</p>

          <h2 style={h2}>12. Governing Law</h2>
          <p style={p}>These Terms are governed by the laws of the Republic of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

          <h2 style={h2}>13. Contact</h2>
          <p style={p}>For questions regarding these Terms:</p>
          <p style={p}>
            Tech Chain Global Pte Ltd<br />
            Email: <a href="mailto:support@techchainglobal.com" style={{ color: '#3b82f6' }}>support@techchainglobal.com</a><br />
            Website: <a href="https://www.techchainglobal.com" style={{ color: '#3b82f6' }}>www.techchainglobal.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
