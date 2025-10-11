import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import NewLegoRegistration from './views/NewLegoRegistration.vue'
import SavedLegoManager from './views/SavedLegoManager.vue'
import RealtimeDetection from './views/RealtimeDetection.vue'
import IntegratedVisionDetection from './views/IntegratedVisionDetection.vue'
import MasterDataBuilder from './views/MasterDataBuilder.vue'
import StoreManager from './views/StoreManager.vue'
import SyntheticDatasetManager from './views/SyntheticDatasetManager.vue'
import HybridDetection from './views/HybridDetection.vue'
import AutomatedTrainingDashboard from './views/AutomatedTrainingDashboard.vue'
import StoreManagementDashboard from './views/StoreManagementDashboard.vue'
import MonitoringDashboard from './views/MonitoringDashboard.vue'
import ModelMonitoringDashboard from './views/ModelMonitoringDashboard.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/new-lego', name: 'NewLegoRegistration', component: NewLegoRegistration },
  { path: '/saved-lego', name: 'SavedLegoManager', component: SavedLegoManager },
  { path: '/detection', name: 'RealtimeDetection', component: RealtimeDetection },
  { path: '/integrated-vision', name: 'IntegratedVisionDetection', component: IntegratedVisionDetection },
  { path: '/master-builder', name: 'MasterDataBuilder', component: MasterDataBuilder },
  { path: '/store-manager', name: 'StoreManager', component: StoreManager },
  { path: '/synthetic-dataset', name: 'SyntheticDatasetManager', component: SyntheticDatasetManager },
  { path: '/hybrid-detection', name: 'HybridDetection', component: HybridDetection },
  { path: '/automated-training', name: 'AutomatedTrainingDashboard', component: AutomatedTrainingDashboard },
  { path: '/store-management', name: 'StoreManagementDashboard', component: StoreManagementDashboard },
  { path: '/monitoring', name: 'MonitoringDashboard', component: MonitoringDashboard },
  { path: '/model-monitoring', name: 'ModelMonitoringDashboard', component: ModelMonitoringDashboard }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
