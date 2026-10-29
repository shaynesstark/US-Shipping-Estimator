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

export interface ShippingOptions {
    originZip?: string;
    destinationZip?: string;
    originCountry?: 'US';
    destinationCountry?: 'US';
    zone?: number;
    zoneResolver?: (postalCodes: { originZip?: string; destinationZip?: string }) => number | undefined;
    serviceIds?: string[];
    services?: Record<string, Partial<ServiceConfig> | ServiceConfig>;
    handlingFee?: number;
    insuranceFee?: number;
    markupPercent?: number;
}

export interface Breakdown {
    base: number;
    weightCharge: number;
    zoneCharge: number;
    fuel: number;
    handling: number;
    insurance: number;
    markup: number;
}

export type Quote =
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
          volumeCubicIn: number;
          billedDimensionsIn: number[];
          breakdown: Breakdown;
          estimationMethod: 'illustrative-rate-model';
      };

export interface Estimate {
    currency: 'USD';
    domesticOnly: true;
    zone: number;
    zoneAssumed: boolean;
    originZip: string | null;
    destinationZip: string | null;
    cheapest: Extract<Quote, { available: true }> | null;
    quotes: Quote[];
    disclaimer: string;
}

export class ShippingValidationError extends Error {}

export const SERVICE_IDS: readonly string[];

export function calculateDimensionalWeight(
    parcel: Parcel,
    options?: {
        divisor?: number;
        thresholdCubicIn?: number;
        rounding?: 'up' | 'nearest';
    },
): {
    dimensionalWeightLb: number;
    volumeCubicIn: number;
    billedDimensionsIn: number[];
    divisor: number;
};

export function estimateShipping(parcel: Parcel, options?: ShippingOptions): Estimate;

export function createShippingCalculator(defaultOptions?: ShippingOptions): {
    estimate(parcel: Parcel, options?: ShippingOptions): Estimate;
};
