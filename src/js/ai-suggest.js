import { parseCustomerRequest, parseNaturalLanguageQuery } from "./ai-request-parser.js";
import { applyAiFilters, scorePremises } from "./ai-score.js";
import { renderAISuggestions } from "./ai-suggest-render.js";

let LAST_AI_PARSED_FILTERS = null;

function getDbClient() {
  if (globalThis.db) return globalThis.db;
  if (typeof db !== "undefined") return db;
  throw new Error("Supabase client chưa sẵn sàng");
}

function notify(message) {
  if (typeof toast === "function") toast(message);
  else window.alert(message);
}

function applyNumericFilter(query, column, operator, value) {
  if (value == null || value === "") return query;
  return query[operator](column, value);
}

function applyStreetSearch(query, streets = []) {
  if (!streets.length) return query;
  const street = streets[0].replace(/[%(),]/g, " ").trim();
  if (!street) return query;
  return query.or(`street.ilike.%${street}%,address.ilike.%${street}%`);
}

async function runPremisesQuery(filters, options = {}) {
  const client = getDbClient();
  let query = client.from("premises").select("*");

  query = query.eq("is_approved", true);
  query = query.or("is_deleted.is.null,is_deleted.eq.false");

  if (!options.omitStatus && filters.status) query = query.eq("status", filters.status);
  if (!options.omitDistricts && filters.districts?.length) query = query.in("district", filters.districts);
  if (!options.omitWards && filters.wards?.length) query = query.in("ward", filters.wards);
  query = applyStreetSearch(query, options.omitStreets ? [] : filters.streets || []);

  query = applyNumericFilter(query, "price", "gte", options.omitMinPrice ? null : filters.minPrice);
  query = applyNumericFilter(query, "price", "lte", options.priceMax ?? filters.maxPrice);
  query = applyNumericFilter(query, "area", "gte", options.omitMinArea ? null : filters.minArea);
  query = applyNumericFilter(query, "area", "lte", filters.maxArea);
  query = applyNumericFilter(query, "width", "gte", options.omitMinWidth ? null : filters.minWidth);
  query = applyNumericFilter(query, "length", "gte", options.omitMinDepth ? null : filters.minDepth);
  query = applyNumericFilter(query, "floors", "gte", options.omitMinFloors ? null : filters.minFloors);
  query = applyNumericFilter(query, "pn", "gte", options.omitMinBedrooms ? null : filters.minBedrooms);
  query = applyNumericFilter(query, "wc", "gte", options.omitMinBathrooms ? null : filters.minBathrooms);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(options.limit || 160);
  if (error) throw error;
  return data || [];
}

export async function queryPremisesByFilters(filters) {
  const attempts = [
    { label: null, options: {} },
    { label: "Nới điều kiện ngang/dài", options: { omitMinWidth: true, omitMinDepth: true } },
    { label: "Nới điều kiện diện tích/phòng", options: { omitMinWidth: true, omitMinDepth: true, omitMinArea: true, omitMinFloors: true, omitMinBedrooms: true, omitMinBathrooms: true } },
    {
      label: "Tăng ngân sách tối đa thêm 10%",
      options: {
        omitMinWidth: true,
        omitMinDepth: true,
        omitMinArea: true,
        omitMinFloors: true,
        omitMinBedrooms: true,
        omitMinBathrooms: true,
        priceMax: filters.maxPrice ? Math.round(filters.maxPrice * 1.1) : null,
      },
    },
    {
      label: "Không có mặt bằng khớp 100%, đang hiển thị nguồn gần phù hợp nhất",
      options: {
        omitStatus: true,
        omitMinWidth: true,
        omitMinDepth: true,
        omitMinArea: true,
        omitMinFloors: true,
        omitMinBedrooms: true,
        omitMinBathrooms: true,
        priceMax: filters.maxPrice ? Math.round(filters.maxPrice * 1.25) : null,
      },
    },
  ];

  for (const attempt of attempts) {
    const rows = await runPremisesQuery(filters, attempt.options);
    const scored = applyAiFilters(rows, filters);
    if (scored.length) {
      return {
        rows: scored,
        relaxed: Boolean(attempt.label),
        relaxedSteps: attempt.label ? [attempt.label] : [],
      };
    }
  }

  // Last fallback: if the query has no hard district, show scored recent inventory.
  if (!filters.districts?.length) {
    const rows = await runPremisesQuery(filters, {
      omitStatus: true,
      omitMinPrice: true,
      omitMinWidth: true,
      omitMinDepth: true,
      omitMinArea: true,
      omitMinFloors: true,
      omitMinBedrooms: true,
      omitMinBathrooms: true,
      limit: 120,
    });
    return {
      rows: scorePremises(rows, filters).sort((a, b) => b.ai_score - a.ai_score),
      relaxed: true,
      relaxedSteps: ["Không có kết quả khớp chặt, đang hiển thị nguồn gần phù hợp nhất"],
    };
  }

  return { rows: [], relaxed: true, relaxedSteps: ["Không có kết quả phù hợp sau khi nới điều kiện"] };
}

export async function suggestPremisesFromRequest(text) {
  const filters = await parseCustomerRequest(text);
  LAST_AI_PARSED_FILTERS = filters;
  globalThis.LAST_AI_PARSED_FILTERS = filters;

  const { rows, relaxed, relaxedSteps } = await queryPremisesByFilters(filters);
  const scored = rows
    .map((row) => ({ ...row, ai_relaxed: relaxed, ai_relaxed_steps: relaxedSteps }))
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 30);

  scored.parsedFilters = filters;
  scored.relaxed = relaxed;
  scored.relaxedSteps = relaxedSteps;

  console.log("[AI Suggest] parsed:", filters);
  console.log("[AI Suggest] scored results:", scored);
  return scored;
}

export async function runAISuggestFromInput() {
  const btn = document.getElementById("btn-ai-suggest");
  const input = document.getElementById("ai-customer-request");
  if (!btn || !input) return;

  const text = input.value.trim();
  if (!text) {
    notify("Vui lòng nhập yêu cầu khách hàng");
    return;
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang tìm...";

  try {
    const results = await suggestPremisesFromRequest(text);
    renderAISuggestions(results, "ai-suggest-result", results.parsedFilters);
  } catch (error) {
    console.error("[AI Suggest] failed:", error);
    notify("Lỗi AI tìm mặt bằng: " + (error.message || error));
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

export function resetAISuggestions() {
  LAST_AI_PARSED_FILTERS = null;
  globalThis.LAST_AI_PARSED_FILTERS = null;
  const input = document.getElementById("ai-customer-request");
  const result = document.getElementById("ai-suggest-result");
  if (input) input.value = "";
  if (result) result.innerHTML = "";
}

globalThis.parseNaturalLanguageQuery = parseNaturalLanguageQuery;
globalThis.suggestPremisesFromRequest = suggestPremisesFromRequest;
globalThis.renderAISuggestions = renderAISuggestions;
globalThis.runAISuggestFromInput = runAISuggestFromInput;
globalThis.resetAISuggestions = resetAISuggestions;
