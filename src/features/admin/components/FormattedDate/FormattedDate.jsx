'use client';

import { useEffect, useState } from 'react';

export function FormattedDate({ value, fallback = '—' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!value) return <span>{fallback}</span>;

  const date = new Date(value);
  if (isNaN(date.getTime())) return <span>{fallback}</span>;

  if (!mounted) {
    const isoDate = date.toISOString().slice(0, 10);
    const isoTime = date.toISOString().slice(11, 16);
    return <span suppressHydrationWarning>{`${isoDate} ${isoTime} UTC`}</span>;
  }

  return (
    <span suppressHydrationWarning>
      {new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)}
    </span>
  );
}

