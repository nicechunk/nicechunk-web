export function updateAvatarMotion({
  THREE,
  avatar,
  player,
  avatarGroundOffset,
  miningSwingDuration,
  cameraPitchMin,
  cameraPitchMax,
  headPitchMin,
  headPitchMax,
}) {
  avatar.position.copy(player.position);
  avatar.position.y -= avatarGroundOffset;
  const moving = player.moving;
  const t = performance.now() * 0.011;
  const swing = moving ? Math.sin(t) * 0.32 : Math.sin(t * 0.25) * 0.03;
  const { leftArm, rightArm, leftLeg, rightLeg, head } = avatar.userData.limbs;
  const mineRemaining = Math.max(0, player.miningSwing - performance.now());
  const mineProgress = mineRemaining > 0 ? 1 - mineRemaining / miningSwingDuration : 0;
  if (mineRemaining <= 0 && player.miningContact) player.miningContact = null;
  const miningPose = getMiningPose(THREE, mineProgress);
  leftArm.rotation.x = swing;
  rightArm.rotation.z = miningPose.active ? -0.2 : 0;
  rightArm.rotation.x = miningPose.active ? miningPose.armX : -swing;
  leftLeg.rotation.x = -swing;
  rightLeg.rotation.x = swing;
  head.rotation.x = THREE.MathUtils.mapLinear(player.cameraPitch, cameraPitchMin, cameraPitchMax, headPitchMin, headPitchMax);
  head.rotation.y = moving ? Math.sin(t * 0.5) * 0.04 : Math.sin(t * 0.2) * 0.025;
  avatar.position.y += moving ? Math.abs(Math.sin(t * 0.5)) * 0.035 : 0;
}

export function startAvatarHandSwing(player, miningSwingDuration) {
  player.miningSwing = performance.now() + miningSwingDuration * 0.72;
  player.miningHitDone = false;
  player.miningContact = null;
  player.miningTargetHit = null;
  player.miningPreviousToolBoxes = null;
}

export function getMiningPose(THREE, progress) {
  if (progress <= 0 || progress >= 1) return { active: false, armX: 0 };
  if (progress < 0.2) {
    const raise = easeOut(progress / 0.2);
    return { active: true, armX: THREE.MathUtils.lerp(0.15, 1.95, raise) };
  }
  const strike = easeIn((progress - 0.2) / 0.8);
  return { active: true, armX: THREE.MathUtils.lerp(1.95, -0.2, strike) };
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t) {
  return t * t * t;
}
