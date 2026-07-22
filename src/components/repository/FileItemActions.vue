<script setup>
import AppIcon from '@/components/common/AppIcon.vue';

defineProps({ entry: { type: Object, required: true }, canMutate: Boolean, downloadBusy: Boolean });
defineEmits(['download', 'delete']);
</script>

<template>
  <div class="file-actions" @click.stop>
    <button v-if="entry.kind === 'file'" class="icon-button" title="下载" aria-label="下载" :disabled="downloadBusy" @click="$emit('download', entry)"><AppIcon name="download" /></button>
    <button v-if="canMutate && (entry.kind === 'file' || entry.kind === 'directory')" class="icon-button icon-button--danger" title="删除" aria-label="删除" @click="$emit('delete', entry)"><AppIcon name="trash" /></button>
  </div>
</template>
