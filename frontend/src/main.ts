import { createApp } from 'vue'
import './style.css'
import './assets/poke-sprite.css'
import App from './App.vue'
import router from './router'

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  if (title) document.title = title
})

createApp(App).use(router).mount('#app')