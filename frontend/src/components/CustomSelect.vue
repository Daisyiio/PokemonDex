<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  placeholder?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const activeIndex = ref(-1)
const btnEl = ref<HTMLButtonElement | null>(null)
const menuStyle = ref({ top: '0px', left: '0px', width: '0px' })

const selectedLabel = () =>
  props.options.find((o) => o.value === props.modelValue)?.label

function position() {
  const el = btnEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  menuStyle.value = {
    top: `${r.bottom + 6}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
  }
}

function onMove() {
  if (open.value) position()
}

function close() {
  open.value = false
  activeIndex.value = -1
  window.removeEventListener('scroll', onMove, true)
  window.removeEventListener('resize', onMove)
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    activeIndex.value = Math.max(
      0,
      props.options.findIndex((o) => o.value === props.modelValue)
    )
    position()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
  } else {
    window.removeEventListener('scroll', onMove, true)
    window.removeEventListener('resize', onMove)
  }
}

function pick(v: string) {
  emit('update:modelValue', v)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  const n = props.options.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) toggle()
    else activeIndex.value = activeIndex.value >= n - 1 ? 0 : activeIndex.value + 1
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) toggle()
    else activeIndex.value = activeIndex.value <= 0 ? n - 1 : activeIndex.value - 1
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (open.value) pick(props.options[activeIndex.value]?.value ?? props.modelValue)
    else toggle()
  } else if (e.key === 'Escape') {
    close()
  }
}

function onDocClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.sel-wrap')) close()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  close()
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="sel-wrap">
    <button
      ref="btnEl"
      type="button"
      class="sel-btn"
      :class="{ open }"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="sel-label" :class="{ ph: !selectedLabel() }">
        {{ selectedLabel() || placeholder }}
      </span>
      <svg
        class="sel-arrow"
        :class="{ open }"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <Transition name="sel">
      <div v-if="open" class="sel-menu" :style="menuStyle">
        <button
          v-for="(o, i) in options"
          :key="o.value"
          type="button"
          class="sel-opt"
          :class="{ on: o.value === modelValue, active: i === activeIndex }"
          :style="{ animationDelay: `${i * 24}ms` }"
          @click="pick(o.value)"
          @mouseenter="activeIndex = i"
        >
          {{ o.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sel-wrap {
  position: relative;
}
.sel-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.sel-btn:hover {
  border-color: var(--accent);
}
.sel-btn.open {
  border-color: var(--accent);
}
.sel-label {
  white-space: nowrap;
}
.sel-label.ph {
  color: var(--text-3);
}
.sel-arrow {
  color: var(--text-3);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.sel-arrow.open {
  transform: rotate(180deg);
}
.sel-menu {
  position: fixed;
  z-index: 30;
  background: var(--drop-bg);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  padding: 4px;
  overflow-y: auto;
  max-height: 60vh;
}
.sel-opt {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  animation: sel-opt-in 0.24s ease both;
}
.sel-opt:hover,
.sel-opt.active {
  background: var(--drop-hover);
  color: var(--text);
}
.sel-opt.on {
  color: var(--accent);
  font-weight: 600;
}
@keyframes sel-opt-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}
.sel-enter-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform-origin: top center;
}
.sel-leave-active {
  transition: opacity 0.12s ease;
}
.sel-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.sel-leave-to {
  opacity: 0;
}
</style>