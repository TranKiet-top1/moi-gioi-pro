    let SHOW_PENDING = false;
    // 👉 chế độ xem danh sách tin nhân sự đã báo hết (admin)
    let SHOW_REPORTED = false;
    // Đếm số mặt bằng nhân sự đã báo hết nhưng admin chưa xác nhận
    async function checkRentedReportCount() {
      const { count } = await db
        .from("premises")
        .select("*", { count: "exact", head: true })
        .not("rented_reported_at", "is", null)
        .is("rented_confirmed_at", null);

      const cnt = count || 0;
      const span = document.getElementById("count-rented-reports");
      if (span) span.textContent = cnt;
    }

    function toggleReportedMode() {
      SHOW_REPORTED = !SHOW_REPORTED;
      const btn = document.getElementById("btn-toggle-rented-reports");
      if (!btn) return;

      if (SHOW_REPORTED) {
        btn.classList.add("btn-active");
        btn.textContent = "Đang xem Báo hết (Thoát)";
      } else {
        btn.classList.remove("btn-active");
        btn.innerHTML =
          `Báo hết <span class="badge badge-sm bg-white text-error ml-1 border-none" id="count-rented-reports">...</span>`;
        checkRentedReportCount();
      }
      applyFilters(true);
    }
    // 👉 chế độ xem danh sách tin yêu cầu chạy lại (admin)
    let SHOW_REACTIVATE = false;
    let SHOW_FEATURED = false;
    let SHOW_DELETED = false;

    // Đếm số mặt bằng yêu cầu chạy lại, admin chưa duyệt
    async function checkReactivateCount() {
      try {
        const { count, error } = await db
          .from("premises")
          .select("*", { count: "exact", head: true })
          .not("reactivate_reported_at", "is", null)
          .is("reactivate_confirmed_at", null);

        if (error) throw error;
        const cnt = count || 0;
        const span = document.getElementById("count-reactivate");
        if (span) span.textContent = cnt;
      } catch (err) {
        console.error("checkReactivateCount error", err);
      }
    }

    function toggleReactivateMode() {
      SHOW_REACTIVATE = !SHOW_REACTIVATE;
      const btn = document.getElementById("btn-toggle-reactivate");
      if (!btn) return;

      if (SHOW_REACTIVATE) {
        btn.classList.add("btn-active");
        btn.textContent = "Đang xem Duyệt chạy lại (Thoát)";
      } else {
        btn.classList.remove("btn-active");
        btn.innerHTML =
          `Duyệt chạy lại <span class="badge badge-sm bg-white text-info ml-1 border-none" id="count-reactivate">...</span>`;
        checkReactivateCount();
      }

      applyFilters(true);
    }
    // ===== HELPERS =====
    function toast(msg) {
      const toastEl = document.getElementById("toast");
      const textEl = document.getElementById("toast-text");
      textEl.textContent = msg;
      toastEl.classList.remove("hidden");
      setTimeout(() => toastEl.classList.add("hidden"), 2500);
    }

    function money(v) {
      if (v == null || isNaN(v)) return "";
      return new Intl.NumberFormat("vi-VN").format(v) + " đ";
    }

    function formatDateVN(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("vi-VN");
    }

    function pickField(obj, names) {
      for (const n of names) {
        if (obj && obj[n] !== undefined && obj[n] !== null && obj[n] !== "") {
          return obj[n];
        }
      }
      return null;
    }

    function isAdmin() { return CURRENT_ROLE === "admin"; }
    function isStaff() { return CURRENT_ROLE === "staff"; }
    // --- GHIM MẶT BẰNG THEO NHÂN SỰ (LƯU LOCAL) ---
    let FAVORITES_MODE = false;

    function getFavoriteStorageKey() {
      if (CURRENT_USER && CURRENT_USER.id) {
        return "idland_favorites_" + CURRENT_USER.id;
      }
      // fallback nếu chưa login (ít dùng)
      return "idland_favorites_guest";
    }

    function getFavoriteIds() {
      if (typeof SAVED_LISTING_IDS !== "undefined" && SAVED_LISTING_IDS instanceof Set) {
        return Array.from(SAVED_LISTING_IDS);
      }
      try {
        const raw = localStorage.getItem(getFavoriteStorageKey());
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        console.warn("getFavoriteIds error", e);
        return [];
      }
    }

    function saveFavoriteIds(ids) {
      try {
        localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(ids));
      } catch (e) {
        console.warn("saveFavoriteIds error", e);
      }
    }

    function toggleFavorite(e, id) {
      if (e) e.stopPropagation(); // ⬅ để khi bấm sao không bị mở popup

      if (!CURRENT_USER) {
        toast("Vui lòng đăng nhập để ghim sản phẩm.");
        return;
      }

      if (typeof toggleSavedListing === "function") {
        toggleSavedListing(e, id);
        return;
      }

      let ids = getFavoriteIds();
      const idx = ids.indexOf(id);
      let isFav = false;

      if (idx === -1) {
        ids.push(id);
        isFav = true;
      } else {
        ids.splice(idx, 1);
        isFav = false;
      }

      saveFavoriteIds(ids);

      // Cập nhật icon / màu cho tất cả nút sao của id này
      document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn => {
        btn.classList.toggle("btn-error", isFav);
        btn.classList.toggle("text-white", isFav);
        btn.classList.toggle("btn-ghost", !isFav);
        btn.textContent = isFav ? "★" : "☆";
      });

      // Nếu đang ở chế độ chỉ xem ghim thì render lại
      if (FAVORITES_MODE) {
        const favSet = new Set(ids);
        const filtered = (LAST_ROWS || []).filter(r => favSet.has(r.id));
        renderCards(filtered, true);
        const showEl = document.getElementById("count-show");
        if (showEl) showEl.textContent = filtered.length;
      }
    }


    function toggleFavoriteMode() {
      FAVORITES_MODE = !FAVORITES_MODE;
      const btn = document.getElementById("btn-toggle-favorites");
      if (!btn) return;

      if (FAVORITES_MODE) {
        btn.classList.add("btn-active");
        btn.textContent = "Đang xem: Mặt bằng đã ghim (thoát)";

        const favSet = new Set(getFavoriteIds());
        const filtered = (LAST_ROWS || []).filter(r => favSet.has(r.id));
        renderCards(filtered, true);

        const showEl = document.getElementById("count-show");
        if (showEl) showEl.textContent = filtered.length;
      } else {
        btn.classList.remove("btn-active");
        btn.textContent = "Xem mặt bằng đã ghim";

        renderCards(LAST_ROWS || [], true);
        const showEl = document.getElementById("count-show");
        if (showEl) {
          showEl.textContent = Math.min((PAGE + 1) * PAGE_SIZE, TOTAL_COUNT);
        }
      }
    }


    function maskAddress(row) {
      const full = row.address || "";
      // NẾU LÀ ADMIN THÌ HIỆN HẾT
      if (typeof canViewFullPremiseInfo === "function" && canViewFullPremiseInfo()) return full || row.street; 

      if (!isStaff()) return [row.ward, row.district].filter(Boolean).join(", ");

      if (full) {
        return [row.ward, row.district].filter(Boolean).join(", ") || row.district || "TP.HCM";
      }
      return [row.street, row.ward, row.district].filter(Boolean).join(", ");
    }

    function toggleFeaturedMode() {
      SHOW_FEATURED = !SHOW_FEATURED;
      if (SHOW_FEATURED) SHOW_DELETED = false;
      const btn = document.getElementById("btn-toggle-featured");
      const deletedBtn = document.getElementById("btn-toggle-deleted");
      if (btn) btn.classList.toggle("btn-active", SHOW_FEATURED);
      if (deletedBtn) deletedBtn.classList.remove("btn-active");
      applyFilters(true);
    }

    function toggleDeletedMode() {
      SHOW_DELETED = !SHOW_DELETED;
      if (SHOW_DELETED) SHOW_FEATURED = false;
      const btn = document.getElementById("btn-toggle-deleted");
      const featuredBtn = document.getElementById("btn-toggle-featured");
      if (btn) btn.classList.toggle("btn-active", SHOW_DELETED);
      if (featuredBtn) featuredBtn.classList.remove("btn-active");
      applyFilters(true);
    }

    function buildImageUrl(path) {
      if (!path) return null;
      if (path.startsWith('http')) return path; // Hỗ trợ link đầy đủ
      const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      return data?.publicUrl || null;
    }

    function formatCurrencyInput(el) {
        let val = el.value.replace(/\D/g, '');
        if(val) el.value = new Intl.NumberFormat('vi-VN').format(val);
    }

