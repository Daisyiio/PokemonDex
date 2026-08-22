import { onActivated, onDeactivated, ref } from 'vue'

export function useInfiniteScroll(
  loadMoreFn: () => Promise<void>,
  canLoadMore: () => boolean,
) {
  const loadingMore = ref(false)

  function onScroll() {
    if (loadingMore.value || !canLoadMore()) return
    const bottom =
      document.documentElement.scrollHeight -
      document.documentElement.scrollTop -
      document.documentElement.clientHeight
    if (bottom < 300) {
      loadingMore.value = true
      loadMoreFn().finally(() => {
        loadingMore.value = false
      })
    }
  }

  onActivated(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
  })

  onDeactivated(() => {
    window.removeEventListener('scroll', onScroll)
  })

  return { loadingMore, onScroll }
}
