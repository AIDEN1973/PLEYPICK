<template>
  <div class="metadata-management">
    <div class="header">
      <h1>🤖 AI 메타데이터 관리</h1>
      <p class="subtitle">AI 메타데이터, CLIP 임베딩, Semantic Vector 상태를 관리합니다</p>
    </div>

    <!-- 탭 -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'metadata' }]"
        @click="activeTab = 'metadata'"
      >
        📝 AI 메타데이터
      </button>
      <button 
        :class="['tab', { active: activeTab === 'embedding' }]"
        @click="activeTab = 'embedding'"
      >
        🧠 CLIP 임베딩
      </button>
      <button 
        :class="['tab', { active: activeTab === 'semantic-vector' }]"
        @click="activeTab = 'semantic-vector'"
      >
        🎯 Semantic Vector
      </button>
      <button 
        :class="['tab', { active: activeTab === 'prompt-config' }]"
        @click="activeTab = 'prompt-config'"
      >
        🔧 프롬프트 설정
      </button>
      <button 
        :class="['tab', { active: activeTab === 'category-monitoring' }]"
        @click="activeTab = 'category-monitoring'"
      >
        📊 카테고리 모니터링
      </button>
    </div>

    <!-- 탭 콘텐츠 -->
    <div class="tab-content">
      <!-- AI 메타데이터 탭 -->
      <div v-if="activeTab === 'metadata'" class="metadata-tab">
        <MetadataTab />
      </div>

      <!-- CLIP 임베딩 탭 -->
      <div v-if="activeTab === 'embedding'" class="embedding-tab">
        <EmbeddingTab />
      </div>

      <!-- Semantic Vector 탭 -->
      <div v-if="activeTab === 'semantic-vector'" class="semantic-vector-tab">
        <SemanticVectorTab />
      </div>

      <!-- 프롬프트 설정 탭 -->
      <div v-if="activeTab === 'prompt-config'" class="prompt-config-tab">
        <PromptConfigTab />
      </div>

      <!-- 카테고리 모니터링 탭 -->
      <div v-if="activeTab === 'category-monitoring'" class="category-monitoring-tab">
        <CategoryMonitoringTab />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MetadataTab from '../components/MetadataTab.vue'
import EmbeddingTab from '../components/EmbeddingTab.vue'
import SemanticVectorTab from '../components/SemanticVectorTab.vue'
import PromptConfigTab from '../components/PromptConfigTab.vue'
import CategoryMonitoringTab from '../components/CategoryMonitoringTab.vue'

const activeTab = ref('metadata')
</script>

<style scoped>
.metadata-management {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #7f8c8d;
  font-size: 1rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 2rem;
}

.tab {
  padding: 1rem 2rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: #7f8c8d;
  transition: all 0.3s;
  margin-bottom: -2px;
}

.tab:hover {
  color: #2c3e50;
  background: #f8f9fa;
}

.tab.active {
  color: #3498db;
  border-bottom-color: #3498db;
  background: #f8f9fa;
}

.tab-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}
</style>

