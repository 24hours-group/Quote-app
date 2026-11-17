import { Providers } from '@/components/layout/Providers';
import '@/styles/globals.css';

export const metadata = {
  title: {
    default: 'Townexa | Towing Made Simple.',
    template: '%s | Townexa',
  },
  description: 'Townexa - Towing Made Simple. Fast, reliable roadside assistance quotes and bookings.',
  icons: {
    icon: [
      { url: '/TowNexaa-logo.png' },
      { url: '/icon.png', sizes: 'any' },
    ],
    shortcut: '/TowNexaa-logo.png',
    apple: '/TowNexaa-logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-US">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
