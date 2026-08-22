import { onActivated, onDeactivated, onMounted, onBeforeUnmount } from 'vue'

export function useScrollMemory() {
  let savedY = 0

  onMounted(() => {
    savedY = 0
  })

  onActivated(() => {
    if (savedY > 0) window.scrollTo({ top: savedY })
    savedY = 0
  })

  onDeactivated(() => {
    savedY = window.scrollY || document.documentElement.scrollTop || 0
  })

  onBeforeUnmount(() => {
    savedY = 0
  })
}