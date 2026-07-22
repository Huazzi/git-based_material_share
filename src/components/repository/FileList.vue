<script setup>
import AppIcon from '@/components/common/AppIcon.vue';
import FileItemActions from './FileItemActions.vue';
import { formatFileSize } from '@/utils/format.js';

defineProps({ entries: { type: Array, default: () => [] }, canMutate: Boolean });
defineEmits(['open', 'download', 'delete']);
</script>

<template>
  <ul class="file-list">
    <li v-for="entry in entries" :key="entry.id" class="file-row" @click="$emit('open', entry)">
      <span class="file-symbol" :class="`file-symbol--${entry.kind}`"><AppIcon :name="entry.kind === 'directory' ? 'folder' : 'file'" :size="22" /></span>
      <span class="file-name"><strong>{{ entry.name }}</strong><small>{{ entry.kind === 'submodule' ? 'Git submodule' : entry.kind === 'symlink' ? '符号链接' : entry.path }}</small></span>
      <span class="file-size">{{ entry.kind === 'file' ? formatFileSize(entry.size) : '' }}</span>
      <FileItemActions :entry="entry" :can-mutate="canMutate" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
    </li>
  </ul>
</template>
