const DISTRICT_NAMES = [
  "Qu\u1eadn 1", "Qu\u1eadn 2", "Qu\u1eadn 3", "Qu\u1eadn 4", "Qu\u1eadn 5", "Qu\u1eadn 6",
  "Qu\u1eadn 7", "Qu\u1eadn 8", "Qu\u1eadn 9", "Qu\u1eadn 10", "Qu\u1eadn 11", "Qu\u1eadn 12",
  "B\u00ecnh T\u00e2n", "B\u00ecnh Th\u1ea1nh", "G\u00f2 V\u1ea5p", "Ph\u00fa Nhu\u1eadn",
  "T\u00e2n B\u00ecnh", "T\u00e2n Ph\u00fa", "Th\u1ee7 \u0110\u1ee9c", "Nh\u00e0 B\u00e8",
  "H\u00f3c M\u00f4n", "C\u1ee7 Chi", "B\u00ecnh Ch\u00e1nh", "C\u1ea7n Gi\u1edd"
];

const BUSINESS_TYPES = [
  "cafe", "c\u00e0 ph\u00ea", "coffee", "f&b", "spa", "showroom",
  "v\u0103n ph\u00f2ng", "van phong", "nha khoa", "ph\u00f2ng kh\u00e1m",
  "phong kham", "shop", "th\u1eddi trang", "thoi trang", "nh\u00e0 h\u00e0ng",
  "nha hang", "qu\u00e1n \u0103n", "quan an", "si\u00eau th\u1ecb", "sieu thi"
];

export function normalizeVietnameseText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function emptyResult() {
  return {
    district: null,
    ward: null,
    street: null,
    address: null,
    width: null,
    length: null,
    area: null,
    floors: null,
    bedrooms: null,
    wc: null,
    price: null,
    deposit_months: null,
    business_type: null,
    road_type: null,
  };
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function cleanLine(line = "") {
  return String(line).replace(/\s+/g, " ").trim();
}

function firstLine(text = "") {
  return cleanLine(String(text).split(/\n+/).find((line) => cleanLine(line)) || "");
}

function parsePrice(originalText, normalizedText) {
  const explicitMillionMatch = normalizedText.match(/(?:gia|gia thue|thue)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|m)\b/);
  if (explicitMillionMatch) return Math.round(toNumber(explicitMillionMatch[1]) * 1000000);

  const explicitBillionMatch = normalizedText.match(/(?:gia|gia thue|thue)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:ty|ti)\b/);
  if (explicitBillionMatch) return Math.round(toNumber(explicitBillionMatch[1]) * 1000000000);

  const directNumber = normalizedText.match(/(?:gia|gia thue|thue)\s*[:\-]?\s*(\d{7,12})\b/);
  if (directNumber) return Number(directNumber[1]);

  const millionMatches = [...normalizedText.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:tr|trieu)\b/g)];
  if (millionMatches.length) return Math.round(toNumber(millionMatches.at(-1)[1]) * 1000000);

  const shortMillionMatches = [...normalizedText.matchAll(/\b(\d+(?:[.,]\d+)?)\s*m\b/g)]
    .filter((match) => !/\b(?:hem|duong|lo|mat|mt)\s*$/.test(normalizedText.slice(Math.max(0, match.index - 12), match.index)));
  if (shortMillionMatches.length) return Math.round(toNumber(shortMillionMatches.at(-1)[1]) * 1000000);

  const billionMatch = normalizedText.match(/\b(\d+(?:[.,]\d+)?)\s*(?:ty|ti)\b/);
  if (billionMatch) return Math.round(toNumber(billionMatch[1]) * 1000000000);

  const looseNumber = originalText.match(/\b(\d{8,12})\b/);
  return looseNumber ? Number(looseNumber[1]) : null;
}

function parseDimensions(normalizedText) {
  const result = { width: null, length: null, area: null };
  const compact = normalizedText.match(/\b(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\b/);
  const labeled = normalizedText.match(/(?:ngang|mat tien|mt)\s*(\d+(?:[.,]\d+)?).*?(?:dai|sau|chieu dai)\s*(\d+(?:[.,]\d+)?)/);
  const match = compact || labeled;

  if (match) {
    result.width = toNumber(match[1]);
    result.length = toNumber(match[2]);
  }

  const areaMatch = normalizedText.match(/(?:dt|dien tich|area)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m\u00b2|met vuong)\b/);
  if (areaMatch) result.area = toNumber(areaMatch[1]);

  if (result.width && result.length) {
    result.area = Number((result.width * result.length).toFixed(2));
  }

  return result;
}

function parseFloors(normalizedText) {
  const lauMatch = normalizedText.match(/(\d+)\s*(?:lau|l\u1ea7u)/);
  if (lauMatch) return Number(lauMatch[1]);

  const tretLauMatch = normalizedText.match(/\b(?:tret|tr\u1ec7t)\s+(?:lau|l\u1ea7u)\b/);
  if (tretLauMatch) return 1;

  const tangMatch = normalizedText.match(/(\d+)\s*(?:tang|t\u1ea7ng)/);
  if (tangMatch) return Number(tangMatch[1]);

  const basementFloors = normalizedText.match(/\d+\s*ham\s*(\d+)\s*tang/);
  if (basementFloors) return Number(basementFloors[1]);

  return null;
}

function parseDistrict(normalizedText) {
  const qMatch = normalizedText.match(/\bq(?:uan|\.)?\s*\.?\s*(1[0-2]|\d)\b/);
  if (qMatch) return `Qu\u1eadn ${Number(qMatch[1])}`;

  for (const name of DISTRICT_NAMES) {
    if (normalizedText.includes(normalizeVietnameseText(name))) return name;
  }

  return null;
}

function parseWard(normalizedText) {
  const wardMatch = normalizedText.match(/\b(?:p|phuong|ph\u01b0\u1eddng)\.?\s*(\d+|[a-z\s]+?)(?=\s+q\.?|\s+quan|\s*$)/);
  if (!wardMatch) return null;
  const value = wardMatch[1].trim();
  return /^\d+$/.test(value) ? `Ph\u01b0\u1eddng ${Number(value)}` : `Ph\u01b0\u1eddng ${value}`;
}

function parseAddress(originalText) {
  const line = firstLine(originalText);
  if (!line) return null;
  const beforeWardDistrict = line.split(/\b(?:p|ph\u01b0\u1eddng|phuong)\.?\s*[\p{L}\d\s]+|\bq(?:u\u1eadn|uan|\.?)?\s*\d+/iu)[0];
  return cleanLine(beforeWardDistrict).replace(/[,\-\s]+$/g, "") || null;
}

function parseStreet(originalText, district) {
  const line = parseAddress(originalText) || firstLine(originalText);
  if (!line) return null;

  let street = line
    .replace(/^\s*\d+[\/\w.-]*\s+/i, "")
    .replace(/^\s*(mt|m\u1eb7t ti\u1ec1n|mat tien|hxh|h\u1ebbm xe h\u01a1i|hem xe hoi|h\u1ebbm|hem)\s+/i, "")
    .replace(/\bq(?:u\u1eadn|uan|\.?)?\s*\d+\b/gi, "")
    .replace(/\bqu\u1eadn\s*\d+\b/gi, "")
    .replace(/\bquan\s*\d+\b/gi, "")
    .replace(/\b(ph\u01b0\u1eddng|phuong|p\.|p\s+)\s*[\p{L}\d\s]+$/iu, "")
    .replace(/(^|\s)(\u0111\u01b0\u1eddng|duong)\s+/gi, " ")
    .trim();

  if (district) street = street.replace(new RegExp(district, "ig"), "").trim();

  DISTRICT_NAMES.forEach((name) => {
    street = street.replace(new RegExp(name, "ig"), "").trim();
  });

  return street
    .replace(/\b(hxh|h\u1ebbm|hem)\b.*$/i, "")
    .replace(/^[,\-\s]+|[,\-\s]+$/g, "")
    .replace(/\s+/g, " ") || null;
}

function parseRoadType(normalizedText) {
  if (/\b(hxh|hem xe hoi|xe hoi)\b/.test(normalizedText)) return "H\u1ebbm xe h\u01a1i";
  if (/\b(mt|mat tien|m\u1eb7t ti\u1ec1n)\b/.test(normalizedText)) return "M\u1eb7t ti\u1ec1n";
  if (/\b(hem|h\u1ebbm)\b/.test(normalizedText)) return "H\u1ebbm";
  return null;
}

function parseDepositMonths(normalizedText) {
  const match = normalizedText.match(/(?:coc|dat coc)\s*(\d+(?:[.,]\d+)?)\s*(?:thang|th)/);
  return match ? toNumber(match[1]) : null;
}

function parseBedrooms(normalizedText) {
  const match = normalizedText.match(/\b(\d+)\s*(?:pn|phong ngu|phong)\b/);
  return match ? Number(match[1]) : null;
}

function parseWc(normalizedText) {
  const match = normalizedText.match(/\b(\d+)\s*(?:wc|toilet|ve sinh)\b/);
  return match ? Number(match[1]) : null;
}

function parseBusinessType(originalText, normalizedText) {
  const intentMatch = originalText.match(/(?:ph\u00f9 h\u1ee3p|phu hop|kinh doanh|m\u00f4 h\u00ecnh|mo hinh)\s*[:\-]?\s*([^\n,.]+)/i);
  if (intentMatch) return intentMatch[1].trim() || null;

  const normalizedBusiness = BUSINESS_TYPES.find((type) => normalizedText.includes(normalizeVietnameseText(type)));
  return normalizedBusiness || null;
}

export function validateParseResult(raw = {}) {
  const result = emptyResult();
  Object.keys(result).forEach((key) => {
    result[key] = raw[key] ?? null;
  });

  ["width", "length", "area", "floors", "bedrooms", "wc", "price", "deposit_months"].forEach((key) => {
    result[key] = toNumber(result[key]);
  });

  if (result.width != null && result.width <= 0) result.width = null;
  if (result.length != null && result.length <= 0) result.length = null;
  if (result.area != null && result.area <= 0) result.area = null;
  if (result.floors != null && result.floors < 0) result.floors = null;
  if (result.bedrooms != null && result.bedrooms < 0) result.bedrooms = null;
  if (result.wc != null && result.wc < 0) result.wc = null;
  if (result.price != null && result.price <= 0) result.price = null;

  if (result.width && result.length) {
    const computedArea = Number((result.width * result.length).toFixed(2));
    if (!result.area || Math.abs(result.area - computedArea) > computedArea * 0.25) {
      result.area = computedArea;
    }
  }

  return result;
}

export function parsePremiseDescriptionWithRegex(text = "") {
  const originalText = String(text || "");
  const normalizedText = normalizeVietnameseText(originalText);
  const dimensions = parseDimensions(normalizedText);
  const district = parseDistrict(normalizedText);

  return validateParseResult({
    district,
    ward: parseWard(normalizedText),
    street: parseStreet(originalText, district),
    address: parseAddress(originalText),
    width: dimensions.width,
    length: dimensions.length,
    area: dimensions.area,
    floors: parseFloors(normalizedText),
    bedrooms: parseBedrooms(normalizedText),
    wc: parseWc(normalizedText),
    price: parsePrice(originalText, normalizedText),
    deposit_months: parseDepositMonths(normalizedText),
    business_type: parseBusinessType(originalText, normalizedText),
    road_type: parseRoadType(normalizedText),
  });
}
