import './globals.css';
import { AuthProvider } from './components/AuthContext';
import { ToastProvider } from './components/Toast';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import ChatWidget from './components/help/ChatWidget';

export const metadata = {
  title: 'TCG Express | B2B Express Delivery Platform',
  description: 'On-demand B2B delivery platform. Post jobs, get bids, track deliveries in real-time.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TCG Express',
  },
  openGraph: {
    title: 'TCG Express - B2B Tech Equipment Delivery',
    description: 'Singapore premier B2B technology equipment delivery platform. Fast, reliable, insured.',
    url: 'https://express.techchainglobal.com',
    siteName: 'TCG Express',
    type: 'website',
    locale: 'en_SG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCG Express',
    description: 'B2B tech equipment delivery in Singapore',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider>
          <ToastProvider>
            {children}
            <ChatWidget />
          </ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
