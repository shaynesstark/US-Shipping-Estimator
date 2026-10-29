import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/index.js', import.meta.url),
  'utf8'
);

const exports = [
  'ShippingValidationError',
  'SERVICE_IDS',
  'calculateDimensionalWeight',
  'estimateShipping',
  'createShippingCalculator'
];

let output = source
  .replace(/^export class /gm, 'class ')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ');

output += `\nmodule.exports = { ${exports.join(', ')} };\n`;

writeFileSync(
  new URL('../src/index.cjs', import.meta.url),
  output
);

console.log('Generated src/index.cjs');
