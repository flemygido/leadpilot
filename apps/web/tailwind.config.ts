import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
      },
    },
  },
  plugins: [],
};

export default config;
