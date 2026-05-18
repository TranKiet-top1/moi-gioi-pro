let DELETE_LISTING_TARGET_ID = null;

function getCurrentSubscriptionForPhone() {
  return CURRENT_SUBSCRIPTION || null;
}

function canViewOwnerPhone(user = CURRENT_USER, profile = { role: CURRENT_ROLE }, subscription = getCurrentSubscriptionForPhone()) {
  if (!user) return false;
  if (profile?.role === "admin") return true;
  const plan = String(subscription?.plan_type || subscription?.plan || subscription?.plan_name || "").toLowerCase();
  const status = subscription?.status;
  const expiresAt = subscription?.expires_at || subscription?.end_date;
  return (
    (plan === "basic" || plan === "pro") &&
    status === "active" &&
    (!expiresAt || new Date(expiresAt).getTime() > Date.now())
  );
}

function isAdminUser() {
  return typeof isAdmin === "function" && isAdmin();
}

function isPaidMember() {
  return canViewOwnerPhone();
}

function getPhoneRevealState() {
  if (!CURRENT_USER) return "guest";
  if (isAdminUser()) return "admin";
  if (isPaidMember()) return "paid-hidden";
  return "free";
}

function openPricingUpgrade() {
  toast("Tính năng xem số điện thoại chỉ dành cho tài khoản Basic/Pro. Vui lòng nâng cấp gói để xem đầy đủ nguồn liên hệ.");
  if (typeof openAccountDialog === "function") {
    openAccountDialog();
    return;
  }
  window.location.hash = "pricing";
  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
}

function openLoginForPhone() {
  toast("Vui lòng đăng nhập để xem thông tin liên hệ.");
  document.getElementById("auth-section")?.classList.remove("hidden");
  document.getElementById("app-root")?.classList.add("hidden");
  document.getElementById("login-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function refreshQuotaBadge() {
  if (!CURRENT_USER) return;
  try {
    const { data, error } = await db.rpc("get_my_quota_status");
    if (error) return;
    const quota = Array.isArray(data) ? data[0] : data;
    const target = document.getElementById("phone-quota-status");
    if (!target || !quota) return;
    if (quota.phone_limit_per_day === null || quota.phone_limit_per_day === undefined) {
      target.textContent = "";
    } else {
      target.textContent = `Còn ${quota.phone_remaining_today}/${quota.phone_limit_per_day} lượt xem số hôm nay`;
    }
  } catch (error) {
    console.warn("Không tải được quota xem số.", error);
  }
}

async function revealOwnerPhone(listingId) {
  const targetId = listingId || CURRENT_DETAIL?.id;
  if (!CURRENT_USER) {
    openLoginForPhone();
    return;
  }
  if (!isAdminUser() && !isPaidMember()) {
    openPricingUpgrade();
    return;
  }

  const phoneEl = document.getElementById("owner-phone-value");
  const actionEl = document.getElementById("owner-phone-action");
  if (actionEl) actionEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" disabled>Đang tải...</button>`;

  try {
    const { data, error } = await db.rpc("reveal_owner_phone", { p_premise_id: targetId });
    if (error) throw error;
    const payload = Array.isArray(data) ? data[0] : data;
    const phone = payload?.owner_phone || "";
    if (!phone) {
      toast("Tin này chưa có số chủ.");
      if (actionEl) actionEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="revealOwnerPhone('${targetId}')">Thử lại</button>`;
      return;
    }

    if (phoneEl) phoneEl.textContent = phone;
    if (actionEl) actionEl.innerHTML = `<a class="btn btn-primary btn-sm" href="tel:${phone}">Gọi ngay</a>`;

    const quotaEl = document.getElementById("phone-quota-status");
    if (quotaEl && payload.phone_limit_per_day !== null && payload.phone_limit_per_day !== undefined) {
      quotaEl.textContent = `Còn ${payload.phone_remaining_today}/${payload.phone_limit_per_day} lượt xem số hôm nay`;
    }
  } catch (error) {
    const message = error?.message || "Không xem được số chủ.";
    if (message.toLowerCase().includes("nâng cấp")) openPricingUpgrade();
    else toast(message);
    if (actionEl) actionEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="revealOwnerPhone('${targetId}')">Hiện số điện thoại</button>`;
  }
}

function renderOwnerPhoneBox(row = CURRENT_DETAIL) {
  const state = getPhoneRevealState();
  if (state === "admin") {
    setTimeout(() => revealOwnerPhone(row?.id), 0);
    return `
      <div class="listing-contact-card">
        <div>
          <span>Liên hệ chủ nhà / nguồn</span>
          <strong id="owner-phone-value">Đang tải số...</strong>
          <small id="phone-quota-status"></small>
        </div>
        <div id="owner-phone-action">
          <button type="button" class="btn btn-primary btn-sm" onclick="revealOwnerPhone('${row?.id}')">Hiện số điện thoại</button>
        </div>
      </div>
    `;
  }
  if (state === "paid-hidden") {
    setTimeout(refreshQuotaBadge, 0);
    return `
      <div class="listing-contact-card">
        <div>
          <span>Liên hệ chủ nhà / nguồn</span>
          <strong id="owner-phone-value">••••••••••</strong>
          <small id="phone-quota-status"></small>
        </div>
        <div id="owner-phone-action">
          <button type="button" class="btn btn-primary btn-sm" onclick="revealOwnerPhone('${row?.id}')">Hiện số điện thoại</button>
        </div>
      </div>
    `;
  }
  if (state === "guest") {
    return `
      <div class="listing-contact-card is-locked">
        <div>
          <span>Liên hệ chủ nhà / nguồn</span>
          <strong>Đăng nhập để xem thông tin liên hệ</strong>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="openLoginForPhone()">Đăng nhập</button>
      </div>
    `;
  }
  return `
    <div class="listing-contact-card is-locked">
      <div>
        <span>Liên hệ chủ nhà / nguồn</span>
        <strong>Tính năng dành cho Basic/Pro</strong>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="openPricingUpgrade()">Nâng cấp để xem số</button>
    </div>
  `;
}

async function getSensitiveDetail(listingId) {
  if (!CURRENT_USER) {
    openLoginForPhone();
    return null;
  }
  try {
    const { data, error } = await db.rpc("get_premise_sensitive_detail", { p_premise_id: listingId });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    const message = error?.message || "Không xem được thông tin chi tiết.";
    if (message.toLowerCase().includes("nâng cấp")) openPricingUpgrade();
    else toast(message);
    return null;
  }
}

function getCurrentPlanType() {
  if (isAdminUser()) return "admin";
  const sub = getCurrentSubscriptionForPhone();
  const plan = String(sub?.plan_type || sub?.plan || sub?.plan_name || CURRENT_PLAN || "free_trial").toLowerCase();
  const status = sub?.status || "active";
  const expiresAt = sub?.expires_at || sub?.end_date;
  if (status !== "active") return "free_trial";
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return "free_trial";
  return plan === "free" ? "free_trial" : plan;
}

function renderMapAccessBox(listingId) {
  const plan = getCurrentPlanType();
  if (!CURRENT_USER) {
    return `
      <div id="listing-map-panel" class="membership-map-lock map-lock-card">
        <div class="map-lock-icon">⌖</div>
        <b>Bản đồ được bảo vệ</b>
        <p>Đăng nhập để xem bản đồ và quyền truy cập nguồn hàng.</p>
        <button type="button" class="btn btn-sm btn-primary mt-3" onclick="openLoginForPhone()">Đăng nhập</button>
      </div>
    `;
  }
  if (plan === "basic") {
    return `
      <div id="listing-map-panel" class="membership-map-lock map-lock-card map-basic-card">
        <div class="map-lock-icon">⌖</div>
        <b>Bản đồ khu vực</b>
        <p>Tài khoản Basic được xem vị trí tương đối để đánh giá khu vực. Nâng cấp Pro để xem vị trí chính xác.</p>
        <button type="button" class="btn btn-sm btn-primary mt-3" onclick="loadPremiseMap('${listingId}')">Xem bản đồ khu vực</button>
      </div>
    `;
  }
  if (plan === "pro" || plan === "admin") {
    return `
      <div id="listing-map-panel" class="membership-map-lock map-lock-card map-pro-card">
        <div class="map-lock-icon">⌖</div>
        <b>Bản đồ được bảo vệ</b>
        <p>Tài khoản của bạn có quyền xem vị trí chi tiết của mặt bằng này.</p>
        <button type="button" class="btn btn-sm btn-primary mt-3" onclick="loadPremiseMap('${listingId}')">Mở bản đồ</button>
      </div>
    `;
  }
  return `
    <div id="listing-map-panel" class="membership-map-lock map-lock-card">
      <div class="map-lock-icon">⌖</div>
      <b>Bản đồ được bảo vệ</b>
      <p>Vị trí chi tiết chỉ dành cho tài khoản Basic/Pro. Nâng cấp gói để xem bản đồ và thông tin liên hệ chủ nhà.</p>
      <button type="button" class="btn btn-sm btn-primary mt-3" onclick="openPricingUpgrade()">Nâng cấp để xem bản đồ</button>
    </div>
  `;
}

async function getPremiseMapDetail(listingId) {
  if (!CURRENT_USER) {
    openLoginForPhone();
    return null;
  }
  try {
    const { data, error } = await db.rpc("get_premise_map_detail", { p_premise_id: listingId });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    const message = error?.message || "Không xem được bản đồ.";
    if (message.toLowerCase().includes("hết hạn")) {
      toast("Gói của bạn đã hết hạn. Vui lòng gia hạn để xem bản đồ.");
      openPricingUpgrade();
    } else if (message.toLowerCase().includes("nâng cấp")) {
      openPricingUpgrade();
    } else {
      toast(message);
    }
    return null;
  }
}

function buildMapQuery(detail = {}) {
  if (detail.map_level === "full" && detail.map_url) return { url: detail.map_url };
  if (detail.lat && detail.lng) {
    return { query: `${detail.lat},${detail.lng}` };
  }
  return {
    query: [detail.exact_address, detail.street_name, detail.ward, detail.district, "TP.HCM"].filter(Boolean).join(", "),
  };
}

function renderMapFrame(detail, listingId) {
  const panel = document.getElementById("listing-map-panel");
  if (!panel) return;
  if (!detail?.can_view_map) {
    panel.outerHTML = renderMapAccessBox(listingId);
    toast(detail?.message || "Bạn cần nâng cấp gói để xem bản đồ.");
    return;
  }

  const mapTarget = buildMapQuery(detail);
  const embedQuery = encodeURIComponent(mapTarget.query || [detail.ward, detail.district, "TP.HCM"].filter(Boolean).join(", "));
  const isFull = detail.map_level === "full";
  const externalUrl = mapTarget.url || `https://www.google.com/maps/search/?api=1&query=${embedQuery}`;

  panel.className = "listing-map-card listing-map-secure-card";
  panel.innerHTML = `
    <iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${embedQuery}&t=&z=${isFull ? "16" : "14"}&ie=UTF8&iwloc=&output=embed"></iframe>
    <div class="map-access-note ${isFull ? "is-full" : "is-limited"}">
      ${isFull ? "Vị trí chi tiết theo quyền Pro/Admin." : "Vị trí đang được hiển thị tương đối theo quyền Basic."}
    </div>
    ${isFull ? `<button type="button" class="listing-map-open btn btn-sm" onclick="window.open('${externalUrl.replace(/'/g, "\\'")}', '_blank', 'noopener')">Mở Google Maps</button>` : ""}
  `;
}

async function loadPremiseMap(listingId, openExternal = false) {
  const detail = await getPremiseMapDetail(listingId);
  if (!detail) return;
  if (detail.can_view_map === false) {
    openPricingUpgrade();
    return;
  }
  renderMapFrame(detail, listingId);
  if (openExternal && detail.map_level === "full") {
    const mapTarget = buildMapQuery(detail);
    const url = mapTarget.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapTarget.query || "")}`;
    window.open(url, "_blank", "noopener");
  }
}

async function openSensitiveMap(listingId) {
  return loadPremiseMap(listingId, true);
}

function openDeleteListingConfirm(id) {
  if (!isAdminUser()) {
    toast("Chỉ admin mới được xóa mặt bằng.");
    return;
  }
  DELETE_LISTING_TARGET_ID = id;
  document.getElementById("deleteListingDlg")?.showModal();
}

async function confirmSoftDeleteListing() {
  if (!isAdminUser() || !DELETE_LISTING_TARGET_ID) return;
  const { error } = await db
    .from("premises")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: CURRENT_USER?.id || null,
    })
    .eq("id", DELETE_LISTING_TARGET_ID);
  if (error) {
    toast("Lỗi xóa mặt bằng: " + error.message);
    return;
  }
  toast("Đã xóa mặt bằng");
  document.getElementById("deleteListingDlg")?.close();
  document.getElementById("detailDlg")?.close();
  DELETE_LISTING_TARGET_ID = null;
  if (typeof applyFilters === "function") applyFilters(true);
  if (typeof loadPublicListings === "function") loadPublicListings();
}

async function toggleFeaturedListing(id, currentlyFeatured = false) {
  if (!isAdminUser()) {
    toast("Chỉ admin mới được bật/gỡ nổi bật.");
    return;
  }
  const payload = currentlyFeatured
    ? { is_featured: false }
    : {
        is_featured: true,
        featured_at: new Date().toISOString(),
        featured_by: CURRENT_USER?.id || null,
      };
  const { error } = await db.from("premises").update(payload).eq("id", id);
  if (error) {
    toast("Lỗi cập nhật nổi bật: " + error.message);
    return;
  }
  toast(currentlyFeatured ? "Đã gỡ nổi bật" : "Đã đưa tin ra trang chủ");
  if (CURRENT_DETAIL?.id === id) CURRENT_DETAIL.is_featured = !currentlyFeatured;
  if (typeof applyFilters === "function") applyFilters(false);
  if (typeof loadPublicListings === "function") loadPublicListings();
  if (document.getElementById("detailDlg")?.open && typeof openDetail === "function") {
    openDetail(id);
  }
}
