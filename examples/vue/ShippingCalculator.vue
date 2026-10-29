<script setup>
    import { reactive, ref } from 'vue';
    import { createShippingCalculator } from 'us-shipping-estimator';

    // Set your business's shipping origin here.
    const shipping = createShippingCalculator({
        originZip: '10017',
    });

    const parcel = reactive({
        weight: 2.5,
        length: 14,
        width: 10,
        height: 6,
    });

    const destinationZip = ref('');
    const result = ref(null);
    const error = ref('');
    const loading = ref(false);

    async function calculate() {
        loading.value = true;
        error.value = '';
        result.value = null;

        try {
            result.value = await shipping.estimate({ ...parcel }, { destinationZip: destinationZip.value });
        } catch (err) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    }
</script>

<template>
    <section class="shipping-calculator">
        <h2>Calculate shipping</h2>

        <form @submit.prevent="calculate">
            <label v-for="field in ['weight', 'length', 'width', 'height']" :key="field">
                {{ field }}

                <input v-model.number="parcel[field]" type="number" min="0.01" step="any" required />
            </label>

            <label>
                Destination ZIP
                <input v-model="destinationZip" type="text" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required />
            </label>

            <button type="submit" :disabled="loading">
                {{ loading ? 'Calculating...' : 'Get estimate' }}
            </button>
        </form>

        <p v-if="error" role="alert">
            {{ error }}
        </p>

        <template v-if="result">
            <p>
                Estimated distance:
                {{ result.distanceMiles }} miles
            </p>

            <p v-for="quote in result.quotes" :key="quote.id">
                {{ quote.label }}:
                {{ quote.available ? '$' + quote.estimatedTotal.toFixed(2) : quote.reason }}
            </p>

            <small>{{ result.disclaimer }}</small>
        </template>
    </section>
</template>
