function $(sel, ctx = document) {
  return ctx.querySelector(sel);
}

function $$(sel, ctx = document) {
  return [...ctx.querySelectorAll(sel)];
}

function formatMoney(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function badge(status) {
  const s = (status || 'pending').toLowerCase();
  return `<span class="badge badge-${s}">${s.replace(/_/g, ' ')}</span>`;
}

function loanDisplayStatus(loan) {
  if (!loan) return 'pending';
  if (loan.status === 'active' && loan.balance <= 0) return 'completed';
  return loan.status || 'pending';
}

function loanPayoutStatus(loan) {
  if (!loan) return 'unpaid';
  if (loan.status === 'approved') return 'unpaid';
  if (loan.disbursementReceiptNo || loan.disbursedDate || loan.disbursedBy) return 'paid';
  return loan.status === 'active' ? 'paid' : loan.status;
}

function payoutBadge(loan) {
  const s = loanPayoutStatus(loan);
  if (s === 'unpaid') return '<span class="badge badge-pending">Unpaid</span>';
  if (s === 'paid') return '<span class="badge badge-approved">Paid</span>';
  return badge(s);
}

function toast(msg, type = 'success') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3500);
}

function openModal(id) {
  $(`#${id}`)?.classList.add('open');
}

function closeModal(id) {
  $(`#${id}`)?.classList.remove('open');
}

function showPanel(id) {
  $$(`.panel-form`).forEach((p) => p.classList.add('hidden'));
  const panel = $(`#${id}`);
  if (!panel) return;
  const page = panel.closest('.page');
  if (page) {
    page.querySelectorAll(':scope > *:not(.panel-form)').forEach((el) => el.classList.add('hidden'));
  }
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hidePanels() {
  $$(`.panel-form`).forEach((p) => p.classList.add('hidden'));
  const activePage = $('.page.active');
  if (activePage) {
    activePage.querySelectorAll(':scope > *:not(.panel-form)').forEach((el) => el.classList.remove('hidden'));
  }
  $('#pdfPreviewPanel')?.classList.add('hidden');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().split('T')[0];
}

function memberName(data, id) {
  return data.members.find((m) => m.id === id)?.fullName || 'Unknown';
}

function productName(data, id) {
  return data.loanProducts.find((p) => p.id === id)?.name || 'N/A';
}

function isFileProtocol() {
  return location.protocol === 'file:';
}

function saccoDisplayName(settings) {
  const name = settings?.saccoName || 'KIHINDI SACCO';
  return name.replace(/KAHINDI/gi, 'KIHINDI');
}

function memberSearchBlob(m) {
  return [m.fullName, m.membershipNo, m.phone, m.nin, m.accountNo].filter(Boolean).join(' ').toLowerCase();
}

function filterMembers(members, q, limit = 30) {
  const query = (q || '').trim().toLowerCase();
  if (query.length < 2) return [];
  return members.filter((m) => memberSearchBlob(m).includes(query)).slice(0, limit);
}

/**
 * Search input with dropdown — type letters to filter, click or Enter to select.
 */
function initTypeahead({ input, box, hidden = null, getItems, renderItem, onSelect, showAllOnFocus = false }) {
  if (!input || !box) return;

  let matches = [];
  let activeIdx = -1;

  function closeBox() {
    box.innerHTML = '';
    box.style.display = 'none';
    activeIdx = -1;
  }

  function pick(idx) {
    const item = matches[idx];
    if (!item) return;
    if (hidden) hidden.value = item.memberId ?? item.id ?? '';
    input.value = item.fullName ?? item.label ?? '';
    closeBox();
    onSelect?.(item, idx);
  }

  function renderDropdown(q) {
    matches = filterMembers(getItems(), q);
    activeIdx = -1;

    if (!matches.length) {
      const query = (input.value || '').trim();
      if (query.length < 2) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
      }
      box.innerHTML = '<div class="suggest-item muted">No matches — keep typing</div>';
      box.style.display = 'block';
      return;
    }

    box.innerHTML = matches
      .map((m, i) => `<div class="suggest-item${i === activeIdx ? ' active' : ''}" data-idx="${i}">${renderItem(m)}</div>`)
      .join('');

    box.querySelectorAll('.suggest-item:not(.muted)').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(Number(el.dataset.idx));
      });
    });
    box.style.display = 'block';
  }

  function highlightActive() {
    box.querySelectorAll('.suggest-item:not(.muted)').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
      if (i === activeIdx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  input.addEventListener('input', () => {
    if (hidden) hidden.value = '';
    renderDropdown(input.value);
  });

  input.addEventListener('focus', () => {
    if (showAllOnFocus || input.value.trim().length >= 2) renderDropdown(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = box.querySelectorAll('.suggest-item:not(.muted)');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      pick(activeIdx);
    } else if (e.key === 'Escape') {
      closeBox();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(closeBox, 150);
  });

  // Keep dropdown open while scrolling (mousedown on scrollbar would blur the input)
  box.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  return { render: renderDropdown, close: closeBox };
}
