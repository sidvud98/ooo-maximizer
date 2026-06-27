import { useMemo } from 'react';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { ConfigProvider, theme as antdTheme } from 'antd';
import App from './App.jsx';
import { createAppTheme } from './theme.js';

export default function ThemedApp() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createAppTheme(prefersDark ? 'dark' : 'light'), [prefersDark]);

  // Keep antd date pickers visually aligned with MUI: same primary color,
  // radius, font, and a 40px control height to match MUI `size="small"`.
  const antdConfig = useMemo(
    () => ({
      algorithm: prefersDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: theme.palette.primary.main,
        borderRadius: Number(theme.shape.borderRadius) || 4,
        fontFamily: theme.typography.fontFamily,
        controlHeight: 40,
        colorBgContainer: theme.palette.background.paper,
        colorBorder: theme.palette.divider,
        colorText: theme.palette.text.primary,
        zIndexPopupBase: 1500,
      },
    }),
    [prefersDark, theme],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfigProvider theme={antdConfig}>
        <App />
      </ConfigProvider>
    </ThemeProvider>
  );
}
