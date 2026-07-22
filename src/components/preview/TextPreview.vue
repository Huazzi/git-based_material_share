<script setup>
import { ref, watch } from 'vue';

const props = defineProps({ blob: { type: Blob, required: true } });
const text = ref('');

watch(() => props.blob, async (blob) => { text.value = await blob.text(); }, { immediate: true });
</script>

<template><pre class="text-preview">{{ text }}</pre></template>
