<script setup>
import { ref, watch } from 'vue';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import { sanitizeCodeHtml } from '@/services/preview/htmlSanitizer.js';

const props = defineProps({ blob: { type: Blob, required: true }, extension: { type: String, default: '' } });
const html = ref('');

const grammarNames = { js: 'javascript', jsx: 'javascript', ts: 'javascript', json: 'json', html: 'markup', xml: 'markup', vue: 'markup', py: 'python' };

watch(() => [props.blob, props.extension], async () => {
  const source = await props.blob.text();
  const language = grammarNames[props.extension] || props.extension;
  const grammar = Prism.languages[language] || Prism.languages.markup;
  html.value = sanitizeCodeHtml(Prism.highlight(source, grammar, language));
}, { immediate: true });
</script>

<template><pre class="code-preview"><code v-html="html" /></pre></template>
