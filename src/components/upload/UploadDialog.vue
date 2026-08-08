<script setup>
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { getErrorMessage } from '@/errors/errorMessages.js';
import { createBatchUploadDraft, planBatchUpload } from '@/services/batch/BatchUploadPlanner.js';
import { formatFileSize } from '@/utils/format.js';
import { getFileName, joinPath } from '@/utils/path.js';

const props = defineProps({
  open: Boolean,
  busy: Boolean,
  snapshot: { type: Object, default: null },
  directory: { type: String, default: '' },
  status: { type: String, default: '' },
  error: { type: String, default: '' },
});
const emit = defineEmits(['submit', 'close']);
const draft = ref(null);
const message = ref('');
const localError = ref('');
const dragging = ref(false);
const totalSize = computed(() => draft.value?.totalBytes || 0);

watch(() => props.open, (open) => {
  if (!open) return;
  draft.value = null;
  message.value = '';
  localError.value = '';
});

watch(() => props.snapshot?.commitSha, (nextCommit, previousCommit) => {
  if (!props.open || !draft.value || !previousCommit || nextCommit === previousCommit) return;
  draft.value.files.forEach((item, index) => {
    item.action = conflictType(item, index) ? '' : 'create';
  });
  localError.value = '';
});

function selectFiles(selected) {
  const files = Array.from(selected || []);
  if (!files.length) return;
  try {
    draft.value = createBatchUploadDraft(files, { directory: props.directory, snapshot: props.snapshot });
    message.value = files.length === 1 ? `上传 ${files[0].name}` : `批量上传 ${files.length} 个文件`;
    localError.value = '';
  } catch (error) {
    localError.value = getErrorMessage(error);
    draft.value = null;
  }
}

function removeItem(index) {
  const files = draft.value.files.filter((_, itemIndex) => itemIndex !== index).map((item) => item.file);
  if (files.length) selectFiles(files);
  else draft.value = null;
}

function conflictType(item, index) {
  const targetName = getFileName(item.targetName || item.originalName);
  const targetPath = joinPath(props.directory, targetName);
  const duplicate = draft.value.files.slice(0, index).some((candidate) => (
    joinPath(props.directory, getFileName(candidate.targetName || candidate.originalName)) === targetPath
  ));
  if (duplicate) return 'batch-duplicate';
  const remote = props.snapshot?.stat(targetPath);
  return remote ? `remote-${remote.kind}` : null;
}

function syncConflict(item, index) {
  const type = conflictType(item, index);
  if (!type) item.action = 'create';
  else if (item.action === 'create' || (type !== 'remote-file' && item.action === 'overwrite')) item.action = '';
}

function optionsFor(item, index) {
  const type = conflictType(item, index);
  if (type === 'batch-duplicate' || type !== 'remote-file') {
    return [{ value: 'rename', label: '自动重命名' }, { value: 'skip', label: '跳过' }];
  }
  return [
    { value: 'rename', label: '自动重命名' },
    { value: 'overwrite', label: '覆盖远端文件' },
    { value: 'skip', label: '跳过' },
  ];
}

function submit() {
  if (!draft.value || !props.snapshot) return;
  try {
    const plan = planBatchUpload({ draft: draft.value, snapshot: props.snapshot, message: message.value });
    localError.value = '';
    emit('submit', { draft: draft.value, message: message.value.trim(), fingerprint: plan.fingerprint });
  } catch (error) {
    localError.value = getErrorMessage(error);
  }
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="!busy && $emit('close')">
    <form class="dialog-card upload-dialog upload-dialog--batch" @submit.prevent="submit">
      <h2>批量上传文件</h2>
      <label v-if="!draft" class="drop-zone" :class="{ 'drop-zone--active': dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dragging = false; selectFiles($event.dataTransfer.files)">
        <AppIcon name="upload" :size="34" />
        <strong>拖放多个文件到此处</strong>
        <span>最多 {{ FILE_LIMITS.batchUploadCount }} 个，单个 25 MiB，总计 100 MiB</span>
        <input type="file" multiple hidden @change="selectFiles($event.target.files)">
      </label>
      <template v-else>
        <div class="batch-summary"><strong>{{ draft.files.length }} 个文件</strong><span>共 {{ formatFileSize(totalSize) }}</span><button type="button" class="button button--ghost" :disabled="busy" @click="draft = null">重新选择</button></div>
        <div class="upload-items">
          <article v-for="(item, index) in draft.files" :key="item.id" class="upload-item">
            <div class="upload-item__source"><AppIcon name="file" /><span><strong>{{ item.originalName }}</strong><small>{{ formatFileSize(item.file.size) }}</small></span></div>
            <label class="form-field"><span>目标文件名</span><input v-model="item.targetName" required :disabled="busy || item.action === 'skip'" @input="syncConflict(item, index)"></label>
            <label v-if="conflictType(item, index)" class="form-field"><span>{{ conflictType(item, index) === 'batch-duplicate' ? '批次内重名' : '远端同名冲突' }}</span><select v-model="item.action" required :disabled="busy"><option value="" disabled>请选择处理方式</option><option v-for="option in optionsFor(item, index)" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <button type="button" class="icon-button icon-button--danger" aria-label="移除此文件" :disabled="busy" @click="removeItem(index)"><AppIcon name="trash" /></button>
          </article>
        </div>
        <label class="form-field"><span>提交信息</span><input v-model="message" required :disabled="busy"></label>
      </template>
      <p v-if="status" class="notice">{{ status }}</p>
      <p v-if="localError || error" class="notice notice--error">{{ localError || error }}</p>
      <div class="dialog-actions"><button type="button" class="button button--secondary" :disabled="busy" @click="$emit('close')">取消</button><button class="button button--primary" :disabled="busy || !draft">{{ busy ? '正在提交…' : '原子上传' }}</button></div>
    </form>
  </div>
</template>
