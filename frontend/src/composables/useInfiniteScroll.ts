import { onActivated, onDeactivated, onBeforeUnmount, ref, type Ref } from 'vue'

interface UseInfiniteScrollResult {
  loadingMore: Ref<boolean>
  onScroll: () => void
}

/**
 * 无限滚动：带请求序号，避免筛选/搜索变化时旧响应把旧数据 append 进来。
 */
export function useInfiniteScroll(
  loadMoreFn: () => Promise<void>,
  canLoadMore: () => boolean,
): UseInfiniteScrollResult {
  const loadingMore = ref(false)

  function onScroll() {
    if (loadingMore.value || !canLoadMore()) return
    const bottom =
      document.documentElement.scrollHeight -
      document.documentElement.scrollTop -
      document.documentElement.clientHeight
    if (bottom < 300) {
      loadingMore.value = true
      loadMoreFn()
        .catch(() => {
          /* 错误由上层统一展示 */
        })
        .finally(() => {
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

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
  })

  return { loadingMore, onScroll }
}
