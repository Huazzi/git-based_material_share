<script setup>
defineProps({
  open: Boolean,
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  busy: Boolean,
  danger: Boolean,
});
defineEmits(['confirm', 'close']);
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <section class="dialog-card" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <p class="dialog-message">{{ message }}</p>
      <slot />
      <div class="dialog-actions">
        <button class="button button--secondary" :disabled="busy" @click="$emit('close')">取消</button>
        <button class="button" :class="danger ? 'button--danger' : 'button--primary'" :disabled="busy" @click="$emit('confirm')">
          {{ busy ? '处理中…' : confirmText }}
        </button>
      </div>
    </section>
  </div>
</template>
