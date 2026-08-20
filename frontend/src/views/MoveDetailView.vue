<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMove, type MoveDetail } from '../api'
import { imageUrl } from '../types'
import TypeBadge from '../components/TypeBadge.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import SafeImage from '../components/SafeImage.vue'

const route = useRoute()
const router = useRouter()
const move = ref<MoveDetail | null>(null)
const loading = ref(true)
const error = ref('')

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/moves')
}

const methodLabel: Record<string, string> = {
  升级: '升级',
  机器: '招式机',
  蛋: '蛋孵化',
}

onMounted(async () => {
  try {
    move.value = await getMove(route.params.id as string)
    if (!move.value?.nameZh) error.value = '未找到该招式'
  } catch {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <button class="back" @click="goBack">
      <span class="back-icon">‹</span> 返回招式图鉴
    </button>

    <div v-if="loading" class="sk-hero"></div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="move">
      <section class="mv-hero">
        <div class="mv-head">
          <h1>{{ move.nameZh }}</h1>
          <span class="mv-gen" v-if="move.generation">第 {{ move.generation }} 世代</span>
        </div>
        <div class="mv-badges">
          <TypeBadge v-if="move.type" :type="move.type" size="lg" />
          <CategoryBadge v-if="move.category" :category="move.category" size="lg" />
        </div>
        <div class="mv-stats">
          <div class="stat">
            <span class="stat-label">威力</span>
            <b>{{ move.power || '—' }}</b>
          </div>
          <div class="stat">
            <span class="stat-label">命中</span>
            <b>{{ move.accuracy || '—' }}</b>
          </div>
          <div class="stat">
            <span class="stat-label">PP</span>
            <b>{{ move.pp || '—' }}</b>
          </div>
        </div>
        <div class="mv-machines" v-if="move.machines.length">
          <span
            v-for="mc in move.machines"
            :key="mc"
            class="tm-chip"
            :class="mc.startsWith('TM') ? 'tm' : 'tr'"
          >
            {{ mc }}
          </span>
        </div>
        <p class="mv-desc" v-if="move.description">{{ move.description }}</p>
      </section>

      <section class="learners">
        <h2>可学习宝可梦 <span class="count">{{ move.learners.length }} 只</span></h2>
        <div v-if="move.learners.length === 0" class="no-learners">
          没有宝可梦能通过正常方式学会此招式
        </div>
        <div v-else class="learner-grid">
          <router-link
            v-for="l in move.learners"
            :key="l.id"
            :to="`/pokemon/${l.id}`"
            class="learner"
          >
            <div class="learner-img">
              <SafeImage
                v-if="l.image"
                :src="imageUrl('official', l.image)"
                :alt="l.nameZh"
              />
              <span v-else class="learner-unknown">?</span>
            </div>
            <div class="learner-name">#{{ l.id }} {{ l.nameZh }}</div>
            <div class="learner-methods">
              <span
                v-for="m in l.methods"
                :key="m"
                class="method"
                :class="`method-${m}`"
              >
                {{ methodLabel[m] }}
              </span>
            </div>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 60vh;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 10px;
  margin-bottom: 16px;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.back:hover {
  background: var(--surface-3);
  color: var(--text);
}
.back-icon {
  font-size: 18px;
  line-height: 1;
}
.sk-hero {
  height: 220px;
  border-radius: 18px;
  background: var(--surface);
  position: relative;
  overflow: hidden;
}
.sk-hero::after {
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
.error {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 15px;
}
.mv-hero {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 18px;
  padding: 24px;
  margin-bottom: 20px;
}
.mv-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.mv-head h1 {
  margin: 0;
  font-size: 26px;
  color: var(--text);
}
.mv-gen {
  font-size: 12px;
  color: var(--text-3);
  background: var(--surface-3);
  padding: 3px 10px;
  border-radius: 999px;
}
.mv-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.mv-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 14px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-label {
  font-size: 12px;
  color: var(--text-3);
}
.stat b {
  font-size: 18px;
  color: var(--text);
}
.mv-machines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.tm-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}
.tm-chip.tm {
  color: var(--accent);
  background: var(--accent-soft);
}
.tm-chip.tr {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
}
.mv-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-2);
}
.learners h2 {
  margin: 0 0 16px;
  font-size: 18px;
  color: var(--text);
}
.learners .count {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 400;
}
.no-learners {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 14px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 14px;
}
.learner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 12px;
}
.learner {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 12px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.learner:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.learner-img {
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 12px;
  overflow: hidden;
}
.learner-img :deep(img) {
  max-width: 68px;
  max-height: 68px;
}
.learner-img :deep(.img-fallback) {
  color: var(--text-faint);
}
.learner-unknown {
  font-size: 24px;
  color: var(--text-3);
}
.learner-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.learner-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
.method {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
}
.method-升级 {
  color: var(--accent);
  background: var(--accent-soft);
}
.method-机器 {
  color: #2980ef;
  background: rgba(41, 128, 239, 0.12);
}
.method-蛋 {
  color: #ef70ef;
  background: rgba(239, 112, 239, 0.12);
}
</style>