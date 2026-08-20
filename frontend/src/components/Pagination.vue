<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
}>()

const emit = defineEmits<{ (e: 'change', page: number): void }>()

const pages = computed<(number | '…')[]>(() => {
  const cur = props.page
  const total = props.totalPages
  const list: (number | '…')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) list.push(i)
  } else {
    list.push(1)
    if (cur > 3) list.push('…')
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++)
      list.push(i)
    if (cur < total - 2) list.push('…')
    list.push(total)
  }
  return list
})
</script>

<template>
  <div class="pagination">
    <button class="page-btn" :disabled="page <= 1" @click="emit('change', page - 1)">
      上一页
    </button>
    <template v-for="(p, i) in pages" :key="i">
      <button v-if="p === '…'" class="page-dots" disabled>…</button>
      <button
        v-else
        class="page-num"
        :class="{ current: p === page }"
        @click="emit('change', p)"
      >
        {{ p }}
      </button>
    </template>
    <button
      class="page-btn"
      :disabled="page >= totalPages"
      @click="emit('change', page + 1)"
    >
      下一页
    </button>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-num {
  min-width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.page-num:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.page-num.current {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.page-dots {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: default;
  padding: 0 2px;
}
</style>