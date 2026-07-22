<script setup>
import AppIcon from './AppIcon.vue';

defineProps({ state: { type: Object, required: true } });
defineEmits(['close']);
</script>

<template>
  <Transition name="toast">
    <div v-if="state.visible" class="app-toast" :class="`app-toast--${state.type}`" role="status">
      <span>{{ state.message }}</span>
      <button class="icon-button" aria-label="关闭通知" @click="$emit('close')"><AppIcon name="close" :size="16" /></button>
    </div>
  </Transition>
</template>
