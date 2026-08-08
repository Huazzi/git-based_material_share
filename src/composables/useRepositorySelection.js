import { computed, ref, watch } from 'vue';

export function useRepositorySelection(browser) {
  const selectedPaths = ref(new Set());
  const selectableEntries = computed(() => browser.entries.value || []);
  const selectedEntries = computed(() => selectableEntries.value.filter((entry) => selectedPaths.value.has(entry.path)));
  const allSelected = computed(() => selectableEntries.value.length > 0
    && selectableEntries.value.every((entry) => selectedPaths.value.has(entry.path)));
  const someSelected = computed(() => selectedEntries.value.length > 0 && !allSelected.value);

  function replace(next) {
    selectedPaths.value = new Set(next);
  }

  function clear() { replace([]); }

  function toggle(entry) {
    const next = new Set(selectedPaths.value);
    if (next.has(entry.path)) next.delete(entry.path);
    else next.add(entry.path);
    replace(next);
  }

  function toggleAll() {
    if (allSelected.value) clear();
    else replace(selectableEntries.value.map((entry) => entry.path));
  }

  function isSelected(entry) { return selectedPaths.value.has(entry.path); }

  watch(browser.viewRevision, clear);

  return {
    selectedPaths,
    selectedEntries,
    allSelected,
    someSelected,
    count: computed(() => selectedEntries.value.length),
    clear,
    toggle,
    toggleAll,
    isSelected,
  };
}
