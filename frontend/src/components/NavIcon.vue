<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <svg
    class="nav-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-if="name === 'dex'">
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.6 12A8.4 8.4 0 0 1 20.4 12" fill="currentColor" stroke="none" opacity="0.92" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="9.6" y1="12" x2="14.4" y2="12" />
    </g>
    <g v-else-if="name === 'moves'">
      <path d="M12 3.2l2.1 4.6 4.7.9-3.4 3.3.8 4.6-4.2-2.4-4.2 2.4.8-4.6-3.4-3.3 4.7-.9z" />
      <circle cx="9.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </g>
    <g v-else-if="name === 'abilities'">
      <path d="M12 3.4l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </g>
    <g v-else-if="name === 'items'">
      <path d="M5.5 7.5h13l-.7 12.4a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z" />
      <path d="M9 7.5V5.8a3 3 0 0 1 6 0v1.7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </g>
    <g v-else-if="name === 'egg'">
      <ellipse cx="11.8" cy="13" rx="7.2" ry="8.6" transform="rotate(-18 11.8 13)" />
      <ellipse cx="9.6" cy="10.6" rx="1.9" ry="1.4" fill="currentColor" stroke="none" transform="rotate(-18 9.6 10.6)" />
    </g>
    <g v-else-if="name === 'genetics'">
      <path d="M6 4v16M18 4v16" />
      <path d="M6 12h12" />
      <path d="M4 6.5l4 4M4 17.5l4-4M20 6.5l-4 4M20 17.5l-4-4" />
    </g>
    <g v-else-if="name === 'types'">
      <path d="M12 3.4l9.2 16.4H2.8z" />
      <line x1="12" y1="10" x2="12" y2="15" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </g>
    <circle v-else cx="12" cy="12" r="8" />
  </svg>
</template>

<style scoped>
.nav-icon {
  display: block;
  flex-shrink: 0;
}
</style>