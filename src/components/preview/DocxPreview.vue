<script setup>
import { ref, watch } from 'vue';
import mammoth from 'mammoth/mammoth.browser';
import { sanitizeRepositoryHtml } from '@/services/preview/htmlSanitizer.js';

const props = defineProps({ blob: { type: Blob, required: true } });
const html = ref('');
const warnings = ref([]);

watch(() => props.blob, async (blob) => {
  const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  html.value = sanitizeRepositoryHtml(result.value);
  warnings.value = result.messages || [];
}, { immediate: true });
</script>

<template>
  <div class="docx-wrapper">
    <p v-if="warnings.length" class="preview-warning">文档已转换为网页格式，部分版式可能与原文件不同。</p>
    <article class="rich-preview" v-html="html" />
  </div>
</template>
