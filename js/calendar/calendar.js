// Full Google Calendar Clone with Month, Week, Day Views, Resizing, Popover & Shortcuts

import { CalendarDragDrop } from './dragdrop.js';
import { exportToICS, importFromICS } from './ical.js';

export class GoogleCalendar {
  constructor(containerElement, store, waifuDialogue) {
    this.container = containerElement;
    this.store = store;
    this.waifu = waifuDialogue;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.selectedEventId = null;
    this.currentView = this.store.get('calendar.view') || 'month';
    this.searchQuery = '';
    this.dragDrop = new CalendarDragDrop(store, this);

    this.init();
  }

  init() {
    this.renderShell();
    this.bindEvents();
    this.renderMainCalendar();
    this.renderMiniCalendar();
    this.renderTaskList();

    // Re-render when calendar events change
    this.store.subscribe('calendar.events', () => {
      this.renderMainCalendar();
      this.renderTaskList();
      this.renderMiniCalendar();
    });

    this.store.subscribe('calendar.view', (newView) => {
      this.currentView = newView;
      this.renderMainCalendar();
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  renderShell() {
    this.container.innerHTML = `
      <div class="gcal-wrapper">
        <!-- TOP TOOLBAR -->
        <header class="gcal-toolbar">
          <div class="gcal-toolbar-left">
            <button class="gcal-btn gcal-btn-primary" id="gcal-create-btn" title="Shortcut: Press 'c'">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Create</span>
            </button>
            <button class="gcal-btn gcal-btn-outline" id="gcal-today-btn" title="Shortcut: Press 't'">Today</button>
            <div class="gcal-nav-arrows">
              <button class="gcal-icon-btn" id="gcal-prev-btn" title="Previous">◀</button>
              <button class="gcal-icon-btn" id="gcal-next-btn" title="Next">▶</button>
            </div>
            <h2 class="gcal-title" id="gcal-title-display"></h2>
          </div>

          <!-- SEARCH BAR -->
          <div class="gcal-search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="gcal-search-input" class="gcal-search-input" placeholder="Search events & tasks..." />
          </div>

          <div class="gcal-toolbar-right">
            <button class="gcal-btn gcal-btn-waifu" id="gcal-briefing-btn" title="Ask Waifu to review today's agenda">
              <span class="btn-icon">🌸</span>
              <span class="btn-text">Waifu Briefing</span>
            </button>
            <div class="gcal-view-selector">
              <button class="view-btn ${this.currentView === 'month' ? 'active' : ''}" data-view="month" title="Shortcut: 'm'">Month</button>
              <button class="view-btn ${this.currentView === 'week' ? 'active' : ''}" data-view="week" title="Shortcut: 'w'">Week</button>
              <button class="view-btn ${this.currentView === 'day' ? 'active' : ''}" data-view="day" title="Shortcut: 'd'">Day</button>
            </div>
            <div class="gcal-more-actions">
              <button class="gcal-icon-btn" id="gcal-export-btn" title="Export .ics Calendar">📅 ⬇️</button>
              <label class="gcal-icon-btn" title="Import .ics Calendar" style="cursor: pointer;">
                📅 ⬆️
                <input type="file" id="gcal-import-input" accept=".ics" style="display:none;" />
              </label>
            </div>
          </div>
        </header>

        <!-- CALENDAR MAIN BODY: SIDEBAR + GRID -->
        <div class="gcal-body">
          <!-- LEFT SIDEBAR -->
          <aside class="gcal-sidebar">
            <div class="mini-cal-card" id="mini-cal-container"></div>

            <!-- EVENT CATEGORIES FILTER -->
            <div class="gcal-category-box">
              <h4 class="sidebar-heading">My Calendars</h4>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-events" checked />
                <span class="filter-dot" style="background: #ff6584;"></span>
                Events
              </label>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-tasks" checked />
                <span class="filter-dot" style="background: #00cec9;"></span>
                Tasks
              </label>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-birthdays" checked />
                <span class="filter-dot" style="background: #e84393;"></span>
                Birthdays 🎂
              </label>
            </div>

            <!-- TASKS TO-DO SECTION -->
            <div class="gcal-tasks-box">
              <div class="tasks-box-header">
                <h4 class="sidebar-heading">Tasks (Drag onto calendar)</h4>
                <span class="tasks-badge" id="tasks-count-badge">0</span>
              </div>
              <form id="quick-task-form" class="quick-task-form">
                <input type="text" id="quick-task-input" placeholder="+ Add a task & press Enter" required />
              </form>
              <div class="tasks-list-container" id="tasks-list"></div>
            </div>
          </aside>

          <!-- MAIN CALENDAR VIEW STAGE -->
          <main class="gcal-stage" id="gcal-stage"></main>
        </div>
      </div>

      <!-- GOOGLE CALENDAR STYLE EVENT DETAILS POPOVER -->
      <div class="gcal-popover" id="event-popover" style="display:none;">
        <div class="popover-header">
          <div class="popover-color-stripe" id="popover-color-stripe"></div>
          <div class="popover-actions">
            <button class="popover-btn" id="popover-toggle-task" title="Toggle Completed">✅</button>
            <button class="popover-btn" id="popover-edit-btn" title="Edit Event">✏️</button>
            <button class="popover-btn popover-btn-del" id="popover-del-btn" title="Delete Event (or press Del)">🗑️</button>
            <button class="popover-btn" id="popover-close-btn" title="Close">✕</button>
          </div>
        </div>
        <div class="popover-body">
          <h3 class="popover-title" id="popover-title">Event Title</h3>
          <div class="popover-time" id="popover-time">Date & Time</div>
          <div class="popover-badge" id="popover-type-badge">Event</div>
          <div class="popover-loc" id="popover-loc" style="display:none;"></div>
          <div class="popover-desc" id="popover-desc" style="display:none;"></div>
        </div>
      </div>

      <!-- EVENT CREATE/EDIT MODAL -->
      <div class="gcal-modal-overlay" id="event-modal-overlay">
        <div class="gcal-modal" id="event-modal">
          <div class="modal-header">
            <h3 id="modal-heading">Add Event</h3>
            <button class="modal-close-btn" id="modal-close-btn">✕</button>
          </div>
          <form id="event-form" class="modal-form">
            <input type="hidden" id="event-id" />
            
            <div class="form-group">
              <input type="text" id="event-title" placeholder="Add title" class="modal-title-input" required />
            </div>

            <div class="form-group-row">
              <label class="form-label">Type</label>
              <select id="event-type" class="modal-select">
                <option value="event">Event</option>
                <option value="task">Task</option>
                <option value="birthday">Birthday 🎂</option>
              </select>
            </div>

            <div class="form-group-row">
              <label class="form-label">All day</label>
              <input type="checkbox" id="event-allday" />
            </div>

            <div class="form-group-row" id="time-inputs-container">
              <div class="time-col">
                <label class="form-sublabel">Start</label>
                <input type="date" id="event-start-date" class="modal-input" required />
                <input type="time" id="event-start-time" class="modal-input" value="09:00" />
              </div>
              <div class="time-col">
                <label class="form-sublabel">End</label>
                <input type="date" id="event-end-date" class="modal-input" required />
                <input type="time" id="event-end-time" class="modal-input" value="10:00" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Color Badge</label>
              <div class="color-palette-options" id="event-color-picker">
                <button type="button" class="color-dot active" data-color="#ff6584" style="background:#ff6584;"></button>
                <button type="button" class="color-dot" data-color="#6c5ce7" style="background:#6c5ce7;"></button>
                <button type="button" class="color-dot" data-color="#00cec9" style="background:#00cec9;"></button>
                <button type="button" class="color-dot" data-color="#fdcb6e" style="background:#fdcb6e;"></button>
                <button type="button" class="color-dot" data-color="#e84393" style="background:#e84393;"></button>
                <button type="button" class="color-dot" data-color="#0984e3" style="background:#0984e3;"></button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Location / Link</label>
              <input type="text" id="event-location" placeholder="e.g. Discord, Classroom, Zoom" class="modal-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Description / Notes</label>
              <textarea id="event-description" placeholder="Add description..." class="modal-textarea" rows="3"></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" class="gcal-btn gcal-btn-danger" id="modal-delete-btn" style="display:none;">
                🗑️ Delete Event
              </button>
              <div style="flex:1;"></div>
              <button type="button" class="gcal-btn gcal-btn-outline" id="modal-cancel-btn">Cancel</button>
              <button type="submit" class="gcal-btn gcal-btn-primary" id="modal-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Navigation
    this.container.querySelector('#gcal-prev-btn').addEventListener('click', () => this.navigateDate(-1));
    this.container.querySelector('#gcal-next-btn').addEventListener('click', () => this.navigateDate(1));
    this.container.querySelector('#gcal-today-btn').addEventListener('click', () => {
      this.currentDate = new Date();
      this.selectedDate = new Date();
      this.renderMainCalendar();
      this.renderMiniCalendar();
    });

    // Search bar
    const searchInput = this.container.querySelector('#gcal-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderMainCalendar();
    });

    // View selector buttons
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        this.store.set('calendar.view', view);
      });
    });

    // Category filters
    ['filter-events', 'filter-tasks', 'filter-birthdays'].forEach(id => {
      this.container.querySelector(`#${id}`).addEventListener('change', () => this.renderMainCalendar());
    });

    // Create Button
    this.container.querySelector('#gcal-create-btn').addEventListener('click', () => {
      this.openEventModal(null, this.currentDate);
    });

    // Waifu Briefing
    this.container.querySelector('#gcal-briefing-btn').addEventListener('click', () => {
      this.triggerWaifuBriefing();
    });

    // Quick Task Form
    const taskForm = this.container.querySelector('#quick-task-form');
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.container.querySelector('#quick-task-input');
      const val = input.value.trim();
      if (!val) return;

      const now = new Date();
      const end = new Date(now.getTime() + 1800000);
      this.store.addEvent({
        title: val,
        start: now.toISOString(),
        end: end.toISOString(),
        allDay: false,
        type: 'task',
        completed: false,
        color: '#00cec9',
        description: 'Created via quick tasks'
      });

      input.value = '';
    });

    // Export / Import
    this.container.querySelector('#gcal-export-btn').addEventListener('click', () => {
      exportToICS(this.store.get('calendar.events'));
    });

    const importInput = this.container.querySelector('#gcal-import-input');
    importInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const imported = importFromICS(evt.target.result);
        if (imported.length > 0) {
          imported.forEach(ev => this.store.addEvent(ev));
          window.__showToast?.(`Imported ${imported.length} events successfully!`);
        } else {
          window.__showToast?.('No events found in file.');
        }
      };
      reader.readAsText(file);
      importInput.value = '';
    });

    // Modal bindings
    this.setupModalBindings();
    this.setupPopoverBindings();
  }

  handleKeyboardShortcuts(e) {
    // Ignore keyboard shortcuts if user is typing inside an input field
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedEventId) {
        e.preventDefault();
        this.deleteEventWithToast(this.selectedEventId);
      }
    } else if (e.key === 't' || e.key === 'T') {
      this.currentDate = new Date();
      this.selectedDate = new Date();
      this.renderMainCalendar();
      this.renderMiniCalendar();
    } else if (e.key === 'm' || e.key === 'M') {
      this.store.set('calendar.view', 'month');
    } else if (e.key === 'w' || e.key === 'W') {
      this.store.set('calendar.view', 'week');
    } else if (e.key === 'd' || e.key === 'D') {
      this.store.set('calendar.view', 'day');
    } else if (e.key === 'c' || e.key === 'C') {
      this.openEventModal(null, this.currentDate);
    } else if (e.key === 'Escape') {
      this.closePopover();
      this.container.querySelector('#event-modal-overlay').classList.remove('active');
    }
  }

  setupPopoverBindings() {
    const popover = this.container.querySelector('#event-popover');
    const closeBtn = popover.querySelector('#popover-close-btn');
    const editBtn = popover.querySelector('#popover-edit-btn');
    const delBtn = popover.querySelector('#popover-del-btn');
    const toggleBtn = popover.querySelector('#popover-toggle-task');

    closeBtn.addEventListener('click', () => this.closePopover());

    delBtn.addEventListener('click', () => {
      if (this.selectedEventId) {
        this.deleteEventWithToast(this.selectedEventId);
        this.closePopover();
      }
    });

    editBtn.addEventListener('click', () => {
      const ev = this.store.get('calendar.events').find(e => e.id === this.selectedEventId);
      if (ev) {
        this.closePopover();
        this.openEventModal(ev);
      }
    });

    toggleBtn.addEventListener('click', () => {
      if (this.selectedEventId) {
        this.toggleTaskCompletion(this.selectedEventId);
        const ev = this.store.get('calendar.events').find(e => e.id === this.selectedEventId);
        if (ev) this.openPopover(ev);
      }
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !e.target.closest('.event-pill') && !e.target.closest('.week-event-card')) {
        this.closePopover();
      }
    });
  }

  openPopover(event, anchorElement = null) {
    const popover = this.container.querySelector('#event-popover');
    this.selectedEventId = event.id;

    popover.querySelector('#popover-title').textContent = event.title;
    popover.querySelector('#popover-color-stripe').style.background = event.color || '#ff6584';

    const s = new Date(event.start);
    const e = new Date(event.end || event.start);
    const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = event.allDay 
      ? 'All Day' 
      : `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    popover.querySelector('#popover-time').textContent = `${dateStr} · ${timeStr}`;

    const typeBadge = popover.querySelector('#popover-type-badge');
    typeBadge.textContent = event.type.toUpperCase() + (event.completed ? ' (COMPLETED)' : '');
    typeBadge.style.background = event.color || '#ff6584';

    const toggleBtn = popover.querySelector('#popover-toggle-task');
    if (event.type === 'task') {
      toggleBtn.style.display = 'inline-flex';
      toggleBtn.textContent = event.completed ? '↩️ Mark Incomplete' : '✅ Mark Completed';
    } else {
      toggleBtn.style.display = 'none';
    }

    const locEl = popover.querySelector('#popover-loc');
    if (event.location) {
      locEl.style.display = 'block';
      locEl.textContent = `📍 ${event.location}`;
    } else {
      locEl.style.display = 'none';
    }

    const descEl = popover.querySelector('#popover-desc');
    if (event.description) {
      descEl.style.display = 'block';
      descEl.textContent = event.description;
    } else {
      descEl.style.display = 'none';
    }

    // Position popover
    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      let top = rect.top + window.scrollY;
      let left = rect.right + 12;

      if (left + 320 > window.innerWidth) {
        left = Math.max(16, rect.left - 330);
      }
      if (top + 260 > window.innerHeight) {
        top = Math.max(70, window.innerHeight - 280);
      }

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    } else {
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
    }

    popover.style.display = 'block';
  }

  closePopover() {
    const popover = this.container.querySelector('#event-popover');
    if (popover) {
      popover.style.display = 'none';
      popover.style.transform = 'none';
    }
  }

  deleteEventWithToast(id) {
    const ev = this.store.get('calendar.events').find(e => e.id === id);
    if (ev) {
      this.store.deleteEvent(id);
      this.selectedEventId = null;
      this.closePopover();
      window.__showToast?.(`Deleted "${ev.title}"`);
    }
  }

  toggleTaskCompletion(id) {
    const task = this.store.toggleTask(id);
    if (task) {
      const persona = this.store.get('waifu.personality');
      let msg = task.completed ? `Completed "${task.title}"!` : `Marked "${task.title}" incomplete`;
      if (task.completed) {
        if (persona === 'tsundere') msg = `Good job finishing it... not that I care! +15 Bond EXP`;
        else if (persona === 'deredere') msg = `YAY! Task conquered! +15 Bond EXP! 🎉`;
      }
      window.__showToast?.(msg);
    }
  }

  setupModalBindings() {
    const overlay = this.container.querySelector('#event-modal-overlay');
    const closeBtn = this.container.querySelector('#modal-close-btn');
    const cancelBtn = this.container.querySelector('#modal-cancel-btn');
    const form = this.container.querySelector('#event-form');
    const deleteBtn = this.container.querySelector('#modal-delete-btn');
    const alldayBox = this.container.querySelector('#event-allday');
    const startTime = this.container.querySelector('#event-start-time');
    const endTime = this.container.querySelector('#event-end-time');

    const closeModal = () => overlay.classList.remove('active');
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    alldayBox.addEventListener('change', () => {
      const isAllDay = alldayBox.checked;
      startTime.style.display = isAllDay ? 'none' : 'block';
      endTime.style.display = isAllDay ? 'none' : 'block';
    });

    const colorPicker = this.container.querySelector('#event-color-picker');
    colorPicker.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // Delete Button in Modal
    deleteBtn.addEventListener('click', () => {
      const id = this.container.querySelector('#event-id').value;
      if (id) {
        this.deleteEventWithToast(id);
        closeModal();
      }
    });

    // Save/Submit Form
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = this.container.querySelector('#event-id').value;
      const title = this.container.querySelector('#event-title').value.trim();
      const type = this.container.querySelector('#event-type').value;
      const allDay = alldayBox.checked;
      const startDate = this.container.querySelector('#event-start-date').value;
      const endDate = this.container.querySelector('#event-end-date').value;
      const sTime = startTime.value || '09:00';
      const eTime = endTime.value || '10:00';
      const activeColor = colorPicker.querySelector('.color-dot.active')?.dataset?.color || '#ff6584';
      const location = this.container.querySelector('#event-location').value.trim();
      const description = this.container.querySelector('#event-description').value.trim();

      const startIso = allDay 
        ? new Date(startDate + 'T00:00:00').toISOString() 
        : new Date(`${startDate}T${sTime}:00`).toISOString();
      
      const endIso = allDay
        ? new Date(endDate + 'T23:59:59').toISOString()
        : new Date(`${endDate}T${eTime}:00`).toISOString();

      const payload = {
        title,
        type,
        allDay,
        start: startIso,
        end: endIso,
        color: activeColor,
        location,
        description
      };

      if (id) {
        this.store.updateEvent(id, payload);
        window.__showToast?.(`Updated "${title}"`);
      } else {
        this.store.addEvent(payload);
        window.__showToast?.(`Created "${title}"`);
      }

      closeModal();
    });
  }

  openEventModal(event = null, defaultDate = new Date()) {
    this.closePopover();
    const overlay = this.container.querySelector('#event-modal-overlay');
    const heading = this.container.querySelector('#modal-heading');
    const idInput = this.container.querySelector('#event-id');
    const titleInput = this.container.querySelector('#event-title');
    const typeSelect = this.container.querySelector('#event-type');
    const alldayBox = this.container.querySelector('#event-allday');
    const startDateInput = this.container.querySelector('#event-start-date');
    const startTimeInput = this.container.querySelector('#event-start-time');
    const endDateInput = this.container.querySelector('#event-end-date');
    const endTimeInput = this.container.querySelector('#event-end-time');
    const locationInput = this.container.querySelector('#event-location');
    const descInput = this.container.querySelector('#event-description');
    const deleteBtn = this.container.querySelector('#modal-delete-btn');
    const colorPicker = this.container.querySelector('#event-color-picker');

    if (event) {
      heading.textContent = 'Edit Event';
      idInput.value = event.id;
      titleInput.value = event.title;
      typeSelect.value = event.type || 'event';
      alldayBox.checked = !!event.allDay;

      const s = new Date(event.start);
      const e = new Date(event.end || event.start);
      startDateInput.value = this.formatDateForInput(s);
      startTimeInput.value = this.formatTimeForInput(s);
      endDateInput.value = this.formatDateForInput(e);
      endTimeInput.value = this.formatTimeForInput(e);

      locationInput.value = event.location || '';
      descInput.value = event.description || '';
      deleteBtn.style.display = 'inline-flex';

      colorPicker.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === event.color);
      });
    } else {
      heading.textContent = 'Add Event';
      idInput.value = '';
      titleInput.value = '';
      typeSelect.value = 'event';
      alldayBox.checked = false;

      const s = new Date(defaultDate);
      const e = new Date(s.getTime() + 3600000);
      startDateInput.value = this.formatDateForInput(s);
      startTimeInput.value = this.formatTimeForInput(s);
      endDateInput.value = this.formatDateForInput(e);
      endTimeInput.value = this.formatTimeForInput(e);

      locationInput.value = '';
      descInput.value = '';
      deleteBtn.style.display = 'none';

      colorPicker.querySelectorAll('.color-dot').forEach((d, i) => {
        d.classList.toggle('active', i === 0);
      });
    }

    const isAllDay = alldayBox.checked;
    startTimeInput.style.display = isAllDay ? 'none' : 'block';
    endTimeInput.style.display = isAllDay ? 'none' : 'block';

    overlay.classList.add('active');
    titleInput.focus();
  }

  navigateDate(delta) {
    if (this.currentView === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + delta, 1);
    } else if (this.currentView === 'week') {
      this.currentDate = new Date(this.currentDate.getTime() + delta * 7 * 86400000);
    } else if (this.currentView === 'day') {
      this.currentDate = new Date(this.currentDate.getTime() + delta * 86400000);
    }
    this.renderMainCalendar();
    this.renderMiniCalendar();
  }

  renderMainCalendar() {
    const stage = this.container.querySelector('#gcal-stage');
    const titleDisplay = this.container.querySelector('#gcal-title-display');

    if (this.currentView === 'month') {
      titleDisplay.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      this.renderMonthView(stage);
    } else if (this.currentView === 'week') {
      const weekStart = this.getStartOfWeek(this.currentDate);
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
      titleDisplay.textContent = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      this.renderWeekView(stage);
    } else if (this.currentView === 'day') {
      titleDisplay.textContent = this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      this.renderDayView(stage);
    }
  }

  getFilteredEvents() {
    const showEvents = this.container.querySelector('#filter-events')?.checked ?? true;
    const showTasks = this.container.querySelector('#filter-tasks')?.checked ?? true;
    const showBirthdays = this.container.querySelector('#filter-birthdays')?.checked ?? true;
    const query = this.searchQuery;

    return this.store.get('calendar.events').filter(e => {
      if (e.type === 'event' && !showEvents) return false;
      if (e.type === 'task' && !showTasks) return false;
      if (e.type === 'birthday' && !showBirthdays) return false;
      if (query) {
        const titleMatch = (e.title || '').toLowerCase().includes(query);
        const locMatch = (e.location || '').toLowerCase().includes(query);
        const descMatch = (e.description || '').toLowerCase().includes(query);
        if (!titleMatch && !locMatch && !descMatch) return false;
      }
      return true;
    });
  }

  /* ------------------- MONTH VIEW ------------------- */
  renderMonthView(stage) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayIndex = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    let nextMonthDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      days.push({
        date: new Date(year, month + 1, nextMonthDay++),
        isCurrentMonth: false
      });
    }

    const events = this.getFilteredEvents();
    const today = new Date();

    let html = `
      <div class="month-grid-container">
        <div class="month-header-row">
          <div class="month-col-header">SUN</div>
          <div class="month-col-header">MON</div>
          <div class="month-col-header">TUE</div>
          <div class="month-col-header">WED</div>
          <div class="month-col-header">THU</div>
          <div class="month-col-header">FRI</div>
          <div class="month-col-header">SAT</div>
        </div>
        <div class="month-days-grid">
    `;

    days.forEach(dayObj => {
      const d = dayObj.date;
      const isToday = this.isSameDay(d, today);
      const isSelected = this.isSameDay(d, this.selectedDate);
      const dateStr = d.toISOString();
      const dayEvents = events.filter(e => this.isSameDay(new Date(e.start), d));

      html += `
        <div class="month-day-cell ${dayObj.isCurrentMonth ? '' : 'outside-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
          <div class="day-cell-top">
            <span class="day-num ${isToday ? 'today-badge' : ''}">${d.getDate()}</span>
          </div>
          <div class="day-events-wrapper">
            ${dayEvents.slice(0, 4).map(ev => this.renderEventPill(ev)).join('')}
            ${dayEvents.length > 4 ? `<div class="more-events-tag">+${dayEvents.length - 4} more</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    stage.innerHTML = html;

    // Drop zones on cells
    stage.querySelectorAll('.month-day-cell').forEach(cell => {
      this.dragDrop.initDropZone(cell, () => cell.dataset.date);

      cell.addEventListener('click', (e) => {
        if (e.target.closest('.event-pill') || e.target.closest('.pill-task-check')) return;
        this.selectedDate = new Date(cell.dataset.date);
        this.openEventModal(null, this.selectedDate);
      });
    });

    // Pills interaction (drag, click to view popover, task checkbox)
    stage.querySelectorAll('.event-pill').forEach(pill => {
      const eventId = pill.dataset.eventId;
      const event = events.find(e => e.id === eventId);
      if (event) {
        this.dragDrop.initDraggable(pill, event, 'calendar-event');

        // Checkbox click
        const check = pill.querySelector('.pill-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(eventId);
          });
        }

        // Pill click opens popover
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          pill.classList.add('is-selected');
          this.openPopover(event, pill);
        });
      }
    });
  }

  renderEventPill(ev) {
    const isBirthday = ev.type === 'birthday';
    const isTask = ev.type === 'task';
    const startTime = ev.allDay ? '' : new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSelected = this.selectedEventId === ev.id;

    return `
      <div class="event-pill ${isTask && ev.completed ? 'completed' : ''} ${isSelected ? 'is-selected' : ''}" 
           data-event-id="${ev.id}" 
           style="background: ${ev.color || '#ff6584'};">
        ${isTask ? `<input type="checkbox" class="pill-task-check" ${ev.completed ? 'checked' : ''} title="Mark task completed" />` : ''}
        ${isBirthday ? '<span class="pill-icon">🎂</span>' : ''}
        <span class="pill-title">${startTime ? `<small>${startTime}</small> ` : ''}${this.escapeHTML(ev.title)}</span>
      </div>
    `;
  }

  /* ------------------- WEEK VIEW WITH DRAG-RESIZE ------------------- */
  renderWeekView(stage) {
    const weekStart = this.getStartOfWeek(this.currentDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(new Date(weekStart.getTime() + i * 86400000));
    }

    const events = this.getFilteredEvents();
    const today = new Date();

    let html = `
      <div class="week-view-container">
        <!-- Week Header -->
        <div class="week-header-row">
          <div class="time-gutter-header">GMT</div>
          ${weekDays.map(d => {
            const isToday = this.isSameDay(d, today);
            return `
              <div class="week-header-day ${isToday ? 'today' : ''}">
                <span class="week-day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="week-day-num ${isToday ? 'today-badge' : ''}">${d.getDate()}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 24-Hour Time Grid -->
        <div class="week-time-grid">
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <div class="week-columns-wrapper">
            ${weekDays.map(day => {
              const dateStr = day.toISOString();
              const dayEvents = events.filter(e => this.isSameDay(new Date(e.start), day));
              const isToday = this.isSameDay(day, today);

              return `
                <div class="week-day-column ${isToday ? 'today-col' : ''}" data-date="${dateStr}">
                  ${Array.from({ length: 24 }).map((_, h) => `
                    <div class="week-hour-cell" data-hour="${h}"></div>
                  `).join('')}

                  ${isToday ? `<div class="current-time-line" style="top: ${this.getCurrentTimePercent()}%;"></div>` : ''}

                  <div class="week-events-layer">
                    ${dayEvents.map(ev => this.renderWeekEventCard(ev)).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    stage.innerHTML = html;

    // Drop zones & click-to-create
    stage.querySelectorAll('.week-hour-cell').forEach(cell => {
      const col = cell.closest('.week-day-column');
      const hour = parseInt(cell.dataset.hour, 10);

      this.dragDrop.initDropZone(cell, () => {
        const colDate = new Date(col.dataset.date);
        colDate.setHours(hour, 0, 0, 0);
        return colDate.toISOString();
      });

      cell.addEventListener('click', () => {
        const colDate = new Date(col.dataset.date);
        colDate.setHours(hour, 0, 0, 0);
        this.openEventModal(null, colDate);
      });
    });

    // Event card interactions (drag, click to view popover, task check, resize handle)
    stage.querySelectorAll('.week-event-card').forEach(card => {
      const id = card.dataset.eventId;
      const ev = events.find(e => e.id === id);
      if (ev) {
        this.dragDrop.initDraggable(card, ev, 'calendar-event');

        // Task checkbox inside card
        const check = card.querySelector('.card-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(id);
          });
        }

        // Card click opens popover
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('event-resize-handle')) return;
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this.openPopover(ev, card);
        });

        // Event Resizing Handle (Make event longer/shorter)
        const resizeHandle = card.querySelector('.event-resize-handle');
        if (resizeHandle) {
          this.initEventResize(resizeHandle, card, ev);
        }
      }
    });

    const grid = stage.querySelector('.week-time-grid');
    if (grid) grid.scrollTop = 480;
  }

  /* ------------------- EVENT RESIZE (MAKE LONGER/SHORTER) ------------------- */
  initEventResize(handle, card, event) {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startY = e.clientY;
      const initialHeight = parseFloat(card.style.height) || card.offsetHeight;
      const s = new Date(event.start);
      let finalHeight = initialHeight;

      document.body.classList.add('is-resizing-event');

      const onMouseMove = (moveEvent) => {
        const deltaY = moveEvent.clientY - startY;
        // Snap to 15px increments (15 minutes)
        const snappedDelta = Math.round(deltaY / 15) * 15;
        finalHeight = Math.max(26, initialHeight + snappedDelta);
        card.style.height = `${finalHeight}px`;

        // Live update time text
        const newDurationHours = (finalHeight + 4) / 60;
        const newEndTime = new Date(s.getTime() + newDurationHours * 3600000);
        const timeLabel = card.querySelector('.card-time');
        if (timeLabel) {
          timeLabel.textContent = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${newEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('is-resizing-event');

        const newDurationHours = Math.max(0.5, (finalHeight + 4) / 60);
        const newEndDate = new Date(s.getTime() + newDurationHours * 3600000);

        this.store.updateEvent(event.id, {
          end: newEndDate.toISOString()
        });

        window.__showToast?.(`Updated duration for "${event.title}"`);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  renderWeekEventCard(ev) {
    const s = new Date(ev.start);
    const e = new Date(ev.end || ev.start);

    let startHour = s.getHours() + s.getMinutes() / 60;
    let endHour = e.getHours() + e.getMinutes() / 60;
    if (endHour <= startHour) endHour = startHour + 1;
    const duration = Math.max(0.5, endHour - startHour);

    const topPx = startHour * 60;
    const heightPx = Math.max(26, duration * 60 - 4);
    const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const isTask = ev.type === 'task';
    const isSelected = this.selectedEventId === ev.id;

    return `
      <div class="week-event-card ${isTask && ev.completed ? 'completed' : ''} ${isSelected ? 'is-selected' : ''}" 
           data-event-id="${ev.id}" 
           style="top: ${topPx}px; height: ${heightPx}px; background: ${ev.color || '#ff6584'};">
        <div class="card-header-row">
          ${isTask ? `<input type="checkbox" class="card-task-check" ${ev.completed ? 'checked' : ''} title="Mark completed" />` : ''}
          <div class="card-title">${this.escapeHTML(ev.title)}</div>
        </div>
        <div class="card-time">${timeStr}</div>
        ${ev.location ? `<div class="card-loc">📍 ${this.escapeHTML(ev.location)}</div>` : ''}
        <!-- Resize handle for dragging duration longer/shorter -->
        <div class="event-resize-handle" title="Hold & drag to make longer/shorter"></div>
      </div>
    `;
  }

  /* ------------------- DAY VIEW ------------------- */
  renderDayView(stage) {
    const today = new Date();
    const day = this.currentDate;
    const isToday = this.isSameDay(day, today);
    const events = this.getFilteredEvents().filter(e => this.isSameDay(new Date(e.start), day));

    let html = `
      <div class="day-view-container">
        <div class="day-time-grid">
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <div class="day-single-column" data-date="${day.toISOString()}">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="day-hour-cell" data-hour="${h}"></div>
            `).join('')}

            ${isToday ? `<div class="current-time-line" style="top: ${this.getCurrentTimePercent()}%;"></div>` : ''}

            <div class="day-events-layer">
              ${events.map(ev => this.renderWeekEventCard(ev)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    stage.innerHTML = html;

    stage.querySelectorAll('.day-hour-cell').forEach(cell => {
      const hour = parseInt(cell.dataset.hour, 10);
      this.dragDrop.initDropZone(cell, () => {
        const d = new Date(day);
        d.setHours(hour, 0, 0, 0);
        return d.toISOString();
      });

      cell.addEventListener('click', () => {
        const d = new Date(day);
        d.setHours(hour, 0, 0, 0);
        this.openEventModal(null, d);
      });
    });

    stage.querySelectorAll('.week-event-card').forEach(card => {
      const id = card.dataset.eventId;
      const ev = events.find(e => e.id === id);
      if (ev) {
        this.dragDrop.initDraggable(card, ev, 'calendar-event');

        const check = card.querySelector('.card-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(id);
          });
        }

        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('event-resize-handle')) return;
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this.openPopover(ev, card);
        });

        const resizeHandle = card.querySelector('.event-resize-handle');
        if (resizeHandle) {
          this.initEventResize(resizeHandle, card, ev);
        }
      }
    });

    const grid = stage.querySelector('.day-time-grid');
    if (grid) grid.scrollTop = 480;
  }

  /* ------------------- MINI CALENDAR ------------------- */
  renderMiniCalendar() {
    const mini = this.container.querySelector('#mini-cal-container');
    if (!mini) return;

    const y = this.selectedDate.getFullYear();
    const m = this.selectedDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startIdx = first.getDay();
    const totalDays = last.getDate();

    let daysHtml = '';
    for (let i = 0; i < startIdx; i++) {
      daysHtml += `<div class="mini-day empty"></div>`;
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(y, m, d);
      const isSelected = this.isSameDay(dateObj, this.selectedDate);
      const isToday = this.isSameDay(dateObj, new Date());
      daysHtml += `
        <div class="mini-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-date="${dateObj.toISOString()}">
          ${d}
        </div>
      `;
    }

    mini.innerHTML = `
      <div class="mini-cal-header">
        <span>${first.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        <div class="mini-nav">
          <button id="mini-prev">‹</button>
          <button id="mini-next">›</button>
        </div>
      </div>
      <div class="mini-cal-grid">
        <div class="mini-day-label">S</div><div class="mini-day-label">M</div><div class="mini-day-label">T</div>
        <div class="mini-day-label">W</div><div class="mini-day-label">T</div><div class="mini-day-label">F</div><div class="mini-day-label">S</div>
        ${daysHtml}
      </div>
    `;

    mini.querySelector('#mini-prev').addEventListener('click', () => {
      this.selectedDate = new Date(y, m - 1, 1);
      this.renderMiniCalendar();
    });
    mini.querySelector('#mini-next').addEventListener('click', () => {
      this.selectedDate = new Date(y, m + 1, 1);
      this.renderMiniCalendar();
    });

    mini.querySelectorAll('.mini-day:not(.empty)').forEach(d => {
      d.addEventListener('click', () => {
        this.selectedDate = new Date(d.dataset.date);
        this.currentDate = new Date(d.dataset.date);
        this.renderMainCalendar();
        this.renderMiniCalendar();
      });
    });
  }

  /* ------------------- TASKS TO-DO LIST ------------------- */
  renderTaskList() {
    const list = this.container.querySelector('#tasks-list');
    const badge = this.container.querySelector('#tasks-count-badge');
    if (!list) return;

    const allTasks = this.store.get('calendar.events').filter(e => e.type === 'task');
    const pending = allTasks.filter(t => !t.completed);
    if (badge) badge.textContent = pending.length;

    if (allTasks.length === 0) {
      list.innerHTML = `<div class="empty-tasks-msg">No tasks yet! Add one above 🌸</div>`;
      return;
    }

    list.innerHTML = allTasks.map(task => `
      <div class="sidebar-task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" draggable="true">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} title="Toggle completed" />
        <span class="task-item-text" title="${this.escapeHTML(task.title)}">${this.escapeHTML(task.title)}</span>
        <button class="task-del-btn" title="Delete task">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.sidebar-task-item').forEach(item => {
      const taskId = item.dataset.taskId;
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      this.dragDrop.initDraggable(item, task, 'task-item');

      item.querySelector('.task-checkbox').addEventListener('change', () => {
        this.toggleTaskCompletion(taskId);
      });

      item.querySelector('.task-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteEventWithToast(taskId);
      });

      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.openEventModal(task);
      });
    });
  }

  triggerWaifuBriefing() {
    window.__switchTab?.('main');
    setTimeout(() => {
      if (this.waifu) {
        this.waifu.processUserMessage('Give me a schedule review for today!');
      }
    }, 250);
  }

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  getStartOfWeek(d) {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = copy.getDate() - day;
    return new Date(copy.setDate(diff));
  }

  getCurrentTimePercent() {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    return (totalMinutes / 1440) * 100;
  }

  formatDateForInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatTimeForInput(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}
