export function renderStatus(element, state) {
  element.textContent = state.ready ? '' : (state.error || '');
}
