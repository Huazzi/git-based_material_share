<script setup>
import { ref, watch } from 'vue';

const props = defineProps({ open: Boolean, busy: Boolean, error: { type: String, default: '' } });
const emit = defineEmits(['submit', 'close']);
const name = ref('');
const message = ref('');

watch(() => props.open, (open) => {
  if (open) { name.value = ''; message.value = '创建新文件夹'; }
});
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <form class="dialog-card" @submit.prevent="$emit('submit', { name: name.trim(), message: message.trim() })">
      <h2>新建文件夹</h2>
      <label class="form-field"><span>文件夹名称</span><input v-model="name" required autocomplete="off"></label>
      <label class="form-field"><span>提交信息</span><input v-model="message" required autocomplete="off"></label>
      <p v-if="error" class="notice notice--error">{{ error }}</p>
      <div class="dialog-actions"><button type="button" class="button button--secondary" :disabled="busy" @click="$emit('close')">取消</button><button class="button button--primary" :disabled="busy || !name.trim()">{{ busy ? '创建中…' : '确认创建' }}</button></div>
    </form>
  </div>
</template>
