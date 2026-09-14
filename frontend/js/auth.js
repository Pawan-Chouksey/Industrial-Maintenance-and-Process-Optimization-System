/**
 * auth.js - Streamlined Authentication Controller
 * Clean login & registration workflows for AeroPulse Industrial Cockpit
 */

import {
  POPULAR_COUNTRY_CODES,
  sanitizeInput,
  validateUsername,
  validateEmail,
  validateMobileNumber,
  validatePassword,
  validateConfirmPassword,
  validateLoginIdentifier,
} from './validation.js';
import { loginApi, registerApi } from './api.js';

export class AuthController {
  constructor(app) {
    this.app = app;
    this.showLoginPassword = false;
    this.showRegPassword = false;
    this.showRegConfirmPassword = false;
  }

  init() {
    this.populateCountryCodes();
    this.bindLoginEvents();
    this.bindRegisterEvents();
    this.renderQuickFillButtons();
  }

  // ── Country Codes ────────────────────────────────────────────────────────────
  populateCountryCodes() {
    const select = document.getElementById('register-select-country-code');
    if (!select) return;
    select.innerHTML = '';
    POPULAR_COUNTRY_CODES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.dialCode;
      opt.textContent = `${c.code} (${c.dialCode})`;
      select.appendChild(opt);
    });
    select.value = '+1';
  }

  // ── Login Workflow ──────────────────────────────────────────────────────────
  bindLoginEvents() {
    const form = document.getElementById('login-form');
    const identifierInput = document.getElementById('login-input-identifier');
    const passwordInput = document.getElementById('login-input-password');
    const togglePwdBtn = document.getElementById('login-btn-toggle-password');
    const switchToRegisterBtn = document.getElementById('login-btn-switch-to-register');

    if (identifierInput) {
      identifierInput.addEventListener('input', (e) => {
        this.clearLoginError();
        this.updateLoginIdentifierBadge(e.target.value.trim());
      });
    }

    if (togglePwdBtn && passwordInput) {
      togglePwdBtn.addEventListener('click', () => {
        this.showLoginPassword = !this.showLoginPassword;
        passwordInput.type = this.showLoginPassword ? 'text' : 'password';
      });
    }

    if (switchToRegisterBtn) {
      switchToRegisterBtn.addEventListener('click', () => this.app.setView('register'));
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = identifierInput ? identifierInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        const validation = validateLoginIdentifier(identifier);
        if (!validation.isValid) {
          this.showLoginError(validation.error || 'Please enter a valid username, email, or mobile number.');
          return;
        }

        if (!password || password.length < 8) {
          this.showLoginError('Password must be at least 8 characters.');
          return;
        }

        const submitBtn = document.getElementById('login-btn-submit');
        this.setButtonLoading(submitBtn, true, 'Authenticating...');

        try {
          const res = await loginApi({
            identifier: sanitizeInput(identifier),
            password: password,
          });

          this.app.handleLoginSuccess(res.user, res.access_token);
        } catch (err) {
          this.showLoginError(err.message || 'Login failed. Please check your credentials.');
        } finally {
          this.setButtonLoading(submitBtn, false, 'Sign In');
        }
      });
    }
  }

  updateLoginIdentifierBadge(value) {
    const badge = document.getElementById('login-identifier-badge');
    if (!badge) return;
    const val = validateLoginIdentifier(value);
    if (!value || !val.isValid) {
      badge.textContent = '';
      return;
    }
    if (val.type === 'email') badge.textContent = 'Email format';
    else if (val.type === 'phone') badge.textContent = 'Phone format';
    else badge.textContent = 'Username';
  }

  showLoginError(msg) {
    const banner = document.getElementById('login-general-error-banner');
    const text = document.getElementById('login-general-error-text');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  clearLoginError() {
    const banner = document.getElementById('login-general-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  renderQuickFillButtons() {
    const container = document.getElementById('login-quick-fill-container');
    if (!container) return;
    container.innerHTML = `
      <button type="button" class="px-2.5 py-1 rounded bg-white hover:bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-200 transition cursor-pointer shadow-2xs">
        Fill: alex_rivera (Demo User)
      </button>
    `;
    const btn = container.querySelector('button');
    if (btn) {
      btn.addEventListener('click', () => {
        const idInput = document.getElementById('login-input-identifier');
        const pwInput = document.getElementById('login-input-password');
        if (idInput) {
          idInput.value = 'alex_rivera';
          this.updateLoginIdentifierBadge('alex_rivera');
        }
        if (pwInput) pwInput.value = 'Password123!';
        this.clearLoginError();
      });
    }
  }

  // ── Registration Workflow ───────────────────────────────────────────────────
  bindRegisterEvents() {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('register-input-username');
    const emailInput = document.getElementById('register-input-email');
    const countryCodeSelect = document.getElementById('register-select-country-code');
    const mobileInput = document.getElementById('register-input-mobile');
    const passwordInput = document.getElementById('register-input-password');
    const confirmInput = document.getElementById('register-input-confirm-password');
    const toggleRegPwd = document.getElementById('register-btn-toggle-password');
    const toggleRegConfirm = document.getElementById('register-btn-toggle-confirm-password');
    const switchToLoginBtn = document.getElementById('register-btn-switch-to-login');

    if (toggleRegPwd && passwordInput) {
      toggleRegPwd.addEventListener('click', () => {
        this.showRegPassword = !this.showRegPassword;
        passwordInput.type = this.showRegPassword ? 'text' : 'password';
      });
    }

    if (toggleRegConfirm && confirmInput) {
      toggleRegConfirm.addEventListener('click', () => {
        this.showRegConfirmPassword = !this.showRegConfirmPassword;
        confirmInput.type = this.showRegConfirmPassword ? 'text' : 'password';
      });
    }

    if (switchToLoginBtn) {
      switchToLoginBtn.addEventListener('click', () => this.app.setView('login'));
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput ? usernameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const countryCode = countryCodeSelect ? countryCodeSelect.value : '+1';
        const mobile = mobileInput ? mobileInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const confirm = confirmInput ? confirmInput.value : '';

        // Validation checks
        const uVal = validateUsername(username);
        if (!uVal.isValid) return this.showRegisterError(uVal.error);

        const eVal = validateEmail(email);
        if (!eVal.isValid) return this.showRegisterError(eVal.error);

        const mVal = validateMobileNumber(countryCode, mobile);
        if (!mVal.isValid) return this.showRegisterError(mVal.error);

        const pVal = validatePassword(password);
        if (!pVal.isValid) return this.showRegisterError(pVal.error);

        const cVal = validateConfirmPassword(password, confirm);
        if (!cVal.isValid) return this.showRegisterError(cVal.error);

        const submitBtn = document.getElementById('register-btn-submit');
        this.setButtonLoading(submitBtn, true, 'Creating Account...');

        try {
          await registerApi({
            username: sanitizeInput(username),
            email: sanitizeInput(email),
            password: password,
            mobile: `${countryCode}${mobile}`,
          });

          // Auto-login newly registered user
          const loginRes = await loginApi({
            identifier: username,
            password: password,
          });

          this.app.handleLoginSuccess(loginRes.user, loginRes.access_token);
        } catch (err) {
          this.showRegisterError(err.message || 'Registration failed. Please try again.');
        } finally {
          this.setButtonLoading(submitBtn, false, 'Create Account');
        }
      });
    }
  }

  showRegisterError(msg) {
    const banner = document.getElementById('register-general-error-banner');
    const text = document.getElementById('register-general-error-text');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  clearRegisterError() {
    const banner = document.getElementById('register-general-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  setButtonLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<span>${text}</span>` : `<span>${text}</span>`;
  }
}
