import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PokemonDetail from '../views/PokemonDetail.vue'
import MovesView from '../views/MovesView.vue'
import MoveDetailView from '../views/MoveDetailView.vue'
import AbilitiesView from '../views/AbilitiesView.vue'
import AbilityDetailView from '../views/AbilityDetailView.vue'
import ItemsView from '../views/ItemsView.vue'
import TypeChartView from '../views/TypeChartView.vue'
import EggGroupsView from '../views/EggGroupsView.vue'
import BreedingSimView from '../views/BreedingSimView.vue'
import GeneticsView from '../views/GeneticsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: '宝可梦图鉴', subtitle: '全国图鉴' },
    },
    {
      path: '/pokemon/:id',
      name: 'pokemon-detail',
      component: PokemonDetail,
      meta: { title: '宝可梦图鉴' },
    },
    {
      path: '/moves',
      name: 'moves',
      component: MovesView,
      meta: { title: '招式图鉴', subtitle: '招式百科' },
    },
    {
      path: '/moves/:id',
      name: 'move-detail',
      component: MoveDetailView,
      meta: { title: '招式详情' },
    },
    {
      path: '/abilities',
      name: 'abilities',
      component: AbilitiesView,
      meta: { title: '特性图鉴', subtitle: '特性百科' },
    },
    {
      path: '/abilities/:id',
      name: 'ability-detail',
      component: AbilityDetailView,
      meta: { title: '特性详情' },
    },
    {
      path: '/items',
      name: 'items',
      component: ItemsView,
      meta: { title: '道具图鉴', subtitle: '道具百科' },
    },
    {
      path: '/type-chart',
      name: 'type-chart',
      component: TypeChartView,
      meta: { title: '属性克制', subtitle: '克制 · 抵抗 · 无效' },
    },
    {
      path: '/egg-groups',
      name: 'egg-groups',
      component: EggGroupsView,
      meta: { title: '蛋组图鉴', subtitle: '培育查询' },
    },
    {
      path: '/breeding',
      name: 'breeding',
      component: BreedingSimView,
      meta: { title: '孵蛋模拟器', subtitle: '目标驱动 · 遗传模拟' },
    },
    {
      path: '/genetics',
      name: 'genetics',
      component: GeneticsView,
      meta: { title: '蛋招式遗传规划', subtitle: '自动推导遗传路径' },
    },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.name === 'home') return false
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router