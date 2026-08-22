<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string | null | undefined
  fallback?: string
  alt?: string
}>()

const state = ref<'primary' | 'fallback' | 'failed'>('primary')

watch(
  () => props.src,
  () => {
    state.value = 'primary'
  }
)

function onError() {
  if (state.value === 'primary' && props.fallback) {
    state.value = 'fallback'
  } else {
    state.value = 'failed'
  }
}
</script>

<template>
  <img
    v-if="state === 'primary' && src"
    :src="src"
    :alt="alt"
    class="safe-img"
    loading="lazy"
    decoding="async"
    @error="onError"
  />
  <img
    v-else-if="state === 'fallback' && fallback"
    :src="fallback"
    :alt="alt"
    class="safe-img"
    loading="lazy"
    decoding="async"
    @error="onError"
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
.safe-img {
  animation: img-fade-in 0.4s ease;
}
@keyframes img-fade-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
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