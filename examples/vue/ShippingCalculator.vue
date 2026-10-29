<script setup>
    import { reactive, ref } from 'vue';

    import { estimateShipping } from 'us-shipping-estimator';

    const parcel = reactive({
        weight: 2,
        length: 12,
        width: 9,
        height: 6,
    });

    const zone = ref(5);
    const result = ref(null);
    const error = ref('');

    function calculate() {
        try {
            result.value = estimateShipping({ ...parcel }, { zone: zone.value });

            error.value = '';
        } catch (err) {
            error.value = err.message;
            result.value = null;
        }
    }
</script>

<template>
    <section class="shipping-calculator">
        <h2>Shipping estimator</h2>

        <form @submit.prevent="calculate">
            <label v-for="field in ['weight', 'length', 'width', 'height']" :key="field">
                {{ field }}

                <input v-model.number="parcel[field]" type="number" min="0.01" step="any" required />
            </label>

            <label>
                Zone

                <input v-model.number="zone" type="number" min="1" max="9" step="1" required />
            </label>

            <button type="submit">Get estimate</button>
        </form>

        <p v-if="error" role="alert">
            {{ error }}
        </p>

        <template v-if="result">
            <p>
                Estimated US shipping · USD · Zone
                {{ result.zone }}
            </p>

            <ul>
                <li v-for="quote in result.quotes" :key="quote.id">
                    {{ quote.label }}:
                    {{ quote.available ? '$' + quote.estimatedTotal.toFixed(2) : quote.reason }}
                </li>
            </ul>

            <small>
                {{ result.disclaimer }}
            </small>
        </template>
    </section>
</template>
