<script setup lang="ts">
import { ref } from 'vue';
import { useFEAStore } from '../store/fea';

const store = useFEAStore();
const editingId = ref<string | null>(null);
const editingName = ref('');

function startRename(id: string, name: string) {
  editingId.value = id;
  editingName.value = name;
}

function finishRename() {
  if (editingId.value && editingName.value.trim()) {
    store.renameCondition(editingId.value, editingName.value.trim());
  }
  editingId.value = null;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    finishRename();
  } else if (e.key === 'Escape') {
    editingId.value = null;
  }
}

function getConditionSummary(cond: { loads: { nodeId: number; fx: number; fy: number }[]; fixedNodeIds: number[]; result: { maxStress: number; maxDisplacement: number } | null }) {
  const loadCount = cond.loads.length;
  const fixedCount = cond.fixedNodeIds.length;
  return { loadCount, fixedCount };
}
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-4 space-y-3">
    <div class="flex items-center justify-between border-b border-slate-700 pb-2">
      <h3 class="text-sm font-bold text-slate-200">
        工况管理
      </h3>
      <button
        @click="store.addCondition()"
        class="px-2 py-1 text-[10px] font-bold bg-sky-700 text-white rounded hover:bg-sky-600 transition"
      >
        + 新增工况
      </button>
    </div>

    <div class="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
      <div
        v-for="cond in store.workingConditions"
        :key="cond.id"
        @click="store.switchCondition(cond.id)"
        :class="[
          'relative rounded p-2 cursor-pointer transition border',
          store.currentConditionId === cond.id
            ? 'bg-sky-900/50 border-sky-600'
            : 'bg-slate-700/50 border-transparent hover:bg-slate-700 hover:border-slate-600'
        ]"
      >
        <div class="flex items-center gap-2">
          <div
            :class="[
              'w-2 h-2 rounded-full flex-shrink-0',
              cond.result ? 'bg-green-400' : 'bg-slate-500'
            ]"
          />
          <div v-if="editingId === cond.id" class="flex-1 min-w-0" @click.stop>
            <input
              v-model="editingName"
              @blur="finishRename"
              @keydown="handleKeydown"
              class="w-full bg-slate-900 text-slate-200 text-xs px-2 py-1 rounded border border-sky-600 outline-none"
              autofocus
            />
          </div>
          <div v-else class="flex-1 min-w-0">
            <div class="text-xs font-medium text-slate-200 truncate">
              {{ cond.name }}
            </div>
            <div class="text-[10px] text-slate-400">
              {{ getConditionSummary(cond).loadCount }} 个载荷 ·
              {{ getConditionSummary(cond).fixedNodeIds }} 个约束
              <span v-if="cond.result" class="text-green-400 ml-1">
                · 已求解
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 mt-1.5" @click.stop>
          <button
            @click="startRename(cond.id, cond.name)"
            class="px-1.5 py-0.5 text-[9px] bg-slate-600 text-slate-300 rounded hover:bg-slate-500 transition"
            title="重命名"
          >
            重命名
          </button>
          <button
            @click="store.duplicateCondition(cond.id)"
            class="px-1.5 py-0.5 text-[9px] bg-slate-600 text-slate-300 rounded hover:bg-slate-500 transition"
            title="复制"
          >
            复制
          </button>
          <button
            v-if="store.workingConditions.length > 1"
            @click="store.deleteCondition(cond.id)"
            class="px-1.5 py-0.5 text-[9px] bg-red-900/60 text-red-300 rounded hover:bg-red-800/70 transition"
            title="删除"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <div class="border-t border-slate-700 pt-3 space-y-2">
      <button
        @click="store.solveAllConditions()"
        class="w-full py-2 rounded text-xs font-bold bg-purple-700 text-white hover:bg-purple-600 transition"
      >
        ⚙ 求解所有工况
      </button>
      <button
        @click="store.toggleComparisonMode()"
        :class="[
          'w-full py-2 rounded text-xs font-bold transition',
          store.comparisonMode
            ? 'bg-amber-600 text-white hover:bg-amber-500'
            : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
        ]"
      >
        {{ store.comparisonMode ? '退出对比模式' : '📊 对比模式' }}
      </button>
    </div>

    <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-700">
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span>已求解: {{ store.solvedConditions.length }} / {{ store.workingConditions.length }}</span>
      </div>
    </div>
  </div>
</template>
