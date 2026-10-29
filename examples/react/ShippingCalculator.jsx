import { useState } from 'react';
import { createShippingCalculator } from 'us-shipping-estimator';

// Configure the origin in code, not in the customer form.
const shipping = createShippingCalculator({
    originZip: '10017',
});

export default function ShippingCalculator() {
    const [parcel, setParcel] = useState({
        weight: 2.5,
        length: 14,
        width: 10,
        height: 6,
    });

    const [destinationZip, setDestinationZip] = useState('');

    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    function update(key, value) {
        setParcel((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    async function calculate(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const estimate = await shipping.estimate(parcel, { destinationZip });
            setResult(estimate);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="shipping-calculator">
            <h2>Calculate shipping</h2>

            <form onSubmit={calculate}>
                {['weight', 'length', 'width', 'height'].map((key) => (
                    <label key={key}>
                        {key}
                        <input type="number" min="0.01" step="any" value={parcel[key]} onChange={(event) => update(key, Number(event.target.value))} required />
                    </label>
                ))}

                <label>
                    Destination ZIP
                    <input value={destinationZip} onChange={(event) => setDestinationZip(event.target.value)} inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required />
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? 'Calculating...' : 'Get estimate'}
                </button>
            </form>

            {error && <p role="alert">{error}</p>}

            {result && (
                <div>
                    <p>Estimated distance: {result.distanceMiles} miles</p>

                    {result.quotes.map((quote) => (
                        <p key={quote.id}>
                            {quote.label}: {quote.available ? `$${quote.estimatedTotal.toFixed(2)}` : quote.reason}
                        </p>
                    ))}

                    <small>{result.disclaimer}</small>
                </div>
            )}
        </section>
    );
}
