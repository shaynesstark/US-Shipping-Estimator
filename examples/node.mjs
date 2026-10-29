import { estimateShipping } from '../src/index.js';

const result = estimateShipping(
    {
        weight: 2.5,
        length: 14,
        width: 10,
        height: 6,
    },
    {
        originZip: '11103',
        destinationZip: '90210',
        zone: 8,
        handlingFee: 1.5,
    },
);

console.table(
    result.quotes.map((q) => ({
        service: q.label,
        estimatedUSD: q.available ? q.estimatedTotal : 'unavailable',
    })),
);

console.log('Note:', result.disclaimer);
