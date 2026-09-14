/**
 * app.js - Application Coordinator & View Router
 */

import { AuthController } from './auth.js';
import { DashboardController } from './dashboard.js';
import { fetchCurrentUser } from './api.js';

class App {
  constructor() {
    this.currentView = 'login'; // 'login' | 'register' | 'dashboard'
    this.currentUser = null;
    this.toastTimer = null;

    this.authCtrl = new AuthController(this);
    this.dashCtrl = new DashboardController(this);
  }

  async init() {
    this.authCtrl.init();
    this.dashCtrl.init();
    this.bindGlobalEvents();

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
        };
        this.setView('dashboard');
      } catch (e) {
        localStorage.removeItem('access_token');
        this.setView('login');
      }
    } else {
      this.setView('login');
    }
  }

  bindGlobalEvents() {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');

    if (tabLogin) tabLogin.addEventListener('click', () => this.setView('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => this.setView('register'));
  }

  setView(viewName) {
    this.currentView = viewName;

    const authRoot = document.getElementById('auth-root-container');
    const dashRoot = document.getElementById('dashboard-root-container');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const loginView = document.getElementById('login-form-container');
    const registerView = document.getElementById('register-form-container');

    if (viewName === 'dashboard') {
      if (authRoot) authRoot.classList.add('hidden-view');
      if (dashRoot) dashRoot.classList.remove('hidden-view');
      this.dashCtrl.activate();
      return;
    }

    if (dashRoot) dashRoot.classList.add('hidden-view');
    if (authRoot) authRoot.classList.remove('hidden-view');
    this.dashCtrl.deactivate();

    if (viewName === 'login') {
      if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      if (loginView) loginView.classList.remove('hidden');
      if (registerView) registerView.classList.add('hidden');
    } else if (viewName === 'register') {
      if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer bg-white text-indigo-700 shadow-xs';
      if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      if (loginView) loginView.classList.add('hidden');
      if (registerView) registerView.classList.remove('hidden');
    }
  }

  handleLoginSuccess(user, token) {
    if (token) localStorage.setItem('access_token', token);
    this.currentUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      countryCode: '+1',
      mobileNumber: user.mobile || '',
    };
    this.setView('dashboard');
    this.showNotification(`Welcome back, @${user.username}!`, 'success');
  }

  handleLogout() {
    localStorage.removeItem('access_token');
    this.currentUser = null;
    this.setView('login');
    this.showNotification('Signed out safely.', 'info');
  }

  showNotification(message, type = 'success') {
    const toast = document.getElementById('auth-notification-toast');
    const msgEl = document.getElementById('auth-toast-message');
    if (!toast || !msgEl) return;

    if (this.toastTimer) clearTimeout(this.toastTimer);
    msgEl.textContent = message;
    toast.className = type === 'success'
      ? 'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-emerald-200 bg-emerald-50 text-emerald-800 fade-in'
      : 'mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-xs font-medium shadow-sm border border-indigo-200 bg-indigo-50 text-indigo-800 fade-in';

    toast.classList.remove('hidden');
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
