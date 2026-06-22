import { createTheme } from '@mui/material/styles';

export function createAppTheme(mode = 'light') {
  return createTheme({
    palette: { mode },
  });
}
