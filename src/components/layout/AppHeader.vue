<script setup>
import AppIcon from '@/components/common/AppIcon.vue';

defineProps({ loaded: Boolean, searchValue: { type: String, default: '' }, view: { type: String, default: 'list' } });
defineEmits(['settings', 'search', 'update:searchValue', 'toggle-view']);
</script>

<template>
  <header class="app-header">
    <div class="brand"><AppIcon name="book" :size="26" /><span>资料共享站</span><small>V2</small></div>
    <form v-if="loaded" class="search-bar" @submit.prevent="$emit('search')">
      <input :value="searchValue" placeholder="搜索文件…" aria-label="搜索文件" @input="$emit('update:searchValue', $event.target.value)">
      <button class="icon-button" type="submit" aria-label="搜索"><AppIcon name="search" /></button>
    </form>
    <nav class="header-actions">
      <button v-if="loaded" class="icon-button" :aria-label="view === 'list' ? '切换到网格视图' : '切换到列表视图'" @click="$emit('toggle-view')">
        <AppIcon :name="view === 'list' ? 'grid' : 'list'" />
      </button>
      <button class="button button--ghost" @click="$emit('settings')"><AppIcon name="settings" />仓库设置</button>
    </nav>
  </header>
</template>
