function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function getListingText(row) {
  return normalizeText([
    row?.title,
    row?.code,
    row?.address,
    row?.street,
    row?.ward,
    row?.district,
    row?.description,
    row?.detail,
    row?.suitable_for,
    row?.business_type,
    row?.tags,
    row?.note,
    row?.ket_cau,
    row?.road_type,
    row?.frontage ? "mat tien" : "",
  ].filter(Boolean).join(" "));
}

function hasImages(row) {
  const images = row?.images;
  if (Array.isArray(images)) return images.length > 0;
  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return false;
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed);
    } catch {
      return true;
    }
  }
  return false;
}

function isAvailableStatus(status) {
  const normalized = normalizeText(status);
  return !normalized || normalized === "available" || normalized.includes("con trong");
}

function isRentedStatus(status) {
  const normalized = normalizeText(status);
  return normalized === "rented" || normalized.includes("da thue") || normalized.includes("het");
}

function matchesDistrict(row, filters) {
  if (!filters.districts?.length) return true;
  const rowDistrict = normalizeText(row.district);
  return filters.districts.some((district) => rowDistrict === normalizeText(district));
}

function matchesPosition(row, filters) {
  if (!filters.positionTypes?.length && !filters.roadTypes?.length) return true;
  const text = getListingText(row);
  return [...(filters.positionTypes || []), ...(filters.roadTypes || [])].some((type) => {
    const normalized = normalizeText(type);
    if (normalized.includes("mat tien")) return row.frontage === true || text.includes("mat tien") || text.includes("mt");
    if (normalized.includes("hem xe hoi")) return text.includes("hem xe hoi") || text.includes("hxh") || text.includes("xe hoi");
    if (normalized === "hem") return text.includes("hem");
    if (normalized.includes("goc") || normalized.includes("2 mat tien")) return text.includes("goc") || text.includes("2 mat tien") || text.includes("hai mat tien");
    return text.includes(normalized);
  });
}

function matchesBusiness(row, filters) {
  if (!filters.businessTypes?.length) return true;
  const text = getListingText(row);
  return filters.businessTypes.some((type) => text.includes(normalizeText(type)));
}

export function scoreListingMatch(row = {}, filters = {}) {
  let score = 0;
  const reasons = [];
  const warnings = [];
  const badges = [];

  const price = toNumber(row.price);
  const area = toNumber(row.area);
  const width = toNumber(row.width);
  const depth = toNumber(row.length);
  const floors = toNumber(row.floors);
  const bedrooms = toNumber(row.pn || row.so_pn || row.bedrooms || row.rooms);
  const bathrooms = toNumber(row.wc || row.bathrooms);

  if (filters.districts?.length) {
    if (matchesDistrict(row, filters)) {
      score += 25;
      addUnique(reasons, "Đúng khu vực khách yêu cầu");
      addUnique(badges, "Đúng quận");
    } else {
      score -= 45;
      addUnique(warnings, "Sai khu vực khách đã chỉ định");
    }
  } else {
    score += 8;
  }

  if (filters.minPrice || filters.maxPrice) {
    const inMin = !filters.minPrice || (price != null && price >= filters.minPrice);
    const inMax = !filters.maxPrice || (price != null && price <= filters.maxPrice);
    if (inMin && inMax) {
      score += 25;
      addUnique(reasons, "Giá nằm trong ngân sách");
      addUnique(badges, "Đúng giá");
    } else if (filters.maxPrice && price != null && price > filters.maxPrice) {
      const overRatio = (price - filters.maxPrice) / filters.maxPrice;
      score -= overRatio > 0.15 ? 35 : 20;
      addUnique(warnings, `Giá vượt ngân sách khoảng ${Math.max(1, Math.round(overRatio * 100))}%`);
    } else {
      addUnique(warnings, "Thiếu dữ liệu giá hoặc chưa đúng khoảng giá");
    }
  } else {
    score += 8;
  }

  if (filters.positionTypes?.length || filters.roadTypes?.length) {
    if (matchesPosition(row, filters)) {
      score += 15;
      addUnique(reasons, "Đúng loại vị trí khách yêu cầu");
      if (filters.positionTypes?.includes("mặt tiền")) addUnique(badges, "Mặt tiền");
      if (filters.positionTypes?.includes("hẻm xe hơi")) addUnique(badges, "Hẻm xe hơi");
    } else {
      score -= 25;
      addUnique(warnings, "Chưa khớp loại vị trí yêu cầu");
    }
  }

  let dimensionScore = 0;
  const dimensionChecks = [
    [filters.minArea, area, "Diện tích đạt yêu cầu tối thiểu"],
    [filters.maxArea ? -filters.maxArea : null, area ? -area : null, "Diện tích không vượt mức tối đa"],
    [filters.minWidth, width, "Ngang nhà đạt yêu cầu tối thiểu"],
    [filters.minDepth, depth, "Chiều dài đạt yêu cầu tối thiểu"],
    [filters.minFloors, floors, "Số tầng đạt yêu cầu"],
    [filters.minBedrooms, bedrooms, "Số phòng ngủ đạt yêu cầu"],
    [filters.minBathrooms, bathrooms, "Số WC đạt yêu cầu"],
  ].filter(([need]) => need != null);

  if (dimensionChecks.length) {
    for (const [need, actual, reason] of dimensionChecks) {
      if (actual != null && actual >= need) {
        dimensionScore += 15 / dimensionChecks.length;
        addUnique(reasons, reason);
      } else if (actual == null) {
        addUnique(warnings, "Thiếu dữ liệu kích thước/phòng để đối chiếu");
      }
    }
    score += dimensionScore;
  }

  if (filters.businessTypes?.length) {
    if (matchesBusiness(row, filters)) {
      score += 15;
      addUnique(reasons, `Mô tả phù hợp ngành ${filters.businessTypes.slice(0, 3).join("/")}`);
      addUnique(badges, "Đúng ngành");
    } else {
      score -= 8;
      addUnique(warnings, "Chưa thấy mô tả khớp ngành nghề yêu cầu");
    }
  }

  if (isAvailableStatus(row.status)) {
    score += 5;
    addUnique(reasons, "Mặt bằng đang còn trống");
  }

  if (isRentedStatus(row.status)) {
    score -= 50;
    addUnique(warnings, "Mặt bằng đã thuê, đưa xuống cuối");
  }

  if (!hasImages(row)) {
    score -= 5;
    addUnique(warnings, "Không có hình ảnh");
  }

  return {
    ...row,
    matchScore: clampScore(score),
    ai_score: clampScore(score),
    ai_reasons: reasons,
    ai_warnings: warnings,
    ai_badges: badges,
  };
}

export function scorePremises(rows = [], filters = {}) {
  return rows.map((row) => scoreListingMatch(row, filters));
}

export function applyAiFilters(listings = [], parsedFilters = {}) {
  return scorePremises(listings, parsedFilters)
    .filter((row) => {
      if (parsedFilters.districts?.length && !matchesDistrict(row, parsedFilters)) return false;
      if (parsedFilters.maxPrice && toNumber(row.price) != null && toNumber(row.price) > parsedFilters.maxPrice * 1.25) return false;
      return true;
    })
    .sort((a, b) => b.ai_score - a.ai_score);
}

globalThis.scoreListingMatch = scoreListingMatch;
globalThis.applyAiFilters = applyAiFilters;
