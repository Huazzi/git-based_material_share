<script setup>
import AppIcon from '@/components/common/AppIcon.vue';
import FileItemActions from './FileItemActions.vue';
import { formatFileSize } from '@/utils/format.js';

defineProps({ entries: { type: Array, default: () => [] }, canMutate: Boolean });
defineEmits(['open', 'download', 'delete']);
</script>

<template>
  <div class="file-grid">
    <article v-for="entry in entries" :key="entry.id" class="file-card" @click="$emit('open', entry)">
      <span class="file-card__icon" :class="`file-symbol--${entry.kind}`"><AppIcon :name="entry.kind === 'directory' ? 'folder' : 'file'" :size="38" /></span>
      <strong>{{ entry.name }}</strong>
      <small>{{ entry.kind === 'file' ? formatFileSize(entry.size) : entry.kind }}</small>
      <FileItemActions :entry="entry" :can-mutate="canMutate" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
    </article>
  </div>
</template>
