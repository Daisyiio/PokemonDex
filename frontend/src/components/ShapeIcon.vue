<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  shape: string
}>()

const num = computed(() => {
  const m = props.shape.match(/Body(\d+)\.png/i)
  return m ? m[1] : ''
})

const failed = ref(false)
watch(num, () => (failed.value = false))

const src = computed(() =>
  num.value ? `${import.meta.env.BASE_URL}shapes/Body${num.value}.png` : '',
)
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="`体型 ${num}`"
    class="shape-img"
    width="26"
    height="26"
    loading="lazy"
    @error="failed = true"
  />
  <svg
    v-else
    viewBox="0 0 48 48"
    width="26"
    height="26"
    fill="currentColor"
    aria-hidden="true"
  >
    <template v-if="num === '01'">
      <circle cx="35" cy="21" r="5" />
      <ellipse cx="21" cy="26" rx="12" ry="6.5" />
      <path d="M12 32v9M18 32.5v9M25 32v9M31 32.5v9" />
    </template>
    <template v-else-if="num === '02'">
      <circle cx="25" cy="17" r="7.5" />
      <path d="M17 25c-1.5-5 16-6 16-1l-1.5 9c-4 3.5-9 3.5-13 0z" />
      <path d="M19 33.5V43M29 33.5V43" />
      <path d="M20 28l-5 1M28 28l5 1" />
    </template>
    <template v-else-if="num === '03'">
      <circle cx="12" cy="15" r="5.5" />
      <path
        d="M17 15c7 0 9 6 13 9 3 2.5 8 2 8 6 0 4-4 6-8 5l-2-3c2-1 3-3 1-5-4-4-12-4-12-12z"
      />
    </template>
    <template v-else-if="num === '04'">
      <circle cx="25" cy="15" r="7" />
      <path d="M16 24c1-4 18-5 18 1l-2 9c-4 3-10 3-14 0z" />
      <path d="M18 27l-6 3M30 27l6 3" />
      <path d="M19 34v9M29 34v9" />
    </template>
    <template v-else-if="num === '05'">
      <path d="M22 9l3 3 3-3M21 12l-2-1M27 12l2-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="18" r="4.5" />
      <ellipse cx="24" cy="25" rx="5" ry="3.5" />
      <ellipse cx="24" cy="33" rx="6.5" ry="4" />
      <path d="M19 24l-6 4M29 24l6 4" />
    </template>
    <template v-else-if="num === '06'">
      <circle cx="13" cy="24" r="5" />
      <ellipse cx="27" cy="24" rx="11" ry="6" />
      <path d="M18 29v5M22 29.5v5M26 29v5M30 29.5v5M34 29v4" />
    </template>
    <template v-else-if="num === '07'">
      <path d="M10 24c8-7 14-8 20-8 3 0 5 8 8 8-3 0-5 8-8 8-6 0-12-1-20-8z" />
      <path d="M36 15c4 4.5 7 8 8 9-1 1-4 4.5-8 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </template>
    <template v-else-if="num === '08'">
      <circle cx="15" cy="15" r="5" />
      <path d="M20 15c9 0 10 7 5 10-3 2.5-7 0-5.5-3.5 1-2 3-1.5 4 0" />
    </template>
    <template v-else-if="num === '09'">
      <circle cx="24" cy="25" r="12" />
      <path d="M19 31c1.5 2 6 2 10 0" fill="none" stroke="var(--surface)" stroke-width="2" stroke-linecap="round" />
      <circle cx="20" cy="23" r="1.8" fill="var(--surface)" />
      <circle cx="28" cy="23" r="1.8" fill="var(--surface)" />
    </template>
    <template v-else-if="num === '10'">
      <circle cx="24" cy="16" r="6" />
      <path d="M23 21c-1 5-7 9-15 10 2-6 7-11 15-10z" />
      <path d="M25 21c1 5 7 9 15 10-2-6-7-11-15-10z" />
      <path d="M24 22c0 7-4 11-8 13 0-4 3-8 8-13z" />
    </template>
    <template v-else-if="num === '11'">
      <path d="M24 5l5 12 12.5.5-9.5 8 3 12L24 30l-11 7.5 3-12-9.5-8L19 17z" />
    </template>
    <template v-else-if="num === '12'">
      <circle cx="31" cy="14" r="5" />
      <path d="M27 19c-5 0-8 5-8 11l3 4 2-3 3 12 4-2-2-10c3-2 5-6 4-9-1-2-3-3-6-3z" />
      <path d="M22 30l-7 3M28 36l5 6" />
    </template>
    <template v-else-if="num === '13'">
      <circle cx="13" cy="27" r="5" />
      <path d="M17 21c0-6 15-6 17 0l-2 12c-3 4-10 4-13 0z" />
      <path d="M19 33v6M28 33v6M13 33l-2 4" />
    </template>
    <template v-else-if="num === '14'">
      <path d="M14 10h20c-1 13-5 20-10 22-5-2-9-9-10-22z" />
      <path d="M18 27c0 4-1 7-3 8M24 27c0 5 0 8-1 9M30 27c0 3 0 6-2 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="24" cy="24" r="9" opacity="0.3" />
    </template>
  </svg>
</template>

<style scoped>
.shape-img {
  flex-shrink: 0;
  object-fit: contain;
}
</style>