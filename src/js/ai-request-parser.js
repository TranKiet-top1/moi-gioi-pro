const DISTRICT_ALIASES = [
  ["Quận 1", ["q1", "quan 1", "quận 1"]],
  ["Quận 2", ["q2", "quan 2", "quận 2"]],
  ["Quận 3", ["q3", "quan 3", "quận 3"]],
  ["Quận 4", ["q4", "quan 4", "quận 4"]],
  ["Quận 5", ["q5", "quan 5", "quận 5"]],
  ["Quận 6", ["q6", "quan 6", "quận 6"]],
  ["Quận 7", ["q7", "quan 7", "quận 7"]],
  ["Quận 8", ["q8", "quan 8", "quận 8"]],
  ["Quận 9", ["q9", "quan 9", "quận 9"]],
  ["Quận 10", ["q10", "quan 10", "quận 10"]],
  ["Quận 11", ["q11", "quan 11", "quận 11"]],
  ["Quận 12", ["q12", "quan 12", "quận 12"]],
  ["Bình Thạnh", ["bt", "binh thanh", "bình thạnh"]],
  ["Phú Nhuận", ["pn", "phu nhuan", "phú nhuận"]],
  ["Tân Bình", ["tb", "tan binh", "tân bình"]],
  ["Gò Vấp", ["gv", "go vap", "gò vấp"]],
  ["Tân Phú", ["tp", "tan phu", "tân phú"]],
  ["Thủ Đức", ["td", "thu duc", "thủ đức"]],
  ["Bình Tân", ["binh tan", "bình tân"]],
  ["Nhà Bè", ["nha be", "nhà bè"]],
  ["Hóc Môn", ["hoc mon", "hóc môn"]],
  ["Củ Chi", ["cu chi", "củ chi"]],
  ["Bình Chánh", ["binh chanh", "bình chánh"]],
  ["Cần Giờ", ["can gio", "cần giờ"]],
];

const BUSINESS_DICTIONARY = [
  {
    keys: ["do an", "an uong", "quan an", "nha hang", "bun pho", "f&b", "fnb", "food"],
    values: ["đồ ăn", "ăn uống", "quán ăn", "nhà hàng", "F&B", "cafe"],
  },
  {
    keys: ["cafe", "ca phe", "coffee"],
    values: ["cafe", "cà phê", "coffee", "F&B"],
  },
  {
    keys: ["spa", "nail", "salon", "lam dep"],
    values: ["spa", "nail", "salon", "làm đẹp"],
  },
  {
    keys: ["showroom", "trung bay", "cua hang", "shop"],
    values: ["showroom", "cửa hàng", "shop"],
  },
  {
    keys: ["van phong", "office", "cty", "cong ty"],
    values: ["văn phòng", "office", "công ty"],
  },
  {
    keys: ["kho", "xuong", "luu hang"],
    values: ["kho", "xưởng"],
  },
];

const DEFAULT_PARSED_FILTERS = {
  districts: [],
  wards: [],
  streets: [],
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  minWidth: null,
  maxWidth: null,
  minDepth: null,
  maxDepth: null,
  minFloors: null,
  minBedrooms: null,
  minBathrooms: null,
  positionTypes: [],
  businessTypes: [],
  propertyTypes: [],
  status: null,
  rawQuery: "",

  // Backward-compatible aliases for the previous implementation.
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  widthMin: null,
  lengthMin: null,
  floorsMin: null,
  roadTypes: [],
  frontage: null,
  keywords: [],
};

export function normalizeVietnameseText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[“”"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function toVnd(value, unit = "", context = "") {
  const amount = toNumber(value);
  if (amount == null) return null;
  const normalizedUnit = normalizeVietnameseText(unit);
  const normalizedContext = normalizeVietnameseText(context);
  if (normalizedUnit.includes("ty") || normalizedUnit.includes("ti")) return Math.round(amount * 1000000000);
  if (normalizedUnit.includes("tr") || normalizedUnit.includes("trieu") || normalizedUnit === "m") return Math.round(amount * 1000000);
  if (amount < 1000 && /(gia|thue|tai chinh|ngan sach|duoi|tren|tam|khoang|den|toi)/.test(normalizedContext)) {
    return Math.round(amount * 1000000);
  }
  return Math.round(amount);
}

function addDistrict(result, district) {
  if (district && !result.includes(district)) result.push(district);
}

export function parseDistricts(text = "") {
  const original = String(text);
  const normalized = normalizeVietnameseText(original);
  const districts = [];

  for (const match of normalized.matchAll(/\bq\.?\s*(1[0-2]|[1-9])\b/g)) {
    addDistrict(districts, `Quận ${Number(match[1])}`);
  }

  for (const match of normalized.matchAll(/\bquan\s+((?:1[0-2]|[1-9])(?:\s+(?:1[0-2]|[1-9]))*)\b/g)) {
    match[1].split(/\s+/).forEach((number) => addDistrict(districts, `Quận ${Number(number)}`));
  }

  for (const [name, aliases] of DISTRICT_ALIASES) {
    if (aliases.some((alias) => new RegExp(`(^|\\W)${alias.replace(/\s+/g, "\\s+")}(?=\\W|$)`, "i").test(normalized))) {
      addDistrict(districts, name);
    }
  }

  // Contextual shorthand: "quận 1 3 10" already handled above. This also catches
  // "khu q1 3 10" without interpreting random standalone numbers as districts.
  const shorthand = normalized.match(/\b(?:q|quan|quan trung tam|khu vuc)\s*((?:1[0-2]|[1-9])(?:\s+(?:1[0-2]|[1-9])){1,})\b/);
  if (shorthand) shorthand[1].split(/\s+/).forEach((number) => addDistrict(districts, `Quận ${Number(number)}`));

  // Preserve accents when users write exact names in the original query.
  if (/bình thạnh/i.test(original)) addDistrict(districts, "Bình Thạnh");
  if (/phú nhuận/i.test(original)) addDistrict(districts, "Phú Nhuận");
  if (/tân bình/i.test(original)) addDistrict(districts, "Tân Bình");
  if (/gò vấp/i.test(original)) addDistrict(districts, "Gò Vấp");
  if (/tân phú/i.test(original)) addDistrict(districts, "Tân Phú");
  if (/thủ đức/i.test(original)) addDistrict(districts, "Thủ Đức");

  return unique(districts);
}

function parseWards(text = "") {
  const normalized = normalizeVietnameseText(text);
  const wards = [];
  for (const match of normalized.matchAll(/\b(?:p|phuong)\.?\s*(\d{1,2})\b/g)) {
    wards.push(`Phường ${Number(match[1])}`);
  }
  return unique(wards);
}

function parseStreets(text = "") {
  const streets = [];
  const source = String(text);
  for (const match of source.matchAll(/(?:đường|duong|duong)\s+([^,\n]+?)(?=\s+(?:q\.?|quận|quan|p\.?|phường|phuong)\b|,|\n|$)/giu)) {
    const street = match[1].trim().replace(/\s+/g, " ");
    if (street && !/\d+\s*(tr|triệu|m2|m²)/i.test(street)) streets.push(street);
  }
  return unique(streets);
}

export function parsePrice(text = "") {
  const normalized = normalizeVietnameseText(text);
  const clean = normalized
    .replace(/\bq\.?\s*\d{1,2}\b/g, " ")
    .replace(/\bquan\s+(?:1[0-2]|[1-9])(?:\s+(?:1[0-2]|[1-9]))*\b/g, " ")
    .replace(/\b(?:ngang|mat tien|dai|sau|chieu dai)\s*(?:tren|tu|toi thieu|>=)?\s*\d+(?:[.,]\d+)?\s*m?\b/g, " ")
    .replace(/\b(?:dien tich|dt)\s*(?:tren|tu|toi thieu|duoi|toi da|>=|<=)?\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)?\b/g, " ")
    .replace(/\b(?:tren|tu|duoi)\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/g, " ");

  const result = { minPrice: null, maxPrice: null };

  const range = clean.match(/(?:gia|tai chinh|ngan sach|tam|khoang)?\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?/);
  if (range) {
    const unit = range[4] || range[2] || "tr";
    result.minPrice = toVnd(range[1], unit, clean);
    result.maxPrice = toVnd(range[3], unit, clean);
    return result;
  }

  const maxPatterns = [
    /(?:duoi|toi da|khong qua|nho hon|ngan sach|tai chinh)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?/,
    /(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?\s*(?:do lai|tro lai)/,
  ];
  for (const pattern of maxPatterns) {
    const match = clean.match(pattern);
    if (match) {
      result.maxPrice = toVnd(match[1], match[2] || "tr", clean);
      break;
    }
  }

  const min = clean.match(/(?:tren|tu|toi thieu|hon)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)\b/);
  if (min) result.minPrice = toVnd(min[1], min[2], clean);

  if (result.minPrice == null && result.maxPrice == null) {
    const budget = clean.match(/(?:gia|tai chinh|ngan sach|thue|tam|khoang)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?/);
    if (budget) result.maxPrice = toVnd(budget[1], budget[2] || "tr", clean);
  }

  return result;
}

export function parseDimensions(text = "") {
  const normalized = normalizeVietnameseText(text);
  const result = {
    minArea: null,
    maxArea: null,
    minWidth: null,
    maxWidth: null,
    minDepth: null,
    maxDepth: null,
    minFloors: null,
    minBedrooms: null,
    minBathrooms: null,
  };

  const areaMin = normalized.match(/(?:dien tich|dt|m2)\s*(?:tren|tu|toi thieu|>=|lon hon)?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)?|(?:tren|tu)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/);
  if (areaMin) result.minArea = toNumber(areaMin[1] || areaMin[2]);

  const areaMax = normalized.match(/(?:dien tich|dt)?\s*(?:duoi|toi da|<=|nho hon)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/);
  if (areaMax) result.maxArea = toNumber(areaMax[1]);

  const width = normalized.match(/(?:ngang|mat tien)\s*(?:tren|tu|toi thieu|>=)?\s*(\d+(?:[.,]\d+)?)\s*m?(?:\s*tro len)?/);
  if (width) result.minWidth = toNumber(width[1]);

  const depth = normalized.match(/(?:dai|sau|chieu dai)\s*(?:tren|tu|toi thieu|>=)?\s*(\d+(?:[.,]\d+)?)\s*m?(?:\s*tro len)?/);
  if (depth) result.minDepth = toNumber(depth[1]);

  const floors = normalized.match(/(?:tren|tu|toi thieu)?\s*(\d+)\s*(?:lau|tang)\s*(?:tro len)?/);
  if (floors) result.minFloors = Number(floors[1]);

  const bedrooms = normalized.match(/(\d+)\s*(?:pn|phong ngu)\s*(?:tro len)?/);
  if (bedrooms) result.minBedrooms = Number(bedrooms[1]);

  const bathrooms = normalized.match(/(\d+)\s*(?:wc|toilet|nha ve sinh)\s*(?:tro len)?/);
  if (bathrooms) result.minBathrooms = Number(bathrooms[1]);

  return result;
}

export function parsePositionTypes(text = "") {
  const normalized = normalizeVietnameseText(text);
  const positionTypes = [];
  if (/\b(hxh|hem xe hoi|xe hoi vao duoc|oto vao duoc|o to vao duoc)\b/.test(normalized)) positionTypes.push("hẻm xe hơi");
  if (/\b(mat tien|mat pho|mt)\b/.test(normalized)) positionTypes.push("mặt tiền");
  if (/\b(2 mat tien|hai mat tien|goc|goc 2 mat tien)\b/.test(normalized)) {
    positionTypes.push("góc", "2 mặt tiền");
  }
  if (/\b(hem|nha hem)\b/.test(normalized) && !positionTypes.includes("hẻm xe hơi")) positionTypes.push("hẻm");
  return unique(positionTypes);
}

export function parseBusinessTypes(text = "") {
  const normalized = normalizeVietnameseText(text);
  const businessTypes = [];
  for (const group of BUSINESS_DICTIONARY) {
    if (group.keys.some((key) => normalized.includes(key))) {
      businessTypes.push(...group.values);
    }
  }
  return unique(businessTypes);
}

function parsePropertyTypes(text = "") {
  const normalized = normalizeVietnameseText(text);
  const propertyTypes = [];
  if (normalized.includes("nha nguyen can")) propertyTypes.push("nhà nguyên căn");
  if (normalized.includes("mat bang")) propertyTypes.push("mặt bằng");
  if (normalized.includes("toa nha")) propertyTypes.push("tòa nhà");
  return unique(propertyTypes);
}

function parseStatus(text = "") {
  const normalized = normalizeVietnameseText(text);
  if (/\b(da thue|het|bao het)\b/.test(normalized)) return "rented";
  if (/\b(con trong|dang trong|available)\b/.test(normalized)) return "available";
  return "available";
}

function applyAliases(filters) {
  const roadTypes = filters.positionTypes.map((type) => {
    if (type === "mặt tiền") return "Mặt tiền";
    if (type === "hẻm xe hơi") return "Hẻm xe hơi";
    if (type === "hẻm") return "Hẻm";
    if (type === "góc" || type === "2 mặt tiền") return "Góc 2 mặt tiền";
    return type;
  });

  return {
    ...filters,
    priceMin: filters.minPrice,
    priceMax: filters.maxPrice,
    areaMin: filters.minArea,
    areaMax: filters.maxArea,
    widthMin: filters.minWidth,
    lengthMin: filters.minDepth,
    floorsMin: filters.minFloors,
    roadTypes: unique(roadTypes),
    frontage: filters.positionTypes.includes("mặt tiền") || filters.positionTypes.includes("2 mặt tiền") ? true : null,
    keywords: unique([...filters.businessTypes, ...filters.propertyTypes]),
  };
}

function cleanParsedFilters(raw = {}) {
  const filters = {
    ...DEFAULT_PARSED_FILTERS,
    ...raw,
    districts: unique(raw.districts || []),
    wards: unique(raw.wards || []),
    streets: unique(raw.streets || []),
    positionTypes: unique(raw.positionTypes || []),
    businessTypes: unique(raw.businessTypes || []),
    propertyTypes: unique(raw.propertyTypes || []),
    minPrice: toNumber(raw.minPrice),
    maxPrice: toNumber(raw.maxPrice),
    minArea: toNumber(raw.minArea),
    maxArea: toNumber(raw.maxArea),
    minWidth: toNumber(raw.minWidth),
    maxWidth: toNumber(raw.maxWidth),
    minDepth: toNumber(raw.minDepth),
    maxDepth: toNumber(raw.maxDepth),
    minFloors: toNumber(raw.minFloors),
    minBedrooms: toNumber(raw.minBedrooms),
    minBathrooms: toNumber(raw.minBathrooms),
    status: raw.status || "available",
    rawQuery: raw.rawQuery || "",
  };
  return applyAliases(filters);
}

export function parseNaturalLanguageQuery(query = "") {
  const price = parsePrice(query);
  const dimensions = parseDimensions(query);
  return cleanParsedFilters({
    rawQuery: query,
    districts: parseDistricts(query),
    wards: parseWards(query),
    streets: parseStreets(query),
    positionTypes: parsePositionTypes(query),
    businessTypes: parseBusinessTypes(query),
    propertyTypes: parsePropertyTypes(query),
    status: parseStatus(query),
    ...price,
    ...dimensions,
  });
}

export async function parseCustomerRequest(text) {
  const parsed = parseNaturalLanguageQuery(text);
  console.log("[AI Suggest] parsed filters:", parsed);
  return parsed;
}

export function mergeParseResults(regexResult = {}, aiResult = {}) {
  return cleanParsedFilters({
    ...regexResult,
    ...aiResult,
    districts: unique([...(regexResult.districts || []), ...(aiResult.districts || [])]),
    wards: unique([...(regexResult.wards || []), ...(aiResult.wards || [])]),
    streets: unique([...(regexResult.streets || []), ...(aiResult.streets || [])]),
    positionTypes: unique([...(regexResult.positionTypes || []), ...(aiResult.positionTypes || [])]),
    businessTypes: unique([...(regexResult.businessTypes || []), ...(aiResult.businessTypes || [])]),
    propertyTypes: unique([...(regexResult.propertyTypes || []), ...(aiResult.propertyTypes || [])]),
  });
}

export function runAiParserExamples() {
  const cases = [
    "khách cần tìm quận 1 3 10, tài chính dưới 50, kinh doanh đồ ăn, mặt tiền",
    "cần mặt bằng q1 hoặc q3 dưới 80tr ngang trên 5m phù hợp cafe showroom",
    "tìm hẻm xe hơi bình thạnh phú nhuận giá 20-40 triệu diện tích trên 60m2",
    "khách mở spa cần nhà nguyên căn tân bình dưới 30tr 2pn trở lên",
    "mặt tiền quận 10 dưới 100 triệu ngang 6m",
  ];
  return cases.map((input) => ({ input, output: parseNaturalLanguageQuery(input) }));
}

globalThis.parseNaturalLanguageQuery = parseNaturalLanguageQuery;
globalThis.runAiParserExamples = runAiParserExamples;
