import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Roboto', 'Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      colors: {
        // Cores Corporativas Oficiais DFT (Dafiti) - acessíveis como bg-dft-teal, text-dft-teal, bg-dft-purple, etc.
        'dft-teal': 'var(--dft-teal, var(--color-dft-teal, oklch(0.73 0.13 185)))',
        'dft-teal-hover': 'var(--dft-teal-hover, var(--color-dft-teal-hover, oklch(0.67 0.135 185)))',
        'dft-teal-light': 'var(--dft-teal-light, var(--color-dft-teal-light, oklch(0.82 0.10 190)))',
        'dft-teal-dark': 'var(--dft-teal-dark, var(--color-dft-teal-dark, oklch(0.50 0.11 185)))',
        'dft-purple': 'var(--dft-purple, var(--color-dft-purple, oklch(0.55 0.25 280)))',
        'dft-coral': 'var(--dft-coral, var(--color-dft-coral, oklch(0.66 0.22 36)))',
        'dft-black': 'var(--dft-black, var(--color-dft-black, oklch(0.12 0.005 240)))',
        'dft-white': 'var(--dft-white, var(--color-dft-white, oklch(1 0 0)))',
        'dft-gray-100': 'var(--dft-gray-100, var(--color-dft-gray-100, oklch(0.9761 0.002 185)))',
        'dft-gray-200': 'var(--dft-gray-200, var(--color-dft-gray-200, oklch(0.9431 0.004 185)))',
        'dft-gray-300': 'var(--dft-gray-300, var(--color-dft-gray-300, oklch(0.8452 0.006 185)))',
        'dft-gray-400': 'var(--dft-gray-400, var(--color-dft-gray-400, oklch(0.6268 0.008 185)))',
        'dft-gray-500': 'var(--dft-gray-500, var(--color-dft-gray-500, oklch(0.5103 0.008 185)))',
        'dft-gray-600': 'var(--dft-gray-600, var(--color-dft-gray-600, oklch(0.2972 0.008 185)))',
        'dft-gray-700': 'var(--dft-gray-700, var(--color-dft-gray-700, oklch(0.22 0.008 185)))',
        'dft-gray-800': 'var(--dft-gray-800, var(--color-dft-gray-800, oklch(0.16 0.008 185)))',
        'dft-gray-900': 'var(--dft-gray-900, var(--color-dft-gray-900, oklch(0.10 0.008 185)))',

        // Objeto aninhado dft - acessível como bg-dft-teal, bg-dft-purple, bg-dft-gray-500, etc.
        dft: {
          DEFAULT: 'var(--dft-teal, var(--color-dft-teal, oklch(0.73 0.13 185)))',
          teal: {
            DEFAULT: 'var(--dft-teal, var(--color-dft-teal, oklch(0.73 0.13 185)))',
            hover: 'var(--dft-teal-hover, var(--color-dft-teal-hover, oklch(0.67 0.135 185)))',
            light: 'var(--dft-teal-light, var(--color-dft-teal-light, oklch(0.82 0.10 190)))',
            dark: 'var(--dft-teal-dark, var(--color-dft-teal-dark, oklch(0.50 0.11 185)))',
          },
          purple: 'var(--dft-purple, var(--color-dft-purple, oklch(0.55 0.25 280)))',
          coral: 'var(--dft-coral, var(--color-dft-coral, oklch(0.66 0.22 36)))',
          black: 'var(--dft-black, var(--color-dft-black, oklch(0.12 0.005 240)))',
          white: 'var(--dft-white, var(--color-dft-white, oklch(1 0 0)))',
          gray: {
            100: 'var(--dft-gray-100, var(--color-dft-gray-100, oklch(0.9761 0.002 185)))',
            200: 'var(--dft-gray-200, var(--color-dft-gray-200, oklch(0.9431 0.004 185)))',
            300: 'var(--dft-gray-300, var(--color-dft-gray-300, oklch(0.8452 0.006 185)))',
            400: 'var(--dft-gray-400, var(--color-dft-gray-400, oklch(0.6268 0.008 185)))',
            500: 'var(--dft-gray-500, var(--color-dft-gray-500, oklch(0.5103 0.008 185)))',
            600: 'var(--dft-gray-600, var(--color-dft-gray-600, oklch(0.2972 0.008 185)))',
            700: 'var(--dft-gray-700, var(--color-dft-gray-700, oklch(0.22 0.008 185)))',
            800: 'var(--dft-gray-800, var(--color-dft-gray-800, oklch(0.16 0.008 185)))',
            900: 'var(--dft-gray-900, var(--color-dft-gray-900, oklch(0.10 0.008 185)))',
          },
          danger: 'var(--dft-coral, var(--color-destructive, oklch(0.65 0.22 36)))',
        },

        // Variáveis Semânticas do Tema
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) * 0.8)',
        sm: 'calc(var(--radius) * 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
