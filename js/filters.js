    function getSelectedDistricts() {
        const checkboxes = document.querySelectorAll('#district-list-checkboxes input[type="checkbox"]:checked');
        const values = Array.from(checkboxes).map(cb => cb.value);
        return values; // VD: ["Quận 1", "Quận 3"]
    }

    // 2. Hàm vẽ danh sách checkbox Quận & Xử lý sự kiện
    function buildDistrictDropdown() {
        const listContainer = document.getElementById("district-list-checkboxes");
        const displayLabel = document.getElementById("district-display-text");
        if (!listContainer) return;

        listContainer.innerHTML = "";
        const dists = Object.keys(HCM_DATA).sort();

        // Tạo các dòng checkbox
        dists.forEach(d => {
            const li = document.createElement("li");
            li.innerHTML = `
                <label class="label cursor-pointer justify-start gap-2 py-1 px-2 hover:bg-base-200 rounded">
                    <input type="checkbox" class="checkbox checkbox-xs checkbox-primary district-cb" value="${d}" />
                    <span class="label-text text-xs">${d}</span>
                </label>
            `;
            listContainer.appendChild(li);
        });

        // Bắt sự kiện khi click vào checkbox
        const checkboxes = listContainer.querySelectorAll(".district-cb");
        checkboxes.forEach(cb => {
            cb.addEventListener("change", () => {
                // A. Cập nhật chữ hiển thị trên nút
                const selected = getSelectedDistricts();
                if (selected.length === 0) {
                    displayLabel.textContent = "Tất cả";
                } else if (selected.length <= 2) {
                    displayLabel.textContent = selected.join(", ");
                } else {
                    displayLabel.textContent = `Đã chọn ${selected.length} Quận`;
                }

                // B. Cập nhật dropdown Phường (Gộp phường của các quận đã chọn)
                updateWardOptionsMulti();

                // C. Gọi lọc dữ liệu ngay lập tức
                applyFilters(true);
            });
        });
    }


    // --- HÀM CHUNG: TẠO DROPDOWN CHO PN, WC, TẦNG ---
    function buildMultiSelectDropdown(config) {
        const { listId, displayId, options, suffix } = config;
        const listContainer = document.getElementById(listId);
        const displayLabel = document.getElementById(displayId);
        
        if (!listContainer) return;
        listContainer.innerHTML = "";

        options.forEach(opt => {
            const val = opt.value; // VD: "1", "2", ">6"
            const label = opt.label; // VD: "1 PN", "> 6 PN"
            
            const li = document.createElement("li");
            li.innerHTML = `
                <label class="label cursor-pointer justify-start gap-2 py-1 px-2 hover:bg-base-200 rounded">
                    <input type="checkbox" class="checkbox checkbox-xs checkbox-primary multi-cb" value="${val}" />
                    <span class="label-text text-xs">${label}</span>
                </label>
            `;
            listContainer.appendChild(li);
        });

        // Xử lý sự kiện click
        const checkboxes = listContainer.querySelectorAll(".multi-cb");
        checkboxes.forEach(cb => {
            cb.addEventListener("change", () => {
                // Lấy danh sách đang chọn
                const checkedBoxes = listContainer.querySelectorAll('.multi-cb:checked');
                const values = Array.from(checkedBoxes).map(c => c.value);
                
                // Cập nhật text hiển thị
                if (values.length === 0) {
                    displayLabel.textContent = "Tất cả";
                } else {
                    // Nếu chọn ít thì hiện số, chọn nhiều thì hiện tổng số
                    if (values.length <= 2) {
                        displayLabel.textContent = values.map(v => v.includes(">") ? v : v + suffix).join(", ");
                    } else {
                        displayLabel.textContent = `Đã chọn ${values.length}`;
                    }
                }
                
                // Gọi lọc ngay lập tức
                applyFilters(true);
            });
        });
    }

    // Hàm lấy giá trị (dùng chung cho 3 cái)
    function getMultiValues(listId) {
        const checkboxes = document.querySelectorAll(`#${listId} input[type="checkbox"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Hàm khởi tạo 3 bộ lọc này (Sẽ gọi ở cuối)
    function initAllMultiFilters() {
        // 1. PN
        buildMultiSelectDropdown({
            listId: "pn-list-checkboxes",
            displayId: "pn-display-text",
            suffix: " PN",
            options: [
                {value: "1", label: "1 PN"}, {value: "2", label: "2 PN"}, 
                {value: "3", label: "3 PN"}, {value: "4", label: "4 PN"}, 
                {value: "5", label: "5 PN"}, {value: "6", label: "6 PN"}, 
                {value: ">6", label: "> 6 PN"}
            ]
        });
        // 2. WC
        buildMultiSelectDropdown({
            listId: "wc-list-checkboxes",
            displayId: "wc-display-text",
            suffix: " WC",
            options: [
                {value: "1", label: "1 WC"}, {value: "2", label: "2 WC"}, 
                {value: "3", label: "3 WC"}, {value: "4", label: "4 WC"}, 
                {value: "5", label: "5 WC"}, {value: ">5", label: "> 5 WC"}
            ]
        });
        // 3. Tầng
        buildMultiSelectDropdown({
            listId: "floors-list-checkboxes",
            displayId: "floors-display-text",
            suffix: " Tầng",
            options: [
                {value: "1", label: "1 Tầng"}, {value: "2", label: "2 Tầng"}, 
                {value: "3", label: "3 Tầng"}, {value: "4", label: "4 Tầng"}, 
                {value: "5", label: "5 Tầng"}, {value: ">5", label: "> 5 Tầng"}
            ]
        });
    }
    // 3. Hàm cập nhật Phường (Khi chọn nhiều quận, hiển thị tất cả phường của các quận đó)
    function updateWardOptionsMulti() {
        const selectedDistricts = getSelectedDistricts();
        const selectWard = document.getElementById("filter-ward");
        selectWard.innerHTML = '<option value="">Tất cả</option>';

        if (selectedDistricts.length === 0) return; // Nếu không chọn quận nào thì thôi

        let allWards = [];
        selectedDistricts.forEach(dist => {
            if (HCM_DATA[dist]) {
                // Thêm prefix tên quận vào để dễ nhìn nếu danh sách quá dài (Tuỳ chọn)
                // Hoặc cứ đẩy thẳng tên phường vào
                allWards = [...allWards, ...HCM_DATA[dist]];
            }
        });
        
        // Loại bỏ trùng lặp và sắp xếp
        allWards = [...new Set(allWards)].sort();

        allWards.forEach((w) => {
            const opt = document.createElement("option");
            opt.value = w;
            opt.textContent = w;
            selectWard.appendChild(opt);
        });
    }
// ============================================================
    // CẤU HÌNH BẢN ĐỒ LEAFLET (OPENSTREETMAP - MIỄN PHÍ)

