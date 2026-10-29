import type { Config } from "tailwindcss";

/**
 * Tailwind 仅用于布局工具类（flex/grid/gap/宽高/文本截断）。
 * 颜色、阴影、圆角等视觉语义一律走 src/styles/tokens.scss 设计令牌，禁止在模板中直接使用。
 */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        primary: "var(--app-primary)",
        "text-1": "var(--app-text-1)",
        "text-2": "var(--app-text-2)",
        "text-3": "var(--app-text-3)"
      }
    }
  }
} satisfies Config;
