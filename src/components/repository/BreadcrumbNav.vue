<script setup>
import AppIcon from '@/components/common/AppIcon.vue';

defineProps({ path: { type: String, default: '' }, breadcrumbs: { type: Array, default: () => [] } });
defineEmits(['navigate', 'up']);
</script>

<template>
  <nav class="breadcrumbs" aria-label="当前目录">
    <button v-if="path" class="icon-button" aria-label="返回上级" @click="$emit('up')"><AppIcon name="up" /></button>
    <button class="breadcrumb" @click="$emit('navigate', '')">根目录</button>
    <template v-for="item in breadcrumbs" :key="item.path">
      <span>/</span><button class="breadcrumb" @click="$emit('navigate', item.path)">{{ item.name }}</button>
    </template>
  </nav>
</template>
