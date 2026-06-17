export const resourceSimulationEnabled = true;
export const resourceDebugEventName = "nicechunk:resource-sim-debug";

export const simulatedResourceItems = {
  gravel: {
    kind: "resource",
    id: "gravel",
    labelKey: "resourceSimulator.resource.gravel",
    action: "swing",
    hand: "empty",
    iconClass: "item-resource item-gravel",
  },
};

const stoneYieldRule = {
  sourceBlockType: "stone",
  resourceId: "gravel",
  amount: 0.1,
};

export function resetHotbarForResourceSimulation(hotbarSlots, hotbarItems) {
  if (!resourceSimulationEnabled) return false;
  let changed = false;
  for (let index = 0; index < hotbarSlots.length; index += 1) {
    const slot = hotbarSlots[index];
    const item = hotbarItems[slot?.itemId];
    if (!slot || item?.kind === "tool" || item?.kind === "forged" || item?.kind === "system" || slot.locked) continue;
    hotbarSlots[index] = null;
    changed = true;
  }
  return changed;
}

export function simulateResourceDiscovery({ block, debug = false }) {
  const material = block?.type ?? "unknown";
  const result = {
    coordinate: {
      x: Number(block?.x ?? 0),
      y: Number(block?.y ?? 0),
      z: Number(block?.z ?? 0),
    },
    blockKey: material,
    material,
    resourceId: null,
    amount: 0,
    eligible: material === stoneYieldRule.sourceBlockType,
    ruleId: "stone_to_gravel_v1",
  };

  if (result.eligible) {
    result.resourceId = stoneYieldRule.resourceId;
    result.amount = stoneYieldRule.amount;
  }

  if (debug) dispatchResourceDebug(result);
  return result;
}

export function addResourceToHotbar(hotbarSlots, hotbarItems, resourceId, amount, maxStackSize) {
  if (!resourceId || amount <= 0) return false;
  if (!hotbarItems[resourceId]) return false;

  const roundedAmount = roundResourceAmount(amount);
  const existingSlot = hotbarSlots.find((slot) => slot?.itemId === resourceId && Number.isFinite(slot.count));
  if (existingSlot) {
    existingSlot.count = Math.min(maxStackSize, roundResourceAmount(existingSlot.count + roundedAmount));
    return true;
  }

  const emptyIndex = hotbarSlots.findIndex((slot) => !slot);
  if (emptyIndex === -1) return false;
  hotbarSlots[emptyIndex] = {
    itemId: resourceId,
    count: Math.min(maxStackSize, roundedAmount),
  };
  return true;
}

export function formatResourceAmount(amount) {
  if (!Number.isFinite(amount)) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function roundResourceAmount(amount) {
  return Math.round(amount * 10) / 10;
}

function dispatchResourceDebug(detail) {
  window.dispatchEvent(new CustomEvent(resourceDebugEventName, { detail }));
}
