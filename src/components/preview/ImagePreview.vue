<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { sanitizeSvg } from '@/services/preview/htmlSanitizer.js';

const props = defineProps({ blob: { type: Blob, required: true }, extension: { type: String, default: '' }, alt: { type: String, default: '' } });
const url = ref('');

function revoke() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
}

watch(() => [props.blob, props.extension], async () => {
  revoke();
  let displayBlob = props.blob;
  if (props.extension === 'svg') {
    displayBlob = new Blob([sanitizeSvg(await props.blob.text())], { type: 'image/svg+xml' });
  }
  url.value = URL.createObjectURL(displayBlob);
}, { immediate: true });

onBeforeUnmount(revoke);
</script>

<template><div class="image-preview"><img v-if="url" :src="url" :alt="alt"></div></template>
