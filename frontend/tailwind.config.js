/** @type {import('tailwindcss').Config} */
export default {
  // Scan alle React-bestanden op gebruikte klassen
  content: ['./index.html', './src/**/*.{js,jsx}'],

  // Donkere modus via een CSS-klasse op <html> (handmatig aanstuurbaar)
  darkMode: 'class',

  theme: {
    extend: {
      // ── Transpo-Nuth kleurenpalet ──────────────────────────────────────────
      colors: {
        // Achtergronden
        app: {
          bg:       '#070C18',   // Diep donker-navy (hoofd-achtergrond)
          surface:  '#0D1526',   // Iets lichter voor kaarten
          elevated: '#131E35',   // Verhoogde kaarten / modals
        },
        // Primair merk
        merk: {
          DEFAULT: '#1A3C6E',
          licht:   '#2A5BA8',
          donker:  '#0F2447',
        },
        // Accent-oranje (CTA's, badges)
        accent: {
          DEFAULT: '#F97316',
          licht:   '#FB923C',
          donker:  '#EA6B0A',
        },
        // Glassmorphism-oppervlak
        glas: {
          wit:   'rgba(255,255,255,0.06)',
          rand:  'rgba(255,255,255,0.10)',
          hover: 'rgba(255,255,255,0.10)',
        },
        // Status-kleuren
        status: {
          succes:    '#22C55E',
          waarschuwing: '#EAB308',
          gevaar:    '#EF4444',
          info:      '#3B82F6',
        },
      },

      // ── Typografie ─────────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        mono:  ['SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Grote aanraakdoelen conform mobile-first richtlijnen
        'aanraken': ['1.0625rem', { lineHeight: '1.5', fontWeight: '500' }],
      },

      // ── Schaduwen (premium, zachte gloed) ─────────────────────────────────
      boxShadow: {
        'glas':      '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glas-lg':   '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
        'accent':    '0 0 20px rgba(249,115,22,0.35)',
        'accent-sm': '0 0 10px rgba(249,115,22,0.25)',
        'opgeheven': '0 20px 60px rgba(0,0,0,0.5)',
      },

      // ── Achtergrond-vervaging (glassmorphism) ─────────────────────────────
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '60px',
      },

      // ── Animatietijden (Framer Motion wordt primair gebruikt, maar ook Tailwind) ──
      transitionDuration: {
        250: '250ms',
        400: '400ms',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },

      // ── Afgeronde hoeken (iOS-stijl) ──────────────────────────────────────
      borderRadius: {
        '2.5xl': '1.25rem',
        '3xl':   '1.5rem',
        '4xl':   '2rem',
      },

      // ── Minimale aanraakdoelgroottes (WCAG + mobile UX) ──────────────────
      minHeight: {
        'touch': '48px',  // Google Material minimum
        'touch-lg': '56px',
      },
      minWidth: {
        'touch': '48px',
      },
    },
  },

  plugins: [
    // Glassmorphism-hulpklassen als Tailwind-plugin
    function ({ addUtilities }) {
      addUtilities({
        '.glas-kaart': {
          'background': 'rgba(255,255,255,0.05)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'border': '1px solid rgba(255,255,255,0.08)',
          'box-shadow': '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        },
        '.glas-kaart-hover': {
          'background': 'rgba(255,255,255,0.08)',
          'border-color': 'rgba(255,255,255,0.14)',
        },
        '.glas-nav': {
          'background': 'rgba(7,12,24,0.85)',
          'backdrop-filter': 'blur(30px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(30px) saturate(180%)',
          'border-top': '1px solid rgba(255,255,255,0.07)',
        },
        // Grote aanraakdoelen voor mobiel
        '.touch-doelwit': {
          'min-height': '48px',
          'min-width': '48px',
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        },
        // Veilige zone onderaan voor iPhones / Android met navigatiebalk
        '.veilige-zone-onder': {
          'padding-bottom': 'max(env(safe-area-inset-bottom), 16px)',
        },
      });
    },
  ],
};
