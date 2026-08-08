<script setup>
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppToast from '@/components/common/AppToast.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import AppFooter from '@/components/layout/AppFooter.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import BreadcrumbNav from '@/components/repository/BreadcrumbNav.vue';
import BatchActionBar from '@/components/repository/BatchActionBar.vue';
import CreateFolderDialog from '@/components/repository/CreateFolderDialog.vue';
import FileBrowser from '@/components/repository/FileBrowser.vue';
import RepositoryConfigDialog from '@/components/repository/RepositoryConfigDialog.vue';
import BatchDownloadDialog from '@/components/download/BatchDownloadDialog.vue';
import PreviewModal from '@/components/preview/PreviewModal.vue';
import UploadDialog from '@/components/upload/UploadDialog.vue';
import { useFilePreview } from '@/composables/useFilePreview.js';
import { useBatchDownload } from '@/composables/useBatchDownload.js';
import { useRepositoryBrowser } from '@/composables/useRepositoryBrowser.js';
import { useRepositoryConfig } from '@/composables/useRepositoryConfig.js';
import { useRepositoryMutations } from '@/composables/useRepositoryMutations.js';
import { useRepositorySession } from '@/composables/useRepositorySession.js';
import { useRepositorySelection } from '@/composables/useRepositorySelection.js';
import { useToast } from '@/composables/useToast.js';
import { getErrorMessage } from '@/errors/errorMessages.js';
import { joinPath } from '@/utils/path.js';

const configState = useRepositoryConfig();
const browser = useRepositoryBrowser();
const toast = useToast();
const session = useRepositorySession({ browser });
const activeProvider = session.activeProvider;
const preview = useFilePreview(() => activeProvider.value);
const selection = useRepositorySelection(browser);
const batchDownload = useBatchDownload(() => activeProvider.value);
session.setInvalidator(() => {
  preview.dispose();
  batchDownload.dispose();
  selection.clear();
});
const mutations = useRepositoryMutations({ getProvider: () => activeProvider.value, browser });
const showConfig = ref(false);
const configBusy = ref(false);
const configError = ref('');
const showUpload = ref(false);
const showCreateFolder = ref(false);
const mutationBusy = session.mutationBusy;
const mutationStatus = mutations.status;
const mutationError = computed(() => mutations.error.value ? getErrorMessage(mutations.error.value) : '');
const deleteTarget = ref(null);
const rateLimit = session.rateLimit;

const loaded = computed(() => Boolean(activeProvider.value?.snapshot));
const canMutate = computed(() => activeProvider.value?.capabilities.canMutate && !mutationBusy.value);
const browserError = computed(() => browser.error.value ? getErrorMessage(browser.error.value) : '');
const previewError = computed(() => preview.state.error ? getErrorMessage(preview.state.error) : '');
const batchDownloadError = computed(() => batchDownload.state.error ? getErrorMessage(batchDownload.state.error) : '');
const downloadBusy = computed(() => preview.state.downloadBusy
  || batchDownload.state.phase === 'running'
  || batchDownload.state.phase === 'finalizing');
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

async function activateProvider({ config, token, remember }, persist = true) {
  if (activeProvider.value?.queue.isBusy) {
    configError.value = '仓库写操作进行中，暂时不能切换仓库。';
    return false;
  }
  configBusy.value = true;
  configError.value = '';
  try {
    await session.connect({
      config,
      token,
      commit: persist
        ? () => configState.persist({ config, nextToken: token, remember })
        : undefined,
    });
    showConfig.value = false;
    toast.show(token ? 'GitHub 仓库已连接' : '已以匿名只读模式连接公开仓库', 'success');
    return true;
  } catch (error) {
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
  try {
    configState.reset();
  } catch (error) {
    configError.value = getErrorMessage(error);
    showConfig.value = true;
    return;
  }
  session.disconnect();
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
    if (error.code !== 'ABORTED' && error.code !== 'SESSION_CHANGED') {
      toast.show(getErrorMessage(error), 'error');
    }
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
  const result = await mutations.uploadBatch(command);
  if (result.ok) {
    showUpload.value = false;
    toast.show('批量上传已通过一个 Git commit 提交', 'success');
  } else {
    if (result.requiresAudit) showUpload.value = false;
    toast.show(getErrorMessage(result.error), result.requiresAudit ? 'warning' : 'error');
  }
}

function prepareBatchDownload() {
  try {
    batchDownload.prepare(selection.selectedEntries.value);
  } catch (error) {
    toast.show(getErrorMessage(error), 'error');
  }
}

async function startBatchDownload() {
  const result = await batchDownload.start();
  if (result.status === 'complete') {
    selection.clear();
    toast.show('ZIP 归档已生成', 'success');
  } else if (result.status === 'error') {
    toast.show(getErrorMessage(result.error), 'error');
  }
}

async function submitCreateFolder({ name, message }) {
  const result = await mutations.createDirectory({
    path: joinPath(browser.currentPath.value, name), message,
  });
  if (result.ok) {
    showCreateFolder.value = false;
    toast.show(`文件夹“${name}”已创建`, 'success');
  } else {
    if (result.requiresAudit) showCreateFolder.value = false;
    toast.show(getErrorMessage(result.error), result.requiresAudit ? 'warning' : 'error');
  }
}

async function confirmDelete() {
  const entry = deleteTarget.value;
  if (!entry) return;
  const result = await mutations.remove(
    entry,
    entry.kind === 'directory' ? `删除目录 ${entry.path}` : `删除 ${entry.name}`,
  );
  if (result.ok) {
    deleteTarget.value = null;
    toast.show('删除操作已提交', 'success');
  } else {
    toast.show(getErrorMessage(result.error), result.requiresAudit ? 'warning' : 'error');
    if (result.requiresAudit) deleteTarget.value = null;
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
        <svg class="git-graph" viewBox="0 0 120 200" aria-hidden="true" focusable="false">
          <path d="M30 0 V200" fill="none" stroke="#b9c9e8" stroke-width="2"/>
          <path d="M30 78 C30 58 80 62 80 42 V18 M80 118 C80 98 30 102 30 122" fill="none" stroke="#9fd3ac" stroke-width="2"/>
          <circle cx="30" cy="30" r="6" fill="#fff" stroke="#2e5aac" stroke-width="2.5"/>
          <circle cx="80" cy="18" r="5" fill="#fff" stroke="#1f883d" stroke-width="2.5"/>
          <circle cx="30" cy="78" r="6" fill="#fff" stroke="#2e5aac" stroke-width="2.5"/>
          <circle cx="30" cy="122" r="6" fill="#2e5aac"/>
          <circle cx="30" cy="172" r="6" fill="#fff" stroke="#2e5aac" stroke-width="2.5"/>
        </svg>
        <div class="repository-summary__text">
          <p class="eyebrow">Repository Snapshot</p>
          <h1>{{ repositoryLabel }}</h1>
          <p class="snapshot-note">浏览和搜索均基于本地快照<span class="commit-chip"><i aria-hidden="true"></i>{{ activeProvider.snapshot.commitSha.slice(0, 7) }}</span></p>
        </div>
        <button class="button button--secondary" :disabled="browser.loading.value || mutationBusy" @click="refreshRepository"><AppIcon name="refresh" />刷新快照</button>
      </section>

      <section class="toolbar">
        <BreadcrumbNav :path="browser.currentPath.value" :breadcrumbs="browser.breadcrumbs.value" @navigate="browser.navigate" @up="browser.goUp" />
        <div class="toolbar-actions">
          <button class="button button--secondary" :disabled="!canMutate" :title="canMutate ? '' : '需要 PAT 才能写入'" @click="mutations.clearError(); showCreateFolder = true"><AppIcon name="folder" />新建文件夹</button>
          <button class="button button--primary" :disabled="!canMutate" :title="canMutate ? '' : '需要 PAT 才能写入'" @click="mutations.clearError(); showUpload = true"><AppIcon name="upload" />上传文件</button>
        </div>
      </section>

      <div v-if="browser.searchActive.value" class="search-banner"><span>搜索“{{ browser.searchQuery.value }}”：{{ browser.entries.value.length }} 个结果</span><button class="button button--ghost" @click="browser.clearSearch">清除搜索</button></div>

      <BatchActionBar
        :count="selection.count.value"
        :all-selected="selection.allSelected.value"
        :some-selected="selection.someSelected.value"
        :busy="downloadBusy"
        @toggle-all="selection.toggleAll"
        @clear="selection.clear"
        @download="prepareBatchDownload"
      />

      <FileBrowser
        :entries="browser.entries.value"
        :view="configState.preferences.view"
        :loading="browser.loading.value"
        :error-message="browserError"
        :search-active="browser.searchActive.value"
        :can-mutate="canMutate"
        :download-busy="downloadBusy"
        :selected-paths="selection.selectedPaths.value"
        @open="openEntry"
        @download="downloadEntry"
        @delete="deleteTarget = $event"
        @toggle-selection="selection.toggle"
      />
    </main>

    <section v-else-if="!showConfig" class="welcome-panel"><span class="spinner" /><h1>正在连接 GitHub 仓库</h1><p>正在读取仓库快照，请稍候…</p></section>

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
    <UploadDialog :open="showUpload" :busy="mutationBusy" :snapshot="activeProvider?.snapshot" :directory="browser.currentPath.value" :status="mutationStatus" :error="mutationError" @submit="submitUpload" @close="showUpload = false" />
    <CreateFolderDialog :open="showCreateFolder" :busy="mutationBusy" :error="mutationError" @submit="submitCreateFolder" @close="showCreateFolder = false" />
    <ConfirmDialog :open="Boolean(deleteTarget)" title="确认删除" :message="deleteMessage" confirm-text="确认删除" :busy="mutationBusy" danger @confirm="confirmDelete" @close="deleteTarget = null" />
    <PreviewModal :state="preview.state" :error-message="previewError" :download-busy="preview.state.downloadBusy" @close="preview.close" @download="downloadEntry" />
    <BatchDownloadDialog :state="batchDownload.state" :error-message="batchDownloadError" @start="startBatchDownload" @cancel="batchDownload.cancel" @close="batchDownload.close" />
    <AppToast :state="toast.state" @close="toast.close" />
  </div>
</template>
