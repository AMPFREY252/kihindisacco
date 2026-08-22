/**
 * KIHINDI SACCO – Role-based access control
 */
const ROLES = {
  loan_officer: {
    label: 'Loans Officer',
    pages: ['dashboard', 'members', 'loan-applications', 'loans'],
    home: 'dashboard',
    dashboard: 'loan_officer',
  },
  cashier: {
    label: 'Cashier',
    pages: ['dashboard', 'members', 'savings', 'loans'],
    home: 'loans',
    dashboard: 'cashier',
  },
  chairman: {
    label: 'Chairperson',
    pages: ['dashboard', 'members', 'applications', 'loan-applications', 'savings', 'deposits', 'loans', 'reports', 'users'],
    home: 'dashboard',
    dashboard: 'chairman',
  },
};

const PERMS = {
  manageUsers: ['chairman'],
  resetData: ['chairman'],
  registerMember: ['chairman', 'loan_officer', 'cashier'],
  editMember: ['chairman'],
  deleteMember: ['chairman'],
  deleteStaff: ['chairman'],
  manageApplications: ['chairman'],
  approveApplication: ['chairman'],
  openFixedDeposit: ['chairman'],
  applyLoan: ['chairman', 'loan_officer'],
  approveLoan: ['chairman'],
  disburseLoan: ['chairman', 'cashier'],
  recordLoanPayment: ['chairman', 'loan_officer'],
  savingsDeposit: ['chairman', 'cashier'],
  savingsWithdraw: ['chairman', 'cashier'],
  viewMembers: ['chairman', 'loan_officer', 'cashier'],
  viewReports: ['chairman'],
};

const Access = {
  role() {
    return Auth.session?.role || '';
  },

  can(page) {
    const allowed = ROLES[Auth.normalizeRole(this.role())]?.pages || [];
    return allowed.includes(page);
  },

  perm(action) {
    const role = Auth.normalizeRole(this.role());
    return (PERMS[action] || []).includes(role);
  },

  label(role) {
    return ROLES[role]?.label || role;
  },

  homePage() {
    return ROLES[Auth.normalizeRole(this.role())]?.home || 'dashboard';
  },

  dashboardType() {
    return ROLES[Auth.normalizeRole(this.role())]?.dashboard || 'chairman';
  },
};
