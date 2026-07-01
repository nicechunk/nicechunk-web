export const smeltingRules = {
  "schemaVersion": 1,
  "ruleSet": "nicechunk-smelting-v1",
  "heatTiers": [
    {
      "tier": 1,
      "key": "low",
      "temperatureC": 350
    },
    {
      "tier": 2,
      "key": "workshop",
      "temperatureC": 700
    },
    {
      "tier": 3,
      "key": "forge",
      "temperatureC": 1050
    },
    {
      "tier": 4,
      "key": "blast",
      "temperatureC": 1300
    }
  ],
  "fuels": [
    {
      "id": "dry_grass",
      "sourceType": "raw",
      "sourceKeys": [
        "dryGrass",
        "deadBush",
        "thorn"
      ],
      "heatTier": 1,
      "burnSeconds": 18,
      "consumable": true
    },
    {
      "id": "wood",
      "sourceType": "raw",
      "sourceKeys": [
        "trunk",
        "pineTrunk",
        "deadWood",
        "giantRoot"
      ],
      "heatTier": 2,
      "burnSeconds": 42,
      "consumable": true
    },
    {
      "id": "charcoal",
      "sourceType": "material",
      "materialId": "charcoal",
      "heatTier": 2,
      "burnSeconds": 64,
      "consumable": true
    },
    {
      "id": "coal",
      "sourceType": "raw",
      "sourceKeys": [
        "coal"
      ],
      "heatTier": 3,
      "burnSeconds": 96,
      "consumable": true
    },
    {
      "id": "lava_heat",
      "sourceType": "raw",
      "sourceKeys": [
        "lava",
        "basalt"
      ],
      "heatTier": 4,
      "burnSeconds": 160,
      "consumable": false
    }
  ],
  "materials": [
    {
      "id": "charcoal",
      "class": "carbon",
      "rawInputs": [
        {
          "key": "trunk",
          "amount": 2
        },
        {
          "key": "dryGrass",
          "amount": 3
        }
      ],
      "requiredHeatTier": 1,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "fuel",
      "composition": [
        [
          "C",
          "70-88%"
        ],
        [
          "O",
          "6-18%"
        ],
        [
          "H",
          "2-6%"
        ],
        [
          "K",
          "0.2-2%"
        ]
      ]
    },
    {
      "id": "biochar_compost",
      "class": "carbon",
      "rawInputs": [
        {
          "key": "leaves",
          "amount": 2
        },
        {
          "key": "moss",
          "amount": 1
        },
        {
          "key": "mud",
          "amount": 1
        }
      ],
      "requiredHeatTier": 1,
      "artisanLevel": 1,
      "yieldCount": 2,
      "forgeUse": "soilCatalyst",
      "composition": [
        [
          "C",
          "32-52%"
        ],
        [
          "O",
          "24-38%"
        ],
        [
          "H",
          "4-9%"
        ],
        [
          "N",
          "1-5%"
        ],
        [
          "K",
          "0.5-4%"
        ]
      ]
    },
    {
      "id": "plant_fiber",
      "class": "fiber",
      "rawInputs": [
        {
          "key": "reed",
          "amount": 2
        },
        {
          "key": "vine",
          "amount": 1
        }
      ],
      "requiredHeatTier": 1,
      "artisanLevel": 1,
      "yieldCount": 2,
      "forgeUse": "binding",
      "composition": [
        [
          "C",
          "42-50%"
        ],
        [
          "O",
          "38-45%"
        ],
        [
          "H",
          "5-7%"
        ],
        [
          "N",
          "0.3-2%"
        ]
      ]
    },
    {
      "id": "resin_binder",
      "class": "polymer",
      "rawInputs": [
        {
          "key": "pineTrunk",
          "amount": 1
        },
        {
          "key": "vine",
          "amount": 1
        }
      ],
      "requiredHeatTier": 1,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "binding",
      "composition": [
        [
          "C",
          "58-72%"
        ],
        [
          "H",
          "7-11%"
        ],
        [
          "O",
          "12-24%"
        ],
        [
          "N",
          "0.2-2%"
        ]
      ]
    },
    {
      "id": "ceramic_brick",
      "class": "ceramic",
      "rawInputs": [
        {
          "key": "clay",
          "amount": 2
        },
        {
          "key": "sand",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 1,
      "yieldCount": 2,
      "forgeUse": "mold",
      "composition": [
        [
          "O",
          "46-56%"
        ],
        [
          "Si",
          "22-36%"
        ],
        [
          "Al",
          "6-16%"
        ],
        [
          "Fe",
          "0.5-6%"
        ]
      ]
    },
    {
      "id": "lime_ceramic",
      "class": "ceramic",
      "rawInputs": [
        {
          "key": "shellBed",
          "amount": 1
        },
        {
          "key": "clay",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "binding",
      "composition": [
        [
          "O",
          "42-54%"
        ],
        [
          "Ca",
          "18-34%"
        ],
        [
          "Si",
          "10-24%"
        ],
        [
          "Al",
          "3-10%"
        ]
      ]
    },
    {
      "id": "quicklime",
      "class": "ceramic",
      "rawInputs": [
        {
          "key": "shellBed",
          "amount": 2
        },
        {
          "key": "coral",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "flux",
      "composition": [
        [
          "Ca",
          "42-58%"
        ],
        [
          "O",
          "32-45%"
        ],
        [
          "C",
          "0-8%"
        ],
        [
          "Mg",
          "0.5-4%"
        ]
      ]
    },
    {
      "id": "salt_flux",
      "class": "chemical",
      "rawInputs": [
        {
          "key": "saltFlat",
          "amount": 2
        },
        {
          "key": "ash",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "flux",
      "composition": [
        [
          "Na",
          "24-38%"
        ],
        [
          "Cl",
          "28-42%"
        ],
        [
          "K",
          "2-8%"
        ],
        [
          "O",
          "8-20%"
        ]
      ]
    },
    {
      "id": "ash_cement",
      "class": "composite",
      "rawInputs": [
        {
          "key": "ash",
          "amount": 2
        },
        {
          "key": "clay",
          "amount": 1
        },
        {
          "key": "shellBed",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 2,
      "yieldCount": 2,
      "forgeUse": "masonry",
      "composition": [
        [
          "O",
          "42-55%"
        ],
        [
          "Si",
          "16-30%"
        ],
        [
          "Ca",
          "8-20%"
        ],
        [
          "Al",
          "4-12%"
        ],
        [
          "Fe",
          "1-6%"
        ]
      ]
    },
    {
      "id": "glass_ingot",
      "class": "glass",
      "rawInputs": [
        {
          "key": "sand",
          "amount": 3
        },
        {
          "key": "saltFlat",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 1,
      "forgeUse": "lens",
      "composition": [
        [
          "Si",
          "30-44%"
        ],
        [
          "O",
          "48-58%"
        ],
        [
          "Na",
          "3-10%"
        ],
        [
          "Ca",
          "1-6%"
        ]
      ]
    },
    {
      "id": "obsidian_glass",
      "class": "glass",
      "rawInputs": [
        {
          "key": "sand",
          "amount": 2
        },
        {
          "key": "basalt",
          "amount": 1
        }
      ],
      "catalysts": [
        {
          "key": "lava",
          "amount": 1
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "lens",
      "composition": [
        [
          "Si",
          "26-40%"
        ],
        [
          "O",
          "42-54%"
        ],
        [
          "Fe",
          "3-10%"
        ],
        [
          "Mg",
          "1-7%"
        ],
        [
          "Al",
          "4-12%"
        ]
      ]
    },
    {
      "id": "silicon_wafer",
      "class": "crystal",
      "rawInputs": [
        {
          "key": "sand",
          "amount": 4
        },
        {
          "key": "coal",
          "amount": 1
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "circuit",
      "composition": [
        [
          "Si",
          "78-92%"
        ],
        [
          "O",
          "3-12%"
        ],
        [
          "C",
          "0.5-4%"
        ],
        [
          "Al",
          "0.1-2%"
        ]
      ]
    },
    {
      "id": "ice_crystal",
      "class": "crystal",
      "rawInputs": [
        {
          "key": "ice",
          "amount": 2
        },
        {
          "key": "snow",
          "amount": 2
        },
        {
          "key": "saltFlat",
          "amount": 1
        }
      ],
      "requiredHeatTier": 1,
      "artisanLevel": 1,
      "yieldCount": 1,
      "forgeUse": "cooling",
      "composition": [
        [
          "O",
          "82-89%"
        ],
        [
          "H",
          "10-12%"
        ],
        [
          "Na",
          "0.2-2%"
        ],
        [
          "Cl",
          "0.2-2%"
        ]
      ]
    },
    {
      "id": "iron_bloom",
      "class": "metal",
      "rawInputs": [
        {
          "key": "deepStone",
          "amount": 3
        },
        {
          "key": "stone",
          "amount": 1
        }
      ],
      "catalysts": [
        {
          "key": "coal",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 1,
      "forgeUse": "toolHead",
      "composition": [
        [
          "Fe",
          "54-74%"
        ],
        [
          "O",
          "8-18%"
        ],
        [
          "C",
          "0.2-3%"
        ],
        [
          "Si",
          "2-10%"
        ],
        [
          "Mn",
          "0-2%"
        ]
      ]
    },
    {
      "id": "copper_bloom",
      "class": "metal",
      "rawInputs": [
        {
          "key": "gravel",
          "amount": 2
        },
        {
          "key": "basalt",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 1,
      "forgeUse": "conductor",
      "composition": [
        [
          "Cu",
          "42-68%"
        ],
        [
          "Fe",
          "4-14%"
        ],
        [
          "Si",
          "4-14%"
        ],
        [
          "O",
          "8-22%"
        ]
      ]
    },
    {
      "id": "alumina_plate",
      "class": "ceramic",
      "rawInputs": [
        {
          "key": "clay",
          "amount": 3
        },
        {
          "key": "deepStone",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 1,
      "forgeUse": "armorPlate",
      "composition": [
        [
          "Al",
          "22-38%"
        ],
        [
          "O",
          "42-54%"
        ],
        [
          "Si",
          "8-18%"
        ],
        [
          "Fe",
          "1-6%"
        ]
      ]
    },
    {
      "id": "nickel_iron",
      "class": "alloy",
      "rawInputs": [
        {
          "key": "deepStone",
          "amount": 3
        },
        {
          "key": "basalt",
          "amount": 2
        }
      ],
      "catalysts": [
        {
          "key": "coal",
          "amount": 1
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "magneticCore",
      "composition": [
        [
          "Fe",
          "48-68%"
        ],
        [
          "Ni",
          "6-18%"
        ],
        [
          "Mg",
          "2-8%"
        ],
        [
          "C",
          "0.2-3%"
        ],
        [
          "Si",
          "2-10%"
        ]
      ]
    },
    {
      "id": "carbon_plate",
      "class": "carbon",
      "rawInputs": [
        {
          "key": "coal",
          "amount": 2
        },
        {
          "key": "deepStone",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 1,
      "forgeUse": "reinforcement",
      "composition": [
        [
          "C",
          "62-82%"
        ],
        [
          "Fe",
          "3-12%"
        ],
        [
          "Si",
          "2-8%"
        ],
        [
          "O",
          "4-14%"
        ]
      ]
    },
    {
      "id": "carbon_steel",
      "class": "alloy",
      "rawInputs": [
        {
          "key": "deepStone",
          "amount": 4
        },
        {
          "key": "coal",
          "amount": 2
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "weaponAndTool",
      "composition": [
        [
          "Fe",
          "78-92%"
        ],
        [
          "C",
          "0.6-2.2%"
        ],
        [
          "Mn",
          "0-2%"
        ],
        [
          "Si",
          "0.2-2%"
        ]
      ]
    },
    {
      "id": "basalt_fiber",
      "class": "fiber",
      "rawInputs": [
        {
          "key": "basalt",
          "amount": 3
        },
        {
          "key": "lava",
          "amount": 1
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 2,
      "forgeUse": "heatShield",
      "composition": [
        [
          "Si",
          "18-30%"
        ],
        [
          "O",
          "42-54%"
        ],
        [
          "Mg",
          "4-12%"
        ],
        [
          "Fe",
          "4-12%"
        ],
        [
          "Ca",
          "4-10%"
        ]
      ]
    },
    {
      "id": "basalt_composite",
      "class": "composite",
      "rawInputs": [
        {
          "key": "basalt",
          "amount": 3
        },
        {
          "key": "pineTrunk",
          "amount": 1
        },
        {
          "key": "coal",
          "amount": 1
        }
      ],
      "requiredHeatTier": 4,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "armorPlate",
      "composition": [
        [
          "Si",
          "14-24%"
        ],
        [
          "O",
          "34-48%"
        ],
        [
          "C",
          "18-32%"
        ],
        [
          "Mg",
          "2-8%"
        ],
        [
          "Fe",
          "2-8%"
        ]
      ]
    },
    {
      "id": "geopolymer_block",
      "class": "composite",
      "rawInputs": [
        {
          "key": "ash",
          "amount": 2
        },
        {
          "key": "basalt",
          "amount": 1
        },
        {
          "key": "saltFlat",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 2,
      "yieldCount": 2,
      "forgeUse": "masonry",
      "composition": [
        [
          "O",
          "42-55%"
        ],
        [
          "Si",
          "20-34%"
        ],
        [
          "Al",
          "5-14%"
        ],
        [
          "Na",
          "1-6%"
        ],
        [
          "Ca",
          "1-7%"
        ]
      ]
    },
    {
      "id": "coral_lime",
      "class": "ceramic",
      "rawInputs": [
        {
          "key": "coral",
          "amount": 2
        },
        {
          "key": "deadCoral",
          "amount": 1
        },
        {
          "key": "sand",
          "amount": 1
        }
      ],
      "requiredHeatTier": 2,
      "artisanLevel": 2,
      "yieldCount": 2,
      "forgeUse": "masonry",
      "composition": [
        [
          "Ca",
          "24-42%"
        ],
        [
          "O",
          "38-52%"
        ],
        [
          "Si",
          "8-18%"
        ],
        [
          "C",
          "1-8%"
        ]
      ]
    },
    {
      "id": "toxic_glass",
      "class": "glass",
      "rawInputs": [
        {
          "key": "sand",
          "amount": 2
        },
        {
          "key": "toxicWater",
          "amount": 1
        },
        {
          "key": "saltFlat",
          "amount": 1
        }
      ],
      "requiredHeatTier": 3,
      "artisanLevel": 3,
      "yieldCount": 1,
      "forgeUse": "sealedVessel",
      "composition": [
        [
          "Si",
          "24-38%"
        ],
        [
          "O",
          "44-56%"
        ],
        [
          "Na",
          "3-10%"
        ],
        [
          "Cl",
          "1-6%"
        ],
        [
          "S",
          "0.5-4%"
        ]
      ]
    }
  ]
};


export const SMELTING_MATERIAL_ATTRIBUTE_KEYS = [
  "hardness",
  "durability",
  "toughness",
  "ductility",
  "brittleness",
  "density",
  "heatResistance",
  "corrosionResistance",
  "conductivity",
  "thermalConductivity",
  "magnetism",
  "workability",
];

export const smeltingMaterialAttributeProfiles = {
  charcoal: { hardness: 18, durability: 35, toughness: 22, ductility: 5, brittleness: 42, density: 25, heatResistance: 62, corrosionResistance: 70, conductivity: 22, thermalConductivity: 18, magnetism: 0, workability: 58 },
  biochar_compost: { hardness: 8, durability: 22, toughness: 16, ductility: 10, brittleness: 35, density: 18, heatResistance: 34, corrosionResistance: 62, conductivity: 12, thermalConductivity: 14, magnetism: 0, workability: 72 },
  plant_fiber: { hardness: 12, durability: 38, toughness: 48, ductility: 66, brittleness: 18, density: 14, heatResistance: 24, corrosionResistance: 42, conductivity: 6, thermalConductivity: 8, magnetism: 0, workability: 86 },
  resin_binder: { hardness: 16, durability: 42, toughness: 36, ductility: 58, brittleness: 22, density: 20, heatResistance: 30, corrosionResistance: 68, conductivity: 5, thermalConductivity: 7, magnetism: 0, workability: 82 },
  ceramic_brick: { hardness: 62, durability: 64, toughness: 36, ductility: 2, brittleness: 74, density: 54, heatResistance: 78, corrosionResistance: 72, conductivity: 8, thermalConductivity: 24, magnetism: 0, workability: 34 },
  lime_ceramic: { hardness: 54, durability: 56, toughness: 32, ductility: 2, brittleness: 68, density: 48, heatResistance: 72, corrosionResistance: 66, conductivity: 7, thermalConductivity: 20, magnetism: 0, workability: 42 },
  quicklime: { hardness: 38, durability: 34, toughness: 20, ductility: 1, brittleness: 82, density: 42, heatResistance: 64, corrosionResistance: 24, conductivity: 8, thermalConductivity: 18, magnetism: 0, workability: 46 },
  salt_flux: { hardness: 24, durability: 26, toughness: 16, ductility: 4, brittleness: 62, density: 36, heatResistance: 42, corrosionResistance: 22, conductivity: 22, thermalConductivity: 26, magnetism: 0, workability: 74 },
  ash_cement: { hardness: 58, durability: 68, toughness: 46, ductility: 4, brittleness: 48, density: 50, heatResistance: 76, corrosionResistance: 62, conductivity: 10, thermalConductivity: 22, magnetism: 2, workability: 54 },
  glass_ingot: { hardness: 58, durability: 44, toughness: 18, ductility: 1, brittleness: 88, density: 45, heatResistance: 52, corrosionResistance: 86, conductivity: 4, thermalConductivity: 16, magnetism: 0, workability: 32 },
  obsidian_glass: { hardness: 72, durability: 56, toughness: 26, ductility: 1, brittleness: 78, density: 55, heatResistance: 68, corrosionResistance: 88, conductivity: 6, thermalConductivity: 18, magnetism: 4, workability: 24 },
  silicon_wafer: { hardness: 66, durability: 38, toughness: 16, ductility: 3, brittleness: 84, density: 42, heatResistance: 64, corrosionResistance: 76, conductivity: 56, thermalConductivity: 70, magnetism: 0, workability: 28 },
  ice_crystal: { hardness: 14, durability: 18, toughness: 10, ductility: 2, brittleness: 76, density: 18, heatResistance: 4, corrosionResistance: 72, conductivity: 3, thermalConductivity: 38, magnetism: 0, workability: 20 },
  iron_bloom: { hardness: 62, durability: 72, toughness: 74, ductility: 52, brittleness: 26, density: 78, heatResistance: 66, corrosionResistance: 34, conductivity: 46, thermalConductivity: 48, magnetism: 70, workability: 62 },
  copper_bloom: { hardness: 42, durability: 58, toughness: 48, ductility: 86, brittleness: 14, density: 82, heatResistance: 48, corrosionResistance: 58, conductivity: 94, thermalConductivity: 88, magnetism: 2, workability: 84 },
  alumina_plate: { hardness: 84, durability: 66, toughness: 38, ductility: 1, brittleness: 72, density: 42, heatResistance: 92, corrosionResistance: 86, conductivity: 6, thermalConductivity: 32, magnetism: 0, workability: 30 },
  nickel_iron: { hardness: 70, durability: 78, toughness: 76, ductility: 50, brittleness: 24, density: 80, heatResistance: 72, corrosionResistance: 48, conductivity: 42, thermalConductivity: 44, magnetism: 92, workability: 56 },
  carbon_plate: { hardness: 78, durability: 62, toughness: 48, ductility: 10, brittleness: 58, density: 30, heatResistance: 86, corrosionResistance: 88, conductivity: 38, thermalConductivity: 58, magnetism: 0, workability: 44 },
  carbon_steel: { hardness: 86, durability: 88, toughness: 82, ductility: 44, brittleness: 30, density: 76, heatResistance: 74, corrosionResistance: 42, conductivity: 36, thermalConductivity: 42, magnetism: 78, workability: 52 },
  basalt_fiber: { hardness: 66, durability: 70, toughness: 62, ductility: 38, brittleness: 34, density: 34, heatResistance: 94, corrosionResistance: 82, conductivity: 8, thermalConductivity: 24, magnetism: 6, workability: 48 },
  basalt_composite: { hardness: 78, durability: 82, toughness: 78, ductility: 22, brittleness: 34, density: 52, heatResistance: 92, corrosionResistance: 80, conductivity: 12, thermalConductivity: 28, magnetism: 8, workability: 42 },
  geopolymer_block: { hardness: 64, durability: 76, toughness: 58, ductility: 4, brittleness: 42, density: 56, heatResistance: 84, corrosionResistance: 78, conductivity: 9, thermalConductivity: 22, magnetism: 4, workability: 46 },
  coral_lime: { hardness: 48, durability: 54, toughness: 32, ductility: 2, brittleness: 66, density: 40, heatResistance: 62, corrosionResistance: 70, conductivity: 7, thermalConductivity: 18, magnetism: 0, workability: 50 },
  toxic_glass: { hardness: 60, durability: 50, toughness: 20, ductility: 1, brittleness: 84, density: 48, heatResistance: 56, corrosionResistance: 94, conductivity: 8, thermalConductivity: 18, magnetism: 0, workability: 22 },
};

const smeltingClassFallbackAttributes = {
  carbon: { hardness: 38, durability: 46, toughness: 34, ductility: 8, brittleness: 48, density: 28, heatResistance: 68, corrosionResistance: 76, conductivity: 28, thermalConductivity: 32, magnetism: 0, workability: 52 },
  fiber: { hardness: 24, durability: 48, toughness: 58, ductility: 62, brittleness: 18, density: 18, heatResistance: 36, corrosionResistance: 54, conductivity: 6, thermalConductivity: 10, magnetism: 0, workability: 74 },
  polymer: { hardness: 26, durability: 48, toughness: 46, ductility: 58, brittleness: 24, density: 24, heatResistance: 34, corrosionResistance: 68, conductivity: 5, thermalConductivity: 8, magnetism: 0, workability: 78 },
  ceramic: { hardness: 62, durability: 58, toughness: 34, ductility: 2, brittleness: 72, density: 46, heatResistance: 76, corrosionResistance: 72, conductivity: 7, thermalConductivity: 22, magnetism: 0, workability: 36 },
  chemical: { hardness: 28, durability: 28, toughness: 18, ductility: 4, brittleness: 64, density: 38, heatResistance: 44, corrosionResistance: 28, conductivity: 20, thermalConductivity: 22, magnetism: 0, workability: 66 },
  glass: { hardness: 62, durability: 46, toughness: 20, ductility: 1, brittleness: 84, density: 48, heatResistance: 58, corrosionResistance: 86, conductivity: 5, thermalConductivity: 18, magnetism: 0, workability: 28 },
  crystal: { hardness: 56, durability: 34, toughness: 16, ductility: 2, brittleness: 80, density: 32, heatResistance: 42, corrosionResistance: 74, conductivity: 24, thermalConductivity: 48, magnetism: 0, workability: 24 },
  metal: { hardness: 58, durability: 70, toughness: 68, ductility: 62, brittleness: 22, density: 78, heatResistance: 62, corrosionResistance: 44, conductivity: 68, thermalConductivity: 66, magnetism: 36, workability: 66 },
  alloy: { hardness: 78, durability: 82, toughness: 78, ductility: 46, brittleness: 28, density: 74, heatResistance: 76, corrosionResistance: 52, conductivity: 38, thermalConductivity: 44, magnetism: 62, workability: 52 },
  composite: { hardness: 66, durability: 76, toughness: 68, ductility: 16, brittleness: 38, density: 50, heatResistance: 82, corrosionResistance: 78, conductivity: 12, thermalConductivity: 26, magnetism: 4, workability: 46 },
};

export default smeltingRules;

export const SMELTING_RECIPES_PER_TABLE = 12;
export const SMELTING_RECIPE_TABLE_ID_BASE = 20;
export const SMELTING_MERGE_RECIPE_TABLE_ID_BASE = 120;
export const SMELTING_MATERIAL_INPUT_PREFIX = "material:";
export const SMELTING_RECIPE_YIELD_BPS_DENOMINATOR = 10_000;

for (const material of smeltingRules.materials) {
  material.attributes = smeltingMaterialBaseAttributes(material);
  material.yieldBps = smeltingRecipeYieldBps(material);
  material.mergeYieldBps = SMELTING_RECIPE_YIELD_BPS_DENOMINATOR;
}


export function smeltingMaterialBaseAttributes(materialOrId, rules = smeltingRules) {
  const material = typeof materialOrId === "string" ? smeltingMaterialById(materialOrId, rules) : materialOrId;
  const fallback = smeltingClassFallbackAttributes[material?.class] ?? smeltingClassFallbackAttributes.composite;
  const profile = smeltingMaterialAttributeProfiles[material?.id] ?? fallback;
  return normalizeSmeltingAttributes({ ...fallback, ...profile });
}

export function normalizeSmeltingAttributes(attributes = {}) {
  const normalized = {};
  for (const key of SMELTING_MATERIAL_ATTRIBUTE_KEYS) {
    normalized[key] = clampSmeltingScore(attributes[key] ?? 0);
  }
  return normalized;
}

export function deriveSmeltingMaterialProperties({
  material,
  inputSlots = [],
  fuelSlots = [],
  itemId = 0,
  itemCode = 0,
  sourceSeed = 0,
} = {}) {
  const base = smeltingMaterialBaseAttributes(material);
  const source = deriveSmeltingSourceAttributes(inputSlots, material);
  const quality = deriveSmeltingQuality({ material, inputSlots, fuelSlots, itemId, itemCode, sourceSeed });
  const attributes = {};
  for (const key of SMELTING_MATERIAL_ATTRIBUTE_KEYS) {
    const baseValue = base[key] ?? 0;
    const sourceValue = source[key] ?? baseValue;
    const qualityDelta = (quality.score - 70) * smeltingQualityWeightForAttribute(key);
    attributes[key] = clampSmeltingScore(Math.round(baseValue * 0.7 + sourceValue * 0.2 + quality.score * 0.1 + qualityDelta));
  }
  return {
    attributes,
    purity: quality.purity,
    grade: quality.grade,
    qualityScore: quality.score,
  };
}

export function deriveSmeltingQuality({ material, inputSlots = [], fuelSlots = [], itemId = 0, itemCode = 0, sourceSeed = 0 } = {}) {
  const requiredHeat = Math.max(1, Number(material?.requiredHeatTier) || 1);
  const maxFuel = Math.max(0, ...fuelSlots.map((slot) => Number(slot?.fuelTier ?? slot?.heatTier ?? 0)).filter(Number.isFinite));
  const heatFit = maxFuel > 0 ? clampNumber(maxFuel - requiredHeat, -2, 2) : 0;
  const sourceCount = Math.max(1, inputSlots.length || recipeInputCount(material));
  const artisan = Math.max(1, Number(material?.artisanLevel) || 1);
  const seed = numericSmeltingSeed([material?.id ?? "", itemId, itemCode, sourceSeed, sourceCount].join("|"));
  const variance = (seed % 11) - 5;
  const score = clampSmeltingScore(Math.round(62 + artisan * 4 + sourceCount * 1.4 + heatFit * 5 + variance));
  return {
    score,
    purity: clampSmeltingScore(Math.round(score + 8 + Math.max(0, heatFit) * 2 - Math.max(0, sourceCount - 4))),
    grade: smeltingGradeForScore(score),
  };
}

export function deriveSmeltingSourceAttributes(inputSlots = [], material = null) {
  if (!inputSlots.length) return smeltingMaterialBaseAttributes(material);
  const totals = Object.fromEntries(SMELTING_MATERIAL_ATTRIBUTE_KEYS.map((key) => [key, 0]));
  let weightTotal = 0;
  for (const slot of inputSlots) {
    const profile = smeltingSourceAttributeProfile(slot);
    const weight = Math.max(0.5, Number(slot?.massKg) || 1);
    for (const key of SMELTING_MATERIAL_ATTRIBUTE_KEYS) totals[key] += profile[key] * weight;
    weightTotal += weight;
  }
  const result = {};
  for (const key of SMELTING_MATERIAL_ATTRIBUTE_KEYS) result[key] = clampSmeltingScore(Math.round(totals[key] / Math.max(1, weightTotal)));
  return result;
}

export function smeltingSourceAttributeProfile(slot = {}) {
  if (slot?.materialProperties?.attributes) return normalizeSmeltingAttributes(slot.materialProperties.attributes);
  const category = slot?.category ?? slot?.atlas?.category ?? "";
  const densityKgM3 = Number(slot?.densityKgM3 ?? slot?.atlas?.physical?.densityKgM3 ?? 0);
  const density = densityKgM3 > 0 ? clampSmeltingScore(Math.round(densityKgM3 / 100)) : 35;
  const composition = slot?.composition ?? slot?.atlas?.composition ?? [];
  const elementScore = (symbol) => compositionMidpointForElement(composition, symbol);
  const fe = elementScore("Fe");
  const c = elementScore("C");
  const si = elementScore("Si");
  const ca = elementScore("Ca");
  const al = elementScore("Al");
  const organic = ["organic", "plants", "aquatic"].includes(category);
  const fluid = category === "fluids";
  return normalizeSmeltingAttributes({
    hardness: organic ? 18 + c * 0.2 : 26 + si * 0.55 + fe * 0.8 + al * 0.45,
    durability: organic ? 30 + c * 0.35 : 35 + density * 0.32 + fe * 0.7 + si * 0.25,
    toughness: organic ? 42 + c * 0.25 : 30 + density * 0.22 + fe * 0.65,
    ductility: organic ? 58 : 18 + fe * 0.25 + ca * 0.15,
    brittleness: fluid ? 8 : organic ? 22 : 36 + si * 0.4 + ca * 0.25,
    density,
    heatResistance: organic ? 24 + c * 0.5 : 38 + si * 0.35 + al * 0.55 + fe * 0.25,
    corrosionResistance: organic ? 42 : 44 + si * 0.25 + ca * 0.2,
    conductivity: 4 + fe * 0.7 + c * 0.25,
    thermalConductivity: 8 + density * 0.18 + fe * 0.35 + c * 0.18,
    magnetism: fe * 2.4,
    workability: organic ? 72 : fluid ? 20 : 46 + ca * 0.15 - si * 0.1,
  });
}

export function smeltingTopAttributeEntries(attributes = {}, count = 4) {
  return SMELTING_MATERIAL_ATTRIBUTE_KEYS
    .map((key) => [key, clampSmeltingScore(attributes[key] ?? 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
}

export function smeltingGradeForScore(score) {
  if (score >= 92) return "mythic";
  if (score >= 82) return "prime";
  if (score >= 70) return "refined";
  if (score >= 56) return "standard";
  return "crude";
}

function recipeInputCount(material) {
  return [...(material?.rawInputs ?? []), ...(material?.catalysts ?? [])]
    .reduce((sum, input) => sum + (Number(input?.amount) || 0), 0);
}

function smeltingQualityWeightForAttribute(key) {
  if (["hardness", "durability", "toughness", "heatResistance", "corrosionResistance"].includes(key)) return 0.18;
  if (["conductivity", "thermalConductivity", "magnetism"].includes(key)) return 0.12;
  if (key === "brittleness") return -0.08;
  return 0.08;
}

function compositionMidpointForElement(composition = [], symbol) {
  const entry = composition.find(([candidate]) => candidate === symbol);
  if (!entry) return 0;
  return smeltingCompositionMidpoint(entry[1]);
}

function smeltingCompositionMidpoint(range) {
  const numbers = String(range).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length) return 0;
  if (numbers.length === 1) return numbers[0];
  return (numbers[0] + numbers[1]) / 2;
}

function numericSmeltingSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampSmeltingScore(value) {
  return clampNumber(Math.round(Number(value) || 0), 0, 100);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function validateSmeltingRules(rules = smeltingRules) {
  if (!rules || typeof rules !== "object") throw new Error("Missing smelting rules");
  if (!Number.isInteger(rules.schemaVersion)) throw new Error("Missing smelting schemaVersion");
  if (!rules.ruleSet) throw new Error("Missing smelting ruleSet");
  const heatTiers = Array.isArray(rules.heatTiers) ? rules.heatTiers : [];
  const fuels = Array.isArray(rules.fuels) ? rules.fuels : [];
  const materials = Array.isArray(rules.materials) ? rules.materials : [];
  if (!heatTiers.length) throw new Error("Smelting rules require heatTiers");
  if (!fuels.length) throw new Error("Smelting rules require fuels");
  if (!materials.length) throw new Error("Smelting rules require materials");

  const heatTierIds = new Set();
  for (const tier of heatTiers) {
    if (!Number.isInteger(tier.tier) || tier.tier < 1) throw new Error(`Invalid heat tier: ${JSON.stringify(tier)}`);
    if (heatTierIds.has(tier.tier)) throw new Error(`Duplicate heat tier: ${tier.tier}`);
    heatTierIds.add(tier.tier);
  }

  const fuelIds = new Set();
  for (const fuel of fuels) {
    if (!fuel.id) throw new Error("Fuel missing id");
    if (fuelIds.has(fuel.id)) throw new Error(`Duplicate fuel id: ${fuel.id}`);
    fuelIds.add(fuel.id);
    if (!heatTierIds.has(fuel.heatTier)) throw new Error(`Fuel ${fuel.id} uses unknown heat tier ${fuel.heatTier}`);
    if (fuel.sourceType === "raw" && !Array.isArray(fuel.sourceKeys)) throw new Error(`Raw fuel ${fuel.id} requires sourceKeys`);
    if (fuel.sourceType === "material" && !fuel.materialId) throw new Error(`Material fuel ${fuel.id} requires materialId`);
  }

  const materialIds = new Set();
  for (const material of materials) {
    if (!material.id) throw new Error("Material missing id");
    if (materialIds.has(material.id)) throw new Error(`Duplicate material id: ${material.id}`);
    materialIds.add(material.id);
    if (!material.class) throw new Error(`Material ${material.id} missing class`);
    if (!Array.isArray(material.rawInputs) || !material.rawInputs.length) throw new Error(`Material ${material.id} requires rawInputs`);
    if (!heatTierIds.has(material.requiredHeatTier)) throw new Error(`Material ${material.id} uses unknown heat tier ${material.requiredHeatTier}`);
    if (!Number.isInteger(material.yieldCount) || material.yieldCount < 1) throw new Error(`Material ${material.id} has invalid yieldCount`);
    if (!Number.isInteger(material.yieldBps) || material.yieldBps < 1 || material.yieldBps > SMELTING_RECIPE_YIELD_BPS_DENOMINATOR) {
      throw new Error(`Material ${material.id} has invalid yieldBps`);
    }
    const attributes = smeltingMaterialBaseAttributes(material);
    for (const key of SMELTING_MATERIAL_ATTRIBUTE_KEYS) {
      if (!Number.isInteger(attributes[key]) || attributes[key] < 0 || attributes[key] > 100) {
        throw new Error(`Material ${material.id} has invalid attribute ${key}`);
      }
    }
    for (const input of [...material.rawInputs, ...(material.catalysts ?? [])]) {
      if (!input.key || !Number.isFinite(input.amount) || input.amount < 1) {
        throw new Error(`Material ${material.id} has invalid input ${JSON.stringify(input)}`);
      }
    }
  }

  for (const fuel of fuels) {
    if (fuel.sourceType === "material" && !materialIds.has(fuel.materialId)) {
      throw new Error(`Fuel ${fuel.id} points to unknown material ${fuel.materialId}`);
    }
  }
  return true;
}

export function smeltingHeatTierByTier(tier, rules = smeltingRules) {
  return (rules.heatTiers ?? []).find((item) => item.tier === tier) ?? null;
}

export function smeltingMaterialById(id, rules = smeltingRules) {
  return (rules.materials ?? []).find((material) => material.id === id) ?? null;
}

export function smeltingRecipeIdForMaterialId(id, rules = smeltingRules) {
  const index = (rules.materials ?? []).findIndex((material) => material.id === id);
  return index >= 0 ? 1001 + index : 0;
}

export function smeltingMergeRecipeIdForMaterialId(id, rules = smeltingRules) {
  const index = (rules.materials ?? []).findIndex((material) => material.id === id);
  return index >= 0 ? 2001 + index : 0;
}

export function smeltingRecipeTableIdForMaterialId(id, rules = smeltingRules) {
  const index = (rules.materials ?? []).findIndex((material) => material.id === id);
  return index >= 0 ? Math.floor(index / SMELTING_RECIPES_PER_TABLE) + SMELTING_RECIPE_TABLE_ID_BASE : 0;
}

export function smeltingMergeRecipeTableIdForMaterialId(id, rules = smeltingRules) {
  const index = (rules.materials ?? []).findIndex((material) => material.id === id);
  return index >= 0 ? Math.floor(index / SMELTING_RECIPES_PER_TABLE) + SMELTING_MERGE_RECIPE_TABLE_ID_BASE : 0;
}

export function smeltingRecipeTableIdForRecipeId(recipeId, rules = smeltingRules) {
  const index = Number(recipeId) - 1001;
  if (Number.isInteger(index) && index >= 0 && index < (rules.materials ?? []).length) {
    return Math.floor(index / SMELTING_RECIPES_PER_TABLE) + SMELTING_RECIPE_TABLE_ID_BASE;
  }
  const mergeIndex = Number(recipeId) - 2001;
  return Number.isInteger(mergeIndex) && mergeIndex >= 0 && mergeIndex < (rules.materials ?? []).length
    ? Math.floor(mergeIndex / SMELTING_RECIPES_PER_TABLE) + SMELTING_MERGE_RECIPE_TABLE_ID_BASE
    : 0;
}

export function smeltingMaterialIdForRecipeId(recipeId, rules = smeltingRules) {
  const index = Number(recipeId) - 1001;
  if (Number.isInteger(index) && index >= 0) return rules.materials?.[index]?.id ?? null;
  const mergeIndex = Number(recipeId) - 2001;
  return Number.isInteger(mergeIndex) && mergeIndex >= 0 ? rules.materials?.[mergeIndex]?.id ?? null : null;
}

export function smeltingMaterialItemCode(id, rules = smeltingRules) {
  const index = (rules.materials ?? []).findIndex((material) => material.id === id);
  return index >= 0 ? 1001 + index : 0;
}

export function smeltingMaterialIdForItemCode(itemCode, rules = smeltingRules) {
  const index = Number(itemCode) - 1001;
  return Number.isInteger(index) && index >= 0 ? rules.materials?.[index]?.id ?? null : null;
}

export function smeltingMaterialInputKey(materialId) {
  return `${SMELTING_MATERIAL_INPUT_PREFIX}${materialId}`;
}

export function smeltingMaterialIdForInputKey(key) {
  const text = String(key ?? "");
  return text.startsWith(SMELTING_MATERIAL_INPUT_PREFIX)
    ? text.slice(SMELTING_MATERIAL_INPUT_PREFIX.length)
    : null;
}

export function createSmeltingMergeRecipe(materialOrId, rules = smeltingRules) {
  const material = typeof materialOrId === "string" ? smeltingMaterialById(materialOrId, rules) : materialOrId;
  if (!material?.id) return null;
  return {
    ...material,
    recipeKind: "merge",
    materialInputs: [{ key: smeltingMaterialInputKey(material.id), amount: 1 }],
    rawInputs: [],
    catalysts: [],
    yieldBps: material.mergeYieldBps ?? SMELTING_RECIPE_YIELD_BPS_DENOMINATOR,
    yieldCount: 1,
  };
}

export function smeltingRecipeYieldBps(recipe) {
  const explicit = Number(recipe?.yieldBps);
  if (Number.isInteger(explicit) && explicit > 0) {
    return Math.min(SMELTING_RECIPE_YIELD_BPS_DENOMINATOR, explicit);
  }
  return ({
    carbon: 5500,
    fiber: 6500,
    polymer: 6000,
    ceramic: 7200,
    glass: 8000,
    flux: 7000,
    stone: 8500,
    metal: 6200,
    composite: 5800,
  }[recipe?.class] ?? 6000);
}

export function smeltingSkillOutputBpsForLevel(level) {
  return Math.min(SMELTING_RECIPE_YIELD_BPS_DENOMINATOR, 7000 + Math.max(0, Math.min(10, Math.floor(Number(level) || 0))) * 300);
}

export function smeltingFuelForRawKey(key, rules = smeltingRules) {
  return (rules.fuels ?? [])
    .filter((fuel) => fuel.sourceType === "raw" && (fuel.sourceKeys ?? []).includes(key))
    .sort((a, b) => (b.heatTier ?? 0) - (a.heatTier ?? 0))[0] ?? null;
}

export function smeltingFuelForMaterialId(materialId, rules = smeltingRules) {
  return (rules.fuels ?? [])
    .filter((fuel) => fuel.sourceType === "material" && fuel.materialId === materialId)
    .sort((a, b) => (b.heatTier ?? 0) - (a.heatTier ?? 0))[0] ?? null;
}

export function createSmeltingInputCounts(keys = []) {
  const counts = new Map();
  for (const key of keys.filter(Boolean)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function recipeRequirements(recipe) {
  return [...(recipe?.rawInputs ?? []), ...(recipe?.materialInputs ?? []), ...(recipe?.catalysts ?? [])];
}

export function hasRequiredSmeltingInputs(recipe, counts) {
  return recipeRequirements(recipe).every((input) => (counts.get(input.key) ?? 0) >= input.amount);
}

export function smeltingRecipeInputMultiplier(recipe, counts) {
  const requirements = recipeRequirements(recipe);
  if (!requirements.length || !counts?.size) return 0;
  const requiredKeys = new Set(requirements.map((input) => input.key));
  for (const key of counts.keys()) {
    if (!requiredKeys.has(key)) return 0;
  }
  let multiplier = null;
  for (const input of requirements) {
    const required = Math.max(1, Number(input.amount) || 1);
    const actual = counts.get(input.key) ?? 0;
    if (actual < required || actual % required !== 0) return 0;
    const nextMultiplier = actual / required;
    if (multiplier === null) multiplier = nextMultiplier;
    if (multiplier !== nextMultiplier) return 0;
  }
  return multiplier ?? 0;
}

export function hasExactSmeltingInputRatio(recipe, counts) {
  return smeltingRecipeInputMultiplier(recipe, counts) >= 1;
}

export function smeltingRecipeMatchScore(recipe, counts) {
  const requirements = recipeRequirements(recipe);
  const requiredTotal = requirements.reduce((sum, input) => sum + input.amount, 0);
  const multiplier = smeltingRecipeInputMultiplier(recipe, counts);
  const matchedTotal = requirements.reduce((sum, input) => sum + Math.min(counts.get(input.key) ?? 0, input.amount * Math.max(1, multiplier)), 0);
  const exact = multiplier >= 1;
  const waste = [...counts.entries()].reduce((sum, [key, count]) => {
    const required = requirements.find((input) => input.key === key)?.amount * Math.max(1, multiplier) || 0;
    return sum + Math.max(0, count - required);
  }, 0);
  return {
    exact,
    multiplier,
    matchedTotal,
    requiredTotal: requiredTotal * Math.max(1, multiplier),
    ratio: requiredTotal > 0 ? matchedTotal / (requiredTotal * Math.max(1, multiplier)) : 0,
    waste,
  };
}

export function findBestSmeltingRecipeForKeys(keys = [], rules = smeltingRules) {
  const counts = createSmeltingInputCounts(keys);
  const materialMergeRecipe = createMergeCandidateFromCounts(counts, rules);
  const candidates = [
    ...(rules.materials ?? []),
    ...(materialMergeRecipe ? [materialMergeRecipe] : []),
  ]
    .map((recipe) => ({ recipe, score: smeltingRecipeMatchScore(recipe, counts) }))
    .filter(({ score }) => score.matchedTotal > 0)
    .sort((a, b) => {
      if (a.score.exact !== b.score.exact) return a.score.exact ? -1 : 1;
      if (b.score.ratio !== a.score.ratio) return b.score.ratio - a.score.ratio;
      if (a.score.waste !== b.score.waste) return a.score.waste - b.score.waste;
      return (a.recipe.requiredHeatTier ?? 0) - (b.recipe.requiredHeatTier ?? 0);
    });
  return candidates[0] ?? null;
}

function createMergeCandidateFromCounts(counts, rules) {
  if (!counts?.size || counts.size !== 1) return null;
  const [[key, count]] = counts.entries();
  if (count < 2) return null;
  const materialId = smeltingMaterialIdForInputKey(key);
  if (!materialId) return null;
  return createSmeltingMergeRecipe(materialId, rules);
}

export function missingSmeltingInputs(recipe, keys = []) {
  const counts = createSmeltingInputCounts(keys);
  return recipeRequirements(recipe)
    .map((input) => ({ ...input, missing: Math.max(0, input.amount - (counts.get(input.key) ?? 0)) }))
    .filter((input) => input.missing > 0);
}

validateSmeltingRules(smeltingRules);
