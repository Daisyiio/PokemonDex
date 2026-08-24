import { reactive, ref } from 'vue'

export const listState = reactive({
  search: '',
  types: [] as string[],
  gen: '',
  page: 1,
})

const THEME_KEY = 'dex-theme'

export const theme = ref<'light' | 'dark'>('dark')

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') {
    theme.value = saved
  } else {
    theme.value = 'dark'
  }
  applyTheme()
}

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(THEME_KEY, theme.value)
  applyTheme()
}