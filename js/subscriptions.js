    let CURRENT_SUBSCRIPTION = null;
    let CURRENT_PLAN = "free";

    function normalizeSubscription(row, source = "user_subscriptions") {
      if (!row) return null;
      if (source === "legacy") {
        return {
          id: row.user_id,
          user_id: row.user_id,
          plan: row.plan_name || "free",
          plan_name: row.plan_name || "free",
          status: row.status || "active",
          started_at: row.start_date || null,
          expires_at: row.end_date || null,
          start_date: row.start_date || null,
          end_date: row.end_date || null,
        };
      }
      return {
        ...row,
        plan_name: row.plan_type || row.plan || row.plan_name || "free_trial",
        plan_type: row.plan_type || row.plan || row.plan_name || "free_trial",
        plan: row.plan_type || row.plan || row.plan_name || "free_trial",
        end_date: row.expires_at || row.end_date || null,
        start_date: row.started_at || row.start_date || null,
      };
    }

    function isActiveSubscription(sub) {
      if (!sub || sub.status !== "active") return false;
      const endDate = sub.expires_at || sub.end_date;
      if (!endDate) return true;
      return new Date(endDate).getTime() >= Date.now();
    }

    function isProSubscriptionActive() {
      return isActiveSubscription(CURRENT_SUBSCRIPTION) && CURRENT_SUBSCRIPTION.plan_name === "pro";
    }

    function isPaidSubscriptionActive() {
      return isActiveSubscription(CURRENT_SUBSCRIPTION) && ["basic", "pro"].includes(CURRENT_SUBSCRIPTION.plan_name);
    }

    function isProUser() {
      return isProSubscriptionActive();
    }

    function canViewFullPremiseInfo() {
      return (typeof isAdmin === "function" && isAdmin()) || isPaidSubscriptionActive();
    }

    function requireProFeature() {
      if ((typeof isAdmin === "function" && isAdmin()) || isProSubscriptionActive()) return true;
      toast("Tính năng này chỉ dành cho gói Pro. Vui lòng nâng cấp để sử dụng.");
      return false;
    }

    function isMissingSubscriptionsTableError(error) {
      const message = String(error?.message || error || "").toLowerCase();
      return (
        message.includes("public.subscriptions") ||
        message.includes("public.user_subscriptions") ||
        (message.includes("subscriptions") && message.includes("schema cache")) ||
        message.includes("could not find the table") ||
        message.includes("does not exist") ||
        error?.code === "42P01"
      );
    }

    function subscriptionSetupMessage() {
      return `
        <div class="membership-admin-row border-warning bg-warning/10">
          <div>
            <b>Chưa tạo bảng gói thành viên trên Supabase</b>
            <p>
              Mở Supabase SQL Editor, chạy file
              <code>project/supabase-admin-users.sql</code>, sau đó tải lại trang.
              Nếu vừa chạy SQL, chờ 10-20 giây để Supabase cập nhật schema cache.
            </p>
          </div>
        </div>
      `;
    }

    function showSubscriptionSetupNotice() {
      const result = document.getElementById("admin-subscription-result");
      if (result) result.innerHTML = subscriptionSetupMessage();
      toast("Chưa có bảng gói thành viên. Hãy chạy file supabase-admin-users.sql trong Supabase SQL Editor.");
    }

    function formatDateOnly(value) {
      if (!value) return "Không giới hạn";
      const d = new Date(value);
      if (isNaN(d.getTime())) return "Không giới hạn";
      return d.toLocaleDateString("vi-VN");
    }

    async function loadCurrentSubscription() {
      CURRENT_SUBSCRIPTION = null;
      CURRENT_PLAN = "free";
      if (!CURRENT_USER) return null;

      const { data, error } = await db
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", CURRENT_USER.id)
        .eq("status", "active")
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("expires_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        CURRENT_SUBSCRIPTION = normalizeSubscription(data);
        CURRENT_PLAN = isActiveSubscription(CURRENT_SUBSCRIPTION) ? CURRENT_SUBSCRIPTION.plan_name : "free";
        return CURRENT_SUBSCRIPTION;
      }

      if (error && !isMissingSubscriptionsTableError(error)) {
        console.warn("Không tải được user_subscriptions, thử bảng subscriptions cũ.", error);
      }

      const { data: legacyData, error: legacyError } = await db
        .from("subscriptions")
        .select("*")
        .eq("user_id", CURRENT_USER.id)
        .eq("status", "active")
        .order("end_date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (legacyError) {
        if (!isMissingSubscriptionsTableError(legacyError)) {
          console.warn("Không tải được subscription, mặc định Free.", legacyError);
        }
        return null;
      }

      CURRENT_SUBSCRIPTION = normalizeSubscription(legacyData, "legacy");
      CURRENT_PLAN = isActiveSubscription(CURRENT_SUBSCRIPTION) ? CURRENT_SUBSCRIPTION.plan_name : "free";
      return CURRENT_SUBSCRIPTION;
    }

    function updatePlanUI() {
      const planBadge = document.getElementById("plan-badge");
      const plan = CURRENT_PLAN || "free";
      if (planBadge) {
        planBadge.textContent = plan === "pro" ? "Pro" : plan === "basic" ? "Basic" : "Free";
        planBadge.className = plan === "pro"
          ? "badge bg-primary text-white border-none"
          : plan === "basic"
            ? "badge bg-info text-white border-none"
            : "badge badge-outline";
      }

      const accountPlan = document.getElementById("account-plan-name");
      const accountEnd = document.getElementById("account-plan-end");
      if (accountPlan) accountPlan.textContent = plan === "pro" ? "Pro" : plan === "basic" ? "Basic" : "Free";
      if (accountEnd) accountEnd.textContent = plan !== "free" ? formatDateOnly(CURRENT_SUBSCRIPTION?.end_date) : "-";
    }

    function renderUpgradeNotice() {
      if (canViewFullPremiseInfo()) return "";
      return `
        <div class="membership-lock mt-3">
          <div>
            <b>Thông tin đang được ẩn với gói Free/Basic</b>
            <p>Nâng cấp Pro để xem số điện thoại, địa chỉ chi tiết và ghi chú nguồn hàng.</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="openAccountDialog()">Nâng cấp Pro</button>
        </div>
      `;
    }

    function openAccountDialog() {
      updatePlanUI();
      const nameInput = document.getElementById("account-full-name");
      if (nameInput) {
        const name = typeof getUserDisplayName === "function"
          ? getUserDisplayName(CURRENT_USER, CURRENT_PROFILE)
          : "";
        nameInput.value = name || "";
      }
      const dlg = document.getElementById("accountDlg");
      if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    }

    function openMembershipAdminDialog() {
      if (!isAdmin()) {
        toast("Chỉ admin mới dùng được.");
        return;
      }
      const dlg = document.getElementById("membershipAdminDlg");
      if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    }

    async function adminFindSubscriptionUser() {
      if (!isAdmin()) return;
      const email = document.getElementById("admin-subscription-email").value.trim();
      const result = document.getElementById("admin-subscription-result");
      if (!email) {
        toast("Nhập email user cần tìm.");
        return;
      }

      result.innerHTML = "Đang tìm...";
      const { data, error } = await db
        .from("profiles")
        .select("id,email,role")
        .ilike("email", `%${email}%`)
        .limit(10);

      if (error) {
        result.innerHTML = `<div class="text-error text-sm">${error.message}</div>`;
        return;
      }

      if (!data || !data.length) {
        result.innerHTML = `<div class="text-sm text-slate-500">Không tìm thấy user.</div>`;
        return;
      }

      result.innerHTML = data.map((user) => `
        <div class="membership-admin-row">
          <div>
            <b>${user.email || "(không có email)"}</b>
            <p>${user.role || "staff"}</p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="adminActivatePro('${user.id}', '${(user.email || "").replace(/'/g, "\\'")}')">
            Kích hoạt/Gia hạn Pro
          </button>
        </div>
      `).join("");
    }

    async function adminActivatePro(userId, email) {
      if (!isAdmin()) return;
      const months = Number(document.getElementById("admin-subscription-months").value) || 1;
      const start = new Date();
      const baseEnd = new Date();
      const end = new Date(baseEnd);
      end.setMonth(end.getMonth() + months);

      const { error } = await db
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          plan: "pro",
          status: "active",
          started_at: start.toISOString(),
          expires_at: end.toISOString(),
          cancelled_at: null,
        }, { onConflict: "user_id" });

      if (error) {
        if (isMissingSubscriptionsTableError(error)) {
          showSubscriptionSetupNotice();
          return;
        }
        toast("Lỗi kích hoạt Pro: " + error.message);
        return;
      }

      if (CURRENT_USER?.id === userId) {
        await loadCurrentSubscription();
        updatePlanUI();
      }
      if (typeof renderAdminUsersPage === "function") renderAdminUsersPage();
      toast(`Đã kích hoạt Pro cho ${email || userId}`);
    }
