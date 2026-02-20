'use client';
import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import useMobile from '../../components/useMobile';

const FAQ_CATEGORIES = [
  {
    key: 'delivery', icon: '🚚', label: 'Delivery',
    faqs: [
      { q: 'How do I track my delivery?', a: 'Go to My Jobs, tap on your active job. You\'ll see a live map showing your driver\'s real-time location.' },
      { q: 'Can I cancel a delivery?', a: 'Yes! Before pickup, go to the job detail page and tap "Cancel Job". After pickup, cancellation may incur a partial fee.' },
      { q: 'How do I change the delivery address?', a: 'Contact your assigned driver through the in-app chat. If the delivery hasn\'t started, the driver can update the route.' },
      { q: 'What if my delivery is late?', a: 'You can track the driver in real-time. If there\'s a significant delay, contact the driver via chat or open a support ticket.' },
      { q: 'What items can I send?', a: 'We support general items, documents, electronics, furniture, food, fragile items, and more. Prohibited items include hazardous materials and illegal goods.' },
    ],
  },
  {
    key: 'payment', icon: '💳', label: 'Payment',
    faqs: [
      { q: 'How does the wallet work?', a: 'Your wallet holds SGD credits. Top up via PayNow, then pay for deliveries directly from your wallet balance.' },
      { q: 'What are top-up bonuses?', a: 'We offer bonus credits on larger top-ups: $100→$5 bonus, $200→$15 bonus, $500→$50 bonus.' },
      { q: 'How do reward points work?', a: 'Earn 5% points on every completed delivery. 100 points = $1. Use points to get discounts on future deliveries.' },
      { q: 'How do I get a refund?', a: 'Refunds for cancelled jobs are automatically credited to your wallet. For bank refunds, contact support.' },
      { q: 'What payment methods are supported?', a: 'We support PayNow (QR code), wallet balance, and reward points. Stripe card payments coming soon.' },
    ],
  },
  {
    key: 'account', icon: '👤', label: 'Account',
    faqs: [
      { q: 'How do I create an account?', a: 'Visit the sign-up page, choose your role (Client or Driver), and fill in your details. Drivers need to complete KYC verification.' },
      { q: 'What is KYC verification?', a: 'Know Your Customer (KYC) verification is required for drivers. Upload your NRIC, driver\'s license, and vehicle insurance in Settings.' },
      { q: 'How do I reset my password?', a: 'On the login page, tap "Forgot Password" and enter your email. You\'ll receive a reset link.' },
      { q: 'How long does driver approval take?', a: 'Admin reviews KYC documents within 24 hours. You\'ll receive a notification once approved.' },
    ],
  },
  {
    key: 'driver', icon: '🏍️', label: 'Driver',
    faqs: [
      { q: 'How does bidding work?', a: 'Browse available jobs, view details and estimated fare, then submit your bid amount. Clients choose the best bid.' },
      { q: 'When do I get paid?', a: 'After the client confirms delivery, the payment is released from escrow. You\'ll see it in your earnings dashboard.' },
      { q: 'What is the commission rate?', a: 'TCG Express charges a 15% commission on each completed delivery. The rest is your payout.' },
      { q: 'How do I increase my chances of winning bids?', a: 'Maintain a high rating, respond quickly to new jobs, write professional bid messages, and have competitive pricing.' },
    ],
  },
];

export default function HelpPage() {
  const m = useMobile();
  const [selectedCat, setSelectedCat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const allFaqs = FAQ_CATEGORIES.flatMap(c => c.faqs.map(f => ({ ...f, category: c.label, icon: c.icon })));
  const filteredFaqs = searchQuery.trim()
    ? allFaqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : selectedCat
    ? FAQ_CATEGORIES.find(c => c.key === selectedCat)?.faqs || []
    : [];

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Help" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>❓ Help Center</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Find answers to common questions or contact support</p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search FAQs..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSelectedCat(null); }}
          style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', marginBottom: '20px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}
        />

        {/* Categories */}
        {!searchQuery && (
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {FAQ_CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => { setSelectedCat(selectedCat === cat.key ? null : cat.key); setOpenFaq(null); }}
                style={{
                  ...card, cursor: 'pointer', textAlign: 'center', marginBottom: 0, border: selectedCat === cat.key ? '2px solid #3b82f6' : '1px solid #f1f5f9',
                  background: selectedCat === cat.key ? '#eff6ff' : 'white', fontFamily: "'Inter', sans-serif",
                }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{cat.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{cat.label}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{cat.faqs.length} articles</div>
              </button>
            ))}
          </div>
        )}

        {/* FAQ List */}
        {(searchQuery || selectedCat) && (
          <div>
            {filteredFaqs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                <p style={{ color: '#64748b' }}>No results found. Try a different search term.</p>
              </div>
            ) : (
              filteredFaqs.map((faq, i) => (
                <div key={i} style={{ ...card, cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', flex: 1 }}>
                      {faq.category && searchQuery && <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '8px' }}>{faq.icon}</span>}
                      {faq.q}
                    </div>
                    <span style={{ fontSize: '18px', color: '#94a3b8', transform: openFaq === i ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▾</span>
                  </div>
                  {openFaq === i && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Contact Support */}
        <div style={{ ...card, background: 'linear-gradient(135deg, #eff6ff, #e0e7ff)', border: '1px solid #c7d2fe', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Still need help?</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Chat with our AI assistant or connect with a support agent</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Use the chat button at the bottom right of the screen</div>
        </div>
      </div>
    </div>
  );
}
