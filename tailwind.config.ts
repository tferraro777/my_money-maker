import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        clemson: {
          orange: '#F56600',
          purple: '#522D80',
          diploma: '#2E1A47',
          avenue: '#333333',
          goal: '#FFFFFF',
          stadium: '#CBC4BC'
        }
      }
    }
  },
  plugins: []
};

export default config;
