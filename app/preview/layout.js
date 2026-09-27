export const metadata = {
  title: 'TCG Express — Fixed-price business delivery in Singapore',
  description:
    'Singapore B2B delivery for tech equipment. See a fixed price before you book, a verified driver takes the job, track it door to door. 10 free deliveries for new businesses with code FIRST10.',
  openGraph: {
    title: 'TCG Express — Fixed-price business delivery',
    description:
      'See the price before you book. The first available verified driver takes the job. 10 free deliveries for new businesses with code FIRST10.',
    url: 'https://app.techchainglobal.com/preview',
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

export default function PreviewLayout({ children }) {
  return children;
}
