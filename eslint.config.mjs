import ts from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import html from "eslint-plugin-html";

export default ts.config(
  // Use recommended TypeScript rules
  ...ts.configs.recommended,

  {
    // Apply HTML plugin to .html files
    files: ["**/*.html"],
    plugins: { html },
  },

  {
    // General project rules
    rules: {
      "no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
    },
  },

  // Must be last: disables ESLint rules that conflict with Prettier
  prettierConfig
);
