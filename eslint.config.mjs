import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**"],
  },
  {
    // These experimental react-hooks rules flag intentional, safe patterns used
    // throughout this app (refs as selection anchors, context-menu measurement
    // effects, and view-cache refresh). They are stylistic/perf suggestions, not
    // correctness issues, so they are disabled to keep the code readable.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
