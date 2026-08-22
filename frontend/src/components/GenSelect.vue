<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  modelValue: number
  options: { value: number; label: string }[]
  compact?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const open = ref(false)
const wrapEl = ref<HTMLElement | null>(null)
const panelStyle = ref<{ top: string; bottom: string; left: string; maxHeight: string }>({
  top: 'auto',
  bottom: 'auto',
  left: '0px',
  maxHeight: '300px',
})

const label = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? ''
)

function pick(v: number) {
  emit('update:modelValue', v)
  open.value = false
}

function onDocClick() {
  open.value = false
}

function toggle() {
  if (!open.value) position()
  open.value = !open.value
}

// 用 fixed 定位把面板约束在视口内：根据选项数估算面板高度，下方不够时向上弹出
function position() {
  const el = wrapEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const estHeight = Math.min(props.options.length * 34 + 10, 320)
  const below = vh - r.bottom - 8
  const above = r.top - 8
  const dir = below >= estHeight || below >= above ? 'down' : 'up'

  if (dir === 'down') {
    panelStyle.value = {
      top: `${r.bottom + 6}px`,
      bottom: 'auto',
      left: `${r.left}px`,
      maxHeight: `${Math.max(120, Math.min(estHeight, below))}px`,
    }
  } else {
    panelStyle.value = {
      top: 'auto',
      bottom: `${vh - r.top + 6}px`,
      left: `${r.left}px`,
      maxHeight: `${Math.max(120, Math.min(estHeight, above))}px`,
    }
  }
}

function onResize() {
  if (open.value) position()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onResize, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onResize, true)
})
</script>

<template>
  <div ref="wrapEl" class="gs-wrap" :class="{ compact }">
    <button type="button" class="gs-select" @click.stop="toggle">
      <span class="gs-label">{{ label }}</span>
      <svg
        class="gs-chevron"
        :class="{ open }"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <Transition name="gsDrop">
      <div v-if="open" class="gs-panel" :style="panelStyle">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="gs-opt"
          :class="{ on: o.value === modelValue }"
          @click="pick(o.value)"
        >
          <span>{{ o.label }}</span>
          <svg
            v-if="o.value === modelValue"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.gs-wrap {
  position: relative;
  display: inline-flex;
}
.gs-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
  max-width: 220px;
}
.gs-wrap.compact .gs-select {
  padding: 4px 10px;
  font-size: 12px;
  max-width: 160px;
}
.gs-select:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.gs-select:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.gs-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gs-chevron {
  flex-shrink: 0;
  transition: transform 0.18s ease;
  color: var(--text-faint);
}
.gs-select:hover .gs-chevron,
.gs-chevron.open {
  color: var(--accent);
}
.gs-chevron.open {
  transform: rotate(180deg);
}
.gs-panel {
  position: fixed;
  z-index: 1100;
  min-width: 160px;
  padding: 4px;
  background: var(--drop-bg);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  overflow-y: auto;
  overflow-x: hidden;
}
.gs-wrap.compact .gs-panel {
  min-width: 148px;
}
.gs-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}
.gs-opt:hover {
  background: var(--drop-hover);
  color: var(--text);
}
.gs-opt.on {
  color: var(--accent);
  font-weight: 600;
}
.gsDrop-enter-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.gsDrop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.gsDrop-enter-from,
.gsDrop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>