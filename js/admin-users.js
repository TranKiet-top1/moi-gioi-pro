    let ADMIN_USERS_CACHE = [];
    let ADMIN_USER_PLAN_TARGET = null;
    let ADMIN_USER_CANCEL_TARGET = null;

    function adminEscapeHtml(value = "") {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function adminPlanLabel(plan) {
      const value = String(plan || "free").toLowerCase();
      if (value === "pro") return "Pro";
      if (value === "basic") return "Basic";
      return "Free";
    }

    function adminStatusLabel(status) {
      const value = String(status || "active").toLowerCase();
      if (value === "cancelled") return "cancelled";
      if (value === "expired") return "expired";
      return "active";
    }

    function adminEffectiveStatus(sub) {
      if (!sub) return "active";
      if (sub.status === "cancelled") return "cancelled";
      if (sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()) return "expired";
      return sub.status || "active";
    }

    function adminDaysLeft(row) {
      const plan = row.plan || "free";
      if (plan === "free" || !row.expires_at) return "-";
      const ms = new Date(row.expires_at).getTime() - Date.now();
      if (isNaN(ms) || ms < 0) return "Hết hạn";
      return `${Math.ceil(ms / 86400000)} ngày`;
    }

    function adminFormatDate(value) {
      if (!value) return "-";
      const d = new Date(value);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("vi-VN");
    }

    function adminFormatDateTime(value) {
      if (!value) return "-";
      const d = new Date(value);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function adminPlanBadge(plan) {
      const value = String(plan || "free").toLowerCase();
      return `<span class="admin-plan-badge plan-${value}">${adminPlanLabel(value)}</span>`;
    }

    function adminStatusBadge(status) {
      const value = adminStatusLabel(status);
      return `<span class="admin-status-badge status-${value}">${value}</span>`;
    }

    function isAdminUsersMissingTableError(error) {
      const message = String(error?.message || error || "").toLowerCase();
      return (
        message.includes("public.user_subscriptions") ||
        message.includes("could not find the table") ||
        (message.includes("user_subscriptions") && message.includes("does not exist")) ||
        (message.includes("user_subscriptions") && message.includes("schema cache")) ||
        error?.code === "42P01"
      );
    }

    function isMissingProfilePhoneError(error) {
      const message = String(error?.message || error || "").toLowerCase();
      return (
        message.includes("profiles.phone") ||
        message.includes("column phone") ||
        message.includes("phone does not exist") ||
        message.includes("could not find the 'phone' column") ||
        (message.includes("phone") && message.includes("schema cache"))
      );
    }

    function renderAdminUsersSetupNotice(message, detail = "") {
      const tbody = document.getElementById("admin-users-tbody");
      if (!tbody) return;
      tbody.innerHTML = `
        <tr>
          <td colspan="11">
            <div class="admin-users-empty">
              <b>${adminEscapeHtml(message || "Chưa tạo bảng quản lý tài khoản.")}</b>
              <p>Hãy chạy file <code>project/supabase-admin-users.sql</code> trong Supabase SQL Editor, rồi tải lại trang.</p>
              ${detail ? `<p class="text-error">${adminEscapeHtml(detail)}</p>` : ""}
            </div>
          </td>
        </tr>
      `;
    }

    async function loadProfilesForAdminUsers() {
      const { data, error } = await db
        .from("profiles")
        .select("id,email,phone,full_name,role,last_seen_at,created_at")
        .order("created_at", { ascending: false });

      if (!error) return data || [];
      if (!isMissingProfilePhoneError(error)) throw error;

      console.warn("profiles.phone chua san sang, fallback tai danh sach khong co so dien thoai.", error);
      const fallback = await db
        .from("profiles")
        .select("id,email,full_name,role,last_seen_at,created_at")
        .order("created_at", { ascending: false });

      if (fallback.error) throw fallback.error;
      return (fallback.data || []).map((profile) => ({ ...profile, phone: "-" }));
    }

    async function loadAdminUsersData() {
      if (!isAdmin()) return [];

      const profiles = await loadProfilesForAdminUsers();

      const userIds = (profiles || []).map((profile) => profile.id);
      let subscriptions = [];
      if (userIds.length) {
        const { data, error } = await db
          .from("user_subscriptions")
          .select("*")
          .in("user_id", userIds);
        if (error) throw error;
        subscriptions = data || [];
      }

      const pickBetterSub = (current, next) => {
        if (!current) return next;
        const currentActive = adminEffectiveStatus(current) === "active";
        const nextActive = adminEffectiveStatus(next) === "active";
        if (currentActive !== nextActive) return nextActive ? next : current;
        const rank = { pro: 3, basic: 2, free_trial: 1, free: 1 };
        const currentPlan = current.plan_type || current.plan || "free";
        const nextPlan = next.plan_type || next.plan || "free";
        if ((rank[nextPlan] || 0) !== (rank[currentPlan] || 0)) {
          return (rank[nextPlan] || 0) > (rank[currentPlan] || 0) ? next : current;
        }
        const currentDate = new Date(current.expires_at || current.updated_at || current.created_at || 0).getTime();
        const nextDate = new Date(next.expires_at || next.updated_at || next.created_at || 0).getTime();
        return nextDate > currentDate ? next : current;
      };
      const subByUser = new Map();
      subscriptions.forEach((sub) => {
        subByUser.set(sub.user_id, pickBetterSub(subByUser.get(sub.user_id), sub));
      });
      return (profiles || []).map((profile) => {
        const sub = subByUser.get(profile.id) || null;
        const plan = sub?.plan_type || sub?.plan || "free";
        const status = adminEffectiveStatus(sub || { status: "active", plan });
        return {
          ...profile,
          subscription_id: sub?.id || null,
          plan,
          status,
          started_at: sub?.started_at || null,
          expires_at: sub?.expires_at || null,
          cancelled_at: sub?.cancelled_at || null,
        };
      });
    }

    function filterAdminUsers(rows) {
      const q = (document.getElementById("admin-users-search")?.value || "").trim().toLowerCase();
      const plan = document.getElementById("admin-users-plan-filter")?.value || "";
      const status = document.getElementById("admin-users-status-filter")?.value || "";

      return rows.filter((row) => {
        const text = `${row.email || ""} ${row.phone || ""} ${row.full_name || ""}`.toLowerCase();
        if (q && !text.includes(q)) return false;
        if (plan && row.plan !== plan) return false;
        if (status && row.status !== status) return false;
        return true;
      });
    }

    function renderAdminUserActions(row) {
      if ((row.plan || "free") === "free" || row.status !== "active") {
        return `<button class="btn btn-xs btn-primary" onclick="openAdminUserPlanDialog('${row.id}', 'subscribe')">Đăng ký gói</button>`;
      }
      return `
        <div class="admin-user-actions">
          <button class="btn btn-xs btn-primary" onclick="openAdminUserPlanDialog('${row.id}', 'renew')">Gia hạn</button>
          <button class="btn btn-xs btn-outline" onclick="openAdminUserPlanDialog('${row.id}', 'change')">Đổi gói</button>
          <button class="btn btn-xs btn-error text-white" onclick="openAdminUserCancelDialog('${row.id}')">Hủy gói</button>
        </div>
      `;
    }

    function renderAdminUsersTable(rows) {
      const tbody = document.getElementById("admin-users-tbody");
      if (!tbody) return;
      const filtered = filterAdminUsers(rows);
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="11"><div class="admin-users-empty">Không có tài khoản phù hợp bộ lọc.</div></td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map((row) => `
        <tr>
          <td>
            <div class="admin-user-cell">
              <b>${adminEscapeHtml(row.email || "(không có email)")}</b>
              <span>${adminEscapeHtml(row.full_name || "Chưa có tên")}</span>
            </div>
          </td>
          <td>${adminEscapeHtml(row.phone || "-")}</td>
          <td>${adminEscapeHtml(row.role || "user")}</td>
          <td>${adminPlanBadge(row.plan)}</td>
          <td>${adminStatusBadge(row.status)}</td>
          <td>${adminFormatDate(row.created_at)}</td>
          <td>${adminFormatDate(row.started_at)}</td>
          <td>${adminFormatDate(row.expires_at)}</td>
          <td>${adminDaysLeft(row)}</td>
          <td>${adminFormatDateTime(row.last_seen_at)}</td>
          <td>${renderAdminUserActions(row)}</td>
        </tr>
      `).join("");
    }

    async function renderAdminUsersPage() {
      const tbody = document.getElementById("admin-users-tbody");
      if (!tbody) return;
      if (!isAdmin()) {
        tbody.innerHTML = `<tr><td colspan="11"><div class="admin-users-empty text-error">Chỉ admin mới được xem trang này.</div></td></tr>`;
        return;
      }

      tbody.innerHTML = `<tr><td colspan="11"><div class="admin-users-empty">Đang tải danh sách tài khoản...</div></td></tr>`;
      try {
        ADMIN_USERS_CACHE = await loadAdminUsersData();
        renderAdminUsersTable(ADMIN_USERS_CACHE);
      } catch (error) {
        console.error("renderAdminUsersPage error", error);
        if (isAdminUsersMissingTableError(error)) {
          renderAdminUsersSetupNotice("Chưa có bảng user_subscriptions hoặc cột mới của profiles.");
        } else {
          tbody.innerHTML = `<tr><td colspan="11"><div class="admin-users-empty text-error">${adminEscapeHtml(error.message)}</div></td></tr>`;
        }
      }
    }

    function getAdminUserRow(userId) {
      return ADMIN_USERS_CACHE.find((row) => row.id === userId) || null;
    }

    function openAdminUserPlanDialog(userId, mode = "subscribe") {
      const row = getAdminUserRow(userId);
      if (!row) return;
      ADMIN_USER_PLAN_TARGET = { userId, mode };
      const title = document.getElementById("admin-user-plan-title");
      const subtitle = document.getElementById("admin-user-plan-subtitle");
      const planSelect = document.getElementById("admin-user-plan-select");
      if (title) title.textContent = mode === "renew" ? "Gia hạn gói" : mode === "change" ? "Đổi gói" : "Đăng ký gói";
      if (subtitle) subtitle.textContent = row.email || row.full_name || userId;
      if (planSelect) planSelect.value = row.plan && row.plan !== "free" ? row.plan : "pro";
      document.getElementById("adminUserPlanDlg")?.showModal();
    }

    async function confirmAdminUserPlanChange() {
      if (!ADMIN_USER_PLAN_TARGET || !isAdmin()) return;
      const row = getAdminUserRow(ADMIN_USER_PLAN_TARGET.userId);
      if (!row) return;
      const plan = document.getElementById("admin-user-plan-select").value || "free";
      const days = Number(document.getElementById("admin-user-duration-select").value) || 30;
      const now = new Date();
      const currentExpiry = row.expires_at ? new Date(row.expires_at) : null;
      const base = ADMIN_USER_PLAN_TARGET.mode === "renew" && currentExpiry && currentExpiry.getTime() > Date.now()
        ? currentExpiry
        : now;
      const expiresAt = plan === "free" ? null : new Date(base.getTime() + days * 86400000);

      const { error } = await db
        .from("user_subscriptions")
        .upsert({
          user_id: row.id,
          plan,
          plan_type: plan,
          status: "active",
          started_at: row.started_at || now.toISOString(),
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          cancelled_at: null,
        }, { onConflict: "user_id" });

      if (error) {
        if (isAdminUsersMissingTableError(error)) renderAdminUsersSetupNotice();
        toast("Lỗi cập nhật gói: " + error.message);
        return;
      }

      document.getElementById("adminUserPlanDlg")?.close();
      toast("Đã cập nhật gói thành viên.");
      if (CURRENT_USER?.id === row.id) {
        await loadCurrentSubscription();
        updatePlanUI();
      }
      await renderAdminUsersPage();
    }

    function openAdminUserCancelDialog(userId) {
      const row = getAdminUserRow(userId);
      if (!row) return;
      ADMIN_USER_CANCEL_TARGET = userId;
      const text = document.getElementById("admin-user-cancel-text");
      if (text) text.textContent = `Tài khoản ${row.email || row.full_name || userId} sẽ mất quyền gói hiện tại.`;
      document.getElementById("adminUserCancelDlg")?.showModal();
    }

    async function confirmAdminUserCancelPlan() {
      if (!ADMIN_USER_CANCEL_TARGET || !isAdmin()) return;
      const userId = ADMIN_USER_CANCEL_TARGET;
      const { error } = await db
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          plan: "free",
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          expires_at: null,
        }, { onConflict: "user_id" });

      if (error) {
        toast("Lỗi hủy gói: " + error.message);
        return;
      }

      document.getElementById("adminUserCancelDlg")?.close();
      toast("Đã hủy gói thành viên.");
      if (CURRENT_USER?.id === userId) {
        await loadCurrentSubscription();
        updatePlanUI();
      }
      await renderAdminUsersPage();
    }

    function bindAdminUsersFilters() {
      ["admin-users-search", "admin-users-plan-filter", "admin-users-status-filter"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.boundAdminUsers) return;
        el.dataset.boundAdminUsers = "1";
        const eventName = id === "admin-users-search" ? "input" : "change";
        el.addEventListener(eventName, () => renderAdminUsersTable(ADMIN_USERS_CACHE));
      });
    }
