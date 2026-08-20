<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { listEggGroups, type EggGroup } from '../api'
import { imageUrl, typeColor } from '../types'
import SafeImage from '../components/SafeImage.vue'

const route = useRoute()
const groups = ref<EggGroup[]>([])
const loading = ref(true)
const openName = ref('')

function toggle(name: string) {
  openName.value = openName.value === name ? '' : name
}

onMounted(async () => {
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
  } finally {
    loading.value = false
  }
})
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
              <router-link
                v-for="m in g.members"
                :key="m.id"
                :to="`/pokemon/${m.id}`"
                class="mem"
              >
                <div
                  class="mem-img"
                  :style="{ background: `linear-gradient(160deg, ${typeColor(m.types[0] || '一般')}22, var(--surface-2))` }"
                >
                  <SafeImage
                    v-if="m.image"
                    :src="imageUrl('official', m.image)"
                    :alt="m.nameZh"
                  />
                </div>
                <div class="mem-id">#{{ m.id }}</div>
                <div class="mem-name">{{ m.nameZh }}</div>
              </router-link>
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
  border-color: var(--accent);
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
.mem {
  text-decoration: none;
  color: inherit;
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 10px;
  text-align: center;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.mem:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-hover);
}
.mem-img {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.mem-img img {
  max-width: 64px;
  max-height: 64px;
}
.mem-id {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-faint);
  font-weight: 600;
}
.mem-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eg-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.eg-enter-from {
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