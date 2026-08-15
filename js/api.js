/**
 * KIHINDI SACCO Prototype – local API (mirrors PHP api/index.php)
 */
const Api = {
  err(message, code = 400) {
    const e = new Error(message);
    e.status = code;
    throw e;
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  addMonths(dateStr, months) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + Number(months));
    return d.toISOString().split('T')[0];
  },

  namesMatch(a, b) {
    const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    return na === nb || nb.includes(na) || na.includes(nb);
  },

  staffSession(user) {
    return {
      id: user.id,
      username: user.username,
      role: user.role === 'admin' ? 'chairman' : user.role,
      name: user.fullName,
    };
  },

  requireAuth() {
    const session = SessionStore.get();
    if (!session) this.err('Not authenticated', 401);
    return session;
  },

  requireRole(...roles) {
    const session = this.requireAuth();
    if (!roles.includes(session.role)) this.err('Access denied', 403);
    return session;
  },

  staffName(bundle, id) {
    if (!id) return null;
    return bundle.users.find((u) => u.id === id)?.fullName || null;
  },

  nextSeq(bundle, name) {
    if (!bundle.sequences[name]) bundle.sequences[name] = 1000;
    bundle.sequences[name] += 1;
    return bundle.sequences[name];
  },

  nextEntityId(bundle, collection) {
    const rows = bundle[collection] || [];
    return rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
  },

  exportData(bundle) {
    const users = bundle.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.fullName,
      active: !!u.isActive,
      created: u.createdAt,
    }));

    const members = bundle.members.map((m) => ({
      id: m.id,
      membershipNo: m.membershipNo,
      fullName: m.fullName,
      gender: m.gender,
      dob: m.dob,
      nin: m.nin,
      phone: m.phone,
      marital: m.marital,
      address: m.address,
      occupation: m.occupation,
      stage: m.stage,
      nokName: m.nokName,
      nokPhone: m.nokPhone,
      shareCapital: m.shareCapital,
      entranceFeePaid: !!m.entranceFeePaid,
      status: m.status,
      joined: m.joined,
    }));

    const applications = bundle.applications.map((a) => ({
      id: a.id,
      applicationNo: a.applicationNo,
      surname: a.surname,
      otherNames: a.otherNames,
      fullName: a.fullName,
      gender: a.gender,
      dob: a.dob,
      marital: a.marital,
      nin: a.nin,
      phone: a.phone,
      altPhone: a.altPhone,
      email: a.email,
      village: a.village,
      parish: a.parish,
      subCounty: a.subCounty,
      district: a.district,
      postal: a.postal,
      occupation: a.occupation,
      stage: a.stage,
      plate: a.plate,
      monthlyCommitment: a.monthlyCommitment,
      nokName: a.nokName,
      nokRelation: a.nokRelation,
      nokNin: a.nokNin,
      nokPhone: a.nokPhone,
      nokAddress: a.nokAddress,
      shareCapital: a.shareCapital,
      shares: a.shares,
      entranceFeePaid: !!a.entranceFeePaid,
      introName: a.introName,
      introNo: a.introNo,
      signature: a.signature,
      applied: a.applied,
      status: a.status,
      approved: a.approved,
      rejected: a.rejected,
      rejectReason: a.rejectReason,
      membershipNo: a.membershipNo,
      reviewedBy: this.staffName(bundle, a.reviewedBy),
    }));

    const savings = bundle.savings.map((s) => ({
      id: s.id,
      memberId: s.memberId,
      accountNo: s.accountNo,
      balance: s.balance,
      status: s.status,
      opened: s.opened,
    }));

    const savingsTx = bundle.savingsTx.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      type: t.type,
      amount: t.amount,
      desc: t.desc,
      date: t.date,
      receiptNo: t.receiptNo,
      processedBy: this.staffName(bundle, t.processedBy),
    }));

    const deposits = bundle.deposits.map((d) => ({
      id: d.id,
      memberId: d.memberId,
      accountNo: d.accountNo,
      amount: d.amount,
      rate: d.rate,
      tenor: d.tenor,
      startDate: d.startDate,
      maturityDate: d.maturityDate,
      interestMode: d.interestMode,
      status: d.status,
      createdBy: this.staffName(bundle, d.createdBy),
    }));

    const loanProducts = bundle.loanProducts
      .filter((p) => p.isActive !== false)
      .map((p) => ({
        id: p.id,
        name: p.name,
        rate: p.rate,
        maxMonths: p.maxMonths,
        description: p.description,
      }));

    const loans = bundle.loans.map((l) => ({
      id: l.id,
      loanId: l.loanNo,
      memberId: l.memberId,
      productId: l.productId,
      amount: l.amount,
      balance: l.balance,
      rate: l.rate,
      months: l.months,
      status: l.status,
      applied: l.applied,
      createdBy: this.staffName(bundle, l.createdBy),
      approvedBy: this.staffName(bundle, l.approvedBy),
      approvedDate: l.approvedDate,
      disbursedBy: this.staffName(bundle, l.disbursedBy),
      disbursedDate: l.disbursedDate,
      disbursementReceiptNo: l.disbursementReceiptNo,
      clientConfirmedName: l.clientConfirmedName,
    }));

    const loanPayments = bundle.loanPayments.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      memberId: p.memberId,
      amount: p.amount,
      date: p.date,
      notes: p.notes,
      processedBy: this.staffName(bundle, p.processedBy),
    }));

    return {
      users,
      members,
      applications,
      savings,
      savingsTx,
      deposits,
      loans,
      loanPayments,
      loanProducts,
      settings: { ...bundle.settings },
    };
  },

  async loadData() {
    const bundle = await DB.ensureSeed();
    return this.exportData(bundle);
  },

  async handle(action, payload = {}, method = 'POST') {
    switch (action) {
      case 'me':
        if (method !== 'GET') this.err('Method not allowed', 405);
        return { ok: true, session: SessionStore.get() };
      case 'login':
        return this.login(payload);
      case 'logout':
        SessionStore.set(null);
        return { ok: true };
      case 'data':
        if (method !== 'GET') this.err('Method not allowed', 405);
        this.requireAuth();
        return { ok: true, data: await this.loadData() };
      case 'repair-staff':
        return this.repairStaff();
      case 'application.create':
        return this.applicationCreate(payload);
      case 'application.approve':
        return this.applicationApprove(payload);
      case 'application.reject':
        return this.applicationReject(payload);
      case 'member.create':
        return this.memberCreate(payload);
      case 'member.update':
        return this.memberUpdate(payload);
      case 'member.delete':
        return this.memberDelete(payload);
      case 'savings.deposit':
        return this.savingsDeposit(payload);
      case 'savings.withdraw':
        return this.savingsWithdraw(payload);
      case 'deposit.create':
        return this.depositCreate(payload);
      case 'loan.create':
        return this.loanCreate(payload);
      case 'loan.approve':
        return this.loanApprove(payload);
      case 'loan.reject':
        return this.loanReject(payload);
      case 'loan.disburse':
        return this.loanDisburse(payload);
      case 'loan.pay':
        return this.loanPay(payload);
      case 'staff.save':
        return this.staffSave(payload);
      case 'staff.toggle':
        return this.staffToggle(payload);
      case 'staff.delete':
        return this.staffDelete(payload);
      default:
        this.err('Unknown action', 404);
    }
  },

  async login(in_) {
    const username = (in_.username || '').trim();
    const password = in_.password || '';
    if (!username || !password) this.err('Username and password required');

    const bundle = await DB.ensureSeed();
    const user = bundle.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || user.password !== password) this.err('Invalid username or password', 401);
    if (!user.isActive) this.err('Account disabled. Contact the chairman.', 403);

    const session = this.staffSession(user);
    SessionStore.set(session);
    return { ok: true, session, data: this.exportData(bundle) };
  },

  async repairStaff() {
    await DB.update((bundle) => {
      const defaults = [
        ['admin', 'password', 'Chairman', 'chairman'],
        ['loans', 'password', 'Loan Officer', 'loan_officer'],
        ['cashier', 'password', 'Cashier', 'cashier'],
      ];
      defaults.forEach(([username, password, fullName, role]) => {
        const existing = bundle.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
        if (existing) {
          existing.password = password;
          existing.fullName = fullName;
          existing.role = role;
          existing.isActive = true;
        } else {
          bundle.users.push({
            id: this.nextEntityId(bundle, 'users'),
            username,
            password,
            fullName,
            role,
            isActive: true,
            createdAt: this.today(),
          });
        }
      });
    });
    return { ok: true, message: 'Default staff logins restored' };
  },

  async applicationCreate(in_) {
    this.requireRole('chairman');
    const nin = (in_.nin || '').trim();
    if (!nin) this.err('NIN required');

    await DB.update((bundle) => {
      if (bundle.members.some((m) => m.nin === nin)) this.err('A member with this NIN already exists');
      if (bundle.applications.some((a) => a.nin === nin && a.status === 'pending')) {
        this.err('A pending application with this NIN already exists');
      }

      const appNo = 'APP-' + this.nextSeq(bundle, 'application');
      bundle.applications.push({
        id: this.nextEntityId(bundle, 'applications'),
        applicationNo: appNo,
        surname: in_.surname,
        otherNames: in_.otherNames,
        fullName: in_.fullName,
        gender: in_.gender,
        dob: in_.dob,
        marital: in_.marital,
        nin,
        phone: in_.phone,
        altPhone: in_.altPhone || null,
        email: in_.email || null,
        village: in_.village || null,
        parish: in_.parish || null,
        subCounty: in_.subCounty || null,
        district: in_.district || null,
        postal: in_.postal || null,
        occupation: in_.occupation,
        stage: in_.stage,
        plate: in_.plate || null,
        monthlyCommitment: in_.monthlyCommitment || 0,
        nokName: in_.nokName,
        nokRelation: in_.nokRelation,
        nokNin: in_.nokNin || null,
        nokPhone: in_.nokPhone,
        nokAddress: in_.nokAddress || null,
        shareCapital: in_.shareCapital || 0,
        shares: in_.shares || 1,
        entranceFeePaid: !!in_.entranceFeePaid,
        introName: in_.introName || null,
        introNo: in_.introNo || null,
        signature: in_.signature,
        applied: in_.applied,
        status: 'pending',
        approved: null,
        rejected: null,
        rejectReason: null,
        membershipNo: null,
        reviewedBy: null,
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async applicationApprove(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Application ID required');

    await DB.update((bundle) => {
      const app = bundle.applications.find((a) => a.id === id && a.status === 'pending');
      if (!app) this.err('Application not found or already processed');

      const membershipNo = 'KSC-' + this.nextSeq(bundle, 'member');
      const address = [app.village, app.parish, app.subCounty, app.district].filter(Boolean).join(', ');
      const memberId = this.nextEntityId(bundle, 'members');

      bundle.members.push({
        id: memberId,
        membershipNo,
        fullName: app.fullName,
        gender: app.gender,
        dob: app.dob,
        nin: app.nin,
        phone: app.phone,
        password: 'member123',
        marital: app.marital,
        address: address || null,
        occupation: app.occupation,
        stage: app.stage,
        nokName: app.nokName,
        nokPhone: app.nokPhone,
        shareCapital: app.shareCapital,
        entranceFeePaid: app.entranceFeePaid,
        status: 'active',
        joined: this.today(),
        applicationId: id,
      });

      bundle.savings.push({
        id: this.nextEntityId(bundle, 'savings'),
        memberId,
        accountNo: 'SAV-' + this.nextSeq(bundle, 'savings'),
        balance: app.shareCapital,
        status: 'active',
        opened: this.today(),
      });

      app.status = 'approved';
      app.approved = this.today();
      app.membershipNo = membershipNo;
      app.reviewedBy = staff.id;
    });
    return { ok: true, data: await this.loadData() };
  },

  async applicationReject(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Application ID required');

    await DB.update((bundle) => {
      const app = bundle.applications.find((a) => a.id === id && a.status === 'pending');
      if (!app) return;
      app.status = 'rejected';
      app.rejected = this.today();
      app.rejectReason = in_.reason || '';
      app.reviewedBy = staff.id;
    });
    return { ok: true, data: await this.loadData() };
  },

  async memberCreate(in_) {
    this.requireRole('chairman');
    const nin = (in_.nin || '').trim();
    if (!nin) this.err('NIN required');

    await DB.update((bundle) => {
      if (bundle.members.some((m) => m.nin === nin)) this.err('Member with this NIN already exists');

      const membershipNo = 'KSC-' + this.nextSeq(bundle, 'member');
      const share = Number(in_.shareCapital) || 0;
      const memberId = this.nextEntityId(bundle, 'members');

      bundle.members.push({
        id: memberId,
        membershipNo,
        fullName: in_.fullName,
        gender: in_.gender || 'Male',
        dob: in_.dob || null,
        nin,
        phone: in_.phone || null,
        password: in_.password || 'member123',
        marital: in_.marital || 'Single',
        address: in_.address || null,
        occupation: in_.occupation || null,
        stage: in_.stage || null,
        nokName: in_.nokName,
        nokPhone: in_.nokPhone,
        shareCapital: share,
        entranceFeePaid: !!in_.entranceFeePaid,
        status: 'active',
        joined: this.today(),
        applicationId: null,
      });

      bundle.savings.push({
        id: this.nextEntityId(bundle, 'savings'),
        memberId,
        accountNo: 'SAV-' + this.nextSeq(bundle, 'savings'),
        balance: share,
        status: 'active',
        opened: this.today(),
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async memberUpdate(in_) {
    this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Member ID required');
    const nin = (in_.nin || '').trim();
    if (!nin) this.err('NIN required');

    await DB.update((bundle) => {
      const member = bundle.members.find((m) => m.id === id);
      if (!member) this.err('Member not found');
      if (bundle.members.some((m) => m.nin === nin && m.id !== id)) {
        this.err('Another member with this NIN already exists');
      }
      const status = in_.status || 'active';
      if (!['active', 'inactive', 'suspended'].includes(status)) this.err('Invalid status');

      Object.assign(member, {
        fullName: in_.fullName,
        gender: in_.gender || 'Male',
        dob: in_.dob || null,
        nin,
        phone: in_.phone || null,
        marital: in_.marital || 'Single',
        address: in_.address || null,
        occupation: in_.occupation || null,
        stage: in_.stage || null,
        nokName: in_.nokName,
        nokPhone: in_.nokPhone,
        shareCapital: Number(in_.shareCapital) || 0,
        entranceFeePaid: !!in_.entranceFeePaid,
        status,
      });
      if (in_.password) member.password = in_.password;
    });
    return { ok: true, data: await this.loadData() };
  },

  async memberDelete(in_) {
    this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Member ID required');

    await DB.update((bundle) => {
      const member = bundle.members.find((m) => m.id === id);
      if (!member) this.err('Member not found');

      if (bundle.loans.some((l) => l.memberId === id && l.balance > 0)) {
        this.err('Cannot delete: member has an outstanding loan balance. Settle loans first or set status to inactive.');
      }
      const sav = bundle.savings.find((s) => s.memberId === id);
      if (sav && sav.balance > 0) {
        this.err('Cannot delete: member has savings balance. Withdraw funds first or set status to inactive.');
      }

      bundle.loanPayments = bundle.loanPayments.filter((p) => p.memberId !== id);
      bundle.loans = bundle.loans.filter((l) => l.memberId !== id);
      bundle.savingsTx = bundle.savingsTx.filter((t) => t.memberId !== id);
      bundle.deposits = bundle.deposits.filter((d) => d.memberId !== id);
      bundle.savings = bundle.savings.filter((s) => s.memberId !== id);
      bundle.members = bundle.members.filter((m) => m.id !== id);
    });
    return { ok: true, data: await this.loadData() };
  },

  async savingsDeposit(in_) {
    const staff = this.requireRole('chairman', 'cashier');
    const memberId = Number(in_.memberId);
    const amount = Number(in_.amount);
    if (!memberId || amount <= 0) this.err('Invalid deposit');

    await DB.update((bundle) => {
      const acc = bundle.savings.find((s) => s.memberId === memberId);
      if (!acc) this.err('No savings account for member');
      acc.balance += amount;
      bundle.savingsTx.push({
        id: this.nextEntityId(bundle, 'savingsTx'),
        memberId,
        savingsId: acc.id,
        type: 'deposit',
        amount,
        desc: in_.desc || 'Deposit',
        date: this.today(),
        receiptNo: null,
        processedBy: staff.id,
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async savingsWithdraw(in_) {
    const staff = this.requireRole('chairman', 'cashier');
    const memberId = Number(in_.memberId);
    const amount = Number(in_.amount);
    const nin = (in_.nin || '').trim();
    if (!memberId || amount <= 0) this.err('Invalid withdrawal');
    if (!nin) this.err('National ID required');

    let receipt;
    await DB.update((bundle) => {
      const member = bundle.members.find((m) => m.id === memberId);
      if (!member || member.nin !== nin) this.err('National ID does not match');

      const acc = bundle.savings.find((s) => s.memberId === memberId);
      if (!acc || acc.balance < amount) this.err('Insufficient balance');

      const receiptNo = 'RCP-' + this.nextSeq(bundle, 'receipt');
      acc.balance -= amount;
      bundle.savingsTx.push({
        id: this.nextEntityId(bundle, 'savingsTx'),
        memberId,
        savingsId: acc.id,
        type: 'withdraw',
        amount,
        desc: in_.desc || 'Withdrawal',
        date: this.today(),
        receiptNo,
        processedBy: staff.id,
      });
      receipt = {
        receiptNo,
        member: member.fullName,
        account: acc.accountNo,
        amount,
        date: this.today(),
        nin,
      };
    });
    return { ok: true, data: await this.loadData(), receipt };
  },

  async depositCreate(in_) {
    const staff = this.requireRole('chairman');
    const memberId = Number(in_.memberId);
    if (!memberId) this.err('Member required');

    await DB.update((bundle) => {
      const tenor = Number(in_.tenor) || 12;
      const start = in_.startDate || this.today();
      bundle.deposits.push({
        id: this.nextEntityId(bundle, 'deposits'),
        memberId,
        accountNo: 'FD-' + this.nextSeq(bundle, 'deposit'),
        amount: Number(in_.amount),
        rate: Number(in_.rate),
        tenor,
        startDate: start,
        maturityDate: this.addMonths(start, tenor),
        interestMode: in_.interestMode || 'quarterly',
        status: 'active',
        createdBy: staff.id,
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async loanCreate(in_) {
    const staff = this.requireRole('chairman', 'loan_officer');
    const memberId = Number(in_.memberId);
    const productId = Number(in_.productId);
    const amount = Number(in_.amount);
    if (!memberId || !productId || amount <= 0) this.err('Invalid loan application');

    const isChairman = staff.role === 'chairman';
    const status = isChairman ? 'approved' : 'pending';
    const today = this.today();

    await DB.update((bundle) => {
      bundle.loans.push({
        id: this.nextEntityId(bundle, 'loans'),
        loanNo: 'LN-' + this.nextSeq(bundle, 'loan'),
        memberId,
        productId,
        amount,
        balance: 0,
        rate: Number(in_.rate),
        months: Number(in_.months),
        status,
        applied: today,
        createdBy: staff.id,
        approvedBy: isChairman ? staff.id : null,
        approvedDate: isChairman ? today : null,
        disbursedBy: null,
        disbursedDate: null,
        disbursementReceiptNo: null,
        clientConfirmedName: null,
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async loanApprove(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Loan ID required');

    await DB.update((bundle) => {
      const loan = bundle.loans.find((l) => l.id === id && l.status === 'pending');
      if (!loan) this.err('Loan not found or already processed');
      loan.status = 'approved';
      loan.approvedBy = staff.id;
      loan.approvedDate = this.today();
    });
    return { ok: true, data: await this.loadData() };
  },

  async loanReject(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Loan ID required');

    await DB.update((bundle) => {
      const loan = bundle.loans.find((l) => l.id === id && l.status === 'pending');
      if (!loan) this.err('Loan not found or already processed');
      loan.status = 'rejected';
      loan.approvedBy = staff.id;
      loan.approvedDate = this.today();
    });
    return { ok: true, data: await this.loadData() };
  },

  async loanDisburse(in_) {
    const staff = this.requireRole('chairman', 'cashier');
    const id = Number(in_.id);
    const clientName = (in_.clientConfirmedName || '').trim();
    if (!id) this.err('Loan ID required');
    if (!clientName) this.err('Client confirmation name is required');

    let receipt;
    await DB.update((bundle) => {
      const loan = bundle.loans.find((l) => l.id === id && l.status === 'approved');
      if (!loan) this.err('Loan not found or already paid out');

      const member = bundle.members.find((m) => m.id === loan.memberId);
      const product = bundle.loanProducts.find((p) => p.id === loan.productId);
      if (!member) this.err('Member not found');
      if (!this.namesMatch(clientName, member.fullName)) {
        this.err('Client confirmation name must match the member receiving the loan');
      }

      const receiptNo = 'LRC-' + this.nextSeq(bundle, 'receipt');
      const today = this.today();
      loan.status = 'active';
      loan.balance = loan.amount;
      loan.disbursedBy = staff.id;
      loan.disbursedDate = today;
      loan.disbursementReceiptNo = receiptNo;
      loan.clientConfirmedName = clientName;

      receipt = {
        receiptNo,
        loanId: loan.loanNo,
        member: member.fullName,
        membershipNo: member.membershipNo,
        nin: member.nin,
        phone: member.phone,
        product: product?.name || 'N/A',
        amount: loan.amount,
        rate: loan.rate,
        months: loan.months,
        date: today,
        generatedBy: staff.name,
        approvedBy: this.staffName(bundle, loan.approvedBy),
        clientConfirmedName: clientName,
      };
    });
    return { ok: true, data: await this.loadData(), receipt };
  },

  async loanPay(in_) {
    const staff = this.requireRole('chairman', 'loan_officer');
    const loanId = Number(in_.loanId);
    const amount = Number(in_.amount);
    if (!loanId || amount <= 0) this.err('Invalid payment');

    await DB.update((bundle) => {
      const loan = bundle.loans.find((l) => l.id === loanId && l.status === 'active');
      if (!loan || loan.balance <= 0) this.err('Invalid loan');
      if (amount > loan.balance) this.err('Amount exceeds outstanding balance');

      loan.balance = Math.max(0, loan.balance - amount);
      if (loan.balance <= 0) loan.status = 'completed';

      bundle.loanPayments.push({
        id: this.nextEntityId(bundle, 'loanPayments'),
        loanId,
        memberId: loan.memberId,
        amount,
        date: this.today(),
        notes: in_.notes || null,
        processedBy: staff.id,
      });
    });
    return { ok: true, data: await this.loadData() };
  },

  async staffSave(in_) {
    this.requireRole('chairman');
    const id = Number(in_.id);
    const username = (in_.username || '').trim();
    const name = (in_.name || '').trim();
    const role = in_.role || '';
    const active = !!in_.active;
    const password = in_.password || '';

    if (!username || !name || !['chairman', 'loan_officer', 'cashier'].includes(role)) {
      this.err('Invalid staff data');
    }

    await DB.update((bundle) => {
      if (bundle.users.some((u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== id)) {
        this.err('Username already taken');
      }

      if (id) {
        const user = bundle.users.find((u) => u.id === id);
        if (!user) this.err('Staff account not found');
        user.username = username;
        user.fullName = name;
        user.role = role;
        user.isActive = active;
        if (password) user.password = password;
      } else {
        if (!password) this.err('Password required for new staff');
        bundle.users.push({
          id: this.nextEntityId(bundle, 'users'),
          username,
          password,
          fullName: name,
          role,
          isActive: active,
          createdAt: this.today(),
        });
      }
    });
    return { ok: true, data: await this.loadData() };
  },

  async staffToggle(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (id === staff.id) this.err('You cannot disable your own account');

    await DB.update((bundle) => {
      const user = bundle.users.find((u) => u.id === id);
      if (!user) this.err('Staff account not found');
      user.isActive = !user.isActive;
    });
    return { ok: true, data: await this.loadData() };
  },

  async staffDelete(in_) {
    const staff = this.requireRole('chairman');
    const id = Number(in_.id);
    if (!id) this.err('Staff ID required');
    if (id === staff.id) this.err('You cannot delete your own account');

    await DB.update((bundle) => {
      const target = bundle.users.find((u) => u.id === id);
      if (!target) this.err('Staff account not found');
      if (target.role === 'chairman') {
        const others = bundle.users.filter((u) => u.role === 'chairman' && u.id !== id);
        if (!others.length) this.err('Cannot delete the only chairman account');
      }
      bundle.users = bundle.users.filter((u) => u.id !== id);
    });
    return { ok: true, data: await this.loadData() };
  },
};
