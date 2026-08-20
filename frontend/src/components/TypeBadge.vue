<script setup lang="ts">
import { typeColor } from '../types'

defineProps<{
  type: string
  size?: 'sm' | 'lg'
}>()
</script>

<template>
  <span
    class="type-badge"
    :class="size === 'lg' ? 'type-badge-lg' : ''"
    :style="{ background: typeColor(type) }"
  >
    <span class="picon" :class="`picon-t-${type}`" />
    <span class="type-badge-text">{{ type }}</span>
  </span>
</template>

<style scoped>
.type-badge {
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
.type-badge-lg {
  font-size: 14px;
  padding: 5px 14px 5px 5px;
  gap: 7px;
}
.type-badge-text {
  line-height: 1;
}

@media (max-width: 640px) {
  .type-badge {
    width: 26px;
    height: 26px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }
  .type-badge-lg {
    width: 28px;
    height: 28px;
    padding: 0;
    gap: 0;
  }
  .type-badge-text {
    display: none;
  }
  .picon {
    width: 100%;
    background-position-x: center;
  }
}
</style>