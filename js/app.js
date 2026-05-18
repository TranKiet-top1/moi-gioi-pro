    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("btn-login")?.addEventListener("click", handleLogin);
      document.getElementById("btn-google-login")?.addEventListener("click", handleGoogleLogin);
      document.getElementById("btn-send-phone-otp")?.addEventListener("click", sendPhoneOtp);
      document.getElementById("btn-verify-phone-otp")?.addEventListener("click", verifyPhoneOtp);
      document.getElementById("auth-tab-email")?.addEventListener("click", () => setAuthTab("email"));
      document.getElementById("auth-tab-phone")?.addEventListener("click", () => setAuthTab("phone"));
      document.getElementById("btn-logout").addEventListener("click", handleLogout);
      const btnToggleRegister = document.getElementById("btn-toggle-register");
      if (btnToggleRegister) {
        btnToggleRegister.addEventListener("click", () => {
          setAuthMode(typeof AUTH_MODE !== "undefined" && AUTH_MODE === "register" ? "login" : "register");
        });
      }
      
      const filtersPanel = document.getElementById("filters-panel");
      const btnToggleMobileFilters = document.getElementById("btn-toggle-mobile-filters");
      const closeMobileFilters = () => {
        if (!filtersPanel) return;
        filtersPanel.classList.remove("is-open");
        document.body.classList.remove("filters-open");
        if (btnToggleMobileFilters) btnToggleMobileFilters.textContent = "Bộ lọc";
      };
      const openMobileFilters = () => {
        if (!filtersPanel) return;
        filtersPanel.classList.add("is-open");
        document.body.classList.add("filters-open");
        if (btnToggleMobileFilters) btnToggleMobileFilters.textContent = "Đóng";
      };
      if (btnToggleMobileFilters && filtersPanel) {
        btnToggleMobileFilters.addEventListener("click", () => {
          if (filtersPanel.classList.contains("is-open")) closeMobileFilters();
          else openMobileFilters();
        });
      }

      document.getElementById("btn-apply").addEventListener("click", () => {
        applyFilters(true);
        closeMobileFilters();
      });
      const keywordInput = document.getElementById("filter-keyword");
      if (keywordInput) {
        let keywordTimer = null;
        keywordInput.addEventListener("input", () => {
          clearTimeout(keywordTimer);
          keywordTimer = setTimeout(() => applyFilters(true), 450);
        });
      }
      const streetInput = document.getElementById("filter-street");
      if (streetInput) {
        let streetTimer = null;
        streetInput.addEventListener("input", () => {
          clearTimeout(streetTimer);
          streetTimer = setTimeout(() => applyFilters(true), 450);
        });
      }
      ["filter-ward", "filter-price-min", "filter-price-max", "filter-width-min", "filter-length-min", "filter-area-min", "filter-area-max", "filter-frontage-type", "filter-status", "filter-sort"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", () => applyFilters(true));
      });
      document.getElementById("btn-reset").addEventListener("click", () => {
        document.querySelectorAll("aside input, aside select").forEach(el => {
            if(el.type === 'checkbox') el.checked = false; // Bỏ check hết
            else el.value = "";
        });
        const sortSelect = document.getElementById("filter-sort");
        if (sortSelect) sortSelect.value = "updated_desc";
        document.getElementById("district-display-text").textContent = "Tất cả";
        document.getElementById("pn-display-text").textContent = "Tất cả";
        document.getElementById("wc-display-text").textContent = "Tất cả";
        document.getElementById("floors-display-text").textContent = "Tất cả";
        document.getElementById("district-display-text").textContent = "Tất cả";
        buildDistrictDropdown(); // Vẽ lại sạch sẽ
        applyFilters(true);
        closeMobileFilters();
      });
      // Nút mở form Đăng nhập nhân sự trên trang chủ
      const btnOpenLogin = document.getElementById("btn-open-login");
      const loginCard = document.getElementById("login-card");
      if (btnOpenLogin && loginCard) {
        btnOpenLogin.addEventListener("click", () => {
          loginCard.classList.remove("hidden");
          loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }

      document.getElementById("btn-load-more").addEventListener("click", () => {
        PAGE++;
        applyFilters(false);
      });

      // Khi chọn QUẬN trong bộ lọc -> cập nhật PHƯỜNG + lọc lại
      const filterDistrict = document.getElementById("filter-district");
      if (filterDistrict) {
        filterDistrict.addEventListener("change", () => {
          if (typeof updateWardOptions === "function") {
            updateWardOptions();
          }
          applyFilters(true);
        });
      }

      // Admin / Add Events
      // Tìm dòng này: document.getElementById("btn-open-add").onclick = ...
      // Sửa thành:
      document.getElementById("btn-open-add").onclick = () => {
          document.getElementById("addDlg").showModal();
          // Gọi hàm tạo map cho form thêm (mặc định lấy tâm HCM nếu chưa nhập gì)
          initPickerMap('add-map-picker', 'add-lat', 'add-lng');
      };
      document.getElementById("btn-toggle-pending").onclick = togglePendingMode;
      const btnToggleReported = document.getElementById("btn-toggle-rented-reports");
      if (btnToggleReported) btnToggleReported.onclick = toggleReportedMode;

      const btnToggleReactivate = document.getElementById("btn-toggle-reactivate");
      if (btnToggleReactivate) btnToggleReactivate.onclick = toggleReactivateMode;
      const btnToggleFeatured = document.getElementById("btn-toggle-featured");
      if (btnToggleFeatured) btnToggleFeatured.onclick = toggleFeaturedMode;
      const btnToggleDeleted = document.getElementById("btn-toggle-deleted");
      if (btnToggleDeleted) btnToggleDeleted.onclick = toggleDeletedMode;

      document.getElementById("btn-approve-all").onclick = approveAll;
      
      const btnToggleRented = document.getElementById("btn-toggle-rented-reports");
      if (btnToggleRented) {
        btnToggleRented.onclick = toggleReportedMode;
      }

      // Quick filters
      document.querySelectorAll("[data-quick-district]").forEach((btn) => {
        btn.addEventListener("click", () => {
          // 1. Reset hết checkbox trước
          document.querySelectorAll('.district-cb').forEach(cb => cb.checked = false);
          
          // 2. Tick vào quận được chọn
          const targetDist = btn.getAttribute("data-quick-district");
          const cb = document.querySelector(`.district-cb[value="${targetDist}"]`);
          if(cb) {
              cb.checked = true;
              // Trigger sự kiện change để cập nhật label và phường
              cb.dispatchEvent(new Event('change'));
          }
        });
      });
      // Nút xem danh sách mặt bằng đã ghim
      const btnToggleFavorites = document.getElementById("btn-toggle-favorites");
      if (btnToggleFavorites) {
        btnToggleFavorites.addEventListener("click", toggleFavoriteMode);
      }

      const btnClearQuick = document.getElementById("btn-clear-quick");
      if (btnClearQuick) {
        btnClearQuick.addEventListener("click", () => {
          if (typeof resetAISuggestions === "function") resetAISuggestions();
        });
      }

      // ===== DEMO NOTICE BUTTONS =====
      const demoAgreeBtn = document.getElementById("btn-demo-agree");
      const demoDisagreeBtn = document.getElementById("btn-demo-disagree");
      const demoDlg = document.getElementById("demoNoticeDlg");
      if (demoAgreeBtn && demoDlg) {
        demoAgreeBtn.addEventListener("click", () => demoDlg.close());
      }
      if (demoDisagreeBtn && demoDlg) {
        demoDisagreeBtn.addEventListener("click", async () => {
          demoDlg.close();
          await db.auth.signOut();
          location.reload();
        });
      }

      // Luôn build dropdown QUẬN/PHƯỜNG khi load trang
      buildDistrictDropdown()
      initAllMultiFilters();
      // Rồi mới xử lý login / role / dữ liệu
      initAuth();
      const btnAiSuggest = document.getElementById("btn-ai-suggest");

      if (btnAiSuggest) {
        btnAiSuggest.addEventListener("click", async () => {
          if (typeof applyAIRequestFilter === "function") {
            await applyAIRequestFilter();
          }
        });
      }
    });
// --- XỬ LÝ CHUYỂN TAB LIST / MAP (LEAFLET VERSION) ---
      const btnList = document.getElementById("btn-view-list");
      const btnMap = document.getElementById("btn-view-map");
      const divList = document.getElementById("list-view");
      const divMap = document.getElementById("map-view");

      // --- SỬA LỖI: HÀM CHUYỂN TAB MỚI ---
      let CURRENT_VIEW = 'list'; // Biến theo dõi chế độ hiện tại

      function switchView(mode) {
          CURRENT_VIEW = mode; // Lưu lại mode

          const btnList = document.getElementById("btn-view-list");
          const btnTable = document.getElementById("btn-view-table"); // Mới
          const btnMap = document.getElementById("btn-view-map");
          
          const divList = document.getElementById("list-view");
          const divTable = document.getElementById("table-view"); // Mới
          const divMap = document.getElementById("map-view");

          // Reset tất cả về ẩn
          [divList, divTable, divMap].forEach(el => el && el.classList.add("hidden"));
          [btnList, btnTable, btnMap].forEach(btn => btn && btn.classList.remove("btn-active"));

          if (mode === 'list') {
              if(divList) divList.classList.remove("hidden");
              if(btnList) btnList.classList.add("btn-active");
              renderCards(LAST_ROWS, true); // Vẽ lại grid
          } 
          else if (mode === 'table') {
              if(divTable) divTable.classList.remove("hidden");
              if(btnTable) btnTable.classList.add("btn-active");
              renderTable(LAST_ROWS); // Vẽ bảng
          }
          else if (mode === 'map') {
              if(divMap) divMap.classList.remove("hidden");
              if(btnMap) btnMap.classList.add("btn-active");
              
              initStaffMap();
              setTimeout(() => { if(MAP_INSTANCE) MAP_INSTANCE.invalidateSize(); }, 200);
              if (LAST_ROWS && LAST_ROWS.length > 0) renderMapMarkers(LAST_ROWS);
          }
      }

      // Gắn sự kiện click cho nút Bảng (Table)
      const btnTableEl = document.getElementById("btn-view-table");
      if(btnTableEl) btnTableEl.onclick = () => switchView('table');

      // Gắn sự kiện click
      if(btnList) btnList.onclick = () => switchView('list');
      if(btnMap) btnMap.onclick = () => switchView('map');

    const MAX_UPLOAD_WIDTH = 1600;
    const MAX_UPLOAD_HEIGHT = 1600;
    const UPLOAD_IMAGE_QUALITY = 0.78;

    function safeImageName(name, index) {
        const base = (name || `image-${index + 1}.jpg`)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9.]+/g, "_")
            .replace(/^_+|_+$/g, "");
        return base || `image-${index + 1}.jpg`;
    }

    async function compressImageFile(file, index) {
        if (!file.type || !file.type.startsWith("image/") || file.type === "image/gif") return file;

        const bitmap = await createImageBitmap(file).catch(() => null);
        if (!bitmap) return file;

        const scale = Math.min(1, MAX_UPLOAD_WIDTH / bitmap.width, MAX_UPLOAD_HEIGHT / bitmap.height);
        if (scale >= 1 && file.size <= 900 * 1024) {
            bitmap.close();
            return file;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", UPLOAD_IMAGE_QUALITY));
        if (!blob || blob.size >= file.size) return file;

        const cleanBase = safeImageName(file.name, index).replace(/\.[^.]+$/, "");
        return new File([blob], `${cleanBase}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now()
        });
    }

    // --- 2. CÁC HÀM XỬ LÝ GIAO DIỆN ẢNH ---
    async function handleSelectFiles(input) {
        if (!input.files || input.files.length === 0) return;
        const newFiles = Array.from(input.files);
        toast(`Đang tối ưu ${newFiles.length} ảnh trước khi tải lên...`);
        const optimizedFiles = await Promise.all(newFiles.map((file, index) => compressImageFile(file, index)));
        FILES_BUFFER = [...FILES_BUFFER, ...optimizedFiles];
        input.value = '';
        renderPreview();
    }

    function renderPreview() {
        const container = document.getElementById("preview-container");
        container.innerHTML = ""; 
        if (FILES_BUFFER.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-500 w-full text-center py-8 pointer-events-none">Chưa có ảnh nào.<br/>Ảnh đầu tiên sẽ là <b>Ảnh Bìa</b>.</p>`;
            return;
        }
        FILES_BUFFER.forEach((file, index) => {
            const url = URL.createObjectURL(file);
            const div = document.createElement("div");
            div.className = `relative w-24 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${index === 0 ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-gray-300 hover:border-primary'}`;
            div.title = index === 0 ? "Ảnh bìa hiện tại" : "Click để đặt làm ảnh bìa";
            div.onclick = () => makeCover(index);

            const img = document.createElement("img");
            img.src = url;
            img.loading = "lazy";
            img.decoding = "async";
            img.className = "w-full h-full object-cover";
            
            const btnRemove = document.createElement("button");
            btnRemove.innerHTML = "✕";
            btnRemove.className = "absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-[10px] flex items-center justify-center rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity";
            btnRemove.onclick = (e) => { e.stopPropagation(); removeFile(index); };

            if (index === 0) {
                const badge = document.createElement("div");
                badge.innerText = "Bìa";
                badge.className = "absolute bottom-0 left-0 right-0 bg-primary text-white text-[10px] text-center font-bold py-0.5";
                div.appendChild(badge);
            }
            div.appendChild(img); div.appendChild(btnRemove); container.appendChild(div);
        });
    }

    function makeCover(index) {
        if (index === 0) return;
        const item = FILES_BUFFER.splice(index, 1)[0];
        FILES_BUFFER.unshift(item);
        renderPreview();
    }

    function removeFile(index) {
        FILES_BUFFER.splice(index, 1);
        renderPreview();
    }

    // --- 3. HÀM UPLOAD (CẬP NHẬT: NHẬN THAM SỐ FOLDER NAME) ---
    async function uploadFilesToSupabase(folderName) {
        if (FILES_BUFFER.length === 0) return [];
        
        const uploadedPaths = [];
        // Không cần timestamp ở tên file nữa vì đã có folder riêng, nhưng vẫn thêm random cho chắc
        
        toast(`Đang tải ${FILES_BUFFER.length} ảnh lên folder ${folderName}...`);

        for (let i = 0; i < FILES_BUFFER.length; i++) {
            const file = FILES_BUFFER[i];
            
            // Làm sạch tên file (bỏ dấu tiếng Việt, ký tự lạ)
            const cleanName = `${String(i + 1).padStart(2, "0")}_${safeImageName(file.name, i)}`;
            
            // Cấu trúc path: TÊN_FOLDER/TÊN_FILE
            // Ví dụ: MB-123456/hinh_nha_1.jpg
            const filePath = `${folderName}/${cleanName}`;
            
            const { data, error } = await db.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '31536000',
                    upsert: false
                });

            if (error) {
                console.error("Lỗi upload:", file.name, error);
                continue; 
            }
            if (data) uploadedPaths.push(data.path);
        }
        return uploadedPaths;
    }

    // --- 4. HÀM LƯU TIN (ĐÃ CẬP NHẬT LOGIC TĂNG MÃ) ---
    async function saveNewPremiseWithUpload() {
        const btn = document.getElementById("btn-save-new");
        
        // Validate cơ bản
        const getVal = (id) => document.getElementById(id).value.trim();
        const priceRaw = getVal("add-price").replace(/\D/g,'');
        const priceNum = priceRaw ? parseInt(priceRaw) : 0;

        if (!getVal("add-address") || !getVal("add-district") || !priceNum) {
            toast("Vui lòng nhập: Địa chỉ, Quận và Giá thuê!");
            return;
        }

        // Disable nút để tránh click đúp
        btn.disabled = true;
        btn.innerHTML = `<span class="loading loading-spinner"></span> Đang lấy mã MB...`;

        try {
            // BƯỚC 1: LẤY MÃ MB TIẾP THEO TỪ DATABASE (Async)
            const newCode = await generateNextCode();
            console.log("Mã mới sẽ là:", newCode);

            // Cập nhật trạng thái nút bấm
            btn.innerHTML = `<span class="loading loading-spinner"></span> Đang up ảnh lên ${newCode}...`;

            // BƯỚC 2: UPLOAD ẢNH VÀO FOLDER CÓ TÊN LÀ MÃ MB VỪA TẠO
            const imagePaths = await uploadFilesToSupabase(newCode);

            // BƯỚC 3: CHUẨN BỊ DATA
            const rType = document.getElementById("add-road-type").value;
            const isFrontage = rType === "Mặt tiền";

            const payload = {
                code: newCode, // <-- MÃ TỰ TĂNG
                creator_email: CURRENT_USER.email,
                
                address: getVal("add-address"),
                district: document.getElementById("add-district").value,
                ward: document.getElementById("add-ward").value,
                street: getVal("add-street"),
                lat: document.getElementById("add-lat").value || null,
                lng: document.getElementById("add-lng").value || null,
                price: priceNum,
                area: Number(getVal("add-area")) || null,
                width: Number(getVal("add-width")) || null,
                length: Number(getVal("add-length")) || null,
                floors: Number(getVal("add-floors")) || null,
                pn: Number(getVal("add-bedrooms")) || null,
                wc: Number(getVal("add-wc")) || null,
                ket_cau: getVal("add-ket-cau"),
                contact_phone: getVal("add-contact-phone"),
                
                road_type: rType,
                commission: getVal("add-commission"),
                frontage: isFrontage,

                images: imagePaths, 
                detail: getVal("add-detail"),
                status: 'available',
                created_at: new Date().toISOString()
            };

            // BƯỚC 4: INSERT VÀO DB
            const { error } = await db.from("premises").insert([payload]);

            if (error) throw error;

            toast(isAdmin() ? `Thêm thành công! Mã: ${newCode}` : "Đã gửi duyệt!");
            
            // Reset form
            document.getElementById("addDlg").close();
            FILES_BUFFER = []; 
            renderPreview();
            applyFilters(true);
            if(isAdmin()) checkPendingCount();

        } catch (err) {
            console.error(err);
            toast("Lỗi: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Lưu tin";
        }
    }
    async function cancelRentedStaff(id) {
      if (!isStaff()) return;
      if (!confirm("Bạn muốn huỷ báo hết mặt bằng này?")) return;

      const { error } = await db
        .from("premises")
        .update({
          rented_reported_at: null
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        toast("Lỗi: " + error.message);
        return;
      }

      toast("Đã huỷ báo hết");
      document.getElementById("detailDlg").close();
      applyFilters(true);
    }
    const GRID_IMAGE_CACHE = new Map();
    const GRID_IMAGE_BATCH_SIZE = 8;
    const IMAGE_FILE_PATTERN = /\.(avif|webp|jpe?g|png|gif|bmp)$/i;

    function renderGridThumb(imgContainer, publicUrl, altText) {
      imgContainer.innerHTML = `
        <img src="${publicUrl}"
             loading="lazy"
             decoding="async"
             class="w-full h-full object-cover animate-fade-in transition-opacity duration-500"
             alt="${altText || "Mặt bằng"}" />
      `;
      imgContainer.classList.remove("opacity-60");
    }

    async function findStorageCoverImage(row) {
      if (!row || !row.code) return null;

      if (GRID_IMAGE_CACHE.has(row.code)) {
        return GRID_IMAGE_CACHE.get(row.code);
      }

      const { data: files, error } = await db.storage
        .from(STORAGE_BUCKET)
        .list(row.code, {
          limit: 40,
          sortBy: { column: "name", order: "asc" },
        });

      if (error || !files || files.length === 0) {
        GRID_IMAGE_CACHE.set(row.code, null);
        return null;
      }

      const validFile = files.find((file) => {
        if (!file || !file.name || file.name === ".emptyFolderPlaceholder") return false;
        return IMAGE_FILE_PATTERN.test(file.name);
      });

      if (!validFile) {
        GRID_IMAGE_CACHE.set(row.code, null);
        return null;
      }

      const fullPath = `${row.code}/${validFile.name}`;
      const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
      const publicUrl = data?.publicUrl || null;
      GRID_IMAGE_CACHE.set(row.code, publicUrl);
      return publicUrl;
    }

    // === QUÉT ẢNH TỪ STORAGE THEO MÃ ===
    async function scanGridImages(rows) {
      if (!rows || !rows.length) return;

      const rowsToScan = rows.filter((row) => {
        if (!row || !row.id || !row.code) return false;
        const imgContainer = document.getElementById(`thumb-box-${row.id}`);
        return imgContainer && !imgContainer.querySelector("img");
      });

      for (let i = 0; i < rowsToScan.length; i += GRID_IMAGE_BATCH_SIZE) {
        const batch = rowsToScan.slice(i, i + GRID_IMAGE_BATCH_SIZE);
        await Promise.all(batch.map(async (row) => {
          const imgContainer = document.getElementById(`thumb-box-${row.id}`);
          if (!imgContainer || imgContainer.querySelector("img")) return;

          try {
            const publicUrl = await findStorageCoverImage(row);
            if (publicUrl) {
              renderGridThumb(imgContainer, publicUrl, row.code);
            } else {
              imgContainer.innerHTML = `<div class="text-[10px] text-gray-400 flex items-center justify-center">📷 No IMG</div>`;
            }
          } catch (err) {
            console.warn("Lỗi quét ảnh cho:", row.code, err);
          }
        }));
      }
    }

    // ==== TOOL 1 LẦN: ĐỒNG BỘ ẢNH TỪ STORAGE -> CỘT images ====
    async function syncImagesFromStorage() {
      if (!isAdmin || !isAdmin()) {
        alert("Chỉ admin mới được chạy sync images.");
        return;
      }

      const PAGE_SIZE = 100;
      let from = 0;
      let totalUpdated = 0;

      alert("Bắt đầu sync ảnh, mở Console để xem log. Đừng tắt tab cho tới khi xong.");

      while (true) {
        const { data: rows, error } = await db
          .from("premises")
          .select("id, code, images", { count: "exact" })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error("Lỗi load premises:", error);
          break;
        }
        if (!rows || rows.length === 0) break;

        console.log(`Đang xử lý từ row ${from} tới ${from + rows.length - 1}`);

        for (const row of rows) {
          // Nếu đã có images rồi thì bỏ qua
          let hasImg = false;
          if (Array.isArray(row.images) && row.images.length > 0) hasImg = true;
          else if (typeof row.images === "string" && row.images.trim().length > 0) hasImg = true;
          if (hasImg) continue;
          if (!row.code) continue;

          console.log("→ Quét folder:", row.code);

          const { data: files, error: err2 } = await db.storage
            .from(STORAGE_BUCKET) // ví dụ "premise-images"
            .list(row.code, {
              limit: 50,
              sortBy: { column: "name", order: "asc" },
            });

          if (err2) {
            console.error("   Lỗi list storage", row.code, err2);
            continue;
          }
          if (!files || !files.length) {
            console.log("   Không có file nào trong storage cho", row.code);
            continue;
          }

          // Bỏ file placeholder nếu có
          const validFiles = files.filter(f => f.name !== ".emptyFolderPlaceholder");
          if (!validFiles.length) continue;

          // Lưu đường dẫn tương đối vào cột images (Postgres text[] hoặc jsonb đều ok)
          const paths = validFiles.map(f => `${row.code}/${f.name}`);

          const { error: err3 } = await db
            .from("premises")
            .update({ images: paths })
            .eq("id", row.id);

          if (err3) {
            console.error("   Lỗi update images cho", row.code, err3);
          } else {
            totalUpdated++;
            console.log("   Đã update images cho", row.code, paths);
          }
        }

        from += PAGE_SIZE;
      }

      alert("Sync ảnh xong. Tổng số mặt bằng được cập nhật: " + totalUpdated);
    }
    // --- BIẾN TOÀN CỤC ĐỂ ĐIỀU KHIỂN ---
    let STOP_SYNC = false;

    // --- TOOL QUÉT TỌA ĐỘ SIÊU CẤP (KHÔNG BAO GIỜ BỎ SÓT) ---
    async function startSyncCoordinates() {
      if (!isAdmin()) { alert("Chỉ Admin mới được dùng!"); return; }

      const btn = document.getElementById("btn-start-sync");
      const logBox = document.getElementById("sync-log");
      
      // 1. Kiểm tra thống kê trước khi chạy
      const { count: total } = await db.from("premises").select("*", { count: 'exact', head: true });
      const { count: missing } = await db.from("premises").select("*", { count: 'exact', head: true }).is("lat", null);
      
      if (missing === 0) {
          alert(`Tuyệt vời! Toàn bộ ${total} mặt bằng đã có tọa độ. Không cần quét.`);
          return;
      }

      if(!confirm(`Tổng: ${total} căn.\nHiện có ${missing} căn ĐANG MẤT TỌA ĐỘ (không hiện trên map).\nBạn có muốn quét lại toàn bộ ${missing} căn này không?`)) return;

      // 2. Bắt đầu xử lý
      document.getElementById("sync-status").classList.remove("hidden");
      btn.disabled = true;
      STOP_SYNC = false;
      logBox.innerHTML = "<div>Đang tải danh sách cần xử lý...</div>";

      // Lấy danh sách chưa có tọa độ
      const { data: list } = await db
        .from("premises")
        .select("id, address, district, ward, street")
        .is("lat", null);

      document.getElementById("sync-total").innerText = list.length;
      let processed = 0;

      for (const item of list) {
        if (STOP_SYNC) break;
        processed++;
        document.getElementById("sync-count").innerText = processed;
        document.getElementById("sync-bar").style.width = (processed / list.length * 100) + "%";

        // --- CÁC CHIẾN THUẬT TÌM KIẾM ---
        const city = "Ho Chi Minh City";
        const district = item.district || "";
        const ward = item.ward || "";
        
        // Xử lý tên đường: Bỏ "Góc", "Hẻm", số nhà rắc rối
        let cleanStreet = "";
        if (item.street) cleanStreet = item.street;
        else if (item.address) {
             cleanStreet = item.address.replace(/^[0-9\/A-Za-z]+\s+(.*)$/, "$1"); // Bỏ số nhà đầu
             cleanStreet = cleanStreet.replace(/^(Góc|Hẻm|Nhà|Lô)\s+/i, "");
        }

        const queries = [
            // 1. Tìm chính xác (Số nhà + Đường + Quận)
            `${item.address}, ${district}, ${city}`,
            
            // 2. Tìm Đường + Phường + Quận (Bỏ số nhà)
            `Đường ${cleanStreet}, ${ward}, ${district}, ${city}`,
            
            // 3. Tìm Đường + Quận (Bỏ phường luôn)
            `Đường ${cleanStreet}, ${district}, ${city}`,
            
            // 4. Tìm Phường + Quận (Nếu tên đường sai, lấy tâm Phường) - FALLBACK 1
            `UBND ${ward}, ${district}, ${city}`,
            
            // 5. Tìm Quận (Nếu phường cũng sai, lấy tâm Quận) - FALLBACK 2
            `${district}, ${city}`
        ];

        logBox.innerHTML += `<div class="border-t mt-1 pt-1 font-bold text-gray-500">${item.address || cleanStreet}</div>`;
        logBox.scrollTop = logBox.scrollHeight;

        let found = null;
        let method = 0;

        for (const q of queries) {
            method++;
            try {
                // logBox.innerHTML += `<div class="text-[9px] text-gray-400">... thử cách ${method}</div>`;
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
                const res = await fetch(url);
                const data = await res.json();
                
                if (data && data.length > 0) {
                    found = data[0];
                    break; // Tìm thấy thì dừng ngay
                }
            } catch(e) {}
            await new Promise(r => setTimeout(r, 1200)); // Nghỉ 1.2s để không bị khóa IP
        }

        if (found) {
            await db.from("premises").update({ lat: found.lat, lng: found.lon }).eq("id", item.id);
            
            let color = "text-success"; // Xanh: Tìm chính xác
            if(method >= 4) color = "text-warning"; // Vàng: Chỉ tìm thấy Phường/Quận
            
            logBox.innerHTML += `<div class="${color} text-[10px] pl-2">-> OK (Cách ${method}): ${found.display_name.substring(0,40)}...</div>`;
        } else {
            logBox.innerHTML += `<div class="text-error text-[10px] pl-2">-> VẪN THẤT BẠI (Check lại tên Quận)</div>`;
        }
      }

      btn.disabled = false;
      alert("Hoàn tất! Hãy tải lại trang để xem bản đồ.");
      applyFilters(true);
    }

    // Hàm gọi API riêng lẻ
    async function fetchOpenStreetMap(query) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) return data[0];
        return null;
      } catch (e) {
        return null;
      }
    }
    // HÀM DÒ TỌA ĐỘ CHO FORM SỬA (ADMIN)
    async function autoFetchCoordsForEdit() {
        const address = document.getElementById("edit-address").value;
        const district = document.getElementById("edit-district").value;
        const street = document.getElementById("edit-street").value;
        const city = document.getElementById("edit-city").value || "Hồ Chí Minh";

        if (!district) {
            alert("Vui lòng nhập Quận trong form sửa trước!");
            return;
        }

        const btn = document.querySelector("button[onclick='autoFetchCoordsForEdit()']");
        const oldText = btn.innerText;
        btn.innerText = "Đang dò...";
        btn.disabled = true;

        try {
            // Logic tìm kiếm giống hệt lúc thêm mới
            let query = `${address}, ${district}, ${city}`;
            // Nếu địa chỉ quá ngắn hoặc không có số nhà, ưu tiên tìm theo đường
            if (!address || (address.split(' ').length < 2 && street)) {
                 query = `${street}, ${district}, ${city}`;
            }

            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.length > 0) {
                document.getElementById("edit-lat").value = data[0].lat;
                document.getElementById("edit-lng").value = data[0].lon;
                toast(`Đã tìm thấy: ${data[0].display_name.split(',')[0]}`);
            } else {
                // Thử lại lần 2 chỉ với Tên đường + Quận (fallback)
                if (street) {
                    const url2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(street + ", " + district + ", " + city)}&limit=1`;
                    const res2 = await fetch(url2);
                    const data2 = await res2.json();
                    if (data2 && data2.length > 0) {
                         document.getElementById("edit-lat").value = data2[0].lat;
                         document.getElementById("edit-lng").value = data2[0].lon;
                         toast(`Đã tìm thấy (theo đường): ${data2[0].display_name.split(',')[0]}`);
                         return;
                    }
                }
                alert("Không tìm thấy tọa độ. Vui lòng nhập tay hoặc kiểm tra lại địa chỉ.");
            }
        } catch (e) {
            console.error(e);
            toast("Lỗi kết nối bản đồ.");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    }
    // --- CODE MỚI: HIỆU ỨNG CO GIÃN MENU ---
    window.addEventListener("scroll", function() {
      const navbar = document.getElementById("main-navbar");
      const logo = document.getElementById("navbar-logo");
      
      if (!navbar || !logo) return;

      if (window.scrollY > 20) {
        // KHI KÉO XUỐNG: Thu nhỏ lại
        navbar.classList.remove("py-4"); 
        navbar.classList.add("py-2", "shadow-md"); 
        
        logo.classList.remove("h-16");
        logo.classList.add("h-10"); // Thu về 40px
      } else {
        // KHI Ở ĐẦU TRANG: Phóng to ra
        navbar.classList.add("py-4");
        navbar.classList.remove("py-2", "shadow-md");
        
        logo.classList.add("h-16");
        logo.classList.remove("h-10");
      }
    });
    // --- CẤP CỨU: KHÔI PHỤC CHỨC NĂNG LỌC QUẬN ---
    setTimeout(() => {
        // 1. Nạp lại danh sách Quận từ dữ liệu nguồn
        if (typeof buildDistrictWardOptions === 'function') {
            console.log("Đang nạp lại danh sách Quận...");
            buildDistrictDropdown();
        }

        // 2. Kết nối lại sự kiện: Chọn Quận -> Tự đổi Phường & Lọc bài
        const districtSelect = document.getElementById("filter-district");
        if (districtSelect) {
            // Xóa sự kiện cũ (để tránh bị trùng) rồi gán mới
            const newSelect = districtSelect.cloneNode(true);
            districtSelect.parentNode.replaceChild(newSelect, districtSelect);
            
            newSelect.addEventListener("change", function() {
                // Cập nhật phường tương ứng
                if (typeof updateWardOptions === 'function') {
                    updateWardOptions();
                }
                // Gọi hàm lọc
                if (typeof applyFilters === 'function') {
                    applyFilters(true);
                }
            });
            
            // Nếu đang có quận được chọn sẵn (ví dụ load lại trang), hãy nạp phường luôn
            if (newSelect.value) {
                 if (typeof updateWardOptions === 'function') updateWardOptions();
            }
        }
    }, 1000); // Chờ 1 giây để đảm bảo HTML đã vẽ xong  
// --- LOGIC TABLE VIEW (EXCEL MODE) ---

    // 1. Hàm vẽ bảng
    function renderTable(rows) {
      const tbody = document.getElementById("table-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">Không có dữ liệu</td></tr>`;
        return;
      }

      const html = rows.map(row => {
        // Xử lý ảnh nhỏ
        let thumb = "";
        if (row.images && row.images.length > 0) {
            // Lấy ảnh đầu tiên (xử lý cả dạng mảng hoặc chuỗi)
            let path = Array.isArray(row.images) ? row.images[0] : (JSON.parse(row.images || "[]")[0] || ""); 
            if(path) thumb = `<img src="${buildImageUrl(path)}" loading="lazy" decoding="async" class="w-8 h-8 object-cover rounded border" />`;
        }

        // Nếu không phải Admin thì chỉ hiện text, Admin thì hiện Input để sửa
        const isAdminUser = isAdmin(); 

        // Ô Giá (Admin sửa được)
        const priceCell = isAdminUser 
          ? `<input type="number" class="input input-ghost input-xs w-24 font-bold text-right" 
               value="${row.price}" 
               onchange="quickUpdate('${row.id}', 'price', this.value)" />`
          : `<span class="font-bold text-primary">${money(row.price)}</span>`;

        // Ô Hoa hồng (Admin sửa được)
        const commCell = isAdminUser
          ? `<input type="text" class="input input-ghost input-xs w-20" 
               value="${row.commission_note || ''}" placeholder="..." 
               onchange="quickUpdate('${row.id}', 'commission_note', this.value)" />`
          : `<span>${row.commission_note || '-'}</span>`;

        // Ô Trạng thái (Select box cho Admin)
        const statusOpts = `
            <option value="available" ${row.status==='available'?'selected':''}>Trống</option>
            <option value="deposited" ${row.status==='deposited'?'selected':''}>Cọc</option>
            <option value="rented" ${row.status==='rented'?'selected':''}>Thuê</option>
        `;
        const statusCell = isAdminUser
          ? `<select class="select select-ghost select-xs" onchange="quickUpdate('${row.id}', 'status', this.value)">${statusOpts}</select>`
          : `<span class="badge badge-xs">${row.status}</span>`;

        return `
          <tr class="hover">
            <td>${thumb}</td>
            <td>
                <div class="font-bold text-xs">${row.code || '---'}</div>
                <div class="flex gap-1 mt-1">
                  ${row.is_featured ? `<span class="badge badge-xs badge-primary">Nổi bật</span>` : ""}
                  ${row.is_deleted ? `<span class="badge badge-xs badge-error text-white">Đã xóa</span>` : ""}
                </div>
                <div class="text-[10px] opacity-70 truncate max-w-[150px]" title="${[row.street, row.ward, row.district].filter(Boolean).join(', ')}">${maskAddress(row)}</div>
            </td>
            <td>
                <div class="text-[10px]">
                    ${row.width || 0}x${row.length || 0}m | ${row.area || 0}m²<br/>
                    ${row.ket_cau || '-'}
                </div>
            </td>
            <td class="text-right">${priceCell}</td>
            <td>${commCell}</td>
            <td>${statusCell}</td>
            <td>
               <button class="btn btn-xs btn-square btn-ghost" onclick="openDetail('${row.id}')">👁</button>
               ${isAdminUser ? `<button class="btn btn-xs btn-square btn-ghost text-blue-600" onclick="openEditPremise('${row.id}')">✏️</button>` : ''}
               ${isAdminUser ? `<button class="btn btn-xs btn-outline" onclick="toggleFeaturedListing('${row.id}', ${row.is_featured === true})">${row.is_featured ? 'Gỡ NB' : 'Nổi bật'}</button>` : ''}
               ${isAdminUser ? `<button class="btn btn-xs btn-error btn-outline" onclick="openDeleteListingConfirm('${row.id}')">Xóa</button>` : ''}
            </td>
          </tr>
        `;
      }).join("");

      tbody.innerHTML = html;
    }

    // 2. Hàm lưu nhanh (Auto Save khi sửa ô input)
    async function quickUpdate(id, field, value) {
        if(!isAdmin()) { toast("Không có quyền!"); return; }
        
        // Hiệu ứng "Đang lưu..." nhỏ (Optional)
        toast(`Đang lưu ${field}...`);

        let payload = {};
        payload[field] = value;
        
        // Nếu sửa giá thì chuyển về số
        if(field === 'price') payload[field] = Number(value);

        // Nếu sửa trạng thái thành 'rented', cập nhật ngày (logic tương tự hàm sửa form)
        if(field === 'status' && value === 'rented') {
             payload['rented_confirmed_at'] = new Date().toISOString();
        }

        const { error } = await db.from('premises').update(payload).eq('id', id);
        
        if(error) {
            toast("Lỗi lưu: " + error.message);
        } else {
            // Cập nhật lại dữ liệu local (LAST_ROWS) để không phải load lại trang
            const row = LAST_ROWS.find(r => r.id === id);
            if(row) row[field] = payload[field];
            toast("Đã lưu ✅");
        }
    }
    // === HÀM HỖ TRỢ: Chọn item trong dropdown theo tên gần đúng ===
    function setSelectOptionByText(selectId, textToFind) {
        const select = document.getElementById(selectId);
        if (!select || !textToFind) return false;
        
        const cleanText = textToFind.toLowerCase().trim()
            .replace(/^q\.|^q\s|^quận\s/g, "") // Bỏ chữ Quận, Q.
            .replace(/^p\.|^p\s|^phường\s/g, ""); // Bỏ chữ Phường, P.

        for (let i = 0; i < select.options.length; i++) {
            const optText = select.options[i].text.toLowerCase();
            const optVal = select.options[i].value.toLowerCase();
            
            // So sánh tìm chuỗi con (VD: tìm "Gò Vấp" trong "Quận Gò Vấp")
            if (optText.includes(cleanText) || optVal.includes(cleanText)) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change')); // Kích hoạt sự kiện để load Phường
                return true;
            }
        }
        return false;
    }

    // === TÍNH NĂNG: TỰ ĐỘNG ĐIỀN FORM TỪ MÔ TẢ (BẢN NÂNG CẤP) ===
    function autoFillFromDesc() {
        const text = document.getElementById("add-detail").value;
        if (!text) {
            toast("Vui lòng dán nội dung vào ô Mô tả chi tiết trước!");
            return;
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) el.value = val; // Ghi đè luôn để sửa nếu sai
        };

        // --- 1. XỬ LÝ CÁC TRƯỜNG CƠ BẢN (SỐ) ---
        
        // SĐT
        const phoneMatch = text.match(/(0[3|5|7|8|9][0-9]{8})\b/);
        if (phoneMatch) setVal("add-contact-phone", phoneMatch[1]);

        // Kích thước (Ngang x Dài)
        const dimMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[m]?\s*[xX*]\s*(\d+(?:[.,]\d+)?)/);
        if (dimMatch) {
            const w = parseFloat(dimMatch[1].replace(',', '.'));
            const l = parseFloat(dimMatch[2].replace(',', '.'));
            setVal("add-width", w);
            setVal("add-length", l);
            // Tự tính diện tích nếu chưa có
            if(!document.getElementById("add-area").value) {
                setVal("add-area", w * l);
            }
        } else {
            // Tìm diện tích lẻ (DT: 100m2)
            const areaMatch = text.match(/(?:dt|diện tích)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:m2|m²)/i);
            if (areaMatch) setVal("add-area", areaMatch[1].replace(',', '.'));
        }

        // Kết cấu (Lấy hết nội dung sau chữ "Kết cấu:" đến hết dòng hoặc dấu phẩy xa nhất)
        // VD: "Kết cấu: Trệt, 2 lầu, ST" -> Lấy "Trệt, 2 lầu, ST"
        const structMatch = text.match(/(?:kết cấu|kc)[:\s]+(.+?)(?:\n|$|\.)/i);
        if (structMatch) {
            setVal("add-ket-cau", structMatch[1].trim());
        }

        // Số tầng, PN, WC (Giữ nguyên logic cũ vì khá ổn)
        const floorMatch = text.match(/(\d+)\s*(?:lầu|tầng|lau|tang)/i);
        if (floorMatch) setVal("add-floors", floorMatch[1]);

        const pnMatch = text.match(/(\d+)\s*(?:pn|phòng|phong)/i);
        if (pnMatch) setVal("add-bedrooms", pnMatch[1]);

        const wcMatch = text.match(/(\d+)\s*(?:wc|toilet)/i);
        if (wcMatch) setVal("add-wc", wcMatch[1]);

        // Hoa hồng (Tìm chữ HH, Hoa hồng, Phí MG)
        const commMatch = text.match(/(?:hoa hồng|hh|phí mg|phí)[:\s]+(.+?)(?:\n|$|\.)/i);
        if (commMatch) {
             setVal("add-commission", commMatch[1].trim());
        }

        // Giá thuê
        let price = 0;
        const tyMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty)\b/i);
        if (tyMatch) price = parseFloat(tyMatch[1].replace(',', '.')) * 1000000000;
        else {
            const trMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu)\b/i);
            if (trMatch) price = parseFloat(trMatch[1].replace(',', '.')) * 1000000;
        }
        if (price > 0) {
            const inputPrice = document.getElementById("add-price");
            inputPrice.value = new Intl.NumberFormat('vi-VN').format(price);
        }

        // --- 2. XỬ LÝ ĐỊA CHỈ & QUẬN/PHƯỜNG (PHỨC TẠP) ---
        
        // Tìm dòng chứa địa chỉ (Thường có chữ "Đường", "Phường", "Quận" hoặc nằm ngay đầu)
        // Chiến thuật: Tìm Quận trước, sau đó suy ngược ra Phường và Đường
        
        let districtName = "";
        let wardName = "";
        let streetName = "";
        let fullAddr = "";

        // Regex tìm Quận (VD: Quận 1, Q.1, Quận Gò Vấp, Q.GV)
        const distMatch = text.match(/(?:quận|q\.|q)\s*([\p{L}\d\s]+?)(?:,|$|\n|phường|p\.)/iu);
        
        if (distMatch) {
            // Lấy tên quận thô
            let rawDist = distMatch[1].trim().replace(/,$/, "");
            
            // Xử lý map Quận tên tắt thành tên đầy đủ nếu cần
            if(rawDist.toLowerCase() === 'gv') rawDist = "Gò Vấp";
            if(rawDist.toLowerCase() === 'pn') rawDist = "Phú Nhuận";
            if(rawDist.toLowerCase() === 'tb') rawDist = "Tân Bình";
            if(rawDist.toLowerCase() === 'tp') rawDist = "Tân Phú";
            
            // 1. CHỌN QUẬN TRÊN DROPDOWN
            const foundDist = setSelectOptionByText("add-district", rawDist);
            
            if(foundDist) {
                districtName = rawDist;
                // Nếu chọn được Quận, tìm tiếp Phường trong text
                // Regex tìm Phường (VD: Phường 9, P.9)
                const wardMatch = text.match(/(?:phường|p\.|p)\s*(\d+|[\p{L}\s]+)(?:,|$|\n|quận|q\.)/iu);
                if(wardMatch) {
                    wardName = wardMatch[1].trim().replace(/,$/, "");
                    // 2. CHỌN PHƯỜNG (Cần setTimeout nhỏ để dropdown Phường kịp render sau khi chọn Quận)
                    setTimeout(() => {
                        setSelectOptionByText("add-ward", wardName);
                    }, 100);
                }
            }
        }

        // Tìm tên đường và Số nhà (Logic: Lấy phần text đứng trước Phường/Quận)
        // VD: "123 Nguyễn Trãi, Phường 2, Quận 5" -> Lấy "123 Nguyễn Trãi"
        const addressLineMatch = text.match(/(?:địa chỉ|đc|nhà)[:\s]*(.*?)(?:,?\s*(?:phường|p\.|quận|q\.))/i);
        
        if (addressLineMatch) {
            fullAddr = addressLineMatch[1].trim();
        } else {
            // Nếu không có từ khóa "Địa chỉ", quét dòng đầu tiên có chứa "Đường" hoặc tên đường
            // Cách đơn giản: Lấy dòng đầu tiên của mô tả làm địa chỉ nếu chưa tìm thấy
            const firstLine = text.split('\n')[0];
            // Lọc bớt các từ quảng cáo "Cho thuê nhà..."
            fullAddr = firstLine.replace(/^(cho thuê|bán|sang)\s+(nhà|mb|mặt bằng)\s+/i, "").trim();
            // Cắt bỏ phần Phường/Quận ở đuôi nếu dính vào
            fullAddr = fullAddr.split(/,|phường|quận/i)[0].trim();
        }

        if(fullAddr) {
            setVal("add-address", fullAddr); // Điền full địa chỉ
            
            // Tách tên đường (Bỏ số nhà ở đầu: "123 Nguyễn Trãi" -> "Nguyễn Trãi")
            const streetOnly = fullAddr.replace(/^\d+[\/\w]*\s+/, "").replace(/^(hẻm|đường)\s+/i, "");
            setVal("add-street", streetOnly);
        }

        // Loại hình (Mặt tiền / Hẻm)
        const isMT = text.toLowerCase().includes("mặt tiền") || text.toLowerCase().includes("mt");
        const isHXH = text.toLowerCase().includes("hxh") || text.toLowerCase().includes("xe hơi");
        const roadSelect = document.getElementById("add-road-type");
        if(isMT) roadSelect.value = "Mặt tiền";
        else if(isHXH) roadSelect.value = "Hẻm xe hơi";
        else roadSelect.value = "Hẻm";

        toast("Đã quét và điền thông tin chi tiết!");
    }

    // === TÍNH NĂNG MỚI: TẢI TẤT CẢ ẢNH (ZIP) ===
    async function downloadAllImages(event) {
        if (typeof requireProFeature === "function" && !requireProFeature()) return;
        if (!CURRENT_DETAIL || !CURRENT_DETAIL.resolvedImages || CURRENT_DETAIL.resolvedImages.length === 0) {
            toast("Không có ảnh để tải!");
            return;
        }

        const btn = event?.target; // Lấy nút đang bấm
        if (!btn) return;
        const oldText = btn.innerHTML;
        btn.innerHTML = `⏳ Đang nén...`;
        btn.disabled = true;

        try {
            const zip = new JSZip();
            const folderName = CURRENT_DETAIL.code || "images";
            const imgFolder = zip.folder(folderName);
            const urls = CURRENT_DETAIL.resolvedImages;

            toast(`Đang xử lý ${urls.length} ảnh... vui lòng đợi.`);

            // Tải từng ảnh về và thêm vào zip
            const promises = urls.map(async (url, i) => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    // Đặt tên file là 1.jpg, 2.jpg...
                    const ext = blob.type.split('/')[1] || "jpg";
                    imgFolder.file(`${i + 1}.${ext}`, blob);
                } catch (err) {
                    console.warn("Lỗi tải ảnh:", url);
                }
            });

            await Promise.all(promises);

            // Tạo file zip và tải xuống
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${folderName}.zip`);
            toast("Đã tải xuống thành công!");

        } catch (e) {
            console.error(e);
            toast("Lỗi khi tạo file nén.");
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }

    // === TÍNH NĂNG MỚI: COPY THÔNG TIN CHI TIẾT ===
    function copyPropertyInfo() {
        if (typeof requireProFeature === "function" && !requireProFeature()) return;
        if (!CURRENT_DETAIL) return;
        const i = CURRENT_DETAIL;

        // 1. Xử lý dữ liệu đẹp
        const price = i.price ? new Intl.NumberFormat('vi-VN').format(i.price) : "Thương lượng";
        const dt = i.width && i.length ? `${i.width}m x ${i.length}m` : (i.area ? `${i.area}m²` : "");
        const ketcau = i.ket_cau || "Trống suốt";
        const pn = i.pn ? `${i.pn} PN` : "";
        const wc = i.wc ? `${i.wc} WC` : "";
        const title = buildTitle(i);
        
        // 2. Tạo nội dung tin đăng mẫu
        const textToCopy = `
📢 CHO THUÊ ${title}
📍 Khu vực: ${[i.street, i.ward, i.district].filter(Boolean).join(", ")}
--------------------------
💰 Giá thuê: ${price} VNĐ/tháng
📐 Diện tích: ${dt} ${i.area ? `(${i.area}m²)` : ""}
🏠 Kết cấu: ${ketcau} ${pn ? `| ${pn}` : ""} ${wc ? `| ${wc}` : ""}
${i.frontage ? "🚗 Vị trí: Mặt tiền" : `🚗 Hẻm: ${i.road_type || "Thông thoáng"}`}
--------------------------
📝 Mô tả: 
Thông tin chi tiết được bảo vệ theo quyền tài khoản Môi giới Pro.
--------------------------
📞 Liên hệ: 0798 905 082 (Môi giới Pro)
`.trim();

        // 3. Copy vào clipboard
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast("Đã sao chép nội dung tin đăng! 📋");
        }).catch(err => {
            toast("Lỗi sao chép, vui lòng thử lại.");
        });
    }

    function handleOpenMap(encodedQuery) {
        if (CURRENT_DETAIL?.id && typeof openSensitiveMap === "function") {
            openSensitiveMap(CURRENT_DETAIL.id);
            return;
        }
        if (typeof requireProFeature === "function" && !requireProFeature()) return;
        if (!encodedQuery) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`, "_blank", "noopener");
    }

    async function handleDownloadZip(event) {
        return downloadAllImages(event);
    }

    function handleCopyPost() {
        return copyPropertyInfo();
    }

    function normalizeTextVN(text) {
      return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function parseAIRequest(text) {
      const raw = text || "";
      const normalized = normalizeTextVN(raw);

      const result = {
        districts: [],
        priceMax: null,
        priceMin: null,
        widthMin: null,
        areaMin: null,
        frontageType: "",
        keyword: "",
      };

      // ===== Parse quận =====
      const districtMatches = normalized.match(/(?:quan|q)\s*(\d{1,2})/g) || [];

      districtMatches.forEach((match) => {
        const numMatch = match.match(/\d{1,2}/);
        if (!numMatch) return;

        const district = `Quận ${Number(numMatch[0])}`;

        if (!result.districts.includes(district)) {
          result.districts.push(district);
        }
      });

      // Parse các quận chữ không số
      const specialDistricts = [
        "binh thanh",
        "tan binh",
        "tan phu",
        "phu nhuan",
        "go vap",
        "binh tan",
        "thu duc",
      ];

      const specialMap = {
        "binh thanh": "Bình Thạnh",
        "tan binh": "Tân Bình",
        "tan phu": "Tân Phú",
        "phu nhuan": "Phú Nhuận",
        "go vap": "Gò Vấp",
        "binh tan": "Bình Tân",
        "thu duc": "Thủ Đức",
      };

      specialDistricts.forEach((key) => {
        if (normalized.includes(key)) {
          const district = specialMap[key];
          if (!result.districts.includes(district)) {
            result.districts.push(district);
          }
        }
      });

            // ===== Parse giá tối đa =====
            // Ví dụ: dưới 100tr, dưới 100 triệu, giá dưới 100tr
           // ===== Parse giá thuê thông minh =====
      function parsePriceFromAIText(normalized) {
        const result = {
          priceMin: null,
          priceMax: null,
        };

        // Tránh bắt nhầm "quận 1", "q1" thành giá
        const text = normalized
          .replace(/quan\s*\d{1,2}/g, "")
          .replace(/\bq\s*\d{1,2}\b/g, "");

        // Ví dụ: "trên 200 triệu", "từ 200tr", "tối thiểu 200 triệu"
        const minMatch = text.match(
          /(?:tren|tu|toi thieu|hon)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m)?/
        );

        if (minMatch) {
          result.priceMin = Number(minMatch[1].replace(",", "."));
        }

        // Ví dụ: "dưới 100 triệu", "tối đa 100tr", "không quá 100 triệu"
        const maxMatch = text.match(
          /(?:duoi|toi da|khong qua|nho hon|ngan sach duoi|gia duoi)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m)?/
        );

        if (maxMatch) {
          result.priceMax = Number(maxMatch[1].replace(",", "."));
        }

        // Ví dụ: "giá 80-120 triệu"
        const rangeMatch = text.match(
          /(?:gia|tam|khoang)?\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m)/
        );

        if (rangeMatch) {
          result.priceMin = Number(rangeMatch[1].replace(",", "."));
          result.priceMax = Number(rangeMatch[2].replace(",", "."));
        }

        // Ví dụ: "ngân sách 100 triệu" => hiểu là tối đa 100 triệu
        // Chỉ chạy nếu chưa có min/max rõ ràng
        if (result.priceMin == null && result.priceMax == null) {
          const budgetMatch = text.match(
            /(?:ngan sach|tam gia|gia khoang|khoang)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|m)/
          );

          if (budgetMatch) {
            result.priceMax = Number(budgetMatch[1].replace(",", "."));
          }
        }

        return result;
      }

      // ===== Parse ngang tối thiểu =====
      const widthMatch = normalized.match(
        /(?:ngang|mat tien ngang)\s*(?:tren|tu|toi thieu)?\s*(\d+(?:[.,]\d+)?)/
      );

      if (widthMatch) {
        result.widthMin = Number(widthMatch[1].replace(",", "."));
      }

      // ===== Parse diện tích tối thiểu =====
      const areaMatch = normalized.match(
        /(?:dien tich|dt)\s*(?:tren|tu|toi thieu)?\s*(\d+(?:[.,]\d+)?)/
      );

      if (areaMatch) {
        result.areaMin = Number(areaMatch[1].replace(",", "."));
      }

      // ===== Parse loại đường =====
      if (
        normalized.includes("mat tien") ||
        normalized.includes("mt")
      ) {
        result.frontageType = "mt";
      } else if (
        normalized.includes("hem xe hoi") ||
        normalized.includes("hxh")
      ) {
        result.frontageType = "hxh";
      } else if (normalized.includes("hem")) {
        result.frontageType = "hem";
      }

      // ===== Keyword mô hình kinh doanh =====
      const businessKeywords = [
        "cafe",
        "ca phe",
        "showroom",
        "spa",
        "nha hang",
        "van phong",
        "shop",
        "thoi trang",
        "phong kham",
        "gym",
      ];

      const foundKeywords = businessKeywords.filter((kw) =>
        normalized.includes(kw)
      );

      result.keyword = foundKeywords.join(" ");

      return result;
    }

    function applyDistrictCheckboxes(districts) {
      document.querySelectorAll(".district-cb").forEach((cb) => {
        cb.checked = false;
      });

      districts.forEach((district) => {
        const cb = document.querySelector(`.district-cb[value="${district}"]`);
        if (cb) {
          cb.checked = true;
        }
      });

      const displayText = document.getElementById("district-display-text");

      if (displayText) {
        if (!districts.length) {
          displayText.textContent = "Tất cả";
        } else if (districts.length <= 2) {
          displayText.textContent = districts.join(", ");
        } else {
          displayText.textContent = `Đã chọn ${districts.length} Quận`;
        }
      }

      if (typeof updateWardOptionsMulti === "function") {
        updateWardOptionsMulti();
      }
    }

    async function applyAIRequestFilter() {
      if (typeof runAISuggestFromInput === "function") {
        await runAISuggestFromInput();
        return;
      }

      const input = document.getElementById("ai-customer-request");
      if (!input || !input.value.trim()) {
        toast("Vui lòng nhập yêu cầu khách hàng");
        return;
      }
      toast("AI search chưa sẵn sàng. Vui lòng tải lại trang.");
    }
