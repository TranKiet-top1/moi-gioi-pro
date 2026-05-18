    let SAVED_LISTING_IDS = new Set();
    let COLLECTION_TARGET_LISTING_ID = null;
    let ENGAGEMENT_TABLES_READY = true;

    function escapeHtml(value = "") {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function isMissingFeatureTableError(error) {
      const message = String(error?.message || error || "").toLowerCase();
      return (
        message.includes("schema cache") ||
        message.includes("could not find the table") ||
        message.includes("does not exist") ||
        error?.code === "42P01"
      );
    }

    function notifyFeatureTablesMissing() {
      toast("Chua tao bang Supabase cho tinh nang moi. Hay chay file supabase-engagement-features.sql roi tai lai trang.");
    }

    function showFeatureSetupNotice(container, featureName = "tinh nang nay") {
      if (!container) return;
      container.innerHTML = `
        <div class="feature-card feature-setup-card">
          <h3>Can tao bang Supabase de dung ${escapeHtml(featureName)}</h3>
          <p>
            Cac bang moi chua co trong database. Hay mo Supabase SQL Editor va chay file
            <b>project/supabase-engagement-features.sql</b>, sau do tai lai trang.
          </p>
        </div>
      `;
    }

    function makeShareSlug(title = "bo-suu-tap") {
      const base = title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "bo-suu-tap";
      return `${base}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function getShareUrl(slug) {
      return `${window.location.origin}${window.location.pathname}#share/${slug}`;
    }

    function isListingSaved(id) {
      return SAVED_LISTING_IDS.has(id);
    }

    async function loadSavedListingIds() {
      SAVED_LISTING_IDS = new Set();
      if (!CURRENT_USER) return SAVED_LISTING_IDS;
      const { data, error } = await db
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", CURRENT_USER.id);
      if (error) {
        if (isMissingFeatureTableError(error)) {
          ENGAGEMENT_TABLES_READY = false;
          return SAVED_LISTING_IDS;
        }
        console.warn("Khong tai duoc tin da luu.", error);
        return SAVED_LISTING_IDS;
      }
      ENGAGEMENT_TABLES_READY = true;
      SAVED_LISTING_IDS = new Set((data || []).map((row) => row.listing_id));
      return SAVED_LISTING_IDS;
    }

    async function toggleSavedListing(event, listingId) {
      if (event) event.stopPropagation();
      if (!CURRENT_USER) {
        toast("Vui long dang nhap de luu tin.");
        return;
      }

      const saved = SAVED_LISTING_IDS.has(listingId);
      if (saved) {
        const { error } = await db
          .from("saved_listings")
          .delete()
          .eq("user_id", CURRENT_USER.id)
          .eq("listing_id", listingId);
        if (error) {
          if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
          else toast("Loi bo luu: " + error.message);
          return;
        }
        SAVED_LISTING_IDS.delete(listingId);
        toast("Da bo luu tin.");
      } else {
        const { error } = await db
          .from("saved_listings")
          .upsert({ user_id: CURRENT_USER.id, listing_id: listingId, note: "" }, { onConflict: "user_id,listing_id" });
        if (error) {
          if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
          else toast("Loi luu tin: " + error.message);
          return;
        }
        SAVED_LISTING_IDS.add(listingId);
        toast("Da luu tin.");
      }

      document.querySelectorAll(`[data-save-listing="${listingId}"]`).forEach((btn) => {
        const nowSaved = SAVED_LISTING_IDS.has(listingId);
        btn.textContent = nowSaved ? "Da luu" : "Luu";
        btn.classList.toggle("btn-primary", nowSaved);
        btn.classList.toggle("btn-outline", !nowSaved);
      });
      if (!document.getElementById("app-page-saved")?.classList.contains("hidden")) {
        renderSavedListingsPage();
      }
    }

    async function fetchPremisesByIds(ids = []) {
      if (!ids.length) return [];
      const publicColumns = [
        "id", "code", "images", "price", "area", "width", "length", "floors", "pn", "wc",
        "ket_cau", "road_type", "frontage", "status", "ward", "district", "city", "street",
        "created_at", "updated_at"
      ].join(",");
      const { data, error } = await db.from("premises").select(publicColumns).in("id", ids);
      if (error) {
        console.warn("Khong tai duoc mat bang.", error);
        return [];
      }
      return data || [];
    }

    async function fetchPublicPremisesByIds(ids = []) {
      if (!ids.length) return [];
      const publicColumns = [
        "id", "code", "images", "price", "area", "width", "length", "floors", "pn", "wc",
        "ket_cau", "road_type", "frontage", "status", "ward", "district", "city", "street",
        "created_at", "updated_at"
      ].join(",");
      const { data, error } = await db.from("premises").select(publicColumns).in("id", ids);
      if (error) {
        console.warn("Khong tai duoc public premises.", error);
        return [];
      }
      return data || [];
    }

    function normalizeImagePaths(rawImages) {
      if (!rawImages) return [];
      let paths = [];
      if (Array.isArray(rawImages)) {
        paths = rawImages;
      } else if (typeof rawImages === "string" && rawImages.trim()) {
        const value = rawImages.trim();
        try {
          const parsed = value.startsWith("[") || value.startsWith("{") ? JSON.parse(value) : null;
          if (Array.isArray(parsed)) paths = parsed;
          else if (parsed && Array.isArray(parsed.images)) paths = parsed.images;
          else paths = value.split(/[\n;,]+/);
        } catch {
          paths = value.split(/[\n;,]+/);
        }
      }

      return paths
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") return item.trim();
          if (typeof item === "object") return String(item.path || item.url || item.publicUrl || item.name || "").trim();
          return String(item).trim();
        })
        .filter(Boolean);
    }

    function getListingImageUrl(row) {
      if (row?._featureImageUrl) return row._featureImageUrl;
      const firstPath = normalizeImagePaths(row?.images)[0];
      return firstPath ? buildImageUrl(firstPath) : "";
    }

    async function findFirstStorageImageByCode(code) {
      if (!code) return "";
      try {
        const { data: files, error } = await db.storage
          .from(STORAGE_BUCKET)
          .list(code, {
            limit: 50,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          });
        if (error || !files?.length) return "";
        const file = files.find((item) => {
          const name = String(item.name || "");
          return name && name !== ".emptyFolderPlaceholder" && !item.id?.endsWith("/");
        });
        return file ? buildImageUrl(`${code}/${file.name}`) : "";
      } catch (err) {
        console.warn("Khong quet duoc anh storage cho", code, err);
        return "";
      }
    }

    async function hydrateListingImages(rows = []) {
      await Promise.all(rows.map(async (row) => {
        const currentUrl = getListingImageUrl(row);
        if (currentUrl) {
          row._featureImageUrl = currentUrl;
          return;
        }
        row._featureImageUrl = await findFirstStorageImageByCode(row.code);
      }));
      return rows;
    }

    function listingTitle(row) {
      try {
        return buildTitle(row) || row.address || row.street || "Mat bang";
      } catch {
        return row.address || row.street || "Mat bang";
      }
    }

    function renderMiniListingCard(row, options = {}) {
      const imageUrl = getListingImageUrl(row);
      const saved = isListingSaved(row.id);
      return `
        <article class="feature-card">
          <div class="feature-card-media">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Mat bang" loading="lazy" decoding="async" />` : `<div class="feature-empty">No image</div>`}
          </div>
          <div class="feature-card-body">
            <h3>${escapeHtml(listingTitle(row))}</h3>
            <p>${escapeHtml(maskAddress(row) || [row.ward, row.district].filter(Boolean).join(", "))}</p>
            <strong>${money(row.price)}</strong>
            <div class="public-card-specs">
              ${row.width && row.length ? `<span>${escapeHtml(row.width)}x${escapeHtml(row.length)}m</span>` : ""}
              ${row.area ? `<span>${escapeHtml(row.area)}m2</span>` : ""}
              ${row.pn ? `<span>${escapeHtml(row.pn)}PN</span>` : ""}
            </div>
            ${options.note !== undefined ? `
              <textarea class="textarea textarea-bordered textarea-sm w-full mt-3" placeholder="Ghi chu rieng..." onchange="updateSavedNote('${row.id}', this.value)">${escapeHtml(options.note || "")}</textarea>
            ` : ""}
            <div class="feature-actions">
              <button class="btn btn-xs ${saved ? "btn-primary" : "btn-outline"}" data-save-listing="${row.id}" onclick="toggleSavedListing(event, '${row.id}')">${saved ? "Da luu" : "Luu"}</button>
              <button class="btn btn-xs btn-outline" onclick="openAddToCollectionDialog('${row.id}', event)">Them vao bo gui khach</button>
              <button class="btn btn-xs btn-outline" onclick="copyPremiseSummary('${row.id}', event)">Copy mo ta</button>
              <button class="btn btn-xs btn-primary" onclick="openDetail('${row.id}')">Xem chi tiet</button>
              ${options.savedRowId ? `<button class="btn btn-xs btn-ghost text-error" onclick="removeSavedListing('${row.id}')">Bo luu</button>` : ""}
            </div>
          </div>
        </article>
      `;
    }

    async function renderSavedListingsPage() {
      const container = document.getElementById("saved-listings-page");
      if (!container) return;
      container.innerHTML = `<div class="feature-card p-6 text-sm text-slate-500">Dang tai tin da luu...</div>`;
      const { data: savedRows, error } = await db
        .from("saved_listings")
        .select("*")
        .eq("user_id", CURRENT_USER.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingFeatureTableError(error)) {
          showFeatureSetupNotice(container, "Tin da luu");
          return;
        }
        container.innerHTML = `<div class="feature-card p-6 text-error">${escapeHtml(error.message)}</div>`;
        return;
      }
      const ids = (savedRows || []).map((row) => row.listing_id);
      const listings = await hydrateListingImages(await fetchPremisesByIds(ids));
      const byId = new Map(listings.map((row) => [row.id, row]));
      if (!savedRows?.length) {
        container.innerHTML = `<div class="feature-card p-6 text-sm text-slate-500">Ban chua luu mat bang nao.</div>`;
        return;
      }
      container.innerHTML = savedRows.map((saved) => {
        const row = byId.get(saved.listing_id);
        return row ? renderMiniListingCard(row, { note: saved.note, savedRowId: saved.id }) : "";
      }).join("");
    }

    async function updateSavedNote(listingId, note) {
      const { error } = await db
        .from("saved_listings")
        .update({ note })
        .eq("user_id", CURRENT_USER.id)
        .eq("listing_id", listingId);
      if (error) {
        if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
        else toast("Loi luu ghi chu: " + error.message);
      }
    }

    async function removeSavedListing(listingId) {
      await toggleSavedListing(null, listingId);
    }

    function openCollectionCreateDialog() {
      document.getElementById("collectionCreateDlg")?.showModal();
    }

    async function createClientCollection() {
      const title = document.getElementById("collection-title").value.trim();
      const description = document.getElementById("collection-description").value.trim();
      const clientName = document.getElementById("collection-client-name").value.trim();
      if (!title) {
        toast("Nhap tieu de bo suu tap.");
        return;
      }
      const { error } = await db.from("client_collections").insert({
        user_id: CURRENT_USER.id,
        title,
        description,
        client_name: clientName,
        share_slug: makeShareSlug(title),
        is_public: true,
      });
      if (error) {
        if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
        else toast("Loi tao bo: " + error.message);
        return;
      }
      document.getElementById("collectionCreateDlg").close();
      toast("Da tao bo gui khach.");
      renderCollectionsPage();
    }

    async function loadCollections() {
      const { data, error } = await db
        .from("client_collections")
        .select("*")
        .eq("user_id", CURRENT_USER.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingFeatureTableError(error)) {
          ENGAGEMENT_TABLES_READY = false;
          return [];
        }
        toast("Loi tai bo gui khach: " + error.message);
        return [];
      }
      ENGAGEMENT_TABLES_READY = true;
      return data || [];
    }

    async function renderCollectionsPage() {
      const container = document.getElementById("collections-page");
      if (!container) return;
      const collections = await loadCollections();
      if (!ENGAGEMENT_TABLES_READY) {
        showFeatureSetupNotice(container, "Bo gui khach");
        return;
      }
      if (!collections.length) {
        container.innerHTML = `<div class="feature-card p-6 text-sm text-slate-500">Chua co bo gui khach nao.</div>`;
        return;
      }
      const counts = await loadCollectionCounts(collections.map((item) => item.id));
      container.innerHTML = collections.map((collection) => `
        <article class="feature-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-bold text-lg">${escapeHtml(collection.title)}</h3>
              <p class="text-sm text-slate-500">${escapeHtml(collection.description || "Khong co mo ta")}</p>
              <p class="text-xs text-slate-400 mt-1">Khach: ${escapeHtml(collection.client_name || "-")} - ${counts.get(collection.id) || 0} mat bang</p>
            </div>
            <span class="badge ${collection.is_public ? "badge-success text-white" : "badge-ghost"}">${collection.is_public ? "Public" : "Private"}</span>
          </div>
          <div class="feature-actions mt-4">
            <button class="btn btn-xs btn-primary" onclick="copyCollectionLink('${collection.share_slug}')">Copy link chia se</button>
            <button class="btn btn-xs btn-outline" onclick="renderCollectionDetail('${collection.id}')">Xem danh sach</button>
            <button class="btn btn-xs btn-ghost text-error" onclick="deleteCollection('${collection.id}')">Xoa bo</button>
          </div>
          <div id="collection-detail-${collection.id}" class="mt-3"></div>
        </article>
      `).join("");
    }

    async function loadCollectionCounts(ids = []) {
      const map = new Map();
      ids.forEach((id) => map.set(id, 0));
      if (!ids.length) return map;
      const { data, error } = await db.from("client_collection_items").select("collection_id").in("collection_id", ids);
      if (error) return map;
      (data || []).forEach((row) => map.set(row.collection_id, (map.get(row.collection_id) || 0) + 1));
      return map;
    }

    async function openAddToCollectionDialog(listingId, event) {
      if (event) event.stopPropagation();
      if (!CURRENT_USER) {
        toast("Vui long dang nhap.");
        return;
      }
      COLLECTION_TARGET_LISTING_ID = listingId;
      const list = document.getElementById("add-to-collection-list");
      const collections = await loadCollections();
      if (!ENGAGEMENT_TABLES_READY) {
        showFeatureSetupNotice(list, "Bo gui khach");
        document.getElementById("addToCollectionDlg")?.showModal();
        return;
      }
      list.innerHTML = collections.length
        ? collections.map((collection) => `
            <button class="collection-pick-row" onclick="addListingToCollection('${collection.id}')">
              <b>${escapeHtml(collection.title)}</b>
              <span>${escapeHtml(collection.client_name || "Chua dat ten khach")}</span>
            </button>
          `).join("")
        : `<div class="text-sm text-slate-500">Chua co bo nao. Hay tao bo gui khach truoc.</div>`;
      document.getElementById("addToCollectionDlg")?.showModal();
    }

    async function addListingToCollection(collectionId) {
      if (!COLLECTION_TARGET_LISTING_ID) return;
      const { error } = await db.from("client_collection_items").upsert({
        collection_id: collectionId,
        listing_id: COLLECTION_TARGET_LISTING_ID,
        sort_order: 0,
      }, { onConflict: "collection_id,listing_id" });
      if (error) {
        if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
        else toast("Loi them vao bo: " + error.message);
        return;
      }
      document.getElementById("addToCollectionDlg").close();
      toast("Da them vao bo gui khach.");
    }

    async function renderCollectionDetail(collectionId) {
      const wrap = document.getElementById(`collection-detail-${collectionId}`);
      if (!wrap) return;
      wrap.innerHTML = `<div class="text-sm text-slate-500">Dang tai...</div>`;
      const { data: items, error } = await db
        .from("client_collection_items")
        .select("*")
        .eq("collection_id", collectionId)
        .order("sort_order", { ascending: true });
      if (error) {
        if (isMissingFeatureTableError(error)) {
          showFeatureSetupNotice(wrap, "Bo gui khach");
          return;
        }
        wrap.innerHTML = `<div class="text-error text-sm">${escapeHtml(error.message)}</div>`;
        return;
      }
      const listings = await hydrateListingImages(await fetchPublicPremisesByIds((items || []).map((item) => item.listing_id)));
      const byId = new Map(listings.map((row) => [row.id, row]));
      wrap.innerHTML = items?.length
        ? `<div class="collection-items-list">${items.map((item) => {
            const row = byId.get(item.listing_id);
            return row ? `
              <div class="collection-item-row">
                ${getListingImageUrl(row) ? `<img class="collection-item-thumb" src="${escapeHtml(getListingImageUrl(row))}" alt="Mat bang" loading="lazy" decoding="async" />` : `<div class="collection-item-thumb collection-item-thumb-empty">No image</div>`}
                <span>${escapeHtml(listingTitle(row))}</span>
                <button class="btn btn-xs btn-ghost text-error" onclick="removeListingFromCollection('${item.id}', '${collectionId}')">Xoa</button>
              </div>
            ` : "";
          }).join("")}</div>`
        : `<div class="text-sm text-slate-500">Bo nay chua co mat bang.</div>`;
    }

    async function removeListingFromCollection(itemId, collectionId) {
      const { error } = await db.from("client_collection_items").delete().eq("id", itemId);
      if (error) {
        if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
        else toast("Loi xoa mat bang khoi bo: " + error.message);
      } else renderCollectionDetail(collectionId);
    }

    async function deleteCollection(collectionId) {
      if (!confirm("Xoa bo gui khach nay?")) return;
      const { error } = await db.from("client_collections").delete().eq("id", collectionId).eq("user_id", CURRENT_USER.id);
      if (error) {
        if (isMissingFeatureTableError(error)) notifyFeatureTablesMissing();
        else toast("Loi xoa bo: " + error.message);
      } else renderCollectionsPage();
    }

    function copyCollectionLink(slug) {
      const url = getShareUrl(slug);
      navigator.clipboard?.writeText(url).then(() => toast("Da copy link chia se.")).catch(() => window.prompt("Link chia se:", url));
    }

    async function loadNotificationCount() {
      if (!CURRENT_USER) return;
      const { count, error } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", CURRENT_USER.id)
        .eq("is_read", false);
      if (error) return;
      const badge = document.getElementById("notification-badge");
      if (!badge) return;
      badge.textContent = count || 0;
      badge.classList.toggle("hidden", !count);
    }

    async function renderNotificationsPage() {
      const container = document.getElementById("notifications-page");
      if (!container) return;
      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", CURRENT_USER.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (isMissingFeatureTableError(error)) {
          showFeatureSetupNotice(container, "Thong bao");
          return;
        }
        container.innerHTML = `<div class="feature-card p-6 text-error">${escapeHtml(error.message)}</div>`;
        return;
      }
      if (!data?.length) {
        container.innerHTML = `<div class="feature-card p-6 text-sm text-slate-500">Chua co thong bao. Trung tam nay da san sang de ket noi realtime sau.</div>`;
        return;
      }
      container.innerHTML = data.map((item) => `
        <article class="notification-row ${item.is_read ? "" : "is-unread"}">
          <div>
            <h3>${escapeHtml(item.title || "Thong bao")}</h3>
            <p>${escapeHtml(item.message || "")}</p>
            <span>${escapeHtml(item.type || "system")} - ${formatDateVN(item.created_at)}</span>
          </div>
          ${item.is_read ? "" : `<button class="btn btn-xs btn-outline" onclick="markNotificationRead('${item.id}')">Da doc</button>`}
        </article>
      `).join("");
    }

    async function markNotificationRead(id) {
      await db.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", CURRENT_USER.id);
      renderNotificationsPage();
      loadNotificationCount();
    }

    async function markAllNotificationsRead() {
      await db.from("notifications").update({ is_read: true }).eq("user_id", CURRENT_USER.id).eq("is_read", false);
      renderNotificationsPage();
      loadNotificationCount();
    }

    function showAppPage(page) {
      document.querySelectorAll(".app-page").forEach((el) => el.classList.add("hidden"));
      document.getElementById(`app-page-${page}`)?.classList.remove("hidden");
      document.querySelectorAll(".app-nav-btn").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.appPage === page));
      if (page === "saved") renderSavedListingsPage();
      if (page === "collections") renderCollectionsPage();
      if (page === "notifications") renderNotificationsPage();
      if (page === "admin-users" && typeof renderAdminUsersPage === "function") renderAdminUsersPage();
      window.location.hash = page === "listings" ? "app" : `app/${page}`;
    }

    async function renderSharePage(slug) {
      document.getElementById("auth-section")?.classList.add("hidden");
      document.getElementById("app-root")?.classList.add("hidden");
      document.getElementById("share-page")?.classList.remove("hidden");
      const container = document.getElementById("share-content");
      container.innerHTML = `<div class="feature-card p-6 text-sm text-slate-500">Dang tai bo suu tap...</div>`;
      const { data: collection, error } = await db
        .from("client_collections")
        .select("*")
        .eq("share_slug", slug)
        .eq("is_public", true)
        .maybeSingle();
      if (error || !collection) {
        container.innerHTML = `<div class="feature-card p-6 text-sm text-error">Khong tim thay bo suu tap hoac link da bi tat.</div>`;
        return;
      }
      const { data: items } = await db
        .from("client_collection_items")
        .select("*")
        .eq("collection_id", collection.id)
        .order("sort_order", { ascending: true });
      const listings = await hydrateListingImages(await fetchPublicPremisesByIds((items || []).map((item) => item.listing_id)));
      container.innerHTML = `
        <section class="share-hero-card">
          <p class="public-eyebrow">Bo suu tap mat bang</p>
          <h1>${escapeHtml(collection.title)}</h1>
          <p>${escapeHtml(collection.description || "Danh sach mat bang duoc moi gioi chon loc cho khach hang.")}</p>
          ${collection.client_name ? `<span>Danh cho: ${escapeHtml(collection.client_name)}</span>` : ""}
        </section>
        <div class="share-grid">
          ${listings.map(renderShareListingCard).join("") || `<div class="feature-card p-6 text-sm text-slate-500">Bo nay chua co mat bang.</div>`}
        </div>
      `;
    }

    function renderShareListingCard(row) {
      const imageUrl = getListingImageUrl(row);
      const shortDesc = [row.road_type, row.ket_cau, row.frontage ? "Mat tien" : ""].filter(Boolean).join(" - ");
      return `
        <article class="public-listing-card">
          <div class="public-card-media">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Mat bang" loading="lazy" decoding="async" />` : `<div class="public-no-image">No image</div>`}
          </div>
          <div class="public-card-body">
            <h3>${escapeHtml(listingTitle(row))}</h3>
            <div class="public-card-price">${money(row.price)}</div>
            <p>${escapeHtml([row.ward, row.district].filter(Boolean).join(", "))}</p>
            <div class="public-card-specs">
              ${row.width && row.length ? `<span>${escapeHtml(row.width)}x${escapeHtml(row.length)}m</span>` : ""}
              ${row.area ? `<span>${escapeHtml(row.area)}m2</span>` : ""}
              ${row.pn ? `<span>${escapeHtml(row.pn)}PN</span>` : ""}
            </div>
            <div class="public-business">${escapeHtml(shortDesc || "Thong tin co ban")}</div>
          </div>
        </article>
      `;
    }

    function getShareSlugFromLocation() {
      const hash = window.location.hash || "";
      if (hash.startsWith("#share/")) return hash.replace("#share/", "").trim();
      const match = window.location.pathname.match(/\/share\/([^/]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    }

    function bindAppFeatureNavigation() {
      document.querySelectorAll("[data-app-page]").forEach((btn) => {
        btn.addEventListener("click", () => showAppPage(btn.dataset.appPage));
      });
      window.addEventListener("hashchange", () => {
        const slug = getShareSlugFromLocation();
        if (slug) renderSharePage(slug);
      });
    }

    async function initAppFeatureState() {
      bindAppFeatureNavigation();
      const slug = getShareSlugFromLocation();
      if (slug) {
        await renderSharePage(slug);
        return;
      }
      await loadSavedListingIds();
      await loadNotificationCount();
      const hash = (window.location.hash || "").replace("#", "");
      if (hash === "admin/users") {
        showAppPage("admin-users");
        return;
      }
      if (hash.startsWith("app/")) {
        const page = hash.split("/")[1];
        if (["saved", "collections", "notifications", "admin-users"].includes(page)) showAppPage(page);
      }
    }
