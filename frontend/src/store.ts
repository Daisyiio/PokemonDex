import { reactive, ref } from 'vue'

export const listState = reactive({
  search: '',
  type: '',
  gen: '',
  page: 1,
})

const THEME_KEY = 'dex-theme'

export const theme = ref<'light' | 'dark'>('light')

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  theme.value = saved === 'dark' ? 'dark' : 'light'
  applyTheme()
}

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(THEME_KEY, theme.value)
  applyTheme()
}