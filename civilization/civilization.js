import { initI18n, t } from "../src/i18n.js";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import "./style.css";
import "../src/site-header.css";

/**
 * @typedef {"natural" | "civilization"} LawType
 * @typedef {"draft" | "reading" | "cooling" | "challenge" | "ready" | "active" | "not_enough"} RuleStatus
 * @typedef {"smelting" | "forging" | "block_properties" | "resource_rules" | "element_rules" | "world_knowledge"} TargetModule
 * @typedef {{
 *   id: string;
 *   titleKey: string;
 *   lawType: LawType;
 *   targetModules: TargetModule[];
 *   riskLevel: "medium" | "high" | "critical";
 *   threshold: number;
 *   snapshotEpoch: number;
 *   yesPower: number;
 *   noPower: number;
 *   abstainPower: number;
 *   status: RuleStatus;
 *   cooldownEnd: string;
 *   executeStatus: string;
 *   textHash: string;
 *   patchHash: string;
 *   author: string;
 * }} RuleBook
 * @typedef {{
 *   epoch: number;
 *   activeCitizens: number;
 *   totalPower: number;
 *   matureCitizenRatio: number;
 * }} CivilizationPowerSnapshot
 */

const lawLayers = [
  {
    id: "natural",
    titleKey: "civilization.layers.natural.title",
    subtitleKey: "civilization.layers.natural.subtitle",
    threshold: "90%",
    metaKeys: [
      "civilization.layers.natural.meta.constitution",
      "civilization.layers.natural.meta.longDelay",
      "civilization.layers.natural.meta.strictValidator",
    ],
  },
  {
    id: "civilization",
    titleKey: "civilization.layers.civilization.title",
    subtitleKey: "civilization.layers.civilization.subtitle",
    threshold: "50%",
    metaKeys: [
      "civilization.layers.civilization.meta.production",
      "civilization.layers.civilization.meta.normalDelay",
      "civilization.layers.civilization.meta.openEvolution",
    ],
  },
];

const tocItems = [
  { id: "termDecoder", href: "#term-decoder", tone: "green" },
  { id: "plainModel", href: "#plain-model", tone: "green" },
  { id: "readerPath", href: "#reader-path", tone: "blue" },
  { id: "trustJourney", href: "#trust-journey", tone: "green" },
  { id: "ruleClassifier", href: "#rule-classifier", tone: "gold" },
  { id: "threatModel", href: "#threat-model", tone: "red" },
  { id: "challengeDesk", href: "#challenge-desk", tone: "red" },
  { id: "caseWalkthrough", href: "#case-walkthrough", tone: "green" },
  { id: "impactSimulator", href: "#impact-simulator", tone: "blue" },
  { id: "civicPower", href: "#civic-power-ledger", tone: "green" },
  { id: "executionProof", href: "#execution-proof", tone: "blue" },
  { id: "pdaTransparency", href: "#pda-transparency", tone: "gold" },
  { id: "civilizationDesign", href: "#civilization-blueprint", tone: "green" },
  { id: "buildSpec", href: "#build-spec", tone: "blue" },
];

const glossaryTerms = [
  { id: "ruleBook", proof: "rule_book_pda" },
  { id: "pda", proof: "program_derived_address" },
  { id: "hash", proof: "text_hash | patch_hash" },
  { id: "snapshot", proof: "snapshot_epoch" },
  { id: "validator", proof: "RuleValidator gates" },
  { id: "event", proof: "RuleExecuted | RuleRejected" },
];

const glossaryChecks = [
  "plainFirst",
  "proofSecond",
  "sameIdentity",
  "replayable",
  "shareable",
];

const classifierRoutes = [
  { id: "futureConfig", route: "civilization", threshold: "50%", proof: "migration_mode = ForwardOnly" },
  { id: "oldAssets", route: "natural", threshold: "90%", proof: "migration_mode = NaturalLaw" },
  { id: "coreInvariant", route: "natural", threshold: "90%", proof: "scope = genesis | conservation" },
  { id: "privilegeMint", route: "reject", threshold: "0%", proof: "RuleRejected::Privilege" },
  { id: "unknownPatch", route: "reject", threshold: "0%", proof: "RuleRejected::UnknownAdapter" },
];

const classifierChecks = [
  "touchesOldAssets",
  "changesSupply",
  "grantsPrivilege",
  "futureOnly",
  "knownAdapter",
];

const lifecycleSteps = [
  "draft",
  "publish",
  "read",
  "sign",
  "threshold",
  "cooling",
  "execute",
  "active",
];

const schemaFields = [
  ["title", "string"],
  ["author", "pubkey"],
  ["category", "NaturalLaw | CivilizationLaw"],
  ["target_module", "TargetModule[]"],
  ["human_readable_text", "sha256-bound text"],
  ["machine_patch", "validated patch bytes"],
  ["risk_level", "medium | high | critical"],
  ["threshold", "50 | 90"],
  ["snapshot_epoch", "u64"],
  ["status", "RuleStatus"],
  ["yes_power", "u64"],
  ["no_power", "u64"],
  ["abstain_power", "u64"],
  ["cooldown_end", "i64"],
  ["execute_status", "pending | executed | rejected"],
];

const targetModules = [
  { id: "smelting", config: "smelting_config_pda" },
  { id: "forging", config: "forging_config_pda" },
  { id: "block_properties", config: "block_property_config_pda" },
  { id: "resource_rules", config: "resource_config_pda" },
  { id: "element_rules", config: "element_config_pda" },
  { id: "world_knowledge", config: "world_knowledge_pda" },
];

const naturalLawExamples = [
  "resourceConservation",
  "assetProtection",
  "publicWorldGeneration",
  "noProjectPrivilege",
  "transparentAuthority",
  "nckPrinciples",
];

const civilizationLawExamples = [
  "bronze",
  "oreEnergy",
  "blockHardness",
  "toolRecipe",
  "materialProcessing",
];

const powerSources = [
  "registration",
  "exploration",
  "mining",
  "forging",
  "trading",
  "guardianService",
  "ruleReading",
  "longActivity",
];

const powerGuards = [
  "maturity",
  "walletCap",
  "activeWindow",
  "decay",
  "anomalyPenalty",
];

const threatScenarios = [
  { id: "sybil", defense: "maturity" },
  { id: "whaleCapture", defense: "powerCap" },
  { id: "stalePatch", defense: "oldHash" },
  { id: "assetSeizure", defense: "naturalLaw" },
  { id: "resourceInflation", defense: "conservation" },
  { id: "hiddenAdmin", defense: "permissionless" },
];

const defenseStackItems = [
  "identity",
  "hash",
  "validator",
  "challenge",
  "publicFailure",
];

const challengeStages = [
  { id: "detect", proof: "rule_diff_view" },
  { id: "evidence", proof: "evidence_hash" },
  { id: "file", proof: "challenge_pda" },
  { id: "pause", proof: "execution_lock" },
  { id: "resolve", proof: "resolution_event" },
  { id: "learn", proof: "public_failure_index" },
];

const challengeChecks = [
  "clearWindow",
  "evidenceHash",
  "executionPause",
  "namedReason",
  "publicOutcome",
];

const caseSummaryFacts = [
  ["lawType", "CivilizationLaw"],
  ["ruleId", "bronze-age-rule"],
  ["targetModules", "smelting + forging"],
  ["threshold", "50%"],
  ["snapshotEpoch", "42"],
  ["execution", "permissionless execute_rule"],
];

const caseViews = [
  { id: "player", tone: "green" },
  { id: "builder", tone: "blue" },
  { id: "auditor", tone: "gold" },
  { id: "contract", tone: "red" },
];

const caseEvidence = [
  { id: "textHash", label: "text_hash", value: "text_9ad4...bronze" },
  { id: "patchHash", label: "patch_hash", value: "patch_a80c...forge" },
  { id: "oldHash", label: "old_value_hash", value: "old_cfg_21bc...smelt" },
  { id: "newHash", label: "new_value_hash", value: "new_cfg_c71e...bronze" },
  { id: "writtenPda", label: "written_pda", value: "smelting_config_pda + forging_config_pda" },
  { id: "event", label: "event", value: "RuleExecuted" },
];

const impactSurfaces = [
  { id: "personal", proof: "wallet_scope = read-only" },
  { id: "assets", proof: "migration_mode = ForwardOnly" },
  { id: "production", proof: "recipe_diff_hash" },
  { id: "settlement", proof: "settlement_effect_hash" },
  { id: "economy", proof: "conservation_check" },
  { id: "technical", proof: "validator_dry_run" },
];

const impactChecks = [
  "readAccounts",
  "compareHashes",
  "showDiff",
  "simulateFailure",
  "explainChoice",
];

const reputationSources = [
  { id: "discovery", proof: "chunk_discovery_receipt_pda" },
  { id: "backpack", proof: "backpack_ownership_snapshot" },
  { id: "forging", proof: "forging_output_receipt_hash" },
  { id: "market", proof: "settled_trade_integrity_score" },
  { id: "settlement", proof: "civic_contribution_receipt_pda" },
  { id: "audit", proof: "challenge_resolution_record" },
];

const reputationGuards = [
  "receiptOnly",
  "snapshotEpoch",
  "capAndDecay",
  "nonTransferable",
  "replayableMath",
];

const constitutionChecks = [
  "higherRisk",
  "longerCooldown",
  "stricterValidation",
  "strongerPrompt",
  "widerChallenge",
];

const conceptCards = [
  "publicRulebook",
  "boundedMachine",
  "noSilentAdmin",
];

const boundaryCards = [
  "liveNow",
  "designedNext",
  "notClaimed",
];

const readerGuideLanes = [
  { id: "player", checks: ["plainChange", "personalImpact", "signChoice"] },
  { id: "builder", checks: ["targetModule", "patchDiff", "executionPath"] },
  { id: "auditor", checks: ["hashes", "pdaWrites", "rejectionProof"] },
];

const reviewChecklist = [
  "whatChanges",
  "affectedSurface",
  "oldAssets",
  "hashProof",
  "thresholdPath",
  "failurePath",
];

const journeySteps = [
  { id: "enter", proof: "wallet + seed_chunk" },
  { id: "gather", proof: "resource_origin_hash" },
  { id: "craft", proof: "recipe_version_hash" },
  { id: "settle", proof: "settlement_pda" },
  { id: "propose", proof: "rule_book_pda" },
  { id: "verify", proof: "decoded_pda_link" },
];

const journeyTranslations = [
  "plainAction",
  "publicEvidence",
  "powerSnapshot",
  "boundedChange",
  "replayableResult",
];

const technicalAssurances = [
  "hashBinding",
  "validatorBeforeWrite",
  "pdaRegistry",
  "permissionlessExecution",
];

const patchFields = [
  ["module", "TargetModule"],
  ["operation", "SetField | UpsertRecord | DisableRecord"],
  ["field_path", "bytes"],
  ["old_value_hash", "[u8; 32]"],
  ["new_value_hash", "[u8; 32]"],
  ["migration_mode", "None | ForwardOnly | NaturalLaw"],
  ["effective_epoch", "u64"],
  ["rollback_hash", "[u8; 32]"],
];

const riskMatrix = [
  { id: "low", threshold: "50%", tone: "green" },
  { id: "medium", threshold: "50% + cooldown", tone: "blue" },
  { id: "high", threshold: "50% + challenge", tone: "gold" },
  { id: "critical", threshold: "90% Natural Law", tone: "red" },
];

const validatorGates = [
  "parse",
  "scope",
  "conservation",
  "asset",
  "threshold",
  "write",
];

const executionProofItems = [
  "snapshotFrozen",
  "signatureAccount",
  "executeAccounts",
  "publicRejection",
];

const transparencySurfaces = [
  { id: "ruleLedger", account: "rule_book_pda", proof: "text_hash + patch_hash" },
  { id: "signatureLedger", account: "rule_signature_pda", proof: "power_at_snapshot" },
  { id: "citizenSnapshot", account: "citizen_state_pda", proof: "snapshot_epoch" },
  { id: "configRegistry", account: "rule_registry_pda", proof: "active_config_hash" },
  { id: "assetSafety", account: "backpack_pda", proof: "read-only asset check" },
  { id: "challengeCourt", account: "challenge_pda", proof: "evidence_hash" },
];

const transparencyChecks = [
  "decode",
  "compare",
  "recount",
  "simulate",
  "watch",
];

const versioningStages = [
  { id: "activeV1", account: "rule_registry_pda", hash: "config_v1_hash" },
  { id: "proposalV2", account: "rule_book_pda", hash: "patch_v2_hash" },
  { id: "compatibility", account: "asset_policy_pda", hash: "compat_hash" },
  { id: "activeV2", account: "module_config_pda", hash: "config_v2_hash" },
];

const versioningPrinciples = [
  "appendOnly",
  "effectiveEpoch",
  "compatibility",
  "supersession",
  "auditReplay",
];

const designSurfaces = [
  { id: "era", account: "civilization_epoch_pda", anchor: "era_rule_hash" },
  { id: "citizen", account: "citizen_profile_pda", anchor: "power_snapshot_hash" },
  { id: "settlement", account: "settlement_pda", anchor: "territory_hash" },
  { id: "production", account: "production_graph_pda", anchor: "recipe_config_hash" },
  { id: "knowledge", account: "knowledge_record_pda", anchor: "discovery_hash" },
  { id: "proof", account: "civilization_index_pda", anchor: "decoded_account_hash" },
];

const designPrinciples = [
  "readablePromise",
  "pdaAnchor",
  "materialContinuity",
  "forwardUnlocks",
  "publicDecoder",
];

const designBlueprints = [
  { id: "epoch", pda: "civilization_epoch_pda", instruction: "advance_epoch" },
  { id: "role", pda: "citizen_role_pda", instruction: "update_citizen_role" },
  { id: "settlement", pda: "settlement_pda", instruction: "register_settlement" },
  { id: "project", pda: "civic_project_pda", instruction: "fund_civic_project" },
  { id: "knowledge", pda: "knowledge_record_pda", instruction: "publish_discovery" },
];

const civicSurfaces = [
  { id: "charter", account: "settlement_pda", proof: "charter_hash" },
  { id: "contribution", account: "civic_contribution_pda", proof: "material_receipt_hash" },
  { id: "guardian", account: "guardian_coverage_pda", proof: "coverage_epoch_hash" },
  { id: "project", account: "civic_project_pda", proof: "milestone_hash" },
  { id: "benefit", account: "settlement_effect_pda", proof: "effect_config_hash" },
  { id: "audit", account: "settlement_index_pda", proof: "decoded_state_hash" },
];

const civicGuarantees = [
  "noPrivateTreasury",
  "materialReceipts",
  "guardianProof",
  "ruleAuthorized",
  "benefitBounded",
];

const accountBlueprints = [
  { id: "ruleBook", account: "rule_book_pda", seed: "[\"rule-book\", rule_id]", writer: "author wallet", mutability: "append-then-freeze" },
  { id: "signature", account: "rule_signature_pda", seed: "[\"rule-signature\", rule_id, voter]", writer: "voter wallet", mutability: "one signer per rule" },
  { id: "citizen", account: "citizen_state_pda", seed: "[\"citizen\", wallet]", writer: "participation programs", mutability: "epoch snapshot input" },
  { id: "registry", account: "rule_registry_pda", seed: "[\"rule-registry\", target_module]", writer: "execute_rule", mutability: "versioned active rules" },
  { id: "moduleConfig", account: "module_config_pda", seed: "[module, config_version]", writer: "execute_rule", mutability: "narrow config patch" },
];

const failureCases = [
  { id: "staleHash", severity: "medium" },
  { id: "thresholdMissing", severity: "high" },
  { id: "snapshotChanged", severity: "high" },
  { id: "assetViolation", severity: "critical" },
  { id: "conservationFailure", severity: "critical" },
  { id: "wrongScope", severity: "medium" },
];

const buildSpecGroups = [
  { id: "program", items: ["stateAccounts", "instructions", "errors"] },
  { id: "validator", items: ["patchParser", "safetyGates", "moduleAdapters"] },
  { id: "client", items: ["ruleEditor", "signaturePanel", "pdaBrowser"] },
  { id: "audit", items: ["hashCompare", "simulation", "eventLog"] },
];

const buildOrderSteps = [
  "mockFirst",
  "readOnlyPdas",
  "signatureFlow",
  "validatorDryRun",
  "permissionlessExecute",
];

const instructionSpecs = [
  { id: "publishRule", accounts: ["author", "rule_book_pda", "system_program"] },
  { id: "signRule", accounts: ["voter", "rule_book_pda", "rule_signature_pda", "citizen_state_pda"] },
  { id: "finalizeThreshold", accounts: ["rule_book_pda", "signature_index_pda", "rule_tally_pda"] },
  { id: "challengeRule", accounts: ["challenger", "rule_book_pda", "challenge_pda", "evidence_hash"] },
  { id: "executeRule", accounts: ["caller", "rule_book_pda", "rule_registry_pda", "module_config_pda", "target_config_pda"] },
];

const eventSpecs = [
  { id: "rulePublished", level: "public" },
  { id: "ruleSigned", level: "public" },
  { id: "thresholdFinalized", level: "public" },
  { id: "ruleChallenged", level: "warning" },
  { id: "ruleExecuted", level: "public" },
  { id: "ruleRejected", level: "warning" },
];

const invariants = [
  "hashIdentity",
  "snapshotReplay",
  "singleSignature",
  "noPrivilegedExecute",
  "boundedWrite",
  "rejectionReason",
];

const moduleBindings = [
  { id: "core", magic: "NCKCFG01", seed: "global-config", account: "GlobalConfig", status: "immutable" },
  { id: "chunk", magic: "NCKDRP01", seed: "resource-drops", account: "ResourceDropTable", status: "config" },
  { id: "backpack", magic: "NCKBPK01", seed: "backpack", account: "BackpackAccount", status: "asset" },
  { id: "smelting", magic: "NCKSMR01", seed: "smelting-recipes", account: "RecipeTable", status: "config" },
  { id: "guardian", magic: "NCKGDR01", seed: "guardian-registry", account: "GuardianRegistry", status: "service" },
  { id: "market", magic: "NCKMKT01", seed: "listing", account: "ListingAccount", status: "settlement" },
];

/** @type {CivilizationPowerSnapshot} */
const powerSnapshot = {
  epoch: 42,
  activeCitizens: 18420,
  totalPower: 9200000,
  matureCitizenRatio: 0.73,
};

/** @type {RuleBook[]} */
const mockRuleBooks = [
  {
    id: "bronze-age-rule",
    titleKey: "civilization.mock.rules.bronze.title",
    lawType: "civilization",
    targetModules: ["smelting", "forging"],
    riskLevel: "medium",
    threshold: 50,
    snapshotEpoch: 42,
    yesPower: 630000,
    noPower: 210000,
    abstainPower: 160000,
    status: "ready",
    cooldownEnd: "2026-07-02T00:00:00Z",
    executeStatus: "ready_to_execute",
    textHash: "text_9ad4...bronze",
    patchHash: "patch_a80c...forge",
    author: "F3rM...7aQp",
  },
  {
    id: "world-conservation-amendment",
    titleKey: "civilization.mock.rules.conservation.title",
    lawType: "natural",
    targetModules: ["resource_rules", "smelting"],
    riskLevel: "critical",
    threshold: 90,
    snapshotEpoch: 42,
    yesPower: 820000,
    noPower: 130000,
    abstainPower: 50000,
    status: "not_enough",
    cooldownEnd: "not_started",
    executeStatus: "blocked_by_threshold",
    textHash: "text_a171...world",
    patchHash: "patch_71ce...conserve",
    author: "8Gov...NCK9",
  },
  {
    id: "desert-cactus-block-rule",
    titleKey: "civilization.mock.rules.cactus.title",
    lawType: "civilization",
    targetModules: ["block_properties", "resource_rules"],
    riskLevel: "medium",
    threshold: 50,
    snapshotEpoch: 43,
    yesPower: 510000,
    noPower: 330000,
    abstainPower: 160000,
    status: "cooling",
    cooldownEnd: "2026-07-05T12:00:00Z",
    executeStatus: "cooling_period",
    textHash: "text_f0c2...cactus",
    patchHash: "patch_75db...desert",
    author: "Cact...9zE2",
  },
  {
    id: "no-admin-minting-principle",
    titleKey: "civilization.mock.rules.noAdminMint.title",
    lawType: "natural",
    targetModules: ["resource_rules", "element_rules"],
    riskLevel: "critical",
    threshold: 90,
    snapshotEpoch: 43,
    yesPower: 940000,
    noPower: 40000,
    abstainPower: 20000,
    status: "challenge",
    cooldownEnd: "2026-07-09T00:00:00Z",
    executeStatus: "challenge_period",
    textHash: "text_501c...nomint",
    patchHash: "patch_faa9...privilege",
    author: "NoPr...7vL1",
  },
];

const contractAccounts = [
  "civilization_program",
  "rule_registry_pda",
  "rule_book_pda",
  "rule_signature_pda",
  "citizen_state_pda",
  "smelting_config_pda",
  "forging_config_pda",
  "block_property_config_pda",
  "resource_config_pda",
];

const validatorRules = [
  "noResourceFromNothing",
  "noInputBypass",
  "noAddressPrivilege",
  "noOwnershipSeizure",
];

const heroLedger = document.querySelector("#heroLedger");
const civilizationToc = document.querySelector("#civilizationToc");
const civilizationGlossaryDiagram = document.querySelector("#civilizationGlossaryDiagram");
const glossaryStack = document.querySelector("#glossaryStack");
const glossaryGrid = document.querySelector("#glossaryGrid");
const civilizationConceptCards = document.querySelector("#civilizationConceptCards");
const civilizationSystemDiagram = document.querySelector("#civilizationSystemDiagram");
const civilizationReaderDiagram = document.querySelector("#civilizationReaderDiagram");
const readerGuideLanesTarget = document.querySelector("#readerGuideLanes");
const ruleReviewChecklist = document.querySelector("#ruleReviewChecklist");
const civilizationJourneyDiagram = document.querySelector("#civilizationJourneyDiagram");
const journeyStack = document.querySelector("#journeyStack");
const journeyGrid = document.querySelector("#journeyGrid");
const civilizationBoundaryGrid = document.querySelector("#civilizationBoundaryGrid");
const lawLayerCards = document.querySelector("#lawLayerCards");
const civilizationClassifierDiagram = document.querySelector("#civilizationClassifierDiagram");
const classifierChecksTarget = document.querySelector("#classifierChecks");
const classifierGrid = document.querySelector("#classifierGrid");
const constitutionChecksTarget = document.querySelector("#constitutionChecks");
const powerSourcesTarget = document.querySelector("#powerSources");
const powerGuardsTarget = document.querySelector("#powerGuards");
const civilizationPowerDiagram = document.querySelector("#civilizationPowerDiagram");
const civilizationThreatDiagram = document.querySelector("#civilizationThreatDiagram");
const defenseStackTarget = document.querySelector("#defenseStack");
const threatModelGrid = document.querySelector("#threatModelGrid");
const civilizationChallengeDiagram = document.querySelector("#civilizationChallengeDiagram");
const challengeStack = document.querySelector("#challengeStack");
const challengeGrid = document.querySelector("#challengeGrid");
const civilizationCaseDiagram = document.querySelector("#civilizationCaseDiagram");
const caseSummaryPanel = document.querySelector("#caseSummaryPanel");
const caseViewGrid = document.querySelector("#caseViewGrid");
const caseEvidenceGrid = document.querySelector("#caseEvidenceGrid");
const civilizationImpactDiagram = document.querySelector("#civilizationImpactDiagram");
const impactStack = document.querySelector("#impactStack");
const impactGrid = document.querySelector("#impactGrid");
const civilizationReputationDiagram = document.querySelector("#civilizationReputationDiagram");
const reputationStack = document.querySelector("#reputationStack");
const reputationGrid = document.querySelector("#reputationGrid");
const timelineTarget = document.querySelector("#ruleLifecycleTimeline");
const schemaTarget = document.querySelector("#ruleBookSchema");
const civilizationExecutionDiagram = document.querySelector("#civilizationExecutionDiagram");
const technicalAssurancesTarget = document.querySelector("#technicalAssurances");
const civilizationValidatorDiagram = document.querySelector("#civilizationValidatorDiagram");
const patchSchemaPanel = document.querySelector("#patchSchemaPanel");
const riskMatrixGrid = document.querySelector("#riskMatrixGrid");
const civilizationTransactionDiagram = document.querySelector("#civilizationTransactionDiagram");
const executionProofStack = document.querySelector("#executionProofStack");
const accountBlueprintGrid = document.querySelector("#accountBlueprintGrid");
const failureCaseGrid = document.querySelector("#failureCaseGrid");
const civilizationTransparencyDiagram = document.querySelector("#civilizationTransparencyDiagram");
const transparencyChecksTarget = document.querySelector("#transparencyChecks");
const transparencyGrid = document.querySelector("#transparencyGrid");
const civilizationVersioningDiagram = document.querySelector("#civilizationVersioningDiagram");
const versioningStack = document.querySelector("#versioningStack");
const versioningGrid = document.querySelector("#versioningGrid");
const civilizationDesignDiagram = document.querySelector("#civilizationDesignDiagram");
const designStack = document.querySelector("#designStack");
const designGrid = document.querySelector("#designGrid");
const designBlueprintPanel = document.querySelector("#designBlueprintPanel");
const civilizationCivicDiagram = document.querySelector("#civilizationCivicDiagram");
const civicStack = document.querySelector("#civicStack");
const civicGrid = document.querySelector("#civicGrid");
const buildSpecGrid = document.querySelector("#buildSpecGrid");
const buildOrderPanel = document.querySelector("#buildOrderPanel");
const civilizationAuditTrailDiagram = document.querySelector("#civilizationAuditTrailDiagram");
const invariantPanel = document.querySelector("#invariantPanel");
const instructionSpecGrid = document.querySelector("#instructionSpecGrid");
const eventLogGrid = document.querySelector("#eventLogGrid");
const civilizationBindingDiagram = document.querySelector("#civilizationBindingDiagram");
const moduleBindingGrid = document.querySelector("#moduleBindingGrid");
const modulesTarget = document.querySelector("#ruleModulesGrid");
const naturalExamplesTarget = document.querySelector("#naturalLawExamples");
const civilizationExamplesTarget = document.querySelector("#civilizationLawExamples");
const executionStackTarget = document.querySelector("#executionStack");
const mockRuleBooksTarget = document.querySelector("#mockRuleBooks");
const contractDirectionTarget = document.querySelector("#futureContractDirection");
const toast = document.querySelector("#comingSoonToast");
let svgMarkerCounter = 0;

setSiteLoadingProgress(28);
await initI18n();
setSiteLoadingProgress(56);
renderCivilizationPage();
finishSiteLoading();

window.addEventListener("nicechunk:languagechange", renderCivilizationPage);

document.querySelectorAll("[data-civilization-action]").forEach((button) => {
  button.addEventListener("click", showComingSoon);
});

function renderCivilizationPage() {
  document.title = t("civilization.meta.title");
  renderHeroLedger();
  renderDirectory();
  renderGlossary();
  renderConceptCards();
  renderSvgDiagrams();
  renderReaderGuide();
  renderTrustJourney();
  renderBoundaryGrid();
  renderLawLayerCards();
  renderRuleClassifier();
  renderConstitutionChecks();
  renderPowerExplainer();
  renderThreatModel();
  renderChallengeDesk();
  renderCaseWalkthrough();
  renderImpactSimulator();
  renderReputationLedger();
  renderRuleLifecycleTimeline();
  renderRuleBookSchema();
  renderTechnicalAssurances();
  renderValidatorSpec();
  renderExecutionProof();
  renderTransparencyConsole();
  renderVersioningModel();
  renderCivilizationDesign();
  renderCivicWorks();
  renderBuildSpec();
  renderImplementationTrace();
  renderModuleBindings();
  renderRuleModulesGrid();
  renderExamples();
  renderExecutionModelSection();
  renderMockRuleBooks();
  renderFutureContractDirection();
}

function renderHeroLedger() {
  heroLedger?.replaceChildren(
    metricCard("90%", t("civilization.hero.metric.natural")),
    metricCard("50%", t("civilization.hero.metric.civilization")),
    metricCard(String(powerSnapshot.epoch), t("civilization.hero.metric.epoch")),
    metricCard(formatCompact(powerSnapshot.activeCitizens), t("civilization.hero.metric.citizens")),
  );
}

function renderDirectory() {
  civilizationToc?.replaceChildren(
    ...tocItems.map((item, index) => {
      const link = document.createElement("a");
      link.className = `toc-card ${item.tone}`;
      link.href = item.href;
      link.innerHTML = "<span></span><strong></strong><p></p>";
      link.querySelector("span").textContent = String(index + 1).padStart(2, "0");
      link.querySelector("strong").textContent = t(`civilization.toc.items.${item.id}.title`);
      link.querySelector("p").textContent = t(`civilization.toc.items.${item.id}.body`);
      return link;
    }),
  );
}

function renderGlossary() {
  glossaryStack?.replaceChildren(
    sectionMiniTitle("civilization.glossary.stackTitle"),
    ...glossaryChecks.map((key) => checkCard(t(`civilization.glossary.checks.${key}`))),
  );
  glossaryGrid?.replaceChildren(
    ...glossaryTerms.map((term) => {
      const card = document.createElement("article");
      card.className = `glossary-card ${term.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = t(`civilization.glossary.terms.${term.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.glossary.terms.${term.id}.title`);
      card.querySelector("p").textContent = t(`civilization.glossary.terms.${term.id}.body`);
      card.querySelector("code").textContent = term.proof;
      return card;
    }),
  );
}

function renderLawLayerCards() {
  lawLayerCards?.replaceChildren(
    ...lawLayers.map((layer) => {
      const card = document.createElement("article");
      card.className = `law-layer-card ${layer.id}`;
      card.innerHTML = `
        <div class="law-layer-threshold"></div>
        <div class="law-layer-copy">
          <span class="law-type"></span>
          <h3></h3>
          <p></p>
        </div>
        <div class="law-meta-list"></div>
      `;
      card.querySelector(".law-layer-threshold").textContent = layer.threshold;
      card.querySelector(".law-type").textContent = t(`civilization.lawType.${layer.id}`);
      card.querySelector("h3").textContent = t(layer.titleKey);
      card.querySelector("p").textContent = t(layer.subtitleKey);
      card.querySelector(".law-meta-list").replaceChildren(...layer.metaKeys.map((key) => pill(t(key))));
      return card;
    }),
  );
}

function renderConceptCards() {
  civilizationConceptCards?.replaceChildren(
    ...conceptCards.map((key) => {
      const card = document.createElement("article");
      card.className = "concept-card";
      card.innerHTML = "<span></span><h3></h3><p></p>";
      card.querySelector("span").textContent = t(`civilization.concept.cards.${key}.kicker`);
      card.querySelector("h3").textContent = t(`civilization.concept.cards.${key}.title`);
      card.querySelector("p").textContent = t(`civilization.concept.cards.${key}.body`);
      return card;
    }),
  );
}

function renderReaderGuide() {
  readerGuideLanesTarget?.replaceChildren(
    ...readerGuideLanes.map((lane) => {
      const card = document.createElement("article");
      card.className = `reader-lane-card ${lane.id}`;
      card.innerHTML = "<span></span><h3></h3><p></p><ul></ul>";
      card.querySelector("span").textContent = t(`civilization.readerGuide.lanes.${lane.id}.kicker`);
      card.querySelector("h3").textContent = t(`civilization.readerGuide.lanes.${lane.id}.title`);
      card.querySelector("p").textContent = t(`civilization.readerGuide.lanes.${lane.id}.body`);
      card.querySelector("ul").replaceChildren(
        ...lane.checks.map((check) => {
          const item = document.createElement("li");
          item.textContent = t(`civilization.readerGuide.lanes.${lane.id}.checks.${check}`);
          return item;
        }),
      );
      return card;
    }),
  );
  ruleReviewChecklist?.replaceChildren(
    ...reviewChecklist.map((key, index) => {
      const card = document.createElement("article");
      card.className = "review-check-card";
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector("strong").textContent = t(`civilization.readerGuide.checklist.${key}.title`);
      card.querySelector("p").textContent = t(`civilization.readerGuide.checklist.${key}.body`);
      card.querySelector("code").textContent = t(`civilization.readerGuide.checklist.${key}.proof`);
      return card;
    }),
  );
}

function renderTrustJourney() {
  journeyStack?.replaceChildren(
    sectionMiniTitle("civilization.journey.stackTitle"),
    ...journeyTranslations.map((key) => checkCard(t(`civilization.journey.translations.${key}`))),
  );
  journeyGrid?.replaceChildren(
    ...journeySteps.map((step, index) => {
      const card = document.createElement("article");
      card.className = `journey-card ${step.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector("strong").textContent = t(`civilization.journey.steps.${step.id}.title`);
      card.querySelector("p").textContent = t(`civilization.journey.steps.${step.id}.body`);
      card.querySelector("code").textContent = step.proof;
      return card;
    }),
  );
}

function renderBoundaryGrid() {
  civilizationBoundaryGrid?.replaceChildren(
    ...boundaryCards.map((key) => {
      const card = document.createElement("article");
      card.className = `boundary-card ${key}`;
      card.innerHTML = "<span></span><h3></h3><ul></ul>";
      card.querySelector("span").textContent = t(`civilization.boundary.cards.${key}.label`);
      card.querySelector("h3").textContent = t(`civilization.boundary.cards.${key}.title`);
      card.querySelector("ul").replaceChildren(
        ...["one", "two", "three"].map((itemKey) => {
          const item = document.createElement("li");
          item.textContent = t(`civilization.boundary.cards.${key}.items.${itemKey}`);
          return item;
        }),
      );
      return card;
    }),
  );
}

function renderConstitutionChecks() {
  constitutionChecksTarget?.replaceChildren(...constitutionChecks.map((key) => checkCard(t(`civilization.constitution.checks.${key}`))));
}

function renderPowerExplainer() {
  powerSourcesTarget?.replaceChildren(
    sectionMiniTitle("civilization.power.sourcesTitle"),
    ...powerSources.map((key) => powerItem(t(`civilization.power.sources.${key}`), "source")),
  );
  powerGuardsTarget?.replaceChildren(
    sectionMiniTitle("civilization.power.guardsTitle"),
    ...powerGuards.map((key) => powerItem(t(`civilization.power.guards.${key}`), "guard")),
    powerSnapshotCard(),
  );
}

function renderThreatModel() {
  defenseStackTarget?.replaceChildren(
    sectionMiniTitle("civilization.threatModel.defenseTitle"),
    ...defenseStackItems.map((key) => checkCard(t(`civilization.threatModel.defenses.${key}`))),
  );
  threatModelGrid?.replaceChildren(
    ...threatScenarios.map((scenario) => {
      const card = document.createElement("article");
      card.className = `threat-card ${scenario.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = t(`civilization.threatModel.scenarios.${scenario.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.threatModel.scenarios.${scenario.id}.title`);
      card.querySelector("p").textContent = t(`civilization.threatModel.scenarios.${scenario.id}.body`);
      card.querySelector("code").textContent = t(`civilization.threatModel.scenarios.${scenario.id}.proof`);
      return card;
    }),
  );
}

function renderChallengeDesk() {
  challengeStack?.replaceChildren(
    sectionMiniTitle("civilization.challenge.stackTitle"),
    ...challengeChecks.map((key) => checkCard(t(`civilization.challenge.checks.${key}`))),
  );
  challengeGrid?.replaceChildren(
    ...challengeStages.map((stage, index) => {
      const card = document.createElement("article");
      card.className = `challenge-card ${stage.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector("strong").textContent = t(`civilization.challenge.stages.${stage.id}.title`);
      card.querySelector("p").textContent = t(`civilization.challenge.stages.${stage.id}.body`);
      card.querySelector("code").textContent = stage.proof;
      return card;
    }),
  );
}

function renderRuleLifecycleTimeline() {
  timelineTarget?.replaceChildren(
    ...lifecycleSteps.map((step, index) => {
      const article = document.createElement("article");
      article.className = "timeline-step";
      article.innerHTML = `
        <span class="timeline-index"></span>
        <div>
          <h3></h3>
          <p></p>
        </div>
      `;
      article.querySelector(".timeline-index").textContent = String(index + 1).padStart(2, "0");
      article.querySelector("h3").textContent = t(`civilization.lifecycle.steps.${step}.title`);
      article.querySelector("p").textContent = t(`civilization.lifecycle.steps.${step}.body`);
      return article;
    }),
  );
}

function renderRuleBookSchema() {
  schemaTarget?.replaceChildren(
    ...schemaFields.map(([field, type]) => {
      const row = document.createElement("div");
      row.className = "schema-row";
      const fieldNode = document.createElement("code");
      fieldNode.textContent = field;
      const typeNode = document.createElement("span");
      typeNode.textContent = type;
      const description = document.createElement("p");
      description.textContent = t(`civilization.schema.fields.${field}`);
      row.append(fieldNode, typeNode, description);
      return row;
    }),
  );
}

function renderTechnicalAssurances() {
  technicalAssurancesTarget?.replaceChildren(
    ...technicalAssurances.map((key) => {
      const item = document.createElement("article");
      item.className = "technical-assurance";
      item.innerHTML = "<strong></strong><p></p>";
      item.querySelector("strong").textContent = t(`civilization.technical.assurances.${key}.title`);
      item.querySelector("p").textContent = t(`civilization.technical.assurances.${key}.body`);
      return item;
    }),
  );
}

function renderValidatorSpec() {
  patchSchemaPanel?.replaceChildren(
    sectionMiniTitle("civilization.validatorSpec.patchTitle"),
    ...patchFields.map(([field, type]) => {
      const row = document.createElement("div");
      row.className = "patch-schema-row";
      const code = document.createElement("code");
      code.textContent = field;
      const typeNode = document.createElement("span");
      typeNode.textContent = type;
      const description = document.createElement("p");
      description.textContent = t(`civilization.validatorSpec.patchFields.${field}`);
      row.append(code, typeNode, description);
      return row;
    }),
  );
  riskMatrixGrid?.replaceChildren(
    ...riskMatrix.map((risk) => {
      const card = document.createElement("article");
      card.className = `risk-matrix-card ${risk.tone}`;
      card.innerHTML = `
        <span></span>
        <h3></h3>
        <strong></strong>
        <p></p>
      `;
      card.querySelector("span").textContent = t(`civilization.validatorSpec.risk.${risk.id}.label`);
      card.querySelector("h3").textContent = t(`civilization.validatorSpec.risk.${risk.id}.title`);
      card.querySelector("strong").textContent = risk.threshold;
      card.querySelector("p").textContent = t(`civilization.validatorSpec.risk.${risk.id}.body`);
      return card;
    }),
  );
}

function renderModuleBindings() {
  moduleBindingGrid?.replaceChildren(
    ...moduleBindings.map((binding) => {
      const card = document.createElement("article");
      card.className = `module-binding-card ${binding.id}`;
      card.innerHTML = `
        <div class="module-binding-head">
          <span></span>
          <strong></strong>
        </div>
        <p></p>
        <dl></dl>
      `;
      card.querySelector(".module-binding-head span").textContent = t(`civilization.binding.status.${binding.status}`);
      card.querySelector(".module-binding-head strong").textContent = t(`civilization.binding.modules.${binding.id}.title`);
      card.querySelector("p").textContent = t(`civilization.binding.modules.${binding.id}.body`);
      const facts = [
        [t("civilization.binding.labels.account"), binding.account],
        [t("civilization.binding.labels.magic"), binding.magic],
        [t("civilization.binding.labels.seed"), binding.seed],
        [t("civilization.binding.labels.civilizationPath"), t(`civilization.binding.modules.${binding.id}.path`)],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
}

function renderRuleModulesGrid() {
  modulesTarget?.replaceChildren(
    ...targetModules.map((module) => {
      const card = document.createElement("article");
      card.className = "module-card";
      card.innerHTML = `
        <div class="module-icon"></div>
        <h3></h3>
        <p></p>
        <code></code>
      `;
      card.querySelector(".module-icon").textContent = moduleGlyph(module.id);
      card.querySelector("h3").textContent = t(`civilization.modules.items.${module.id}.title`);
      card.querySelector("p").textContent = t(`civilization.modules.items.${module.id}.body`);
      card.querySelector("code").textContent = module.config;
      return card;
    }),
  );
}

function renderSvgDiagrams() {
  civilizationSystemDiagram?.replaceChildren(createSystemDiagram());
  civilizationGlossaryDiagram?.replaceChildren(createGlossaryDiagram());
  civilizationReaderDiagram?.replaceChildren(createReaderGuideDiagram());
  civilizationJourneyDiagram?.replaceChildren(createJourneyDiagram());
  civilizationClassifierDiagram?.replaceChildren(createClassifierDiagram());
  civilizationPowerDiagram?.replaceChildren(createPowerDiagram());
  civilizationThreatDiagram?.replaceChildren(createThreatModelDiagram());
  civilizationChallengeDiagram?.replaceChildren(createChallengeDiagram());
  civilizationCaseDiagram?.replaceChildren(createCaseWalkthroughDiagram());
  civilizationImpactDiagram?.replaceChildren(createImpactDiagram());
  civilizationReputationDiagram?.replaceChildren(createReputationDiagram());
  civilizationExecutionDiagram?.replaceChildren(createExecutionDiagram());
  civilizationValidatorDiagram?.replaceChildren(createValidatorDiagram());
  civilizationTransactionDiagram?.replaceChildren(createTransactionDiagram());
  civilizationTransparencyDiagram?.replaceChildren(createTransparencyDiagram());
  civilizationVersioningDiagram?.replaceChildren(createVersioningDiagram());
  civilizationDesignDiagram?.replaceChildren(createDesignDiagram());
  civilizationCivicDiagram?.replaceChildren(createCivicDiagram());
  civilizationAuditTrailDiagram?.replaceChildren(createAuditTrailDiagram());
  civilizationBindingDiagram?.replaceChildren(createBindingDiagram());
}

function renderVersioningModel() {
  versioningStack?.replaceChildren(
    sectionMiniTitle("civilization.versioning.stackTitle"),
    ...versioningPrinciples.map((key) => checkCard(t(`civilization.versioning.principles.${key}`))),
  );
  versioningGrid?.replaceChildren(
    ...versioningStages.map((stage, index) => {
      const card = document.createElement("article");
      card.className = `versioning-card ${stage.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><dl></dl>";
      card.querySelector("span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector("strong").textContent = t(`civilization.versioning.stages.${stage.id}.title`);
      card.querySelector("p").textContent = t(`civilization.versioning.stages.${stage.id}.body`);
      const facts = [
        [t("civilization.versioning.labels.account"), stage.account],
        [t("civilization.versioning.labels.hash"), stage.hash],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
}

function renderCivilizationDesign() {
  designStack?.replaceChildren(
    sectionMiniTitle("civilization.design.stackTitle"),
    ...designPrinciples.map((key) => checkCard(t(`civilization.design.principles.${key}`))),
  );
  designGrid?.replaceChildren(
    ...designSurfaces.map((surface) => {
      const card = document.createElement("article");
      card.className = `design-card ${surface.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><dl></dl>";
      card.querySelector("span").textContent = t(`civilization.design.surfaces.${surface.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.design.surfaces.${surface.id}.title`);
      card.querySelector("p").textContent = t(`civilization.design.surfaces.${surface.id}.body`);
      const facts = [
        [t("civilization.design.labels.account"), surface.account],
        [t("civilization.design.labels.anchor"), surface.anchor],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
  if (designBlueprintPanel) {
    designBlueprintPanel.innerHTML = "<h3></h3><div></div>";
    designBlueprintPanel.querySelector("h3").textContent = t("civilization.design.blueprintTitle");
    designBlueprintPanel.querySelector("div").replaceChildren(
      ...designBlueprints.map((blueprint, index) => {
        const item = document.createElement("article");
        item.className = "design-blueprint-card";
        item.innerHTML = "<span></span><strong></strong><p></p><code></code>";
        item.querySelector("span").textContent = String(index + 1).padStart(2, "0");
        item.querySelector("strong").textContent = t(`civilization.design.blueprints.${blueprint.id}.title`);
        item.querySelector("p").textContent = t(`civilization.design.blueprints.${blueprint.id}.body`);
        item.querySelector("code").textContent = `${blueprint.instruction} -> ${blueprint.pda}`;
        return item;
      }),
    );
  }
}

function renderCivicWorks() {
  civicStack?.replaceChildren(
    sectionMiniTitle("civilization.civic.stackTitle"),
    ...civicGuarantees.map((key) => checkCard(t(`civilization.civic.guarantees.${key}`))),
  );
  civicGrid?.replaceChildren(
    ...civicSurfaces.map((surface) => {
      const card = document.createElement("article");
      card.className = `civic-card ${surface.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><dl></dl>";
      card.querySelector("span").textContent = t(`civilization.civic.surfaces.${surface.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.civic.surfaces.${surface.id}.title`);
      card.querySelector("p").textContent = t(`civilization.civic.surfaces.${surface.id}.body`);
      const facts = [
        [t("civilization.civic.labels.account"), surface.account],
        [t("civilization.civic.labels.proof"), surface.proof],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
}

function renderRuleClassifier() {
  classifierChecksTarget?.replaceChildren(
    sectionMiniTitle("civilization.classifier.checkTitle"),
    ...classifierChecks.map((key) => checkCard(t(`civilization.classifier.checks.${key}`))),
  );
  classifierGrid?.replaceChildren(
    ...classifierRoutes.map((route) => {
      const card = document.createElement("article");
      card.className = `classifier-card ${route.route}`;
      card.innerHTML = "<span></span><strong></strong><p></p><dl></dl>";
      card.querySelector("span").textContent = t(`civilization.classifier.route.${route.route}`);
      card.querySelector("strong").textContent = t(`civilization.classifier.routes.${route.id}.title`);
      card.querySelector("p").textContent = t(`civilization.classifier.routes.${route.id}.body`);
      const facts = [
        [t("civilization.classifier.labels.threshold"), route.threshold],
        [t("civilization.classifier.labels.proof"), route.proof],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
}

function renderTransparencyConsole() {
  transparencyChecksTarget?.replaceChildren(
    sectionMiniTitle("civilization.transparency.checkTitle"),
    ...transparencyChecks.map((key) => checkCard(t(`civilization.transparency.checks.${key}`))),
  );
  transparencyGrid?.replaceChildren(
    ...transparencySurfaces.map((surface) => {
      const card = document.createElement("article");
      card.className = `transparency-card ${surface.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><dl></dl>";
      card.querySelector("span").textContent = t(`civilization.transparency.surfaces.${surface.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.transparency.surfaces.${surface.id}.title`);
      card.querySelector("p").textContent = t(`civilization.transparency.surfaces.${surface.id}.body`);
      const facts = [
        [t("civilization.transparency.labels.account"), surface.account],
        [t("civilization.transparency.labels.proof"), surface.proof],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
}

function renderCaseWalkthrough() {
  caseSummaryPanel?.replaceChildren(
    sectionMiniTitle("civilization.caseWalkthrough.summaryTitle"),
    ...caseSummaryFacts.map(([key, value]) => {
      const row = document.createElement("div");
      row.className = "case-summary-row";
      const label = document.createElement("span");
      label.textContent = t(`civilization.caseWalkthrough.summary.${key}`);
      const code = document.createElement("code");
      code.textContent = value;
      row.append(label, code);
      return row;
    }),
  );
  caseViewGrid?.replaceChildren(
    ...caseViews.map((view) => {
      const card = document.createElement("article");
      card.className = `case-view-card ${view.tone}`;
      card.innerHTML = "<span></span><h3></h3><p></p><ul></ul>";
      card.querySelector("span").textContent = t(`civilization.caseWalkthrough.views.${view.id}.kicker`);
      card.querySelector("h3").textContent = t(`civilization.caseWalkthrough.views.${view.id}.title`);
      card.querySelector("p").textContent = t(`civilization.caseWalkthrough.views.${view.id}.body`);
      card.querySelector("ul").replaceChildren(
        ...["one", "two", "three"].map((itemKey) => {
          const item = document.createElement("li");
          item.textContent = t(`civilization.caseWalkthrough.views.${view.id}.items.${itemKey}`);
          return item;
        }),
      );
      return card;
    }),
  );
  caseEvidenceGrid?.replaceChildren(
    ...caseEvidence.map((evidence) => {
      const card = document.createElement("article");
      card.className = "case-evidence-card";
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = evidence.label;
      card.querySelector("strong").textContent = t(`civilization.caseWalkthrough.evidence.${evidence.id}.title`);
      card.querySelector("p").textContent = t(`civilization.caseWalkthrough.evidence.${evidence.id}.body`);
      card.querySelector("code").textContent = evidence.value;
      return card;
    }),
  );
}

function renderImpactSimulator() {
  impactStack?.replaceChildren(
    sectionMiniTitle("civilization.impact.stackTitle"),
    ...impactChecks.map((key) => checkCard(t(`civilization.impact.checks.${key}`))),
  );
  impactGrid?.replaceChildren(
    ...impactSurfaces.map((surface) => {
      const card = document.createElement("article");
      card.className = `impact-card ${surface.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = t(`civilization.impact.surfaces.${surface.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.impact.surfaces.${surface.id}.title`);
      card.querySelector("p").textContent = t(`civilization.impact.surfaces.${surface.id}.body`);
      card.querySelector("code").textContent = surface.proof;
      return card;
    }),
  );
}

function renderReputationLedger() {
  reputationStack?.replaceChildren(
    sectionMiniTitle("civilization.reputation.stackTitle"),
    ...reputationGuards.map((key) => checkCard(t(`civilization.reputation.guards.${key}`))),
  );
  reputationGrid?.replaceChildren(
    ...reputationSources.map((source) => {
      const card = document.createElement("article");
      card.className = `reputation-card ${source.id}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = t(`civilization.reputation.sources.${source.id}.label`);
      card.querySelector("strong").textContent = t(`civilization.reputation.sources.${source.id}.title`);
      card.querySelector("p").textContent = t(`civilization.reputation.sources.${source.id}.body`);
      card.querySelector("code").textContent = source.proof;
      return card;
    }),
  );
}

function renderExecutionProof() {
  executionProofStack?.replaceChildren(
    ...executionProofItems.map((key) => {
      const item = document.createElement("article");
      item.className = "proof-card";
      item.innerHTML = "<span></span><strong></strong><p></p>";
      item.querySelector("span").textContent = t(`civilization.executionProof.items.${key}.kicker`);
      item.querySelector("strong").textContent = t(`civilization.executionProof.items.${key}.title`);
      item.querySelector("p").textContent = t(`civilization.executionProof.items.${key}.body`);
      return item;
    }),
  );
  accountBlueprintGrid?.replaceChildren(
    ...accountBlueprints.map((blueprint) => {
      const card = document.createElement("article");
      card.className = "account-blueprint-card";
      card.innerHTML = "<div><span></span><strong></strong></div><p></p><dl></dl>";
      card.querySelector("span").textContent = blueprint.account;
      card.querySelector("strong").textContent = t(`civilization.executionProof.accounts.${blueprint.id}.title`);
      card.querySelector("p").textContent = t(`civilization.executionProof.accounts.${blueprint.id}.body`);
      const facts = [
        [t("civilization.executionProof.labels.seed"), blueprint.seed],
        [t("civilization.executionProof.labels.writer"), blueprint.writer],
        [t("civilization.executionProof.labels.mutability"), blueprint.mutability],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      return card;
    }),
  );
  failureCaseGrid?.replaceChildren(
    ...failureCases.map((failure) => {
      const card = document.createElement("article");
      card.className = `failure-card ${failure.severity}`;
      card.innerHTML = "<span></span><strong></strong><p></p>";
      card.querySelector("span").textContent = t(`civilization.executionProof.severity.${failure.severity}`);
      card.querySelector("strong").textContent = t(`civilization.executionProof.failures.${failure.id}.title`);
      card.querySelector("p").textContent = t(`civilization.executionProof.failures.${failure.id}.body`);
      return card;
    }),
  );
}

function renderBuildSpec() {
  buildSpecGrid?.replaceChildren(
    ...buildSpecGroups.map((group) => {
      const card = document.createElement("article");
      card.className = "build-spec-card";
      card.innerHTML = "<span></span><h3></h3><p></p><ul></ul>";
      card.querySelector("span").textContent = t(`civilization.buildSpec.groups.${group.id}.kicker`);
      card.querySelector("h3").textContent = t(`civilization.buildSpec.groups.${group.id}.title`);
      card.querySelector("p").textContent = t(`civilization.buildSpec.groups.${group.id}.body`);
      card.querySelector("ul").replaceChildren(
        ...group.items.map((item) => {
          const li = document.createElement("li");
          li.textContent = t(`civilization.buildSpec.groups.${group.id}.items.${item}`);
          return li;
        }),
      );
      return card;
    }),
  );
  if (buildOrderPanel) {
    buildOrderPanel.innerHTML = "<h3></h3><div></div>";
    buildOrderPanel.querySelector("h3").textContent = t("civilization.buildSpec.orderTitle");
    buildOrderPanel.querySelector("div").replaceChildren(
      ...buildOrderSteps.map((step, index) => {
        const item = document.createElement("article");
        item.className = "build-order-step";
        item.innerHTML = "<span></span><strong></strong><p></p>";
        item.querySelector("span").textContent = String(index + 1).padStart(2, "0");
        item.querySelector("strong").textContent = t(`civilization.buildSpec.order.${step}.title`);
        item.querySelector("p").textContent = t(`civilization.buildSpec.order.${step}.body`);
        return item;
      }),
    );
  }
}

function renderImplementationTrace() {
  invariantPanel?.replaceChildren(
    sectionMiniTitle("civilization.implementationTrace.invariantTitle"),
    ...invariants.map((key) => checkCard(t(`civilization.implementationTrace.invariants.${key}`))),
  );
  instructionSpecGrid?.replaceChildren(
    ...instructionSpecs.map((spec) => {
      const card = document.createElement("article");
      card.className = "instruction-card";
      card.innerHTML = "<div><span></span><strong></strong></div><p></p><dl></dl><ul></ul>";
      card.querySelector("span").textContent = t(`civilization.implementationTrace.instructions.${spec.id}.phase`);
      card.querySelector("strong").textContent = t(`civilization.implementationTrace.instructions.${spec.id}.title`);
      card.querySelector("p").textContent = t(`civilization.implementationTrace.instructions.${spec.id}.body`);
      const facts = [
        [t("civilization.implementationTrace.labels.input"), t(`civilization.implementationTrace.instructions.${spec.id}.input`)],
        [t("civilization.implementationTrace.labels.output"), t(`civilization.implementationTrace.instructions.${spec.id}.output`)],
      ];
      card.querySelector("dl").replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = label;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
      card.querySelector("ul").replaceChildren(
        ...spec.accounts.map((account) => {
          const li = document.createElement("li");
          li.textContent = account;
          return li;
        }),
      );
      return card;
    }),
  );
  eventLogGrid?.replaceChildren(
    ...eventSpecs.map((event) => {
      const card = document.createElement("article");
      card.className = `event-card ${event.level}`;
      card.innerHTML = "<span></span><strong></strong><p></p><code></code>";
      card.querySelector("span").textContent = t(`civilization.implementationTrace.events.${event.id}.level`);
      card.querySelector("strong").textContent = t(`civilization.implementationTrace.events.${event.id}.title`);
      card.querySelector("p").textContent = t(`civilization.implementationTrace.events.${event.id}.body`);
      card.querySelector("code").textContent = t(`civilization.implementationTrace.events.${event.id}.payload`);
      return card;
    }),
  );
}

function renderExamples() {
  naturalExamplesTarget?.replaceChildren(...naturalLawExamples.map((key) => exampleCard(t(`civilization.examples.natural.${key}`), "natural")));
  civilizationExamplesTarget?.replaceChildren(...civilizationLawExamples.map((key) => exampleCard(t(`civilization.examples.civilization.${key}`), "civilization")));
}

function createSystemDiagram() {
  const labels = {
    player: t("civilization.diagrams.system.nodes.player"),
    proposal: t("civilization.diagrams.system.nodes.proposal"),
    read: t("civilization.diagrams.system.nodes.read"),
    sign: t("civilization.diagrams.system.nodes.sign"),
    validator: t("civilization.diagrams.system.nodes.validator"),
    config: t("civilization.diagrams.system.nodes.config"),
    gameplay: t("civilization.diagrams.system.nodes.gameplay"),
    world: t("civilization.diagrams.system.nodes.world"),
  };
  const svg = createSvg("0 0 920 420", "civilization-flow-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 420);
  [
    [60, 68, 170, 74, labels.player, "blue"],
    [300, 68, 190, 74, labels.proposal, "green"],
    [590, 68, 250, 74, labels.read, "blue"],
    [105, 260, 190, 74, labels.sign, "gold"],
    [365, 260, 190, 74, labels.validator, "red"],
    [645, 260, 190, 74, labels.config, "green"],
  ].forEach((node) => addSvgNode(svg, ...node));
  addSvgNode(svg, 365, 162, 190, 64, labels.gameplay, "blue");
  addSvgNode(svg, 645, 162, 190, 64, labels.world, "green");
  [
    [230, 105, 300, 105],
    [490, 105, 590, 105],
    [715, 142, 715, 162],
    [645, 194, 555, 194],
    [460, 226, 460, 260],
    [295, 297, 365, 297],
    [555, 297, 645, 297],
    [200, 260, 200, 142],
    [230, 105, 200, 105],
  ].forEach((arrow) => addArrow(svg, markerId, ...arrow));
  addSvgBadge(svg, 328, 148, t("civilization.diagrams.system.badges.hashes"));
  addSvgBadge(svg, 70, 208, t("civilization.diagrams.system.badges.snapshot"));
  addSvgBadge(svg, 566, 328, t("civilization.diagrams.system.badges.pdaWrite"));
  return svg;
}

function createGlossaryDiagram() {
  const svg = createSvg("0 0 920 390", "civilization-flow-svg glossary-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 390);
  const nodes = [
    ["plain", 54, 82, 150, 66, "green"],
    ["term", 276, 82, 150, 66, "blue"],
    ["proof", 498, 82, 164, 66, "gold"],
    ["replay", 734, 82, 132, 66, "green"],
    ["mistake", 276, 238, 150, 62, "red"],
    ["reject", 498, 238, 164, 62, "red"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.glossary.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 204, 115, 276, 115);
  addArrow(svg, markerId, 426, 115, 498, 115);
  addArrow(svg, markerId, 662, 115, 734, 115);
  addArrow(svg, markerId, 350, 148, 350, 238);
  addArrow(svg, markerId, 426, 270, 498, 270);
  addArrow(svg, markerId, 580, 238, 580, 148);
  addSvgBadge(svg, 58, 180, t("civilization.diagrams.glossary.badges.player"));
  addSvgBadge(svg, 268, 180, t("civilization.diagrams.glossary.badges.dictionary"));
  addSvgBadge(svg, 492, 180, t("civilization.diagrams.glossary.badges.account"));
  addSvgBadge(svg, 700, 180, t("civilization.diagrams.glossary.badges.audit"));
  addSvgBadge(svg, 290, 324, t("civilization.diagrams.glossary.badges.noVagueWords"));
  return svg;
}

function createReaderGuideDiagram() {
  const svg = createSvg("0 0 920 380", "civilization-flow-svg reader-guide-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 380);
  const nodes = [
    [46, 72, 154, 66, "plain", "blue"],
    [250, 72, 154, 66, "impact", "green"],
    [454, 72, 154, 66, "evidence", "gold"],
    [658, 72, 154, 66, "decision", "green"],
    [146, 238, 154, 62, "patch", "blue"],
    [370, 238, 154, 62, "validator", "red"],
    [594, 238, 154, 62, "pda", "green"],
  ];
  nodes.forEach(([x, y, width, height, key, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.readerGuide.nodes.${key}`), tone);
  });
  [
    [200, 105, 250, 105],
    [404, 105, 454, 105],
    [608, 105, 658, 105],
    [326, 238, 370, 238],
    [524, 238, 594, 238],
    [454, 138, 446, 238],
    [658, 138, 670, 238],
  ].forEach(([x1, y1, x2, y2]) => addArrow(svg, markerId, x1, y1, x2, y2));
  addSvgBadge(svg, 54, 168, t("civilization.diagrams.readerGuide.badges.beginner"));
  addSvgBadge(svg, 334, 168, t("civilization.diagrams.readerGuide.badges.builder"));
  addSvgBadge(svg, 602, 168, t("civilization.diagrams.readerGuide.badges.auditor"));
  addSvgBadge(svg, 264, 318, t("civilization.diagrams.readerGuide.badges.sameRule"));
  return svg;
}

function createJourneyDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg journey-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["enter", 48, 66, 130, 62, "blue"],
    ["gather", 228, 66, 138, 62, "green"],
    ["craft", 416, 66, 138, 62, "gold"],
    ["settle", 604, 66, 138, 62, "blue"],
    ["propose", 256, 258, 152, 66, "green"],
    ["verify", 512, 258, 152, 66, "red"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.journey.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 178, 97, 228, 97);
  addArrow(svg, markerId, 366, 97, 416, 97);
  addArrow(svg, markerId, 554, 97, 604, 97);
  addArrow(svg, markerId, 672, 128, 408, 258);
  addArrow(svg, markerId, 408, 291, 512, 291);
  addArrow(svg, markerId, 588, 258, 486, 128);
  addSvgBadge(svg, 58, 158, t("civilization.diagrams.journey.badges.play"));
  addSvgBadge(svg, 280, 158, t("civilization.diagrams.journey.badges.proof"));
  addSvgBadge(svg, 500, 158, t("civilization.diagrams.journey.badges.power"));
  addSvgBadge(svg, 246, 348, t("civilization.diagrams.journey.badges.rule"));
  addSvgBadge(svg, 508, 348, t("civilization.diagrams.journey.badges.audit"));
  return svg;
}

function createClassifierDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg classifier-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  addSvgNode(svg, 52, 168, 162, 70, t("civilization.diagrams.classifier.nodes.proposal"), "blue");
  addSvgNode(svg, 294, 158, 170, 90, t("civilization.diagrams.classifier.nodes.classifier"), "gold");
  addSvgNode(svg, 560, 42, 170, 64, t("civilization.diagrams.classifier.nodes.civilization"), "green");
  addSvgNode(svg, 560, 136, 170, 64, t("civilization.diagrams.classifier.nodes.natural"), "red");
  addSvgNode(svg, 560, 230, 170, 64, t("civilization.diagrams.classifier.nodes.reject"), "red");
  addSvgNode(svg, 560, 324, 170, 64, t("civilization.diagrams.classifier.nodes.review"), "blue");
  addSvgNode(svg, 766, 42, 112, 64, t("civilization.diagrams.classifier.nodes.fifty"), "green");
  addSvgNode(svg, 766, 136, 112, 64, t("civilization.diagrams.classifier.nodes.ninety"), "red");
  addSvgNode(svg, 766, 230, 112, 64, t("civilization.diagrams.classifier.nodes.noVote"), "red");
  addArrow(svg, markerId, 214, 203, 294, 203);
  addArrow(svg, markerId, 464, 184, 560, 74);
  addArrow(svg, markerId, 464, 196, 560, 168);
  addArrow(svg, markerId, 464, 210, 560, 262);
  addArrow(svg, markerId, 464, 224, 560, 356);
  addArrow(svg, markerId, 730, 74, 766, 74);
  addArrow(svg, markerId, 730, 168, 766, 168);
  addArrow(svg, markerId, 730, 262, 766, 262);
  addSvgBadge(svg, 58, 268, t("civilization.diagrams.classifier.badges.beforeSign"));
  addSvgBadge(svg, 282, 70, t("civilization.diagrams.classifier.badges.ask"));
  addSvgBadge(svg, 506, 398, t("civilization.diagrams.classifier.badges.noBypass"));
  addSvgBadge(svg, 706, 326, t("civilization.diagrams.classifier.badges.publicReason"));
  return svg;
}

function createPowerDiagram() {
  const svg = createSvg("0 0 920 300", "civilization-flow-svg power-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 300);
  addSvgNode(svg, 48, 70, 190, 86, t("civilization.diagrams.power.nodes.sources"), "green");
  addSvgNode(svg, 282, 70, 190, 86, t("civilization.diagrams.power.nodes.filters"), "gold");
  addSvgNode(svg, 516, 70, 190, 86, t("civilization.diagrams.power.nodes.snapshot"), "blue");
  addSvgNode(svg, 750, 70, 130, 86, t("civilization.diagrams.power.nodes.vote"), "green");
  addArrow(svg, markerId, 238, 113, 282, 113);
  addArrow(svg, markerId, 472, 113, 516, 113);
  addArrow(svg, markerId, 706, 113, 750, 113);
  addSvgBadge(svg, 72, 202, t("civilization.diagrams.power.badges.add"));
  addSvgBadge(svg, 302, 202, t("civilization.diagrams.power.badges.reduce"));
  addSvgBadge(svg, 536, 202, t("civilization.diagrams.power.badges.freeze"));
  addSvgBadge(svg, 730, 202, t("civilization.diagrams.power.badges.sign"));
  return svg;
}

function createThreatModelDiagram() {
  const svg = createSvg("0 0 920 420", "civilization-flow-svg threat-model-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 420);
  addSvgNode(svg, 48, 70, 160, 76, t("civilization.diagrams.threatModel.nodes.badRule"), "red");
  addSvgNode(svg, 280, 46, 150, 58, t("civilization.diagrams.threatModel.nodes.identity"), "blue");
  addSvgNode(svg, 280, 128, 150, 58, t("civilization.diagrams.threatModel.nodes.hash"), "blue");
  addSvgNode(svg, 486, 86, 162, 66, t("civilization.diagrams.threatModel.nodes.validator"), "red");
  addSvgNode(svg, 486, 202, 162, 66, t("civilization.diagrams.threatModel.nodes.challenge"), "gold");
  addSvgNode(svg, 710, 72, 150, 66, t("civilization.diagrams.threatModel.nodes.safeWrite"), "green");
  addSvgNode(svg, 710, 236, 150, 66, t("civilization.diagrams.threatModel.nodes.publicReject"), "red");
  addArrow(svg, markerId, 208, 108, 280, 75);
  addArrow(svg, markerId, 208, 108, 280, 157);
  addArrow(svg, markerId, 430, 75, 486, 112);
  addArrow(svg, markerId, 430, 157, 486, 119);
  addArrow(svg, markerId, 648, 119, 710, 105);
  addArrow(svg, markerId, 567, 152, 567, 202);
  addArrow(svg, markerId, 648, 235, 710, 269);
  addSvgBadge(svg, 54, 180, t("civilization.diagrams.threatModel.badges.untrusted"));
  addSvgBadge(svg, 274, 216, t("civilization.diagrams.threatModel.badges.prove"));
  addSvgBadge(svg, 496, 304, t("civilization.diagrams.threatModel.badges.window"));
  addSvgBadge(svg, 662, 160, t("civilization.diagrams.threatModel.badges.noSilentPath"));
  return svg;
}

function createChallengeDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg challenge-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["suspicion", 52, 74, 150, 66, "red"],
    ["evidence", 264, 48, 160, 64, "gold"],
    ["challenge", 264, 164, 160, 64, "blue"],
    ["pause", 506, 92, 162, 66, "red"],
    ["resolve", 724, 92, 142, 66, "green"],
    ["record", 506, 278, 162, 66, "blue"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.challenge.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 202, 107, 264, 80);
  addArrow(svg, markerId, 202, 107, 264, 196);
  addArrow(svg, markerId, 424, 80, 506, 116);
  addArrow(svg, markerId, 424, 196, 506, 122);
  addArrow(svg, markerId, 668, 125, 724, 125);
  addArrow(svg, markerId, 795, 158, 668, 294);
  addArrow(svg, markerId, 506, 312, 344, 228);
  addSvgBadge(svg, 54, 174, t("civilization.diagrams.challenge.badges.review"));
  addSvgBadge(svg, 246, 282, t("civilization.diagrams.challenge.badges.hash"));
  addSvgBadge(svg, 490, 184, t("civilization.diagrams.challenge.badges.lock"));
  addSvgBadge(svg, 704, 188, t("civilization.diagrams.challenge.badges.verdict"));
  addSvgBadge(svg, 500, 368, t("civilization.diagrams.challenge.badges.replay"));
  return svg;
}

function createCaseWalkthroughDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg case-walkthrough-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["story", 42, 62, 160, 66, "green"],
    ["patch", 252, 62, 160, 66, "blue"],
    ["signatures", 462, 62, 160, 66, "gold"],
    ["validator", 672, 62, 180, 66, "red"],
    ["config", 252, 266, 180, 70, "green"],
    ["event", 492, 266, 160, 70, "blue"],
    ["gameplay", 712, 266, 150, 70, "green"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.caseWalkthrough.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 202, 95, 252, 95);
  addArrow(svg, markerId, 412, 95, 462, 95);
  addArrow(svg, markerId, 622, 95, 672, 95);
  addArrow(svg, markerId, 762, 128, 762, 266);
  addArrow(svg, markerId, 672, 302, 652, 302);
  addArrow(svg, markerId, 492, 302, 432, 302);
  addArrow(svg, markerId, 652, 302, 712, 302);
  addSvgBadge(svg, 50, 176, t("civilization.diagrams.caseWalkthrough.badges.playerPromise"));
  addSvgBadge(svg, 252, 176, t("civilization.diagrams.caseWalkthrough.badges.boundPatch"));
  addSvgBadge(svg, 466, 176, t("civilization.diagrams.caseWalkthrough.badges.snapshot"));
  addSvgBadge(svg, 654, 176, t("civilization.diagrams.caseWalkthrough.badges.gates"));
  addSvgBadge(svg, 296, 360, t("civilization.diagrams.caseWalkthrough.badges.pda"));
  addSvgBadge(svg, 528, 360, t("civilization.diagrams.caseWalkthrough.badges.publicEvent"));
  return svg;
}

function createImpactDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg impact-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["proposal", 54, 82, 150, 66, "blue"],
    ["accounts", 276, 50, 160, 64, "green"],
    ["personal", 276, 164, 160, 64, "gold"],
    ["validator", 524, 82, 170, 70, "red"],
    ["diff", 524, 210, 170, 66, "blue"],
    ["decision", 746, 146, 130, 72, "green"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.impact.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 204, 115, 276, 82);
  addArrow(svg, markerId, 204, 115, 276, 196);
  addArrow(svg, markerId, 436, 82, 524, 116);
  addArrow(svg, markerId, 436, 196, 524, 244);
  addArrow(svg, markerId, 694, 118, 746, 170);
  addArrow(svg, markerId, 694, 244, 746, 194);
  addSvgBadge(svg, 62, 184, t("civilization.diagrams.impact.badges.beforeSign"));
  addSvgBadge(svg, 258, 300, t("civilization.diagrams.impact.badges.readOnly"));
  addSvgBadge(svg, 504, 304, t("civilization.diagrams.impact.badges.dryRun"));
  addSvgBadge(svg, 704, 258, t("civilization.diagrams.impact.badges.choice"));
  return svg;
}

function createReputationDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg reputation-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["actions", 54, 74, 150, 66, "blue"],
    ["receipts", 270, 52, 166, 64, "green"],
    ["guards", 270, 170, 166, 64, "gold"],
    ["snapshot", 518, 74, 170, 68, "blue"],
    ["signature", 736, 74, 130, 68, "green"],
    ["replay", 520, 252, 168, 66, "red"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.reputation.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 204, 106, 270, 84);
  addArrow(svg, markerId, 204, 106, 270, 202);
  addArrow(svg, markerId, 436, 84, 518, 108);
  addArrow(svg, markerId, 436, 202, 518, 118);
  addArrow(svg, markerId, 688, 108, 736, 108);
  addArrow(svg, markerId, 800, 142, 688, 270);
  addArrow(svg, markerId, 520, 286, 436, 202);
  addSvgBadge(svg, 58, 172, t("civilization.diagrams.reputation.badges.provable"));
  addSvgBadge(svg, 248, 286, t("civilization.diagrams.reputation.badges.normalized"));
  addSvgBadge(svg, 500, 172, t("civilization.diagrams.reputation.badges.snapshot"));
  addSvgBadge(svg, 700, 170, t("civilization.diagrams.reputation.badges.bounded"));
  addSvgBadge(svg, 512, 342, t("civilization.diagrams.reputation.badges.replay"));
  return svg;
}

function createExecutionDiagram() {
  const svg = createSvg("0 0 920 360", "civilization-flow-svg execution-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 360);
  addSvgNode(svg, 60, 62, 180, 72, t("civilization.diagrams.execution.nodes.text"), "blue");
  addSvgNode(svg, 60, 222, 180, 72, t("civilization.diagrams.execution.nodes.patch"), "green");
  addSvgNode(svg, 330, 142, 190, 72, t("civilization.diagrams.execution.nodes.signature"), "gold");
  addSvgNode(svg, 610, 62, 220, 72, t("civilization.diagrams.execution.nodes.validator"), "red");
  addSvgNode(svg, 610, 222, 220, 72, t("civilization.diagrams.execution.nodes.registry"), "green");
  addArrow(svg, markerId, 240, 98, 330, 164);
  addArrow(svg, markerId, 240, 258, 330, 192);
  addArrow(svg, markerId, 520, 178, 610, 98);
  addArrow(svg, markerId, 720, 134, 720, 222);
  addSvgBadge(svg, 92, 145, t("civilization.diagrams.execution.badges.bound"));
  addSvgBadge(svg, 332, 232, t("civilization.diagrams.execution.badges.threshold"));
  addSvgBadge(svg, 586, 160, t("civilization.diagrams.execution.badges.reject"));
  return svg;
}

function createValidatorDiagram() {
  const svg = createSvg("0 0 920 330", "civilization-flow-svg validator-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 330);
  const nodes = validatorGates.map((gate, index) => ({
    gate,
    x: 42 + index * 146,
    y: index % 2 === 0 ? 78 : 178,
    tone: gate === "write" ? "green" : gate === "asset" || gate === "conservation" ? "red" : "blue",
  }));
  nodes.forEach((node) => {
    addSvgNode(svg, node.x, node.y, 118, 62, t(`civilization.diagrams.validator.nodes.${node.gate}`), node.tone);
  });
  for (let index = 0; index < nodes.length - 1; index += 1) {
    addArrow(svg, markerId, nodes[index].x + 118, nodes[index].y + 31, nodes[index + 1].x, nodes[index + 1].y + 31);
  }
  addSvgBadge(svg, 58, 28, t("civilization.diagrams.validator.badges.deterministic"));
  addSvgBadge(svg, 360, 260, t("civilization.diagrams.validator.badges.reject"));
  addSvgBadge(svg, 656, 28, t("civilization.diagrams.validator.badges.write"));
  return svg;
}

function createTransactionDiagram() {
  const svg = createSvg("0 0 920 450", "civilization-flow-svg transaction-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 450);
  addSvgNode(svg, 48, 56, 170, 66, t("civilization.diagrams.transaction.nodes.caller"), "blue");
  addSvgNode(svg, 278, 42, 190, 70, t("civilization.diagrams.transaction.nodes.rulebook"), "green");
  addSvgNode(svg, 278, 142, 190, 70, t("civilization.diagrams.transaction.nodes.signatures"), "gold");
  addSvgNode(svg, 278, 242, 190, 70, t("civilization.diagrams.transaction.nodes.citizens"), "blue");
  addSvgNode(svg, 548, 138, 190, 78, t("civilization.diagrams.transaction.nodes.execute"), "red");
  addSvgNode(svg, 548, 286, 190, 70, t("civilization.diagrams.transaction.nodes.reject"), "red");
  addSvgNode(svg, 774, 82, 118, 70, t("civilization.diagrams.transaction.nodes.registry"), "green");
  addSvgNode(svg, 774, 206, 118, 70, t("civilization.diagrams.transaction.nodes.config"), "green");
  addArrow(svg, markerId, 218, 89, 278, 77);
  addArrow(svg, markerId, 468, 77, 548, 164);
  addArrow(svg, markerId, 468, 177, 548, 177);
  addArrow(svg, markerId, 468, 277, 548, 190);
  addArrow(svg, markerId, 643, 216, 643, 286);
  addArrow(svg, markerId, 738, 168, 774, 117);
  addArrow(svg, markerId, 738, 186, 774, 241);
  addSvgBadge(svg, 64, 152, t("civilization.diagrams.transaction.badges.anyone"));
  addSvgBadge(svg, 288, 342, t("civilization.diagrams.transaction.badges.snapshot"));
  addSvgBadge(svg, 538, 72, t("civilization.diagrams.transaction.badges.hashes"));
  addSvgBadge(svg, 554, 376, t("civilization.diagrams.transaction.badges.reason"));
  return svg;
}

function createTransparencyDiagram() {
  const svg = createSvg("0 0 920 460", "civilization-flow-svg transparency-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 460);
  addSvgNode(svg, 50, 64, 170, 68, t("civilization.diagrams.transparency.nodes.claim"), "green");
  addSvgNode(svg, 286, 42, 170, 62, t("civilization.diagrams.transparency.nodes.rule"), "blue");
  addSvgNode(svg, 286, 132, 170, 62, t("civilization.diagrams.transparency.nodes.signatures"), "gold");
  addSvgNode(svg, 286, 222, 170, 62, t("civilization.diagrams.transparency.nodes.config"), "green");
  addSvgNode(svg, 286, 312, 170, 62, t("civilization.diagrams.transparency.nodes.challenge"), "red");
  addSvgNode(svg, 540, 92, 180, 72, t("civilization.diagrams.transparency.nodes.decoder"), "blue");
  addSvgNode(svg, 540, 252, 180, 72, t("civilization.diagrams.transparency.nodes.indexer"), "gold");
  addSvgNode(svg, 764, 176, 120, 70, t("civilization.diagrams.transparency.nodes.player"), "green");
  addArrow(svg, markerId, 220, 98, 286, 73);
  addArrow(svg, markerId, 220, 98, 286, 163);
  addArrow(svg, markerId, 220, 98, 286, 253);
  addArrow(svg, markerId, 220, 98, 286, 343);
  addArrow(svg, markerId, 456, 73, 540, 124);
  addArrow(svg, markerId, 456, 163, 540, 128);
  addArrow(svg, markerId, 456, 253, 540, 288);
  addArrow(svg, markerId, 456, 343, 540, 296);
  addArrow(svg, markerId, 720, 128, 764, 198);
  addArrow(svg, markerId, 720, 288, 764, 224);
  addSvgBadge(svg, 54, 158, t("civilization.diagrams.transparency.badges.noTrust"));
  addSvgBadge(svg, 286, 398, t("civilization.diagrams.transparency.badges.sameAccounts"));
  addSvgBadge(svg, 534, 176, t("civilization.diagrams.transparency.badges.decode"));
  addSvgBadge(svg, 708, 286, t("civilization.diagrams.transparency.badges.shareable"));
  return svg;
}

function createVersioningDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg versioning-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["v1", 50, 74, 150, 70, "blue"],
    ["proposal", 270, 74, 170, 70, "gold"],
    ["compat", 510, 74, 170, 70, "red"],
    ["v2", 740, 74, 130, 70, "green"],
    ["oldAssets", 272, 270, 170, 70, "blue"],
    ["history", 512, 270, 170, 70, "gold"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.versioning.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 200, 109, 270, 109);
  addArrow(svg, markerId, 440, 109, 510, 109);
  addArrow(svg, markerId, 680, 109, 740, 109);
  addArrow(svg, markerId, 595, 144, 420, 270);
  addArrow(svg, markerId, 805, 144, 598, 270);
  addArrow(svg, markerId, 442, 305, 512, 305);
  addSvgBadge(svg, 58, 178, t("civilization.diagrams.versioning.badges.current"));
  addSvgBadge(svg, 260, 178, t("civilization.diagrams.versioning.badges.supersede"));
  addSvgBadge(svg, 506, 178, t("civilization.diagrams.versioning.badges.compat"));
  addSvgBadge(svg, 718, 178, t("civilization.diagrams.versioning.badges.forward"));
  addSvgBadge(svg, 366, 366, t("civilization.diagrams.versioning.badges.replay"));
  return svg;
}

function createDesignDiagram() {
  const svg = createSvg("0 0 920 430", "civilization-flow-svg design-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 430);
  const nodes = [
    ["actions", 44, 60, 148, 64, "blue"],
    ["resources", 244, 60, 150, 64, "gold"],
    ["production", 446, 60, 156, 64, "green"],
    ["settlement", 708, 60, 160, 64, "blue"],
    ["citizen", 116, 250, 156, 64, "green"],
    ["knowledge", 360, 250, 166, 64, "gold"],
    ["rule", 608, 250, 170, 64, "red"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.design.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 192, 92, 244, 92);
  addArrow(svg, markerId, 394, 92, 446, 92);
  addArrow(svg, markerId, 602, 92, 708, 92);
  addArrow(svg, markerId, 200, 124, 170, 250);
  addArrow(svg, markerId, 522, 124, 442, 250);
  addArrow(svg, markerId, 788, 124, 694, 250);
  addArrow(svg, markerId, 272, 282, 360, 282);
  addArrow(svg, markerId, 526, 282, 608, 282);
  addArrow(svg, markerId, 692, 250, 532, 124);
  addSvgBadge(svg, 64, 158, t("civilization.diagrams.design.badges.play"));
  addSvgBadge(svg, 276, 158, t("civilization.diagrams.design.badges.material"));
  addSvgBadge(svg, 500, 158, t("civilization.diagrams.design.badges.build"));
  addSvgBadge(svg, 648, 350, t("civilization.diagrams.design.badges.law"));
  addSvgBadge(svg, 236, 350, t("civilization.diagrams.design.badges.pda"));
  return svg;
}

function createCivicDiagram() {
  const svg = createSvg("0 0 920 450", "civilization-flow-svg civic-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 450);
  const nodes = [
    ["settlement", 64, 74, 160, 68, "blue"],
    ["contribute", 294, 48, 170, 64, "green"],
    ["guardian", 294, 146, 170, 64, "gold"],
    ["rule", 534, 96, 170, 70, "red"],
    ["project", 350, 286, 178, 70, "green"],
    ["benefit", 642, 286, 170, 70, "blue"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.civic.nodes.${key}`), tone);
  });
  addArrow(svg, markerId, 224, 108, 294, 80);
  addArrow(svg, markerId, 224, 108, 294, 178);
  addArrow(svg, markerId, 464, 80, 534, 126);
  addArrow(svg, markerId, 464, 178, 534, 130);
  addArrow(svg, markerId, 620, 166, 456, 286);
  addArrow(svg, markerId, 528, 321, 642, 321);
  addArrow(svg, markerId, 726, 286, 662, 166);
  addArrow(svg, markerId, 350, 321, 144, 142);
  addSvgBadge(svg, 56, 184, t("civilization.diagrams.civic.badges.charter"));
  addSvgBadge(svg, 270, 226, t("civilization.diagrams.civic.badges.receipts"));
  addSvgBadge(svg, 520, 190, t("civilization.diagrams.civic.badges.authorized"));
  addSvgBadge(svg, 338, 378, t("civilization.diagrams.civic.badges.milestone"));
  addSvgBadge(svg, 640, 378, t("civilization.diagrams.civic.badges.visible"));
  return svg;
}

function createAuditTrailDiagram() {
  const svg = createSvg("0 0 920 390", "civilization-flow-svg audit-trail-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 390);
  const nodes = [
    ["publish", 48, 60, 140, 62, "blue"],
    ["sign", 228, 60, 140, 62, "gold"],
    ["finalize", 408, 60, 140, 62, "green"],
    ["challenge", 588, 60, 140, 62, "red"],
    ["execute", 768, 60, 120, 62, "green"],
  ];
  nodes.forEach(([key, x, y, width, height, tone]) => {
    addSvgNode(svg, x, y, width, height, t(`civilization.diagrams.auditTrail.nodes.${key}`), tone);
  });
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const [, x, y, width, height] = nodes[index];
    const [, nextX, nextY] = nodes[index + 1];
    addArrow(svg, markerId, x + width, y + height / 2, nextX, nextY + height / 2);
  }
  addSvgNode(svg, 138, 230, 170, 62, t("civilization.diagrams.auditTrail.nodes.eventLog"), "blue");
  addSvgNode(svg, 374, 230, 170, 62, t("civilization.diagrams.auditTrail.nodes.indexer"), "gold");
  addSvgNode(svg, 610, 230, 170, 62, t("civilization.diagrams.auditTrail.nodes.browser"), "green");
  addArrow(svg, markerId, 458, 122, 458, 230);
  addArrow(svg, markerId, 308, 261, 374, 261);
  addArrow(svg, markerId, 544, 261, 610, 261);
  addSvgBadge(svg, 58, 154, t("civilization.diagrams.auditTrail.badges.hashes"));
  addSvgBadge(svg, 324, 154, t("civilization.diagrams.auditTrail.badges.replay"));
  addSvgBadge(svg, 600, 154, t("civilization.diagrams.auditTrail.badges.public"));
  return svg;
}

function createBindingDiagram() {
  const svg = createSvg("0 0 920 470", "civilization-flow-svg binding-svg");
  const markerId = addDefs(svg);
  addGrid(svg, 920, 470);
  addSvgNode(svg, 54, 76, 190, 78, t("civilization.diagrams.binding.nodes.rulebook"), "green");
  addSvgNode(svg, 54, 264, 190, 78, t("civilization.diagrams.binding.nodes.validator"), "red");
  addSvgNode(svg, 338, 170, 220, 90, t("civilization.diagrams.binding.nodes.registry"), "gold");
  addArrow(svg, markerId, 149, 154, 149, 264);
  addArrow(svg, markerId, 244, 303, 338, 220);
  const targets = [
    ["core", 650, 42],
    ["chunk", 650, 112],
    ["backpack", 650, 182],
    ["smelting", 650, 252],
    ["guardian", 650, 322],
    ["market", 650, 392],
  ];
  targets.forEach(([key, x, y]) => {
    addSvgNode(svg, x, y, 210, 52, t(`civilization.diagrams.binding.nodes.${key}`), key === "backpack" ? "blue" : "green");
    addArrow(svg, markerId, 558, 215, x, y + 26);
  });
  addSvgBadge(svg, 66, 178, t("civilization.diagrams.binding.badges.safety"));
  addSvgBadge(svg, 306, 284, t("civilization.diagrams.binding.badges.versioned"));
  addSvgBadge(svg, 622, 12, t("civilization.diagrams.binding.badges.public"));
  return svg;
}

function renderExecutionModelSection() {
  executionStackTarget?.replaceChildren(
    ...["ruleValidator", "registryWrite", "permissionlessCaller", "fixedCoreContracts"].map((key) => {
      const item = document.createElement("article");
      item.className = "execution-item";
      item.innerHTML = "<strong></strong><p></p>";
      item.querySelector("strong").textContent = t(`civilization.execution.items.${key}.title`);
      item.querySelector("p").textContent = t(`civilization.execution.items.${key}.body`);
      return item;
    }),
  );
}

function renderMockRuleBooks() {
  mockRuleBooksTarget?.replaceChildren(...mockRuleBooks.map(renderRuleBookCard));
}

function renderRuleBookCard(rule) {
  const yesPercent = supportPercent(rule);
  const thresholdMet = yesPercent >= rule.threshold;
  const card = document.createElement("article");
  card.className = `rule-book-card ${rule.lawType} ${rule.status}`;
  card.innerHTML = `
    <div class="rule-book-top">
      <span class="rule-kind"></span>
      <span class="rule-status"></span>
    </div>
    <h3></h3>
    <p class="rule-module-line"></p>
    <div class="rule-progress" aria-hidden="true"><span></span></div>
    <div class="rule-metrics"></div>
    <div class="rule-hashes"></div>
    <div class="rule-actions"></div>
  `;
  card.querySelector(".rule-kind").textContent = t(`civilization.lawType.${rule.lawType}`);
  card.querySelector(".rule-status").textContent = t(`civilization.status.${rule.status}`);
  card.querySelector("h3").textContent = t(rule.titleKey);
  card.querySelector(".rule-module-line").textContent = rule.targetModules.map((module) => t(`civilization.modules.short.${module}`)).join(" + ");
  card.querySelector(".rule-progress span").style.width = `${Math.min(100, yesPercent)}%`;
  card.querySelector(".rule-progress").classList.toggle("met", thresholdMet);
  card.querySelector(".rule-metrics").replaceChildren(
    metricCard(`${yesPercent}%`, t("civilization.mock.yesPower")),
    metricCard(`${rule.threshold}%`, t("civilization.mock.threshold")),
    metricCard(riskLabel(rule.riskLevel), t("civilization.mock.risk")),
    metricCard(String(rule.snapshotEpoch), t("civilization.mock.epoch")),
  );
  card.querySelector(".rule-hashes").replaceChildren(
    hashRow("text_hash", rule.textHash),
    hashRow("patch_hash", rule.patchHash),
    hashRow("author", rule.author),
    hashRow("execute_status", rule.executeStatus),
  );
  card.querySelector(".rule-actions").replaceChildren(
    actionButton("civilization.actions.read"),
    actionButton("civilization.actions.signAgree"),
    actionButton("civilization.actions.signReject"),
    actionButton("civilization.actions.execute", rule.status !== "ready"),
  );
  return card;
}

function renderFutureContractDirection() {
  const accountList = document.createElement("article");
  accountList.className = "contract-card";
  accountList.innerHTML = "<h3></h3><div class='contract-token-list'></div>";
  accountList.querySelector("h3").textContent = t("civilization.contract.accountsTitle");
  accountList.querySelector(".contract-token-list").replaceChildren(...contractAccounts.map((account) => codeToken(account)));

  const validatorList = document.createElement("article");
  validatorList.className = "contract-card validator-card";
  validatorList.innerHTML = "<h3></h3><div></div>";
  validatorList.querySelector("h3").textContent = t("civilization.contract.validatorTitle");
  validatorList.querySelector("div").replaceChildren(...validatorRules.map((key) => checkCard(t(`civilization.contract.validator.${key}`))));

  contractDirectionTarget?.replaceChildren(accountList, validatorList);
}

function createSvg(viewBox, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-label", t("civilization.diagrams.aria"));
  return svg;
}

function addDefs(svg) {
  svgMarkerCounter += 1;
  const markerId = `civArrow${svgMarkerCounter}`;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="svg-arrow-head"></path>
    </marker>
  `;
  svg.append(defs);
  return markerId;
}

function addGrid(svg, width, height) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "svg-grid-lines");
  for (let x = 40; x < width; x += 80) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("x2", String(x));
    line.setAttribute("y1", "0");
    line.setAttribute("y2", String(height));
    group.append(line);
  }
  for (let y = 40; y < height; y += 80) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", String(width));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    group.append(line);
  }
  svg.append(group);
}

function addSvgNode(svg, x, y, width, height, label, tone) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", `svg-node ${tone}`);
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "8");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x + width / 2));
  text.setAttribute("y", String(y + height / 2 + 5));
  text.setAttribute("text-anchor", "middle");
  text.textContent = label;
  group.append(rect, text);
  svg.append(group);
}

function addSvgBadge(svg, x, y, label) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "svg-badge");
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const width = Math.min(230, Math.max(92, label.length * 8));
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", "30");
  rect.setAttribute("rx", "15");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x + width / 2));
  text.setAttribute("y", String(y + 20));
  text.setAttribute("text-anchor", "middle");
  text.textContent = label;
  group.append(rect, text);
  svg.append(group);
}

function addArrow(svg, markerId, x1, y1, x2, y2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "svg-arrow");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.setAttribute("marker-end", `url(#${markerId})`);
  svg.append(line);
}

function metricCard(value, label) {
  const card = document.createElement("article");
  card.className = "metric-card";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function pill(text) {
  const item = document.createElement("span");
  item.className = "info-pill";
  item.textContent = text;
  return item;
}

function checkCard(text) {
  const item = document.createElement("article");
  item.className = "check-card";
  item.textContent = text;
  return item;
}

function sectionMiniTitle(key) {
  const title = document.createElement("h3");
  title.className = "mini-title";
  title.textContent = t(key);
  return title;
}

function powerItem(text, type) {
  const item = document.createElement("article");
  item.className = `power-item ${type}`;
  item.textContent = text;
  return item;
}

function powerSnapshotCard() {
  const card = document.createElement("article");
  card.className = "power-snapshot";
  card.replaceChildren(
    metricCard(formatCompact(powerSnapshot.totalPower), t("civilization.power.snapshot.total")),
    metricCard(`${Math.round(powerSnapshot.matureCitizenRatio * 100)}%`, t("civilization.power.snapshot.mature")),
  );
  return card;
}

function exampleCard(text, type) {
  const item = document.createElement("article");
  item.className = `example-card ${type}`;
  item.textContent = text;
  return item;
}

function actionButton(key, disabled = true) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rule-action-button";
  button.textContent = t(key);
  button.disabled = disabled;
  button.title = t("civilization.actions.comingSoon");
  if (!disabled) button.addEventListener("click", showComingSoon);
  return button;
}

function hashRow(label, value) {
  const row = document.createElement("div");
  row.className = "hash-row";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("code");
  valueNode.textContent = value;
  row.append(labelNode, valueNode);
  return row;
}

function codeToken(value) {
  const token = document.createElement("code");
  token.className = "code-token";
  token.textContent = value;
  return token;
}

function supportPercent(rule) {
  const total = rule.yesPower + rule.noPower + rule.abstainPower;
  if (!total) return 0;
  return Math.round((rule.yesPower / total) * 100);
}

function riskLabel(riskLevel) {
  return t(`civilization.risk.${riskLevel}`);
}

function moduleGlyph(module) {
  const glyphs = {
    smelting: "SM",
    forging: "FG",
    block_properties: "BL",
    resource_rules: "RS",
    element_rules: "EL",
    world_knowledge: "WK",
  };
  return glyphs[module] ?? "NC";
}

function formatCompact(value) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function showComingSoon() {
  if (!toast) return;
  toast.textContent = t("civilization.actions.comingSoon");
  toast.classList.add("visible");
  window.clearTimeout(showComingSoon.timer);
  showComingSoon.timer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}
