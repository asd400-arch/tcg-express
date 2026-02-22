'use client';
import useMobile from '../components/useMobile';

export default function PrivacyPage() {
  const m = useMobile();
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginTop: '32px', marginBottom: '12px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.8', marginBottom: '12px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: m ? '20px 16px' : '40px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: m ? '24px 20px' : '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
        <a href="/" style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>&larr; Back</a>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginTop: '16px', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>Last updated: 19 February 2026</p>

        <p style={p}>Tech Chain Global Pte Ltd (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;) operates the TCG Express platform (&quot;Platform&quot;). This Privacy Policy describes how we collect, use, store, and protect your personal data when you use our Platform.</p>

        <h2 style={h2}>1. Data We Collect</h2>
        <p style={p}><strong>Account Information:</strong> Name, email address, phone number, company name, and account credentials.</p>
        <p style={p}><strong>Driver Verification Documents:</strong> NRIC (front and back), driving license, vehicle insurance, vehicle registration details, and business registration certificate (for company drivers).</p>
        <p style={p}><strong>Transaction Data:</strong> Job details, bid amounts, payment records, commission details, and refund history.</p>
        <p style={p}><strong>Location Data:</strong> Real-time GPS coordinates during active deliveries (drivers only), pickup and delivery addresses.</p>
        <p style={p}><strong>Communication Data:</strong> In-app chat messages between clients and drivers, dispute records, and support communications.</p>
        <p style={p}><strong>Device & Usage Data:</strong> Browser type, device information, IP address, push notification tokens, and platform usage analytics.</p>

        <h2 style={h2}>2. How We Use Your Data</h2>
        <p style={p}>We use your personal data to: (a) provide and operate the Platform; (b) verify driver identities and qualifications; (c) process payments securely via Stripe; (d) enable real-time delivery tracking; (e) facilitate communication between clients and drivers; (f) resolve disputes and provide customer support; (g) send service notifications via email and push notifications; (h) improve our services and user experience; (i) comply with legal obligations.</p>

        <h2 style={h2}>3. Payment Processing</h2>
        <p style={p}>All payments are processed through Stripe, a PCI-DSS compliant payment processor. We do not store your full credit card details on our servers. Stripe&apos;s privacy policy governs the handling of your payment information. We store only transaction references and amounts for record-keeping purposes.</p>

        <h2 style={h2}>4. Data Sharing</h2>
        <p style={p}>We share your data only as necessary: (a) between clients and drivers for delivery coordination (limited to name, phone, and delivery details); (b) with Stripe for payment processing; (c) with Resend for transactional email delivery; (d) with Sentry for error monitoring (anonymized); (e) with law enforcement when required by applicable law.</p>
        <p style={p}>We do not sell your personal data to third parties.</p>

        <h2 style={h2}>5. Data Storage & Security</h2>
        <p style={p}>Your data is stored on Supabase (hosted on AWS) with encryption at rest and in transit. KYC documents are stored in secure cloud storage with restricted access. We implement industry-standard security measures including HTTPS encryption, row-level security policies, and secure session management.</p>

        <h2 style={h2}>6. Data Retention</h2>
        <p style={p}>We retain your account data for the duration of your account plus 12 months after deletion. Transaction records are retained for 7 years for regulatory compliance. KYC documents are retained for 5 years after account closure. GPS tracking data is retained for 90 days after delivery completion. Chat messages are retained for 12 months.</p>

        <h2 style={h2}>7. Your Rights</h2>
        <p style={p}>Under the Singapore Personal Data Protection Act (PDPA), you have the right to: (a) access your personal data held by us; (b) correct inaccurate or incomplete data; (c) withdraw consent for data processing (which may affect your ability to use the Platform); (d) request data portability where technically feasible.</p>
        <p style={p}>To exercise these rights, contact us at <a href="mailto:admin@techchainglobal.com" style={{ color: '#3b82f6' }}>admin@techchainglobal.com</a>.</p>

        <h2 style={h2}>8. Cookies & Local Storage</h2>
        <p style={p}>We use essential cookies for session management and authentication. We use local storage for push notification preferences. We do not use third-party tracking cookies or advertising cookies.</p>

        <h2 style={h2}>9. Push Notifications</h2>
        <p style={p}>With your consent, we send push notifications for job updates, bid activity, delivery status changes, and important account alerts. You can disable push notifications at any time through your browser settings.</p>

        <h2 style={h2}>10. Children&apos;s Privacy</h2>
        <p style={p}>Our Platform is not intended for individuals under 18 years of age. We do not knowingly collect personal data from children. If we become aware that we have collected data from a child, we will promptly delete it.</p>

        <h2 style={h2}>11. International Transfers</h2>
        <p style={p}>Your data may be processed in jurisdictions outside Singapore where our service providers operate. We ensure appropriate safeguards are in place for any international data transfers.</p>

        <h2 style={h2}>12. Changes to This Policy</h2>
        <p style={p}>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>

        <h2 style={h2}>13. Contact & Data Protection Officer</h2>
        <p style={p}>For privacy-related inquiries or to exercise your data rights, contact us at <a href="mailto:admin@techchainglobal.com" style={{ color: '#3b82f6' }}>admin@techchainglobal.com</a>.</p>
        <p style={p}>Tech Chain Global Pte Ltd<br />Singapore</p>
      </div>
    </div>
  );
}
