/**
 * FocusTrack — Personal Study & Productivity Tracker
 * Vanilla JS + localStorage + Chart.js
 */

(function () {
  'use strict';

  // ========== STORAGE KEYS ==========
  const KEYS = {
    entries: 'ft_entries',
    categories: 'ft_categories',
    todos: 'ft_todos',
    todoHistory: 'ft_todo_history',
    journals: 'ft_journals',
    readings: 'ft_readings',
    theme: 'ft_theme',
    goals: 'ft_goals',
    pomoSettings: 'ft_pomo_settings',
    habits: 'ft_habits',
    habitLogs: 'ft_habit_logs',
    weeklyReviewPrompted: 'ft_weekly_review_prompted',
  };

  // ========== STATE ==========
  let entries = [];
  let categories = ['Job Work'];
  let todos = [];
  let todoHistory = [];
  let journals = [];
  let readings = [];
  let goals = { dailyHours: 2, weeklyHours: 10 };
  let habits = [];
  let habitLogs = {};

  // Chart instances
  let dailySubjectChart = null;
  let dailyTopicChart = null;
  let weeklyBarChart = null;
  let monthlyBarChart = null;
  let compareBarChart = null;

  // Pomodoro state
  let pomo = {
    mode: 'work', // work | short | long
    remainingSec: 25 * 60,
    totalSec: 25 * 60,
    running: false,
    intervalId: null,
    workMin: 25,
    shortMin: 5,
    longMin: 15,
    autoLog: true,
    completedFocusToday: 0,
  };

  // ========== HELPERS ==========
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function minsToHoursMins(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { h, m };
  }

  function parseDuration(hours, minutes) {
    return (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
  }

  function getWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }

  function getMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  function isSameDay(d1, d2) {
    return d1.slice(0, 10) === d2.slice(0, 10);
  }

  // ========== INIT ==========
  function init() {
    entries = load(KEYS.entries, []);
    categories = load(KEYS.categories, ['Job Work']);
    if (!categories.includes('Job Work')) categories.unshift('Job Work');
    todos = load(KEYS.todos, []);
    todoHistory = load(KEYS.todoHistory, []);
    journals = load(KEYS.journals, []);
    readings = load(KEYS.readings, []);
    goals = load(KEYS.goals, { dailyHours: 2, weeklyHours: 10 });
    habits = load(KEYS.habits, []);
    habitLogs = load(KEYS.habitLogs, {});

    const savedPomo = load(KEYS.pomoSettings, null);
    if (savedPomo) {
      pomo.workMin = savedPomo.workMin || 25;
      pomo.shortMin = savedPomo.shortMin || 5;
      pomo.longMin = savedPomo.longMin || 15;
      pomo.autoLog = savedPomo.autoLog !== false;
    }

    // Theme
    const savedTheme = localStorage.getItem(KEYS.theme) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Default dates
    document.getElementById('entryDate').value = todayStr();
    document.getElementById('journalDate').value = todayStr();
    document.getElementById('readingDate').value = todayStr();

    populateCategories();
    populatePomoCategories();
    setupNav();
    setupTheme();
    setupMobileMenu();
    setupEntryForm();
    setupTodo();
    setupJournal();
    setupReading();
    setupViewTabs();
    setupFilters();
    setupExportWeekly();
    setupGoals();
    setupPomodoro();
    setupHabits();
    setupBackupRestore();
    setupWeeklyReview();
    setupPrintWeekly();
    setupEntrySearch();
    maybePromptWeeklyReview();

    renderAll();
  }

  function renderAll() {
    renderTodayEntries();
    renderAllEntries();
    renderTodos();
    renderJournals();
    renderReadings();
    renderHabits();
    renderReviewDue();
    updateDashboard();
    updateGoalsAndStreaks();
    updatePomoTodayCount();
    updateMiniPomo();
  }

  // ========== NAVIGATION ==========
  function setupNav() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('show');
        // Refresh charts when opening dashboard
        if (section === 'dashboard') {
          setTimeout(updateDashboard, 50);
        }
      });
    });
  }

  function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }

  // ========== THEME ==========
  function setupTheme() {
    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(KEYS.theme, next);
      updateThemeIcon(next);
      // Re-render charts with new colors
      setTimeout(updateDashboard, 50);
    });
  }

  function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: isDark ? '#94a3b8' : '#64748b',
      grid: isDark ? '#334155' : '#e2e8f0',
      palette: [
        '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
      ],
    };
  }

  // ========== CATEGORIES ==========
  function populateCategories() {
    const select = document.getElementById('entryCategory');
    const current = select.value;
    select.innerHTML = '<option value="">Select category</option>';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    if (current && categories.includes(current)) select.value = current;
    populatePomoCategories();
    populateFilterCategories();
  }

  function populatePomoCategories() {
    const select = document.getElementById('pomoCategory');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    // Prefer non-Job Work if available
    if (current && categories.includes(current)) {
      select.value = current;
    } else {
      const study = categories.find((c) => c !== 'Job Work');
      select.value = study || categories[0] || '';
    }
  }

  function setupCategoryModal() {
    const modal = document.getElementById('categoryModal');
    const input = document.getElementById('newCategoryInput');
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      input.value = '';
      modal.classList.add('show');
      input.focus();
    });
    document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
      modal.classList.remove('show');
    });
    document.getElementById('saveCategoryBtn').addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;
      if (!categories.includes(name)) {
        categories.push(name);
        save(KEYS.categories, categories);
        populateCategories();
      }
      document.getElementById('entryCategory').value = name;
      modal.classList.remove('show');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('saveCategoryBtn').click();
    });
  }

  // ========== TIME ENTRIES ==========
  function setupEntryForm() {
    setupCategoryModal();
    const form = document.getElementById('entryForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('entryId').value;
      const category = document.getElementById('entryCategory').value;
      const topic = document.getElementById('entryTopic').value.trim();
      const date = document.getElementById('entryDate').value;
      const hours = document.getElementById('entryHours').value;
      const minutes = document.getElementById('entryMinutes').value;
      const notes = document.getElementById('entryNotes').value.trim();
      const duration = parseDuration(hours, minutes);

      if (!category || !topic || !date) return;
      if (duration <= 0) {
        alert('Please enter a duration greater than 0.');
        return;
      }

      if (id) {
        const idx = entries.findIndex((x) => x.id === id);
        if (idx !== -1) {
          entries[idx] = { ...entries[idx], category, topic, date, duration, notes };
        }
      } else {
        entries.push({
          id: uid(),
          category,
          topic,
          date,
          duration,
          notes,
          createdAt: new Date().toISOString(),
        });
      }

      save(KEYS.entries, entries);
      resetEntryForm();
      renderAll();
    });

    document.getElementById('entryCancelBtn').addEventListener('click', resetEntryForm);
  }

  function resetEntryForm() {
    document.getElementById('entryId').value = '';
    document.getElementById('entryForm').reset();
    document.getElementById('entryDate').value = todayStr();
    document.getElementById('entryHours').value = 0;
    document.getElementById('entryMinutes').value = 0;
    document.getElementById('entrySubmitBtn').textContent = 'Add Entry';
    document.getElementById('entryCancelBtn').style.display = 'none';
  }

  function editEntry(id) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    document.getElementById('entryId').value = entry.id;
    document.getElementById('entryCategory').value = entry.category;
    document.getElementById('entryTopic').value = entry.topic;
    document.getElementById('entryDate').value = entry.date;
    const { h, m } = minsToHoursMins(entry.duration);
    document.getElementById('entryHours').value = h;
    document.getElementById('entryMinutes').value = m;
    document.getElementById('entryNotes').value = entry.notes || '';
    document.getElementById('entrySubmitBtn').textContent = 'Update Entry';
    document.getElementById('entryCancelBtn').style.display = 'inline-flex';
    // Switch to add-entry section
    document.querySelector('.nav-item[data-section="add-entry"]').click();
  }

  function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    entries = entries.filter((e) => e.id !== id);
    save(KEYS.entries, entries);
    renderAll();
  }

  function renderTodayEntries() {
    const list = document.getElementById('todayEntriesList');
    const empty = document.getElementById('todayEntriesEmpty');
    const today = todayStr();
    const todays = entries
      .filter((e) => e.date === today)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    list.innerHTML = '';
    if (todays.length === 0) {
      empty.classList.remove('hide');
      return;
    }
    empty.classList.add('hide');
    todays.forEach((e) => list.appendChild(createEntryEl(e)));
  }

  function getEntryFilters() {
    return {
      search: (document.getElementById('entrySearch')?.value || '').trim().toLowerCase(),
      category: document.getElementById('filterCategory')?.value || '',
      type: document.getElementById('filterType')?.value || '',
      from: document.getElementById('filterDateFrom')?.value || '',
      to: document.getElementById('filterDateTo')?.value || '',
    };
  }

  function renderAllEntries() {
    const list = document.getElementById('allEntriesList');
    const empty = document.getElementById('allEntriesEmpty');
    const f = getEntryFilters();
    let filtered = [...entries];

    if (f.search) {
      filtered = filtered.filter((e) => {
        const blob = `${e.category} ${e.topic} ${e.notes || ''}`.toLowerCase();
        return blob.includes(f.search);
      });
    }
    if (f.category) filtered = filtered.filter((e) => e.category === f.category);
    if (f.type === 'study') filtered = filtered.filter((e) => e.category !== 'Job Work');
    if (f.type === 'job') filtered = filtered.filter((e) => e.category === 'Job Work');
    if (f.from) filtered = filtered.filter((e) => e.date >= f.from);
    if (f.to) filtered = filtered.filter((e) => e.date <= f.to);

    filtered.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

    list.innerHTML = '';
    if (filtered.length === 0) {
      empty.classList.remove('hide');
      empty.textContent = entries.length ? 'No entries match your filters.' : 'No entries yet — add your first study session!';
      return;
    }
    empty.classList.add('hide');
    filtered.forEach((e) => list.appendChild(createEntryEl(e)));
  }

  function createEntryEl(e) {
    const div = document.createElement('div');
    div.className = 'entry-item';
    div.innerHTML = `
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(e.category)} — ${escapeHtml(e.topic)}</div>
        <div class="entry-meta">${e.date} · ${formatDuration(e.duration)}</div>
        ${e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : ''}
      </div>
      <div class="entry-duration">${formatDuration(e.duration)}</div>
      <div class="entry-actions">
        <button type="button" class="btn-edit" data-id="${e.id}">Edit</button>
        <button type="button" class="btn-danger" data-id="${e.id}">Delete</button>
      </div>
    `;
    div.querySelector('.btn-edit').addEventListener('click', () => editEntry(e.id));
    div.querySelector('.btn-danger').addEventListener('click', () => deleteEntry(e.id));
    return div;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setupFilters() {
    // legacy no-op; real wiring in setupEntrySearch
  }

  function setupEntrySearch() {
    populateFilterCategories();
    const ids = ['entrySearch', 'filterCategory', 'filterType', 'filterDateFrom', 'filterDateTo'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'entrySearch' ? 'input' : 'change', () => renderAllEntries());
    });
    const clearBtn = document.getElementById('clearFilterBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const search = document.getElementById('entrySearch');
        const cat = document.getElementById('filterCategory');
        const type = document.getElementById('filterType');
        const from = document.getElementById('filterDateFrom');
        const to = document.getElementById('filterDateTo');
        if (search) search.value = '';
        if (cat) cat.value = '';
        if (type) type.value = '';
        if (from) from.value = '';
        if (to) to.value = '';
        renderAllEntries();
      });
    }
  }

  function populateFilterCategories() {
    const select = document.getElementById('filterCategory');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All categories</option>';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  // ========== DASHBOARD ==========
  function setupViewTabs() {
    document.querySelectorAll('.view-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.view-panel').forEach((p) => p.classList.remove('active'));
        document.getElementById('view-' + tab.dataset.view).classList.add('active');
        setTimeout(updateDashboard, 50);
      });
    });
  }

  function updateDashboard() {
    updateDailyView();
    updateWeeklyView();
    updateMonthlyView();
  }

  function updateDailyView() {
    const today = todayStr();
    const todays = entries.filter((e) => e.date === today);
    const totalMins = todays.reduce((s, e) => s + e.duration, 0);
    const studyMins = todays.filter((e) => e.category !== 'Job Work').reduce((s, e) => s + e.duration, 0);
    const jobMins = todays.filter((e) => e.category === 'Job Work').reduce((s, e) => s + e.duration, 0);

    document.getElementById('dailyTotalHours').textContent = formatDuration(totalMins);
    document.getElementById('dailyStudyHours').textContent = formatDuration(studyMins);
    document.getElementById('dailyJobHours').textContent = formatDuration(jobMins);
    document.getElementById('dailySessions').textContent = todays.length;

    // By subject
    const bySubject = {};
    todays.forEach((e) => {
      bySubject[e.category] = (bySubject[e.category] || 0) + e.duration;
    });
    renderDonut('dailySubjectChart', 'dailySubjectEmpty', bySubject);

    // By topic
    const byTopic = {};
    todays.forEach((e) => {
      byTopic[e.topic] = (byTopic[e.topic] || 0) + e.duration;
    });
    renderDonut('dailyTopicChart', 'dailyTopicEmpty', byTopic);
  }

  function renderDonut(canvasId, emptyId, dataMap) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    const wrap = canvas.parentElement;
    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap).map((m) => +(m / 60).toFixed(2));

    if (labels.length === 0) {
      empty.classList.add('show');
      wrap.classList.add('hide');
      if (canvasId === 'dailySubjectChart' && dailySubjectChart) {
        dailySubjectChart.destroy();
        dailySubjectChart = null;
      }
      if (canvasId === 'dailyTopicChart' && dailyTopicChart) {
        dailyTopicChart.destroy();
        dailyTopicChart = null;
      }
      return;
    }
    empty.classList.remove('show');
    wrap.classList.remove('hide');

    const colors = getChartColors();
    const config = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.palette.slice(0, labels.length),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.text, boxWidth: 12, padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const mins = Math.round(ctx.raw * 60);
                return `${ctx.label}: ${formatDuration(mins)}`;
              },
            },
          },
        },
      },
    };

    if (canvasId === 'dailySubjectChart') {
      if (dailySubjectChart) dailySubjectChart.destroy();
      dailySubjectChart = new Chart(canvas, config);
    } else {
      if (dailyTopicChart) dailyTopicChart.destroy();
      dailyTopicChart = new Chart(canvas, config);
    }
  }

  function updateWeeklyView() {
    const { monday, sunday } = getWeekRange();
    const weekEntries = entries.filter((e) => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });
    const totalMins = weekEntries.reduce((s, e) => s + e.duration, 0);
    document.getElementById('weeklyTotalHours').textContent = formatDuration(totalMins);

    // Top subjects
    const bySub = {};
    weekEntries.forEach((e) => {
      bySub[e.category] = (bySub[e.category] || 0) + e.duration;
    });
    const sorted = Object.entries(bySub).sort((a, b) => b[1] - a[1]).slice(0, 3);
    document.getElementById('weeklyTopSubjects').textContent =
      sorted.length ? sorted.map(([k, v]) => `${k} (${formatDuration(v)})`).join(' · ') : '—';

    // Hours per day Mon–Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMins = [0, 0, 0, 0, 0, 0, 0];
    weekEntries.forEach((e) => {
      const d = new Date(e.date + 'T12:00:00');
      let idx = d.getDay() - 1;
      if (idx < 0) idx = 6;
      dayMins[idx] += e.duration;
    });

    const canvas = document.getElementById('weeklyBarChart');
    const empty = document.getElementById('weeklyBarEmpty');
    const wrap = canvas.parentElement;
    const hasData = dayMins.some((m) => m > 0);
    const colors = getChartColors();

    if (!hasData) {
      empty.classList.add('show');
      wrap.classList.add('hide');
      if (weeklyBarChart) {
        weeklyBarChart.destroy();
        weeklyBarChart = null;
      }
    } else {
      empty.classList.remove('show');
      wrap.classList.remove('hide');
      if (weeklyBarChart) weeklyBarChart.destroy();
      weeklyBarChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: dayNames,
          datasets: [{
            label: 'Hours',
            data: dayMins.map((m) => +(m / 60).toFixed(2)),
            backgroundColor: colors.palette[0],
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: colors.text },
              grid: { color: colors.grid },
            },
            x: {
              ticks: { color: colors.text },
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatDuration(Math.round(ctx.raw * 60)),
              },
            },
          },
        },
      });
    }

    updateWeekComparison(monday, sunday, dayNames, dayMins, totalMins);
  }

  function getLastWeekRange(monday) {
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    lastMonday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);
    return { lastMonday, lastSunday };
  }

  function updateWeekComparison(monday, sunday, dayNames, thisDayMins, thisTotal) {
    const { lastMonday, lastSunday } = getLastWeekRange(monday);
    const lastEntries = entries.filter((e) => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= lastMonday && d <= lastSunday;
    });
    const lastTotal = lastEntries.reduce((s, e) => s + e.duration, 0);
    const lastDayMins = [0, 0, 0, 0, 0, 0, 0];
    lastEntries.forEach((e) => {
      const d = new Date(e.date + 'T12:00:00');
      let idx = d.getDay() - 1;
      if (idx < 0) idx = 6;
      lastDayMins[idx] += e.duration;
    });

    document.getElementById('compareThisTotal').textContent = formatDuration(thisTotal);
    document.getElementById('compareLastTotal').textContent = formatDuration(lastTotal);
    document.getElementById('compareThisDetail').textContent =
      `${monday.toISOString().slice(0, 10)} → ${sunday.toISOString().slice(0, 10)}`;
    document.getElementById('compareLastDetail').textContent =
      `${lastMonday.toISOString().slice(0, 10)} → ${lastSunday.toISOString().slice(0, 10)}`;

    const deltaEl = document.getElementById('compareDelta');
    if (lastTotal === 0 && thisTotal === 0) {
      deltaEl.textContent = '—';
      deltaEl.className = 'compare-delta';
    } else if (lastTotal === 0) {
      deltaEl.textContent = 'New';
      deltaEl.className = 'compare-delta up';
    } else {
      const pct = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
      deltaEl.textContent = (pct >= 0 ? '+' : '') + pct + '%';
      deltaEl.className = 'compare-delta ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : '');
    }

    const canvas = document.getElementById('compareBarChart');
    if (!canvas) return;
    const colors = getChartColors();
    if (compareBarChart) compareBarChart.destroy();
    compareBarChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [
          {
            label: 'This week',
            data: thisDayMins.map((m) => +(m / 60).toFixed(2)),
            backgroundColor: colors.palette[0],
            borderRadius: 4,
          },
          {
            label: 'Last week',
            data: lastDayMins.map((m) => +(m / 60).toFixed(2)),
            backgroundColor: colors.palette[4],
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: colors.text }, grid: { color: colors.grid } },
          x: { ticks: { color: colors.text }, grid: { display: false } },
        },
        plugins: {
          legend: { labels: { color: colors.text, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatDuration(Math.round(ctx.raw * 60))}` },
          },
        },
      },
    });
  }

  // ========== WEEKLY PROGRESS EXPORT ==========
  function setupExportWeekly() {
    const btn = document.getElementById('exportWeeklyBtn');
    if (btn) {
      btn.addEventListener('click', exportWeeklyProgress);
    }
  }

  function getWeeklyProgressData() {
    const { monday, sunday } = getWeekRange();
    const weekEntries = entries.filter((e) => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });

    const totalMins = weekEntries.reduce((s, e) => s + e.duration, 0);
    const studyMins = weekEntries
      .filter((e) => e.category !== 'Job Work')
      .reduce((s, e) => s + e.duration, 0);
    const jobMins = weekEntries
      .filter((e) => e.category === 'Job Work')
      .reduce((s, e) => s + e.duration, 0);

    const bySubject = {};
    const byTopic = {};
    weekEntries.forEach((e) => {
      bySubject[e.category] = (bySubject[e.category] || 0) + e.duration;
      byTopic[e.topic] = (byTopic[e.topic] || 0) + e.duration;
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMins = [0, 0, 0, 0, 0, 0, 0];
    const dayDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dayDates.push(d.toISOString().slice(0, 10));
    }
    weekEntries.forEach((e) => {
      const d = new Date(e.date + 'T12:00:00');
      let idx = d.getDay() - 1;
      if (idx < 0) idx = 6;
      dayMins[idx] += e.duration;
    });

    // Todos for this week (current list + matching history)
    const weekTodosCurrent = todos.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });
    const weekTodoHistory = todoHistory.filter((h) => {
      const d = new Date(h.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });

    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    return {
      mondayStr,
      sundayStr,
      weekEntries,
      totalMins,
      studyMins,
      jobMins,
      bySubject,
      byTopic,
      dayNames,
      dayMins,
      dayDates,
      weekTodosCurrent,
      weekTodoHistory,
      sessionCount: weekEntries.length,
    };
  }

  function formatDateShort(iso) {
    try {
      const d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildWeeklyTextReport(data) {
    const lines = [];
    lines.push('========================================');
    lines.push('  FocusTrack — Weekly Progress Report');
    lines.push('========================================');
    lines.push('');
    lines.push(`Period: ${data.mondayStr} → ${data.sundayStr}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('--- SUMMARY ---');
    lines.push(`Total time:     ${formatDuration(data.totalMins)}`);
    lines.push(`Study:          ${formatDuration(data.studyMins)}`);
    lines.push(`Job Work:       ${formatDuration(data.jobMins)}`);
    lines.push(`Sessions:       ${data.sessionCount}`);
    lines.push('');

    lines.push('--- HOURS PER DAY ---');
    data.dayNames.forEach((name, i) => {
      lines.push(`  ${name} (${data.dayDates[i]}): ${formatDuration(data.dayMins[i])}`);
    });
    lines.push('');

    lines.push('--- BY SUBJECT ---');
    const subjects = Object.entries(data.bySubject).sort((a, b) => b[1] - a[1]);
    if (subjects.length === 0) {
      lines.push('  (none)');
    } else {
      subjects.forEach(([k, v]) => lines.push(`  ${k}: ${formatDuration(v)}`));
    }
    lines.push('');

    lines.push('--- BY TOPIC ---');
    const topics = Object.entries(data.byTopic).sort((a, b) => b[1] - a[1]);
    if (topics.length === 0) {
      lines.push('  (none)');
    } else {
      topics.forEach(([k, v]) => lines.push(`  ${k}: ${formatDuration(v)}`));
    }
    lines.push('');

    lines.push('--- SESSION LOG ---');
    if (data.weekEntries.length === 0) {
      lines.push('  (no sessions this week)');
    } else {
      const sorted = [...data.weekEntries].sort((a, b) => a.date.localeCompare(b.date));
      sorted.forEach((e) => {
        lines.push(`  ${e.date} | ${formatDuration(e.duration).padEnd(8)} | ${e.category} — ${e.topic}`);
        if (e.notes) lines.push(`           notes: ${e.notes}`);
      });
    }
    lines.push('');

    lines.push('--- TO-DO (this week) ---');
    let todoLines = 0;
    data.weekTodosCurrent.forEach((t) => {
      lines.push(`  [${t.done ? 'x' : ' '}] ${t.text} (${t.date || 'today'})`);
      todoLines++;
    });
    data.weekTodoHistory.forEach((h) => {
      lines.push(`  — Archived list ${h.date} —`);
      h.tasks.forEach((t) => {
        lines.push(`  [${t.done ? 'x' : ' '}] ${t.text}`);
        todoLines++;
      });
    });
    if (todoLines === 0) lines.push('  (no to-do data for this week)');
    lines.push('');
    lines.push('========================================');
    lines.push('End of report');
    lines.push('========================================');
    return lines.join('\n');
  }

  function buildWeeklyCsv(data) {
    const rows = [];
    // Summary section
    rows.push(['Section', 'Key', 'Value']);
    rows.push(['Summary', 'Period Start', data.mondayStr]);
    rows.push(['Summary', 'Period End', data.sundayStr]);
    rows.push(['Summary', 'Total Minutes', data.totalMins]);
    rows.push(['Summary', 'Total Formatted', formatDuration(data.totalMins)]);
    rows.push(['Summary', 'Study Minutes', data.studyMins]);
    rows.push(['Summary', 'Job Work Minutes', data.jobMins]);
    rows.push(['Summary', 'Sessions', data.sessionCount]);

    data.dayNames.forEach((name, i) => {
      rows.push(['Daily', name + ' ' + data.dayDates[i], data.dayMins[i]]);
    });

    Object.entries(data.bySubject)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => rows.push(['Subject', k, v]));

    Object.entries(data.byTopic)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => rows.push(['Topic', k, v]));

    // Detailed sessions
    rows.push([]);
    rows.push(['Date', 'Category', 'Topic', 'Duration (minutes)', 'Duration (formatted)', 'Notes']);
    const sorted = [...data.weekEntries].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((e) => {
      rows.push([
        e.date,
        e.category,
        e.topic,
        e.duration,
        formatDuration(e.duration),
        (e.notes || '').replace(/"/g, '""'),
      ]);
    });

    return rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(',')
      )
      .join('\n');
  }

  function exportWeeklyProgress() {
    const data = getWeeklyProgressData();
    const stamp = data.mondayStr + '_to_' + data.sundayStr;

    const text = buildWeeklyTextReport(data);
    const csv = buildWeeklyCsv(data);

    downloadBlob(`weekly-progress_${stamp}.txt`, text, 'text/plain;charset=utf-8');
    // Small delay so both downloads trigger reliably in most browsers
    setTimeout(() => {
      downloadBlob(`weekly-progress_${stamp}.csv`, csv, 'text/csv;charset=utf-8');
    }, 250);

    // Brief visual feedback
    const btn = document.getElementById('exportWeeklyBtn');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Exported!';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 1800);
    }
  }

  function updateMonthlyView() {
    const { start, end } = getMonthRange();
    const monthEntries = entries.filter((e) => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= start && d <= end;
    });
    const totalMins = monthEntries.reduce((s, e) => s + e.duration, 0);
    document.getElementById('monthlyTotalHours').textContent = formatDuration(totalMins);

    const bySub = {};
    monthEntries.forEach((e) => {
      bySub[e.category] = (bySub[e.category] || 0) + e.duration;
    });
    const sorted = Object.entries(bySub).sort((a, b) => b[1] - a[1]);
    document.getElementById('monthlyBySubject').textContent =
      sorted.length ? sorted.map(([k, v]) => `${k}: ${formatDuration(v)}`).join(' · ') : '—';

    // Daily totals for current month
    const daysInMonth = end.getDate();
    const labels = [];
    const dayMins = [];
    for (let i = 1; i <= daysInMonth; i++) {
      labels.push(String(i));
      const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const mins = monthEntries.filter((e) => e.date === dateStr).reduce((s, e) => s + e.duration, 0);
      dayMins.push(mins);
    }

    const canvas = document.getElementById('monthlyBarChart');
    const empty = document.getElementById('monthlyBarEmpty');
    const wrap = canvas.parentElement;
    const hasData = dayMins.some((m) => m > 0);

    if (!hasData) {
      empty.classList.add('show');
      wrap.classList.add('hide');
      if (monthlyBarChart) {
        monthlyBarChart.destroy();
        monthlyBarChart = null;
      }
      return;
    }
    empty.classList.remove('show');
    wrap.classList.remove('hide');

    const colors = getChartColors();
    if (monthlyBarChart) monthlyBarChart.destroy();
    monthlyBarChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Hours',
          data: dayMins.map((m) => +(m / 60).toFixed(2)),
          backgroundColor: colors.palette[1],
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: colors.text },
            grid: { color: colors.grid },
          },
          x: {
            ticks: { color: colors.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Day ${items[0].label}`,
              label: (ctx) => formatDuration(Math.round(ctx.raw * 60)),
            },
          },
        },
      },
    });
  }

  // ========== TO-DO ==========
  function setupTodo() {
    document.getElementById('todoForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('todoInput');
      const text = input.value.trim();
      if (!text) return;
      todos.push({
        id: uid(),
        text,
        done: false,
        date: todayStr(),
        createdAt: new Date().toISOString(),
      });
      save(KEYS.todos, todos);
      input.value = '';
      renderTodos();
    });

    document.getElementById('clearCompletedBtn').addEventListener('click', () => {
      todos = todos.filter((t) => !t.done);
      save(KEYS.todos, todos);
      renderTodos();
    });

    document.getElementById('archiveTodosBtn').addEventListener('click', () => {
      if (todos.length === 0) return;
      const snapshot = {
        date: todayStr(),
        tasks: todos.map((t) => ({ text: t.text, done: t.done })),
      };
      todoHistory.unshift(snapshot);
      if (todoHistory.length > 14) todoHistory = todoHistory.slice(0, 14);
      save(KEYS.todoHistory, todoHistory);
      todos = [];
      save(KEYS.todos, todos);
      renderTodos();
    });
  }

  function renderTodos() {
    // Auto-reset if todos are from a previous day
    const today = todayStr();
    const outdated = todos.filter((t) => t.date && t.date !== today);
    if (outdated.length > 0 && todos.every((t) => t.date !== today || t.done)) {
      // Optional: could auto-archive, but we keep current list until user archives
    }

    const list = document.getElementById('todoList');
    const empty = document.getElementById('todoEmpty');
    list.innerHTML = '';

    if (todos.length === 0) {
      empty.classList.remove('hide');
    } else {
      empty.classList.add('hide');
      todos.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (t.done ? ' completed' : '');
        li.innerHTML = `
          <input type="checkbox" class="todo-check" ${t.done ? 'checked' : ''} data-id="${t.id}" />
          <span class="todo-text">${escapeHtml(t.text)}</span>
          <button type="button" class="btn-danger" data-id="${t.id}">Delete</button>
        `;
        li.querySelector('.todo-check').addEventListener('change', (e) => {
          const item = todos.find((x) => x.id === t.id);
          if (item) {
            item.done = e.target.checked;
            save(KEYS.todos, todos);
            renderTodos();
          }
        });
        li.querySelector('.btn-danger').addEventListener('click', () => {
          todos = todos.filter((x) => x.id !== t.id);
          save(KEYS.todos, todos);
          renderTodos();
        });
        list.appendChild(li);
      });
    }

    const done = todos.filter((t) => t.done).length;
    const total = todos.length;
    document.getElementById('todoProgressText').textContent = `${done}/${total} tasks done`;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('todoProgressFill').style.width = pct + '%';

    // History
    const histCard = document.getElementById('todoHistoryCard');
    const histList = document.getElementById('todoHistoryList');
    if (todoHistory.length === 0) {
      histCard.style.display = 'none';
    } else {
      histCard.style.display = 'block';
      histList.innerHTML = '';
      todoHistory.slice(0, 5).forEach((h) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const doneCount = h.tasks.filter((t) => t.done).length;
        div.innerHTML = `
          <strong>${h.date} — ${doneCount}/${h.tasks.length} completed</strong>
          ${h.tasks.map((t) => `<div>${t.done ? '✓' : '○'} ${escapeHtml(t.text)}</div>`).join('')}
        `;
        histList.appendChild(div);
      });
    }
  }

  // ========== JOURNAL ==========
  function setupJournal() {
    document.getElementById('journalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('journalId').value;
      const date = document.getElementById('journalDate').value;
      const text = document.getElementById('journalText').value.trim();
      const review = document.getElementById('journalReview')?.checked || false;
      if (!date || !text) return;

      if (id) {
        const idx = journals.findIndex((j) => j.id === id);
        if (idx !== -1) {
          journals[idx] = {
            ...journals[idx],
            date,
            text,
            review,
            reviewDone: review ? (journals[idx].reviewDone || {}) : {},
          };
        }
      } else {
        journals.push({
          id: uid(),
          date,
          text,
          review,
          reviewDone: {},
          createdAt: new Date().toISOString(),
        });
      }
      save(KEYS.journals, journals);
      resetJournalForm();
      renderJournals();
      renderReviewDue();
    });

    document.getElementById('journalCancelBtn').addEventListener('click', resetJournalForm);
  }

  function resetJournalForm() {
    document.getElementById('journalId').value = '';
    document.getElementById('journalForm').reset();
    document.getElementById('journalDate').value = todayStr();
    document.getElementById('journalSubmitBtn').textContent = 'Save Entry';
    document.getElementById('journalCancelBtn').style.display = 'none';
  }

  function editJournal(id) {
    const j = journals.find((x) => x.id === id);
    if (!j) return;
    document.getElementById('journalId').value = j.id;
    document.getElementById('journalDate').value = j.date;
    document.getElementById('journalText').value = j.text;
    const rev = document.getElementById('journalReview');
    if (rev) rev.checked = !!j.review;
    document.getElementById('journalSubmitBtn').textContent = 'Update Entry';
    document.getElementById('journalCancelBtn').style.display = 'inline-flex';
  }

  function deleteJournal(id) {
    if (!confirm('Delete this journal entry?')) return;
    journals = journals.filter((j) => j.id !== id);
    save(KEYS.journals, journals);
    renderJournals();
    renderReviewDue();
  }

  function renderJournals() {
    const list = document.getElementById('journalList');
    const empty = document.getElementById('journalEmpty');
    const sorted = [...journals].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

    list.innerHTML = '';
    if (sorted.length === 0) {
      empty.classList.remove('hide');
      return;
    }
    empty.classList.add('hide');
    sorted.forEach((j) => {
      const div = document.createElement('div');
      div.className = 'journal-item';
      const badge = j.review ? '<span class="review-badge">Review</span>' : '';
      div.innerHTML = `
        <div class="item-date">${j.date}${badge}</div>
        <div class="item-body">${escapeHtml(j.text)}</div>
        <div class="item-actions">
          <button type="button" class="btn-edit" data-id="${j.id}">Edit</button>
          <button type="button" class="btn-danger" data-id="${j.id}">Delete</button>
        </div>
      `;
      div.querySelector('.btn-edit').addEventListener('click', () => editJournal(j.id));
      div.querySelector('.btn-danger').addEventListener('click', () => deleteJournal(j.id));
      list.appendChild(div);
    });
  }

  function daysBetween(dateStr, today) {
    const a = new Date(dateStr + 'T12:00:00');
    const b = new Date(today + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }

  function renderReviewDue() {
    const card = document.getElementById('reviewDueCard');
    const list = document.getElementById('reviewDueList');
    if (!card || !list) return;
    const today = todayStr();
    const intervals = [1, 3, 7];
    const due = journals.filter((j) => {
      if (!j.review) return false;
      const days = daysBetween(j.date, today);
      return intervals.some((n) => days === n && !(j.reviewDone && j.reviewDone[String(n)]));
    });
    if (due.length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    list.innerHTML = '';
    due.forEach((j) => {
      const days = daysBetween(j.date, today);
      const div = document.createElement('div');
      div.className = 'journal-item';
      div.innerHTML = `
        <div class="item-date">${j.date} · Day ${days} review</div>
        <div class="item-body">${escapeHtml(j.text)}</div>
        <div class="item-actions">
          <button type="button" class="btn primary small mark-reviewed" data-id="${j.id}" data-day="${days}">Mark reviewed</button>
        </div>
      `;
      div.querySelector('.mark-reviewed').addEventListener('click', () => {
        const idx = journals.findIndex((x) => x.id === j.id);
        if (idx !== -1) {
          journals[idx].reviewDone = journals[idx].reviewDone || {};
          journals[idx].reviewDone[String(days)] = true;
          save(KEYS.journals, journals);
          renderReviewDue();
        }
      });
      list.appendChild(div);
    });
  }

  // ========== READING ==========
  function setupReading() {
    document.getElementById('readingForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('readingId').value;
      const title = document.getElementById('readingTitle').value.trim();
      const progress = document.getElementById('readingProgress').value.trim();
      const date = document.getElementById('readingDate').value;
      const notes = document.getElementById('readingNotes').value.trim();
      if (!title || !date) return;

      if (id) {
        const idx = readings.findIndex((r) => r.id === id);
        if (idx !== -1) {
          readings[idx] = { ...readings[idx], title, progress, date, notes };
        }
      } else {
        readings.push({
          id: uid(),
          title,
          progress,
          date,
          notes,
          createdAt: new Date().toISOString(),
        });
      }
      save(KEYS.readings, readings);
      resetReadingForm();
      renderReadings();
    });

    document.getElementById('readingCancelBtn').addEventListener('click', resetReadingForm);
  }

  function resetReadingForm() {
    document.getElementById('readingId').value = '';
    document.getElementById('readingForm').reset();
    document.getElementById('readingDate').value = todayStr();
    document.getElementById('readingSubmitBtn').textContent = 'Add Reading';
    document.getElementById('readingCancelBtn').style.display = 'none';
  }

  function editReading(id) {
    const r = readings.find((x) => x.id === id);
    if (!r) return;
    document.getElementById('readingId').value = r.id;
    document.getElementById('readingTitle').value = r.title;
    document.getElementById('readingProgress').value = r.progress || '';
    document.getElementById('readingDate').value = r.date;
    document.getElementById('readingNotes').value = r.notes || '';
    document.getElementById('readingSubmitBtn').textContent = 'Update Reading';
    document.getElementById('readingCancelBtn').style.display = 'inline-flex';
  }

  function deleteReading(id) {
    if (!confirm('Delete this reading entry?')) return;
    readings = readings.filter((r) => r.id !== id);
    save(KEYS.readings, readings);
    renderReadings();
  }

  function renderReadings() {
    const list = document.getElementById('readingList');
    const empty = document.getElementById('readingEmpty');
    const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

    list.innerHTML = '';
    if (sorted.length === 0) {
      empty.classList.remove('hide');
      return;
    }
    empty.classList.add('hide');
    sorted.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'reading-item';
      div.innerHTML = `
        <div class="item-date">${r.date}</div>
        <div class="item-title">${escapeHtml(r.title)}</div>
        ${r.progress ? `<div class="item-progress">${escapeHtml(r.progress)}</div>` : ''}
        ${r.notes ? `<div class="item-notes">${escapeHtml(r.notes)}</div>` : ''}
        <div class="item-actions">
          <button type="button" class="btn-edit" data-id="${r.id}">Edit</button>
          <button type="button" class="btn-danger" data-id="${r.id}">Delete</button>
        </div>
      `;
      div.querySelector('.btn-edit').addEventListener('click', () => editReading(r.id));
      div.querySelector('.btn-danger').addEventListener('click', () => deleteReading(r.id));
      list.appendChild(div);
    });
  }

  // ========== GOALS ==========
  function setupGoals() {
    document.getElementById('editGoalsBtn').addEventListener('click', () => {
      document.getElementById('goalDailyHours').value = goals.dailyHours;
      document.getElementById('goalWeeklyHours').value = goals.weeklyHours;
      document.getElementById('goalsEditCard').style.display = 'block';
    });
    document.getElementById('cancelGoalsBtn').addEventListener('click', () => {
      document.getElementById('goalsEditCard').style.display = 'none';
    });
    document.getElementById('saveGoalsBtn').addEventListener('click', () => {
      const d = parseFloat(document.getElementById('goalDailyHours').value);
      const w = parseFloat(document.getElementById('goalWeeklyHours').value);
      goals.dailyHours = isNaN(d) || d < 0 ? 0 : d;
      goals.weeklyHours = isNaN(w) || w < 0 ? 0 : w;
      save(KEYS.goals, goals);
      document.getElementById('goalsEditCard').style.display = 'none';
      updateGoalsAndStreaks();
    });
  }

  function getStudyMinutesForDate(dateStr) {
    return entries
      .filter((e) => e.date === dateStr && e.category !== 'Job Work')
      .reduce((s, e) => s + e.duration, 0);
  }

  function getStudyMinutesInRange(startDate, endDate) {
    return entries
      .filter((e) => {
        if (e.category === 'Job Work') return false;
        const d = new Date(e.date + 'T12:00:00');
        return d >= startDate && d <= endDate;
      })
      .reduce((s, e) => s + e.duration, 0);
  }

  function updateGoalsAndStreaks() {
    const today = todayStr();
    const dailyTargetMin = Math.round((goals.dailyHours || 0) * 60);
    const weeklyTargetMin = Math.round((goals.weeklyHours || 0) * 60);
    const dailyStudy = getStudyMinutesForDate(today);
    const { monday, sunday } = getWeekRange();
    const weeklyStudy = getStudyMinutesInRange(monday, sunday);

    // Daily ring
    const dailyPct = dailyTargetMin > 0 ? Math.min(100, Math.round((dailyStudy / dailyTargetMin) * 100)) : 0;
    const ring = document.getElementById('dailyGoalRingFill');
    if (ring) ring.setAttribute('stroke-dasharray', `${dailyPct}, 100`);
    document.getElementById('dailyGoalPct').textContent = dailyPct + '%';
    document.getElementById('dailyGoalCurrent').textContent = formatDuration(dailyStudy);
    document.getElementById('dailyGoalTarget').textContent = formatDuration(dailyTargetMin);
    const statusEl = document.getElementById('dailyGoalStatus');
    if (dailyTargetMin <= 0) {
      statusEl.textContent = 'Set a daily goal to track progress';
      statusEl.classList.remove('met');
    } else if (dailyStudy >= dailyTargetMin) {
      statusEl.textContent = 'Daily goal met! 🎉';
      statusEl.classList.add('met');
    } else {
      statusEl.textContent = `${formatDuration(dailyTargetMin - dailyStudy)} remaining today`;
      statusEl.classList.remove('met');
    }

    // Weekly bar
    const weeklyPct = weeklyTargetMin > 0 ? Math.min(100, Math.round((weeklyStudy / weeklyTargetMin) * 100)) : 0;
    document.getElementById('weeklyGoalFill').style.width = weeklyPct + '%';
    document.getElementById('weeklyGoalText').textContent =
      `${formatDuration(weeklyStudy)} / ${formatDuration(weeklyTargetMin)}`;
    document.getElementById('weeklyGoalPctLabel').textContent = weeklyPct + '%';

    // Streaks
    const { current, longest } = computeStreaks();
    document.getElementById('currentStreak').textContent = current;
    document.getElementById('longestStreak').textContent = longest;
    const hint = document.getElementById('streakHint');
    const hasToday = entries.some((e) => e.date === today);
    if (current === 0) {
      hint.textContent = 'Log a session today to start a streak';
    } else if (hasToday) {
      hint.textContent = current === 1 ? 'Great start — keep it going tomorrow!' : `You're on a ${current}-day roll!`;
    } else {
      hint.textContent = 'Log a session today to keep your streak alive';
    }
  }

  function computeStreaks() {
    // Days with at least one entry (any category)
    const daysWithActivity = new Set(entries.map((e) => e.date));
    if (daysWithActivity.size === 0) return { current: 0, longest: 0 };

    const sortedDays = Array.from(daysWithActivity).sort();
    // Longest streak
    let longest = 1;
    let run = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1] + 'T12:00:00');
      const curr = new Date(sortedDays[i] + 'T12:00:00');
      const diffDays = Math.round((curr - prev) / 86400000);
      if (diffDays === 1) {
        run++;
        longest = Math.max(longest, run);
      } else {
        run = 1;
      }
    }

    // Current streak: count backwards from today or yesterday
    const today = todayStr();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    let current = 0;
    let cursor;
    if (daysWithActivity.has(today)) {
      cursor = today;
    } else if (daysWithActivity.has(yesterday)) {
      cursor = yesterday;
    } else {
      return { current: 0, longest };
    }

    while (daysWithActivity.has(cursor)) {
      current++;
      const d = new Date(cursor + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    }

    longest = Math.max(longest, current);
    return { current, longest };
  }

  // ========== POMODORO ==========
  function setupPomodoro() {
    document.getElementById('pomoWorkMin').value = pomo.workMin;
    document.getElementById('pomoShortMin').value = pomo.shortMin;
    document.getElementById('pomoLongMin').value = pomo.longMin;
    document.getElementById('pomoAutoLog').checked = pomo.autoLog;

    setPomoMode('work', true);

    document.querySelectorAll('.pomo-mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (pomo.running) return;
        setPomoMode(btn.dataset.mode, true);
      });
    });

    document.getElementById('pomoStartBtn').addEventListener('click', startPomo);
    document.getElementById('pomoPauseBtn').addEventListener('click', pausePomo);
    document.getElementById('pomoResetBtn').addEventListener('click', () => resetPomo(true));

    ['pomoWorkMin', 'pomoShortMin', 'pomoLongMin'].forEach((id) => {
      document.getElementById(id).addEventListener('change', savePomoSettingsFromInputs);
    });
    document.getElementById('pomoAutoLog').addEventListener('change', () => {
      pomo.autoLog = document.getElementById('pomoAutoLog').checked;
      savePomoSettings();
    });
  }

  function savePomoSettingsFromInputs() {
    if (pomo.running) return;
    pomo.workMin = clampInt(document.getElementById('pomoWorkMin').value, 1, 120, 25);
    pomo.shortMin = clampInt(document.getElementById('pomoShortMin').value, 1, 60, 5);
    pomo.longMin = clampInt(document.getElementById('pomoLongMin').value, 1, 60, 15);
    document.getElementById('pomoWorkMin').value = pomo.workMin;
    document.getElementById('pomoShortMin').value = pomo.shortMin;
    document.getElementById('pomoLongMin').value = pomo.longMin;
    savePomoSettings();
    setPomoMode(pomo.mode, true);
  }

  function savePomoSettings() {
    save(KEYS.pomoSettings, {
      workMin: pomo.workMin,
      shortMin: pomo.shortMin,
      longMin: pomo.longMin,
      autoLog: pomo.autoLog,
    });
  }

  function clampInt(val, min, max, fallback) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function setPomoMode(mode, resetTime) {
    pomo.mode = mode;
    document.querySelectorAll('.pomo-mode').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (resetTime) {
      const mins =
        mode === 'work' ? pomo.workMin : mode === 'short' ? pomo.shortMin : pomo.longMin;
      pomo.totalSec = mins * 60;
      pomo.remainingSec = pomo.totalSec;
      updatePomoDisplay();
      document.getElementById('pomoStatus').textContent =
        mode === 'work' ? 'Ready to focus' : mode === 'short' ? 'Short break ready' : 'Long break ready';
    }
  }

  function formatPomoTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updatePomoDisplay() {
    document.getElementById('pomoDisplay').textContent = formatPomoTime(pomo.remainingSec);
    if (typeof updateMiniPomo === 'function') updateMiniPomo();
  }

  function startPomo() {
    if (pomo.running) return;
    if (pomo.remainingSec <= 0) setPomoMode(pomo.mode, true);
    pomo.running = true;
    document.getElementById('pomoStartBtn').disabled = true;
    document.getElementById('pomoPauseBtn').disabled = false;
    document.getElementById('pomoStatus').textContent =
      pomo.mode === 'work' ? 'Focusing…' : 'On break…';
    document.title = formatPomoTime(pomo.remainingSec) + ' · FocusTrack';
    updateMiniPomo();

    pomo.intervalId = setInterval(() => {
      pomo.remainingSec--;
      updatePomoDisplay();
      document.title = formatPomoTime(Math.max(0, pomo.remainingSec)) + ' · FocusTrack';
      if (pomo.remainingSec <= 0) {
        clearInterval(pomo.intervalId);
        pomo.intervalId = null;
        pomo.running = false;
        document.getElementById('pomoStartBtn').disabled = false;
        document.getElementById('pomoPauseBtn').disabled = true;
        updateMiniPomo();
        onPomoComplete();
      }
    }, 1000);
  }

  function pausePomo() {
    if (!pomo.running) return;
    clearInterval(pomo.intervalId);
    pomo.intervalId = null;
    pomo.running = false;
    document.getElementById('pomoStartBtn').disabled = false;
    document.getElementById('pomoPauseBtn').disabled = true;
    document.getElementById('pomoStatus').textContent = 'Paused';
    document.title = 'Study & Productivity Tracker';
    updateMiniPomo();
  }

  function resetPomo(updateStatus) {
    pausePomo();
    setPomoMode(pomo.mode, true);
    if (updateStatus) {
      document.getElementById('pomoStatus').textContent =
        pomo.mode === 'work' ? 'Ready to focus' : 'Break ready';
    }
    document.title = 'Study & Productivity Tracker';
  }

  function onPomoComplete() {
    document.title = 'Study & Productivity Tracker';
    playPomoChime();

    if (pomo.mode === 'work') {
      document.getElementById('pomoStatus').textContent = 'Focus session complete!';
      const durationMin = pomo.workMin;
      if (pomo.autoLog) {
        logPomoSession(durationMin);
      } else if (confirm(`Focus session done (${durationMin} min). Log it as a time entry?`)) {
        logPomoSession(durationMin);
      }
      // Suggest short break
      setTimeout(() => {
        if (!pomo.running) {
          setPomoMode('short', true);
          document.getElementById('pomoStatus').textContent = 'Nice work — take a short break?';
        }
      }, 400);
    } else {
      document.getElementById('pomoStatus').textContent = 'Break over — back to focus?';
      setPomoMode('work', true);
    }
  }

  function logPomoSession(durationMin) {
    const category = document.getElementById('pomoCategory').value || 'Study';
    const topic = (document.getElementById('pomoTopic').value || '').trim() || 'Pomodoro focus';
    const duration = durationMin * 60; // store as minutes in existing schema? wait - entries use minutes
    // Existing entries store duration in minutes already (parseDuration returns minutes)
    const durationMins = durationMin;

    entries.push({
      id: uid(),
      category,
      topic,
      date: todayStr(),
      duration: durationMins,
      notes: `Pomodoro (${durationMin} min)`,
      createdAt: new Date().toISOString(),
      source: 'pomodoro',
    });
    save(KEYS.entries, entries);
    renderAll();
    updatePomoTodayCount();
  }

  function updatePomoTodayCount() {
    const today = todayStr();
    const count = entries.filter(
      (e) => e.date === today && (e.source === 'pomodoro' || (e.notes || '').includes('Pomodoro'))
    ).length;
    const el = document.getElementById('pomoTodayCount');
    if (el) el.textContent = count;
  }

  function playPomoChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.stop(ctx.currentTime + 0.6);
    } catch (_) {
      // Audio may be blocked; ignore
    }
  }

  // ========== MINI POMODORO ==========
  function updateMiniPomo() {
    const el = document.getElementById('miniPomo');
    if (!el) return;
    if (pomo.running || (pomo.remainingSec > 0 && pomo.remainingSec < pomo.totalSec)) {
      el.style.display = 'flex';
      document.getElementById('miniPomoTime').textContent = formatPomoTime(pomo.remainingSec);
      document.getElementById('miniPomoLabel').textContent =
        pomo.mode === 'work' ? 'Focus' : pomo.mode === 'short' ? 'Break' : 'Long break';
      document.getElementById('miniPomoToggle').textContent = pomo.running ? '⏸' : '▶';
    } else {
      el.style.display = 'none';
    }
  }

  // Hook mini updates into existing pomo display
  const _origUpdatePomoDisplay = typeof updatePomoDisplay === 'function' ? updatePomoDisplay : null;

  // ========== HABITS ==========
  function setupHabits() {
    const form = document.getElementById('habitForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('habitInput');
      const name = input.value.trim();
      if (!name) return;
      habits.push({ id: uid(), name });
      save(KEYS.habits, habits);
      input.value = '';
      renderHabits();
    });
  }

  function getWeekDatesFromMonday() {
    const { monday } = getWeekRange();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  function renderHabits() {
    const list = document.getElementById('habitsList');
    const empty = document.getElementById('habitsEmpty');
    const header = document.getElementById('habitWeekHeader');
    const summary = document.getElementById('habitSummary');
    if (!list) return;

    const weekDates = getWeekDatesFromMonday();
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (header) {
      header.innerHTML =
        '<span></span>' +
        dayLabels.map((d) => `<span>${d}</span>`).join('') +
        '<span>%</span>';
    }

    list.innerHTML = '';
    if (habits.length === 0) {
      if (empty) empty.classList.remove('hide');
      if (summary) summary.textContent = '';
      return;
    }
    if (empty) empty.classList.add('hide');

    let totalCells = 0;
    let doneCells = 0;

    habits.forEach((h) => {
      const row = document.createElement('div');
      row.className = 'habit-row';
      let doneCount = 0;
      const cells = weekDates
        .map((date) => {
          const done = !!(habitLogs[date] && habitLogs[date][h.id]);
          if (done) doneCount++;
          totalCells++;
          if (done) doneCells++;
          return `<button type="button" class="habit-day ${done ? 'done' : ''}" data-habit="${h.id}" data-date="${date}" title="${date}">${done ? '✓' : ''}</button>`;
        })
        .join('');
      const pct = Math.round((doneCount / 7) * 100);
      row.innerHTML = `
        <span class="habit-name" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</span>
        ${cells}
        <span class="habit-pct">${pct}%</span>
        <button type="button" class="btn-danger habit-del" data-id="${h.id}">×</button>
      `;
      row.querySelectorAll('.habit-day').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hid = btn.dataset.habit;
          const date = btn.dataset.date;
          if (!habitLogs[date]) habitLogs[date] = {};
          if (habitLogs[date][hid]) delete habitLogs[date][hid];
          else habitLogs[date][hid] = true;
          save(KEYS.habitLogs, habitLogs);
          renderHabits();
        });
      });
      row.querySelector('.habit-del').addEventListener('click', () => {
        if (!confirm('Delete this habit?')) return;
        habits = habits.filter((x) => x.id !== h.id);
        save(KEYS.habits, habits);
        renderHabits();
      });
      list.appendChild(row);
    });

    if (summary) {
      const weekPct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
      summary.textContent = `This week: ${doneCells}/${totalCells} check-ins (${weekPct}% completion)`;
    }
  }

  // ========== BACKUP / RESTORE ==========
  function setupBackupRestore() {
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const clearBtn = document.getElementById('clearAllDataBtn');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          entries,
          categories,
          todos,
          todoHistory,
          journals,
          readings,
          goals,
          habits,
          habitLogs,
          pomoSettings: {
            workMin: pomo.workMin,
            shortMin: pomo.shortMin,
            longMin: pomo.longMin,
            autoLog: pomo.autoLog,
          },
        };
        downloadBlob(
          `focustrack-backup_${todayStr()}.json`,
          JSON.stringify(payload, null, 2),
          'application/json'
        );
      });
    }
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('restoreFile');
        const file = fileInput?.files?.[0];
        if (!file) {
          alert('Choose a backup JSON file first.');
          return;
        }
        if (!confirm('Restore will replace ALL current data. Continue?')) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            entries = data.entries || [];
            categories = data.categories || ['Job Work'];
            todos = data.todos || [];
            todoHistory = data.todoHistory || [];
            journals = data.journals || [];
            readings = data.readings || [];
            goals = data.goals || { dailyHours: 2, weeklyHours: 10 };
            habits = data.habits || [];
            habitLogs = data.habitLogs || {};
            if (data.pomoSettings) {
              pomo.workMin = data.pomoSettings.workMin || 25;
              pomo.shortMin = data.pomoSettings.shortMin || 5;
              pomo.longMin = data.pomoSettings.longMin || 15;
              pomo.autoLog = data.pomoSettings.autoLog !== false;
            }
            save(KEYS.entries, entries);
            save(KEYS.categories, categories);
            save(KEYS.todos, todos);
            save(KEYS.todoHistory, todoHistory);
            save(KEYS.journals, journals);
            save(KEYS.readings, readings);
            save(KEYS.goals, goals);
            save(KEYS.habits, habits);
            save(KEYS.habitLogs, habitLogs);
            savePomoSettings();
            populateCategories();
            renderAll();
            alert('Backup restored successfully.');
          } catch (err) {
            alert('Could not read backup file. Make sure it is a valid FocusTrack JSON export.');
          }
        };
        reader.readAsText(file);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('Delete ALL local FocusTrack data? This cannot be undone.')) return;
        if (!confirm('Are you absolutely sure?')) return;
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
        location.reload();
      });
    }
  }

  // ========== WEEKLY REVIEW ==========
  function setupWeeklyReview() {
    const openBtn = document.getElementById('openWeeklyReviewBtn');
    const modal = document.getElementById('weeklyReviewModal');
    const cancel = document.getElementById('cancelWeeklyReviewBtn');
    const saveBtn = document.getElementById('saveWeeklyReviewBtn');
    if (openBtn && modal) {
      openBtn.addEventListener('click', () => modal.classList.add('show'));
    }
    if (cancel) cancel.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const wins = document.getElementById('reviewWins').value.trim();
        const blockers = document.getElementById('reviewBlockers').value.trim();
        const focus = document.getElementById('reviewFocus').value.trim();
        if (!wins && !blockers && !focus) {
          alert('Write at least one section.');
          return;
        }
        const text = [
          '## Weekly Review',
          wins ? `Wins:\n${wins}` : '',
          blockers ? `Blockers:\n${blockers}` : '',
          focus ? `Next week focus:\n${focus}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        journals.push({
          id: uid(),
          date: todayStr(),
          text,
          review: false,
          reviewDone: {},
          createdAt: new Date().toISOString(),
          type: 'weekly-review',
        });
        save(KEYS.journals, journals);
        document.getElementById('reviewWins').value = '';
        document.getElementById('reviewBlockers').value = '';
        document.getElementById('reviewFocus').value = '';
        modal.classList.remove('show');
        renderJournals();
        alert('Weekly review saved to your journal.');
      });
    }
  }

  function maybePromptWeeklyReview() {
    const day = new Date().getDay(); // 0 Sun
    if (day !== 0) return;
    const key = todayStr();
    const prompted = load(KEYS.weeklyReviewPrompted, {});
    if (prompted[key]) return;
    setTimeout(() => {
      if (confirm('It\'s Sunday — want to do a quick weekly review?')) {
        document.querySelector('.nav-item[data-section="journal"]')?.click();
        document.getElementById('weeklyReviewModal')?.classList.add('show');
      }
      prompted[key] = true;
      save(KEYS.weeklyReviewPrompted, prompted);
    }, 800);
  }

  // ========== PRINT WEEKLY ==========
  function setupPrintWeekly() {
    const btn = document.getElementById('printWeeklyBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const data = getWeeklyProgressData();
      const el = document.getElementById('printReport');
      const subjects = Object.entries(data.bySubject)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<li>${escapeHtml(k)}: ${formatDuration(v)}</li>`)
        .join('');
      const days = data.dayNames
        .map((n, i) => `<li>${n} (${data.dayDates[i]}): ${formatDuration(data.dayMins[i])}</li>`)
        .join('');
      el.innerHTML = `
        <h1>FocusTrack — Weekly Report</h1>
        <p><strong>Period:</strong> ${data.mondayStr} → ${data.sundayStr}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <h2>Summary</h2>
        <p>Total: ${formatDuration(data.totalMins)} · Study: ${formatDuration(data.studyMins)} · Job: ${formatDuration(data.jobMins)} · Sessions: ${data.sessionCount}</p>
        <h2>Hours per day</h2>
        <ul>${days}</ul>
        <h2>By subject</h2>
        <ul>${subjects || '<li>(none)</li>'}</ul>
        <h2>Sessions</h2>
        <ul>${
          data.weekEntries
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(
              (e) =>
                `<li>${e.date} · ${formatDuration(e.duration)} · ${escapeHtml(e.category)} — ${escapeHtml(e.topic)}</li>`
            )
            .join('') || '<li>(none)</li>'
        }</ul>
      `;
      window.print();
    });
  }

  // Mini pomo button wiring (after DOM)
  function setupMiniPomoButtons() {
    const toggle = document.getElementById('miniPomoToggle');
    const open = document.getElementById('miniPomoOpen');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (pomo.running) pausePomo();
        else startPomo();
        updateMiniPomo();
      });
    }
    if (open) {
      open.addEventListener('click', () => {
        document.querySelector('.nav-item[data-section="pomodoro"]')?.click();
      });
    }
  }

  // ========== START ==========
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupMiniPomoButtons();
  });
})();
