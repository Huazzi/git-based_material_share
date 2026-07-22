<script setup>
import { ref, watch } from 'vue';
import { marked } from 'marked';
import { sanitizeRepositoryHtml } from '@/services/preview/htmlSanitizer.js';

const props = defineProps({ blob: { type: Blob, required: true } });
const html = ref('');

watch(() => props.blob, async (blob) => {
  html.value = sanitizeRepositoryHtml(marked.parse(await blob.text()));
}, { immediate: true });
</script>

<template><article class="rich-preview markdown-body" v-html="html" /></template>
