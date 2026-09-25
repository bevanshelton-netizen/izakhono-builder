(() => {
  "use strict";

  const state = {
    curriculum: null,
    activeTrack: "all",
    search: "",
    activeModule: null,
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
        toast("Enterprise enquiry workflow is the next commercial connection.");
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
    renderFilters();
    checkEngine();

    try {
      await loadCurriculum();
      renderCourses();
    } catch {
      els.grid.innerHTML = '<div class="empty">The curriculum could not be loaded. The engine should fail closed rather than invent course content.</div>';
    }
  }

  boot();
})();