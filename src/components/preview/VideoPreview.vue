<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({ blob: { type: Blob, required: true } });
const url = ref('');
const player = ref(null);

function cleanup() {
  if (player.value) {
    player.value.pause();
    player.value.removeAttribute('src');
    player.value.load();
  }
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
}

watch(() => props.blob, (blob) => {
  cleanup();
  url.value = URL.createObjectURL(blob);
}, { immediate: true });

onBeforeUnmount(cleanup);
</script>

<template><div class="video-preview"><video ref="player" :src="url" controls playsinline preload="metadata" /></div></template>
