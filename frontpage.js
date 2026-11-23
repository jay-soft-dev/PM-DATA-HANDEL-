const MONTHS_UPPER = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];
const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const TOTAL_PM_TOOLS = 70;
const MONTH_ROSTER_STORAGE_KEY = "ToolSyncPM_MonthRoster_v1";
const MONTH_EXCHANGE_STORAGE_KEY = "ToolSyncPM_MonthExchange_v1";
const LEGACY_ROSTER_KEY = "ToolSyncPM_70_Roster_v2";
const LEGACY_EXCHANGE_KEY = "ToolSyncPM_70_ToolExchange_v1";
const MATRIX_STATE_KEY = "ToolSyncPM_Matrix_3Grid_v1";
const PHOTO_BACKUP_KEY = "ToolSyncPM_PhotoBackup_v1";
const ONLY_PIC_BACKUP_KEY = "ToolSyncPM_Only_Pic_Backup_v1";
const SHARED_TOOLS_MIRROR_KEY = "ToolSyncPM_Tools_v1";

function escapeAttr(str) {
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
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
        el.classList.remove("translate-y-0", "opacity-100");
        el.classList.add("translate-y-20", "opacity-0");
    }, 2200);
}

function createPlaceholderToolCode(indexZeroBased) {
    return `TOOL-${String(indexZeroBased + 1).padStart(3, "0")}`;
}

function createEmpty70Roster() {
    const list = [];
    for (let i = 0; i < TOTAL_PM_TOOLS; i++) {
        list.push(createPlaceholderToolCode(i));
    }
    return list;
}

function normalize70List(arr) {
    const defaults = createEmpty70Roster();
    const out = [];
    for (let i = 0; i < TOTAL_PM_TOOLS; i++) {
        const val = Array.isArray(arr) ? String(arr[i] ?? defaults[i]).trim().toUpperCase() : defaults[i];
        out.push(val || defaults[i]);
    }
    return out;
}

function getMonthKey(year, monthIdx) {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

function loadMonthRosterMap() {
    try {
        const raw = localStorage.getItem(MONTH_ROSTER_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                const cleaned = {};
                Object.entries(parsed).forEach(([mKey, list]) => {
                    cleaned[mKey] = normalize70List(list);
                });
                return cleaned;
            }
        }
    } catch {
        // Ignore storage errors
    }

    const seeded = {};
    try {
        const legacyRaw = localStorage.getItem(LEGACY_ROSTER_KEY);
        if (legacyRaw) {
            const legacyArr = JSON.parse(legacyRaw);
            if (Array.isArray(legacyArr) && legacyArr.some((c) => c && !/^TOOL-\d{3}$/.test(String(c)))) {
                seeded["2026-11"] = normalize70List(legacyArr);
            }
        }
    } catch {
        // Ignore legacy errors
    }
    return seeded;
}

function saveMonthRosterMap(mapObj) {
    try {
        localStorage.setItem(MONTH_ROSTER_STORAGE_KEY, JSON.stringify(mapObj));
    } catch {
        // Ignore storage errors
    }
}

function loadMonthExchangeMap() {
    try {
        const raw = localStorage.getItem(MONTH_EXCHANGE_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch {
        // Ignore storage errors
    }

    const seeded = {};
    try {
        const legacyExRaw = localStorage.getItem(LEGACY_EXCHANGE_KEY);
        if (legacyExRaw) {
            const parsedEx = JSON.parse(legacyExRaw);
            if (parsedEx && typeof parsedEx === "object" && Object.keys(parsedEx).length) {
                seeded["2026-11"] = parsedEx;
            }
        }
    } catch {
        // Ignore legacy errors
    }
    return seeded;
}

function saveMonthExchangeMap(mapObj) {
    try {
        localStorage.setItem(MONTH_EXCHANGE_STORAGE_KEY, JSON.stringify(mapObj));
    } catch {
        // Ignore storage errors
    }
}

let activeYear = 2026;
let activeMonthIdx = 10; // November
let preSearchMonth = null;
let monthRosterMap = loadMonthRosterMap();
let monthExchangeMap = loadMonthExchangeMap();

function getRosterForMonth(year = activeYear, monthIdx = activeMonthIdx) {
    const key = getMonthKey(year, monthIdx);
    if (!monthRosterMap[key]) {
        monthRosterMap[key] = createEmpty70Roster();
    }
    return monthRosterMap[key];
}

function getExchangeForMonth(year = activeYear, monthIdx = activeMonthIdx) {
    const key = getMonthKey(year, monthIdx);
    if (!monthExchangeMap[key] || typeof monthExchangeMap[key] !== "object") {
        monthExchangeMap[key] = {};
    }
    return monthExchangeMap[key];
}

function loadMatrixState() {
    try {
        const raw = localStorage.getItem(MATRIX_STATE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch {
        // Ignore storage errors
    }

    const seeded = {};
    try {
        const mirror = JSON.parse(localStorage.getItem(SHARED_TOOLS_MIRROR_KEY) || "[]");
        if (Array.isArray(mirror)) {
            mirror.forEach((item) => {
                if (!item || !item.toolCode || !item.scheduledDate) return;
                const key = `${String(item.toolCode).trim().toUpperCase()}__${String(item.scheduledDate).trim()}`;
                const mark = String(item.pmMark || "P").trim().toUpperCase();
                seeded[key] = {
                    p: mark === "P" || item.status === "Scheduled" || !mark,
                    a: mark === "A" || item.status === "PM Completed",
                    beforePhoto: item.beforePhoto || "",
                    afterPhoto: item.afterPhoto || "",
                    remark: item.remarks || ""
                };
            });
        }
    } catch {
        // Ignore mirror errors
    }
    return seeded;
}

function syncBackupAndMirror(stateObj) {
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
            if (!entry.p && !entry.a && !hasBefore && !hasAfter) return;

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
        return true;
    } catch {
        showToast("Browser storage limit reached! Export JSON backup & clear old photos.");
        return false;
    }
}

function compressImageToDataUrl(file, maxWidth = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

let matrixState = loadMatrixState();

// Modal state
let activePicTool = "";
let activePicDate = "";
let draftBeforeUrl = "";
let draftAfterUrl = "";
let draftRemarkText = "";

function getDaysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
}

function makeIsoDate(year, monthIdx, day) {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getActiveMonthPrefix() {
    return `${getMonthKey(activeYear, activeMonthIdx)}-`;
}

function syncMonthPickerValue() {
    const mp = document.getElementById("month-picker");
    if (mp) {
        mp.value = getMonthKey(activeYear, activeMonthIdx);
    }
}

function collectAllSignOffs() {
    const signOffs = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("ToolSyncPM_SignOff_")) {
                const tag = k.replace("ToolSyncPM_SignOff_", "");
                signOffs[tag] = JSON.parse(localStorage.getItem(k) || "{}");
            }
        }
    } catch {
        // Ignore sign-off scan errors
    }
    return signOffs;
}

function restoreAllSignOffs(signOffs) {
    if (!signOffs || typeof signOffs !== "object") return;
    Object.entries(signOffs).forEach(([tag, val]) => {
        if (!tag || !val || typeof val !== "object") return;
        try {
            localStorage.setItem(`ToolSyncPM_SignOff_${tag}`, JSON.stringify(val));
        } catch {
            // Ignore write errors
        }
    });
}

function exportFullJsonBackup() {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

    const payload = {
        app: "ToolSyncPM",
        version: 2,
        exportedAt: now.toISOString(),
        activeView: {
            year: activeYear,
            monthIdx: activeMonthIdx
        },
        monthRosterMap,
        monthExchangeMap,
        matrixState,
        signOffs: collectAllSignOffs()
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ToolSyncPM_Backup_${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Full JSON backup downloaded!");
}

function importFullJsonBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || "{}"));
            if (!parsed || typeof parsed !== "object" || (!parsed.matrixState && !parsed.monthRosterMap)) {
                showToast("Invalid ToolSyncPM backup file");
                return;
            }

            if (parsed.monthRosterMap && typeof parsed.monthRosterMap === "object") {
                const cleaned = {};
                Object.entries(parsed.monthRosterMap).forEach(([mKey, list]) => {
                    cleaned[mKey] = normalize70List(list);
                });
                monthRosterMap = cleaned;
                saveMonthRosterMap(monthRosterMap);
            }

            if (parsed.monthExchangeMap && typeof parsed.monthExchangeMap === "object") {
                monthExchangeMap = parsed.monthExchangeMap;
                saveMonthExchangeMap(monthExchangeMap);
            }

            if (parsed.matrixState && typeof parsed.matrixState === "object") {
                matrixState = parsed.matrixState;
                syncBackupAndMirror(matrixState);
            }

            if (parsed.signOffs && typeof parsed.signOffs === "object") {
                restoreAllSignOffs(parsed.signOffs);
            }

            if (parsed.activeView && typeof parsed.activeView.year === "number" && typeof parsed.activeView.monthIdx === "number") {
                activeYear = parsed.activeView.year;
                activeMonthIdx = parsed.activeView.monthIdx;
                syncMonthPickerValue();
            }

            preSearchMonth = null;
            updateHeaderTitle();
            renderDateColumns();
            renderExcelGrid();
            bindSignOff();
            showToast("Backup restored successfully!");
        } catch {
            showToast("Could not read JSON backup file");
        }
    };
    reader.readAsText(file);
}

function ensureBackupControlsInToolbar() {
    if (document.getElementById("export-json-backup-btn")) return;

    const anchorBtn = document.getElementById("export-excel-btn");
    const container = anchorBtn?.parentElement;
    if (!container) return;

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.id = "export-json-backup-btn";
    exportBtn.className = "px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition";
    exportBtn.textContent = "Backup JSON";
    exportBtn.title = "Download complete JSON backup (plans, tools, photos)";
    exportBtn.addEventListener("click", exportFullJsonBackup);

    const importLabel = document.createElement("label");
    importLabel.className = "cursor-pointer px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 text-xs font-bold transition inline-flex items-center";
    importLabel.title = "Restore data from a saved JSON backup file";
    importLabel.textContent = "Restore JSON";

    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    importInput.id = "import-json-backup-input";
    importInput.className = "hidden";
    importInput.addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        if (f) importFullJsonBackupFile(f);
        e.target.value = "";
    });

    importLabel.appendChild(importInput);

    if (anchorBtn && anchorBtn.nextSibling) {
        container.insertBefore(exportBtn, anchorBtn.nextSibling);
        container.insertBefore(importLabel, exportBtn.nextSibling);
    } else {
        container.appendChild(exportBtn);
        container.appendChild(importLabel);
    }
}

function parseDateTokenToIso(token, fallbackYear, fallbackMonthIdx) {
    const clean = String(token || "").trim();
    if (!clean) return "";

    const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const y = Number(isoMatch[1]);
        const m = Number(isoMatch[2]);
        const d = Number(isoMatch[3]);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
    }

    const monthTokenMatch = clean.match(/^(\d{1,2})\s*[-/]\s*([a-zA-Z]+)(?:\s*[-/]\s*(\d{4}))?$/);
    if (monthTokenMatch) {
        const day = Number(monthTokenMatch[1]);
        const mName = monthTokenMatch[2].toLowerCase();
        const year = monthTokenMatch[3] ? Number(monthTokenMatch[3]) : fallbackYear;

        const shortIdx = MONTHS_SHORT.findIndex((s) => s.toLowerCase() === mName.slice(0, 3));
        const longIdx = MONTHS_UPPER.findIndex((u) => u.toLowerCase() === mName.toLowerCase());
        const mIdx = shortIdx !== -1 ? shortIdx : longIdx;

        if (mIdx !== -1 && day >= 1 && day <= 31) {
            return makeIsoDate(year, mIdx, day);
        }
    }

    const dmMatch = clean.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})(?:\s*[-/]\s*(\d{4}))?$/);
    if (dmMatch) {
        const day = Number(dmMatch[1]);
        const monthNum = Number(dmMatch[2]);
        const year = dmMatch[3] ? Number(dmMatch[3]) : fallbackYear;
        if (monthNum >= 1 && monthNum <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
    }

    return "";
}

function formatIsoToShortDate(isoDate) {
    const parts = String(isoDate || "").split("-");
    if (parts.length !== 3) return isoDate;
    const day = Number(parts[2]);
    const mIdx = Number(parts[1]) - 1;
    const mLabel = MONTHS_SHORT[mIdx] || parts[1];
    return `${day}/${mLabel}`;
}

function arrangeOcrTextToDateAndSr(rawOcrText) {
    const currentRoster = getRosterForMonth(activeYear, activeMonthIdx);
    const lines = String(rawOcrText || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const groupedByDate = new Map();
    let currentIsoDate = "";

    const addEntry = (isoDate, srNo, toolCode) => {
        if (!isoDate) return;
        let resolvedCode = String(toolCode || "").trim().toUpperCase();
        let resolvedSr = Number(srNo) || 0;

        if (!resolvedCode && resolvedSr >= 1 && resolvedSr <= currentRoster.length) {
            resolvedCode = currentRoster[resolvedSr - 1];
        } else if (resolvedCode && !resolvedSr) {
            const foundIdx = currentRoster.findIndex((c) => c === resolvedCode);
            if (foundIdx !== -1) resolvedSr = foundIdx + 1;
        }

        if (!resolvedCode) return;

        if (!groupedByDate.has(isoDate)) {
            groupedByDate.set(isoDate, []);
        }
        const bucket = groupedByDate.get(isoDate);
        if (!bucket.some((x) => x.toolCode === resolvedCode)) {
            bucket.push({ srNo: resolvedSr || 9999, toolCode: resolvedCode });
        }
    };

    lines.forEach((line) => {
        const dateMatches = [
            ...line.matchAll(
                /\b(\d{1,2}\s*[-/]\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{4}-\d{2}-\d{2})\b/gi
            )
        ];
        if (dateMatches.length) {
            const firstDateIso = parseDateTokenToIso(dateMatches[0][1], activeYear, activeMonthIdx);
            if (firstDateIso) currentIsoDate = firstDateIso;
        }

        const toolMatches = [...line.matchAll(/\b(?:\d{5,6}[A-Z0-9-]*|\d{6}-\d{3}(?:\s+OLD)?)\b/gi)];
        if (toolMatches.length && currentIsoDate) {
            toolMatches.forEach((tm) => {
                addEntry(currentIsoDate, 0, tm[0].trim().toUpperCase());
            });
            return;
        }

        if (currentIsoDate && /\bp\b/i.test(line)) {
            const srMatch = line.match(/\b([1-6]?\d|70)\b/);
            if (srMatch) {
                addEntry(currentIsoDate, Number(srMatch[1]), "");
            }
        }
    });

    const sortedDates = [...groupedByDate.keys()].sort();
    const formattedLines = [];
    const resolvedAssignments = [];

    sortedDates.forEach((isoDate) => {
        const items = groupedByDate.get(isoDate) || [];
        items.sort((a, b) => a.srNo - b.srNo || a.toolCode.localeCompare(b.toolCode));

        const labels = items.map((it) => {
            resolvedAssignments.push({ isoDate, toolCode: it.toolCode, srNo: it.srNo });
            return it.srNo && it.srNo < 9999 ? `Sr ${it.srNo} (${it.toolCode})` : it.toolCode;
        });

        if (labels.length) {
            formattedLines.push(`${formatIsoToShortDate(isoDate)}: ${labels.join(", ")}`);
        }
    });

    return {
        arrangedText: formattedLines.join("\n"),
        assignments: resolvedAssignments
    };
}

function parseArrangedOrBulkAssignments(text, targetYear = activeYear, targetMonthIdx = activeMonthIdx) {
    const targetRoster = getRosterForMonth(targetYear, targetMonthIdx);
    const lines = String(text || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const out = [];
    let currentDate = "";

    lines.forEach((line) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
            const left = line.slice(0, colonIdx).trim();
            const right = line.slice(colonIdx + 1).trim();
            const parsedDate = parseDateTokenToIso(left, targetYear, targetMonthIdx);
            if (parsedDate) {
                currentDate = parsedDate;
                right.split(/[,;|]+/).forEach((part) => {
                    const p = part.trim();
                    if (!p) return;
                    const parenMatch = p.match(/\(([^)]+)\)/);
                    if (parenMatch) {
                        out.push({ isoDate: currentDate, toolCode: parenMatch[1].trim().toUpperCase() });
                        return;
                    }
                    const srOnlyMatch = p.match(/^sr\.?\s*(\d{1,2})$/i);
                    if (srOnlyMatch) {
                        const idx = Number(srOnlyMatch[1]) - 1;
                        if (idx >= 0 && idx < targetRoster.length) {
                            out.push({ isoDate: currentDate, toolCode: targetRoster[idx] });
                        }
                        return;
                    }
                    out.push({ isoDate: currentDate, toolCode: p.toUpperCase() });
                });
                return;
            }
        }

        const standaloneDate = parseDateTokenToIso(line, targetYear, targetMonthIdx);
        if (standaloneDate) {
            currentDate = standaloneDate;
            return;
        }

        if (currentDate) {
            line.split(/[,;|]+/).forEach((part) => {
                const p = part.trim().toUpperCase();
                if (p) out.push({ isoDate: currentDate, toolCode: p });
            });
        }
    });

    return out;
}

function ensureToolInMonthRoster(toolCode, year, monthIdx) {
    const upper = String(toolCode || "").trim().toUpperCase();
    if (!upper) return;
    const roster = getRosterForMonth(year, monthIdx);
    if (roster.includes(upper)) return;
    const placeholderIdx = roster.findIndex((c) => /^TOOL-\d{3}$/.test(c));
    if (placeholderIdx !== -1) {
        roster[placeholderIdx] = upper;
    }
}

function clampDayToMonth(year, monthIdx, dayNum) {
    const maxDay = getDaysInMonth(year, monthIdx);
    const safeDay = Math.min(Math.max(Number(dayNum) || 1, 1), maxDay);
    return makeIsoDate(year, monthIdx, safeDay);
}

function applyAssignmentsToMatrix(assignments, clearOldP) {
    if (!Array.isArray(assignments) || !assignments.length) return 0;

    const targetYear = activeYear;
    const targetMonthIdx = activeMonthIdx;
    const targetMonthPrefix = `${getMonthKey(targetYear, targetMonthIdx)}-`;

    if (clearOldP) {
        Object.keys(matrixState).forEach((k) => {
            const datePart = k.split("__")[1] || "";
            if (datePart.startsWith(targetMonthPrefix) && matrixState[k]) {
                matrixState[k].p = false;
                if (!matrixState[k].p && !matrixState[k].a && !matrixState[k].beforePhoto && !matrixState[k].afterPhoto && !matrixState[k].remark) {
                    delete matrixState[k];
                }
            }
        });
    }

    let appliedCount = 0;

    assignments.forEach(({ isoDate, toolCode }) => {
        if (!isoDate || !toolCode) return;
        const parts = isoDate.split("-");
        const dayNum = parts.length === 3 ? Number(parts[2]) : 1;
        const effectiveIsoDate = clampDayToMonth(targetYear, targetMonthIdx, dayNum);

        ensureToolInMonthRoster(toolCode, targetYear, targetMonthIdx);

        const key = `${toolCode}__${effectiveIsoDate}`;
        const existing = matrixState[key] || {
            p: false,
            a: false,
            beforePhoto: "",
            afterPhoto: "",
            remark: ""
        };
        existing.p = true;
        matrixState[key] = existing;
        appliedCount += 1;
    });

    syncMonthPickerValue();
    saveMonthRosterMap(monthRosterMap);
    syncBackupAndMirror(matrixState);
    updateHeaderTitle();
    renderDateColumns();
    renderExcelGrid();
    bindSignOff();
    return appliedCount;
}

async function runPlanPhotoOcr(file) {
    const statusEl = document.getElementById("scan-status-text");
    const previewImg = document.getElementById("scan-plan-preview");
    const emptyBox = document.getElementById("scan-plan-empty");
    const outTa = document.getElementById("scan-arranged-textarea");
    const countBadge = document.getElementById("scan-detected-count");

    const dataUrl = await compressImageToDataUrl(file, 1400, 0.85);
    if (previewImg && emptyBox) {
        previewImg.src = dataUrl;
        previewImg.classList.remove("hidden");
        emptyBox.classList.add("hidden");
    }

    if (!window.Tesseract) {
        if (statusEl) statusEl.textContent = "OCR library unavailable — paste/edit text manually.";
        return;
    }

    if (statusEl) statusEl.textContent = "Scanning plan photo with OCR...";
    showToast("Scanning manual plan photo...");

    try {
        const result = await window.Tesseract.recognize(dataUrl, "eng");
        const rawText = result?.data?.text || "";
        const arranged = arrangeOcrTextToDateAndSr(rawText);

        if (outTa) {
            outTa.value = arranged.arrangedText || rawText.trim();
        }
        if (countBadge) {
            countBadge.textContent = `${arranged.assignments.length} items detected`;
        }
        if (statusEl) {
            statusEl.textContent = "Scan complete. Review/fix if needed and click 'Fix & Apply to PM Plan'.";
        }
        showToast("Scan complete!");
    } catch {
        if (statusEl) statusEl.textContent = "Could not read photo clearly — edit text manually.";
        showToast("OCR scan failed");
    }
}

function updateHeaderTitle() {
    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    const titleEl = document.getElementById("sheet-main-title");
    if (titleEl) {
        titleEl.textContent = `MOULD PREVENTIVE MAINTENANCE PLAN ${MONTHS_UPPER[activeMonthIdx]} - ${activeYear}`;
    }
    const badgeEl = document.getElementById("tool-count-badge");
    if (badgeEl) {
        badgeEl.textContent = `${roster.length} Tools`;
    }
}

function renderDateColumns() {
    const headerRow = document.getElementById("pm-date-header-row");
    const slotTh = document.getElementById("date-headers-slot");
    if (!headerRow || !slotTh) return;

    const totalDays = getDaysInMonth(activeYear, activeMonthIdx);
    slotTh.colSpan = totalDays;

    const prefixCols = `
        <th class="sticky left-0 z-30 bg-[#0d1017] text-center py-1.5 text-stone-400">#</th>
        <th class="sticky left-12 z-30 bg-[#0d1017] px-3 py-1.5 text-left text-stone-400">
            Tool No
        </th>
        <th class="sticky left-[275px] z-30 bg-[#0d1017] px-3 py-1.5 text-left text-stone-400">
            Tool Exchange
        </th>
        <th class="sticky left-[455px] z-30 bg-[#0d1017] px-2 py-1.5 text-center text-stone-400">
            Type
        </th>
    `;

    const dateCols = [];
    for (let d = 1; d <= totalDays; d++) {
        dateCols.push(`
            <th class="py-1.5 px-1 text-center min-w-[44px] whitespace-nowrap">
                ${d}/${MONTHS_SHORT[activeMonthIdx]}
            </th>
        `);
    }

    headerRow.innerHTML = prefixCols + dateCols.join("");
}

function hasActivityInMonth(code, year, monthIdx) {
    const prefix = `${getMonthKey(year, monthIdx)}-`;
    return Object.entries(matrixState).some(([k, item]) => {
        if (!item) return false;
        const [toolCode, isoDate] = k.split("__");
        if (toolCode !== code || !isoDate || !isoDate.startsWith(prefix)) return false;
        return Boolean(item.p || item.a || item.beforePhoto || item.afterPhoto || item.remark);
    });
}

function hasActivityInActiveMonth(code) {
    return hasActivityInMonth(code, activeYear, activeMonthIdx);
}

function hasActivityOnDate(code, targetDate) {
    if (!targetDate) return true;
    const item = matrixState[`${code}__${targetDate}`];
    if (!item) return false;
    return Boolean(item.p || item.a || item.beforePhoto || item.afterPhoto || item.remark);
}

function getAll12MonthKeysForYear(year) {
    return Array.from({ length: 12 }, (_, mIdx) => ({
        year,
        monthIdx: mIdx,
        monthKey: getMonthKey(year, mIdx)
    }));
}

function rowMatchesQuery(rowObj, q) {
    if (!q) return true;
    return (
        String(rowObj.srNo) === q ||
        rowObj.code.toLowerCase().includes(q) ||
        rowObj.exchange.toLowerCase().includes(q) ||
        rowObj.monthKey.toLowerCase().includes(q)
    );
}

function handleCrossMonthSearchSwitch(q) {
    if (!q) {
        if (preSearchMonth) {
            activeYear = preSearchMonth.year;
            activeMonthIdx = preSearchMonth.monthIdx;
            preSearchMonth = null;
            syncMonthPickerValue();
            updateHeaderTitle();
            renderDateColumns();
            bindSignOff();
        }
        return;
    }

    const activeRoster = getRosterForMonth(activeYear, activeMonthIdx);
    const activeExchange = getExchangeForMonth(activeYear, activeMonthIdx);
    const activeKey = getMonthKey(activeYear, activeMonthIdx);

    const hasMatchInActive = activeRoster.some((code, idx) =>
        rowMatchesQuery(
            { srNo: idx + 1, code, exchange: activeExchange[String(idx + 1)] || "", monthKey: activeKey },
            q
        )
    );

    if (hasMatchInActive) return;

    const candidateMonths = getAll12MonthKeysForYear(activeYear);
    Object.keys(monthRosterMap).forEach((mKey) => {
        if (!candidateMonths.some((m) => m.monthKey === mKey)) {
            const [yStr, mStr] = mKey.split("-");
            const y = Number(yStr);
            const mIdx = Number(mStr) - 1;
            if (y && mIdx >= 0 && mIdx <= 11) {
                candidateMonths.push({ year: y, monthIdx: mIdx, monthKey: mKey });
            }
        }
    });

    for (const cand of candidateMonths) {
        const rList = getRosterForMonth(cand.year, cand.monthIdx);
        const exMap = getExchangeForMonth(cand.year, cand.monthIdx);
        const found = rList.some((code, idx) =>
            rowMatchesQuery(
                { srNo: idx + 1, code, exchange: exMap[String(idx + 1)] || "", monthKey: cand.monthKey },
                q
            )
        );
        if (found) {
            if (!preSearchMonth) {
                preSearchMonth = { year: activeYear, monthIdx: activeMonthIdx };
            }
            activeYear = cand.year;
            activeMonthIdx = cand.monthIdx;
            syncMonthPickerValue();
            updateHeaderTitle();
            renderDateColumns();
            bindSignOff();
            break;
        }
    }
}

function getFilteredRosterRows() {
    const q = (document.getElementById("tool-search-input")?.value || "").trim().toLowerCase();
    const targetDate = (document.getElementById("date-search-input")?.value || "").trim();

    if (q) {
        const activeRoster = getRosterForMonth(activeYear, activeMonthIdx);
        const activeExchange = getExchangeForMonth(activeYear, activeMonthIdx);
        const activeKey = getMonthKey(activeYear, activeMonthIdx);

        const currentMatches = activeRoster
            .map((code, i) => ({
                srNo: i + 1,
                code,
                exchange: activeExchange[String(i + 1)] || "",
                monthKey: activeKey,
                monthLabel: `${MONTHS_SHORT[activeMonthIdx]} ${activeYear}`
            }))
            .filter((r) => rowMatchesQuery(r, q) && hasActivityOnDate(r.code, targetDate));

        if (currentMatches.length) {
            return currentMatches;
        }

        const allMonthMatches = [];
        const allMonths = getAll12MonthKeysForYear(activeYear);
        Object.keys(monthRosterMap).forEach((mKey) => {
            if (!allMonths.some((m) => m.monthKey === mKey)) {
                const [yStr, mStr] = mKey.split("-");
                const y = Number(yStr);
                const mIdx = Number(mStr) - 1;
                if (y && mIdx >= 0 && mIdx <= 11) {
                    allMonths.push({ year: y, monthIdx: mIdx, monthKey: mKey });
                }
            }
        });

        allMonths.forEach((mObj) => {
            const rList = getRosterForMonth(mObj.year, mObj.monthIdx);
            const exMap = getExchangeForMonth(mObj.year, mObj.monthIdx);
            rList.forEach((code, i) => {
                const candidateRow = {
                    srNo: i + 1,
                    code,
                    exchange: exMap[String(i + 1)] || "",
                    monthKey: mObj.monthKey,
                    monthLabel: `${MONTHS_SHORT[mObj.monthIdx]} ${mObj.year}`
                };
                if (rowMatchesQuery(candidateRow, q) && hasActivityOnDate(candidateRow.code, targetDate)) {
                    allMonthMatches.push(candidateRow);
                }
            });
        });

        return allMonthMatches;
    }

    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    const exchangeMap = getExchangeForMonth(activeYear, activeMonthIdx);
    const activeKey = getMonthKey(activeYear, activeMonthIdx);

    const rows = roster.map((code, i) => ({
        srNo: i + 1,
        code,
        exchange: exchangeMap[String(i + 1)] || "",
        monthKey: activeKey,
        monthLabel: `${MONTHS_SHORT[activeMonthIdx]} ${activeYear}`
    }));

    return rows.filter((r) => {
        const isAssignedOrActive = !/^TOOL-\d{3}$/.test(r.code) || hasActivityInActiveMonth(r.code) || Boolean(r.exchange);
        const matchesDate = hasActivityOnDate(r.code, targetDate);
        return (targetDate || isAssignedOrActive) && matchesDate;
    });
}

function renderExcelGrid() {
    const tbody = document.getElementById("pm-matrix-tbody");
    if (!tbody) return;

    const totalDays = getDaysInMonth(activeYear, activeMonthIdx);
    const rows = getFilteredRosterRows();

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${totalDays + 4}" class="py-6 text-center text-stone-400">
                    No tool entries found across months for this filter. Use Scan Plan, Bulk Text Plan, or Add Tool.
                </td>
            </tr>
        `;
        return;
    }

    const htmlRows = [];

    rows.forEach(({ srNo, code, exchange, monthLabel }) => {
        const pCells = [];
        const aCells = [];
        const picCells = [];
        const actionBlankCells = Array.from({ length: totalDays }, () => `
            <td class="p-0 bg-[#0f131b]"></td>
        `);

        for (let d = 1; d <= totalDays; d++) {
            const iso = makeIsoDate(activeYear, activeMonthIdx, d);
            const key = `${code}__${iso}`;
            const item = matrixState[key] || {};

            const hasP = Boolean(item.p);
            pCells.push(`
                <td class="p-0 text-center ${hasP ? "bg-amber-400/20 text-amber-300 font-bold" : "bg-[#11151d] text-stone-600 hover:bg-stone-800/80"}">
                    <button
                        type="button"
                        onclick="toggleFlagCell('${escapeAttr(code)}', '${iso}', 'p')"
                        class="w-full h-7 flex items-center justify-center text-[11px] font-bold"
                        title="Sr ${srNo} | ${code} | ${iso} — [P] Plan"
                    >
                        ${hasP ? "P" : ""}
                    </button>
                </td>
            `);

            const hasA = Boolean(item.a);
            aCells.push(`
                <td class="p-0 text-center ${hasA ? "bg-emerald-500/20 text-emerald-300 font-bold" : "bg-[#11151d] text-stone-600 hover:bg-stone-800/80"}">
                    <button
                        type="button"
                        onclick="toggleFlagCell('${escapeAttr(code)}', '${iso}', 'a')"
                        class="w-full h-7 flex items-center justify-center text-[11px] font-bold"
                        title="Sr ${srNo} | ${code} | ${iso} — [A] Attended/Complete"
                    >
                        ${hasA ? "A" : ""}
                    </button>
                </td>
            `);

            const picCount = (item.beforePhoto ? 1 : 0) + (item.afterPhoto ? 1 : 0);
            const picCls =
                picCount === 2
                    ? "bg-sky-500/25 text-sky-200 font-bold"
                    : picCount === 1
                    ? "bg-cyan-500/15 text-cyan-300 font-bold"
                    : "bg-[#11151d] text-stone-500 hover:bg-stone-800/80";

            picCells.push(`
                <td class="p-0 text-center ${picCls}">
                    <button
                        type="button"
                        onclick="openPicModal('${escapeAttr(code)}', '${iso}')"
                        class="w-full h-7 px-0.5 flex items-center justify-center text-[10px] font-bold tracking-tight"
                        title="Sr ${srNo} | ${code} | ${iso} — Before/After Pic (${picCount}/2)"
                    >
                        ${picCount > 0 ? `PIC(${picCount})` : "PIC"}
                    </button>
                </td>
            `);
        }

        const monthBadge = monthLabel
            ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[9px] text-sky-300 font-semibold">${escapeAttr(monthLabel)}</span>`
            : "";

        htmlRows.push(`
            <tr>
                <td rowspan="4" class="sticky left-0 z-10 bg-[#11151d] py-1 px-2 text-center text-stone-300 font-bold align-middle">
                    ${srNo}
                </td>
                <td class="sticky left-12 z-10 bg-[#11151d] py-1 px-2.5 font-bold text-stone-100 align-middle min-w-[227px] max-w-[227px]">
                    <div class="flex items-center justify-between gap-1">
                        <span class="truncate text-xs text-stone-100" title="${escapeAttr(code)}">
                            ${escapeAttr(code)}
                        </span>
                        ${monthBadge}
                    </div>
                </td>
                <td class="sticky left-[275px] z-10 bg-[#11151d] py-1 px-2.5 text-left align-middle min-w-[180px] max-w-[180px]">
                    <span class="block text-[11px] truncate ${exchange ? "text-amber-200 font-semibold" : "text-stone-500"}" title="${escapeAttr(exchange)}">
                        ${exchange ? escapeAttr(exchange) : "—"}
                    </span>
                </td>
                <td class="sticky left-[455px] z-10 bg-[#151a24] px-2 py-0.5 text-center text-[10px] font-bold text-amber-300">
                    P
                </td>
                ${pCells.join("")}
            </tr>
        `);

        htmlRows.push(`
            <tr>
                <td class="sticky left-12 z-10 bg-[#0f131b] py-1 px-2.5 align-middle min-w-[227px] max-w-[227px]">
                    <div class="flex items-center gap-1.5">
                        <button
                            type="button"
                            onclick="editRosterTool(${srNo - 1})"
                            class="px-2 py-0.5 rounded bg-stone-800 hover:bg-amber-400/20 border border-stone-600 hover:border-amber-400/60 text-[10px] text-amber-300 font-bold"
                            title="Edit Tool No for Sr #${srNo}"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onclick="deleteRosterTool(${srNo - 1})"
                            class="px-2 py-0.5 rounded bg-stone-800 hover:bg-rose-500/20 border border-stone-600 hover:border-rose-500/60 text-[10px] text-rose-300 font-bold"
                            title="Delete Tool No for Sr #${srNo}"
                        >
                            Delete
                        </button>
                    </div>
                </td>
                <td class="sticky left-[275px] z-10 bg-[#0f131b] py-1 px-2.5 align-middle min-w-[180px] max-w-[180px]">
                    <div class="flex items-center gap-1.5">
                        <button
                            type="button"
                            onclick="editToolExchange(${srNo - 1})"
                            class="px-2 py-0.5 rounded bg-stone-800 hover:bg-amber-400/20 border border-stone-600 hover:border-amber-400/60 text-[10px] text-amber-300 font-bold"
                            title="Edit Tool Exchange for Sr #${srNo}"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onclick="deleteToolExchange(${srNo - 1})"
                            class="px-2 py-0.5 rounded bg-stone-800 hover:bg-rose-500/20 border border-stone-600 hover:border-rose-500/60 text-[10px] text-rose-300 font-bold"
                            title="Delete Tool Exchange for Sr #${srNo}"
                        >
                            Delete
                        </button>
                    </div>
                </td>
                <td class="sticky left-[455px] z-10 bg-[#151a24] px-2 py-0.5 text-center text-[10px] font-bold text-emerald-300">
                    A
                </td>
                ${aCells.join("")}
            </tr>
        `);

        htmlRows.push(`
            <tr>
                <td rowspan="2" class="sticky left-12 z-10 bg-[#11151d]"></td>
                <td rowspan="2" class="sticky left-[275px] z-10 bg-[#11151d]"></td>
                <td class="sticky left-[455px] z-10 bg-[#151a24] px-2 py-0.5 text-center text-[10px] font-bold text-sky-300">
                    PIC
                </td>
                ${picCells.join("")}
            </tr>
        `);

        htmlRows.push(`
            <tr class="border-b-2 border-stone-600">
                <td class="sticky left-[455px] z-10 bg-[#0f131b] px-2 py-0.5 text-center text-[9px] text-stone-500">
                    ACT
                </td>
                ${actionBlankCells.join("")}
            </tr>
        `);
    });

    tbody.innerHTML = htmlRows.join("");
}

window.editToolExchange = function (index) {
    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    if (index < 0 || index >= roster.length) return;
    const exchangeMap = getExchangeForMonth(activeYear, activeMonthIdx);
    const srKey = String(index + 1);
    const current = exchangeMap[srKey] || "";
    const entered = window.prompt(
        `Enter Tool Exchange for Sr. No ${index + 1} (${roster[index]}):`,
        current
    );
    if (entered === null) return;

    const clean = entered.trim();
    if (clean) {
        exchangeMap[srKey] = clean;
    } else {
        delete exchangeMap[srKey];
    }

    saveMonthExchangeMap(monthExchangeMap);
    renderExcelGrid();
    showToast(`Tool Exchange updated for Sr #${index + 1}`);
};

window.deleteToolExchange = function (index) {
    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    if (index < 0 || index >= roster.length) return;
    const exchangeMap = getExchangeForMonth(activeYear, activeMonthIdx);
    const srKey = String(index + 1);
    if (!exchangeMap[srKey]) {
        showToast("No Tool Exchange to delete");
        return;
    }
    delete exchangeMap[srKey];
    saveMonthExchangeMap(monthExchangeMap);
    renderExcelGrid();
    showToast(`Deleted Tool Exchange for Sr #${index + 1}`);
};

window.toggleFlagCell = function (toolCode, isoDate, field) {
    const key = `${toolCode}__${isoDate}`;
    const current = matrixState[key] || {
        p: false,
        a: false,
        beforePhoto: "",
        afterPhoto: "",
        remark: ""
    };

    const nextVal = !Boolean(current[field]);
    const updated = { ...current, [field]: nextVal };

    if (!updated.p && !updated.a && !updated.beforePhoto && !updated.afterPhoto && !updated.remark) {
        delete matrixState[key];
    } else {
        matrixState[key] = updated;
    }

    syncBackupAndMirror(matrixState);
    renderExcelGrid();

    const label = field === "p" ? "P (Plan)" : "A (Attended/Complete)";
    showToast(`${nextVal ? "Set" : "Cleared"} ${label} for ${toolCode} on ${isoDate}`);
};

window.editRosterTool = function (index) {
    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    if (index < 0 || index >= roster.length) return;
    const current = roster[index];
    const entered = window.prompt(`Enter Tool Number for Sr. No ${index + 1}:`, current);
    if (entered === null) return;

    const clean = entered.trim().toUpperCase();
    if (!clean || clean === current) return;

    const monthPrefix = getActiveMonthPrefix();

    Object.keys(matrixState).forEach((k) => {
        const [codePart, datePart] = k.split("__");
        if (codePart === current && datePart && datePart.startsWith(monthPrefix)) {
            const val = matrixState[k];
            delete matrixState[k];
            matrixState[`${clean}__${datePart}`] = val;
            if (typeof window.syncToolBeforeAfterPicBackup === "function" && val) {
                window.syncToolBeforeAfterPicBackup({
                    toolNo: clean,
                    date: datePart,
                    beforePic: val.beforePhoto || "",
                    afterPic: val.afterPhoto || ""
                });
            }
        }
    });

    roster[index] = clean;
    saveMonthRosterMap(monthRosterMap);
    syncBackupAndMirror(matrixState);
    renderExcelGrid();
    showToast(`Sr #${index + 1} updated to ${clean}`);
};

window.deleteRosterTool = function (index) {
    const roster = getRosterForMonth(activeYear, activeMonthIdx);
    if (index < 0 || index >= roster.length) return;
    const current = roster[index];
    const confirmed = window.confirm(`Delete Tool No "${current}" (Sr #${index + 1}) for ${MONTHS_SHORT[activeMonthIdx]} ${activeYear}?`);
    if (!confirmed) return;

    const monthPrefix = getActiveMonthPrefix();

    Object.keys(matrixState).forEach((k) => {
        const [codePart, datePart] = k.split("__");
        if (codePart === current && datePart && datePart.startsWith(monthPrefix)) {
            delete matrixState[k];
        }
    });

    const exchangeMap = getExchangeForMonth(activeYear, activeMonthIdx);
    delete exchangeMap[String(index + 1)];
    saveMonthExchangeMap(monthExchangeMap);

    roster[index] = createPlaceholderToolCode(index);
    saveMonthRosterMap(monthRosterMap);
    syncBackupAndMirror(matrixState);
    renderExcelGrid();
    showToast(`Deleted ${current} (Sr #${index + 1})`);
};

function syncPicModalUI() {
    const beforeImg = document.getElementById("modal-before-img");
    const beforeEmpty = document.getElementById("modal-before-empty");
    const beforeBtnTxt = document.getElementById("before-upload-label");

    if (draftBeforeUrl) {
        beforeImg.src = draftBeforeUrl;
        beforeImg.classList.remove("hidden");
        beforeEmpty.classList.add("hidden");
        if (beforeBtnTxt) beforeBtnTxt.textContent = "Change / Edit Before Pic";
    } else {
        beforeImg.classList.add("hidden");
        beforeEmpty.classList.remove("hidden");
        if (beforeBtnTxt) beforeBtnTxt.textContent = "Upload Before Pic";
    }

    const afterImg = document.getElementById("modal-after-img");
    const afterEmpty = document.getElementById("modal-after-empty");
    const afterBtnTxt = document.getElementById("after-upload-label");

    if (draftAfterUrl) {
        afterImg.src = draftAfterUrl;
        afterImg.classList.remove("hidden");
        afterEmpty.classList.add("hidden");
        if (afterBtnTxt) afterBtnTxt.textContent = "Change / Edit After Pic";
    } else {
        afterImg.classList.add("hidden");
        afterEmpty.classList.remove("hidden");
        if (afterBtnTxt) afterBtnTxt.textContent = "Upload After Pic";
    }
}

window.openPicModal = function (toolCode, isoDate) {
    activePicTool = toolCode;
    activePicDate = isoDate;
    const key = `${toolCode}__${isoDate}`;
    const existing = matrixState[key] || {};

    draftBeforeUrl = existing.beforePhoto || "";
    draftAfterUrl = existing.afterPhoto || "";
    draftRemarkText = existing.remark || "";

    document.getElementById("pic-modal-title").textContent = `Tool: ${toolCode} • Date: ${isoDate}`;
    document.getElementById("modal-pic-remark").value = draftRemarkText;
    document.getElementById("modal-before-file").value = "";
    document.getElementById("modal-after-file").value = "";

    syncPicModalUI();

    const modal = document.getElementById("pic-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
};

function closePicModal() {
    activePicTool = "";
    activePicDate = "";
    const modal = document.getElementById("pic-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function openLightbox(src) {
    if (!src) return;
    const lb = document.getElementById("image-lightbox");
    const img = document.getElementById("lightbox-full-img");
    img.src = src;
    lb.classList.remove("hidden");
    lb.classList.add("flex");
}

function bindSignOff() {
    const prepEl = document.getElementById("prepared-by-input");
    const appEl = document.getElementById("approved-by-input");
    const key = `ToolSyncPM_SignOff_${getMonthKey(activeYear, activeMonthIdx)}`;

    try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        if (prepEl) prepEl.value = data.preparedBy || "";
        if (appEl) appEl.value = data.approvedBy || "";
    } catch {
        // Ignore storage read errors
    }

    const saveSignOff = () => {
        try {
            localStorage.setItem(
                key,
                JSON.stringify({
                    preparedBy: prepEl?.value.trim() || "",
                    approvedBy: appEl?.value.trim() || ""
                })
            );
        } catch {
            // Ignore storage write errors
        }
    };

    if (prepEl) prepEl.oninput = saveSignOff;
    if (appEl) appEl.oninput = saveSignOff;
}

function decodeDataUrlToUint8Array(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return null;

    const rawType = match[1].toLowerCase();
    const extension =
        rawType === "jpg" || rawType === "jpeg"
            ? "jpeg"
            : rawType === "png"
            ? "png"
            : rawType === "gif"
            ? "gif"
            : "jpeg";

    try {
        const binaryStr = atob(match[2].replace(/\s+/g, ""));
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return { buffer: bytes, extension };
    } catch {
        return null;
    }
}

function resolvePhotosForKey(toolCode, isoDate) {
    const key = `${toolCode}__${isoDate}`;
    const item = matrixState[key] || {};
    let beforePhoto = item.beforePhoto || "";
    let afterPhoto = item.afterPhoto || "";
    let remark = item.remark || "";

    const backupKeys = [PHOTO_BACKUP_KEY, ONLY_PIC_BACKUP_KEY];
    for (const storageKey of backupKeys) {
        if (beforePhoto && afterPhoto) break;
        try {
            const list = JSON.parse(localStorage.getItem(storageKey) || "[]");
            if (!Array.isArray(list)) continue;
            list.forEach((rec) => {
                if (!rec) return;
                const recTool = String(rec.toolCode || rec.toolNo || "").trim().toUpperCase();
                const recDate = String(rec.date || "").trim();
                const picSrc = rec.photo || rec.pic || "";
                if (recTool !== toolCode || recDate !== isoDate || !picSrc) return;

                const stage = String(rec.stage || "").trim().toUpperCase();
                if (stage.includes("AFTER")) {
                    if (!afterPhoto) afterPhoto = picSrc;
                } else if (!beforePhoto) {
                    beforePhoto = picSrc;
                }
                if (!remark && rec.remarks) remark = rec.remarks;
            });
        } catch {
            // Ignore backup read errors
        }
    }

    return { beforePhoto, afterPhoto, remark };
}

function applyThinBorder(cell, colorHex = "FF3F4654") {
    cell.border = {
        top: { style: "thin", color: { argb: colorHex } },
        left: { style: "thin", color: { argb: colorHex } },
        bottom: { style: "thin", color: { argb: colorHex } },
        right: { style: "thin", color: { argb: colorHex } }
    };
}

async function exportPmSheetToExcelWithPics() {
    if (!window.ExcelJS) {
        showToast("ExcelJS library failed to load");
        return;
    }

    showToast("Generating Excel with PM photos...");

    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = "ToolSync PM";
    workbook.created = new Date();

    const monthTag = getMonthKey(activeYear, activeMonthIdx);
    const totalDays = getDaysInMonth(activeYear, activeMonthIdx);
    const rows = getFilteredRosterRows();

    const sheet = workbook.addWorksheet("PM Plan Matrix");
    const totalCols = 4 + totalDays;

    sheet.mergeCells(1, 1, 1, totalCols);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `MOULD PREVENTIVE MAINTENANCE PLAN ${MONTHS_UPPER[activeMonthIdx]} - ${activeYear}`;
    titleCell.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FFFCD34D" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1017" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 26;

    const headerRow = sheet.getRow(2);
    headerRow.values = [
        "Sr. No",
        "TOOL NUMBER",
        "TOOL EXCHANGE",
        "GRID",
        ...Array.from({ length: totalDays }, (_, idx) => `${idx + 1}/${MONTHS_SHORT[activeMonthIdx]}`)
    ];
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF151A24" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        applyThinBorder(cell);
    });

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 26;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 8;
    for (let c = 5; c <= totalCols; c++) {
        sheet.getColumn(c).width = 9;
    }

    const picSheet = workbook.addWorksheet("PM Photos");
    picSheet.columns = [
        { header: "Sr. No", key: "sr", width: 10 },
        { header: "TOOL NUMBER", key: "tool", width: 25 },
        { header: "DATE", key: "date", width: 15 },
        { header: "BEFORE PM PHOTO", key: "before", width: 32 },
        { header: "AFTER PM PHOTO", key: "after", width: 32 },
        { header: "REMARK", key: "remark", width: 34 }
    ];

    const picHeader = picSheet.getRow(1);
    picHeader.height = 24;
    picHeader.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF151A24" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        applyThinBorder(cell);
    });

    const targetRowByKey = new Map();
    let picRowCursor = 2;
    const photoEntriesToEmbed = [];

    rows.forEach(({ srNo, code, exchange }) => {
        for (let d = 1; d <= totalDays; d++) {
            const iso = makeIsoDate(activeYear, activeMonthIdx, d);
            const resolvedPics = resolvePhotosForKey(code, iso);
            if (resolvedPics.beforePhoto || resolvedPics.afterPhoto || resolvedPics.remark) {
                const entryKey = `${code}__${iso}`;
                targetRowByKey.set(entryKey, `B${picRowCursor}`);
                photoEntriesToEmbed.push({
                    srNo,
                    code,
                    exchange: exchange || "—",
                    date: iso,
                    beforePhoto: resolvedPics.beforePhoto,
                    afterPhoto: resolvedPics.afterPhoto,
                    remark: resolvedPics.remark
                });
                picRowCursor += 1;
            }
        }
    });

    let currentRowNum = 3;

    rows.forEach(({ srNo, code, exchange }) => {
        const pRowNum = currentRowNum;
        const aRowNum = currentRowNum + 1;
        const picRowNum = currentRowNum + 2;

        sheet.mergeCells(pRowNum, 1, picRowNum, 1);
        sheet.mergeCells(pRowNum, 2, picRowNum, 2);
        sheet.mergeCells(pRowNum, 3, picRowNum, 3);

        const srCell = sheet.getCell(pRowNum, 1);
        srCell.value = srNo;
        srCell.alignment = { horizontal: "center", vertical: "middle" };
        srCell.font = { name: "Calibri", size: 10, bold: true };

        const codeCell = sheet.getCell(pRowNum, 2);
        codeCell.value = code;
        codeCell.alignment = { horizontal: "left", vertical: "middle" };
        codeCell.font = { name: "Calibri", size: 10, bold: true };

        const exCell = sheet.getCell(pRowNum, 3);
        exCell.value = exchange || "—";
        exCell.alignment = { horizontal: "left", vertical: "middle" };
        exCell.font = { name: "Calibri", size: 10 };

        const pLabel = sheet.getCell(pRowNum, 4);
        pLabel.value = "P";
        pLabel.alignment = { horizontal: "center", vertical: "middle" };
        pLabel.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFD97706" } };

        const aLabel = sheet.getCell(aRowNum, 4);
        aLabel.value = "A";
        aLabel.alignment = { horizontal: "center", vertical: "middle" };
        aLabel.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF059669" } };

        const picLabel = sheet.getCell(picRowNum, 4);
        picLabel.value = "PIC";
        picLabel.alignment = { horizontal: "center", vertical: "middle" };
        picLabel.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0284C7" } };

        for (let d = 1; d <= totalDays; d++) {
            const iso = makeIsoDate(activeYear, activeMonthIdx, d);
            const item = matrixState[`${code}__${iso}`] || {};
            const resolvedPics = resolvePhotosForKey(code, iso);
            const colIdx = 4 + d;

            const pCell = sheet.getCell(pRowNum, colIdx);
            pCell.value = item.p ? "P" : "";
            pCell.alignment = { horizontal: "center", vertical: "middle" };
            if (item.p) {
                pCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF92400E" } };
                pCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
            }

            const aCell = sheet.getCell(aRowNum, colIdx);
            aCell.value = item.a ? "A" : "";
            aCell.alignment = { horizontal: "center", vertical: "middle" };
            if (item.a) {
                aCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF065F46" } };
                aCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
            }

            const picCount = (resolvedPics.beforePhoto ? 1 : 0) + (resolvedPics.afterPhoto ? 1 : 0);
            const picCell = sheet.getCell(picRowNum, colIdx);
            picCell.alignment = { horizontal: "center", vertical: "middle" };

            if (picCount > 0) {
                const targetCellRef = targetRowByKey.get(`${code}__${iso}`) || "A2";
                picCell.value = {
                    text: `PIC(${picCount})`,
                    hyperlink: `#'PM Photos'!${targetCellRef}`,
                    tooltip: `Click to view Before/After PM Photos for ${code} (${iso})`
                };
                picCell.font = {
                    name: "Calibri",
                    size: 9,
                    bold: true,
                    underline: true,
                    color: { argb: "FF075985" }
                };
                picCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
            } else {
                picCell.value = "";
            }
        }

        [pRowNum, aRowNum, picRowNum].forEach((rNum) => {
            sheet.getRow(rNum).height = 19;
            for (let c = 1; c <= totalCols; c++) {
                applyThinBorder(sheet.getCell(rNum, c));
            }
        });

        currentRowNum += 3;
    });

    const prepBy = document.getElementById("prepared-by-input")?.value.trim() || "";
    const appBy = document.getElementById("approved-by-input")?.value.trim() || "";
    const signRow = sheet.getRow(currentRowNum + 1);
    signRow.getCell(2).value = `Prepared By : ${prepBy}`;
    signRow.getCell(3).value = `Approved By : ${appBy}`;
    signRow.font = { name: "Calibri", size: 10, bold: true };

    photoEntriesToEmbed.forEach((entry, idx) => {
        const excelRowNumber = 2 + idx;
        const row = picSheet.getRow(excelRowNumber);
        row.height = 120;
        row.getCell(1).value = entry.srNo;
        row.getCell(2).value = entry.code;
        row.getCell(3).value = entry.date;
        row.getCell(6).value = entry.remark;

        for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.alignment = {
                horizontal: c === 2 || c === 6 ? "left" : "center",
                vertical: "middle",
                wrapText: true
            };
            cell.font = { name: "Calibri", size: 10 };
            applyThinBorder(cell);
        }

        const zeroBasedRow = excelRowNumber - 1;

        const decodedBefore = decodeDataUrlToUint8Array(entry.beforePhoto);
        if (decodedBefore) {
            const beforeImgId = workbook.addImage({
                buffer: decodedBefore.buffer,
                extension: decodedBefore.extension
            });
            picSheet.addImage(beforeImgId, {
                tl: { col: 3.15, row: zeroBasedRow + 0.08 },
                ext: { width: 165, height: 135 },
                editAs: "oneCell"
            });
        } else {
            row.getCell(4).value = "No Before Photo";
        }

        const decodedAfter = decodeDataUrlToUint8Array(entry.afterPhoto);
        if (decodedAfter) {
            const afterImgId = workbook.addImage({
                buffer: decodedAfter.buffer,
                extension: decodedAfter.extension
            });
            picSheet.addImage(afterImgId, {
                tl: { col: 4.15, row: zeroBasedRow + 0.08 },
                ext: { width: 165, height: 135 },
                editAs: "oneCell"
            });
        } else {
            row.getCell(5).value = "No After Photo";
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Mould_PM_Plan_${monthTag}_With_Pics.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Excel downloaded with clickable PIC links & photos!");
}

function initFrontPageGrid() {
    ensureBackupControlsInToolbar();

    const mpEl = document.getElementById("month-picker");
    if (mpEl && mpEl.value && mpEl.value.includes("-")) {
        const [yStr, mStr] = mpEl.value.split("-");
        const y = Number(yStr);
        const mIdx = Number(mStr) - 1;
        if (y && mIdx >= 0 && mIdx <= 11) {
            activeYear = y;
            activeMonthIdx = mIdx;
        }
    } else {
        syncMonthPickerValue();
    }

    Object.entries(matrixState).forEach(([k, entry]) => {
        if (!entry) return;
        const [code, isoDate] = k.split("__");
        if (!code || !isoDate) return;
        const [yStr, mStr] = isoDate.split("-");
        const y = Number(yStr);
        const mIdx = Number(mStr) - 1;
        if (y && mIdx >= 0 && mIdx <= 11) {
            ensureToolInMonthRoster(code.trim().toUpperCase(), y, mIdx);
        }
    });

    saveMonthRosterMap(monthRosterMap);
    saveMonthExchangeMap(monthExchangeMap);
    syncBackupAndMirror(matrixState);

    updateHeaderTitle();
    renderDateColumns();
    renderExcelGrid();
    bindSignOff();

    document.getElementById("toggle-scan-plan-btn")?.addEventListener("click", () => {
        document.getElementById("scan-plan-panel")?.classList.toggle("hidden");
    });

    document.getElementById("scan-plan-file-input")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await runPlanPhotoOcr(file);
    });

    document.getElementById("reparse-scan-text-btn")?.addEventListener("click", () => {
        const ta = document.getElementById("scan-arranged-textarea");
        const countBadge = document.getElementById("scan-detected-count");
        if (!ta) return;
        const arranged = arrangeOcrTextToDateAndSr(ta.value);
        if (arranged.arrangedText) {
            ta.value = arranged.arrangedText;
        }
        if (countBadge) {
            countBadge.textContent = `${arranged.assignments.length} items detected`;
        }
        showToast("Text arranged date & Sr/Tool wise");
    });

    document.getElementById("apply-scanned-plan-btn")?.addEventListener("click", () => {
        const ta = document.getElementById("scan-arranged-textarea");
        const clearOldP = Boolean(document.getElementById("scan-replace-existing-p")?.checked);
        const assignments = parseArrangedOrBulkAssignments(ta?.value || "", activeYear, activeMonthIdx);
        if (!assignments.length) {
            showToast("No valid date & tool/Sr entries found");
            return;
        }
        const count = applyAssignmentsToMatrix(assignments, clearOldP);
        showToast(`Fixed & applied ${count} [P] entries in ${MONTHS_SHORT[activeMonthIdx]} ${activeYear}`);
    });

    document.getElementById("toggle-bulk-plan-btn")?.addEventListener("click", () => {
        document.getElementById("bulk-plan-panel")?.classList.toggle("hidden");
    });

    document.getElementById("sample-bulk-plan-btn")?.addEventListener("click", () => {
        const ta = document.getElementById("bulk-plan-textarea");
        if (!ta) return;
        const mLabel = MONTHS_SHORT[activeMonthIdx];
        ta.value = [
            `2/${mLabel}: TOOL-001, TOOL-002, TOOL-003`,
            `3/${mLabel}: TOOL-004, TOOL-005, TOOL-006`,
            `4/${mLabel}: TOOL-007, TOOL-008, TOOL-009`
        ].join("\n");
    });

    document.getElementById("apply-bulk-plan-btn")?.addEventListener("click", () => {
        const raw = document.getElementById("bulk-plan-textarea")?.value || "";
        const clearOldP = Boolean(document.getElementById("bulk-replace-existing-p")?.checked);
        const assignments = parseArrangedOrBulkAssignments(raw, activeYear, activeMonthIdx);
        if (!assignments.length) {
            showToast("No valid date + mould lines found");
            return;
        }
        const count = applyAssignmentsToMatrix(assignments, clearOldP);
        showToast(`Applied ${count} date-wise [P] entries in ${MONTHS_SHORT[activeMonthIdx]} ${activeYear}`);
    });

    document.getElementById("export-excel-btn")?.addEventListener("click", exportPmSheetToExcelWithPics);

    document.getElementById("month-picker")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (!val || !val.includes("-")) return;
        preSearchMonth = null;
        const [yStr, mStr] = val.split("-");
        activeYear = Number(yStr);
        activeMonthIdx = Number(mStr) - 1;
        updateHeaderTitle();
        renderDateColumns();
        renderExcelGrid();
        bindSignOff();
    });

    document.getElementById("tool-search-input")?.addEventListener("input", (e) => {
        const q = (e.target.value || "").trim().toLowerCase();
        handleCrossMonthSearchSwitch(q);
        renderExcelGrid();
    });

    document.getElementById("date-search-input")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val && val.includes("-")) {
            const [yStr, mStr] = val.split("-");
            const y = Number(yStr);
            const mIdx = Number(mStr) - 1;
            if (y && mIdx >= 0 && mIdx <= 11 && (y !== activeYear || mIdx !== activeMonthIdx)) {
                preSearchMonth = null;
                activeYear = y;
                activeMonthIdx = mIdx;
                syncMonthPickerValue();
                updateHeaderTitle();
                renderDateColumns();
                bindSignOff();
            }
        }
        renderExcelGrid();
    });

    document.getElementById("clear-date-search-btn")?.addEventListener("click", () => {
        const dateInput = document.getElementById("date-search-input");
        if (dateInput) dateInput.value = "";
        renderExcelGrid();
    });

    document.getElementById("toggle-add-tool-btn")?.addEventListener("click", () => {
        document.getElementById("add-tool-panel")?.classList.toggle("hidden");
    });

    document.getElementById("add-tool-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const srVal = Number(document.getElementById("new-tool-sr")?.value);
        const toolVal = document.getElementById("new-tool-number")?.value.trim().toUpperCase();
        const dateVal = document.getElementById("new-tool-pm-date")?.value || makeIsoDate(activeYear, activeMonthIdx, 1);
        const markVal = (document.getElementById("new-tool-mark")?.value || "P").trim().toUpperCase();

        if (!toolVal) return;

        const [dy, dm] = dateVal.split("-").map(Number);
        const targetY = dy || activeYear;
        const targetMIdx = dm ? dm - 1 : activeMonthIdx;
        const targetRoster = getRosterForMonth(targetY, targetMIdx);

        if (srVal >= 1 && srVal <= TOTAL_PM_TOOLS) {
            targetRoster[srVal - 1] = toolVal;
        } else if (!targetRoster.includes(toolVal)) {
            const emptyIdx = targetRoster.findIndex((c) => /^TOOL-\d{3}$/.test(c));
            targetRoster[emptyIdx !== -1 ? emptyIdx : TOTAL_PM_TOOLS - 1] = toolVal;
        }

        const key = `${toolVal}__${dateVal}`;
        const prev = matrixState[key] || { p: false, a: false, beforePhoto: "", afterPhoto: "", remark: "" };
        if (markVal === "A") {
            prev.a = true;
        } else {
            prev.p = true;
        }
        matrixState[key] = prev;

        saveMonthRosterMap(monthRosterMap);
        syncBackupAndMirror(matrixState);

        preSearchMonth = null;
        activeYear = targetY;
        activeMonthIdx = targetMIdx;
        syncMonthPickerValue();

        document.getElementById("new-tool-number").value = "";
        document.getElementById("new-tool-sr").value = "";
        updateHeaderTitle();
        renderDateColumns();
        renderExcelGrid();
        bindSignOff();
        showToast(`Saved ${toolVal} on ${dateVal}`);
    });

    document.getElementById("modal-before-file")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        draftBeforeUrl = await compressImageToDataUrl(file);
        syncPicModalUI();
    });

    document.getElementById("modal-after-file")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        draftAfterUrl = await compressImageToDataUrl(file);
        syncPicModalUI();
    });

    document.getElementById("remove-before-pic-btn")?.addEventListener("click", () => {
        draftBeforeUrl = "";
        document.getElementById("modal-before-file").value = "";
        syncPicModalUI();
    });

    document.getElementById("remove-after-pic-btn")?.addEventListener("click", () => {
        draftAfterUrl = "";
        document.getElementById("modal-after-file").value = "";
        syncPicModalUI();
    });

    document.getElementById("modal-before-img")?.addEventListener("click", () => openLightbox(draftBeforeUrl));
    document.getElementById("modal-after-img")?.addEventListener("click", () => openLightbox(draftAfterUrl));
    document.getElementById("close-lightbox-btn")?.addEventListener("click", () => {
        const lb = document.getElementById("image-lightbox");
        lb.classList.add("hidden");
        lb.classList.remove("flex");
    });

    document.getElementById("close-pic-modal-btn")?.addEventListener("click", closePicModal);
    document.getElementById("cancel-pic-modal-btn")?.addEventListener("click", closePicModal);

    document.getElementById("save-pic-modal-btn")?.addEventListener("click", () => {
        if (!activePicTool || !activePicDate) return;
        const key = `${activePicTool}__${activePicDate}`;
        const remarkVal = (document.getElementById("modal-pic-remark")?.value || "").trim();
        const prev = matrixState[key] || { p: false, a: false };

        const nextEntry = {
            ...prev,
            beforePhoto: draftBeforeUrl,
            afterPhoto: draftAfterUrl,
            remark: remarkVal
        };

        if (!nextEntry.p && !nextEntry.a && !nextEntry.beforePhoto && !nextEntry.afterPhoto && !nextEntry.remark) {
            delete matrixState[key];
        } else {
            matrixState[key] = nextEntry;
        }

        if (typeof window.syncToolBeforeAfterPicBackup === "function") {
            window.syncToolBeforeAfterPicBackup({
                toolNo: activePicTool,
                date: activePicDate,
                beforePic: draftBeforeUrl,
                afterPic: draftAfterUrl
            });
        }

        const savedOk = syncBackupAndMirror(matrixState);
        renderExcelGrid();
        closePicModal();
        if (savedOk) {
            showToast(`Saved photos for ${activePicTool} (${activePicDate})`);
        }
    });
}

initFrontPageGrid();