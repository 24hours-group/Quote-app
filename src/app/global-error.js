'use client';

import { Button } from '@mui/material';

export default function GlobalError({ reset }) {
  return (
    <html lang="en-US">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>The application encountered an unexpected error.</p>
          <Button onClick={reset} variant="contained">
            Try again
          </Button>
        </main>
      </body>
    </html>
  );
}
