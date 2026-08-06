import timberWorkbenchDefinition from "../item_ncm/json/furniture/timber-workbench.json";
import storageShelfDefinition from "../item_ncm/json/furniture/storage-shelf.json";
import ironDeepRockPickaxeDefinition from "../item_ncm/json/mining-tools/iron-deep-rock-pickaxe.json";
import brickAndTimberPalletDefinition from "../item_ncm/json/construction/brick-and-timber-pallet.json";
import timberMarketDisplayStandDefinition from "../item_ncm/json/commerce/timber-market-display-stand.json";
import ironAnvilDefinition from "../item_ncm/json/workshop/iron-blacksmith-anvil.json";
import ironBlacksmithHammerDefinition from "../item_ncm/json/workshop/iron-blacksmith-hammer.json";

export const HOME_DEFERRED_ITEM_DEFINITIONS = Object.freeze({
  anvil: ironAnvilDefinition,
  hammer: ironBlacksmithHammerDefinition,
  marketDisplay: timberMarketDisplayStandDefinition,
  pallet: brickAndTimberPalletDefinition,
  pickaxe: ironDeepRockPickaxeDefinition,
  shelf: storageShelfDefinition,
  workbench: timberWorkbenchDefinition,
});
