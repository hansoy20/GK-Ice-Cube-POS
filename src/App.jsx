import { useState, useEffect } from 'react';
import { 
  format, addDays, subDays, startOfDay, isSameDay, 
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  eachDayOfInterval
} from 'date-fns';
import { Settings as SettingsIcon, ChevronLeft, ChevronRight, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp, WifiOff, Download, LogOut } from 'lucide-react';
import { supabase } from './supabase';
import './index.css';

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [settings, setSettings] = useState({ pickup_price: 8, delivery_price: 10, cost_per_kg: 0 });
  
  const [sales, setSales] = useState([]);
  const [production, setProduction] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [carryover, setCarryover] = useState(0);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [isSavingProd, setIsSavingProd] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [error, setError] = useState(null);

  // Auth states
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Form states
  const [saleKg, setSaleKg] = useState('');
  const [saleType, setSaleType] = useState('pickup');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [salePaymentStatus, setSalePaymentStatus] = useState('paid');
  const [salePaymentMethod, setSalePaymentMethod] = useState('cash');
  
  const [prodKg, setProdKg] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [settingsForm, setSettingsForm] = useState({ pickup_price: 8, delivery_price: 10, cost_per_kg: 0 });

  // Determine date range based on viewMode
  let startDate, endDate;
  if (viewMode === 'daily') {
    startDate = selectedDate;
    endDate = selectedDate;
  } else if (viewMode === 'weekly') {
    startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
    endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
  } else {
    startDate = startOfMonth(selectedDate);
    endDate = endOfMonth(selectedDate);
  }

  // Fetch data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchSettings();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchPeriodData(startDate, endDate);
    }
  }, [startDate.toISOString(), endDate.toISOString(), viewMode, session]);

  const fetchSettings = async () => {
    try {
      const { data, error: err } = await supabase.from('settings').select('*').limit(1).single();
      if (err && err.code !== 'PGRST116') throw err;
      if (data) {
        setSettings(data);
        setSettingsForm({
          pickup_price: data.pickup_price,
          delivery_price: data.delivery_price,
          cost_per_kg: data.cost_per_kg
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(`Database Error: ${err.message || err.error_description || "Could not connect to database."}`);
    }
  };

  const fetchPeriodData = async (start, end) => {
    setIsLoading(true);
    setError(null);
    try {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      const { data: salesData, error: salesErr } = await supabase
        .from('sales_entries')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('created_at', { ascending: false });
      if (salesErr) throw salesErr;
        
      const { data: prodData, error: prodErr } = await supabase
        .from('production_entries')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('created_at', { ascending: false });
      if (prodErr) throw prodErr;

      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('created_at', { ascending: false });
      if (expErr) throw expErr;

      const { data: carryoverData, error: carryoverErr } = await supabase
        .rpc('get_carryover_stock', { target_date: startStr });
      if (carryoverErr) throw carryoverErr;

      setCarryover(Number(carryoverData) || 0);
      setSales(salesData || []);
      setProduction(prodData || []);
      setExpenses(expData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Database Error: ${err.message || err.error_description || "Failed to load data."}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const roundCurrency = (val) => Math.round(val * 100) / 100;

  const prodTotal = production.reduce((acc, curr) => acc + Number(curr.kg_produced), 0);
  const salesTotal = sales.reduce((acc, curr) => acc + Number(curr.kg), 0);
  const totalAvailableStock = carryover + prodTotal;
  const remainingStock = totalAvailableStock - salesTotal;
  
  const revenueTotal = roundCurrency(sales.reduce((acc, curr) => acc + Number(curr.revenue), 0));
  const unpaidTotal = roundCurrency(sales.filter(s => s.payment_status === 'unpaid').reduce((acc, curr) => acc + Number(curr.revenue), 0));
  const collectedTotal = roundCurrency(revenueTotal - unpaidTotal);
  const costTotal = roundCurrency(sales.reduce((acc, curr) => acc + (Number(curr.kg) * Number(curr.cost_per_kg)), 0));
  const expensesTotal = roundCurrency(expenses.reduce((acc, curr) => acc + Number(curr.amount), 0));
  const profitTotal = roundCurrency(revenueTotal - costTotal - expensesTotal);

  // Handlers
  const handlePrev = () => {
    if (viewMode === 'daily') setSelectedDate(subDays(selectedDate, 1));
    else if (viewMode === 'weekly') setSelectedDate(subWeeks(selectedDate, 1));
    else setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'daily') setSelectedDate(addDays(selectedDate, 1));
    else if (viewMode === 'weekly') setSelectedDate(addWeeks(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  };

  const handleAddSale = async (e) => {
    e.preventDefault();
    if (!saleKg || Number(saleKg) <= 0 || viewMode !== 'daily' || isSavingSale) return;
    
    setError(null);
    const kg = Number(saleKg);

    if (kg > remainingStock) {
      setError(`Cannot record sale: You only have ${remainingStock} kg of stock available.`);
      return;
    }

    setIsSavingSale(true);
    const price_per_kg = saleType === 'pickup' ? settings.pickup_price : settings.delivery_price;
    const revenue = kg * price_per_kg;
    
    const rpcArgs = {
      sale_date: format(selectedDate, 'yyyy-MM-dd'),
      sale_kg: kg,
      sale_type: saleType,
      sale_price_per_kg: price_per_kg,
      sale_cost_per_kg: settings.cost_per_kg,
      sale_revenue: revenue,
      p_customer_name: saleCustomer || 'Walk-in',
      p_payment_status: salePaymentStatus,
      p_payment_method: salePaymentStatus === 'unpaid' ? null : salePaymentMethod
    };

    try {
      const { data, error: err } = await supabase.rpc('record_sale', rpcArgs);
      if (err) throw err;
      if (data) setSales([data, ...sales]);
      handleClearSaleForm();
    } catch (err) {
      console.error("Sale error", err);
      const msg = err.message || err.error_description || "Failed to save sale.";
      setError(msg.includes('Insufficient stock') ? msg : `Sale Error: ${msg}`);
    } finally {
      setIsSavingSale(false);
    }
  };

  const handleClearSaleForm = () => {
    setSaleKg('');
    setSaleCustomer('');
    setSalePaymentStatus('paid');
    setSalePaymentMethod('cash');
  };

  const handleAddProduction = async (e) => {
    e.preventDefault();
    if (!prodKg || Number(prodKg) <= 0 || viewMode !== 'daily' || isSavingProd) return;
    
    setError(null);
    setIsSavingProd(true);
    const newProd = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      kg_produced: Number(prodKg)
    };

    try {
      const { data, error: err } = await supabase.from('production_entries').insert([newProd]).select().single();
      if (err) throw err;
      if (data) setProduction([data, ...production]);
      setProdKg('');
    } catch (err) {
      console.error("Prod error", err);
      setError(`Production Error: ${err.message || err.error_description || "Failed to save production."}`);
    } finally {
      setIsSavingProd(false);
    }
  };

  const handleDeleteSale = async (id) => {
    if (viewMode !== 'daily') return;
    if (!window.confirm("Are you sure you want to delete this sale? This cannot be undone.")) return;
    
    setError(null);
    try {
      const { error: err } = await supabase.from('sales_entries').delete().eq('id', id);
      if (err) throw err;
      setSales(sales.filter(s => s.id !== id));
    } catch (err) {
      console.error("Delete error", err);
      setError("Failed to delete sale.");
    }
  };

  const handleMarkAsPaid = async (id) => {
    if (viewMode !== 'daily') return;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sales_entries')
        .update({ payment_status: 'paid', payment_method: 'cash' })
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      if (data) {
        setSales(sales.map(s => s.id === id ? data : s));
      }
    } catch (err) {
      console.error("Update error", err);
      setError("Failed to mark sale as paid.");
    }
  };

  const handleDeleteProduction = async (id) => {
    if (viewMode !== 'daily') return;
    if (!window.confirm("Are you sure you want to delete this production entry? This cannot be undone.")) return;
    
    setError(null);
    try {
      const { error: err } = await supabase.from('production_entries').delete().eq('id', id);
      if (err) throw err;
      setProduction(production.filter(p => p.id !== id));
    } catch (err) {
      console.error("Delete error", err);
      setError("Failed to delete production.");
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || Number(expenseAmount) <= 0 || viewMode !== 'daily' || isSavingExpense) return;
    
    setError(null);
    setIsSavingExpense(true);
    const newExp = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      description: expenseDesc,
      amount: Number(expenseAmount)
    };

    try {
      const { data, error: err } = await supabase.from('expenses').insert([newExp]).select().single();
      if (err) throw err;
      if (data) setExpenses([data, ...expenses]);
      setExpenseDesc('');
      setExpenseAmount('');
    } catch (err) {
      console.error("Expense error", err);
      setError(`Expense Error: ${err.message || err.error_description || "Failed to save expense."}`);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (viewMode !== 'daily') return;
    if (!window.confirm("Are you sure you want to delete this expense? This cannot be undone.")) return;
    
    setError(null);
    try {
      const { error: err } = await supabase.from('expenses').delete().eq('id', id);
      if (err) throw err;
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (err) {
      console.error("Delete error", err);
      setError("Failed to delete expense.");
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError(null);
    const newSettings = {
      pickup_price: Number(settingsForm.pickup_price),
      delivery_price: Number(settingsForm.delivery_price),
      cost_per_kg: Number(settingsForm.cost_per_kg)
    };
    
    try {
      if (settings.id) {
        const { error: err } = await supabase.from('settings').update(newSettings).eq('id', settings.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('settings').insert([newSettings]).select().single();
        if (err) throw err;
        setSettings(data);
      }
      setSettings((prev) => ({ ...prev, ...newSettings }));
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Settings error", err);
      setError("Failed to save settings.");
    }
  };

  const generateAggregateRows = () => {
    const endCap = endDate > new Date() ? new Date() : endDate;
    if (startDate > new Date()) return []; 
    const days = eachDayOfInterval({ start: startDate, end: endCap }).reverse(); 
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySales = sales.filter(s => s.date === dateStr);
      const dayProd = production.filter(p => p.date === dateStr);
      const dayExp = expenses.filter(e => e.date === dateStr);
      const pTotal = dayProd.reduce((acc, p) => acc + Number(p.kg_produced), 0);
      const sTotal = daySales.reduce((acc, s) => acc + Number(s.kg), 0);
      const rev = roundCurrency(daySales.reduce((acc, s) => acc + Number(s.revenue), 0));
      const cost = roundCurrency(daySales.reduce((acc, s) => acc + (Number(s.kg) * Number(s.cost_per_kg)), 0));
      const expTotal = roundCurrency(dayExp.reduce((acc, e) => acc + Number(e.amount), 0));
      const prof = roundCurrency(rev - cost - expTotal);
      if (pTotal === 0 && sTotal === 0 && expTotal === 0) return null; 
      return { date: day, produced: pTotal, sold: sTotal, revenue: rev, expenses: expTotal, profit: prof };
    }).filter(Boolean); 
  };

  const triggerDownload = (csvContent, fileName) => {
    // Add BOM for Excel UTF-8 support to correctly render the Peso sign
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportDetailed = async () => {
    try {
      // Fetch all historical records to allow backtracking everything
      const { data: allSales, error: salesErr } = await supabase.from('sales_entries').select('*');
      const { data: allProd, error: prodErr } = await supabase.from('production_entries').select('*');
      const { data: allExp, error: expErr } = await supabase.from('expenses').select('*');
      if (salesErr) throw salesErr;
      if (prodErr) throw prodErr;
      if (expErr) throw expErr;

      const headers = ['Date', 'Time', 'Type', 'Amount (kg/Qty)', 'Revenue/Cost', 'Price per kg/Desc', 'Customer', 'Payment Status', 'Payment Method'];
      const rows = [];
      
      const combined = [
        ...(allSales || []).map(s => ({ ...s, _sortDate: new Date(s.created_at), _type: 'sale' })),
        ...(allProd || []).map(p => ({ ...p, _sortDate: new Date(p.created_at), _type: 'production' })),
        ...(allExp || []).map(e => ({ ...e, _sortDate: new Date(e.created_at), _type: 'expense' }))
      ].sort((a, b) => b._sortDate - a._sortDate);

      combined.forEach(entry => {
        const date = format(new Date(entry.date + 'T00:00:00'), 'yyyy-MM-dd');
        const time = format(entry._sortDate, 'hh:mm a');
        if (entry._type === 'sale') {
          rows.push([date, time, `Sale (${entry.sale_type})`, `-${entry.kg}`, `₱${entry.revenue}`, `₱${entry.price_per_kg}`, entry.customer_name || 'Walk-in', entry.payment_status?.toUpperCase(), entry.payment_method?.toUpperCase() || '-']);
        } else if (entry._type === 'production') {
          rows.push([date, time, 'Production', `+${entry.kg_produced}`, '-', '-', '-', '-', '-']);
        } else {
          rows.push([date, time, 'Expense', '-', `-₱${entry.amount}`, `"${entry.description}"`, '-', '-', '-']);
        }
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      triggerDownload(csvContent, `IceCube_All_Detailed_Records.csv`);
    } catch (err) {
      console.error("Export error", err);
      setError("Failed to export detailed records.");
    }
  };

  const handleExportSummary = async () => {
    try {
      // Fetch all historical records
      const { data: allSales, error: salesErr } = await supabase.from('sales_entries').select('*');
      const { data: allProd, error: prodErr } = await supabase.from('production_entries').select('*');
      const { data: allExp, error: expErr } = await supabase.from('expenses').select('*');
      if (salesErr) throw salesErr;
      if (prodErr) throw prodErr;
      if (expErr) throw expErr;

      const safeSales = allSales || [];
      const safeProd = allProd || [];
      const safeExp = allExp || [];

      if (!safeSales.length && !safeProd.length && !safeExp.length) {
        setError("No records to export.");
        return;
      }
      
      const parseLocal = (dStr) => { const [y, m, d] = dStr.split('-'); return new Date(y, m-1, d); };
      const allDates = [
        ...safeSales.map(s => parseLocal(s.date)), 
        ...safeProd.map(p => parseLocal(p.date)),
        ...safeExp.map(e => parseLocal(e.date))
      ];
      
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));
      
      const days = eachDayOfInterval({ start: minDate, end: maxDate }).reverse();
      
      const aggregate = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const daySales = safeSales.filter(s => s.date === dateStr);
        const dayProd = safeProd.filter(p => p.date === dateStr);
        const dayExp = safeExp.filter(e => e.date === dateStr);
        const pTotal = dayProd.reduce((acc, p) => acc + Number(p.kg_produced), 0);
        const sTotal = daySales.reduce((acc, s) => acc + Number(s.kg), 0);
        const rev = roundCurrency(daySales.reduce((acc, s) => acc + Number(s.revenue), 0));
        const collected = roundCurrency(daySales.filter(s => s.payment_status === 'paid').reduce((acc, s) => acc + Number(s.revenue), 0));
        const unpaid = roundCurrency(daySales.filter(s => s.payment_status === 'unpaid').reduce((acc, s) => acc + Number(s.revenue), 0));
        const cost = roundCurrency(daySales.reduce((acc, s) => acc + (Number(s.kg) * Number(s.cost_per_kg)), 0));
        const expTotal = roundCurrency(dayExp.reduce((acc, e) => acc + Number(e.amount), 0));
        const prof = roundCurrency(rev - cost - expTotal);
        if (pTotal === 0 && sTotal === 0 && expTotal === 0) return null; 
        return { date: day, produced: pTotal, sold: sTotal, revenue: rev, collected, unpaid, expenses: expTotal, profit: prof };
      }).filter(Boolean);

      const headers = ['Date', 'Produced (kg)', 'Sold (kg)', 'Total Revenue', 'Collected (Paid)', 'Unpaid (Credit)', 'Expenses', 'Net Profit'];
      const rows = aggregate.map(row => {
        return [
          format(row.date, 'yyyy-MM-dd'),
          row.produced,
          row.sold,
          `₱${row.revenue}`,
          `₱${row.collected}`,
          `₱${row.unpaid}`,
          `₱${row.expenses}`,
          `₱${row.profit}`
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      triggerDownload(csvContent, `IceCube_All_Summary_Records.csv`);
    } catch (err) {
      console.error("Export error", err);
      setError("Failed to export summary records.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (err) {
      setError(err.message);
      setIsAuthLoading(false);
    } else {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderDateLabel = () => {
    if (viewMode === 'daily') {
      return isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'MMM d, yyyy');
    } else if (viewMode === 'weekly') {
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    } else {
      return format(startDate, 'MMMM yyyy');
    }
  };

  if (isAuthLoading) {
    return <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <form className="card" onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px', border: '2px solid var(--primary-color)' }}>
          <div className="card-header" style={{ textAlign: 'center', color: 'var(--primary-color)' }}>Ice Cube POS Login</div>
          {error && (
            <div className="warning-banner" style={{ backgroundColor: '#fef2f2', color: '#dc2626', marginBottom: '16px' }}>
              <AlertCircle size={20} />
              {error}
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              className="form-control" 
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px' }}>
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="app-header">
        <div className="date-selector">
          <button className="btn btn-outline" onClick={handlePrev}>
            <ChevronLeft size={20} />
          </button>
          <div className="current-date">
            {renderDateLabel()}
          </div>
          <button className="btn btn-outline" onClick={handleNext}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* View Toggle */}
      <div className="view-toggle">
        <button className={`btn ${viewMode === 'daily' ? 'active' : ''}`} onClick={() => setViewMode('daily')}>Daily</button>
        <button className={`btn ${viewMode === 'weekly' ? 'active' : ''}`} onClick={() => setViewMode('weekly')}>Weekly</button>
        <button className={`btn ${viewMode === 'monthly' ? 'active' : ''}`} onClick={() => setViewMode('monthly')}>Monthly</button>
      </div>

      {/* Global Errors / Warnings */}
      {error && (
        <div className="warning-banner" style={{backgroundColor: '#fef2f2', color: '#dc2626'}}>
          <WifiOff size={20} />
          {error}
        </div>
      )}
      {remainingStock < 0 && (
        <div className="warning-banner">
          <AlertCircle size={20} />
          Warning: Sales exceed available stock!
        </div>
      )}

      {/* GLANCE HERO SECTION */}
      {isLoading ? (
        <div className="hero-section" style={{ color: 'var(--text-tertiary)' }}>Loading data...</div>
      ) : (
        <section className="hero-section">
          <div className="hero-label">
            {viewMode === 'daily' ? 'Remaining Stock' : 'Ending Stock'}
          </div>
          <div className="hero-value mono">
            {remainingStock} kg
          </div>
          <div className="hero-sub">
            <div className="hero-sub-label">Net Profit</div>
            <div className="hero-sub-value mono">₱{profitTotal.toLocaleString()}</div>
          </div>
        </section>
      )}

      {/* PRIMARY ACTION: LOG SALE */}
      {viewMode === 'daily' && !isLoading && (
        <form className="card" onSubmit={handleAddSale} style={{ border: '2px solid var(--primary-color)', boxShadow: 'var(--shadow-md)' }}>
          <div className="card-header" style={{ color: 'var(--primary-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Record a Sale</span>
            <button type="button" className="btn-text" onClick={handleClearSaleForm} style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
              Clear
            </button>
          </div>
          
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Customer Name (Optional)"
              value={saleCustomer}
              onChange={(e) => setSaleCustomer(e.target.value)}
              disabled={isSavingSale}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input 
              type="number" 
              className="form-control mono" 
              placeholder="0 kg"
              value={saleKg}
              onChange={(e) => setSaleKg(e.target.value)}
              min="0"
              step="any"
              autoFocus
              required
              disabled={isSavingSale}
              style={{ flex: 1, fontSize: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
              <button 
                type="button" 
                className={`btn btn-outline ${saleType === 'pickup' ? 'active' : ''}`} 
                style={{ flex: 1, padding: '12px 8px' }}
                onClick={() => setSaleType('pickup')}
                disabled={isSavingSale}
              >
                Pickup
              </button>
              <button 
                type="button" 
                className={`btn btn-outline ${saleType === 'delivery' ? 'active' : ''}`} 
                style={{ flex: 1, padding: '12px 8px' }}
                onClick={() => setSaleType('delivery')}
                disabled={isSavingSale}
              >
                Delivery
              </button>
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button 
              type="button" 
              className={`btn btn-outline ${salePaymentStatus === 'paid' ? 'active' : ''}`} 
              style={{ flex: 1 }}
              onClick={() => setSalePaymentStatus('paid')}
              disabled={isSavingSale}
            >
              Paid
            </button>
            <button 
              type="button" 
              className={`btn btn-outline ${salePaymentStatus === 'unpaid' ? 'active' : ''}`} 
              style={{ flex: 1 }}
              onClick={() => setSalePaymentStatus('unpaid')}
              disabled={isSavingSale}
            >
              Unpaid (Credit)
            </button>
          </div>

          {salePaymentStatus === 'paid' && (
            <div className="form-group" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['cash', 'gcash', 'bank'].map(method => (
                <button 
                  key={method}
                  type="button" 
                  className={`btn btn-outline ${salePaymentMethod === method ? 'active' : ''}`} 
                  style={{ flex: 1, fontSize: '0.875rem' }}
                  onClick={() => setSalePaymentMethod(method)}
                  disabled={isSavingSale}
                >
                  {method.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '18px', fontSize: '1.125rem' }} disabled={isSavingSale}>
            {isSavingSale ? 'Saving...' : <><Plus size={20} /> Record ₱{((Number(saleKg) || 0) * (saleType === 'pickup' ? settings.pickup_price : settings.delivery_price)).toLocaleString()}</>}
          </button>
        </form>
      )}

      {/* SECONDARY ACTION: LOG PRODUCTION */}
      {viewMode === 'daily' && !isLoading && (
        <form className="card" onSubmit={handleAddProduction}>
          <div className="card-header">Log Production</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="number" 
              className="form-control mono" 
              placeholder="0 kg"
              value={prodKg}
              onChange={(e) => setProdKg(e.target.value)}
              min="0"
              step="any"
              style={{ padding: '12px', fontSize: '1.25rem' }}
              required
              disabled={isSavingProd}
            />
            <button type="submit" className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} disabled={isSavingProd}>
              {isSavingProd ? 'Saving...' : <><Plus size={20} /> Add</>}
            </button>
          </div>
        </form>
      )}

      {/* TERTIARY ACTION: LOG EXPENSE */}
      {viewMode === 'daily' && !isLoading && (
        <form className="card" onSubmit={handleAddExpense}>
          <div className="card-header">Log Expense</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Description (e.g. Fuel)"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              style={{ padding: '12px', fontSize: '1.25rem', flex: 2 }}
              required
              disabled={isSavingExpense}
            />
            <input 
              type="number" 
              className="form-control mono" 
              placeholder="Amount (₱)"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              min="0"
              step="any"
              style={{ padding: '12px', fontSize: '1.25rem', flex: 1, minWidth: '110px' }}
              required
              disabled={isSavingExpense}
            />
            <button type="submit" className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} disabled={isSavingExpense}>
              {isSavingExpense ? 'Saving...' : <><Plus size={20} /> Add</>}
            </button>
          </div>
        </form>
      )}

      {/* DETAILED LEDGER (Collapsible) */}
      {!isLoading && (
        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button 
            className="btn-text" 
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}
          >
            {isDetailsOpen ? 'Hide Detailed Numbers' : 'View Detailed Numbers'}
            {isDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {isDetailsOpen && (
            <div className="ledger-grid" style={{ margin: '0 20px 20px 20px' }}>
              <div className="ledger-item">
                <span className="ledger-label">Carryover Stock</span>
                <span className="ledger-value mono">{carryover} kg</span>
              </div>
              <div className="ledger-item">
                <span className="ledger-label">Total Production</span>
                <span className="ledger-value mono">+{prodTotal} kg</span>
              </div>
              <div className="ledger-item" style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '-8px' }}>
                <span className="ledger-label">Total Available Stock</span>
                <span className="ledger-value mono" style={{ fontSize: '1.25rem' }}>{totalAvailableStock} kg</span>
              </div>
              <div className="ledger-item" style={{ gridColumn: 'span 2', borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px' }}>
                <span className="ledger-label">Total Sold</span>
                <span className="ledger-value mono negative">-{salesTotal} kg</span>
              </div>
              <div className="ledger-item">
                <span className="ledger-label">Total Revenue</span>
                <span className="ledger-value mono">₱{revenueTotal.toLocaleString()}</span>
              </div>
              <div className="ledger-item" style={{ display: 'flex', gap: '16px', gridColumn: 'span 2', background: 'var(--surface-color)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ flex: 1 }}>
                  <span className="ledger-label" style={{ fontSize: '0.75rem' }}>Collected (Paid)</span>
                  <span className="ledger-value mono positive" style={{ fontSize: '1rem' }}>₱{collectedTotal.toLocaleString()}</span>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                  <span className="ledger-label" style={{ fontSize: '0.75rem' }}>Unpaid (Utang)</span>
                  <span className="ledger-value mono negative" style={{ fontSize: '1rem' }}>₱{unpaidTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="ledger-item">
                <span className="ledger-label">Total Est. Cost</span>
                <span className="ledger-value mono" style={{ color: 'var(--text-secondary)' }}>₱{costTotal.toLocaleString()}</span>
              </div>
              <div className="ledger-item">
                <span className="ledger-label">Total Expenses</span>
                <span className="ledger-value mono negative">-₱{expensesTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* AGGREGATE BREAKDOWN TABLE */}
      {viewMode !== 'daily' && !isLoading && (
        <section className="card">
          <div className="card-header">Day-by-Day Breakdown</div>
          <div className="aggregate-table-wrapper">
            <table className="aggregate-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prod</th>
                  <th>Sold</th>
                  <th>Rev.</th>
                  <th>Exp.</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {generateAggregateRows().map(row => (
                  <tr key={row.date.toISOString()}>
                    <td>{format(row.date, 'MMM d')}</td>
                    <td className="mono">{row.produced > 0 ? `+${row.produced}` : '-'}</td>
                    <td className="mono">{row.sold > 0 ? `-${row.sold}` : '-'}</td>
                    <td className="mono">₱{row.revenue.toLocaleString()}</td>
                    <td className="mono negative">{row.expenses > 0 ? `-₱${row.expenses.toLocaleString()}` : '-'}</td>
                    <td className={`mono ${row.profit > 0 ? 'positive' : ''}`}>₱{row.profit.toLocaleString()}</td>
                  </tr>
                ))}
                {generateAggregateRows().length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>
                      No activity in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DAILY TRANSACTION LOGS */}
      {viewMode === 'daily' && !isLoading && (sales.length > 0 || production.length > 0 || expenses.length > 0) && (
        <section className="card">
          <div className="card-header">Today's Entries</div>
          <ul className="log-list">
            {sales.map(sale => (
              <li key={sale.id} className="log-item">
                <div className="log-details">
                  <span className="log-title">Sale ({sale.sale_type}) {sale.customer_name ? `- ${sale.customer_name}` : ''}</span>
                  <span className="log-meta">
                    {format(new Date(sale.created_at), 'h:mm a')} • ₱{Number(sale.price_per_kg).toFixed(2)}/kg
                    {sale.payment_status === 'unpaid' ? (
                      <span style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: '8px' }}>[UNPAID]</span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: '8px' }}>[{sale.payment_method?.toUpperCase() || 'CASH'}]</span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="log-amount">
                    <div className="mono negative">-{sale.kg} kg</div>
                    <div className="mono positive" style={{ fontSize: '0.875rem' }}>+₱{sale.revenue}</div>
                  </div>
                  {sale.payment_status === 'unpaid' && (
                    <button className="btn btn-outline" onClick={() => handleMarkAsPaid(sale.id)} style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#059669', borderColor: '#059669' }}>
                      Mark Paid
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => handleDeleteSale(sale.id)}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </li>
            ))}
            {production.map(prod => (
              <li key={prod.id} className="log-item">
                <div className="log-details">
                  <span className="log-title">Production</span>
                  <span className="log-meta">{format(new Date(prod.created_at), 'h:mm a')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="log-amount">
                    <div className="mono positive">+{prod.kg_produced} kg</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => handleDeleteProduction(prod.id)}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </li>
            ))}
            {expenses.map(exp => (
              <li key={exp.id} className="log-item">
                <div className="log-details">
                  <span className="log-title">Expense ({exp.description})</span>
                  <span className="log-meta">{format(new Date(exp.created_at), 'h:mm a')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="log-amount">
                    <div className="mono negative">-₱{exp.amount}</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => handleDeleteExpense(exp.id)}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Floating Actions */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 100 }}>
        <button className="btn btn-outline" onClick={handleExportSummary} title="Export Summary to Excel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-color)', boxShadow: 'var(--shadow-md)', width: '120px' }}>
          <Download size={18} /> <span>Summary</span>
        </button>
        <button className="btn btn-outline" onClick={handleExportDetailed} title="Export Detailed Logs to Excel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-color)', boxShadow: 'var(--shadow-md)', width: '120px' }}>
          <Download size={18} /> <span>Detailed</span>
        </button>
        <button className="btn btn-outline" onClick={handleLogout} title="Log Out" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)', backgroundColor: 'var(--bg-color)', boxShadow: 'var(--shadow-md)', width: '120px' }}>
          <LogOut size={18} /> <span>Logout</span>
        </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Settings</h3>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Pickup Price (₱ per kg)</label>
                <input 
                  type="number" 
                  className="form-control mono" 
                  value={settingsForm.pickup_price}
                  onChange={(e) => setSettingsForm({...settingsForm, pickup_price: e.target.value})}
                  min="0"
                  step="any"
                  required
                />
              </div>
              <div className="form-group">
                <label>Delivery Price (₱ per kg)</label>
                <input 
                  type="number" 
                  className="form-control mono" 
                  value={settingsForm.delivery_price}
                  onChange={(e) => setSettingsForm({...settingsForm, delivery_price: e.target.value})}
                  min="0"
                  step="any"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cost to Produce (₱ per kg)</label>
                <input 
                  type="number" 
                  className="form-control mono" 
                  value={settingsForm.cost_per_kg}
                  onChange={(e) => setSettingsForm({...settingsForm, cost_per_kg: e.target.value})}
                  min="0"
                  step="any"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px', marginBottom: '16px' }}>
                Save Settings
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
