import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import Home from './views/Home.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import NewLegoRegistration from './views/NewLegoRegistration.vue'
import SavedLegoManager from './views/SavedLegoManager.vue'
import RealtimeDetection from './views/RealtimeDetection.vue'
import IntegratedVisionDetection from './views/IntegratedVisionDetection.vue'
import ElementIdSearchTest from './views/ElementIdSearchTest.vue'
import MasterDataBuilder from './views/MasterDataBuilder.vue'
import StoreManager from './views/StoreManager.vue'
import SyntheticDatasetManager from './views/SyntheticDatasetManager.vue'
import DatasetConverter from './views/DatasetConverter.vue'
import HybridDetection from './views/HybridDetection.vue'
import AutomatedTrainingDashboard from './views/AutomatedTrainingDashboard.vue'
import StoreManagementDashboard from './views/StoreManagementDashboard.vue'
import MonitoringDashboard from './views/MonitoringDashboard.vue'
import ModelMonitoringDashboard from './views/ModelMonitoringDashboard.vue'
import SystemMonitoringDashboard from './views/SystemMonitoringDashboard.vue'
import MetadataManagement from './views/MetadataManagement.vue'
import FailedUploadManager from './views/FailedUploadManager.vue'
import QualityHealingDashboard from './views/QualityHealingDashboard.vue'
import RenderOptimizationDashboard from './views/RenderOptimizationDashboard.vue'
import CategoryManagementView from './views/CategoryManagementView.vue'
import SyntheticImageUploader from './views/SyntheticImageUploader.vue'
import PortManagement from './components/PortManagement.vue'
import ManualInspection from './views/ManualInspection.vue'
import InspectionAnalytics from './views/InspectionAnalytics.vue'
import InspectionNotes from './views/InspectionNotes.vue'
import PartToSetSearch from './views/PartToSetSearch.vue'
import MissingParts from './views/MissingParts.vue'
import SetParts from './views/SetParts.vue'
import SetInstructions from './views/SetInstructions.vue'
import PartManager from './views/PartManager.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/new-lego', name: 'NewLegoRegistration', component: NewLegoRegistration },
  { path: '/saved-lego', name: 'SavedLegoManager', component: SavedLegoManager },
  { path: '/element-search', name: 'ElementIdSearchTest', component: ElementIdSearchTest },
  { path: '/detection', name: 'RealtimeDetection', component: RealtimeDetection },
  { path: '/integrated-vision', name: 'IntegratedVisionDetection', component: IntegratedVisionDetection },
  { path: '/master-builder', name: 'MasterDataBuilder', component: MasterDataBuilder },
  { path: '/store-manager', name: 'StoreManager', component: StoreManager },
  { path: '/synthetic-dataset', name: 'SyntheticDatasetManager', component: SyntheticDatasetManager },
  { path: '/dataset-converter', name: 'DatasetConverter', component: DatasetConverter },
  { path: '/hybrid-detection', name: 'HybridDetection', component: HybridDetection },
  { path: '/automated-training', name: 'AutomatedTrainingDashboard', component: AutomatedTrainingDashboard },
  { path: '/store-management', name: 'StoreManagementDashboard', component: StoreManagementDashboard },
  { path: '/monitoring', name: 'MonitoringDashboard', component: MonitoringDashboard },
  { path: '/model-monitoring', name: 'ModelMonitoringDashboard', component: ModelMonitoringDashboard },
  { path: '/system-monitoring', name: 'SystemMonitoringDashboard', component: SystemMonitoringDashboard },
  { path: '/metadata-management', name: 'MetadataManagement', component: MetadataManagement },
  { path: '/failed-uploads', name: 'FailedUploadManager', component: FailedUploadManager },
  { path: '/quality-healing', name: 'QualityHealingDashboard', component: QualityHealingDashboard },
  { path: '/render-optimization', name: 'RenderOptimizationDashboard', component: RenderOptimizationDashboard },
  { path: '/category-management', name: 'CategoryManagementView', component: CategoryManagementView },
  { path: '/synthetic-uploader', name: 'SyntheticImageUploader', component: SyntheticImageUploader },
  { path: '/port-management', name: 'PortManagement', component: PortManagement },
  { path: '/manual-inspection', name: 'ManualInspection', component: ManualInspection },
  { path: '/inspection-history', name: 'InspectionHistory', component: InspectionAnalytics },
  { path: '/inspection-notes', name: 'InspectionNotes', component: InspectionNotes },
  { path: '/part-to-set-search', name: 'PartToSetSearch', component: PartToSetSearch },
  { path: '/missing-parts', name: 'MissingParts', component: MissingParts },
  { path: '/set-parts', name: 'SetParts', component: SetParts },
  { path: '/set-instructions', name: 'SetInstructions', component: SetInstructions },
  { path: '/parts', name: 'PartManager', component: PartManager }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
