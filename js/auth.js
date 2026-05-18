    async function initAuth() {
      if (typeof getShareSlugFromLocation === "function") {
        const shareSlug = getShareSlugFromLocation();
        if (shareSlug) {
          await renderSharePage(shareSlug);
          return;
        }
      }
      // SỬA: dùng db thay vì supabase
      const { data } = await db.auth.getUser();
      
      if (!data.user) {
        document.getElementById("auth-section").classList.remove("hidden");
        document.getElementById("app-root").classList.add("hidden");
        return;
      }

      CURRENT_USER = data.user;

      if (typeof db.rpc === "function") {
        const { error: touchError } = await db.rpc("ensure_current_user_profile_and_subscription");
        if (touchError) {
          console.warn("Không cập nhật được last_seen/profile mặc định. Hãy chạy supabase-admin-users.sql nếu chưa chạy.", touchError);
        }
      }

      // --- LẤY ROLE TỪ BẢNG PROFILES ---
      let role = "user";
      let userEmail = CURRENT_USER.email || CURRENT_USER.phone || "";
      
      // SỬA: Chỗ này file cũ của bạn đang dùng 'supabase' -> Gây lỗi văng ra
      const { data: profile } = await db
        .from("profiles")
        .select("role, email, phone, full_name")
        .eq("id", CURRENT_USER.id)
        .maybeSingle();
      
      if (profile) {
          if (profile.role) role = profile.role;
          if (profile.email || profile.phone) userEmail = profile.email || profile.phone;
      }
      if (!profile && String(CURRENT_USER.email || "").toLowerCase() === "admin@idl.com") {
          role = "admin";
          userEmail = CURRENT_USER.email;
      }
      CURRENT_ROLE = role;
      await loadCurrentSubscription();

      // ĐOẠN QUAN TRỌNG NHẤT: CHUYỂN MÀN HÌNH
      // Vì code trên đã sửa xong, dòng này sẽ chạy được
      document.getElementById("auth-section").classList.add("hidden");
      document.getElementById("app-root").classList.remove("hidden");
      
      // Hiển thị tên/role
      document.getElementById("user-email-display").textContent = userEmail;
      const roleBadge = document.getElementById("role-badge");
      roleBadge.textContent = (role === "admin" ? "Admin" : "User");
      updatePlanUI();
      
      if (role === "admin") {
          roleBadge.className = "badge badge-error text-white";
          document.getElementById("admin-pending-controls").classList.remove("hidden");
          document.getElementById("admin-users-nav-btn")?.classList.remove("hidden");
          if (typeof bindAdminUsersFilters === "function") bindAdminUsersFilters();
          checkPendingCount();
          checkRentedReportCount();
          checkReactivateCount();
      } else {
          roleBadge.className = "badge badge-outline";
          document.getElementById("admin-pending-controls").classList.add("hidden");
          document.getElementById("admin-users-nav-btn")?.classList.add("hidden");
      }

      await applyFilters(true);
      await buildDistrictWardOptions();
      initAddFormDropdowns();
      if (typeof initAppFeatureState === "function") await initAppFeatureState();
    }

    
    function showDemoNotice() {
      const dlg = document.getElementById("demoNoticeDlg");
      if (dlg && typeof dlg.showModal === "function") {
        dlg.showModal();
      }
    }

    let AUTH_MODE = "login";
    let PHONE_OTP_TARGET = "";
    let PHONE_OTP_FAILS = 0;
    let AUTH_COOLDOWNS = { email: 0, phone: 0 };

    function getAuthRedirectUrl() {
      return window.location.origin && window.location.origin !== "null"
        ? `${window.location.origin}${window.location.pathname}`
        : window.location.href.split("#")[0];
    }

    function setAuthMode(mode) {
      AUTH_MODE = mode === "register" ? "register" : "login";
      const isRegister = AUTH_MODE === "register";
      const title = document.getElementById("auth-form-title");
      const subtitle = document.getElementById("auth-form-subtitle");
      const loginBtn = document.getElementById("btn-login");
      const toggleBtn = document.getElementById("btn-toggle-register");
      const phoneWrap = document.getElementById("register-phone-wrap");

      if (title) title.textContent = isRegister ? "Đăng ký Môi giới Pro" : "Đăng nhập Môi giới Pro";
      if (subtitle) {
        subtitle.textContent = isRegister
          ? "Tạo tài khoản bằng Gmail, số điện thoại và mật khẩu."
          : "Đăng nhập bằng Google hoặc Gmail đã đăng ký.";
      }
      if (phoneWrap) phoneWrap.classList.toggle("hidden", !isRegister);
      if (loginBtn) loginBtn.textContent = isRegister ? "Đăng ký tài khoản" : "Đăng nhập";
      if (toggleBtn) {
        toggleBtn.textContent = isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký mới";
      }
    }

    function scrollToLoginCard(mode = "login") {
      if (typeof setAuthMode === "function") setAuthMode(mode);
      const authSection = document.getElementById("auth-section");
      const appRoot = document.getElementById("app-root");
      const loginCard = document.getElementById("login-card");
      authSection?.classList.remove("hidden");
      appRoot?.classList.add("hidden");
      loginCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function bindPublicAuthControls() {
      document.getElementById("btn-open-login")?.addEventListener("click", (event) => {
        event.preventDefault();
        scrollToLoginCard("login");
      });
      document.getElementById("btn-open-register")?.addEventListener("click", (event) => {
        event.preventDefault();
        scrollToLoginCard("register");
      });
      document.querySelectorAll("[data-public-login]").forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          scrollToLoginCard("login");
        });
      });
      document.querySelectorAll("[data-public-register]").forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          scrollToLoginCard("register");
        });
      });
    }

    function setAuthTab(tab) {
      const isPhone = tab === "phone";
      document.getElementById("auth-email-panel")?.classList.toggle("hidden", isPhone);
      document.getElementById("auth-phone-panel")?.classList.toggle("hidden", !isPhone);
      document.getElementById("auth-tab-email")?.classList.toggle("tab-active", !isPhone);
      document.getElementById("auth-tab-phone")?.classList.toggle("tab-active", isPhone);
    }

    function normalizeVietnamPhone(rawPhone = "") {
      const digits = String(rawPhone || "").replace(/[^\d+]/g, "");
      if (!digits) return "";
      if (digits.startsWith("+")) return digits;
      if (digits.startsWith("84")) return `+${digits}`;
      if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
      return `+84${digits}`;
    }

    function setCooldown(kind, seconds = 60) {
      AUTH_COOLDOWNS[kind] = Date.now() + seconds * 1000;
      const btn = kind === "phone" ? document.getElementById("btn-send-phone-otp") : document.getElementById("btn-login");
      const baseText = kind === "phone" ? "Gửi mã OTP" : "Gửi mã xác thực";
      const timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((AUTH_COOLDOWNS[kind] - Date.now()) / 1000));
        if (!btn) {
          clearInterval(timer);
          return;
        }
        if (left <= 0) {
          btn.disabled = false;
          btn.textContent = baseText;
          clearInterval(timer);
        } else {
          btn.disabled = true;
          btn.textContent = `Gửi lại sau ${left}s`;
        }
      }, 250);
    }

    function getGenericOtpError(error) {
      const message = String(error?.message || "");
      if (/rate|too many|limit/i.test(message)) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
      if (/expired|invalid|token/i.test(message)) return "Mã xác thực không đúng hoặc đã hết hạn.";
      return "Không thể xác thực lúc này. Vui lòng thử lại.";
    }

    async function handleLogin() {
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password")?.value.trim() || "";
      if (!email) {
        toast("Vui lòng nhập Gmail");
        return;
      }
      if (!password) {
        toast("Vui lòng nhập mật khẩu");
        return;
      }
      if (AUTH_MODE === "register") {
        await handleRegisterWithPassword(email, password);
        return;
      }
      const btn = document.getElementById("btn-login");
      if (btn) btn.disabled = true;
      try {
        const { error } = await db.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast("Đăng nhập thành công");
        await initAuth();
      } catch (error) {
        toast("Đăng nhập thất bại. Vui lòng kiểm tra Gmail hoặc mật khẩu.");
        if (btn) btn.disabled = false;
      }
    }

    async function handleRegisterWithPassword(email, password) {
      const phone = normalizeVietnamPhone(document.getElementById("register-phone")?.value || "");
      if (!phone || !/^\+\d{10,15}$/.test(phone)) {
        toast("Vui lòng nhập số điện thoại hợp lệ.");
        return;
      }
      if (password.length < 6) {
        toast("Mật khẩu cần ít nhất 6 ký tự.");
        return;
      }
      const btn = document.getElementById("btn-login");
      if (btn) btn.disabled = true;
      try {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              auth_provider: "email_password",
              phone,
            },
          },
        });
        if (error) throw error;
        if (data?.session) {
          try {
            await db.rpc("ensure_current_user_profile_and_subscription");
          } catch {}
          toast("Đăng ký thành công");
          await initAuth();
        } else {
          toast("Đã đăng ký. Vui lòng kiểm tra Gmail để xác thực tài khoản.");
          setAuthMode("login");
        }
      } catch (error) {
        toast(error?.message || "Đăng ký thất bại. Vui lòng thử lại.");
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function handleGoogleLogin() {
      if (!window.supabase || !db?.auth) {
        toast("Chưa tải được Supabase Auth. Vui lòng tải lại trang.");
        return;
      }
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        toast("Không thể đăng nhập Google. Vui lòng thử lại.");
      }
    }

    async function sendPhoneOtp() {
      const phone = normalizeVietnamPhone(document.getElementById("login-phone")?.value || "");
      const msg = document.getElementById("phone-auth-message");
      if (!phone || !/^\+\d{10,15}$/.test(phone)) {
        toast("Vui lòng nhập số điện thoại hợp lệ.");
        return;
      }
      if (Date.now() < AUTH_COOLDOWNS.phone) {
        toast("Vui lòng chờ trước khi gửi lại OTP.");
        return;
      }
      const btn = document.getElementById("btn-send-phone-otp");
      if (btn) btn.disabled = true;
      try {
        const { error } = await db.auth.signInWithOtp({ phone });
        if (error) throw error;
        PHONE_OTP_TARGET = phone;
        PHONE_OTP_FAILS = 0;
        document.getElementById("phone-otp-wrap")?.classList.remove("hidden");
        if (msg) msg.textContent = "Đã gửi OTP. Vui lòng kiểm tra tin nhắn.";
        toast("Đã gửi mã OTP.");
        setCooldown("phone", 60);
      } catch (error) {
        toast(getGenericOtpError(error));
        if (btn) btn.disabled = false;
      }
    }

    async function verifyPhoneOtp() {
      const token = document.getElementById("phone-otp-code")?.value.trim() || "";
      if (!PHONE_OTP_TARGET) {
        toast("Vui lòng gửi mã OTP trước.");
        return;
      }
      if (!/^\d{4,8}$/.test(token)) {
        toast("Vui lòng nhập mã OTP hợp lệ.");
        return;
      }
      if (PHONE_OTP_FAILS >= 5) {
        toast("Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại OTP.");
        return;
      }
      const btn = document.getElementById("btn-verify-phone-otp");
      if (btn) btn.disabled = true;
      try {
        const { error } = await db.auth.verifyOtp({
          phone: PHONE_OTP_TARGET,
          token,
          type: "sms",
        });
        if (error) throw error;
        toast("Xác thực thành công");
        await initAuth();
      } catch (error) {
        PHONE_OTP_FAILS += 1;
        toast(getGenericOtpError(error));
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    
    async function handleLogout() {
      await db.auth.signOut();
      location.reload();
    }

    document.addEventListener("DOMContentLoaded", bindPublicAuthControls);

