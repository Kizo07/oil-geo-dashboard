import { createTheme } from '@mantine/core';

// "Cyan Ledger" theme ported from Kizo07.github.io (branch fusion/cyan-ledger):
// electric cyan × ledger gold, grotesk display headings, midnight / ice schemes.
// The per-scheme design tokens (--bg, --surface, --accent, --gold, ...) live in
// ./cyan-ledger.css; the palettes below keep Mantine's color scales on the same
// hues. The app's semantic color names are preserved and re-pointed at the
// Cyan Ledger ramps:
//   amber  → matrix cyan  (primary — the site's exact ramp)
//   cyan   → matrix cyan, violet/yellow → ledger gold
//   green  → ledger green-teal, red → ledger red
//   dark/gray → ledger midnight surfaces and blue-gray neutrals
export const theme = createTheme({
  primaryColor: 'amber',
  primaryShade: { dark: 5, light: 7 },
  defaultRadius: 'md',
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
  headings: {
    fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    fontWeight: '500',
  },
  cursorType: 'pointer',
  focusRing: 'auto',
  colors: {
    // Exact matrix-cyan ramp from the source site's Mantine theme.
    amber: [
      '#e9faff',
      '#cef2ff',
      '#a0e8ff',
      '#6bdbff',
      '#36ceff',
      '#08bfff', // dark-scheme accent
      '#009ed9',
      '#007ea9', // light-scheme primary shade
      '#006484',
      '#004a63',
    ],
    cyan: [
      '#e9faff',
      '#cef2ff',
      '#a0e8ff',
      '#6bdbff',
      '#36ceff',
      '#08bfff',
      '#009ed9',
      '#007ea9',
      '#006484',
      '#004a63',
    ],
    // Ledger gold: shade 4 accents the dark scheme, shade 7 the light one.
    violet: [
      '#fdf3e3',
      '#f8e5c4',
      '#f1d59c',
      '#ecc374',
      '#e3ac55', // dark-scheme gold
      '#cf9440',
      '#b57d2e',
      '#8f621f', // light-scheme gold
      '#6f4b17',
      '#4f3510',
    ],
    yellow: [
      '#fdf3e3',
      '#f8e5c4',
      '#f1d59c',
      '#ecc374',
      '#e3ac55',
      '#cf9440',
      '#b57d2e',
      '#8f621f',
      '#6f4b17',
      '#4f3510',
    ],
    // Ledger green-teal (#68dfcf on dark, #137665 on light).
    green: [
      '#e6faf6',
      '#c2f2ea',
      '#96e6d8',
      '#68dfcf',
      '#45cdb8',
      '#30b8a1',
      '#209a86',
      '#137665',
      '#0f5a4d',
      '#0a3f36',
    ],
    // Ledger red (#f58ba4 on dark, #b0395d on light).
    red: [
      '#fdeef2',
      '#f9dbe2',
      '#f3b8c6',
      '#ee8fa5',
      '#e66785',
      '#d6456b',
      '#c13a5e',
      '#b0395d',
      '#8a2c49',
      '#642037',
    ],
    // Dark-scheme surfaces/text: 0 = text, 2 = dimmed, 4 = border,
    // 5 = hover, 6 = paper, 7 = body background.
    dark: [
      '#edf7fc',
      '#c9dde9',
      '#a1b4c4',
      '#819aaa',
      '#1e4254',
      '#0b1c28',
      '#07131d',
      '#020609',
      '#050c12',
      '#010304',
    ],
    // Light-scheme grays tinted toward ice blue; 6 = dimmed (#445e72).
    gray: [
      '#f5faff',
      '#ecf4fa',
      '#e5f0f8',
      '#d3e3ee',
      '#b7cddc',
      '#9ab6c7',
      '#445e72',
      '#3a5266',
      '#2b4152',
      '#102d42',
    ],
  },
  components: {
    Button: {
      defaultProps: { fw: 500 },
    },
    Card: {
      defaultProps: { padding: 'lg', radius: 'md' },
    },
  },
});
