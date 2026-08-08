<script setup>
import AppIcon from '@/components/common/AppIcon.vue';

defineProps({
  loaded: Boolean,
  searchValue: { type: String, default: '' },
  view: { type: String, default: 'list' },
  canMutate: Boolean,
});
defineEmits(['settings', 'search', 'update:searchValue', 'toggle-view']);
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="brand-mark"><AppIcon name="book" :size="23" /></span>
      <span class="brand-copy"><strong>资料共享站</strong><small>Material Hub</small></span>
    </div>
    <form v-if="loaded" class="search-bar" @submit.prevent="$emit('search')">
      <AppIcon name="search" :size="19" />
      <input :value="searchValue" placeholder="搜索当前仓库中的文件…" aria-label="搜索文件" @input="$emit('update:searchValue', $event.target.value)">
      <button class="icon-button" type="submit" aria-label="搜索"><AppIcon name="search" /></button>
    </form>
    <nav class="header-actions">
      <span v-if="loaded" class="header-status" :class="{ 'header-status--write': canMutate }"><i aria-hidden="true"></i>{{ canMutate ? '可编辑' : '只读' }}</span>
      <button v-if="loaded" class="icon-button" :aria-label="view === 'list' ? '切换到网格视图' : '切换到列表视图'" @click="$emit('toggle-view')">
        <AppIcon :name="view === 'list' ? 'grid' : 'list'" />
      </button>
      <button class="button button--ghost header-settings" @click="$emit('settings')"><AppIcon name="settings" /><span>仓库设置</span></button>
    </nav>
  </header>
</template>
