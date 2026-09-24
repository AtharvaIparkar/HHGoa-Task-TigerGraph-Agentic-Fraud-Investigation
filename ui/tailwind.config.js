/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  // Dark mode is the default for this ops console
  darkMode: 'class',

  theme: {
    extend: {
      // ── Brand palette ────────────────────────────────────────────────────
      colors: {
        // Background layers (dark ops console)
        surface: {
          950: '#0b0f19',   // deepest background
          900: '#0f172a',   // slate-900 — page bg
          800: '#1e293b',   // slate-800 — card bg
          700: '#334155',   // slate-700 — subtle borders
          600: '#475569',   // slate-600 — muted text
        },

        // Primary accent — cyan (TigerGraph-inspired)
        cyan: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },

        // Secondary accent — amber (alerts, warnings, SAR)
        amber: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        // Risk / severity colours
        risk: {
          low:      '#22c55e',   // green-500
          medium:   '#f59e0b',   // amber-500
          high:     '#ef4444',   // red-500
          critical: '#7c3aed',   // violet-600
        },

        // Decision colours
        decision: {
          clear:          '#22c55e',
          suspicious:     '#f59e0b',
          fraud:          '#ef4444',
          confirmed_fraud:'#7c3aed',
          pending:        '#64748b',
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ── Borders & shadows ─────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },

      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-amber':  '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-red':    '0 0 20px rgba(239, 68, 68, 0.3)',
        'card':        '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
      },

      // ── Animations ────────────────────────────────────────────────────────
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':      'fadeIn 0.3s ease-in-out',
        'slide-up':     'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
      },
    },
  },

  plugins: [],
}
