import { elements } from "./data/elements.js";

export const elementCategories = [
  "nonmetal",
  "noble_gas",
  "alkali_metal",
  "alkaline_earth_metal",
  "metalloid",
  "halogen",
  "post_transition_metal",
  "transition_metal",
  "lanthanide",
  "actinide",
  "unknown_properties",
];

export const processingByCategory = {
  nonmetal: { tier: 1, station: "separator", heat: "low", binder: "none" },
  noble_gas: { tier: 3, station: "cryogenicTrap", heat: "low", binder: "pressureCell" },
  alkali_metal: { tier: 2, station: "stabilizer", heat: "low", binder: "sealedCapsule" },
  alkaline_earth_metal: { tier: 2, station: "kiln", heat: "medium", binder: "flux" },
  metalloid: { tier: 2, station: "refiner", heat: "medium", binder: "silicateMatrix" },
  halogen: { tier: 2, station: "sealedReactor", heat: "low", binder: "saltMatrix" },
  post_transition_metal: { tier: 2, station: "smelter", heat: "medium", binder: "ingotMold" },
  transition_metal: { tier: 3, station: "alloyForge", heat: "high", binder: "carbonFlux" },
  lanthanide: { tier: 4, station: "magneticSeparator", heat: "high", binder: "rareEarthFlux" },
  actinide: { tier: 5, station: "shieldedReactor", heat: "extreme", binder: "containmentCore" },
  unknown_properties: { tier: 5, station: "shieldedReactor", heat: "extreme", binder: "containmentCore" },
};

const fBlockLayout = new Map([
  ...["Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu"].map((symbol, index) => [symbol, { tableColumn: index + 4, tableRow: 8 }]),
  ...["Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr"].map((symbol, index) => [symbol, { tableColumn: index + 4, tableRow: 9 }]),
]);

export const elementsCatalog = elements.map((element) => {
  const fBlock = fBlockLayout.get(element.symbol);
  return {
    atomicNumber: element.atomicNumber,
    symbol: element.symbol,
    name: element.name,
    group: element.identity.group,
    period: element.identity.period,
    tableColumn: fBlock?.tableColumn ?? element.identity.group ?? element.identity.period,
    tableRow: fBlock?.tableRow ?? element.identity.period,
    block: element.identity.block,
    category: element.identity.category,
    phase: element.identity.standardState,
    naturalOccurrence: element.identity.naturalOccurrence,
    atomicMass: element.atomic.atomicMass == null ? "" : String(element.atomic.atomicMass),
  };
});

export function elementNameKey(symbol) {
  return `elements.names.${symbol}`;
}
