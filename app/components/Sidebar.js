'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import useMobile from './useMobile';
import NotificationBell from './NotificationBell';
import { useUnreadMessages } from './UnreadMessagesContext';
import useLocale from './useLocale';
import { formatCurrency } from '../../lib/locale/config';

const clientLinks = [
  { label: 'Dashboard', href: '/client/dashboard', icon: '📊' },
  { label: 'New Delivery', href: '/client/jobs/new', icon: '➕' },
  { label: 'My Deliveries', href: '/client/jobs', icon: '📦' },
  { label: 'Services', href: '/services', icon: '🖥️' },
  { label: 'Wallet', href: '/client/wallet', icon: '👛' },
  { label: 'Help', href: '/client/help', icon: '❓' },
  { label: 'Settings', href: '/client/settings', icon: '⚙️' },
];

const driverLinks = [
  { label: 'Dashboard', href: '/driver/dashboard', icon: '📊' },
  { label: 'Available Jobs', href: '/driver/jobs', icon: '🔍' },
  { label: 'My Jobs', href: '/driver/my-jobs', icon: '📦' },
  { label: 'Earnings', href: '/driver/earnings', icon: '💰' },
  { label: 'Wallet', href: '/driver/wallet', icon: '👛' },
  { label: 'Help', href: '/driver/help', icon: '❓' },
  { label: 'Settings', href: '/driver/settings', icon: '⚙️' },
];

const adminLinks = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
  { label: 'All Jobs', href: '/admin/jobs', icon: '📦' },
  { label: 'Disputes', href: '/admin/disputes', icon: '⚖️' },
  { label: 'Drivers', href: '/admin/drivers', icon: '🚗' },
  { label: 'Clients', href: '/admin/clients', icon: '🏢' },
  { label: 'Coupons', href: '/admin/coupons', icon: '🎟️' },
  { label: 'Promotions', href: '/admin/promotions', icon: '🎯' },
  { label: 'Warehouse', href: '/admin/warehouse', icon: '🏭' },
  { label: 'Corp Premium', href: '/admin/corp-premium', icon: '🏆' },
  { label: 'Geo Zones', href: '/admin/geo-zones', icon: '🗺️' },
  { label: 'Banners', href: '/admin/banners', icon: '📢' },
  { label: 'Support', href: '/admin/support', icon: '💬' },
  { label: 'Transactions', href: '/admin/transactions', icon: '💳' },
  { label: 'Wallet', href: '/admin/wallet', icon: '👛' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
  { label: 'API Keys', href: '/admin/api-keys', icon: '🔑' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export default function Sidebar({ active = '', title }) {
  const { user, logout } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const m = useMobile();
  const [open, setOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const { totalUnread } = useUnreadMessages();
  const displayTitle = title || active;

  // Fetch wallet balance for badge
  useEffect(() => {
    if (user && (user.role === 'client' || user.role === 'driver')) {
      fetch('/api/wallet')
        .then(res => res.json())
        .then(result => {
          if (result.data?.wallet?.balance != null) {
            setWalletBalance(parseFloat(result.data.wallet.balance));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'driver' ? driverLinks : clientLinks;
  const roleColor = user?.role === 'admin' ? '#ef4444' : user?.role === 'driver' ? '#10b981' : '#3b82f6';
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'driver' ? 'Driver' : 'Client';

  const sidebar = (
    <div style={{
      width: m ? '100%' : '240px', height: m ? '100vh' : '100vh',
      background: 'white', borderRight: m ? 'none' : '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', position: m ? 'fixed' : 'sticky',
      top: 0, left: 0, zIndex: 100, flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo_C_typographic_1200.png" alt="TCG Express" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>TCG Express</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: roleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{roleLabel}</div>
          </div>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user?.id && <NotificationBell userId={user.id} />}
          {m && <div onClick={() => setOpen(false)} style={{ fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>✕</div>}
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        {links.map((link, i) => (
          <a key={i} href={link.href} onClick={() => m && setOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px', borderRadius: '10px', marginBottom: '4px',
            textDecoration: 'none', fontSize: '14px', fontWeight: '500',
            background: active === link.label ? `${roleColor}10` : 'transparent',
            color: active === link.label ? roleColor : '#64748b',
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: '18px' }}>{link.icon}</span>
            <span style={{ flex: 1 }}>{link.label}</span>
            {link.label === 'Wallet' && walletBalance > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: '700',
                padding: '2px 8px', borderRadius: '10px',
                background: active === 'Wallet' ? `${roleColor}20` : '#f1f5f9',
                color: active === 'Wallet' ? roleColor : '#475569',
              }}>{formatCurrency(walletBalance, locale)}</span>
            )}
            {(link.label === 'My Jobs' || link.label === 'My Deliveries') && totalUnread > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: '700', minWidth: '20px', textAlign: 'center',
                padding: '2px 7px', borderRadius: '10px',
                background: '#ef4444', color: 'white',
              }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </a>
        ))}
      </div>

      {/* User Info */}
      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>
            {(user?.contact_name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.contact_name || 'User'}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={() => { logout(); router.push('/login'); }} style={{
          width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0',
          background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '500',
          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}>Logout</button>
      </div>
    </div>
  );

  if (m) {
    return (
      <>
        {/* Mobile Header */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 99,
          background: 'white', borderBottom: '1px solid #e2e8f0',
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <img src="/logo_C_typographic_1200.png" alt="TCG Express" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain', flexShrink: 0 }} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle || 'TCG Express'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.id && <NotificationBell userId={user.id} />}
            <div onClick={() => setOpen(true)} style={{ display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer', padding: '6px' }}>
              <div style={{ width: '20px', height: '2px', background: '#64748b', borderRadius: '2px' }}></div>
              <div style={{ width: '20px', height: '2px', background: '#64748b', borderRadius: '2px' }}></div>
              <div style={{ width: '20px', height: '2px', background: '#64748b', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
        {/* Spacer */}
        <div style={{ height: '56px' }}></div>
        {/* Mobile Overlay */}
        {open && <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.3)' }} onClick={() => setOpen(false)}>{sidebar}</div>}
      </>
    );
  }

  return sidebar;
}
