<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { listEggGroups, type EggGroup } from '../api'
import ListError from '../components/ListError.vue'
import PokeCard from '../components/PokeCard.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const route = useRoute()
const groups = ref<EggGroup[]>([])
const loading = ref(true)
const error = ref('')
const openName = ref('')

function toggle(name: string) {
  openName.value = openName.value === name ? '' : name
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    groups.value = await listEggGroups()
    const q = typeof route.query.group === 'string' ? route.query.group : ''
    if (q && groups.value.some((g) => g.name === q)) {
      openName.value = q
      window.setTimeout(() => {
        document
          .getElementById(`eg-${q}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '蛋组数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>蛋组图鉴</h1>
      <div class="page-total">共 {{ groups.length }} 个蛋组</div>
    </div>

    <p class="intro">
      蛋组决定了宝可梦之间能否生蛋。同一蛋组（或任意两只同组、可互相配对）的宝可梦可以在培育屋一起生蛋。
    </p>

    <div v-if="loading" class="eg-grid">
      <div v-for="i in 8" :key="i" class="sk-card"></div>
    </div>

    <ListError v-else-if="error" :message="error" @retry="load" />

    <div v-else class="eg-list">
      <div
        v-for="g in groups"
        :id="`eg-${g.name}`"
        :key="g.name"
        class="eg-group"
        :class="{ open: openName === g.name }"
      >
        <button class="eg-head" @click="toggle(g.name)">
          <span class="eg-name">{{ g.name }}</span>
          <span class="eg-count">{{ g.count }} 只</span>
          <svg
            class="eg-chevron"
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
        <Transition name="eg">
          <div v-if="openName === g.name" class="eg-body">
            <div class="eg-members">
              <PokeCard
                v-for="m in g.members"
                :key="m.id"
                :id="m.id"
                :name-zh="m.nameZh"
                :image="m.image"
                :types="m.types"
                size="sm"
                :to="`/pokemon/${m.id}`"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 60vh;
}
.page-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.page-head h1 {
  font-size: 24px;
  margin: 0;
  color: var(--text);
}
.page-total {
  font-size: 13px;
  color: var(--text-3);
}
.intro {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.7;
}
.eg-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.eg-group {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.eg-group.open {
  border-color: var(--border);
  box-shadow: var(--shadow-hover);
}
.eg-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text);
}
.eg-head:hover {
  background: var(--surface-2);
}
.eg-name {
  font-size: 15px;
  font-weight: 700;
}
.eg-count {
  font-size: 12px;
  color: var(--text-3);
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 999px;
  padding: 2px 10px;
}
.eg-chevron {
  margin-left: auto;
  color: var(--text-3);
  transition: transform 0.2s;
}
.eg-group.open .eg-chevron {
  transform: rotate(180deg);
}
.eg-body {
  border-top: 1px solid var(--border-faint);
  padding: 14px;
}
.eg-members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}
.eg-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.eg-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.eg-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.eg-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.eg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.sk-card {
  height: 48px;
  border-radius: 14px;
  background: var(--surface);
  position: relative;
  overflow: hidden;
}
.sk-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--surface-2) 50%, transparent);
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (max-width: 640px) {
  .eg-members {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
}
</style>