<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)

function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop || 0
  visible.value = y > 400
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="to-top">
    <button v-if="visible" class="to-top" @click="scrollTop" aria-label="返回顶部">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.to-top {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 40;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-2);
  box-shadow: var(--shadow-hover);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.to-top:hover {
  border-color: var(--border);
  color: var(--text);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
.to-top:active {
  transform: scale(0.94);
}
.to-top-enter-active,
.to-top-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}
.to-top-enter-from,
.to-top-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (max-width: 768px) {
  .to-top {
    right: 14px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    width: 38px;
    height: 38px;
  }
}
</style>