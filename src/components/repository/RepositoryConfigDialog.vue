<script setup>
import { reactive, watch } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps({
  open: Boolean,
  initialConfig: { type: Object, default: null },
  initialToken: { type: String, default: '' },
  initialRemember: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },
  migrationMessage: { type: String, default: '' },
  canClose: Boolean,
});
const emit = defineEmits(['save', 'close', 'reset']);

const draft = reactive({ owner: '', repo: '', branch: 'main', token: '', remember: false });

watch(() => props.open, (open) => {
  if (!open) return;
  Object.assign(draft, {
    owner: props.initialConfig?.owner || '',
    repo: props.initialConfig?.repo || '',
    branch: props.initialConfig?.branch || 'main',
    token: props.initialToken || '',
    remember: props.initialRemember,
  });
}, { immediate: true });

function submit() {
  emit('save', {
    config: { owner: draft.owner.trim(), repo: draft.repo.trim(), branch: draft.branch.trim() || 'main' },
    token: draft.token.trim(),
    remember: draft.remember,
  });
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="canClose && $emit('close')">
    <form class="dialog-card config-dialog" role="dialog" aria-modal="true" aria-label="仓库配置" @submit.prevent="submit">
      <button v-if="canClose" class="icon-button dialog-close" type="button" aria-label="关闭" @click="$emit('close')"><AppIcon name="close" /></button>
      <div class="dialog-heading">
        <p class="eyebrow">GitHub First</p>
        <h2>连接资料仓库</h2>
        <p>仓库信息保存在本机；PAT 默认只在当前标签页会话中保存。</p>
      </div>
      <p v-if="migrationMessage" class="notice notice--warning">{{ migrationMessage }}</p>
      <label class="form-field"><span>用户名或组织名</span><input v-model.trim="draft.owner" required autocomplete="off" placeholder="octocat"></label>
      <label class="form-field"><span>仓库名</span><input v-model.trim="draft.repo" required autocomplete="off" placeholder="learning-materials"></label>
      <label class="form-field"><span>分支</span><input v-model.trim="draft.branch" required autocomplete="off" placeholder="main"></label>
      <label class="form-field"><span>Fine-grained PAT（公开仓库只读可留空）</span><input v-model="draft.token" type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <label class="check-row"><input v-model="draft.remember" type="checkbox" :disabled="!draft.token"><span>在此设备记住访问令牌</span></label>
      <p v-if="error" class="notice notice--error">{{ error }}</p>
      <div class="dialog-actions dialog-actions--spread">
        <button class="button button--secondary" type="button" :disabled="busy" @click="$emit('reset')">重置配置</button>
        <button class="button button--primary" type="submit" :disabled="busy || !draft.owner || !draft.repo">{{ busy ? '正在连接…' : '保存并加载' }}</button>
      </div>
    </form>
  </div>
</template>
