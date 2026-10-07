/**
 * Industrial Maintenance Prognostics — Authentication & Session Manager
 */

const Auth = (() => {
  const TOKEN_KEY = "aero_access_token";
  const USER_KEY = "aero_user_profile";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    return !!getToken();
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Form input validation
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateUsername(username) {
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
  }

  function validatePassword(password) {
    return password && password.length >= 8;
  }

  return {
    getToken,
    getUser,
    isAuthenticated,
    setSession,
    clearSession,
    validateEmail,
    validateUsername,
    validatePassword,

    async handleLogin(identifier, password) {
      if (!identifier || !identifier.trim()) {
        throw new Error("Please enter your username or email.");
      }
      if (!password) {
        throw new Error("Please enter your password.");
      }

      const res = await API.login(identifier.trim(), password);
      if (res && res.access_token) {
        setSession(res.access_token, res.user);
        return res;
      }
      throw new Error("Invalid response from authentication server.");
    },

    async handleRegister(username, email, password, confirmPassword, mobile) {
      if (!validateUsername(username)) {
        throw new Error("Username must be 3–30 characters and alphanumeric (letters, numbers, underscores).");
      }
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }
      if (!validatePassword(password)) {
        throw new Error("Password must be at least 8 characters long.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      return await API.register(username.trim(), email.trim(), password, mobile ? mobile.trim() : null);
    },

    logout() {
      clearSession();
      window.location.hash = "#login";
      if (window.App && typeof window.App.showAuthView === "function") {
        window.App.showAuthView();
      }
    }
  };
})();
