// EXPENSE TRACKER — vanilla JS
// Data lives entirely in localStorage under the key below. One array of
// expense objects, reloaded on start, rewritten on every change.
// NOTE: money is stored as integer PAISE (₹120.50 = 12050), never floats.

const STORAGE_KEY = "expenseItems";

const CATEGORIES = [
  { name: "Food",     emoji: "🍜", color: "#f59e0b" },
  { name: "Travel",   emoji: "🚌", color: "#3b82f6" },
  { name: "Shopping", emoji: "🛍️", color: "#a855f7" },
  { name: "Bills",    emoji: "🧾", color: "#ef4444" },
  { name: "Fun",      emoji: "🎮", color: "#22c55e" },
  { name: "Other",    emoji: "📦", color: "#64748b" },
];

// ---------- tiny helpers ----------

const $ = (id) => document.getElementById(id);

// ₹120.50 — paise in, rupees out. the ONLY place money is formatted
function formatMoney(paise) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-11-06" -> "2026-11"
function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short" }) + (y !== new Date().getFullYear() ? " " + String(y).slice(2) : "");
}

function catByName(name) {
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}

// ---------- state ----------

let expenses = [];
try {
  expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
} catch {
  expenses = [];
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// ---------- adding ----------

$("expense-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const desc = $("f-desc").value.trim();
  const amountPaise = Math.round(parseFloat($("f-amount").value) * 100);
  const category = $("f-category").value;
  const date = $("f-date").value;

  if (!desc || !Number.isFinite(amountPaise) || amountPaise <= 0 || !date) return;

  expenses.push({
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    desc,
    category,
    amountPaise,
    date,
  });

  save();
  e.target.reset();
  $("f-date").value = todayISO();
  render();
  $("f-desc").focus();
});

// deleting — event delegation so one listener covers every row forever
$("expense-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete-id]");
  if (!btn) return;
  expenses = expenses.filter((x) => x.id !== btn.dataset.deleteId);
  save();
  render();
});

$("load-demo").addEventListener("click", () => {
  expenses.push(...demoData());
  save();
  render();
});

$("filter-category").addEventListener("change", render);
$("filter-month").addEventListener("change", render);
$("clear-filters").addEventListener("click", () => {
  $("filter-category").value = "";
  $("filter-month").value = "";
  render();
});

// ---------- rendering ----------

function render() {
  renderFilterOptions();
  const filtered = applyFilters();
  renderStats(filtered);
  renderList(filtered);
  renderCategorySplit(filtered);
  drawChart(); // chart always shows the overall 6-month trend, unaffected by filters
}

function applyFilters() {
  const fCat = $("filter-category").value;
  const fMonth = $("filter-month").value;
  return expenses.filter((x) =>
    (!fCat || x.category === fCat) && (!fMonth || monthKey(x.date) === fMonth)
  );
}

function renderFilterOptions() {
  // populate date-derived list only once per distinct month
  const selCat = $("filter-category");
  if (selCat.options.length === 0) {
    selCat.append(new Option("All categories", ""));
    CATEGORIES.forEach((c) => selCat.append(new Option(c.name, c.name)));
  }

  const months = [...new Set(expenses.map((x) => monthKey(x.date)))].sort().reverse();
  const selMonth = $("filter-month");
  const current = selMonth.value;
  selMonth.replaceChildren(new Option("All months", ""));
  months.forEach((m) => selMonth.append(new Option(monthLabel(m), m)));
  if (months.includes(current)) selMonth.value = current;

  const active = selCat.value || selMonth.value;
  $("clear-filters").classList.toggle("hidden", !active);
}

function renderStats(filtered) {
  const thisMonth = monthKey(todayISO());
  const monthTotal = filtered
    .filter((x) => monthKey(x.date) === thisMonth)
    .reduce((sum, x) => sum + x.amountPaise, 0);

  const allTotal = filtered.reduce((sum, x) => sum + x.amountPaise, 0);

  // top category by spend within the filtered set, this month only
  const byCat = {};
  filtered.filter((x) => monthKey(x.date) === thisMonth).forEach((x) => {
    byCat[x.category] = (byCat[x.category] || 0) + x.amountPaise;
  });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  $("stat-month").textContent = formatMoney(monthTotal);
  $("stat-total").textContent = formatMoney(allTotal);
  $("stat-count").textContent = String(filtered.length) + (filtered.length === expenses.length ? "" : " / " + expenses.length);
  $("stat-top").textContent = top ? `${catByName(top[0]).emoji} ${top[0]}` : "—";
}

function renderList(filtered) {
  const list = $("expense-list");
  list.replaceChildren();

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  sorted.forEach((x) => {
    const cat = catByName(x.category);
    const li = document.createElement("li");
    li.className = "expense-item";

    const emoji = document.createElement("span");
    emoji.className = "exp-emoji";
    emoji.textContent = cat.emoji;

    const desc = document.createElement("span");
    desc.className = "exp-desc";
    desc.textContent = x.desc;

    const chip = document.createElement("span");
    chip.className = "exp-chip";
    chip.style.background = cat.color;
    chip.textContent = x.category;
    chip.title = "filter by " + x.category;
    chip.style.cursor = "pointer";
    chip.addEventListener("click", () => { $("filter-category").value = x.category; render(); });

    const date = document.createElement("span");
    date.className = "exp-date";
    date.textContent = x.date.slice(8) + "/" + x.date.slice(5, 7);

    const amount = document.createElement("span");
    amount.className = "exp-amount";
    amount.textContent = formatMoney(x.amountPaise);

    const del = document.createElement("button");
    del.className = "exp-delete";
    del.textContent = "✕";
    del.title = "Delete";
    del.dataset.deleteId = x.id;

    li.append(emoji, desc, chip, date, amount, del);
    list.append(li);
  });

  const nothing = sorted.length === 0;
  list.classList.toggle("hidden", nothing);
  $("empty-state").classList.toggle("hidden", !nothing);
  if (nothing && expenses.length > 0) {
    $("empty-state").querySelector("p").textContent = "No expenses match the current filters.";
  } else if (nothing) {
    $("empty-state").querySelector("p").textContent = "Nothing tracked yet. Add your first expense or load demo data.";
  }
}

function renderCategorySplit(filtered) {
  const box = $("category-split");
  box.replaceChildren();

  const total = filtered.reduce((sum, x) => sum + x.amountPaise, 0);
  $("split-title").textContent = $('filter-category').value || $('filter-month').value
    ? "Category split (filters on)"
    : "Category split";

  if (total === 0) {
    const p = document.createElement("p");
    p.className = "sub";
    p.style.margin = "0";
    p.textContent = "Nothing to split yet.";
    box.append(p);
    return;
  }

  const byCat = {};
  filtered.forEach((x) => {
    byCat[x.category] = (byCat[x.category] || 0) + x.amountPaise;
  });

  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([name, paise]) => {
    const cat = catByName(name);
    const row = document.createElement("div");
    row.className = "split-row";

    const head = document.createElement("div");
    head.className = "split-head";
    head.innerHTML = `<span>${cat.emoji} ${name}</span><strong>${formatMoney(paise)}</strong>`;

    const bar = document.createElement("div");
    bar.className = "split-bar";
    const fill = document.createElement("div");
    fill.className = "split-fill";
    fill.style.background = cat.color;
    fill.style.width = (paise / total) * 100 + "%";

    bar.append(fill);
    row.append(head, bar);
    box.append(row);
  });
}

// ---------- canvas chart ----------

function drawChart() {
  const canvas = $("chart");
  const cssW = canvas.clientWidth || 560;
  const cssH = 220; // keep in sync with the #chart CSS height
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // handle retina crisply
  ctx.clearRect(0, 0, cssW, cssH);

  // totals for the last 6 months, oldest first
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      ym,
      label: monthLabel(ym),
      total: expenses.filter((x) => monthKey(x.date) === ym).reduce((s, x) => s + x.amountPaise, 0),
    });
  }

  const maxY = Math.max(...months.map((m) => m.total), 1);
  const padL = 10, padR = 10, padTop = 24, padBottom = 26;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padTop - padBottom;
  const barSlot = plotW / months.length;
  const barW = Math.min(barSlot * 0.55, 52);

  // horizontal gridlines
  ctx.strokeStyle = "#ececec";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
  }

  months.forEach((m, i) => {
    const h = Math.round((m.total / maxY) * plotH);
    const x = padL + barSlot * i + (barSlot - barW) / 2;
    const y = padTop + plotH - h + 2; // +2 keeps 0-height months flat on the baseline

    // bar
    ctx.fillStyle = m.total > 0 ? "#0d9488" : "#dff2f0";
    roundRect(ctx, x, y, barW, Math.max(h, 4), 6);
    ctx.fill();

    // value on top of each bar (compact: ₹1.2k)
    if (m.total > 0) {
      ctx.fillStyle = "#2b2a27";
      ctx.font = "600 11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(compactMoney(m.total), x + barW / 2, y - 6);
    }

    // month label below
    ctx.fillStyle = "#8a877e";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(m.label, x + barW / 2, cssH - 8);
  });
}

function compactMoney(paise) {
  const rupees = paise / 100;
  if (rupees >= 1000) return "₹" + (rupees / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + Math.round(rupees);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// redraw on resize so the canvas never goes blurry/stretched
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawChart, 150);
});

// ---------- demo data ----------

function demoData() {
  const recipes = {
    Food: ["Filter coffee", "Dosa plate", "Lunch thali", "Groceries - veggies", "Swiggy order"],
    Travel: ["Metro card top-up", "Auto to office", "Petrol top-up", "Bus ticket", "Cab to airport"],
    Shopping: ["T-shirt", "Notebook pack", "Earphone case", "Sandals", "Rent: cushion? no — pillow"],
    Bills: ["Wifi recharge", "Electricity bill", "Mobile recharge", "Gas cylinder", "Rent share"],
    Fun: ["Movie ticket", "Game pass", "Bowling", "Concert ticket", "Board game"],
    Other: ["Gift for someone", "Laundry", "Replacement key", "Photo print", "Donation"],
  };

  const out = [];
  const now = new Date();
  for (let i = 0; i < 26; i++) {
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const monthsBack = Math.floor(Math.random() * 5); // 0..4 months ago
    const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 2 + Math.floor(Math.random() * 26));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const rupees = 40 + Math.floor(Math.random() * 8) * 45 + Math.floor(Math.random() * 12) * 25;
    out.push({
      id: "demo-" + i + "-" + Math.random().toString(36).slice(2, 6),
      desc: recipes[cat.name][Math.floor(Math.random() * recipes[cat.name].length)],
      category: cat.name,
      amountPaise: rupees * 100,
      date: iso,
    });
  }
  return out;
}

// ---------- boot ----------

$("f-category").append(...CATEGORIES.map((c) => new Option(c.name, c.name)));
$("f-date").value = todayISO();
render();
