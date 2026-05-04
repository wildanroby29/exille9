import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Zap, Smartphone, Search, Copy, Trash2, History, RefreshCw, Lock, User, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://wildanrobians29-otp-gateway-api.hf.space';

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('logged_user') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [balance, setBalance] = useState(0); 
  const [livePrices, setLivePrices] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState({ code: '6', price: 0, name: 'Indonesia' });
  const [selectedProvider, setSelectedProvider] = useState('Any');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isOrdering = useRef(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [logs, setLogs] = useState([]);

  // --- LOGIN LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: credentials.username.trim().toLowerCase(), 
                password: credentials.password.trim() 
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            localStorage.setItem('logged_user', data.user.username);
            setUser(data.user.username);
        } else { setLoginError('❌ Login Gagal!'); }
    } catch (err) { setLoginError('❌ Server Offline!'); }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setUser('');
  };

  // --- DATA SYNC ---
  useEffect(() => {
    if (user) {
      setActiveOrders(JSON.parse(localStorage.getItem(`orders_${user}`)) || []);
      setLogs(JSON.parse(localStorage.getItem(`logs_${user}`)) || []);
      fetchBalance();
      fetchRealPrices();
    }
  }, [user]);

  useEffect(() => { if (user) localStorage.setItem(`orders_${user}`, JSON.stringify(activeOrders)); }, [activeOrders, user]);
  useEffect(() => { if (user) localStorage.setItem(`logs_${user}`, JSON.stringify(logs)); }, [logs, user]);

  const fetchBalance = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/get-user-balance?username=${user}`);
      const data = await res.json();
      if (data.status === 'success') setBalance(parseFloat(data.balance));
    } catch (err) { console.error("Balance fetch error"); }
  };

  const fetchRealPrices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/get-real-prices`);
      const data = await res.json();
      if (data.status === 'success' && data.prices) {
        const names = {
          "0": "Russia", "1": "Ukraine", "2": "Kazakhstan", "3": "China", "4": "Philippines",
          "5": "Myanmar", "6": "Indonesia", "7": "Malaysia", "8": "Kenya", "9": "Tanzania",
          "10": "Vietnam", "11": "Kyrgyzstan", "12": "USA", "13": "Israel", "14": "Hong Kong",
          "15": "Poland", "16": "United Kingdom", "22": "India", "32": "Romania", "36": "Canada",
          "40": "Uzbekistan", "43": "Germany", "48": "Netherlands", "52": "Thailand", "53": "Saudi Arabia",
          "56": "Spain", "62": "Turkey", "73": "Brazil", "82": "Singapore", "83": "Italy", "86": "UAE"
        };
        const formatted = data.prices.map(p => ({ ...p, name: names[p.code] || `Negara ${p.code}` }));
        const sorted = formatted.sort((a, b) => a.code === '6' ? -1 : b.code === '6' ? 1 : a.name.localeCompare(b.name));
        setLivePrices(sorted);
        
        // Auto-select Indonesia jika tersedia
        const indo = sorted.find(p => p.code === '6');
        if (indo) setSelectedCountry({ code: indo.code, price: indo.priceIdr, name: indo.name });
      }
    } catch (err) { console.error("Gagal load negara"); }
    setIsLoading(false);
  };
  
  // --- ORDER & OTP ---
  const handleOrder = async (qty = 1) => {
    if (isOrdering.current) return;
    isOrdering.current = true;
    setErrorMsg('');
    for (let i = 0; i < qty; i++) {
      try {
        const op = selectedProvider.toLowerCase() === 'any' ? '' : `&operator=${selectedProvider.toLowerCase()}`;
        const res = await fetch(`${API_URL}/order-wa?country=${selectedCountry.code}&username=${user}&price=${selectedCountry.price}${op}`);
        const data = await res.json();
        if (data.status === 'success') {
          setActiveOrders(prev => [{ id: data.id, number: data.number, otp: null, status: 'WAITING', createdAt: Date.now() }, ...prev]);
          fetchBalance();
        } else { setErrorMsg(`⚠️ ${data.message}`); break; }
      } catch (err) { setErrorMsg("⚠️ Server Error"); break; }
    }
    isOrdering.current = false;
  };

  const handleCancel = async (id) => {
    try {
      const res = await fetch(`${API_URL}/cancel-order?id=${id}`);
      const data = await res.json();
      if (data.status === 'success') {
        setActiveOrders(prev => prev.filter(x => x.id !== id));
        fetchBalance();
      }
    } catch (e) { console.error("Cancel failed"); }
  };

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      // Check Expiration
      setActiveOrders(prev => {
        return prev.map(o => {
          const timeLeft = 300 - (Date.now() - o.createdAt) / 1000;
          if (!o.otp && timeLeft <= 0 && o.status === 'WAITING') {
            handleCancel(o.id);
            return { ...o, status: 'EXPIRED' };
          }
          return o;
        });
      });

      // Check OTP
      activeOrders.filter(o => o.status === 'WAITING').forEach(async (order) => {
        try {
          const res = await fetch(`${API_URL}/check-otp?id=${order.id}`);
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            setActiveOrders(prev => prev.map(o => o.id === order.id ? { ...o, otp: data.code, status: 'SUCCESS' } : o));
            setLogs(l => [{ number: order.number, otp: data.code, time: new Date().toLocaleTimeString() }, ...l].slice(0, 50));
            fetchBalance();
          }
        } catch (e) {}
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [user, activeOrders]);

  const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <Zap size={40} className="text-blue" fill="currentColor"/>
          <h2 style={{margin: '15px 0'}}>E X I L L E 9</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group"><User size={16}/><input type="text" placeholder="Username" onChange={(e) => setCredentials({...credentials, username: e.target.value})} required /></div>
            <div className="input-group"><Lock size={16}/><input type="password" placeholder="Password" onChange={(e) => setCredentials({...credentials, password: e.target.value})} required /></div>
            {loginError && <p className="text-red" style={{fontSize: '11px'}}>{loginError}</p>}
            <button type="submit" className="btn-login">ENTER SYSTEM</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo"><Zap size={14} fill="currentColor"/> EX9-PANEL</div>
        <nav style={{flex: 1, marginTop: '20px'}}>
          <div className={`list-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('dashboard')}><Smartphone size={14}/> Dashboard</div>
          <div className={`list-item ${activeMenu === 'history' ? 'active' : ''}`} onClick={() => setActiveMenu('history')}><History size={14}/> History</div>
        </nav>
        <button className="logout-btn" onClick={handleLogout}><LogOut size={14}/> Logout</button>
      </aside>

      <main className="main-content">
        <header className="header-top">
          <div><span style={{color: '#64748b'}}>Welcome back,</span> <br/><b>{user.toUpperCase()}</b></div>
          <div className="balance-box">
            <span style={{fontSize: '10px', color: '#64748b'}}>SALDO AKTIF</span>
            <div className="balance-amt text-blue">{formatIDR(balance)}</div>
          </div>
        </header>

        {activeMenu === 'dashboard' ? (
          <div className="dashboard-wrapper">
            {/* Panel Kiri: Settings */}
            <div className="panel-card">
              <div className="panel-header">Settings & Countries</div>
              <div className="scroll-area">
                <div className="provider-grid">
                  {['Any', 'Telkomsel', 'Indosat', 'XL', 'Axis', 'Three'].map(p => (
                    <button key={p} className={`provider-btn ${selectedProvider === p ? 'active' : ''}`} onClick={() => setSelectedProvider(p)}>{p}</button>
                  ))}
                </div>
                
                <div style={{position: 'relative', margin: '15px 0'}}>
                  <Search size={12} style={{position: 'absolute', left: '10px', top: '10px', color: '#64748b'}}/>
                  <input type="text" placeholder="Cari negara..." className="search-input-custom" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="country-list">
                  {livePrices.length > 0 ? (
                    livePrices.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase())).map(n => (
                      <div key={n.code} className={`list-item ${selectedCountry.code === n.code ? 'active' : ''}`} onClick={() => setSelectedCountry({code: n.code, price: n.priceIdr, name: n.name})}>
                        <span>{n.name}</span><span className="text-blue">{formatIDR(n.priceIdr)}</span>
                      </div>
                    ))
                  ) : <div className="text-center" style={{padding: '20px', color: '#64748b'}}>Memuat negara...</div>}
                </div>

                <button className="btn-order-single" onClick={() => handleOrder(1)}>ORDER 1x ({formatIDR(selectedCountry.price)})</button>
                <button className="btn-order-mass" onClick={() => handleOrder(5)}>MASS ORDER 5x</button>
                {errorMsg && <p className="text-red" style={{fontSize: '10px', marginTop: '10px'}}>{errorMsg}</p>}
              </div>
            </div>

            {/* Panel Tengah: Live Monitor */}
            <div className="panel-card">
              <div className="panel-header">Live OTP Monitor</div>
              <div className="scroll-area">
                {activeOrders.length === 0 && <div className="text-center" style={{marginTop: '50px', color: '#64748b'}}>Belum ada order aktif</div>}
                {activeOrders.map(o => (
                  <div key={o.id} className="number-slot">
                    <div style={{flex: 1}}>
                      <div style={{fontSize: '14px', fontWeight: 'bold'}}>{o.number}</div>
                      <div style={{fontSize: '10px', color: '#64748b'}}>{o.status}</div>
                    </div>
                    {o.otp ? <div className="otp-badge">{o.otp}</div> : <RefreshCw size={14} className="animate-spin text-blue"/>}
                    <div style={{display: 'flex', gap: '5px', marginLeft: '10px'}}>
                      <button onClick={() => navigator.clipboard.writeText(o.otp || o.number)} className="btn-icon"><Copy size={12}/></button>
                      <button onClick={() => handleCancel(o.id)} className="btn-icon text-red"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Kanan: Logs */}
            <div className="panel-card">
              <div className="panel-header">Success History</div>
              <div className="scroll-area" style={{padding: 0}}>
                {logs.map((l, i) => (
                  <div key={i} className="log-row">
                    <div style={{fontSize: '10px', color: '#64748b'}}>{l.time}</div>
                    <div style={{fontWeight: 'bold'}}>{l.number}</div>
                    <div className="text-green">OTP: {l.otp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center" style={{padding: '50px'}}>
             <History size={40} style={{color: '#64748b'}}/>
             <p>Fitur History Lengkap sedang sinkronisasi...</p>
          </div>
        )}
      </main>
    </div>
  );
}
