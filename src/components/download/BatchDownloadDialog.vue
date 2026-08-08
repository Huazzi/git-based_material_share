<script setup>
import { computed } from 'vue';
import { formatFileSize } from '@/utils/format.js';
const props = defineProps({ state: { type: Object, required: true }, errorMessage: { type: String, default: '' } });
defineEmits(['start', 'cancel', 'close']);
const percent = computed(() => props.state.totalBytes ? Math.min(100, Math.round((props.state.loadedBytes / props.state.totalBytes) * 100)) : 100);
const active = computed(() => props.state.phase === 'running' || props.state.phase === 'finalizing');
const cancellable = computed(() => props.state.phase === 'running');
</script>

<template>
  <div v-if="state.visible" class="modal-backdrop" @click.self="!active && $emit('close')">
    <section class="dialog-card batch-download-dialog" role="dialog" aria-modal="true" aria-labelledby="batch-download-title">
      <h2 id="batch-download-title">打包下载</h2>
      <template v-if="state.plan">
        <div class="batch-download-summary"><strong>{{ state.plan.archiveName }}</strong><span>{{ state.plan.totalFiles }} 个文件 · {{ formatFileSize(state.plan.totalBytes) }}</span><span v-if="state.plan.directories.length">保留 {{ state.plan.directories.length }} 个目录条目</span></div>
        <p v-if="state.plan.excluded.length" class="notice notice--warning">已排除 {{ state.plan.excluded.length }} 个系统文件、符号链接或子模块。</p>
        <div v-if="active || state.phase === 'complete' || state.phase === 'cancelled'" class="batch-progress">
          <div><span>{{ state.phase === 'complete' ? '归档完成' : state.phase === 'cancelled' ? '已取消' : state.phase === 'finalizing' ? '正在完成 ZIP 文件…' : `正在处理 ${state.completedFiles}/${state.totalFiles}` }}</span><strong>{{ percent }}%</strong></div>
          <progress :value="state.loadedBytes" :max="state.totalBytes || 1" />
          <small v-if="state.activePath">{{ state.activePath }}</small>
        </div>
        <p v-if="errorMessage" class="notice notice--error">{{ errorMessage }}</p>
      </template>
      <div class="dialog-actions">
        <button v-if="cancellable" class="button button--secondary" @click="$emit('cancel')">取消下载</button>
        <button v-else-if="state.phase === 'finalizing'" class="button button--secondary" disabled>正在完成…</button>
        <button v-else type="button" class="button button--secondary" @click="$emit('close')">关闭</button>
        <button v-if="state.phase === 'ready' || state.phase === 'error' || state.phase === 'cancelled'" class="button button--primary" @click="$emit('start')">{{ state.phase === 'ready' ? '选择位置并下载' : '重试' }}</button>
      </div>
    </section>
  </div>
</template>
