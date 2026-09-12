import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import {
  state,
  setState,
  addCalendarEvent,
  toggleTask,
  deleteCalendarEvent,
  updateCalendarEvent,
  moveCalendarEvent,
  getEventsForDate,
  getOccurrenceForDate,
  isEventOnDate,
  dateKeyOf,
  showToast,
} from '../lib/store';
import { CalendarEventItem } from '../lib/ical';
import { MiniCalendar } from './MiniCalendar';
import { EventModal } from './EventModal';
import { CalendarPopover } from './CalendarPopover';
import { RepeatScopeDialog, RepeatScopeRequest } from './RepeatScopeDialog';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { t, getLocale, formatDate } from '../lib/i18n';
import { onActivateKey } from '../lib/accessibility';

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

  const [repeatScopeRequest, setRepeatScopeRequest] = createSignal<RepeatScopeRequest | null>(null);

  // Pending single-event delete confirmation (protects against accidental data loss)
  const [pendingDelete, setPendingDelete] = createSignal<CalendarEventItem | null>(null);

  // Filtered events
  const filteredEvents = createMemo(() => {
    return state.calendar.events.filter(e => {
      if (e.type === 'event' && !state.calendar.filterEvents) return false;
      if (e.type === 'task' && !state.calendar.filterTasks) return false;
      if (e.type === 'birthday' && !state.calendar.filterBirthdays) return false;
      return true;
    });
  });

  // Tasks sidebar: ONLY tasks occurring today — everything from earlier days is
// hidden. Incomplete tasks come first, completed ones sink to the bottom.
const sidebarTasks = createMemo(() => {
  const today = new Date();
  const todayKey = dateKeyOf(today);
  const completionOf = (e: CalendarEventItem): boolean => {
    if (e.recurrence && e.recurrence !== 'none') {
      return getEventsForDate([e], today)[0]?.completed ?? e.completed;
    }
    return e.completed;
  };
  return state.calendar.events
    .filter(e => {
      if (e.type !== 'task' || !isEventOnDate(e, today)) return false;
      // A recurring task whose today's occurrence was deleted does not happen
      // today and must not be listed.
      if (e.recurrence && e.recurrence !== 'none') {
        const deleted = state.calendar.occurrenceOverrides.some(
          o => o.parentId === e.id && o.dateKey === todayKey && o.deleted === true
        );
        if (deleted) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDone = completionOf(a);
      const bDone = completionOf(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
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
    if (ev.parentId && ev.dateKey && ev.recurrence && ev.recurrence !== 'none') {
      setRepeatScopeRequest({ action: 'edit', event: ev, dateKey: ev.dateKey });
      return;
    }
    setModalEvent(ev);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = (ev: CalendarEventItem) => {
    if (ev.parentId && ev.dateKey && ev.recurrence && ev.recurrence !== 'none') {
      setRepeatScopeRequest({ action: 'delete', event: ev, dateKey: ev.dateKey });
      return;
    }
    // Single (non-recurring) events / whole series get an explicit confirmation
    // so a stray click can never wipe calendar data.
    setPendingDelete(ev);
  };

  const confirmDelete = () => {
    const ev = pendingDelete();
    if (!ev) return;
    deleteCalendarEvent(ev.id);
    showToast(t('calendar.toasts.eventDeleted', { title: ev.title }));
    setPendingDelete(null);
    closePopover();
  };

  const cancelDelete = () => {
    setPendingDelete(null);
  };

  const handleRequestMove = (
    ev: CalendarEventItem,
    start: Date,
    end: Date,
    dateKey?: string
  ) => {
    if (dateKey && ev.recurrence && ev.recurrence !== 'none') {
      setRepeatScopeRequest({ action: 'move', event: ev, dateKey, moveRange: { start, end } });
      return;
    }
    updateCalendarEvent(ev.id, { start: start.toISOString(), end: end.toISOString() });
    closePopover();
  };

  const resolveRepeatScope = (scope: 'this' | 'all') => {
    const req = repeatScopeRequest();
    if (!req) return;
    setRepeatScopeRequest(null);
    const { action, event, dateKey, moveRange } = req;
    const baseId = event.parentId || event.id;
    const base = state.calendar.events.find(e => e.id === baseId) || event;

    if (action === 'edit') {
      closePopover();
      setModalEvent(scope === 'this' ? event : base);
      setIsModalOpen(true);
    } else if (action === 'delete') {
      deleteCalendarEvent(baseId, scope === 'this' ? dateKey : undefined);
      showToast(t('calendar.toasts.eventDeleted', { title: base.title }));
      closePopover();
    } else if (action === 'move' && moveRange) {
      if (scope === 'this') {
        moveCalendarEvent(baseId, dateKey, moveRange.start.toISOString(), moveRange.end.toISOString());
      } else {
        updateCalendarEvent(baseId, { start: moveRange.start.toISOString(), end: moveRange.end.toISOString() });
      }
      showToast(t('calendar.toasts.rescheduled', { title: base.title, date: formatDate(moveRange.start) }));
      closePopover();
    }
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
    // Search UI was removed; make sure a stale query can't hide events.
    if (state.calendar.searchQuery) {
      setState('calendar', 'searchQuery', '');
    }

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

        <div class="gcal-toolbar-right">
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
                aria-label={t('calendar.a11y.quickTask')}
                value={quickTaskInput()}
                onInput={e => setQuickTaskInput(e.currentTarget.value)}
                required
              />
            </form>
            <div class="tasks-list-container">
              <For each={sidebarTasks()}>
                {tk => {
                  const occursToday = () => {
                    if (!tk.recurrence || tk.recurrence === 'none') return true;
                    return isEventOnDate(tk, new Date());
                  };
                  // For recurring tasks this is the occurrence shown for today.
                  // If the series does not fall on today there is no occurrence, so
                  // we fall back to the base record instead of crashing on [0].
                  const todayOccurrence = () => {
                    if (tk.recurrence && tk.recurrence !== 'none' && occursToday()) {
                      return getEventsForDate([tk], new Date())[0] ?? getOccurrenceForDate(tk, new Date());
                    }
                    return tk;
                  };
                  const toggle = () => {
                    if (tk.recurrence && tk.recurrence !== 'none') {
                      if (!occursToday()) return;
                      toggleTask(tk.id, dateKeyOf(new Date()));
                    } else {
                      toggleTask(tk.id);
                    }
                  };
                  return (
                    <div
                      class={`sidebar-task-item ${todayOccurrence().completed ? 'completed' : ''}`}
                      draggable={true}
                      onDragStart={e => {
                        if (!e.dataTransfer) return;
                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'sidebar-task', id: tk.id }));
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={todayOccurrence().completed}
                        disabled={!occursToday()}
                        onClick={e => {
                          e.stopPropagation();
                          toggle();
                        }}
                      />
                      <span
                        class="task-item-text"
                        title={tk.title}
                        role="button"
                        tabindex="0"
                        onClick={() => openEditModal(tk)}
                        onKeyDown={e => onActivateKey(e, () => openEditModal(tk))}
                      >
                        {tk.title}
                        {tk.recurrence && tk.recurrence !== 'none' && (
                          <span class="task-repeat-badge" title={t('calendar.sidebar.repeats', { rule: tk.recurrence })}> 🔁</span>
                        )}
                      </span>
                      <button
                        type="button"
                        class="task-del-btn"
                        aria-label={t('calendar.a11y.deleteTask', { title: tk.title })}
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteEvent(tk);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                }}
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
              onRequestMove={handleRequestMove}
            />
          </Show>

          <Show when={state.calendar.view === 'week'}>
            <CalendarWeekView
              currentDate={currentDate()}
              events={filteredEvents()}
              onSelectSlot={d => openCreateModal(d, 'event')}
              onSelectRange={range => openCreateModal(range.start, 'event', range)}
              onOpenEvent={(ev, rect) => openPopover(ev, rect)}
              onRequestMove={handleRequestMove}
            />
          </Show>

          <Show when={state.calendar.view === 'day'}>
            <CalendarDayView
              currentDate={currentDate()}
              events={filteredEvents()}
              onSelectSlot={d => openCreateModal(d, 'event')}
              onSelectRange={range => openCreateModal(range.start, 'event', range)}
              onOpenEvent={(ev, rect) => openPopover(ev, rect)}
              onRequestMove={handleRequestMove}
            />
          </Show>
        </main>
      </div>

      {/* POPOVER */}
      <CalendarPopover
        event={popoverEvent()}
        position={popoverPos()}
        onEdit={ev => openEditModal(ev)}
        onDeleteEvent={ev => handleDeleteEvent(ev)}
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

      {/* REPEAT SCOPE PROMPT */}
      <RepeatScopeDialog
        request={repeatScopeRequest()}
        onSelect={resolveRepeatScope}
        onClose={() => setRepeatScopeRequest(null)}
      />

      {/* DELETE CONFIRMATION (guards against accidental data loss) */}
      {(() => {
        const ev = pendingDelete();
        if (!ev) return null;
        const isSeries = !!(ev.recurrence && ev.recurrence !== 'none');
        return (
          <div
            class="gcal-modal-overlay active"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            onClick={e => {
              if (e.target === e.currentTarget) cancelDelete();
            }}
          >
            <div class="gcal-modal" style={{ 'max-width': '360px' }}>
              <div class="modal-header">
                <h3 id="confirm-delete-title">{t('calendar.deleteConfirm.title')}</h3>
                <button
                  class="modal-close-btn"
                  type="button"
                  onClick={cancelDelete}
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>
              <div class="repeat-scope-body">
                <p class="repeat-scope-event">"{ev.title}"</p>
                <p class="repeat-scope-subtitle">
                  {isSeries
                    ? t('calendar.deleteConfirm.seriesMessage')
                    : t('calendar.deleteConfirm.message')}
                </p>
                <div class="repeat-scope-actions">
                  <button type="button" class="gcal-btn gcal-btn-outline" onClick={cancelDelete}>
                    {t('calendar.deleteConfirm.cancel')}
                  </button>
                  <button type="button" class="gcal-btn gcal-btn-danger" onClick={confirmDelete}>
                    {isSeries
                      ? t('calendar.deleteConfirm.deleteSeries')
                      : t('calendar.deleteConfirm.confirm')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
