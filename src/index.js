/**
 * US Shipping Estimator
 * Automatic ZIP-based domestic shipping estimates.
 *
 * Prices and distance bands are illustrative, not official
 * carrier quotations or verified carrier zones.
 */

const DEFAULT_SERVICES = {
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
};

export const SERVICE_IDS = Object.freeze(Object.keys(DEFAULT_SERVICES));

export class ShippingValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShippingValidationError';
    }
}

export class ShippingLookupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShippingLookupError';
    }
}

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function number(value, name, allowZero = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
        throw new ShippingValidationError(`${name} must be a ${allowZero ? 'nonnegative' : 'positive'} finite number`);
    }
    return value;
}

function normalizeZip(zip) {
    if (typeof zip !== 'string' || !/^\d{5}(?:-\d{4})?$/.test(zip)) {
        throw new ShippingValidationError('ZIP must be a valid 5-digit US ZIP or ZIP+4 string');
    }
    return zip.slice(0, 5);
}

function normalizeParcel(parcel) {
    if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) {
        throw new ShippingValidationError('parcel must be an object');
    }

    const weightConversions = {
        lb: 1,
        oz: 1 / 16,
        kg: 2.2046226218,
        g: 1 / 453.59237,
    };

    const dimensionConversions = {
        in: 1,
        cm: 1 / 2.54,
        mm: 1 / 25.4,
    };

    const weightUnit = parcel.weightUnit ?? 'lb';
    const dimensionUnit = parcel.dimensionUnit ?? 'in';

    if (!(weightUnit in weightConversions)) {
        throw new ShippingValidationError('Invalid weight unit');
    }

    if (!(dimensionUnit in dimensionConversions)) {
        throw new ShippingValidationError('Invalid dimension unit');
    }

    const dimensions = ['length', 'width', 'height'].map((key) => number(parcel[key], key) * dimensionConversions[dimensionUnit]).sort((a, b) => b - a);

    return {
        weightLb: number(parcel.weight, 'weight') * weightConversions[weightUnit],
        dimensions,
    };
}

export function calculateDimensionalWeight(parcel, { divisor = 139, thresholdCubicIn = 0 } = {}) {
    number(divisor, 'divisor');
    number(thresholdCubicIn, 'thresholdCubicIn', true);

    const p = normalizeParcel(parcel);
    const billedDimensionsIn = p.dimensions.map(Math.ceil);

    const volumeCubicIn = billedDimensionsIn.reduce((total, dimension) => total * dimension, 1);

    return {
        dimensionalWeightLb: volumeCubicIn > thresholdCubicIn ? Math.ceil(volumeCubicIn / divisor) : 0,
        volumeCubicIn,
        billedDimensionsIn,
        divisor,
    };
}

function distanceMiles(a, b) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;

    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const deltaLat = lat2 - lat1;
    const deltaLon = toRadians(b.longitude - a.longitude);

    const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/**
 * Approximate distance-to-zone classification.
 *
 * Not official USPS, UPS, or FedEx zone data.
 * The 1-9 bands are a modeling assumption only.
 */
function approximateDistanceBand(miles) {
    if (miles <= 50) return 1;
    if (miles <= 150) return 2;
    if (miles <= 300) return 3;
    if (miles <= 600) return 4;
    if (miles <= 1000) return 5;
    if (miles <= 1400) return 6;
    if (miles <= 1800) return 7;
    if (miles <= 3000) return 8;
    return 9;
}

function createZipLookup(fetcher = globalThis.fetch) {
    if (typeof fetcher !== 'function') {
        throw new ShippingValidationError('A fetch implementation is required');
    }

    const cache = new Map();

    return async function lookupZip(zip) {
        const normalizedZip = normalizeZip(zip);

        if (cache.has(normalizedZip)) {
            return cache.get(normalizedZip);
        }

        const promise = (async () => {
            let response;

            try {
                response = await fetcher(`https://api.zippopotam.us/us/${normalizedZip}`);
            } catch {
                throw new ShippingLookupError(`ZIP lookup failed for ${normalizedZip}. Check the network connection.`);
            }

            if (!response.ok) {
                throw new ShippingLookupError(response.status === 404 ? `ZIP ${normalizedZip} was not found` : `ZIP lookup returned HTTP ${response.status}`);
            }

            let data;

            try {
                data = await response.json();
            } catch {
                throw new ShippingLookupError('ZIP lookup returned invalid JSON');
            }

            const place = data.places?.[0];

            const latitude = Number(place?.latitude);
            const longitude = Number(place?.longitude);

            if (place == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                throw new ShippingLookupError(`No valid coordinates for ZIP ${normalizedZip}`);
            }

            return {
                zip: normalizedZip,
                city: place['place name'],
                state: place['state abbreviation'],
                latitude,
                longitude,
            };
        })();

        cache.set(normalizedZip, promise);

        try {
            return await promise;
        } catch (error) {
            cache.delete(normalizedZip);
            throw error;
        }
    };
}

export function createShippingCalculator({ originZip, services = {}, handlingFee = 0, insuranceFee = 0, markupPercent = 0, fetch: customFetch } = {}) {
    const origin = normalizeZip(originZip);

    number(handlingFee, 'handlingFee', true);
    number(insuranceFee, 'insuranceFee', true);
    number(markupPercent, 'markupPercent', true);

    if (!services || typeof services !== 'object' || Array.isArray(services)) {
        throw new ShippingValidationError('services must be an object');
    }

    const configurations = {};

    for (const [id, defaults] of Object.entries(DEFAULT_SERVICES)) {
        configurations[id] = {
            ...defaults,
            ...(services[id] ?? {}),
        };
    }

    for (const [id, override] of Object.entries(services)) {
        if (!override || typeof override !== 'object' || Array.isArray(override)) {
            throw new ShippingValidationError(`Invalid service: ${id}`);
        }
        if (!configurations[id]) {
            configurations[id] = { ...override };
        }
    }

    for (const [id, service] of Object.entries(configurations)) {
        if (typeof service.label !== 'string' || typeof service.carrier !== 'string') {
            throw new ShippingValidationError(`${id} requires label and carrier`);
        }

        for (const key of ['divisor', 'maxWeightLb', 'base', 'perLb', 'zoneStep', 'fuelPercent', 'dimThresholdCubicIn']) {
            number(service[key], `${id}.${key}`, !['divisor', 'maxWeightLb'].includes(key));
        }

        for (const key of ['maxLengthIn', 'maxLengthPlusGirthIn']) {
            if (service[key] != null) {
                number(service[key], `${id}.${key}`);
            }
        }
    }

    const lookup = createZipLookup(customFetch);

    async function estimate(parcel, { destinationZip, serviceIds = Object.keys(configurations) } = {}) {
        const destination = normalizeZip(destinationZip);
        const normalizedParcel = normalizeParcel(parcel);

        if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
            throw new ShippingValidationError('serviceIds must be a nonempty array');
        }

        const [from, to] = await Promise.all([lookup(origin), lookup(destination)]);

        const miles = distanceMiles(from, to);
        const distanceBand = approximateDistanceBand(miles);

        const quotes = serviceIds.map((id) => {
            const config = configurations[id];

            if (!config) {
                throw new ShippingValidationError(`Unknown service: ${id}`);
            }

            const dim = calculateDimensionalWeight(parcel, {
                divisor: config.divisor,
                thresholdCubicIn: config.dimThresholdCubicIn,
            });

            const [length, width, height] = dim.billedDimensionsIn;

            const lengthPlusGirth = length + 2 * (width + height);

            let reason = null;

            if (normalizedParcel.weightLb > config.maxWeightLb) {
                reason = 'Actual weight exceeds service limit';
            } else if (config.maxLengthIn && length > config.maxLengthIn) {
                reason = 'Length exceeds service limit';
            } else if (config.maxLengthPlusGirthIn && lengthPlusGirth > config.maxLengthPlusGirthIn) {
                reason = 'Length plus girth exceeds service limit';
            }

            if (reason) {
                return {
                    id,
                    label: config.label,
                    carrier: config.carrier,
                    available: false,
                    reason,
                };
            }

            const billableWeightLb = Math.max(Math.ceil(normalizedParcel.weightLb), dim.dimensionalWeightLb);

            const base = roundMoney(config.base);
            const weightCharge = roundMoney(billableWeightLb * config.perLb);
            const distanceCharge = roundMoney(Math.max(0, distanceBand - 1) * config.zoneStep);

            const transportation = roundMoney(base + weightCharge + distanceCharge);

            const fuel = roundMoney((transportation * config.fuelPercent) / 100);

            const markup = roundMoney(((transportation + fuel + handlingFee + insuranceFee) * markupPercent) / 100);

            const estimatedTotal = roundMoney(transportation + fuel + handlingFee + insuranceFee + markup);

            return {
                id,
                label: config.label,
                carrier: config.carrier,
                available: true,
                currency: 'USD',
                estimatedTotal,
                actualWeightLb: roundMoney(normalizedParcel.weightLb),
                dimensionalWeightLb: dim.dimensionalWeightLb,
                billableWeightLb,
                breakdown: {
                    base,
                    weightCharge,
                    distanceCharge,
                    fuel,
                    handling: roundMoney(handlingFee),
                    insurance: roundMoney(insuranceFee),
                    markup,
                },
                estimationMethod: 'approximate-distance-model',
            };
        });

        const available = quotes.filter((q) => q.available).sort((a, b) => a.estimatedTotal - b.estimatedTotal);

        return {
            originZip: origin,
            destinationZip: destination,
            origin: from,
            destination: to,
            distanceMiles: Math.round(miles),
            currency: 'USD',
            domesticOnly: true,
            cheapest: available[0] ?? null,
            quotes: [...available, ...quotes.filter((q) => !q.available)],
            disclaimer: 'Illustrative estimates based on ZIP-coordinate distance. ' + 'Distance bands are not official carrier zones. ' + 'Rates do not include all possible carrier surcharges.',
        };
    }

    return {
        originZip: origin,
        estimate,
    };
}
