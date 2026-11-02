import { Providers } from '@/components/layout/Providers';
import '@/styles/globals.css';

export const metadata = {
  title: {
    default: 'Roadside Quote',
    template: '%s | Roadside Quote',
  },
  description: 'Self-service roadside assistance quotes and bookings.',
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
