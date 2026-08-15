/**
 * KIHINDI SACCO Prototype – IndexedDB storage
 */
const DB_NAME = 'kihindisacco_prototype';
const DB_VERSION = 1;
const STORE = 'bundle';
const BUNDLE_KEY = 'main';

const SessionStore = {
  key: 'kihindisacco_session',

  get() {
    try {
      const raw = sessionStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(session) {
    if (session) sessionStorage.setItem(this.key, JSON.stringify(session));
    else sessionStorage.removeItem(this.key);
  },
};

function seedBundle() {
  return {
    version: 1,
    sequences: {
      member: 1002,
      application: 100,
      savings: 5002,
      deposit: 3001,
      loan: 2002,
      receipt: 9000,
      loan_payment: 500,
    },
    settings: {
      saccoName: 'KIHINDI SACCO',
      motto: 'Faith in God leads to success',
      currency: 'UGX',
      entranceFee: 20000,
    },
    users: [
      { id: 1, username: 'admin', password: 'password', fullName: 'Chairman', role: 'chairman', isActive: true, createdAt: '2024-01-01' },
      { id: 2, username: 'loans', password: 'password', fullName: 'Loan Officer', role: 'loan_officer', isActive: true, createdAt: '2024-01-01' },
      { id: 3, username: 'cashier', password: 'password', fullName: 'Cashier', role: 'cashier', isActive: true, createdAt: '2024-01-01' },
    ],
    members: [
      {
        id: 1, membershipNo: 'KSC-1001', fullName: 'James Okello', gender: 'Male', dob: '1990-05-12',
        nin: 'CM920512001A', phone: '0772123456', password: 'member123', marital: 'Married',
        address: 'Mbarara City, Nyamityobora', occupation: 'Boda Rider', stage: 'Main Stage',
        nokName: 'Mary Okello', nokPhone: '0783123456', shareCapital: 50000, entranceFeePaid: true,
        status: 'active', joined: '2024-01-15', applicationId: null,
      },
      {
        id: 2, membershipNo: 'KSC-1002', fullName: 'Sarah Namukasa', gender: 'Female', dob: '1988-11-03',
        nin: 'CF881103002B', phone: '0755123789', password: 'member123', marital: 'Single',
        address: 'Mbarara City, Kakoba', occupation: 'Trader', stage: 'Market Stage',
        nokName: 'Peter Namukasa', nokPhone: '0700123789', shareCapital: 100000, entranceFeePaid: true,
        status: 'active', joined: '2024-03-20', applicationId: null,
      },
    ],
    applications: [],
    savings: [
      { id: 1, memberId: 1, accountNo: 'SAV-5001', balance: 850000, status: 'active', opened: '2024-01-15' },
      { id: 2, memberId: 2, accountNo: 'SAV-5002', balance: 1200000, status: 'active', opened: '2024-03-20' },
    ],
    savingsTx: [
      { id: 1, memberId: 1, savingsId: 1, type: 'deposit', amount: 200000, desc: 'Monthly savings', date: '2025-07-01', receiptNo: null, processedBy: 3 },
      { id: 2, memberId: 2, savingsId: 2, type: 'deposit', amount: 150000, desc: 'Weekly contribution', date: '2025-07-05', receiptNo: null, processedBy: 3 },
      { id: 3, memberId: 1, savingsId: 1, type: 'withdraw', amount: 50000, desc: 'Emergency', date: '2025-07-10', receiptNo: 'RCP-9000', processedBy: 3 },
    ],
    deposits: [
      {
        id: 1, memberId: 1, accountNo: 'FD-3001', amount: 500000, rate: 12, tenor: 12,
        startDate: '2024-06-01', maturityDate: '2025-06-01', interestMode: 'quarterly', status: 'active', createdBy: 1,
      },
    ],
    loanProducts: [
      { id: 1, name: 'Business Loan', rate: 15, maxMonths: 24, description: 'For business expansion', isActive: true },
      { id: 2, name: 'Emergency Loan', rate: 12, maxMonths: 12, description: 'Quick emergency funding', isActive: true },
      { id: 3, name: 'Asset Loan', rate: 14, maxMonths: 36, description: 'Vehicle & equipment purchase', isActive: true },
    ],
    loans: [
      {
        id: 1, loanNo: 'LN-2001', memberId: 1, productId: 1, amount: 300000, balance: 180000,
        rate: 15, months: 12, status: 'active', applied: '2024-08-01', createdBy: 2,
        approvedBy: null, approvedDate: null, disbursedBy: null, disbursedDate: null,
        disbursementReceiptNo: null, clientConfirmedName: null,
      },
      {
        id: 2, loanNo: 'LN-2002', memberId: 2, productId: 2, amount: 150000, balance: 0,
        rate: 12, months: 6, status: 'completed', applied: '2024-02-10', createdBy: 2,
        approvedBy: null, approvedDate: null, disbursedBy: null, disbursedDate: null,
        disbursementReceiptNo: null, clientConfirmedName: null,
      },
    ],
    loanPayments: [
      { id: 1, loanId: 1, memberId: 1, amount: 120000, date: '2024-11-01', notes: 'Partial repayment', processedBy: 2 },
      { id: 2, loanId: 2, memberId: 2, amount: 150000, date: '2024-08-10', notes: 'Full settlement', processedBy: 2 },
    ],
  };
}

const DB = {
  _conn: null,

  async open() {
    if (this._conn) return this._conn;
    this._conn = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._conn;
  },

  async readBundle() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(BUNDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async writeBundle(bundle) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bundle, BUNDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async ensureSeed() {
    let bundle = await this.readBundle();
    if (!bundle) {
      bundle = seedBundle();
      await this.writeBundle(bundle);
    }
    return bundle;
  },

  async reset() {
    await this.writeBundle(seedBundle());
  },

  async update(mutator) {
    const bundle = await this.ensureSeed();
    mutator(bundle);
    await this.writeBundle(bundle);
    return bundle;
  },
};
