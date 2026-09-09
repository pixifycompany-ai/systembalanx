import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
      },
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        // Surfaces
        background: "hsl(var(--background))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
        },

        // Foreground
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          muted: "hsl(var(--foreground-muted))",
          subtle: "hsl(var(--foreground-subtle))",
        },

        // Borders / inputs
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Primary
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },

        // Semantic
        success: {
          DEFAULT: "hsl(var(--success))",
          bg: "hsl(var(--success-bg))",
          fg: "hsl(var(--success-fg))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          bg: "hsl(var(--danger-bg))",
          fg: "hsl(var(--danger-fg))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          bg: "hsl(var(--warning-bg))",
          fg: "hsl(var(--warning-fg))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          bg: "hsl(var(--info-bg))",
          fg: "hsl(var(--info-fg))",
          foreground: "hsl(var(--info-foreground))",
        },

        // Tag (categorias)
        tag: {
          pink: "hsl(var(--tag-pink))",
          orange: "hsl(var(--tag-orange))",
          amber: "hsl(var(--tag-amber))",
          green: "hsl(var(--tag-green))",
          teal: "hsl(var(--tag-teal))",
          blue: "hsl(var(--tag-blue))",
          violet: "hsl(var(--tag-violet))",
          fuchsia: "hsl(var(--tag-fuchsia))",
        },

        // Legacy aliases (mantém compatibilidade)
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        positive: {
          DEFAULT: "hsl(var(--positive))",
          muted: "hsl(var(--positive-muted))",
        },
        negative: {
          DEFAULT: "hsl(var(--negative))",
          muted: "hsl(var(--negative-muted))",
        },
        pending: {
          DEFAULT: "hsl(var(--pending))",
          muted: "hsl(var(--pending-muted))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },

      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        popover: "var(--shadow-popover)",
      },

      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "system-ui", "sans-serif"],
        heading: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "system-ui", "sans-serif"],
      },

      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "150ms",
        normal: "200ms",
        slow: "300ms",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "shimmer": "linear-gradient(90deg, transparent, hsl(var(--surface-2)) 50%, transparent)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
