<script setup>
import AppIcon from '@/components/common/AppIcon.vue';
import FileItemActions from './FileItemActions.vue';
import { formatFileSize } from '@/utils/format.js';

const props = defineProps({ entries: { type: Array, default: () => [] }, canMutate: Boolean, downloadBusy: Boolean, selectedPaths: { type: Object, default: () => new Set() } });
defineEmits(['open', 'download', 'delete', 'toggle-selection']);
</script>

<template>
  <div class="file-grid">
    <article v-for="entry in entries" :key="entry.id" class="file-card" :class="{ 'is-selected': props.selectedPaths.has(entry.path) }" :aria-selected="props.selectedPaths.has(entry.path)" @click="$emit('open', entry)">
      <label class="entry-checkbox entry-checkbox--card" @click.stop><input type="checkbox" :checked="props.selectedPaths.has(entry.path)" :aria-label="`选择 ${entry.name}`" @change="$emit('toggle-selection', entry)"></label>
      <span class="file-card__icon" :class="`file-symbol--${entry.kind}`"><AppIcon :name="entry.kind === 'directory' ? 'folder' : 'file'" :size="38" /></span>
      <strong>{{ entry.name }}</strong>
      <small>{{ entry.kind === 'file' ? formatFileSize(entry.size) : entry.kind }}</small>
      <FileItemActions :entry="entry" :can-mutate="canMutate" :download-busy="downloadBusy" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
    </article>
  </div>
</template>
