<script setup>
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppToast from '@/components/common/AppToast.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import AppFooter from '@/components/layout/AppFooter.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import BreadcrumbNav from '@/components/repository/BreadcrumbNav.vue';
import CreateFolderDialog from '@/components/repository/CreateFolderDialog.vue';
import FileBrowser from '@/components/repository/FileBrowser.vue';
import RepositoryConfigDialog from '@/components/repository/RepositoryConfigDialog.vue';
import PreviewModal from '@/components/preview/PreviewModal.vue';
import UploadDialog from '@/components/upload/UploadDialog.vue';
import { useFilePreview } from '@/composables/useFilePreview.js';
import { useRepositoryBrowser } from '@/composables/useRepositoryBrowser.js';
import { useRepositoryConfig } from '@/composables/useRepositoryConfig.js';
import { useToast } from '@/composables/useToast.js';
import { getErrorMessage } from '@/errors/errorMessages.js';
import { GitHubStorageProvider } from '@/services/storage/GitHubStorageProvider.js';
import { joinPath } from '@/utils/path.js';

const configState = useRepositoryConfig();
const browser = useRepositoryBrowser();
const toast = useToast();
const activeProvider = shallowRef(null);
const preview = useFilePreview(() => activeProvider.value);
const showConfig = ref(false);
const configBusy = ref(false);
const configError = ref('');
const showUpload = ref(false);
const showCreateFolder = ref(false);
const mutationBusy = ref(false);
const mutationStatus = ref('');
const mutationError = ref('');
const deleteTarget = ref(null);
const rateLimit = reactive({ limit: null, remaining: null, resetAt: null });
let unsubscribeQueue = null;

const loaded = computed(() => Boolean(activeProvider.value?.snapshot));
const canMutate = computed(() => activeProvider.value?.capabilities.canMutate && !mutationBusy.value);
const browserError = computed(() => browser.error.value ? getErrorMessage(browser.error.value) : '');
const previewError = computed(() => preview.state.error ? getErrorMessage(preview.state.error) : '');
const repositoryLabel = computed(() => configState.repository.value
  ? `${configState.repository.value.owner}/${configState.repository.value.repo} · ${configState.repository.value.branch}`
  : 'GitHub Material Hub');
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return '';
  if (deleteTarget.value.kind === 'directory') {
    const count = activeProvider.value?.snapshot.descendantLeaves(deleteTarget.value.path).length || 0;
    return `将以一个 Git commit 原子删除目录“${deleteTarget.value.path}”及其中 ${count} 个条目。远端分支变化时操作会安全停止。`;
  }
  return `将删除文件“${deleteTarget.value.path}”。远端文件变化时操作会安全停止。`;
});

function attachQueue(provider) {
  unsubscribeQueue?.();
  unsubscribeQueue = provider.queue.subscribe((state) => {
    mutationBusy.value = state.isBusy;
  });
}

async function activateProvider({ config, token, remember }, persist = true) {
  if (activeProvider.value?.queue.isBusy) {
    configError.value = '仓库写操作进行中，暂时不能切换仓库。';
    return false;
  }
  configBusy.value = true;
  configError.value = '';
  const candidate = new GitHubStorageProvider({
    config,
    token,
    onRateLimit: (state) => Object.assign(rateLimit, state),
  });
  try {
    await candidate.initialize();
    if (persist) configState.persist({ config, nextToken: token, remember });
    const previous = activeProvider.value;
    activeProvider.value = candidate;
    attachQueue(candidate);
    await browser.attach(candidate, { initialized: true });
    previous?.dispose();
    showConfig.value = false;
    toast.show(token ? 'GitHub 仓库已连接' : '已以匿名只读模式连接公开仓库', 'success');
    return true;
  } catch (error) {
    candidate.dispose();
    configError.value = getErrorMessage(error);
    showConfig.value = true;
    return false;
  } finally {
    configBusy.value = false;
  }
}

async function saveConfiguration(payload) {
  await activateProvider({ config: payload.config, token: payload.token, remember: payload.remember }, true);
}

function resetConfiguration() {
  if (mutationBusy.value) return;
  activeProvider.value?.dispose();
  activeProvider.value = null;
  browser.provider.value = null;
  browser.entries.value = [];
  configState.reset();
  configError.value = '';
  showConfig.value = true;
}

function toggleView() {
  configState.setView(configState.preferences.view === 'list' ? 'grid' : 'list');
}

function openEntry(entry) {
  if (entry.kind === 'directory') browser.navigate(entry.path);
  else if (entry.kind === 'file') preview.open(entry);
  else toast.show(entry.kind === 'submodule' ? 'Git submodule 在 V2 中为只读特殊节点' : '符号链接在 V2 中不提供预览', 'info');
}

async function downloadEntry(entry) {
  try {
    await preview.download(entry);
    toast.show(`已开始下载：${entry.name}`, 'success');
  } catch (error) {
    toast.show(getErrorMessage(error), 'error');
  }
}

async function refreshRepository() {
  try {
    await browser.refresh();
    toast.show('仓库快照已刷新', 'success');
  } catch (error) {
    toast.show(getErrorMessage(error), 'error');
  }
}

async function submitUpload(command) {
  mutationError.value = '';
  mutationStatus.value = '正在读取文件并创建 GitHub commit…';
  try {
    await activeProvider.value.upload({ ...command, directory: browser.currentPath.value });
    browser.sync();
    showUpload.value = false;
    toast.show('文件上传成功', 'success');
  } catch (error) {
    mutationError.value = getErrorMessage(error);
    toast.show(mutationError.value, error.applied ? 'warning' : 'error');
    if (error.applied) await browser.refresh().catch(() => undefined);
  } finally {
    mutationStatus.value = '';
  }
}

async function submitCreateFolder({ name, message }) {
  mutationError.value = '';
  try {
    await activeProvider.value.createDirectory({ path: joinPath(browser.currentPath.value, name), message });
    browser.sync();
    showCreateFolder.value = false;
    toast.show(`文件夹“${name}”已创建`, 'success');
  } catch (error) {
    mutationError.value = getErrorMessage(error);
  }
}

async function confirmDelete() {
  const entry = deleteTarget.value;
  if (!entry) return;
  try {
    if (entry.kind === 'directory') {
      await activeProvider.value.deleteDirectory({ path: entry.path, message: `删除目录 ${entry.path}` });
    } else {
      await activeProvider.value.deleteFile({ path: entry.path, message: `删除 ${entry.name}` });
    }
    browser.sync();
    deleteTarget.value = null;
    toast.show('删除操作已提交', 'success');
  } catch (error) {
    toast.show(getErrorMessage(error), error.applied ? 'warning' : 'error');
    if (error.applied) deleteTarget.value = null;
  }
}

onMounted(async () => {
  configState.initialize();
  if (configState.storageError.value) {
    configError.value = getErrorMessage(configState.storageError.value);
    showConfig.value = true;
    return;
  }
  if (!configState.repository.value) {
    showConfig.value = true;
    return;
  }
  await activateProvider({
    config: configState.repository.value,
    token: configState.token.value,
    remember: configState.rememberToken.value,
  }, false);
});
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :loaded="loaded"
      :search-value="browser.searchQuery.value"
      :view="configState.preferences.view"
      @settings="showConfig = true"
      @toggle-view="toggleView"
      @update:search-value="browser.searchQuery.value = $event"
      @search="browser.search"
    />

    <main v-if="loaded" class="main-content">
      <section class="repository-summary">
        <div><p class="eyebrow">Repository Snapshot</p><h1>{{ repositoryLabel }}</h1><p>浏览和搜索均基于 commit {{ activeProvider.snapshot.commitSha.slice(0, 7) }} 的本地快照。</p></div>
        <button class="button button--secondary" :disabled="browser.loading.value || mutationBusy" @click="refreshRepository"><AppIcon name="refresh" />刷新快照</button>
      </section>

      <section class="toolbar">
        <BreadcrumbNav :path="browser.currentPath.value" :breadcrumbs="browser.breadcrumbs.value" @navigate="browser.navigate" @up="browser.goUp" />
        <div class="toolbar-actions">
          <button class="button button--secondary" :disabled="!canMutate" :title="canMutate ? '' : '需要 PAT 才能写入'" @click="mutationError = ''; showCreateFolder = true"><AppIcon name="folder" />新建文件夹</button>
          <button class="button button--primary" :disabled="!canMutate" :title="canMutate ? '' : '需要 PAT 才能写入'" @click="mutationError = ''; showUpload = true"><AppIcon name="upload" />上传文件</button>
        </div>
      </section>

      <div v-if="browser.searchActive.value" class="search-banner"><span>搜索“{{ browser.searchQuery.value }}”：{{ browser.entries.value.length }} 个结果</span><button class="button button--ghost" @click="browser.clearSearch">清除搜索</button></div>

      <FileBrowser
        :entries="browser.entries.value"
        :view="configState.preferences.view"
        :loading="browser.loading.value"
        :error-message="browserError"
        :search-active="browser.searchActive.value"
        :can-mutate="canMutate"
        @open="openEntry"
        @download="downloadEntry"
        @delete="deleteTarget = $event"
      />
    </main>

    <section v-else-if="!showConfig" class="welcome-panel"><span class="spinner" /><h1>正在连接 GitHub 仓库</h1></section>

    <AppFooter :repository-label="repositoryLabel" :rate-limit="rateLimit" />
    <RepositoryConfigDialog
      :open="showConfig"
      :initial-config="configState.repository.value"
      :initial-token="configState.token.value"
      :initial-remember="configState.rememberToken.value"
      :busy="configBusy"
      :error="configError"
      :migration-message="configState.migrationMessage.value"
      :can-close="loaded"
      @save="saveConfiguration"
      @close="showConfig = false"
      @reset="resetConfiguration"
    />
    <UploadDialog :open="showUpload" :busy="mutationBusy" :existing-names="browser.directoryNames()" :status="mutationStatus" :error="mutationError" @submit="submitUpload" @close="showUpload = false" />
    <CreateFolderDialog :open="showCreateFolder" :busy="mutationBusy" :error="mutationError" @submit="submitCreateFolder" @close="showCreateFolder = false" />
    <ConfirmDialog :open="Boolean(deleteTarget)" title="确认删除" :message="deleteMessage" confirm-text="确认删除" :busy="mutationBusy" danger @confirm="confirmDelete" @close="deleteTarget = null" />
    <PreviewModal :state="preview.state" :error-message="previewError" @close="preview.close" @download="downloadEntry" />
    <AppToast :state="toast.state" @close="toast.close" />
  </div>
</template>
