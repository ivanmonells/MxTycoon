/* MX Tycoon - Economy: monthly ledger by category, cash history, loans, prices. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U;

  const INCOME = {
    entradas: 'Entradas', tarifas: 'Tarifas de pilotos', abonos: 'Abonos de temporada', inscripciones: 'Inscripciones',
    comida: 'Comida y bebida', merch: 'Merchandising', taller: 'Taller', escuela: 'Escuela MX', camping: 'Camping',
    aparcamiento: 'Aparcamiento', patrocinio: 'Patrocinios', eventos: 'Eventos y TV', subvenciones: 'Subvenciones', otros: 'Otros ingresos'
  };
  const EXPENSE = {
    construccion: 'Construcción', terreno: 'Terreno y movimientos', sueldos: 'Sueldos', mantenimiento: 'Mantenimiento',
    suministros: 'Suministros', marketing: 'Marketing', investigacion: 'Investigación', eventos: 'Organización de eventos',
    premios: 'Premios', intereses: 'Intereses', multas: 'Multas', otros: 'Otros gastos'
  };

  function emptyMonth(index) {
    const r = { index, income: {}, expense: {} };
    for (const k in INCOME) r.income[k] = 0;
    for (const k in EXPENSE) r.expense[k] = 0;
    return r;
  }

  class Economy {
    constructor(money) {
      this.money = money;
      this.loan = 0;
      this.maxLoan = 100000;
      this.month = emptyMonth(0);
      this.history = [];
      this.cash = [];        // daily samples {d, m}
      this.negDays = 0;
      this.prices = { ticket: 12, riderFee: 28, pass: 80, food: 1.0, merch: 1.0, parking: 0 };
      this.totalIncome = 0; this.totalExpense = 0;
    }
    earn(cat, amount) {
      if (!amount) return;
      if (!(cat in this.month.income)) cat = 'otros';
      this.month.income[cat] += amount;
      this.money += amount;
      this.totalIncome += amount;
    }
    spend(cat, amount) {
      if (!amount) return;
      if (!(cat in this.month.expense)) cat = 'otros';
      this.month.expense[cat] += amount;
      this.money -= amount;
      this.totalExpense += amount;
    }
    refund(cat, amount) {
      /* refunds reduce the expense category of the month (never below zero) */
      if (!(cat in this.month.expense)) cat = 'otros';
      const back = Math.min(this.month.expense[cat], amount);
      this.month.expense[cat] -= back;
      this.month.income.otros += amount - back;
      this.money += amount;
    }
    sumIncome(m) { m = m || this.month; let s = 0; for (const k in m.income) s += m.income[k]; return s; }
    sumExpense(m) { m = m || this.month; let s = 0; for (const k in m.expense) s += m.expense[k]; return s; }
    profit(m) { return this.sumIncome(m) - this.sumExpense(m); }
    closeMonth(nextIndex) {
      this.history.push(this.month);
      if (this.history.length > 36) this.history.shift();
      const closed = this.month;
      this.month = emptyMonth(nextIndex);
      return closed;
    }
    sampleCash(day) {
      this.cash.push({ d: day, m: Math.round(this.money) });
      if (this.cash.length > 400) this.cash.shift();
    }
    /* monthly interest on the loan */
    interest() { return Math.round(this.loan * C.LOAN_RATE_YEAR / 12); }
    takeLoan(amount) {
      amount = Math.min(amount, this.maxLoan - this.loan);
      if (amount <= 0) return 0;
      this.loan += amount; this.money += amount;
      return amount;
    }
    repayLoan(amount) {
      amount = Math.min(amount, this.loan, Math.max(0, this.money));
      if (amount <= 0) return 0;
      this.loan -= amount; this.money -= amount;
      return amount;
    }
    serialize() {
      return { money: this.money, loan: this.loan, maxLoan: this.maxLoan, month: this.month, history: this.history, cash: this.cash, negDays: this.negDays, prices: this.prices, ti: this.totalIncome, te: this.totalExpense };
    }
    static deserialize(d) {
      const e = new Economy(d.money);
      Object.assign(e, { loan: d.loan, maxLoan: d.maxLoan, month: d.month, history: d.history || [], cash: d.cash || [], negDays: d.negDays || 0 });
      e.prices = Object.assign(e.prices, d.prices || {});
      e.totalIncome = d.ti || 0; e.totalExpense = d.te || 0;
      for (const k in INCOME) if (!(k in e.month.income)) e.month.income[k] = 0;
      for (const k in EXPENSE) if (!(k in e.month.expense)) e.month.expense[k] = 0;
      return e;
    }
  }
  Economy.INCOME = INCOME;
  Economy.EXPENSE = EXPENSE;
  MX.Economy = Economy;
  void U;
})(window.MX);
