import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Chart.js-ийн тохиргоо, ArcGIS-ийн объектууд дээр прагматик байдлаар any ашиглана
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  { ignores: ['out/**', '.next/**', 'node_modules/**'] }
];

export default eslintConfig;
