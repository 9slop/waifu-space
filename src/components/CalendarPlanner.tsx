import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import {
  state,
  setState,
  addCalendarEvent,
  toggleTask,
  deleteCalendarEvent,
  showToast,
  triggerWaifuResponse,
  isSameDay,
  getEventsForDate
} from '../lib/store';
import { CalendarEventItem, exportToICS, importFromICS } from '../lib/ical';
import { getPersonality } from '../lib/personality';
import { MiniCalendar } from './MiniCalendar';
import { EventModal } from './EventModal';
import { CalendarPopover } from './CalendarPopover';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { t, getLocale } from '../lib/i18n';

export function CalendarPlanner() {
  const [currentDate, setCurrentDate] = createSignal(new Date());
  const [selectedDate, setSelectedDate] = createSignal(new Date());
  const [quickTaskInput, setQuickTaskInput] = createSignal('');

  // Modals & Popovers & Dropdowns
  const [createMenuOpen, setCreateMenuOpen] = createSignal(false);
  let createMenuRef: HTMLDivElement | undefined;

  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [modalEvent, setModalEvent] = createSignal<CalendarEventItem | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = createSignal<Date>(new Date());
  const [modalInitialType, setModalInitialType] = createSignal<'event' | 'task'>('event');
  const [modalPrefilledRange, setModalPrefilledRange] = createSignal<{ start: Date; end: Date } | undefined>(undefined);

  const [popoverEvent, setPopoverEvent] = createSignal<CalendarEventItem | null>(null);
  const [popoverPos, setPopoverPos] = createSignal<{ top: number; left: number } | null>(null);

  // Filtered events
  const filteredEvents = createMemo(() => {
    const q = state.calendar.searchQuery.toLowerCase().trim();
    return state.calendar.events.filter(e => {
      if (e.type === 'event' && !state.calendar.filterEvents) return false;
      if (e.type === 'task' && !state.calendar.filterTasks) return false;
      if (e.type === 'birthday' && !state.calendar.filterBirthdays) return false;
      if (q) {
        const titleMatch = (e.title || '').toLowerCase().includes(q);
        const locMatch = (e.location || '').toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        if (!titleMatch && !locMatch && !descMatch) return false;
      }
      return true;
    });
  });

  const sidebarTasks = createMemo(() => {
    return state.calendar.events.filter(e => e.type === 'task');
  });

  // Navigation
  const navigateDate = (dir: number) => {
    const d = new Date(currentDate());
    const view = state.calendar.view;
    if (view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else if (view === 'week') {
      d.setDate(d.getDate() + dir * 7);
    } else if (view === 'day') {
      d.setDate(d.getDate() + dir);
    }
    setCurrentDate(d);
    closePopover();
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
    closePopover();
  };

  const getTitleDisplay = () => {
    const d = currentDate();
    const view = state.calendar.view;
    const loc = getLocale();
    if (view === 'month') {
      return d.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start.getTime() + 6 * 86400000);
      return `${start.toLocaleDateString(loc, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return d.toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const openCreateModal = (
    defaultD = new Date(),
    initialType: 'event' | 'task' = 'event',
    prefilledRange?: { start: Date; end: Date }
  ) => {
    closePopover();
    setModalEvent(null);
    setModalDefaultDate(defaultD);
    setModalInitialType(initialType);
    setModalPrefilledRange(prefilledRange);
    setIsModalOpen(true);
  };

  const openEditModal = (ev: CalendarEventItem) => {
    closePopover();
    setModalEvent(ev);
    setIsModalOpen(true);
  };

  const openPopover = (ev: CalendarEventItem, anchorRect?: DOMRect) => {
    setPopoverEvent(ev);
    if (anchorRect) {
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      const innerW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const innerH = typeof window !== 'undefined' ? window.innerHeight : 768;
      let top = anchorRect.top + scrollY;
      let left = anchorRect.right + 12;
      if (left + 320 > innerW) {
        left = Math.max(16, anchorRect.left - 330);
      }
      if (top + 260 > innerH) {
        top = Math.max(70, innerH - 280);
      }
      setPopoverPos({ top, left });
    } else {
      setPopoverPos(null);
    }
  };

  const closePopover = () => {
    setPopoverEvent(null);
    setPopoverPos(null);
  };

  // Waifu Briefing
  const triggerBriefing = () => {
    const today = new Date();
    const todayEvents = getEventsForDate(state.calendar.events, today);
    const evCount = todayEvents.filter(e => e.type === 'event').length;
    const tkCount = todayEvents.filter(e => e.type === 'task' && !e.completed).length;

    const persona = getPersonality(state.waifu.personality);
    const review = persona.scheduleReview(evCount, tkCount);
    showToast(`🌸 ${t('calendar.toasts.waifuBriefing', { text: review.text })}`);
    triggerWaifuResponse(review.text, review.mood);
  };

  // Quick Task Submit
  const handleQuickTask = (e: Event) => {
    e.preventDefault();
    const taskTitle = quickTaskInput().trim();
    if (!taskTitle) return;
    setQuickTaskInput('');
    addCalendarEvent({
      title: taskTitle,
      type: 'task',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 1800000).toISOString(),
      color: '#00cec9',
      allDay: false
    });
    showToast(t('calendar.toasts.taskAdded', { title: taskTitle }));
  };

  // iCal Import
  const handleFileImport = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      if (text) {
        const imported = importFromICS(text);
        if (imported.length > 0) {
          setState('calendar', 'events', evs => [...imported, ...evs]);
          showToast(t('calendar.toasts.importedEvents', { count: imported.length, file: file.name }));
        } else {
          showToast(t('calendar.toasts.noValidEvents'));
        }
      }
    };
    reader.readAsText(file);
    input.value = '';
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 't' || e.key === 'T') {
      jumpToToday();
    } else if (e.key === 'm' || e.key === 'M') {
      setState('calendar', 'view', 'month');
    } else if (e.key === 'w' || e.key === 'W') {
      setState('calendar', 'view', 'week');
    } else if (e.key === 'd' || e.key === 'D') {
      setState('calendar', 'view', 'day');
    } else if (e.key === 'c' || e.key === 'C') {
      openCreateModal(currentDate());
    } else if (e.key === 'Escape') {
      closePopover();
      setCreateMenuOpen(false);
      setIsModalOpen(false);
    }
  };

  const handleDocClick = (e: MouseEvent) => {
    if (createMenuRef && !createMenuRef.contains(e.target as Node)) {
      setCreateMenuOpen(false);
    }
  };

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('click', handleDocClick);
    }

    onCleanup(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('click', handleDocClick);
      }
    });
  });

  return (
    <div class="gcal-wrapper">
      {/* TOP TOOLBAR */}
      <header class="gcal-toolbar">
        <div class="gcal-toolbar-left">
          <div class="create-menu-container" ref={createMenuRef}>
            <button
              type="button"
              class="gcal-btn gcal-btn-primary create-menu-btn"
              onClick={() => setCreateMenuOpen(!createMenuOpen())}
              title={t('calendar.toolbar.createTooltip')}
            >
              <span class="btn-icon">➕</span>
              <span class="btn-text">{t('calendar.toolbar.create')}</span>
              <span class="create-caret">▾</span>
            </button>
            <Show when={createMenuOpen()}>
              <div class="create-dropdown-menu">
                <button
                  type="button"
                  class="create-dropdown-item"
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openCreateModal(currentDate(), 'event');
                  }}
                >
                  <span class="dropdown-item-icon">📅</span>
                  <div class="dropdown-item-text">
                    <span class="dropdown-item-title">{t('calendar.menu.event')}</span>
                    <span class="dropdown-item-desc">{t('calendar.menu.eventDesc')}</span>
                  </div>
                </button>
                <button
                  type="button"
                  class="create-dropdown-item"
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openCreateModal(currentDate(), 'task');
                  }}
                >
                  <span class="dropdown-item-icon">☑️</span>
                  <div class="dropdown-item-text">
                    <span class="dropdown-item-title">{t('calendar.menu.task')}</span>
                    <span class="dropdown-item-desc">{t('calendar.menu.taskDesc')}</span>
                  </div>
                </button>
              </div>
            </Show>
          </div>
          <button
            type="button"
            class="gcal-btn gcal-btn-outline"
            onClick={jumpToToday}
            title={t('calendar.toolbar.todayTooltip')}
          >
            {t('calendar.toolbar.today')}
          </button>
          <div class="gcal-nav-arrows">
            <button
              type="button"
              class="gcal-icon-btn"
              onClick={() => navigateDate(-1)}
              title={t('calendar.toolbar.prev')}
            >
              ◀
            </button>
            <button
              type="button"
              class="gcal-icon-btn"
              onClick={() => navigateDate(1)}
              title={t('calendar.toolbar.next')}
            >
              ▶
            </button>
          </div>
          <h2 class="gcal-title">{getTitleDisplay()}</h2>
        </div>

        {/* SEARCH BAR */}
        <div class="gcal-search-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="gcal-search-input"
            placeholder={t('calendar.toolbar.searchPlaceholder')}
            value={state.calendar.searchQuery}
            onInput={e => setState('calendar', 'searchQuery', e.currentTarget.value)}
          />
        </div>

        <div class="gcal-toolbar-right">
          <button
            type="button"
            class="gcal-btn gcal-btn-waifu"
            onClick={triggerBriefing}
            title={t('calendar.toolbar.waifuBriefingTooltip')}
          >
            <span class="btn-icon">🌸</span>
            <span class="btn-text">{t('calendar.toolbar.waifuBriefing')}</span>
          </button>

          <div class="gcal-view-selector">
            <button
              type="button"
              class={`view-btn ${state.calendar.view === 'month' ? 'active' : ''}`}
              onClick={() => setState('calendar', 'view', 'month')}
              title="Shortcut: 'm'"
            >
              {t('calendar.views.month')}
            </button>
            <button
              type="button"
              class={`view-btn ${state.calendar.view === 'week' ? 'active' : ''}`}
              onClick={() => setState('calendar', 'view', 'week')}
              title="Shortcut: 'w'"
            >
              {t('calendar.views.week')}
            </button>
            <button
              type="button"
              class={`view-btn ${state.calendar.view === 'day' ? 'active' : ''}`}
              onClick={() => setState('calendar', 'view', 'day')}
              title="Shortcut: 'd'"
            >
              {t('calendar.views.day')}
            </button>
          </div>

          <div class="gcal-more-actions">
            <button
              type="button"
              class="gcal-icon-btn"
              onClick={() => exportToICS(state.calendar.events)}
              title={t('calendar.toolbar.exportIcs')}
            >
              📅 ⬇️
            </button>
            <label
              class="gcal-icon-btn"
              title={t('calendar.toolbar.importIcs')}
              style={{ cursor: 'pointer' }}
            >
              📅 ⬆️
              <input
                type="file"
                accept=".ics"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
            </label>
          </div>
        </div>
      </header>

      {/* CALENDAR MAIN BODY: SIDEBAR + STAGE */}
      <div class="gcal-body">
        {/* LEFT SIDEBAR */}
        <aside class="gcal-sidebar">
          <MiniCalendar
            selectedDate={selectedDate()}
            onSelectDate={d => {
              setSelectedDate(d);
              setCurrentDate(d);
            }}
          />

          {/* MY CALENDARS FILTER */}
          <div class="gcal-category-box">
            <h4 class="sidebar-heading">{t('calendar.sidebar.myCalendars')}</h4>
            <label class="cal-filter-item">
              <input
                type="checkbox"
                checked={state.calendar.filterEvents}
                onChange={e => setState('calendar', 'filterEvents', e.currentTarget.checked)}
              />
              <span class="filter-dot" style={{ background: '#ff6584' }} />
              {t('calendar.sidebar.events')}
            </label>
            <label class="cal-filter-item">
              <input
                type="checkbox"
                checked={state.calendar.filterTasks}
                onChange={e => setState('calendar', 'filterTasks', e.currentTarget.checked)}
              />
              <span class="filter-dot" style={{ background: '#00cec9' }} />
              {t('calendar.sidebar.tasks')}
            </label>
            <label class="cal-filter-item">
              <input
                type="checkbox"
                checked={state.calendar.filterBirthdays}
                onChange={e => setState('calendar', 'filterBirthdays', e.currentTarget.checked)}
              />
              <span class="filter-dot" style={{ background: '#e84393' }} />
              {t('calendar.sidebar.birthdays')}
            </label>
          </div>

          {/* TASKS TO-DO SECTION */}
          <div class="gcal-tasks-box">
            <div class="tasks-box-header">
              <h4 class="sidebar-heading">{t('calendar.sidebar.tasks')}</h4>
              <span class="tasks-badge">{sidebarTasks().length}</span>
            </div>
            <form class="quick-task-form" onSubmit={handleQuickTask}>
              <input
                type="text"
                placeholder={t('calendar.sidebar.quickTaskPlaceholder')}
                value={quickTaskInput()}
                onInput={e => setQuickTaskInput(e.currentTarget.value)}
                required
              />
            </form>
            <div class="tasks-list-container">
              <For each={sidebarTasks()}>
                {tk => (
                  <div
                    class={`sidebar-task-item ${tk.completed ? 'completed' : ''}`}
                    draggable={true}
                    onDragStart={e => {
                      if (!e.dataTransfer) return;
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'sidebar-task', id: tk.id }));
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tk.completed}
                      onClick={e => {
                        e.stopPropagation();
                        toggleTask(tk.id);
                      }}
                    />
                    <span
                      class="task-item-text"
                      title={tk.title}
                      onClick={() => openEditModal(tk)}
                    >
                      {tk.title}
                      {tk.recurrence && tk.recurrence !== 'none' && (
                        <span class="task-repeat-badge" title={t('calendar.sidebar.repeats', { rule: tk.recurrence })}> 🔁</span>
                      )}
                    </span>
                    <button
                      type="button"
                      class="task-del-btn"
                      onClick={() => deleteCalendarEvent(tk.id)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </aside>

        {/* MAIN CALENDAR VIEW STAGE */}
        <main class="gcal-stage">
          <Show when={state.calendar.view === 'month'}>
            <CalendarMonthView
              currentDate={currentDate()}
              events={filteredEvents()}
              onSelectDay={d => openCreateModal(d, 'event')}
              onOpenEvent={(ev, rect) => openPopover(ev, rect)}
            />
          </Show>

          <Show when={state.calendar.view === 'week'}>
            <CalendarWeekView
              currentDate={currentDate()}
              events={filteredEvents()}
              onSelectSlot={d => openCreateModal(d, 'event')}
              onSelectRange={range => openCreateModal(range.start, 'event', range)}
              onOpenEvent={(ev, rect) => openPopover(ev, rect)}
            />
          </Show>

          <Show when={state.calendar.view === 'day'}>
            <CalendarDayView
              currentDate={currentDate()}
              events={filteredEvents()}
              onSelectSlot={d => openCreateModal(d, 'event')}
              onSelectRange={range => openCreateModal(range.start, 'event', range)}
              onOpenEvent={(ev, rect) => openPopover(ev, rect)}
            />
          </Show>
        </main>
      </div>

      {/* POPOVER */}
      <CalendarPopover
        event={popoverEvent()}
        position={popoverPos()}
        onEdit={ev => openEditModal(ev)}
        onClose={closePopover}
      />

      {/* MODAL */}
      <EventModal
        isOpen={isModalOpen()}
        event={modalEvent()}
        defaultDate={modalDefaultDate()}
        initialType={modalInitialType()}
        prefilledRange={modalPrefilledRange()}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
