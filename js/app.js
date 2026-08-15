/* ── Auth ── */
const Auth = {
  session: null,

  normalizeRole(role) {
    return role === 'admin' ? 'chairman' : role;
  },

  async checkSession() {
    try {
      const json = await Store.request('me', null, 'GET');
      if (json.session) {
        json.session.role = this.normalizeRole(json.session.role);
        this.session = json.session;
      } else {
        this.session = null;
      }
    } catch {
      this.session = null;
    }
  },

  async login(username, password) {
    try {
      const json = await Store.request('login', { username: username.trim(), password });
      if (!json.session) throw new Error('Invalid server response');
      json.session.role = this.normalizeRole(json.session.role);
      this.session = json.session;
      return { ok: true };
    } catch (e) {
      this.session = null;
      return { ok: false, error: e.message || 'Login failed' };
    }
  },

  async logout() {
    try {
      await Store.request('logout');
    } catch {
      /* ignore */
    }
    this.session = null;
    Store.cache = null;
  },

  isLoggedIn() {
    return !!this.session;
  },
};

/* ── Pages ── */
const Pages = {
  dashboard(clearLookup = false) {
    const data = Store.get();
    const type = Access.dashboardType();

    $$('.role-dashboard').forEach((el) => el.classList.add('hidden'));
    $(`#dash-${type.replace('_', '-')}`)?.classList.remove('hidden');

    if (clearLookup) {
      App.dashboardMemberId = null;
      App.dashboardLoanId = null;
      $('#chDashMemberSearch') && ($('#chDashMemberSearch').value = '');
      $('#caDashMemberSearch') && ($('#caDashMemberSearch').value = '');
      $('#loDashLoanSearch') && ($('#loDashLoanSearch').value = '');
    }

    if (type === 'chairman') this.renderChairmanDashboard(data);
    if (type === 'loan_officer') this.renderLoanOfficerDashboard(data);
    if (type === 'cashier') this.renderCashierDashboard(data);

    if (App.dashboardMemberId) {
      if (type === 'chairman') App.renderChairmanDashDetail(App.dashboardMemberId);
      if (type === 'cashier') App.renderCashierDashDetail(App.dashboardMemberId);
    }
    if (App.dashboardLoanId && type === 'loan_officer') App.renderLoanDashDetail(App.dashboardLoanId);
  },

  renderChairmanDashboard(data) {
    const activeMembers = data.members.filter((m) => m.status === 'active').length;
    const pendingApps = (data.applications || []).filter((a) => a.status === 'pending').length;
    const pendingLoans = data.loans.filter((l) => l.status === 'pending').length;
    const totalSavings = data.savings.reduce((s, a) => s + a.balance, 0);
    const totalDeposits = data.deposits.filter((d) => d.status === 'active').reduce((s, d) => s + d.amount, 0);
    const totalLoans = data.loans.filter((l) => l.status === 'active' && l.balance > 0).reduce((s, l) => s + l.balance, 0);

    $('#statMembers').textContent = activeMembers;
    $('#statPendingApps').textContent = pendingApps;
    $('#statPendingLoans').textContent = pendingLoans;
    $('#statSavings').textContent = formatMoney(totalSavings);
    $('#statDeposits').textContent = formatMoney(totalDeposits);
    $('#statLoans').textContent = formatMoney(totalLoans);

    if (!App.dashboardMemberId) App.renderChairmanDashDetail(null);
  },

  renderLoanOfficerDashboard(data) {
    const unpaid = data.loans.filter((l) => l.status === 'active' && l.balance > 0);
    const paid = data.loans.filter((l) => l.status === 'completed' || (l.status === 'active' && l.balance <= 0));
    const outstanding = unpaid.reduce((s, l) => s + l.balance, 0);
    const collected = (data.loanPayments || []).reduce((s, p) => s + p.amount, 0);

    $('#loDashActive').textContent = unpaid.length;
    $('#loDashPaid').textContent = paid.length;
    $('#loDashOutstanding').textContent = formatMoney(outstanding);
    $('#loDashCollected').textContent = formatMoney(collected);

    if (!App.dashboardLoanId) App.renderLoanDashDetail(null);
  },

  renderCashierDashboard(data) {
    const activeAccounts = data.savings.filter((s) => s.status === 'active').length;
    const loansToDisburse = data.loans.filter((l) => l.status === 'approved').length;
    const todayStr = today();
    const todayTx = data.savingsTx.filter((t) => t.date === todayStr);
    const depositsToday = todayTx.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const withdrawalsToday = todayTx.filter((t) => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);

    $('#caDashAccounts').textContent = activeAccounts;
    $('#caDashLoansToDisburse').textContent = loansToDisburse;
    $('#caDashDepositsToday').textContent = formatMoney(depositsToday);
    $('#caDashWithdrawalsToday').textContent = formatMoney(withdrawalsToday);
    $('#caDashTxToday').textContent = todayTx.length;

    if (!App.dashboardMemberId) App.renderCashierDashDetail(null);
  },

  members() {
    const data = Store.get();
    const canEdit = Access.perm('editMember');
    const canDelete = Access.perm('deleteMember');
    const q = (App.memberListQuery || '').trim().toLowerCase();
    let list = data.members;
    if (q) list = list.filter((m) => memberSearchBlob(m).includes(q));

    $('#memberBody').innerHTML = list.length
      ? list
          .map(
            (m) => {
              const sav = Store.getSavings(data, m.id);
              return `<tr>
          <td>${m.membershipNo}</td>
          <td><strong>${escapeHtml(m.fullName)}</strong></td>
          <td>${m.nin}</td>
          <td>${m.phone || '—'}</td>
          <td>${sav ? formatMoney(sav.balance) : '<span class="muted">—</span>'}</td>
          <td>${badge(m.status)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="App.viewMember(${m.id})">View</button>
            ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="App.editMember(${m.id})">Edit</button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="App.deleteMember(${m.id})">Delete</button>` : ''}
          </td>
        </tr>`;
            }
          )
          .join('')
      : `<tr><td colspan="7" class="empty">${q ? 'No members match your search' : 'No members registered'}</td></tr>`;
  },

  applications() {
    const data = Store.get();
    if (!data.applications) data.applications = [];
    const canApprove = Access.perm('approveApplication');
    $('#applicationBody').innerHTML = data.applications.length
      ? [...data.applications]
          .sort((a, b) => new Date(b.applied) - new Date(a.applied))
          .map(
            (a) => `<tr>
          <td>${a.applicationNo}</td>
          <td><strong>${escapeHtml(a.fullName)}</strong></td>
          <td>${a.nin}</td>
          <td>${a.phone}</td>
          <td>${formatDate(a.applied)}</td>
          <td>${badge(a.status)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="App.viewApplication(${a.id})">View</button>
            ${canApprove && a.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="App.approveApplication(${a.id})">Approve</button>
            <button class="btn btn-sm btn-outline" onclick="App.rejectApplication(${a.id})">Reject</button>` : ''}
          </td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="empty">No applications yet</td></tr>';
    App.checkPdfAvailable();
  },

  loanApplications(filter = 'pending') {
    const data = Store.get();
    const workflowLoans = data.loans.filter((l) => ['pending', 'approved', 'rejected'].includes(l.status));
    let loans = [...workflowLoans];

    if (filter === 'pending') loans = loans.filter((l) => l.status === 'pending');
    if (filter === 'approved') loans = loans.filter((l) => l.status === 'approved');
    if (filter === 'rejected') loans = loans.filter((l) => l.status === 'rejected');

    const pending = workflowLoans.filter((l) => l.status === 'pending');
    const approved = workflowLoans.filter((l) => l.status === 'approved');
    const rejected = workflowLoans.filter((l) => l.status === 'rejected');
    $('#loanAppStatPending').textContent = pending.length;
    $('#loanAppStatApproved').textContent = approved.length;
    $('#loanAppStatRejected').textContent = rejected.length;

    const canApprove = Access.perm('approveLoan');
    const hint = $('#loanAppHint');
    if (hint) {
      hint.textContent = canApprove
        ? 'Review loan officer submissions here. Approve to send to the cashier for payout.'
        : 'Track loan applications you have submitted. Approved loans go to the cashier for payout.';
    }

    $('#loanApplicationBody').innerHTML = loans.length
      ? loans
          .sort((a, b) => new Date(b.applied) - new Date(a.applied))
          .map((l) => {
            const m = Store.getMember(data, l.memberId);
            const actions = [`<button class="btn btn-sm btn-outline" onclick="App.viewLoan(${l.id})">View</button>`];
            if (canApprove && l.status === 'pending') {
              actions.push(`<button class="btn btn-sm btn-primary" onclick="App.approveLoan(${l.id})">Approve</button>`);
              actions.push(`<button class="btn btn-sm btn-outline" onclick="App.rejectLoan(${l.id})">Reject</button>`);
            }
            return `<tr>
            <td>${l.loanId}</td>
            <td><strong>${escapeHtml(m?.fullName || '—')}</strong></td>
            <td>${productName(data, l.productId)}</td>
            <td>${formatMoney(l.amount)}</td>
            <td>${l.months}</td>
            <td>${formatDate(l.applied)}</td>
            <td>${escapeHtml(l.createdBy || '—')}</td>
            <td>${badge(l.status)}</td>
            <td>${actions.join(' ')}</td>
          </tr>`;
          })
          .join('')
      : `<tr><td colspan="9" class="empty">${filter === 'pending' ? 'No loan applications awaiting approval' : 'No loan applications in this list'}</td></tr>`;
  },

  savings() {
    const data = Store.get();
    const q = (App.savingsListQuery || '').trim().toLowerCase();
    let accounts = data.savings;
    if (q) {
      accounts = accounts.filter((s) => {
        const m = Store.getMember(data, s.memberId);
        const blob = [m?.fullName, m?.membershipNo, m?.phone, m?.nin, s.accountNo].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
      });
    }

    $('#savingsBody').innerHTML = accounts.length
      ? accounts
          .map((s) => {
            const m = Store.getMember(data, s.memberId);
            return `<tr>
            <td><strong>${escapeHtml(m?.fullName || '—')}</strong></td>
            <td>${s.accountNo}</td>
            <td>${formatMoney(s.balance)}</td>
            <td>${badge(s.status)}</td>
            <td>${formatDate(s.opened)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="App.viewSavings(${s.memberId})">View</button> <button class="btn btn-sm btn-primary" onclick="App.openSavingsDeposit(${s.memberId})">Record Payment</button> <button class="btn btn-sm btn-gold" onclick="App.openSavingsWithdrawal(${s.memberId})">Withdraw</button></td>
          </tr>`;
          })
          .join('')
      : `<tr><td colspan="6" class="empty">${q ? 'No accounts match your search' : 'No savings accounts'}</td></tr>`;
  },

  deposits() {
    const data = Store.get();
    $('#depositBody').innerHTML = data.deposits.length
      ? data.deposits
          .map((d) => {
            const m = Store.getMember(data, d.memberId);
            const qInterest = ((d.amount * d.rate) / 100 / 4).toFixed(0);
            return `<tr>
            <td>${d.accountNo}</td>
            <td>${escapeHtml(m?.fullName || '—')}</td>
            <td>${formatMoney(d.amount)}</td>
            <td>${d.tenor} mo</td>
            <td>${formatDate(d.maturityDate)}</td>
            <td>${formatMoney(qInterest)}</td>
            <td>${badge(d.status)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="App.viewFixedDeposit(${d.id})">View</button> <button class="btn btn-sm btn-primary" onclick="App.openFixedDepositTransaction(${d.id}, 'deposit')">Record Payment</button> <button class="btn btn-sm btn-gold" onclick="App.openFixedDepositTransaction(${d.id}, 'withdraw')">Withdraw</button></td>
          </tr>`;
          })
          .join('')
      : '<tr><td colspan="8" class="empty">No fixed deposits</td></tr>';
  },

  loans(filter = 'all') {
    const data = Store.get();
    const isCashier = Access.role() === 'cashier';
    let loans = [...data.loans];

    if (isCashier) {
      if (filter === 'unpaid_payout') loans = loans.filter((l) => l.status === 'approved');
      if (filter === 'paid_payout') loans = loans.filter((l) => loanPayoutStatus(l) === 'paid' && l.status !== 'approved');

      const unpaid = data.loans.filter((l) => l.status === 'approved');
      const paidOut = data.loans.filter((l) => loanPayoutStatus(l) === 'paid' && l.status !== 'approved');
      $('#loanStatUnpaidPayout').textContent = unpaid.length;
      $('#loanStatPaidPayout').textContent = paidOut.length;
      $('#loanStatUnpaidAmount').textContent = formatMoney(unpaid.reduce((s, l) => s + l.amount, 0));

      const head = $('#page-loans table thead tr');
      if (head) {
        head.innerHTML = '<th>Loan ID</th><th>Member</th><th>Product</th><th>Amount</th><th>Approved By</th><th>Receipt No</th><th>Payout</th><th></th>';
      }

      const canDisburse = Access.perm('disburseLoan');
      $('#loanBody').innerHTML = loans.length
        ? loans
            .map((l) => {
              const m = Store.getMember(data, l.memberId);
              const actions = [`<button class="btn btn-sm btn-outline" onclick="App.viewLoan(${l.id})">View</button>`];
              if (canDisburse && l.status === 'approved') {
                actions.push(`<button class="btn btn-sm btn-primary" onclick="App.openLoanPayout(${l.id})"><i class="fas fa-money-bill-transfer"></i> Pay</button>`);
              }
              if (l.disbursementReceiptNo) {
                actions.push(`<button class="btn btn-sm btn-outline" onclick="App.viewLoanReceipt(${l.id})"><i class="fas fa-receipt"></i> Receipt</button>`);
              }
              return `<tr>
              <td>${l.loanId}</td>
              <td>${escapeHtml(m?.fullName || '—')}</td>
              <td>${productName(data, l.productId)}</td>
              <td>${formatMoney(l.amount)}</td>
              <td>${escapeHtml(l.approvedBy || '—')}</td>
              <td>${l.disbursementReceiptNo || '—'}</td>
              <td>${payoutBadge(l)}</td>
              <td>${actions.join(' ')}</td>
            </tr>`;
            })
            .join('')
        : '<tr><td colspan="8" class="empty">No loan payouts in this list</td></tr>';
      return;
    }

    const head = $('#page-loans table thead tr');
    if (head) {
      head.innerHTML = '<th>Loan ID</th><th>Member</th><th>Product</th><th>Amount</th><th>Balance</th><th>Paid</th><th>Status</th><th></th>';
    }

    if (filter === 'pending') loans = loans.filter((l) => l.status === 'pending');
    if (filter === 'approved') loans = loans.filter((l) => l.status === 'approved');
    if (filter === 'active') loans = loans.filter((l) => l.status === 'active' && l.balance > 0);
    if (filter === 'completed') loans = loans.filter((l) => l.status === 'completed' || (l.status === 'active' && l.balance <= 0));

    const active = data.loans.filter((l) => l.status === 'active' && l.balance > 0);
    const paid = data.loans.filter((l) => l.status === 'completed' || (l.status === 'active' && l.balance <= 0));
    const outstanding = active.reduce((s, l) => s + l.balance, 0);
    $('#loanStatActive').textContent = active.length;
    $('#loanStatPaid').textContent = paid.length;
    $('#loanStatOutstanding').textContent = formatMoney(outstanding);

    const canPay = Access.perm('recordLoanPayment');
    const canApprove = Access.perm('approveLoan');
    const canDisburse = Access.perm('disburseLoan');
    $('#loanBody').innerHTML = loans.length
      ? loans
          .map((l) => {
            const m = Store.getMember(data, l.memberId);
            const paidAmt = l.status === 'active' || l.status === 'completed' ? l.amount - l.balance : 0;
            const displayStatus = loanDisplayStatus(l);
            const actions = [
              `<button class="btn btn-sm btn-outline" onclick="App.viewLoan(${l.id})">View</button>`,
            ];
            if (canApprove && l.status === 'pending') {
              actions.push(`<button class="btn btn-sm btn-primary" onclick="App.approveLoan(${l.id})">Approve</button>`);
              actions.push(`<button class="btn btn-sm btn-outline" onclick="App.rejectLoan(${l.id})">Reject</button>`);
            }
            if (canDisburse && l.status === 'approved') {
              actions.push(`<button class="btn btn-sm btn-primary" onclick="App.openLoanPayout(${l.id})">Pay Out</button>`);
            }
            if (canPay && l.status === 'active' && l.balance > 0) {
              actions.push(`<button class="btn btn-sm btn-primary" onclick="App.openLoanPayment(${l.id})">Record Payment</button>`);
            }
            return `<tr>
            <td>${l.loanId}</td>
            <td>${escapeHtml(m?.fullName || '—')}</td>
            <td>${productName(data, l.productId)}</td>
            <td>${formatMoney(l.amount)}</td>
            <td>${l.status === 'active' || l.status === 'completed' ? formatMoney(l.balance) : '—'}</td>
            <td>${paidAmt > 0 ? formatMoney(paidAmt) : '—'}</td>
            <td>${badge(displayStatus)}</td>
            <td>${actions.join(' ')}</td>
          </tr>`;
          })
          .join('')
      : '<tr><td colspan="8" class="empty">No loans found</td></tr>';
  },

  users() {
    const data = Store.get();
    const me = Auth.session?.id;
    const canDelete = Access.perm('deleteStaff');
    $('#userBody').innerHTML = data.users.length
      ? data.users
          .map(
            (u) => `<tr>
          <td><strong>${escapeHtml(u.name)}</strong></td>
          <td>${u.username}</td>
          <td>${Access.label(u.role)}</td>
          <td>${badge(u.active === false ? 'inactive' : 'active')}</td>
          <td>${formatDate(u.created || today())}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="App.editUser(${u.id})">Edit</button>
            ${u.id !== me ? `<button class="btn btn-sm btn-outline" onclick="App.toggleUser(${u.id})">${u.active === false ? 'Enable' : 'Disable'}</button>` : '<small class="muted">You</small>'}
            ${canDelete && u.id !== me ? `<button class="btn btn-sm btn-danger" onclick="App.deleteStaff(${u.id})">Delete</button>` : ''}
          </td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="6" class="empty">No staff accounts</td></tr>';
  },

  reports() {
    App.updateReportFilterUI();
    if (App.lastReportGenerated) App.generateReport(false);
  },
};

const REPORT_LABELS = {
  summary: 'SACCO Summary',
  members: 'Member Register',
  applications: 'Membership Applications',
  savings: 'Savings Accounts',
  savings_tx: 'Savings Transactions',
  deposits: 'Fixed Deposits',
  loans: 'Loans Portfolio',
  loan_payments: 'Loan Repayments',
};

const REPORT_STATUS_OPTIONS = {
  members: [['', 'All statuses'], ['active', 'Active'], ['inactive', 'Inactive'], ['suspended', 'Suspended']],
  applications: [['', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']],
  savings: [['', 'All statuses'], ['active', 'Active'], ['inactive', 'Inactive'], ['closed', 'Closed']],
  deposits: [['', 'All statuses'], ['active', 'Active'], ['matured', 'Matured'], ['closed', 'Closed']],
  loans: [['', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['active', 'Active'], ['completed', 'Completed'], ['rejected', 'Rejected'], ['defaulted', 'Defaulted']],
};

function reportDateOnly(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 10);
}

function reportInDateRange(dateStr, from, to) {
  const d = reportDateOnly(dateStr);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function reportFilterDesc(filters) {
  const parts = [];
  if (filters.from) parts.push(`From ${formatDate(filters.from)}`);
  if (filters.to) parts.push(`To ${formatDate(filters.to)}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.txType) parts.push(`Type: ${filters.txType}`);
  if (filters.productId) parts.push(`Product: ${filters.productName || filters.productId}`);
  if (filters.memberName) parts.push(`Member: ${filters.memberName}`);
  return parts.length ? parts.join(' · ') : 'All records';
}

/* ── App Controller ── */
const App = {
  charts: { deposits: null, loans: null, reportSavings: null, reportLoans: null },
  memberCache: [],
  loanFilter: 'all',
  loanAppFilter: 'pending',
  pendingLoanReceipt: null,
  memberListQuery: '',
  savingsListQuery: '',
  dashboardMemberId: null,
  dashboardLoanId: null,
  lastReportGenerated: false,

  async init() {
    this.showFileProtocolNotice();
    this.bindNav();
    this.bindForms();
    this.bindModals();
    
    // Check if this is first visit or splash was dismissed
    if (!sessionStorage.getItem('splashShown') && !Auth.isLoggedIn()) {
      this.showSplash();
      sessionStorage.setItem('splashShown', 'true');
      return;
    }
    
    await Auth.checkSession();
    if (Auth.isLoggedIn() && Access.role() === 'cashier') this.loanFilter = 'unpaid_payout';
    if (Auth.isLoggedIn()) {
      await this.showApp();
    } else {
      this.showLogin();
    }
  },

  showSplash() {
    // Redirect to splash page
    window.location.href = 'splash.html';
  },

  showLogin() {
    $('#loginScreen').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
  },

  async showApp() {
    $('#loginScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    const s = Auth.session;
    $('#userName').textContent = s.name || s.username;
    $('#userRole').textContent = Access.label(s.role);
    $('#userInitials').textContent = (s.name || s.username || 'A').slice(0, 2).toUpperCase();

    let loadError = null;
    try {
      await Store.load(!Store.hasRecords(Store.cache));
    } catch (e) {
      loadError = e.message || 'Could not load data from database';
      if (!Store.hasRecords(Store.cache)) {
        toast(loadError, 'error');
      }
    }
    this.updateDataBanner(loadError);
    this.applyAccessUI();
    this.refreshAll();
    this.navigate(Access.homePage());
  },

  updateDataBanner(loadError = null) {
    const el = $('#dataStatusBanner');
    if (!el) return;
    const data = Store.get();
    if (loadError && !Store.hasRecords(data)) {
      el.className = 'data-status-banner error';
      el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Unable to load SACCO records right now. Please try again or contact the chairman.';
      el.classList.remove('hidden');
      return;
    }
    if (!Store.hasRecords(data)) {
      el.className = 'data-status-banner';
      el.innerHTML = '<i class="fas fa-circle-info"></i> No member records are available yet. New registrations and applications will appear here.';
      el.classList.remove('hidden');
      return;
    }
    el.classList.add('hidden');
    el.innerHTML = '';
  },

  applyAccessUI() {
    const role = Access.role();
    const isCashier = role === 'cashier';
    $$('.nav-link[data-page]').forEach((link) => {
      link.classList.toggle('hidden', !Access.can(link.dataset.page));
    });
    $$('[data-perm]').forEach((el) => {
      el.classList.toggle('hidden', !Access.perm(el.dataset.perm));
    });
    $('#topbarChairman')?.classList.toggle('hidden', role !== 'chairman');
    $('#topbarLoanOfficer')?.classList.toggle('hidden', role !== 'loan_officer');
    $('#topbarCashier')?.classList.toggle('hidden', role !== 'cashier');
    $('#loanStatsChairman')?.classList.toggle('hidden', isCashier);
    $('#loanStatsCashier')?.classList.toggle('hidden', !isCashier);
    if ($('#loanPageTitle')) {
      $('#loanPageTitle').innerHTML = isCashier
        ? '<i class="fas fa-money-bill-transfer"></i> Loan Payouts'
        : '<i class="fas fa-hand-holding-dollar"></i> Loan Portfolio';
    }
    $$('#loanFilters .filter-tab').forEach((tab) => {
      const tabRole = tab.dataset.role || 'staff';
      tab.classList.toggle('hidden', isCashier ? tabRole === 'staff' : tabRole === 'cashier');
    });
    if (isCashier && !['unpaid_payout', 'paid_payout'].includes(this.loanFilter)) {
      this.loanFilter = 'unpaid_payout';
      $$('#loanFilters .filter-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.filter === 'unpaid_payout');
      });
    }
  },

  refreshAll() {
    this.memberCache = Store.get().members.filter((m) => m.status === 'active');
    this.updateDataBanner();
    if (Access.can('dashboard')) Pages.dashboard();
    if (Access.can('members')) Pages.members();
    if (Access.can('applications')) Pages.applications();
    if (Access.can('loan-applications')) Pages.loanApplications(this.loanAppFilter);
    if (Access.can('savings')) Pages.savings();
    if (Access.can('deposits')) Pages.deposits();
    if (Access.can('loans')) Pages.loans(this.loanFilter);
    if (Access.can('users')) Pages.users();
    if (Access.can('reports') && $('#page-reports')?.classList.contains('active') && this.lastReportGenerated) {
      this.generateReport(false);
    }
  },

  bindNav() {
    $$('.nav-link').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
    $$('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.dataset.filter) {
          this.loanFilter = el.dataset.filter;
          $$('#loanFilters .filter-tab').forEach((t) => t.classList.toggle('active', t.dataset.filter === el.dataset.filter));
        }
        if (el.dataset.loanAppFilter) {
          this.loanAppFilter = el.dataset.loanAppFilter;
          $$('#loanAppFilters .filter-tab').forEach((t) => t.classList.toggle('active', t.dataset.filter === el.dataset.loanAppFilter));
        }
        this.navigate(el.dataset.goto);
      });
    });
    $('#menuBtn')?.addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
      $('#overlay').classList.toggle('show');
    });
    $('#overlay')?.addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('#overlay').classList.remove('show');
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        $('#sidebar')?.classList.remove('open');
        $('#overlay')?.classList.remove('show');
      }
    });
    $('#logoutBtn')?.addEventListener('click', async () => {
      await Auth.logout();
      this.showLogin();
      toast('Logged out');
    });

    $('#loDashApply')?.addEventListener('click', () => this.openLoanApply());
    $('#loDashPayments')?.addEventListener('click', () => {
      this.loanFilter = 'active';
      $$('#loanFilters .filter-tab').forEach((t) => t.classList.toggle('active', t.dataset.filter === 'active'));
      this.navigate('loans');
    });
    $('#caDashDeposit')?.addEventListener('click', () => this.openSavingsAction('deposit'));
    $('#caDashWithdraw')?.addEventListener('click', () => this.openSavingsAction('withdraw'));
  },

  navigate(page) {
    if (!Access.can(page)) {
      toast('You do not have access to that section', 'error');
      return;
    }
    $$('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
    $('#pageTitle').textContent = {
      dashboard: { chairman: 'Chairman Dashboard', loan_officer: 'Loan Officer Dashboard', cashier: 'Cashier Dashboard' }[Access.role()] || 'Dashboard',
      members: 'Members',
      applications: 'Member Applications',
      'loan-applications': 'Loan Applications',
      savings: 'Savings',
      deposits: 'Fixed Deposits',
      loans: Access.role() === 'cashier' ? 'Loan Payouts' : 'Loans Portfolio',
      reports: 'Reports',
      users: 'Staff Access',
    }[page] || page;
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
    hidePanels();
    if (page === 'reports') {
      Pages.reports();
    }
    if (page === 'applications') Pages.applications();
    if (page === 'loan-applications') Pages.loanApplications(this.loanAppFilter);
    if (page === 'loans') Pages.loans(this.loanFilter);
    if (page === 'users') Pages.users();
    if (page === 'dashboard') Pages.dashboard(true);
  },

  bindForms() {
    // Password visibility toggle
    const toggleBtn = $('#togglePassword');
    const passwordInput = $('#loginPass');
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        const icon = toggleBtn.querySelector('i');
        if (icon) {
          icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
        toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        passwordInput.focus();
      });
    }

    $('#loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = $('#loginUser').value.trim();
      const p = $('#loginPass').value;
      const btn = e.target.querySelector('[type=submit]');
      const errEl = $('#loginError');
      if (btn) btn.disabled = true;
      errEl?.classList.add('hidden');
      const result = await Auth.login(u, p);
      if (btn) btn.disabled = false;
      if (result.ok) {
        errEl?.classList.add('hidden');
        try {
          await this.showApp();
          toast(`Welcome, ${Auth.session.name}!`);
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || 'Could not load application data';
            errEl.classList.remove('hidden');
          }
          toast(err.message || 'Could not load application data', 'error');
        }
      } else if (errEl) {
        errEl.textContent = result.error || 'Invalid username or password';
        errEl.classList.remove('hidden');
      }
    });

    $('#btnAddMember')?.addEventListener('click', () => this.openMemberForm());
    $('#btnCancelMember')?.addEventListener('click', () => hidePanels());

    $('#btnNewApplication')?.addEventListener('click', () => {
      showPanel('applicationFormPanel');
      $('#afDate').value = today();
    });
    $('#btnCancelApplication')?.addEventListener('click', () => {
      hidePanels();
      $('#pdfPreviewPanel')?.classList.add('hidden');
    });

    $('#applicationForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('manageApplications')) return toast('Access denied', 'error');
      const surname = $('#afSurname').value.trim();
      const otherNames = $('#afOtherNames').value.trim();
      const fullName = `${surname} ${otherNames}`.trim();
      try {
        await Store.request('application.create', {
          surname, otherNames, fullName,
          gender: $('#afGender').value,
          dob: $('#afDob').value,
          marital: $('#afMarital').value,
          nin: $('#afNin').value.trim(),
          phone: $('#afPhone').value.trim(),
          altPhone: $('#afAltPhone').value.trim(),
          email: $('#afEmail').value.trim(),
          village: $('#afVillage').value.trim(),
          parish: $('#afParish').value.trim(),
          subCounty: $('#afSubCounty').value.trim(),
          district: $('#afDistrict').value.trim(),
          postal: $('#afPostal').value.trim(),
          occupation: $('#afOccupation').value.trim(),
          stage: $('#afStage').value.trim(),
          plate: $('#afPlate').value.trim(),
          monthlyCommitment: Number($('#afMonthly').value) || 0,
          nokName: $('#afNokName').value.trim(),
          nokRelation: $('#afNokRelation').value.trim(),
          nokNin: $('#afNokNin').value.trim(),
          nokPhone: $('#afNokPhone').value.trim(),
          nokAddress: $('#afNokAddress').value.trim(),
          shareCapital: Number($('#afShare').value) || 0,
          shares: Number($('#afShares').value) || 1,
          entranceFeePaid: $('#afFee').checked,
          introName: $('#afIntroName').value.trim(),
          introNo: $('#afIntroNo').value.trim(),
          signature: $('#afSignature').value.trim(),
          applied: $('#afDate').value || today(),
        });
        e.target.reset();
        hidePanels();
        $('#pdfPreviewPanel')?.classList.add('hidden');
        toast('Application submitted successfully!');
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#memberForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#mfId').value;
      const payload = {
        fullName: $('#mfName').value.trim(),
        gender: $('#mfGender').value,
        dob: $('#mfDob').value,
        nin: $('#mfNin').value.trim(),
        phone: $('#mfPhone').value.trim(),
        password: $('#mfPass').value,
        marital: $('#mfMarital').value,
        address: $('#mfAddress').value.trim(),
        occupation: $('#mfOccupation').value.trim(),
        stage: $('#mfStage').value.trim(),
        nokName: $('#mfNokName').value.trim(),
        nokPhone: $('#mfNokPhone').value.trim(),
        shareCapital: Number($('#mfShare').value) || 0,
        entranceFeePaid: $('#mfFee').checked,
      };
      if (id) {
        if (!Access.perm('editMember')) return toast('Access denied', 'error');
        payload.id = Number(id);
        payload.status = $('#mfStatus').value;
      } else if (!Access.perm('registerMember')) {
        return toast('Access denied', 'error');
      }
      try {
        await Store.request(id ? 'member.update' : 'member.create', payload);
        e.target.reset();
        hidePanels();
        toast(id ? 'Member updated successfully!' : 'Member registered successfully!');
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btnSavDep')?.addEventListener('click', () => showPanel('savDepPanel'));
    $('#btnSavWith')?.addEventListener('click', () => showPanel('savWithPanel'));

    $('#savDepForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('savingsDeposit')) return toast('Access denied', 'error');
      const mid = Number($('#sdMemberId').value);
      const amt = Number($('#sdAmount').value);
      if (!mid) return toast('Select a member', 'error');
      try {
        const json = await Store.request('savings.deposit', { memberId: mid, amount: amt, desc: $('#sdDesc').value || 'Deposit' });
        e.target.reset();
        $('#sdMemberId').value = '';
        hidePanels();
        this.showTransactionReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#savWithForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('savingsWithdraw')) return toast('Access denied', 'error');
      const mid = Number($('#swMemberId').value);
      const amt = Number($('#swAmount').value);
      const nid = $('#swNin').value.trim();
      if (!mid) return toast('Select a member', 'error');
      if (!nid) return toast('National ID required', 'error');
      try {
        const json = await Store.request('savings.withdraw', {
          memberId: mid, amount: amt, nin: nid, desc: $('#swDesc').value || 'Withdrawal',
        });
        e.target.reset();
        $('#swMemberId').value = '';
        hidePanels();
        this.showTransactionReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btnAddDeposit')?.addEventListener('click', () => {
      showPanel('depFormPanel');
      $('#dfStart').value = today();
    });

    $('#depForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('openFixedDeposit')) return toast('Access denied', 'error');
      const mid = Number($('#dfMemberId').value);
      if (!mid) return toast('Select a member', 'error');
      try {
        const json = await Store.request('deposit.create', {
          memberId: mid,
          amount: Number($('#dfAmount').value),
          rate: Number($('#dfRate').value),
          tenor: Number($('#dfTenor').value),
          startDate: $('#dfStart').value,
          interestMode: document.querySelector('input[name="dfInterest"]:checked')?.value || 'quarterly',
        });
        e.target.reset();
        hidePanels();
        this.showTransactionReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btnApplyLoan')?.addEventListener('click', () => this.openLoanApply());

    $('#lfProduct')?.addEventListener('change', () => this.updateLoanRate());

    $('#loanForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('applyLoan')) return toast('Access denied', 'error');
      const mid = Number($('#lfMemberId').value);
      if (!mid) return toast('Select a member', 'error');
      try {
        await Store.request('loan.create', {
          memberId: mid,
          productId: Number($('#lfProduct').value),
          amount: Number($('#lfAmount').value),
          rate: Number($('#lfRate').value),
          months: Number($('#lfMonths').value),
        });
        e.target.reset();
        hidePanels();
        toast(Access.perm('approveLoan') ? 'Loan approved — ready for cashier disbursement!' : 'Loan application submitted for chairman approval!');
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $$('#loanFilters .filter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.loanFilter = tab.dataset.filter;
        $$('#loanFilters .filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
        Pages.loans(this.loanFilter);
      });
    });

    $$('#loanAppFilters .filter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.loanAppFilter = tab.dataset.filter;
        $$('#loanAppFilters .filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
        Pages.loanApplications(this.loanAppFilter);
      });
    });

    $('#btnApplyLoanApp')?.addEventListener('click', () => this.openLoanApply());

    $('#btnCancelLoanPay')?.addEventListener('click', () => hidePanels());
    $('#loanPayForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('recordLoanPayment')) return toast('Access denied', 'error');
      const loanId = Number($('#lpLoanId').value);
      const amt = Number($('#lpAmount').value);
      try {
        const json = await Store.request('loan.pay', { loanId, amount: amt, notes: $('#lpNotes').value.trim() });
        e.target.reset();
        hidePanels();
        this.showTransactionReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btnCancelDepTx')?.addEventListener('click', () => hidePanels());
    $('#depTxForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('openFixedDeposit')) return toast('Access denied', 'error');
      try {
        const json = await Store.request('deposit.transaction', {
          depositId: Number($('#dtxDepositId').value),
          type: $('#dtxType').value,
          amount: Number($('#dtxAmount').value),
          desc: $('#dtxDesc').value.trim(),
        });
        e.target.reset();
        hidePanels();
        this.showTransactionReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#loanPayoutForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('disburseLoan')) return toast('Access denied', 'error');
      const id = Number($('#lpoLoanId').value);
      const clientConfirmedName = $('#lpoClientName').value.trim();
      if (!$('#lpoConfirm').checked) return toast('Please confirm cash was received by the member', 'error');
      try {
        const json = await Store.request('loan.disburse', { id, clientConfirmedName });
        toast('Loan paid — receipt generated');
        this.showLoanReceipt(json.receipt);
        this.refreshAll();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btnAddUser')?.addEventListener('click', () => {
      $('#userForm').reset();
      $('#ufId').value = '';
      $('#ufActive').checked = true;
      $('#ufPassword').required = true;
      $('#userFormTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add Staff Account';
      showPanel('userFormPanel');
    });
    $('#btnCancelUser')?.addEventListener('click', () => hidePanels());

    $('#userForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('manageUsers')) return toast('Access denied', 'error');
      const id = $('#ufId').value;
      try {
        await Store.request('staff.save', {
          id: id ? Number(id) : 0,
          username: $('#ufUsername').value.trim(),
          name: $('#ufName').value.trim(),
          password: $('#ufPassword').value,
          role: $('#ufRole').value,
          active: $('#ufActive').checked,
        });
        e.target.reset();
        hidePanels();
        toast(id ? 'Staff account updated' : 'Staff account created');
        Pages.users();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    this.initMemberSearch('sdSearch', 'sdMemberId', 'sdSuggestions');
    this.initMemberSearch('swSearch', 'swMemberId', 'swSuggestions');
    this.initMemberSearch('dfSearch', 'dfMemberId', 'dfSuggestions');
    this.initMemberSearch('lfSearch', 'lfMemberId', 'lfSuggestions');
    this.initListSearches();
    this.initDashboardSearches();
    this.initReportFilters();
  },

  initReportFilters() {
    $('#reportType')?.addEventListener('change', () => this.updateReportFilterUI());
    $('#reportFilters')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Access.perm('viewReports')) return toast('Access denied', 'error');
      await this.generateReport(true);
    });
    $('#btnClearReportFilters')?.addEventListener('click', () => this.clearReportFilters());
    $('#btnPrintReport')?.addEventListener('click', () => this.printReport());

    initTypeahead({
      input: $('#reportMemberSearch'),
      box: $('#reportMemberSuggestions'),
      hidden: $('#reportMemberId'),
      getItems: () => Store.get().members,
      renderItem: (m) => this.memberSuggestLabel(m, Store.get()),
    });

    this.updateReportFilterUI();
  },

  clearReportFilters() {
    $('#reportType').value = 'summary';
    $('#reportFrom').value = '';
    $('#reportTo').value = '';
    $('#reportStatus').value = '';
    $('#reportTxType').value = '';
    $('#reportProduct').value = '';
    $('#reportMemberSearch').value = '';
    $('#reportMemberId').value = '';
    this.lastReportGenerated = false;
    $('#reportEmpty')?.classList.remove('hidden');
    $('#reportContent')?.classList.add('hidden');
    $('#btnPrintReport')?.classList.add('hidden');
    $('#reportSignatures')?.classList.add('hidden');
    $('#reportOutputTitle').innerHTML = '<i class="fas fa-file-lines"></i> Report';
    $('#reportMeta').textContent = '';
    this.updateReportFilterUI();
    toast('Filters cleared');
  },

  updateReportFilterUI() {
    const type = $('#reportType')?.value || 'summary';
    const statusWrap = $('#reportStatusWrap');
    const txWrap = $('#reportTxTypeWrap');
    const productWrap = $('#reportProductWrap');

    const statusOpts = REPORT_STATUS_OPTIONS[type];
    statusWrap?.classList.toggle('hidden', !statusOpts);
    txWrap?.classList.toggle('hidden', type !== 'savings_tx');
    productWrap?.classList.toggle('hidden', type !== 'loans');

    if (statusOpts && $('#reportStatus')) {
      $('#reportStatus').innerHTML = statusOpts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    }

    if (type === 'loans') {
      const data = Store.get();
      $('#reportProduct').innerHTML =
        '<option value="">All products</option>' +
        data.loanProducts.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    }
  },

  getReportFilters() {
    const data = Store.get();
    const memberId = Number($('#reportMemberId')?.value || 0) || null;
    const productId = Number($('#reportProduct')?.value || 0) || null;
    const m = memberId ? Store.getMember(data, memberId) : null;
    return {
      type: $('#reportType')?.value || 'summary',
      from: $('#reportFrom')?.value || '',
      to: $('#reportTo')?.value || '',
      status: $('#reportStatus')?.value || '',
      txType: $('#reportTxType')?.value || '',
      productId,
      productName: productId ? productName(data, productId) : '',
      memberId,
      memberName: m?.fullName || '',
    };
  },

  generateReport(showToast = true) {
    return this._generateReport(showToast);
  },

  async _generateReport(showToast = true) {
    if (!Access.perm('viewReports')) return toast('Access denied', 'error');

    try {
      await Store.load();
    } catch (e) {
      return toast(e.message || 'Could not load data from database', 'error');
    }

    const data = Store.get();
    const members = data.members || [];
    const applications = data.applications || [];
    const savings = data.savings || [];
    const savingsTx = data.savingsTx || [];
    const deposits = data.deposits || [];
    const loans = data.loans || [];
    const loanPayments = data.loanPayments || [];
    const f = this.getReportFilters();
    const settings = data.settings || {};
    const label = REPORT_LABELS[f.type] || 'Report';
    const generatedAt = new Date().toLocaleString('en-UG');
    const filterText = reportFilterDesc(f);

    let summaryHtml = '';
    let tableHtml = '';
    let rowCount = 0;
    let totalAmount = 0;

    const memberMatch = (memberId) => !f.memberId || memberId === f.memberId;

    if (f.type === 'summary') {
      const activeMembers = members.filter((m) => m.status === 'active').length;
      const pendingApps = applications.filter((a) => a.status === 'pending').length;
      const totalSavings = savings.reduce((s, a) => s + a.balance, 0);
      const totalDeposits = deposits.filter((d) => d.status === 'active').reduce((s, d) => s + d.amount, 0);
      const totalLoans = loans.filter((l) => l.balance > 0).reduce((s, l) => s + l.balance, 0);
      const txInRange = savingsTx.filter(
        (t) => reportInDateRange(t.date, f.from, f.to) && memberMatch(t.memberId)
      );
      const depositsInRange = txInRange.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
      const withdrawalsInRange = txInRange.filter((t) => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);

      summaryHtml = `
        <div class="stat"><div class="stat-val">${activeMembers}</div><div class="stat-lbl">Active Members</div></div>
        <div class="stat"><div class="stat-val">${pendingApps}</div><div class="stat-lbl">Pending Applications</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalSavings)}</div><div class="stat-lbl">Total Savings</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalDeposits)}</div><div class="stat-lbl">Active Fixed Deposits</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalLoans)}</div><div class="stat-lbl">Outstanding Loans</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(depositsInRange)}</div><div class="stat-lbl">Deposits in Period</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(withdrawalsInRange)}</div><div class="stat-lbl">Withdrawals in Period</div></div>
        <div class="stat"><div class="stat-val">${txInRange.length}</div><div class="stat-lbl">Transactions in Period</div></div>`;

      this.renderReportCharts(data, f);
      $('#reportCharts')?.classList.remove('hidden');
    } else {
      $('#reportCharts')?.classList.add('hidden');
    }

    if (f.type === 'members') {
      const rows = members.filter(
        (m) =>
          memberMatch(m.id) &&
          (!f.status || m.status === f.status) &&
          reportInDateRange(m.joined, f.from, f.to)
      );
      rowCount = rows.length;
      tableHtml = `<table><thead><tr><th>Membership No</th><th>Name</th><th>NIN</th><th>Phone</th><th>Share Capital</th><th>Status</th><th>Joined</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map(
                (m) => `<tr>
            <td>${m.membershipNo}</td><td>${escapeHtml(m.fullName)}</td><td>${m.nin}</td><td>${m.phone || '—'}</td>
            <td>${formatMoney(m.shareCapital)}</td><td>${badge(m.status)}</td><td>${formatDate(m.joined)}</td>
          </tr>`
              )
              .join('')
          : `<tr><td colspan="7" class="empty">${this.reportEmptyMessage('members', members.length, f)}</td></tr>`
      }</tbody></table>`;
    }

    if (f.type === 'applications') {
      let rows = applications.filter(
        (a) =>
          (!f.status || a.status === f.status) &&
          reportInDateRange(a.applied, f.from, f.to)
      );
      if (f.memberId) {
        const m = Store.getMember(data, f.memberId);
        rows = rows.filter((a) => a.nin === m?.nin || a.fullName === m?.fullName);
      }
      rowCount = rows.length;
      tableHtml = this.reportApplicationsTable(rows, applications.length, f);
    }

    if (f.type === 'savings') {
      const rows = savings.filter(
        (s) => memberMatch(s.memberId) && (!f.status || s.status === f.status)
      );
      rowCount = rows.length;
      totalAmount = rows.reduce((s, r) => s + r.balance, 0);
      tableHtml = `<table><thead><tr><th>Member</th><th>Account</th><th>Balance</th><th>Status</th><th>Opened</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map((s) => {
                const m = Store.getMember(data, s.memberId);
                return `<tr>
              <td>${escapeHtml(m?.fullName || '—')}</td><td>${s.accountNo}</td><td>${formatMoney(s.balance)}</td>
              <td>${badge(s.status)}</td><td>${formatDate(s.opened)}</td>
            </tr>`;
              })
              .join('')
          : `<tr><td colspan="5" class="empty">${this.reportEmptyMessage('savings', savings.length, f)}</td></tr>`
      }</tbody></table>`;
      summaryHtml = `<div class="stat"><div class="stat-val">${rowCount}</div><div class="stat-lbl">Accounts</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalAmount)}</div><div class="stat-lbl">Total Balance</div></div>`;
    }

    if (f.type === 'savings_tx') {
      const rows = savingsTx.filter(
        (t) =>
          memberMatch(t.memberId) &&
          (!f.txType || t.type === f.txType) &&
          reportInDateRange(t.date, f.from, f.to)
      );
      rowCount = rows.length;
      totalAmount = rows.reduce((s, t) => s + (t.type === 'withdraw' ? -t.amount : t.amount), 0);
      const deposits = rows.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
      const withdrawals = rows.filter((t) => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
      tableHtml = `<table><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Description</th><th>Receipt</th><th>By</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map(
                (t) => `<tr>
            <td>${formatDate(t.date)}</td><td>${escapeHtml(memberName(data, t.memberId))}</td>
            <td><span class="tx-type tx-${t.type}">${t.type}</span></td><td>${formatMoney(t.amount)}</td>
            <td>${escapeHtml(t.desc || '—')}</td><td>${t.receiptNo || '—'}</td><td>${escapeHtml(t.processedBy || '—')}</td>
          </tr>`
              )
              .join('')
          : `<tr><td colspan="7" class="empty">${this.reportEmptyMessage('savings_tx', savingsTx.length, f)}</td></tr>`
      }</tbody></table>`;
      summaryHtml = `<div class="stat"><div class="stat-val">${rowCount}</div><div class="stat-lbl">Transactions</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(deposits)}</div><div class="stat-lbl">Deposits</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(withdrawals)}</div><div class="stat-lbl">Withdrawals</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(deposits - withdrawals)}</div><div class="stat-lbl">Net Movement</div></div>`;
    }

    if (f.type === 'deposits') {
      const rows = deposits.filter(
        (d) =>
          memberMatch(d.memberId) &&
          (!f.status || d.status === f.status) &&
          reportInDateRange(d.startDate, f.from, f.to)
      );
      rowCount = rows.length;
      totalAmount = rows.reduce((s, d) => s + d.amount, 0);
      tableHtml = `<table><thead><tr><th>Account</th><th>Member</th><th>Amount</th><th>Rate</th><th>Tenor</th><th>Start</th><th>Maturity</th><th>Status</th><th>Opened By</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map((d) => {
                const m = Store.getMember(data, d.memberId);
                return `<tr>
              <td>${d.accountNo}</td><td>${escapeHtml(m?.fullName || '—')}</td><td>${formatMoney(d.amount)}</td>
              <td>${d.rate}%</td><td>${d.tenor} mo</td><td>${formatDate(d.startDate)}</td><td>${formatDate(d.maturityDate)}</td>
              <td>${badge(d.status)}</td><td>${escapeHtml(d.createdBy || '—')}</td>
            </tr>`;
              })
              .join('')
          : `<tr><td colspan="9" class="empty">${this.reportEmptyMessage('deposits', deposits.length, f)}</td></tr>`
      }</tbody></table>`;
      summaryHtml = `<div class="stat"><div class="stat-val">${rowCount}</div><div class="stat-lbl">Deposits</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalAmount)}</div><div class="stat-lbl">Total Amount</div></div>`;
    }

    if (f.type === 'loans') {
      const rows = loans.filter(
        (l) =>
          memberMatch(l.memberId) &&
          (!f.status || l.status === f.status) &&
          (!f.productId || l.productId === f.productId) &&
          reportInDateRange(l.applied, f.from, f.to)
      );
      rowCount = rows.length;
      totalAmount = rows.reduce((s, l) => s + l.balance, 0);
      const principal = rows.reduce((s, l) => s + l.amount, 0);
      tableHtml = `<table><thead><tr><th>Loan ID</th><th>Member</th><th>Product</th><th>Principal</th><th>Balance</th><th>Rate</th><th>Months</th><th>Status</th><th>Applied</th><th>Processed By</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map((l) => {
                const m = Store.getMember(data, l.memberId);
                return `<tr>
              <td>${l.loanId}</td><td>${escapeHtml(m?.fullName || '—')}</td><td>${productName(data, l.productId)}</td>
              <td>${formatMoney(l.amount)}</td><td>${formatMoney(l.balance)}</td><td>${l.rate}%</td><td>${l.months}</td>
              <td>${badge(l.status)}</td><td>${formatDate(l.applied)}</td><td>${escapeHtml(l.createdBy || '—')}</td>
            </tr>`;
              })
              .join('')
          : `<tr><td colspan="10" class="empty">${this.reportEmptyMessage('loans', loans.length, f)}</td></tr>`
      }</tbody></table>`;
      summaryHtml = `<div class="stat"><div class="stat-val">${rowCount}</div><div class="stat-lbl">Loans</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(principal)}</div><div class="stat-lbl">Total Principal</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalAmount)}</div><div class="stat-lbl">Outstanding</div></div>`;
    }

    if (f.type === 'loan_payments') {
      const rows = loanPayments.filter(
        (p) => memberMatch(p.memberId) && reportInDateRange(p.date, f.from, f.to)
      );
      rowCount = rows.length;
      totalAmount = rows.reduce((s, p) => s + p.amount, 0);
      tableHtml = `<table><thead><tr><th>Date</th><th>Member</th><th>Loan</th><th>Amount</th><th>Notes</th><th>Processed By</th></tr></thead><tbody>${
        rows.length
          ? rows
              .map((p) => {
                const loan = loans.find((l) => l.id === p.loanId);
                return `<tr>
              <td>${formatDate(p.date)}</td><td>${escapeHtml(memberName(data, p.memberId))}</td>
              <td>${loan?.loanId || '—'}</td><td>${formatMoney(p.amount)}</td>
              <td>${escapeHtml(p.notes || '—')}</td><td>${escapeHtml(p.processedBy || '—')}</td>
            </tr>`;
              })
              .join('')
          : `<tr><td colspan="6" class="empty">${this.reportEmptyMessage('loan_payments', loanPayments.length, f)}</td></tr>`
      }</tbody></table>`;
      summaryHtml = `<div class="stat"><div class="stat-val">${rowCount}</div><div class="stat-lbl">Payments</div></div>
        <div class="stat"><div class="stat-val">${formatMoney(totalAmount)}</div><div class="stat-lbl">Total Collected</div></div>`;
    }

    $('#reportEmpty')?.classList.add('hidden');
    $('#reportContent')?.classList.remove('hidden');
    $('#btnPrintReport')?.classList.remove('hidden');
    $('#reportOutputTitle').innerHTML = `<i class="fas fa-file-lines"></i> ${label}`;
    $('#reportMeta').textContent =
      f.type === 'summary' ? `Overview · ${filterText}` : `${rowCount} record(s) · ${filterText}`;

    const saccoName = saccoDisplayName(settings);
    $('#reportPrintSacco').textContent = saccoName;
    $('#reportPrintMotto').textContent = settings.motto || '';
    $('#reportPrintTitle').textContent = label;
    $('#reportPrintMeta').textContent = `Generated ${generatedAt} · ${filterText}`;

    const summaryEl = $('#reportSummary');
    if (summaryHtml) {
      summaryEl.innerHTML = summaryHtml;
      summaryEl.classList.remove('hidden');
    } else {
      summaryEl.innerHTML = '';
      summaryEl.classList.add('hidden');
    }

    let summaryTableHtml = '';
    if (f.type === 'summary') {
      const txInRange = savingsTx.filter(
        (t) => reportInDateRange(t.date, f.from, f.to) && memberMatch(t.memberId)
      );
      const staffActivity = {};
      txInRange.forEach((t) => {
        const who = t.processedBy || '—';
        if (!staffActivity[who]) staffActivity[who] = { savings: 0, payments: 0 };
        staffActivity[who].savings += 1;
      });
      loanPayments
        .filter((p) => reportInDateRange(p.date, f.from, f.to) && memberMatch(p.memberId))
        .forEach((p) => {
          const who = p.processedBy || '—';
          if (!staffActivity[who]) staffActivity[who] = { savings: 0, payments: 0 };
          staffActivity[who].payments += 1;
        });
      const staffRows = Object.entries(staffActivity).sort((a, b) => {
        const totalA = a[1].savings + a[1].payments;
        const totalB = b[1].savings + b[1].payments;
        return totalB - totalA;
      });
      summaryTableHtml = staffRows.length
        ? `<h4 class="report-table-title">Staff Activity in Period</h4>
          <table><thead><tr><th>Staff Name</th><th>Savings Transactions</th><th>Loan Repayments</th><th>Total</th></tr></thead><tbody>${staffRows
            .map(
              ([name, counts]) => `<tr>
            <td>${escapeHtml(name)}</td><td>${counts.savings}</td><td>${counts.payments}</td>
            <td>${counts.savings + counts.payments}</td>
          </tr>`
            )
            .join('')}</tbody></table>`
        : '';
    }

    $('#reportTableWrap').innerHTML =
      f.type === 'summary'
        ? `<p class="muted report-table-title">Summary report — use other report types for detailed listings.</p>${summaryTableHtml}`
        : tableHtml;

    $('#reportFooter').textContent = `${saccoName} · ${label} · ${
      f.type === 'summary' ? 'Overview' : rowCount + ' record(s)'
    } · ${generatedAt}`;

    this.renderReportSignatures(generatedAt);

    this.lastReportGenerated = true;
    if (showToast) {
      const hasFilters = !!(f.from || f.to || f.status || f.txType || f.productId || f.memberId);
      if (f.type !== 'summary' && rowCount === 0 && hasFilters) {
        toast('No records match filters — try Clear Filters or widen the date range', 'error');
      } else if (f.type === 'summary') {
        toast(`Summary loaded — ${members.length} member(s) in database`);
      } else {
        toast(`Report loaded — ${rowCount} record(s). Use Print Report when ready.`);
      }
    }
  },

  reportEmptyMessage(type, systemCount, filters) {
    const hasFilters = !!(filters.from || filters.to || filters.status || filters.txType || filters.productId || filters.memberId);
    if (systemCount > 0 && hasFilters) {
      return 'No records match your filters — try Clear Filters or leave dates empty for all records';
    }
    if (systemCount > 0) {
      return 'No records match the selected criteria';
    }
    return 'No records in the database for this report yet';
  },

  renderReportSignatures(generatedAt) {
    const s = Auth.session;
    const name = s?.name || s?.username || 'Staff';
    const role = Access.label(s?.role || '');
    const when = generatedAt || new Date().toLocaleString('en-UG');
    const byEl = $('#reportGeneratedBy');
    const atEl = $('#reportGeneratedAt');
    if (byEl) byEl.textContent = `${name} (${role})`;
    if (atEl) atEl.textContent = when;
    $('#reportSignatures')?.classList.remove('hidden');
  },

  printReport() {
    if (!this.lastReportGenerated) return toast('Apply filters to load a report first', 'error');
    const charts = $('#reportCharts');
    const chartsWereVisible = charts && !charts.classList.contains('hidden');
    if (chartsWereVisible) charts.classList.add('hidden');

    document.body.classList.add('print-report');
    const cleanup = () => {
      document.body.classList.remove('print-report');
      if (chartsWereVisible) charts.classList.remove('hidden');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1000);
  },

  reportApplicationsTable(rows, systemCount = 0, filters = {}) {
    const emptyMsg = this.reportEmptyMessage('applications', systemCount, filters);
    return `<table><thead><tr><th>App No</th><th>Name</th><th>NIN</th><th>Phone</th><th>Applied</th><th>Status</th><th>Membership No</th><th>Reviewed By</th></tr></thead><tbody>${
      rows.length
        ? rows
            .map(
              (a) => `<tr>
          <td>${a.applicationNo}</td><td>${escapeHtml(a.fullName)}</td><td>${a.nin}</td><td>${a.phone}</td>
          <td>${formatDate(a.applied)}</td><td>${badge(a.status)}</td><td>${a.membershipNo || '—'}</td>
          <td>${escapeHtml(a.reviewedBy || '—')}</td>
        </tr>`
            )
            .join('')
        : `<tr><td colspan="8" class="empty">${emptyMsg}</td></tr>`
    }</tbody></table>`;
  },

  renderReportCharts(data, filters) {
    if (typeof Chart === 'undefined') return;

    const months = {};
    data.savingsTx
      .filter((t) => reportInDateRange(t.date, filters.from, filters.to))
      .forEach((t) => {
        const m = t.date.slice(0, 7);
        months[m] = (months[m] || 0) + (t.type === 'deposit' ? t.amount : -t.amount);
      });
    const monthLabels = Object.keys(months).sort();
    const monthValues = monthLabels.map((k) => months[k]);

    const productTotals = {};
    data.loans.forEach((l) => {
      const name = productName(data, l.productId);
      productTotals[name] = (productTotals[name] || 0) + l.amount;
    });

    const c1 = $('#reportSavingsChart');
    if (c1) {
      if (this.charts.reportSavings) this.charts.reportSavings.destroy();
      this.charts.reportSavings = new Chart(c1, {
        type: 'bar',
        data: {
          labels: monthLabels.length ? monthLabels : ['No data'],
          datasets: [{ label: 'Net Savings', data: monthValues.length ? monthValues : [0], backgroundColor: '#0d6e4f', borderRadius: 6 }],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });
    }

    const c2 = $('#reportLoansChart');
    if (c2) {
      if (this.charts.reportLoans) this.charts.reportLoans.destroy();
      this.charts.reportLoans = new Chart(c2, {
        type: 'doughnut',
        data: {
          labels: Object.keys(productTotals).length ? Object.keys(productTotals) : ['No data'],
          datasets: [{ data: Object.values(productTotals).length ? Object.values(productTotals) : [1], backgroundColor: ['#0d6e4f', '#c9a227', '#1a9d6c', '#e8c547', '#64748b'] }],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    }
  },

  loanSearchItems() {
    const data = Store.get();
    return data.loans.map((l) => {
      const m = Store.getMember(data, l.memberId);
      return {
        id: l.id,
        loanId: l.loanId,
        fullName: m?.fullName || 'Unknown',
        membershipNo: m?.membershipNo || '',
        balance: l.balance,
        amount: l.amount,
        status: l.status,
        phone: m?.phone || '',
        nin: m?.nin || '',
      };
    });
  },

  loanSearchBlob(item) {
    return [item.loanId, item.fullName, item.membershipNo, item.phone, item.nin].filter(Boolean).join(' ').toLowerCase();
  },

  filterLoans(loans, q, limit = 30) {
    const query = (q || '').trim().toLowerCase();
    if (query.length < 2) return [];
    return loans.filter((l) => this.loanSearchBlob(l).includes(query)).slice(0, limit);
  },

  initDashboardSearches() {
    const data = () => Store.get();

    initTypeahead({
      input: $('#chDashMemberSearch'),
      box: $('#chDashMemberSuggestions'),
      getItems: () => data().members,
      renderItem: (m) => this.memberSuggestLabel(m, data()),
      onSelect: (m) => {
        App.dashboardMemberId = m.id;
        $('#chDashMemberSearch').value = m.fullName;
        App.renderChairmanDashDetail(m.id);
      },
    });

    initTypeahead({
      input: $('#caDashMemberSearch'),
      box: $('#caDashMemberSuggestions'),
      getItems: () => this.memberCache,
      renderItem: (m) => this.memberSuggestLabel(m, data()),
      onSelect: (m) => {
        App.dashboardMemberId = m.id;
        $('#caDashMemberSearch').value = m.fullName;
        App.renderCashierDashDetail(m.id);
      },
    });

    const loInput = $('#loDashLoanSearch');
    const loBox = $('#loDashLoanSuggestions');
    if (loInput && loBox) {
      let matches = [];
      let activeIdx = -1;

      const closeBox = () => {
        loBox.innerHTML = '';
        loBox.style.display = 'none';
        activeIdx = -1;
      };

      const pick = (idx) => {
        const item = matches[idx];
        if (!item) return;
        loInput.value = `${item.loanId} — ${item.fullName}`;
        closeBox();
        App.dashboardLoanId = item.id;
        App.renderLoanDashDetail(item.id);
      };

      const renderDropdown = (q) => {
        matches = this.filterLoans(this.loanSearchItems(), q);
        activeIdx = -1;
        if (!matches.length) {
          const query = loInput.value.trim();
          if (query.length < 2) {
            loBox.innerHTML = '';
            loBox.style.display = 'none';
            return;
          }
          loBox.innerHTML = '<div class="suggest-item muted">No loans found</div>';
          loBox.style.display = 'block';
          return;
        }
        loBox.innerHTML = matches
          .map(
            (l, i) =>
              `<div class="suggest-item" data-idx="${i}"><strong>${l.loanId}</strong> — ${escapeHtml(l.fullName)}<small>${formatMoney(l.balance)} outstanding · ${badge(l.status)}</small></div>`
          )
          .join('');
        loBox.querySelectorAll('.suggest-item:not(.muted)').forEach((el) => {
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pick(Number(el.dataset.idx));
          });
        });
        loBox.style.display = 'block';
      };

      loInput.addEventListener('input', () => {
        App.dashboardLoanId = null;
        App.renderLoanDashDetail(null);
        renderDropdown(loInput.value);
      });
      loInput.addEventListener('focus', () => {
        if (loInput.value.trim().length >= 2) renderDropdown(loInput.value);
      });
      loInput.addEventListener('blur', () => setTimeout(closeBox, 150));
      loBox.addEventListener('mousedown', (e) => e.preventDefault());
    }
  },

  renderChairmanDashDetail(memberId) {
    const el = $('#chDashDetailBody');
    if (!el) return;
    if (!memberId) {
      el.className = 'dash-detail-body dash-detail-empty';
      el.innerHTML = '<p class="muted"><i class="fas fa-circle-info"></i> Select a member to view savings, deposits, and loans.</p>';
      return;
    }

    const data = Store.get();
    const m = Store.getMember(data, memberId);
    if (!m) return;
    const sav = Store.getSavings(data, memberId);
    const deps = data.deposits.filter((d) => d.memberId === memberId);
    const loans = data.loans.filter((l) => l.memberId === memberId);

    el.className = 'dash-detail-body dash-detail-panel';
    el.innerHTML = `
      <div class="detail-grid">
        <div><label>Member</label><p><strong>${escapeHtml(m.fullName)}</strong> (${m.membershipNo})</p></div>
        <div><label>Status</label><p>${badge(m.status)}</p></div>
      </div>
      <h4>Savings</h4>
      ${sav ? `<p>Account <strong>${sav.accountNo}</strong> — ${formatMoney(sav.balance)}</p>` : '<p class="muted">No account</p>'}
      <h4>Fixed Deposits (${deps.length})</h4>
      ${deps.length ? deps.map((d) => `<p>${d.accountNo} — ${formatMoney(d.amount)} ${badge(d.status)}</p>`).join('') : '<p class="muted">None</p>'}
      <h4>Loans (${loans.length})</h4>
      ${loans.length ? loans.map((l) => `<p>${l.loanId} — ${formatMoney(l.amount)} (Bal: ${formatMoney(l.balance)}) ${badge(l.status)}</p>`).join('') : '<p class="muted">None</p>'}
      <button class="btn btn-sm btn-outline" style="margin-top:0.75rem;" onclick="App.viewMember(${m.id})">Full Profile</button>
    `;
  },

  renderCashierDashDetail(memberId) {
    const el = $('#caDashDetailBody');
    if (!el) return;
    if (!memberId) {
      el.className = 'dash-detail-body dash-detail-empty';
      el.innerHTML = '<p class="muted"><i class="fas fa-circle-info"></i> Select a member to view their savings balance and recent transactions.</p>';
      return;
    }

    const data = Store.get();
    const m = Store.getMember(data, memberId);
    if (!m) return;
    const sav = Store.getSavings(data, memberId);
    const txs = data.savingsTx
      .filter((t) => t.memberId === memberId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    el.className = 'dash-detail-body dash-detail-panel';
    el.innerHTML = `
      <div class="detail-grid">
        <div><label>Member</label><p><strong>${escapeHtml(m.fullName)}</strong> (${m.membershipNo})</p></div>
        <div><label>Phone</label><p>${m.phone || '—'}</p></div>
      </div>
      <h4>Savings Account</h4>
      ${sav ? `<p>Account <strong>${sav.accountNo}</strong> — Balance: <strong>${formatMoney(sav.balance)}</strong></p>` : '<p class="muted">No account</p>'}
      <h4>Recent Transactions (${txs.length})</h4>
      ${
        txs.length
          ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th></tr></thead><tbody>${txs
              .map(
                (t) => `<tr>
              <td>${formatDate(t.date)}</td>
              <td><span class="tx-type tx-${t.type}">${t.type}</span></td>
              <td>${formatMoney(t.amount)}</td>
            </tr>`
              )
              .join('')}</tbody></table></div>`
          : '<p class="muted">No transactions for this member</p>'
      }
    `;
  },

  renderLoanDashDetail(loanId) {
    const el = $('#loDashDetailBody');
    if (!el) return;
    if (!loanId) {
      el.className = 'dash-detail-body dash-detail-empty';
      el.innerHTML = '<p class="muted"><i class="fas fa-circle-info"></i> Select a loan to view balance and repayment history.</p>';
      return;
    }

    const data = Store.get();
    const l = Store.getLoan(data, loanId);
    if (!l) return;
    const m = Store.getMember(data, l.memberId);
    const payments = (data.loanPayments || [])
      .filter((p) => p.loanId === l.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const paidAmt = l.status === 'active' || l.status === 'completed' ? l.amount - l.balance : 0;

    el.className = 'dash-detail-body dash-detail-panel';
    el.innerHTML = `
      <div class="detail-grid">
        <div><label>Loan ID</label><p>${l.loanId}</p></div>
        <div><label>Member</label><p>${escapeHtml(m?.fullName || '—')}</p></div>
        <div><label>Original Amount</label><p>${formatMoney(l.amount)}</p></div>
        <div><label>Outstanding</label><p>${l.status === 'active' ? formatMoney(l.balance) : '—'}</p></div>
        <div><label>Total Paid</label><p>${paidAmt > 0 ? formatMoney(paidAmt) : '—'}</p></div>
        <div><label>Status</label><p>${badge(loanDisplayStatus(l))}</p></div>
      </div>
      <h4>Repayment History (${payments.length})</h4>
      ${
        payments.length
          ? payments
              .map((p) => `<p>${formatDate(p.date)} — ${formatMoney(p.amount)} <small class="muted">${escapeHtml(p.processedBy || '')}</small></p>`)
              .join('')
          : '<p class="muted">No payments recorded yet</p>'
      }
      ${l.status === 'active' && l.balance > 0 ? `<button class="btn btn-sm btn-primary" style="margin-top:0.75rem;" onclick="App.openLoanPayment(${l.id})">Record Payment</button>` : ''}
    `;
  },

  memberSuggestLabel(m, data) {
    const sav = data ? Store.getSavings(data, m.id) : null;
    const extra = sav ? ` · ${formatMoney(sav.balance)}` : '';
    return `<strong>${escapeHtml(m.fullName)}</strong><small>${m.membershipNo}${m.phone ? ` · ${m.phone}` : ''}${extra}</small>`;
  },

  savingsSearchItems() {
    const data = Store.get();
    return data.savings.map((s) => {
      const m = Store.getMember(data, s.memberId);
      return {
        id: s.id,
        memberId: s.memberId,
        accountNo: s.accountNo,
        balance: s.balance,
        fullName: m?.fullName || 'Unknown',
        membershipNo: m?.membershipNo || '',
        phone: m?.phone || '',
        nin: m?.nin || '',
      };
    });
  },

  initListSearches() {
    const data = () => Store.get();

    initTypeahead({
      input: $('#memberListSearch'),
      box: $('#memberListSuggestions'),
      getItems: () => data().members,
      renderItem: (m) => this.memberSuggestLabel(m, data()),
      onSelect: (m) => {
        App.memberListQuery = m.fullName;
        $('#memberListSearch').value = m.fullName;
        Pages.members();
        App.viewMember(m.id);
      },
    });

    $('#memberListSearch')?.addEventListener('input', (e) => {
      App.memberListQuery = e.target.value;
      Pages.members();
    });

    initTypeahead({
      input: $('#savingsListSearch'),
      box: $('#savingsListSuggestions'),
      getItems: () => this.savingsSearchItems(),
      renderItem: (s) =>
        `<strong>${escapeHtml(s.fullName)}</strong><small>${s.accountNo} · ${formatMoney(s.balance)}</small>`,
      onSelect: (s) => {
        App.savingsListQuery = s.fullName;
        $('#savingsListSearch').value = s.fullName;
        Pages.savings();
      },
    });

    $('#savingsListSearch')?.addEventListener('input', (e) => {
      App.savingsListQuery = e.target.value;
      Pages.savings();
    });
  },

  updateLoanRate() {
    const opt = $('#lfProduct').selectedOptions[0];
    $('#lfRate').value = opt?.dataset.rate || '';
  },

  initMemberSearch(inputId, hiddenId, boxId) {
    const input = $(`#${inputId}`);
    const hidden = $(`#${hiddenId}`);
    const box = $(`#${boxId}`);
    if (!input) return;

    initTypeahead({
      input,
      box,
      hidden,
      getItems: () => this.memberCache,
      renderItem: (m) => this.memberSuggestLabel(m, Store.get()),
    });
  },

  viewApplication(id) {
    const data = Store.get();
    const a = Store.getApplication(data, id);
    if (!a) return;
    $('#applicationPrintBody').innerHTML = this.renderApplicationPrint(a);
    openModal('applicationPrintModal');
  },

  async approveLoan(id) {
    if (!Access.perm('approveLoan')) return toast('Access denied', 'error');
    const data = Store.get();
    const l = Store.getLoan(data, id);
    if (!l || l.status !== 'pending') return;
    const m = Store.getMember(data, l.memberId);
    if (!confirm(`Approve loan ${l.loanId} for ${m?.fullName || 'member'} (${formatMoney(l.amount)})?`)) return;
    try {
      await Store.request('loan.approve', { id });
      toast('Loan approved — sent to cashier for disbursement');
      this.refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  async rejectLoan(id) {
    if (!Access.perm('approveLoan')) return toast('Access denied', 'error');
    const data = Store.get();
    const l = Store.getLoan(data, id);
    if (!l || l.status !== 'pending') return;
    const m = Store.getMember(data, l.memberId);
    if (!confirm(`Reject loan ${l.loanId} for ${m?.fullName || 'member'}?`)) return;
    try {
      await Store.request('loan.reject', { id });
      toast('Loan application rejected');
      this.refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  async disburseLoan(id) {
    this.openLoanPayout(id);
  },

  openLoanPayout(id) {
    if (!Access.perm('disburseLoan')) return toast('Access denied', 'error');
    const data = Store.get();
    const l = Store.getLoan(data, id);
    if (!l || l.status !== 'approved') return toast('This loan is not ready for payout', 'error');
    const m = Store.getMember(data, l.memberId);
    $('#lpoLoanId').value = l.id;
    $('#lpoLoanLabel').value = `${l.loanId} — ${productName(data, l.productId)}`;
    $('#lpoAmount').value = formatMoney(l.amount);
    $('#lpoMember').value = m?.fullName || '';
    $('#lpoClientName').value = '';
    $('#lpoConfirm').checked = false;
    $('#loanPayoutConfirmPanel')?.classList.remove('hidden');
    $('#loanReceiptPrintPanel')?.classList.add('hidden');
    $('#loanReceiptActions')?.classList.add('hidden');
    $('#loanReceiptModalTitle').innerHTML = '<i class="fas fa-money-bill-transfer"></i> Pay Approved Loan';
    openModal('loanReceiptModal');
  },

  showLoanReceipt(receipt) {
    this.pendingLoanReceipt = receipt;
    $('#loanPayoutConfirmPanel')?.classList.add('hidden');
    $('#loanReceiptPrintPanel')?.classList.remove('hidden');
    $('#loanReceiptActions')?.classList.remove('hidden');
    $('#loanReceiptModalTitle').innerHTML = '<i class="fas fa-receipt"></i> Loan Disbursement Receipt';
    $('#loanReceiptBody').innerHTML = this.renderLoanReceiptHtml(receipt);
    openModal('loanReceiptModal');
  },

  viewLoanReceipt(id) {
    const data = Store.get();
    const l = Store.getLoan(data, id);
    if (!l || !l.disbursementReceiptNo) return toast('Receipt not available', 'error');
    const m = Store.getMember(data, l.memberId);
    this.showLoanReceipt({
      receiptNo: l.disbursementReceiptNo,
      loanId: l.loanId,
      member: m?.fullName || '—',
      membershipNo: m?.membershipNo || '—',
      nin: m?.nin || '—',
      phone: m?.phone || '—',
      product: productName(data, l.productId),
      amount: l.amount,
      rate: l.rate,
      months: l.months,
      date: l.disbursedDate || today(),
      generatedBy: l.disbursedBy || '—',
      approvedBy: l.approvedBy || '—',
      clientConfirmedName: l.clientConfirmedName || '—',
    });
  },

  renderLoanReceiptHtml(r) {
    const settings = Store.get().settings || {};
    const saccoName = saccoDisplayName(settings);
    const motto = settings.motto || 'Faith in God leads to success';
    return `
      <div class="report-watermark" aria-hidden="true">
        <img src="assets/logo/real%20logo.jpg" alt="" />
      </div>
      <div class="report-print-content print-form">
        <header class="print-form-header">
          <div class="print-form-logo"><img src="assets/logo/real%20logo.jpg" alt="${escapeHtml(saccoName)} logo" style="width:56px;height:56px;object-fit:cover;border-radius:8px;" /></div>
          <div>
            <h2>${escapeHtml(saccoName)}</h2>
            <p>Mbarara City Boda Boda Riders' SACCO</p>
            <p class="motto">${escapeHtml(motto)}</p>
          </div>
        </header>
        <h3 class="print-form-title">Loan Disbursement Receipt</h3>
        <p class="print-form-ref">Receipt No: <strong>${escapeHtml(r.receiptNo)}</strong> &nbsp;|&nbsp; Date: <strong>${formatDate(r.date)}</strong> &nbsp;|&nbsp; Loan ID: <strong>${escapeHtml(r.loanId)}</strong></p>
        <div class="detail-grid loan-receipt-grid">
          <div><label>Member Name</label><p>${escapeHtml(r.member)}</p></div>
          <div><label>Membership No</label><p>${escapeHtml(r.membershipNo)}</p></div>
          <div><label>National ID</label><p>${escapeHtml(r.nin)}</p></div>
          <div><label>Phone</label><p>${escapeHtml(r.phone || '—')}</p></div>
          <div><label>Loan Product</label><p>${escapeHtml(r.product)}</p></div>
          <div><label>Interest Rate</label><p>${r.rate}%</p></div>
          <div><label>Repayment Period</label><p>${r.months} months</p></div>
          <div><label>Amount Disbursed</label><p><strong>${formatMoney(r.amount)}</strong></p></div>
          <div><label>Approved By</label><p>${escapeHtml(r.approvedBy || '—')}</p></div>
        </div>
        <p class="loan-receipt-declaration">I confirm that I have received the loan amount stated above in cash from ${escapeHtml(saccoName)}.</p>
        <div class="report-signatures">
          <div class="report-sign-box">
            <span class="report-sign-label">Generated By (Cashier)</span>
            <p class="report-sign-name">${escapeHtml(r.generatedBy)}</p>
            <div class="report-sign-line"></div>
            <small class="muted">Official staff signature</small>
          </div>
          <div class="report-sign-box">
            <span class="report-sign-label">Client Confirmation</span>
            <p class="report-sign-name">${escapeHtml(r.clientConfirmedName)}</p>
            <div class="report-sign-line"></div>
            <small class="muted">Member signature / confirmation</small>
          </div>
        </div>
      </div>`;
  },

  async approveApplication(id) {
    if (!Access.perm('approveApplication')) return toast('Access denied', 'error');
    const data = Store.get();
    const a = Store.getApplication(data, id);
    if (!a || a.status !== 'pending') return;
    if (!confirm(`Approve application for ${a.fullName} and register as member?`)) return;
    try {
      await Store.request('application.approve', { id });
      toast(`${a.fullName} approved and registered!`);
      this.refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  async rejectApplication(id) {
    if (!Access.perm('approveApplication')) return toast('Access denied', 'error');
    const data = Store.get();
    const a = Store.getApplication(data, id);
    if (!a || a.status !== 'pending') return;
    const reason = prompt('Reason for rejection (optional):');
    try {
      await Store.request('application.reject', { id, reason: reason || '' });
      toast('Application rejected');
      this.refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  checkPdfAvailable() {
    if (isFileProtocol()) {
      $('#fileProtocolNotice')?.classList.remove('hidden');
    }
    const pdfUrl = 'assets/forms/member-application-form.pdf';
    const frame = $('#pdfFrame');
    const missing = $('#pdfMissingNote');
    const fileNote = $('#pdfFileNote');

    if (isFileProtocol()) {
      frame?.classList.add('hidden');
      if (frame) frame.removeAttribute('src');
      missing?.classList.add('hidden');
      fileNote?.classList.remove('hidden');
      $('#btnBlankPdf')?.classList.remove('hidden');
      return;
    }

    fileNote?.classList.add('hidden');
    fetch(pdfUrl, { method: 'HEAD' })
      .then((r) => {
        const ok = r.ok;
        $('#btnBlankPdf')?.classList.toggle('hidden', !ok);
        if (ok && frame) {
          frame.src = pdfUrl;
          frame.classList.remove('hidden');
        } else {
          frame?.classList.add('hidden');
          if (frame) frame.removeAttribute('src');
        }
        missing?.classList.toggle('hidden', ok);
        if (!ok) $('#pdfPreviewPanel')?.classList.add('hidden');
      })
      .catch(() => {
        $('#btnBlankPdf')?.classList.add('hidden');
        frame?.classList.add('hidden');
        if (frame) frame.removeAttribute('src');
        missing?.classList.remove('hidden');
        fileNote?.classList.add('hidden');
      });
  },

  showFileProtocolNotice() {},

  renderApplicationPrint(a) {
    const addr = [a.village, a.parish, a.subCounty, a.district].filter(Boolean).join(', ') || '—';
    const settings = Store.get().settings || {};
    return `
      <div class="print-form">
        <header class="print-form-header">
          <div class="print-form-logo"><img src="assets/logo/real%20logo.jpg" alt="${escapeHtml(saccoDisplayName(settings))} logo" style="width:56px;height:56px;object-fit:cover;border-radius:8px;" /></div>
          <div>
            <h2>${escapeHtml(saccoDisplayName(settings))}</h2>
            <p>Mbarara City Boda Boda Riders' SACCO</p>
            <p class="motto">${escapeHtml(settings.motto || 'Faith in God leads to success')}</p>
          </div>
        </header>
        <h3 class="print-form-title">APPLICATION FOR MEMBERSHIP</h3>
        <p class="print-form-ref">Application No: <strong>${a.applicationNo}</strong> &nbsp;|&nbsp; Date: <strong>${formatDate(a.applied)}</strong> &nbsp;|&nbsp; Status: ${badge(a.status)}</p>

        <section class="print-section">
          <h4>Part A — Personal Details</h4>
          <div class="print-grid">
            <div><label>Surname</label><p>${escapeHtml(a.surname)}</p></div>
            <div><label>Other Names</label><p>${escapeHtml(a.otherNames)}</p></div>
            <div><label>Gender</label><p>${a.gender}</p></div>
            <div><label>Date of Birth</label><p>${formatDate(a.dob)}</p></div>
            <div><label>Marital Status</label><p>${a.marital}</p></div>
            <div><label>National ID</label><p>${a.nin}</p></div>
          </div>
        </section>

        <section class="print-section">
          <h4>Part B — Contact &amp; Address</h4>
          <div class="print-grid">
            <div><label>Mobile Phone</label><p>${a.phone}</p></div>
            <div><label>Alt. Phone</label><p>${a.altPhone || '—'}</p></div>
            <div><label>Email</label><p>${a.email || '—'}</p></div>
            <div><label>Address</label><p>${escapeHtml(addr)}</p></div>
            <div><label>P.O. Box</label><p>${a.postal || '—'}</p></div>
          </div>
        </section>

        <section class="print-section">
          <h4>Part C — Employment &amp; Stage</h4>
          <div class="print-grid">
            <div><label>Occupation</label><p>${escapeHtml(a.occupation)}</p></div>
            <div><label>Boda Stage</label><p>${escapeHtml(a.stage)}</p></div>
            <div><label>Bike Reg.</label><p>${a.plate || '—'}</p></div>
            <div><label>Monthly Commitment</label><p>${formatMoney(a.monthlyCommitment)}</p></div>
          </div>
        </section>

        <section class="print-section">
          <h4>Part D — Next of Kin</h4>
          <div class="print-grid">
            <div><label>Name</label><p>${escapeHtml(a.nokName)}</p></div>
            <div><label>Relationship</label><p>${escapeHtml(a.nokRelation)}</p></div>
            <div><label>ID No.</label><p>${a.nokNin || '—'}</p></div>
            <div><label>Phone</label><p>${a.nokPhone}</p></div>
            <div class="span-2"><label>Address</label><p>${escapeHtml(a.nokAddress || '—')}</p></div>
          </div>
        </section>

        <section class="print-section">
          <h4>Part E — Share Capital &amp; Fees</h4>
          <div class="print-grid">
            <div><label>Share Capital</label><p>${formatMoney(a.shareCapital)}</p></div>
            <div><label>Shares</label><p>${a.shares}</p></div>
            <div><label>Entrance Fee</label><p>${a.entranceFeePaid ? 'Paid (UGX 20,000)' : 'Not paid'}</p></div>
          </div>
        </section>

        <section class="print-section">
          <h4>Part F — Introduced By</h4>
          <div class="print-grid">
            <div><label>Name</label><p>${escapeHtml(a.introName || '—')}</p></div>
            <div><label>Membership No.</label><p>${a.introNo || '—'}</p></div>
          </div>
        </section>

        <section class="print-section declaration">
          <p>I hereby apply for membership in ${escapeHtml(saccoDisplayName(settings))} and agree to abide by the society's by-laws, policies, and regulations.</p>
          <div class="print-signatures">
            <div><label>Applicant Signature</label><p class="sig-line">${escapeHtml(a.signature)}</p><small>Date: ${formatDate(a.applied)}</small></div>
            <div><label>For Official Use</label><p class="sig-line"></p><small>Membership No: ${a.membershipNo || '_______________'}</small></div>
          </div>
        </section>
      </div>`;
  },

  openLoanApply() {
    this.navigate('loans');
    showPanel('loanFormPanel');
    const data = Store.get();
    $('#lfProduct').innerHTML = data.loanProducts.map((p) => `<option value="${p.id}" data-rate="${p.rate}">${p.name} (${p.rate}%)</option>`).join('');
    this.updateLoanRate();
  },

  openSavingsAction(type) {
    this.navigate('savings');
    showPanel(type === 'withdraw' ? 'savWithPanel' : 'savDepPanel');
  },

  openSavingsDeposit(memberId) {
    this.openSavingsAction('deposit');
    const m = Store.getMember(Store.get(), memberId);
    $('#sdMemberId').value = memberId;
    $('#sdSearch').value = m?.fullName || '';
    $('#sdAmount').focus();
  },

  openSavingsWithdrawal(memberId) {
    this.openSavingsAction('withdraw');
    const m = Store.getMember(Store.get(), memberId);
    $('#swMemberId').value = memberId;
    $('#swSearch').value = m?.fullName || '';
    $('#swNin').value = m?.nin || '';
    $('#swAmount').focus();
  },

  viewSavings(memberId) {
    const data = Store.get();
    const s = Store.getSavings(data, memberId);
    const m = Store.getMember(data, memberId);
    if (!s || !m) return;
    const transactions = (data.savingsTx || []).filter((t) => t.memberId === memberId).slice(0, 10);
    $('#memberModalBody').innerHTML = `<div class="detail-grid"><div><label>Member</label><p>${escapeHtml(m.fullName)}</p></div><div><label>Account</label><p>${s.accountNo}</p></div><div><label>Current Balance</label><p><strong>${formatMoney(s.balance)}</strong></p></div><div><label>Status</label><p>${badge(s.status)}</p></div></div><hr><h4>Recent Transactions</h4>${transactions.length ? transactions.map((t) => `<p>${formatDate(t.date)} — <strong>${t.type === 'withdraw' ? 'Withdrawal' : 'Deposit'}</strong>: ${formatMoney(t.amount)} <small class="muted">${escapeHtml(t.receiptNo || 'No receipt')}</small></p>`).join('') : '<p class="muted">No transactions recorded yet.</p>'}`;
    $('#memberModal .modal-head h3').innerHTML = '<i class="fas fa-piggy-bank"></i> Savings Account';
    openModal('memberModal');
  },

  viewFixedDeposit(id) {
    const data = Store.get();
    const d = (data.deposits || []).find((item) => item.id === id);
    const m = d && Store.getMember(data, d.memberId);
    if (!d || !m) return;
    $('#memberModalBody').innerHTML = `<div class="detail-grid"><div><label>Member</label><p>${escapeHtml(m.fullName)}</p></div><div><label>Account</label><p>${d.accountNo}</p></div><div><label>Current Balance</label><p><strong>${formatMoney(d.amount)}</strong></p></div><div><label>Interest Rate</label><p>${d.rate}%</p></div><div><label>Tenor</label><p>${d.tenor} months</p></div><div><label>Maturity Date</label><p>${formatDate(d.maturityDate)}</p></div><div><label>Interest Payment</label><p>${escapeHtml(d.interestMode.replace('_', ' '))}</p></div><div><label>Status</label><p>${badge(d.status)}</p></div></div>`;
    $('#memberModal .modal-head h3').innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Fixed Deposit Details';
    openModal('memberModal');
  },

  openFixedDepositTransaction(id, type) {
    if (!Access.perm('openFixedDeposit')) return toast('Access denied', 'error');
    const d = (Store.get().deposits || []).find((item) => item.id === id);
    if (!d) return;
    this.navigate('deposits');
    $('#dtxDepositId').value = d.id;
    $('#dtxType').value = type;
    $('#dtxAccount').value = d.accountNo;
    $('#dtxBalance').value = formatMoney(d.amount);
    $('#dtxAmount').value = '';
    $('#dtxDesc').value = '';
    $('#depTxTitle').textContent = type === 'withdraw' ? 'Withdraw from Fixed Deposit' : 'Record Fixed Deposit Payment';
    $('#dtxSubmit').textContent = type === 'withdraw' ? 'Withdraw & Generate Receipt' : 'Record Payment & Generate Receipt';
    $('#dtxSubmit').className = `btn ${type === 'withdraw' ? 'btn-gold' : 'btn-primary'}`;
    showPanel('depTxPanel');
    $('#dtxAmount').focus();
  },

  showTransactionReceipt(receipt) {
    if (!receipt) return toast('Transaction recorded, but receipt details are unavailable', 'error');
    const settings = Store.get().settings || {};
    const saccoName = saccoDisplayName(settings);
    $('#receiptModalTitle').innerHTML = `<i class="fas fa-receipt"></i> ${escapeHtml(receipt.type)} Receipt`;
    $('#receiptPrintBody').innerHTML = `<div class="report-watermark" aria-hidden="true"><img src="assets/logo/real%20logo.jpg" alt="" /></div><div class="report-print-content print-form"><header class="print-form-header"><div class="print-form-logo"><img src="assets/logo/real%20logo.jpg" alt="${escapeHtml(saccoName)} logo" style="width:56px;height:56px;object-fit:cover;border-radius:8px;" /></div><div><h2>${escapeHtml(saccoName)}</h2><p>Mbarara City Boda Boda Riders' SACCO</p><p class="motto">${escapeHtml(settings.motto || 'Faith in God leads to success')}</p></div></header><h3 class="print-form-title">${escapeHtml(receipt.type)} Receipt</h3><p class="print-form-ref">Receipt No: <strong>${escapeHtml(receipt.receiptNo)}</strong> &nbsp;|&nbsp; Date: <strong>${formatDate(receipt.date)}</strong></p><div class="detail-grid loan-receipt-grid"><div><label>Member</label><p>${escapeHtml(receipt.member)}</p></div><div><label>Account</label><p>${escapeHtml(receipt.account)}</p></div><div><label>Amount</label><p><strong>${formatMoney(receipt.amount)}</strong></p></div><div><label>Balance After Transaction</label><p><strong>${formatMoney(receipt.balance)}</strong></p></div><div><label>Description</label><p>${escapeHtml(receipt.description || '—')}</p></div><div><label>Processed By</label><p>${escapeHtml(receipt.processedBy || '—')}</p></div>${receipt.nin ? `<div><label>National ID</label><p>${escapeHtml(receipt.nin)}</p></div>` : ''}</div><div class="report-signatures"><div class="report-sign-box"><span class="report-sign-label">Processed By</span><p class="report-sign-name">${escapeHtml(receipt.processedBy || '—')}</p><div class="report-sign-line"></div></div><div class="report-sign-box"><span class="report-sign-label">Member Confirmation</span><p class="report-sign-name report-sign-blank">&nbsp;</p><div class="report-sign-line"></div></div></div></div>`;
    openModal('receiptModal');
  },

  openLoanPayment(id) {
    const data = Store.get();
    const loan = Store.getLoan(data, id);
    if (!loan || loan.status !== 'active' || loan.balance <= 0) return;
    const m = Store.getMember(data, loan.memberId);
    if (!$('#page-loans').classList.contains('active')) this.navigate('loans');
    $('#lpLoanId').value = loan.id;
    $('#lpLoanLabel').value = `${loan.loanId} — ${m?.fullName || 'Member'}`;
    $('#lpBalance').value = formatMoney(loan.balance);
    $('#lpAmount').value = '';
    $('#lpAmount').max = loan.balance;
    showPanel('loanPayPanel');
  },

  viewLoan(id) {
    const data = Store.get();
    const l = Store.getLoan(data, id);
    if (!l) return;
    const m = Store.getMember(data, l.memberId);
    const payments = (data.loanPayments || []).filter((p) => p.loanId === l.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const paidAmt = l.amount - l.balance;

    $('#memberModalBody').innerHTML = `
      <div class="detail-grid">
        <div><label>Loan ID</label><p>${l.loanId}</p></div>
        <div><label>Member</label><p>${escapeHtml(m?.fullName || '—')}</p></div>
        <div><label>Product</label><p>${productName(data, l.productId)}</p></div>
        <div><label>Interest Rate</label><p>${l.rate}%</p></div>
        <div><label>Original Amount</label><p>${formatMoney(l.amount)}</p></div>
        <div><label>Outstanding</label><p>${l.status === 'active' || l.status === 'completed' ? formatMoney(l.balance) : '—'}</p></div>
        <div><label>Total Paid</label><p>${paidAmt > 0 ? formatMoney(paidAmt) : '—'}</p></div>
        <div><label>Status</label><p>${badge(loanDisplayStatus(l))}</p></div>
        <div><label>Applied By</label><p>${escapeHtml(l.createdBy || '—')}</p></div>
        ${l.approvedBy ? `<div><label>Approved By</label><p>${escapeHtml(l.approvedBy)}${l.approvedDate ? ` on ${formatDate(l.approvedDate)}` : ''}</p></div>` : ''}
        ${l.disbursedBy ? `<div><label>Disbursed By</label><p>${escapeHtml(l.disbursedBy)}${l.disbursedDate ? ` on ${formatDate(l.disbursedDate)}` : ''}</p></div>` : ''}
      </div>
      <hr>
      <h4>Repayment History (${payments.length})</h4>
      ${payments.length ? payments.map((p) => `<p>${formatDate(p.date)} — ${formatMoney(p.amount)} <small class="muted">by ${escapeHtml(p.processedBy || '—')}</small></p>`).join('') : '<p class="muted">No payments recorded yet</p>'}
    `;
    openModal('memberModal');
    $('#memberModal .modal-head h3').innerHTML = '<i class="fas fa-hand-holding-dollar"></i> Loan Details';
  },

  openMemberForm(member = null) {
    $('#memberForm').reset();
    $('#mfId').value = member ? member.id : '';
    $('#mfMembershipNoWrap').classList.toggle('hidden', !member);
    $('#mfStatusWrap').classList.toggle('hidden', !member);
    if (member) {
      $('#memberFormTitle').innerHTML = '<i class="fas fa-user-pen"></i> Edit Member';
      $('#memberFormSubmit').textContent = 'Save Changes';
      $('#mfMembershipNo').value = member.membershipNo;
      $('#mfName').value = member.fullName;
      $('#mfGender').value = member.gender || 'Male';
      $('#mfDob').value = member.dob || '';
      $('#mfNin').value = member.nin;
      $('#mfPhone').value = member.phone || '';
      $('#mfPass').value = '';
      $('#mfPass').required = false;
      $('#mfPassHint').textContent = '(leave blank to keep)';
      $('#mfPass').placeholder = 'Leave blank to keep current password';
      $('#mfMarital').value = member.marital || 'Single';
      $('#mfAddress').value = member.address || '';
      $('#mfOccupation').value = member.occupation || '';
      $('#mfStage').value = member.stage || '';
      $('#mfNokName').value = member.nokName || '';
      $('#mfNokPhone').value = member.nokPhone || '';
      $('#mfShare').value = member.shareCapital || 0;
      $('#mfFee').checked = !!member.entranceFeePaid;
      $('#mfStatus').value = member.status || 'active';
    } else {
      $('#memberFormTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add Member';
      $('#memberFormSubmit').textContent = 'Register';
      $('#mfPass').required = true;
      $('#mfPassHint').textContent = '*';
      $('#mfPass').placeholder = '';
    }
    this.navigate('members');
    showPanel('memberFormPanel');
  },

  editMember(id) {
    if (!Access.perm('editMember')) return toast('Access denied', 'error');
    const m = Store.getMember(Store.get(), id);
    if (!m) return;
    this.openMemberForm(m);
  },

  async deleteMember(id) {
    if (!Access.perm('deleteMember')) return toast('Access denied', 'error');
    const m = Store.getMember(Store.get(), id);
    if (!m) return;
    if (!confirm(`Permanently delete member ${m.fullName} (${m.membershipNo})?\n\nThis cannot be undone. Members with savings balance or outstanding loans cannot be deleted.`)) return;
    try {
      await Store.request('member.delete', { id });
      closeModal('memberModal');
      toast('Member deleted');
      this.refreshAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  async deleteStaff(id) {
    if (!Access.perm('deleteStaff')) return toast('Access denied', 'error');
    if (id === Auth.session?.id) return toast('You cannot delete your own account', 'error');
    const u = Store.getUser(Store.get(), id);
    if (!u) return;
    if (!confirm(`Permanently delete staff account for ${u.name} (${u.username})?`)) return;
    try {
      await Store.request('staff.delete', { id });
      toast('Staff account deleted');
      Pages.users();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  editUser(id) {
    if (!Access.perm('manageUsers')) return toast('Access denied', 'error');
    const data = Store.get();
    const u = Store.getUser(data, id);
    if (!u) return;
    $('#ufId').value = u.id;
    $('#ufName').value = u.name;
    $('#ufUsername').value = u.username;
    $('#ufPassword').value = '';
    $('#ufPassword').required = false;
    $('#ufPassword').placeholder = 'Leave blank to keep current password';
    $('#ufRole').value = u.role;
    $('#ufActive').checked = u.active !== false;
    $('#userFormTitle').innerHTML = '<i class="fas fa-user-pen"></i> Edit Staff Account';
    showPanel('userFormPanel');
  },

  async toggleUser(id) {
    if (!Access.perm('manageUsers')) return toast('Access denied', 'error');
    if (id === Auth.session?.id) return toast('You cannot disable your own account', 'error');
    try {
      await Store.request('staff.toggle', { id });
      toast('Account status updated');
      Pages.users();
    } catch (e) {
      toast(e.message, 'error');
    }
  },

  viewMember(id) {
    if (!Access.perm('viewMembers')) return toast('Access denied', 'error');
    const data = Store.get();
    const m = Store.getMember(data, id);
    if (!m) return;
    const sav = Store.getSavings(data, id);
    const isChairman = Access.role() === 'chairman';
    const deps = isChairman ? data.deposits.filter((d) => d.memberId === id) : [];
    const loans = isChairman ? data.loans.filter((l) => l.memberId === id) : [];

    $('#memberModalBody').innerHTML = `
      <div class="detail-grid">
        <div><label>Membership No</label><p>${m.membershipNo}</p></div>
        <div><label>Full Name</label><p>${escapeHtml(m.fullName)}</p></div>
        <div><label>NIN</label><p>${m.nin}</p></div>
        <div><label>Phone</label><p>${m.phone || '—'}</p></div>
        <div><label>Occupation</label><p>${m.occupation || '—'}</p></div>
        <div><label>Stage</label><p>${m.stage || '—'}</p></div>
        <div><label>Next of Kin</label><p>${m.nokName} (${m.nokPhone})</p></div>
        <div><label>Status</label><p>${badge(m.status)}</p></div>
      </div>
      <hr>
      <h4>Savings Account</h4>
      ${sav ? `<p>Account <strong>${sav.accountNo}</strong> — Balance: <strong>${formatMoney(sav.balance)}</strong></p>` : '<p class="muted">No account</p>'}
      ${isChairman ? `<h4>Fixed Deposits (${deps.length})</h4>
      ${deps.length ? deps.map((d) => `<p>${d.accountNo} — ${formatMoney(d.amount)} ${badge(d.status)}</p>`).join('') : '<p class="muted">None</p>'}
      <h4>Loans (${loans.length})</h4>
      ${loans.length ? loans.map((l) => `<p>${l.loanId} — ${formatMoney(l.amount)} (Bal: ${formatMoney(l.balance)}) ${badge(l.status)}</p>`).join('') : '<p class="muted">None</p>'}` : ''}
      ${Access.perm('editMember') ? `<div style="margin-top:1rem;display:flex;gap:0.5rem;"><button class="btn btn-primary btn-sm" onclick="closeModal('memberModal'); App.editMember(${m.id})">Edit Member</button>${Access.perm('deleteMember') ? `<button class="btn btn-danger btn-sm" onclick="App.deleteMember(${m.id})">Delete Member</button>` : ''}</div>` : ''}
    `;
    openModal('memberModal');
    $('#memberModal .modal-head h3').innerHTML = '<i class="fas fa-user"></i> Member Details';
  },

  bindModals() {
    $$('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    $('#printReceipt')?.addEventListener('click', () => {
      document.body.classList.add('print-transaction-receipt');
      window.print();
      window.addEventListener('afterprint', () => document.body.classList.remove('print-transaction-receipt'), { once: true });
    });
    $('#printLoanReceipt')?.addEventListener('click', () => {
      document.body.classList.add('print-loan-receipt');
      window.print();
      window.addEventListener('afterprint', () => document.body.classList.remove('print-loan-receipt'), { once: true });
    });
    $('#printApplication')?.addEventListener('click', () => window.print());
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.suggestions') && !e.target.closest('.member-search')) {
        $$('.suggestions').forEach((b) => (b.style.display = 'none'));
      }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
