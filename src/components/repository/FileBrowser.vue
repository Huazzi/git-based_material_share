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
});
defineEmits(['open', 'download', 'delete']);
</script>

<template>
  <section class="file-browser" aria-live="polite">
    <div v-if="loading" class="state-panel"><span class="spinner" />正在加载仓库快照…</div>
    <div v-else-if="errorMessage" class="state-panel state-panel--error">{{ errorMessage }}</div>
    <div v-else-if="!entries.length" class="state-panel">{{ searchActive ? '没有匹配的文件' : '此目录为空' }}</div>
    <FileList v-else-if="view === 'list'" :entries="entries" :can-mutate="canMutate" @open="$emit('open', $event)" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
    <FileGrid v-else :entries="entries" :can-mutate="canMutate" @open="$emit('open', $event)" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
  </section>
</template>
