<script setup>
defineProps({ repositoryLabel: { type: String, default: '' }, rateLimit: { type: Object, default: null } });
</script>

<template>
  <footer class="app-footer">
    <span>{{ repositoryLabel || 'GitHub Material Hub' }}</span>
    <span v-if="rateLimit?.remaining !== null && rateLimit?.remaining !== undefined">GitHub API：剩余 {{ rateLimit.remaining }}</span>
  </footer>
</template>
