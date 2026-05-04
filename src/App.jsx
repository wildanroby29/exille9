import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Zap, Smartphone, Search, Copy, Trash2, History, RefreshCw, CheckCircle, Lock, User, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://wildanrobians29-otp-gateway-api.hf.space';

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('logged_user') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [balance, setBalance] = useState(0); 
  const [livePrices, setLivePrices] = useState([]); // Master data harga
  const [displayCountries, setDisplayCountries] = useState([]); // Data negara unik untuk list
  const [selectedCountry, setSelectedCountry] = useState({ code: '6', name: 'Indonesia' });
  const [selectedPriceOption, setSelectedPriceOption] = useState(null); // Opsi harga aktif
  const [selectedProvider, setSelectedProvider] = useState('Any');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOrderingState, setIsOrderingState] = useState(false);
  const isOrdering = useRef(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [logs, setLogs] = useState([]);

  // --- LOGIN ---
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
        } else { setLoginError('❌ Username atau Password salah!'); }
    } catch (err) { setLoginError('❌ Server Error!'); }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setUser('');
    setCredentials({ username: '', password: '' });
  };

  // --- DATA LOADING ---
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
    } catch (err) { console.log("Balance offline"); }
  };

  const fetchRealPrices = async () => {
    try {
      const res = await fetch(`${API_URL}/get-real-prices`);
      const data = await res.json();
      if (data.status === 'success') {
        const names = {
          "0": "Russia", "1": "Ukraine", "2": "Kazakhstan", "3": "China", "4": "Philippines",
          "5": "Myanmar", "6": "Indonesia", "7": "Malaysia", "8": "Kenya", "9": "Tanzania",
          "10": "Vietnam", "11": "Kyrgyzstan", "12": "USA", "13": "Israel", "14": "Hong Kong",
          "15": "Poland", "16": "United Kingdom", "17": "Madagascar", "18": "Congo", "19": "Nigeria",
          "22": "India", "31": "South Africa", "32": "Romania", "52": "Thailand", "56": "Spain",
          "62": "Turkey", "73": "Brazil", "82": "Singapore", "86": "UAE"
        };

        const allData = data.prices.map(p => ({ ...p, name: names[p.code] || `Negara ${p.code}` }));
        setLivePrices(allData);

        // Grouping unik untuk list negara
        const unique = allData.reduce((acc, curr) => {
          if (!acc.find(x => x.code === curr.code)) {
            const options = allData.filter(ap => ap.code === curr.code);
            const cheapest = options.sort((a, b) => a.priceIdr - b.priceIdr)[0];
            acc.push({ ...curr, minPrice: cheapest.priceIdr });
          }
          return acc;
        }, []);

        const sorted = unique.sort((a, b) => a.code === '6' ? -1 : b.code === '6' ? 1 : a.name.localeCompare(b.name));
        setDisplayCountries(sorted);

        // Default selection
        const currentIndo = sorted.find(p => p.code === '6') || sorted[0];
        if (currentIndo) {
            setSelectedCountry({ code: currentIndo.code, name: currentIndo.name });
            const options = allData.filter(p => p.code === currentIndo.code).sort((a, b) => a.priceIdr - b.priceIdr);
            setSelectedPriceOption(options[0]);
        }
      }
    } catch (err) { console.log("Gagal memuat harga"); }
  };

  const handleSelectCountry = (country) => {
    setSelectedCountry({ code: country.code, name: country.name });
    const options = livePrices.filter(p => p.code === country.code).sort((a, b) => a.priceIdr - b.priceIdr);
    setSelectedPriceOption(options[0]);
  };
  
  // --- ORDER LOGIC ---
  const handleOrder = async (qty = 1) => {
    if (isOrdering.current || !selectedPriceOption) return;
    isOrdering.current = true;
    setIsOrderingState(true); 
    setErrorMsg('');
    for (let i = 0; i < qty; i++) {
      try {
        const op = selectedProvider.toLowerCase() === 'any' ? '' : `&operator=${selectedProvider.toLowerCase()}`;
        // Kirim priceIdr yang dipilih dari dropdown
        const res = await fetch(`${API_URL}/order-wa?country=${selectedCountry.code}&username=${user}&price=${selectedPriceOption.priceIdr}${op}`);
        const data = await res.json();
        if (data.status === 'success') {
          setActiveOrders(prev => [{ id: data.id, number: data.number, otp: null, status: 'WAITING', createdAt: Date.now() }, ...prev]);
          fetchBalance();
          if (qty > 1) await new Promise(r => setTimeout(r, 1000));
        } else { setErrorMsg(`⚠️ ${data.message}`); break; }
      } catch (err) { setErrorMsg("⚠️ ERROR SERVER!"); break; }
    }
    setIsOrderingState(false);
    isOrdering.current = false;
  };

  // --- CANCEL & REFUND LOGIC ---
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

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem(`logs_${user}`);
  };

  // --- BACKGROUND CHECKER ---
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      setActiveOrders(prev => {
        const updated = prev.map(o => {
          const isTooOld = (Date.now() - o.createdAt) / 1000 > 300;
          if (!o.otp && isTooOld && o.status === 'WAITING') {
            fetch(`${API_URL}/cancel-order?id=${o.id}`).then(() => fetchBalance());
            return { ...o, status: 'EXPIRED' };
          }
          return o;
        });
        return updated;
      });

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

  const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const copy = (t) => { if (t) navigator.clipboard.writeText(t); };

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <Zap size={48} className="text-blue" fill="currentColor" style={{marginBottom: '10px'}}/>
          <h2> E X I L L E 9</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group"><User size={16}/><input type="text" placeholder="Username" value={credentials.username} onChange={(e) => setCredentials({...credentials, username: e.target.value})} required /></div>
            <div className="input-group"><Lock size={16}/><input type="password" placeholder="Password" value={credentials.password} onChange={(e) => setCredentials({...credentials, password: e.target.value})} required /></div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="btn-login">LOGIN SYSTEM</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo"><Zap size={16} className="text-blue" fill="currentColor"/> E X I L L E 9</div>
        <div className="user-profile-badge"><div className="avatar">{user[0].toUpperCase()}</div><span>{user.toUpperCase()}</span></div>
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
            <button onClick={() => { fetchBalance(); fetchRealPrices(); }} className="refresh-btn-small">
              <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''}/> REFRESH
            </button>
          </div>
          <div className="balance-box" style={{textAlign: 'right'}}>
            <div style={{fontSize: '9px', color: '#64748b'}}>SALDO USER (IDR)</div>
            <div className="balance-amt">{formatIDR(balance)}</div>
          </div>
        </header>

        {activeMenu === 'dashboard' ? (
          <div className="dashboard-wrapper">
            <div className="panel-card">
              <div className="panel-header">Settings Hero-SMS</div>
              <div className="scroll-area">
                <div className="provider-grid">
                  {['Any', 'Telkomsel', 'Indosat', 'XL', 'Axis', 'Three', 'Smartfren'].map(p => (
                    <button key={p} className={`provider-btn ${selectedProvider === p ? 'active' : ''}`} onClick={() => setSelectedProvider(p)}>{p}</button>
                  ))}
                </div>
                
                <div style={{position: 'relative', margin: '15px 0 8px 0'}}>
                  <Search size={12} style={{position: 'absolute', left: '8px', top: '8px', color: '#64748b'}}/>
                  <input type="text" placeholder="Cari Negara..." className="search-input-custom" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                {/* List Negara */}
                <div style={{maxHeight: '120px', overflowY: 'auto', border: '1px solid #232d42', borderRadius: '4px'}}>
                    {displayCountries.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.code.includes(searchTerm)).map(n => (
                    <div key={n.code} className={`list-item ${selectedCountry.code === n.code ? 'active' : ''}`} onClick={() => handleSelectCountry(n)}>
                        <span>{n.name} ({n.code})</span><span className="text-blue" style={{fontSize: '10px'}}>Mulai {formatIDR(n.minPrice)}</span>
                    </div>
                    ))}
                </div>

                {/* Dropdown Kategori Harga */}
                <div style={{marginTop: '15px'}}>
                  <label style={{fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '5px'}}>PILIH KATEGORI HARGA:</label>
                  <select 
                    className="search-input-custom" 
                    style={{padding: '5px', appearance: 'auto', cursor: 'pointer'}}
                    value={selectedPriceOption?.priceIdr || ''}
                    onChange={(e) => setSelectedPriceOption(livePrices.find(p => p.code === selectedCountry.code && p.priceIdr == e.target.value))}
                  >
                    {livePrices.filter(p => p.code === selectedCountry.code).sort((a,b) => a.priceIdr - b.priceIdr).map((opt, idx) => (
                      <option key={idx} value={opt.priceIdr}>
                        {idx === 0 ? '🔥 TERMURAH: ' : 'Kategori: '} {formatIDR(opt.priceIdr)}
                      </option>
                    ))}
                  </select>
                </div>

                <button disabled={isOrderingState} className="btn-order-single" onClick={() => handleOrder(1)}>
                  {isOrderingState ? 'ORDERING...' : `+ ORDER 1 NUM (${formatIDR(selectedPriceOption?.priceIdr || 0)})`}
                </button>
                <button disabled={isOrderingState} className="btn-order-mass" onClick={() => handleOrder(5)}>
                  {isOrderingState ? 'PROCESSING...' : '🚀 MASS ORDER 5X'}
                </button>
                {errorMsg && <div className="text-red" style={{fontSize:'10px', marginTop:'5px'}}>{errorMsg}</div>}
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
                        <span style={{fontSize:'9px', color:'#64748b'}}>ID: {o.id}</span>
                        <span className={`slot-num ${o.status === 'EXPIRED' ? 'expired' : ''}`}>
                         {o.number.replace(/^(62|6)/, '')}
                        </span>
                        {o.status === 'WAITING' && (
                          <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px'}}>
                            <span className="timer-text">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>
                            <span className="status-desc">Waiting SMS...</span>
                          </div>
                        )}
                        {o.status === 'EXPIRED' && <span className="status-desc text-red">Expired & Refunded</span>}
                        {o.otp && <span className="status-desc text-green">OTP Received</span>}
                      </div>
                      <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        {o.otp ? <div className="otp-badge">{o.otp}</div> : o.status === 'EXPIRED' ? <RefreshCw size={12} style={{opacity: 0.2}}/> : <RefreshCw size={14} className="animate-spin text-blue"/>}
                      </div>
                      <div style={{display: 'flex', gap: '4px'}}>
                        <button onClick={() => copy(o.otp || o.number.replace(/^(62|6)/, ''))} className="btn-icon"><Copy size={12}/></button>
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
                      <span className="text-green" style={{fontWeight:'bold'}}>SUCCESS</span>
                      <span style={{color: '#64748b'}}>{l.time}</span>
                    </div>
                    <div style={{color: '#fff', margin: '2px 0'}}>{l.number.replace(/^(62|6)/, '')}</div>
                    <div className="text-blue" style={{fontWeight: '900'}}>OTP: {l.otp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{padding: '60px', textAlign: 'center'}}>
            <History size={40} style={{marginBottom: '10px', color: '#64748b'}}/>
            <h3>Riwayat Aktivitas</h3>
            <p style={{fontSize: '12px', color: '#64748b', marginBottom: '20px'}}>Menampilkan 50 data terakhir yang tersimpan di perangkat ini.</p>
            <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                <button className="btn-order-mass" style={{width: 'auto', padding: '10px 20px'}} onClick={() => setActiveMenu('dashboard')}>Kembali</button>
                <button className="btn-order-single" style={{width: 'auto', padding: '10px 20px', backgroundColor:'#ef4444'}} onClick={clearLogs}>Hapus Semua History</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
