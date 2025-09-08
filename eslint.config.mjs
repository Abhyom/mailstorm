import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		rules: {
			"@typescript-eslint/no-unused-vars": "off", // Ignore unused variables
			"@typescript-eslint/no-explicit-any": "off", // Ignore explicit any type
			"react/no-unescaped-entities": "off", // Ignore unescaped entities
			"react-hooks/exhaustive-deps": "warn", // Downgrade missing dependency warning to warn
		},
	},
];

export default eslintConfig;
