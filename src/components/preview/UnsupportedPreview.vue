<script setup>
defineProps({ message: { type: String, default: '暂不支持在线预览此文件。' } });
</script>

<template><div class="unsupported-preview"><strong>无法在线预览</strong><p>{{ message }}</p><slot /></div></template>
