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

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: '宝可梦图鉴' },
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
      meta: { title: '招式图鉴' },
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
      meta: { title: '特性图鉴' },
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
      meta: { title: '道具图鉴' },
    },
    {
      path: '/type-chart',
      name: 'type-chart',
      component: TypeChartView,
      meta: { title: '属性克制' },
    },
    {
      path: '/egg-groups',
      name: 'egg-groups',
      component: EggGroupsView,
      meta: { title: '蛋组图鉴' },
    },
    {
      path: '/breeding',
      name: 'breeding',
      component: BreedingSimView,
      meta: { title: '孵蛋模拟器' },
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router