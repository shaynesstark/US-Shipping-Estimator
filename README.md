# US Shipping Estimator

A lightweight, dependency-free JavaScript library for estimating
domestic United States parcel shipping costs.

Supports USPS Ground Advantage, UPS Ground, and FedEx Ground
illustrative rate profiles.

## Features

- Domestic US shipping only
- Actual and dimensional weight calculations
- Pounds, ounces, kilograms, and grams
- Inches, centimeters, and millimeters
- Configurable shipping zones
- Custom carrier rate models
- Handling fees and insurance
- Percentage-based markup
- Detailed cost breakdowns
- ES modules, TypeScript, and framework integration

## Requirements

Node.js 18 or newer.

## Installation

Clone the repository and install it locally:

```bash
npm install /path/to/us-shipping-estimator
```

Or import the source directly:

```javascript
import { estimateShipping } from './src/index.js';
```

## Quick start

```javascript
import { estimateShipping } from 'us-shipping-estimator';

const result = estimateShipping(
    {
        weight: 2.5,
        length: 14,
        width: 10,
        height: 6,
    },
    {
        zone: 5,
    },
);

console.log(result.cheapest);
```

## Parcel properties

| Property      | Type   | Default  |
| ------------- | ------ | -------- |
| weight        | number | Required |
| length        | number | Required |
| width         | number | Required |
| height        | number | Required |
| weightUnit    | string | lb       |
| dimensionUnit | string | in       |

All numerical measurements must be positive.

## Shipping options

| Property       | Description                    |
| -------------- | ------------------------------ |
| originZip      | Origin US ZIP                  |
| destinationZip | Destination US ZIP             |
| zone           | Shipping zone 1–9              |
| zoneResolver   | Custom synchronous zone lookup |
| serviceIds     | Services to compare            |
| services       | Rate configuration overrides   |
| handlingFee    | Flat USD handling fee          |
| insuranceFee   | Flat USD insurance fee         |
| markupPercent  | Percentage markup              |

ZIP codes are validated but do not automatically determine zones.

If no zone is supplied, zone 5 is assumed.

## Dimensional weight

The calculator uses package dimensions to calculate dimensional
weight.

Conceptually:

Dimensional weight = length × width × height / divisor

The carrier's dimensional weight and actual weight determine
billable weight.

Service-specific rules and rounding are configurable.

## Custom rates

```javascript
const result = estimateShipping(
    {
        weight: 3,
        length: 12,
        width: 10,
        height: 8,
    },
    {
        zone: 6,
        services: {
            'ups-ground': {
                base: 9.5,
                perLb: 1.15,
                zoneStep: 1.2,
                fuelPercent: 5,
            },
        },
    },
);
```

## Basic HTML, CSS, and JavaScript

Import the JavaScript module using a module script.

```html
<form id="shipping-form">
    <input id="weight" type="number" step="any" placeholder="Weight (lb)" required />
    <input id="length" type="number" step="any" placeholder="Length (in)" required />
    <input id="width" type="number" step="any" placeholder="Width (in)" required />
    <input id="height" type="number" step="any" placeholder="Height (in)" required />
    <button type="submit">Calculate</button>
</form>

<p id="result"></p>

<script type="module">
    import { estimateShipping } from './src/index.js';

    document.querySelector('#shipping-form').addEventListener('submit', (event) => {
        event.preventDefault();

        const value = (id) => Number(document.getElementById(id).value);

        try {
            const result = estimateShipping({
                weight: value('weight'),
                length: value('length'),
                width: value('width'),
                height: value('height'),
            });

            document.getElementById('result').textContent = `Estimated shipping: $${result.cheapest.estimatedTotal.toFixed(2)}`;
        } catch (error) {
            document.getElementById('result').textContent = error.message;
        }
    });
</script>
```

Serve the site through an HTTP development server rather than
opening the HTML file directly.

## React

```jsx
import { useState } from 'react';
import { estimateShipping } from 'us-shipping-estimator';

export default function ShippingCalculator() {
    const [result, setResult] = useState(null);

    function calculate() {
        const estimate = estimateShipping(
            {
                weight: 2,
                length: 12,
                width: 10,
                height: 8,
            },
            {
                zone: 5,
            },
        );

        setResult(estimate);
    }

    return (
        <div>
            <button onClick={calculate}>Calculate shipping</button>
            {result && <p>${result.cheapest.estimatedTotal.toFixed(2)}</p>}
        </div>
    );
}
```

## Vue 3

```vue
<script setup>
    import { ref } from 'vue';
    import { estimateShipping } from 'us-shipping-estimator';

    const result = ref(null);

    function calculate() {
        result.value = estimateShipping(
            {
                weight: 2,
                length: 12,
                width: 10,
                height: 8,
            },
            {
                zone: 5,
            },
        );
    }
</script>

<template>
    <button @click="calculate">Calculate shipping</button>
    <p v-if="result">${{ result.cheapest.estimatedTotal.toFixed(2) }}</p>
</template>
```

## Testing

```bash
npm test
```

## Important pricing limitations

The included rates are illustrative and are not official
USPS, UPS, or FedEx prices.

Shipping estimates may differ from actual costs because of:

- Shipping zones and negotiated rates
- Residential delivery fees
- Delivery area surcharges
- Fuel surcharges
- Oversized package fees
- Peak-season pricing
- Carrier-specific rounding and dimensional-weight rules

For production checkout, configure accurate rates and
a reliable shipping-zone resolver or integrate a live
carrier rate service.

## License

MIT License. See LICENSE for details.
