export const fmt = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d);

export const fmtInt = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Math.round(v).toLocaleString();

export const chgArrow = (v: number | null | undefined): string =>
  v === null || v === undefined ? '•' : v > 0 ? '▲' : v < 0 ? '▼' : '•';

// Legacy convention: rising risk metrics are red, falling are green.
export const chgColor = (v: number | null | undefined): 'red' | 'green' | 'dimmed' =>
  v === null || v === undefined ? 'dimmed' : v > 0 ? 'red' : v < 0 ? 'green' : 'dimmed';

export const signed = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}`;

export const bandColor = (band: string): string => {
  switch (band) {
    case 'Low':
      return 'green';
    case 'Elevated':
      return 'yellow';
    case 'High':
      return 'orange';
    case 'Severe':
      return 'red';
    case 'Critical':
      return 'red';
    default:
      return 'gray';
  }
};

export const sourceColor = (status: string): string => {
  switch (status) {
    case 'ok':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'error':
    case 'unavailable':
      return 'red';
    default:
      return 'gray';
  }
};

export const catColor = (cat: string): string => {
  switch (cat) {
    case 'chokepoint':
      return 'red';
    case 'conflict':
      return 'orange';
    case 'oil-price':
      return 'amber';
    case 'opec':
      return 'violet';
    case 'sanctions':
      return 'cyan';
    default:
      return 'gray';
  }
};