function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  if (typeof money === "function") return money(value);
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("vi-VN").format(number) + " đ";
}

function formatMillion(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(number / 1000000))} triệu/tháng`;
}

function getAddress(row) {
  if (typeof isAdmin === "function" && isAdmin()) return row.address || "";
  if (typeof maskAddress === "function") return maskAddress(row);
  return [row.street, row.ward, row.district].filter(Boolean).join(", ");
}

function formatSize(row) {
  const width = row.width ? `${row.width}m` : "?";
  const length = row.length ? `${row.length}m` : "?";
  if (row.width || row.length) return `${width} x ${length}`;
  return "-";
}

function renderReasonList(items = [], className = "") {
  if (!items.length) return "";
  return `
    <ul class="${className} mt-2 space-y-1 text-xs">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderUnderstanding(filters = {}) {
  if (!filters.rawQuery && !filters.districts?.length) return "";
  const rows = [];
  if (filters.districts?.length) rows.push(["Khu vực", filters.districts.join(", ")]);
  if (filters.wards?.length) rows.push(["Phường", filters.wards.join(", ")]);
  if (filters.streets?.length) rows.push(["Đường", filters.streets.join(", ")]);
  if (filters.minPrice) rows.push(["Giá tối thiểu", formatMillion(filters.minPrice)]);
  if (filters.maxPrice) rows.push(["Giá tối đa", formatMillion(filters.maxPrice)]);
  if (filters.minArea) rows.push(["Diện tích tối thiểu", `${filters.minArea} m²`]);
  if (filters.maxArea) rows.push(["Diện tích tối đa", `${filters.maxArea} m²`]);
  if (filters.minWidth) rows.push(["Ngang tối thiểu", `${filters.minWidth}m`]);
  if (filters.minDepth) rows.push(["Dài tối thiểu", `${filters.minDepth}m`]);
  if (filters.minFloors) rows.push(["Số tầng", `${filters.minFloors}+`]);
  if (filters.minBedrooms) rows.push(["Số phòng ngủ", `${filters.minBedrooms}+`]);
  if (filters.minBathrooms) rows.push(["Số WC", `${filters.minBathrooms}+`]);
  if (filters.positionTypes?.length) rows.push(["Vị trí", filters.positionTypes.join(", ")]);
  if (filters.businessTypes?.length) rows.push(["Ngành nghề", filters.businessTypes.slice(0, 8).join(" / ")]);
  if (filters.propertyTypes?.length) rows.push(["Loại nhà", filters.propertyTypes.join(", ")]);

  return `
    <div class="ai-understood-card">
      <div class="ai-understood-head">
        <b>Đã hiểu yêu cầu</b>
        <span>${escapeHtml(filters.rawQuery || "")}</span>
      </div>
      <div class="ai-understood-grid">
        ${rows.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <b>${escapeHtml(value)}</b>
          </div>
        `).join("") || `<p>Chưa nhận diện được điều kiện rõ ràng. Hãy nhập thêm quận, giá hoặc nhu cầu kinh doanh.</p>`}
      </div>
    </div>
  `;
}

function renderBadges(row) {
  const badges = row.ai_badges || [];
  if (!badges.length) return "";
  return `
    <div class="ai-match-badges">
      ${badges.slice(0, 4).map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
    </div>
  `;
}

function renderCard(row) {
  const score = Number(row.ai_score || row.matchScore || 0);
  const scoreClass = score >= 80 ? "badge-success" : score >= 60 ? "badge-warning" : "badge-ghost";
  const relaxed = row.ai_relaxed ? `
    <div class="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-700">
      ${escapeHtml((row.ai_relaxed_steps || []).join(", "))}
    </div>
  ` : "";

  return `
    <article class="ai-suggest-card bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-bold text-sm text-slate-900 truncate">${escapeHtml(row.code || row.id || "Mặt bằng")}</div>
          <div class="text-xs text-slate-600 mt-1 line-clamp-2">${escapeHtml(getAddress(row) || "-")}</div>
          <div class="text-xs text-slate-500 mt-1">${escapeHtml([row.ward, row.district].filter(Boolean).join(", ") || "-")}</div>
        </div>
        <span class="badge ${scoreClass} shrink-0">Phù hợp ${score}%</span>
      </div>

      ${renderBadges(row)}

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
        <div class="rounded-lg bg-slate-50 px-2 py-1">
          <div class="text-slate-500">Giá</div>
          <div class="font-semibold text-blue-600">${escapeHtml(formatMoney(row.price))}</div>
        </div>
        <div class="rounded-lg bg-slate-50 px-2 py-1">
          <div class="text-slate-500">Diện tích</div>
          <div class="font-semibold">${escapeHtml(row.area ? `${row.area}m²` : "-")}</div>
        </div>
        <div class="rounded-lg bg-slate-50 px-2 py-1">
          <div class="text-slate-500">Ngang/dài</div>
          <div class="font-semibold">${escapeHtml(formatSize(row))}</div>
        </div>
        <div class="rounded-lg bg-slate-50 px-2 py-1">
          <div class="text-slate-500">Trạng thái</div>
          <div class="font-semibold">${escapeHtml(row.status || "-")}</div>
        </div>
      </div>

      ${renderReasonList(row.ai_reasons, "text-emerald-700")}
      ${renderReasonList(row.ai_warnings, "text-amber-700")}
      ${relaxed}

      <div class="mt-3 flex justify-end">
        <button type="button" class="btn btn-xs btn-primary" data-ai-open-detail="${escapeHtml(row.id)}">
          Xem chi tiết
        </button>
      </div>
    </article>
  `;
}

export function renderAISuggestions(results = [], containerId = "ai-suggest-result", parsedFilters = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const filters = parsedFilters || results.parsedFilters || globalThis.LAST_AI_PARSED_FILTERS || {};
  const relaxed = results.relaxed || results.some?.((row) => row.ai_relaxed);
  const relaxedMessage = relaxed ? `
    <div class="ai-near-match-note">
      Không có mặt bằng khớp 100%, đang hiển thị nguồn gần phù hợp nhất.
    </div>
  ` : "";

  if (!results.length) {
    container.innerHTML = `
      ${renderUnderstanding(filters)}
      <div class="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
        Không tìm thấy mặt bằng phù hợp
      </div>
    `;
    return;
  }

  container.innerHTML = `
    ${renderUnderstanding(filters)}
    ${relaxedMessage}
    <div class="flex items-center justify-between gap-2 mb-2 mt-3">
      <h3 class="font-semibold text-sm text-slate-900">Gợi ý tốt nhất</h3>
      <span class="text-xs text-slate-500">${results.length} kết quả, sắp xếp theo điểm phù hợp</span>
    </div>
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      ${results.map(renderCard).join("")}
    </div>
  `;

  container.querySelectorAll("[data-ai-open-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-ai-open-detail");
      if (typeof openDetail === "function") openDetail(id);
    });
  });
}
