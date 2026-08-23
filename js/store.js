/**
 * KIHINDI SACCO Prototype – IndexedDB client (same interface as PHP store.js)
 */
const Store = {
  cache: null,

  empty() {
    return {
      users: [], members: [], applications: [], savings: [], savingsTx: [],
      deposits: [], loans: [], loanPayments: [], loanProducts: [],
      settings: { saccoName: 'KIHINDI SACCO', motto: 'Faith in God leads to success', currency: 'UGX', entranceFee: 20000 },
    };
  },

  get() {
    return this.cache || this.empty();
  },

  async request(action, payload = null, method = 'POST') {
    try {
      await DB.ensureSeed();
      const json = await Api.handle(action, payload || {}, method);
      if (json.data) this.cache = json.data;
      return json;
    } catch (e) {
      const err = new Error(e.message || 'Request failed');
      err.status = e.status || 500;
      throw err;
    }
  },

  async load(force = false) {
    if (!force && this.cache && this.hasRecords(this.cache)) return this.cache;
    await this.request('data', null, 'GET');
    return this.cache;
  },

  hasRecords(data) {
    if (!data) return false;
    return !!(data.members?.length || data.savings?.length || data.loans?.length
      || data.applications?.length || data.users?.length);
  },

  async repairStaffLogins() {
    return this.request('repair-staff');
  },

  async resetDemoData() {
    await DB.reset();
    this.cache = null;
    SessionStore.set(null);
    return this.load(true);
  },

  getMember(data, id) {
    return (data || this.get()).members.find((m) => m.id === Number(id));
  },

  getSavings(data, memberId) {
    return (data || this.get()).savings.find((s) => s.memberId === Number(memberId));
  },

  getApplication(data, id) {
    return (data || this.get()).applications.find((a) => a.id === Number(id));
  },

  getUser(data, id) {
    return (data || this.get()).users.find((u) => u.id === Number(id));
  },

  getLoan(data, id) {
    return (data || this.get()).loans.find((l) => l.id === Number(id));
  },
};
