    let PICKER_MAP = null;
    let PICKER_MARKER = null;

    // Hàm khởi tạo bản đồ chọn vị trí
    function initPickerMap(mapId, latInputId, lngInputId, initialLat, initialLng) {
        // 1. Xóa map cũ nếu đã có (để tránh lỗi khởi tạo lại)
        if (PICKER_MAP) {
            PICKER_MAP.remove();
            PICKER_MAP = null;
            PICKER_MARKER = null;
        }

        const mapEl = document.getElementById(mapId);
        if (!mapEl) return;

        // 2. Xác định tâm bản đồ: Ưu tiên input > tham số truyền vào > Mặc định (HCM)
        let lat = document.getElementById(latInputId).value || initialLat || 10.7769;
        let lng = document.getElementById(lngInputId).value || initialLng || 106.7009;

        // 3. Tạo Map
        PICKER_MAP = L.map(mapId).setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(PICKER_MAP);

        // 4. Tạo Marker có thể kéo thả (draggable: true)
        PICKER_MARKER = L.marker([lat, lng], { draggable: true }).addTo(PICKER_MAP);

        // --- SỰ KIỆN QUAN TRỌNG: KHI KÉO GHIM ---
        PICKER_MARKER.on('dragend', function(e) {
            const coord = e.target.getLatLng();
            // Cập nhật ngược lại vào ô Input
            document.getElementById(latInputId).value = coord.lat.toFixed(6);
            document.getElementById(lngInputId).value = coord.lng.toFixed(6);
        });

        // Sự kiện click vào bản đồ cũng di chuyển ghim tới đó
        PICKER_MAP.on('click', function(e) {
            PICKER_MARKER.setLatLng(e.latlng);
            document.getElementById(latInputId).value = e.latlng.lat.toFixed(6);
            document.getElementById(lngInputId).value = e.latlng.lng.toFixed(6);
        });

        // Fix lỗi hiển thị map trong modal (bị xám)
        setTimeout(() => { PICKER_MAP.invalidateSize(); }, 300);
    }
    // --- CẬP NHẬT: HÀM TÌM TỌA ĐỘ THÔNG MINH (FALLBACK) ---
    async function autoFetchCoords() {
        const addressInput = document.getElementById("add-address").value; // VD: 490/8 Lê Văn Sỹ
        const district = document.getElementById("add-district").value;    // VD: Quận 3
        const streetInput = document.getElementById("add-street").value;   // VD: Lê Văn Sỹ (nếu có nhập)
        const city = "Hồ Chí Minh";

        if (!district) {
            alert("Vui lòng chọn Quận trước!");
            return;
        }

        const btn = document.querySelector("button[onclick='autoFetchCoords()']");
        const originalText = btn.innerText;
        btn.innerText = "Đang dò...";
        btn.disabled = true;

        // Hàm con để gọi API
        const callApi = async (query) => {
            try {
                console.log("Đang tìm: " + query);
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
                const res = await fetch(url);
                const data = await res.json();
                return (data && data.length > 0) ? data[0] : null;
            } catch (e) {
                return null;
            }
        };

        try {
            let result = null;

            // --- CHIẾN THUẬT 1: Tìm chính xác cả số nhà ---
            // Ưu tiên lấy tên đường từ ô "Tên đường" nếu nhân viên có nhập, vì nó chuẩn hơn
            let streetName = streetInput; 
            if (!streetName && addressInput) {
                // Cố gắng đoán tên đường từ địa chỉ (Bỏ số nhà ở đầu)
                // VD: "490/8 Lê Văn Sỹ" -> lấy "Lê Văn Sỹ" (cách đơn giản)
                const parts = addressInput.split(" ");
                if (parts.length > 1 && /^\d/.test(parts[0])) { 
                    parts.shift(); // Bỏ phần số (VD: 490/8)
                    streetName = parts.join(" ");
                } else {
                    streetName = addressInput;
                }
            }

            // Thử tìm full địa chỉ trước: "490/8 Lê Văn Sỹ, Quận 3, Hồ Chí Minh"
            const fullQuery = `${addressInput}, ${district}, ${city}`;
            result = await callApi(fullQuery);

            // --- CHIẾN THUẬT 2: Nếu thất bại, tìm theo TÊN ĐƯỜNG + QUẬN ---
            if (!result && streetName) {
                toast("Không tìm thấy số nhà, đang tìm theo tên đường...");
                // Query: "Đường Lê Văn Sỹ, Quận 3, Hồ Chí Minh"
                const streetQuery = `${streetName}, ${district}, ${city}`;
                result = await callApi(streetQuery);
            }

            // --- KẾT QUẢ ---
            if (result) {
                const lat = result.lat;
                const lng = result.lon; // API trả về 'lon'

                // 1. Điền vào ô input
                document.getElementById("add-lat").value = lat;
                document.getElementById("add-lng").value = lng;

                // 2. Cập nhật bản đồ chọn (Picker Map) nếu đã cài đặt ở bước trước
                if (typeof PICKER_MAP !== 'undefined' && PICKER_MAP && PICKER_MARKER) {
                    const newLatLng = new L.LatLng(lat, lng);
                    PICKER_MARKER.setLatLng(newLatLng);
                    PICKER_MAP.setView(newLatLng, 16);
                }

                toast(`Đã ghim tại: ${result.display_name.split(',')[0]}`);
            } else {
                alert("Không tìm thấy cả đường lẫn số nhà. Vui lòng nhập thủ công hoặc kiểm tra lại tên đường.");
            }

        } catch (e) {
            console.error(e);
            toast("Lỗi kết nối bản đồ.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
    // ===== CHI TIẾT & SỬA =====
    // ===== CHI TIẾT & SỬA (ĐÃ NÂNG CẤP TỰ QUÉT ẢNH STORAGE) =====
    // ===== CHI TIẾT & SỬA (ĐÃ SỬA LỖI THỨ TỰ KHAI BÁO) =====
    function cleanBrandText(value = "") {
      return String(value || "")
        .replace(/ID-Land Premises/gi, "Môi giới Pro")
        .replace(/ID-Land Marketplace/gi, "Môi giới Pro")
        .replace(/ID[-\s]?LAND/gi, "Môi giới Pro")
        .replace(/ID-Land/gi, "Môi giới Pro");
    }

    function detailEscapeHtml(value = "") {
      return cleanBrandText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function detailValue(value, suffix = "") {
      if (value === undefined || value === null || value === "") return "-";
      return `${detailEscapeHtml(value)}${suffix}`;
    }

    function detailStatusMeta(status) {
      if (status === "rented") return { label: "Đã thuê", cls: "is-rented" };
      if (status === "deposited") return { label: "Đã cọc", cls: "is-deposited" };
      return { label: "Còn trống", cls: "is-available" };
    }

    function detailBuildBullets(item, displayAddress, detailText, canViewFull) {
      const bullets = [
        buildTitle(item) ? `Cho thuê ${buildTitle(item)}` : "",
        item.price ? `Giá thuê: ${money(item.price)}/tháng` : "",
        item.area ? `Diện tích: ${item.area} m²` : "",
        item.width && item.length ? `Kích thước: ${item.width}m x ${item.length}m` : "",
        item.ket_cau ? `Kết cấu: ${item.ket_cau}` : "",
        item.road_type || item.frontage ? `Vị trí: ${item.road_type || "Mặt tiền"}` : "",
        displayAddress ? `Khu vực: ${displayAddress}` : "",
      ].filter(Boolean);

      if (canViewFull && detailText) {
        detailText
          .split(/\n|\.|;|\+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 6)
          .forEach((line) => bullets.push(line));
      } else if (!canViewFull) {
        bullets.push("Ghi chú nguồn hàng đang được ẩn với gói Free/Basic.");
      }

      return [...new Set(bullets)].slice(0, 10);
    }

    function selectDetailImage(index) {
      const images = CURRENT_DETAIL?.resolvedImages || [];
      const url = images[index];
      const main = document.getElementById("detail-main-img");
      const count = document.getElementById("detail-image-count");
      if (!url || !main) return;
      main.src = url;
      if (count) count.textContent = `${index + 1}/${images.length}`;
      document.querySelectorAll(".listing-thumb").forEach((thumb) => {
        thumb.classList.toggle("is-active", Number(thumb.dataset.index) === index);
      });
    }

    async function openDetail(id) {
      const dlg = document.getElementById("detailDlg");
      const wrap = document.getElementById("detail-content");
      wrap.innerHTML = `<div class="py-10 text-center text-sm opacity-70"><span class="loading loading-spinner"></span> Đang tải dữ liệu và quét hình ảnh...</div>`;
      dlg.showModal();

      const isPaidPlan = typeof canViewOwnerPhone === "function" && canViewOwnerPhone();
      const canLoadPrivate = (typeof isAdmin === "function" && isAdmin()) || isPaidPlan;
      const publicColumns = [
        "id", "code", "images", "price", "area", "width", "length", "floors", "pn", "wc",
        "ket_cau", "road_type", "frontage", "direction", "status", "ward", "district",
        "city", "street", "created_at", "updated_at", "is_approved", "rented_reported_at",
        "rented_confirmed_at", "reactivate_reported_at", "reactivate_confirmed_at",
        "is_featured", "featured_at", "is_deleted"
      ].join(",");

      // 1. Lấy thông tin căn nhà từ Database
      const { data, error } = await db
        .from("premises")
        .select(publicColumns)
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        wrap.innerHTML = `<div class="py-10 text-center text-sm text-error">Không tải được dữ liệu.</div>`;
        return;
      }

      const item = data;

      // --- [SỬA LỖI] ĐƯA ĐOẠN TÍNH TOÁN ẢNH LÊN TRƯỚC ---
      let imgUrls = [];
      let rawImgs = item.images;

      // Bước 2a: Thử lấy từ Database trước
      if (Array.isArray(rawImgs) && rawImgs.length > 0) {
        imgUrls = rawImgs.map(p => buildImageUrl(p)).filter(Boolean);
      } 
      else if (typeof rawImgs === "string" && rawImgs.trim()) {
         let paths = [];
         try {
            if (rawImgs.startsWith("[")) paths = JSON.parse(rawImgs);
            else paths = rawImgs.split(/[\n;,]+/).map(s => s.trim());
         } catch(e) { paths = []; }
         imgUrls = paths.map(p => buildImageUrl(p)).filter(Boolean);
      }

      // Bước 2b: Nếu vẫn chưa có ảnh nào -> QUÉT STORAGE
      if (imgUrls.length === 0 && item.code) {
          console.log("Database không có ảnh, đang quét Storage folder:", item.code);
          const { data: files, error: listError } = await db.storage
            .from(STORAGE_BUCKET)
            .list(item.code, {
                limit: 50,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

          if (!listError && files && files.length > 0) {
              const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
              imgUrls = validFiles.map(f => {
                  const fullPath = `${item.code}/${f.name}`;
                  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
                  return data.publicUrl;
              });
          }
      }

      // --- SAU KHI CÓ ẢNH RỒI MỚI GÁN VÀO BIẾN TOÀN CỤC ---
      CURRENT_DETAIL = item; 
      CURRENT_DETAIL.resolvedImages = imgUrls; 
      // -----------------------------------------------------

      const pnVal = pickField(item, ["pn", "so_pn", "bedrooms", "rooms"]);
      const wcVal = pickField(item, ["wc", "bathrooms"]);
      const floorsVal = pickField(item, ["floors"]);
      const detailText = cleanBrandText(item.detail || item.description || "");
      const canViewFull = canLoadPrivate;
      const updatedLabel = formatDateVN(item.updated_at || item.created_at);
      
      const price = typeof item.price === "number" ? new Intl.NumberFormat("vi-VN").format(item.price) + " đ/tháng" : "";
      const area = item.area ? item.area + " m²" : "";

      const addressParts = [];
      if (item.street) addressParts.push(item.street);
      if (item.ward) addressParts.push(item.ward);
      if (item.district) addressParts.push(item.district);
      if (item.city) addressParts.push(item.city);
      const address = addressParts.join(", ");
      const displayAddress = maskAddress(item) || address;
      const displayDetailText = canViewFull ? detailText : "";
      const displayCommission = canViewFull ? "-" : "Ẩn với gói Free";
      const statusMeta = detailStatusMeta(item.status);
      const title = cleanBrandText(buildTitle(item) || item.street || "Mặt bằng Môi giới Pro");
      const detailBullets = detailBuildBullets(item, displayAddress, detailText, canViewFull);
      const roadLabel = item.road_type || (item.frontage ? "Mặt tiền" : item.direction || "-");
      const sourceRows = canViewFull
        ? [
            ["Nguồn", "Môi giới Pro"],
            ["Liên hệ", "Bấm Hiện số điện thoại để xem"],
            ["Ghi chú", "Ghi chú nguồn được bảo vệ theo quyền tài khoản"],
            ["Mã tin", item.code || "-"],
          ]
        : [
            ["Nguồn", "Môi giới Pro"],
            ["Ghi chú", "Thông tin nguồn chỉ dành cho gói Pro"],
            ["Mã tin", item.code || "-"],
          ];

      const mapEmbed = typeof renderMapAccessBox === "function"
        ? renderMapAccessBox(id)
        : `<div id="listing-map-panel" class="membership-map-lock">
             <div>
               <b>Bản đồ được bảo vệ</b>
               <p>Vị trí chi tiết chỉ dành cho tài khoản Basic/Pro.</p>
             </div>
           </div>`;

      const isRented = item.status === "rented";
      const isAvailableLike = item.status === "available" || item.status === "deposited";

      const actions = `
        <div class="listing-action-bar-inner">
          <button class="btn btn-sm btn-primary" data-save-listing="${id}" onclick="toggleSavedListing(event, '${id}')">
            Lưu
          </button>
          <button class="btn btn-sm btn-outline" onclick="openAddToCollectionDialog('${id}', event)">
            Bộ gửi khách
          </button>
          ${canViewFull ? `
            <button class="btn btn-sm btn-outline" onclick="copyPropertyInfo()">
              Copy mô tả
            </button>
            <button class="btn btn-sm btn-outline" onclick="loadPremiseMap('${id}', true)">
              Mở bản đồ
            </button>
            <button class="btn btn-sm btn-outline" onclick="downloadAllImages(event)">
              Tải ảnh zip
            </button>
          ` : `
            <button type="button" class="btn btn-sm btn-outline" onclick="openAccountDialog()">Nâng cấp Pro</button>
          `}

          ${isStaff() && isAvailableLike && !item.rented_reported_at && !item.rented_confirmed_at
              ? `<button class="btn btn-sm btn-error btn-outline" onclick="reportRentedStaff('${id}')">Báo hết</button>`
              : ""
          }

          ${isAdmin() && isAvailableLike
              ? `<button class="btn btn-sm btn-error text-white" onclick="reportRentedDirect('${id}')">Báo hết</button>`
              : ""
          }

          ${canViewFull && isRented && !item.reactivate_reported_at
              ? `<button class="btn btn-sm btn-outline" onclick="requestReactivate('${id}')">Báo chạy lại</button>`
              : ""
          }

          ${canViewFull && isAdmin() && item.reactivate_reported_at && !item.reactivate_confirmed_at
              ? `<button class="btn btn-sm btn-success" onclick="confirmReactivate('${id}')">Duyệt chạy lại</button>`
              : ""
          }

          ${canViewFull && isAdmin()
              ? `<button class="btn btn-outline btn-sm" onclick="openEditPremise('${id}')">Sửa</button>`
              : ""
          }
          ${isAdmin() ? `
            <button class="btn btn-sm btn-outline" onclick="toggleFeaturedListing('${id}', ${item.is_featured === true})">
              ${item.is_featured ? "Gỡ nổi bật" : "Đề xuất"}
            </button>
            <button class="btn btn-sm btn-error btn-outline" onclick="openDeleteListingConfirm('${id}')">Xóa tin</button>
          ` : ""}
        </div>
      `;

      const html = `
        <div class="listing-detail-shell">
          <header class="listing-detail-header">
            <div class="listing-detail-title-wrap">
              <h2>${detailEscapeHtml(title)}</h2>
              <p>
                <span>⌖</span>
                ${detailEscapeHtml(displayAddress || [item.ward, item.district, item.city].filter(Boolean).join(", "))}
              </p>
              <div class="listing-detail-badges">
                <span class="listing-status-badge ${statusMeta.cls}">${statusMeta.label}</span>
                <span>Mã tin: <b>${detailEscapeHtml(item.code || "---")}</b></span>
                <span>Cập nhật: ${detailEscapeHtml(updatedLabel || "-")}</span>
                ${item.is_featured ? `<span>Nguồn nổi bật</span>` : ""}
              </div>
            </div>
            <div class="listing-header-actions">
              <button type="button" class="listing-icon-btn listing-tool-btn" title="Lưu tin" data-save-listing="${id}" onclick="toggleSavedListing(event, '${id}')">♡</button>
              <button type="button" class="listing-icon-btn listing-tool-btn" title="Copy mô tả" onclick="${canViewFull ? "copyPropertyInfo()" : "openAccountDialog()"}">↗</button>
              <button type="button" class="listing-icon-btn listing-close-btn" title="Đóng" onclick="document.getElementById('detailDlg').close()">×</button>
            </div>
          </header>

          <div class="listing-detail-body">
            <section class="listing-detail-left">
              <div class="listing-gallery-main">
                ${imgUrls.length 
                  ? `<img id="detail-main-img" src="${imgUrls[0]}" loading="eager" decoding="async" alt="${detailEscapeHtml(title)}" />` 
                  : `<div class="listing-empty-image"><span>Ảnh</span><small>Chưa có hình ảnh trong folder "${detailEscapeHtml(item.code || "...")}"</small></div>`
                }
                ${imgUrls.length ? `<span id="detail-image-count" class="listing-image-count">1/${imgUrls.length}</span>` : ""}
              </div>

              ${imgUrls.length > 1 ? `
                <div class="listing-thumbs">
                  ${imgUrls.slice(0, 6).map((url, index) => {
                    const hiddenCount = imgUrls.length - 6;
                    const isLastOverflow = index === 5 && hiddenCount > 0;
                    return `
                      <button type="button" class="listing-thumb ${index === 0 ? "is-active" : ""}" data-index="${index}" onclick="selectDetailImage(${index})">
                        <img src="${url}" loading="lazy" decoding="async" alt="Ảnh ${index + 1}" />
                        ${isLastOverflow ? `<span>+${hiddenCount}</span>` : ""}
                      </button>
                    `;
                  }).join("")}
                </div>
              ` : ""}

              ${mapEmbed}
            </section>

            <section class="listing-detail-right">
              <div class="listing-price-card">
                <span>Giá thuê</span>
                <strong>${detailEscapeHtml(price || "Liên hệ")}</strong>
              </div>

              <div class="listing-quick-specs">
                ${area ? `<span><b>${detailEscapeHtml(area)}</b><small>Diện tích</small></span>` : ""}
                <span><b>${detailValue(item.width, "m")}</b><small>Ngang</small></span>
                <span><b>${detailValue(item.length, "m")}</b><small>Dài</small></span>
                <span><b>${detailValue(floorsVal)}</b><small>Tầng</small></span>
                <span><b>${detailEscapeHtml(roadLabel)}</b><small>Vị trí</small></span>
              </div>

              <div class="listing-info-card">
                <h3>Thông tin chi tiết</h3>
                <div class="listing-info-grid">
                  <div><span>Diện tích</span><b>${detailValue(item.area, " m²")}</b></div>
                  <div><span>Ngang</span><b>${detailValue(item.width, " m")}</b></div>
                  <div><span>Dài</span><b>${detailValue(item.length, " m")}</b></div>
                  <div><span>Kết cấu</span><b>${detailValue(item.ket_cau)}</b></div>
                  <div><span>Tầng</span><b>${detailValue(floorsVal)}</b></div>
                  <div><span>WC</span><b>${detailValue(wcVal)}</b></div>
                  <div><span>Hướng / vị trí</span><b>${detailEscapeHtml(roadLabel)}</b></div>
                  <div><span>Hoa hồng</span><b class="text-success">${detailEscapeHtml(displayCommission)}</b></div>
                </div>
              </div>

              ${item.status === "rented" && item.rented_confirmed_at
                  ? `<div class="listing-alert is-danger">
                       Ngày báo hết: <b>${formatDateVN(item.rented_confirmed_at)}</b>
                       ${item.rented_reporter_email ? `<br/>Người báo: <b>${detailEscapeHtml(item.rented_reporter_email)}</b>` : ""}
                     </div>`
                  : ""
              }

              ${item.rented_reported_at && !item.rented_confirmed_at
                  ? `<div class="listing-alert is-danger">
                       <b>${detailEscapeHtml(item.rented_reporter_email || 'Nhân sự')}</b> đã báo hết ngày ${formatDateVN(item.rented_reported_at)}.
                       <br/>Chờ Admin xác nhận.
                     </div>`
                  : ""
              }

              ${item.reactivate_reported_at && !item.reactivate_confirmed_at
                  ? `<div class="listing-alert is-info">
                       <b>${detailEscapeHtml(item.reactivate_reporter_email || 'Nhân sự')}</b> đã báo chạy lại ngày ${formatDateVN(item.reactivate_reported_at)}.
                       <br/>Chờ Admin duyệt.
                     </div>`
                  : ""
              }
              
              ${item.is_approved === false
                  ? `<div class="listing-alert is-warning">
                       Tin này do <b>${detailEscapeHtml(item.creator_email || 'Nhân sự')}</b> đăng, đang chờ duyệt.
                     </div>`
                  : ""
              }

              ${typeof renderOwnerPhoneBox === "function" ? renderOwnerPhoneBox(item) : ""}

              ${!canViewFull ? renderUpgradeNotice() : ""}

              <div class="listing-info-card">
                <h3>Chi tiết mặt bằng</h3>
                <ul class="listing-bullet-list">
                  ${detailBullets.map((line) => `<li>${detailEscapeHtml(line)}</li>`).join("")}
                </ul>
              </div>

              <div class="listing-source-card">
                <h3>Thông tin nguồn</h3>
                <div>
                  ${sourceRows.map(([label, value]) => `
                    <p><span>${detailEscapeHtml(label)}</span><b>${detailEscapeHtml(value)}</b></p>
                  `).join("")}
                </div>
              </div>
            </section>
          </div>

          <footer class="listing-action-bar">
            ${actions}
          </footer>
        </div>
      `;
      wrap.innerHTML = html;
    }
    
    async function saveEditPremise() {
      if (!isAdmin() || !EDITING_ID) return;
      const getVal = (id) => document.getElementById(id).value.trim();
      const getNum = (id) => { const v = getVal(id).replace(/[^\d.]/g, ""); return v ? Number(v) : 0; };

      const payload = {
        code: getVal("edit-code"),
        address: getVal("edit-address"),
        city: getVal("edit-city"),
        district: getVal("edit-district"),
        ward: getVal("edit-ward"),
        street: getVal("edit-street"),
        price: getNum("edit-price"),
        area: getNum("edit-area"),
        width: getNum("edit-width"),
        length: getNum("edit-length"),
        floors: getNum("edit-floors"),
        pn: getNum("edit-bedrooms"),
        wc: getNum("edit-wc"),
        ket_cau: getVal("edit-ket-cau"),
        contact_phone: getVal("edit-contact-phone"),
        frontage: document.getElementById("edit-frontage").checked,
        status: getVal("edit-status"),
        commission_note: getVal("edit-commission"),
        images: getVal("edit-images").split("\n").map(s => s.trim()).filter(Boolean),
        detail: getVal("edit-detail"),
        updated_at: new Date().toISOString(),
        road_type: document.getElementById("edit-road-type").value, // MỚI
        commission: getVal("edit-commission-text"), // MỚI
        lat: getVal("edit-lat") ? Number(getVal("edit-lat")) : null,
        lng: getVal("edit-lng") ? Number(getVal("edit-lng")) : null,
      };
      // Nếu admin chỉnh trạng thái khác "rented" -> xoá ngày báo hết & yêu cầu chạy lại
      if (payload.status && payload.status !== "rented") {
        payload.rented_reported_at = null;
        payload.rented_confirmed_at = null;
        payload.reactivate_reported_at = null;
        payload.reactivate_confirmed_at = null;
      }

      const { error } = await db
        .from("premises")
        .update(payload)
        .eq("id", EDITING_ID); // <--- SỬA LẠI THÀNH BIẾN TOÀN CỤC VIẾT HOA

      if (error) { toast("Lỗi: " + error.message); return; }
      toast("Đã lưu thay đổi!");
      document.getElementById("editDlg").close();
      await applyFilters(false);
    }
    // ===== BÁO HẾT (KHÔNG CẦN DUYỆT) =====
    async function reportRentedDirect(id) {
      if (!isAdmin()) return;  // chỉ admin được dùng
      if (!confirm("Xác nhận mặt bằng này đã hết / đã cho thuê?")) return;
      const nowIso = new Date().toISOString();
      const { error } = await db
        .from("premises")
        .update({
          status: "rented",
          rented_reported_at: nowIso,
          rented_confirmed_at: nowIso, // coi như duyệt luôn
          reactivate_reported_at: null,
          reactivate_confirmed_at: null,
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        toast("Lỗi báo hết: " + error.message);
        return;
      }

      toast("Đã báo hết mặt bằng này.");
      document.getElementById("detailDlg").close();
      applyFilters(true);
    }

    // ===== BÁO CHẠY LẠI (NS & ADMIN) =====
    async function requestReactivate(id) {
      if (!confirm("Báo chạy lại mặt bằng này?")) return;

      const { error } = await db
        .from("premises")
        .update({
          reactivate_reported_at: new Date().toISOString(),
          reactivate_reporter_email: CURRENT_USER.email
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        toast("Lỗi báo chạy lại: " + error.message);
        return;
      }

      toast("Đã báo chạy lại – chờ admin duyệt.");
      document.getElementById("detailDlg").close();
      applyFilters(true);
    }

    // ===== ADMIN DUYỆT CHẠY LẠI =====
    async function confirmReactivate(id) {
      if (!isAdmin()) return;
      if (!confirm("Duyệt cho mặt bằng này chạy lại?")) return;

      const { error } = await db
        .from("premises")
        .update({
          status: "available",
          reactivate_confirmed_at: new Date().toISOString(),
          reactivate_reported_at: null,
          // xoá dấu vết 'Ngày báo hết' để ẩn dòng đó
          rented_reported_at: null,
          rented_confirmed_at: null,
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        toast("Lỗi duyệt chạy lại: " + error.message);
        return;
      }

      toast("Đã duyệt cho mặt bằng chạy lại.");
      document.getElementById("detailDlg").close();
      applyFilters(true);
    }


    async function confirmRented(id, e) {
      if(e) e.stopPropagation(); // Ngăn không cho mở popup chi tiết
      if (!isAdmin()) return;
      
      if (!confirm("Xác nhận: Mặt bằng này ĐÃ ĐƯỢC CHO THUÊ?")) return;

      // Cập nhật Database
      const { error } = await db
        .from("premises")
        .update({
          status: "rented",
          rented_confirmed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) {
        toast("Lỗi: " + error.message);
        return;
      }
      
      toast("Đã xác nhận thành công! ✅");
      
      // --- CẬP NHẬT GIAO DIỆN TỨC THÌ ---
      checkRentedReportCount(); // <--- Dòng này sẽ cập nhật lại con số trên nút đỏ
      applyFilters(false);      // Tải lại danh sách (giữ nguyên trang hiện tại)
      
      // Nếu đang mở popup thì đóng luôn
      const dlg = document.getElementById("detailDlg");
      if(dlg && dlg.open) dlg.close();
    }

    // === 2. HÀM HUỶ BÁO CÁO (KHÔNG XÁC NHẬN) ===
    async function cancelRented(id, e) {
      if(e) e.stopPropagation();
      if (!isAdmin()) return;

      if (!confirm("Từ chối báo cáo này? (Mặt bằng vẫn tính là CÒN TRỐNG)")) return;

      // Xóa thông tin báo cáo trong Database
      const { error } = await db
        .from("premises")
        .update({
          rented_reported_at: null,
          rented_reporter_email: null
        })
        .eq("id", id);

      if (error) {
        toast("Lỗi: " + error.message);
        return;
      }
      
      toast("Đã huỷ báo cáo ✕");

      // --- CẬP NHẬT GIAO DIỆN TỨC THÌ ---
      checkRentedReportCount(); // <--- Cập nhật số lượng
      applyFilters(false);
      
      const dlg = document.getElementById("detailDlg");
      if(dlg && dlg.open) dlg.close();
    }

