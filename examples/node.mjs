import { createShippingCalculator } from '../src/index.js';

// Configure the shipping origin once.
const shipping = createShippingCalculator({
    originZip: '11103',
    handlingFee: 1.5,
});

async function main() {
    const estimate = await shipping.estimate(
        {
            weight: 2.5,
            length: 14,
            width: 10,
            height: 6,
        },
        {
            destinationZip: '90210',
        },
    );

    console.log(`Shipping from ${estimate.originZip} to ${estimate.destinationZip}`);

    console.log(`Approximate distance: ${estimate.distanceMiles} miles`);

    console.table(
        estimate.quotes.map((quote) => ({
            service: quote.label,
            estimate: quote.available ? `$${quote.estimatedTotal.toFixed(2)}` : 'Unavailable',
        })),
    );

    console.log(estimate.disclaimer);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
