// Drag & Drop Calendar Event Handler

export class CalendarDragDrop {
  constructor(store, calendarInstance) {
    this.store = store;
    this.cal = calendarInstance;
    this.draggedItem = null;
    this.draggedType = null; // 'calendar-event' | 'task-item'
  }

  initDraggable(element, eventData, type = 'calendar-event') {
    element.setAttribute('draggable', 'true');

    element.addEventListener('dragstart', (e) => {
      this.draggedItem = eventData;
      this.draggedType = type;
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: eventData.id, type }));
      e.dataTransfer.effectAllowed = 'move';
      element.classList.add('is-dragging');
      document.body.classList.add('calendar-drag-active');
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('is-dragging');
      document.body.classList.remove('calendar-drag-active');
      this.draggedItem = null;
      this.draggedType = null;
    });
  }

  initDropZone(element, dateGetter) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drop-hover');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('drop-hover');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drop-hover');

      if (!this.draggedItem) return;

      const targetDate = dateGetter(e, element);
      if (!targetDate) return;

      if (this.draggedType === 'calendar-event' || this.draggedType === 'task-item') {
        this.rescheduleEvent(this.draggedItem, targetDate);
      }
    });
  }

  rescheduleEvent(event, newStartDate) {
    const oldStart = new Date(event.start);
    const oldEnd = new Date(event.end || event.start);
    const durationMs = Math.max(1800000, oldEnd.getTime() - oldStart.getTime()); // at least 30m

    const newStart = new Date(newStartDate);
    const newEnd = new Date(newStart.getTime() + durationMs);

    this.store.updateEvent(event.id, {
      start: newStart.toISOString(),
      end: newEnd.toISOString()
    });

    // Notify user with brief waifu prompt
    const persona = this.store.get('waifu.personality');
    const waifuName = this.store.get('waifu.name');
    let toastMsg = `Rescheduled "${event.title}"!`;
    if (persona === 'tsundere') toastMsg = `Don't think changing the time lets you be lazy, baka!`;
    else if (persona === 'yandere') toastMsg = `Rescheduled for us, darling~`;

    window.__showToast?.(toastMsg);
  }
}
