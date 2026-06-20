<script setup lang="ts">
import { onMounted } from 'vue';
import FEACanvas from './components/FEACanvas.vue';
import ElementInfo from './components/ElementInfo.vue';
import MeshControls from './components/MeshControls.vue';
import WorkingConditionPanel from './components/WorkingConditionPanel.vue';
import ConditionComparison from './components/ConditionComparison.vue';
import { useFEAStore } from './store/fea';

const store = useFEAStore();

onMounted(() => {
  store.loadPreset('cantilever');
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <header class="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-lg font-bold text-purple-400">
          🔬 有限元应力热力图可视化
        </h1>
        <div
          v-if="store.currentCondition"
          class="text-xs bg-sky-900/50 text-sky-300 px-3 py-1 rounded-full border border-sky-700"
        >
          当前工况: <span class="font-bold">{{ store.currentCondition.name }}</span>
        </div>
      </div>
      <div class="text-xs text-slate-500">
        节点: {{ store.model.nodes.length }} |
        单元: {{ store.model.elements.length }} |
        工况: {{ store.workingConditions.length }}
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <div class="flex-1 p-3" style="width: 75%">
        <ConditionComparison v-if="store.comparisonMode" />
        <FEACanvas v-else />
      </div>

      <div class="w-[25%] min-w-[260px] bg-slate-900 border-l border-slate-800 p-3 flex flex-col gap-3 overflow-y-auto">
        <WorkingConditionPanel />
        <MeshControls />
        <ElementInfo />
      </div>
    </div>

    <footer class="bg-slate-900 border-t border-slate-800 px-6 py-2 flex items-center gap-6 text-xs text-slate-400">
      <span>
        最大应力:
        <span class="text-red-400 font-bold">
          {{ store.result ? (store.maxStress / 1e6).toFixed(2) + ' MPa' : '—' }}
        </span>
      </span>
      <span>
        最大位移:
        <span class="text-amber-400 font-bold">
          {{ store.result ? (store.maxDisplacement * 1000).toFixed(3) + ' mm' : '—' }}
        </span>
      </span>
      <span>
        节点数: <span class="text-slate-200">{{ store.model.nodes.length }}</span>
      </span>
      <span>
        单元数: <span class="text-slate-200">{{ store.model.elements.length }}</span>
      </span>
      <span class="ml-auto text-slate-600">
        热力图: {{ store.heatmapMode }}
        <span v-if="store.comparisonMode" class="ml-2 text-amber-500">
          · 对比模式
        </span>
      </span>
    </footer>
  </div>
</template>
