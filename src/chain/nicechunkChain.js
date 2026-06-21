import { Buffer } from "buffer";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { EMPTY_BLOCK, WorldMapBlock } from "../world/blocks.js";
import { chunkSize } from "../world/config.js";
import { createNicechunkRpcFetch, getNicechunkRpcUrl, reportRpcError, rpcConfigChangedEventName } from "../rpcConfig.js";

if (!globalThis.Buffer) globalThis.Buffer = Buffer;

const coreProgramId = new PublicKey("9EhMCRYMJej1F21KzaA5Zao3khGGc5aJbDGbnxaogQHu");
const playerProgramId = new PublicKey("oeaRMVnPoV4iENnGCCtaEeRxU5be515s4YYe6aXQuKe");
const chunkProgramId = new PublicKey("12rCvz9PZ64Uix1TCiHEGU4AN4ZS1h4jv5u7CkqTRdk5");
const backpackProgramId = new PublicKey("FwTrMDGyRg653L9svvt5aoGii9ZjX1WekSFWcwByjxqt");
const marketProgramId = new PublicKey("1PwPzFtdJ5gQqku5gBo4b6Wvo48Qe8NuXSogUP8TWpR");
const globalConfigSeed = "global-config";
const playerSeed = "player";
const playerSessionSeed = "session";
const chunkSeed = "chunk";
const chunkBrokenSeed = "chunk-broken";
const backpackSeed = "backpack";
const marketListingSeed = "listing";
const marketAuthoritySeed = "market-authority";
const globalConfigLength = 293;
const globalConfigMagic = "NCKCFG01";
const worldConfigStorageKey = "nicechunk.worldConfig.v1";
const legacyPlayerProfileLength = 417;
const playerProfileLength = 449;
const chunkStateLength = 8280;
const chunkHeaderLength = 88;
const blockDeltaLength = 64;
const chunkMagic = "NCKCHK01";
const chunkBrokenMagic = "NCBK";
const chunkBrokenHeaderLength = 16;
const chunkBrokenRecordLength = 3;
const backpackMagic = "NCKBPK01";
const backpackDefaultCapacity = 50;
const backpackMaxCapacity = 99;
const backpackHeaderLength = 128;
const backpackRecordLength = 10;
const backpackAccountLength = backpackHeaderLength + backpackMaxCapacity * backpackRecordLength;
const marketListingMagic = "NCKMKT01";
const marketListingLength = 216;
const marketListingStateOffset = 11;
const marketListingSellerOffset = 12;
const marketListingCategoryOffset = 52;
const marketListingCurrencyOffset = 53;
const marketListingSourceKindOffset = 54;
const marketAssetMagic = "NCKAST01";
const marketAssetPayloadLength = 96;
const marketAssetLength = 256;
const marketStateNames = new Map([
  [1, "active"],
  [2, "canceled"],
  [3, "sold"],
]);
const marketStateCodes = new Map(Array.from(marketStateNames.entries()).map(([code, key]) => [key, code]));
const marketCategoryCodes = new Map([
  ["raw", 1],
  ["equipment", 2],
  ["building", 3],
  ["clothing", 4],
]);
const marketCategoryNames = new Map(Array.from(marketCategoryCodes.entries()).map(([key, code]) => [code, key]));
const marketCurrencyCodes = new Map([
  ["NCK", 1],
  ["SOL", 2],
]);
const marketCurrencyNames = new Map(Array.from(marketCurrencyCodes.entries()).map(([key, code]) => [code, key]));
const marketSourceKindCodes = new Map([
  ["backpack", 1],
  ["asset", 2],
]);
const marketSourceKindNames = new Map(Array.from(marketSourceKindCodes.entries()).map(([key, code]) => [code, key]));
const marketDynamicAssetItemCode = 65535;
const marketAssetItemCodes = new Map([
  ["iron_pickaxe", 1],
  ["dirt", 2],
  ["stone", 3],
  ["sand", 4],
  ["trunk", 5],
  ["leaves", 6],
  ["red_flower", 7],
  ["forged_item", 8],
  ["backpack_resource", 9],
]);
const marketAssetItemIds = new Map(Array.from(marketAssetItemCodes.entries()).map(([key, code]) => [code, key]));
const marketCurrencyDecimals = new Map([
  ["NCK", 6],
  ["SOL", 9],
]);
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const nckMint = new PublicKey("HSnWF5kjkWVrceW2SaSskScuLveUZE4gpthZ2ZXRPQPo");
const marketTreasury = new PublicKey("CtPV2vmqNNwUSfMu5nz58ZtMPy6ZvxL4LyNdPHVW7WvF");
const storageWalletKey = "nicechunk.walletAddress";
const chainSyncStorageKey = "nicechunk.chainSync";
const equippedBackpackStorageKeyPrefix = "nicechunk.equippedBackpack.v1.";
const sessionStorageKeyPrefix = "nicechunk.session.v1.";
const sessionFundingStorageKeyPrefix = "nicechunk.sessionFundingLamports.v1.";
const sessionFundingAcknowledgedKeyPrefix = "nicechunk.sessionFundingAcknowledged.v1.";
const sessionDurationSeconds = 8 * 60 * 60;
const sessionRefreshSkewSeconds = 15 * 60;
const lamportsPerSol = 1_000_000_000;
const minimumSessionFundingLamports = 100_000_000;
const sessionMinimumMiningLamports = 8_000_000;
const sessionAllowedActions = (1 << 1) | (1 << 2);
const sessionMaxActions = 10_000;
const inspectOnlyBlockId = 0xffff;

const blockIdByRenderType = new Map([
  ["grass", WorldMapBlock.Grass],
  ["dirt", WorldMapBlock.Dirt],
  ["stone", WorldMapBlock.Stone],
  ["deepStone", WorldMapBlock.DeepStone],
  ["sand", WorldMapBlock.Sand],
  ["sandstone", WorldMapBlock.Sand],
  ["gravel", WorldMapBlock.Gravel],
  ["clay", WorldMapBlock.Clay],
  ["mud", WorldMapBlock.Mud],
  ["dryDirt", WorldMapBlock.DryDirt],
  ["saltFlat", WorldMapBlock.SaltFlat],
  ["snow", WorldMapBlock.Snow],
  ["ice", WorldMapBlock.Ice],
  ["frozenSoil", WorldMapBlock.FrozenSoil],
  ["basalt", WorldMapBlock.Basalt],
  ["ash", WorldMapBlock.Ash],
  ["bedrock", WorldMapBlock.Bedrock],
  ["water", WorldMapBlock.Water],
  ["swampWater", WorldMapBlock.SwampWater],
  ["toxicWater", WorldMapBlock.ToxicWater],
  ["lava", WorldMapBlock.Lava],
  ["quicksand", WorldMapBlock.Quicksand],
  ["trunk", WorldMapBlock.Trunk],
  ["trunkDark", WorldMapBlock.Trunk],
  ["leaves", WorldMapBlock.Leaves],
  ["leavesDark", WorldMapBlock.Leaves],
  ["leavesLight", WorldMapBlock.Leaves],
  ["leavesTeal", WorldMapBlock.Leaves],
  ["leavesWarm", WorldMapBlock.Leaves],
  ["pineTrunk", WorldMapBlock.PineTrunk],
  ["pineLeaves", WorldMapBlock.PineLeaves],
  ["deadWood", WorldMapBlock.DeadWood],
  ["giantRoot", WorldMapBlock.GiantRoot],
  ["grassPlant", WorldMapBlock.GrassPlant],
  ["dryGrass", WorldMapBlock.DryGrass],
  ["bush", WorldMapBlock.Bush],
  ["deadBush", WorldMapBlock.DeadBush],
  ["cactus", WorldMapBlock.Cactus],
  ["reed", WorldMapBlock.Reed],
  ["swampGrass", WorldMapBlock.SwampGrass],
  ["snowBush", WorldMapBlock.SnowBush],
  ["thorn", WorldMapBlock.Thorn],
  ["moss", WorldMapBlock.Moss],
  ["lichen", WorldMapBlock.Lichen],
  ["vine", WorldMapBlock.Vine],
  ["glowMycelium", WorldMapBlock.GlowMycelium],
  ["mushroom", WorldMapBlock.Mushroom],
  ["seaweed", WorldMapBlock.Seaweed],
  ["aquaticPlant", WorldMapBlock.AquaticPlant],
  ["coral", WorldMapBlock.Coral],
  ["deadCoral", WorldMapBlock.DeadCoral],
  ["shellBed", WorldMapBlock.ShellBed],
]);
const renderTypeByBlockId = new Map(
  Array.from(blockIdByRenderType.entries()).map(([renderType, blockId]) => [blockId, renderType]),
);

let connection = null;
let connectionRpcUrl = "";
let globalConfigPda = null;

export function getNicechunkConnection() {
  const rpcUrl = getNicechunkRpcUrl();
  if (!connection || connectionRpcUrl !== rpcUrl) {
    connection = new Connection(rpcUrl, {
      commitment: "confirmed",
      fetch: createNicechunkRpcFetch("nicechunk-chain"),
    });
    connectionRpcUrl = rpcUrl;
  }
  return connection;
}

if (typeof window !== "undefined") {
  window.addEventListener(rpcConfigChangedEventName, () => {
    connection = null;
    connectionRpcUrl = "";
  });
}

export function deriveGlobalConfigPda() {
  if (!globalConfigPda) {
    [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from(globalConfigSeed)], coreProgramId);
  }
  return globalConfigPda;
}

export async function loadGlobalConfig({ useCache = true } = {}) {
  const globalConfig = deriveGlobalConfigPda();
  try {
    const account = await getNicechunkConnection().getAccountInfo(globalConfig, "confirmed");
    if (!account?.data?.length) throw new Error("GlobalConfig account was not found.");
    const decoded = decodeGlobalConfig(account.data);
    const config = {
      ...decoded,
      programId: coreProgramId.toBase58(),
      globalConfig: globalConfig.toBase58(),
      loadedAt: Date.now(),
    };
    if (hasLocalStorage()) {
      localStorage.setItem(worldConfigStorageKey, JSON.stringify(serializeGlobalConfigForStorage(config)));
    }
    return config;
  } catch (error) {
    reportRpcError(error, "global-config");
    if (!useCache) throw error;
    const cached = loadCachedGlobalConfig();
    if (cached) return { ...cached, fromCache: true, loadError: error };
    throw error;
  }
}

export function loadCachedGlobalConfig() {
  try {
    if (!hasLocalStorage()) return null;
    const raw = localStorage.getItem(worldConfigStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.magic !== globalConfigMagic || !parsed.worldSeedHex) return null;
    return {
      ...parsed,
      worldSeed: Buffer.from(parsed.worldSeedHex, "hex"),
      fromCache: true,
    };
  } catch {
    return null;
  }
}

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

export function derivePlayerProfilePda(owner) {
  return PublicKey.findProgramAddressSync([Buffer.from(playerSeed), owner.toBuffer()], playerProgramId);
}

export function derivePlayerSessionPda(owner, sessionAuthority) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(playerSessionSeed), owner.toBuffer(), sessionAuthority.toBuffer()],
    playerProgramId,
  );
}

export function deriveChunkPda(chunkX, chunkZ) {
  const chunkXBytes = Buffer.alloc(4);
  const chunkZBytes = Buffer.alloc(4);
  chunkXBytes.writeInt32LE(chunkX, 0);
  chunkZBytes.writeInt32LE(chunkZ, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(chunkSeed), deriveGlobalConfigPda().toBuffer(), chunkXBytes, chunkZBytes],
    chunkProgramId,
  );
}

export function deriveChunkBrokenPda(chunkX, chunkZ) {
  const chunkXBytes = Buffer.alloc(4);
  const chunkZBytes = Buffer.alloc(4);
  chunkXBytes.writeInt32LE(chunkX, 0);
  chunkZBytes.writeInt32LE(chunkZ, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(chunkBrokenSeed), deriveGlobalConfigPda().toBuffer(), chunkXBytes, chunkZBytes],
    chunkProgramId,
  );
}

export function deriveBackpackPda(owner, backpackId) {
  const backpackIdBytes = Buffer.alloc(8);
  backpackIdBytes.writeBigUInt64LE(BigInt(backpackId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(backpackSeed), owner.toBuffer(), backpackIdBytes],
    backpackProgramId,
  );
}

export function deriveMarketListingPda(seller, listingId) {
  const listingIdBytes = Buffer.alloc(8);
  listingIdBytes.writeBigUInt64LE(BigInt(listingId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(marketListingSeed), seller.toBuffer(), listingIdBytes],
    marketProgramId,
  );
}

export function deriveMarketAssetPda(owner, assetId) {
  const assetIdBytes = Buffer.alloc(8);
  assetIdBytes.writeBigUInt64LE(BigInt(assetId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("asset"), owner.toBuffer(), assetIdBytes],
    marketProgramId,
  );
}

export function deriveMarketAuthorityPda() {
  return PublicKey.findProgramAddressSync([Buffer.from(marketAuthoritySeed)], marketProgramId);
}

export async function createMarketListingOnChain({
  item,
  category,
  currency,
  price,
  quantity = 1,
  backpackAddress = null,
}) {
  const provider = await connectedWalletProvider({ prompt: true });
  if (!provider) return { submitted: false, reason: "wallet-unavailable" };

  const listingId = createMarketListingId();
  const [listing] = deriveMarketListingPda(provider.publicKey, listingId);
  const normalizedCurrency = String(currency || "NCK").toUpperCase();
  const priceBaseUnits = parseMarketPriceBaseUnits(price, normalizedCurrency);
  const sourceKind = item?.source === "backpack" ? "backpack" : "asset";
  const assetDetails = sourceKind === "asset" ? createMarketAssetDetails(item, quantity) : null;
  const itemHash = await createMarketItemHash({ item, category, currency: normalizedCurrency, quantity, assetDetails });
  const assetId = sourceKind === "asset" ? createMarketAssetId() : null;
  const [asset] = sourceKind === "asset" ? deriveMarketAssetPda(provider.publicKey, assetId) : [null];
  const sourceInventory = sourceKind === "backpack"
    ? backpackAddress || item?.backpack
    : asset.toBase58();
  const sourceRecord = item?.source === "backpack" ? item?.slot?.record : null;
  if (item?.source === "backpack" && (!sourceInventory || !sourceRecord)) {
    return { submitted: false, reason: "listing-unavailable" };
  }
  const tx = new Transaction();
  if (sourceKind === "asset") {
    tx.add(createInitializeMarketAssetInstruction({
      owner: provider.publicKey,
      asset,
      assetId,
      category,
      quantity,
      itemHash,
      assetDetails,
    }));
  }
  tx.add(createMarketListingInstruction({
    seller: provider.publicKey,
    listing,
    listingId,
    category,
    currency: normalizedCurrency,
    sourceKind,
    sourceIndex: Number.isInteger(item?.slotIndex) ? item.slotIndex : 0,
    quantity,
    priceBaseUnits,
    itemHash,
    sourceInventory,
    sourceRecord,
  }));

  const conn = getNicechunkConnection();
  const signature = await signAndSendWalletTransaction(provider, tx, conn);
  return {
    submitted: true,
    signature,
    listing: listing.toBase58(),
    listingId: listingId.toString(),
    seller: provider.publicKey.toBase58(),
    priceBaseUnits: priceBaseUnits.toString(),
    sourceInventory,
    sourceKind,
    asset: asset?.toBase58() ?? null,
    assetId: assetId?.toString() ?? null,
    programId: marketProgramId.toBase58(),
  };
}

export async function cancelMarketListingOnChain({
  listing,
  listingId,
  source = null,
  sourceInventory = null,
}) {
  const provider = await connectedWalletProvider({ prompt: true });
  if (!provider) return { submitted: false, reason: "wallet-unavailable" };
  const listingPublicKey = listing
    ? new PublicKey(listing)
    : deriveMarketListingPda(provider.publicKey, BigInt(listingId))[0];
  const tx = new Transaction().add(createCancelMarketListingInstruction({
    seller: provider.publicKey,
    listing: listingPublicKey,
    source,
    sourceInventory,
  }));
  const signature = await signAndSendWalletTransaction(provider, tx, getNicechunkConnection());
  return {
    submitted: true,
    signature,
    listing: listingPublicKey.toBase58(),
  };
}

export async function buyMarketListingOnChain({ listing, buyerBackpackAddress = null }) {
  const provider = await connectedWalletProvider({ prompt: true });
  if (!provider) return { submitted: false, reason: "wallet-unavailable" };
  if (!listing?.listing || !listing?.seller) return { submitted: false, reason: "listing-unavailable" };

  const listingPublicKey = new PublicKey(listing.listing);
  const seller = new PublicKey(listing.seller);
  if (seller.equals(provider.publicKey)) return { submitted: false, reason: "self-purchase" };

  const currency = String(listing.currency || "NCK").toUpperCase();
  if (listing.source === "backpack" && !buyerBackpackAddress) {
    return { submitted: false, reason: "no-backpack" };
  }
  const conn = getNicechunkConnection();
  if (listing.source === "backpack") {
    const buyerBackpack = await fetchBackpack(buyerBackpackAddress);
    if (!buyerBackpack?.publicKey) return { submitted: false, reason: "no-backpack" };
    if (buyerBackpack.itemCount >= buyerBackpack.capacity) return { submitted: false, reason: "backpack-full" };
  }
  const tx = new Transaction();
  if (currency === "NCK") {
    const buyerNckToken = getAssociatedTokenAddressSync(nckMint, provider.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const sellerNckToken = getAssociatedTokenAddressSync(nckMint, seller, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const treasuryNckToken = getAssociatedTokenAddressSync(nckMint, marketTreasury, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const [buyerNckAccount, sellerNckAccount, treasuryNckAccount] = await Promise.all([
      conn.getAccountInfo(buyerNckToken, "confirmed"),
      conn.getAccountInfo(sellerNckToken, "confirmed"),
      conn.getAccountInfo(treasuryNckToken, "confirmed"),
    ]);
    if (!buyerNckAccount?.data?.length) return { submitted: false, reason: "nck-token-missing" };
    if (!sellerNckAccount?.data?.length) {
      tx.add(createAssociatedTokenAccountInstruction(
        provider.publicKey,
        sellerNckToken,
        seller,
        nckMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }
    if (!treasuryNckAccount?.data?.length) {
      tx.add(createAssociatedTokenAccountInstruction(
        provider.publicKey,
        treasuryNckToken,
        marketTreasury,
        nckMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }
    tx.add(createBuyMarketListingInstruction({
      buyer: provider.publicKey,
      seller,
      listing: listingPublicKey,
      currency,
      buyerNckToken,
      sellerNckToken,
      treasuryNckToken,
      source: listing.source,
      sourceInventory: listing.sourceInventory,
      buyerBackpackAddress,
    }));
  } else if (currency === "SOL") {
    tx.add(createBuyMarketListingInstruction({
      buyer: provider.publicKey,
      seller,
      listing: listingPublicKey,
      currency,
      source: listing.source,
      sourceInventory: listing.sourceInventory,
      buyerBackpackAddress,
    }));
  } else {
    throw new Error(`Unsupported market currency: ${currency}`);
  }

  const signature = await signAndSendWalletTransaction(provider, tx, conn);
  return {
    submitted: true,
    signature,
    listing: listingPublicKey.toBase58(),
    buyer: provider.publicKey.toBase58(),
    seller: seller.toBase58(),
    currency,
    programId: marketProgramId.toBase58(),
  };
}

export async function fetchMarketListingsOnChain({
  seller = null,
  state = null,
  category = "all",
  currency = "all",
  source = null,
  query = "",
  sort = "newest",
} = {}) {
  const filters = [{ dataSize: marketListingLength }];
  if (seller) {
    const sellerKey = typeof seller === "string" ? new PublicKey(seller) : seller;
    filters.push({ memcmp: { offset: marketListingSellerOffset, bytes: sellerKey.toBase58() } });
  }
  const stateCode = state ? marketStateCodes.get(String(state).toLowerCase()) : null;
  if (stateCode) {
    filters.push(createSingleByteMemcmpFilter(marketListingStateOffset, stateCode));
  }
  const categoryCode = category && category !== "all" ? marketCategoryCodes.get(String(category).toLowerCase()) : null;
  if (categoryCode) {
    filters.push(createSingleByteMemcmpFilter(marketListingCategoryOffset, categoryCode));
  }
  const currencyCode = currency && currency !== "all" ? marketCurrencyCodes.get(String(currency).toUpperCase()) : null;
  if (currencyCode) {
    filters.push(createSingleByteMemcmpFilter(marketListingCurrencyOffset, currencyCode));
  }
  const sourceCode = source ? marketSourceKindCodes.get(String(source).toLowerCase()) : null;
  if (sourceCode) {
    filters.push(createSingleByteMemcmpFilter(marketListingSourceKindOffset, sourceCode));
  }
  const conn = getNicechunkConnection();
  const accounts = await conn.getProgramAccounts(marketProgramId, {
    commitment: "confirmed",
    filters,
  });
  const listings = accounts
    .map(({ pubkey, account }) => {
      try {
        return { ...decodeMarketListing(account.data), listing: pubkey.toBase58() };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const assetLookups = listings
    .map((listing, index) => listing.source === "asset" && listing.sourceInventory
      ? { index, publicKey: new PublicKey(listing.sourceInventory) }
      : null)
    .filter(Boolean);
  if (assetLookups.length) {
    const assetAccounts = await conn.getMultipleAccountsInfo(
      assetLookups.map((lookup) => lookup.publicKey),
      "confirmed",
    );
    assetAccounts.forEach((account, lookupIndex) => {
      if (!account?.data?.length) return;
      try {
        listings[assetLookups[lookupIndex].index].asset = decodeMarketAsset(account.data);
      } catch {
        // Listing data is still usable without client-side asset metadata.
      }
    });
  }
  return filterAndSortMarketListings(listings, { state, category, currency, source, query, sort });
}

export async function fetchMarketListingsPageOnChain({
  page = 1,
  pageSize = 20,
  ...filters
} = {}) {
  const listings = await fetchMarketListingsOnChain(filters);
  const normalizedPageSize = Math.max(1, Math.min(500, Math.floor(Number(pageSize) || 20)));
  const total = listings.length;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
  const startIndex = total ? (currentPage - 1) * normalizedPageSize : 0;
  const endIndex = total ? Math.min(total, startIndex + normalizedPageSize) : 0;
  return {
    items: listings.slice(startIndex, endIndex),
    pageInfo: {
      page: currentPage,
      pageSize: normalizedPageSize,
      total,
      totalPages,
      start: total ? startIndex + 1 : 0,
      end: endIndex,
    },
  };
}

function createSingleByteMemcmpFilter(offset, value) {
  const byte = Number(value);
  if (!Number.isInteger(byte) || byte < 0 || byte >= base58Alphabet.length) {
    throw new Error(`Invalid single-byte memcmp value: ${value}`);
  }
  return { memcmp: { offset, bytes: base58Alphabet[byte] } };
}

function filterAndSortMarketListings(listings, {
  state = null,
  category = "all",
  currency = "all",
  source = null,
  query = "",
  sort = "newest",
} = {}) {
  const normalizedState = state ? String(state).toLowerCase() : null;
  const normalizedCategory = String(category || "all").toLowerCase();
  const normalizedCurrency = String(currency || "all").toUpperCase();
  const normalizedSource = source ? String(source).toLowerCase() : null;
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filtered = listings.filter((listing) => {
    if (normalizedState && listing.stateLabel !== normalizedState) return false;
    if (normalizedCategory !== "all" && listing.category !== normalizedCategory) return false;
    if (normalizedCurrency !== "ALL" && listing.currency !== normalizedCurrency) return false;
    if (normalizedSource && listing.source !== normalizedSource) return false;
    if (!normalizedQuery) return true;
    return marketListingSearchText(listing).includes(normalizedQuery);
  });
  return filtered.sort((a, b) => {
    if (sort === "oldest") return marketListingCreatedAt(a) - marketListingCreatedAt(b);
    if (sort === "price-asc") return marketListingPriceValue(a) - marketListingPriceValue(b);
    if (sort === "price-desc") return marketListingPriceValue(b) - marketListingPriceValue(a);
    return marketListingCreatedAt(b) - marketListingCreatedAt(a);
  });
}

function marketListingCreatedAt(listing) {
  const value = Number(listing?.createdAt || 0);
  return Number.isFinite(value) ? value : 0;
}

function marketListingPriceValue(listing) {
  const value = Number(listing?.price || 0);
  return Number.isFinite(value) ? value : 0;
}

function marketListingSearchText(listing) {
  const record = listing?.sourceRecord;
  const asset = listing?.asset;
  return [
    listing?.listing,
    listing?.listingId,
    listing?.seller,
    listing?.category,
    listing?.currency,
    listing?.source,
    listing?.sourceInventory,
    listing?.price,
    record ? `${record.worldX},${record.worldY},${record.worldZ}` : "",
    asset?.itemId,
    asset?.itemCode,
  ].join(" ").toLowerCase();
}

export async function loadChunkBlockDeltas(chunkX, chunkZ) {
  if (!isNicechunkChainSyncEnabled()) return [];
  const [chunkBrokenPda] = deriveChunkBrokenPda(chunkX, chunkZ);
  const [chunkPda] = deriveChunkPda(chunkX, chunkZ);
  const [chunkBrokenAccount, chunkAccount] = await getNicechunkConnection().getMultipleAccountsInfo(
    [chunkBrokenPda, chunkPda],
    "confirmed",
  );
  if (chunkBrokenAccount?.data?.length) {
    const brokenDeltas = decodeChunkBrokenDeltas(chunkBrokenAccount.data, chunkX, chunkZ);
    if (brokenDeltas.length) return brokenDeltas;
  }
  if (!chunkAccount?.data?.length) return [];
  return decodeChunkDeltas(chunkAccount.data, chunkX, chunkZ);
}

export async function loadChunkBlockDeltasBatch(chunks, { batchSize = 50 } = {}) {
  if (!isNicechunkChainSyncEnabled() || !Array.isArray(chunks) || !chunks.length) return new Map();
  const results = new Map();
  const uniqueChunks = dedupeChunks(chunks);
  const conn = getNicechunkConnection();

  for (let start = 0; start < uniqueChunks.length; start += batchSize) {
    const batch = uniqueChunks.slice(start, start + batchSize);
    const accounts = [];
    for (const chunk of batch) {
      const [chunkBrokenPda] = deriveChunkBrokenPda(chunk.chunkX, chunk.chunkZ);
      const [chunkPda] = deriveChunkPda(chunk.chunkX, chunk.chunkZ);
      accounts.push(chunkBrokenPda, chunkPda);
    }
    let infos;
    try {
      infos = await conn.getMultipleAccountsInfo(accounts, "confirmed");
    } catch (error) {
      reportRpcError(error, "chunk-delta-batch");
      throw error;
    }
    for (let index = 0; index < batch.length; index += 1) {
      const chunk = batch[index];
      const chunkKey = `${chunk.chunkX},${chunk.chunkZ}`;
      const brokenAccount = infos[index * 2];
      const legacyAccount = infos[index * 2 + 1];
      let deltas = [];
      if (brokenAccount?.data?.length) {
        deltas = decodeChunkBrokenDeltas(brokenAccount.data, chunk.chunkX, chunk.chunkZ);
      }
      if (!deltas.length && legacyAccount?.data?.length) {
        deltas = decodeChunkDeltas(legacyAccount.data, chunk.chunkX, chunk.chunkZ);
      }
      results.set(chunkKey, deltas);
    }
  }
  return results;
}

export async function recordBlockBreakOnChain(block, toolSlot = 0) {
  if (!isNicechunkChainSyncEnabled()) {
    return { submitted: false, reason: "chain-sync-disabled" };
  }
  try {
    const provider = await connectedWalletProvider();
    if (!provider) return { submitted: false, reason: "wallet-unavailable" };

    if (await isBlockAlreadyBrokenOnChain(block)) {
      return { submitted: false, reason: "already-mined" };
    }

    const session = await getOrCreateGameplaySession(provider);
    const tx = new Transaction();
    const conn = getNicechunkConnection();
    const equippedBackpack = await loadEquippedBackpackForOwner(provider.publicKey, conn);
    if (!equippedBackpack?.publicKey) {
      return { submitted: false, reason: "no-backpack" };
    }
    if (equippedBackpack.itemCount >= equippedBackpack.capacity) {
      return { submitted: false, reason: "backpack-full" };
    }
    tx.add(createMineBlockInstruction({ authority: session.keypair.publicKey, block, owner: provider.publicKey }));
    tx.add(createAppendMinedResourceInstruction({
      owner: provider.publicKey,
      sessionAuthority: session.keypair.publicKey,
      backpack: equippedBackpack.publicKey,
      block,
    }));

    const signature = await signAndSendKeypairTransaction(session.keypair, tx, conn);
    return { submitted: true, signature, backpack: equippedBackpack?.publicKey?.toBase58?.() ?? null };
  } catch (error) {
    reportRpcError(error, "mine-block");
    throw error;
  }
}

export async function purchaseDefaultBackpack() {
  const provider = await connectedWalletProvider({ prompt: true });
  if (!provider) return { purchased: false, reason: "wallet-unavailable" };
  const [playerProfile] = derivePlayerProfilePda(provider.publicKey);
  const conn = getNicechunkConnection();
  const playerAccount = await conn.getAccountInfo(playerProfile, "confirmed");
  if (playerAccount?.data?.length) {
    const profile = decodePlayerProfile(playerAccount.data);
    if (profile.equippedBackpack && profile.equippedBackpack !== PublicKey.default.toBase58()) {
      return {
        purchased: false,
        reason: "backpack-already-bound",
        backpack: profile.equippedBackpack,
      };
    }
  }
  const backpackId = createBackpackId();
  const [backpack] = deriveBackpackPda(provider.publicKey, backpackId);
  const tx = new Transaction();
  if (!playerAccount?.data?.length) {
    tx.add(createInitializePlayerInstruction(provider.publicKey, playerProfile));
  }
  tx.add(createInitializeBackpackInstruction({
    owner: provider.publicKey,
    playerProfile,
    backpack,
    backpackId,
    capacity: backpackDefaultCapacity,
  }));
  tx.add(createSetEquippedBackpackInstruction({
    authority: provider.publicKey,
    playerProfile,
    backpack,
  }));
  const signature = await signAndSendWalletTransaction(provider, tx, conn);
  const record = {
    backpack: backpack.toBase58(),
    backpackId: backpackId.toString(),
    owner: provider.publicKey.toBase58(),
    equippedAt: Date.now(),
  };
  storeEquippedBackpackRecord(provider.publicKey, record);
  return { purchased: true, signature, ...record };
}

export async function getEquippedBackpackStatus({ prompt = false } = {}) {
  const provider = await connectedWalletProvider({ prompt });
  const owner = provider?.publicKey ?? storedWalletPublicKey();
  if (!owner) return { walletAvailable: false, equipped: false, backpack: null };
  const equippedBackpack = await loadEquippedBackpackForOwner(owner);
  if (!equippedBackpack?.publicKey) {
    return { walletAvailable: Boolean(provider), owner: owner.toBase58(), equipped: false, backpack: null };
  }
  return { walletAvailable: Boolean(provider), owner: owner.toBase58(), equipped: true, backpack: equippedBackpack };
}

export async function fetchBackpack(backpackAddress) {
  if (!backpackAddress) return null;
  const publicKey = typeof backpackAddress === "string" ? new PublicKey(backpackAddress) : backpackAddress;
  const account = await getNicechunkConnection().getAccountInfo(publicKey, "confirmed");
  if (!account?.data?.length) return null;
  const decoded = decodeBackpack(account.data);
  return {
    ...decoded,
    publicKey: publicKey.toBase58(),
    programId: backpackProgramId.toBase58(),
  };
}

export function getMinimumGameplaySessionFundingSol() {
  return minimumSessionFundingLamports / lamportsPerSol;
}

export function getConfiguredGameplaySessionFundingSol(owner = null) {
  return getConfiguredGameplaySessionFundingLamports(owner) / lamportsPerSol;
}

export function setConfiguredGameplaySessionFundingSol(value, owner = null) {
  const parsed = Number(value);
  const lamports = Number.isFinite(parsed)
    ? Math.max(minimumSessionFundingLamports, Math.ceil(parsed * lamportsPerSol))
    : minimumSessionFundingLamports;
  if (hasLocalStorage()) localStorage.setItem(sessionFundingStorageKey(owner), String(lamports));
  return lamports / lamportsPerSol;
}

export function hasAcknowledgedGameplaySessionFunding(owner = null) {
  return hasLocalStorage() && localStorage.getItem(sessionFundingAcknowledgedKey(owner)) === "1";
}

export function acknowledgeGameplaySessionFunding(owner = null) {
  if (hasLocalStorage()) localStorage.setItem(sessionFundingAcknowledgedKey(owner), "1");
}

export async function getGameplaySessionStatus() {
  const provider = await connectedWalletProvider();
  if (!provider) {
    return {
      walletAvailable: false,
      acknowledged: false,
      configuredFundingLamports: getConfiguredGameplaySessionFundingLamports(null),
      minimumFundingLamports: minimumSessionFundingLamports,
      balanceLamports: null,
      publicKey: null,
      expiresAt: null,
    };
  }

  const owner = provider.publicKey;
  const stored = loadStoredGameplaySession(owner);
  const configuredFundingLamports = getConfiguredGameplaySessionFundingLamports(owner);
  if (!stored) {
    return {
      walletAvailable: true,
      owner: owner.toBase58(),
      acknowledged: hasAcknowledgedGameplaySessionFunding(owner),
      configuredFundingLamports,
      minimumFundingLamports: minimumSessionFundingLamports,
      balanceLamports: null,
      publicKey: null,
      expiresAt: null,
    };
  }

  let balanceLamports = null;
  try {
    balanceLamports = await getNicechunkConnection().getBalance(stored.keypair.publicKey, "confirmed");
  } catch (error) {
    reportRpcError(error, "session-balance");
    throw error;
  }

  return {
    walletAvailable: true,
    owner: owner.toBase58(),
    acknowledged: hasAcknowledgedGameplaySessionFunding(owner),
    configuredFundingLamports,
    minimumFundingLamports: minimumSessionFundingLamports,
    balanceLamports,
    balanceSol: balanceLamports / lamportsPerSol,
    publicKey: stored.keypair.publicKey.toBase58(),
    expiresAt: stored.expiresAt,
  };
}

export async function ensureGameplaySessionFunded() {
  const provider = await connectedWalletProvider({ prompt: true });
  if (!provider) return { funded: false, reason: "wallet-unavailable" };
  const session = await getOrCreateGameplaySession(provider);
  const balanceLamports = await getNicechunkConnection().getBalance(session.keypair.publicKey, "confirmed");
  return {
    funded: true,
    balanceLamports,
    balanceSol: balanceLamports / lamportsPerSol,
    publicKey: session.keypair.publicKey.toBase58(),
    expiresAt: session.expiresAt,
  };
}

function dedupeChunks(chunks) {
  const seen = new Set();
  const unique = [];
  for (const chunk of chunks) {
    const chunkX = Number(chunk?.chunkX);
    const chunkZ = Number(chunk?.chunkZ);
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) continue;
    const key = `${chunkX},${chunkZ}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ chunkX, chunkZ });
  }
  return unique;
}

export async function recordBlockPlacementOnChain(target, renderType, toolSlot = 0) {
  if (!isNicechunkChainSyncEnabled()) {
    return { submitted: false, reason: "chain-sync-disabled" };
  }
  try {
    const provider = await connectedWalletProvider();
    if (!provider) return { submitted: false, reason: "wallet-unavailable" };

    const authority = provider.publicKey;
    const [playerProfile] = derivePlayerProfilePda(authority);
    const [chunkPda] = deriveChunkPda(blockChunkX(target.x), blockChunkZ(target.z));
    const conn = getNicechunkConnection();
    const tx = new Transaction();
    const playerAccount = await getNicechunkConnection().getAccountInfo(playerProfile, "confirmed");

    if (!playerAccount) {
      tx.add(createInitializePlayerInstruction(authority, playerProfile));
    }
    tx.add(createRecordBlockChangeInstruction({
      authority,
      playerProfile,
      chunkPda,
      block: { ...target, type: renderType },
      previousBlockId: EMPTY_BLOCK,
      newBlockId: blockRenderTypeId(renderType),
      action: 2,
      toolSlot,
    }));

    const signature = await signAndSendWalletTransaction(provider, tx, conn);
    return { submitted: true, signature };
  } catch (error) {
    reportRpcError(error, "place-block");
    throw error;
  }
}

export function blockChunkX(x) {
  return Math.floor(x / chunkSize);
}

export function blockChunkZ(z) {
  return Math.floor(z / chunkSize);
}

export function blockLocalX(x) {
  return positiveModulo(x, chunkSize);
}

export function blockLocalZ(z) {
  return positiveModulo(z, chunkSize);
}

export function blockRenderTypeId(type) {
  return blockIdByRenderType.get(type) ?? EMPTY_BLOCK;
}

export function renderTypeForBlockId(blockId) {
  return renderTypeByBlockId.get(blockId) ?? null;
}

export function isNicechunkChainSyncEnabled() {
  return localStorage.getItem(chainSyncStorageKey) !== "0";
}

function decodeChunkDeltas(data, chunkX, chunkZ) {
  if (data.length !== chunkStateLength) return [];
  if (data.subarray(0, 8).toString("utf8") !== chunkMagic) return [];

  const storedDeltaCount = data.readUInt16LE(58);
  const deltas = [];
  for (let index = 0; index < storedDeltaCount; index += 1) {
    const offset = chunkHeaderLength + index * blockDeltaLength;
    const sequence = data.readUInt32LE(offset);
    if (sequence === 0) continue;
    const localX = data.readUInt8(offset + 36);
    const y = data.readInt16LE(offset + 37);
    const localZ = data.readUInt8(offset + 39);
    const previousBlockId = data.readUInt16LE(offset + 40);
    const newBlockId = data.readUInt16LE(offset + 42);
    deltas.push({
      sequence,
      actor: new PublicKey(data.subarray(offset + 4, offset + 36)),
      x: chunkX * chunkSize + localX,
      y,
      z: chunkZ * chunkSize + localZ,
      localX,
      localZ,
      previousBlockId,
      newBlockId,
      action: data.readUInt8(offset + 44),
      toolSlot: data.readUInt8(offset + 45),
      slot: data.readBigUInt64LE(offset + 46),
      timestamp: data.readBigInt64LE(offset + 54),
    });
  }
  deltas.sort((a, b) => a.sequence - b.sequence);
  return deltas;
}

function decodeChunkBrokenDeltas(data, chunkX, chunkZ) {
  if (data.length < chunkBrokenHeaderLength) return [];
  if (data.subarray(0, 4).toString("utf8") !== chunkBrokenMagic) return [];
  const count = data.readUInt16LE(6);
  const capacity = data.readUInt16LE(8);
  const minY = data.readInt16LE(10);
  if (count > capacity || data.length !== chunkBrokenHeaderLength + capacity * chunkBrokenRecordLength) return [];

  const deltas = [];
  for (let index = 0; index < count; index += 1) {
    const offset = chunkBrokenHeaderLength + index * chunkBrokenRecordLength;
    const packed = data.readUIntLE(offset, chunkBrokenRecordLength);
    const localX = packed & 0x0f;
    const localZ = (packed >> 4) & 0x0f;
    const yOffset = (packed >> 8) & 0x01ff;
    deltas.push({
      sequence: index + 1,
      x: chunkX * chunkSize + localX,
      y: minY + yOffset,
      z: chunkZ * chunkSize + localZ,
      localX,
      localZ,
      previousBlockId: null,
      newBlockId: EMPTY_BLOCK,
      action: 1,
      toolSlot: 0,
      packed: data.subarray(offset, offset + chunkBrokenRecordLength).toString("hex"),
    });
  }
  return deltas;
}

function decodeBackpack(data) {
  if (data.length !== backpackAccountLength) {
    throw new Error(`Invalid Backpack length: expected ${backpackAccountLength}, got ${data.length}.`);
  }
  if (data.subarray(0, 8).toString("utf8") !== backpackMagic) {
    throw new Error("Invalid Backpack magic.");
  }
  const capacity = data.readUInt8(52);
  const itemCount = data.readUInt8(53);
  const readableCount = Math.min(itemCount, capacity, backpackMaxCapacity);
  const records = [];
  for (let index = 0; index < readableCount; index += 1) {
    const offset = backpackHeaderLength + index * backpackRecordLength;
    records.push({
      index,
      worldX: data.readInt32LE(offset),
      worldY: data.readInt16LE(offset + 4),
      worldZ: data.readInt32LE(offset + 6),
    });
  }
  return {
    magic: backpackMagic,
    version: data.readUInt16LE(8),
    bump: data.readUInt8(10),
    initialized: data.readUInt8(11) === 1,
    backpackId: data.readBigUInt64LE(12).toString(),
    owner: new PublicKey(data.subarray(20, 52)).toBase58(),
    capacity,
    itemCount,
    state: data.readUInt8(54),
    flags: data.readUInt8(55),
    placed: {
      x: data.readInt32LE(56),
      y: data.readInt16LE(60),
      z: data.readInt32LE(62),
    },
    createdSlot: data.readBigUInt64LE(66).toString(),
    updatedSlot: data.readBigUInt64LE(74).toString(),
    createdAt: data.readBigInt64LE(82).toString(),
    records,
  };
}

function decodeMarketListing(data) {
  if (data.length !== marketListingLength) {
    throw new Error(`Invalid MarketListing length: expected ${marketListingLength}, got ${data.length}.`);
  }
  if (data.subarray(0, 8).toString("utf8") !== marketListingMagic) {
    throw new Error("Invalid MarketListing magic.");
  }
  const currency = marketCurrencyNames.get(data.readUInt8(53)) ?? "NCK";
  const priceBaseUnits = data.readBigUInt64LE(61);
  const soldSlot = data.readBigUInt64LE(199);
  const soldAt = data.readBigInt64LE(207);
  const buyerBytes = data.subarray(167, 199);
  const hasBuyer = buyerBytes.some((byte) => byte !== 0);
  return {
    magic: marketListingMagic,
    version: data.readUInt16LE(8),
    bump: data.readUInt8(10),
    state: data.readUInt8(11),
    stateLabel: marketStateNames.get(data.readUInt8(11)) ?? "unknown",
    seller: new PublicKey(data.subarray(12, 44)).toBase58(),
    listingId: data.readBigUInt64LE(44).toString(),
    category: marketCategoryNames.get(data.readUInt8(52)) ?? "raw",
    currency,
    source: marketSourceKindNames.get(data.readUInt8(54)) ?? "backpack",
    sourceIndex: data.readUInt16LE(55),
    quantity: data.readUInt32LE(57),
    priceBaseUnits: priceBaseUnits.toString(),
    price: formatMarketBaseUnits(priceBaseUnits, currency),
    itemHash: Buffer.from(data.subarray(69, 101)).toString("hex"),
    sourceInventory: new PublicKey(data.subarray(101, 133)).toBase58(),
    sourceRecord: {
      worldX: data.readInt32LE(133),
      worldY: data.readInt16LE(137),
      worldZ: data.readInt32LE(139),
    },
    createdSlot: data.readBigUInt64LE(143).toString(),
    updatedSlot: data.readBigUInt64LE(151).toString(),
    createdAt: data.readBigInt64LE(159).toString(),
    buyer: hasBuyer ? new PublicKey(buyerBytes).toBase58() : null,
    soldSlot: soldSlot ? soldSlot.toString() : null,
    soldAt: soldAt ? soldAt.toString() : null,
  };
}

function decodeMarketAsset(data) {
  if (data.length !== marketAssetLength) {
    throw new Error(`Invalid MarketAsset length: expected ${marketAssetLength}, got ${data.length}.`);
  }
  if (data.subarray(0, 8).toString("utf8") !== marketAssetMagic) {
    throw new Error("Invalid MarketAsset magic.");
  }
  const itemCode = data.readUInt16LE(145);
  const payloadLength = Math.min(data.readUInt16LE(155), marketAssetPayloadLength);
  const payload = Array.from(data.subarray(157, 157 + payloadLength));
  const dynamicItemId = itemCode === marketDynamicAssetItemCode
    ? new TextDecoder().decode(Uint8Array.from(payload)).replace(/\0+$/, "") || null
    : null;
  return {
    magic: marketAssetMagic,
    version: data.readUInt16LE(8),
    bump: data.readUInt8(10),
    state: data.readUInt8(11),
    stateLabel: data.readUInt8(11) === 1 ? "active" : data.readUInt8(11) === 2 ? "listed" : "unknown",
    owner: new PublicKey(data.subarray(12, 44)).toBase58(),
    assetId: data.readBigUInt64LE(44).toString(),
    category: marketCategoryNames.get(data.readUInt8(52)) ?? "raw",
    quantity: data.readUInt32LE(53),
    itemHash: Buffer.from(data.subarray(57, 89)).toString("hex"),
    listing: data.subarray(89, 121).some((byte) => byte !== 0)
      ? new PublicKey(data.subarray(89, 121)).toBase58()
      : null,
    createdSlot: data.readBigUInt64LE(121).toString(),
    updatedSlot: data.readBigUInt64LE(129).toString(),
    createdAt: data.readBigInt64LE(137).toString(),
    itemCode,
    itemId: marketAssetItemIds.get(itemCode) ?? dynamicItemId,
    stackCount: data.readUInt32LE(147),
    durability: data.readUInt32LE(151),
    payloadLength,
    payload,
  };
}

async function isBlockAlreadyBrokenOnChain(block) {
  const chunkX = blockChunkX(block.x);
  const chunkZ = blockChunkZ(block.z);
  const [chunkBrokenPda] = deriveChunkBrokenPda(chunkX, chunkZ);
  let account;
  try {
    account = await getNicechunkConnection().getAccountInfo(chunkBrokenPda, "confirmed");
  } catch (error) {
    reportRpcError(error, "already-broken-check");
    throw error;
  }
  if (!account?.data?.length) return false;
  return decodeChunkBrokenDeltas(account.data, chunkX, chunkZ).some((delta) =>
    delta.x === block.x && delta.y === block.y && delta.z === block.z
  );
}

function decodeGlobalConfig(data) {
  if (data.length !== globalConfigLength) {
    throw new Error(`Invalid GlobalConfig length: expected ${globalConfigLength}, got ${data.length}.`);
  }
  if (data.subarray(0, 8).toString("utf8") !== globalConfigMagic) {
    throw new Error("Invalid GlobalConfig magic.");
  }
  return {
    magic: globalConfigMagic,
    version: data.readUInt16LE(8),
    bump: data.readUInt8(10),
    initialized: data.readUInt8(11) === 1,
    nckMint: new PublicKey(data.subarray(12, 44)).toBase58(),
    nckDecimals: data.readUInt8(44),
    nckGenesisSupply: data.readBigUInt64LE(45).toString(),
    developmentWallet: new PublicKey(data.subarray(53, 85)).toBase58(),
    worldId: data.readUInt16LE(85),
    worldSeed: Buffer.from(data.subarray(87, 119)),
    terrainConfigHash: Buffer.from(data.subarray(119, 151)).toString("hex"),
    resourceRuleHash: Buffer.from(data.subarray(151, 183)).toString("hex"),
    clientWorldConfigHash: Buffer.from(data.subarray(183, 215)).toString("hex"),
    chunkSize: data.readUInt16LE(259),
    sectionHeight: data.readUInt16LE(261),
    minBuildY: data.readInt16LE(263),
    maxBuildY: data.readInt16LE(265),
    maxTerrainHeight: data.readInt16LE(267),
    seaLevel: data.readInt16LE(269),
    guardianRegionSizeChunks: data.readUInt16LE(271),
    guardianRealtimeRadiusChunks: data.readUInt16LE(273),
    mineCooldownSlots: data.readUInt16LE(275),
    genesisSlot: data.readBigUInt64LE(277).toString(),
    createdAt: data.readBigInt64LE(285).toString(),
  };
}

function decodePlayerProfile(data) {
  if (data.length !== playerProfileLength && data.length !== legacyPlayerProfileLength) {
    throw new Error(
      `Invalid PlayerProfile length: expected ${playerProfileLength} or ${legacyPlayerProfileLength}, got ${data.length}.`,
    );
  }
  if (data.subarray(0, 8).toString("utf8") !== "NCKPLY01") {
    throw new Error("Invalid PlayerProfile magic.");
  }
  return {
    version: data.readUInt16LE(8),
    bump: data.readUInt8(10),
    initialized: data.readUInt8(11) === 1,
    owner: new PublicKey(data.subarray(12, 44)).toBase58(),
    globalConfig: new PublicKey(data.subarray(44, 76)).toBase58(),
    worldId: data.readUInt16LE(76),
    position: {
      x: data.readInt32LE(78),
      y: data.readInt32LE(82),
      z: data.readInt32LE(86),
    },
    equippedBackpack: data.length === playerProfileLength
      ? new PublicKey(data.subarray(393, 425)).toBase58()
      : PublicKey.default.toBase58(),
  };
}

function serializeGlobalConfigForStorage(config) {
  return {
    ...config,
    worldSeed: undefined,
    worldSeedHex: Buffer.from(config.worldSeed).toString("hex"),
    loadError: undefined,
  };
}

function createInitializePlayerInstruction(authority, playerProfile) {
  return new TransactionInstruction({
    programId: playerProgramId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: playerProfile, isSigner: false, isWritable: true },
      { pubkey: deriveGlobalConfigPda(), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  });
}

function createSetEquippedBackpackInstruction({ authority, playerProfile, backpack }) {
  return new TransactionInstruction({
    programId: playerProgramId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: playerProfile, isSigner: false, isWritable: true },
      { pubkey: backpack, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([5]),
  });
}

function createOrRefreshPlayerSessionInstruction({
  owner,
  sessionAuthority,
  playerProfile,
  playerSession,
  expiresAt,
}) {
  const data = Buffer.alloc(15);
  data.writeUInt8(4, 0);
  data.writeBigInt64LE(BigInt(expiresAt), 1);
  data.writeUInt16LE(sessionAllowedActions, 9);
  data.writeUInt32LE(sessionMaxActions, 11);

  return new TransactionInstruction({
    programId: playerProgramId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: sessionAuthority, isSigner: true, isWritable: false },
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: playerSession, isSigner: false, isWritable: true },
      { pubkey: deriveGlobalConfigPda(), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createRecordBlockChangeInstruction({
  authority,
  playerProfile,
  chunkPda,
  block,
  previousBlockId = blockRenderTypeId(block.type),
  newBlockId = EMPTY_BLOCK,
  action = 1,
  toolSlot,
}) {
  const data = Buffer.alloc(19);
  data.writeUInt8(1, 0);
  data.writeInt32LE(blockChunkX(block.x), 1);
  data.writeInt32LE(blockChunkZ(block.z), 5);
  data.writeUInt8(blockLocalX(block.x), 9);
  data.writeInt16LE(block.y, 10);
  data.writeUInt8(blockLocalZ(block.z), 12);
  data.writeUInt16LE(previousBlockId, 13);
  data.writeUInt16LE(newBlockId, 15);
  data.writeUInt8(action, 17);
  data.writeUInt8(toolSlot, 18);

  return new TransactionInstruction({
    programId: chunkProgramId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: chunkPda, isSigner: false, isWritable: true },
      { pubkey: deriveGlobalConfigPda(), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createMineBlockInstruction({ authority, block, owner = null }) {
  const [chunkBrokenPda] = deriveChunkBrokenPda(blockChunkX(block.x), blockChunkZ(block.z));
  const data = Buffer.alloc(13);
  data.writeUInt8(5, 0);
  data.writeInt32LE(block.x, 1);
  data.writeInt16LE(block.y, 5);
  data.writeInt32LE(block.z, 7);
  data.writeUInt16LE(inspectOnlyBlockId, 11);
  const keys = [{ pubkey: authority, isSigner: true, isWritable: true }];
  if (owner) {
    const [playerProfile] = derivePlayerProfilePda(owner);
    const [playerSession] = derivePlayerSessionPda(owner, authority);
    keys.push(
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: playerSession, isSigner: false, isWritable: false },
    );
  }
  keys.push(
    { pubkey: chunkBrokenPda, isSigner: false, isWritable: true },
    { pubkey: deriveGlobalConfigPda(), isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  );

  return new TransactionInstruction({
    programId: chunkProgramId,
    keys,
    data,
  });
}

function createInitializeBackpackInstruction({ owner, playerProfile, backpack, backpackId, capacity = backpackDefaultCapacity }) {
  const data = Buffer.alloc(10);
  data.writeUInt8(0, 0);
  data.writeBigUInt64LE(BigInt(backpackId), 1);
  data.writeUInt8(capacity, 9);
  return new TransactionInstruction({
    programId: backpackProgramId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: backpack, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createAppendMinedResourceInstruction({ owner, sessionAuthority, backpack, block }) {
  const [playerProfile] = derivePlayerProfilePda(owner);
  const [playerSession] = derivePlayerSessionPda(owner, sessionAuthority);
  const data = Buffer.alloc(11);
  data.writeUInt8(1, 0);
  data.writeInt32LE(block.x, 1);
  data.writeInt16LE(block.y, 5);
  data.writeInt32LE(block.z, 7);
  return new TransactionInstruction({
    programId: backpackProgramId,
    keys: [
      { pubkey: sessionAuthority, isSigner: true, isWritable: false },
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: playerSession, isSigner: false, isWritable: false },
      { pubkey: backpack, isSigner: false, isWritable: true },
    ],
    data,
  });
}

function createInitializeMarketAssetInstruction({
  owner,
  asset,
  assetId,
  category,
  quantity,
  itemHash,
  assetDetails,
}) {
  const categoryCode = marketCategoryCodes.get(category);
  if (!categoryCode) throw new Error(`Unsupported market category: ${category}`);
  const normalizedQuantity = Math.max(1, Math.min(2 ** 32 - 1, Number(quantity) || 1));
  const hash = Buffer.from(itemHash);
  if (hash.length !== 32) throw new Error("Invalid market item hash.");
  const details = assetDetails ?? {
    itemCode: 0,
    itemId: null,
    stackCount: normalizedQuantity,
    durability: 0,
    payloadLength: 0,
    payload: [],
  };
  const payload = Buffer.alloc(marketAssetPayloadLength);
  Buffer.from(details.payload ?? []).copy(payload, 0, 0, marketAssetPayloadLength);
  const data = Buffer.alloc(154);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(BigInt(assetId), 1);
  data.writeUInt8(categoryCode, 9);
  data.writeUInt32LE(normalizedQuantity, 10);
  hash.copy(data, 14);
  data.writeUInt16LE(details.itemCode, 46);
  data.writeUInt32LE(details.stackCount, 48);
  data.writeUInt32LE(details.durability, 52);
  data.writeUInt16LE(details.payloadLength, 56);
  payload.copy(data, 58);
  return new TransactionInstruction({
    programId: marketProgramId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: asset, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createMarketListingInstruction({
  seller,
  listing,
  listingId,
  category,
  currency,
  sourceKind,
  sourceIndex,
  quantity,
  priceBaseUnits,
  itemHash,
  sourceInventory,
  sourceRecord,
}) {
  const categoryCode = marketCategoryCodes.get(category);
  const currencyCode = marketCurrencyCodes.get(currency);
  const sourceKindCode = marketSourceKindCodes.get(sourceKind);
  if (!categoryCode) throw new Error(`Unsupported market category: ${category}`);
  if (!currencyCode) throw new Error(`Unsupported market currency: ${currency}`);
  if (!sourceKindCode) throw new Error(`Unsupported market source: ${sourceKind}`);
  const normalizedSourceIndex = Math.max(0, Math.min(65535, Number(sourceIndex) || 0));
  const normalizedQuantity = Math.max(1, Math.min(2 ** 32 - 1, Number(quantity) || 1));
  const hash = Buffer.from(itemHash);
  if (hash.length !== 32) throw new Error("Invalid market item hash.");
  const sourceInventoryKey = sourceInventory ? new PublicKey(sourceInventory) : PublicKey.default;
  const record = sourceRecord ?? {};

  const data = Buffer.alloc(100);
  data.writeUInt8(0, 0);
  data.writeBigUInt64LE(BigInt(listingId), 1);
  data.writeUInt8(categoryCode, 9);
  data.writeUInt8(currencyCode, 10);
  data.writeUInt8(sourceKindCode, 11);
  data.writeUInt16LE(normalizedSourceIndex, 12);
  data.writeUInt32LE(normalizedQuantity, 14);
  data.writeBigUInt64LE(BigInt(priceBaseUnits), 18);
  hash.copy(data, 26);
  sourceInventoryKey.toBuffer().copy(data, 58);
  data.writeInt32LE(Number(record.worldX ?? 0), 90);
  data.writeInt16LE(Number(record.worldY ?? 0), 94);
  data.writeInt32LE(Number(record.worldZ ?? 0), 96);

  const keys = [
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: listing, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  if (sourceKind === "backpack") {
    keys.push(
      { pubkey: sourceInventoryKey, isSigner: false, isWritable: true },
      { pubkey: backpackProgramId, isSigner: false, isWritable: false },
    );
  } else if (sourceKind === "asset") {
    keys.push({ pubkey: sourceInventoryKey, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    programId: marketProgramId,
    keys,
    data,
  });
}

function createCancelMarketListingInstruction({ seller, listing, source = null, sourceInventory = null }) {
  const keys = [
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: listing, isSigner: false, isWritable: true },
  ];
  if (source === "backpack" && sourceInventory) {
    keys.push(
      { pubkey: new PublicKey(sourceInventory), isSigner: false, isWritable: true },
      { pubkey: backpackProgramId, isSigner: false, isWritable: false },
      { pubkey: deriveMarketAuthorityPda()[0], isSigner: false, isWritable: false },
    );
  } else if (source === "asset" && sourceInventory) {
    keys.push({ pubkey: new PublicKey(sourceInventory), isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({
    programId: marketProgramId,
    keys,
    data: Buffer.from([1]),
  });
}

function createBuyMarketListingInstruction({
  buyer,
  seller,
  listing,
  currency,
  buyerNckToken = null,
  sellerNckToken = null,
  treasuryNckToken = null,
  source = null,
  sourceInventory = null,
  buyerBackpackAddress = null,
}) {
  const normalizedCurrency = String(currency || "NCK").toUpperCase();
  const keys = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: listing, isSigner: false, isWritable: true },
  ];
  if (normalizedCurrency === "NCK") {
    if (!buyerNckToken || !sellerNckToken || !treasuryNckToken) {
      throw new Error("NCK purchase requires buyer, seller, and treasury token accounts.");
    }
    keys.push(
      { pubkey: buyerNckToken, isSigner: false, isWritable: true },
      { pubkey: sellerNckToken, isSigner: false, isWritable: true },
      { pubkey: treasuryNckToken, isSigner: false, isWritable: true },
      { pubkey: nckMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    );
  } else if (normalizedCurrency === "SOL") {
    keys.push(
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: marketTreasury, isSigner: false, isWritable: true },
    );
  } else {
    throw new Error(`Unsupported market currency: ${currency}`);
  }
  if (source === "backpack") {
    if (!buyerBackpackAddress) throw new Error("Backpack listing purchase requires a buyer backpack.");
    keys.push(
      { pubkey: new PublicKey(buyerBackpackAddress), isSigner: false, isWritable: true },
      { pubkey: backpackProgramId, isSigner: false, isWritable: false },
      { pubkey: deriveMarketAuthorityPda()[0], isSigner: false, isWritable: false },
    );
  } else if (source === "asset") {
    if (!sourceInventory) throw new Error("Asset listing purchase requires an asset account.");
    keys.push({ pubkey: new PublicKey(sourceInventory), isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({
    programId: marketProgramId,
    keys,
    data: Buffer.from([2]),
  });
}

async function getOrCreateGameplaySession(provider) {
  const owner = provider.publicKey;
  const stored = loadStoredGameplaySession(owner);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const conn = getNicechunkConnection();
  if (stored && stored.expiresAt > nowSeconds + sessionRefreshSkewSeconds) {
    const [playerSession] = derivePlayerSessionPda(owner, stored.keypair.publicKey);
    const [account, sessionBalance] = await Promise.all([
      conn.getAccountInfo(playerSession, "confirmed"),
      conn.getBalance(stored.keypair.publicKey, "confirmed"),
    ]);
    if (account?.data?.length) {
      await fundGameplaySessionIfNeeded(provider, stored.keypair.publicKey, sessionBalance, conn);
      return stored;
    }
  }

  const keypair = stored?.keypair ?? Keypair.generate();
  const expiresAt = nowSeconds + sessionDurationSeconds;
  const [playerProfile] = derivePlayerProfilePda(owner);
  const [playerSession] = derivePlayerSessionPda(owner, keypair.publicKey);
  const tx = new Transaction();
  const [profileAccount, sessionBalance] = await Promise.all([
    conn.getAccountInfo(playerProfile, "confirmed"),
    conn.getBalance(keypair.publicKey, "confirmed"),
  ]);

  if (!profileAccount?.data?.length) {
    tx.add(createInitializePlayerInstruction(owner, playerProfile));
  }
  const targetLamports = getConfiguredGameplaySessionFundingLamports(owner);
  if (sessionBalance < targetLamports) {
    tx.add(SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: keypair.publicKey,
      lamports: targetLamports - sessionBalance,
    }));
  }
  tx.add(createOrRefreshPlayerSessionInstruction({
    owner,
    sessionAuthority: keypair.publicKey,
    playerProfile,
    playerSession,
    expiresAt,
  }));

  await signAndSendWalletTransaction(provider, tx, conn, [keypair]);
  const session = { keypair, expiresAt };
  storeGameplaySession(owner, session);
  return session;
}

async function fundGameplaySessionIfNeeded(provider, sessionAuthority, sessionBalance, conn) {
  const targetLamports = getConfiguredGameplaySessionFundingLamports(provider.publicKey);
  if (sessionBalance >= sessionMinimumMiningLamports) return;
  const tx = new Transaction();
  tx.add(SystemProgram.transfer({
    fromPubkey: provider.publicKey,
    toPubkey: sessionAuthority,
    lamports: targetLamports - sessionBalance,
  }));
  await signAndSendWalletTransaction(provider, tx, conn);
}

async function loadEquippedBackpackForOwner(owner, conn = getNicechunkConnection()) {
  const [playerProfile] = derivePlayerProfilePda(owner);
  const playerAccount = await conn.getAccountInfo(playerProfile, "confirmed");
  if (!playerAccount?.data?.length) return null;
  const profile = decodePlayerProfile(playerAccount.data);
  if (profile.owner !== owner.toBase58()) return null;
  if (!profile.equippedBackpack || profile.equippedBackpack === PublicKey.default.toBase58()) return null;
  const publicKey = new PublicKey(profile.equippedBackpack);
  const account = await conn.getAccountInfo(publicKey, "confirmed");
  if (!account?.data?.length) return null;
  const decoded = decodeBackpack(account.data);
  if (decoded.owner !== owner.toBase58()) {
    return null;
  }
  return { ...decoded, publicKey };
}

function loadStoredGameplaySession(owner) {
  try {
    if (!hasLocalStorage()) return null;
    const raw = localStorage.getItem(sessionStorageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.secretKey || !Number.isFinite(parsed.expiresAt)) return null;
    const secretKey = base64ToBytes(parsed.secretKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    if (parsed.publicKey && keypair.publicKey.toBase58() !== parsed.publicKey) return null;
    return { keypair, expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

function loadEquippedBackpackRecord(owner) {
  try {
    if (!hasLocalStorage()) return null;
    const raw = localStorage.getItem(equippedBackpackStorageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.backpack || !parsed?.backpackId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeEquippedBackpackRecord(owner, record) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(equippedBackpackStorageKey(owner), JSON.stringify(record));
}

function clearEquippedBackpackRecord(owner) {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(equippedBackpackStorageKey(owner));
}

function storeGameplaySession(owner, session) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(sessionStorageKey(owner), JSON.stringify({
    publicKey: session.keypair.publicKey.toBase58(),
    secretKey: bytesToBase64(session.keypair.secretKey),
    expiresAt: session.expiresAt,
    savedAt: Date.now(),
  }));
}

function sessionStorageKey(owner) {
  return `${sessionStorageKeyPrefix}${owner.toBase58()}`;
}

function equippedBackpackStorageKey(owner) {
  return `${equippedBackpackStorageKeyPrefix}${owner.toBase58()}`;
}

function sessionFundingStorageKey(owner = null) {
  const suffix = sessionOwnerStorageSuffix(owner);
  return `${sessionFundingStorageKeyPrefix}${suffix}`;
}

function sessionFundingAcknowledgedKey(owner = null) {
  const suffix = sessionOwnerStorageSuffix(owner);
  return `${sessionFundingAcknowledgedKeyPrefix}${suffix}`;
}

function sessionOwnerStorageSuffix(owner = null) {
  if (typeof owner === "string" && owner) return owner;
  return owner?.toBase58?.() ?? "default";
}

function storedWalletPublicKey() {
  try {
    if (!hasLocalStorage()) return null;
    const value = localStorage.getItem(storageWalletKey);
    return value ? new PublicKey(value) : null;
  } catch {
    return null;
  }
}

function createBackpackId() {
  const time = BigInt(Date.now()) & ((1n << 42n) - 1n);
  const random = BigInt(Math.floor(Math.random() * 2 ** 22));
  return (time << 22n) | random;
}

function createMarketListingId() {
  const time = BigInt(Date.now()) & ((1n << 42n) - 1n);
  const random = BigInt(Math.floor(Math.random() * 2 ** 22));
  return (time << 22n) | random;
}

function createMarketAssetId() {
  const time = BigInt(Date.now()) & ((1n << 42n) - 1n);
  const random = BigInt(Math.floor(Math.random() * 2 ** 22));
  return (time << 22n) | random;
}

function parseMarketPriceBaseUnits(value, currency) {
  const decimals = marketCurrencyDecimals.get(currency) ?? 6;
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid market listing price.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Price supports at most ${decimals} decimal places for ${currency}.`);
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const amount = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
  if (amount <= 0n || amount > 2n ** 64n - 1n) throw new Error("Invalid market listing price.");
  return amount;
}

function formatMarketBaseUnits(value, currency) {
  const decimals = marketCurrencyDecimals.get(currency) ?? 6;
  const amount = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount % scale;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

function createMarketAssetDetails(item, quantity = 1) {
  const slot = item?.slot ?? {};
  const itemId = slot.itemId ?? item?.itemId ?? "backpack_resource";
  const itemCode = marketAssetItemCodes.get(itemId) ?? marketDynamicAssetItemCode;
  const stackCount = clampU32(Number.isFinite(slot.count) ? slot.count : quantity);
  const durability = clampU32(Number.isFinite(slot.durability) ? slot.durability : 0);
  const payloadSource = itemId === "forged_item" && Array.isArray(slot.bytes)
    ? slot.bytes
    : itemCode === marketDynamicAssetItemCode
      ? Array.from(new TextEncoder().encode(itemId))
      : [];
  if (payloadSource.length > marketAssetPayloadLength) {
    throw new Error("Market asset payload is too large.");
  }
  return {
    itemCode,
    itemId,
    stackCount,
    durability,
    payloadLength: payloadSource.length,
    payload: [...payloadSource],
  };
}

async function createMarketItemHash({ item, category, currency, quantity, assetDetails = null }) {
  const payload = JSON.stringify({
    id: item?.id ?? "",
    source: item?.source ?? "",
    slotIndex: item?.slotIndex ?? null,
    name: item?.name ?? "",
    meta: item?.meta ?? "",
    category,
    currency,
    quantity,
    record: item?.slot?.record
      ? {
          worldX: item.slot.record.worldX,
          worldY: item.slot.record.worldY,
          worldZ: item.slot.record.worldZ,
        }
      : null,
    code: item?.slot?.code ?? null,
    itemId: item?.slot?.itemId ?? null,
    asset: assetDetails,
  });
  const encoded = new TextEncoder().encode(payload);
  if (crypto?.subtle?.digest) {
    return Buffer.from(await crypto.subtle.digest("SHA-256", encoded));
  }
  let hash = 2166136261;
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  const fallback = Buffer.alloc(32);
  for (let index = 0; index < 32; index += 4) {
    fallback.writeUInt32LE(hash >>> 0, index);
    hash = Math.imul(hash ^ index, 16777619);
  }
  return fallback;
}

function clampU32(value) {
  return Math.max(0, Math.min(2 ** 32 - 1, Math.floor(Number(value) || 0)));
}

function getConfiguredGameplaySessionFundingLamports(owner = null) {
  if (!hasLocalStorage()) return minimumSessionFundingLamports;
  const ownerValue = localStorage.getItem(sessionFundingStorageKey(owner));
  const defaultValue = localStorage.getItem(sessionFundingStorageKey(null));
  const parsed = Number(ownerValue ?? defaultValue);
  return Number.isFinite(parsed) && parsed >= minimumSessionFundingLamports
    ? Math.floor(parsed)
    : minimumSessionFundingLamports;
}

async function signAndSendWalletTransaction(provider, transaction, conn = getNicechunkConnection(), extraSigners = []) {
  transaction.feePayer = provider.publicKey;

  if (typeof conn.prepareTransaction === "function") {
    await conn.prepareTransaction(transaction, { commitment: "confirmed" });
  } else {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
  }

  for (const signer of extraSigners) transaction.partialSign(signer);

  if (typeof provider.signTransaction === "function") {
    const signed = await provider.signTransaction(transaction);
    const signature = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await conn.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight: transaction.lastValidBlockHeight,
    }, "confirmed");
    return signature;
  }

  if (typeof provider.signAndSendTransaction !== "function") {
    throw new Error("Wallet does not support transaction signing.");
  }
  const result = await provider.signAndSendTransaction(transaction);
  const signature = typeof result === "string" ? result : result?.signature;
  if (!signature) throw new Error("Wallet did not return a transaction signature.");
  await conn.confirmTransaction({
    signature,
    blockhash: transaction.recentBlockhash,
    lastValidBlockHeight: transaction.lastValidBlockHeight,
  }, "confirmed");
  return signature;
}

async function signAndSendKeypairTransaction(signer, transaction, conn = getNicechunkConnection()) {
  transaction.feePayer = signer.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.sign(signer);
  const signature = await conn.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

async function connectedWalletProvider({ prompt = false } = {}) {
  const provider = [
    window.phantom?.solana,
    window.solflare,
    window.backpack?.solana,
    window.solana,
  ].find((candidate) => candidate && typeof candidate.connect === "function");
  if (!provider || typeof provider.connect !== "function") return null;
  const storedWallet = localStorage.getItem(storageWalletKey);
  try {
    if (!provider.publicKey) {
      if (prompt) {
        await provider.connect();
      } else {
        await provider.connect({ onlyIfTrusted: true });
      }
    }
  } catch {
    return null;
  }
  if (!provider.publicKey) return null;
  if (storedWallet && provider.publicKey.toBase58() !== storedWallet) return null;
  return provider;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
