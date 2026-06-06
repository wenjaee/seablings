import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "ios/**",
    "supabase/**",
    "graphify-out/**",
    "gitnexus-out/**",
    ".gitnexus/**"
  ]),
  ...nextVitals
];

export default eslintConfig;
