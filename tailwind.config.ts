import type { Config } from "tailwindcss";

/* ─────────────────────────────────────────────────────────────────────────────
   Roof HR — "Docs"

   The palette overrides below are the cheap half of the brand migration. There
   were 406 `red-*` utility uses across 11 shades and ~1,000 `gray-*` uses, and
   codemodding every call site would have been a thousand chances to break a
   layout for no visual gain. Instead the two ramps are RETONED here: every
   existing `bg-red-600`, `text-red-500`, `dark:bg-gray-800` keeps working and
   starts rendering in the Roof-ER palette.

   `red` is generated in OKLCH from #B60807 (held exactly at 600) so the ramp is
   perceptually even rather than eyeballed. `gray` is the slate-biased neutral
   set from ~/roofdocs-site/PICKUP.md — the old Tailwind gray is blue (#1f2937
   is hue ~215deg), which contradicted the dark theme's own stated intent 51
   times in `dark:bg-gray-800` alone.

   Every shade used as text passes WCAG AA on its expected ground. The 500 stops
   are deliberately darker than a purely even ramp would put them, because
   `text-red-500` and `text-gray-500` are real patterns in this codebase and the
   even values landed at 4.06:1 and 4.23:1.
   ───────────────────────────────────────────────────────────────────────── */

// on white / on ink #0a0b0c
const brandRed = {
  50: "#fff0ec",   // 1.11
  100: "#ffdfd8",  // 1.25
  200: "#ffc3b8",  // 1.53
  300: "#ff9c8c",  // 2.02
  400: "#fc6a5a",  // 2.86 / 6.89  <- the dark-mode text red
  500: "#d6372c",  // 4.73 / 4.17
  600: "#b60807",  // 6.94 / 2.84  <- the brand red, exactly
  700: "#a20e0a",  // 8.07
  800: "#880806",  // 10.08
  900: "#750403",  // 11.83
  950: "#4a0000",  // 16.26
};

// on white / on ink-2 #101315
const slate = {
  50: "#f6f8f9",
  100: "#eceff1",
  200: "#dde1e3",
  300: "#c9cfd3",  //        / 11.86
  400: "#949ba1",  //        / 6.63
  500: "#6b7279",  // 4.87
  600: "#575e64",  // 6.58
  700: "#3f464b",  // 9.59
  800: "#282d31",
  900: "#181b1e",
  950: "#0a0b0c",
};

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      colors: {
        red: brandRed,
        rose: brandRed,
        gray: slate,
        slate: slate,
        zinc: slate,
        neutral: slate,
        stone: slate,
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        // The four semantic roles. Anything status-coloured should reach for
        // these rather than a raw palette shade, so light and dark stay in sync.
        positive: {
          DEFAULT: "var(--positive)",
          foreground: "var(--positive-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        // Red as TEXT. Resolves to #B60807 on light (6.94:1) and #F0444C on
        // dark (5.01:1), because the brand red is 2.70:1 on the dark ground and
        // must never be small text there.
        "brand-ink": "var(--brand-ink)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
