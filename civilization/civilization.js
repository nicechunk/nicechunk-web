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

const constitutionChecks = [
  "higherRisk",
  "longerCooldown",
  "stricterValidation",
  "strongerPrompt",
  "widerChallenge",
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
const lawLayerCards = document.querySelector("#lawLayerCards");
const constitutionChecksTarget = document.querySelector("#constitutionChecks");
const powerSourcesTarget = document.querySelector("#powerSources");
const powerGuardsTarget = document.querySelector("#powerGuards");
const timelineTarget = document.querySelector("#ruleLifecycleTimeline");
const schemaTarget = document.querySelector("#ruleBookSchema");
const modulesTarget = document.querySelector("#ruleModulesGrid");
const naturalExamplesTarget = document.querySelector("#naturalLawExamples");
const civilizationExamplesTarget = document.querySelector("#civilizationLawExamples");
const executionStackTarget = document.querySelector("#executionStack");
const mockRuleBooksTarget = document.querySelector("#mockRuleBooks");
const contractDirectionTarget = document.querySelector("#futureContractDirection");
const toast = document.querySelector("#comingSoonToast");

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
  renderLawLayerCards();
  renderConstitutionChecks();
  renderPowerExplainer();
  renderRuleLifecycleTimeline();
  renderRuleBookSchema();
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

function renderExamples() {
  naturalExamplesTarget?.replaceChildren(...naturalLawExamples.map((key) => exampleCard(t(`civilization.examples.natural.${key}`), "natural")));
  civilizationExamplesTarget?.replaceChildren(...civilizationLawExamples.map((key) => exampleCard(t(`civilization.examples.civilization.${key}`), "civilization")));
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
