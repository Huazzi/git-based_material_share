<script setup>
import AppIcon from '@/components/common/AppIcon.vue';
import FileItemActions from './FileItemActions.vue';
import { formatFileSize } from '@/utils/format.js';

const props = defineProps({ entries: { type: Array, default: () => [] }, canMutate: Boolean, downloadBusy: Boolean, selectedPaths: { type: Object, default: () => new Set() } });
defineEmits(['open', 'download', 'delete', 'toggle-selection']);
</script>

<template>
  <ul class="file-list">
    <li v-for="entry in entries" :key="entry.id" class="file-row" :class="{ 'is-selected': props.selectedPaths.has(entry.path) }" :aria-selected="props.selectedPaths.has(entry.path)" @click="$emit('open', entry)">
      <label class="entry-checkbox" @click.stop><input type="checkbox" :checked="props.selectedPaths.has(entry.path)" :aria-label="`选择 ${entry.name}`" @change="$emit('toggle-selection', entry)"></label>
      <span class="file-symbol" :class="`file-symbol--${entry.kind}`"><AppIcon :name="entry.kind === 'directory' ? 'folder' : 'file'" :size="22" /></span>
      <span class="file-name"><strong>{{ entry.name }}</strong><small v-if="entry.kind === 'submodule'">Git submodule</small><small v-else-if="entry.kind === 'symlink'">符号链接</small><small v-else-if="entry.path.includes('/')">{{ entry.path }}</small></span>
      <span class="file-size">{{ entry.kind === 'file' ? formatFileSize(entry.size) : '' }}</span>
      <FileItemActions :entry="entry" :can-mutate="canMutate" :download-busy="downloadBusy" @download="$emit('download', $event)" @delete="$emit('delete', $event)" />
    </li>
  </ul>
</template>
