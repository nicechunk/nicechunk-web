import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";

import {
  createExecuteSmeltingInstruction,
  deriveMaterialPhysicsPda,
  deriveSmeltingRecipeTablePda,
} from "../../src/chain/nicechunkChain.js";

test("recipe table 221 recipe 1015 keeps its production selection and nine-account ABI", () => {
  const [recipeTable] = deriveSmeltingRecipeTablePda(221n);
  const instruction = createExecuteSmeltingInstruction({
    owner: Keypair.generate().publicKey,
    recipeTable,
    backpack: Keypair.generate().publicKey,
    recipeId: 1015,
    inputIndexes: [8, 9, 0],
    fuelIndexes: [1],
    batchMultiplier: 1,
  });
  const [materialPhysics] = deriveMaterialPhysicsPda();

  assert.equal(instruction.keys.length, 9);
  assert.equal(instruction.keys[1].pubkey.toBase58(), recipeTable.toBase58());
  assert.equal(instruction.keys[5].pubkey.toBase58(), materialPhysics.toBase58());
  assert.equal(instruction.data.readBigUInt64LE(2), 1015n);
  assert.equal(instruction.data.readUInt8(10), 3);
  assert.equal(instruction.data.readUInt8(11), 1);
  assert.equal(instruction.data.readUInt16LE(12), 1);
  assert.deepEqual([...instruction.data.subarray(14, 17)], [8, 9, 0]);
  assert.equal(instruction.data.readUInt8(17), 1);
});
