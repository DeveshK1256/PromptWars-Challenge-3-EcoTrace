/**
 * @module ui-helpers
 * Shared DOM creation utilities used across pages.
 */

/**
 * Creates a styled card element with optional icon, title, body, and metadata.
 * @param {{ tag?: string, className?: string, icon?: string, title?: string, body?: string, meta?: Array<{label: string, value: string}> }} opts
 * @returns {HTMLElement}
 */
export function createCard({ tag = 'article', className = 'card', icon, title, body, meta } = {}) {
  const card = document.createElement(tag);
  card.className = className;

  if (icon) {
    const i = document.createElement('i');
    i.className = `fa-solid ${icon}`;
    i.setAttribute('aria-hidden', 'true');
    card.append(i);
  }

  if (title) {
    const h = document.createElement('h3');
    h.textContent = title;
    card.append(h);
  }

  if (body) {
    const p = document.createElement('p');
    p.textContent = body;
    card.append(p);
  }

  if (meta && meta.length) {
    const div = document.createElement('div');
    div.className = 'card-meta';
    meta.forEach(({ label, value }) => {
      const span = document.createElement('span');
      span.textContent = `${label}: ${value}`;
      div.append(span);
    });
    card.append(div);
  }

  return card;
}

/**
 * Creates a metadata row with label and value.
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
export function createMetaRow(label, value) {
  const row = document.createElement('div');
  row.className = 'meta-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'meta-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'meta-value';
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
}

/**
 * Creates an empty state placeholder with icon and message.
 * @param {string} message
 * @param {string} [iconClass='fa-leaf']
 * @returns {HTMLElement}
 */
export function createEmptyState(message, iconClass = 'fa-leaf') {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  const icon = document.createElement('i');
  icon.className = `fa-solid ${iconClass}`;
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('p');
  text.textContent = message;
  wrapper.append(icon, text);
  return wrapper;
}
