/**
 * ============================================================
 * DOOM SPENDING TRACKER — 
 * Vanilla JS | localStorage | Chart.js
 * Features (MVP):
 *   1. Total spending header card (auto-update)
 *   2. Add transaction form with validation
 *   3. Scrollable transaction list with delete
 *   4. Doughnut chart (Chart.js) — auto-update
 *
 * Optional Challenges (3/5):
 *   1. Custom Category Builder (with Surabaya presets)
 *   2. Sort transactions (newest/oldest/highest/lowest/category)
 *   3. Dark / Light Mode Toggle
 * ============================================================
 */

'use strict';

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */

const STORAGE_KEY_TRANSACTIONS = 'doomspending_transactions';
const STORAGE_KEY_CATEGORIES   = 'doomspending_custom_categories';
const STORAGE_KEY_THEME        = 'doomspending_theme';
const STORAGE_KEY_INCOME       = 'doomspending_income';

/** Default categories always present in the select */
const DEFAULT_CATEGORIES = [
  { value: 'Makanan',      label: '🍽️ Makanan' },
  { value: 'Transportasi', label: '🚗 Transportasi' },
  { value: 'Hiburan',      label: '🎮 Hiburan' },
];

/** Emoji map for known income category names */
const INCOME_CATEGORY_EMOJI = {
  'Gaji':      '💼',
  'Bonus':     '🎁',
  'Uang Saku': '🪙',
  'Lain-lain': '📦',
};

/** Emoji map for known expense category names */
const CATEGORY_EMOJI = {
  'Makanan':              '🍽️',
  'Transportasi':         '🚗',
  'Hiburan':              '🎮',
  'Nongkrong Tunjungan':  '☕',
  'Ojol Pas Hujan':       '🛵',
  'Sego Sambel Malam':    '🍛',
  'Es Teh Pakde':         '🧊',
  'Bakso Cak Budi':       '🍜',
  'Parkir Mal':           '🅿️',
  'Jajan Tengah Malam':   '🌙',
  'Top Up Game':          '🎮',
};

/** Pastel colours for chart slices (cycles if more categories) */
const CHART_COLORS = [
  '#a78bfa', '#f472b6', '#fb923c', '#34d399',
  '#60a5fa', '#fbbf24', '#f87171', '#818cf8',
  '#2dd4bf', '#e879f9',
];

/** App state — single source of truth */
let state = {
  transactions:      [],   // { id, name, amount, category, timestamp }
  incomes:           [],   // { id, name, amount, category, timestamp }
  customCategories:  [],   // string[]
  theme:             'light',
  sortOrder:         'newest',
  listFilter:        'all', // 'all' | 'income' | 'expense'
  chart:             null,
};

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const dom = {
  // Header summary
  totalIncome:   document.getElementById('totalIncome'),
  incomeCount:   document.getElementById('incomeCount'),
  totalAmount:   document.getElementById('totalAmount'),
  totalCount:    document.getElementById('totalCount'),
  balanceAmount: document.getElementById('balanceAmount'),
  balanceStatus: document.getElementById('balanceStatus'),
  themeToggle:   document.getElementById('themeToggle'),
  themeIcon:     document.getElementById('themeIcon'),

  // Income form
  incomeForm:          document.getElementById('incomeForm'),
  incomeName:          document.getElementById('incomeName'),
  incomeAmount:        document.getElementById('incomeAmount'),
  incomeCategory:      document.getElementById('incomeCategory'),
  incomeDate:          document.getElementById('incomeDate'),
  incomeNameError:     document.getElementById('incomeNameError'),
  incomeAmountError:   document.getElementById('incomeAmountError'),
  incomeDateError:     document.getElementById('incomeDateError'),

  // Expense form
  form:          document.getElementById('spendingForm'),
  itemName:      document.getElementById('itemName'),
  itemAmount:    document.getElementById('itemAmount'),
  itemCategory:  document.getElementById('itemCategory'),
  itemDate:      document.getElementById('itemDate'),
  nameError:     document.getElementById('nameError'),
  amountError:   document.getElementById('amountError'),
  categoryError: document.getElementById('categoryError'),
  itemDateError: document.getElementById('itemDateError'),
  btnAddCat:     document.getElementById('btnAddCategory'),

  // List
  transactionList: document.getElementById('transactionList'),
  emptyState:      document.getElementById('emptyState'),
  sortSelect:      document.getElementById('sortSelect'),
  filterTabs:      document.getElementById('filterTabs'),

  // Chart
  chartCanvas:  document.getElementById('spendingChart'),
  chartEmpty:   document.getElementById('chartEmpty'),

  // Modal
  modal:               document.getElementById('categoryModal'),
  modalClose:          document.getElementById('modalClose'),
  presetGrid:          document.getElementById('presetGrid'),
  customCategoryInput: document.getElementById('customCategoryInput'),
  btnModalAdd:         document.getElementById('btnModalAdd'),
  customCategoryError: document.getElementById('customCategoryError'),

  // Toast
  toast: document.getElementById('toast'),
};

/* ============================================================
   PERSISTENCE HELPERS
   ============================================================ */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(state.transactions));
}

function saveCustomCategories() {
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(state.customCategories));
}

function saveIncomes() {
  localStorage.setItem(STORAGE_KEY_INCOME, JSON.stringify(state.incomes));
}

function loadFromStorage() {
  try {
    const tx = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (tx) state.transactions = JSON.parse(tx);
  } catch { state.transactions = []; }

  try {
    const inc = localStorage.getItem(STORAGE_KEY_INCOME);
    if (inc) state.incomes = JSON.parse(inc);
  } catch { state.incomes = []; }

  try {
    const cats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (cats) state.customCategories = JSON.parse(cats);
  } catch { state.customCategories = []; }

  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  state.theme = savedTheme === 'dark' ? 'dark' : 'light';
}

/* ============================================================
   UTILITY HELPERS
   ============================================================ */

/** Format number as Indonesian Rupiah */
function formatRupiah(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Get emoji for a spending category */
function getCategoryEmoji(category) {
  return CATEGORY_EMOJI[category] || '🏷️';
}

/** Get emoji for an income category */
function getIncomeEmoji(category) {
  return INCOME_CATEGORY_EMOJI[category] || '💵';
}

/** Format date string (YYYY-MM-DD) to Indonesian locale e.g. "23 Jul 2026" */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Returns today's date as YYYY-MM-DD string (for input default) */
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Show a toast notification */
let toastTimer = null;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 2800);
}

/** Animate a summary amount element on update */
function bumpEl(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

/* ============================================================
   THEME (Dark / Light Mode Toggle)
   ============================================================ */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  // Refresh chart colours for dark/light context
  if (state.chart) updateChart();
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

/* ============================================================
   CATEGORY SELECT — build <option> list
   ============================================================ */
function buildCategorySelect() {
  // Keep the default <optgroup> intact; only manage the custom group
  // Remove existing custom optgroup if present
  const existing = dom.itemCategory.querySelector('optgroup[label="Kategori Kustom"]');
  if (existing) existing.remove();

  if (state.customCategories.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Kategori Kustom';
    state.customCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${getCategoryEmoji(cat)} ${cat}`;
      group.appendChild(opt);
    });
    dom.itemCategory.appendChild(group);
  }
}

/** Mark preset chips as used if category already exists */
function syncPresetChips() {
  const allCategories = new Set([
    ...DEFAULT_CATEGORIES.map(c => c.value),
    ...state.customCategories,
  ]);
  dom.presetGrid.querySelectorAll('.preset-chip').forEach(chip => {
    const preset = chip.dataset.preset;
    chip.classList.toggle('used', allCategories.has(preset));
  });
}

/* ============================================================
   ADD CUSTOM CATEGORY
   ============================================================ */
function addCustomCategory(name) {
  const trimmed = name.trim();
  if (!trimmed) return false;

  // Duplicate check (case-insensitive)
  const allExisting = [
    ...DEFAULT_CATEGORIES.map(c => c.value.toLowerCase()),
    ...state.customCategories.map(c => c.toLowerCase()),
  ];
  if (allExisting.includes(trimmed.toLowerCase())) {
    showToast('Kategori sudah ada!', 'error');
    return false;
  }

  state.customCategories.push(trimmed);
  // Add emoji mapping if it's a known preset
  saveCustomCategories();
  buildCategorySelect();
  syncPresetChips();

  // Select the newly added category in form
  dom.itemCategory.value = trimmed;
  return true;
}

/* ============================================================
   MODAL OPEN / CLOSE
   ============================================================ */
function openModal() {
  syncPresetChips();
  dom.customCategoryInput.value = '';
  dom.customCategoryError.style.display = 'none';
  dom.modal.classList.add('open');
  setTimeout(() => dom.customCategoryInput.focus(), 150);
}

function closeModal() {
  dom.modal.classList.remove('open');
}

/* ============================================================
   RENDER — SUMMARY CARDS (Pemasukan / Pengeluaran / Sisa Saldo)
   ============================================================ */
function renderSummary() {
  const totalExp = state.transactions.reduce((s, t) => s + t.amount, 0);
  const totalInc = state.incomes.reduce((s, i) => s + i.amount, 0);
  const balance  = totalInc - totalExp;

  dom.totalAmount.textContent  = formatRupiah(totalExp);
  dom.totalCount.textContent   = `${state.transactions.length} transaksi`;
  dom.totalIncome.textContent  = formatRupiah(totalInc);
  dom.incomeCount.textContent  = `${state.incomes.length} pemasukan`;

  // Balance card
  const balanceCard = dom.balanceAmount.closest('.summary-card');
  balanceCard.classList.remove('balance-positive', 'balance-negative', 'balance-zero');
  if (balance > 0) {
    dom.balanceAmount.textContent = formatRupiah(balance);
    dom.balanceStatus.textContent = 'Masih aman, gas terus! 🚀';
    balanceCard.classList.add('balance-positive');
  } else if (balance < 0) {
    dom.balanceAmount.textContent = '−' + formatRupiah(Math.abs(balance));
    dom.balanceStatus.textContent = 'Awas, dompet sekarat! 😱';
    balanceCard.classList.add('balance-negative');
  } else {
    dom.balanceAmount.textContent = formatRupiah(0);
    dom.balanceStatus.textContent = 'Pas banget, tipis! 😅';
    balanceCard.classList.add('balance-zero');
  }

  bumpEl(dom.totalAmount);
  bumpEl(dom.totalIncome);
  bumpEl(dom.balanceAmount);
}

/* ============================================================
   RENDER — TRANSACTION LIST
   ============================================================ */

/** Build a combined + filtered + sorted list of all entries */
function getCombinedList() {
  // tag each entry with its type
  const expenses = state.transactions.map(t => ({ ...t, _type: 'expense' }));
  const incomes  = state.incomes.map(i => ({ ...i, _type: 'income' }));

  let combined;
  if (state.listFilter === 'income')  combined = incomes;
  else if (state.listFilter === 'expense') combined = expenses;
  else combined = [...expenses, ...incomes];

  switch (state.sortOrder) {
    case 'newest':   return combined.sort((a, b) => b.timestamp - a.timestamp);
    case 'oldest':   return combined.sort((a, b) => a.timestamp - b.timestamp);
    case 'highest':  return combined.sort((a, b) => b.amount - a.amount);
    case 'lowest':   return combined.sort((a, b) => a.amount - b.amount);
    case 'category': return combined.sort((a, b) => a.category.localeCompare(b.category, 'id'));
    default:         return combined;
  }
}

function renderList() {
  const sorted = getCombinedList();

  // Show/hide empty state
  dom.emptyState.classList.toggle('hidden', sorted.length > 0);

  // Remove existing items (keep emptyState node)
  const existingItems = dom.transactionList.querySelectorAll('.transaction-item');
  existingItems.forEach(el => el.remove());

  sorted.forEach(tx => {
    const item = document.createElement('div');
    const isIncome = tx._type === 'income';
    item.className = `transaction-item${isIncome ? ' item-income' : ' item-expense'}`;
    item.dataset.id = tx.id;

    const emoji  = isIncome ? getIncomeEmoji(tx.category) : getCategoryEmoji(tx.category);
    const badge  = isIncome
      ? `<span class="item-type-badge badge-income">Masuk</span>`
      : `<span class="item-type-badge badge-expense">Keluar</span>`;
    const deleteAttr = isIncome ? 'data-income-id' : 'data-id';

    item.innerHTML = `
      <span class="item-emoji">${emoji}</span>
      <div class="item-info">
        <p class="item-name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}</p>
        <p class="item-category">${escapeHtml(tx.category)} ${badge}</p>
        ${tx.date ? `<p class="item-date">📅 ${escapeHtml(formatDate(tx.date))}</p>` : ''}
      </div>
      <div class="item-right">
        <span class="item-amount ${isIncome ? 'amount-income' : 'amount-expense'}">${isIncome ? '+' : '−'}${formatRupiah(tx.amount)}</span>
        <button class="btn-delete" ${deleteAttr}="${tx.id}" aria-label="Hapus ${escapeHtml(tx.name)}" title="Hapus">✕</button>
      </div>
    `;
    dom.transactionList.appendChild(item);
  });
}

/** Simple HTML escape to prevent XSS from user input */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   RENDER — CHART
   ============================================================ */

/** Aggregate spending totals per category */
function getCategoryTotals() {
  const map = {};
  state.transactions.forEach(tx => {
    map[tx.category] = (map[tx.category] || 0) + tx.amount;
  });
  return map;
}

function updateChart() {
  const totals    = getCategoryTotals();
  const labels    = Object.keys(totals);
  const data      = Object.values(totals);
  const hasData   = labels.length > 0;

  // Toggle empty state overlay
  dom.chartEmpty.classList.toggle('hidden', hasData);

  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#f0e6ff' : '#1e1b2e';

  if (!state.chart) {
    // Create chart instance
    state.chart = new Chart(dom.chartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: CHART_COLORS,
          borderColor:      isDark ? '#1a1030' : '#ffffff',
          borderWidth:      3,
          hoverBorderWidth: 4,
          hoverOffset:      8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color:      textColor,
              font:       { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' },
              padding:    12,
              boxWidth:   12,
              boxHeight:  12,
              borderRadius: 4,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatRupiah(ctx.parsed)}`,
            },
            titleFont:  { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
            bodyFont:   { family: "'Plus Jakarta Sans', sans-serif" },
            padding:    10,
            cornerRadius: 8,
          },
        },
        animation: { duration: 400, easing: 'easeInOutQuart' },
      },
    });
  } else {
    // Update existing chart
    state.chart.data.labels   = labels;
    state.chart.data.datasets[0].data            = data;
    state.chart.data.datasets[0].borderColor     = isDark ? '#1a1030' : '#ffffff';
    state.chart.options.plugins.legend.labels.color = textColor;
    state.chart.update('active');
  }
}

/* ============================================================
   RENDER ALL — single call to refresh every UI piece
   ============================================================ */
function renderAll() {
  renderSummary();
  renderList();
  updateChart();
}

/* ============================================================
   FORM VALIDATION & SUBMISSION
   ============================================================ */

/** Mark / unmark a form field group as errored */
function setFieldError(inputEl, errorEl, hasError) {
  const group = inputEl.closest('.form-group');
  group.classList.toggle('error', hasError);
  errorEl.style.display = hasError ? 'block' : 'none';
}

function clearAllErrors() {
  setFieldError(dom.itemName,     dom.nameError,     false);
  setFieldError(dom.itemAmount,   dom.amountError,   false);
  setFieldError(dom.itemCategory, dom.categoryError, false);
  setFieldError(dom.itemDate,     dom.itemDateError, false);
}

function clearIncomeErrors() {
  setFieldError(dom.incomeName,   dom.incomeNameError,   false);
  setFieldError(dom.incomeAmount, dom.incomeAmountError, false);
  setFieldError(dom.incomeDate,   dom.incomeDateError,   false);
}

function validateIncomeForm() {
  let valid = true;
  const name   = dom.incomeName.value.trim();
  const amount = parseFloat(dom.incomeAmount.value);
  const date   = dom.incomeDate.value;

  if (!name) {
    setFieldError(dom.incomeName, dom.incomeNameError, true);
    valid = false;
  } else {
    setFieldError(dom.incomeName, dom.incomeNameError, false);
  }

  if (!dom.incomeAmount.value || isNaN(amount) || amount <= 0) {
    setFieldError(dom.incomeAmount, dom.incomeAmountError, true);
    valid = false;
  } else {
    setFieldError(dom.incomeAmount, dom.incomeAmountError, false);
  }

  if (!date) {
    setFieldError(dom.incomeDate, dom.incomeDateError, true);
    valid = false;
  } else {
    setFieldError(dom.incomeDate, dom.incomeDateError, false);
  }

  return valid;
}

function handleIncomeSubmit(e) {
  e.preventDefault();
  if (!validateIncomeForm()) return;

  const newIncome = {
    id:        uid(),
    name:      dom.incomeName.value.trim(),
    amount:    parseFloat(dom.incomeAmount.value),
    category:  dom.incomeCategory.value,
    date:      dom.incomeDate.value,
    timestamp: Date.now(),
  };

  state.incomes.unshift(newIncome);
  saveIncomes();
  renderAll();

  dom.incomeForm.reset();
  dom.incomeDate.value = todayStr(); // restore default after reset
  clearIncomeErrors();
  dom.incomeName.focus();

  showToast(`💰 "${newIncome.name}" dicatat sebagai pemasukan!`, 'success');
}

function validateForm() {
  let valid = true;

  const name     = dom.itemName.value.trim();
  const amount   = parseFloat(dom.itemAmount.value);
  const category = dom.itemCategory.value;

  if (!name) {
    setFieldError(dom.itemName, dom.nameError, true);
    valid = false;
  } else {
    setFieldError(dom.itemName, dom.nameError, false);
  }

  if (!dom.itemAmount.value || isNaN(amount) || amount <= 0) {
    setFieldError(dom.itemAmount, dom.amountError, true);
    valid = false;
  } else {
    setFieldError(dom.itemAmount, dom.amountError, false);
  }

  if (!category) {
    setFieldError(dom.itemCategory, dom.categoryError, true);
    valid = false;
  } else {
    setFieldError(dom.itemCategory, dom.categoryError, false);
  }

  const date = dom.itemDate.value;
  if (!date) {
    setFieldError(dom.itemDate, dom.itemDateError, true);
    valid = false;
  } else {
    setFieldError(dom.itemDate, dom.itemDateError, false);
  }

  return valid;
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const newTransaction = {
    id:        uid(),
    name:      dom.itemName.value.trim(),
    amount:    parseFloat(dom.itemAmount.value),
    category:  dom.itemCategory.value,
    date:      dom.itemDate.value,
    timestamp: Date.now(),
  };

  // Prepend so newest appears first in raw array
  state.transactions.unshift(newTransaction);
  saveTransactions();
  renderAll();

  // Reset form
  dom.form.reset();
  dom.itemDate.value = todayStr(); // restore default after reset
  clearAllErrors();
  dom.itemName.focus();

  showToast(`✅ "${newTransaction.name}" dicatat!`, 'success');
}

/* ============================================================
   DELETE TRANSACTION / INCOME
   ============================================================ */
function handleDeleteTransaction(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  state.transactions = state.transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
  showToast(`🗑️ "${tx.name}" dihapus.`, 'info');
}

function handleDeleteIncome(id) {
  const inc = state.incomes.find(i => i.id === id);
  if (!inc) return;

  state.incomes = state.incomes.filter(i => i.id !== id);
  saveIncomes();
  renderAll();
  showToast(`🗑️ "${inc.name}" dihapus.`, 'info');
}

/* ============================================================
   SORT
   ============================================================ */
function handleSortChange() {
  state.sortOrder = dom.sortSelect.value;
  renderList(); // no need to re-calculate totals/chart
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function initEventListeners() {
  // Income form submit
  dom.incomeForm.addEventListener('submit', handleIncomeSubmit);
  dom.incomeName.addEventListener('input',   () => setFieldError(dom.incomeName,   dom.incomeNameError,   false));
  dom.incomeAmount.addEventListener('input', () => setFieldError(dom.incomeAmount, dom.incomeAmountError, false));
  dom.incomeDate.addEventListener('change',  () => setFieldError(dom.incomeDate,   dom.incomeDateError,   false));

  // Expense form submit
  dom.form.addEventListener('submit', handleFormSubmit);

  // Clear individual field errors on input
  dom.itemName.addEventListener('input',    () => setFieldError(dom.itemName,     dom.nameError,     false));
  dom.itemAmount.addEventListener('input',  () => setFieldError(dom.itemAmount,   dom.amountError,   false));
  dom.itemCategory.addEventListener('change', () => setFieldError(dom.itemCategory, dom.categoryError, false));
  dom.itemDate.addEventListener('change',   () => setFieldError(dom.itemDate,     dom.itemDateError, false));

  // Transaction list — event delegation for BOTH delete buttons
  dom.transactionList.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    if (btn.dataset.incomeId) handleDeleteIncome(btn.dataset.incomeId);
    else if (btn.dataset.id)  handleDeleteTransaction(btn.dataset.id);
  });

  // Filter tabs
  dom.filterTabs.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    dom.filterTabs.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    state.listFilter = tab.dataset.filter;
    renderList();
  });

  // Sort
  dom.sortSelect.addEventListener('change', handleSortChange);

  // Theme toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Open custom category modal
  dom.btnAddCat.addEventListener('click', openModal);

  // Close modal — X button
  dom.modalClose.addEventListener('click', closeModal);

  // Close modal — click on overlay backdrop
  dom.modal.addEventListener('click', e => {
    if (e.target === dom.modal) closeModal();
  });

  // Close modal — Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dom.modal.classList.contains('open')) closeModal();
  });

  // Preset chip click
  dom.presetGrid.addEventListener('click', e => {
    const chip = e.target.closest('.preset-chip');
    if (!chip || chip.classList.contains('used')) return;
    const name = chip.dataset.preset;
    if (addCustomCategory(name)) {
      showToast(`🎉 Kategori "${name}" ditambahkan!`, 'success');
      closeModal();
    }
  });

  // Add custom category from text input
  dom.btnModalAdd.addEventListener('click', submitCustomCategory);
  dom.customCategoryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitCustomCategory(); }
  });
}

function submitCustomCategory() {
  const name = dom.customCategoryInput.value.trim();
  if (!name) {
    dom.customCategoryError.style.display = 'block';
    dom.customCategoryInput.focus();
    return;
  }
  dom.customCategoryError.style.display = 'none';

  if (addCustomCategory(name)) {
    dom.customCategoryInput.value = '';
    showToast(`🎉 Kategori "${name}" ditambahkan!`, 'success');
    closeModal();
  }
}

/* ============================================================
   BOOTSTRAP — INIT
   ============================================================ */
function init() {
  loadFromStorage();
  applyTheme(state.theme);
  buildCategorySelect();
  // Set default date to today for both forms
  const today = todayStr();
  dom.incomeDate.value = today;
  dom.itemDate.value   = today;
  renderAll();
  initEventListeners();
}

// Kick everything off when DOM is ready
document.addEventListener('DOMContentLoaded', init);
