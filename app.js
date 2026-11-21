(() => {
  "use strict";

  const config = window.NEOAPP_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const supabaseApiKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "");
  const isConfigured = (/^https:\/\//i.test(supabaseUrl) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(supabaseUrl)) && Boolean(supabaseApiKey);
  const SESSION_KEY = "neoapp-auth-session-v1";
  const validPages = new Set(["inicio", "info", "globales", "tienda", "cuenta"]);
  const numberFormat = new Intl.NumberFormat("es-ES");
  const euroFormat = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

  const pages = [...document.querySelectorAll("[data-page-view]")];
  const routeLinks = [...document.querySelectorAll("[data-route]")];
  const nav = document.getElementById("main-nav");
  const menuToggle = document.getElementById("menu-toggle");
  const cartDialog = document.getElementById("cart-dialog");
  const cartCount = document.getElementById("cart-count");
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");
  const checkoutButton = document.getElementById("checkout-button");
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");
  const rewardSearch = document.getElementById("reward-search");
  const rewardEmpty = document.getElementById("reward-empty");
  const authForm = document.getElementById("auth-form");
  const authFeedback = document.getElementById("auth-feedback");
  const authSetupNote = document.getElementById("auth-setup-note");
  const authNameField = document.getElementById("auth-name-field");
  const authSubmit = document.getElementById("auth-submit");

  let toastTimer;
  let activeFilter = "all";
  let authMode = "signin";
  let session = readSession();
  let currentUser = null;
  let accountProfile = null;
  const cart = new Map();

  function readSession() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
      return saved && typeof saved.access_token === "string" && typeof saved.refresh_token === "string" ? saved : null;
    } catch (_error) {
      return null;
    }
  }

  function storeSession(data) {
    if (!data || typeof data.access_token !== "string" || typeof data.refresh_token !== "string") return false;
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
      token_type: data.token_type || "bearer",
    };
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_error) {
      showAuthFeedback("El navegador no permite guardar la sesión. Activa el almacenamiento del sitio y vuelve a entrar.", true);
      return false;
    }
    return true;
  }

  function clearSession() {
    session = null;
    currentUser = null;
    accountProfile = null;
    try { window.localStorage.removeItem(SESSION_KEY); } catch (_error) { /* storage may be disabled */ }
  }

  function apiErrorMessage(payload, status) {
    const message = String(payload?.msg || payload?.message || payload?.error_description || payload?.error || "");
    const normalized = message.toLocaleLowerCase("es");
    if (normalized.includes("invalid login credentials")) return "El correo o la contraseña no coinciden.";
    if (normalized.includes("email not confirmed")) return "Confirma tu correo antes de iniciar sesión.";
    if (normalized.includes("user already registered")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
    if (normalized.includes("password should be at least")) return "La contraseña debe ser más larga.";
    if (normalized.includes("insufficient_points")) return "Aún no tienes estrellas suficientes para ese canje.";
    if (normalized.includes("reward_not_found")) return "Esa recompensa ya no está disponible.";
    if (status === 429) return "Has hecho demasiados intentos. Espera un momento y vuelve a probar.";
    if (status >= 500) return "El servicio de NeoApp no responde ahora. Inténtalo de nuevo más tarde.";
    return message || "No se pudo completar la operación. Revisa tus datos e inténtalo otra vez.";
  }

  async function api(path, options = {}, tokenOverride) {
    if (!isConfigured) throw new Error("El servicio de cuentas aún no está conectado.");
    const token = tokenOverride === undefined ? session?.access_token : tokenOverride;
    const headers = {
      apikey: supabaseApiKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${supabaseUrl}${path}`, { ...options, headers });
    } catch (_error) {
      throw new Error("No se pudo conectar con las cuentas de NeoApp. Comprueba tu conexión.");
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiErrorMessage(payload, response.status));
    return payload;
  }

  async function ensureFreshSession() {
    if (!session) throw new Error("Inicia sesión para continuar.");
    if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return;
    const refreshed = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }, null);
    if (!storeSession(refreshed)) throw new Error("No se pudo guardar tu sesión en este navegador.");
  }

  async function signedApi(path, options = {}) {
    await ensureFreshSession();
    return api(path, options, session.access_token);
  }

  function showAuthFeedback(message, isError = false) {
    authFeedback.textContent = message;
    authFeedback.classList.toggle("is-error", isError);
    authFeedback.classList.toggle("is-success", !isError && Boolean(message));
  }

  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === "signup";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    authNameField.hidden = !isSignup;
    document.getElementById("auth-name").required = isSignup;
    document.getElementById("auth-password").autocomplete = isSignup ? "new-password" : "current-password";
    authSubmit.innerHTML = isSignup ? 'Crear cuenta <svg class="icon"><use href="#i-arrow"/></svg>' : 'Iniciar sesión <svg class="icon"><use href="#i-arrow"/></svg>';
    showAuthFeedback("");
  }

  async function loadAccount() {
    await ensureFreshSession();
    currentUser = await signedApi("/auth/v1/user");
    if (!currentUser?.id) throw new Error("No se pudo validar tu sesión. Inicia sesión de nuevo.");
    const id = encodeURIComponent(currentUser.id);
    const profiles = await signedApi(`/rest/v1/profiles?select=id,display_name,points,last_daily_claim&id=eq.${id}&limit=1`);
    accountProfile = Array.isArray(profiles) ? profiles[0] : null;
    if (!accountProfile) throw new Error("No se encontró tu perfil. La base de datos de NeoApp necesita terminar su configuración.");
    const activity = await signedApi(`/rest/v1/point_transactions?select=amount,reason,created_at&user_id=eq.${id}&order=created_at.desc&limit=8`);
    renderAccount(Array.isArray(activity) ? activity : []);
    document.body.classList.remove("auth-required");
    showAuthFeedback("");
  }

  function formatDate(value) {
    if (!value) return "Ahora";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Reciente" : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date);
  }

  function createActivityRow(entry) {
    const amount = Number(entry.amount);
    const row = document.createElement("div");
    row.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = "activity-icon activity-icon-star";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✦";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = String(entry.reason || "Movimiento de estrellas");
    const detail = document.createElement("span");
    detail.textContent = `${amount > 0 ? "+" : ""}${numberFormat.format(amount)} estrellas`;
    copy.append(title, detail);
    const time = document.createElement("time");
    time.textContent = formatDate(entry.created_at);
    row.append(icon, copy, time);
    return row;
  }

  function renderAccount(activity) {
    const displayName = accountProfile.display_name || currentUser.user_metadata?.display_name || currentUser.email?.split("@")[0] || "Explorador";
    const points = Number(accountProfile.points) || 0;
    const formattedPoints = numberFormat.format(points);
    ["header-points", "balance-points", "account-points", "account-summary-points"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = formattedPoints;
    });
    ["profile-name", "profile-name-title"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = displayName;
    });
    document.getElementById("profile-email").textContent = currentUser.email || "Cuenta NeoApp";
    document.getElementById("profile-avatar").textContent = displayName.trim().slice(0, 1).toLocaleUpperCase("es") || "N";
    const claimedToday = accountProfile.last_daily_claim === new Date().toISOString().slice(0, 10);
    const claimButton = document.getElementById("daily-claim-button");
    claimButton.disabled = claimedToday;
    claimButton.innerHTML = claimedToday ? 'Reclamado hoy <svg class="icon"><use href="#i-check"/></svg>' : 'Reclamar 150 <svg class="icon"><use href="#i-star"/></svg>';
    document.getElementById("daily-claim-status").textContent = claimedToday ? "Ya recibiste tus 150 estrellas de hoy. Vuelve mañana." : "Reclama tus 150 estrellas de hoy.";
    document.getElementById("daily-claim-caption").textContent = claimedToday ? "Siguiente reclamo mañana." : "Disponible una vez cada día.";
    const list = document.getElementById("activity-list");
    const empty = document.getElementById("activity-empty");
    list.replaceChildren(...activity.map(createActivityRow));
    empty.hidden = activity.length !== 0;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const displayName = document.getElementById("auth-name").value.trim();
    if (!isConfigured) {
      showAuthFeedback("El acceso seguro todavía no está conectado. Falta configurar el proyecto de cuentas de NeoApp.", true);
      return;
    }
    authSubmit.disabled = true;
    showAuthFeedback(authMode === "signup" ? "Creando tu cuenta…" : "Iniciando sesión…");
    try {
      const result = authMode === "signup"
        ? await api(`/auth/v1/signup?redirect_to=${encodeURIComponent(window.location.href.split("#")[0])}`, { method: "POST", body: JSON.stringify({ email, password, data: { display_name: displayName } }) }, null)
        : await api("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }, null);
      const resultSession = result?.session || result;
      if (!resultSession?.access_token || !resultSession?.refresh_token) {
        if (authMode === "signup" && result?.user?.id) {
          showAuthFeedback("Revisa tu correo y confirma la cuenta. Después podrás iniciar sesión.");
          return;
        }
        throw new Error("El servicio no devolvió una sesión válida. Inténtalo otra vez.");
      }
      if (!storeSession(resultSession)) return;
      if (!session) {
        showAuthFeedback("Revisa tu correo y confirma la cuenta. Después podrás iniciar sesión.");
        return;
      }
      await loadAccount();
      showPage(currentRoute());
    } catch (error) {
      showAuthFeedback(error instanceof Error ? error.message : "No se pudo acceder a NeoApp.", true);
    } finally {
      authSubmit.disabled = false;
    }
  }

  function currentRoute() {
    const route = window.location.hash.slice(1);
    return validPages.has(route) ? route : "inicio";
  }

  function showPage(route, updateHash = false) {
    const pageName = validPages.has(route) ? route : "inicio";
    pages.forEach((page) => {
      const isCurrent = page.dataset.pageView === pageName;
      page.hidden = !isCurrent;
      page.classList.toggle("is-visible", isCurrent);
    });
    routeLinks.forEach((link) => {
      const isCurrent = link.dataset.route === pageName;
      if (link.classList.contains("nav-link")) {
        link.classList.toggle("is-active", isCurrent);
        if (isCurrent) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    });
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menú");
    if (updateHash && window.location.hash !== `#${pageName}`) window.history.pushState(null, "", `#${pageName}`);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  routeLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = link.dataset.route;
      if (!validPages.has(route)) return;
      event.preventDefault();
      showPage(route, true);
    });
  });
  window.addEventListener("hashchange", () => showPage(currentRoute()));
  window.addEventListener("popstate", () => showPage(currentRoute()));

  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });

  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
  authForm.addEventListener("submit", (event) => void submitAuth(event));
  document.getElementById("daily-claim-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    try {
      const result = await signedApi("/rest/v1/rpc/claim_daily_points", { method: "POST", body: "{}" });
      const claim = Array.isArray(result) ? result[0] : result;
      await loadAccount();
      showToast(claim?.claimed ? "¡150 estrellas añadidas a tu cuenta!" : "Ya reclamaste tus estrellas de hoy.");
    } catch (error) {
      button.disabled = false;
      showToast(error instanceof Error ? error.message : "No se pudo reclamar la recompensa diaria.");
    }
  });

  document.getElementById("account-refresh-button").addEventListener("click", async () => {
    try { await loadAccount(); showToast("Tu cuenta está actualizada."); }
    catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar la cuenta."); }
  });
  document.getElementById("signout-button").addEventListener("click", async () => {
    try { if (session) await signedApi("/auth/v1/logout", { method: "POST" }); }
    catch (_error) { /* clear the local session even if the service is offline */ }
    clearSession();
    document.body.classList.add("auth-required");
    setAuthMode("signin");
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((filter) => filter.classList.toggle("is-selected", filter === button));
      applyRewardFilters();
    });
  });
  rewardSearch.addEventListener("input", applyRewardFilters);

  function applyRewardFilters() {
    const searchTerm = rewardSearch.value.trim().toLocaleLowerCase("es");
    const cards = [...document.querySelectorAll(".reward-card")];
    let shown = 0;
    cards.forEach((card) => {
      const categoryMatches = activeFilter === "all" || card.dataset.category === activeFilter;
      const searchMatches = !searchTerm || `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase("es").includes(searchTerm);
      const visible = categoryMatches && searchMatches;
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    rewardEmpty.hidden = shown !== 0;
  }

  document.querySelectorAll(".redeem-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const rewardId = button.dataset.rewardId;
      if (!rewardId || button.disabled) return;
      button.disabled = true;
      try {
        const result = await signedApi("/rest/v1/rpc/redeem_reward", { method: "POST", body: JSON.stringify({ p_reward_id: rewardId }) });
        const redemption = Array.isArray(result) ? result[0] : result;
        await loadAccount();
        showToast(`¡${redemption?.reward_name || "Recompensa"} canjeada!`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo canjear esta recompensa.");
      } finally {
        button.disabled = false;
      }
    });
  });

  function renderCart() {
    const entries = [...cart.values()];
    const quantity = entries.reduce((sum, item) => sum + item.quantity, 0);
    const total = entries.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartCount.textContent = String(quantity);
    cartTotal.textContent = euroFormat.format(total);
    checkoutButton.disabled = entries.length === 0;
    cartItems.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cart-empty";
      const icon = document.createElement("span"); icon.className = "cart-empty-icon"; icon.textContent = "◇";
      const title = document.createElement("strong"); title.textContent = "Tu cesta está en órbita vacía.";
      const detail = document.createElement("span"); detail.textContent = "Añade algún artículo digital de la tienda.";
      empty.append(icon, title, detail); cartItems.append(empty); return;
    }
    entries.forEach((item) => {
      const line = document.createElement("div"); line.className = "cart-line";
      const name = document.createElement("span"); name.className = "cart-line-name"; name.textContent = `${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
      const side = document.createElement("span"); side.className = "cart-line-price"; side.textContent = euroFormat.format(item.price * item.quantity);
      const remove = document.createElement("button"); remove.className = "cart-remove"; remove.type = "button"; remove.textContent = "Quitar";
      remove.setAttribute("aria-label", `Quitar ${item.title} de la cesta`);
      remove.addEventListener("click", () => { cart.delete(item.id); renderCart(); });
      side.append(remove); line.append(name, side); cartItems.append(line);
    });
  }

  document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", () => {
      const price = Number(button.dataset.price); const id = button.dataset.id; const title = button.dataset.title;
      if (!id || !title || !Number.isFinite(price) || price <= 0) return;
      const existing = cart.get(id);
      if (existing) existing.quantity += 1;
      else cart.set(id, { id, title, price, quantity: 1 });
      renderCart(); showToast(`${title} se añadió a tu cesta de muestra.`);
    });
  });

  document.getElementById("open-cart").addEventListener("click", () => cartDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => cartDialog.close()));
  cartDialog.addEventListener("click", (event) => { if (event.target === cartDialog) cartDialog.close(); });
  checkoutButton.addEventListener("click", () => { if (cart.size) showToast("El pago aún no está conectado; no se realizará ningún cobro."); });

  function initializeAuth() {
    authSetupNote.hidden = isConfigured;
    document.getElementById("year").textContent = String(new Date().getFullYear());
    renderCart();
    showPage(currentRoute());
    if (!session) {
      document.body.classList.add("auth-required");
      return;
    }
    loadAccount().catch((error) => {
      clearSession();
      document.body.classList.add("auth-required");
      showAuthFeedback(error instanceof Error ? error.message : "Inicia sesión para continuar.", true);
    });
  }

  initializeAuth();
})();

