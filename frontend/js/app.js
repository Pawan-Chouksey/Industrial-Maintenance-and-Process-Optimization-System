
/**
 * app.js - Application coordinator and view router
 * Restores the dashboard after page refresh.
 */

import { AuthController } from './auth.js';
import { DashboardController } from './dashboard.js';
import { fetchCurrentUser } from './api.js';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'maintenance_current_user';

class App {
  constructor() {
    this.currentView = 'login';
    this.currentUser = null;
    this.toastTimer = null;

    this.authCtrl = new AuthController(this);
    this.dashCtrl = new DashboardController(this);
  }

  // ----------------------------------------------------------
  // SESSION HELPERS
  // ----------------------------------------------------------

  saveUser(user) {
    if (!user) return;

    this.currentUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      countryCode: user.countryCode || '+1',
      mobileNumber: user.mobileNumber || user.mobile || '',
      registeredAt: user.registeredAt || new Date().toISOString(),
    };

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(this.currentUser)
    );
  }

  getSavedUser() {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('[Auth] Could not read saved user:', error);
      return null;
    }
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser = null;
  }

  // ----------------------------------------------------------
  // INITIALIZATION / SESSION RESTORATION
  // ----------------------------------------------------------

  async init() {
  this.authCtrl.init();
  this.dashCtrl.init();
  this.bindGlobalEvents();

  const token = localStorage.getItem('access_token');
  const savedUser = localStorage.getItem('user_data');

  // Remove the boot screen immediately.
  document.body.classList.remove('app-booting');

  // No saved login: show the login page.
  if (!token) {
    this.setView('login');
    return;
  }

  // Restore the dashboard immediately from cached user data.
  if (savedUser) {
    try {
      this.currentUser = JSON.parse(savedUser);
      this.setView('dashboard');

      // Validate the token in the background.
      this.validateSession(token);
      return;
    } catch (error) {
      console.error('Could not restore saved user:', error);
      localStorage.removeItem('user_data');
    }
  }

  // First reload after this change, or missing cached user.
  // Show the login UI instead of a blank screen while checking.
  this.setView('login');

  try {
    const apiUser = await fetchCurrentUser(token);

    this.currentUser = {
      id: apiUser.id,
      username: apiUser.username,
      email: apiUser.email,
      countryCode: '+1',
      mobileNumber: apiUser.mobile || '',
      registeredAt: new Date().toISOString(),
    };

    localStorage.setItem(
      'user_data',
      JSON.stringify(this.currentUser)
    );

    this.setView('dashboard');
  } catch (error) {
    console.error('Session restore failed:', error);

    if (error.message.startsWith('HTTP 401:')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
    }
  }
}

async validateSession(token) {
  try {
    const apiUser = await fetchCurrentUser(token);

    // Refresh cached user details without interrupting the dashboard.
    this.currentUser = {
      ...this.currentUser,
      id: apiUser.id,
      username: apiUser.username,
      email: apiUser.email,
      mobileNumber: apiUser.mobile || '',
    };

    localStorage.setItem(
      'user_data',
      JSON.stringify(this.currentUser)
    );
  } catch (error) {
    console.error('Background session check failed:', error);

    // Only log out when the backend explicitly rejects the token.
    if (error.message.startsWith('HTTP 401:')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      this.currentUser = null;
      this.setView('login');
    }

    // Network errors and timeouts do not force a logout.
  }
}

  // ----------------------------------------------------------
  // GLOBAL EVENTS
  // ----------------------------------------------------------

  bindGlobalEvents() {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');

    if (tabLogin) {
      tabLogin.addEventListener('click', () => {
        this.setView('login');
      });
    }

    if (tabRegister) {
      tabRegister.addEventListener('click', () => {
        this.setView('register');
      });
    }
  }

  // ----------------------------------------------------------
  // VIEW ROUTER
  // ----------------------------------------------------------

  setView(viewName) {
    this.currentView = viewName;

    const authRoot = document.getElementById('auth-root-container');
    const dashRoot = document.getElementById('dashboard-root-container');

    const authTabs = document.getElementById('auth-tab-navigation');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');

    const loginView = document.getElementById('login-form-container');
    const registerView = document.getElementById('register-form-container');
    const accountView = document.getElementById('account-dashboard-view');
    const complianceFooter = document.getElementById(
      'auth-compliance-footer-card'
    );

    if (viewName === 'dashboard') {
      if (authRoot) authRoot.classList.add('hidden-view');
      if (dashRoot) dashRoot.classList.remove('hidden-view');

      this.dashCtrl.activate();
      return;
    }

    // Show the authentication portal.
    if (dashRoot) dashRoot.classList.add('hidden-view');
    if (authRoot) authRoot.classList.remove('hidden-view');

    this.dashCtrl.deactivate();

    if (viewName === 'login') {
      if (authTabs) authTabs.classList.remove('hidden');

      if (tabLogin) {
        tabLogin.className =
          'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      }

      if (tabRegister) {
        tabRegister.className =
          'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      }

      if (loginView) loginView.classList.remove('hidden');
      if (registerView) registerView.classList.add('hidden');
      if (accountView) accountView.classList.add('hidden');
      if (complianceFooter) complianceFooter.classList.remove('hidden');

    } else if (viewName === 'register') {
      if (authTabs) authTabs.classList.remove('hidden');

      if (tabRegister) {
        tabRegister.className =
          'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      }

      if (tabLogin) {
        tabLogin.className =
          'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      }

      if (loginView) loginView.classList.add('hidden');
      if (registerView) registerView.classList.remove('hidden');
      if (accountView) accountView.classList.add('hidden');
      if (complianceFooter) complianceFooter.classList.remove('hidden');

    } else if (viewName === 'authenticated') {
      if (authTabs) authTabs.classList.add('hidden');
      if (loginView) loginView.classList.add('hidden');
      if (registerView) registerView.classList.add('hidden');
      if (accountView) accountView.classList.remove('hidden');
      if (complianceFooter) complianceFooter.classList.add('hidden');

      if (this.currentUser) {
        this.authCtrl.renderAccountDashboard(this.currentUser);
      }
    }
  }

  // ----------------------------------------------------------
  // LOGIN / REGISTER / LOGOUT
  // ----------------------------------------------------------

  handleLoginSuccess(user, token) {
  this.currentUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    countryCode: '+1',
    mobileNumber: user.mobile || '',
    registeredAt: new Date().toISOString(),
  };

  localStorage.setItem('access_token', token);
  localStorage.setItem(
    'user_data',
    JSON.stringify(this.currentUser)
  );

  this.setView('dashboard');

  this.showNotification(
    `Welcome back, @${user.username}!`,
    'success'
  );
}

  // ----------------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------------

  showNotification(message, type = 'success') {
    const toast = document.getElementById('auth-notification-toast');
    const msgEl = document.getElementById('auth-toast-message');

    if (!toast || !msgEl) return;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    msgEl.textContent = message;

    if (type === 'success') {
      toast.className =
        'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-emerald-200 bg-emerald-50 text-emerald-800 fade-in';
    } else {
      toast.className =
        'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-indigo-200 bg-indigo-50 text-indigo-800 fade-in';
    }

    toast.classList.remove('hidden');

    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 4500);
  }
}

// Start the application when the page is ready.
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});