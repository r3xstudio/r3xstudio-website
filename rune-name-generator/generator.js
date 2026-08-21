const runes = [
  { key: "f", name: "Fehu", rune: "ᚠ", file: "01-fehu.png" },
  { key: "u", name: "Uruz", rune: "ᚢ", file: "02-uruz.png" },
  { key: "th", name: "Thurisaz", rune: "ᚦ", file: "03-thurisaz.png" },
  { key: "a", name: "Ansuz", rune: "ᚨ", file: "04-ansuz.png" },
  { key: "r", name: "Raidho", rune: "ᚱ", file: "05-raidho.png" },
  { key: "k", name: "Kenaz", rune: "ᚲ", file: "06-kenaz.png" },
  { key: "g", name: "Gebo", rune: "ᚷ", file: "07-gebo.png" },
  { key: "w", name: "Wunjo", rune: "ᚹ", file: "08-wunjo.png" },
  { key: "h", name: "Hagalaz", rune: "ᚺ", file: "09-hagalaz.png" },
  { key: "n", name: "Nauthiz", rune: "ᚾ", file: "10-nauthiz.png" },
  { key: "i", name: "Isa", rune: "ᛁ", file: "11-isa.png" },
  { key: "j", name: "Jera", rune: "ᛃ", file: "12-jera.png" },
  { key: "ei", name: "Eihwaz", rune: "ᛇ", file: "13-eihwaz.png" },
  { key: "p", name: "Perthro", rune: "ᛈ", file: "14-perthro.png" },
  { key: "z", name: "Algiz", rune: "ᛉ", file: "15-algiz.png" },
  { key: "s", name: "Sowilo", rune: "ᛊ", file: "16-sowilo.png" },
  { key: "t", name: "Tiwaz", rune: "ᛏ", file: "17-tiwaz.png" },
  { key: "b", name: "Berkano", rune: "ᛒ", file: "18-berkano.png" },
  { key: "e", name: "Ehwaz", rune: "ᛖ", file: "19-ehwaz.png" },
  { key: "m", name: "Mannaz", rune: "ᛗ", file: "20-mannaz.png" },
  { key: "l", name: "Laguz", rune: "ᛚ", file: "21-laguz.png" },
  { key: "ng", name: "Ingwaz", rune: "ᛜ", file: "22-ingwaz.png" },
  { key: "d", name: "Dagaz", rune: "ᛞ", file: "23-dagaz.png" },
  { key: "o", name: "Othala", rune: "ᛟ", file: "24-othala.png" }
];

const runeByKey = new Map(runes.map(rune => [rune.key, rune]));
const assetBase = "../assets/runes/";
const imageCache = new Map();
const input = document.querySelector("#name-input");
const mode = document.querySelector("#render-mode");
const language = document.querySelector("#language");
const divider = document.querySelector("#divider");
const stage = document.querySelector("#rune-stage");
const submittedValue = document.querySelector("#submitted-value");
const normalizedValue = document.querySelector("#normalized-value");
const unicodeValue = document.querySelector("#unicode-value");
const decisionLog = document.querySelector("#decision-log");
const methodBadge = document.querySelector("#method-badge");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const actionStatus = document.querySelector("#action-status");
let currentResult = null;

document.querySelector("#rune-form").addEventListener("input", render);
document.querySelectorAll("[data-sample]").forEach(button => button.addEventListener("click", () => {
  input.value = button.dataset.sample;
  language.value = button.dataset.language;
  render();
}));
copyButton.addEventListener("click", copyUnicode);
downloadButton.addEventListener("click", downloadPng);

buildReferenceGrid();
render();

function render() {
  const submitted = input.value.trim();
  language.disabled = mode.value !== "sound";
  const result = createRendering(submitted, mode.value, language.value);
  currentResult = result;
  submittedValue.textContent = submitted || "—";
  normalizedValue.textContent = result.normalized.toUpperCase() || "—";
  methodBadge.textContent = mode.value === "sound" ? "Sound-aware approximation" : "Visual transliteration";
  const unicode = result.items.map(item => item.type === "rune" ? item.rune.rune : divider.value === "dot" ? "·" : divider.value === "gap" ? " " : "").join("");
  unicodeValue.textContent = unicode || "—";
  decisionLog.replaceChildren();
  result.decisions.forEach(decision => {
    const chip = document.createElement("span");
    chip.textContent = decision;
    decisionLog.append(chip);
  });
  stage.replaceChildren();

  if (!result.items.some(item => item.type === "rune")) {
    const empty = document.createElement("p");
    empty.className = "empty-result";
    empty.textContent = submitted ? "No supported letters were found. Try a name written with Latin letters." : "Enter a name to reveal its rune sequence.";
    stage.append(empty);
    copyButton.disabled = true;
    downloadButton.disabled = true;
    return;
  }

  result.items.forEach(item => {
    if (item.type === "divider") {
      if (divider.value === "none") return;
      const mark = document.createElement("span");
      mark.className = "rune-divider";
      mark.textContent = divider.value === "dot" ? "·" : "";
      mark.setAttribute("aria-hidden", "true");
      stage.append(mark);
      return;
    }
    const card = document.createElement("div");
    card.className = "rune-card";
    const image = document.createElement("img");
    image.src = assetBase + item.rune.file;
    image.width = 500;
    image.height = 500;
    image.alt = `${item.rune.name} rune for ${item.source.toUpperCase()}`;
    const label = document.createElement("small");
    label.textContent = item.rune.name;
    card.append(image, label);
    stage.append(card);
  });
  copyButton.disabled = false;
  downloadButton.disabled = false;
  actionStatus.textContent = "";
}

function createRendering(value, selectedMode, selectedLanguage) {
  const decisions = [];
  let prepared = value.toLocaleLowerCase();
  if (selectedMode === "sound") prepared = applySoundRules(prepared, selectedLanguage, decisions);
  prepared = normalizeLetters(prepared, decisions);
  if (selectedMode === "visual") prepared = applyVisualRules(prepared, decisions);
  const items = [];
  let normalized = "";

  for (let index = 0; index < prepared.length;) {
    const char = prepared[index];
    if (/\s|-/.test(char)) {
      if (items.at(-1)?.type !== "divider") items.push({ type: "divider" });
      normalized += " ";
      index += 1;
      continue;
    }
    const pair = prepared.slice(index, index + 2);
    const key = pair === "th" || pair === "ng" ? pair : char;
    const rune = runeByKey.get(key);
    if (rune) {
      items.push({ type: "rune", rune, source: key });
      normalized += key;
      index += key.length;
    } else {
      decisions.push(`${char.toUpperCase()} omitted — no direct Elder Futhark sign`);
      index += 1;
    }
  }
  return { items, normalized: normalized.replace(/\s+/g, " ").trim(), decisions: [...new Set(decisions)] };
}

function applyVisualRules(value, decisions) {
  const replacements = [
    [/qu/g, "kw", "QU → KW"], [/x/g, "ks", "X → KS"], [/c/g, "k", "C → K"],
    [/v/g, "w", "V → W"], [/y/g, "i", "Y → I"]
  ];
  return replaceWithLog(value, replacements, decisions);
}

function applySoundRules(value, selectedLanguage, decisions) {
  const rules = {
    pl: [
      [/dź|dzi|dż|cz|ć/g, "ts", "Polish affricate → TS approximation"],
      [/sz|ś/g, "s", "SZ/Ś → S"], [/rz|ż|ź/g, "z", "RZ/Ż/Ź → Z"],
      [/ch/g, "h", "CH → H"], [/ó/g, "u", "Ó → U"], [/ł/g, "w", "Ł → W"],
      [/ą/g, "ong", "Ą → ONG approximation"], [/ę/g, "eng", "Ę → ENG approximation"],
      [/c/g, "ts", "C → TS approximation"], [/y/g, "i", "Y → I"]
    ],
    en: [
      [/ch(?=r|l|ael)/g, "k", "CH → K approximation"], [/tch|ch/g, "ts", "CH → TS approximation"], [/sh/g, "s", "SH → S"],
      [/ph/g, "f", "PH → F"], [/qu/g, "kw", "QU → KW"], [/x/g, "ks", "X → KS"],
      [/c(?=[eiy])/g, "s", "Soft C → S"], [/c/g, "k", "Hard C → K"],
      [/v/g, "w", "V → W"], [/y/g, "i", "Y → I"]
    ],
    no: [
      [/skj|sj/g, "s", "SKJ/SJ → S approximation"], [/kj/g, "k", "KJ → K approximation"],
      [/hv/g, "w", "HV → W"], [/v/g, "w", "V → W"], [/y/g, "i", "Y → I"],
      [/ø/g, "o", "Ø → O approximation"], [/å/g, "o", "Å → O"], [/æ/g, "ae", "Æ → AE"]
    ]
  };
  return replaceWithLog(value, rules[selectedLanguage], decisions);
}

function normalizeLetters(value, decisions) {
  const special = [[/þ/g, "th", "Þ → TH"], [/ð/g, "d", "Ð → D approximation"], [/œ/g, "oe", "Œ → OE"], [/æ/g, "ae", "Æ → AE"], [/ø/g, "o", "Ø → O"], [/ł/g, "l", "Ł → L"]];
  const replaced = replaceWithLog(value, special, decisions);
  return replaced.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s-]/g, "");
}

function replaceWithLog(value, replacements, decisions) {
  let result = value;
  replacements.forEach(([pattern, replacement, note]) => {
    pattern.lastIndex = 0;
    if (pattern.test(result)) {
      decisions.push(note);
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
  });
  return result;
}

async function copyUnicode() {
  const value = unicodeValue.textContent;
  try {
    await navigator.clipboard.writeText(value);
    actionStatus.textContent = "Unicode rune sequence copied.";
  } catch {
    actionStatus.textContent = `Copy manually: ${value}`;
  }
}

async function downloadPng() {
  if (!currentResult) return;
  downloadButton.disabled = true;
  actionStatus.textContent = "Building transparent PNG…";
  try {
    const units = currentResult.items.filter(item => item.type === "rune" || divider.value !== "none");
    const runeCount = units.filter(item => item.type === "rune").length;
    const preferredRuneSize = 420;
    const preferredGap = 22;
    const dividerWidth = divider.value === "dot" ? 100 : 135;
    const naturalWidth = runeCount * (preferredRuneSize + preferredGap) + units.filter(item => item.type === "divider").length * dividerWidth + 180;
    const scale = Math.min(1, 6000 / naturalWidth);
    const runeSize = Math.round(preferredRuneSize * scale);
    const gap = Math.round(preferredGap * scale);
    const dividerSize = Math.round(dividerWidth * scale);
    const width = Math.max(900, Math.round(naturalWidth * scale));
    const height = runeSize + 180;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    let x = 90;
    for (const item of units) {
      if (item.type === "divider") {
        if (divider.value === "dot") {
          context.fillStyle = "#c76632";
          context.beginPath();
          context.arc(x + dividerSize / 2, height / 2, Math.max(7, 13 * scale), 0, Math.PI * 2);
          context.fill();
        }
        x += dividerSize;
        continue;
      }
      const image = await loadImage(assetBase + item.rune.file);
      context.drawImage(image, x, 90, runeSize, runeSize);
      x += runeSize + gap;
    }
    const link = document.createElement("a");
    const fileName = (input.value.trim() || "rune-name").toLocaleLowerCase().replace(/ł/g, "l").replace(/ø/g, "o").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.download = `r3x-${fileName || "rune-name"}-elder-futhark.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    actionStatus.textContent = `Transparent PNG ready: ${canvas.width} × ${canvas.height}px.`;
  } catch (error) {
    actionStatus.textContent = "PNG export failed. Please try again.";
  } finally {
    downloadButton.disabled = false;
  }
}

function loadImage(source) {
  if (imageCache.has(source)) return imageCache.get(source);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
  imageCache.set(source, promise);
  return promise;
}

function buildReferenceGrid() {
  const grid = document.querySelector("#rune-grid");
  runes.forEach((rune, index) => {
    const card = document.createElement("article");
    card.className = "reference-card";
    const image = document.createElement("img");
    image.src = assetBase + rune.file;
    image.width = 500;
    image.height = 500;
    image.loading = "lazy";
    image.alt = `${rune.name} rune artwork`;
    const meta = document.createElement("div");
    meta.className = "reference-meta";
    const name = document.createElement("strong");
    name.textContent = `${String(index + 1).padStart(2, "0")} / ${rune.name}`;
    const character = document.createElement("span");
    character.textContent = rune.rune;
    meta.append(name, character);
    card.append(image, meta);
    grid.append(card);
  });
}
