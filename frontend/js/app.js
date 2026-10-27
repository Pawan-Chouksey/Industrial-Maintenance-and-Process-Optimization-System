/**
 * Industrial Maintenance Prognostics — App Orchestrator & Router
 */

const App = (() => {
  let isDashboardInitialized = false;

  function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "nominal") icon = "✅";
    if (type === "warning") icon = "⚠️";
    if (type === "critical") icon = "❌";

    toast.innerHTML = `
      <span style="font-size: 14px;">${icon}</span>
      <div style="flex: 1; color: var(--text-primary);">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "opacity 0.2s, transform 0.2s";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aero_theme", theme);
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.innerHTML = theme === "light" 
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  async function updateApiStatusBadge() {
    const status = await API.checkStatus();
    const badges = document.querySelectorAll(".api-status-badge");
    badges.forEach(b => {
      if (status.online) {
        b.innerHTML = `<span class="status-dot status-dot-nominal"></span> API CONNECTED (${status.url})`;
        b.className = "badge badge-nominal api-status-badge";
      } else {
        b.innerHTML = `<span class="status-dot status-dot-warning"></span> STANDALONE SIMULATOR (NASA FD001)`;
        b.className = "badge badge-warning api-status-badge";
      }
    });
  }

  function showAuthView(tab = "login") {
    const authView = document.getElementById("view-auth");
    const dashView = document.getElementById("view-dashboard");
    if (authView) authView.style.display = "flex";
    if (dashView) dashView.style.display = "none";

    switchAuthTab(tab);
  }

  const PANELS_WITHOUT_CYCLE_SCRUBBER = new Set([
    "panel-batch",
    "panel-copilot",
    "panel-account"
  ]);

  function updateCycleScrubberVisibility(panelId) {
    const scrubberBar = document.getElementById("cycle-scrubber-bar");
    if (!scrubberBar) return;

    if (PANELS_WITHOUT_CYCLE_SCRUBBER.has(panelId)) {
      scrubberBar.style.display = "none";
      if (typeof Dashboard !== "undefined" && typeof Dashboard.pausePlayback === "function") {
        Dashboard.pausePlayback();
      }
    } else {
      scrubberBar.style.display = "block";
    }
  }

  function showDashboardView() {
    const authView = document.getElementById("view-auth");
    const dashView = document.getElementById("view-dashboard");
    if (authView) authView.style.display = "none";
    if (dashView) dashView.style.display = "block";

    // Update user display & account credentials
    updateUserProfileUI();

    // Ensure cycle scrubber visibility matches active panel
    const activePanel = document.querySelector(".cockpit-panel.active");
    updateCycleScrubberVisibility(activePanel ? activePanel.id : "panel-overview");

    if (!isDashboardInitialized) {
      Dashboard.init();
      isDashboardInitialized = true;
    } else {
      Dashboard.refresh();
    }
  }

  async function updateUserProfileUI() {
    let user = Auth.getUser();
    if (!user) {
      const cached = localStorage.getItem("aero_user_profile");
      if (cached) {
        try { user = JSON.parse(cached); } catch (e) {}
      }
    }

    try {
      const remote = await API.getProfile();
      if (remote && remote.username) {
        user = { ...user, ...remote };
      }
    } catch (e) {
      // offline / simulated fallback
    }

    if (!user) {
      user = {
        username: "lead_operator",
        email: "operator@turbofan-prognostics.nasa.gov",
        mobile: "+1 (555) 019-2831",
        id: "usr_sim_001"
      };
    }

    const username = (user.username || "lead_operator").trim();
    const initials = (username.length >= 2 ? username.slice(0, 2) : "OP").toUpperCase();

    // 1. Top Navbar Badge
    const userBadge = document.getElementById("user-profile-badge");
    if (userBadge) {
      userBadge.textContent = username.toUpperCase();
      userBadge.style.cursor = "pointer";
      userBadge.title = "View User Account";
      userBadge.onclick = () => {
        const item = document.querySelector(".sidebar-nav-item[data-target='panel-account']");
        if (item) item.click();
      };
    }

    // 2. Sidebar Footer User Tile
    const sidebarName = document.getElementById("sidebar-user-name");
    if (sidebarName) sidebarName.textContent = username;
    const sidebarAvatar = document.getElementById("sidebar-user-avatar");
    if (sidebarAvatar) sidebarAvatar.textContent = initials;

    // 3. Account Panel Details
    const accCardUsername = document.getElementById("account-card-username");
    if (accCardUsername) accCardUsername.textContent = username.toUpperCase();

    const accAvatar = document.getElementById("account-avatar");
    if (accAvatar) accAvatar.textContent = initials;

    const accId = document.getElementById("account-detail-id");
    if (accId) accId.textContent = user.id || user._id || "usr_sim_001";

    const accUser = document.getElementById("account-detail-username");
    if (accUser) accUser.textContent = username;

    const accEmail = document.getElementById("account-detail-email");
    if (accEmail) accEmail.textContent = user.email || "operator@turbofan-prognostics.nasa.gov";

    const accMobile = document.getElementById("account-detail-mobile");
    if (accMobile) accMobile.textContent = user.mobile || "+1 (555) 019-2831";

    // Active Engine unit name in Account panel
    const accEngine = document.getElementById("account-active-engine");
    if (accEngine && typeof Dashboard !== "undefined" && Dashboard.getCurrentState) {
      const st = Dashboard.getCurrentState();
      accEngine.textContent = st.engine_name || `Engine #${st.engine_id}`;
    }
  }

  function switchAuthTab(tab) {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const formLogin = document.getElementById("form-login-container");
    const formRegister = document.getElementById("form-register-container");

    if (tab === "register") {
      if (tabLogin) tabLogin.classList.remove("active");
      if (tabRegister) tabRegister.classList.add("active");
      if (formLogin) formLogin.style.display = "none";
      if (formRegister) formRegister.style.display = "block";
    } else {
      if (tabLogin) tabLogin.classList.add("active");
      if (tabRegister) tabRegister.classList.remove("active");
      if (formLogin) formLogin.style.display = "block";
      if (formRegister) formRegister.style.display = "none";
    }
  }

  function initAuthForms() {
    // Tab buttons
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    if (tabLogin) tabLogin.addEventListener("click", () => switchAuthTab("login"));
    if (tabRegister) tabRegister.addEventListener("click", () => switchAuthTab("register"));

    // Demo Fill button
    const btnDemo = document.getElementById("btn-fill-demo");
    if (btnDemo) {
      btnDemo.addEventListener("click", () => {
        const idInput = document.getElementById("login-identifier");
        const passInput = document.getElementById("login-password");
        if (idInput) idInput.value = "operator@turbofan-prognostics.nasa.gov";
        if (passInput) passInput.value = "Turbofan2026!";
        showToast("Demo operator credentials pre-filled.", "info");
      });
    }

    // Login Form Submit
    const formLogin = document.getElementById("login-form");
    if (formLogin) {
      formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = document.getElementById("login-identifier").value;
        const password = document.getElementById("login-password").value;
        const btnSubmit = document.getElementById("btn-login-submit");

        try {
          if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Authenticating...";
          }

          const res = await Auth.handleLogin(identifier, password);
          showToast(`Welcome, Operator ${res.user?.username || 'Lead'}!`, "nominal");
          window.location.hash = "#dashboard";
          showDashboardView();
        } catch (err) {
          showToast(err.message, "critical");
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Sign In to Cockpit";
          }
        }
      });
    }

    // Register Form Submit
    const formRegister = document.getElementById("register-form");
    if (formRegister) {
      formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("reg-username").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-confirm-password").value;
        const mobile = document.getElementById("reg-mobile").value;
        const btnSubmit = document.getElementById("btn-register-submit");

        try {
          if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Registering Account...";
          }

          await Auth.handleRegister(username, email, password, confirmPassword, mobile);
          showToast("Account created successfully. Please sign in.", "nominal");
          switchAuthTab("login");
          document.getElementById("login-identifier").value = username;
          document.getElementById("login-password").value = password;
        } catch (err) {
          showToast(err.message, "critical");
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Create Operator Account";
          }
        }
      });
    }
  }

  function attachGlobalShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Don't trigger shortcuts when typing inside form inputs
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }

      // Ignore cycle scrubber shortcuts in menus where the slider is hidden
      const scrubberBar = document.getElementById("cycle-scrubber-bar");
      if (scrubberBar && scrubberBar.style.display === "none") {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        Dashboard.togglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        Dashboard.step(1);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        Dashboard.step(-1);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        Dashboard.step(10);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        Dashboard.step(-10);
      }
    });
  }

  function initSidebar() {
    const sidebar = document.getElementById("cockpit-sidebar");
    const toggleBtns = document.querySelectorAll(".sidebar-toggle-btn");

    // Load saved collapsed state
    const savedState = localStorage.getItem("aero_sidebar_collapsed");
    if (savedState === "true" && sidebar) {
      sidebar.classList.add("collapsed");
    }

    toggleBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle("collapsed");
        localStorage.setItem("aero_sidebar_collapsed", isCollapsed ? "true" : "false");

        // Re-render SVG chart smoothly once layout recalculates
        setTimeout(() => {
          if (Dashboard && typeof Dashboard.renderChart === "function") {
            Dashboard.renderChart();
          }
        }, 220);
      });
    });

    // Panel navigation
    const navItems = document.querySelectorAll(".sidebar-nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        const targetPanelId = item.dataset.target;
        if (!targetPanelId) return;

        // Activate button
        navItems.forEach(n => n.classList.remove("active"));
        item.classList.add("active");

        // Activate panel
        document.querySelectorAll(".cockpit-panel").forEach(p => p.classList.remove("active"));
        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) {
          targetPanel.classList.add("active");
        }

        // Update hash
        history.replaceState(null, null, `#dashboard/${targetPanelId.replace('panel-', '')}`);

        // Update cycle scrubber visibility (hidden in Batch, Copilot, Account)
        updateCycleScrubberVisibility(targetPanelId);

        // Re-render chart if navigating to trajectory or overview
        if (targetPanelId === "panel-trajectory" || targetPanelId === "panel-overview") {
          setTimeout(() => {
            if (Dashboard && typeof Dashboard.renderChart === "function") {
              Dashboard.renderChart();
            }
          }, 50);
        }

        // Update profile details when navigating to account
        if (targetPanelId === "panel-account") {
          updateUserProfileUI();
        }
      });
    });

    // Sidebar footer user tile click
    const sidebarUserTile = document.getElementById("sidebar-user-tile");
    if (sidebarUserTile) {
      sidebarUserTile.addEventListener("click", () => {
        const item = document.querySelector(".sidebar-nav-item[data-target='panel-account']");
        if (item) item.click();
      });
    }

    // Compact sidebar user icon click
    const compactUserBtn = document.getElementById("sidebar-compact-user-btn");
    if (compactUserBtn) {
      compactUserBtn.addEventListener("click", () => {
        const item = document.querySelector(".sidebar-nav-item[data-target='panel-account']");
        if (item) item.click();
      });
    }

    // Refresh account credentials button in panel-account
    const btnRefreshAccount = document.getElementById("btn-refresh-account");
    if (btnRefreshAccount) {
      btnRefreshAccount.addEventListener("click", async () => {
        btnRefreshAccount.disabled = true;
        await updateUserProfileUI();
        btnRefreshAccount.disabled = false;
        showToast("Operator account credentials synchronized.", "nominal");
      });
    }
  }

  // Routing based on hash & session
  function route() {
    const hash = window.location.hash;
    if (Auth.isAuthenticated() && hash !== "#login") {
      showDashboardView();
      if (hash.startsWith("#dashboard/")) {
        const sub = hash.replace("#dashboard/", "");
        const targetItem = document.querySelector(`.sidebar-nav-item[data-target="panel-${sub}"]`);
        if (targetItem) {
          targetItem.click();
        }
      }
    } else {
      showAuthView(hash === "#register" ? "register" : "login");
    }
  }

  return {
    async init() {
      // Theme
      const savedTheme = localStorage.getItem("aero_theme") || "dark";
      applyTheme(savedTheme);

      const themeBtn = document.getElementById("theme-toggle-btn");
      if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

      // Logout buttons
      document.querySelectorAll(".btn-logout").forEach(btn => {
        btn.addEventListener("click", () => Auth.logout());
      });

      initAuthForms();
      initSidebar();
      attachGlobalShortcuts();
      await updateApiStatusBadge();

      // Check route
      route();
      window.addEventListener("hashchange", route);
    },

    showAuthView,
    showDashboardView,
    showToast
  };
})();

// Bootstrap upon DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
