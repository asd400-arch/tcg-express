'use client';
import useMobile from '../components/useMobile';

export default function TermsPage() {
  const m = useMobile();
  const h2 = { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginTop: '32px', marginBottom: '12px' };
  const p = { fontSize: '14px', color: '#475569', lineHeight: '1.8', marginBottom: '12px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: m ? '20px 16px' : '40px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: m ? '24px 20px' : '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
        <a href="/" style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>← Back</a>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginTop: '16px', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>Last updated: 19 February 2026</p>

        <p style={p}>Welcome to Tech Chain Express ("Platform"), operated by Tech Chain Global Pte Ltd ("Company", "we", "us"). By accessing or using our Platform, you agree to be bound by these Terms of Service ("Terms").</p>

        <h2 style={h2}>1. Service Description</h2>
        <p style={p}>Tech Chain Express is a B2B express delivery marketplace that connects businesses ("Clients") with delivery service providers ("Drivers"). We facilitate job posting, bidding, payment processing, and real-time delivery tracking.</p>

        <h2 style={h2}>2. Account Registration</h2>
        <p style={p}>To use our Platform, you must register an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials. Driver accounts require admin approval and valid documentation (NRIC, license, vehicle insurance).</p>

        <h2 style={h2}>3. Client Obligations</h2>
        <p style={p}>Clients agree to: (a) provide accurate job descriptions, pickup/delivery addresses, and item details; (b) ensure items are legal and properly packaged; (c) pay the agreed bid amount through our secure payment system; (d) confirm delivery upon receipt of items in satisfactory condition.</p>

        <h2 style={h2}>4. Driver Obligations</h2>
        <p style={p}>Drivers agree to: (a) maintain valid licenses, insurance, and vehicle registration; (b) handle items with care and provide photo proof of pickup and delivery; (c) complete deliveries within agreed timeframes; (d) comply with all applicable traffic and safety regulations.</p>

        <h2 style={h2}>5. Payments & Escrow</h2>
        <p style={p}>All payments are processed securely through Stripe. When a Client accepts a bid, the payment is held in escrow. Funds are released to the Driver upon confirmed delivery, minus the platform commission. Refunds are issued automatically upon job cancellation before delivery.</p>

        <h2 style={h2}>6. Commission</h2>
        <p style={p}>The Platform charges a commission on each completed delivery. The current rate is displayed in the platform settings and may be updated from time to time. Drivers are paid the bid amount minus the commission.</p>

        <h2 style={h2}>7. Disputes</h2>
        <p style={p}>Either party may raise a dispute through the Platform. Disputes freeze the escrow until resolved by an admin. We aim to resolve disputes fairly based on evidence provided by both parties, including photo proof and chat records.</p>

        <h2 style={h2}>8. Cancellation</h2>
        <p style={p}>Clients may cancel jobs before delivery. Cancellation triggers a full refund of the escrowed amount. Excessive cancellations may result in account review. Admins reserve the right to cancel jobs and issue refunds at their discretion.</p>

        <h2 style={h2}>9. Limitation of Liability</h2>
        <p style={p}>Tech Chain Express acts as a marketplace facilitator. We are not liable for: (a) damage, loss, or delay of items during delivery; (b) disputes between Clients and Drivers; (c) accuracy of information provided by users. Our total liability is limited to the commission earned on the relevant transaction.</p>

        <h2 style={h2}>10. Account Termination</h2>
        <p style={p}>We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or receive repeated complaints. Users may close their accounts by contacting support.</p>

        <h2 style={h2}>11. Modifications</h2>
        <p style={p}>We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms. We will notify registered users of material changes via email.</p>

        <h2 style={h2}>12. Governing Law</h2>
        <p style={p}>These Terms are governed by the laws of the Republic of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

        <h2 style={h2}>13. Contact</h2>
        <p style={p}>For questions about these Terms, contact us at <a href="mailto:admin@techchainglobal.com" style={{ color: '#3b82f6' }}>admin@techchainglobal.com</a>.</p>
      </div>
    </div>
  );
}
