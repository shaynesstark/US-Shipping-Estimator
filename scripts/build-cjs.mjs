import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const sourcePath = join(root, 'src', 'index.js');
const outputPath = join(root, 'src', 'index.cjs');

// Read the ES module implementation.
const source = readFileSync(sourcePath, 'utf8');

// Public exports supported by the shipping calculator.
const exports = ['ShippingValidationError', 'ShippingLookupError', 'SERVICE_IDS', 'calculateDimensionalWeight', 'createShippingCalculator'];

// Convert named ES module exports into CommonJS declarations.
let output = source
    .replace(/^export\s+class\s+/gm, 'class ')
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+async\s+function\s+/gm, 'async function ');

// Add the CommonJS export declaration.
output += `

module.exports = {
  ${exports.join(',\n  ')}
};
`;

// Write the generated CommonJS implementation.
writeFileSync(outputPath, output, 'utf8');

console.log('Successfully generated src/index.cjs');
console.log(`Exported: ${exports.join(', ')}`);
