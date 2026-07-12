import express from 'express';
import db from '../config/db.js';

const router = express.Router();

/* ==========================================================================
   AUTH API
   ========================================================================== */

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  try {
    const { data: admin, error } = await db
      .from('administrators')
      .select('id, username, name, house_number')
      .eq('username', username.toLowerCase().trim())
      .eq('password', password)
      .maybeSingle();

    if (error) throw error;
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   PROPERTIES API
   ========================================================================== */

router.get('/properties', async (req, res) => {
  try {
    const { data: properties, error } = await db.from('properties').select('*');
    if (error) throw error;

    // Sort properties by the numeric part of apartment_code
    properties.sort((a, b) => {
      const numA = parseInt(a.apartment_code.substring(5)) || 0;
      const numB = parseInt(b.apartment_code.substring(5)) || 0;
      return numA - numB;
    });

    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/properties', async (req, res) => {
  const { apartment_code, owner_name, phone } = req.body;
  if (!apartment_code || !owner_name) {
    return res.status(400).json({ error: 'apartment_code and owner_name are required' });
  }
  try {
    const { data: prop, error } = await db
      .from('properties')
      .insert({ apartment_code, owner_name, phone })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(prop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/properties/:id', async (req, res) => {
  const { id } = req.params;
  const { owner_name, phone } = req.body;
  try {
    const { data: prop, error } = await db
      .from('properties')
      .update({ owner_name, phone })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(prop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/properties/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await db.from('properties').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Propiedad eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   BANK ACCOUNTS API
   ========================================================================== */

router.get('/bank-accounts', async (req, res) => {
  try {
    const { data: accounts, error } = await db.from('bank_accounts').select('*').order('id', { ascending: true });
    if (error) throw error;
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bank-accounts', async (req, res) => {
  const { bank_name, account_number, account_holder, currency, balance } = req.body;
  if (!bank_name || !account_number || !account_holder) {
    return res.status(400).json({ error: 'bank_name, account_number, account_holder are required' });
  }
  const parseLocalFloat = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = val.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };
  try {
    const { data: account, error } = await db
      .from('bank_accounts')
      .insert({
        bank_name,
        account_number,
        account_holder,
        currency,
        balance: parseLocalFloat(balance)
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/bank-accounts/:id', async (req, res) => {
  const { id } = req.params;
  const { bank_name, account_number, account_holder, currency, balance } = req.body;
  const parseLocalFloat = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = val.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };
  try {
    const { data: account, error } = await db
      .from('bank_accounts')
      .update({
        bank_name,
        account_number,
        account_holder,
        currency,
        balance: parseLocalFloat(balance)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/bank-accounts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await db.from('bank_accounts').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Cuenta bancaria eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   SERVICES API
   ========================================================================== */

router.get('/services', async (req, res) => {
  try {
    const { data: services, error } = await db.from('services').select('*').order('id', { ascending: true });
    if (error) throw error;
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/services', async (req, res) => {
  const { name, description, default_amount } = req.body;
  if (!name || default_amount === undefined || default_amount === null) {
    return res.status(400).json({ error: 'name and default_amount are required' });
  }

  const cost = parseFloat(default_amount);

  try {
    // 1. Insert service
    const { data: service, error: servErr } = await db.from('services').insert({ name, description, default_amount: cost }).select().single();
    if (servErr) throw servErr;
    const serviceId = service.id;

    // 2. Get all properties
    const { data: properties, error: propErr } = await db.from('properties').select('id');
    if (propErr) throw propErr;

    const amountPerHouse = properties.length > 0 ? (cost / properties.length) : 0;

    // 3. Create debt rows for each property
    const debtRows = properties.map(prop => ({
      property_id: prop.id,
      service_id: serviceId,
      amount: amountPerHouse,
      status: 'pending'
    }));

    if (debtRows.length > 0) {
      const { error: debtErr } = await db.from('debts').insert(debtRows);
      if (debtErr) {
        // Rollback service insert manually
        await db.from('services').delete().eq('id', serviceId);
        throw debtErr;
      }
    }

    res.status(201).json({ id: serviceId, name, description, default_amount: cost, generatedDebtsCount: properties.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/services/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await db.from('services').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Servicio y deudas asociadas eliminados con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   DEBTS API
   ========================================================================== */

router.get('/debts', async (req, res) => {
  const { property_id, status } = req.query;
  try {
    let queryBuilder = db.from('debts').select(`
      *,
      properties (apartment_code, owner_name),
      services (name)
    `);

    if (property_id) {
      queryBuilder = queryBuilder.eq('property_id', property_id);
    }
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: debts, error } = await queryBuilder;
    if (error) throw error;

    // Format like the original database rows and sort
    const formatted = debts.map(d => ({
      id: d.id,
      property_id: d.property_id,
      service_id: d.service_id,
      amount: d.amount,
      status: d.status,
      created_at: d.created_at,
      apartment_code: d.properties?.apartment_code,
      owner_name: d.properties?.owner_name,
      service_name: d.services?.name
    }));

    formatted.sort((a, b) => {
      const numA = parseInt(a.apartment_code?.substring(5)) || 0;
      const numB = parseInt(b.apartment_code?.substring(5)) || 0;
      if (numA !== numB) return numA - numB;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   PAYMENTS (INCOME) API
   ========================================================================== */

router.post('/payments', async (req, res) => {
  const { debt_id, bank_account_id, amount_paid, payment_date, payment_method, reference_number, exchange_rate, commission } = req.body;
  if (!debt_id || !bank_account_id || !amount_paid || !payment_date || !payment_method) {
    return res.status(400).json({ error: 'debt_id, bank_account_id, amount_paid, payment_date, payment_method are required' });
  }

  if (payment_method !== 'Pago Móvil' && payment_method !== 'Transferencia') {
    return res.status(400).json({ error: 'El método de pago debe ser Pago Móvil o Transferencia' });
  }

  try {
    // 1. Get debt
    const { data: debt, error: debtErr } = await db.from('debts').select('*').eq('id', debt_id).maybeSingle();
    if (debtErr) throw debtErr;
    if (!debt) throw new Error('Deuda no encontrada');
    if (debt.status === 'paid') throw new Error('Esta deuda ya ha sido pagada');

    // 2. Get bank account
    const { data: account, error: accErr } = await db.from('bank_accounts').select('*').eq('id', bank_account_id).maybeSingle();
    if (accErr) throw accErr;
    if (!account) throw new Error('Cuenta bancaria no encontrada');

    // 3. Update debt status
    const { error: updateDebtErr } = await db.from('debts').update({ status: 'paid' }).eq('id', debt_id);
    if (updateDebtErr) throw updateDebtErr;

    // 4. Update bank account balance
    const commissionVal = parseFloat(commission || 0);
    const netAmount = parseFloat(amount_paid) - commissionVal;
    const newBalance = account.balance + netAmount;
    const { error: updateAccErr } = await db.from('bank_accounts').update({ balance: newBalance }).eq('id', bank_account_id);
    if (updateAccErr) {
      // Rollback debt status
      await db.from('debts').update({ status: 'pending' }).eq('id', debt_id);
      throw updateAccErr;
    }

    // 5. Create payment
    const { data: payment, error: payErr } = await db.from('payments').insert({
      debt_id,
      bank_account_id,
      amount_paid: parseFloat(amount_paid),
      payment_date,
      payment_method,
      reference_number,
      exchange_rate: parseFloat(exchange_rate || 1),
      commission: commissionVal
    }).select().single();

    if (payErr) {
      // Rollback balance and debt
      await db.from('bank_accounts').update({ balance: account.balance }).eq('id', bank_account_id);
      await db.from('debts').update({ status: 'pending' }).eq('id', debt_id);
      throw payErr;
    }

    res.status(201).json({
      id: payment.id,
      debt_id,
      bank_account_id,
      amount_paid,
      new_account_balance: newBalance,
      account_currency: account.currency,
      account_name: account.bank_name,
      payment_date,
      payment_method,
      reference_number
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const { data: payments, error } = await db.from('payments').select(`
      *,
      debts (
        property_id,
        service_id,
        properties (apartment_code, owner_name),
        services (name)
      ),
      bank_accounts (bank_name, account_holder, currency)
    `).order('payment_date', { ascending: false }).order('id', { ascending: false });

    if (error) throw error;

    const formatted = payments.map(pay => ({
      id: pay.id,
      debt_id: pay.debt_id,
      bank_account_id: pay.bank_account_id,
      amount_paid: pay.amount_paid,
      payment_date: pay.payment_date,
      payment_method: pay.payment_method,
      reference_number: pay.reference_number,
      exchange_rate: pay.exchange_rate,
      commission: pay.commission,
      created_at: pay.created_at,
      apartment_code: pay.debts?.properties?.apartment_code,
      owner_name: pay.debts?.properties?.owner_name,
      service_name: pay.debts?.services?.name,
      bank_name: pay.bank_accounts?.bank_name,
      account_holder: pay.bank_accounts?.account_holder,
      account_currency: pay.bank_accounts?.currency
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   EXPENSES API
   ========================================================================== */

router.post('/expenses', async (req, res) => {
  const { bank_account_id, description, amount, expense_date, reference_number, payment_method, commission } = req.body;
  if (!bank_account_id || !description || !amount || !expense_date) {
    return res.status(400).json({ error: 'bank_account_id, description, amount, expense_date are required' });
  }

  const expenseAmount = parseFloat(amount);
  const commissionVal = parseFloat(commission || 0);

  try {
    // 1. Get bank account
    const { data: account, error: accErr } = await db.from('bank_accounts').select('*').eq('id', bank_account_id).maybeSingle();
    if (accErr) throw accErr;
    if (!account) throw new Error('Cuenta bancaria no encontrada');

    // 2. Update balance (deduct both amount and commission)
    const newBalance = account.balance - (expenseAmount + commissionVal);
    const { error: updateAccErr } = await db.from('bank_accounts').update({ balance: newBalance }).eq('id', bank_account_id);
    if (updateAccErr) throw updateAccErr;

    // 3. Create expense record
    const { data: expense, error: expErr } = await db.from('expenses').insert({
      bank_account_id,
      description,
      amount: expenseAmount,
      expense_date,
      reference_number,
      payment_method: payment_method || 'Transferencia',
      commission: commissionVal
    }).select().single();

    if (expErr) {
      // Rollback bank account balance
      await db.from('bank_accounts').update({ balance: account.balance }).eq('id', bank_account_id);
      throw expErr;
    }

    res.status(201).json({
      id: expense.id,
      bank_account_id,
      description,
      amount: expenseAmount,
      commission: commissionVal,
      payment_method: payment_method || 'Transferencia',
      new_account_balance: newBalance,
      account_currency: account.currency,
      account_name: account.bank_name,
      expense_date,
      reference_number
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const { data: expenses, error } = await db.from('expenses').select(`
      *,
      bank_accounts (bank_name, account_holder, currency)
    `).order('expense_date', { ascending: false }).order('id', { ascending: false });

    if (error) throw error;

    const formatted = expenses.map(e => ({
      id: e.id,
      bank_account_id: e.bank_account_id,
      description: e.description,
      amount: e.amount,
      payment_method: e.payment_method,
      commission: e.commission,
      expense_date: e.expense_date,
      reference_number: e.reference_number,
      created_at: e.created_at,
      bank_name: e.bank_accounts?.bank_name,
      account_holder: e.bank_accounts?.account_holder,
      account_currency: e.bank_accounts?.currency
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   DASHBOARD / SUMMARY API
   ========================================================================== */

router.get('/dashboard/summary', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    // 1. Total funds (aggregated in Bs. and USD separately)
    const { data: accounts, error: accErr } = await db.from('bank_accounts').select('balance, currency');
    if (accErr) throw accErr;
    let totalBs = 0;
    let totalUsd = 0;
    accounts.forEach(acc => {
      if (acc.currency === 'Bs') totalBs += acc.balance;
      else if (acc.currency === 'USD' || acc.currency === '$') totalUsd += acc.balance;
    });

    // 2. Total pending debt
    const { data: pendingDebts, error: debtErr } = await db.from('debts').select('amount').eq('status', 'pending');
    if (debtErr) throw debtErr;
    const totalPendingDebt = pendingDebts.reduce((sum, d) => sum + d.amount, 0);

    // 2.5. Total payments received (within date range if provided)
    let payBsQuery = db.from('payments').select('amount_paid');
    let payUsdQuery = db.from('payments').select('debts(amount)');
    if (startDate && endDate) {
      payBsQuery = payBsQuery.gte('payment_date', startDate).lte('payment_date', endDate);
      payUsdQuery = payUsdQuery.gte('payment_date', startDate).lte('payment_date', endDate);
    }
    const { data: payBsData, error: payBsErr } = await payBsQuery;
    if (payBsErr) throw payBsErr;
    const { data: payUsdData, error: payUsdErr } = await payUsdQuery;
    if (payUsdErr) throw payUsdErr;

    const totalPaymentsBs = payBsData.reduce((sum, p) => sum + p.amount_paid, 0);
    const totalPaymentsUsd = payUsdData.reduce((sum, p) => sum + (p.debts?.amount || 0), 0);

    // 2.7. Total expenses paid (within date range if provided)
    let expenseSumQuery = db.from('expenses').select('amount, commission');
    if (startDate && endDate) {
      expenseSumQuery = expenseSumQuery.gte('expense_date', startDate).lte('expense_date', endDate);
    }
    const { data: expSumData, error: expSumErr } = await expenseSumQuery;
    if (expSumErr) throw expSumErr;
    const totalExpenses = expSumData.reduce((sum, e) => sum + e.amount + (e.commission || 0), 0);

    // 3. Properties stats
    const { count: totalProperties, error: countErr } = await db.from('properties').select('*', { count: 'exact', head: true });
    if (countErr) throw countErr;

    // 4. Properties fully paid vs those with pending debts
    const { data: uniquePropsWithDebt, error: uniqueDebtErr } = await db.from('debts').select('property_id').eq('status', 'pending');
    if (uniqueDebtErr) throw uniqueDebtErr;
    const propIdsWithDebt = new Set(uniquePropsWithDebt.map(d => d.property_id));
    const propertiesWithDebt = propIdsWithDebt.size;
    const propertiesUpToDate = Math.max(0, (totalProperties || 0) - propertiesWithDebt);

    // 5. Transactions (filtered by date range if provided)
    let recentPaymentsQuery = db.from('payments').select(`
      amount_paid,
      payment_date,
      debts (
        services (name),
        properties (apartment_code, owner_name)
      ),
      bank_accounts (currency)
    `);
    if (startDate && endDate) {
      recentPaymentsQuery = recentPaymentsQuery.gte('payment_date', startDate).lte('payment_date', endDate);
    }
    recentPaymentsQuery = recentPaymentsQuery.order('payment_date', { ascending: false }).order('id', { ascending: false });
    if (!startDate) {
      recentPaymentsQuery = recentPaymentsQuery.limit(5);
    }
    const { data: recentPaymentsData, error: recPayErr } = await recentPaymentsQuery;
    if (recPayErr) throw recPayErr;

    const recentPayments = (recentPaymentsData || []).map(pay => ({
      type: 'income',
      amount: pay.amount_paid,
      date: pay.payment_date,
      detail: `${pay.debts?.properties?.apartment_code || ''} - ${pay.debts?.properties?.owner_name || ''}`,
      concept: pay.debts?.services?.name || 'Servicio',
      account_currency: pay.bank_accounts?.currency
    }));

    let recentExpensesQuery = db.from('expenses').select(`
      amount,
      commission,
      expense_date,
      description,
      bank_accounts (currency)
    `);
    if (startDate && endDate) {
      recentExpensesQuery = recentExpensesQuery.gte('expense_date', startDate).lte('expense_date', endDate);
    }
    recentExpensesQuery = recentExpensesQuery.order('expense_date', { ascending: false }).order('id', { ascending: false });
    if (!startDate) {
      recentExpensesQuery = recentExpensesQuery.limit(5);
    }
    const { data: recentExpensesData, error: recExpErr } = await recentExpensesQuery;
    if (recExpErr) throw recExpErr;

    const recentExpenses = (recentExpensesData || []).map(e => ({
      type: 'expense',
      amount: e.amount + (e.commission || 0),
      date: e.expense_date,
      detail: e.description + (e.commission ? ` (Comisión: ${e.commission} Bs.)` : ''),
      concept: 'Gasto Común',
      account_currency: e.bank_accounts?.currency
    }));

    // Combine and sort by date descending
    const recentActivity = [...recentPayments, ...recentExpenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivitySliced = startDate ? recentActivity : recentActivity.slice(0, 5);

    res.json({
      totalBs,
      totalUsd,
      totalPendingDebt,
      totalPaymentsBs,
      totalPaymentsUsd,
      totalExpenses,
      totalProperties: totalProperties || 0,
      propertiesUpToDate,
      propertiesWithDebt,
      recentActivity: recentActivitySliced
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
