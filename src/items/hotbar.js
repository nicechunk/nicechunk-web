import { createBackpackPreviewCanvas } from "../render/backpack.js";
import { createForgedItemPreviewElement } from "../forgedItems.js";

export const hotbarSlotCount = 9;
export const maxStackSize = 99;
export const defaultToolDurability = 999;
export const backpackSlotIndex = hotbarSlotCount - 1;
export const forgedItemSlotIndex = hotbarSlotCount - 2;
export const hotbarSlotsStorageKey = "nicechunk.hotbar.slots.v1";
export const forgedHotbarQueueStorageKey = "nicechunk.forged.hotbar.queue.v1";
const forgedHotbarReservationTtlMs = 10 * 60 * 1000;

export const emptyHotbarItem = {
  kind: "empty",
  id: "empty",
  labelKey: "main.item.empty",
  action: "swing",
  hand: "empty",
};

const baseHotbarItems = {
  iron_pickaxe: { kind: "tool", id: "iron_pickaxe", labelKey: "main.item.iron_pickaxe", action: "mine", hand: "pickaxe", iconClass: "item-pickaxe" },
  dirt: { kind: "block", id: "dirt", labelKey: "main.item.dirt", action: "placeBlock", type: "dirt", hand: "block", iconClass: "item-cube item-dirt" },
  stone: { kind: "block", id: "stone", labelKey: "main.item.stone", action: "placeBlock", type: "stone", hand: "block", iconClass: "item-cube item-stone" },
  sand: { kind: "block", id: "sand", labelKey: "main.item.sand", action: "placeBlock", type: "sand", hand: "block", iconClass: "item-cube item-sand" },
  trunk: { kind: "block", id: "trunk", labelKey: "main.item.trunk", action: "placeBlock", type: "trunk", hand: "block", iconClass: "item-cube item-trunk" },
  leaves: { kind: "block", id: "leaves", labelKey: "main.item.leaves", action: "placeBlock", type: "leaves", hand: "block", iconClass: "item-cube item-leaves" },
  red_flower: {
    kind: "plant",
    id: "red_flower",
    labelKey: "main.item.red_flower",
    action: "placePlant",
    type: "flowerRed",
    hand: "block",
    handType: "flowerRed",
    handScale: 0.24,
    iconClass: "item-flower",
  },
  forged_item: { kind: "forged", id: "forged_item", labelKey: "main.item.forged_item", action: "mine", hand: "forged", iconClass: "item-forged" },
  backpack: { kind: "system", id: "backpack", labelKey: "main.item.backpack", action: "openBackpack", hand: "empty", renderIcon: "backpack" },
  backpack_resource: { kind: "resource", id: "backpack_resource", labelKey: "main.item.backpack_resource", action: "swing", hand: "empty", iconClass: "item-cube item-stone" },
};

export function createHotbarItems(extraItems = {}) {
  return {
    ...baseHotbarItems,
    ...extraItems,
  };
}

export function createInitialHotbarSlots() {
  const slots = [
    createToolSlot("iron_pickaxe"),
    createStackSlot("dirt"),
    createStackSlot("stone"),
    createStackSlot("sand"),
    createStackSlot("trunk"),
    createStackSlot("leaves"),
    createStackSlot("red_flower"),
    null,
    null,
  ];
  slots.length = hotbarSlotCount;
  return slots;
}

export function createDefaultStoredHotbarSlots() {
  return createInitialHotbarSlots().map((slot) => {
    if (!slot) return null;
    if (slot.itemId === "iron_pickaxe" || slot.itemId === "backpack" || slot.itemId === "forged_item") return slot;
    return null;
  });
}

export function createStackSlot(itemId, count = maxStackSize) {
  return {
    itemId,
    count: Math.min(maxStackSize, Math.max(0, count)),
  };
}

export function createToolSlot(itemId, durability = defaultToolDurability) {
  return {
    itemId,
    durability: Math.max(0, durability),
  };
}

export function createBackpackSlot(backpack = {}) {
  return {
    itemId: "backpack",
    locked: true,
    backpackAddress: backpack.address ?? backpack.publicKey ?? null,
    backpackId: backpack.backpackId ?? null,
    capacity: backpack.capacity ?? null,
    itemCount: backpack.itemCount ?? null,
  };
}

export function createForgedItemSlot(item) {
  return {
    itemId: "forged_item",
    count: 1,
    bytes: Array.isArray(item.bytes) ? [...item.bytes] : null,
    byteLength: item.byteLength,
    code: item.code,
    savedAt: item.savedAt,
  };
}

export function loadStoredHotbarSlots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(hotbarSlotsStorageKey) || "null");
    return normalizeHotbarSlots(parsed);
  } catch {
    return null;
  }
}

export function saveHotbarSlots(slots) {
  try {
    localStorage.setItem(hotbarSlotsStorageKey, JSON.stringify(normalizeHotbarSlots(slots) ?? createDefaultStoredHotbarSlots()));
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
}

export function reserveForgedHotbarSlot() {
  const queue = loadForgedHotbarQueue();
  if (!hasForgedHotbarCapacity(queue)) return null;
  const reservation = {
    id: `forge-reserve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    state: "reserved",
    reservedAt: Date.now(),
  };
  return writeForgedHotbarQueue([...queue, reservation]) ? reservation : null;
}

export function commitForgedHotbarReservation(reservationId, item) {
  const queue = loadForgedHotbarQueue();
  const index = queue.findIndex((entry) => entry?.id === reservationId && entry.state === "reserved");
  if (index < 0) return false;
  queue[index] = normalizeForgedHotbarQueueItem(item, reservationId);
  return writeForgedHotbarQueue(queue);
}

export function releaseForgedHotbarReservation(reservationId) {
  if (!reservationId) return;
  writeForgedHotbarQueue(loadForgedHotbarQueue().filter((entry) => entry?.id !== reservationId));
}

export function consumePendingForgedHotbarItems(hotbarSlots, { avoidSlotIndex = null } = {}) {
  const queue = loadForgedHotbarQueue();
  if (!queue.length) return { changed: false, remaining: 0, added: 0, addedSlots: [] };
  const remaining = [];
  let changed = false;
  let added = 0;
  const addedSlots = [];
  for (const entry of queue) {
    if (entry?.state === "reserved") {
      remaining.push(entry);
      continue;
    }
    const slotIndex = findAvailableHotbarSlot(hotbarSlots, { avoidSlotIndex });
    if (slotIndex < 0) {
      remaining.push(entry);
      continue;
    }
    hotbarSlots[slotIndex] = createForgedItemSlot(entry);
    changed = true;
    added += 1;
    addedSlots.push(slotIndex);
  }
  if (remaining.length !== queue.length || changed) writeForgedHotbarQueue(remaining);
  return { changed, remaining: remaining.length, added, addedSlots };
}

export function hasPendingForgedHotbarItems() {
  return loadForgedHotbarQueue().some((entry) => entry?.state !== "reserved");
}

function hasForgedHotbarCapacity(queue = loadForgedHotbarQueue()) {
  const slots = loadStoredHotbarSlots() ?? createDefaultStoredHotbarSlots();
  const freeSlots = slots.filter((slot) => !slot).length;
  return queue.length < freeSlots;
}

function loadForgedHotbarQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(forgedHotbarQueueStorageKey) || "[]");
    const now = Date.now();
    return Array.isArray(parsed)
      ? parsed
        .filter((entry) => entry && typeof entry === "object")
        .filter((entry) => entry.state !== "reserved" || now - Number(entry.reservedAt || 0) < forgedHotbarReservationTtlMs)
      : [];
  } catch {
    return [];
  }
}

function writeForgedHotbarQueue(queue) {
  try {
    localStorage.setItem(forgedHotbarQueueStorageKey, JSON.stringify(queue));
    return true;
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
    return false;
  }
}

function normalizeForgedHotbarQueueItem(item, fallbackId = "") {
  return {
    id: item?.id || fallbackId || `forged-${Date.now().toString(36)}`,
    state: "ready",
    itemId: "forged_item",
    count: 1,
    bytes: Array.isArray(item?.bytes) ? [...item.bytes] : null,
    byteLength: Number(item?.byteLength) || (Array.isArray(item?.bytes) ? item.bytes.length : 0),
    code: item?.code ?? "",
    savedAt: Number(item?.savedAt) || Date.now(),
  };
}

function normalizeHotbarSlots(value) {
  if (!Array.isArray(value)) return null;
  const slots = value.slice(0, hotbarSlotCount).map(normalizeHotbarSlot);
  while (slots.length < hotbarSlotCount) slots.push(null);
  return slots;
}

function normalizeHotbarSlot(slot) {
  if (!slot || typeof slot !== "object" || !slot.itemId) return null;
  const normalized = { ...slot };
  if (Array.isArray(slot.bytes)) normalized.bytes = [...slot.bytes];
  return normalized;
}

function findAvailableHotbarSlot(slots, { avoidSlotIndex = null } = {}) {
  if (Number.isInteger(avoidSlotIndex) && !slots[avoidSlotIndex]) {
    const alternate = slots.findIndex((slot, index) => index !== avoidSlotIndex && !slot);
    if (alternate >= 0) return alternate;
  }
  return slots.findIndex((slot) => !slot);
}

export function hotbarSlotAt(hotbarSlots, slotIndex) {
  return hotbarSlots[slotIndex] ?? null;
}

export function hotbarItemAt(hotbarSlots, hotbarItems, slotIndex) {
  const slot = hotbarSlotAt(hotbarSlots, slotIndex);
  return hotbarItems[slot?.itemId] ?? emptyHotbarItem;
}

export function isReservedHotbarSlot(slot, item = null) {
  return Boolean(slot?.locked || item?.kind === "system");
}

export function renderHotbarSlots({ hotbar, hotbarSlots, hotbarItems, selectedHotbarSlot, t, formatResourceAmount }) {
  hotbar.replaceChildren(
    ...Array.from({ length: hotbarSlotCount }, (_, index) => {
      const slotData = hotbarSlotAt(hotbarSlots, index);
      const item = hotbarItemAt(hotbarSlots, hotbarItems, index);
      const slot = document.createElement("button");
      slot.className = "hotbar-slot";
      slot.type = "button";
      slot.dataset.slot = String(index);
      slot.classList.toggle("selected", index === selectedHotbarSlot);
      slot.setAttribute("aria-label", hotbarSlotLabel({ slotIndex: index, slot: slotData, item, t, formatResourceAmount }));

      if (item.kind === "forged" && (slotData?.code || slotData?.bytes)) {
        const preview = createForgedItemPreviewElement(slotData.code ?? slotData.bytes, {
          className: "item-forged-render",
          size: 96,
          title: t(item.labelKey),
        });
        if (preview) slot.append(preview);
      } else if (item.renderIcon === "backpack") {
        slot.append(createBackpackPreviewCanvas());
      } else if (item.iconClass) {
        const icon = document.createElement("span");
        icon.className = item.iconClass;
        slot.append(icon);
      }

      const amount = hotbarSlotAmount(slotData, formatResourceAmount);
      if (amount !== "") {
        const count = document.createElement("span");
        count.className = "item-count";
        count.textContent = amount;
        slot.append(count);
      }

      return slot;
    }),
  );
}

export function hotbarSlotAmount(slot, formatResourceAmount) {
  if (!slot) return "";
  if (slot.itemId === "backpack") {
    return Number.isFinite(slot.itemCount) ? String(slot.itemCount) : "0";
  }
  if (slot.locked) return "";
  if (Number.isFinite(slot.durability)) return String(slot.durability);
  if (Number.isFinite(slot.count)) return formatResourceAmount(slot.count);
  return "";
}

function hotbarSlotLabel({ slotIndex, slot, item, t, formatResourceAmount }) {
  if (!slot) return t("main.hotbarSlot.empty", { slot: slotIndex + 1 });
  if (slot.locked) return t("main.hotbarSlot.item", { slot: slotIndex + 1, item: t(item.labelKey) });
  const amount = Number.isFinite(slot.durability)
    ? t("main.hotbarSlot.durability", { value: slot.durability })
    : t("main.hotbarSlot.count", { value: formatResourceAmount(slot.count) });
  return t("main.hotbarSlot.detail", { slot: slotIndex + 1, item: t(item.labelKey), amount });
}
