import { addBackpackParts, backpackMaterialSpecs } from "./backpack.js";

export const avatarMaterialSpecs = {
  skin: [0xc99061, 0.06],
  skinShade: [0xb2774f, 0.06],
  shirt: [0x2e8b86, 0.08],
  shirtDark: [0x216966, 0.06],
  shirtLight: [0x58b6a8, 0.06],
  pants: [0x294a7c, 0.05],
  pantsDark: [0x1d3157, 0.04],
  boots: [0x2b2520, 0.05],
  belt: [0x4d3424, 0.04],
  buckle: [0xd6a84a, 0.04],
  ...backpackMaterialSpecs,
  watchBand: [0x1d1712, 0.04],
  watchCase: [0xd6a84a, 0.04],
  watchFace: [0x2ba9d6, 0.03],
  toolHandle: [0x6d4a2d, 0.04],
  toolHead: [0x9ea6a8, 0.04],
  toolEdge: [0xe6eceb, 0.02],
  hair: [0x3f2918, 0.05],
  hairShade: [0x2b1b11, 0.04],
  eye: [0x151414, 0],
  mouth: [0x7c392f, 0],
};

export function createAvatarMaterials(THREE, materialFactory = (color) => new THREE.MeshLambertMaterial({ color })) {
  return Object.fromEntries(
    Object.entries(avatarMaterialSpecs).map(([key, [color, roughness]]) => [
      key,
      materialFactory(color, roughness, key),
    ]),
  );
}

export function createAvatar({ THREE, cubeGeometry, materials }) {
  function addBox(parent, name, material, position, scale) {
    const mesh = new THREE.Mesh(cubeGeometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createTool() {
    const tool = new THREE.Group();
    tool.name = "equippedTool";
    tool.rotation.set(-0.44, 0.18, -0.18);
    addBox(tool, "toolHandle", materials.toolHandle, [0, 0, -0.46], [0.14, 0.14, 1.16]);
    addBox(tool, "toolGrip", materials.belt, [0, 0, 0.12], [0.18, 0.18, 0.28]);
    addBox(tool, "toolNeck", materials.toolHead, [0, 0, -0.86], [0.18, 0.18, 0.34]);
    addBox(tool, "toolHead", materials.toolHead, [0, 0, -1.08], [0.24, 0.86, 0.24]);
    addBox(tool, "toolTipTop", materials.toolEdge, [0, 0.52, -1.08], [0.18, 0.18, 0.18]);
    addBox(tool, "toolTipBottom", materials.toolEdge, [0, -0.52, -1.08], [0.18, 0.18, 0.18]);
    return tool;
  }

  function createArm(name, x) {
    const arm = new THREE.Group();
    arm.name = name;
    arm.position.set(x, 2.05, 0);
    addBox(arm, `${name}Sleeve`, materials.shirtDark, [0, -0.26, 0], [0.34, 0.5, 0.38]);
    addBox(arm, `${name}Cuff`, materials.shirtLight, [0, -0.54, -0.01], [0.36, 0.06, 0.4]);
    addBox(arm, `${name}Hand`, materials.skin, [0, -0.78, 0], [0.32, 0.42, 0.34]);
    addBox(arm, `${name}Knuckle`, materials.skinShade, [0, -0.95, -0.19], [0.22, 0.08, 0.05]);
    if (name === "leftArm") {
      addBox(arm, "watchBand", materials.watchBand, [0, -0.6, -0.2], [0.34, 0.08, 0.045]);
      addBox(arm, "watchCase", materials.watchCase, [0, -0.6, -0.232], [0.2, 0.14, 0.035]);
      addBox(arm, "watchFace", materials.watchFace, [0, -0.6, -0.255], [0.14, 0.08, 0.025]);
    }
    if (name === "rightArm") {
      const tool = createTool();
      tool.position.set(0.16, -0.9, -0.22);
      arm.add(tool);
      const heldBlock = addBox(arm, "heldBlock", materials.grass, [0.14, -0.92, -0.28], [0.38, 0.38, 0.38]);
      heldBlock.rotation.set(-0.25, 0.2, -0.12);
      heldBlock.visible = false;
    }
    return arm;
  }

  function createLeg(name, x) {
    const leg = new THREE.Group();
    leg.name = name;
    leg.position.set(x, 1.15, 0);
    addBox(leg, `${name}Pants`, materials.pants, [0, -0.34, 0], [0.36, 0.76, 0.36]);
    addBox(leg, `${name}PantStripe`, materials.pantsDark, [0, -0.22, -0.2], [0.22, 0.5, 0.045]);
    addBox(leg, `${name}Boot`, materials.boots, [0, -0.94, -0.03], [0.4, 0.42, 0.46]);
    addBox(leg, `${name}BootLip`, materials.belt, [0, -0.7, -0.03], [0.42, 0.12, 0.48]);
    return leg;
  }

  const root = new THREE.Group();
  root.name = "CodeBuiltVoxelAvatar";

  const torso = new THREE.Group();
  torso.name = "torso";
  root.add(torso);

  addBox(torso, "bodyCore", materials.shirt, [0, 1.55, 0], [0.84, 1.14, 0.46]);
  addBox(torso, "shirtPanel", materials.shirtLight, [0, 1.62, -0.255], [0.5, 0.72, 0.045]);
  addBox(torso, "leftCollar", materials.shirtDark, [-0.14, 2.05, -0.28], [0.2, 0.12, 0.05]);
  addBox(torso, "rightCollar", materials.shirtDark, [0.14, 2.05, -0.28], [0.2, 0.12, 0.05]);
  addBox(torso, "belt", materials.belt, [0, 1.02, -0.27], [0.9, 0.13, 0.06]);
  addBox(torso, "buckle", materials.buckle, [0, 1.02, -0.31], [0.16, 0.16, 0.07]);
  addBackpackParts({ THREE, cubeGeometry, materials, parent: torso });

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 2.45, 0);
  root.add(head);
  addBox(head, "headCore", materials.skin, [0, 0, 0], [0.86, 0.86, 0.86]);
  addBox(head, "leftEye", materials.eye, [-0.18, 0.08, -0.455], [0.11, 0.11, 0.045]);
  addBox(head, "rightEye", materials.eye, [0.18, 0.08, -0.455], [0.11, 0.11, 0.045]);
  addBox(head, "nose", materials.skinShade, [0, -0.06, -0.47], [0.12, 0.16, 0.05]);
  addBox(head, "mouth", materials.mouth, [0, -0.23, -0.465], [0.28, 0.06, 0.045]);
  addBox(head, "hairTop", materials.hair, [0, 0.47, -0.02], [0.94, 0.18, 0.94]);
  addBox(head, "hairBack", materials.hairShade, [0, 0.16, 0.46], [0.94, 0.5, 0.12]);
  addBox(head, "leftHairSide", materials.hair, [-0.47, 0.17, 0], [0.12, 0.5, 0.82]);
  addBox(head, "rightHairSide", materials.hair, [0.47, 0.17, 0], [0.12, 0.5, 0.82]);
  addBox(head, "frontHairLeft", materials.hair, [-0.22, 0.32, -0.48], [0.28, 0.18, 0.12]);
  addBox(head, "frontHairRight", materials.hairShade, [0.16, 0.33, -0.48], [0.34, 0.2, 0.12]);

  const leftArm = createArm("leftArm", -0.64);
  const rightArm = createArm("rightArm", 0.64);
  const leftLeg = createLeg("leftLeg", -0.23);
  const rightLeg = createLeg("rightLeg", 0.23);
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  root.userData.limbs = {
    leftArm,
    rightArm,
    rightTool: rightArm.getObjectByName("equippedTool"),
    heldBlock: rightArm.getObjectByName("heldBlock"),
    leftLeg,
    rightLeg,
    head,
  };
  return root;
}
