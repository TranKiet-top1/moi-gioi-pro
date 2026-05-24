    (function () {
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

      const BUSINESS_GROUPS = [
        { keys: ["do an", "an uong", "quan an", "nha hang", "bun pho", "f&b", "fnb", "food"], values: ["đồ ăn", "ăn uống", "quán ăn", "nhà hàng", "F&B", "cafe"] },
        { keys: ["cafe", "ca phe", "coffee"], values: ["cafe", "cà phê", "coffee", "F&B"] },
        { keys: ["spa", "nail", "salon", "lam dep"], values: ["spa", "nail", "salon", "làm đẹp"] },
        { keys: ["showroom", "trung bay", "cua hang", "shop"], values: ["showroom", "cửa hàng", "shop"] },
        { keys: ["van phong", "office", "cty", "cong ty"], values: ["văn phòng", "office", "công ty"] },
        { keys: ["kho", "xuong", "luu hang"], values: ["kho", "xưởng"] },
      ];

      function normalizeText(value = "") {
        return String(value)
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
        const u = normalizeText(unit);
        const c = normalizeText(context);
        if (u.includes("ty") || u.includes("ti")) return Math.round(amount * 1000000000);
        if (u.includes("tr") || u.includes("trieu") || u === "m") return Math.round(amount * 1000000);
        if (amount < 1000 && /(gia|thue|tai chinh|ngan sach|duoi|tren|tam|khoang|den|toi)/.test(c)) return Math.round(amount * 1000000);
        return Math.round(amount);
      }

      function addDistrict(out, district) {
        if (district && !out.includes(district)) out.push(district);
      }

      function parseDistricts(text) {
        const normalized = normalizeText(text);
        const districts = [];
        for (const match of normalized.matchAll(/\bq\.?\s*(1[0-2]|[1-9])\b/g)) {
          addDistrict(districts, `Quận ${Number(match[1])}`);
        }
        for (const match of normalized.matchAll(/\bquan\s+((?:1[0-2]|[1-9])(?:\s+(?:1[0-2]|[1-9]))*)\b/g)) {
          match[1].split(/\s+/).forEach((number) => addDistrict(districts, `Quận ${Number(number)}`));
        }
        for (const [name, aliases] of DISTRICT_ALIASES) {
          if (aliases.some((alias) => new RegExp(`(^|\\W)${alias.replace(/\s+/g, "\\s+")}(?=\\W|$)`, "i").test(normalized))) addDistrict(districts, name);
        }
        return unique(districts);
      }

      function parsePrice(text) {
        const normalized = normalizeText(text);
        const clean = normalized
          .replace(/\bq\.?\s*\d{1,2}\b/g, " ")
          .replace(/\bquan\s+(?:1[0-2]|[1-9])(?:\s+(?:1[0-2]|[1-9]))*\b/g, " ")
          .replace(/\b(?:ngang|mat tien|dai|sau|chieu dai)\s*(?:tren|tu|toi thieu|>=)?\s*\d+(?:[.,]\d+)?\s*m?\b/g, " ")
          .replace(/\b(?:dien tich|dt)\s*(?:tren|tu|toi thieu|duoi|toi da|>=|<=)?\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)?\b/g, " ")
          .replace(/\b(?:tren|tu|duoi)\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/g, " ");

        const out = { minPrice: null, maxPrice: null };
        const range = clean.match(/(?:gia|tai chinh|ngan sach|tam|khoang)?\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?/);
        if (range) {
          const unit = range[4] || range[2] || "tr";
          out.minPrice = toVnd(range[1], unit, clean);
          out.maxPrice = toVnd(range[3], unit, clean);
          return out;
        }
        const max = clean.match(/(?:duoi|toi da|khong qua|nho hon|ngan sach|tai chinh)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?|(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?\s*(?:do lai|tro lai)/);
        if (max) out.maxPrice = toVnd(max[1] || max[3], max[2] || max[4] || "tr", clean);
        const min = clean.match(/(?:tren|tu|toi thieu|hon)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)\b/);
        if (min) out.minPrice = toVnd(min[1], min[2], clean);
        const budget = clean.match(/(?:gia|tai chinh|ngan sach|thue|tam|khoang)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m|ty|ti)?/);
        if (!out.minPrice && !out.maxPrice && budget) out.maxPrice = toVnd(budget[1], budget[2] || "tr", clean);
        return out;
      }

      function parseDimensions(text) {
        const n = normalizeText(text);
        const out = { minArea: null, maxArea: null, minWidth: null, minDepth: null, minFloors: null, minBedrooms: null, minBathrooms: null };
        const areaMin = n.match(/(?:dien tich|dt)\s*(?:tren|tu|toi thieu|>=|lon hon)?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)?|(?:tren|tu)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/);
        if (areaMin) out.minArea = toNumber(areaMin[1] || areaMin[2]);
        const areaMax = n.match(/(?:dien tich|dt)?\s*(?:duoi|toi da|<=|nho hon)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/);
        if (areaMax) out.maxArea = toNumber(areaMax[1]);
        const width = n.match(/(?:ngang|mat tien)\s*(?:tren|tu|toi thieu|>=)?\s*(\d+(?:[.,]\d+)?)\s*m?(?:\s*tro len)?/);
        if (width) out.minWidth = toNumber(width[1]);
        const depth = n.match(/(?:dai|sau|chieu dai)\s*(?:tren|tu|toi thieu|>=)?\s*(\d+(?:[.,]\d+)?)\s*m?(?:\s*tro len)?/);
        if (depth) out.minDepth = toNumber(depth[1]);
        const floors = n.match(/(?:tren|tu|toi thieu)?\s*(\d+)\s*(?:lau|tang)\s*(?:tro len)?/);
        if (floors) out.minFloors = Number(floors[1]);
        const bedrooms = n.match(/(\d+)\s*(?:pn|phong ngu)\s*(?:tro len)?/);
        if (bedrooms) out.minBedrooms = Number(bedrooms[1]);
        const bathrooms = n.match(/(\d+)\s*(?:wc|toilet|nha ve sinh)\s*(?:tro len)?/);
        if (bathrooms) out.minBathrooms = Number(bathrooms[1]);
        return out;
      }

      function parsePositionTypes(text) {
        const n = normalizeText(text);
        const out = [];
        if (/\b(hxh|hem xe hoi|xe hoi vao duoc|oto vao duoc|o to vao duoc)\b/.test(n)) out.push("hẻm xe hơi");
        if (/\b(mat tien|mat pho|mt)\b/.test(n)) out.push("mặt tiền");
        if (/\b(2 mat tien|hai mat tien|goc|goc 2 mat tien)\b/.test(n)) out.push("góc", "2 mặt tiền");
        if (/\b(hem|nha hem)\b/.test(n) && !out.includes("hẻm xe hơi")) out.push("hẻm");
        return unique(out);
      }

      function parseBusinessTypes(text) {
        const n = normalizeText(text);
        const out = [];
        BUSINESS_GROUPS.forEach((group) => {
          if (group.keys.some((key) => n.includes(key))) out.push(...group.values);
        });
        return unique(out);
      }

      function parsePropertyTypes(text) {
        const n = normalizeText(text);
        const out = [];
        if (n.includes("nha nguyen can")) out.push("nhà nguyên căn");
        if (n.includes("mat bang")) out.push("mặt bằng");
        if (n.includes("toa nha")) out.push("tòa nhà");
        return unique(out);
      }

      function parseNaturalLanguageQuery(query = "") {
        const price = parsePrice(query);
        const dims = parseDimensions(query);
        const positionTypes = parsePositionTypes(query);
        const roadTypes = positionTypes.map((type) => type === "mặt tiền" ? "Mặt tiền" : type === "hẻm xe hơi" ? "Hẻm xe hơi" : type === "hẻm" ? "Hẻm" : type);
        return {
          rawQuery: query,
          districts: parseDistricts(query),
          wards: [],
          streets: [],
          ...price,
          ...dims,
          positionTypes,
          businessTypes: parseBusinessTypes(query),
          propertyTypes: parsePropertyTypes(query),
          status: "available",
          priceMin: price.minPrice,
          priceMax: price.maxPrice,
          areaMin: dims.minArea,
          areaMax: dims.maxArea,
          widthMin: dims.minWidth,
          lengthMin: dims.minDepth,
          floorsMin: dims.minFloors,
          roadTypes,
          frontage: positionTypes.includes("mặt tiền") || positionTypes.includes("2 mặt tiền") ? true : null,
          keywords: unique([...parseBusinessTypes(query), ...parsePropertyTypes(query)]),
        };
      }

      function listingText(row) {
        return normalizeText([row.title, row.code, row.address, row.street, row.ward, row.district, row.description, row.detail, row.suitable_for, row.business_type, row.tags, row.note, row.ket_cau, row.road_type, row.frontage ? "mat tien" : ""].filter(Boolean).join(" "));
      }

      function matchesDistrict(row, filters) {
        if (!filters.districts.length) return true;
        return filters.districts.some((d) => normalizeText(row.district) === normalizeText(d));
      }

      function matchesPosition(row, filters) {
        if (!filters.positionTypes.length) return true;
        const text = listingText(row);
        return filters.positionTypes.some((type) => {
          const n = normalizeText(type);
          if (n.includes("mat tien")) return row.frontage === true || text.includes("mat tien") || text.includes("mt");
          if (n.includes("hem xe hoi")) return text.includes("hem xe hoi") || text.includes("hxh") || text.includes("xe hoi");
          if (n === "hem") return text.includes("hem");
          if (n.includes("goc") || n.includes("2 mat tien")) return text.includes("goc") || text.includes("2 mat tien") || text.includes("hai mat tien");
          return text.includes(n);
        });
      }

      function matchesBusiness(row, filters) {
        if (!filters.businessTypes.length) return true;
        const text = listingText(row);
        return filters.businessTypes.some((type) => text.includes(normalizeText(type)));
      }

      function addUnique(list, value) {
        if (value && !list.includes(value)) list.push(value);
      }

      function scoreListingMatch(row, filters) {
        let score = 0;
        const reasons = [];
        const warnings = [];
        const badges = [];
        const price = toNumber(row.price);
        const area = toNumber(row.area);
        const width = toNumber(row.width);
        const depth = toNumber(row.length);
        const bedrooms = toNumber(row.pn || row.so_pn || row.bedrooms || row.rooms);

        if (filters.districts.length) {
          if (matchesDistrict(row, filters)) { score += 25; addUnique(reasons, "Đúng khu vực khách yêu cầu"); addUnique(badges, "Đúng quận"); }
          else { score -= 45; addUnique(warnings, "Sai khu vực khách đã chỉ định"); }
        } else score += 8;

        if (filters.minPrice || filters.maxPrice) {
          const okMin = !filters.minPrice || (price != null && price >= filters.minPrice);
          const okMax = !filters.maxPrice || (price != null && price <= filters.maxPrice);
          if (okMin && okMax) { score += 25; addUnique(reasons, "Giá nằm trong ngân sách"); addUnique(badges, "Đúng giá"); }
          else if (filters.maxPrice && price != null && price > filters.maxPrice) { score -= price > filters.maxPrice * 1.15 ? 35 : 20; addUnique(warnings, "Giá vượt ngân sách"); }
        } else score += 8;

        if (filters.positionTypes.length) {
          if (matchesPosition(row, filters)) { score += 15; addUnique(reasons, "Đúng loại vị trí khách yêu cầu"); if (filters.positionTypes.includes("mặt tiền")) addUnique(badges, "Mặt tiền"); }
          else { score -= 25; addUnique(warnings, "Chưa khớp loại vị trí yêu cầu"); }
        }

        const checks = [
          [filters.minArea, area, "Diện tích phù hợp"],
          [filters.minWidth, width, "Ngang nhà đạt yêu cầu"],
          [filters.minDepth, depth, "Chiều dài đạt yêu cầu"],
          [filters.minBedrooms, bedrooms, "Số phòng ngủ đạt yêu cầu"],
        ].filter(([need]) => need != null);
        checks.forEach(([need, actual, reason]) => {
          if (actual != null && actual >= need) { score += 15 / checks.length; addUnique(reasons, reason); }
        });

        if (filters.businessTypes.length) {
          if (matchesBusiness(row, filters)) { score += 15; addUnique(reasons, `Mô tả phù hợp ngành ${filters.businessTypes.slice(0, 3).join("/")}`); addUnique(badges, "Đúng ngành"); }
          else { score -= 8; addUnique(warnings, "Chưa thấy mô tả khớp ngành nghề yêu cầu"); }
        }

        if (!row.status || row.status === "available") { score += 5; addUnique(reasons, "Mặt bằng đang còn trống"); }
        if (row.status === "rented") { score -= 50; addUnique(warnings, "Mặt bằng đã thuê"); }

        score = Math.max(0, Math.min(100, Math.round(score)));
        return { ...row, matchScore: score, ai_score: score, ai_reasons: reasons, ai_warnings: warnings, ai_badges: badges };
      }

      async function queryPremisesByFilters(filters) {
        const safeColumns = [
          "id", "code", "images", "price", "area", "width", "length", "floors", "pn", "wc",
          "ket_cau", "road_type", "frontage", "status", "ward", "district", "street",
          "created_at", "updated_at", "is_approved"
        ].join(",");
        let query = db.from("public_premises_view").select(safeColumns).eq("is_approved", true);
        if (filters.status) query = query.eq("status", filters.status);
        if (filters.districts.length) query = query.in("district", filters.districts);
        if (filters.minPrice) query = query.gte("price", filters.minPrice);
        if (filters.maxPrice) query = query.lte("price", filters.maxPrice);
        if (filters.minArea) query = query.gte("area", filters.minArea);
        if (filters.maxArea) query = query.lte("area", filters.maxArea);
        if (filters.minWidth) query = query.gte("width", filters.minWidth);
        if (filters.minDepth) query = query.gte("length", filters.minDepth);
        if (filters.minBedrooms) query = query.gte("pn", filters.minBedrooms);
        const { data, error } = await query.order("updated_at", { ascending: false }).limit(180);
        if (error) throw error;
        let rows = (data || []).map((row) => scoreListingMatch(row, filters)).sort((a, b) => b.ai_score - a.ai_score);
        let relaxed = false;
        if (!rows.length && (filters.minWidth || filters.minArea || filters.minDepth || filters.minBedrooms)) {
          relaxed = true;
          let relaxedQuery = db.from("public_premises_view").select(safeColumns).eq("is_approved", true);
          if (filters.status) relaxedQuery = relaxedQuery.eq("status", filters.status);
          if (filters.districts.length) relaxedQuery = relaxedQuery.in("district", filters.districts);
          if (filters.maxPrice) relaxedQuery = relaxedQuery.lte("price", Math.round(filters.maxPrice * 1.1));
          const relaxedRes = await relaxedQuery.limit(180);
          if (relaxedRes.error) throw relaxedRes.error;
          rows = (relaxedRes.data || []).map((row) => scoreListingMatch(row, filters)).sort((a, b) => b.ai_score - a.ai_score);
        }
        return { rows, relaxed, relaxedSteps: relaxed ? ["Không có mặt bằng khớp 100%, đang hiển thị nguồn gần phù hợp nhất"] : [] };
      }

      function html(value = "") {
        return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      }

      function formatMillion(value) {
        return value ? `${Math.round(value / 1000000).toLocaleString("vi-VN")} triệu/tháng` : "";
      }

      function renderUnderstanding(filters) {
        const rows = [];
        if (filters.districts.length) rows.push(["Khu vực", filters.districts.join(", ")]);
        if (filters.minPrice) rows.push(["Giá tối thiểu", formatMillion(filters.minPrice)]);
        if (filters.maxPrice) rows.push(["Giá tối đa", formatMillion(filters.maxPrice)]);
        if (filters.minArea) rows.push(["Diện tích tối thiểu", `${filters.minArea} m²`]);
        if (filters.minWidth) rows.push(["Ngang tối thiểu", `${filters.minWidth}m`]);
        if (filters.minDepth) rows.push(["Dài tối thiểu", `${filters.minDepth}m`]);
        if (filters.minBedrooms) rows.push(["Số phòng ngủ", `${filters.minBedrooms}+`]);
        if (filters.positionTypes.length) rows.push(["Vị trí", filters.positionTypes.join(", ")]);
        if (filters.businessTypes.length) rows.push(["Ngành nghề", filters.businessTypes.slice(0, 8).join(" / ")]);
        if (filters.propertyTypes.length) rows.push(["Loại nhà", filters.propertyTypes.join(", ")]);
        return `<div class="ai-understood-card"><div class="ai-understood-head"><b>Đã hiểu yêu cầu</b><span>${html(filters.rawQuery)}</span></div><div class="ai-understood-grid">${rows.map(([k, v]) => `<div><span>${html(k)}</span><b>${html(v)}</b></div>`).join("")}</div></div>`;
      }

      function renderCard(row) {
        const scoreClass = row.ai_score >= 80 ? "badge-success" : row.ai_score >= 60 ? "badge-warning" : "badge-ghost";
        const address = typeof maskAddress === "function" ? maskAddress(row) : [row.street, row.ward, row.district].filter(Boolean).join(", ");
        return `<article class="ai-suggest-card bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="font-bold text-sm text-slate-900 truncate">${html(row.code || row.id || "Mặt bằng")}</div><div class="text-xs text-slate-600 mt-1 line-clamp-2">${html(address || "-")}</div><div class="text-xs text-slate-500 mt-1">${html([row.ward, row.district].filter(Boolean).join(", ") || "-")}</div></div><span class="badge ${scoreClass} shrink-0">Phù hợp ${row.ai_score}%</span></div>
          <div class="ai-match-badges">${(row.ai_badges || []).slice(0, 4).map((b) => `<span>${html(b)}</span>`).join("")}</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
            <div class="rounded-lg bg-slate-50 px-2 py-1"><div class="text-slate-500">Giá</div><div class="font-semibold text-blue-600">${typeof money === "function" ? money(row.price) : html(row.price || "-")}</div></div>
            <div class="rounded-lg bg-slate-50 px-2 py-1"><div class="text-slate-500">Diện tích</div><div class="font-semibold">${row.area ? `${html(row.area)}m²` : "-"}</div></div>
            <div class="rounded-lg bg-slate-50 px-2 py-1"><div class="text-slate-500">Ngang/dài</div><div class="font-semibold">${row.width || "?"} x ${row.length || "?"}</div></div>
            <div class="rounded-lg bg-slate-50 px-2 py-1"><div class="text-slate-500">Trạng thái</div><div class="font-semibold">${html(row.status || "-")}</div></div>
          </div>
          ${(row.ai_reasons || []).length ? `<ul class="mt-2 space-y-1 text-xs text-emerald-700">${row.ai_reasons.map((x) => `<li>${html(x)}</li>`).join("")}</ul>` : ""}
          ${(row.ai_warnings || []).length ? `<ul class="mt-2 space-y-1 text-xs text-amber-700">${row.ai_warnings.map((x) => `<li>${html(x)}</li>`).join("")}</ul>` : ""}
          <div class="mt-3 flex justify-end"><button type="button" class="btn btn-xs btn-primary" onclick="openDetail('${html(row.id)}')">Xem chi tiết</button></div>
        </article>`;
      }

      function renderAISuggestions(results, containerId = "ai-suggest-result", parsedFilters) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const relaxed = results.relaxed || results.some((row) => row.ai_relaxed);
        container.innerHTML = `
          ${renderUnderstanding(parsedFilters || window.LAST_AI_PARSED_FILTERS || {})}
          ${relaxed ? `<div class="ai-near-match-note">Không có mặt bằng khớp 100%, đang hiển thị nguồn gần phù hợp nhất.</div>` : ""}
          <div class="flex items-center justify-between gap-2 mb-2 mt-3"><h3 class="font-semibold text-sm text-slate-900">Gợi ý tốt nhất</h3><span class="text-xs text-slate-500">${results.length} kết quả</span></div>
          ${results.length ? `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${results.map(renderCard).join("")}</div>` : `<div class="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">Không tìm thấy mặt bằng phù hợp</div>`}
        `;
      }

      async function suggestPremisesFromRequest(text) {
        const filters = parseNaturalLanguageQuery(text);
        window.LAST_AI_PARSED_FILTERS = filters;
        const { rows, relaxed, relaxedSteps } = await queryPremisesByFilters(filters);
        const results = rows.slice(0, 30).map((row) => ({ ...row, ai_relaxed: relaxed, ai_relaxed_steps: relaxedSteps }));
        results.relaxed = relaxed;
        results.parsedFilters = filters;
        return results;
      }

      async function runAISuggestFromInput() {
        const btn = document.getElementById("btn-ai-suggest");
        const input = document.getElementById("ai-customer-request");
        if (!btn || !input) return;
        const text = input.value.trim();
        if (!text) {
          toast("Vui lòng nhập yêu cầu khách hàng");
          return;
        }
        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Đang tìm...";
        try {
          const results = await suggestPremisesFromRequest(text);
          renderAISuggestions(results, "ai-suggest-result", results.parsedFilters);
        } catch (err) {
          console.error(err);
          toast("Lỗi AI tìm mặt bằng: " + (err.message || err));
        } finally {
          btn.disabled = false;
          btn.textContent = old;
        }
      }

      function resetAISuggestions() {
        window.LAST_AI_PARSED_FILTERS = null;
        const input = document.getElementById("ai-customer-request");
        const result = document.getElementById("ai-suggest-result");
        if (input) input.value = "";
        if (result) result.innerHTML = "";
      }

      window.parseNaturalLanguageQuery = parseNaturalLanguageQuery;
      window.scoreListingMatch = scoreListingMatch;
      window.suggestPremisesFromRequest = suggestPremisesFromRequest;
      window.renderAISuggestions = renderAISuggestions;
      window.runAISuggestFromInput = runAISuggestFromInput;
      window.resetAISuggestions = resetAISuggestions;
    })();
