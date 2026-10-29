import test from 'node:test';
import assert from 'node:assert/strict';

import { createShippingCalculator, calculateDimensionalWeight, ShippingValidationError, ShippingLookupError } from '../src/index.js';

const locations = {
    11103: {
        latitude: '40.7644',
        longitude: '-73.9235',
        name: 'Astoria',
        state: 'NY',
    },
    90210: {
        latitude: '34.0901',
        longitude: '-118.4065',
        name: 'Beverly Hills',
        state: 'CA',
    },
    10001: {
        latitude: '40.7506',
        longitude: '-73.9972',
        name: 'New York',
        state: 'NY',
    },
};

function mockFetch(url) {
    const zip = url.split('/').pop();
    const place = locations[zip];

    if (!place) {
        return Promise.resolve({
            ok: false,
            status: 404,
        });
    }

    return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
            places: [
                {
                    latitude: place.latitude,
                    longitude: place.longitude,
                    'place name': place.name,
                    'state abbreviation': place.state,
                },
            ],
        }),
    });
}

const parcel = {
    weight: 2,
    length: 12,
    width: 9,
    height: 6,
};

const create = (options) =>
    createShippingCalculator({
        originZip: '11103',
        fetch: mockFetch,
        ...options,
    });

test('origin is configured in code', () => {
    const calculator = create();
    assert.equal(calculator.originZip, '11103');
});

test('requires a configured origin', () => {
    assert.throws(() => createShippingCalculator(), ShippingValidationError);
});

test('automatically estimates distance', async () => {
    const result = await create().estimate(parcel, { destinationZip: '90210' });

    assert.ok(result.distanceMiles > 2000);
    assert.equal(result.destinationZip, '90210');
});

test('no manual zone input is required', async () => {
    const result = await create().estimate(parcel, { destinationZip: '10001' });

    assert.ok(result.cheapest);
    assert.equal(result.currency, 'USD');
    assert.equal('zone' in result, false);
});

test('quotes are ordered by price', async () => {
    const result = await create().estimate(parcel, { destinationZip: '90210' });

    const totals = result.quotes.filter((q) => q.available).map((q) => q.estimatedTotal);

    assert.deepEqual(
        totals,
        [...totals].sort((a, b) => a - b),
    );
});

test('dimensional weight is calculated', () => {
    const result = calculateDimensionalWeight({
        weight: 1,
        length: 20,
        width: 20,
        height: 20,
    });

    assert.equal(result.dimensionalWeightLb, Math.ceil(8000 / 139));
});

test('metric measurements are supported', async () => {
    const calculator = create();

    const imperial = await calculator.estimate(parcel, { destinationZip: '90210' });

    const metric = await calculator.estimate(
        {
            weight: 2 * 0.45359237,
            weightUnit: 'kg',
            length: 12 * 2.54,
            width: 9 * 2.54,
            height: 6 * 2.54,
            dimensionUnit: 'cm',
        },
        { destinationZip: '90210' },
    );

    assert.equal(imperial.cheapest.estimatedTotal, metric.cheapest.estimatedTotal);
});

test('oversized and overweight services are rejected', async () => {
    const result = await create().estimate(
        {
            weight: 100,
            length: 10,
            width: 10,
            height: 10,
        },
        { destinationZip: '90210' },
    );

    const usps = result.quotes.find((q) => q.id === 'usps-ground');

    assert.equal(usps.available, false);
});

test('invalid ZIP codes are rejected', async () => {
    await assert.rejects(create().estimate(parcel, { destinationZip: '123' }), ShippingValidationError);
});

test('unknown ZIP codes report lookup errors', async () => {
    await assert.rejects(create().estimate(parcel, { destinationZip: '99999' }), ShippingLookupError);
});

test('custom service rates and fees work', async () => {
    const result = await create({
        handlingFee: 3,
        services: {
            'usps-ground': {
                base: 10,
            },
        },
    }).estimate(parcel, {
        destinationZip: '90210',
        serviceIds: ['usps-ground'],
    });

    assert.equal(result.quotes[0].breakdown.base, 10);
    assert.equal(result.quotes[0].breakdown.handling, 3);
});

test('estimation method is clearly labeled', async () => {
    const result = await create().estimate(parcel, { destinationZip: '90210' });

    assert.equal(result.cheapest.estimationMethod, 'approximate-distance-model');
});
