<script setup>
import { computed, ref, watch } from 'vue';
import { FILE_LIMITS } from '@/constants/fileLimits.js';
import AppIcon from '@/components/common/AppIcon.vue';
import { formatFileSize } from '@/utils/format.js';

const props = defineProps({
  open: Boolean,
  busy: Boolean,
  existingNames: { type: Object, default: () => new Set() },
  status: { type: String, default: '' },
  error: { type: String, default: '' },
});
const emit = defineEmits(['submit', 'close']);
const file = ref(null);
const name = ref('');
const message = ref('');
const conflict = ref('rename');
const localError = ref('');
const dragging = ref(false);

const exists = computed(() => props.existingNames.has(name.value));

watch(() => props.open, (open) => {
  if (!open) return;
  file.value = null;
  name.value = '';
  message.value = '';
  conflict.value = 'rename';
  localError.value = '';
});

function selectFile(selected) {
  if (!selected) return;
  if (selected.size > FILE_LIMITS.upload) {
    localError.value = `此文件为 ${formatFileSize(selected.size)}，上传上限为 25 MiB。`;
    return;
  }
  file.value = selected;
  name.value = selected.name;
  message.value = `上传 ${selected.name}`;
  localError.value = '';
}

function submit() {
  if (!file.value || !name.value.trim()) return;
  emit('submit', { file: file.value, name: name.value.trim(), message: message.value.trim(), conflict: conflict.value });
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="!busy && $emit('close')">
    <form class="dialog-card upload-dialog" @submit.prevent="submit">
      <h2>上传文件</h2>
      <label v-if="!file" class="drop-zone" :class="{ 'drop-zone--active': dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dragging = false; selectFile($event.dataTransfer.files[0])">
        <AppIcon name="upload" :size="34" /><strong>拖放文件到此处</strong><span>或点击选择 25 MiB 以内文件</span>
        <input type="file" hidden @change="selectFile($event.target.files[0])">
      </label>
      <template v-else>
        <div class="selected-file"><AppIcon name="file" :size="28" /><div><strong>{{ file.name }}</strong><small>{{ formatFileSize(file.size) }}</small></div><button type="button" class="button button--ghost" :disabled="busy" @click="file = null">重选</button></div>
        <label class="form-field"><span>文件名</span><input v-model="name" required :disabled="busy"></label>
        <label class="form-field"><span>提交信息</span><input v-model="message" required :disabled="busy"></label>
        <fieldset v-if="exists" class="conflict-options"><legend>同名文件已存在</legend><label><input v-model="conflict" type="radio" value="rename">自动重命名</label><label><input v-model="conflict" type="radio" value="overwrite">覆盖现有文件</label></fieldset>
      </template>
      <p v-if="status" class="notice">{{ status }}</p>
      <p v-if="localError || error" class="notice notice--error">{{ localError || error }}</p>
      <div class="dialog-actions"><button type="button" class="button button--secondary" :disabled="busy" @click="$emit('close')">取消</button><button class="button button--primary" :disabled="busy || !file">{{ busy ? '正在提交…' : '确认上传' }}</button></div>
    </form>
  </div>
</template>
