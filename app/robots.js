export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup'],
        disallow: ['/client/', '/driver/', '/admin/', '/api/'],
      },
    ],
    sitemap: 'https://express.techchainglobal.com/sitemap.xml',
  };
}
