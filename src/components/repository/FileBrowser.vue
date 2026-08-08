<script setup>
import FileGrid from './FileGrid.vue';
import FileList from './FileList.vue';

defineProps({
  entries: { type: Array, default: () => [] },
  view: { type: String, default: 'list' },
  loading: Boolean,
  errorMessage: { type: String, default: '' },
  searchActive: Boolean,
  canMutate: Boolean,
  downloadBusy: Boolean,
  selectedPaths: { type: Object, default: () => new Set() },
});
defineEmits(['open', 'download', 'delete', 'toggle-selection']);
</script>

<template>
  <section class="file-browser" aria-live="polite">
    <div v-if="loading" class="state-panel"><span class="spinner" />正在加载仓库快照…</div>
    <div v-else-if="errorMessage" class="state-panel state-panel--error">{{ errorMessage }}</div>
    <div v-else-if="!entries.length" class="state-panel">{{ searchActive ? '没有匹配的文件' : '此目录为空' }}</div>
    <FileList v-else-if="view === 'list'" :entries="entries" :can-mutate="canMutate" :download-busy="downloadBusy" :selected-paths="selectedPaths" @open="$emit('open', $event)" @download="$emit('download', $event)" @delete="$emit('delete', $event)" @toggle-selection="$emit('toggle-selection', $event)" />
    <FileGrid v-else :entries="entries" :can-mutate="canMutate" :download-busy="downloadBusy" :selected-paths="selectedPaths" @open="$emit('open', $event)" @download="$emit('download', $event)" @delete="$emit('delete', $event)" @toggle-selection="$emit('toggle-selection', $event)" />
  </section>
</template>
