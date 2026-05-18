    function getFilterValues() {
      return {
        keyword: document.getElementById("filter-keyword").value.trim(),
        street: document.getElementById("filter-street")?.value.trim() || "",
        
        // --- SỬA DÒNG NÀY: Gọi hàm lấy mảng thay vì .value ---
        district: getSelectedDistricts(), 
        
        ward: document.getElementById("filter-ward").value,
        priceMin: Number(document.getElementById("filter-price-min").value) || null,
        priceMax: Number(document.getElementById("filter-price-max").value) || null,
        areaMin: Number(document.getElementById("filter-area-min").value) || null,
        areaMax: Number(document.getElementById("filter-area-max").value) || null,
        widthMin: Number(document.getElementById("filter-width-min").value) || null,
        lengthMin: Number(document.getElementById("filter-length-min").value) || null,
        pn: getMultiValues("pn-list-checkboxes"),
        wc: getMultiValues("wc-list-checkboxes"),
        floors: getMultiValues("floors-list-checkboxes"),
        frontageType: document.getElementById("filter-frontage-type").value,
        status: document.getElementById("filter-status").value,
        sort: document.getElementById("filter-sort")?.value || "updated_desc",
      };
    }

    function getSortConfig(sortValue) {
      const configs = {
        price_asc: { column: "price", ascending: true },
        price_desc: { column: "price", ascending: false },
        area_asc: { column: "area", ascending: true },
        area_desc: { column: "area", ascending: false },
        updated_desc: { column: "updated_at", ascending: false },
      };
      return configs[sortValue] || configs.updated_desc;
    }

    function getRoadSearchText(row) {
      return [
        row.address,
        row.street,
        row.detail,
        row.description,
        row.road_type,
        row.direction,
      ].filter(Boolean).join(" ").toLowerCase();
    }

    function matchesFrontageType(row, frontageType) {
      if (!frontageType) return true;
      const txt = getRoadSearchText(row);
      const isFront = row.frontage === true || txt.includes("mặt tiền") || txt.includes("mat tien");
      const isHxh = txt.includes("hxh") || txt.includes("xe hơi") || txt.includes("xe hoi") || txt.includes("hẻm xe hơi") || txt.includes("hem xe hoi");
      const isCorner = txt.includes("góc") || txt.includes("goc") || txt.includes("2 mặt tiền") || txt.includes("2 mat tien") || txt.includes("hai mặt tiền") || txt.includes("hai mat tien");

      if (frontageType === "mt") return isFront;
      if (frontageType === "goc") return isCorner;
      if (frontageType === "hxh") return !isFront && isHxh;
      if (frontageType === "hem") return !isFront && !isHxh && !isCorner;
      return true;
    }

    // --- CẬP NHẬT: applyFilters (VẼ FULL BẢN ĐỒ) ---

    // --- CẬP NHẬT: applyFilters (ĐÃ SỬA LOGIC ADMIN) ---
    async function applyFilters(resetPage = false) {
      if (resetPage) PAGE = 0;
      const f = getFilterValues();

      // 1. Tạo Query cơ sở (Dùng chung cho cả List và Map)
      const SAFE_LIST_COLUMNS = [
        "id", "code", "images", "price", "area", "width", "length", "floors", "pn", "wc",
        "ket_cau", "road_type", "frontage", "direction", "status", "ward", "district",
        "city", "street", "created_at", "updated_at", "is_approved", "rented_reported_at",
        "rented_confirmed_at", "rented_reporter_email",
        "reactivate_reported_at", "reactivate_confirmed_at", "reactivate_reporter_email",
        "is_featured", "featured_order", "featured_at", "is_deleted"
      ].join(",");
      const buildBaseQuery = () => {
          const needsAdminTable = (typeof SHOW_DELETED !== "undefined" && SHOW_DELETED && isAdmin())
            || (typeof SHOW_REPORTED !== "undefined" && SHOW_REPORTED)
            || (typeof SHOW_REACTIVATE !== "undefined" && SHOW_REACTIVATE)
            || (typeof SHOW_PENDING !== "undefined" && SHOW_PENDING && isAdmin())
            || (typeof isAdmin === "function" && isAdmin() && CURRENT_VIEW === "table");
          const sourceTable = needsAdminTable ? "premises" : "public_premises_view";
          let q = db.from(sourceTable).select(SAFE_LIST_COLUMNS, { count: "exact" });
          if (typeof SHOW_DELETED !== "undefined" && SHOW_DELETED && isAdmin()) {
            q = q.eq("is_deleted", true);
          } else {
            q = q.or("is_deleted.is.null,is_deleted.eq.false");
          }
          if (typeof SHOW_FEATURED !== "undefined" && SHOW_FEATURED && isAdmin()) {
            q = q.eq("is_featured", true);
          }
          
          // --- LOGIC QUAN TRỌNG: XỬ LÝ CÁC CHẾ ĐỘ ADMIN ---
          
          // 1. Nếu đang xem "Báo hết" (Nhân sự báo, chờ Admin duyệt)
          if (typeof SHOW_REPORTED !== 'undefined' && SHOW_REPORTED) {
             q = q.not("rented_reported_at", "is", null)  // Có ngày báo hết
                  .is("rented_confirmed_at", null);       // Chưa được duyệt
          }
          // 2. Nếu đang xem "Duyệt chạy lại" (Hàng hết muốn chạy lại)
          else if (typeof SHOW_REACTIVATE !== 'undefined' && SHOW_REACTIVATE) {
             q = q.not("reactivate_reported_at", "is", null) // Có ngày báo chạy lại
                  .is("reactivate_confirmed_at", null);      // Chưa được duyệt
          }
          // 3. Nếu đang xem "Cần duyệt" (Tin mới tạo)
          else if (typeof SHOW_PENDING !== 'undefined' && SHOW_PENDING && isAdmin()) {
             q = q.eq("is_approved", false);
          }
          // 4. Mặc định: Chỉ hiện tin ĐÃ DUYỆT
          else {
             q = q.eq("is_approved", true);
          }

          // -- Áp dụng tiếp các bộ lọc (để Admin có thể tìm kiếm trong danh sách cần duyệt) --
          if (f.keyword) {
            const kw = "%" + f.keyword + "%";
            const searchCols = sourceTable === "public_premises_view"
              ? `street.ilike.${kw},ward.ilike.${kw},district.ilike.${kw},code.ilike.${kw},road_type.ilike.${kw},ket_cau.ilike.${kw}`
              : `address.ilike.${kw},street.ilike.${kw},ward.ilike.${kw},district.ilike.${kw},code.ilike.${kw},detail.ilike.${kw},road_type.ilike.${kw}`;
            q = q.or(searchCols);
          }
          if (f.street) {
            const streetKw = "%" + f.street + "%";
            const streetCols = sourceTable === "public_premises_view"
              ? `street.ilike.${streetKw}`
              : `street.ilike.${streetKw},address.ilike.${streetKw},detail.ilike.${streetKw}`;
            q = q.or(streetCols);
          }
          if (f.district && f.district.length > 0) {
              q = q.in("district", f.district);
          }
          if (f.ward) q = q.eq("ward", f.ward);
          
          // Lưu ý: Khi đang xem "Báo hết" hoặc "Chạy lại", ta không lọc theo status 
          // vì status lúc đó có thể là 'rented' hoặc 'available' tùy ngữ cảnh.
          // Chỉ lọc status khi ở chế độ xem bình thường
          if (!SHOW_REPORTED && !SHOW_REACTIVATE && f.status) {
              q = q.eq("status", f.status);
          }

          if (f.priceMin != null) q = q.gte("price", f.priceMin * 1000000);
          if (f.priceMax != null) q = q.lte("price", f.priceMax * 1000000);
          if (f.areaMin != null) q = q.gte("area", f.areaMin);
          if (f.areaMax != null) q = q.lte("area", f.areaMax);
          if (f.widthMin != null) {
              q = q.gte("width", f.widthMin); // Lọc chiều ngang >= giá trị nhập
          }
          if (f.lengthMin != null) {
              q = q.gte("length", f.lengthMin); // Lọc chiều dài >= giá trị nhập
          }

          if (f.frontageType === "mt") {
              q = q.eq("frontage", true);
          } else if (f.frontageType === "hxh") {
              q = q.eq("frontage", false);
              q = q.or(sourceTable === "public_premises_view"
                ? "road_type.ilike.%Hẻm xe hơi%,ket_cau.ilike.%hxh%,ket_cau.ilike.%xe hơi%"
                : "road_type.ilike.%Hẻm xe hơi%,detail.ilike.%hxh%,detail.ilike.%xe hơi%,address.ilike.%hxh%,address.ilike.%xe hơi%");
          } else if (f.frontageType === "goc") {
              q = q.or(sourceTable === "public_premises_view"
                ? "road_type.ilike.%góc%,road_type.ilike.%2 mặt tiền%,street.ilike.%góc%"
                : "road_type.ilike.%góc%,road_type.ilike.%2 mặt tiền%,detail.ilike.%góc%,detail.ilike.%2 mặt tiền%,address.ilike.%góc%,street.ilike.%góc%");
          } else if (f.frontageType === "hem") {
              q = q.eq("frontage", false);
          }
          // --- XỬ LÝ SỐ PN (ĐA LỰA CHỌN) ---
          if (f.pn && f.pn.length > 0) {
             const exactNums = f.pn.filter(x => !x.includes(">")); // Lấy số thường: ["2", "3"]
             const hasGt = f.pn.find(x => x.includes(">"));        // Lấy dấu >: ">6"
             
             if (hasGt) {
                 // Nếu chọn cả số cụ thể VÀ >6 (VD: Chọn 2, 3 và >6)
                 // Logic: (pn IN (2,3)) HOẶC (pn > 6)
                 const gtVal =parseInt(hasGt.replace(">", ""));
                 if (exactNums.length > 0) {
                     q = q.or(`pn.in.(${exactNums.join(',')}),pn.gt.${gtVal}`);
                 } else {
                     q = q.gt("pn", gtVal); // Chỉ chọn >6
                 }
             } else {
                 // Chỉ chọn số cụ thể
                 q = q.in("pn", exactNums);
             }
          }

          // --- XỬ LÝ SỐ WC (ĐA LỰA CHỌN) ---
          if (f.wc && f.wc.length > 0) {
             const exactNums = f.wc.filter(x => !x.includes(">"));
             const hasGt = f.wc.find(x => x.includes(">"));
             
             if (hasGt) {
                 const gtVal = parseInt(hasGt.replace(">", ""));
                 if (exactNums.length > 0) {
                     q = q.or(`wc.in.(${exactNums.join(',')}),wc.gt.${gtVal}`);
                 } else {
                     q = q.gt("wc", gtVal);
                 }
             } else {
                 q = q.in("wc", exactNums);
             }
          }

          // --- XỬ LÝ SỐ TẦNG (ĐA LỰA CHỌN) ---
          if (f.floors && f.floors.length > 0) {
             const exactNums = f.floors.filter(x => !x.includes(">"));
             const hasGt = f.floors.find(x => x.includes(">"));
             
             if (hasGt) {
                 const gtVal = parseInt(hasGt.replace(">", ""));
                 if (exactNums.length > 0) {
                     q = q.or(`floors.in.(${exactNums.join(',')}),floors.gt.${gtVal}`);
                 } else {
                     q = q.gt("floors", gtVal);
                 }
             } else {
                 q = q.in("floors", exactNums);
             }
          }

          return q;
      };

      // --- NHIỆM VỤ 1: LẤY DỮ LIỆU DANH SÁCH ---
      const from = PAGE * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const sortConfig = getSortConfig(f.sort);
      let listQuery = buildBaseQuery()
        .order(sortConfig.column, { ascending: sortConfig.ascending, nullsFirst: false });
      if (sortConfig.column !== "updated_at") {
        listQuery = listQuery.order("updated_at", { ascending: false, nullsFirst: false });
      }
      listQuery = listQuery.range(from, to);

      const { data, error, count } = await listQuery;

      if (error) {
        console.error(error);
        toast("Lỗi tải dữ liệu: " + error.message);
        return;
      }

      let rows = (data || []).filter((row) => matchesFrontageType(row, f.frontageType));

      // Nếu KHÔNG phải chế độ Admin, sắp xếp status (Còn trống lên đầu)
      if (!SHOW_REPORTED && !SHOW_REACTIVATE && !SHOW_PENDING && !f.sort) {
          const STATUS_ORDER = { available: 0, deposited: 1, rented: 2 };
          rows.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
      }

      LAST_ROWS = rows;
      TOTAL_COUNT = count || 0;

      // Render
      if (PAGE === 0) renderCards(LAST_ROWS, true);
      else renderCards(LAST_ROWS, false);
      
      if (CURRENT_VIEW === 'table') {
          renderTable(LAST_ROWS);
      }
      // UI update
      const showCountEl = document.getElementById("count-show");
      const totalCountEl = document.getElementById("count-total");
      const mobileShowCountEl = document.getElementById("mobile-count-show");
      const mobileTotalCountEl = document.getElementById("mobile-count-total");
      if(showCountEl) showCountEl.textContent = Math.min((PAGE + 1) * PAGE_SIZE, TOTAL_COUNT);
      if(totalCountEl) totalCountEl.textContent = TOTAL_COUNT;
      if(mobileShowCountEl) mobileShowCountEl.textContent = Math.min((PAGE + 1) * PAGE_SIZE, TOTAL_COUNT);
      if(mobileTotalCountEl) mobileTotalCountEl.textContent = TOTAL_COUNT;
      
      const btnMore = document.getElementById("btn-load-more");
      if(btnMore) {
          if ((PAGE + 1) * PAGE_SIZE >= TOTAL_COUNT) {
              btnMore.textContent = "Hết dữ liệu";
              btnMore.classList.add("btn-disabled");
          } else {
              btnMore.textContent = "Tải thêm";
              btnMore.classList.remove("btn-disabled");
          }
      }

      // --- NHIỆM VỤ 2: BẢN ĐỒ ---
      // Không fetch lat/lng trực tiếp ở danh sách. Vị trí chính xác chỉ được lấy qua RPC
      // get_premise_sensitive_detail() khi user có quyền mở bản đồ trong popup.
      if (PAGE === 0) {
          clearMapMarkers();
      }
    }

    // ===== HÀM VẼ LƯỚI SẢN PHẨM (ĐÃ CẬP NHẬT HIỂN THỊ TRẠNG THÁI) =====
    function renderCards(rows, replace) {
      const grid = document.getElementById("grid");
      if (replace) grid.innerHTML = "";

      if (!rows || rows.length === 0) {
        if (PAGE === 0) {
          grid.innerHTML = `
            <div class="col-span-full text-center text-sm opacity-70 py-10">
              Chưa có mặt bằng nào khớp bộ lọc hiện tại.
            </div>`;
        }
        return;
      }

      // Sắp xếp: Tin đã ghim lên đầu
      const favSet = new Set(getFavoriteIds());
      const sortedRows = [...rows].sort((a, b) => {
        const af = favSet.has(a.id);
        const bf = favSet.has(b.id);
        if (af === bf) return 0;
        return af ? -1 : 1; 
      });

      const html = sortedRows.map((row) => {
        // --- 1. XỬ LÝ ẢNH ---
        let firstPath = null;
        if (Array.isArray(row.images) && row.images.length > 0) firstPath = row.images[0];
        else if (typeof row.images === "string" && row.images.trim()) {
          try {
            if (row.images.startsWith("[")) firstPath = JSON.parse(row.images)[0];
            else firstPath = row.images.split(/[\n;,]+/)[0];
          } catch (e) {}
        }
        const imgUrl = firstPath ? buildImageUrl(firstPath) : null;

        // --- 2. XỬ LÝ TIÊU ĐỀ & THÔNG SỐ ---
        let title = "Đang cập nhật";
        try { title = buildTitle(row); } catch(e) {}
        if (!title || title === "") title = row.address || "Mặt bằng chưa có tên";

        const pnVal = row.pn || row.so_pn || row.bedrooms || row.rooms || "";
        const areaDisplay = row.area ? Number(row.area).toFixed(2).replace(/\.00$/, '') : "";
        const updatedLabel = formatDateVN(row.updated_at || row.created_at);
        const addressLine = maskAddress(row) || [row.street, row.ward, row.district].filter(Boolean).join(", ");

        // --- 3. [MỚI] XỬ LÝ TRẠNG THÁI (HIỂN THỊ CÒN/HẾT) ---
        let statusBadgeHtml = "";
        if (row.status === 'rented') {
            statusBadgeHtml = `<span class="premise-status status-rented">Đã thuê</span>`;
        } else if (row.status === 'deposited') {
             statusBadgeHtml = `<span class="premise-status status-deposited">Đã cọc</span>`;
        } else {
             // Mặc định là available
             statusBadgeHtml = `<span class="premise-status status-available">Còn trống</span>`;
        }
        // ---------------------------------------------

        // --- 4. CÁC NÚT BẤM & BADGE KHÁC ---
        const staffReportBadge =
          row.rented_reported_at && row.status !== "rented"
            ? `<span class="badge badge-xs badge-warning border-none ml-1">NS báo hết</span>`
            : "";

        let approveBtn = "";
        if (typeof SHOW_PENDING !== 'undefined' && SHOW_PENDING && isAdmin()) {
          approveBtn = `
            <button onclick="approveOne('${row.id}', event)" 
              class="btn btn-xs btn-success text-white px-2 shadow-sm z-30 relative ml-auto">
              ✔ Duyệt
            </button>`;
        }

        const isFav = favSet.has(row.id);
        const favBtnHtml = `
            <button 
              type="button"
              class="fav-btn premise-fav-btn btn btn-sm btn-circle border-none ${isFav ? 'is-fav bg-white text-yellow-500' : 'bg-white/90 text-gray-400 hover:bg-white text-lg'}"
              data-id="${row.id}" 
              onclick="toggleFavorite(event, '${row.id}')"
              title="${isFav ? 'Bỏ ghim' : 'Ghim tin này'}"
            >
              ${isFav ? '★' : '☆'}
            </button>
        `;

        let reporterInfo = "";
        let adminActions = "";
        
        if (isAdmin() && row.rented_reported_at && !row.rented_confirmed_at) {
             reporterInfo = `<div class="mt-1 text-[10px] font-bold text-error bg-red-50 p-1 rounded border border-red-100 truncate">
                                👤 Báo hết: ${row.rented_reporter_email || 'Ẩn danh'}
                             </div>`;
             adminActions = `
                <div class="flex gap-2 mt-2 z-30 relative">
                    <button onclick="confirmRented('${row.id}', event)" class="btn btn-xs btn-error text-white flex-1 shadow-sm hover:scale-105 transition-transform">✔ Xác nhận</button>
                    <button onclick="cancelRented('${row.id}', event)" class="btn btn-xs btn-outline border-gray-300 text-gray-500 flex-1 hover:bg-gray-100">✕ Huỷ</button>
                </div>`;
        } else if (row.reactivate_reported_at && !row.reactivate_confirmed_at) {
             reporterInfo = `<div class="mt-1 text-[10px] font-bold text-info bg-blue-50 p-1 rounded border border-blue-100 truncate">
                                👤 Báo chạy lại: ${row.reactivate_reporter_email || 'Ẩn danh'}
                             </div>`;
        } else if (row.is_approved === false) {
             reporterInfo = `<div class="mt-1 text-[10px] font-bold text-warning bg-yellow-50 p-1 rounded border border-yellow-100 truncate">
                                👤 Người đăng: ${row.creator_email || 'Ẩn danh'}
                             </div>`;
        }

        // --- 5. TRẢ VỀ HTML ---
        return `
          <article 
            class="premise-card cursor-pointer overflow-hidden flex flex-col group relative"
            data-id="${row.id}">
            
            <figure class="premise-card-media w-full bg-gray-100 shrink-0 relative">
              <div id="thumb-box-${row.id}" 
                class="w-full h-full flex items-center justify-center overflow-hidden">
                ${
                  imgUrl
                    ? `<img src="${imgUrl}" alt="img" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />`
                    : `<div class="text-[10px] text-gray-400 flex flex-col items-center gap-1"><span>Đang tìm ảnh...</span></div>`
                }
              </div>
              <div class="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end pointer-events-auto">
                 ${staffReportBadge}
                 ${favBtnHtml}
              </div>
            </figure>

            <div class="premise-card-body flex-1 flex flex-col justify-between min-w-0 bg-white relative">
              <div>
                <div class="flex items-center gap-1 mb-2">
                  ${statusBadgeHtml}
                  ${row.road_type ? `<span class="premise-chip">${row.road_type}</span>` : ""}
                  ${row.is_featured ? `<span class="premise-chip bg-violet-50 text-violet-700">Nổi bật</span>` : ""}
                </div>

                <h3 class="premise-title line-clamp-2">
                    ${title}
                </h3>
                <div class="premise-address truncate">
                   <span class="truncate">${addressLine}</span>
                </div>
                
                <div class="premise-specs">
                  ${row.width ? `<span>${row.width}m ngang</span>` : ""}
                  ${row.length ? `<span>${row.length}m dài</span>` : ""}
                  ${areaDisplay ? `<span>${areaDisplay}m²</span>` : ""}
                  ${pnVal ? `<span>${pnVal}PN</span>` : ""}
                </div>
              </div>

              <div class="premise-card-footer flex items-end justify-between">
                <div>
                   <div class="premise-price">
                     ${money(row.price)}
                   </div>
                   <div class="premise-date">
                     ${updatedLabel}
                   </div>
                </div>
                <div class="flex flex-col gap-1 items-end">
                  ${approveBtn}
                  <button data-save-listing="${row.id}" onclick="toggleSavedListing(event, '${row.id}')" class="btn btn-xs ${isFav ? 'btn-primary' : 'btn-outline'}">
                    ${isFav ? 'Đã lưu' : 'Lưu'}
                  </button>
                  <button onclick="openAddToCollectionDialog('${row.id}', event)" class="btn btn-xs btn-outline">
                    Bộ gửi khách
                  </button>
                  <button onclick="copyPremiseSummary('${row.id}', event)" class="btn btn-xs btn-outline">
                    Copy mô tả
                  </button>
                  <button onclick="openDetail('${row.id}')" class="btn btn-xs btn-primary">
                    Xem chi tiết
                  </button>
                  ${isAdmin() ? `<button onclick="toggleFeaturedListing('${row.id}', ${row.is_featured === true})" class="btn btn-xs btn-outline">${row.is_featured ? "Gỡ nổi bật" : "Đề xuất"}</button>` : ""}
                  ${isAdmin() ? `<button onclick="openDeleteListingConfirm('${row.id}')" class="btn btn-xs btn-error btn-outline">Xóa</button>` : ""}
                </div>
              </div>
              ${adminActions}
              ${reporterInfo}
            </div>
          </article>
        `;
      });

      grid.insertAdjacentHTML("beforeend", html.join(""));
      
      // Gắn sự kiện click xem chi tiết
      grid.querySelectorAll(".premise-card").forEach((el) => {
        el.onclick = (e) => {
          if(e.target.closest('button')) { e.stopPropagation(); return; }
          const id = el.getAttribute("data-id");
          if (id) openDetail(id);
        };
      });

      // Quét ảnh tự động sau khi vẽ xong
      if (typeof scanGridImages === "function") {
        setTimeout(() => {
            scanGridImages(sortedRows).catch(err => console.warn("Lỗi quét ảnh:", err));
        }, 150);
      }
    }

    function copyPremiseSummary(id, event) {
      if (event) event.stopPropagation();
      const row = (LAST_ROWS || []).find(item => item.id === id);
      if (!row) {
        toast("Không tìm thấy mặt bằng để copy.");
        return;
      }

      let title = "";
      try { title = buildTitle(row); } catch(e) {}
      if (!title) title = row.address || row.street || row.code || "Mặt bằng Môi giới Pro";

      const address = maskAddress(row);
      const canViewFull = typeof canViewFullPremiseInfo === "function" && canViewFullPremiseInfo();
      const size = row.width && row.length ? `${row.width} x ${row.length}m` : "";
      const text = [
        title,
        address ? `Khu vực: ${address}` : "",
        row.price ? `Giá thuê: ${money(row.price)}` : "",
        size ? `Kích thước: ${size}` : "",
        row.area ? `Diện tích: ${row.area}m2` : "",
        row.pn ? `Số phòng: ${row.pn}PN` : "",
        row.ket_cau ? `Kết cấu: ${row.ket_cau}` : "",
        canViewFull && row.detail ? `Ghi chú: ${row.detail}` : "",
        !canViewFull ? "Ghi chú nguồn hàng và liên hệ chỉ hiển thị với gói Pro." : "",
      ].filter(Boolean).join("\n");

      navigator.clipboard?.writeText(text)
        .then(() => toast("Đã copy mô tả mặt bằng"))
        .catch(() => {
          window.prompt("Copy mô tả mặt bằng:", text);
        });
    }
    // --- HÀM KHÔI PHỤC: NẠP DANH SÁCH QUẬN VÀO BỘ LỌC ---
    async function buildDistrictWardOptions() {
      const distSelect = document.getElementById("filter-district");
      if (!distSelect) return;

      // Giữ lại option đầu tiên (Tất cả) và xóa các option cũ nếu có
      distSelect.innerHTML = '<option value="">Tất cả</option>';

      // Lấy danh sách tên Quận từ biến HCM_DATA (đã khai báo ở đầu file)
      const dists = Object.keys(HCM_DATA).sort();
      
      // Tạo từng dòng option cho Quận
      dists.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        distSelect.appendChild(opt);
      });
      
      console.log("Đã nạp xong danh sách Quận vào bộ lọc.");
    }
    // === HÀM MỚI: LỌC PHƯỜNG THEO QUẬN TỪ HCM_DATA ===
    function updateWardOptions() {
      const district = document.getElementById("filter-district").value;
      const selectWard = document.getElementById("filter-ward");
      selectWard.innerHTML = '<option value="">Tất cả</option>';

      if (!district || !HCM_DATA[district]) return;

      const wards = HCM_DATA[district];
      wards.forEach((w) => {
        const opt = document.createElement("option");
        opt.value = w;
        opt.textContent = w;
        selectWard.appendChild(opt);
      });
    }
    // ===== CÁC HÀM HỖ TRỢ (UTILS) =====

    function buildTitle(item) {
      if (!item) return "";

      const street = item.street ? item.street.toUpperCase() : "";
      const detail = (item.detail || "").toLowerCase();
      const ket = (item.ket_cau || "").toLowerCase();

      // ==== 1. XÁC ĐỊNH LOẠI HÌNH (MB / NNC) ====
      let type = "NNC"; // mặc định NNC

      // MẶT BẰNG nếu bài có MB / LDC / LDR trong mô tả
      if (
        detail.includes(" mb") || detail.startsWith("mb ") || detail.includes("mb ") ||
        detail.includes("ldc") ||
        detail.includes("ldr")
      ) {
        type = "MB";
      }

      // Nếu không có MB nhưng có kết cấu nhà → NNC
      if (
        ket.includes("trệt") || ket.includes("tret") ||
        ket.includes("lầu")  || ket.includes("lau") ||
        ket.includes("lửng") || ket.includes("lung") ||
        ket.includes("tum")  ||
        ket.includes("pn")   ||
        ket.includes("wc")
      ) {
        type = "NNC";
      }

      // ==== 2. HƯỚNG (MT / HXH / HEM) ====
      let huong = "HEM";
      const addr = (item.address || "").toLowerCase();

      if (item.frontage) huong = "MT";
      else if (addr.includes("/")) huong = "HXH";
      else if (detail.includes("hxh")) huong = "HXH";

      // ==== 3. PN / WC ====
      const pn = item.pn ? `${item.pn}PN` : "";
      const wc = item.wc ? `${item.wc}WC` : "";

      // ==== 4. DIỆN TÍCH ====
      let dientich = "";
      if (item.width && item.length) {
        dientich = `${item.width}X${item.length}`;
      } else if (item.area) {
        dientich = `${item.area}M2`;
      }

      // ==== 5. KẾT CẤU ====
      const ketcau = item.ket_cau ? item.ket_cau.toUpperCase() : "";

      // ==== 6. QUẬN ====
      let quan = "";
      if (item.district) {
        const q = item.district.replace("Q.", "").replace("Quận", "").trim();
        quan = `QUẬN ${q}`;
      }

      // ==== GHÉP TIÊU ĐỀ ====
      const parts = [
        type,
        huong,
        street,
        pn,
        wc,
        dientich,
        ketcau,
        quan
      ].filter(p => p);

      return parts.join(" - ").toUpperCase();
    }

