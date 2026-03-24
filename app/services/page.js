'use client';
import { useRouter } from 'next/navigation';
import useMobile from '../components/useMobile';
import useLocale from '../components/useLocale';

const SERVICES = [
  {
    key: 'tech_delivery',
    icon: '🖥️',
    title: 'Tech Delivery',
    subtitle: 'B2B Technology Equipment Logistics',
    description:
      'Purpose-built delivery for IT hardware, servers, rack equipment, and sensitive electronics. Trained handlers, anti-static packaging, and real-time tracking — from data centre to office floor.',
    features: [
      'Rack & server transport with anti-static handling',
      'White-glove unboxing and placement',
      'Delivery + installation / commission testing',
      'Site-survey & access coordination',
      'Chain-of-custody documentation',
    ],
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
      'Concierge-level delivery for fragile, high-value, or executive equipment. Full wrap, careful transit, and on-site placement by certified handlers.',
    features: [
      'Full bubble-wrap & foam packaging',
      'Dedicated 2-man team',
      'Indoor placement & debris removal',
      'Insurance coverage available',
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
      'Tailored logistics contracts for enterprises with recurring, high-volume, or time-sensitive delivery needs. Dedicated drivers, SLA agreements, and a dedicated account manager.',
    features: [
      'Dedicated driver pool',
      'Volume-based pricing',
      'SLA & uptime guarantees',
      'NDA & data-security compliance',
      'Monthly reporting & analytics',
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
      'Urgent deliveries dispatched within minutes. Competitive open-bid marketplace connects you to the nearest available driver — transparent pricing, no hidden fees.',
    features: [
      'Dispatch in under 5 minutes',
      'Live GPS tracking',
      'Open-bid or instant-accept',
      'Photo proof of delivery',
    ],
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    tag: 'STANDARD',
    cta: '/client/jobs/new',
    ctaLabel: 'Book Now',
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
          From sensitive IT hardware to enterprise fleet contracts — purpose-built logistics for {country}'s businesses.
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
              Purpose-built for IT hardware, servers, rack equipment, and sensitive electronics.
              Trained handlers, anti-static packaging, and real-time tracking — from data centre to office floor.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Rack & server transport with anti-static handling',
                'White-glove unboxing and placement',
                'Delivery + installation / commission testing',
                'Chain-of-custody documentation',
                'Site-survey & access coordination',
              ].map((f, i) => (
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

          {/* Stats */}
          {!m && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { value: '500+', label: 'Tech Deliveries Completed' },
                { value: '4.9★', label: 'Average Rating' },
                { value: '< 60 min', label: 'Average Dispatch Time' },
                { value: '0', label: 'Equipment Damage Claims' },
              ].map((s, i) => (
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
            Sign up free — first delivery on us with code <strong style={{ color: '#60a5fa' }}>WELCOME</strong>
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
