<script setup>
import { computed, defineAsyncComponent } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import UnsupportedPreview from './UnsupportedPreview.vue';
import { getFilePolicy } from '@/constants/fileLimits.js';

const props = defineProps({ state: { type: Object, required: true }, errorMessage: { type: String, default: '' } });
defineEmits(['close', 'download']);

const components = {
  pdf: defineAsyncComponent(() => import('./PdfPreview.vue')),
  docx: defineAsyncComponent(() => import('./DocxPreview.vue')),
  markdown: defineAsyncComponent(() => import('./MarkdownPreview.vue')),
  image: defineAsyncComponent(() => import('./ImagePreview.vue')),
  video: defineAsyncComponent(() => import('./VideoPreview.vue')),
  code: defineAsyncComponent(() => import('./CodePreview.vue')),
  text: defineAsyncComponent(() => import('./TextPreview.vue')),
};
const previewComponent = computed(() => components[props.state.descriptor?.kind] || null);
const policy = computed(() => getFilePolicy(props.state.entry?.size));
const unsupportedMessage = computed(() => {
  if (!policy.value.preview && policy.value.download) return '文件超过 25 MiB，可下载后在本地查看。';
  if (!policy.value.download) return '文件超过 100 MiB，GitHub Contents API 不支持获取。';
  return '该文件类型暂不支持在线预览，可下载后查看。';
});
</script>

<template>
  <div v-if="state.visible" class="preview-overlay">
    <header class="preview-header">
      <div><small>{{ state.entry.path }}</small><h2>{{ state.entry.name }}</h2></div>
      <div class="preview-header__actions">
        <button v-if="policy.download" class="button button--ghost button--dark" @click="$emit('download', state.entry)"><AppIcon name="download" />下载</button>
        <button class="icon-button icon-button--dark" aria-label="关闭预览" @click="$emit('close')"><AppIcon name="close" :size="22" /></button>
      </div>
    </header>
    <main class="preview-content">
      <div v-if="state.loading" class="state-panel state-panel--dark"><span class="spinner" />正在安全加载预览…</div>
      <div v-else-if="state.error" class="state-panel state-panel--error">{{ errorMessage }}</div>
      <component :is="previewComponent" v-else-if="previewComponent && state.rawFile" :blob="state.rawFile.blob" :extension="state.descriptor.extension" :alt="state.entry.name" />
      <UnsupportedPreview v-else :message="unsupportedMessage">
        <button v-if="policy.download" class="button button--primary" @click="$emit('download', state.entry)">下载文件</button>
      </UnsupportedPreview>
    </main>
  </div>
</template>
