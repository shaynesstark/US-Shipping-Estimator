import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateDimensionalWeight, estimateShipping, createShippingCalculator, ShippingValidationError } from '../src/index.js';

const parcel = {
    weight: 2,
    length: 12,
    width: 9,
    height: 6,
};

test('quotes sorted by price, all US and USD', () => {
    const result = estimateShipping(parcel, { zone: 4 });

    assert.equal(result.quotes.length, 3);
    assert.equal(result.currency, 'USD');
    assert.equal(result.zoneAssumed, false);

    assert.ok(result.quotes[0].estimatedTotal <= result.quotes[1].estimatedTotal);
});

test('dimensional weight drives billable weight', () => {
    const result = estimateShipping(
        {
            weight: 1,
            length: 20,
            width: 20,
            height: 20,
        },
        { zone: 5 },
    );

    assert.equal(result.cheapest.billableWeightLb, Math.ceil(8000 / 139));
});

test('dimensional threshold can exclude small USPS parcels', () => {
    const result = calculateDimensionalWeight(parcel, { thresholdCubicIn: 1728 });

    assert.equal(result.dimensionalWeightLb, 0);
});

test('metric converts consistently', () => {
    const original = estimateShipping(parcel, { zone: 4 });

    const metric = estimateShipping(
        {
            weight: 2 * 0.45359237,
            weightUnit: 'kg',
            length: 12 * 2.54,
            width: 9 * 2.54,
            height: 6 * 2.54,
            dimensionUnit: 'cm',
        },
        { zone: 4 },
    );

    assert.equal(original.cheapest.estimatedTotal, metric.cheapest.estimatedTotal);
});

test('service limits excluded', () => {
    const result = estimateShipping(
        {
            weight: 100,
            length: 10,
            width: 10,
            height: 10,
        },
        { zone: 2 },
    );

    assert.equal(result.quotes.find((quote) => quote.id === 'usps-ground').available, false);
});

test('domestic validation and ZIP validation', () => {
    assert.throws(() => estimateShipping(parcel, { destinationCountry: 'CA' }), ShippingValidationError);

    assert.throws(() => estimateShipping(parcel, { originZip: '021' }), ShippingValidationError);
});

test('custom pricing and fees', () => {
    const result = estimateShipping(parcel, {
        zone: 2,
        serviceIds: ['ups-ground'],
        handlingFee: 3,
        insuranceFee: 2,
        markupPercent: 10,
        services: {
            'ups-ground': {
                base: 10,
                perLb: 1,
                zoneStep: 2,
                fuelPercent: 5,
            },
        },
    });

    assert.equal(result.cheapest.breakdown.handling, 3);

    assert.equal(result.cheapest.breakdown.markup, 2.29);
});

test('zone resolver and assumed fallback', () => {
    assert.equal(estimateShipping(parcel).zoneAssumed, true);

    assert.equal(
        estimateShipping(parcel, {
            originZip: '11103',
            destinationZip: '10001',
            zoneResolver: () => 2,
        }).zone,
        2,
    );
});

test('factory defaults overridable', () => {
    const calculator = createShippingCalculator({
        zone: 8,
        serviceIds: ['usps-ground'],
    });

    assert.equal(calculator.estimate(parcel).zone, 8);

    assert.equal(calculator.estimate(parcel, { zone: 3 }).zone, 3);
});

test('rejects async resolver and bad values', () => {
    assert.throws(() => estimateShipping(parcel, { zoneResolver: async () => 4 }), ShippingValidationError);

    assert.throws(() => estimateShipping({ ...parcel, weight: 0 }), ShippingValidationError);
});
