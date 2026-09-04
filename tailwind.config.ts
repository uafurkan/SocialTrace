import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
          elevated: "var(--surface-elevated)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        inverse: "var(--text-inverse)",
        brand: {
          DEFAULT: "var(--brand)",
          strong: "var(--brand-strong)",
          soft: "var(--brand-soft)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
        avatar: {
          "1-bg": "var(--avatar-1-bg)",
          "1-fg": "var(--avatar-1-fg)",
          "2-bg": "var(--avatar-2-bg)",
          "2-fg": "var(--avatar-2-fg)",
          "3-bg": "var(--avatar-3-bg)",
          "3-fg": "var(--avatar-3-fg)",
          "4-bg": "var(--avatar-4-bg)",
          "4-fg": "var(--avatar-4-fg)",
          "5-bg": "var(--avatar-5-bg)",
          "5-fg": "var(--avatar-5-fg)",
          "6-bg": "var(--avatar-6-bg)",
          "6-fg": "var(--avatar-6-fg)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        button: "var(--radius-button)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        modal: "var(--radius-modal)",
      },
      boxShadow: {
        default: "var(--shadow-default)",
        elevated: "var(--shadow-elevated)",
      },
      spacing: {
        18: "4.5rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
