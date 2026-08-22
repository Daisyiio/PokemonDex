<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { initTheme, theme, toggleTheme } from './store'
import NavIcon from './components/NavIcon.vue'
import BackToTop from './components/BackToTop.vue'

const route = useRoute()
const router = useRouter()

const navItems = [
  { to: '/', exact: true, icon: 'dex', label: '图鉴' },
  { to: '/moves', icon: 'moves', label: '招式' },
  { to: '/abilities', icon: 'abilities', label: '特性' },
  { to: '/items', icon: 'items', label: '道具' },
  { to: '/egg-groups', icon: 'egg', label: '蛋组' },
  { to: '/genetics', icon: 'genetics', label: '遗传' },
  { to: '/type-chart', icon: 'types', label: '克制' },
]

const DETAIL_ROUTES = ['pokemon-detail', 'move-detail', 'ability-detail']

// h5 顶栏标题点击目标：详情页回对应列表，列表页回首页；首页不可点
const headerHref = computed<string | null>(() => {
  switch (route.name) {
    case 'home':
      return null
    case 'pokemon-detail':
      return '/'
    case 'move-detail':
      return '/moves'
    case 'ability-detail':
      return '/abilities'
    default:
      return '/'
  }
})

const isDetail = computed(() => DETAIL_ROUTES.includes(route.name as string))

function goHeaderBack() {
  if (isDetail.value) {
    router.back()
  } else if (headerHref.value) {
    router.push(headerHref.value)
  }
}

onMounted(initTheme)
</script>

<template>
  <header class="app-header frosted">
    <router-link to="/" class="brand">
      <svg class="pokeball" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true">
        <defs>
          <clipPath id="pokeball-clip">
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#fff" />
        <g clip-path="url(#pokeball-clip)">
          <path d="M4 50 A46 46 0 0 1 96 50 Z" fill="#dc0a2d" />
          <rect x="4" y="44" width="92" height="12" fill="#222" />
        </g>
        <circle cx="50" cy="50" r="15" fill="#fff" stroke="#222" stroke-width="5" />
      </svg>
      <span class="logo">宝可梦图鉴</span>
      <span class="subtitle">POKÉDEX</span>
    </router-link>
    <nav class="app-nav" aria-label="主导航">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="{ 'nav-on': item.exact ? route.path === item.to : route.path.startsWith(item.to) }"
      >
        {{ item.label }}
      </router-link>
    </nav>
    <template v-if="isDetail">
      <button class="header-back" @click="goHeaderBack" aria-label="返回上一步">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="header-title" aria-live="polite">
        <span class="header-title-main">{{ route.meta.title }}</span>
        <span v-if="route.meta.subtitle" class="header-title-sub">{{ route.meta.subtitle }}</span>
      </div>
    </template>
    <router-link v-else-if="headerHref" :to="headerHref" class="header-title" aria-live="polite">
      <span class="header-title-main">{{ route.meta.title }}</span>
      <span v-if="route.meta.subtitle" class="header-title-sub">{{ route.meta.subtitle }}</span>
    </router-link>
    <div v-else class="header-title" aria-live="polite">
      <span class="header-title-main">{{ route.meta.title }}</span>
      <span v-if="route.meta.subtitle" class="header-title-sub">{{ route.meta.subtitle }}</span>
    </div>
    <button
      class="theme-btn"
      :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
      @click="toggleTheme"
    >
      <svg
        v-if="theme === 'light'"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  </header>

  <main class="app-main">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page" appear>
        <KeepAlive :max="12">
          <component :is="Component" :key="route.name" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </main>

  <nav class="tab-bar frosted" aria-label="底部导航">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="tab-item"
      :class="{ 'tab-on': item.exact ? route.path === item.to : route.path.startsWith(item.to) }"
    >
      <NavIcon :name="item.icon" />
      <span class="tab-label">{{ item.label }}</span>
    </router-link>
  </nav>

  <footer class="app-footer">
    <span>宝可梦相关名称、角色、图像及数据素材版权归 © The Pokémon Company / Nintendo / Game Freak 所有。</span>
    <span>本项目为个人学习与交流用途，数据仅供参考，不使用于任何商业场景。</span>
  </footer>

  <BackToTop />
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 58px;
  padding: 0 20px;
  background: var(--header-bg);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--header-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}
.pokeball {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}
.logo {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text);
}
.subtitle {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  opacity: 0.85;
  text-transform: uppercase;
  color: var(--text-3);
  align-self: flex-end;
  padding-bottom: 4px;
}
.theme-btn {
  margin-left: auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--surface);
  color: var(--text-2);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: background 0.2s, transform 0.2s, color 0.2s, box-shadow 0.2s;
}
.theme-btn:hover {
  color: var(--accent);
  box-shadow: var(--shadow-hover);
}
.theme-btn:active {
  transform: scale(0.9);
}
.app-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.app-nav a {
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 999px;
  transition: background 0.18s, color 0.18s;
}
.app-nav a:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.app-nav a.nav-on {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}
.app-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 24px 60px;
}
.app-footer {
  text-align: center;
  padding: 24px 24px 40px;
  max-width: 1100px;
  margin: 0 auto;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-faint);
  border-top: 1px solid var(--border-faint);
  margin-top: 8px;
}
.app-footer span {
  display: block;
}
@media (min-width: 769px) {
  .tab-bar {
    display: none;
  }
}

/* ===== 移动端 iPhone 风格底部 Tab ===== */
.tab-bar {
  display: none;
}
.header-title {
  display: none;
}
.header-back {
  display: none;
}
@media (max-width: 768px) {
  .app-header {
    height: 54px;
    padding: 0 16px;
  }
  .app-nav {
    display: none;
  }
  .brand {
    display: none;
  }
  .logo {
    font-size: 18px;
  }
  .subtitle,
  .pokeball,
  .logo {
    display: none;
  }
  .theme-btn {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .header-back {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    background: transparent;
    color: var(--accent);
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    margin-right: 2px;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.15s;
  }
  .header-back:active {
    background: var(--accent-soft);
    transform: scale(0.92);
  }
  .header-title {
    position: static;
    transform: none;
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: flex-start;
    gap: 6px;
    flex: 1;
    min-width: 0;
    padding: 0 12px 0 8px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .header-title-main {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: var(--text);
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-title-sub {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.3px;
    color: var(--text-3);
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .app-main {
    padding: 14px 14px 100px;
  }

  .app-footer {
    display: block;
    padding: 16px 20px calc(76px + env(safe-area-inset-bottom));
    text-align: center;
    font-size: 11px;
    line-height: 1.7;
    color: var(--text-faint);
  }

  .tab-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    background: var(--header-bg);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    backdrop-filter: saturate(180%) blur(24px);
    border-top: 1px solid var(--header-border);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    justify-content: space-around;
    align-items: flex-start;
  }
  .tab-item {
    flex: 1;
    max-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 2px;
    text-decoration: none;
    color: var(--text-3);
    border-radius: 12px;
    transition: color 0.18s, transform 0.18s;
    -webkit-tap-highlight-color: transparent;
  }
  .tab-item:active {
    transform: scale(0.9);
  }
  .tab-label {
    font-size: 10px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.2px;
  }
  .tab-item.tab-on {
    color: var(--accent);
    font-weight: 600;
  }
  .tab-item.tab-on .nav-icon {
    filter: drop-shadow(0 1px 3px var(--accent-soft));
  }
}
</style>