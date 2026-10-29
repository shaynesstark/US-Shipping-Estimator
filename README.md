# US Shipping Estimator

A configurable JavaScript library for estimating domestic US
shipping costs automatically from origin and destination ZIP codes,
package weight, and dimensions.

Supports HTML/JavaScript, React, Vue, Node.js, and TypeScript.

## Features

- Configure the origin ZIP in your application
- Customers provide only their destination ZIP
- Automatic ZIP-code location lookup
- Approximate shipping-distance calculations
- No manual shipping-zone input
- USPS, UPS, and FedEx illustrative service profiles
- Actual and dimensional weight calculations
- Metric and imperial measurements
- Configurable rate tables, handling fees, and markup
- ZIP lookup caching
- No API key required for ZIP lookup

## Requirements

- Node.js 18+ or a modern web browser
- Internet connection for ZIP lookup
- Access to the Zippopotam.us API

## Installation

Install from the local project:

```bash
npm install us-shipping-estimator
```

Or import directly from the source.

## Quick start

```javascript
import { createShippingCalculator } from 'us-shipping-estimator';

const shipping = createShippingCalculator({
    originZip: '10017',
});

const estimate = await shipping.estimate(
    {
        weight: 3,
        length: 12,
        width: 10,
        height: 8,
    },
    {
        destinationZip: '90210',
    },
);

console.log(estimate.cheapest);
```

## Configuring the origin ZIP

Set the origin once when initializing the calculator.

```javascript
const shipping = createShippingCalculator({
    originZip: '10001',
});
```

The customer never needs to enter the origin ZIP.

## Package measurements

| Property      | Description    | Default  |
| ------------- | -------------- | -------- |
| weight        | Package weight | Required |
| length        | Longest side   | Required |
| width         | Second side    | Required |
| height        | Third side     | Required |
| weightUnit    | lb, oz, kg, g  | lb       |
| dimensionUnit | in, cm, mm     | in       |

All measurements must be positive numbers.

## HTML and JavaScript

Import the module in a script with type="module":

```javascript
import { createShippingCalculator } from './src/index.js';

const shipping = createShippingCalculator({
    originZip: '10017',
});

async function calculate(destinationZip, parcel) {
    return await shipping.estimate(parcel, { destinationZip });
}
```

See `examples/vanilla/index.html` for a complete form.

## React

Create the calculator outside your component:

```jsx
import { createShippingCalculator } from 'us-shipping-estimator';

const shipping = createShippingCalculator({
    originZip: '10017',
});

async function calculateShipping(parcel, destinationZip) {
    return await shipping.estimate(parcel, { destinationZip });
}
```

Call this inside an async event handler and store the
result in React state.

See `examples/react/ShippingCalculator.jsx`.

## Vue 3

```javascript
import { createShippingCalculator } from 'us-shipping-estimator';

const shipping = createShippingCalculator({
    originZip: '10017',
});

const estimate = await shipping.estimate(
    {
        weight: 2,
        length: 12,
        width: 10,
        height: 8,
    },
    {
        destinationZip: '90210',
    },
);
```

See `examples/vue/ShippingCalculator.vue`.

## Automatic distance calculation

The calculator:

1. Looks up the origin ZIP coordinates.
2. Looks up the destination ZIP coordinates.
3. Calculates straight-line distance using the Haversine formula.
4. Maps the distance to an approximate cost band.
5. Applies configured service pricing.
6. Returns estimates ranked by cost.

ZIP lookup data comes from Zippopotam.us.

The returned distance is approximate straight-line distance,
not road distance or carrier transport distance.

## Important accuracy limitations

The automatic distance bands are NOT official shipping zones.

Actual USPS, UPS, and FedEx zone assignments may depend on
carrier-specific ZIP-pair tables, routing networks, shipping
services, and exceptions.

The included shipping prices are illustrative and are NOT
official carrier rates.

The current model does not fully account for:

- Carrier-specific zone charts
- Alaska, Hawaii, and territorial rate exceptions
- Residential and rural delivery surcharges
- Fuel adjustments
- Peak-season surcharges
- Large package handling charges
- Negotiated shipping contracts
- Service availability by destination

Do not use illustrative estimates as guaranteed checkout
shipping prices.

For production billing, integrate official carrier rates
or licensed carrier zone tables.

## Custom pricing

```javascript
const shipping = createShippingCalculator({
    originZip: '10017',
    handlingFee: 2,
    insuranceFee: 1,
    markupPercent: 5,
    services: {
        'ups-ground': {
            base: 9.5,
            perLb: 1.15,
            zoneStep: 1.2,
            fuelPercent: 5,
        },
    },
});
```

The `zoneStep` setting is a rate-model parameter for
automatically computed distance bands, not an input
for manually selected carrier zones.

## Error handling

```javascript
try {
    const result = await shipping.estimate(parcel, { destinationZip });
    console.log(result);
} catch (error) {
    console.error(error.message);
}
```

Invalid ZIP codes and network lookup failures produce errors
instead of silently assuming a default location or zone.

## Testing

```bash
npm run build
npm test
npm run demo
```

Automated tests use a mocked ZIP lookup so tests do not
depend on an active network connection.

## Licensing

MIT License. See LICENSE.
