export type WeightUnit = 'lb' | 'oz' | 'kg' | 'g';
export type DimensionUnit = 'in' | 'cm' | 'mm';

export interface Parcel {
    weight: number;
    length: number;
    width: number;
    height: number;
    weightUnit?: WeightUnit;
    dimensionUnit?: DimensionUnit;
}

export interface ServiceConfig {
    label: string;
    carrier: string;
    divisor: number;
    dimThresholdCubicIn: number;
    maxWeightLb: number;
    maxLengthIn?: number;
    maxLengthPlusGirthIn?: number;
    base: number;
    perLb: number;
    zoneStep: number;
    fuelPercent: number;
}

export interface CalculatorConfig {
    originZip: string;
    services?: Record<string, Partial<ServiceConfig>>;
    handlingFee?: number;
    insuranceFee?: number;
    markupPercent?: number;
    fetch?: typeof globalThis.fetch;
}

export interface EstimateOptions {
    destinationZip: string;
    serviceIds?: string[];
}

export interface ZipLocation {
    zip: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
}

export interface ShippingBreakdown {
    base: number;
    weightCharge: number;
    distanceCharge: number;
    fuel: number;
    handling: number;
    insurance: number;
    markup: number;
}

export type ShippingQuote =
    | {
          id: string;
          label: string;
          carrier: string;
          available: false;
          reason: string;
      }
    | {
          id: string;
          label: string;
          carrier: string;
          available: true;
          currency: 'USD';
          estimatedTotal: number;
          actualWeightLb: number;
          dimensionalWeightLb: number;
          billableWeightLb: number;
          breakdown: ShippingBreakdown;
          estimationMethod: 'approximate-distance-model';
      };

export interface ShippingEstimate {
    originZip: string;
    destinationZip: string;
    origin: ZipLocation;
    destination: ZipLocation;
    distanceMiles: number;
    currency: 'USD';
    domesticOnly: true;
    cheapest: Extract<ShippingQuote, { available: true }> | null;
    quotes: ShippingQuote[];
    disclaimer: string;
}

export class ShippingValidationError extends Error {}
export class ShippingLookupError extends Error {}

export const SERVICE_IDS: readonly string[];

export function calculateDimensionalWeight(
    parcel: Parcel,
    options?: {
        divisor?: number;
        thresholdCubicIn?: number;
    },
): {
    dimensionalWeightLb: number;
    volumeCubicIn: number;
    billedDimensionsIn: number[];
    divisor: number;
};

export function createShippingCalculator(config: CalculatorConfig): {
    originZip: string;
    estimate(parcel: Parcel, options: EstimateOptions): Promise<ShippingEstimate>;
};
