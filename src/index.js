const DEFAULT_SERVICES = Object.freeze({
    'usps-ground': {
        label: 'USPS Ground Advantage',
        carrier: 'USPS',
        divisor: 139,
        dimThresholdCubicIn: 1728,
        maxWeightLb: 70,
        maxLengthPlusGirthIn: 130,
        base: 4.95,
        perLb: 0.82,
        zoneStep: 0.68,
        fuelPercent: 0,
    },
    'ups-ground': {
        label: 'UPS Ground',
        carrier: 'UPS',
        divisor: 139,
        dimThresholdCubicIn: 0,
        maxWeightLb: 150,
        maxLengthIn: 108,
        maxLengthPlusGirthIn: 165,
        base: 8.5,
        perLb: 0.93,
        zoneStep: 1.06,
        fuelPercent: 0,
    },
    'fedex-ground': {
        label: 'FedEx Ground',
        carrier: 'FedEx',
        divisor: 139,
        dimThresholdCubicIn: 0,
        maxWeightLb: 150,
        maxLengthIn: 108,
        maxLengthPlusGirthIn: 165,
        base: 8.75,
        perLb: 0.95,
        zoneStep: 1.09,
        fuelPercent: 0,
    },
});

export class ShippingValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShippingValidationError';
    }
}

const finite = (v, name, allowZero = false) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || (allowZero ? v < 0 : v <= 0)) {
        throw new ShippingValidationError(`${name} must be a ${allowZero ? 'nonnegative' : 'positive'} finite number`);
    }
    return v;
};

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const positiveMoney = (v, name) => finite(v, name, true);

const percent = (v, name) => finite(v, name, true);

const weightToLb = (value, unit) => {
    if (unit === 'lb') return value;
    if (unit === 'oz') return value / 16;
    if (unit === 'kg') return value * 2.2046226218;
    if (unit === 'g') return value / 453.59237;

    throw new ShippingValidationError('weightUnit must be lb, oz, kg, or g');
};

const lengthToIn = (value, unit) => {
    if (unit === 'in') return value;
    if (unit === 'cm') return value / 2.54;
    if (unit === 'mm') return value / 25.4;

    throw new ShippingValidationError('dimensionUnit must be in, cm, or mm');
};

const normalize = (parcel) => {
    if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) {
        throw new ShippingValidationError('parcel must be an object');
    }

    const weightUnit = parcel.weightUnit ?? 'lb';
    const dimensionUnit = parcel.dimensionUnit ?? 'in';

    const weightLb = weightToLb(finite(parcel.weight, 'weight'), weightUnit);

    const dimensions = ['length', 'width', 'height'].map((key) => lengthToIn(finite(parcel[key], key), dimensionUnit));

    dimensions.sort((a, b) => b - a);

    const [lengthIn, widthIn, heightIn] = dimensions;

    return {
        weightLb,
        lengthIn,
        widthIn,
        heightIn,
    };
};

const validZip = (value) => typeof value === 'string' && /^\d{5}(?:-\d{4})?$/.test(value);

const validateDomestic = (options) => {
    if (options.originCountry !== undefined && options.originCountry !== 'US') {
        throw new ShippingValidationError('Only US originCountry is supported');
    }

    if (options.destinationCountry !== undefined && options.destinationCountry !== 'US') {
        throw new ShippingValidationError('Only US destinationCountry is supported');
    }

    for (const key of ['originZip', 'destinationZip']) {
        if (options[key] !== undefined && !validZip(options[key])) {
            throw new ShippingValidationError(`${key} must be a 5-digit US ZIP or ZIP+4 string`);
        }
    }
};

const configure = (services = {}) => {
    if (!services || typeof services !== 'object' || Array.isArray(services)) {
        throw new ShippingValidationError('services must be an object');
    }

    const merged = {};

    for (const [id, defaults] of Object.entries(DEFAULT_SERVICES)) {
        merged[id] = {
            ...defaults,
            ...(services[id] ?? {}),
        };
    }

    for (const [id, config] of Object.entries(services)) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw new ShippingValidationError(`services.${id} must be an object`);
        }

        if (!merged[id]) {
            merged[id] = { ...config };
        }
    }

    for (const [id, config] of Object.entries(merged)) {
        if (!config.label || !config.carrier) {
            throw new ShippingValidationError(`services.${id} requires label and carrier`);
        }

        for (const key of ['divisor', 'maxWeightLb', 'base', 'perLb', 'zoneStep', 'fuelPercent']) {
            finite(config[key], `services.${id}.${key}`, key !== 'divisor' && key !== 'maxWeightLb');
        }

        finite(config.dimThresholdCubicIn, `services.${id}.dimThresholdCubicIn`, true);

        for (const key of ['maxLengthIn', 'maxLengthPlusGirthIn']) {
            if (config[key] !== undefined) {
                finite(config[key], `services.${id}.${key}`);
            }
        }
    }

    return merged;
};

export const SERVICE_IDS = Object.freeze(Object.keys(DEFAULT_SERVICES));

export function calculateDimensionalWeight(parcel, { divisor = 139, thresholdCubicIn = 0, rounding = 'up' } = {}) {
    finite(divisor, 'divisor');

    finite(thresholdCubicIn, 'thresholdCubicIn', true);

    if (!['up', 'nearest'].includes(rounding)) {
        throw new ShippingValidationError('rounding must be up or nearest');
    }

    const p = normalize(parcel);

    const round = rounding === 'up' ? Math.ceil : Math.round;

    const billedDimensionsIn = [p.lengthIn, p.widthIn, p.heightIn].map(round);

    const volumeCubicIn = billedDimensionsIn.reduce((a, b) => a * b, 1);

    return {
        dimensionalWeightLb: volumeCubicIn > thresholdCubicIn ? Math.ceil(volumeCubicIn / divisor) : 0,
        volumeCubicIn,
        billedDimensionsIn,
        divisor,
    };
}

function checkFit(parcel, config, dim) {
    const lengthPlusGirth = dim.billedDimensionsIn[0] + 2 * (dim.billedDimensionsIn[1] + dim.billedDimensionsIn[2]);

    if (parcel.weightLb > config.maxWeightLb) {
        return 'actual weight exceeds service limit';
    }

    if (config.maxLengthIn && dim.billedDimensionsIn[0] > config.maxLengthIn) {
        return 'length exceeds service limit';
    }

    if (config.maxLengthPlusGirthIn && lengthPlusGirth > config.maxLengthPlusGirthIn) {
        return 'length plus girth exceeds service limit';
    }

    return null;
}

/**
 * Returns illustrative USD shipping estimates.
 * These are not live carrier-issued prices.
 *
 * Zone 5 is assumed when no shipping zone
 * or synchronous zone resolver is supplied.
 */
export function estimateShipping(parcel, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new ShippingValidationError('options must be an object');
    }

    validateDomestic(options);

    const p = normalize(parcel);
    const services = configure(options.services);

    const selected = options.serviceIds ?? Object.keys(services);

    if (!Array.isArray(selected) || selected.length === 0) {
        throw new ShippingValidationError('serviceIds must be a nonempty array');
    }

    const resolved = options.zoneResolver
        ? options.zoneResolver({
              originZip: options.originZip,
              destinationZip: options.destinationZip,
          })
        : undefined;

    if (resolved !== undefined && typeof resolved?.then === 'function') {
        throw new ShippingValidationError('zoneResolver must return synchronously');
    }

    const zone = options.zone ?? resolved ?? 5;

    if (!Number.isInteger(zone) || zone < 1 || zone > 9) {
        throw new ShippingValidationError('zone must be an integer between 1 and 9');
    }

    const assumedZone = options.zone === undefined && resolved === undefined;

    const handling = positiveMoney(options.handlingFee ?? 0, 'handlingFee');

    const insurance = positiveMoney(options.insuranceFee ?? 0, 'insuranceFee');

    const markupPercent = percent(options.markupPercent ?? 0, 'markupPercent');

    const quotes = selected.map((id) => {
        const config = services[id];

        if (!config) {
            throw new ShippingValidationError(`Unknown service: ${id}`);
        }

        const dim = calculateDimensionalWeight(parcel, {
            divisor: config.divisor,
            thresholdCubicIn: config.dimThresholdCubicIn,
            rounding: config.carrier === 'USPS' ? 'up' : 'nearest',
        });

        const unavailableReason = checkFit(p, config, dim);

        const billableWeightLb = Math.max(Math.ceil(p.weightLb), dim.dimensionalWeightLb);

        if (unavailableReason) {
            return {
                id,
                label: config.label,
                carrier: config.carrier,
                available: false,
                reason: unavailableReason,
            };
        }

        const base = money(config.base);

        const weightCharge = money(billableWeightLb * config.perLb);

        const zoneCharge = money(Math.max(0, zone - 1) * config.zoneStep);

        const transportation = money(base + weightCharge + zoneCharge);

        const fuel = money((transportation * config.fuelPercent) / 100);

        const markup = money(((transportation + fuel + handling + insurance) * markupPercent) / 100);

        const total = money(transportation + fuel + handling + insurance + markup);

        return {
            id,
            label: config.label,
            carrier: config.carrier,
            available: true,
            currency: 'USD',
            estimatedTotal: total,
            actualWeightLb: money(p.weightLb),
            dimensionalWeightLb: dim.dimensionalWeightLb,
            billableWeightLb,
            volumeCubicIn: dim.volumeCubicIn,
            billedDimensionsIn: dim.billedDimensionsIn,
            breakdown: {
                base,
                weightCharge,
                zoneCharge,
                fuel,
                handling,
                insurance,
                markup,
            },
            estimationMethod: 'illustrative-rate-model',
        };
    });

    const available = quotes.filter((q) => q.available).sort((a, b) => a.estimatedTotal - b.estimatedTotal);

    return {
        currency: 'USD',
        domesticOnly: true,
        zone,
        zoneAssumed: assumedZone,
        originZip: options.originZip ?? null,
        destinationZip: options.destinationZip ?? null,
        cheapest: available[0] ?? null,
        quotes: [...available, ...quotes.filter((q) => !q.available)],
        disclaimer: 'Budget estimates only. Default rate tables are illustrative, not carrier-published prices, live quotes, or negotiated rates. Excludes service-specific surcharges and taxes unless configured.',
    };
}

export function createShippingCalculator(defaultOptions = {}) {
    if (!defaultOptions || typeof defaultOptions !== 'object' || Array.isArray(defaultOptions)) {
        throw new ShippingValidationError('defaultOptions must be an object');
    }

    return {
        estimate: (parcel, options = {}) =>
            estimateShipping(parcel, {
                ...defaultOptions,
                ...options,
                services: {
                    ...(defaultOptions.services ?? {}),
                    ...(options.services ?? {}),
                },
            }),
    };
}
