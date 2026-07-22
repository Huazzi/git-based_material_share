import { reactive } from 'vue';

export function useToast() {
  const state = reactive({ visible: false, message: '', type: 'info' });
  let timer = null;

  function show(message, type = 'info', duration = 3200) {
    if (timer) window.clearTimeout(timer);
    Object.assign(state, { visible: true, message, type });
    timer = window.setTimeout(() => {
      state.visible = false;
    }, duration);
  }

  function close() {
    if (timer) window.clearTimeout(timer);
    state.visible = false;
  }

  return { state, show, close };
}
