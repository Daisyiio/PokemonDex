<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { initTheme, theme, toggleTheme } from './store'

onMounted(initTheme)
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="brand">
      <svg class="pokeball" viewBox="0 0 100 100" width="28" height="28" aria-hidden="true">
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
    <nav class="app-nav">
      <router-link to="/" exact-active-class="nav-on">图鉴</router-link>
      <router-link to="/moves" active-class="nav-on">招式</router-link>
      <router-link to="/abilities" active-class="nav-on">特性</router-link>
      <router-link to="/items" active-class="nav-on">道具</router-link>
      <router-link to="/type-chart" active-class="nav-on">克制</router-link>
    </nav>
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
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 20px;
  background: var(--header-bg);
  -webkit-backdrop-filter: saturate(1.8) blur(16px);
  backdrop-filter: saturate(1.8) blur(16px);
  border-bottom: 1px solid var(--header-border);
  box-shadow: var(--shadow);
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
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, color 0.15s, border-color 0.15s;
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
  border-radius: 9px;
  transition: background 0.15s, color 0.15s;
}
.app-nav a:hover {
  background: var(--surface-3);
  color: var(--text);
}
.app-nav a.nav-on {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}
.theme-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.theme-btn:active {
  transform: scale(0.92);
}
.app-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 24px 60px;
}

@media (max-width: 640px) {
  .app-header {
    height: auto;
    padding: 8px 12px;
    gap: 8px;
    flex-wrap: wrap;
    row-gap: 6px;
  }
  .logo {
    font-size: 17px;
  }
  .subtitle {
    display: none;
  }
  .pokeball {
    width: 24px;
    height: 24px;
  }
  .theme-btn {
    width: 32px;
    height: 32px;
  }
  .app-nav {
    order: 3;
    width: 100%;
    justify-content: space-around;
  }
  .app-nav a {
    font-size: 13px;
    padding: 5px 8px;
  }
  .app-main {
    padding: 14px 12px 40px;
  }
}
</style>