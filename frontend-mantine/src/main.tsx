import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
);