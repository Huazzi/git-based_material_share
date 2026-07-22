<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const props = defineProps({ blob: { type: Blob, required: true } });
const viewer = ref(null);
const pages = ref([]);
const currentPage = ref(1);
const loading = ref(true);
const error = ref('');
const pageElements = new Map();
const renderTasks = new Map();
let observer = null;
let loadingTask = null;
let pdfDocument = null;
let generation = 0;

function setPageElement(pageNumber, element) {
  if (element) pageElements.set(pageNumber, element);
  else pageElements.delete(pageNumber);
}

async function renderPage(pageNumber, runGeneration) {
  if (!pdfDocument || renderTasks.has(pageNumber) || runGeneration !== generation) return;
  const holder = pageElements.get(pageNumber);
  const canvas = holder?.querySelector('canvas');
  if (!canvas || canvas.dataset.rendered === 'true') return;
  const page = await pdfDocument.getPage(pageNumber);
  if (runGeneration !== generation) return;
  const viewport = page.getViewport({ scale: 1.35 });
  holder.style.minHeight = `${viewport.height}px`;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
  renderTasks.set(pageNumber, task);
  try {
    await task.promise;
    canvas.dataset.rendered = 'true';
  } catch (caught) {
    if (caught?.name !== 'RenderingCancelledException') throw caught;
  } finally {
    renderTasks.delete(pageNumber);
  }
}

function observePages(runGeneration) {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting);
    if (visible.length) {
      currentPage.value = Number(visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0].target.dataset.page);
    }
    visible.forEach((entry) => renderPage(Number(entry.target.dataset.page), runGeneration));
  }, { root: viewer.value, rootMargin: '900px 0px', threshold: [0, 0.25, 0.6] });
  pageElements.forEach((element) => observer.observe(element));
}

async function cleanup() {
  generation += 1;
  observer?.disconnect();
  observer = null;
  renderTasks.forEach((task) => task.cancel());
  renderTasks.clear();
  pageElements.forEach((element) => {
    const canvas = element.querySelector('canvas');
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  });
  pageElements.clear();
  await loadingTask?.destroy?.();
  await pdfDocument?.destroy?.();
  loadingTask = null;
  pdfDocument = null;
}

async function load(blob) {
  await cleanup();
  const runGeneration = generation;
  loading.value = true;
  error.value = '';
  try {
    loadingTask = getDocument({ data: await blob.arrayBuffer() });
    pdfDocument = await loadingTask.promise;
    if (runGeneration !== generation) return;
    pages.value = Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1);
    await nextTick();
    observePages(runGeneration);
  } catch (caught) {
    if (runGeneration === generation) error.value = `PDF 加载失败：${caught.message}`;
  } finally {
    if (runGeneration === generation) loading.value = false;
  }
}

watch(() => props.blob, load, { immediate: true });
onBeforeUnmount(cleanup);
</script>

<template>
  <div class="pdf-preview">
    <div class="pdf-status"><span>第 {{ currentPage }} / {{ pages.length || '—' }} 页</span><span>按需渲染</span></div>
    <div ref="viewer" class="pdf-viewer">
      <div v-if="loading" class="state-panel">正在解析 PDF…</div>
      <div v-else-if="error" class="state-panel state-panel--error">{{ error }}</div>
      <div v-for="pageNumber in pages" v-else :key="pageNumber" :ref="(element) => setPageElement(pageNumber, element)" class="pdf-page" :data-page="pageNumber">
        <canvas /><span>{{ pageNumber }}</span>
      </div>
    </div>
  </div>
</template>
