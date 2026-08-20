<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string
  alt?: string
}>()

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    :alt="alt"
    loading="lazy"
    @error="failed = true"
  />
  <span v-else class="img-fallback" aria-hidden="true">
    <svg viewBox="0 0 100 100" stroke="currentColor" stroke-width="6" fill="none">
      <circle cx="50" cy="50" r="44" />
      <path d="M6 50 A44 44 0 0 1 94 50 Z" fill="currentColor" stroke="none" opacity="0.28" />
      <path d="M6 50 h88" />
      <circle cx="50" cy="50" r="12" fill="var(--surface)" />
    </svg>
  </span>
</template>

<style scoped>
.img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-faint);
}
.img-fallback svg {
  width: 64%;
  max-width: 60px;
  height: auto;
}
</style>