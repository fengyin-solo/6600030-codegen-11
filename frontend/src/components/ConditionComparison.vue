<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useFEAStore } from '../store/fea';
import { jetColormap } from '../utils/fea-solver';
import type { WorkingCondition } from '../types';

const store = useFEAStore();
const containerRef = ref<HTMLDivElement>();

function drawMiniCanvas(canvas: HTMLCanvasElement, condition: WorkingCondition) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  const { nodes, elements } = store.model;
  if (nodes.length === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const margin = 20;
  const fitScale = Math.min((W - margin * 2) / worldW, (H - margin * 2) / worldH);
  const drawScale = fitScale;
  const drawOffsetX = margin - minX * drawScale + (W - margin * 2 - worldW * drawScale) / 2;
  const drawOffsetY = margin - minY * drawScale + (H - margin * 2 - worldH * drawScale) / 2;

  function toScreen(x: number, y: number): [number, number] {
    return [x * drawScale + drawOffsetX, y * drawScale + drawOffsetY];
  }

  let values: number[] = [];
  if (condition.result) {
    switch (store.heatmapMode) {
      case 'stress':
        values = elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.stress) : 0;
        });
        break;
      case 'strain':
        values = elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.strain) : 0;
        });
        break;
      case 'force':
        values = elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.force) : 0;
        });
        break;
    }
  }

  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;

  for (const el of elements) {
    const n1 = nodes.find((n) => n.id === el.nodeIds[0]);
    const n2 = nodes.find((n) => n.id === el.nodeIds[1]);
    if (!n1 || !n2) continue;

    const [x1, y1] = toScreen(n1.x, n1.y);
    const [x2, y2] = toScreen(n2.x, n2.y);

    let color = '#475569';
    if (condition.result) {
      const r = condition.elementResults.get(el.id);
      if (r) {
        let val = 0;
        switch (store.heatmapMode) {
          case 'stress': val = Math.abs(r.stress); break;
          case 'strain': val = Math.abs(r.strain); break;
          case 'force': val = Math.abs(r.force); break;
        }
        color = jetColormap(val, minVal, maxVal);
      }
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  for (const node of nodes) {
    const [x, y] = toScreen(node.x, node.y);
    const isFixed = condition.fixedNodeIds.includes(node.id);

    if (isFixed) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    }
  }

  for (const load of condition.loads) {
    const node = nodes.find((n) => n.id === load.nodeId);
    if (!node) continue;
    const [x, y] = toScreen(node.x, node.y);

    const mag = Math.sqrt(load.fx ** 2 + load.fy ** 2);
    if (mag === 0) continue;

    const arrowLen = 12;
    const dx = (load.fx / mag) * arrowLen;
    const dy = (load.fy / mag) * arrowLen;

    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function redrawAll() {
  if (!containerRef.value) return;
  const canvases = containerRef.value.querySelectorAll('canvas');
  const conditions = store.solvedConditions;

  canvases.forEach((canvas, i) => {
    if (conditions[i]) {
      drawMiniCanvas(canvas, conditions[i]);
    }
  });
}

function getMaxStress(cond: WorkingCondition): number {
  if (!cond.result) return 0;
  return cond.result.maxStress;
}

function getMaxDisplacement(cond: WorkingCondition): number {
  if (!cond.result) return 0;
  return cond.result.maxDisplacement;
}

onMounted(() => {
  nextTick(() => {
    redrawAll();
  });
});

watch(
  () => [store.solvedConditions, store.heatmapMode, store.model],
  () => {
    nextTick(() => {
      redrawAll();
    });
  },
  { deep: true }
);
</script>

<template>
  <div class="h-full flex flex-col bg-slate-950 p-3">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-bold text-slate-200">
        📊 工况对比视图
        <span class="text-xs font-normal text-slate-500 ml-2">
          ({{ store.solvedConditions.length }} 个已求解工况)
        </span>
      </h2>
      <div class="text-xs text-slate-400">
        热力图模式: <span class="text-purple-400 font-medium">{{ store.heatmapMode === 'stress' ? '应力' : store.heatmapMode === 'strain' ? '应变' : '轴力' }}</span>
      </div>
    </div>

    <div
      v-if="store.solvedConditions.length === 0"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center text-slate-500">
        <div class="text-4xl mb-2">📊</div>
        <div class="text-sm">暂无已求解的工况</div>
        <div class="text-xs mt-1">请先添加并求解至少一个工况</div>
      </div>
    </div>

    <div
      v-else
      ref="containerRef"
      class="flex-1 grid gap-3 content-start overflow-y-auto"
      :style="{
        gridTemplateColumns: store.solvedConditions.length <= 2 ? 'repeat(auto-fill, minmax(280px, 1fr)' : 'repeat(auto-fill, minmax(240px, 1fr))'
      }"
    >
      <div
        v-for="cond in store.solvedConditions"
        :key="cond.id"
        @click="store.switchCondition(cond.id); store.toggleComparisonMode()"
        :class="[
          'bg-slate-800 rounded-lg p-3 cursor-pointer transition border-2 border',
          store.currentConditionId === cond.id
            ? 'border-sky-500 ring-2 ring-sky-500/30'
            : 'border-slate-700 hover:border-slate-600'
        ]"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-bold text-slate-200 truncate">
            {{ cond.name }}
          </div>
          <div v-if="store.currentConditionId === cond.id" class="text-[10px] text-sky-400">
            当前
          </div>
        </div>

        <canvas
          width="300"
          height="200"
          class="w-full rounded border border-slate-700"
        />

        <div class="grid grid-cols-2 gap-2 mt-2 text-[10px]">
          <div class="bg-slate-900 rounded p-1.5">
            <div class="text-slate-500">最大应力</div>
            <div class="font-bold text-red-400">
              {{ cond.result ? (getMaxStress(cond) / 1e6).toFixed(2) + ' MPa' : '—' }}
            </div>
          </div>
          <div class="bg-slate-900 rounded p-1.5">
            <div class="text-slate-500">最大位移</div>
            <div class="font-bold text-amber-400">
              {{ cond.result ? (getMaxDisplacement(cond) * 1000).toFixed(3) + ' mm' : '—' }}
            </div>
          </div>
        </div>

        <div class="mt-2 text-[9px] text-slate-500 flex justify-between">
          <span>{{ cond.loads.length }} 个载荷</span>
          <span>{{ cond.fixedNodeIds.length }} 个约束</span>
        </div>
      </div>
    </div>
  </div>
</template>
