const MATRIX_STATE_KEY = "ToolSyncPM_Matrix_3Grid_v1";
const PHOTO_BACKUP_KEY = "ToolSyncPM_PhotoBackup_v1";
const SHARED_TOOLS_MIRROR_KEY = "ToolSyncPM_Tools_v1";

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function showToast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("translate-y-20", "opacity-0");
    el.classList.add("translate-y-0", "opacity-100");
    clearTimeout(window.__galleryToastTimer);
    window.__galleryToastTimer = setTimeout(() => {
        el.classList.remove("translate-y-0", "opacity-100");
        el.classList.add("translate-y-20", "opacity-0");
    }, 2200);
}

function loadMatrixState() {
    try {
        const raw = localStorage.getItem(MATRIX_STATE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch {
        // Ignore storage read errors
    }
    return {};
}

function saveMatrixState(stateObj) {
    try {
        localStorage.setItem(MATRIX_STATE_KEY, JSON.stringify(stateObj));

        const mirrorList = [];
        const backupPhotos = [];

        Object.entries(stateObj).forEach(([key, entry]) => {
            if (!entry) return;
            const [toolCode, scheduledDate] = key.split("__");
            if (!toolCode || !scheduledDate) return;

            const hasBefore = Boolean(entry.beforePhoto);
            const hasAfter = Boolean(entry.afterPhoto);
            if (!entry.p && !entry.a && !hasBefore && !hasAfter && !entry.remark) return;

            mirrorList.push({
                id: `fp_${toolCode}_${scheduledDate}`,
                toolCode,
                scheduledDate,
                pmMark: entry.a ? "A" : "P",
                status: entry.a ? "PM Completed" : "Scheduled",
                beforePhoto: entry.beforePhoto || "",
                afterPhoto: entry.afterPhoto || "",
                remarks: entry.remark || ""
            });

            if (hasBefore) {
                backupPhotos.push({
                    id: `${toolCode}__${scheduledDate}__BEFORE`,
                    toolCode,
                    date: scheduledDate,
                    stage: "BEFORE PM",
                    photo: entry.beforePhoto,
                    remarks: entry.remark || ""
                });
            }
            if (hasAfter) {
                backupPhotos.push({
                    id: `${toolCode}__${scheduledDate}__AFTER`,
                    toolCode,
                    date: scheduledDate,
                    stage: "AFTER PM",
                    photo: entry.afterPhoto,
                    remarks: entry.remark || ""
                });
            }
        });

        localStorage.setItem(SHARED_TOOLS_MIRROR_KEY, JSON.stringify(mirrorList));
        localStorage.setItem(PHOTO_BACKUP_KEY, JSON.stringify(backupPhotos));
    } catch {
        // Ignore storage write errors
    }
}

function collectPhotoEntries() {
    const state = loadMatrixState();
    const list = [];

    Object.entries(state).forEach(([key, entry]) => {
        if (!entry) return;
        const beforePhoto = entry.beforePhoto || "";
        const afterPhoto = entry.afterPhoto || "";
        if (!beforePhoto && !afterPhoto) return;

        const [toolCode, date] = key.split("__");
        if (!toolCode || !date) return;

        list.push({
            key,
            toolCode,
            date,
            beforePhoto,
            afterPhoto,
            remark: entry.remark || ""
        });
    });

    // Also include any backup-only entries if present
    try {
        const backup = JSON.parse(localStorage.getItem(PHOTO_BACKUP_KEY) || "[]");
        if (Array.isArray(backup)) {
            backup.forEach((b) => {
                if (!b || !b.toolCode || !b.date || !b.photo) return;
                const key = `${String(b.toolCode).trim().toUpperCase()}__${String(b.date).trim()}`;
                let existing = list.find((item) => item.key === key);
                if (!existing) {
                    existing = {
                        key,
                        toolCode: String(b.toolCode).trim().toUpperCase(),
                        date: String(b.date).trim(),
                        beforePhoto: "",
                        afterPhoto: "",
                        remark: b.remarks || ""
                    };
                    list.push(existing);
                }
                if (String(b.stage || "").toUpperCase().includes("AFTER")) {
                    if (!existing.afterPhoto) existing.afterPhoto = b.photo;
                } else if (!existing.beforePhoto) {
                    existing.beforePhoto = b.photo;
                }
            });
        }
    } catch {
        // Ignore backup errors
    }

    return list.sort((a, b) => b.date.localeCompare(a.date) || a.toolCode.localeCompare(b.toolCode));
}

window.openGalleryLightbox = function (src, caption, filename) {
    if (!src) return;
    const lb = document.getElementById("gallery-lightbox");
    const img = document.getElementById("lightbox-image");
    const cap = document.getElementById("lightbox-caption");
    const dl = document.getElementById("lightbox-download-link");

    img.src = src;
    cap.textContent = caption;
    dl.href = src;
    dl.download = filename || "pm-photo.jpg";

    lb.classList.remove("hidden");
    lb.classList.add("flex");
};

window.deleteSingleGalleryPhoto = function (key, stage) {
    const state = loadMatrixState();
    const item = state[key];
    if (!item) return;

    if (stage === "before") {
        item.beforePhoto = "";
    } else if (stage === "after") {
        item.afterPhoto = "";
    }

    if (!item.p && !item.a && !item.beforePhoto && !item.afterPhoto && !item.remark) {
        delete state[key];
    } else {
        state[key] = item;
    }

    saveMatrixState(state);
    renderGallery();
    showToast(`Removed ${stage.toUpperCase()} photo`);
};

function renderGallery() {
    const allItems = collectPhotoEntries();
    const searchQ = (document.getElementById("gallery-tool-search")?.value || "").trim().toLowerCase();
    const dateFilter = (document.getElementById("gallery-date-filter")?.value || "").trim();
    const stageFilter = (document.getElementById("gallery-stage-filter")?.value || "ALL").toUpperCase();

    const filtered = allItems.filter((item) => {
        const matchesText =
            !searchQ ||
            item.toolCode.toLowerCase().includes(searchQ) ||
            item.remark.toLowerCase().includes(searchQ);
        const matchesDate = !dateFilter || item.date === dateFilter;
        const matchesStage =
            stageFilter === "ALL" ||
            (stageFilter === "BEFORE" && Boolean(item.beforePhoto)) ||
            (stageFilter === "AFTER" && Boolean(item.afterPhoto));
        return matchesText && matchesDate && matchesStage;
    });

    const totalBefore = filtered.reduce((acc, x) => acc + (x.beforePhoto ? 1 : 0), 0);
    const totalAfter = filtered.reduce((acc, x) => acc + (x.afterPhoto ? 1 : 0), 0);
    const totalPics = totalBefore + totalAfter;

    const badge = document.getElementById("total-pics-badge");
    if (badge) badge.textContent = `${totalPics} Photos`;

    const statRec = document.getElementById("stat-records");
    const statBef = document.getElementById("stat-before");
    const statAft = document.getElementById("stat-after");
    if (statRec) statRec.textContent = String(filtered.length);
    if (statBef) statBef.textContent = String(totalBefore);
    if (statAft) statAft.textContent = String(totalAfter);

    const container = document.getElementById("gallery-cards-container");
    if (!container) return;

    if (!filtered.length) {
        container.innerHTML = `
            <div class="col-span-full rounded-2xl bg-[#11151d] border border-stone-800 p-10 text-center font-mono text-xs text-stone-400">
                No uploaded PM photos found for the current filter. Upload photos in the PM Sheet to view them here.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered
        .map((item) => {
            const beforeBlock = item.beforePhoto
                ? `
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between text-[11px] font-mono">
                            <span class="text-amber-300 font-bold">BEFORE PM</span>
                            <button
                                type="button"
                                onclick="deleteSingleGalleryPhoto('${escapeHtml(item.key)}', 'before')"
                                class="text-rose-400 hover:underline"
                            >
                                Delete
                            </button>
                        </div>
                        <img
                            src="${item.beforePhoto}"
                            alt="Before PM - ${escapeHtml(item.toolCode)}"
                            onclick="openGalleryLightbox(this.src, '${escapeHtml(item.toolCode)} • ${escapeHtml(item.date)} • Before PM', '${escapeHtml(item.toolCode)}_${escapeHtml(item.date)}_before.jpg')"
                            class="gallery-thumb w-full rounded-lg border border-stone-700 cursor-pointer"
                        />
                    </div>
                `
                : `
                    <div class="space-y-1.5">
                        <div class="text-[11px] font-mono text-stone-500 font-bold">BEFORE PM</div>
                        <div class="gallery-thumb w-full rounded-lg border border-dashed border-stone-800 flex items-center justify-center text-[11px] font-mono text-stone-600">
                            Not Uploaded
                        </div>
                    </div>
                `;

            const afterBlock = item.afterPhoto
                ? `
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between text-[11px] font-mono">
                            <span class="text-emerald-300 font-bold">AFTER PM</span>
                            <button
                                type="button"
                                onclick="deleteSingleGalleryPhoto('${escapeHtml(item.key)}', 'after')"
                                class="text-rose-400 hover:underline"
                            >
                                Delete
                            </button>
                        </div>
                        <img
                            src="${item.afterPhoto}"
                            alt="After PM - ${escapeHtml(item.toolCode)}"
                            onclick="openGalleryLightbox(this.src, '${escapeHtml(item.toolCode)} • ${escapeHtml(item.date)} • After PM', '${escapeHtml(item.toolCode)}_${escapeHtml(item.date)}_after.jpg')"
                            class="gallery-thumb w-full rounded-lg border border-stone-700 cursor-pointer"
                        />
                    </div>
                `
                : `
                    <div class="space-y-1.5">
                        <div class="text-[11px] font-mono text-stone-500 font-bold">AFTER PM</div>
                        <div class="gallery-thumb w-full rounded-lg border border-dashed border-stone-800 flex items-center justify-center text-[11px] font-mono text-stone-600">
                            Not Uploaded
                        </div>
                    </div>
                `;

            return `
                <article class="gallery-card rounded-2xl bg-[#11151d] border border-stone-800 p-4 space-y-3">
                    <div class="flex items-center justify-between gap-2 border-b border-stone-800 pb-2.5 font-mono">
                        <div>
                            <h2 class="text-sm font-bold text-white">${escapeHtml(item.toolCode)}</h2>
                            <p class="text-[11px] text-sky-300">${escapeHtml(item.date)}</p>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-[#181d28] border border-stone-700 text-[10px] text-stone-300">
                            ${(item.beforePhoto ? 1 : 0) + (item.afterPhoto ? 1 : 0)} / 2 Pics
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        ${beforeBlock}
                        ${afterBlock}
                    </div>

                    <p class="text-xs font-mono text-stone-400 truncate" title="${escapeHtml(item.remark)}">
                        Remark: <span class="text-stone-200">${item.remark ? escapeHtml(item.remark) : "—"}</span>
                    </p>
                </article>
            `;
        })
        .join("");
}

function initGalleryPage() {
    renderGallery();

    document.getElementById("gallery-tool-search")?.addEventListener("input", renderGallery);
    document.getElementById("gallery-date-filter")?.addEventListener("change", renderGallery);
    document.getElementById("gallery-stage-filter")?.addEventListener("change", renderGallery);

    document.getElementById("reset-gallery-filters-btn")?.addEventListener("click", () => {
        const s = document.getElementById("gallery-tool-search");
        const d = document.getElementById("gallery-date-filter");
        const st = document.getElementById("gallery-stage-filter");
        if (s) s.value = "";
        if (d) d.value = "";
        if (st) st.value = "ALL";
        renderGallery();
    });

    document.getElementById("close-gallery-lightbox-btn")?.addEventListener("click", () => {
        const lb = document.getElementById("gallery-lightbox");
        lb.classList.add("hidden");
        lb.classList.remove("flex");
    });

    window.addEventListener("storage", (e) => {
        if (e.key === MATRIX_STATE_KEY || e.key === PHOTO_BACKUP_KEY) {
            renderGallery();
        }
    });
}

initGalleryPage();