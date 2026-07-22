<script setup>
import { computed } from 'vue';

const props = defineProps({ name: { type: String, required: true }, size: { type: Number, default: 18 } });

const paths = {
  book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2ZM9 4h2v6l-1-.75L9 10V4Zm9 16H6V4h1v9l3-2.25L13 13V4h5v16Z',
  settings: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm9 3.5-2.2-1.1a7 7 0 0 0-.5-1.2l.8-2.3-2.5-2.5-2.3.8a7 7 0 0 0-1.2-.5L12 3H8.5L7.4 5.2a7 7 0 0 0-1.2.5l-2.3-.8-2.5 2.5.8 2.3a7 7 0 0 0-.5 1.2L-.5 12v3.5l2.2 1.1c.13.42.3.82.5 1.2l-.8 2.3 2.5 2.5 2.3-.8c.38.2.78.37 1.2.5L8.5 24H12l1.1-2.2c.42-.13.82-.3 1.2-.5l2.3.8 2.5-2.5-.8-2.3c.2-.38.37-.78.5-1.2l2.2-1.1V12Z',
  search: 'm21 20-5.2-5.2a7.5 7.5 0 1 0-1 1L20 21l1-1ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z',
  upload: 'M11 16h2V7l3.5 3.5 1.4-1.4L12 3.2 6.1 9.1l1.4 1.4L11 7v9Zm-7 4h16v-6h2v8H2v-8h2v6Z',
  folder: 'M2 5h8l2 2h10v13H2V5Zm2 2v11h16V9h-8.8l-2-2H4Z',
  file: 'M5 2h9l5 5v15H5V2Zm2 2v16h10V8h-4V4H7Z',
  trash: 'M8 4V2h8v2h5v2H3V4h5Zm-2 4h12l-1 14H7L6 8Zm3 2 .7 10h4.6L15 10H9Z',
  download: 'M11 3h2v10l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13V3ZM4 19h16v2H4v-2Z',
  grid: 'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z',
  list: 'M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h16v2H4v-2Z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z',
  refresh: 'M20 6v6h-6l2.3-2.3A6 6 0 1 0 17.8 16l1.7 1.1A8 8 0 1 1 17.7 8L20 6Z',
  up: 'm12 5 7 7-1.4 1.4L13 8.8V21h-2V8.8l-4.6 4.6L5 12l7-7Z',
};

const path = computed(() => paths[props.name] || paths.file);
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path :d="path" fill="currentColor" />
  </svg>
</template>
