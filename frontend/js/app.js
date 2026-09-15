/**
 * app.js - Application coordinator and view router
 */

import { AuthController } from './auth.js';
import { DashboardController } from './dashboard.js';
import { fetchCurrentUser } from './api.js';

class App {
  constructor() {
    this.currentView = 'login'; // 'login' | 'register' | 'authenticated' | 'dashboard'
    this.currentUser = null;
    this.toastTimer = null;

    this.authCtrl = new AuthController(this);
    this.dashCtrl = new DashboardController(this);
  }

  async init() {
    this.authCtrl.init();
    this.dashCtrl.init();
    this.bindGlobalEvents();

    // Check for existing token
    const token = localStorage.getItem('access_token');
    if (token) {
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
        this.setView('authenticated');
      } catch (e) {
        localStorage.removeItem('access_token');
        this.setView('login');
      }
    } else {
      this.setView('login');
    }
  }

  bindGlobalEvents() {
    // Auth navigation tabs (Sign In / Register)
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');

    if (tabLogin) {
      tabLogin.addEventListener('click', () => this.setView('login'));
    }
    if (tabRegister) {
      tabRegister.addEventListener('click', () => this.setView('register'));
    }
  }

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
    const complianceFooter = document.getElementById('auth-compliance-footer-card');

    if (viewName === 'dashboard') {
      if (authRoot) authRoot.classList.add('hidden-view');
      if (dashRoot) dashRoot.classList.remove('hidden-view');
      this.dashCtrl.activate();
      return;
    }

    // Otherwise in Auth portal
    if (dashRoot) dashRoot.classList.add('hidden-view');
    if (authRoot) authRoot.classList.remove('hidden-view');
    this.dashCtrl.deactivate();

    if (viewName === 'login') {
      if (authTabs) authTabs.classList.remove('hidden');
      if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';

      if (loginView) loginView.classList.remove('hidden');
      if (registerView) registerView.classList.add('hidden');
      if (accountView) accountView.classList.add('hidden');
      if (complianceFooter) complianceFooter.classList.remove('hidden');
    } else if (viewName === 'register') {
      if (authTabs) authTabs.classList.remove('hidden');
      if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';

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

  handleLoginSuccess(user, token) {
    localStorage.setItem('access_token', token);
    this.currentUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      countryCode: '+1',
      mobileNumber: user.mobile || '',
      registeredAt: new Date().toISOString(),
    };

    this.setView('dashboard');
    this.showNotification(`Welcome back, @${user.username}!`, 'success');
  }

  handleRegisterSuccess(user) {
    this.currentUser = user;
    this.setView('authenticated');
    this.showNotification(`Account created successfully for @${user.username}!`, 'success');
  }

  handleLogout() {
    localStorage.removeItem('access_token');
    this.currentUser = null;
    this.setView('login');
    this.showNotification('You have been signed out safely.', 'info');
  }

  showNotification(message, type = 'success') {
    const toast = document.getElementById('auth-notification-toast');
    const msgEl = document.getElementById('auth-toast-message');
    if (!toast || !msgEl) return;

    if (this.toastTimer) clearTimeout(this.toastTimer);

    msgEl.textContent = message;
    if (type === 'success') {
      toast.className = 'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-emerald-200 bg-emerald-50 text-emerald-800 fade-in';
    } else {
      toast.className = 'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-indigo-200 bg-indigo-50 text-indigo-800 fade-in';
    }

    toast.classList.remove('hidden');
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 4500);
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
