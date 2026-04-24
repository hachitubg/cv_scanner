import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "generated/**",
      "prisma/dev.db",
      "prisma/migrations/**",
    ],
  },
];

export default config;
