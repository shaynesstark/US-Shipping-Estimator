import { useState } from 'react';
import { estimateShipping, ShippingValidationError } from 'us-shipping-estimator';

export default function ShippingCalculator() {
    const [values, setValues] = useState({
        weight: 2,
        length: 12,
        width: 9,
        height: 6,
        zone: 5,
    });

    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    function update(key, value) {
        setValues((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    function calculate(event) {
        event.preventDefault();

        try {
            const { zone, ...parcel } = values;

            const estimate = estimateShipping(parcel, { zone });

            setResult(estimate);
            setError('');
        } catch (err) {
            setError(err instanceof ShippingValidationError ? err.message : 'Unable to estimate shipping');

            setResult(null);
        }
    }

    return (
        <section className="shipping-calculator">
            <h2>Shipping estimator</h2>

            <form onSubmit={calculate}>
                {['weight', 'length', 'width', 'height', 'zone'].map((key) => (
                    <label key={key}>
                        {key}

                        <input aria-label={key} type="number" min={key === 'zone' ? 1 : 0.01} max={key === 'zone' ? 9 : undefined} step={key === 'zone' ? 1 : 'any'} value={values[key]} onChange={(e) => update(key, Number(e.target.value))} required />
                    </label>
                ))}

                <button type="submit">Get estimate</button>
            </form>

            {error && <p role="alert">{error}</p>}

            {result && (
                <>
                    <p>
                        Estimates only · USD · Zone {result.zone}
                        {result.zoneAssumed ? ' (assumed)' : ''}
                    </p>

                    <ul>
                        {result.quotes.map((quote) => (
                            <li key={quote.id}>
                                {quote.label}: {quote.available ? `$${quote.estimatedTotal.toFixed(2)}` : quote.reason}
                            </li>
                        ))}
                    </ul>

                    <small>{result.disclaimer}</small>
                </>
            )}
        </section>
    );
}
