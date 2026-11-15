import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // รูปภาพใน Flex Preview / Inbox มาจาก URL ภายนอกที่ผู้ใช้กำหนดเอง จึงใช้ <img> ปกติ
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Playwright fixture มีฟังก์ชันชื่อ use() ซึ่งไม่ใช่ React Hook
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/generated/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
