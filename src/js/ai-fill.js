import { parsePremiseDescription } from "./ai-parser.js";

function setValue(id, value, { overwrite = true } = {}) {
  const el = document.getElementById(id);
  if (!el || value === null || value === undefined || value === "") return false;
  if (!overwrite && el.value) return false;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function normalizeForCompare(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .toLowerCase()
    .trim();
}

function selectOptionByText(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) return false;

  const target = normalizeForCompare(value);
  const option = Array.from(select.options).find((opt) => {
    return normalizeForCompare(opt.value) === target || normalizeForCompare(opt.textContent) === target;
  });

  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function formatPriceInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  if (typeof window.formatCurrencyInput === "function") {
    window.formatCurrencyInput(input);
  }
}

function appendDetailLines(lines) {
  const detail = document.getElementById("add-detail");
  if (!detail) return;

  const cleanLines = lines.filter(Boolean);
  if (!cleanLines.length) return;

  const current = detail.value.trim();
  const additions = cleanLines.filter((line) => !current.includes(line));
  if (!additions.length) return;

  detail.value = [current, additions.join("\n")].filter(Boolean).join("\n");
  detail.dispatchEvent(new Event("input", { bubbles: true }));
}

export function fillPremiseForm(result, { overwrite = true } = {}) {
  if (!result || typeof result !== "object") return;

  setValue("add-address", result.address, { overwrite });
  setValue("edit-address", result.address, { overwrite });
  setValue("add-street", result.street, { overwrite });
  setValue("edit-street", result.street, { overwrite });

  if (result.district) {
    selectOptionByText("add-district", result.district);
    selectOptionByText("edit-district", result.district);
  }

  if (result.ward) {
    setTimeout(() => {
      selectOptionByText("add-ward", result.ward);
      setValue("edit-ward", result.ward, { overwrite });
    }, 0);
  }

  setValue("add-width", result.width, { overwrite });
  setValue("edit-width", result.width, { overwrite });
  setValue("add-length", result.length, { overwrite });
  setValue("edit-length", result.length, { overwrite });
  setValue("add-area", result.area, { overwrite });
  setValue("edit-area", result.area, { overwrite });
  setValue("add-floors", result.floors, { overwrite });
  setValue("edit-floors", result.floors, { overwrite });
  setValue("add-bedrooms", result.bedrooms, { overwrite });
  setValue("edit-bedrooms", result.bedrooms, { overwrite });
  setValue("add-wc", result.wc, { overwrite });
  setValue("edit-wc", result.wc, { overwrite });

  if (setValue("add-price", result.price, { overwrite })) formatPriceInput("add-price");
  setValue("edit-price", result.price, { overwrite });

  if (result.road_type) {
    selectOptionByText("add-road-type", result.road_type);
    selectOptionByText("edit-road-type", result.road_type);
    const editFrontage = document.getElementById("edit-frontage");
    if (editFrontage) editFrontage.checked = result.road_type === "M\u1eb7t ti\u1ec1n";
  }

  setValue("add-business-type", result.business_type, { overwrite });

  appendDetailLines([
    result.business_type ? `Ph\u00f9 h\u1ee3p: ${result.business_type}` : "",
    result.deposit_months ? `C\u1ecdc: ${result.deposit_months} th\u00e1ng` : "",
  ]);
}

export function initAIPremiseParserUI() {
  const button = document.getElementById("btn-ai-parse");
  const textarea = document.getElementById("raw-description");
  if (!button || !textarea) return;

  button.addEventListener("click", async () => {
    const rawText = textarea.value.trim();
    if (!rawText) {
      console.warn("[AI Parser] Empty raw description.");
      return;
    }

    const oldLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="loading loading-spinner loading-xs"></span> \u0110ang ph\u00e2n t\u00edch...`;

    try {
      const result = await parsePremiseDescription(rawText);
      const detail = document.getElementById("add-detail");
      if (detail && !detail.value.trim()) detail.value = rawText;
      fillPremiseForm(result);
    } catch (error) {
      console.error("[AI Parser] UI fill failed:", error);
    } finally {
      button.disabled = false;
      button.innerHTML = oldLabel;
    }
  });
}

document.addEventListener("DOMContentLoaded", initAIPremiseParserUI);
