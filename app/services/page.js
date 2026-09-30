'use client';
import { useRouter } from 'next/navigation';
import useMobile from '../components/useMobile';
import useLocale from '../components/useLocale';

const TECH_FEATURES = [
  'Fixed price shown before you book',
  'Verified drivers — motorcycle, car, van or lorry',
  'Add manpower, wrapping or white-glove handling',
  'Live tracking and photo proof of delivery',
  'An invoice for every job',
];

// Plain facts about how the service works — no performance numbers until we have real ones.
const HIGHLIGHTS = [
  { value: '10 FREE', label: 'deliveries for new businesses · code FIRST10' },
  { value: 'Fixed', label: 'price shown before you book' },
  { value: 'Live', label: 'GPS tracking + photo proof' },
  { value: 'Escrow', label: 'driver paid after you confirm' },
];

const SERVICES = [
  {
    key: 'tech_delivery',
    icon: '🖥️',
    title: 'Tech Delivery',
    subtitle: 'B2B Technology Equipment Logistics',
    description:
      'Delivery for IT hardware, servers, displays, POS and networking gear. See a fixed price before you book, a verified driver takes the job, and you track it live — from warehouse to office floor.',
    features: TECH_FEATURES,
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    tag: 'FEATURED',
    cta: '/client/jobs/new',
    ctaLabel: 'Book Now',
  },
  {
    key: 'white_glove',
    icon: '🧤',
    title: 'White Glove Delivery',
    subtitle: 'Premium Care for High-Value Items',
    description:
      'For fragile or high-value items: add white-glove handling, wrapping and extra manpower to any job, and the driver places it where you need it.',
    features: [
      'White-glove handling add-on',
      'Wrapping add-on',
      'Extra manpower for heavy items',
      'Stairs carry when there is no lift',
    ],
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    tag: 'PREMIUM',
    cta: '/client/jobs/new',
    ctaLabel: 'Book Now',
  },
  {
    key: 'corp_premium',
    icon: '🏆',
    title: 'Corp Premium',
    subtitle: 'Dedicated Fleet for Enterprise Clients',
    description:
      'For businesses with recurring or high-volume deliveries. Tell us your routes and volumes, and qualified transport partners send you quotes for a contract.',
    features: [
      'Quotes from qualified transport partners',
      'Volume-based pricing',
      'Dedicated drivers for your routes',
      'Service levels agreed in the contract',
      'NDA on request',
    ],
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    tag: 'ENTERPRISE',
    cta: '/corp-premium',
    ctaLabel: 'Request Quote',
  },
  {
    key: 'express',
    icon: '⚡',
    title: 'Express Delivery',
    subtitle: 'Same-Day & On-Demand Dispatch',
    description:
      'Same-day and scheduled deliveries at a fixed price you see before you book. The first available verified driver takes the job — no bidding, no hidden fees.',
    features: [
      'Fixed price, shown upfront',
      'First available driver accepts',
      'Live GPS tracking',
      'Photo proof of delivery',
    ],
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    tag: 'STANDARD',
    cta: '/client/jobs/new',
    ctaLabel: 'Book Now',
  },
  {
    key: 'cross_border',
    icon: '🇲🇾',
    title: 'Cross-Border: Singapore → Malaysia',
    subtitle: 'Johor Bahru & Kuala Lumpur, door to door',
    description:
      'Hand us the delivery and it is handled: verified cross-border drivers, customs paperwork, live tracking to the door. One quote, one point of contact — nothing is charged until you accept. Pilot runs from October 2026.',
    features: [
      'Verified drivers with VEP RFID and Malaysia cover',
      'Export permit and Malaysian K1 arranged for you',
      'Van to 3-tonne lorry, tech and office equipment',
      'Border checkpoints reported live in the app',
    ],
    color: '#d97706',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    tag: 'NEW · PILOT',
    cta: '/client/jobs/new',
    ctaLabel: 'Request a Quote',
  },
];

export default function ServicesPage() {
  const router = useRouter();
  const m = useMobile();
  const { locale } = useLocale();

  const country = locale === 'id' ? 'Indonesia' : 'Singapore';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo_C_typographic_1200.png" alt="TCG Express" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'contain' }} />
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>TCG Express</span>
        </a>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/login" style={{ padding: '9px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Login</a>
          <a href="/signup" style={{ padding: '9px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Sign Up</a>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: m ? '60px 20px 50px' : '80px 40px 70px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '20px',
          background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
          fontSize: '12px', fontWeight: '700', color: '#93c5fd', letterSpacing: '1px',
          textTransform: 'uppercase', marginBottom: '20px',
        }}>
          TCG Express · {country}
        </div>
        <h1 style={{ fontSize: m ? '32px' : '48px', fontWeight: '800', color: 'white', margin: '0 0 16px', lineHeight: 1.15 }}>
          Delivery Services
        </h1>
        <p style={{ fontSize: m ? '15px' : '18px', color: '#94a3b8', maxWidth: '540px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          Fixed-price delivery for {country}'s businesses — from sensitive IT hardware to regular contract runs.
        </p>
        <a href="/signup" style={{
          display: 'inline-block', padding: '14px 36px', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
          fontSize: '16px', fontWeight: '700', textDecoration: 'none',
        }}>
          Get Started Free →
        </a>
      </div>

      {/* Tech Delivery Feature Card */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: m ? '40px 16px 0' : '60px 24px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
          borderRadius: '20px', padding: m ? '32px 24px' : '48px',
          display: m ? 'block' : 'flex', gap: '48px', alignItems: 'center',
          marginBottom: '40px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Background pattern */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: '-60px', right: '80px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#bfdbfe', letterSpacing: '1.5px', textTransform: 'uppercase' }}>⭐ Featured Service</span>
            </div>
            <h2 style={{ fontSize: m ? '28px' : '36px', fontWeight: '800', color: 'white', margin: '0 0 8px' }}>
              🖥️ Tech Delivery
            </h2>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#93c5fd', margin: '0 0 16px' }}>
              B2B Technology Equipment Logistics
            </p>
            <p style={{ fontSize: '15px', color: '#bfdbfe', lineHeight: 1.7, margin: '0 0 28px' }}>
              For IT hardware, servers, displays, POS and networking gear.
              See a fixed price before you book, a verified driver takes the job, and you track it live — from warehouse to office floor.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TECH_FEATURES.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#dbeafe' }}>
                  <span style={{ color: '#60a5fa', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="/client/jobs/new" style={{ padding: '13px 28px', borderRadius: '10px', background: 'white', color: '#1d4ed8', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
                Book Tech Delivery
              </a>
              <a href="/corp-premium" style={{ padding: '13px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
                Enterprise Contract →
              </a>
            </div>
          </div>

          {/* Highlights */}
          {!m && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {HIGHLIGHTS.map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px 24px', minWidth: '180px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: '500' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Other Services */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>All Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '60px' }}>
          {SERVICES.filter(s => s.key !== 'tech_delivery').map(s => (
            <div key={s.key} style={{
              background: 'white', borderRadius: '16px', padding: '28px',
              border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ fontSize: '36px' }}>{s.icon}</div>
                <span style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800',
                  background: `${s.color}15`, color: s.color, letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>{s.tag}</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{s.title}</h3>
              <p style={{ fontSize: '13px', color: s.color, fontWeight: '600', margin: '0 0 12px' }}>{s.subtitle}</p>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.65, flex: 1, margin: '0 0 20px' }}>{s.description}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {s.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#374151' }}>
                    <span style={{ color: s.color, fontWeight: '700', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={s.cta} style={{
                display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: '10px',
                background: s.gradient, color: 'white', fontSize: '14px', fontWeight: '700', textDecoration: 'none',
              }}>{s.ctaLabel}</a>
            </div>
          ))}
        </div>

        {/* Cross-border SG → MY (30 Sep 2026) */}
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a',
          borderRadius: '20px', padding: m ? '28px 22px' : '40px', marginBottom: '60px',
          display: 'grid', gridTemplateColumns: m ? '1fr' : '1.4fr 1fr', gap: m ? '20px' : '36px', alignItems: 'center',
        }}>
          <div>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: '#b45309', color: 'white', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '14px' }}>NEW · CROSS-BORDER PILOT</span>
            <h2 style={{ fontSize: m ? '24px' : '30px', fontWeight: '800', color: '#78350f', margin: '0 0 12px', lineHeight: 1.2 }}>
              Singapore to Johor Bahru and Kuala Lumpur delivery — handled end to end
            </h2>
            <p style={{ fontSize: '15px', color: '#92400e', lineHeight: 1.7, margin: '0 0 18px' }}>
              Post the job with the consignee and goods details, and leave the rest to us: verified cross-border drivers (VEP RFID, Malaysia insurance cover), the Singapore export permit and Malaysian K1, and live tracking checkpoint by checkpoint. You get one quote and one point of contact, and nothing is charged until you accept. Tech, IT and office equipment, van to 3-tonne lorry, door to door.
            </p>
            <a href="/client/jobs/new" style={{ display: 'inline-block', padding: '13px 26px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #b45309)', color: 'white', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>Request a cross-border quote</a>
          </div>
          <div style={{ background: 'white', borderRadius: '16px', padding: '22px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#b45309', letterSpacing: '0.5px', marginBottom: '10px' }}>HOW IT WORKS</div>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#374151', fontSize: '14px', lineHeight: 1.8 }}>
              <li>Choose Malaysia as the destination and add the consignee and goods details.</li>
              <li>Verified cross-border drivers quote the whole run — fuel, tolls, road charge and levy included.</li>
              <li>Accept a quote. Customs paperwork is arranged through licensed declaring agents (fees invoiced separately).</li>
              <li>Follow the run live: Singapore checkpoint, cleared, Malaysia checkpoint, delivered.</li>
            </ol>
          </div>
        </div>

        {/* CTA Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          borderRadius: '20px', padding: m ? '36px 24px' : '48px',
          textAlign: 'center', marginBottom: '60px',
        }}>
          <h2 style={{ fontSize: m ? '24px' : '32px', fontWeight: '800', color: 'white', margin: '0 0 12px' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: '0 0 28px' }}>
            10 free deliveries for new businesses — up to S$10 off each of your first 10 (max S$100) with code <strong style={{ color: '#60a5fa' }}>FIRST10</strong>. No top-up needed.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/signup" style={{ padding: '13px 32px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>Create Account</a>
            <a href="/login" style={{ padding: '13px 32px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>Sign In</a>
          </div>
        </div>
      </div>
    </div>
  );
}
