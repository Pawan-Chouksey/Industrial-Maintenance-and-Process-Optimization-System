/**
 * auth.js - Authentication portal controller
 */

import {
  POPULAR_COUNTRY_CODES,
  sanitizeInput,
  validateUsername,
  validateEmail,
  validateMobileNumber,
  analyzePassword,
  validatePassword,
  validateConfirmPassword,
  validateLoginIdentifier,
} from './validation.js';
import { loginApi, registerApi } from './api.js';

export class AuthController {
  constructor(app) {
    this.app = app;
    this.registeredUsers = [
      {
        id: 'usr_default_01',
        username: 'alex_rivera',
        email: 'alex.rivera@example.com',
        countryCode: '+1',
        mobileNumber: '5551234567',
        registeredAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ];

    this.showLoginPassword = false;
    this.showRegPassword = false;
    this.showRegConfirmPassword = false;

    this.forgotResetMethod = 'email'; // 'email' | 'phone'
    this.forgotIsSent = false;
  }

  init() {
    this.populateCountryCodes();
    this.bindLoginEvents();
    this.bindRegisterEvents();
    this.bindForgotPasswordEvents();
    this.bindAccountEvents();
    this.renderQuickFillButtons();
  }

  // ── Country Codes Dropdown ───────────────────────────────────────────────────
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

  // ── Login Form Handling ─────────────────────────────────────────────────────
  bindLoginEvents() {
    const form = document.getElementById('login-form');
    const identifierInput = document.getElementById('login-input-identifier');
    const passwordInput = document.getElementById('login-input-password');
    const togglePwdBtn = document.getElementById('login-btn-toggle-password');
    const forgotBtn = document.getElementById('login-btn-forgot-password');
    const switchToRegisterBtn = document.getElementById('login-btn-switch-to-register');

    if (identifierInput) {
      identifierInput.addEventListener('input', (e) => {
        this.clearLoginError();
        this.updateLoginIdentifierBadge(e.target.value);
      });
      identifierInput.addEventListener('blur', (e) => {
        const check = validateLoginIdentifier(e.target.value);
        const errEl = document.getElementById('login-identifier-error');
        if (!check.isValid && e.target.value.trim().length > 0) {
          errEl.textContent = check.error;
          errEl.classList.remove('hidden');
          identifierInput.classList.add('border-rose-400', 'focus:border-rose-500');
        } else {
          errEl.classList.add('hidden');
          identifierInput.classList.remove('border-rose-400', 'focus:border-rose-500');
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        this.clearLoginError();
        const errEl = document.getElementById('login-password-error');
        if (passwordInput.value.length > 0) {
          errEl.classList.add('hidden');
          passwordInput.classList.remove('border-rose-400');
        }
      });
    }

    if (togglePwdBtn && passwordInput) {
      togglePwdBtn.addEventListener('click', () => {
        this.showLoginPassword = !this.showLoginPassword;
        passwordInput.type = this.showLoginPassword ? 'text' : 'password';
        togglePwdBtn.innerHTML = this.showLoginPassword ? this.getEyeOffSvg() : this.getEyeSvg();
      });
    }

    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => this.openForgotPasswordModal());
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

        if (!password) {
          this.showLoginError('Please enter your account password.');
          return;
        }

        if (password.length < 8) {
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
    const iconContainer = document.getElementById('login-identifier-icon-container');
    if (!badge || !iconContainer) return;

    const val = validateLoginIdentifier(value);
    if (!value || !val.isValid) {
      badge.textContent = '';
      iconContainer.innerHTML = this.getUserSvg();
      return;
    }

    if (val.type === 'email') {
      badge.textContent = 'Email recognized';
      iconContainer.innerHTML = this.getMailSvg();
    } else if (val.type === 'phone') {
      badge.textContent = 'Phone recognized';
      iconContainer.innerHTML = this.getPhoneSvg();
    } else {
      badge.textContent = 'Username format';
      iconContainer.innerHTML = this.getUserSvg();
    }
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
    container.innerHTML = '';
    this.registeredUsers.slice(0, 2).forEach((user) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer';
      btn.innerHTML = `
        <svg class="w-3 h-3 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-1.5 1.5L14 9m-4 4l-4 4-2-2 2-2 4-4m1.5-1.5L14 5l2-2"/>
          <circle cx="7.5" cy="15.5" r="5.5"/>
        </svg>
        <span>${user.username}</span>
      `;
      btn.addEventListener('click', () => {
        const idInput = document.getElementById('login-input-identifier');
        const pwdInput = document.getElementById('login-input-password');
        if (idInput) idInput.value = user.username;
        if (pwdInput) pwdInput.value = 'Password123!';
        this.clearLoginError();
        this.updateLoginIdentifierBadge(user.username);
      });
      container.appendChild(btn);
    });
  }

  // ── Register Form Handling ──────────────────────────────────────────────────
  bindRegisterEvents() {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('register-input-username');
    const emailInput = document.getElementById('register-input-email');
    const phoneInput = document.getElementById('register-input-phone');
    const countrySelect = document.getElementById('register-select-country-code');
    const passwordInput = document.getElementById('register-input-password');
    const confirmInput = document.getElementById('register-input-confirm-password');
    const termsCheck = document.getElementById('register-checkbox-terms');
    const togglePwdBtn = document.getElementById('register-btn-toggle-password');
    const toggleConfBtn = document.getElementById('register-btn-toggle-confirm-password');
    const switchToLoginBtn = document.getElementById('register-btn-switch-to-login');

    if (switchToLoginBtn) {
      switchToLoginBtn.addEventListener('click', () => this.app.setView('login'));
    }

    if (usernameInput) {
      usernameInput.addEventListener('input', () => {
        this.clearRegisterError();
        const check = validateUsername(usernameInput.value);
        const feedback = document.getElementById('register-username-feedback');
        const badge = document.getElementById('register-username-badge');

        if (usernameInput.value.length > 0) {
          if (check.isValid) {
            badge.classList.remove('hidden');
            feedback.textContent = '3-20 characters; letters, numbers, underscores, and dots.';
            feedback.className = 'text-xs text-slate-500';
            usernameInput.className = usernameInput.className.replace(/border-rose-\d+/g, 'border-emerald-400');
          } else {
            badge.classList.add('hidden');
            feedback.textContent = check.error;
            feedback.className = 'text-xs text-rose-600';
            usernameInput.className = usernameInput.className.replace(/border-emerald-\d+/g, 'border-rose-400');
          }
        } else {
          badge.classList.add('hidden');
          feedback.textContent = '3-20 characters; letters, numbers, underscores, and dots.';
          feedback.className = 'text-xs text-slate-500';
          usernameInput.classList.remove('border-rose-400', 'border-emerald-400');
        }
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', () => {
        this.clearRegisterError();
        const check = validateEmail(emailInput.value);
        const feedback = document.getElementById('register-email-feedback');
        const badge = document.getElementById('register-email-badge');

        if (emailInput.value.length > 0) {
          if (check.isValid) {
            badge.classList.remove('hidden');
            feedback.classList.add('hidden');
            emailInput.className = emailInput.className.replace(/border-rose-\d+/g, 'border-emerald-400');
          } else {
            badge.classList.add('hidden');
            feedback.textContent = check.error;
            feedback.classList.remove('hidden');
            emailInput.className = emailInput.className.replace(/border-emerald-\d+/g, 'border-rose-400');
          }
        } else {
          badge.classList.add('hidden');
          feedback.classList.add('hidden');
          emailInput.classList.remove('border-rose-400', 'border-emerald-400');
        }
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        this.clearRegisterError();
        phoneInput.value = phoneInput.value.replace(/[^\d\s-]/g, '');
        const dialCode = countrySelect ? countrySelect.value : '+1';
        const check = validateMobileNumber(phoneInput.value, dialCode);
        const feedback = document.getElementById('register-phone-feedback');
        const badge = document.getElementById('register-phone-badge');

        if (phoneInput.value.length > 0) {
          if (check.isValid) {
            badge.classList.remove('hidden');
            feedback.textContent = 'Valid phone format';
            feedback.className = 'text-xs text-emerald-600';
            phoneInput.className = phoneInput.className.replace(/border-rose-\d+/g, 'border-emerald-400');
          } else {
            badge.classList.add('hidden');
            feedback.textContent = check.error;
            feedback.className = 'text-xs text-rose-600';
            phoneInput.className = phoneInput.className.replace(/border-emerald-\d+/g, 'border-rose-400');
          }
        } else {
          badge.classList.add('hidden');
          feedback.textContent = `Sample layout: ${dialCode} (555) 000-0000`;
          feedback.className = 'text-xs text-slate-500';
          phoneInput.classList.remove('border-rose-400', 'border-emerald-400');
        }
      });
    }

    if (countrySelect && phoneInput) {
      countrySelect.addEventListener('change', () => {
        const found = POPULAR_COUNTRY_CODES.find((c) => c.dialCode === countrySelect.value);
        if (found) {
          phoneInput.placeholder = found.format;
          const feedback = document.getElementById('register-phone-feedback');
          if (feedback && !phoneInput.value) {
            feedback.textContent = `Sample layout: ${found.dialCode} ${found.format}`;
          }
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        this.clearRegisterError();
        this.updatePasswordStrength(passwordInput.value);
        if (confirmInput && confirmInput.value) {
          this.checkConfirmPasswordMatch(passwordInput.value, confirmInput.value);
        }
      });
    }

    if (confirmInput) {
      confirmInput.addEventListener('input', () => {
        this.clearRegisterError();
        if (passwordInput) {
          this.checkConfirmPasswordMatch(passwordInput.value, confirmInput.value);
        }
      });
    }

    if (togglePwdBtn && passwordInput) {
      togglePwdBtn.addEventListener('click', () => {
        this.showRegPassword = !this.showRegPassword;
        passwordInput.type = this.showRegPassword ? 'text' : 'password';
        togglePwdBtn.innerHTML = this.showRegPassword ? this.getEyeOffSvg() : this.getEyeSvg();
      });
    }

    if (toggleConfBtn && confirmInput) {
      toggleConfBtn.addEventListener('click', () => {
        this.showRegConfirmPassword = !this.showRegConfirmPassword;
        confirmInput.type = this.showRegConfirmPassword ? 'text' : 'password';
        toggleConfBtn.innerHTML = this.showRegConfirmPassword ? this.getEyeOffSvg() : this.getEyeSvg();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput ? usernameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const dialCode = countrySelect ? countrySelect.value : '+1';
        const mobile = phoneInput ? phoneInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmInput ? confirmInput.value : '';
        const agree = termsCheck ? termsCheck.checked : false;

        const uVal = validateUsername(username);
        if (!uVal.isValid) {
          this.showRegisterError(uVal.error || 'Invalid username.');
          return;
        }

        const eVal = validateEmail(email);
        if (!eVal.isValid) {
          this.showRegisterError(eVal.error || 'Invalid email address.');
          return;
        }

        const mVal = validateMobileNumber(mobile, dialCode);
        if (!mVal.isValid) {
          this.showRegisterError(mVal.error || 'Invalid mobile number.');
          return;
        }

        const pVal = validatePassword(password);
        if (!pVal.isValid) {
          this.showRegisterError(pVal.error || 'Password does not meet requirements.');
          return;
        }

        const cVal = validateConfirmPassword(password, confirmPassword);
        if (!cVal.isValid) {
          this.showRegisterError(cVal.error || 'Passwords do not match.');
          return;
        }

        if (!agree) {
          this.showRegisterError('You must agree to the Terms of Service and Privacy Policy.');
          return;
        }

        const submitBtn = document.getElementById('register-btn-submit');
        this.setButtonLoading(submitBtn, true, 'Validating & Creating Account...');

        try {
          const cleanUser = sanitizeInput(username);
          const cleanMail = sanitizeInput(email).toLowerCase();
          const cleanPhone = mVal.cleanNumber;

          await registerApi({
            username: cleanUser,
            email: cleanMail,
            password: password,
            mobile: cleanPhone,
          });

          const newUser = {
            id: `usr_${Date.now()}`,
            username: cleanUser,
            email: cleanMail,
            countryCode: mVal.dialCode || dialCode,
            mobileNumber: cleanPhone,
            registeredAt: new Date().toISOString(),
          };

          this.registeredUsers.unshift(newUser);
          this.renderQuickFillButtons();
          this.app.handleRegisterSuccess(newUser);
        } catch (err) {
          this.showRegisterError(err.message || 'Registration failed. Please try again.');
        } finally {
          this.setButtonLoading(submitBtn, false, 'Create Account');
        }
      });
    }
  }

  updatePasswordStrength(pwd) {
    const meter = document.getElementById('register-password-meter');
    const label = document.getElementById('register-password-strength-label');
    if (!meter || !label) return;

    if (!pwd) {
      meter.classList.add('hidden');
      label.classList.add('hidden');
      return;
    }

    meter.classList.remove('hidden');
    label.classList.remove('hidden');

    const analysis = analyzePassword(pwd);
    label.textContent = `Strength: ${analysis.label}`;

    let labelColor = 'text-rose-600';
    if (analysis.score >= 3) labelColor = 'text-emerald-600';
    else if (analysis.score === 2) labelColor = 'text-amber-600';
    label.className = `text-xs font-semibold ${labelColor}`;

    // Update 4 progress bars
    for (let i = 1; i <= 4; i++) {
      const bar = document.getElementById(`pwd-meter-bar-${i}`);
      if (bar) {
        if (analysis.score >= i) {
          bar.className = `h-1.5 rounded-full transition-all duration-300 ${analysis.color}`;
        } else {
          bar.className = 'h-1.5 rounded-full transition-all duration-300 bg-slate-200';
        }
      }
    }

    // Update 4 checklist items
    this.updateChecklistItem('pwd-check-len', analysis.hasMinLength);
    this.updateChecklistItem('pwd-check-upper', analysis.hasUppercase);
    this.updateChecklistItem('pwd-check-lower', analysis.hasLowercase);
    this.updateChecklistItem('pwd-check-num-sym', analysis.hasNumber && analysis.hasSpecialChar);
  }

  updateChecklistItem(id, passed) {
    const el = document.getElementById(id);
    if (!el) return;
    const badge = el.querySelector('.pwd-check-badge');
    if (badge) {
      if (passed) {
        badge.className = 'pwd-check-badge w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] bg-emerald-100 text-emerald-700 font-bold';
      } else {
        badge.className = 'pwd-check-badge w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] bg-slate-200 text-slate-400';
      }
    }
  }

  checkConfirmPasswordMatch(pwd, confirm) {
    const matchBadge = document.getElementById('register-confirm-match-badge');
    const feedback = document.getElementById('register-confirm-feedback');
    const input = document.getElementById('register-input-confirm-password');

    const check = validateConfirmPassword(pwd, confirm);
    if (check.isValid) {
      if (matchBadge) matchBadge.classList.remove('hidden');
      if (feedback) feedback.classList.add('hidden');
      if (input) {
        input.classList.remove('border-rose-400');
        input.classList.add('border-emerald-400');
      }
    } else {
      if (matchBadge) matchBadge.classList.add('hidden');
      if (feedback) {
        feedback.textContent = check.error;
        feedback.classList.remove('hidden');
      }
      if (input) {
        input.classList.remove('border-emerald-400');
        input.classList.add('border-rose-400');
      }
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

  // ── Forgot Password Modal ───────────────────────────────────────────────────
  bindForgotPasswordEvents() {
    const backdrop = document.getElementById('forgot-password-backdrop');
    const closeBtn = document.getElementById('forgot-password-btn-close');
    const cancelBtn = document.getElementById('forgot-password-btn-cancel');
    const doneBtn = document.getElementById('forgot-password-btn-done');
    const tabEmail = document.getElementById('forgot-password-tab-email');
    const tabPhone = document.getElementById('forgot-password-tab-phone');
    const form = document.getElementById('forgot-password-form');
    const input = document.getElementById('forgot-password-input');
    const label = document.getElementById('forgot-password-input-label');
    const iconContainer = document.getElementById('forgot-password-input-icon');

    const closeModal = () => {
      if (backdrop) backdrop.classList.add('hidden-view');
      this.forgotIsSent = false;
      if (input) input.value = '';
      this.clearForgotError();
      const formView = document.getElementById('forgot-password-form-view');
      const successView = document.getElementById('forgot-password-success-state');
      if (formView) formView.classList.remove('hidden');
      if (successView) successView.classList.add('hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeModal);

    if (tabEmail && tabPhone && label && input && iconContainer) {
      tabEmail.addEventListener('click', () => {
        this.forgotResetMethod = 'email';
        this.clearForgotError();
        tabEmail.className = 'flex-1 py-1.5 rounded-md text-center transition-all bg-white text-indigo-700 shadow-xs font-semibold cursor-pointer';
        tabPhone.className = 'flex-1 py-1.5 rounded-md text-center transition-all text-slate-600 hover:text-slate-900 cursor-pointer';
        label.textContent = 'Registered Email Address';
        input.type = 'email';
        input.placeholder = 'your.name@example.com';
        iconContainer.innerHTML = this.getMailSvg();
      });

      tabPhone.addEventListener('click', () => {
        this.forgotResetMethod = 'phone';
        this.clearForgotError();
        tabPhone.className = 'flex-1 py-1.5 rounded-md text-center transition-all bg-white text-indigo-700 shadow-xs font-semibold cursor-pointer';
        tabEmail.className = 'flex-1 py-1.5 rounded-md text-center transition-all text-slate-600 hover:text-slate-900 cursor-pointer';
        label.textContent = 'Registered Mobile Number';
        input.type = 'tel';
        input.placeholder = 'e.g. 5551234567';
        iconContainer.innerHTML = this.getPhoneSvg();
      });
    }

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.clearForgotError();
        const val = input.value.trim();

        if (this.forgotResetMethod === 'email') {
          const check = validateEmail(val);
          if (!check.isValid) {
            this.showForgotError(check.error || 'Please enter a valid email.');
            return;
          }
        } else {
          const check = validateMobileNumber(val, '+1');
          if (!check.isValid) {
            this.showForgotError(check.error || 'Please enter a valid phone number.');
            return;
          }
        }

        const formView = document.getElementById('forgot-password-form-view');
        const successView = document.getElementById('forgot-password-success-state');
        const sentTarget = document.getElementById('forgot-password-sent-target');
        if (sentTarget) sentTarget.textContent = val;
        if (formView) formView.classList.add('hidden');
        if (successView) successView.classList.remove('hidden');
      });
    }
  }

  openForgotPasswordModal() {
    const backdrop = document.getElementById('forgot-password-backdrop');
    if (backdrop) backdrop.classList.remove('hidden-view');
  }

  showForgotError(msg) {
    const errorBox = document.getElementById('forgot-password-error');
    const text = document.getElementById('forgot-password-error-text');
    if (errorBox && text) {
      text.textContent = msg;
      errorBox.classList.remove('hidden');
    }
  }

  clearForgotError() {
    const errorBox = document.getElementById('forgot-password-error');
    if (errorBox) errorBox.classList.add('hidden');
  }

  // ── Account Dashboard View ──────────────────────────────────────────────────
  bindAccountEvents() {
    const goToTelemetryBtn = document.getElementById('account-btn-go-to-telemetry');
    const logoutBtn = document.getElementById('account-btn-logout');

    if (goToTelemetryBtn) {
      goToTelemetryBtn.addEventListener('click', () => {
        this.app.setView('dashboard');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.app.handleLogout();
      });
    }
  }

  renderAccountDashboard(user) {
    if (!user) return;
    const initialEl = document.getElementById('dashboard-avatar-initial');
    const usernameEl = document.getElementById('dashboard-user-display-name');
    const valUserEl = document.getElementById('dashboard-val-username');
    const valEmailEl = document.getElementById('dashboard-val-email');
    const valPhoneEl = document.getElementById('dashboard-val-phone');
    const valRegEl = document.getElementById('dashboard-val-registered');

    if (initialEl) initialEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
    if (usernameEl) usernameEl.textContent = `@${user.username}`;
    if (valUserEl) valUserEl.textContent = user.username;
    if (valEmailEl) valEmailEl.textContent = this.maskEmail(user.email || '');
    if (valPhoneEl) valPhoneEl.textContent = this.maskPhone(user.mobileNumber || user.mobile || '', user.countryCode || '+1');
    if (valRegEl) {
      const d = user.registeredAt ? new Date(user.registeredAt) : new Date();
      valRegEl.textContent = `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  maskEmail(email) {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const visibleChars = Math.min(2, name.length);
    return `${name.substring(0, visibleChars)}***@${domain}`;
  }

  maskPhone(phone, code) {
    if (!phone) return `${code} •••• ••0000`;
    if (phone.length <= 4) return `${code} ${phone}`;
    const lastDigits = phone.slice(-4);
    return `${code} •••• ••${lastDigits}`;
  }

  setButtonLoading(btn, isLoading, defaultText) {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `
        <span class="flex items-center gap-2">
          <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          ${defaultText}
        </span>
      `;
    } else {
      btn.innerHTML = `<span>${defaultText}</span>`;
    }
  }

  // ── SVG Helpers ─────────────────────────────────────────────────────────────
  getUserSvg() {
    return `<svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
  getMailSvg() {
    return `<svg class="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  }
  getPhoneSvg() {
    return `<svg class="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  }
  getEyeSvg() {
    return `<svg class="h-4 w-4 text-slate-400 hover:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  getEyeOffSvg() {
    return `<svg class="h-4 w-4 text-slate-400 hover:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
  }
}
