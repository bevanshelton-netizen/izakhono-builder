(() => {
  "use strict";

  const state = {
    curriculum: null,
    activeTrack: "all",
    search: "",
    activeModule: null,
    institutions: null,
    locales: null,
    offers: null,
    automation: null,
    currentLocale: localStorage.getItem("izakhono-digital-finance-locale") || "en",
    progress: loadProgress()
  };

  const els = {
    grid: document.querySelector("#courseGrid"),
    filters: document.querySelector("#filters"),
    search: document.querySelector("#courseSearch"),
    drawer: document.querySelector("#lessonDrawer"),
    backdrop: document.querySelector("#drawerBackdrop"),
    drawerBody: document.querySelector("#drawerBody"),
    closeDrawer: document.querySelector("#closeDrawer"),
    toast: document.querySelector("#toast"),
    engineStatus: document.querySelector("#engineStatus"),
    institutionGrid: document.querySelector("#institutionGrid"),
    languageSelect: document.querySelector("#languageSelect"),
    languageCloud: document.querySelector("#languageCloud"),
    localeCount: document.querySelector("#localeCount"),
    proposalInstitution: document.querySelector("#proposalInstitution"),
    proposalOffer: document.querySelector("#proposalOffer"),
    proposalLanguage: document.querySelector("#proposalLanguage"),
    proposalScale: document.querySelector("#proposalScale"),
    proposalOutput: document.querySelector("#proposalOutput"),
    copyProposal: document.querySelector("#copyProposal"),
    downloadProposal: document.querySelector("#downloadProposal"),
    automationRole: document.querySelector("#automationRole"),
    automationScore: document.querySelector("#automationScore"),
    runAutomationDemo: document.querySelector("#runAutomationDemo"),
    automationResult: document.querySelector("#automationResult"),
    year: document.querySelector("#year")
  };

  if (els.year) els.year.textContent = new Date().getFullYear();

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem("izakhono-digital-finance-progress-v1") || "{}");
    } catch {
      return {};
    }
  }

  function saveProgress() {
    localStorage.setItem("izakhono-digital-finance-progress-v1", JSON.stringify(state.progress));
  }

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 3000);
  }

  async function loadJsonWithFallback(apiPath, fileName) {
    for (const source of [apiPath, fileName]) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        return await response.json();
      } catch {
        // Keep the owned-engine and static-resilience modes interchangeable.
      }
    }
    throw new Error("Resource unavailable: " + fileName);
  }

  async function loadOffers() {
    state.offers = await loadJsonWithFallback("/api/v1/offers", "institutional-offers.json");
  }

  function proposalText() {
    if (!state.offers || !state.institutions || !state.locales) return "";
    const institution = state.institutions.audiences.find(item => item.id === els.proposalInstitution.value);
    const offer = state.offers.offers.find(item => item.id === els.proposalOffer.value);
    const locale = state.locales.locales[els.proposalLanguage.value];
    if (!institution || !offer || !locale) return "";

    return [
      "IZAKHONO DIGITAL FINANCE ACADEMY — INSTITUTIONAL PROGRAMME BRIEF",
      "",
      "Institution type: " + institution.name,
      "Programme: " + offer.name,
      "Language: " + locale.name,
      "Scale: " + els.proposalScale.value,
      "",
      "Institutional value:",
      institution.value,
      "",
      "Programme audience:",
      offer.audience,
      "",
      "Expected outcomes:",
      ...offer.outcomes.map(item => "- " + item),
      "",
      "Delivery options:",
      ...offer.delivery.map(item => "- " + item),
      "",
      ...(offer.pricing ? ["Price: " + offer.pricing.display, ""] : []),
      "Commercial basis: " + (offer.pricing ? offer.pricing.display + " for the standard employee package; separately scoped extras may apply." : "Quote-based institutional agreement."),
      "Accreditation boundary: This programme does not become a university degree or accredited qualification unless separately approved and evidenced.",
      "Localisation boundary: Full course language packs are marketed as available only after translation QA and subject-matter review."
    ].join("\n");
  }

  function renderProposalBuilder() {
    if (!state.offers || !state.institutions || !state.locales || !els.proposalOutput) return;

    els.proposalInstitution.innerHTML = state.institutions.audiences.map(item =>
      `<option value="${esc(item.id)}">${esc(item.name)}</option>`
    ).join("");

    els.proposalOffer.innerHTML = state.offers.offers.map(item =>
      `<option value="${esc(item.id)}">${esc(item.name)}</option>`
    ).join("");

    els.proposalLanguage.innerHTML = Object.entries(state.locales.locales).map(([code, locale]) =>
      `<option value="${esc(code)}">${esc(locale.name)}</option>`
    ).join("");

    if (state.offers.offers.some(item => item.id === "fais-employee-empowerment")) {
      els.proposalOffer.value = "fais-employee-empowerment";
    }

    const sync = () => {
      const offer = state.offers.offers.find(item => item.id === els.proposalOffer.value);
      const institution = state.institutions.audiences.find(item => item.id === els.proposalInstitution.value);
      if (!offer || !institution) return;
      els.proposalOutput.innerHTML = `
        <div class="proposal-eyebrow">Tailored institutional brief</div>
        <h3>${esc(offer.name)}</h3>
        <p><strong>For:</strong> ${esc(institution.name)}</p>
        <p>${esc(institution.value)}</p>
        <div class="programme-list">
          ${offer.outcomes.map(item => `<span>${esc(item)}</span>`).join("")}
        </div>
        <div class="proposal-meta">
          <span>Language: ${esc(state.locales.locales[els.proposalLanguage.value]?.name || "")}</span>
          <span>Scale: ${esc(els.proposalScale.value)}</span>
          ${offer.pricing ? `<span class="proposal-price">${esc(offer.pricing.display)}</span>` : ""}
        </div>
      `;
    };

    [els.proposalInstitution, els.proposalOffer, els.proposalLanguage, els.proposalScale].forEach(control => {
      control.addEventListener("change", sync);
    });

    els.copyProposal.addEventListener("click", async () => {
      const textValue = proposalText();
      try {
        await navigator.clipboard.writeText(textValue);
        toast("Institutional proposal brief copied.");
      } catch {
        toast("Copy unavailable on this device. Use Download brief instead.");
      }
    });

    els.downloadProposal.addEventListener("click", () => {
      const blob = new Blob([proposalText()], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "izakhono-digital-finance-institutional-brief.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

    sync();
  }

  async function runAutomationDemo() {
    if (!els.automationResult || !els.runAutomationDemo) return;
    els.runAutomationDemo.disabled = true;
    els.automationResult.classList.remove("error");
    els.automationResult.innerHTML = "<span>Running a stateless routing decision…</span>";

    const payload = {
      learner_ref: "demo-" + Date.now().toString(36),
      stage: "baseline",
      role: els.automationRole?.value || "general_employee",
      baseline_score: Number(els.automationScore?.value || 0)
    };

    try {
      const response = await fetch("/api/v1/automation/evaluate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("Automation decision unavailable.");

      const modules = (data.assigned_modules || []).map(module => "<span>" + esc(module) + "</span>").join("");
      els.automationResult.innerHTML =
        '<div class="proposal-eyebrow">Automated decision</div>' +
        "<h3>" + esc(data.path || data.decision || "continue") + "</h3>" +
        "<p><strong>Role:</strong> " + esc(data.role || payload.role) + " &nbsp; <strong>Next:</strong> " + esc(data.next_stage || "learning") + "</p>" +
        (modules ? '<div class="programme-list">' + modules + "</div>" : "") +
        '<p class="automation-note">No personal identity fields were sent or stored by this decision engine.</p>';
    } catch {
      els.automationResult.classList.add("error");
      els.automationResult.innerHTML = "<span>The owned automation API is not available on this route. Static resilience mode does not pretend to execute server-side learner decisions.</span>";
    } finally {
      els.runAutomationDemo.disabled = false;
    }
  }

  function bindAutomationDemo() {
    if (!els.runAutomationDemo) return;
    els.runAutomationDemo.addEventListener("click", runAutomationDemo);
  }
  async function loadInstitutionalData() {
    const [institutions, locales] = await Promise.all([
      loadJsonWithFallback("/api/v1/institutions", "institutions.json"),
      loadJsonWithFallback("/api/v1/locales", "locales.json")
    ]);
    state.institutions = institutions;
    state.locales = locales;
    renderInstitutions();
    renderLanguageControls();
    applyLocale(state.currentLocale);
  }

  function renderInstitutions() {
    if (!state.institutions || !els.institutionGrid) return;
    els.institutionGrid.innerHTML = state.institutions.audiences.map((item, index) => `
      <article class="institution-card">
        <div class="tag">0${index + 1}</div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.value)}</p>
        <div class="programme-list">
          ${item.programmes.slice(0, 3).map(programme => `<span>${esc(programme)}</span>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderLanguageControls() {
    if (!state.locales || !els.languageSelect || !els.languageCloud) return;
    const entries = Object.entries(state.locales.locales);
    els.languageSelect.innerHTML = entries.map(([code, locale]) =>
      `<option value="${esc(code)}">${esc(locale.name)}</option>`
    ).join("");
    els.languageSelect.value = state.locales.locales[state.currentLocale] ? state.currentLocale : state.locales.default;
    els.languageCloud.innerHTML = entries.map(([code, locale]) =>
      `<button class="language-chip" type="button" data-locale="${esc(code)}">${esc(locale.name)}</button>`
    ).join("");
    if (els.localeCount) els.localeCount.textContent = String(entries.length);

    els.languageSelect.addEventListener("change", event => applyLocale(event.target.value));
    els.languageCloud.querySelectorAll("[data-locale]").forEach(button => {
      button.addEventListener("click", () => applyLocale(button.dataset.locale));
    });
  }

  function applyLocale(code) {
    if (!state.locales) return;
    const locale = state.locales.locales[code] || state.locales.locales[state.locales.default];
    const activeCode = state.locales.locales[code] ? code : state.locales.default;
    state.currentLocale = activeCode;
    localStorage.setItem("izakhono-digital-finance-locale", activeCode);
    document.documentElement.lang = activeCode;
    document.documentElement.dir = locale.dir || "ltr";
    if (els.languageSelect) els.languageSelect.value = activeCode;
    document.querySelectorAll("[data-i18n]").forEach(node => {
      const key = node.dataset.i18n;
      if (locale[key]) node.textContent = locale[key];
    });
  }

  async function loadCurriculum() {
    const sources = ["/api/v1/catalog", "curriculum.json"];
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data.tracks)) {
          state.curriculum = data;
          return;
        }
      } catch {
        // Static resilience route may not expose the API. Fall through to the JSON file.
      }
    }
    throw new Error("Curriculum unavailable");
  }

  async function checkEngine() {
    try {
      const response = await fetch("/api/v1/status", { cache: "no-store" });
      if (!response.ok) throw new Error("engine unavailable");
      const data = await response.json();
      els.engineStatus.classList.add("healthy");
      els.engineStatus.querySelector("span").textContent = data.mode === "owned-engine"
        ? "Independent engine ready"
        : "Learning route ready";
    } catch {
      els.engineStatus.classList.remove("healthy");
      els.engineStatus.querySelector("span").textContent = "Static resilience mode";
    }
  }

  function flattenModules() {
    if (!state.curriculum) return [];
    return state.curriculum.tracks.flatMap(track =>
      track.modules.map(module => ({
        ...module,
        trackId: track.id,
        trackName: track.name,
        level: track.level,
        tier: track.commercial_tier,
        estimatedHours: track.estimated_hours
      }))
    );
  }

  function moduleProgress(module) {
    const completed = state.progress[module.id] || [];
    const total = module.lessons.length;
    return {
      completed: completed.length,
      total,
      percent: total ? Math.round((completed.length / total) * 100) : 0
    };
  }

  function trackLabel(trackId) {
    if (trackId === "foundations") return "Free foundation";
    if (trackId === "professional") return "Professional certificate";
    return "Specialist lab";
  }

  function renderFilters() {
    const filters = [
      ["all", "All learning"],
      ["foundations", "Free foundations"],
      ["professional", "Professional"],
      ["specialist", "Specialist labs"]
    ];

    els.filters.innerHTML = filters.map(([id, label]) =>
      `<button class="filter ${state.activeTrack === id ? "active" : ""}" data-filter="${id}">${label}</button>`
    ).join("");

    els.filters.querySelectorAll("[data-filter]").forEach(button => {
      button.addEventListener("click", () => {
        state.activeTrack = button.dataset.filter;
        renderFilters();
        renderCourses();
      });
    });
  }

  function renderCourses() {
    const query = state.search.trim().toLowerCase();
    const modules = flattenModules().filter(module => {
      const matchesTrack = state.activeTrack === "all" || module.trackId === state.activeTrack;
      const haystack = [module.title, module.summary, module.trackName, ...module.lessons].join(" ").toLowerCase();
      return matchesTrack && (!query || haystack.includes(query));
    });

    if (!modules.length) {
      els.grid.innerHTML = '<div class="empty">No learning modules match that search yet.</div>';
      return;
    }

    els.grid.innerHTML = modules.map(module => {
      const progress = moduleProgress(module);
      const action = progress.percent === 0 ? "Start module" : progress.percent === 100 ? "Review module" : "Continue module";
      return `
        <article class="course-card">
          <div class="tag">${esc(trackLabel(module.trackId))}</div>
          <h3>${esc(module.title)}</h3>
          <p>${esc(module.summary)}</p>
          <div class="course-meta">
            <span>◫ ${module.lessons.length} lessons</span>
            <span>◎ ${esc(module.level)}</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar" aria-label="Module progress">
              <div class="progress-fill" style="width:${progress.percent}%"></div>
            </div>
            <div class="progress-label">${progress.completed}/${progress.total} lessons complete · ${progress.percent}%</div>
          </div>
          <button class="btn ${module.trackId === "foundations" ? "primary" : "ghost"}" data-module="${esc(module.id)}">${action}</button>
        </article>
      `;
    }).join("");

    els.grid.querySelectorAll("[data-module]").forEach(button => {
      button.addEventListener("click", () => openModule(button.dataset.module));
    });
  }

  function openModule(moduleId) {
    const module = flattenModules().find(item => item.id === moduleId);
    if (!module) return;
    state.activeModule = module.id;
    const progress = moduleProgress(module);
    const isPaid = module.tier === "Paid";

    els.drawerBody.innerHTML = `
      <div class="kicker">${esc(module.trackName)}</div>
      <h2>${esc(module.title)}</h2>
      <p class="drawer-copy">${esc(module.summary)}</p>
      <div class="course-meta">
        <span>◫ ${module.lessons.length} lessons</span>
        <span>◎ ${esc(module.level)}</span>
        <span>↗ ${progress.percent}% complete</span>
      </div>
      ${isPaid ? '<div class="notice">Professional and specialist enrolment is being connected to a verified IZAKHONO checkout. No payment is collected by this preview.</div>' : ""}
      <div class="lesson-list">
        ${module.lessons.map((lesson, index) => lessonRow(module, lesson, index)).join("")}
      </div>
      <div class="module-note">
        Progress is stored on this device only in the current privacy-first MVP. Completion here does not automatically issue an accredited qualification or university degree.
      </div>
    `;

    els.drawerBody.querySelectorAll("[data-lesson]").forEach(button => {
      button.addEventListener("click", () => toggleLesson(module.id, Number(button.dataset.lesson)));
    });

    els.drawer.classList.add("open");
    els.backdrop.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
  }

  function lessonRow(module, lesson, index) {
    const completed = (state.progress[module.id] || []).includes(index);
    return `
      <div class="lesson ${completed ? "completed" : ""}">
        <div class="lesson-index">${completed ? "✓" : String(index + 1).padStart(2, "0")}</div>
        <strong>${esc(lesson)}</strong>
        <button data-lesson="${index}">${completed ? "Undo" : "Complete"}</button>
      </div>
    `;
  }

  function toggleLesson(moduleId, lessonIndex) {
    const module = flattenModules().find(item => item.id === moduleId);
    if (!module) return;

    const completed = new Set(state.progress[moduleId] || []);
    if (completed.has(lessonIndex)) completed.delete(lessonIndex);
    else completed.add(lessonIndex);
    state.progress[moduleId] = [...completed].sort((a, b) => a - b);
    saveProgress();
    openModule(moduleId);
    renderCourses();

    const progress = moduleProgress(module);
    if (progress.percent === 100) {
      toast("Module complete. Your progress is saved on this device.");
    }
  }

  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.backdrop.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
  }

  function bindStaticActions() {
    document.querySelectorAll("[data-scroll]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll("[data-paid-cta]").forEach(button => {
      button.addEventListener("click", () => {
        toast("Paid enrolment will open only after the product-specific iKhokha route is verified.");
      });
    });

    document.querySelectorAll("[data-enterprise-cta]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelector("#programme-builder")?.scrollIntoView({ behavior: "smooth" });
        toast("Choose your institution, programme, language and scale to generate a procurement-ready brief.");
      });
    });

    els.closeDrawer.addEventListener("click", closeDrawer);
    els.backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeDrawer();
    });

    els.search.addEventListener("input", event => {
      state.search = event.target.value;
      renderCourses();
    });
  }

  async function boot() {
    bindStaticActions();
    bindAutomationDemo();
    renderFilters();
    checkEngine();

    const jobs = [
      loadCurriculum().then(renderCourses).catch(() => {
        els.grid.innerHTML = '<div class="empty">The curriculum could not be loaded. The engine should fail closed rather than invent course content.</div>';
      }),
      Promise.all([loadInstitutionalData(), loadOffers()]).then(renderProposalBuilder).catch(() => {
        if (els.institutionGrid) {
          els.institutionGrid.innerHTML = '<div class="empty">Institutional programme data is temporarily unavailable.</div>';
        }
        if (els.proposalOutput) {
          els.proposalOutput.innerHTML = '<div class="empty">Institutional programme builder is temporarily unavailable.</div>';
        }
      })
    ];
    await Promise.allSettled(jobs);
  }

  boot();
})();