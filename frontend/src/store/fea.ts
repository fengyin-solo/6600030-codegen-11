import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FEAModel, FEAResult, WorkingCondition } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createCondition(name: string, model: FEAModel): WorkingCondition {
  const fixedNodeIds = model.nodes.filter((n) => n.fixed).map((n) => n.id);
  return {
    id: genId(),
    name,
    loads: JSON.parse(JSON.stringify(model.loads)),
    fixedNodeIds: [...fixedNodeIds],
    result: null,
    nodeDisplacements: new Map(),
    elementResults: new Map(),
  };
}

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');

  const workingConditions = ref<WorkingCondition[]>([]);
  const currentConditionId = ref<string>('');
  const comparisonMode = ref(false);

  const currentCondition = computed<WorkingCondition | null>(() => {
    return workingConditions.value.find((c) => c.id === currentConditionId.value) || null;
  });

  const solvedConditions = computed(() => {
    return workingConditions.value.filter((c) => c.result !== null);
  });

  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    let presetModel: FEAModel;
    switch (name) {
      case 'cantilever':
        presetModel = presetCantileverBeam();
        break;
      case 'bridge':
        presetModel = presetBridgeTruss();
        break;
      case 'frame':
        presetModel = presetSimpleFrame();
        break;
      default:
        presetModel = presetCantileverBeam();
    }
    model.value = presetModel;

    const defaultCondition = createCondition('工况 1', model.value);
    workingConditions.value = [defaultCondition];
    currentConditionId.value = defaultCondition.id;
    applyConditionToModel(defaultCondition);
  }

  function applyConditionToModel(condition: WorkingCondition) {
    model.value.loads = JSON.parse(JSON.stringify(condition.loads));

    for (const node of model.value.nodes) {
      node.fixed = condition.fixedNodeIds.includes(node.id);
    }

    result.value = condition.result;

    for (const node of model.value.nodes) {
      const disp = condition.nodeDisplacements.get(node.id);
      if (disp) {
        node.displacementX = disp.dx;
        node.displacementY = disp.dy;
      } else {
        node.displacementX = 0;
        node.displacementY = 0;
      }
    }

    for (const el of model.value.elements) {
      const res = condition.elementResults.get(el.id);
      if (res) {
        el.stress = res.stress;
        el.strain = res.strain;
        el.force = res.force;
      } else {
        el.stress = 0;
        el.strain = 0;
        el.force = 0;
      }
    }
  }

  function saveModelToCondition(condition: WorkingCondition) {
    condition.loads = JSON.parse(JSON.stringify(model.value.loads));
    condition.fixedNodeIds = model.value.nodes.filter((n) => n.fixed).map((n) => n.id);
  }

  function addCondition() {
    if (!currentCondition.value) return;
    saveModelToCondition(currentCondition.value);

    const newName = `工况 ${workingConditions.value.length + 1}`;
    const newCondition = createCondition(newName, model.value);
    workingConditions.value.push(newCondition);
    currentConditionId.value = newCondition.id;
    applyConditionToModel(newCondition);
  }

  function deleteCondition(id: string) {
    if (workingConditions.value.length <= 1) return;
    const idx = workingConditions.value.findIndex((c) => c.id === id);
    if (idx === -1) return;

    workingConditions.value.splice(idx, 1);

    if (currentConditionId.value === id) {
      const nextIdx = Math.min(idx, workingConditions.value.length - 1);
      currentConditionId.value = workingConditions.value[nextIdx].id;
      applyConditionToModel(workingConditions.value[nextIdx]);
    }
  }

  function renameCondition(id: string, name: string) {
    const cond = workingConditions.value.find((c) => c.id === id);
    if (cond) cond.name = name;
  }

  function switchCondition(id: string) {
    if (id === currentConditionId.value) return;

    if (currentCondition.value) {
      saveModelToCondition(currentCondition.value);
    }

    const cond = workingConditions.value.find((c) => c.id === id);
    if (!cond) return;

    currentConditionId.value = id;
    applyConditionToModel(cond);
    selectedElement.value = null;
  }

  function duplicateCondition(id: string) {
    const cond = workingConditions.value.find((c) => c.id === id);
    if (!cond) return;

    if (currentCondition.value) {
      saveModelToCondition(currentCondition.value);
    }

    const newCond: WorkingCondition = {
      id: genId(),
      name: cond.name + ' 副本',
      loads: JSON.parse(JSON.stringify(cond.loads)),
      fixedNodeIds: [...cond.fixedNodeIds],
      result: cond.result ? JSON.parse(JSON.stringify(cond.result)) : null,
      nodeDisplacements: new Map(cond.nodeDisplacements),
      elementResults: new Map(cond.elementResults),
    };

    const idx = workingConditions.value.findIndex((c) => c.id === id);
    workingConditions.value.splice(idx + 1, 0, newCond);
    currentConditionId.value = newCond.id;
    applyConditionToModel(newCond);
  }

  function solve() {
    if (!currentCondition.value) return;

    result.value = feaSolve(model.value);
    currentCondition.value.result = result.value;

    currentCondition.value.nodeDisplacements = new Map();
    for (const node of model.value.nodes) {
      currentCondition.value.nodeDisplacements.set(node.id, {
        dx: node.displacementX,
        dy: node.displacementY,
      });
    }

    currentCondition.value.elementResults = new Map();
    for (const el of model.value.elements) {
      currentCondition.value.elementResults.set(el.id, {
        stress: el.stress,
        strain: el.strain,
        force: el.force,
      });
    }

    saveModelToCondition(currentCondition.value);
  }

  function solveAllConditions() {
    if (!currentCondition.value) return;
    saveModelToCondition(currentCondition.value);

    for (const cond of workingConditions.value) {
      const solveModel: FEAModel = {
        nodes: model.value.nodes.map((n) => ({
          ...n,
          fixed: cond.fixedNodeIds.includes(n.id),
          displacementX: 0,
          displacementY: 0,
        })),
        elements: model.value.elements.map((e) => ({
          ...e,
          stress: 0,
          strain: 0,
          force: 0,
        })),
        loads: JSON.parse(JSON.stringify(cond.loads)),
      };

      const r = feaSolve(solveModel);
      cond.result = r;

      cond.nodeDisplacements = new Map();
      for (const node of solveModel.nodes) {
        cond.nodeDisplacements.set(node.id, {
          dx: node.displacementX,
          dy: node.displacementY,
        });
      }

      cond.elementResults = new Map();
      for (const el of solveModel.elements) {
        cond.elementResults.set(el.id, {
          stress: el.stress,
          strain: el.strain,
          force: el.force,
        });
      }
    }

    if (currentCondition.value) {
      applyConditionToModel(currentCondition.value);
    }
  }

  function toggleComparisonMode() {
    comparisonMode.value = !comparisonMode.value;
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
    if (currentCondition.value) {
      saveModelToCondition(currentCondition.value);
    }
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
    if (currentCondition.value) {
      saveModelToCondition(currentCondition.value);
    }
  }

  function getElementColorsForCondition(condition: WorkingCondition): Map<number, string> {
    const colors = new Map<number, string>();
    if (!condition.result || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = model.value.elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.stress) : 0;
        });
        break;
      case 'strain':
        values = model.value.elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.strain) : 0;
        });
        break;
      case 'force':
        values = model.value.elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.force) : 0;
        });
        break;
      default:
        values = model.value.elements.map((el) => {
          const r = condition.elementResults.get(el.id);
          return r ? Math.abs(r.stress) : 0;
        });
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  }

  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    workingConditions,
    currentConditionId,
    currentCondition,
    solvedConditions,
    comparisonMode,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    solveAllConditions,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    addCondition,
    deleteCondition,
    renameCondition,
    switchCondition,
    duplicateCondition,
    toggleComparisonMode,
    getElementColorsForCondition,
  };
});
