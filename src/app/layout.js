import { Providers } from '@/components/layout/Providers';
import '@/styles/globals.css';

export const metadata = {
  title: {
    default: 'Townexa | Towing Made Simple.',
    template: '%s | Townexa',
  },
  description: 'Townexa - Towing Made Simple. Fast, reliable roadside assistance quotes and bookings.',
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
