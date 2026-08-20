<script setup lang="ts">
import { categoryColor } from '../types'

defineProps<{
  category: string
  size?: 'sm' | 'lg'
}>()
</script>

<template>
  <span
    class="cat-badge"
    :class="size === 'lg' ? 'cat-badge-lg' : ''"
    :style="{ background: categoryColor(category) }"
  >
    <span class="picon" :class="`picon-c-${category}`" />
    <span class="cat-badge-text">{{ category }}</span>
  </span>
</template>

<style scoped>
.cat-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px 3px 4px;
  border-radius: 20px;
  line-height: 1;
}
.cat-badge-lg {
  font-size: 14px;
  padding: 5px 14px 5px 5px;
  gap: 7px;
}
.cat-badge-text {
  line-height: 1;
}
</style>