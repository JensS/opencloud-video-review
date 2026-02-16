import { watch, type Ref, onUnmounted } from 'vue'

export function onClickOutside(target: Ref<HTMLElement | null>, callback: () => void) {
  function handler(e: MouseEvent) {
    if (target.value && !target.value.contains(e.target as Node)) {
      callback()
    }
  }

  watch(target, (el, _, onCleanup) => {
    if (el) {
      document.addEventListener('click', handler, true)
      onCleanup(() => document.removeEventListener('click', handler, true))
    }
  }, { immediate: true })
}
