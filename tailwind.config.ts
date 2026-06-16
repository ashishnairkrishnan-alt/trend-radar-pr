import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pr-bg': '#F4F4F6',
        'pr-navy': '#0D1B3E',
        'pr-gold': '#C9A84C',
        'pr-cream': '#FAF6EE',
        'pr-text': '#1A2B4A',
        'pr-muted': '#8A94A6',
        'brand-chivas': '#F5A623',
        'brand-absolut': '#8A94A6',
        'brand-jameson': '#4CAF72',
        'brand-beefeater': '#E84855',
        'ig-pink': '#E1306C',
        'tt-black': '#010101',
      },
      fontFamily: {
        // Display / headings — matching Paid Media Dashboard
        'playfair': ['"Playfair Display"', 'Georgia', 'serif'],
        // Body / UI / metrics
        'dm-sans': ['"DM Sans"', 'system-ui', 'sans-serif'],
        // Aliases for convenience
        'serif': ['"Playfair Display"', 'Georgia', 'serif'],
        'sans': ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.12)',
        'header': '0 1px 0 0 rgba(255,255,255,0.06)',
      },
      letterSpacing: {
        'widest': '0.15em',
        'ultra': '0.2em',
      },
    },
  },
  plugins: [],
}

export default config
