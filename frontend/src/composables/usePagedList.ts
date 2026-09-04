import { onActivated, onBeforeUnmount, ref, type Ref } from 'vue'

export interface PagedItem {
  id: string | number
}

interface UsePagedListOptions<T> {
  loader: (page: number, pageSize: number) => Promise<{
    items: T[]
    total: number
    page: number
    pageSize: number
  }>
  pageSize?: number
  debounce?: number
}

interface UsePagedListResult<T> {
  items: Ref<T[]>
  total: Ref<number>
  page: Ref<number>
  hasMore: Ref<boolean>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<string>
  load: (append?: boolean) => Promise<void>
  reset: () => void
  search: () => void
  setError: (msg: string) => void
}

/**
 * 分页列表统一封装：加载/追加/重置/错误兜底 + 请求序号防竞态。
 */
export function usePagedList<T = PagedItem>(
  options: UsePagedListOptions<T>,
): UsePagedListResult<T> {
  const { loader, pageSize = 24, debounce = 250 } = options

  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const hasMore = ref(true)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref('')

  let seq = 0
  let debounceTimer: number | undefined

  async function load(append = false): Promise<void> {
    const mySeq = ++seq
    if (append) {
      loadingMore.value = true
    } else {
      loading.value = true
      error.value = ''
    }
    try {
      const res = await loader(page.value, pageSize)
      if (mySeq !== seq) return
      items.value = append ? [...items.value, ...res.items] : res.items
      total.value = res.total
      hasMore.value = items.value.length < res.total
    } catch (e) {
      if (mySeq !== seq) return
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      if (mySeq === seq) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  function reset(): void {
    seq++
    page.value = 1
    hasMore.value = true
    items.value = [] as T[]
    error.value = ''
    load()
  }

  function search(): void {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      reset()
    }, debounce)
  }

  function setError(msg: string): void {
    error.value = msg
  }

  function onViewActivated(): void {
    if (items.value.length === 0) load()
  }

  onActivated(onViewActivated)

  onBeforeUnmount(() => {
    window.clearTimeout(debounceTimer)
  })

  return {
    items,
    total,
    page,
    hasMore,
    loading,
    loadingMore,
    error,
    load,
    reset,
    search,
    setError,
  }
}
