import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import NewLegoRegistration from './views/NewLegoRegistration.vue'
import SavedLegoManager from './views/SavedLegoManager.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/new-lego', name: 'NewLegoRegistration', component: NewLegoRegistration },
  { path: '/saved-lego', name: 'SavedLegoManager', component: SavedLegoManager }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
