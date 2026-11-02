'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import {
  CssBaseline,
  StyledEngineProvider,
  ThemeProvider,
} from '@mui/material';
import { NotificationProvider } from '@/components/feedback/NotificationProvider';
import { theme } from '@/styles/theme';

export function Providers({ children }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <NotificationProvider>{children}</NotificationProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </AppRouterCacheProvider>
  );
}
