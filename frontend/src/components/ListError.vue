<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div class="list-error" role="alert">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
    <p class="list-error-msg">{{ message }}</p>
    <button type="button" class="retry-btn" @click="$emit('retry')">重试</button>
  </div>
</template>

<style scoped>
.list-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 16px;
  color: var(--text-3);
  text-align: center;
}
.list-error-msg {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}
.retry-btn {
  padding: 8px 20px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--surface);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.retry-btn:hover {
  background: var(--accent);
  color: var(--on-accent);
}
</style>
