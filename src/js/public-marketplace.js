function getDbClient() {
  if (globalThis.db) return globalThis.db;
  if (typeof db !== "undefined") return db;
  return null;
}

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
  if (!Number.isFinite(number)) return "Đang cập nhật";
  return new Intl.NumberFormat("vi-VN").format(number) + " đ";
}

function getImageUrl(row) {
  let firstPath = null;
  if (Array.isArray(row.images) && row.images.length > 0) firstPath = row.images[0];
  else if (typeof row.images === "string" && row.images.trim()) {
    try {
      firstPath = row.images.startsWith("[") ? JSON.parse(row.images)[0] : row.images.split(/[\n;,]+/)[0];
    } catch {
      firstPath = null;
    }
  }
  if (!firstPath) return "";
  if (typeof buildImageUrl === "function") return buildImageUrl(firstPath);
  return firstPath;
}

function safeTitle(row) {
  if (typeof buildTitle === "function") {
    try {
      return buildTitle(row);
    } catch {
      return row.street || row.code || "Mặt bằng Môi giới Pro";
    }
  }
  return row.street || row.code || "Mặt bằng Môi giới Pro";
}

function publicAddress(row) {
  return [row.ward, row.district].filter(Boolean).join(", ") || row.district || "TP.HCM";
}

function getBusinessLabel(row) {
  const text = [row.detail, row.road_type, row.ket_cau].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("cafe") || text.includes("cà phê")) return "Cafe / F&B";
  if (text.includes("showroom")) return "Showroom";
  if (text.includes("spa") || text.includes("nail")) return "Spa / dịch vụ";
  if (text.includes("văn phòng") || text.includes("van phong")) return "Văn phòng";
  return "Đa ngành nghề";
}

function copyPublicDescription(row) {
  const text = [
    safeTitle(row),
    `Khu vực: ${publicAddress(row)}`,
    `Giá thuê: ${formatMoney(row.price)}`,
    row.width && row.length ? `Kích thước: ${row.width} x ${row.length}m` : "",
    row.area ? `Diện tích: ${row.area}m2` : "",
    `Phù hợp: ${getBusinessLabel(row)}`,
    "Đăng nhập Môi giới Pro để xem thông tin đầy đủ."
  ].filter(Boolean).join("\n");

  navigator.clipboard?.writeText(text)
    .then(() => typeof toast === "function" && toast("Đã copy mô tả rút gọn"))
    .catch(() => window.alert(text));
}

function openLogin(mode = "login") {
  const target = document.getElementById("login-card");
  if (typeof setAuthMode === "function") setAuthMode(mode);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openPublicDetail(row) {
  const dlg = document.getElementById("publicDetailDlg");
  const content = document.getElementById("public-detail-content");
  if (!dlg || !content) return;

  const imageUrl = getImageUrl(row);
  content.innerHTML = `
    <div class="public-detail-preview">
      <div class="public-detail-image">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Mặt bằng" />` : `<div>Chưa có ảnh công khai</div>`}
      </div>
      <div>
        <span class="badge badge-success text-white border-none">Nguồn nổi bật</span>
        <h3>${escapeHtml(safeTitle(row))}</h3>
        <p>${escapeHtml(publicAddress(row))}</p>
        <strong>${escapeHtml(formatMoney(row.price))}</strong>
        <div class="public-card-specs mt-3">
          ${row.width && row.length ? `<span>${escapeHtml(row.width)} x ${escapeHtml(row.length)}m</span>` : ""}
          ${row.area ? `<span>${escapeHtml(row.area)}m²</span>` : ""}
          ${row.pn ? `<span>${escapeHtml(row.pn)} PN</span>` : ""}
          <span>${escapeHtml(getBusinessLabel(row))}</span>
        </div>
        <div class="public-permission-note">
          Trang public không hiển thị số điện thoại chủ nhà. Đăng nhập để dùng AI search, lưu tin và xem thông tin theo quyền tài khoản.
        </div>
        <button class="btn btn-primary btn-sm mt-3" data-public-login>Đăng nhập để xem đầy đủ</button>
      </div>
    </div>
  `;
  content.querySelector("[data-public-login]")?.addEventListener("click", () => openLogin("login"));
  dlg.showModal();
}

function renderPublicListings(rows = []) {
  const grid = document.getElementById("public-listing-grid");
  if (!grid) return;
  if (!rows.length) {
    grid.innerHTML = `<div class="public-loading">Hiện chưa có nguồn nổi bật. Vui lòng quay lại sau.</div>`;
    return;
  }

  grid.innerHTML = rows.map((row) => {
    const imageUrl = getImageUrl(row);
    return `
      <article class="public-listing-card" data-public-id="${escapeHtml(row.id)}">
        <div class="public-card-media">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Mặt bằng" loading="lazy" decoding="async" />` : `<div class="public-no-image">No image</div>`}
          <div class="public-card-badges">
            <span>${row.status === "rented" ? "Đã thuê" : "Còn trống"}</span>
            <span>Nguồn nổi bật</span>
          </div>
        </div>
        <div class="public-card-body">
          <h3>${escapeHtml(safeTitle(row))}</h3>
          <div class="public-card-price">${escapeHtml(formatMoney(row.price))}</div>
          <p>${escapeHtml(publicAddress(row))}</p>
          <div class="public-card-specs">
            ${row.width && row.length ? `<span>${escapeHtml(row.width)}x${escapeHtml(row.length)}m</span>` : ""}
            ${row.area ? `<span>${escapeHtml(row.area)}m²</span>` : ""}
            ${row.pn ? `<span>${escapeHtml(row.pn)}PN</span>` : ""}
          </div>
          <div class="public-business">Phù hợp: ${escapeHtml(getBusinessLabel(row))}</div>
          <div class="public-card-actions">
            <button class="btn btn-xs btn-ghost" data-public-save="${escapeHtml(row.id)}">Lưu</button>
            <button class="btn btn-xs btn-outline" data-public-copy="${escapeHtml(row.id)}">Copy mô tả</button>
            <button class="btn btn-xs btn-primary" data-public-detail="${escapeHtml(row.id)}">Đăng nhập để xem chi tiết</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-public-save]").forEach((btn) => btn.addEventListener("click", () => openLogin("register")));
  grid.querySelectorAll("[data-public-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows.find((item) => item.id === btn.getAttribute("data-public-copy"));
      if (row) copyPublicDescription(row);
    });
  });
  grid.querySelectorAll("[data-public-detail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows.find((item) => item.id === btn.getAttribute("data-public-detail"));
      if (row) openPublicDetail(row);
    });
  });
}

async function loadPublicListings() {
  const client = getDbClient();
  if (!client) return;
  const { data, error } = await client
    .from("premises")
    .select("id,code,images,price,area,width,length,pn,status,ward,district,street,detail,road_type,ket_cau,is_featured,featured_order,featured_at")
    .eq("is_approved", true)
    .eq("is_featured", true)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("status.is.null,status.eq.available,status.eq.deposited")
    .order("featured_order", { ascending: true, nullsFirst: false })
    .order("featured_at", { ascending: false, nullsFirst: false })
    .limit(12);

  if (error) {
    console.warn("[Public Marketplace] load failed:", error);
    renderPublicListings([]);
    return;
  }
  renderPublicListings(data || []);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-public-login]").forEach((el) => el.addEventListener("click", () => openLogin("login")));
  document.querySelectorAll("[data-public-register]").forEach((el) => el.addEventListener("click", () => openLogin("register")));
  document.getElementById("btn-open-register")?.addEventListener("click", () => openLogin("register"));
  loadPublicListings();
});

globalThis.loadPublicListings = loadPublicListings;
