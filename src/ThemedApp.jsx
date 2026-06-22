import { useMemo } from 'react';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import App from './App.jsx';
import { createAppTheme } from './theme.js';

export default function ThemedApp() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createAppTheme(prefersDark ? 'dark' : 'light'), [prefersDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
