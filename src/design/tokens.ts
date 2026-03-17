export const tokens = {
  color: {
    bg: '#000000',
    surface: '#090909',
    surfaceElevated: '#131313',
    panel: '#171010',
    primary: '#ff6268',
    primaryHover: '#e5575d',
    primaryActive: '#cc4d53',
    text: '#f7efef',
    textMuted: '#d3b7b8',
    border: 'rgba(255, 98, 104, 0.24)',
    borderStrong: 'rgba(255, 98, 104, 0.5)',
    success: '#52d67f',
    warn: '#ffb454',
    danger: '#ff6268'
  },
  radius: {
    sm: '10px',
    md: '16px',
    lg: '24px',
    pill: '999px'
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    xxl: '2rem'
  },
  shadow: {
    glow: '0 0 0 1px rgba(255, 98, 104, 0.1), 0 20px 60px rgba(255, 98, 104, 0.1)',
    inset: 'inset 0 1px 0 rgba(255,255,255,0.04)'
  },
  typography: {
    display: '"Space Grotesk", "Segoe UI", sans-serif',
    body: '"Inter", "Segoe UI", sans-serif'
  }
} as const;
