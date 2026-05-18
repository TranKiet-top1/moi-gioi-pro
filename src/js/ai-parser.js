import { callOpenAIParser } from "./openai.js";
import {
  normalizeVietnameseText,
  parsePremiseDescriptionWithRegex,
  validateParseResult,
} from "./regex-parser.js";

export { normalizeVietnameseText };

const MERGE_KEYS = [
  "district",
  "ward",
  "street",
  "address",
  "width",
  "length",
  "area",
  "floors",
  "bedrooms",
  "wc",
  "price",
  "deposit_months",
  "business_type",
  "road_type",
];

function hasUsefulValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasMissingImportantFields(result) {
  return ["district", "street", "width", "length", "floors", "price", "business_type", "road_type"]
    .some((key) => !hasUsefulValue(result[key]));
}

export function mergeParseResults(regexResult = {}, aiResult = {}) {
  const cleanRegex = validateParseResult(regexResult);
  const cleanAi = validateParseResult(aiResult || {});
  const merged = {};

  MERGE_KEYS.forEach((key) => {
    merged[key] = hasUsefulValue(cleanAi[key]) ? cleanAi[key] : cleanRegex[key];
  });

  return validateParseResult(merged);
}

export async function parsePremiseDescription(text) {
  try {
    const regexResult = parsePremiseDescriptionWithRegex(text);
    console.log("[AI Parser] regex result:", regexResult);

    let aiResult = null;
    if (hasMissingImportantFields(regexResult)) {
      aiResult = await callOpenAIParser(text, regexResult);
    }

    console.log("[AI Parser] ai result:", aiResult);
    const mergedResult = mergeParseResults(regexResult, aiResult);
    console.log("[AI Parser] merged result:", mergedResult);

    return mergedResult;
  } catch (error) {
    console.error("[AI Parser] parse failed:", error);
    return validateParseResult({});
  }
}
