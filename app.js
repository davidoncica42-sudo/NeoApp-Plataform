(() => {
  "use strict";

  const STORAGE_KEY = "neoapp-demo-v1";
  const STARTING_POINTS = 2450;
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

  let toastTimer;
  let activeFilter = "all";
  const cart = new Map();

  function readDemoState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Number.isSafeInteger(saved.points) && saved.points >= 0 && Array.isArray(saved.activity)) {
        return {
          points: saved.points,
          activity: saved.activity
            .filter((item) => item && typeof item.name === "string" && Number.isSafeInteger(item.cost) && item.cost > 0)
            .slice(0, 8)
            .map((item) => ({ name: item.name.slice(0, 80), cost: item.cost, at: typeof item.at === "string" ? item.at : "Hoy" }))
        };
      }
    } catch (_error) {
      // Storage can be disabled by the browser; the preview still works for this visit.
    }
    return { points: STARTING_POINTS, activity: [] };
  }

  const demoState = readDemoState();

  function saveDemoState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoState));
    } catch (_error) {
      // Keep the in-memory preview usable when storage is unavailable.
    }
  }

  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function displayPoints() {
    const formatted = numberFormat.format(demoState.points);
    ["header-points", "balance-points", "account-points", "account-summary-points"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = formatted;
    });
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

  function createActivityRow(name, cost, at) {
    const row = document.createElement("div");
    row.className = "activity-item";

    const icon = document.createElement("span");
    icon.className = "activity-icon activity-icon-star";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✦";

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `Canjeaste: ${name}`;
    const detail = document.createElement("span");
    detail.textContent = `−${numberFormat.format(cost)} estrellas`;
    copy.append(title, detail);

    const time = document.createElement("time");
    time.textContent = at;
    row.append(icon, copy, time);
    return row;
  }

  function renderActivity() {
    const list = document.getElementById("activity-list");
    const empty = document.getElementById("activity-empty");
    if (!list || !empty) return;
    list.replaceChildren();
    if (demoState.activity.length === 0) {
      const welcome = document.createElement("div");
      welcome.className = "activity-item activity-welcome";
      const icon = document.createElement("span");
      icon.className = "activity-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✦";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "¡Bienvenido a NeoApp!";
      const detail = document.createElement("span");
      detail.textContent = "Tu aventura comienza aquí";
      copy.append(title, detail);
      const time = document.createElement("time");
      time.textContent = "Ahora";
      welcome.append(icon, copy, time);
      list.append(welcome);

      const balance = document.createElement("div");
      balance.className = "activity-item";
      const starIcon = document.createElement("span");
      starIcon.className = "activity-icon activity-icon-star";
      starIcon.setAttribute("aria-hidden", "true");
      starIcon.textContent = "✦";
      const balanceCopy = document.createElement("div");
      const balanceTitle = document.createElement("strong");
      balanceTitle.textContent = "Saldo inicial";
      const balanceDetail = document.createElement("span");
      balanceDetail.textContent = "Estrellas de muestra para explorar";
      balanceCopy.append(balanceTitle, balanceDetail);
      const balanceTime = document.createElement("time");
      balanceTime.textContent = "Hoy";
      balance.append(starIcon, balanceCopy, balanceTime);
      list.append(balance);
      empty.hidden = true;
      return;
    }
    demoState.activity.forEach((entry) => list.append(createActivityRow(entry.name, entry.cost, entry.at)));
    empty.hidden = true;
  }

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

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((filter) => filter.classList.toggle("is-selected", filter === button));
      applyRewardFilters();
    });
  });
  rewardSearch.addEventListener("input", applyRewardFilters);

  document.querySelectorAll(".redeem-button").forEach((button) => {
    button.addEventListener("click", () => {
      const cost = Number(button.dataset.cost);
      const name = button.dataset.name;
      if (!Number.isSafeInteger(cost) || cost <= 0 || !name) return;
      if (demoState.points < cost) {
        showToast("Te faltan estrellas para canjear esta recompensa.");
        return;
      }
      demoState.points -= cost;
      demoState.activity.unshift({ name, cost, at: "Ahora" });
      demoState.activity = demoState.activity.slice(0, 8);
      saveDemoState();
      displayPoints();
      renderActivity();
      showToast(`¡${name} ya es tuyo! (vista previa)`);
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
      const icon = document.createElement("span");
      icon.className = "cart-empty-icon";
      icon.textContent = "◇";
      const title = document.createElement("strong");
      title.textContent = "Tu cesta está en órbita vacía.";
      const detail = document.createElement("span");
      detail.textContent = "Añade algún artículo digital de la tienda.";
      empty.append(icon, title, detail);
      cartItems.append(empty);
      return;
    }

    entries.forEach((item) => {
      const line = document.createElement("div");
      line.className = "cart-line";
      const name = document.createElement("span");
      name.className = "cart-line-name";
      name.textContent = `${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
      const side = document.createElement("span");
      side.className = "cart-line-price";
      side.textContent = euroFormat.format(item.price * item.quantity);
      const remove = document.createElement("button");
      remove.className = "cart-remove";
      remove.type = "button";
      remove.textContent = "Quitar";
      remove.setAttribute("aria-label", `Quitar ${item.title} de la cesta`);
      remove.addEventListener("click", () => {
        cart.delete(item.id);
        renderCart();
      });
      side.append(remove);
      line.append(name, side);
      cartItems.append(line);
    });
  }

  document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", () => {
      const price = Number(button.dataset.price);
      const id = button.dataset.id;
      const title = button.dataset.title;
      if (!id || !title || !Number.isFinite(price) || price <= 0) return;
      const existing = cart.get(id);
      if (existing) existing.quantity += 1;
      else cart.set(id, { id, title, price, quantity: 1 });
      renderCart();
      showToast(`${title} se añadió a tu cesta de muestra.`);
    });
  });

  document.getElementById("open-cart").addEventListener("click", () => cartDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => cartDialog.close()));
  cartDialog.addEventListener("click", (event) => {
    if (event.target === cartDialog) cartDialog.close();
  });
  checkoutButton.addEventListener("click", () => {
    if (!cart.size) return;
    showToast("El pago aún no está conectado; no se realizará ningún cobro.");
  });

  document.getElementById("sign-in-button").addEventListener("click", () => {
    showToast("La conexión de cuentas NeoApp llegará en una siguiente etapa.");
  });

  document.getElementById("year").textContent = String(new Date().getFullYear());
  displayPoints();
  renderActivity();
  renderCart();
  showPage(currentRoute());
})();

