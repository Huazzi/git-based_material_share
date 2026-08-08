<script setup>
import AppIcon from '@/components/common/AppIcon.vue';
defineProps({ count: Number, allSelected: Boolean, someSelected: Boolean, busy: Boolean });
defineEmits(['toggle-all', 'clear', 'download']);
</script>

<template>
  <div class="batch-action-bar" aria-label="批量操作">
    <label class="selection-toggle"><input type="checkbox" :checked="allSelected" :indeterminate.prop="someSelected" @change="$emit('toggle-all')"><span>{{ allSelected ? '取消全选' : '全选当前视图' }}</span></label>
    <span v-if="count" class="selection-count">已选择 {{ count }} 项</span>
    <div class="batch-action-bar__actions"><button v-if="count" class="button button--ghost" :disabled="busy" @click="$emit('clear')">清除</button><button class="button button--secondary" :disabled="!count || busy" @click="$emit('download')"><AppIcon name="download" />打包下载</button></div>
  </div>
</template>
