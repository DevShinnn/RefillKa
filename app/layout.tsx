import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RefillKa Collection Log',
  description:
    'Live collection logging for the RefillKa × Taguig Monitored Field Study (pre-pilot).',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F6F5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        ) : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Sora:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%232D6A4F'/%3E%3Ccircle cx='16' cy='16' r='11' fill='none' stroke='white' stroke-width='1.5'/%3E%3Cpath d='M11 16 C11 11.5, 21 11.5, 21 16 C21 20.5, 11 20.5, 11 16' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-theme','light');try{localStorage.setItem('refillka_theme','light');}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
