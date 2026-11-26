const STORAGE = {
  transactions: "pinkyWalletTransactions",
  challenges: "pinkyWalletChallenges",
  recurring: "pinkyWalletRecurring",
  theme: "pinkyWalletTheme",
  wallets: "pinkyWalletWallets",
  debts: "pinkyWalletDebts",
  settings: "pinkyWalletSettings",
  budgets: "pinkyWalletBudgets",
  presets: "pinkyWalletPresets",
  customCategories: "pinkyWalletCustomCategories",
  auth: "pinkyWalletAuth",
  session: "pinkyWalletSession"
};

const baseCategories = {
  income: ["Gaji", "Uang Saku", "Bonus", "Hadiah", "Bisnis", "Lainnya"],
  expense: ["Makanan", "Belanja", "Transportasi", "Skincare", "Hiburan", "Pendidikan", "Tagihan", "Kesehatan", "Lainnya"]
};

const baseIcons = {
  Makanan:"🍜", Belanja:"🛍️", Transportasi:"🚗", Skincare:"🧴",
  Hiburan:"🎮", Pendidikan:"📚", Tagihan:"🧾", Kesehatan:"🩺",
  Gaji:"💼", "Uang Saku":"🪙", Bonus:"🎁", Hadiah:"🎀", Bisnis:"📈", Lainnya:"💸"
};

const THEME_STYLE_META = {
  classic: {
    label: "Classic Soft",
    title: "Lembut & Hangat",
    desc: "Sudut membulat ramah dengan bayangan pastel yang kalem."
  },
  "ios18-glass": {
    label: "iOS 18 Glass 🫧",
    title: "Kaca Translusen",
    desc: "Efek blur kaca dengan kilau tipis di tepi kartu."
  },
  bento: {
    label: "Bento Studio 🍱",
    title: "Rapi & Terukur",
    desc: "Batas kartu studio dengan angka tabular yang presisi."
  },
  "cozy-paper": {
    label: "Cozy Paper 📖",
    title: "Jurnal Kertas Hangat",
    desc: "Garis halus jurnal, border putus-putus, dan judul bernuansa klasik."
  },
  "cyber-pastel": {
    label: "Neon Cyber Pastel ⚡",
    title: "Kilau Pastel Berani",
    desc: "Aksen cahaya lembut di tepi kartu dan tombol utama."
  },
  "minimal-flat": {
    label: "Minimalist Flat 🤍",
    title: "Bersih & Ringan",
    desc: "Tanpa bayangan tebal agar fokus penuh ke data keuangan."
  }
};

const $ = id => document.getElementById(id);
const read = (key, fallback = []) => {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
};
const readObj = (key, fallback = {}) => {
  try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === "object" && !Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
let appSettings = readObj(STORAGE.settings, {});
const money = value => new Intl.NumberFormat("id-ID", {style:"currency",currency:appSettings.currency || "IDR",maximumFractionDigits:0}).format(Number(value) || 0);
const dateISO = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const today = new Date();
const todayString = dateISO(today);
let transactions = read(STORAGE.transactions);
let challenges = read(STORAGE.challenges);
let recurring = read(STORAGE.recurring);
let budgets = readObj(STORAGE.budgets, {});
let presets = read(STORAGE.presets);
let customCategories = readObj(STORAGE.customCategories, { income: [], expense: [] });
if (!Array.isArray(customCategories.income)) customCategories.income = [];
if (!Array.isArray(customCategories.expense)) customCategories.expense = [];

function getCategories(type) {
  const base = baseCategories[type] || baseCategories.expense;
  const customNames = (customCategories[type] || []).map(c => c.name);
  return [...new Set([...base, ...customNames])];
}

let editingId = null;
let selectedCalendarDate = todayString;
let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
let toastTimer;
let trendHoverDay = null;

// AUTO FORMAT RIBUAN UNTUK INPUT NOMINAL (100000 -> 100.000)
function formatDigits(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}
function parseMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
function bindMoneyInputs() {
  document.querySelectorAll("[data-money-input]").forEach(input => {
    input.addEventListener("input", () => {
      const digitsBeforeCursor = input.value.slice(0, input.selectionStart).replace(/\D/g, "").length;
      const formatted = formatDigits(input.value);
      input.value = formatted;
      let count = 0;
      let pos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) count++;
        if (count === digitsBeforeCursor) {
          pos = i + 1;
          break;
        }
      }
      if (digitsBeforeCursor === 0) pos = 0;
      input.setSelectionRange(pos, pos);
    });
  });
}

function saveAll() {
  localStorage.setItem(STORAGE.transactions, JSON.stringify(transactions));
  localStorage.setItem(STORAGE.challenges, JSON.stringify(challenges));
  localStorage.setItem(STORAGE.recurring, JSON.stringify(recurring));
  localStorage.setItem(STORAGE.budgets, JSON.stringify(budgets));
  localStorage.setItem(STORAGE.presets, JSON.stringify(presets));
  localStorage.setItem(STORAGE.customCategories, JSON.stringify(customCategories));
}
function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function formatDate(value, options = {day:"numeric",month:"short",year:"numeric"}) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", options);
}
function monthName(date) {
  return date.toLocaleDateString("id-ID", {month:"long",year:"numeric"});
}
function getTotals(list) {
  return list.reduce((acc, item) => {
    if (item.type === "income") acc.income += Number(item.amount) || 0;
    else acc.expense += Number(item.amount) || 0;
    acc.balance = acc.income - acc.expense;
    return acc;
  }, {income:0,expense:0,balance:0});
}
function sortTransactions(list) {
  return [...list].sort((a,b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}
function iconFor(t) {
  if (t.type === "income") {
    const found = (customCategories.income || []).find(c => c.name === t.category);
    return found?.emoji || baseIcons[t.category] || "💰";
  }
  const found = (customCategories.expense || []).find(c => c.name === t.category);
  return found?.emoji || baseIcons[t.category] || "💸";
}

// DASHBOARD + TRANSACTION FORM + QUICK PRESET
function renderDashboard() {
  const totals = getTotals(transactions);
  $("balance").textContent = money(totals.balance);
  $("income").textContent = money(totals.income);
  $("expense").textContent = money(totals.expense);
}
function updateCategories(type, selected = "") {
  const options = getCategories(type);
  $("category").innerHTML = options.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (options.includes(selected)) $("category").value = selected;
}
function renderPresets() {
  if (!$("presetList")) return;
  if (!presets.length) {
    $("presetList").innerHTML = `<span class="field-help">Belum ada template cepat. Klik <b>＋ Simpan Template</b> untuk transaksi yang sering berulang.</span>`;
    return;
  }
  $("presetList").innerHTML = presets.map(p => `
    <span class="preset-chip" onclick="applyPreset('${escapeHTML(p.id)}')" title="Klik untuk isi otomatis">
      <span>${p.type === "income" ? "💰" : "⚡"} ${escapeHTML(p.name)} (${money(p.amount)})</span>
      <button type="button" class="chip-del" aria-label="Hapus template" onclick="event.stopPropagation();deletePreset('${escapeHTML(p.id)}')">×</button>
    </span>
  `).join("");
}
window.applyPreset = id => {
  const p = presets.find(item => item.id === id);
  if (!p) return;
  $("type").value = p.type;
  updateCategories(p.type, p.category);
  $("description").value = p.name;
  $("amount").value = formatDigits(p.amount);
  if (!$("date").value) $("date").value = todayString;
  $("transactionNote").value = p.note || "";
  notify(`Template "${p.name}" diterapkan ⚡`);
};
window.deletePreset = id => {
  presets = presets.filter(item => item.id !== id);
  saveAll();
  renderPresets();
  notify("Template dihapus.");
};
function fillPresetCategories(type = "expense") {
  const list = getCategories(type);
  $("presetCategory").innerHTML = list.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
}
$("openPresetDialogBtn")?.addEventListener("click", () => {
  $("presetForm").reset();
  const currentType = $("type").value || "expense";
  $("presetType").value = currentType;
  fillPresetCategories(currentType);
  if ($("description").value.trim()) $("presetName").value = $("description").value.trim();
  if (parseMoneyInput($("amount").value) > 0) $("presetAmount").value = $("amount").value;
  if ($("transactionNote").value.trim()) $("presetNote").value = $("transactionNote").value.trim();
  $("presetDialog").showModal();
});
$("presetType")?.addEventListener("change", e => fillPresetCategories(e.target.value));
$("presetForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const name = $("presetName").value.trim();
  const type = $("presetType").value;
  const category = $("presetCategory").value;
  const amount = parseMoneyInput($("presetAmount").value);
  const note = $("presetNote").value.trim();
  if (!name || !Number.isFinite(amount) || amount <= 0) return notify("Isi nama dan nominal template dengan benar.");
  presets.push({ id: uid(), name, type, category, amount, note });
  saveAll();
  renderPresets();
  $("presetDialog").close();
  notify("Template cepat disimpan ⚡");
});

function openTransactionForm(type = "expense", transaction = null, isDuplicate = false) {
  $("transactionPanel").hidden = false;
  if (transaction) {
    editingId = isDuplicate ? null : transaction.id;
    $("formTitle").textContent = isDuplicate ? "Salin Transaksi 📋" : "Edit Transaksi ✏️";
    $("type").value = transaction.type;
    $("description").value = transaction.description;
    $("amount").value = formatDigits(transaction.amount);
    $("date").value = isDuplicate ? todayString : transaction.date;
    $("transactionNote").value = transaction.note || "";
    $("transactionWallet").value = transaction.walletId || "cash";
    pendingTransactionPhoto = isDuplicate ? "" : (transaction.photo || "");
    renderPhotoPreview();
    updateCategories(transaction.type, transaction.category);
  } else {
    editingId = null;
    $("formTitle").textContent = "Tambah Transaksi 💗";
    $("transactionForm").reset();
    $("type").value = type;
    $("date").value = todayString;
    $("transactionNote").value = "";
    $("transactionWallet").value = "cash";
    pendingTransactionPhoto = "";
    renderPhotoPreview();
    updateCategories(type);
  }
  $("transactionPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
function closeTransactionForm() {
  $("transactionPanel").hidden = true;
  $("transactionForm").reset();
  editingId = null;
  pendingTransactionPhoto = "";
  renderPhotoPreview();
}
$("addIncomeBtn").addEventListener("click", () => openTransactionForm("income"));
$("addExpenseBtn").addEventListener("click", () => openTransactionForm("expense"));
$("closeFormBtn").addEventListener("click", closeTransactionForm);
$("cancelFormBtn").addEventListener("click", closeTransactionForm);
$("type").addEventListener("change", e => updateCategories(e.target.value));
$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const type = $("type").value;
  const description = $("description").value.trim();
  const amount = parseMoneyInput($("amount").value);
  const date = $("date").value;
  if (!description || !date || !Number.isFinite(amount) || amount <= 0) return notify("Isi data transaksi dengan benar.");
  const oldItem = editingId ? transactions.find(t => t.id === editingId) : null;
  const item = {
    ...(oldItem || {}),
    id: editingId || uid(),
    type,
    description,
    category: $("category").value,
    amount,
    date,
    walletId: $("transactionWallet").value || "cash",
    note: $("transactionNote").value.trim(),
    photo: pendingTransactionPhoto || ""
  };
  if (editingId) transactions = transactions.map(t => t.id === editingId ? item : t);
  else transactions.push(item);
  saveAll();
  closeTransactionForm();
  renderAll();
  notify("Transaksi berhasil disimpan 💗");
});
function editTransaction(id) {
  const item = transactions.find(t => t.id === id);
  if (item) openTransactionForm(item.type, item, false);
}
function duplicateTransaction(id) {
  const item = transactions.find(t => t.id === id);
  if (item) openTransactionForm(item.type, item, true);
}
function deleteTransaction(id) {
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveAll();
  renderAll();
  notify("Transaksi dihapus.");
}
window.editTransaction = editTransaction;
window.duplicateTransaction = duplicateTransaction;
window.deleteTransaction = deleteTransaction;

function updateHistoryCategories() {
  const type = $("filterType").value;
  const list = type === "all" ? [...new Set([...getCategories("income"), ...getCategories("expense")])] : getCategories(type);
  const previous = $("filterCategory").value;
  $("filterCategory").innerHTML = `<option value="all">Semua kategori</option>` + list.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (list.includes(previous)) $("filterCategory").value = previous;
}
function renderHistory() {
  const keyword = ($("historySearch")?.value || "").trim().toLowerCase();
  const month = $("historyMonth").value;
  const type = $("filterType").value;
  const category = $("filterCategory").value;
  const filtered = sortTransactions(transactions.filter(t => {
    if (month && !t.date.startsWith(month)) return false;
    if (type !== "all" && t.type !== type) return false;
    if (category !== "all" && t.category !== category) return false;
    if (keyword) {
      const hay = `${t.description || ""} ${t.note || ""} ${t.category || ""}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  }));
  if (!filtered.length) {
    $("transactionList").innerHTML = `<div class="empty">🌷 Belum ada transaksi yang cocok.</div>`;
    return;
  }
  $("transactionList").innerHTML = filtered.map(t => `
    <div class="transaction">
      <div class="transaction-icon">${iconFor(t)}</div>
      <div class="transaction-info">
        <strong>${escapeHTML(t.description)}</strong>
        <small>${escapeHTML(t.category)} • ${formatDate(t.date)} • ${escapeHTML(walletName(t.walletId))}${t.note ? " • " + escapeHTML(t.note) : ""}</small>
      </div>
      <div class="transaction-right">
        <strong class="${t.type === "income" ? "plus" : "minus"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</strong>
        <div class="transaction-buttons">
          ${t.photo ? `<button type="button" onclick="showTransactionPhoto('${escapeHTML(t.id)}')">Bukti</button>` : ""}
          <button type="button" onclick="duplicateTransaction('${escapeHTML(t.id)}')">Salin</button>
          <button type="button" onclick="editTransaction('${escapeHTML(t.id)}')">Edit</button>
          <button type="button" onclick="deleteTransaction('${escapeHTML(t.id)}')">Hapus</button>
        </div>
      </div>
    </div>`).join("");
}

// CALENDAR
function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  $("calendarMonthLabel").textContent = monthName(calendarCursor);
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const startOffset = firstDay;
  const cells = Math.ceil((startOffset + daysInMonth)/7)*7;
  const weekdays = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  let html = weekdays.map(d => `<div class="weekday">${d}</div>`).join("");
  const totalsByDate = {};
  transactions.forEach(t => {
    if (!totalsByDate[t.date]) totalsByDate[t.date] = {income:false,expense:false};
    totalsByDate[t.date][t.type] = true;
  });
  for (let i=0;i<cells;i++) {
    const day = i-startOffset+1;
    const date = new Date(year,month,day);
    const key = dateISO(date);
    const inMonth = day >= 1 && day <= daysInMonth;
    const marks = totalsByDate[key];
    const classes = ["calendar-day",!inMonth?"muted-day":"",key===todayString?"today":"",key===selectedCalendarDate?"selected":""].filter(Boolean).join(" ");
    html += `<button type="button" class="${classes}" data-calendar-date="${key}" ${!inMonth?'disabled':''}>
      <span>${date.getDate()}</span><span class="dots">${marks?.income?'<i></i>':""}${marks?.expense?'<i class="expense-mark"></i>':""}</span>
    </button>`;
  }
  $("calendarGrid").innerHTML = html;
  $("calendarGrid").querySelectorAll("[data-calendar-date]").forEach(btn => btn.addEventListener("click", () => {
    selectedCalendarDate = btn.dataset.calendarDate;
    renderCalendar();
    renderSelectedDay();
  }));
  renderSelectedDay();
}
function renderSelectedDay() {
  $("selectedDateLabel").textContent = formatDate(selectedCalendarDate,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const list = sortTransactions(transactions.filter(t => t.date === selectedCalendarDate));
  const totals = getTotals(list);
  $("selectedDayTotal").textContent = list.length ? `Net ${money(totals.balance)}` : "";
  if (!list.length) {
    $("selectedDayTransactions").innerHTML = `<p class="empty-state">Belum ada transaksi pada tanggal ini 🌷</p>`;
    return;
  }
  $("selectedDayTransactions").innerHTML = list.map(t => `<div class="mini-transaction"><span>${iconFor(t)} ${escapeHTML(t.description)}</span><strong class="${t.type==="income"?"plus":"minus"}">${t.type==="income"?"+":"−"}${money(t.amount)}</strong></div>`).join("");
}
$("prevMonth").addEventListener("click", () => {calendarCursor.setMonth(calendarCursor.getMonth()-1);selectedCalendarDate=dateISO(calendarCursor);renderCalendar();});
$("nextMonth").addEventListener("click", () => {calendarCursor.setMonth(calendarCursor.getMonth()+1);selectedCalendarDate=dateISO(calendarCursor);renderCalendar();});

// DAILY TREND CANVAS
let trendPointsCache = [];
function renderDailyTrendChart() {
  const canvas = $("dailyTrendCanvas");
  if (!canvas) return;
  const monthStr = $("analyticsMonth").value || todayString.slice(0,7);
  const [y, m] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const expByDay = Array(daysInMonth).fill(0);
  const incByDay = Array(daysInMonth).fill(0);
  transactions.forEach(t => {
    if (!t.date.startsWith(monthStr)) return;
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= daysInMonth) {
      if (t.type === "expense") expByDay[d - 1] += Number(t.amount) || 0;
      else incByDay[d - 1] += Number(t.amount) || 0;
    }
  });

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(280, rect.width || canvas.parentElement.clientWidth - 28 || 600);
  const cssHeight = 190;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const styles = getComputedStyle(document.body);
  const isDark = document.body.classList.contains("dark");
  const gridColor = styles.getPropertyValue("--line").trim() || (isDark ? "#4a394b" : "#f3e3ec");
  const textColor = styles.getPropertyValue("--muted").trim() || (isDark ? "#bda8b6" : "#9c8290");
  const expColor = styles.getPropertyValue("--pink-dark").trim() || "#d95791";
  const incColor = styles.getPropertyValue("--green").trim() || "#39a879";

  const padL = 12, padR = 12, padT = 18, padB = 26;
  const plotW = Math.max(40, cssWidth - padL - padR);
  const plotH = Math.max(40, cssHeight - padT - padB);
  const maxVal = Math.max(1, ...expByDay, ...incByDay);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const gy = padT + (plotH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(cssWidth - padR, gy);
    ctx.stroke();
  }

  const stepX = daysInMonth > 1 ? plotW / (daysInMonth - 1) : 0;
  trendPointsCache = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const x = padL + (d - 1) * stepX;
    const expY = padT + plotH - (expByDay[d - 1] / maxVal) * plotH;
    const incY = padT + plotH - (incByDay[d - 1] / maxVal) * plotH;
    trendPointsCache.push({ day: d, x, expY, incY, exp: expByDay[d - 1], inc: incByDay[d - 1] });
  }

  const drawLine = (keyY, strokeStyle, fillStyle) => {
    if (!trendPointsCache.length) return;
    ctx.beginPath();
    trendPointsCache.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt[keyY]);
      else ctx.lineTo(pt.x, pt[keyY]);
    });
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    if (fillStyle) {
      ctx.lineTo(trendPointsCache[trendPointsCache.length - 1].x, padT + plotH);
      ctx.lineTo(trendPointsCache[0].x, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  };

  drawLine("incY", incColor, null);
  drawLine("expY", expColor, isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(237, 130, 177, 0.16)");

  ctx.fillStyle = textColor;
  ctx.font = "800 9px Nunito, sans-serif";
  ctx.textAlign = "center";
  trendPointsCache.forEach(pt => {
    if (pt.day === 1 || pt.day % 5 === 0 || pt.day === daysInMonth) {
      ctx.fillText(String(pt.day), pt.x, cssHeight - 8);
    }
    if (pt.exp > 0) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.expY, 3, 0, Math.PI * 2);
      ctx.fillStyle = expColor;
      ctx.fill();
    }
    if (pt.inc > 0) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.incY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = incColor;
      ctx.fill();
    }
    ctx.fillStyle = textColor;
  });

  if (trendHoverDay) {
    const active = trendPointsCache.find(p => p.day === trendHoverDay);
    if (active) {
      ctx.strokeStyle = expColor;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(active.x, padT);
      ctx.lineTo(active.x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(active.x, active.expY, 5, 0, Math.PI * 2);
      ctx.fillStyle = expColor;
      ctx.fill();

      if ($("trendHoverInfo")) {
        $("trendHoverInfo").textContent = `Tgl ${active.day} ${monthName(new Date(y, m - 1, 1))} • Keluar: ${money(active.exp)} • Masuk: ${money(active.inc)}`;
      }
    }
  }
}
function handleTrendPointer(event) {
  const canvas = $("dailyTrendCanvas");
  if (!canvas || !trendPointsCache.length) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  let nearest = trendPointsCache[0];
  let bestDist = Math.abs(x - nearest.x);
  for (const pt of trendPointsCache) {
    const dist = Math.abs(x - pt.x);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = pt;
    }
  }
  trendHoverDay = nearest.day;
  renderDailyTrendChart();
}
$("dailyTrendCanvas")?.addEventListener("mousemove", handleTrendPointer);
$("dailyTrendCanvas")?.addEventListener("click", handleTrendPointer);
$("dailyTrendCanvas")?.addEventListener("mouseleave", () => {
  trendHoverDay = null;
  if ($("trendHoverInfo")) $("trendHoverInfo").textContent = "Arahkan atau klik titik hari untuk melihat nominal";
  renderDailyTrendChart();
});
window.addEventListener("resize", () => renderDailyTrendChart());

// ANALYTICS + SMART CASHFLOW FORECAST
function renderAnalytics() {
  const month = $("analyticsMonth").value || todayString.slice(0,7);
  const monthList = transactions.filter(t => t.date.startsWith(month));
  const [y,m] = month.split("-").map(Number);
  const previousMonth = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,"0")}`;
  const previousList = transactions.filter(t => t.date.startsWith(previousMonth));
  const total = getTotals(monthList);
  const previous = getTotals(previousList);
  const expenseDiff = total.expense - previous.expense;
  const diffLabel = previous.expense === 0 ? (total.expense ? "Belum ada data bulan lalu" : "Sama-sama belum ada") :
    `${Math.abs(Math.round(expenseDiff/previous.expense*100))}% ${expenseDiff>0?"lebih tinggi":expenseDiff<0?"lebih rendah":"sama"} dari bulan lalu`;
  const savingsRate = total.income > 0 ? Math.round((total.income-total.expense)/total.income*100) : 0;
  const categoriesTotal = {};
  monthList.filter(t=>t.type==="expense").forEach(t=>categoriesTotal[t.category]=(categoriesTotal[t.category]||0)+Number(t.amount));
  const ranked = Object.entries(categoriesTotal).sort((a,b)=>b[1]-a[1]);
  const top = ranked[0];
  $("analyticsSummary").innerHTML = `
    <div class="analytics-stat"><span>Pemasukan</span><strong class="plus">${money(total.income)}</strong><small>Bulan ini</small></div>
    <div class="analytics-stat"><span>Pengeluaran</span><strong class="minus">${money(total.expense)}</strong><small>${diffLabel}</small></div>
    <div class="analytics-stat"><span>Selisih bersih</span><strong>${money(total.balance)}</strong><small>Pemasukan − pengeluaran</small></div>
    <div class="analytics-stat"><span>Rasio sisa uang</span><strong>${total.income ? savingsRate+"%" : "—"}</strong><small>Dari total pemasukan</small></div>`;
  if (!ranked.length) $("categoryChart").innerHTML = `<p class="empty-state">Belum ada pengeluaran di bulan ini.</p>`;
  else {
    const max = ranked[0][1];
    $("categoryChart").innerHTML = ranked.map(([name,value]) => `<div class="category-row"><span class="cat-name">${escapeHTML(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,value/max*100)}%"></div></div><strong>${money(value)}</strong></div>`).join("");
  }
  const insights = [];
  if (top) insights.push(`Kategori pengeluaran terbesar adalah <b>${escapeHTML(top[0])}</b> (${money(top[1])}).`);
  if (total.income === 0 && total.expense === 0) insights.push("Belum ada transaksi pada bulan ini. Mulai catat pemasukan dan pengeluaranmu.");
  else if (total.balance < 0) insights.push("Pengeluaranmu lebih besar daripada pemasukan. Coba cek kategori yang bisa dikurangi.");
  else if (total.balance > 0) insights.push(`Kamu masih memiliki selisih positif <b>${money(total.balance)}</b>. Pertahankan kebiasaan baik ini!`);
  if (total.income > 0) insights.push(`Rasio sisa uangmu sekitar <b>${savingsRate}%</b> dari pemasukan bulan ini.`);
  insights.push(`Pengeluaran bulan ini ${escapeHTML(diffLabel.toLowerCase())}.`);
  $("insights").innerHTML = insights.map(item=>`<div class="insight-item">✨ ${item}</div>`).join("");
  renderDailyTrendChart();
}

function renderCashflowForecast() {
  const section = $("analyticsSection");
  const summaryEl = $("analyticsSummary");
  if (!section || !summaryEl) return;

  const month = $("analyticsMonth").value || todayString.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = month === todayString.slice(0, 7);
  const isPastMonth = month < todayString.slice(0, 7);

  const elapsedDays = isCurrentMonth
    ? Math.max(1, today.getDate())
    : (isPastMonth ? daysInMonth : 1);
  const remainingDays = isCurrentMonth
    ? Math.max(1, daysInMonth - today.getDate() + 1)
    : daysInMonth;

  const monthTx = transactions.filter(t => t.date.startsWith(month));
  const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expense = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const dailyAvgExpense = expense / elapsedDays;
  const projectedExpense = isCurrentMonth ? Math.round(dailyAvgExpense * daysInMonth) : expense;
  const projectedBalance = income - projectedExpense;
  const safeDailySpend = isCurrentMonth
    ? Math.max(0, Math.round((income - expense) / remainingDays))
    : Math.max(0, Math.round(income / daysInMonth));

  let box = $("forecastBanner");
  if (!box) {
    box = document.createElement("div");
    box.id = "forecastBanner";
    box.className = "forecast-banner";
    summaryEl.insertAdjacentElement("afterend", box);
  }

  box.innerHTML = `
    <div class="forecast-box">
      <span>🛡️ Batas Aman Harian</span>
      <strong class="${safeDailySpend > 0 ? "plus" : "minus"}">${money(safeDailySpend)} / hari</strong>
      <small>${isCurrentMonth ? `Sisa ${remainingDays} hari di bulan ini` : "Estimasi per hari bulanan"}</small>
    </div>
    <div class="forecast-box">
      <span>📈 Estimasi Pengeluaran Akhir Bulan</span>
      <strong class="minus">${money(projectedExpense)}</strong>
      <small>Rata-rata ${money(dailyAvgExpense)} / hari</small>
    </div>
    <div class="forecast-box">
      <span>🔮 Proyeksi Sisa Akhir Bulan</span>
      <strong class="${projectedBalance >= 0 ? "plus" : "minus"}">${money(projectedBalance)}</strong>
      <small>${projectedBalance >= 0 ? "Berpotensi surplus" : "Berpotensi defisit jika laju berlanjut"}</small>
    </div>
  `;

  const insightsEl = $("insights");
  if (insightsEl && isCurrentMonth && dailyAvgExpense > 0) {
    const alertText = dailyAvgExpense > safeDailySpend
      ? `⚠️ Rata-rata pengeluaran harianmu (${money(dailyAvgExpense)}/hari) lebih tinggi dari batas aman harian (${money(safeDailySpend)}/hari).`
      : `✅ Pengeluaran harianmu (${money(dailyAvgExpense)}/hari) masih di bawah batas aman harian (${money(safeDailySpend)}/hari).`;
    insightsEl.insertAdjacentHTML("beforeend", `<div class="insight-item">${alertText}</div>`);
  }
}

function renderSmartInsights(){
  const el=$("insights");if(!el)return;
  const m=$("analyticsMonth").value||todayString.slice(0,7),ex=transactions.filter(t=>t.date.startsWith(m)&&t.type==="expense");
  if(!ex.length)return;
  const total=ex.reduce((s,t)=>s+Number(t.amount||0),0),big=[...ex].sort((a,b)=>b.amount-a.amount)[0],by={};
  ex.forEach(t=>by[t.category]=(by[t.category]||0)+Number(t.amount||0));
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  el.insertAdjacentHTML("beforeend",`<div class="insight-item">🧠 Transaksi terbesar: <b>${escapeHTML(big.description)}</b> (${money(big.amount)}).</div><div class="insight-item">✨ Kategori terbesar: <b>${escapeHTML(top[0])}</b> (${Math.round(top[1]/total*100)}% pengeluaran).</div><div class="insight-item">📌 Rata-rata pengeluaran per transaksi: <b>${money(total/ex.length)}</b>.</div>`);
}

const renderAnalyticsBase = renderAnalytics;
renderAnalytics = function(){
  renderAnalyticsBase();
  renderSmartInsights();
  renderCashflowForecast();
};

$("analyticsMonth").addEventListener("change", () => { renderAnalytics(); renderBudgets(); });

// BUDGETS
function fillBudgetCategories() {
  if (!$("budgetCategory")) return;
  const list = getCategories("expense");
  $("budgetCategory").innerHTML = list.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
}
function renderBudgets() {
  if (!$("budgetList")) return;
  const month = $("analyticsMonth").value || todayString.slice(0,7);
  const entries = Object.entries(budgets).filter(([, limit]) => Number(limit) > 0);
  if (!entries.length) {
    $("budgetList").innerHTML = `<div class="empty span-2">Belum ada batas anggaran bulanan. Klik <b>＋ Atur Anggaran</b> untuk mulai mengontrol pengeluaran per kategori 🎯</div>`;
    return;
  }
  const spentByCategory = {};
  transactions
    .filter(t => t.date.startsWith(month) && t.type === "expense")
    .forEach(t => { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount || 0); });

  $("budgetList").innerHTML = entries.map(([cat, limit]) => {
    const spent = spentByCategory[cat] || 0;
    const rawPct = Math.round((spent / limit) * 100);
    const barPct = Math.min(100, rawPct);
    const fillClass = rawPct >= 100 ? "danger" : rawPct >= 80 ? "warning" : "";
    const statusText = rawPct >= 100
      ? `Melebihi batas ${money(spent - limit)}!`
      : rawPct >= 80
        ? `Hampir habis (${rawPct}%) • Sisa ${money(limit - spent)}`
        : `Aman • Sisa ${money(limit - spent)}`;
    return `
      <article class="budget-card">
        <div class="budget-top">
          <strong>🎯 ${escapeHTML(cat)}</strong>
          <div class="budget-actions">
            <button class="tiny-btn" type="button" onclick="openBudgetDialog('${escapeHTML(cat)}')">Ubah</button>
            <button class="tiny-btn" type="button" onclick="removeBudget('${escapeHTML(cat)}')">Hapus</button>
          </div>
        </div>
        <p>${money(spent)} terpakai dari anggaran ${money(limit)} (${formatDate(month + "-01", {month:"short",year:"numeric"})})</p>
        <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${barPct}%"></div></div>
        <div class="progress-meta"><span>${statusText}</span><strong>${rawPct}%</strong></div>
      </article>
    `;
  }).join("");
}
function openBudgetDialog(category = "") {
  fillBudgetCategories();
  $("budgetForm").reset();
  const list = getCategories("expense");
  if (category && list.includes(category)) {
    $("budgetCategory").value = category;
    $("budgetLimit").value = formatDigits(budgets[category] || "");
  } else {
    $("budgetLimit").value = formatDigits(budgets[$("budgetCategory").value] || "");
  }
  $("budgetDialog").showModal();
}
window.openBudgetDialog = openBudgetDialog;
window.removeBudget = cat => {
  if (!confirm(`Hapus anggaran kategori ${cat}?`)) return;
  delete budgets[cat];
  saveAll();
  renderBudgets();
  notify("Anggaran kategori dihapus.");
};
$("addBudgetBtn").addEventListener("click", () => openBudgetDialog());
$("budgetCategory").addEventListener("change", e => {
  $("budgetLimit").value = formatDigits(budgets[e.target.value] || "");
});
$("budgetForm").addEventListener("submit", event => {
  event.preventDefault();
  const cat = $("budgetCategory").value;
  const limit = parseMoneyInput($("budgetLimit").value);
  if (!cat || !Number.isFinite(limit) || limit <= 0) return notify("Masukkan batas anggaran yang valid.");
  budgets[cat] = limit;
  saveAll();
  $("budgetDialog").close();
  renderBudgets();
  notify("Anggaran bulanan disimpan 🎯");
});

// SAVINGS CHALLENGES
function renderChallenges() {
  if (!challenges.length) {
    $("challengeList").innerHTML = `<div class="empty span-2">Belum ada tantangan menabung. Yuk buat target pertamamu! 🌷</div>`;
    return;
  }
  $("challengeList").innerHTML = challenges.map(c => {
    const saved = Number(c.saved)||0, target = Number(c.target)||1;
    const percent = Math.min(100,Math.round(saved/target*100));
    const completed = saved >= target;
    return `<article class="challenge-card">
      <div class="challenge-top"><strong>🌷 ${escapeHTML(c.name)}</strong><div class="challenge-actions"><button class="tiny-btn" type="button" onclick="editChallenge('${escapeHTML(c.id)}')">Edit</button><button class="tiny-btn" type="button" onclick="deleteChallenge('${escapeHTML(c.id)}')">Hapus</button></div></div>
      <p>${c.deadline?`Target: ${formatDate(c.deadline)}`:"Tanpa batas tanggal"}${c.note?` • ${escapeHTML(c.note)}`:""}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="progress-meta"><span>${money(saved)} terkumpul</span><strong>${percent}%</strong></div>
      <div class="challenge-footer"><strong>${completed?"🎉 Target tercapai!":`Sisa ${money(Math.max(0,target-saved))}`}</strong><button class="btn btn-primary btn-small" type="button" onclick="openContribution('${escapeHTML(c.id)}')">＋ Setor</button></div>
      <p>Target ${money(target)}</p>
    </article>`;
  }).join("");
}
function openChallengeDialog(challenge=null) {
  $("challengeForm").reset();
  $("challengeId").value = challenge?.id || "";
  $("challengeDialogTitle").textContent = challenge ? "Edit Tantangan" : "Buat Tantangan";
  $("challengeName").value = challenge?.name || "";
  $("challengeTarget").value = formatDigits(challenge?.target || "");
  $("challengeDeadline").value = challenge?.deadline || "";
  $("challengeNote").value = challenge?.note || "";
  $("challengeDialog").showModal();
}
function editChallenge(id) {
  const c = challenges.find(item=>item.id===id);
  if (c) openChallengeDialog(c);
}
function deleteChallenge(id) {
  if (!confirm("Hapus tantangan ini? Riwayat setoran tantangan juga akan dihapus.")) return;
  challenges=challenges.filter(c=>c.id!==id);saveAll();renderChallenges();notify("Tantangan dihapus.");
}
function openContribution(id) {
  const c=challenges.find(item=>item.id===id);if(!c)return;
  $("contributeForm").reset();$("contributeChallengeId").value=id;$("contributeChallengeName").textContent=c.name;$("contributeDialog").showModal();
}
window.editChallenge=editChallenge;
window.deleteChallenge=deleteChallenge;
window.openContribution=openContribution;
$("addChallengeBtn").addEventListener("click",()=>openChallengeDialog());
$("challengeForm").addEventListener("submit",event=>{
  event.preventDefault();
  const id=$("challengeId").value;
  const name=$("challengeName").value.trim(),target=parseMoneyInput($("challengeTarget").value);
  if(!name||target<=0)return notify("Isi nama dan target dengan benar.");
  const old=challenges.find(c=>c.id===id);
  const item={id:id||uid(),name,target,deadline:$("challengeDeadline").value,note:$("challengeNote").value.trim(),saved:old?.saved||0,contributions:old?.contributions||[]};
  if(id)challenges=challenges.map(c=>c.id===id?item:c);else challenges.push(item);
  saveAll();$("challengeDialog").close();renderChallenges();notify("Tantangan tersimpan 💗");
});
$("contributeForm").addEventListener("submit",event=>{
  event.preventDefault();
  const c=challenges.find(item=>item.id===$("contributeChallengeId").value),amount=parseMoneyInput($("contributeAmount").value);
  if(!c||amount<=0)return notify("Jumlah setoran tidak valid.");
  c.saved=(Number(c.saved)||0)+amount;c.contributions=c.contributions||[];c.contributions.push({amount,date:todayString});
  saveAll();$("contributeDialog").close();renderChallenges();notify("Setoran berhasil ditambahkan 🌷");
});

// RECURRING REMINDERS
function fillRecurringCategories() {
  const list = getCategories("expense");
  const old = $("recurringCategory").value;
  $("recurringCategory").innerHTML=list.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (list.includes(old)) $("recurringCategory").value = old;
}
function dueStatus(date) {
  const diff=Math.round((new Date(`${date}T00:00:00`)-new Date(`${todayString}T00:00:00`))/86400000);
  if(diff<0)return {label:`Terlambat ${Math.abs(diff)} hari`,className:"overdue"};
  if(diff===0)return {label:"Jatuh tempo hari ini",className:"overdue"};
  if(diff<=3)return {label:`${diff} hari lagi`,className:""};
  return {label:`${formatDate(date,{day:"numeric",month:"short"})}`,className:"safe"};
}
function renderRecurring() {
  const list=[...recurring].sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  if(!list.length){$("recurringList").innerHTML=`<div class="empty">Belum ada pengingat rutin. Tambahkan tagihan atau pembayaran berkala 🔔</div>`;return;}
  $("recurringList").innerHTML=list.map(r=>{
    const status=dueStatus(r.nextDate);
    const frequency={weekly:"Mingguan",monthly:"Bulanan",yearly:"Tahunan"}[r.frequency]||"Bulanan";
    return `<div class="recurring-item"><div class="recurring-icon">🔔</div><div class="recurring-main"><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.category)} • ${frequency} • ${formatDate(r.nextDate)}</small></div><div class="recurring-side"><strong>${money(r.amount)}</strong><span class="due-pill ${status.className}">${status.label}</span><div class="recurring-actions"><button class="tiny-btn" type="button" onclick="markRecurringPaid('${escapeHTML(r.id)}')">Sudah dibayar</button><button class="tiny-btn" type="button" onclick="editRecurring('${escapeHTML(r.id)}')">Edit</button><button class="tiny-btn" type="button" onclick="deleteRecurring('${escapeHTML(r.id)}')">×</button></div></div></div>`;
  }).join("");
}
function openRecurringDialog(item=null) {
  fillRecurringCategories();
  $("recurringForm").reset();$("recurringId").value=item?.id||"";
  $("recurringDialogTitle").textContent=item?"Edit Pengingat":"Buat Pengingat";
  $("recurringName").value=item?.name||"";$("recurringAmount").value=formatDigits(item?.amount||"");
  $("recurringCategory").value=item?.category||"Tagihan";$("recurringFrequency").value=item?.frequency||"monthly";
  $("recurringNextDate").value=item?.nextDate||todayString;$("recurringDialog").showModal();
}
function editRecurring(id){const r=recurring.find(item=>item.id===id);if(r)openRecurringDialog(r);}
function deleteRecurring(id){if(!confirm("Hapus pengingat ini?"))return;recurring=recurring.filter(r=>r.id!==id);saveAll();renderRecurring();notify("Pengingat dihapus.");}
function addFrequency(date,frequency) {
  const d=new Date(`${date}T00:00:00`);
  if(frequency==="weekly")d.setDate(d.getDate()+7);
  else if(frequency==="yearly")d.setFullYear(d.getFullYear()+1);
  else {const originalDay=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(originalDay,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}
  return dateISO(d);
}
function markRecurringPaid(id) {
  const r=recurring.find(item=>item.id===id);if(!r)return;
  if(!confirm(`Catat ${r.name} sebesar ${money(r.amount)} sebagai pengeluaran hari ini?`))return;
  transactions.push({id:uid(),type:"expense",description:r.name,category:r.category,amount:Number(r.amount),date:todayString,walletId:"cash"});
  r.lastPaid=todayString;
  r.nextDate=addFrequency(r.nextDate,r.frequency);
  while(r.nextDate<todayString)r.nextDate=addFrequency(r.nextDate,r.frequency);
  saveAll();renderAll();notify("Pembayaran dicatat dan jatuh tempo diperbarui.");
}
window.editRecurring=editRecurring;window.deleteRecurring=deleteRecurring;window.markRecurringPaid=markRecurringPaid;
$("addRecurringBtn").addEventListener("click",()=>openRecurringDialog());
$("recurringForm").addEventListener("submit",event=>{
  event.preventDefault();
  const id=$("recurringId").value,name=$("recurringName").value.trim(),amount=parseMoneyInput($("recurringAmount").value),nextDate=$("recurringNextDate").value;
  if(!name||amount<=0||!nextDate)return notify("Lengkapi data pengingat.");
  const item={id:id||uid(),name,amount,category:$("recurringCategory").value,frequency:$("recurringFrequency").value,nextDate};
  if(id)recurring=recurring.map(r=>r.id===id?item:r);else recurring.push(item);
  saveAll();$("recurringDialog").close();renderRecurring();notify("Pengingat berhasil disimpan 🔔");
});

// EXPORTS
function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function exportExcel() {
  if(!window.XLSX){notify("Library Excel belum termuat. Periksa koneksi internet.");return;}
  const rows=sortTransactions(transactions).map(t=>({Tanggal:t.date,Jenis:t.type==="income"?"Pemasukan":"Pengeluaran",Deskripsi:t.description,Kategori:t.category,Dompet:walletName(t.walletId),Catatan:t.note||"",Jumlah:Number(t.amount)}));
  const totals=getTotals(transactions);
  const summary=[{Keterangan:"Total Pemasukan",Jumlah:totals.income},{Keterangan:"Total Pengeluaran",Jumlah:totals.expense},{Keterangan:"Saldo Bersih",Jumlah:totals.balance}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Info:"Belum ada transaksi"}]),"Transaksi");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),"Ringkasan");
  const challengeRows=challenges.map(c=>({Tantangan:c.name,Target:c.target,Terkumpul:c.saved||0,Sisa:Math.max(0,c.target-(c.saved||0)),Deadline:c.deadline||"-"}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(challengeRows.length?challengeRows:[{Info:"Belum ada tantangan"}]),"Tantangan");
  XLSX.writeFile(wb,`Pinky_Wallet_Laporan_${todayString}.xlsx`);
  notify("File Excel berhasil dibuat 📊");
}
function exportPdf() {
  const existing=document.getElementById("printReport");
  if(existing)existing.remove();
  const totals=getTotals(transactions);
  const rows=sortTransactions(transactions).map(t=>`<tr><td>${escapeHTML(formatDate(t.date))}</td><td>${t.type==="income"?"Pemasukan":"Pengeluaran"}</td><td>${escapeHTML(t.description)}</td><td>${escapeHTML(t.category)}</td><td style="text-align:right">${escapeHTML(money(t.amount))}</td></tr>`).join("");
  const report=document.createElement("section");
  report.id="printReport";
  report.innerHTML=`<style>
    #printReport{font-family:Arial,sans-serif;color:#333;padding:22px;background:white}
    #printReport h1{color:#cf568d;margin:0 0 4px;font-size:22px}
    #printReport p{font-size:11px;color:#777;margin:0 0 18px}
    #printReport .summary{display:flex;gap:12px;margin:15px 0 22px}
    #printReport .summary div{border:1px solid #f1d7e3;padding:10px;border-radius:8px;flex:1;font-size:11px}
    #printReport .summary b{display:block;margin-top:5px;font-size:13px}
    #printReport table{width:100%;border-collapse:collapse;font-size:10px}
    #printReport th,#printReport td{border:1px solid #eadde4;padding:7px;text-align:left}
    #printReport th{background:#fff0f6}
    @media screen{#printReport{position:fixed;inset:12px;z-index:1000;overflow:auto;box-shadow:0 0 0 9999px #39263488}}
    @media print{body>*:not(#printReport){display:none!important}#printReport{display:block!important;position:static!important;box-shadow:none!important;padding:0!important}}
  </style>
  <h1>🎀 Pinky Wallet — Laporan Keuangan</h1><p>Dibuat pada ${formatDate(todayString,{day:"numeric",month:"long",year:"numeric"})}</p>
  <div class="summary"><div>Total Pemasukan<b>${money(totals.income)}</b></div><div>Total Pengeluaran<b>${money(totals.expense)}</b></div><div>Saldo Bersih<b>${money(totals.balance)}</b></div></div>
  <h3 style="font-size:14px">Daftar Transaksi</h3>
  <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Deskripsi</th><th>Kategori</th><th>Jumlah</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Belum ada transaksi.</td></tr>'}</tbody></table>`;
  document.body.appendChild(report);
  window.print();
  setTimeout(()=>report.remove(),1000);
}
function backupJSON() {
  const data={app:"Pinky Wallet",version:"2.5",exportedAt:new Date().toISOString(),transactions,challenges,recurring,budgets,presets,customCategories,wallets,debts,settings:appSettings};
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`Pinky_Wallet_Backup_${todayString}.json`);
  notify("Backup JSON berhasil dibuat.");
}
$("exportExcelBtn").addEventListener("click",exportExcel);
$("exportPdfBtn").addEventListener("click",exportPdf);
$("backupBtn").addEventListener("click",backupJSON);
$("restoreInput").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.transactions))throw new Error("Format backup tidak dikenali.");
    if(!confirm("Pulihkan backup? Data saat ini akan diganti dengan isi file backup."))return;
    transactions=data.transactions;
    challenges=Array.isArray(data.challenges)?data.challenges:[];
    recurring=Array.isArray(data.recurring)?data.recurring:[];
    budgets=data.budgets&&typeof data.budgets==="object"?data.budgets:{};
    presets=Array.isArray(data.presets)?data.presets:[];
    customCategories=data.customCategories&&typeof data.customCategories==="object"?{income:Array.isArray(data.customCategories.income)?data.customCategories.income:[],expense:Array.isArray(data.customCategories.expense)?data.customCategories.expense:[]}:customCategories;
    wallets=Array.isArray(data.wallets)&&data.wallets.length?data.wallets:wallets;
    debts=Array.isArray(data.debts)?data.debts:[];
    appSettings=data.settings||appSettings;
    localStorage.setItem(STORAGE.wallets,JSON.stringify(wallets));
    localStorage.setItem(STORAGE.debts,JSON.stringify(debts));
    localStorage.setItem(STORAGE.settings,JSON.stringify(appSettings));
    saveAll();applySettings();renderAll();notify("Backup berhasil dipulihkan 💗");
  }catch(error){notify(error.message||"File backup tidak valid.");}
  finally{event.target.value="";}
});
$("wipeAllDataBtn").addEventListener("click", () => {
  if (!confirm("Yakin ingin menghapus SEMUA data transaksi, anggaran, tantangan, pengingat, template, kategori custom, dompet tambahan, dan utang?")) return;
  if (!confirm("Konfirmasi terakhir: tindakan ini tidak bisa dibatalkan. Lanjutkan?")) return;
  transactions = [];
  challenges = [];
  recurring = [];
  budgets = {};
  presets = [];
  customCategories = { income: [], expense: [] };
  debts = [];
  wallets = [{id:"cash",name:"Tunai",kind:"Uang tunai"}];
  localStorage.setItem(STORAGE.wallets, JSON.stringify(wallets));
  localStorage.setItem(STORAGE.debts, JSON.stringify(debts));
  saveAll();
  renderAll();
  notify("Semua data telah dibersihkan.");
});

// === MULTI DOMPET & UTANG/PIUTANG ===
let wallets=read(STORAGE.wallets), debts=read(STORAGE.debts), pendingTransactionPhoto="";
if(!wallets.length){wallets=[{id:"cash",name:"Tunai",kind:"Uang tunai"}];localStorage.setItem(STORAGE.wallets,JSON.stringify(wallets));}
const saveWallets=()=>localStorage.setItem(STORAGE.wallets,JSON.stringify(wallets));
const saveDebts=()=>localStorage.setItem(STORAGE.debts,JSON.stringify(debts));
function walletName(id){return wallets.find(w=>w.id===(id||"cash"))?.name||"Tunai";}
function walletBalance(id){return transactions.reduce((s,t)=>s+((t.walletId||"cash")===id?(t.type==="income"?1:-1)*Number(t.amount||0):0),0);}
function renderWalletSelect(){
  const el=$("transactionWallet");
  if(!el)return;
  const old=el.value||"cash";
  el.innerHTML=wallets.map(w=>`<option value="${escapeHTML(w.id)}">${escapeHTML(w.name)} (${escapeHTML(w.kind)})</option>`).join("");
  el.value=wallets.some(w=>w.id===old)?old:(wallets[0]?.id||"cash");
}
function renderWallets(){if(!$("walletList"))return;renderWalletSelect();$("walletList").innerHTML=wallets.map(w=>`<article class="wallet-card"><strong>👛 ${escapeHTML(w.name)}</strong><small>${escapeHTML(w.kind)}</small><strong class="wallet-balance">${money(walletBalance(w.id))}</strong><div class="wallet-actions">${w.id==="cash"?"<small>Dompet utama</small>":`<button class="tiny-btn" onclick="renameWallet('${escapeHTML(w.id)}')">Ubah nama</button><button class="tiny-btn" onclick="removeWallet('${escapeHTML(w.id)}')">Hapus</button>`}</div></article>`).join("");}
window.renameWallet=id=>{const w=wallets.find(x=>x.id===id);if(!w)return;const n=prompt("Nama dompet:",w.name);if(n?.trim()){w.name=n.trim().slice(0,35);saveWallets();renderWallets();renderHistory();}};
window.removeWallet=id=>{if(transactions.some(t=>(t.walletId||"cash")===id))return notify("Dompet masih memiliki transaksi.");if(confirm("Hapus dompet ini?")){wallets=wallets.filter(w=>w.id!==id);saveWallets();renderWallets();}};
$("addWalletBtn").addEventListener("click",()=>$("walletDialog").showModal());
$("walletForm").addEventListener("submit",e=>{e.preventDefault();wallets.push({id:uid(),name:$("walletName").value.trim(),kind:$("walletKind").value});saveWallets();$("walletDialog").close();renderWallets();notify("Dompet ditambahkan 👛");});

function renderDebts(){if(!$("debtList"))return;const sum=type=>debts.filter(d=>d.type===type).reduce((s,d)=>s+Math.max(0,d.amount-d.paid),0);$("debtSummary").innerHTML=`<div class="debt-total"><span>Utang yang harus dibayar</span><strong class="minus">${money(sum("owe"))}</strong></div><div class="debt-total"><span>Piutang yang harus diterima</span><strong class="plus">${money(sum("owed"))}</strong></div>`;if(!debts.length){$("debtList").innerHTML='<div class="empty">Belum ada catatan utang / piutang 🤝</div>';return;}$("debtList").innerHTML=debts.map(d=>{const left=Math.max(0,d.amount-d.paid);return `<article class="debt-card"><strong>${escapeHTML(d.person)} <span class="debt-tag">${d.type==="owe"?"Utang":"Piutang"}</span></strong><small>${escapeHTML(d.description||"Tanpa keterangan")}${d.dueDate?" • "+formatDate(d.dueDate):""}</small><strong class="debt-remaining ${d.type==="owe"?"minus":"plus"}">${money(left)} tersisa</strong><div class="progress-track"><div class="progress-fill" style="width:${d.amount?d.paid/d.amount*100:0}%"></div></div><small>${money(d.paid)} telah ${d.type==="owe"?"dibayar":"diterima"}</small><div class="debt-actions"><button class="tiny-btn" onclick="payDebt('${d.id}')">Cicilan</button><button class="tiny-btn" onclick="editDebt('${d.id}')">Edit</button><button class="tiny-btn" onclick="deleteDebt('${d.id}')">Hapus</button></div></article>`;}).join("");}
function openDebt(d){$("debtForm").reset();$("debtId").value=d?.id||"";$("debtDialogTitle").textContent=d?"Edit Catatan":"Catat Utang / Piutang";$("debtType").value=d?.type||"owe";$("debtPerson").value=d?.person||"";$("debtDescription").value=d?.description||"";$("debtAmount").value=formatDigits(d?.amount||"");$("debtDueDate").value=d?.dueDate||"";$("debtDialog").showModal();}
window.editDebt=id=>{const d=debts.find(x=>x.id===id);if(d)openDebt(d);};
window.deleteDebt=id=>{if(confirm("Hapus catatan ini?")){debts=debts.filter(d=>d.id!==id);saveDebts();renderDebts();}};
window.payDebt=id=>{const d=debts.find(x=>x.id===id);if(!d)return;const left=d.amount-d.paid;const raw=prompt(`Sisa ${money(left)}. Masukkan cicilan:`);if(raw===null)return;const n=parseMoneyInput(raw);if(n>0&&n<=left){d.paid+=n;saveDebts();renderDebts();notify("Cicilan dicatat.");}else if(n>left)notify("Cicilan melebihi sisa.");else notify("Nominal cicilan tidak valid.");};
$("addDebtBtn").addEventListener("click",()=>openDebt());
$("debtForm").addEventListener("submit",e=>{e.preventDefault();const id=$("debtId").value,old=debts.find(d=>d.id===id),amount=parseMoneyInput($("debtAmount").value);if(!$("debtPerson").value.trim()||amount<=0)return;const d={id:id||uid(),type:$("debtType").value,person:$("debtPerson").value.trim(),description:$("debtDescription").value.trim(),amount,paid:Math.min(old?.paid||0,amount),dueDate:$("debtDueDate").value};if(id)debts=debts.map(x=>x.id===id?d:x);else debts.push(d);saveDebts();$("debtDialog").close();renderDebts();notify("Catatan tersimpan.");});

function renderPhotoPreview(){$("photoPreview").innerHTML=pendingTransactionPhoto?`<img src="${pendingTransactionPhoto}" alt="Bukti transaksi">`:"";}
$("transactionPhoto").addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>1200000){e.target.value="";return notify("Pilih gambar maksimal 1,2 MB.");}const r=new FileReader();r.onload=()=>{pendingTransactionPhoto=String(r.result);renderPhotoPreview();};r.readAsDataURL(f);});
window.showTransactionPhoto=id=>{const t=transactions.find(x=>x.id===id);if(!t?.photo)return;const w=window.open();if(w){w.document.write(`<img src="${t.photo}" style="max-width:100%">`);w.document.close();}};

// CUSTOM CATEGORIES
function renderCustomCategories() {
  if (!$("customCategoryList")) return;
  const items = [
    ...(customCategories.expense || []).map(c => ({ ...c, type: "expense", label: "Pengeluaran" })),
    ...(customCategories.income || []).map(c => ({ ...c, type: "income", label: "Pemasukan" }))
  ];
  if (!items.length) {
    $("customCategoryList").innerHTML = `<span class="field-help">Belum ada kategori custom.</span>`;
    return;
  }
  $("customCategoryList").innerHTML = items.map(c => `
    <span class="cat-pill">
      <span>${escapeHTML(c.emoji || "✨")} ${escapeHTML(c.name)} (${c.label})</span>
      <button type="button" aria-label="Hapus kategori" onclick="deleteCustomCategory('${escapeHTML(c.type)}','${escapeHTML(c.name)}')">×</button>
    </span>
  `).join("");
}
window.deleteCustomCategory = (type, name) => {
  if (!confirm(`Hapus kategori custom "${name}"?`)) return;
  customCategories[type] = (customCategories[type] || []).filter(c => c.name !== name);
  saveAll();
  updateCategories($("type").value || "expense");
  updateHistoryCategories();
  fillBudgetCategories();
  fillRecurringCategories();
  renderCustomCategories();
  notify("Kategori custom dihapus.");
};
$("customCategoryForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const type = $("customCatType").value;
  const emoji = ($("customCatEmoji").value || "✨").trim();
  const name = $("customCatName").value.trim();
  if (!name) return notify("Masukkan nama kategori.");
  if (getCategories(type).some(c => c.toLowerCase() === name.toLowerCase())) {
    return notify("Kategori dengan nama tersebut sudah ada.");
  }
  customCategories[type] = customCategories[type] || [];
  customCategories[type].push({ name, emoji });
  saveAll();
  $("customCatName").value = "";
  updateCategories($("type").value || "expense");
  updateHistoryCategories();
  fillBudgetCategories();
  fillRecurringCategories();
  renderCustomCategories();
  notify("Kategori custom ditambahkan 🏷️");
});

const THEME_STYLES = ["ios18-glass", "bento", "cozy-paper", "cyber-pastel", "minimal-flat"];

function updateThemePreviewUI(styleMode) {
  const meta = THEME_STYLE_META[styleMode] || THEME_STYLE_META.classic;
  if ($("previewStyleBadge")) $("previewStyleBadge").textContent = meta.label;
  if ($("previewStyleTitle")) $("previewStyleTitle").textContent = meta.title;
  if ($("previewStyleDesc")) $("previewStyleDesc").textContent = meta.desc;
}

function applySettings(){
  document.body.classList.remove("accent-purple","accent-blue","accent-mint","accent-peach");
  if(appSettings.accent&&appSettings.accent!=="pink")document.body.classList.add("accent-"+appSettings.accent);

  const styleMode = appSettings.themeStyle || "classic";
  document.body.classList.remove(...THEME_STYLES);
  if (THEME_STYLES.includes(styleMode)) {
    document.body.classList.add(styleMode);
  }

  $("currencySelect").value=appSettings.currency||"IDR";
  $("accentSelect").value=appSettings.accent||"pink";
  if($("themeStyleSelect"))$("themeStyleSelect").value=styleMode;
  updateThemePreviewUI(styleMode);
  $("profileName").value=appSettings.name||"";
  if(appSettings.profilePhoto){$("profilePreview").innerHTML=`<img src="${appSettings.profilePhoto}" alt="Foto profil">`;$("welcomeAvatar").src=appSettings.profilePhoto;$("welcomeAvatar").hidden=false;}else{$("profilePreview").innerHTML="";$("welcomeAvatar").hidden=true;}
  if(appSettings.name)$("welcomeName").textContent=appSettings.name;else $("welcomeName").textContent="money planner";
}

$("themeStyleSelect")?.addEventListener("change", e => {
  const chosen = e.target.value || "classic";
  document.body.classList.remove(...THEME_STYLES);
  if (THEME_STYLES.includes(chosen)) document.body.classList.add(chosen);
  updateThemePreviewUI(chosen);
  renderDailyTrendChart();
});

$("accentSelect")?.addEventListener("change", e => {
  const chosen = e.target.value || "pink";
  document.body.classList.remove("accent-purple","accent-blue","accent-mint","accent-peach");
  if (chosen !== "pink") document.body.classList.add("accent-" + chosen);
  renderDailyTrendChart();
});

let pendingProfilePhoto="";
$("profilePhoto").addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1200000){e.target.value="";return notify("Foto maksimal 1,2 MB.");}const r=new FileReader();r.onload=()=>{pendingProfilePhoto=String(r.result);$("profilePreview").innerHTML=`<img src="${pendingProfilePhoto}" alt="Foto profil">`;};r.readAsDataURL(f);});
$("saveSettingsBtn").addEventListener("click",()=>{
  appSettings={
    ...appSettings,
    currency:$("currencySelect").value,
    accent:$("accentSelect").value,
    themeStyle:$("themeStyleSelect")?.value||"classic",
    name:$("profileName").value.trim(),
    profilePhoto:pendingProfilePhoto||appSettings.profilePhoto||""
  };
  localStorage.setItem(STORAGE.settings,JSON.stringify(appSettings));
  applySettings();renderAll();notify("Kustomisasi disimpan 🎨");
});
$("resetSettingsBtn").addEventListener("click",()=>{
  appSettings={currency:"IDR",accent:"pink",themeStyle:"classic",name:"",profilePhoto:""};
  pendingProfilePhoto="";
  localStorage.setItem(STORAGE.settings,JSON.stringify(appSettings));
  applySettings();renderAll();notify("Tampilan direset.");
});

// === REGISTRASI & LOGIN (TERSIMPAN SESI SAAT REFRESH, KELUAR HANYA SAAT LOGOUT) ===
let authAccount = readObj(STORAGE.auth, null);
let sessionData = readObj(STORAGE.session, null);
let isLoggedIn = Boolean(
  authAccount &&
  authAccount.username &&
  authAccount.passwordHash &&
  sessionData &&
  sessionData.loggedIn === true &&
  sessionData.username === authAccount.username
);

function setAuthError(msg = "") {
  const errEl = $("authError");
  if (!errEl) return;
  if (msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  } else {
    errEl.textContent = "";
    errEl.hidden = true;
  }
}

function syncAuthView() {
  const hasAccount = Boolean(authAccount && authAccount.username && authAccount.passwordHash);
  const confirmGroup = $("confirmPasswordGroup");
  const confirmInput = $("authPasswordConfirm");
  const resetWrap = $("authResetWrap");

  if ($("authTitle")) {
    $("authTitle").textContent = hasAccount ? "Masuk ke Akunmu" : "Daftar Akun Baru";
  }
  if ($("authSubtitle")) {
    $("authSubtitle").textContent = hasAccount
      ? "Masukkan username dan password yang sesuai untuk masuk."
      : "Buat username dan password (pastikan password dan konfirmasi password sama).";
  }
  if ($("authSubmitBtn")) {
    $("authSubmitBtn").textContent = hasAccount ? "Masuk Sekarang 💗" : "Daftar & Masuk 💗";
  }
  if (confirmGroup) confirmGroup.hidden = hasAccount;
  if (confirmInput) {
    confirmInput.required = !hasAccount;
    if (hasAccount) confirmInput.value = "";
  }
  if (resetWrap) resetWrap.hidden = !hasAccount;

  if (isLoggedIn) {
    $("authGate").hidden = true;
    $("appRoot").hidden = false;
    renderDailyTrendChart();
  } else {
    $("authGate").hidden = false;
    $("appRoot").hidden = true;
    setAuthError("");
    if ($("authUsername")) $("authUsername").value = "";
    if ($("authPassword")) $("authPassword").value = "";
    if (confirmInput) confirmInput.value = "";
  }
}

async function hashSecret(text) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(String(text))));
}

document.querySelectorAll("[data-toggle-pass]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = $(btn.dataset.togglePass);
    if (!target) return;
    target.type = target.type === "password" ? "text" : "password";
  });
});

$("authForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const username = ($("authUsername")?.value || "").trim();
  const password = $("authPassword")?.value || "";
  const confirmPass = $("authPasswordConfirm")?.value || "";

  if (!username) return setAuthError("Username tidak boleh kosong.");
  if (!password) return setAuthError("Password tidak boleh kosong.");

  const hasAccount = Boolean(authAccount && authAccount.username && authAccount.passwordHash);
  const hashed = await hashSecret(password);

  if (!hasAccount) {
    if (password !== confirmPass) {
      return setAuthError("Password dan konfirmasi password tidak sama! Silakan periksa kembali.");
    }
    authAccount = { username, passwordHash: hashed };
    localStorage.setItem(STORAGE.auth, JSON.stringify(authAccount));
  } else {
    const isUserMatch = username.toLowerCase() === String(authAccount.username).toLowerCase();
    const isPassMatch = hashed === authAccount.passwordHash;
    if (!isUserMatch || !isPassMatch) {
      return setAuthError("Username atau password salah! Harus sama dengan akun yang terdaftar.");
    }
    authAccount = { ...authAccount, username: authAccount.username };
    localStorage.setItem(STORAGE.auth, JSON.stringify(authAccount));
  }

  const displayName = authAccount.username;
  appSettings = { ...appSettings, name: displayName };
  localStorage.setItem(STORAGE.settings, JSON.stringify(appSettings));
  applySettings();

  sessionData = { loggedIn: true, username: authAccount.username };
  localStorage.setItem(STORAGE.session, JSON.stringify(sessionData));
  isLoggedIn = true;

  setAuthError("");
  syncAuthView();
  notify(`Halo, ${displayName}! Selamat datang di Pinky Wallet 💗`);
});

$("logoutBtn")?.addEventListener("click", () => {
  isLoggedIn = false;
  sessionData = { loggedIn: false, username: "" };
  localStorage.removeItem(STORAGE.session);
  syncAuthView();
  notify("Kamu telah keluar dari akun.");
});

$("resetAccountBtn")?.addEventListener("click", () => {
  if (!confirm("Reset akun terdaftar? Setelah ini kamu bisa mendaftar username & password baru.")) return;
  authAccount = null;
  sessionData = null;
  isLoggedIn = false;
  localStorage.removeItem(STORAGE.auth);
  localStorage.removeItem(STORAGE.session);
  syncAuthView();
  notify("Akun direset. Silakan daftar akun baru.");
});

// SECTION NAV ACTIVE STATE
const navLinks = [...document.querySelectorAll(".section-nav a")];
navLinks.forEach(link => {
  link.addEventListener("click", () => {
    navLinks.forEach(a => a.classList.remove("active-nav"));
    link.classList.add("active-nav");
  });
});

// THEME + INIT
$("themeToggle").addEventListener("click",()=>{
  const dark=document.body.classList.toggle("dark");
  localStorage.setItem(STORAGE.theme,dark?"dark":"light");
  $("themeToggle").textContent=dark?"☀️":"🌙";
  renderDailyTrendChart();
});
if(localStorage.getItem(STORAGE.theme)==="dark"){$("themeToggle").textContent="☀️";document.body.classList.add("dark");}
document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>$(btn.dataset.close).close()));
$("todayLabel").textContent=today.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
$("date").value=todayString;
$("historyMonth").value=todayString.slice(0,7);
$("analyticsMonth").value=todayString.slice(0,7);
$("filterType").addEventListener("change",()=>{updateHistoryCategories();renderHistory();});
$("filterCategory").addEventListener("change",renderHistory);
$("historyMonth").addEventListener("change",renderHistory);
$("historySearch")?.addEventListener("input",renderHistory);
bindMoneyInputs();
fillRecurringCategories();
fillBudgetCategories();
fillPresetCategories("expense");
renderWalletSelect();
applySettings();
updateCategories("expense");
updateHistoryCategories();
function renderAll(){
  renderDashboard();
  renderPresets();
  renderCustomCategories();
  renderHistory();
  renderCalendar();
  renderAnalytics();
  renderBudgets();
  renderChallenges();
  renderRecurring();
  renderWallets();
  renderDebts();
}
renderAll();
syncAuthView();

// === PWA SUPPORT ===
let deferredInstallPrompt = null;
const installBtn = $("installAppBtn");

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installBtn) installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === "accepted") {
    notify("Pinky Wallet berhasil di-install! 🎀");
  }
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installBtn) installBtn.hidden = true;
  notify("Pinky Wallet siap digunakan sebagai aplikasi 💗");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}