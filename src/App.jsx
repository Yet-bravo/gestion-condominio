import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Wallet, 
  FileSpreadsheet, 
  TrendingDown, 
  Plus, 
  Search, 
  Check, 
  AlertCircle, 
  Trash2, 
  Users, 
  DollarSign,
  Lock,
  LogOut,
  Sun,
  Moon,
  Edit
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { createClient } from '@supabase/supabase-js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hulaqkvbbzdrailrcoih.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bGFxa3ZiYnpkcmFpbHJjb2loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc5MzE3MiwiZXhwIjoyMDk5MzY5MTcyfQ.tYZTXteH4AHVLcfcurGbjh-B03hHbJQ7eIfg4fIK4M0';

const supabase = createClient(supabaseUrl, supabaseKey);

const parseLocalFloat = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  let str = val.toString().trim();
  
  // Find position of separators
  const commaIdx = str.lastIndexOf(',');
  const dotIdx = str.lastIndexOf('.');
  
  if (commaIdx > dotIdx) {
    // Comma is decimal separator (e.g. 5.000,25) -> remove dots, replace comma with dot
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (dotIdx > commaIdx) {
    // Dot is decimal separator (e.g. 5,000.25 or 5.000)
    if (commaIdx !== -1) {
      // 5,000.25 -> remove comma
      str = str.replace(/,/g, '');
    } else {
      // No comma, only dot (e.g. "5.000" or "5.00")
      // In Venezuela financial contexts, 3 decimal places is never cents, it's thousands separator!
      const match = str.match(/\.(\d{3})$/);
      if (match) {
        str = str.replace('.', '');
      }
    }
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const maskCurrency = (value) => {
  if (value === undefined || value === null) return '';
  const strVal = value.toString();
  // Strip all non-digits
  const digits = strVal.replace(/\D/g, '');
  if (!digits) return '';
  
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('condo_theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('condo_theme', theme);
  }, [theme]);

  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('condo_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // App States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState({
    totalBs: 0,
    totalUsd: 0,
    totalPendingDebt: 0,
    totalPaymentsBs: 0,
    totalPaymentsUsd: 0,
    totalExpenses: 0,
    totalProperties: 0,
    propertiesUpToDate: 0,
    propertiesWithDebt: 0,
    recentActivity: []
  });
  const [properties, setProperties] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [services, setServices] = useState([]);
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Search & Filter
  const [searchProperty, setSearchProperty] = useState('');
  const [debtFilter, setDebtFilter] = useState('all');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  
  // Date range filters for dashboard summary metrics
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Tasa BCV del día
  const [bcvRate, setBcvRate] = useState(() => {
    const saved = localStorage.getItem('condo_bcv_rate');
    return saved || '46.50';
  });

  const handleSyncBcvRate = async () => {
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const data = await res.json();
      if (data && data.promedio) {
        const rate = data.promedio.toString();
        setBcvRate(rate);
        localStorage.setItem('condo_bcv_rate', rate);
      }
    } catch (err) {
      console.error('Error actualizando la tasa BCV:', err);
    }
  };

  useEffect(() => {
    // Buscar la tasa BCV automáticamente si no se ha guardado una
    if (!localStorage.getItem('condo_bcv_rate')) {
      handleSyncBcvRate();
    }
  }, []);

  // Modals
  const [modals, setModals] = useState({
    property: false,
    bankAccount: false,
    service: false,
    payment: false,
    expense: false
  });

  // Success alert for new account balance
  const [balanceAlert, setBalanceAlert] = useState(null);

  // Custom confirm dialog state (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null);
  // confirmDialog: { message, onConfirm, type: 'danger'|'warning' }

  const openConfirm = (message, onConfirm, type = 'danger') => {
    setConfirmDialog({ message, onConfirm, type });
  };
  const closeConfirm = () => setConfirmDialog(null);

  // Error/notification dialog state (replaces alert)
  const [notifDialog, setNotifDialog] = useState(null);
  const openNotif = (message, type = 'error') => setNotifDialog({ message, type });
  const closeNotif = () => setNotifDialog(null);
  
  // Property edit state
  const [editingPropertyId, setEditingPropertyId] = useState(null);

  // Forms
  const [propertyForm, setPropertyForm] = useState({ apartment_code: '', owner_name: '', phone: '' });
  const [bankAccountForm, setBankAccountForm] = useState({ bank_name: '', account_number: '', account_holder: '', currency: 'Bs', balance: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', default_amount: '' });
  const [paymentForm, setPaymentForm] = useState({ 
    debt_id: '', 
    bank_account_id: '', 
    amount_paid: '', 
    payment_date: new Date().toISOString().split('T')[0], 
    payment_method: 'Pago Móvil',
    reference_number: '',
    exchange_rate: '',
    commission: '0.00'
  });
  const [expenseForm, setExpenseForm] = useState({ 
    bank_account_id: '', 
    description: '', 
    amount: '', 
    expense_date: new Date().toISOString().split('T')[0], 
    reference_number: '',
    payment_method: 'Transferencia',
    commission: '0,00'
  });

  // Load Data
  const fetchData = async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch properties
      const { data: propertiesData, error: propErr } = await supabase.from('properties').select('*');
      if (propErr) throw propErr;
      propertiesData.sort((a, b) => {
        const numA = parseInt(a.apartment_code.substring(5)) || 0;
        const numB = parseInt(b.apartment_code.substring(5)) || 0;
        return numA - numB;
      });

      // 2. Fetch bank accounts
      const { data: bankAccountsData, error: bankErr } = await supabase.from('bank_accounts').select('*').order('id', { ascending: true });
      if (bankErr) throw bankErr;

      // 3. Fetch services
      const { data: servicesData, error: servErr } = await supabase.from('services').select('*').order('id', { ascending: true });
      if (servErr) throw servErr;

      // 4. Fetch debts
      const { data: rawDebts, error: debtErr } = await supabase.from('debts').select(`
        *,
        properties (apartment_code, owner_name),
        services (name)
      `);
      if (debtErr) throw debtErr;

      const debtsData = rawDebts.map(d => ({
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
      debtsData.sort((a, b) => {
        const numA = parseInt(a.apartment_code?.substring(5)) || 0;
        const numB = parseInt(b.apartment_code?.substring(5)) || 0;
        if (numA !== numB) return numA - numB;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // 5. Fetch payments
      const { data: rawPayments, error: payErr } = await supabase.from('payments').select(`
        *,
        debts (
          property_id,
          service_id,
          properties (apartment_code, owner_name),
          services (name)
        ),
        bank_accounts (bank_name, account_holder, currency)
      `).order('payment_date', { ascending: false }).order('id', { ascending: false });
      if (payErr) throw payErr;

      const paymentsData = rawPayments.map(pay => ({
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

      // 6. Fetch expenses
      const { data: rawExpenses, error: expErr } = await supabase.from('expenses').select(`
        *,
        bank_accounts (bank_name, account_holder, currency)
      `).order('expense_date', { ascending: false }).order('id', { ascending: false });
      if (expErr) throw expErr;

      const expensesData = rawExpenses.map(e => ({
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

      // 7. Calculate Dashboard Summary values locally
      let totalBs = 0;
      let totalUsd = 0;
      bankAccountsData.forEach(acc => {
        if (acc.currency === 'Bs') totalBs += acc.balance;
        else if (acc.currency === 'USD' || acc.currency === '$') totalUsd += acc.balance;
      });

      const totalPendingDebt = debtsData.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0);

      // Filter payments and expenses by date range for the summary if defined
      let filteredPayments = paymentsData;
      let filteredExpenses = expensesData;
      if (startDate && endDate) {
        filteredPayments = paymentsData.filter(p => p.payment_date >= startDate && p.payment_date <= endDate);
        filteredExpenses = expensesData.filter(e => e.expense_date >= startDate && e.expense_date <= endDate);
      }

      const totalPaymentsBs = filteredPayments.reduce((sum, p) => sum + p.amount_paid, 0);
      
      // Sum the debt amount (USD) corresponding to the paid debts
      let totalPaymentsUsd = 0;
      filteredPayments.forEach(p => {
        const matchingRawPay = rawPayments.find(rp => rp.id === p.id);
        if (matchingRawPay && matchingRawPay.debts) {
          totalPaymentsUsd += matchingRawPay.debts.amount || 0;
        }
      });

      const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount + (e.commission || 0), 0);

      const totalProperties = propertiesData.length;
      const propertiesWithDebt = new Set(debtsData.filter(d => d.status === 'pending').map(d => d.property_id)).size;
      const propertiesUpToDate = Math.max(0, totalProperties - propertiesWithDebt);

      // Recent Activity
      const mappedRecentPayments = filteredPayments.map(p => ({
        type: 'income',
        amount: p.amount_paid,
        date: p.payment_date,
        detail: `${p.apartment_code || ''} - ${p.owner_name || ''}`,
        concept: p.service_name || 'Servicio',
        account_currency: p.account_currency
      }));

      const mappedRecentExpenses = filteredExpenses.map(e => ({
        type: 'expense',
        amount: e.amount + (e.commission || 0),
        date: e.expense_date,
        detail: e.description + (e.commission ? ` (Comisión: ${e.commission} Bs.)` : ''),
        concept: 'Gasto Común',
        account_currency: e.account_currency
      }));

      const recentActivity = [...mappedRecentPayments, ...mappedRecentExpenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const recentActivitySliced = startDate ? recentActivity : recentActivity.slice(0, 5);

      setSummary({
        totalBs,
        totalUsd,
        totalPendingDebt,
        totalPaymentsBs,
        totalPaymentsUsd,
        totalExpenses,
        totalProperties,
        propertiesUpToDate,
        propertiesWithDebt,
        recentActivity: recentActivitySliced
      });

      setProperties(propertiesData);
      setBankAccounts(bankAccountsData);
      setServices(servicesData);
      setDebts(debtsData);
      setPayments(paymentsData);
      setExpenses(expensesData);
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, startDate, endDate]);

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const { data: user, error } = await supabase.from('users').select('*').eq('username', loginForm.username).eq('password', loginForm.password).maybeSingle();
      if (error) throw error;
      if (!user) {
        setLoginError('Credenciales incorrectas');
        return;
      }
      setCurrentUser(user);
      localStorage.setItem('condo_user', JSON.stringify(user));
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('condo_user');
  };

  // API Call Handlers
  const handlePropertySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPropertyId) {
        const { error } = await supabase.from('properties').update(propertyForm).eq('id', editingPropertyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties').insert(propertyForm);
        if (error) throw error;
      }
      setPropertyForm({ apartment_code: '', owner_name: '', phone: '' });
      setEditingPropertyId(null);
      setModals({ ...modals, property: false });
      fetchData();
    } catch (err) {
      openNotif(err.message || 'Error al procesar la casa/propiedad');
    }
  };

  const handleOpenEditProperty = (prop) => {
    setEditingPropertyId(prop.id);
    setPropertyForm({
      apartment_code: prop.apartment_code,
      owner_name: prop.owner_name,
      phone: prop.phone || ''
    });
    setModals({ ...modals, property: true });
  };

  const handleOpenAddProperty = () => {
    setEditingPropertyId(null);
    setPropertyForm({ apartment_code: '', owner_name: '', phone: '' });
    setModals({ ...modals, property: true });
  };

  const handleCreateBankAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...bankAccountForm,
        balance: parseLocalFloat(bankAccountForm.balance)
      };
      const { error } = await supabase.from('bank_accounts').insert(payload);
      if (error) throw error;
      setBankAccountForm({ bank_name: '', account_number: '', account_holder: '', currency: 'Bs', balance: '' });
      setModals({ ...modals, bankAccount: false });
      fetchData();
    } catch (err) {
      openNotif(err.message || 'Error al crear la cuenta bancaria');
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const cost = parseLocalFloat(serviceForm.default_amount);
      // 1. Insert service
      const { data: service, error: servErr } = await supabase.from('services').insert({
        name: serviceForm.name,
        description: serviceForm.description,
        default_amount: cost
      }).select().single();
      if (servErr) throw servErr;
      const serviceId = service.id;

      // 2. Get all properties
      const { data: properties, error: propErr } = await supabase.from('properties').select('id');
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
        const { error: debtErr } = await supabase.from('debts').insert(debtRows);
        if (debtErr) {
          await supabase.from('services').delete().eq('id', serviceId);
          throw debtErr;
        }
      }

      setServiceForm({ name: '', description: '', default_amount: '' });
      setModals({ ...modals, service: false });
      fetchData();
    } catch (err) {
      openNotif(err.message || 'Error al crear el cobro/servicio');
    }
  };

  const handlePaymentDebtChange = (debtId) => {
    const selectedDebt = debts.find(d => d.id === parseInt(debtId));
    if (selectedDebt) {
      const rate = parseFloat(paymentForm.exchange_rate) || 0;
      const computedAmount = rate ? (selectedDebt.amount * rate).toFixed(2) : '';
      
      let computedComm = 0;
      if (paymentForm.payment_method === 'Pago Móvil' && computedAmount) {
        computedComm = Math.max(2.00, parseFloat(computedAmount) * 0.003).toFixed(2);
      }

      setPaymentForm({
        ...paymentForm,
        debt_id: debtId,
        amount_paid: computedAmount ? maskCurrency(computedAmount) : '',
        commission: computedComm ? maskCurrency(computedComm) : '0,00'
      });
    } else {
      setPaymentForm({
        ...paymentForm,
        debt_id: '',
        amount_paid: '',
        commission: '0,00'
      });
    }
  };

  const handlePaymentRateChange = (rateStr) => {
    const rate = parseFloat(rateStr) || 0;
    const selectedDebt = debts.find(d => d.id === parseInt(paymentForm.debt_id));
    const computedAmount = (selectedDebt && rate) ? (selectedDebt.amount * rate).toFixed(2) : '';
    
    let computedComm = 0;
    if (paymentForm.payment_method === 'Pago Móvil' && computedAmount) {
      computedComm = Math.max(2.00, parseFloat(computedAmount) * 0.003).toFixed(2);
    }

    setPaymentForm({
      ...paymentForm,
      exchange_rate: rateStr,
      amount_paid: computedAmount ? maskCurrency(computedAmount) : '',
      commission: computedComm ? maskCurrency(computedComm) : '0,00'
    });
  };

  const handlePaymentAmountChange = (amountStr) => {
    const masked = maskCurrency(amountStr);
    const val = parseLocalFloat(masked);
    let computedComm = 0;
    if (paymentForm.payment_method === 'Pago Móvil' && val) {
      computedComm = Math.max(2.00, val * 0.003).toFixed(2);
    }

    setPaymentForm({
      ...paymentForm,
      amount_paid: masked,
      commission: computedComm ? maskCurrency(computedComm) : '0,00'
    });
  };

  const handlePaymentMethodChange = (method) => {
    let computedComm = 0;
    const val = parseLocalFloat(paymentForm.amount_paid);
    if (method === 'Pago Móvil' && val) {
      computedComm = Math.max(2.00, val * 0.003).toFixed(2);
    }

    setPaymentForm({
      ...paymentForm,
      payment_method: method,
      commission: computedComm ? maskCurrency(computedComm) : '0,00'
    });
  };

  const handleRegisterPayment = async (e) => {
    e.preventDefault();
    try {
      if (!paymentForm.debt_id || !paymentForm.bank_account_id || !paymentForm.amount_paid) {
        throw new Error('Todos los campos son requeridos');
      }

      // 1. Get debt
      const { data: debt, error: debtErr } = await supabase.from('debts').select('*').eq('id', paymentForm.debt_id).maybeSingle();
      if (debtErr) throw debtErr;
      if (!debt) throw new Error('Deuda no encontrada');
      if (debt.status === 'paid') throw new Error('Esta deuda ya ha sido pagada');

      // 2. Get bank account
      const { data: account, error: accErr } = await supabase.from('bank_accounts').select('*').eq('id', paymentForm.bank_account_id).maybeSingle();
      if (accErr) throw accErr;
      if (!account) throw new Error('Cuenta bancaria no encontrada');

      // 3. Update debt status
      const { error: updateDebtErr } = await supabase.from('debts').update({ status: 'paid' }).eq('id', paymentForm.debt_id);
      if (updateDebtErr) throw updateDebtErr;

      // 4. Update bank account balance
      const commissionVal = parseLocalFloat(paymentForm.commission);
      const amountPaidVal = parseLocalFloat(paymentForm.amount_paid);
      const netAmount = amountPaidVal - commissionVal;
      const newBalance = account.balance + netAmount;
      const { error: updateAccErr } = await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', paymentForm.bank_account_id);
      if (updateAccErr) {
        await supabase.from('debts').update({ status: 'pending' }).eq('id', paymentForm.debt_id);
        throw updateAccErr;
      }

      // 5. Create payment
      const { data: payment, error: payErr } = await supabase.from('payments').insert({
        debt_id: parseInt(paymentForm.debt_id),
        bank_account_id: parseInt(paymentForm.bank_account_id),
        amount_paid: amountPaidVal,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number,
        exchange_rate: parseLocalFloat(paymentForm.exchange_rate) || 1,
        commission: commissionVal
      }).select().single();

      if (payErr) {
        await supabase.from('bank_accounts').update({ balance: account.balance }).eq('id', paymentForm.bank_account_id);
        await supabase.from('debts').update({ status: 'pending' }).eq('id', paymentForm.debt_id);
        throw payErr;
      }

      setPaymentForm({ 
        debt_id: '', 
        bank_account_id: '', 
        amount_paid: '', 
        payment_date: new Date().toISOString().split('T')[0], 
        payment_method: 'Pago Móvil',
        reference_number: '',
        exchange_rate: '',
        commission: '0,00'
      });
      setModals({ ...modals, payment: false });
      
      setBalanceAlert({
        message: `¡Pago Registrado! El total disponible en la cuenta ${account.bank_name} es ahora de ${formatVal(newBalance, account.currency)}`
      });
      setTimeout(() => setBalanceAlert(null), 10000);
      
      fetchData();
    } catch (err) {
      openNotif(err.message || 'Error al registrar el pago');
    }
  };

  const handleRegisterExpense = async (e) => {
    e.preventDefault();
    try {
      if (!expenseForm.bank_account_id || !expenseForm.amount || !expenseForm.description) {
        throw new Error('Todos los campos son requeridos');
      }

      // 1. Get bank account
      const { data: account, error: accErr } = await supabase.from('bank_accounts').select('*').eq('id', expenseForm.bank_account_id).maybeSingle();
      if (accErr) throw accErr;
      if (!account) throw new Error('Cuenta bancaria no encontrada');

      const expenseAmount = parseLocalFloat(expenseForm.amount);
      const commissionVal = parseLocalFloat(expenseForm.commission);

      // 2. Update balance
      const newBalance = account.balance - (expenseAmount + commissionVal);
      const { error: updateAccErr } = await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', expenseForm.bank_account_id);
      if (updateAccErr) throw updateAccErr;

      // 3. Create expense record
      const { data: expense, error: expErr } = await supabase.from('expenses').insert({
        bank_account_id: parseInt(expenseForm.bank_account_id),
        description: expenseForm.description,
        amount: expenseAmount,
        expense_date: expenseForm.expense_date,
        reference_number: expenseForm.reference_number,
        payment_method: expenseForm.payment_method || 'Transferencia',
        commission: commissionVal
      }).select().single();

      if (expErr) {
        await supabase.from('bank_accounts').update({ balance: account.balance }).eq('id', expenseForm.bank_account_id);
        throw expErr;
      }

      setExpenseForm({ 
        bank_account_id: '', 
        description: '', 
        amount: '', 
        expense_date: new Date().toISOString().split('T')[0], 
        reference_number: '',
        payment_method: 'Transferencia',
        commission: '0,00'
      });
      setModals({ ...modals, expense: false });
      
      setBalanceAlert({
        message: `¡Egreso Registrado! El total disponible en la cuenta ${account.bank_name} es ahora de ${formatVal(newBalance, account.currency)}`
      });
      setTimeout(() => setBalanceAlert(null), 10000);
      
      fetchData();
    } catch (err) {
      openNotif(err.message || 'Error al registrar el gasto');
    }
  };

  const handleExpenseAmountChange = (amountStr) => {
    const masked = maskCurrency(amountStr);
    const val = parseLocalFloat(masked);
    let computedComm = 0;
    if (expenseForm.payment_method === 'Pago Móvil' && val) {
      computedComm = Math.max(2.00, val * 0.003).toFixed(2);
    }

    setExpenseForm({
      ...expenseForm,
      amount: masked,
      commission: computedComm ? maskCurrency(computedComm) : '0,00'
    });
  };

  const handleExpenseMethodChange = (method) => {
    let computedComm = 0;
    const val = parseLocalFloat(expenseForm.amount);
    if (method === 'Pago Móvil' && val) {
      computedComm = Math.max(2.00, val * 0.003).toFixed(2);
    }

    setExpenseForm({
      ...expenseForm,
      payment_method: method,
      commission: computedComm ? maskCurrency(computedComm) : '0,00'
    });
  };

  const handleDeleteProperty = (id) => {
    openConfirm(
      '¿Seguro que deseas eliminar esta propiedad? Se borrarán todas sus deudas asociadas.',
      async () => {
        try {
          const { error } = await supabase.from('properties').delete().eq('id', id);
          if (error) throw error;
          fetchData();
        } catch (err) {
          openNotif(err.message || 'Error al eliminar la propiedad');
        }
      }
    );
  };

  const handleDeleteBankAccount = (id) => {
    openConfirm(
      '¿Seguro que deseas eliminar esta cuenta bancaria?',
      async () => {
        try {
          const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
          if (error) throw error;
          fetchData();
        } catch (err) {
          openNotif(err.message || 'Error al eliminar la cuenta bancaria');
        }
      }
    );
  };

  const handleDeleteService = (id) => {
    openConfirm(
      '¿Seguro que deseas eliminar este cobro/servicio? Se eliminarán todas las deudas pendientes asociadas.',
      async () => {
        try {
          const { error } = await supabase.from('services').delete().eq('id', id);
          if (error) throw error;
          fetchData();
        } catch (err) {
          openNotif(err.message || 'Error al eliminar el servicio');
        }
      }
    );
  };

  // Format currency functions
  const formatVal = (val, currency = 'Bs') => {
    const num = parseFloat(val) || 0;
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'Bs.';
    return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)} ${symbol}`;
  };

  // Prepare charts data
  const doughnutData = {
    labels: ['Al Día', 'Con Deuda'],
    datasets: [
      {
        data: [summary.propertiesUpToDate, summary.propertiesWithDebt],
        backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(244, 63, 94, 0.7)'],
        borderColor: ['#10b981', '#f43f5e'],
        borderWidth: 1,
      },
    ],
  };

  const barData = {
    labels: bankAccounts.map(acc => `${acc.bank_name} (${acc.currency})`),
    datasets: [
      {
        label: 'Saldo Disponible',
        data: bankAccounts.map(acc => acc.balance),
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        borderColor: '#8b5cf6',
        borderWidth: 1,
        borderRadius: 8,
      }
    ]
  };

  // If not logged in, show Login view
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--bg-app))', padding: '1.5rem' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '420px', animation: 'fadeIn 0.5s ease-out', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              type="button"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="logo-icon" style={{ display: 'inline-flex', marginBottom: '1rem', padding: '0.8rem' }}>
              <Lock size={28} />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, hsl(var(--text-secondary)))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              GESTIÓN CONDOMINIO
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '0.5rem' }}>Acceso exclusivo para administradores</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ingresa tu usuario"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            {loginError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--accent-rose))', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="logo-icon">
              <Building2 size={20} />
            </div>
            <span className="logo-text">GESTIÓN CONDOMINIO</span>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem', borderRadius: '50%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            type="button"
          >
            {theme === 'dark' ? <Sun size={18} style={{ color: 'hsl(var(--text-secondary))' }} /> : <Moon size={18} style={{ color: 'hsl(var(--text-secondary))' }} />}
          </button>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface-hover) / 0.5)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid hsl(var(--border-color))' }}>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Administrador</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'white' }}>{currentUser.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>{currentUser.house_number}</div>
        </div>
        
        <nav style={{ flexGrow: 1 }}>
          <ul className="nav-links">
            <li>
              <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                <LayoutDashboard size={20} />
                Dashboard
              </button>
            </li>
            <li>
              <button className={`nav-link ${activeTab === 'properties' ? 'active' : ''}`} onClick={() => setActiveTab('properties')}>
                <Building2 size={20} />
                Casas (Propiedades)
              </button>
            </li>
            <li>
              <button className={`nav-link ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>
                <Wallet size={20} />
                Cuentas Bancarias
              </button>
            </li>
            <li>
              <button className={`nav-link ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>
                <FileSpreadsheet size={20} />
                Cobros y Pagos
              </button>
            </li>
            <li>
              <button className={`nav-link ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
                <TrendingDown size={20} />
                Gastos y Egresos
              </button>
            </li>
          </ul>
        </nav>

        <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: 'auto', width: '100%', gap: '0.75rem' }}>
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        
        {/* Real-time Account Balance Alert */}
        {balanceAlert && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', backgroundColor: 'hsl(var(--accent-emerald) / 0.15)', borderColor: 'hsl(var(--accent-emerald) / 0.4)', animation: 'pulseGlow 2s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
              <Check size={24} style={{ color: 'hsl(var(--accent-emerald))' }} />
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{balanceAlert.message}</div>
            </div>
          </div>
        )}

        {/* ==========================================
            DASHBOARD VIEW
            ========================================== */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Panel de Control</h1>
                <p className="page-subtitle">Saldos de cuentas y solvencia general de las 40 casas</p>
              </div>
              <div className="page-header-actions">
                {/* Date range filters */}
                <div className="filter-group">
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Rango:</span>
                  <input 
                    type="date" 
                    style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'white', fontSize: '0.85rem' }}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>al</span>
                  <input 
                    type="date" 
                    style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'white', fontSize: '0.85rem' }}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  {(startDate || endDate) && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Tasa BCV */}
                <div className="filter-group">
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Tasa BCV:</span>
                  <input 
                    type="text" 
                    style={{ width: '60px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'white', fontWeight: '700', fontSize: '0.9rem', textAlign: 'center' }}
                    value={bcvRate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBcvRate(val);
                      localStorage.setItem('condo_bcv_rate', val);
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Bs.</span>
                  <button 
                    type="button" 
                    title="Obtener tasa oficial de DolarApi (BCV)"
                    onClick={handleSyncBcvRate} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'hsl(var(--primary))', fontSize: '0.85rem' }}
                  >
                    🔄
                  </button>
                </div>
                
                <button className="btn btn-primary" onClick={() => setModals({ ...modals, payment: true })}>
                  <Plus size={18} /> Registrar Pago Recibido
                </button>
                <button className="btn btn-danger" onClick={() => setModals({ ...modals, expense: true })}>
                  <Plus size={18} /> Registrar Egreso
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              <div className="glass-card metric-card">
                <div className="metric-icon-wrapper purple">
                  <DollarSign size={24} />
                </div>
                <div className="metric-info">
                  <h3>Fondos en Bolívares</h3>
                  <div className="metric-value">{formatVal(summary.totalBs, 'Bs')}</div>
                </div>
              </div>

              <div className="glass-card metric-card">
                <div className="metric-icon-wrapper emerald">
                  <DollarSign size={24} />
                </div>
                <div className="metric-info">
                  <h3>Fondos en Divisas</h3>
                  <div className="metric-value">
                    {formatVal(summary.totalUsd + (summary.totalBs / (parseLocalFloat(bcvRate) || 1)), 'USD')}
                  </div>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    Fórmula: {formatVal(summary.totalBs, 'Bs')} / {bcvRate} = {formatVal(summary.totalBs / (parseLocalFloat(bcvRate) || 1), 'USD')}
                  </p>
                </div>
              </div>

              <div className="glass-card metric-card">
                <div className="metric-icon-wrapper purple">
                  <Check size={24} />
                </div>
                <div className="metric-info">
                  <h3>Pagos Recibidos (Ingresos)</h3>
                  <div className="metric-value">{formatVal(summary.totalPaymentsBs, 'Bs')}</div>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    Equivalente a: {formatVal(summary.totalPaymentsUsd, 'USD')} de deudas saldadas
                  </p>
                </div>
              </div>

              <div className="glass-card metric-card">
                <div className="metric-icon-wrapper rose">
                  <TrendingDown size={24} />
                </div>
                <div className="metric-info">
                  <h3>Egresos Realizados (Gastos)</h3>
                  <div className="metric-value">{formatVal(summary.totalExpenses, 'Bs')}</div>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    Dinero debitado para reparaciones o servicios
                  </p>
                </div>
              </div>
            </div>

            {/* Graphs Grid */}
            <div className="dashboard-grid">
              <div className="glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600 }}>Saldos Disponibles por Cuenta</h2>
                <div style={{ flexGrow: 1, position: 'relative', width: '100%', height: '80%' }}>
                  {bankAccounts.length > 0 ? (
                    <Bar 
                      data={barData} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
                      }} 
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>No hay cuentas bancarias registradas.</div>
                  )}
                </div>
              </div>

              <div className="glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600, alignSelf: 'flex-start' }}>Estado de Solvencia General</h2>
                <div style={{ width: '200px', height: '200px', margin: 'auto' }}>
                  {summary.totalProperties > 0 ? (
                    <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>Sin datos disponibles.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', fontWeight: 600 }}>Transacciones Recientes</h2>
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Fecha</th>
                      <th>Detalle / Casa</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentActivity && summary.recentActivity.length > 0 ? (
                      summary.recentActivity.map((activity, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={`badge ${activity.type === 'income' ? 'badge-paid' : 'badge-pending'}`}>
                              {activity.type === 'income' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td>{activity.date}</td>
                          <td>{activity.detail}</td>
                          <td>{activity.concept}</td>
                          <td style={{ fontWeight: '600', color: activity.type === 'income' ? 'hsl(var(--accent-emerald))' : 'hsl(var(--accent-rose))' }}>
                            {activity.type === 'income' ? '+' : '-'}{formatVal(activity.amount, activity.account_currency)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                          No hay transacciones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            PROPERTIES VIEW
            ========================================== */}
        {activeTab === 'properties' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Casas Registradas (40 en total)</h1>
                <p className="page-subtitle">Visualiza la lista de viviendas y sus copropietarios</p>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input 
                    type="text" 
                    placeholder="Buscar casa o copropietario..." 
                    className="form-input" 
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                    value={searchProperty}
                    onChange={(e) => setSearchProperty(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Copropietario</th>
                      <th>Total Pagado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties
                      .filter(p => 
                        p.apartment_code.toLowerCase().includes(searchProperty.toLowerCase()) || 
                        p.owner_name.toLowerCase().includes(searchProperty.toLowerCase())
                      )
                      .map((prop) => (
                        <tr key={prop.id}>
                          <td style={{ fontWeight: '600' }}>{prop.apartment_code}</td>
                          <td>{prop.owner_name}</td>
                          <td style={{ fontWeight: '600', color: 'hsl(var(--accent-emerald))' }}>
                            {formatVal(prop.total_paid, 'Bs')}
                          </td>
                          <td>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleOpenEditProperty(prop)}>
                              <Edit size={16} /> Modificar Propietario
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            BANK ACCOUNTS VIEW
            ========================================== */}
        {activeTab === 'accounts' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Cuentas de los Administradores</h1>
                <p className="page-subtitle">Saldos de cuentas bancarias y métodos Pago Móvil / Transferencias</p>
              </div>
              <button className="btn btn-primary" onClick={() => setModals({ ...modals, bankAccount: true })}>
                <Plus size={18} /> Nueva Cuenta
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{acc.bank_name}</h3>
                    <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleDeleteBankAccount(acc.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div>
                    <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Titular (Admin)</div>
                    <div style={{ fontWeight: 500 }}>{acc.account_holder}</div>
                  </div>
                  <div>
                    <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Nro Cuenta / Pago Móvil</div>
                    <div style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>{acc.account_number}</div>
                  </div>
                  <div>
                    <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Moneda</div>
                    <div style={{ fontWeight: 600 }}>{acc.currency}</div>
                  </div>
                  <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500' }}>Saldo Disponible</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'hsl(var(--accent-emerald))' }}>{formatVal(acc.balance, acc.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==========================================
            SERVICES & PAYMENTS VIEW
            ========================================== */}
        {activeTab === 'services' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Registro de Pagos y Servicios</h1>
                <p className="page-subtitle">Genera un cobro y registra los pagos recibidos (Pago Móvil / Transferencia)</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={() => setModals({ ...modals, service: true })}>
                  <Plus size={18} /> Nuevo Cobro Común
                </button>
                <button className="btn btn-emerald" onClick={() => setModals({ ...modals, payment: true })}>
                  <Check size={18} /> Registrar Pago
                </button>
              </div>
            </div>

            <div className="services-grid">
              
              {/* Active Services */}
              <div className="glass-card">
                <h2 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', fontWeight: 600 }}>Cobros Comunes Generados</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {services.map((serv) => (
                    <div 
                      key={serv.id} 
                      className={`list-item-card ${selectedServiceId === serv.id ? 'active-card' : ''}`} 
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
                      onClick={() => setSelectedServiceId(selectedServiceId === serv.id ? null : serv.id)}
                    >
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '1rem' }}>{serv.name}</span>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.25rem 0.5rem' }} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteService(serv.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>{serv.description || 'Sin descripción'}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.9rem' }}>
                        <div style={{ color: 'hsl(var(--text-secondary))' }}>
                          Monto Total del Cobro: <span style={{ fontWeight: '600', color: 'white' }}>{formatVal(serv.default_amount, 'USD')}</span>
                        </div>
                        <div style={{ color: 'hsl(var(--primary))', fontWeight: '600' }}>
                          Cuota por Casa: {formatVal(serv.default_amount / 40, 'USD')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {services.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '1rem' }}>
                      No hay cobros registrados.
                    </div>
                  )}
                </div>
              </div>

              {/* Debts list */}
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Cuentas de las Casas</h2>
                    {selectedServiceId && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px' }}
                        onClick={() => setSelectedServiceId(null)}
                      >
                        Mostrar Todo
                      </button>
                    )}
                  </div>
                  <select 
                    className="form-select" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                    value={debtFilter}
                    onChange={(e) => setDebtFilter(e.target.value)}
                  >
                    <option value="all">Ver Todas</option>
                    <option value="pending">Pendientes</option>
                    <option value="paid">Solventes</option>
                  </select>
                </div>

                <div className="table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Casa</th>
                        <th>Concepto de Cobro</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debts
                        .filter(d => (debtFilter === 'all' || d.status === debtFilter) && (!selectedServiceId || d.service_id === selectedServiceId))
                        .map((debt) => (
                          <tr key={debt.id}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{debt.apartment_code}</div>
                              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>{debt.owner_name}</div>
                            </td>
                            <td>{debt.service_name}</td>
                            <td style={{ fontWeight: '500' }}>{formatVal(debt.amount, 'USD')}</td>
                            <td>
                              <span className={`badge ${debt.status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                                {debt.status === 'paid' ? 'Pagado' : 'Pendiente'}
                              </span>
                            </td>
                            <td>
                              {debt.status === 'pending' && (
                                <button 
                                  className="btn btn-emerald" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setPaymentForm({ ...paymentForm, debt_id: debt.id, amount_paid: debt.amount });
                                    setModals({ ...modals, payment: true });
                                  }}
                                >
                                  Pagar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==========================================
            EXPENSES VIEW
            ========================================== */}
        {activeTab === 'expenses' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Historial de Egresos</h1>
                <p className="page-subtitle">Controla el dinero debitado de las cuentas por gastos comunitarios</p>
              </div>
              <button className="btn btn-danger" onClick={() => setModals({ ...modals, expense: true })}>
                <Plus size={18} /> Registrar Egreso
              </button>
            </div>

            <div className="glass-card">
              <h2 style={{ fontSize: '1.20rem', marginBottom: '1.25rem', fontWeight: 600 }}>Egresos y Pagos Realizados</h2>
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción / Concepto</th>
                      <th>Cuenta Origen</th>
                      <th>Referencia</th>
                      <th>Monto Debitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.expense_date}</td>
                        <td style={{ fontWeight: '500' }}>{exp.description}</td>
                        <td>{exp.bank_name} - <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>{exp.account_holder}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>{exp.reference_number || 'N/A'}</td>
                        <td style={{ fontWeight: '600', color: 'hsl(var(--accent-rose))' }}>
                          -{formatVal(exp.amount, exp.account_currency)}
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                          No hay egresos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ==========================================
          MODALS
          ========================================== */}
      
      {/* 1. Property Modal */}
      {modals.property && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingPropertyId ? 'Editar Propietario de la Casa' : 'Agregar Nueva Casa'}</h2>
              <button className="modal-close" onClick={() => setModals({ ...modals, property: false })}>X</button>
            </div>
            <form onSubmit={handlePropertySubmit}>
              <div className="form-group">
                <label className="form-label">Código de la Casa</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Casa 41"
                  required
                  disabled={!!editingPropertyId} // Disable editing the house code directly for database integrity
                  value={propertyForm.apartment_code}
                  onChange={(e) => setPropertyForm({ ...propertyForm, apartment_code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Copropietario</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nombre y Apellido"
                  required
                  value={propertyForm.owner_name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, owner_name: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModals({ ...modals, property: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingPropertyId ? 'Guardar Cambios' : 'Registrar Casa'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Bank Account Modal */}
      {modals.bankAccount && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Agregar Cuenta Bancaria</h2>
              <button className="modal-close" onClick={() => setModals({ ...modals, bankAccount: false })}>X</button>
            </div>
            <form onSubmit={handleCreateBankAccount}>
              <div className="form-group">
                <label className="form-label">Nombre del Banco</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Banesco, Mercantil"
                  required
                  value={bankAccountForm.bank_name}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, bank_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nro de Cuenta / Identificador Pago Móvil</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Número de cuenta o teléfono de Pago Móvil"
                  required
                  value={bankAccountForm.account_number}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, account_number: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Administrador Titular</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Titular administrador"
                  required
                  value={bankAccountForm.account_holder}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, account_holder: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Moneda</label>
                <select 
                  className="form-select"
                  value={bankAccountForm.currency}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, currency: e.target.value })}
                >
                  <option value="Bs">Bolívares (Bs.)</option>
                  <option value="USD">Dólares ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo Inicial</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 5.000,00 o 5000"
                  value={bankAccountForm.balance}
                  onChange={(e) => setBankAccountForm({ ...bankAccountForm, balance: maskCurrency(e.target.value) })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModals({ ...modals, bankAccount: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Service Modal */}
      {modals.service && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Generar Nuevo Cobro Común</h2>
              <button className="modal-close" onClick={() => setModals({ ...modals, service: false })}>X</button>
            </div>
            <form onSubmit={handleCreateService}>
              <div className="form-group">
                <label className="form-label">Concepto del Cobro</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Aseo, Arreglar Portón, Llave Magnética"
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  placeholder="Detalles sobre el cobro..."
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monto Total del Cobro ($)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 40,00 o 40"
                  required
                  value={serviceForm.default_amount}
                  onChange={(e) => setServiceForm({ ...serviceForm, default_amount: maskCurrency(e.target.value) })}
                />
              </div>
              <div className="form-group" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', background: 'hsl(var(--accent-emerald) / 0.08)', border: '1px solid hsl(var(--accent-emerald) / 0.2)', fontSize: '0.88rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Cuota estimada por Casa (40 casas):</span>
                <span style={{ fontWeight: '700', fontSize: '1rem', color: 'hsl(var(--accent-emerald))' }}>
                  {formatVal(parseLocalFloat(serviceForm.default_amount) / 40, 'USD')}
                </span>
              </div>
              <div className="form-group" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)', fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                💡 El monto total ingresado se dividirá automáticamente en partes iguales entre las 40 casas. Cada casa pagará su cuota en bolívares al cambio del día.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModals({ ...modals, service: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Generar Deudas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Register Payment (Income) Modal */}
      {modals.payment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Pago Recibido</h2>
              <button className="modal-close" onClick={() => setModals({ ...modals, payment: false })}>X</button>
            </div>
            <form onSubmit={handleRegisterPayment}>
              <div className="form-group">
                <label className="form-label">Deuda Pendiente / Casa</label>
                <select 
                  className="form-select" 
                  required
                  value={paymentForm.debt_id}
                  onChange={(e) => handlePaymentDebtChange(e.target.value)}
                >
                  <option value="">-- Selecciona la deuda pendiente --</option>
                  {debts
                    .filter(d => d.status === 'pending')
                    .map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.apartment_code} - {debt.owner_name} ({debt.service_name}: {formatVal(debt.amount, 'USD')})
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Cuenta de Destino (Banco)</label>
                <select 
                  className="form-select" 
                  required
                  value={paymentForm.bank_account_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_account_id: e.target.value })}
                >
                  <option value="">-- Selecciona la cuenta bancaria --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} ({acc.account_holder}) - Saldo: {formatVal(acc.balance, acc.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tasa del Dólar del Día (Bs/$)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: 46.50"
                    required
                    value={paymentForm.exchange_rate}
                    onChange={(e) => handlePaymentRateChange(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Método de Pago</label>
                  <select 
                    className="form-select" 
                    required
                    value={paymentForm.payment_method}
                    onChange={(e) => handlePaymentMethodChange(e.target.value)}
                  >
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Transferencia">Transferencia</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Monto Recibido (Bs.)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: 5.000,00"
                    required
                    value={paymentForm.amount_paid}
                    onChange={(e) => handlePaymentAmountChange(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Comisión Bancaria (Bs.)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="0.00"
                    required
                    value={paymentForm.commission}
                    onChange={(e) => setPaymentForm({ ...paymentForm, commission: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', background: 'hsl(var(--accent-emerald) / 0.08)', border: '1px solid hsl(var(--accent-emerald) / 0.2)', fontSize: '0.88rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>Monto Neto a Depositar:</span>
                <span style={{ fontWeight: '700', fontSize: '1rem', color: 'hsl(var(--accent-emerald))' }}>
                  {formatVal(Math.max(0, parseLocalFloat(paymentForm.amount_paid) - parseLocalFloat(paymentForm.commission)), 'Bs')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Fecha de Pago</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Número de Referencia</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Ref-12345"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModals({ ...modals, payment: false })}>Cancelar</button>
                <button type="submit" className="btn btn-emerald">Confirmar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Register Expense Modal */}
      {modals.expense && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Registrar Gasto / Egreso</h2>
              <button className="modal-close" onClick={() => setModals({ ...modals, expense: false })}>X</button>
            </div>
            <form onSubmit={handleRegisterExpense}>
              <div className="form-group">
                <label className="form-label">Cuenta de Origen</label>
                <select 
                  className="form-select" 
                  required
                  value={expenseForm.bank_account_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, bank_account_id: e.target.value })}
                >
                  <option value="">-- Selecciona la cuenta bancaria --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} ({acc.account_holder}) - Saldo: {formatVal(acc.balance, acc.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción del Egreso</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Reparación de portón principal"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Monto del Egreso (Bs.)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 5.000,00"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => handleExpenseAmountChange(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Método de Pago</label>
                  <select 
                    className="form-select" 
                    required
                    value={expenseForm.payment_method}
                    onChange={(e) => handleExpenseMethodChange(e.target.value)}
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Comisión Bancaria (Bs.)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="0,00"
                    required
                    value={expenseForm.commission}
                    onChange={(e) => setExpenseForm({ ...expenseForm, commission: maskCurrency(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', background: 'hsl(var(--accent-rose) / 0.08)', border: '1px solid hsl(var(--accent-rose) / 0.2)', fontSize: '0.88rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>Monto Total a Debitar (Gasto + Comisión):</span>
                <span style={{ fontWeight: '700', fontSize: '1rem', color: 'hsl(var(--accent-rose))' }}>
                  {formatVal(parseLocalFloat(expenseForm.amount) + parseLocalFloat(expenseForm.commission), 'Bs')}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha del Egreso</label>
                <input 
                  type="date" 
                  className="form-input" 
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nro de Referencia</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Ref-0987"
                  value={expenseForm.reference_number}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference_number: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModals({ ...modals, expense: false })}>Cancelar</button>
                <button type="submit" className="btn btn-danger">Confirmar Egreso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================
          CONFIRM DIALOG MODAL (reemplaza window.confirm)
          ============================================= */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>Confirmar acción</h2>
              <button className="modal-close" onClick={closeConfirm}>X</button>
            </div>
            <div style={{ padding: '0.5rem 0 1.25rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
              {confirmDialog.message}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeConfirm}>Cancelar</button>
              <button
                className={`btn ${confirmDialog.type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          NOTIFICATION DIALOG (reemplaza alert)
          ============================================= */}
      {notifDialog && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: '1.1rem', color: notifDialog.type === 'error' ? 'hsl(var(--accent-rose))' : 'hsl(var(--accent-emerald))' }}>Aviso</h2>
              <button className="modal-close" onClick={closeNotif}>X</button>
            </div>
            <div style={{ padding: '0.5rem 0 1.25rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
              {notifDialog.message}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={closeNotif}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
