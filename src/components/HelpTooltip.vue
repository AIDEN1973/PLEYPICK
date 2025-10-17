<template>
  <div class="help-tooltip-container">
    <span class="help-icon" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false">
      ❓
    </span>
    <div v-if="showTooltip" class="tooltip" :class="position">
      <div class="tooltip-content">
        <h4>{{ title }}</h4>
        <p>{{ content }}</p>
        <div v-if="examples && examples.length > 0" class="examples">
          <strong>예시:</strong>
          <ul>
            <li v-for="example in examples" :key="example">{{ example }}</li>
          </ul>
        </div>
      </div>
      <div class="tooltip-arrow"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  examples: {
    type: Array,
    default: () => []
  },
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value)
  }
})

const showTooltip = ref(false)
</script>

<style scoped>
.help-tooltip-container {
  position: relative;
  display: inline-block;
  margin-left: 4px;
}

.help-icon {
  cursor: help;
  font-size: 14px;
  color: #6b7280;
  transition: color 0.2s;
}

.help-icon:hover {
  color: #3b82f6;
}

.tooltip {
  position: absolute;
  z-index: 1000;
  background: #1f2937;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 250px;
  max-width: 400px;
  font-size: 14px;
  line-height: 1.3;
}

.tooltip.top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}

.tooltip.bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

.tooltip.left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 8px;
}

.tooltip.right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
}

.tooltip-content h4 {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: #f9fafb;
  line-height: 1.2;
}

.tooltip-content p {
  margin: 0 0 6px 0;
  color: #d1d5db;
  line-height: 1.3;
}

.examples {
  margin-top: 6px;
}

.examples ul {
  margin: 2px 0 0 0;
  padding-left: 14px;
}

.examples li {
  margin: 1px 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.2;
}

.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
}

.tooltip.top .tooltip-arrow {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #1f2937;
}

.tooltip.bottom .tooltip-arrow {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #1f2937;
}

.tooltip.left .tooltip-arrow {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #1f2937;
}

.tooltip.right .tooltip-arrow {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #1f2937;
}
</style>
