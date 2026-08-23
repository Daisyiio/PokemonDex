<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getItem, type ItemDetail } from '../api'
import { imageUrl } from '../types'
import SafeImage from '../components/SafeImage.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const route = useRoute()
const router = useRouter()
const item = ref<ItemDetail | null>(null)
const loading = ref(true)
const error = ref('')

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/items')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    item.value = await getItem(route.params.id as string)
    if (!item.value?.nameZh) error.value = '未找到该道具'
  } catch {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, load)

onMounted(load)
</script>

<template>
  <div class="page">
    <button class="back" @click="goBack">
      <span class="back-icon">‹</span> 返回道具图鉴
    </button>

    <div v-if="loading" class="sk-hero"></div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="item">
      <section class="it-hero">
        <div class="it-head">
          <div class="it-icon-big">
            <SafeImage v-if="item.icon" :src="imageUrl('items', item.icon)" :alt="item.nameZh" />
            <span v-else class="it-unknown">?</span>
          </div>
          <div class="it-info">
            <h1>{{ item.nameZh }}</h1>
            <div class="it-meta">
              <span class="it-cat" v-if="item.category">{{ item.category }}</span>
              <span class="it-native" v-if="item.nameEn">{{ item.nameEn }}</span>
            </div>
          </div>
        </div>
        <p class="it-desc" v-if="item.description">{{ item.description }}</p>
      </section>

      <!-- PokeAPI 干净数据 -->
      <section v-if="item.poke" class="extra-section poke-section">
        <div v-if="item.poke.effect" class="extra-block">
          <h3>道具功效</h3>
          <p>{{ item.poke.effect }}</p>
        </div>
        <div v-if="item.poke.attributes && item.poke.attributes.length" class="extra-block">
          <h3>属性</h3>
          <div class="extra-tags">
            <span v-for="a in item.poke.attributes" :key="a" class="extra-tag">{{ a }}</span>
          </div>
        </div>
        <div v-if="item.poke.prices && item.poke.prices.length" class="extra-block">
          <h3>买入 / 卖出价格</h3>
          <div v-for="(p, i) in item.poke.prices" :key="i" class="extra-desc">
            <span class="extra-game">{{ p.game }}</span>
            <span class="extra-text">买入 {{ p.buy || '—' }} / 卖出 {{ p.sell || '—' }}</span>
          </div>
        </div>
      </section>

      <!-- 额外数据 -->
      <section v-if="item.extra" class="extra-section">
        <div v-if="item.extra.usage" class="extra-block">
          <h3>使用信息</h3>
          <div class="extra-grid">
            <div v-for="(val, key) in item.extra.usage" :key="key" class="extra-row2">
              <span class="extra-label">{{ key }}</span>
              <span class="extra-value">{{ val }}</span>
            </div>
          </div>
        </div>

        <div v-if="item.extra.effect" class="extra-block">
          <h3>道具功效</h3>
          <p>{{ item.extra.effect }}</p>
        </div>

        <div v-if="item.extra.locations && item.extra.locations.length" class="extra-block">
          <h3>获取地点</h3>
          <div v-for="(loc, i) in item.extra.locations" :key="i" class="extra-desc">
            <span class="extra-game">{{ loc.version }}</span>
            <span class="extra-text">{{ loc.location }}</span>
          </div>
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
  height: 180px;
  border-radius: 16px;
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
.it-hero {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
}
.it-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}
.it-icon-big {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 14px;
}
.it-icon-big :deep(img) {
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}
.it-unknown {
  font-size: 28px;
  color: var(--text-3);
}
.it-info h1 {
  margin: 0;
  font-size: 24px;
  color: var(--text);
}
.it-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.it-cat {
  font-size: 11px;
  color: var(--text-2);
  background: var(--surface-3);
  padding: 3px 10px;
  border-radius: 999px;
}
.it-native {
  font-size: 11px;
  color: var(--text-3);
  background: var(--surface-3);
  padding: 3px 10px;
  border-radius: 999px;
}
.it-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
}
.extra-section {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 16px 20px;
  box-shadow: var(--shadow);
}
.extra-block {
  margin-bottom: 14px;
}
.extra-block:last-child {
  margin-bottom: 0;
}
.extra-block h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text);
}
.extra-block p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-2);
  white-space: pre-line;
}
.extra-desc {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--border-faint);
  font-size: 13px;
  line-height: 1.6;
}
.extra-desc:last-child {
  border-bottom: none;
}
.extra-game {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-3);
  min-width: 70px;
}
.extra-text {
  color: var(--text-2);
}
.extra-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.extra-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
}
.poke-section h3 span.tag {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
  background: var(--accent-soft);
  color: var(--accent);
  padding: 1px 8px;
  border-radius: 999px;
  margin-left: 6px;
  vertical-align: middle;
}
.extra-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.extra-row2 {
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
}
.extra-label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-3);
  min-width: 64px;
}
.extra-value {
  color: var(--text-2);
}
</style>