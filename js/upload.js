    function initAddFormDropdowns() {
        const distSelect = document.getElementById("add-district");
        const wardSelect = document.getElementById("add-ward");
        
        // Load Districts
        const dists = Object.keys(HCM_DATA).sort();
        distSelect.innerHTML = `<option value="">-- Chọn --</option>` + dists.map(d => `<option value="${d}">${d}</option>`).join("");
        
        // Event Change
        distSelect.addEventListener("change", () => {
            const val = distSelect.value;
            wardSelect.innerHTML = `<option value="">-- Chọn --</option>`;
            if(HCM_DATA[val]) {
                wardSelect.disabled = false;
                wardSelect.innerHTML += HCM_DATA[val].map(w => `<option value="${w}">${w}</option>`).join("");
            } else {
                wardSelect.disabled = true;
            }
        });
    }
    // ====================== GLOBAL VARIABLES ======================
    let FILES_BUFFER = [];  // Lưu file khi chọn ảnh bằng input


    // ====================== HÀM TẠO MÃ MẶT BẰNG ======================
    async function generateNextCode() {
      const { data, error } = await db
        .from("premises")
        .select("code")
        .order("code", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].code; // VD: MBKD 56780001345
        const num = parseInt(lastCode.replace(/\D/g, ""), 10);
        nextNumber = num + 1;
      }

      return "MBKD " + nextNumber.toString().padStart(11, "0");
    }


    // ====================== HÀM CHỌN FILE ẢNH ======================
    function handleSelectFiles(input) {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      for (const file of files) {
        FILES_BUFFER.push(file);
      }

      renderImagePreview();
    }
    function renderImagePreview() {
      const previewBox = document.getElementById("new-images-preview");
      if (!previewBox) return;

      if (FILES_BUFFER.length === 0) {
        previewBox.innerHTML = `
          <div class="text-center text-gray-400 py-6">
            Chưa có ảnh nào. Ảnh đầu tiên sẽ là <b>Ảnh Bìa</b>.
          </div>`;
        return;
      }

      previewBox.innerHTML = FILES_BUFFER.map((file, i) => {
        const url = URL.createObjectURL(file);
        return `
          <div class="relative inline-block m-1">
            <img src="${url}" class="h-24 w-24 object-cover rounded-lg border" />
            <button class="btn btn-xs btn-circle absolute -top-2 -right-2 bg-white"
                    onclick="deleteImageFromBuffer(${i})">✕</button>
          </div>
        `;
      }).join("");
    }

    function deleteImageFromBuffer(index) {
      FILES_BUFFER.splice(index, 1);
      renderImagePreview();
    }

    async function saveNewPremise() {
        const getVal = (id) => document.getElementById(id).value.trim();
        // Lấy giá tiền từ input đã format (xóa dấu chấm/phẩy đi)
        const priceRaw = getVal("add-price").replace(/\D/g,'');
        const priceNum = priceRaw ? parseInt(priceRaw) : 0;

        if (!getVal("add-address") || !getVal("add-district") || !priceNum) {
            toast("Vui lòng nhập: Địa chỉ, Quận và Giá thuê!");
            return;
        }

        const payload = {
            address: getVal("add-address"),
            district: document.getElementById("add-district").value,
            ward: document.getElementById("add-ward").value,
            street: getVal("add-street"),
            price: priceNum,
            area: Number(getVal("add-area")) || null,
            width: Number(getVal("add-width")) || null,
            length: Number(getVal("add-length")) || null,
            floors: Number(getVal("add-floors")) || null,
            pn: Number(getVal("add-bedrooms")) || null,
            wc: Number(getVal("add-wc")) || null,
            ket_cau: getVal("add-ket-cau"),
            contact_phone: getVal("add-contact-phone"),
            frontage: document.getElementById("add-frontage").checked,
            images: getVal("add-images").split('\n').map(s=>s.trim()).filter(Boolean),
            detail: getVal("add-detail"),
            status: 'available',
            road_type: document.getElementById("add-road-type").value, // MỚI
              commission: getVal("add-commission"),
            // code, created_by, is_approved SẼ ĐƯỢC DB TỰ ĐỘNG XỬ LÝ (NẾU ĐÃ CHẠY SQL)
        };

        const { error } = await db.from("premises").insert([payload]);
        if (error) {
            toast("Lỗi: " + error.message);
        } else {
            toast(isAdmin() ? "Đã thêm thành công!" : "Đã gửi duyệt!");
            document.getElementById("addDlg").close();
            applyFilters(true);
            if(isAdmin()) checkPendingCount();
        }
    }
      // ===== NHÂN SỰ: BÁO HẾT (CHỜ ADMIN DUYỆT) =====
    async function reportRentedStaff(id) {
      if (!isStaff()) return;
      if (!confirm("Xác nhận báo hết mặt bằng này để admin duyệt?")) return;

      const { error } = await db
        .from("premises")
        .update({
          rented_reported_at: new Date().toISOString(),
          rented_reporter_email: CURRENT_USER.email,
          rented_confirmed_at: null   // chắc chắn là chưa duyệt
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        toast("Lỗi báo hết: " + error.message);
        return;
      }

      toast("Đã báo hết – chờ admin xác nhận.");
      document.getElementById("detailDlg").close();
      applyFilters(true);
    }

    // ===== LOGIC ADMIN PENDING (MỚI) =====
    async function checkPendingCount() {
        const { count } = await db.from("premises").select("*", { count: 'exact', head: true }).eq("is_approved", false);
        const cnt = count || 0;
        document.getElementById("count-pending").textContent = cnt;
        if (cnt > 0 && SHOW_PENDING) document.getElementById("btn-approve-all").classList.remove("hidden");
        else document.getElementById("btn-approve-all").classList.add("hidden");
    }

    function togglePendingMode() {
        SHOW_PENDING = !SHOW_PENDING;
        const btn = document.getElementById("btn-toggle-pending");
        if (SHOW_PENDING) {
            btn.classList.replace("btn-warning", "btn-active");
            btn.textContent = "Đang xem Chờ duyệt (Thoát)";
        } else {
            btn.classList.replace("btn-active", "btn-warning");
            btn.innerHTML = `Cần duyệt <span class="badge badge-sm bg-white text-warning ml-1 border-none" id="count-pending">...</span>`;
            checkPendingCount();
        }
        applyFilters(true);
    }

    async function approveOne(id, e) {
        e.stopPropagation();
        if(!confirm("Duyệt bài này?")) return;
        await db.from("premises").update({ is_approved: true }).eq("id", id);
        toast("Đã duyệt!");
        applyFilters(true);
        checkPendingCount();
    }

    async function approveAll() {
        if(!confirm("Duyệt tất cả bài đang chờ?")) return;
        await db.from("premises").update({ is_approved: true }).eq("is_approved", false);
        toast("Đã duyệt tất cả!");
        applyFilters(true);
        checkPendingCount();
    }

    // ===== INIT EVENTS =====

