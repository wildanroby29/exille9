import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Zap, Smartphone, Search, Copy, Trash2, History, Wallet, RefreshCw, CheckCircle, Lock, User, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://wildanrobians29-otp-gateway-api.hf.space';

// AMBIL PASSWORD TINA ENV (HF SECRETS)
const USERS_DB = {
  "admin1": import.meta.env.VITE_ADMIN_ROOT1,
  "admin2": import.meta.env.VITE_ADMIN_ROOT2
};

export default function App() {
  // --- STATE LOGIN ---
  const [user, setUser] = useState(() => localStorage.getItem('logged_user') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- STATE DASHBOARD UTAMA ---
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [balance, setBalance] = useState(0); 
  const [selectedCountry, setSelectedCountry] = useState({ name: 'Indonesia', code: '6', price: 0.15 });
  const [selectedProvider, setSelectedProvider] = useState('Any');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOrderingState, setIsOrderingState] = useState(false);
  const isOrdering = useRef(false);

  // --- DATA DASHBOARD (DIPISAH PER USER) ---
  const [activeOrders, setActiveOrders] = useState([]);
  const [logs, setLogs] = useState([]);

  const countriesData = [
    { name: 'Indonesia', code: '6', price: 0.15 },
    { name: 'Russia', code: '1', price: 0.10 },
    { name: 'Vietnam', code: '10', price: 0.12 },
    { name: 'USA', code: '12', price: 0.20 },
    { name: 'Thailand', code: '22', price: 0.15 }
  ];

  // 1. LOAD DATA PER USER
  useEffect(() => {
    if (user) {
      const savedOrders = localStorage.getItem(`orders_${user}`);
      const savedLogs = localStorage.getItem(`logs_${user}`);
      setActiveOrders(savedOrders ? JSON.parse(savedOrders) : []);
      setLogs(savedLogs ? JSON.parse(savedLogs) : []);
      fetchBalance();
    }
  }, [user]);

  // 2. SAVE DATA PER USER
  useEffect(() => {
    if (user) localStorage.setItem(`orders_${user}`, JSON.stringify(activeOrders));
  }, [activeOrders, user]);

  useEffect(() => {
    if (user) localStorage.setItem(`logs_${user}`, JSON.stringify(logs));
  }, [logs, user]);

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = credentials;
    const lowerUser = username.toLowerCase();
    if (USERS_DB[lowerUser] && USERS_DB[lowerUser] === password) {
      localStorage.setItem('logged_user', lowerUser);
      setUser(lowerUser);
      setLoginError('');
    } else {
      setLoginError('❌ Username atawa Password salah!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setUser('');
    setCredentials({ username: '', password: '' });
  };

  const fetchBalance = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/get-balance`);
      const data = await res.json();
      if (data.status === 'success') setBalance(parseFloat(data.balance));
    } catch (err) { console.log("Balance offline"); }
    finally { setIsLoading(false); }
  };

  // Timer & Auto-Expire
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      setActiveOrders(prev => {
        return prev.map(o => {
          const age = (Date.now() - o.createdAt) / 1000;
          if (!o.otp && age > 300 && o.status === 'WAITING') {
            fetch(`${API_URL}/cancel-order?id=${o.id}`).catch(e => {});
            return { ...o, status: 'EXPIRED' };
          }
          return o;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Polling OTP (Stabil)
  useEffect(() => {
    if (!user) return;
    const pollInterval = setInterval(async () => {
      setActiveOrders(currentOrders => {
        const waitingOrders = currentOrders.filter(o => o.status === 'WAITING');
        waitingOrders.forEach(async (order) => {
          try {
            const res = await fetch(`${API_URL}/check-otp?id=${order.id}`);
            const data = await res.json();
            if (data.status === 'SUCCESS') {
              setActiveOrders(prev => prev.map(o => {
                if (o.id === order.id) {
                  const newLog = { number: o.number, otp: data.code, time: new Date().toLocaleTimeString() };
                  setLogs(l => [newLog, ...l].slice(0, 50));
                  return { ...o, otp: data.code, status: 'SUCCESS' };
                }
                return o;
              }));
              fetchBalance();
            }
          } catch (err) { console.log("Poll error"); }
        });
        return currentOrders; 
      });
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [user]);

  const handleOrder = async (qty = 1) => {
    if (isOrdering.current) return;
    isOrdering.current = true;
    setIsOrderingState(true); 
    setErrorMsg('');
    for (let i = 0; i < qty; i++) {
      try {
        const opParam = selectedProvider.toLowerCase() === 'any' ? '' : `&operator=${selectedProvider.toLowerCase()}`;
        const res = await fetch(`${API_URL}/order-wa?country=${selectedCountry.code}${opParam}`);
        const data = await res.json();
        if (data.status === 'success') {
          const newOrder = { id: data.id, number: data.number, otp: null, status: 'WAITING', createdAt: Date.now() };
          setActiveOrders(prev => [newOrder, ...prev]);
          fetchBalance();
          if (qty > 1) await new Promise(r => setTimeout(r, 1000));
        } else {
          setErrorMsg(`⚠️ ${data.message}`);
          break; 
        }
      } catch (err) { setErrorMsg("⚠️ BACKEND ERROR!"); break; }
    }
    setIsOrderingState(false);
    isOrdering.current = false;
  };

  const handleCancel = async (id) => {
    try {
      await fetch(`${API_URL}/cancel-order?id=${id}`);
      setActiveOrders(prev => prev.filter(x => x.id !== id));
      fetchBalance();
    } catch (err) { console.log("Cancel failed"); }
  };

  const copy = (txt) => { if (txt) navigator.clipboard.writeText(txt); };

  // --- HALAMAN LOGIN ---
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <Zap size={48} className="text-blue" fill="currentColor" style={{marginBottom: '10px'}}/>
          <h2> E X I L L E 9</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <User size={16}/><input type="text" placeholder="Username" onChange={(e) => setCredentials({...credentials, username: e.target.value})} required />
            </div>
            <div className="input-group">
              <Lock size={16}/><input type="password" placeholder="Password" onChange={(e) => setCredentials({...credentials, password: e.target.value})} required />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="btn-login">LOGIN SYSTEM</button>
          </form>
        </div>
      </div>
    );
  }

  // --- HALAMAN DASHBOARD (STRUKTUR TEU BERUBAH) ---
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo"><Zap size={16} className="text-blue" fill="currentColor"/> E X I L L E 9</div>
        <div className="user-profile-badge">
          <div className="avatar">{user[0].toUpperCase()}</div>
          <span>{user.toUpperCase()}</span>
        </div>
        <nav style={{flex: 1}}>
          <div className={`list-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('dashboard')}><Smartphone size={14}/> Dashboard</div>
          <div className={`list-item ${activeMenu === 'history' ? 'active' : ''}`} onClick={() => setActiveMenu('history')}><History size={14}/> History</div>
        </nav>
        <div className="logout-btn" onClick={handleLogout}><LogOut size={14}/> Logout</div>
      </aside>

      <main className="main-content">
        <header className="header-top">
          <div className="status-bar">
            <span>USER: <b className="text-blue">{user.toUpperCase()}</b></span>
            <button onClick={fetchBalance} className="refresh-btn-small">
              <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''}/> REFRESH
            </button>
          </div>
          <div className="balance-box" style={{textAlign: 'right'}}>
            <div style={{fontSize: '9px', color: '#64748b'}}>SALDO API</div>
            <div className="balance-amt">${balance.toFixed(2)}</div>
          </div>
        </header>

        {activeMenu === 'dashboard' ? (
          <div className="dashboard-wrapper">
            <div className="panel-card">
              <div className="panel-header">Settings</div>
              <div className="scroll-area">
                {/* ... (Isi Settings tetap sama seperti kode Anda) ... */}
                <div style={{fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '5px'}}>PROVIDER</div>
                <div className="provider-grid">
                  {['Any', 'Telkomsel', 'Indosat', 'XL', 'Axis', 'Three', 'Smartfren'].map(p => (
                    <button key={p} className={`provider-btn ${selectedProvider === p ? 'active' : ''}`} onClick={() => setSelectedProvider(p)}>{p}</button>
                  ))}
                </div>
                
                <div style={{fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '15px', marginBottom: '5px'}}>COUNTRY</div>
                <div style={{position: 'relative', marginBottom: '8px'}}>
                  <Search size={12} style={{position: 'absolute', left: '8px', top: '8px', color: '#64748b'}}/>
                  <input type="text" placeholder="Search..." className="search-input-custom" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div style={{maxHeight: '120px', overflowY: 'auto'}}>
                    {countriesData.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase())).map(n => (
                    <div key={n.name} className={`list-item ${selectedCountry.name === n.name ? 'active' : ''}`} onClick={() => setSelectedCountry(n)}>
                        <span>{n.name}</span><span className="text-blue">${n.price}</span>
                    </div>
                    ))}
                </div>

                <button disabled={isOrderingState} className="btn-order-single" onClick={() => handleOrder(1)}>+ ORDER 1 NUMBER</button>
                <button disabled={isOrderingState} className="btn-order-mass" onClick={() => handleOrder(5)}>🚀 MASS ORDER 5X</button>
                {errorMsg && <div className="error-notif">{errorMsg}</div>}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">Live Monitor ({activeOrders.length})</div>
              <div className="scroll-area">
                {activeOrders.map(o => {
                  const timeLeft = Math.max(0, Math.floor(300 - (Date.now() - o.createdAt) / 1000));
                  return (
                    <div key={o.id} className="number-slot" style={{borderColor: o.status === 'EXPIRED' ? '#450a0a' : o.otp ? '#059669' : '#232d42'}}>
                      <div style={{ flex: 1 }}>
                        <span className="slot-meta">ID: {o.id}</span>
                        <span className={`slot-num ${o.status === 'EXPIRED' ? 'expired' : ''}`}>{o.number}</span>
                        {!o.otp && o.status !== 'EXPIRED' && (
                          <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px'}}>
                            <span className="timer-text">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>
                            <span className="status-desc">Nunggu SMS...</span>
                          </div>
                        )}
                        {o.status === 'EXPIRED' && <span className="status-desc text-red">Expired</span>}
                        {o.otp && <span className="status-desc text-green">OTP Received</span>}
                      </div>
                      <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        {o.otp ? <div className="otp-badge">{o.otp}</div> : o.status === 'EXPIRED' ? <RefreshCw size={12} style={{opacity: 0.2}}/> : <RefreshCw size={14} className="animate-spin text-blue"/>}
                      </div>
                      <div style={{display: 'flex', gap: '4px'}}>
                        <button onClick={() => copy(o.otp || o.number)} className="btn-icon"><Copy size={12}/></button>
                        <button onClick={() => handleCancel(o.id)} className="btn-icon text-red"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">Activity Logs</div>
              <div className="scroll-area" style={{padding: 0}}>
                {logs.map((l, i) => (
                  <div key={i} className="log-row">
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '9px'}}>
                      <span className="text-green font-bold">SUCCESS</span>
                      <span style={{color: '#64748b'}}>{l.time}</span>
                    </div>
                    <div style={{color: '#fff', margin: '2px 0'}}>{l.number}</div>
                    <div className="text-blue" style={{fontWeight: '900'}}>OTP: {l.otp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{padding: '60px', textAlign: 'center'}}>
            <CheckCircle size={40} style={{marginBottom: '10px', color: '#64748b'}}/>
            <h3>Menu {activeMenu} dina pangerjaan</h3>
            <button className="btn-order-mass" style={{width: 'auto', padding: '10px 20px', marginTop: '20px'}} onClick={() => setActiveMenu('dashboard')}>Back to Dashboard</button>
          </div>
        )}
      </main>
    </div>
  );
}
