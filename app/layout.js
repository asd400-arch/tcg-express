import './globals.css';
import { AuthProvider } from './components/AuthContext';
import { ToastProvider } from './components/Toast';
import { UnreadMessagesProvider } from './components/UnreadMessagesContext';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import ChatWidget from './components/help/ChatWidget';
import PushPromptBanner from './components/PushPromptBanner';

export const metadata = {
  title: 'TCG Express | Fixed-Price Business Delivery in Singapore',
  description: 'Fixed-price B2B delivery in Singapore. See the price before you book, the first available verified driver takes the job, and you track it live.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TCG Express',
  },
  openGraph: {
    title: 'TCG Express — Fixed-price business delivery in Singapore',
    description: 'See the price before you book. The first available verified driver takes the job. 10 free deliveries for new businesses with code FIRST10.',
    url: 'https://app.techchainglobal.com',
    siteName: 'TCG Express',
    type: 'website',
    locale: 'en_SG',
    images: [{ url: 'https://app.techchainglobal.com/og/tcg-fixed-price-1200x630.jpg', width: 1200, height: 630, alt: 'TCG Express — fixed-price business delivery in Singapore' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCG Express — Fixed-price business delivery',
    description: 'Singapore B2B delivery: see the price before you book, a verified driver takes the job.',
    images: ['https://app.techchainglobal.com/og/tcg-fixed-price-1200x630.jpg'],
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
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider>
          <ToastProvider>
            <UnreadMessagesProvider>
              {children}
              <ChatWidget />
              <PushPromptBanner />
            </UnreadMessagesProvider>
          </ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
