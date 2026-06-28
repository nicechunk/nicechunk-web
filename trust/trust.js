import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import enDictionary from "./locales/en.json";

const languageStorageKey = "nicechunk.language";
const plannedLanguages = [
  { code: "en", englishName: "English", nativeName: "English", enabled: true },
  { code: "es", englishName: "Spanish", nativeName: "Español", enabled: true },
  { code: "fr", englishName: "French", nativeName: "Français", enabled: true },
  { code: "de", englishName: "German", nativeName: "Deutsch", enabled: true },
  { code: "ja", englishName: "Japanese", nativeName: "Japanese", enabled: true },
  { code: "ru", englishName: "Russian", nativeName: "Русский", enabled: true },
  { code: "ko", englishName: "Korean", nativeName: "한국어", enabled: true },
  { code: "zh-Hant", englishName: "Traditional Chinese", nativeName: "Traditional Chinese", enabled: true },
  { code: "zh-Hans", englishName: "Simplified Chinese", nativeName: "Simplified Chinese", enabled: true },
];
const languageCodes = new Set(plannedLanguages.map((language) => language.code));
const dictionaryCache = new Map([["en", enDictionary]]);

const backdropCanvas = document.querySelector("#trustBackdrop");
const coreCanvas = document.querySelector("#trustCoreCanvas");
const principleGrid = document.querySelector("#principleGrid");
const architectureMap = document.querySelector("#architectureMap");
const verificationGrid = document.querySelector("#verificationGrid");
const evidenceGrid = document.querySelector("#evidenceGrid");
const packageGrid = document.querySelector("#packageGrid");
const packetGrid = document.querySelector("#packetGrid");
const artifactGrid = document.querySelector("#artifactGrid");
const protocolRegistry = document.querySelector("#protocolRegistry");
const deploymentLedger = document.querySelector("#deploymentLedger");
const decoderLedger = document.querySelector("#decoderLedger");
const methodologyGrid = document.querySelector("#methodologyGrid");
const scopeMatrix = document.querySelector("#scopeMatrix");
const threatModel = document.querySelector("#threatModel");
const invariantLedger = document.querySelector("#invariantLedger");
const recipeGrid = document.querySelector("#recipeGrid");
const adversarialMatrix = document.querySelector("#adversarialMatrix");
const formalModel = document.querySelector("#formalModel");
const notationGrid = document.querySelector("#notationGrid");
const lifecycleMap = document.querySelector("#lifecycleMap");
const commitmentGrid = document.querySelector("#commitmentGrid");
const availabilityGrid = document.querySelector("#availabilityGrid");
const economicGrid = document.querySelector("#economicGrid");
const routeGrid = document.querySelector("#routeGrid");
const claimLedger = document.querySelector("#claimLedger");
const maturityLedger = document.querySelector("#maturityLedger");
const upgradeGrid = document.querySelector("#upgradeGrid");
const boundaryTable = document.querySelector("#boundaryTable");
const riskTable = document.querySelector("#riskTable");
const questionGrid = document.querySelector("#questionGrid");
const checklistGrid = document.querySelector("#checklistGrid");
const reviewerGrid = document.querySelector("#reviewerGrid");
const nextStack = document.querySelector("#nextStack");
const languagePicker = document.querySelector(".trust-language");
const languageTrigger = document.querySelector(".trust-language-trigger");
const languageCurrent = document.querySelector(".trust-language-current");
const languageMenu = document.querySelector(".trust-language-menu");

let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || "en";
let dictionary = enDictionary;
let languageLoadToken = 0;

initTrustPage();

async function initTrustPage() {
  setSiteLoadingProgress(34);
  dictionary = await loadDictionary(activeLanguage);
  applyTranslations(document);
  setupLanguageSwitcher();
  renderPrinciples();
  renderArchitecture();
  renderVerification();
  renderEvidence();
  renderPackage();
  renderPacket();
  renderArtifacts();
  renderProtocolRegistry();
  renderDeployment();
  renderDecoderEvidence();
  renderMethodology();
  renderScopeMatrix();
  renderThreatModel();
  renderInvariants();
  renderRecipes();
  renderAdversarial();
  renderFormalModel();
  renderNotation();
  renderLifecycle();
  renderCommitments();
  renderAvailability();
  renderEconomics();
  renderRoutes();
  renderClaims();
  renderMaturity();
  renderUpgrade();
  renderBoundaries();
  renderRisks();
  renderQuestions();
  renderChecklist();
  renderReviewers();
  renderNextWork();
  setupBackdrop(backdropCanvas);
  setupCoreAnimation(coreCanvas);
  setSiteLoadingProgress(88);
  finishSiteLoading();
}

function applyTranslations(root) {
  const title = text("meta.title");
  if (title) document.title = title;

  root.querySelectorAll("[data-trust-i18n]").forEach((element) => {
    const value = text(element.dataset.trustI18n);
    if (value) element.textContent = value;
  });

  root.querySelectorAll("[data-trust-i18n-aria-label]").forEach((element) => {
    const value = text(element.dataset.trustI18nAriaLabel);
    if (value) element.setAttribute("aria-label", value);
  });

  document.documentElement.lang = activeLanguage;
}

function text(path) {
  const value = path.split(".").reduce((current, part) => (current && Object.hasOwn(current, part) ? current[part] : undefined), dictionary);
  if (value !== undefined) return value;
  return path.split(".").reduce((current, part) => (current && Object.hasOwn(current, part) ? current[part] : undefined), enDictionary) ?? "";
}

function setupLanguageSwitcher() {
  renderLanguageMenu();
  updateLanguagePicker();
  languageTrigger?.addEventListener("click", () => {
    setLanguageMenuOpen(!languagePicker?.classList.contains("open"));
  });
  document.addEventListener("click", (event) => {
    if (!languagePicker?.contains(event.target)) setLanguageMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLanguageMenuOpen(false);
  });
}

function renderLanguageMenu() {
  if (!languageMenu) return;
  languageMenu.replaceChildren(
    ...plannedLanguages.map((language) => {
      const option = document.createElement("button");
      option.className = "language-option";
      option.type = "button";
      option.role = "option";
      option.dataset.trustLanguage = language.code;
      option.disabled = !language.enabled;
      option.innerHTML = `
        <span class="language-option-name"></span>
        <span class="language-option-native"></span>
        <span class="language-option-status"></span>
      `;
      option.querySelector(".language-option-name").textContent = language.englishName;
      option.querySelector(".language-option-native").textContent = `(${language.nativeName})`;
      option.querySelector(".language-option-status").textContent = language.enabled ? "" : "Planned";
      option.addEventListener("click", async () => {
        const nextLanguage = normalizeLanguage(option.dataset.trustLanguage);
        if (!nextLanguage || nextLanguage === activeLanguage) {
          setLanguageMenuOpen(false);
          return;
        }
        const token = ++languageLoadToken;
        setSiteLoadingProgress(42);
        activeLanguage = nextLanguage;
        dictionary = await loadDictionary(activeLanguage);
        if (token !== languageLoadToken) return;
        localStorage.setItem(languageStorageKey, activeLanguage);
        applyTranslations(document);
        renderPrinciples();
        renderArchitecture();
        renderVerification();
        renderEvidence();
        renderPackage();
        renderPacket();
        renderArtifacts();
        renderProtocolRegistry();
        renderDeployment();
        renderDecoderEvidence();
        renderMethodology();
        renderScopeMatrix();
        renderThreatModel();
        renderInvariants();
        renderRecipes();
        renderAdversarial();
        renderFormalModel();
        renderNotation();
        renderLifecycle();
        renderCommitments();
        renderAvailability();
        renderEconomics();
        renderRoutes();
        renderClaims();
        renderMaturity();
        renderUpgrade();
        renderBoundaries();
        renderRisks();
        renderQuestions();
        renderChecklist();
        renderReviewers();
        renderNextWork();
        updateLanguagePicker();
        setLanguageMenuOpen(false);
        setSiteLoadingProgress(92);
        finishSiteLoading();
      });
      return option;
    }),
  );
}

function updateLanguagePicker() {
  const active = plannedLanguages.find((language) => language.code === activeLanguage) ?? plannedLanguages[0];
  if (languageCurrent) languageCurrent.textContent = `${active.englishName} (${active.nativeName})`;
  languagePicker?.setAttribute("data-i18n-ready", "true");
  languageMenu?.querySelectorAll(".language-option").forEach((option) => {
    const selected = option.dataset.trustLanguage === activeLanguage;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setLanguageMenuOpen(open) {
  languagePicker?.classList.toggle("open", open);
  languageTrigger?.setAttribute("aria-expanded", String(open));
}

function renderPrinciples() {
  if (!principleGrid) return;
  principleGrid.replaceChildren(
    ...arrayText("principles").map((item, index) => {
      const card = document.createElement("article");
      card.className = "trust-principle-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
      `;
      card.children[0].textContent = String(index + 1).padStart(2, "0");
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      return card;
    }),
  );
}

function renderArchitecture() {
  if (!architectureMap) return;
  architectureMap.replaceChildren(
    ...arrayText("architecture.layers").map((layer, index) => {
      const card = document.createElement("article");
      card.className = "architecture-layer";
      card.innerHTML = `
        <div>
          <span></span>
          <strong></strong>
          <p></p>
        </div>
        <ul></ul>
      `;
      card.querySelector("span").textContent = `L${index + 1}`;
      card.querySelector("strong").textContent = layer.title;
      card.querySelector("p").textContent = layer.body;
      const list = card.querySelector("ul");
      list.replaceChildren(...(layer.points || []).map((point) => {
        const item = document.createElement("li");
        item.textContent = point;
        return item;
      }));
      return card;
    }),
  );
}

function renderVerification() {
  if (!verificationGrid) return;
  verificationGrid.replaceChildren(
    ...arrayText("verification.steps").map((step, index) => {
      const card = document.createElement("article");
      card.className = "verification-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = String(index + 1).padStart(2, "0");
      card.children[1].textContent = step.title;
      card.children[2].textContent = step.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("verification.labels.reviewerCheck") || "Reviewer check";
      entries[0].querySelector("dd").textContent = step.check;
      entries[1].querySelector("dt").textContent = text("verification.labels.currentEvidence") || "Current evidence";
      entries[1].querySelector("dd").textContent = step.evidence;
      return card;
    }),
  );
}

function renderEvidence() {
  if (!evidenceGrid) return;
  evidenceGrid.replaceChildren(
    ...arrayText("evidence.items").map((item) => {
      const card = document.createElement("a");
      card.className = "evidence-card";
      card.href = item.href;
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <em></em>
      `;
      card.children[0].textContent = item.kind;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      card.children[3].textContent = item.cta;
      return card;
    }),
  );
}

function renderPackage() {
  if (!packageGrid) return;
  packageGrid.replaceChildren(
    ...arrayText("package.items").map((item) => {
      const card = document.createElement("article");
      card.className = "package-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("package.labels.current") || "Current artifact";
      entries[0].querySelector("dd").textContent = item.current;
      entries[1].querySelector("dt").textContent = text("package.labels.reviewerUse") || "Reviewer use";
      entries[1].querySelector("dd").textContent = item.reviewerUse;
      entries[2].querySelector("dt").textContent = text("package.labels.next") || "Next hardening";
      entries[2].querySelector("dd").textContent = item.next;
      return card;
    }),
  );
}

function renderPacket() {
  if (!packetGrid) return;
  packetGrid.replaceChildren(
    ...arrayText("packet.items").map((item) => {
      const card = document.createElement("article");
      card.className = "packet-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
        <div class="packet-files"></div>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("packet.labels.purpose") || "Purpose";
      entries[0].querySelector("dd").textContent = item.purpose;
      entries[1].querySelector("dt").textContent = text("packet.labels.proof") || "Proof target";
      entries[1].querySelector("dd").textContent = item.proof;
      const files = card.querySelector(".packet-files");
      files.dataset.label = text("packet.labels.files") || "Packet files";
      files.replaceChildren(...(item.files || []).map((file) => {
        const tag = document.createElement("code");
        tag.textContent = file;
        return tag;
      }));
      return card;
    }),
  );
}

function renderArtifacts() {
  if (!artifactGrid) return;
  artifactGrid.replaceChildren(
    ...arrayText("artifacts.groups").map((group) => {
      const card = document.createElement("article");
      card.className = "artifact-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <div class="artifact-paths"></div>
      `;
      card.children[0].textContent = group.status;
      card.children[1].textContent = group.title;
      card.children[2].textContent = group.body;
      const paths = card.querySelector(".artifact-paths");
      paths.replaceChildren(...(group.paths || []).map((entry) => {
        const item = document.createElement("div");
        item.className = "artifact-path";
        item.innerHTML = `
          <code></code>
          <em></em>
        `;
        item.children[0].textContent = entry.path;
        item.children[1].textContent = entry.note;
        return item;
      }));
      return card;
    }),
  );
}

function renderProtocolRegistry() {
  if (!protocolRegistry) return;
  protocolRegistry.replaceChildren(
    ...arrayText("registry.programs").map((program) => {
      const card = document.createElement("article");
      card.className = "protocol-card";
      card.innerHTML = `
        <div class="protocol-card-header">
          <span></span>
          <strong></strong>
        </div>
        <p></p>
        <dl class="protocol-fields">
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
        <div class="protocol-review"></div>
      `;
      card.querySelector(".protocol-card-header span").textContent = program.status;
      card.querySelector(".protocol-card-header strong").textContent = program.title;
      card.children[1].textContent = program.body;
      const entries = card.querySelectorAll(".protocol-fields div");
      entries[0].querySelector("dt").textContent = text("registry.labels.programId") || "Program ID";
      entries[0].querySelector("dd").textContent = program.programId;
      entries[1].querySelector("dt").textContent = text("registry.labels.pdaSeeds") || "PDA seeds";
      entries[1].querySelector("dd").textContent = program.seeds;
      entries[2].querySelector("dt").textContent = text("registry.labels.accounts") || "Accounts";
      entries[2].querySelector("dd").textContent = program.accounts;
      entries[3].querySelector("dt").textContent = text("registry.labels.version") || "Version / size";
      entries[3].querySelector("dd").textContent = program.version;
      const review = card.querySelector(".protocol-review");
      review.dataset.label = text("registry.labels.reviewFocus") || "Review focus";
      review.textContent = program.reviewFocus;
      return card;
    }),
  );
}

function renderDeployment() {
  if (!deploymentLedger) return;
  deploymentLedger.replaceChildren(
    ...arrayText("deployment.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "deployment-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <code></code>
        <p class="deployment-visible"></p>
        <p class="deployment-missing"></p>
      `;
      item.children[0].textContent = row.domain;
      item.children[1].textContent = row.title;
      item.children[2].textContent = row.programId;
      item.children[3].dataset.label = text("deployment.labels.visible") || "Visible evidence";
      item.children[3].textContent = row.visible;
      item.children[4].dataset.label = text("deployment.labels.missing") || "Still needed";
      item.children[4].textContent = row.missing;
      return item;
    }),
  );
}

function renderDecoderEvidence() {
  if (!decoderLedger) return;
  decoderLedger.replaceChildren(
    ...arrayText("decoder.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "decoder-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="decoder-layout"></p>
        <p class="decoder-checks"></p>
        <p class="decoder-use"></p>
      `;
      item.children[0].textContent = row.domain;
      item.children[1].textContent = row.title;
      item.children[2].dataset.label = text("decoder.labels.layout") || "Layout";
      item.children[2].textContent = row.layout;
      item.children[3].dataset.label = text("decoder.labels.firstChecks") || "First checks";
      item.children[3].textContent = row.checks;
      item.children[4].dataset.label = text("decoder.labels.reviewUse") || "Reviewer use";
      item.children[4].textContent = row.use;
      return item;
    }),
  );
}

function renderMethodology() {
  if (!methodologyGrid) return;
  methodologyGrid.replaceChildren(
    ...arrayText("methodology.steps").map((step, index) => {
      const card = document.createElement("article");
      card.className = "methodology-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = String(index + 1).padStart(2, "0");
      card.children[1].textContent = step.title;
      card.children[2].textContent = step.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("methodology.labels.artifact") || "Artifact";
      entries[0].querySelector("dd").textContent = step.artifact;
      entries[1].querySelector("dt").textContent = text("methodology.labels.failureMode") || "Failure mode";
      entries[1].querySelector("dd").textContent = step.failureMode;
      return card;
    }),
  );
}

function renderScopeMatrix() {
  if (!scopeMatrix) return;
  scopeMatrix.replaceChildren(
    ...arrayText("scope.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "scope-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="scope-current"></p>
        <p class="scope-excluded"></p>
        <p class="scope-evidence"></p>
      `;
      item.children[0].textContent = row.status;
      item.children[1].textContent = row.title;
      item.children[2].dataset.label = text("scope.labels.current") || "Current surface";
      item.children[2].textContent = row.current;
      item.children[3].dataset.label = text("scope.labels.excluded") || "Excluded assumptions";
      item.children[3].textContent = row.excluded;
      item.children[4].dataset.label = text("scope.labels.evidence") || "Required evidence";
      item.children[4].textContent = row.evidence;
      return item;
    }),
  );
}

function renderThreatModel() {
  if (!threatModel) return;
  threatModel.replaceChildren(
    ...arrayText("threats.actors").map((actor) => {
      const card = document.createElement("article");
      card.className = "threat-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = actor.status;
      card.children[1].textContent = actor.title;
      card.children[2].textContent = actor.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("threats.labels.attackSurface") || "Attack surface";
      entries[0].querySelector("dd").textContent = actor.attackSurface;
      entries[1].querySelector("dt").textContent = text("threats.labels.currentControl") || "Current control";
      entries[1].querySelector("dd").textContent = actor.currentControl;
      entries[2].querySelector("dt").textContent = text("threats.labels.openQuestion") || "Open question";
      entries[2].querySelector("dd").textContent = actor.openQuestion;
      return card;
    }),
  );
}

function renderInvariants() {
  if (!invariantLedger) return;
  invariantLedger.replaceChildren(
    ...arrayText("invariants.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "invariant-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="invariant-rule"></p>
        <p class="invariant-test"></p>
      `;
      item.children[0].textContent = row.domain;
      item.children[1].textContent = row.title;
      item.children[2].dataset.label = text("invariants.labels.rule") || "Invariant";
      item.children[2].textContent = row.rule;
      item.children[3].dataset.label = text("invariants.labels.test") || "Evidence test";
      item.children[3].textContent = row.test;
      return item;
    }),
  );
}

function renderRecipes() {
  if (!recipeGrid) return;
  recipeGrid.replaceChildren(
    ...arrayText("recipes.items").map((recipe, index) => {
      const card = document.createElement("article");
      card.className = "recipe-card";
      card.innerHTML = `
        <div class="recipe-index">
          <span></span>
          <em></em>
        </div>
        <div class="recipe-copy">
          <strong></strong>
          <p></p>
          <dl>
            <div><dt></dt><dd></dd></div>
            <div><dt></dt><dd></dd></div>
            <div><dt></dt><dd></dd></div>
            <div><dt></dt><dd></dd></div>
          </dl>
        </div>
      `;
      card.querySelector(".recipe-index span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector(".recipe-index em").textContent = recipe.status;
      card.querySelector(".recipe-copy strong").textContent = recipe.title;
      card.querySelector(".recipe-copy p").textContent = recipe.body;
      const entries = card.querySelectorAll(".recipe-copy dl div");
      entries[0].querySelector("dt").textContent = text("recipes.labels.inputs") || "Inputs";
      entries[0].querySelector("dd").textContent = recipe.inputs;
      entries[1].querySelector("dt").textContent = text("recipes.labels.procedure") || "Procedure";
      entries[1].querySelector("dd").textContent = recipe.procedure;
      entries[2].querySelector("dt").textContent = text("recipes.labels.expected") || "Expected evidence";
      entries[2].querySelector("dd").textContent = recipe.expected;
      entries[3].querySelector("dt").textContent = text("recipes.labels.failure") || "Failure signal";
      entries[3].querySelector("dd").textContent = recipe.failure;
      return card;
    }),
  );
}

function renderAdversarial() {
  if (!adversarialMatrix) return;
  adversarialMatrix.replaceChildren(
    ...arrayText("adversarial.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "adversarial-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="adversarial-reject"></p>
        <p class="adversarial-evidence"></p>
        <p class="adversarial-status"></p>
      `;
      item.children[0].textContent = row.domain;
      item.children[1].textContent = row.title;
      item.children[2].dataset.label = text("adversarial.labels.reject") || "Should reject";
      item.children[2].textContent = row.reject;
      item.children[3].dataset.label = text("adversarial.labels.evidence") || "Evidence to inspect";
      item.children[3].textContent = row.evidence;
      item.children[4].dataset.label = text("adversarial.labels.status") || "Current status";
      item.children[4].textContent = row.status;
      return item;
    }),
  );
}

function renderFormalModel() {
  if (!formalModel) return;
  formalModel.replaceChildren(
    ...arrayText("formal.cards").map((cardData, index) => {
      const card = document.createElement("article");
      card.className = "formal-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = cardData.status || String(index + 1).padStart(2, "0");
      card.children[1].textContent = cardData.title;
      card.children[2].textContent = cardData.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("formal.labels.reviewQuestion") || "Review question";
      entries[0].querySelector("dd").textContent = cardData.question;
      entries[1].querySelector("dt").textContent = text("formal.labels.expectedEvidence") || "Expected evidence";
      entries[1].querySelector("dd").textContent = cardData.evidence;
      return card;
    }),
  );
}

function renderNotation() {
  if (!notationGrid) return;
  notationGrid.replaceChildren(
    ...arrayText("notation.items").map((item) => {
      const card = document.createElement("article");
      card.className = "notation-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <code></code>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.formula;
      card.children[3].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("notation.labels.review") || "Review meaning";
      entries[0].querySelector("dd").textContent = item.review;
      entries[1].querySelector("dt").textContent = text("notation.labels.limit") || "Current limit";
      entries[1].querySelector("dd").textContent = item.limit;
      return card;
    }),
  );
}

function renderLifecycle() {
  if (!lifecycleMap) return;
  lifecycleMap.replaceChildren(
    ...arrayText("lifecycle.steps").map((step, index) => {
      const card = document.createElement("article");
      card.className = "lifecycle-card";
      card.innerHTML = `
        <div class="lifecycle-index">
          <span></span>
          <em></em>
        </div>
        <div class="lifecycle-copy">
          <strong></strong>
          <p></p>
          <dl>
            <div><dt></dt><dd></dd></div>
            <div><dt></dt><dd></dd></div>
          </dl>
        </div>
      `;
      card.querySelector(".lifecycle-index span").textContent = String(index + 1).padStart(2, "0");
      card.querySelector(".lifecycle-index em").textContent = step.status;
      card.querySelector(".lifecycle-copy strong").textContent = step.title;
      card.querySelector(".lifecycle-copy p").textContent = step.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("lifecycle.labels.state") || "State";
      entries[0].querySelector("dd").textContent = step.state;
      entries[1].querySelector("dt").textContent = text("lifecycle.labels.reviewSurface") || "Review surface";
      entries[1].querySelector("dd").textContent = step.surface;
      return card;
    }),
  );
}

function renderCommitments() {
  if (!commitmentGrid) return;
  commitmentGrid.replaceChildren(
    ...arrayText("commitments.items").map((item) => {
      const card = document.createElement("article");
      card.className = "commitment-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("commitments.labels.anchor") || "Public anchor";
      entries[0].querySelector("dd").textContent = item.anchor;
      entries[1].querySelector("dt").textContent = text("commitments.labels.recomputed") || "Recomputed";
      entries[1].querySelector("dd").textContent = item.recomputed;
      entries[2].querySelector("dt").textContent = text("commitments.labels.reviewRisk") || "Review risk";
      entries[2].querySelector("dd").textContent = item.reviewRisk;
      return card;
    }),
  );
}

function renderAvailability() {
  if (!availabilityGrid) return;
  availabilityGrid.replaceChildren(
    ...arrayText("availability.cards").map((item) => {
      const card = document.createElement("article");
      card.className = "availability-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("availability.labels.assumption") || "Assumption";
      entries[0].querySelector("dd").textContent = item.assumption;
      entries[1].querySelector("dt").textContent = text("availability.labels.failure") || "Failure mode";
      entries[1].querySelector("dd").textContent = item.failure;
      entries[2].querySelector("dt").textContent = text("availability.labels.review") || "Reviewer action";
      entries[2].querySelector("dd").textContent = item.review;
      return card;
    }),
  );
}

function renderEconomics() {
  if (!economicGrid) return;
  economicGrid.replaceChildren(
    ...arrayText("economics.cards").map((item) => {
      const card = document.createElement("article");
      card.className = "economic-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("economics.labels.implemented") || "Implemented surface";
      entries[0].querySelector("dd").textContent = item.implemented;
      entries[1].querySelector("dt").textContent = text("economics.labels.reviewFocus") || "Review focus";
      entries[1].querySelector("dd").textContent = item.reviewFocus;
      return card;
    }),
  );
}

function renderRoutes() {
  if (!routeGrid) return;
  routeGrid.replaceChildren(
    ...arrayText("routes.cards").map((route) => {
      const card = document.createElement("article");
      card.className = "route-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <div class="route-steps"></div>
      `;
      card.children[0].textContent = route.audience;
      card.children[1].textContent = route.title;
      card.children[2].textContent = route.body;
      const steps = card.querySelector(".route-steps");
      steps.replaceChildren(...(route.steps || []).map((step) => {
        const link = document.createElement("a");
        link.className = "route-step";
        link.href = step.href || "#";
        link.innerHTML = `
          <span></span>
          <em></em>
        `;
        link.children[0].textContent = step.label;
        link.children[1].textContent = step.proof;
        return link;
      }));
      return card;
    }),
  );
}

function renderClaims() {
  if (!claimLedger) return;
  claimLedger.replaceChildren(
    ...arrayText("claims.rows").map((row) => {
      const card = document.createElement("a");
      card.className = "claim-row";
      card.href = row.href || "#";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="claim-evidence"></p>
        <p class="claim-boundary"></p>
      `;
      card.children[0].textContent = row.status;
      card.children[1].textContent = row.claim;
      card.children[2].dataset.label = text("claims.labels.evidence") || "Evidence";
      card.children[2].textContent = row.evidence;
      card.children[3].dataset.label = text("claims.labels.boundary") || "Boundary";
      card.children[3].textContent = row.boundary;
      return card;
    }),
  );
}

function renderMaturity() {
  if (!maturityLedger) return;
  maturityLedger.replaceChildren(
    ...arrayText("maturity.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "maturity-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="maturity-proof"></p>
        <p class="maturity-missing"></p>
      `;
      item.children[0].textContent = row.phase;
      item.children[1].textContent = row.title;
      item.children[2].dataset.label = text("maturity.labels.proof") || "Current proof";
      item.children[2].textContent = row.proof;
      item.children[3].dataset.label = text("maturity.labels.missing") || "Before protocol-grade";
      item.children[3].textContent = row.missing;
      return item;
    }),
  );
}

function renderUpgrade() {
  if (!upgradeGrid) return;
  upgradeGrid.replaceChildren(
    ...arrayText("upgrade.cards").map((item) => {
      const card = document.createElement("article");
      card.className = "upgrade-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("upgrade.labels.authority") || "Authority posture";
      entries[0].querySelector("dd").textContent = item.authority;
      entries[1].querySelector("dt").textContent = text("upgrade.labels.disclosure") || "Disclosure requirement";
      entries[1].querySelector("dd").textContent = item.disclosure;
      entries[2].querySelector("dt").textContent = text("upgrade.labels.maturity") || "Maturity target";
      entries[2].querySelector("dd").textContent = item.maturity;
      return card;
    }),
  );
}

function renderBoundaries() {
  if (!boundaryTable) return;
  const rows = arrayText("boundaries.rows");
  boundaryTable.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("article");
      item.className = "boundary-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
      `;
      item.children[0].textContent = row.status;
      item.children[1].textContent = row.title;
      item.children[2].textContent = row.body;
      return item;
    }),
  );
}

function renderRisks() {
  if (!riskTable) return;
  riskTable.replaceChildren(
    ...arrayText("risks.rows").map((row) => {
      const item = document.createElement("article");
      item.className = "risk-row";
      item.innerHTML = `
        <span></span>
        <strong></strong>
        <p class="risk-impact"></p>
        <p class="risk-mitigation"></p>
      `;
      item.children[0].textContent = row.status;
      item.children[1].textContent = row.risk;
      item.children[2].dataset.label = text("risks.labels.impact") || "Impact";
      item.children[2].textContent = row.impact;
      item.children[3].dataset.label = text("risks.labels.mitigation") || "Mitigation";
      item.children[3].textContent = row.mitigation;
      return item;
    }),
  );
}

function renderQuestions() {
  if (!questionGrid) return;
  questionGrid.replaceChildren(
    ...arrayText("questions.items").map((item) => {
      const card = document.createElement("article");
      card.className = "question-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <dl>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
          <div><dt></dt><dd></dd></div>
        </dl>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const entries = card.querySelectorAll("dl div");
      entries[0].querySelector("dt").textContent = text("questions.labels.why") || "Why it matters";
      entries[0].querySelector("dd").textContent = item.why;
      entries[1].querySelector("dt").textContent = text("questions.labels.evidence") || "Evidence needed";
      entries[1].querySelector("dd").textContent = item.evidence;
      entries[2].querySelector("dt").textContent = text("questions.labels.owner") || "Likely owner";
      entries[2].querySelector("dd").textContent = item.owner;
      return card;
    }),
  );
}

function renderChecklist() {
  if (!checklistGrid) return;
  checklistGrid.replaceChildren(
    ...arrayText("checklist.items").map((item, index) => {
      const card = document.createElement("article");
      card.className = "checklist-card";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
        <ul></ul>
      `;
      card.children[0].textContent = String(index + 1).padStart(2, "0");
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      const list = card.querySelector("ul");
      list.replaceChildren(...(item.steps || []).map((step) => {
        const li = document.createElement("li");
        li.textContent = step;
        return li;
      }));
      return card;
    }),
  );
}

function renderReviewers() {
  if (!reviewerGrid) return;
  reviewerGrid.replaceChildren(
    ...arrayText("reviewers.cards").map((item) => {
      const card = document.createElement("article");
      card.className = "reviewer-card";
      card.innerHTML = `
        <strong></strong>
        <p></p>
        <ul></ul>
      `;
      card.querySelector("strong").textContent = item.title;
      card.querySelector("p").textContent = item.body;
      const list = card.querySelector("ul");
      list.replaceChildren(...(item.checks || []).map((check) => {
        const li = document.createElement("li");
        li.textContent = check;
        return li;
      }));
      return card;
    }),
  );
}

function renderNextWork() {
  if (!nextStack) return;
  nextStack.replaceChildren(
    ...arrayText("next.items").map((item) => {
      const card = document.createElement("article");
      card.className = "next-item";
      card.innerHTML = `
        <span></span>
        <strong></strong>
        <p></p>
      `;
      card.children[0].textContent = item.status;
      card.children[1].textContent = item.title;
      card.children[2].textContent = item.body;
      return card;
    }),
  );
}

function arrayText(path) {
  const value = text(path);
  return Array.isArray(value) ? value : [];
}

function setupBackdrop(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const resize = () => syncCanvasSize(canvas);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  function render(time) {
    resize();
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#090d13";
    context.fillRect(0, 0, width, height);

    const grid = Math.max(28, Math.min(width, height) / 18);
    context.save();
    context.translate(width * 0.5, height * 0.48);
    context.rotate(-0.18);
    for (let y = -height; y <= height; y += grid) {
      for (let x = -width; x <= width; x += grid) {
        const pulse = Math.sin(time * 0.0008 + x * 0.02 + y * 0.026) * 0.5 + 0.5;
        if (pulse < 0.54) continue;
        context.strokeStyle = pulse > 0.82 ? "rgba(140, 255, 0, 0.13)" : "rgba(152, 203, 255, 0.08)";
        context.lineWidth = 1;
        context.strokeRect(x, y, grid * 0.62, grid * 0.62);
      }
    }
    context.restore();

    context.save();
    for (let i = 0; i < 22; i += 1) {
      const phase = time * 0.00016 + i * 0.43;
      const x = width * (0.08 + ((Math.sin(phase) + 1) * 0.46));
      const y = height * (0.12 + ((Math.cos(phase * 1.27) + 1) * 0.38));
      context.fillStyle = i % 3 === 0 ? "rgba(140, 255, 0, 0.18)" : "rgba(152, 203, 255, 0.13)";
      context.fillRect(x, y, 2, 2);
    }
    context.restore();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function setupCoreAnimation(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const resize = () => syncCanvasSize(canvas);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const nodes = [
    { label: "SEED", angle: -1.8, radius: 0.37 },
    { label: "RULE", angle: -0.72, radius: 0.42 },
    { label: "HASH", angle: 0.42, radius: 0.36 },
    { label: "PDA", angle: 1.38, radius: 0.44 },
    { label: "WALLET", angle: 2.5, radius: 0.38 },
  ];

  function render(time) {
    resize();
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height);
    context.clearRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);
    context.strokeStyle = "rgba(152, 203, 255, 0.16)";
    context.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const radius = scale * (0.16 + i * 0.048);
      context.beginPath();
      context.rect(-radius, -radius, radius * 2, radius * 2);
      context.stroke();
    }

    const points = nodes.map((node, index) => {
      const angle = node.angle + Math.sin(time * 0.00045 + index) * 0.045;
      return {
        ...node,
        x: Math.cos(angle) * scale * node.radius,
        y: Math.sin(angle) * scale * node.radius,
      };
    });

    context.strokeStyle = "rgba(140, 255, 0, 0.2)";
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.stroke();

    points.forEach((point, index) => {
      const glow = Math.sin(time * 0.002 + index) * 0.5 + 0.5;
      context.fillStyle = "rgba(8, 12, 18, 0.92)";
      context.strokeStyle = index % 2 ? "rgba(140, 255, 0, 0.74)" : "rgba(152, 203, 255, 0.78)";
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(point.x - 34, point.y - 18, 68, 36, 8);
      context.fill();
      context.stroke();
      context.fillStyle = `rgba(244, 248, 255, ${0.72 + glow * 0.24})`;
      context.font = "700 10px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(point.label, point.x, point.y + 1);
    });

    context.fillStyle = "rgba(152, 203, 255, 0.08)";
    context.strokeStyle = "rgba(152, 203, 255, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(-58, -42, 116, 84, 10);
    context.fill();
    context.stroke();
    context.fillStyle = "#8cff00";
    context.font = "800 12px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("NICECHUNK", 0, -5);
    context.fillStyle = "rgba(218, 231, 238, 0.66)";
    context.font = "700 9px Inter, system-ui, sans-serif";
    context.fillText("PUBLIC STATE", 0, 15);
    context.restore();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function syncCanvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function normalizeLanguage(language) {
  if (!language) return "";
  if (language === "zh") return "zh-Hans";
  if (language === "zh-CN" || language === "zh-SG") return "zh-Hans";
  if (language === "zh-TW" || language === "zh-HK" || language === "zh-MO") return "zh-Hant";
  return languageCodes.has(language) ? language : "";
}

async function loadDictionary(language) {
  const normalized = normalizeLanguage(language) || "en";
  if (dictionaryCache.has(normalized)) return dictionaryCache.get(normalized);
  try {
    const response = await fetch(`/trust/locales/${normalized}.json`, {
      credentials: "same-origin",
      cache: "default",
    });
    if (!response.ok) throw new Error(`Trust locale ${normalized} failed: ${response.status}`);
    const nextDictionary = await response.json();
    dictionaryCache.set(normalized, nextDictionary);
    return nextDictionary;
  } catch (error) {
    console.warn(error);
    activeLanguage = "en";
    localStorage.setItem(languageStorageKey, "en");
    return enDictionary;
  }
}
