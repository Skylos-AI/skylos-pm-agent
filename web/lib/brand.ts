export const brand = {
  name: 'Skylos',
  website: 'https://skylos.solutions',
  logo: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/skylos-logo.svg`,
  headingFont: 'Winner Sans',
  bodyFont: 'Geist',
  colors: {
    background: '#F2F4F7',
    foreground: '#1A202C',
    blue:       '#2D5BFF',
    magenta:    '#E536A8',
    cyan:       '#29D6E5',
    gradient:   'linear-gradient(115deg, #2D5BFF 0%, #E536A8 50%, #29D6E5 100%)',
  },
  contact: {
    calendlyUrl: 'https://calendly.com/agency-skylos-solutions/30min',
    email: 'agency@skylos.solutions',
  },
} as const;
