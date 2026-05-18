    let MAP_INSTANCE = null;
    let MAP_MARKERS = [];
    let MARKER_CLUSTER_GROUP = null;
    // 1. Hàm khởi tạo bản đồ
    function initStaffMap() {
      // Nếu map đã tạo rồi thì không tạo lại
      if (MAP_INSTANCE) return;

      const el = document.getElementById("premises-map");
      if (!el) return;

      // Tạo map, set trung tâm là TP.HCM (10.7769, 106.7009), zoom 13
      MAP_INSTANCE = L.map('premises-map').setView([10.7769, 106.7009], 13);

      // QUAN TRỌNG: Thêm lớp nền OpenStreetMap (cái này Google Maps không cần nhưng Leaflet bắt buộc)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(MAP_INSTANCE);
    }

    // 2. Hàm xóa các marker cũ khi lọc lại
    function clearMapMarkers() {
      if (MAP_MARKERS.length > 0) {
        MAP_MARKERS.forEach(marker => marker.remove()); // Lệnh xóa của Leaflet
        MAP_MARKERS = [];
      }
    }

    // 3. Hàm vẽ marker lên bản đồ
// 3. Hàm vẽ marker (SỬ DỤNG CLUSTER ĐỂ CHỐNG CHỒNG CHÉO)
    function renderMapMarkers(rows) {
      const mapView = document.getElementById("map-view");
      if (mapView && mapView.classList.contains("hidden")) return;

      initStaffMap();

      // Fix lỗi map xám khi resize
      setTimeout(() => {
         if(MAP_INSTANCE) MAP_INSTANCE.invalidateSize();
      }, 100);

      // --- XÓA LAYER CŨ ---
      // Nếu đã có nhóm cluster cũ thì xóa khỏi bản đồ và clear dữ liệu
      if (MARKER_CLUSTER_GROUP) {
          MARKER_CLUSTER_GROUP.clearLayers();
          MAP_INSTANCE.removeLayer(MARKER_CLUSTER_GROUP);
      }
      
      // Reset mảng markers quản lý thủ công (nếu cần)
      MAP_MARKERS = [];

      if (!rows || !rows.length || !MAP_INSTANCE) return;

      // --- KHỞI TẠO CLUSTER GROUP MỚI ---
      MARKER_CLUSTER_GROUP = L.markerClusterGroup({
          maxClusterRadius: 40, // Bán kính gom nhóm (px). Số nhỏ thì gom ít, số lớn gom nhiều.
          spiderfyOnMaxZoom: true, // Quan trọng: Nếu trùng vị trí, click vào sẽ xoè ra
          showCoverageOnHover: false, // Tắt hiển thị vùng bao phủ khi hover (cho đẹp)
          zoomToBoundsOnClick: true, // Click vào nhóm sẽ zoom vào
          
          // Tùy chỉnh icon của nhóm (Optional - nếu muốn đẹp hơn mặc định)
          
          iconCreateFunction: function(cluster) {
              return L.divIcon({ 
                  html: '<div style="background:#3b82f6; color:white; border-radius:50%; width:30px; height:30px; display:flex; justify-content:center; align-items:center; font-weight:bold; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3)">' + cluster.getChildCount() + '</div>', 
                  className: 'my-cluster-icon', 
                  iconSize: L.point(30, 30) 
              });
          }
          
      });

      rows.forEach((row) => {
        if (!row.lat || !row.lng) return;
        const lat = Number(row.lat);
        const lng = Number(row.lng);

        // Xử lý hiển thị giá
        let displayPrice = "TL";
        if (row.price) {
           if (row.price >= 1000000000) {
             displayPrice = (row.price / 1000000000).toFixed(1) + " Tỷ";
           } else if (row.price >= 1000000) {
             displayPrice = (row.price / 1000000).toFixed(1) + " Tr";
           } else {
             displayPrice = new Intl.NumberFormat('vi-VN').format(row.price);
           }
           displayPrice = displayPrice.replace(".0 ", " ");
        }

        const title = (typeof buildTitle === 'function' ? buildTitle(row) : row.address) || "Mặt bằng";
        
        // Tạo icon giá tiền
        const priceIcon = L.divIcon({
          className: '', 
          html: `<div class="price-marker-label">${displayPrice}</div>`,
          iconSize: [null, null],
          iconAnchor: [20, 10]
        });

        // Tạo marker nhưng KHÔNG addTo(MAP_INSTANCE) ngay lập tức
        const marker = L.marker([lat, lng], { icon: priceIcon });

        // Tạo Popup
        const infoContent = `
          <div style="min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="font-weight: bold; color: #000; margin-bottom: 4px; font-size: 13px;">
                ${title}
            </div>
            <div style="color: #d32f2f; font-weight: bold; margin-bottom: 6px;">
                ${money(row.price)}
            </div>
            <div style="font-size: 12px; color: #555; margin-bottom: 8px;">
               ${typeof maskAddress === "function" ? maskAddress(row) : (row.ward || row.district || "Đang cập nhật địa chỉ...")}
            </div>
            <button 
              onclick="openDetail('${row.id}')"
              class="btn btn-xs btn-primary w-full text-white" 
              style="width: 100%; padding: 6px; background-color: #4f46e5; color: white; border-radius: 4px; border: none; cursor: pointer;">
              Xem chi tiết
            </button>
          </div>
        `;

        marker.bindPopup(infoContent);
        
        // Hiệu ứng hover marker
        marker.on('mouseover', function (e) { this.setZIndexOffset(1000); });
        marker.on('mouseout', function (e) { this.setZIndexOffset(0); });

        // QUAN TRỌNG: Thêm marker vào Cluster Group
        MARKER_CLUSTER_GROUP.addLayer(marker);
        
        // (Tùy chọn) Vẫn đẩy vào mảng quản lý nếu cần xử lý logic khác
        MAP_MARKERS.push(marker);
      });

      // Cuối cùng: Thêm Cluster Group vào bản đồ
      MAP_INSTANCE.addLayer(MARKER_CLUSTER_GROUP);

      // Fit bounds để nhìn thấy tất cả các điểm
      if (MAP_MARKERS.length > 0) {
        MAP_INSTANCE.fitBounds(MARKER_CLUSTER_GROUP.getBounds(), { padding: [50, 50] });
      }
    }

