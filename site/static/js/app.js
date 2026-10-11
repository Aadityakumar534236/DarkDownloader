(function () {
  "use strict";

  const storeKey = "darkdownloader.v1";
  const state = loadState();
  let currentAnalysis = null;
  let selectedPreset = state.settings.preset || "best";
  let apiBase = state.settings.apiBase || "";
  let isAnalyzing = false;
  const isStaticExport = document.querySelector('meta[name="dd-static-export"]')?.content === "true";
  const activeControllers = new Map();

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    nav: $("#primaryNav"),
    menuButton: $(".menu-button"),
    form: $("#analyzeForm"),
    urlInput: $("#urlInput"),
    urlError: $("#urlError"),
    pasteButton: $("#pasteButton"),
    clearButton: $("#clearButton"),
    resetButton: $("#resetButton"),
    analyzeButton: $("#analyzeButton"),
    analyzeButtonText: $("#analyzeButtonText"),
    resultState: $("#resultState"),
    analysisResult: $("#analysisResult"),
    presetPanel: $("#presetPanel"),
    apiBadge: $("#apiBadge"),
    addToQueue: $("#addToQueue"),
    queueList: $("#queueList"),
    runQueue: $("#runQueue"),
    clearQueue: $("#clearQueue"),
    concurrencyInput: $("#concurrencyInput"),
    dropZone: $("#dropZone"),
    historyList: $("#historyList"),
    themeToggle: $("#themeToggle"),
    notifyToggle: $("#notifyToggle"),
    apiUrlInput: $("#apiUrlInput"),
    saveSettings: $("#saveSettings"),
    clearSettings: $("#clearSettings"),
    clearHistory: $("#clearHistory"),
    runDiagnostics: $("#runDiagnostics"),
    diagnosticsList: $("#diagnosticsList"),
    batchInput: $("#batchInput"),
    addBatch: $("#addBatch"),
    pasteBatch: $("#pasteBatch"),
    batchMessage: $("#batchMessage"),
    historySearch: $("#historySearch"),
    historyFilter: $("#historyFilter"),
    themePreference: $("#themePreference"),
    defaultPreset: $("#defaultPreset"),
    defaultFormat: $("#defaultFormat"),
    saveApiSettings: $("#saveApiSettings"),
    providersList: $("#providersList"),
    staticApiNotice: $("#staticApiNotice"),
  };

  init();

  function init() {
    document.documentElement.classList.toggle("page-hidden", document.hidden);
    document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("page-hidden", document.hidden));
    document.documentElement.dataset.theme = state.settings.theme || document.documentElement.dataset.theme || "dark";
    if (elements.apiUrlInput) elements.apiUrlInput.value = apiBase;
    if (elements.staticApiNotice) elements.staticApiNotice.hidden = !apiBase || !hasHttpsApiBase();
    if (elements.notifyToggle) elements.notifyToggle.checked = Boolean(state.settings.notifications);
    if (elements.concurrencyInput) elements.concurrencyInput.value = String(Math.max(1, Math.min(state.settings.concurrency || 1, 2)));
    if (elements.themePreference) elements.themePreference.value = state.settings.theme || "dark";
    if (elements.defaultPreset) elements.defaultPreset.value = state.settings.preset || "best";
    if (elements.defaultFormat) elements.defaultFormat.value = state.settings.format || "original";
    selectPreset(selectedPreset, false);
    updateThemeButton();
    bindEvents();
    renderQueue();
    renderHistory();
    if (elements.apiBadge) refreshHealth();
    registerServiceWorker();
  }

  function bindEvents() {
    if (elements.menuButton) elements.menuButton.addEventListener("click", toggleMenu);
    if (elements.nav) elements.nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    document.addEventListener("click", (event) => {
      if (elements.nav && elements.menuButton && !elements.nav.contains(event.target) && !elements.menuButton.contains(event.target)) closeMenu();
    });

    if (elements.form) elements.form.addEventListener("submit", onAnalyze);
    if (elements.pasteButton) elements.pasteButton.addEventListener("click", pasteFromClipboard);
    if (elements.clearButton) elements.clearButton.addEventListener("click", () => {
      elements.urlInput.value = "";
      setError("");
      elements.urlInput.focus();
    });
    if (elements.resetButton) elements.resetButton.addEventListener("click", resetWorkspace);
    document.querySelectorAll(".preset").forEach((button) => {
      button.addEventListener("click", () => selectPreset(button.dataset.preset, true));
    });
    if (elements.addToQueue) elements.addToQueue.addEventListener("click", addCurrentToQueue);
    if (elements.runQueue) elements.runQueue.addEventListener("click", runQueue);
    if (elements.clearQueue) elements.clearQueue.addEventListener("click", () => {
      state.queue = [];
      saveState();
      renderQueue();
    });
    if (elements.dropZone) elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("active");
    });
    if (elements.dropZone) elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("active"));
    if (elements.dropZone) elements.dropZone.addEventListener("drop", onDrop);
    if (elements.themeToggle) elements.themeToggle.addEventListener("click", toggleTheme);
    if (elements.notifyToggle) elements.notifyToggle.addEventListener("change", onNotificationToggle);
    if (elements.saveSettings) elements.saveSettings.addEventListener("click", saveSettings);
    if (elements.clearSettings) elements.clearSettings.addEventListener("click", clearSettings);
    if (elements.clearHistory) elements.clearHistory.addEventListener("click", () => {
      state.history = [];
      saveState();
      renderHistory();
    });
    if (elements.runDiagnostics) elements.runDiagnostics.addEventListener("click", runDiagnostics);
    if (elements.addBatch) elements.addBatch.addEventListener("click", () => {
      const result = addUrlsToQueue(elements.batchInput.value);
      elements.batchMessage.textContent = `${result.added} added · ${result.rejected} invalid · ${result.duplicates} duplicates skipped.`;
      elements.batchMessage.classList.toggle("message-warning", result.rejected > 0);
      elements.batchInput.value = "";
    });
    if (elements.pasteBatch) elements.pasteBatch.addEventListener("click", pasteBatchFromClipboard);
    if (elements.historySearch) elements.historySearch.addEventListener("input", renderHistory);
    if (elements.historyFilter) elements.historyFilter.addEventListener("change", renderHistory);
    if (elements.themePreference) elements.themePreference.addEventListener("change", () => {
      state.settings.theme = elements.themePreference.value;
      document.documentElement.dataset.theme = state.settings.theme;
      saveState(); updateThemeButton();
    });
    if (elements.defaultPreset) elements.defaultPreset.addEventListener("change", () => { state.settings.preset = elements.defaultPreset.value; selectedPreset = state.settings.preset; saveState(); });
    if (elements.defaultFormat) elements.defaultFormat.addEventListener("change", () => { state.settings.format = elements.defaultFormat.value; saveState(); });
    if (elements.saveApiSettings) elements.saveApiSettings.addEventListener("click", saveApiSettings);
    if (elements.providersList) loadProviders();
  }

  async function onAnalyze(event) {
    event.preventDefault();
    if (isAnalyzing) return;

    const url = elements.urlInput.value.trim();
    const valid = validateUrl(url);
    if (!valid.ok) {
      setError(valid.message);
      return;
    }

    setError("");
    setAnalyzeLoading(true);
    showLoading("Checking supported formats...");

    try {
      const data = await apiFetch("/api/v1/analyze", { method: "POST", body: JSON.stringify({ url }) });
      currentAnalysis = data.result;
      renderAnalysis(currentAnalysis);
      recordHistory({ url, provider: currentAnalysis.provider, status: "analyzed", bytes: 0 });
    } catch (error) {
      showError(error.message || "This source is not currently supported.");
      recordHistory({ url, provider: "unknown", status: "failed", bytes: 0 });
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setError("Clipboard API is unavailable. Paste manually with Ctrl+V.");
      return;
    }
    try {
      elements.urlInput.value = await navigator.clipboard.readText();
      setError("");
      elements.urlInput.focus();
    } catch (error) {
      setError("Clipboard permission was denied. Paste manually with Ctrl+V.");
    }
  }

  function validateUrl(url) {
    if (!url) return { ok: false, message: "Enter a URL first." };
    let parsed;
    try { parsed = new URL(url); } catch (error) { return { ok: false, message: "Enter a valid URL." }; }
    if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, message: "Only HTTP and HTTPS URLs are accepted." };
    if (parsed.username || parsed.password) return { ok: false, message: "URLs with embedded credentials are blocked." };
    return { ok: true };
  }

  function renderAnalysis(result) {
    const formats = result.formats || [];
    const caps = result.capabilities || [];
    const download = result.download || { available: false, reason: "No downloadable formats are available through the permitted integration." };
    const subtitleText = result.subtitles && result.subtitles.length ? `${result.subtitles.length} available` : "Unavailable";

    elements.resultState.classList.add("hidden");
    elements.analysisResult.classList.remove("hidden");
    elements.presetPanel.classList.remove("hidden");
    elements.addToQueue.disabled = !formats.length || !download.available;
    elements.addToQueue.textContent = download.available ? "Add to batch queue" : "No permitted download operation";

    elements.analysisResult.innerHTML = `
      <div class="media-summary">
        <div class="media-thumb">${result.thumbnail ? `<img src="${escapeHtml(result.thumbnail)}" alt="">` : "No preview"}</div>
        <div>
          <p class="eyebrow">${escapeHtml(result.source || "Unavailable")}</p>
          <h2 class="media-title">${escapeHtml(result.title || "Unavailable")}</h2>
          <div class="meta-row">
            ${metric("Provider", result.provider || "Unavailable")}
            ${metric("Duration", result.duration || "Unavailable")}
            ${metric("Formats", formats.length ? `${formats.length} verified` : "Unavailable")}
            ${metric("Subtitles", subtitleText)}
          </div>
        </div>
        <span class="status-chip ${download.available ? "ok" : "warn"}">${download.available ? "Download available" : "Download unavailable"}</span>
      </div>
      <p class="notice-text">${escapeHtml(result.notice || download.reason || "")}</p>
      ${formats.length ? `
        <h3>Available formats</h3>
        <div class="format-grid">${formats.map(formatCard).join("")}</div>
      ` : `
        <div class="list-empty">No downloadable formats are available through the permitted integration.</div>
      `}
      <details class="advanced-options">
        <summary>Provider capability details</summary>
        <div class="capability-grid">${caps.map(capCard).join("")}</div>
      </details>
    `;
    updatePresetAvailability(download.available ? formats : []);
  }

  function metric(label, value) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
  }

  function formatCard(format) {
    const bytes = format.bytes ? humanBytes(format.bytes) : "Size unavailable";
    const media = format.video ? "Video and audio" : "Audio only";
    return `<div class="format-card"><span>${escapeHtml(format.container || "Original")}</span><strong>${escapeHtml(format.quality || "Unavailable")}</strong><small>${media} - ${bytes}</small></div>`;
  }

  function capCard(cap) {
    const stateClass = cap.supported ? "ok" : "warn";
    return `<div class="capability-card"><span>${escapeHtml(cap.key)}</span><strong class="status-chip ${stateClass}">${cap.supported ? "Supported" : "Unavailable"}</strong><small>${escapeHtml(cap.note || "")}</small></div>`;
  }

  function updatePresetAvailability(formats) {
    const hasFormats = formats.length > 0;
    const hasAudioOnly = formats.some((item) => item.audio && !item.video);
    document.querySelectorAll(".preset").forEach((button) => {
      const key = button.dataset.preset;
      const enabled = hasFormats && (key !== "audio" || hasAudioOnly);
      button.disabled = !enabled;
      button.classList.toggle("active", enabled && key === selectedPreset);
      button.title = enabled ? "" : "Unavailable for the analyzed source.";
    });
  }

  function selectPreset(preset, persist) {
    selectedPreset = preset;
    if (persist) {
      state.settings.preset = preset;
      saveState();
    }
    document.querySelectorAll(".preset").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === preset && !button.disabled);
    });
  }

  function addCurrentToQueue() {
    const url = elements.urlInput.value.trim();
    const valid = validateUrl(url);
    if (!valid.ok) { setError(valid.message); return; }
    if (state.queue.some((job) => job.url === url)) { setError("That URL is already queued."); return; }
    if (state.queue.length >= 25) { setError("Queue limit reached."); return; }
    state.queue.push({ id: crypto.randomUUID(), url, preset: selectedPreset, status: "queued", error: "" });
    saveState();
    renderQueue();
    setError("");
    location.href = "/batch";
  }

  async function runQueue() {
    const concurrency = Math.max(1, Math.min(Number(elements.concurrencyInput.value) || 1, 2));
    state.settings.concurrency = concurrency;
    saveState();
    const pending = state.queue.filter((job) => ["queued", "failed"].includes(job.status));
    if (!pending.length) return;

    elements.runQueue.disabled = true;
    elements.runQueue.textContent = "Running...";
    const workers = Array.from({ length: concurrency }, async () => {
      while (pending.length) {
        const job = pending.shift();
        if (!job || !["queued", "failed"].includes(job.status)) continue;
        await runQueueJob(job);
      }
    });
    await Promise.all(workers);
    elements.runQueue.disabled = false;
    elements.runQueue.textContent = "Run queue";
    renderQueue();
  }

  async function runQueueJob(job) {
    job.status = "analyzing";
    job.error = "";
    const controller = new AbortController();
    activeControllers.set(job.id, controller);
    renderQueue();
    try {
      const data = await apiFetch("/api/v1/jobs", { method: "POST", body: JSON.stringify({ url: job.url, preset: job.preset }), signal: controller.signal });
      job.serverId = data.job.id;
      job.status = data.job.status === "ready" && !data.job.downloadAvailable ? "analyzed" : data.job.status;
      job.error = data.job.error || (data.job.downloadAvailable ? "" : "Analysis only; no media download is enabled.");
      job.progressKnown = data.job.progressKnown;
      job.bytesTransferred = data.job.bytesTransferred || 0;
      job.totalBytes = data.job.totalBytes || 0;
      recordHistory({ url: job.url, provider: data.job.provider, status: job.status, bytes: data.job.bytesTransferred || 0 });
    } catch (error) {
      if (error.name === "AbortError") {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.error = error.message || "The connection timed out. Try again.";
        recordHistory({ url: job.url, provider: "unknown", status: "failed", bytes: 0 });
      }
    } finally {
      activeControllers.delete(job.id);
    }
    saveState();
    renderQueue();
  }

  function renderQueue() {
    if (!elements.queueList) return;
    if (!state.queue.length) {
      elements.queueList.className = "list-empty";
      elements.queueList.textContent = "No queued jobs.";
      return;
    }
    elements.queueList.className = "";
    elements.queueList.innerHTML = state.queue.map((job) => `
      <div class="job-row">
        <div>
          <span class="status-chip ${statusTone(job.status)}">${escapeHtml(job.status)}</span>
          <div class="url-text">${escapeHtml(job.url)}</div>
          ${progressMarkup(job)}
          ${job.error ? `<small class="url-text">${escapeHtml(job.error)}</small>` : ""}
        </div>
        <div class="row-actions">
          ${job.status === "failed" ? `<button class="secondary-action" data-retry="${job.id}" type="button">Retry</button>` : ""}
          ${["queued", "analyzing"].includes(job.status) ? `<button class="secondary-action" data-cancel="${job.id}" type="button">Cancel</button>` : ""}
          <button class="text-action" data-remove="${job.id}" type="button">Remove</button>
        </div>
      </div>
    `).join("");
    elements.queueList.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        state.queue = state.queue.filter((job) => job.id !== button.dataset.remove);
        saveState();
        renderQueue();
      });
    });
    elements.queueList.querySelectorAll("[data-retry]").forEach((button) => button.addEventListener("click", () => {
      const job = state.queue.find((item) => item.id === button.dataset.retry);
      if (job) { job.status = "queued"; job.error = ""; saveState(); renderQueue(); }
    }));
    elements.queueList.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", async () => {
      const job = state.queue.find((item) => item.id === button.dataset.cancel);
      if (!job) return;
      const controller = activeControllers.get(job.id);
      if (controller) controller.abort();
      if (job.serverId) {
        try { await apiFetch(`/api/v1/jobs/${encodeURIComponent(job.serverId)}/cancel`, { method: "POST", body: "{}" }); } catch (_) {}
      }
      job.status = "cancelled"; saveState(); renderQueue();
    }));
  }

  function progressMarkup(job) {
    if (job.progressKnown && job.totalBytes) {
      const value = Math.min(100, Math.round((job.bytesTransferred / job.totalBytes) * 100));
      return `<div class="progress-bar" aria-label="Progress"><span style="width:${value}%"></span></div><small>${value}%</small>`;
    }
    if (job.status === "analyzing" || job.status === "downloading") {
      return `<div class="progress-bar indeterminate" aria-label="Progress unknown"><span></span></div><small>Progress total unavailable</small>`;
    }
    return "";
  }

  function statusTone(status) {
    if (["ready", "completed", "analyzed"].includes(status)) return "ok";
    if (["failed", "cancelled"].includes(status)) return "error";
    return "warn";
  }

  function renderHistory() {
    if (!elements.historyList) return;
    const total = state.history.length;
    const completed = state.history.filter((item) => item.status === "completed" || item.status === "ready" || item.status === "analyzed").length;
    const failed = state.history.filter((item) => item.status === "failed").length;
    const bytes = state.history.reduce((sum, item) => sum + (item.bytes || 0), 0);
    if ($("#statTotal")) $("#statTotal").textContent = total;
    if ($("#statCompleted")) $("#statCompleted").textContent = completed;
    if ($("#statFailed")) $("#statFailed").textContent = failed;
    if ($("#statBytes")) $("#statBytes").textContent = humanBytes(bytes);
    const query = elements.historySearch ? elements.historySearch.value.trim().toLowerCase() : "";
    const status = elements.historyFilter ? elements.historyFilter.value : "all";
    const visible = state.history.filter((item) => (status === "all" || item.status === status)
      && `${item.provider} ${safeHostname(item.url)} ${item.status}`.toLowerCase().includes(query));
    if (!visible.length) {
      elements.historyList.className = "list-empty";
      elements.historyList.textContent = total ? "No entries match these filters." : "No local history yet.";
      return;
    }
    elements.historyList.className = "";
    elements.historyList.innerHTML = visible.slice(0, 50).map((item) => `
      <div class="history-row">
        <div>
          <strong>${escapeHtml(item.status)}</strong>
          <div class="url-text">${escapeHtml(item.provider || "Source")} · ${escapeHtml(safeHostname(item.url))}</div>
          <small class="url-text">${formatDate(item.at)}</small>
        </div>
        <span class="tag">${escapeHtml(item.provider)}</span>
      </div>
    `).join("");
  }

  function recordHistory(item) {
    state.history.unshift({ ...item, url: safeHostname(item.url), at: new Date().toISOString() });
    state.history = state.history.slice(0, 50);
    saveState();
    renderHistory();
  }

  async function onDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove("active");
    const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) {
      const file = files[0];
      if (file.size > 8192 || !/text|url|plain/i.test(file.type || file.name)) {
        if (elements.batchMessage) elements.batchMessage.textContent = "Only small text URL-list files are accepted.";
        return;
      }
      addUrlsToQueue(await file.text());
      return;
    }
    addUrlsToQueue(text);
  }

  function addUrlsToQueue(text) {
    const summary = { added: 0, rejected: 0, duplicates: 0 };
    text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 25).forEach((url) => {
      if (!validateUrl(url).ok) { summary.rejected += 1; return; }
      if (state.queue.some((job) => job.url === url)) { summary.duplicates += 1; return; }
      if (state.queue.length >= 25) { summary.rejected += 1; return; }
      state.queue.push({ id: crypto.randomUUID(), url, preset: selectedPreset, status: "queued", error: "" });
      summary.added += 1;
    });
    saveState();
    renderQueue();
    return summary;
  }

  async function pasteBatchFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) { elements.batchMessage.textContent = "Clipboard unavailable. Paste links manually."; return; }
    try { elements.batchInput.value = await navigator.clipboard.readText(); elements.batchInput.focus(); }
    catch (_) { elements.batchMessage.textContent = "Clipboard permission denied. Paste links manually."; }
  }

  function safeHostname(value) {
    try { return new URL(value.includes("://") ? value : `https://${value}`).hostname; } catch (_) { return "Source unavailable"; }
  }

  async function loadProviders() {
    try {
      const data = await apiFetch("/api/v1/providers");
      elements.providersList.innerHTML = data.providers.map((provider) => `
        <article class="provider-row"><div class="provider-head"><h2>${escapeHtml(provider.name)}</h2><span class="tag">${escapeHtml(provider.key)}</span></div>
          <div class="capability-list">${provider.capabilities.map((cap) => `<div class="capability-item"><span>${escapeHtml(cap.key.replaceAll("_", " "))}</span><strong class="${cap.supported ? "tone-ok" : "tone-off"}">${cap.supported ? "Available" : "Unavailable"}</strong></div>`).join("")}</div>
        </article>`).join("");
    } catch (error) { elements.providersList.innerHTML = `<p class="list-empty">Could not load provider capabilities: ${escapeHtml(error.message)}</p>`; }
  }

  async function refreshHealth() {
    try {
      await apiFetch("/api/v1/health");
      if (!elements.apiBadge) return;
      elements.apiBadge.textContent = "API reachable";
      elements.apiBadge.classList.add("ok");
      elements.apiBadge.classList.remove("warn");
    } catch (error) {
      if (!elements.apiBadge) return;
      elements.apiBadge.textContent = isStaticExport && !apiBase ? "Backend not connected" : "API offline";
      elements.apiBadge.classList.add("warn");
      elements.apiBadge.classList.remove("ok");
    }
  }

  async function runDiagnostics() {
    elements.diagnosticsList.innerHTML = `<div class="diag"><strong>Running checks</strong><p>Checking...</p><small>Browser and API diagnostics are local and do not expose secrets.</small></div>`;
    const checks = [
      ["Clipboard", Boolean(navigator.clipboard), "Clipboard paste requires a user gesture."],
      ["Notifications", "Notification" in window, "Optional; denied permissions do not block downloads."],
      ["Service worker", "serviceWorker" in navigator, "Caches app shell only."],
      ["Local storage", storageAvailable(), "Stores non-sensitive preferences and history."],
    ];
    try {
      const providers = await apiFetch("/api/v1/providers");
      checks.push(["API providers", true, `${providers.providers.length} provider records returned.`]);
      checks.push(["FFmpeg", false, "Optional conversion tool is not bundled or detected by this web UI."]);
    } catch (error) {
      checks.push(["API providers", false, error.message]);
    }
    elements.diagnosticsList.innerHTML = checks.map(([name, ok, note]) => `<div class="diag"><strong>${escapeHtml(name)}</strong><p>${ok ? "OK" : "Unavailable"}</p><small>${escapeHtml(note)}</small></div>`).join("");
  }

  function toggleTheme() {
    state.settings.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = state.settings.theme;
    if (elements.themePreference) elements.themePreference.value = state.settings.theme;
    saveState();
    updateThemeButton();
  }

  async function onNotificationToggle() {
    if (!elements.notifyToggle.checked) {
      state.settings.notifications = false;
      saveState();
      return;
    }
    if (!("Notification" in window)) {
      elements.notifyToggle.checked = false;
      return;
    }
    const permission = await Notification.requestPermission();
    state.settings.notifications = permission === "granted";
    elements.notifyToggle.checked = state.settings.notifications;
    saveState();
  }

  function saveSettings() {
    if (elements.defaultPreset) state.settings.preset = elements.defaultPreset.value;
    if (elements.defaultFormat) state.settings.format = elements.defaultFormat.value;
    if (elements.concurrencyInput) state.settings.concurrency = Math.max(1, Math.min(Number(elements.concurrencyInput.value) || 1, 2));
    saveState();
  }

  function saveApiSettings() {
    apiBase = elements.apiUrlInput.value.trim().replace(/\/$/, "");
    state.settings.apiBase = apiBase;
    saveState();
    if (elements.staticApiNotice) elements.staticApiNotice.hidden = !apiBase || !hasHttpsApiBase();
    refreshHealth();
  }

  function hasHttpsApiBase() {
    try {
      const parsed = new URL(apiBase);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch (_) {
      return false;
    }
  }

  function clearSettings() {
    state.settings = {};
    saveState();
    location.reload();
  }

  function updateThemeButton() {
    if (!elements.themeToggle) return;
    const light = document.documentElement.dataset.theme === "light";
    elements.themeToggle.textContent = light ? "Dark" : "Light";
    elements.themeToggle.setAttribute("aria-pressed", String(light));
  }

  function resetWorkspace() {
    currentAnalysis = null;
    elements.urlInput.value = "";
    setError("");
    elements.analysisResult.classList.add("hidden");
    elements.presetPanel.classList.add("hidden");
    elements.resultState.className = "result-state empty";
    elements.resultState.innerHTML = `<div class="empty-graphic" aria-hidden="true"></div><div><h2>Ready when you are</h2><p>Analyze a link to reveal real provider information, available formats, and permitted actions.</p></div>`;
    elements.resultState.classList.remove("hidden");
    elements.urlInput.focus();
  }

  function showLoading(message) {
    elements.resultState.className = "result-state loading";
    elements.resultState.innerHTML = `<div class="empty-graphic" aria-hidden="true"></div><div><h2>Checking supported formats...</h2><p>${escapeHtml(message)}</p></div>`;
    elements.resultState.classList.remove("hidden");
    elements.analysisResult.classList.add("hidden");
    elements.presetPanel.classList.add("hidden");
  }

  function showError(message) {
    elements.resultState.className = "result-state error";
    elements.resultState.innerHTML = `<div class="empty-graphic" aria-hidden="true"></div><div><h2>Unable to analyze</h2><p>${escapeHtml(message)}</p></div>`;
    elements.resultState.classList.remove("hidden");
    elements.analysisResult.classList.add("hidden");
    elements.presetPanel.classList.add("hidden");
  }

  function setAnalyzeLoading(loading) {
    isAnalyzing = loading;
    elements.analyzeButton.disabled = loading;
    elements.analyzeButton.classList.toggle("is-loading", loading);
    elements.analyzeButtonText.textContent = loading ? "Analyzing" : "Analyze link";
  }

  function setError(message) {
    elements.urlError.textContent = message;
    elements.urlInput.classList.toggle("input-error", Boolean(message));
  }

  function toggleMenu() {
    if (!elements.nav || !elements.menuButton) return;
    const open = !elements.nav.classList.contains("open");
    elements.nav.classList.toggle("open", open);
    elements.menuButton.setAttribute("aria-expanded", String(open));
  }

  function closeMenu() {
    if (!elements.nav || !elements.menuButton) return;
    elements.nav.classList.remove("open");
    elements.menuButton.setAttribute("aria-expanded", "false");
  }

  async function apiFetch(path, options = {}) {
    if (isStaticExport && (!apiBase || !hasHttpsApiBase())) {
      throw new Error("This static site has no reachable HTTPS Flask API configured. API-backed features are unavailable here; media downloads are not implemented.");
    }
    const response = await fetch(`${apiBase}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error && data.error.message ? data.error.message : "Request failed.");
    return data;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return { settings: parsed.settings || {}, queue: parsed.queue || [], history: parsed.history || [] };
    } catch (error) {
      return { settings: {}, queue: [], history: [] };
    }
  }

  function saveState() { localStorage.setItem(storeKey, JSON.stringify(state)); }
  function storageAvailable() {
    try {
      localStorage.setItem("__dd_test", "1");
      localStorage.removeItem("__dd_test");
      return true;
    } catch (error) {
      return false;
    }
  }
  function humanBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  }
  function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
})();
