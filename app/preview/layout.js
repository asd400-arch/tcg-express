export const metadata = {
  title: 'TCG Express — Preview Access | Launching 1 September',
  description:
    'Singapore B2B delivery for tech equipment. Post a job, get driver bids in minutes, track door to door, invoices handled. Register early for S$10 launch credit.',
  openGraph: {
    title: 'TCG Express — Launching 1 September',
    description:
      'Post a job, get driver bids in minutes, track door to door, invoices handled. Register for preview access and start with S$10 delivery credit.',
    url: 'https://app.techchainglobal.com/preview',
    siteName: 'TCG Express',
    type: 'website',
    locale: 'en_SG',
    images: [{ url: '/og/preview-card.png', width: 1080, height: 1080, alt: 'TCG Express — Bid it. See it. Done.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCG Express — Launching 1 September',
    description: 'Singapore B2B delivery for tech equipment. S$10 launch credit for early registrations.',
    images: ['/og/preview-card.png'],
  },
};

export default function PreviewLayout({ children }) {
  return children;
}
