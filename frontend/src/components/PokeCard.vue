<script setup lang="ts">
import { imageUrl, typeColor } from '../types'
import SafeImage from './SafeImage.vue'

const props = defineProps<{
  id: string
  nameZh: string
  image?: string | null
  types?: string[]
  size?: 'md' | 'sm'
  to?: string
}>()

const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <component
    :is="props.to ? 'router-link' : 'button'"
    :to="props.to"
    type="button"
    class="poke-card"
    :class="props.size || 'md'"
    @click="props.to ? undefined : emit('click')"
  >
    <div
      class="pc-img"
      :style="{
        background: `linear-gradient(160deg, ${typeColor((props.types && props.types[0]) || '一般')}22, var(--surface-2))`,
      }"
    >
      <SafeImage v-if="props.image" :src="imageUrl('official', props.image)" :alt="props.nameZh" />
    </div>
    <div class="pc-id">#{{ props.id }}</div>
    <div class="pc-name">{{ props.nameZh }}</div>
    <slot />
  </component>
</template>

<style scoped>
.poke-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  background: var(--surface);
  color: inherit;
  text-align: center;
  text-decoration: none;
  font: inherit;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.poke-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
  border-color: var(--border);
}
.pc-img {
  height: 110px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}
.pc-img :deep(img) {
  max-width: 96px;
  max-height: 96px;
  transition: transform 0.18s;
}
.poke-card:hover .pc-img :deep(img) {
  transform: scale(1.06);
}
.pc-id {
  margin-top: 8px;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
}
.pc-name {
  font-weight: 600;
  margin: 3px 0 2px;
}
.poke-card.sm {
  padding: 8px;
}
.poke-card.sm .pc-img {
  height: 72px;
}.poke-card.sm .pc-img :deep(img) {
  max-width: 64px;
  max-height: 64px;
}
.poke-card.sm .pc-id {
  margin-top: 5px;
  font-size: 10px;
}
.poke-card.sm .pc-name {
  font-size: 12px;
}
</style>
