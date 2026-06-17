import { createBackpackPreviewCanvas } from "../render/backpack.js";

export const hotbarSlotCount = 9;
export const maxStackSize = 99;
export const defaultToolDurability = 999;
export const backpackSlotIndex = hotbarSlotCount - 1;
export const forgedItemSlotIndex = hotbarSlotCount - 2;

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

      if (item.renderIcon === "backpack") {
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
