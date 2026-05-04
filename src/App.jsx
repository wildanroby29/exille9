import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Zap, Smartphone, Search, Copy, Trash2, History, RefreshCw, Search as SearchIcon, Lock, User, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://wildanrobians29-otp-gateway-api.hf.space';

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('logged_user') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [balance, setBalance] = useState(0); 
  const [rawPrices, setRawPrices] = useState({}); 
  const [displayCountries, setDisplayCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState({ code: '6', name: 'Indonesia' });
  const [selectedPriceOption, setSelectedPriceOption] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('Any');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOrderingState, setIsOrderingState] = useState(false);
  const isOrdering = useRef(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [logs, setLogs] = useState([]);

  const countryNames = {
    "0": "Russia", "1": "Ukraine", "2": "Kazakhstan", "3": "China", "4": "Philippines",
    "5": "Myanmar", "6": "Indonesia", "7": "Malaysia", "8": "Kenya", "9": "Tanzania",
    "10": "Vietnam", "12": "USA", "15": "Poland", "16": "United Kingdom", "22": "India",
    "52": "Thailand", "62": "Turkey", "73": "Brazil", "82": "Singapore", "187": "USA (Virtual)"
  };

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
    } catch (err) { setLoginError('❌ Server Error!'); }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setUser('');
  };

  useEffect(() => {
    if (user) {
      setActiveOrders(JSON.parse(localStorage.getItem(`orders_${user}`)) || []);
      setLogs(JSON.parse(localStorage.getItem(`logs_${user}`)) || []);
      fetchBalance();
      fetchRealPrices();
    }
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/get-user-balance?username=${user}`);
      const data = await res.json();
      if (data.status === 'success') setBalance(parseFloat(data.balance));
    } catch (err) {}
  };

  const fetchRealPrices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/get-real-prices`);
      const data = await res.json();
      
      console.log("DEBUG API PRICES:", data); // CEK DI CONSOLE F12

      if (data.status === 'success' && data.prices) {
        const priceData = data.prices;
        setRawPrices(priceData);

        const countries = Object.keys(priceData).map(code => ({
          code: String(code),
          name: countryNames[code] || `Country ${code}`
        })).sort((a, b) => a.code === '6' ? -1 : b.code === '6' ? 1 : a.name.localeCompare(b.name));

        setDisplayCountries(countries);
        
        // Paksa cari opsi harga untuk negara default (Indonesia/6)
        const initialOptions = parseOptions(priceData, selectedCountry.code);
        if (initialOptions.length > 0) {
          setSelectedPriceOption(initialOptions[0]);
        }
      }
    } catch (err) { console.error("Gagal ambil data harga server."); }
    setIsLoading(false);
  };

  const parseOptions = (allPrices, countryCode) => {
    // Pastikan countryCode jadi string karena key object API biasanya string
    const codeStr = String(countryCode);
    const countryData = allPrices[codeStr];

    console.log(`Cek Data Negara ${codeStr}:`, countryData);

    if (countryData && countryData['wa']) {
      const options = Object.entries(countryData['wa']).map(([prc, cnt]) => ({
        price: parseFloat(prc),
        count: parseInt(cnt)
      })).sort((a, b) => a.price - b.price);
      
      console.log("Hasil Parse Options:", options);
      return options;
    }
    return [];
  };

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    const options = parseOptions(rawPrices, country.code);
    setSelectedPriceOption(options.length > 0 ? options[0] : null);
  };

  const handleOrder = async (qty = 1) => {
    if (isOrdering.current || !selectedPriceOption) return;
    isOrdering.current = true;
    setIsOrderingState(true); 
    setErrorMsg('');
    
    for (let i = 0; i < qty; i++) {
      try {
        const op = selectedProvider.toLowerCase() === 'any' ? '' : `&operator=${selectedProvider.toLowerCase()}`;
        const res = await fetch(`${API_URL}/order-wa?country=${selectedCountry.code}&username=${user}&price=${selectedPriceOption.price}${op}`);
        const data = await res.json();
        if (data.status === 'success') {
          setActiveOrders(prev => [{ id: data.id, number: data.number, otp: null, status: 'WAITING', createdAt: Date.now() }, ...prev]);
          fetchBalance();
          if (qty > 1) await new Promise(r => setTimeout(r, 800));
        } else { setErrorMsg(`⚠️ ${data.message}`); break; }
      } catch (err) { setErrorMsg("⚠️ ERROR SERVER!"); break; }
    }
    setIsOrderingState(false);
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
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
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
    }, 4000);
    return () => clearInterval(interval);
  }, [user, activeOrders]);

  const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
  const copy = (t) => { if (t) navigator.clipboard.writeText(t); };

  // Ambil list harga untuk ditampilkan di dropdown UI
  const currentOptions = parseOptions(rawPrices, selectedCountry.code);

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <Zap size={48} className="text-blue" fill="currentColor" style={{marginBottom: '10px'}}/>
          <h2> E X I L L E 9</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group"><User size={16}/><input type="text" placeholder="Username" value={credentials.username} onChange={(e) => setCredentials({...credentials, username: e.target.value})} required /></div>
            <div className="input-group"><Lock size={16}/><input type="password" placeholder="Password" value={credentials.password} onChange={(e) => setCredentials({...credentials, password: e.target.value})} required /></div>
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
                  <SearchIcon size={12} style={{position: 'absolute', left: '8px', top: '8px', color: '#64748b'}}/>
                  <input type="text" placeholder="Cari Negara..." className="search-input-custom" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div style={{maxHeight: '120px', overflowY: 'auto', border: '1px solid #232d42', borderRadius: '4px'}}>
                    {displayCountries.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.code.includes(searchTerm)).map(n => (
                    <div key={n.code} className={`list-item ${selectedCountry.code === n.code ? 'active' : ''}`} onClick={() => handleSelectCountry(n)}>
                        <span>{n.name} ({n.code})</span>
                    </div>
                    ))}
                </div>

                <div style={{marginTop: '15px'}}>
                  <label style={{fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '5px'}}>LAYANAN WHATSAPP (HARGA & STOK):</label>
                  <select 
                    className="search-input-custom" 
                    style={{padding: '8px', appearance: 'auto', cursor: 'pointer', background: '#1a2234', color: '#fff'}}
                    value={selectedPriceOption ? selectedPriceOption.price : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const opt = currentOptions.find(o => o.price === val);
                      setSelectedPriceOption(opt || null);
                    }}
                  >
                    {currentOptions.length > 0 ? currentOptions.map((opt, idx) => (
                      <option key={idx} value={opt.price}>
                        {formatIDR(opt.price)} | Stok: {opt.count} pcs
                      </option>
                    )) : <option value="">--- Stok Tidak Tersedia ---</option>}
                  </select>
                </div>

                <button disabled={isOrderingState || !selectedPriceOption} className="btn-order-single" onClick={() => handleOrder(1)}>
                  {isOrderingState ? 'ORDERING...' : `+ ORDER 1 NOMOR`}
                </button>
                <button disabled={isOrderingState || !selectedPriceOption} className="btn-order-mass" onClick={() => handleOrder(5)}>
                  {isOrderingState ? 'PROCESSING...' : '🚀 MASS ORDER 5X'}
                </button>
                {errorMsg && <div className="text-red" style={{fontSize:'10px', marginTop:'5px'}}>{errorMsg}</div>}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">Live Monitor ({activeOrders.length})</div>
              <div className="scroll-area">
                {activeOrders.map(o => (
                  <div key={o.id} className="number-slot">
                    <div style={{ flex: 1 }}>
                      <span style={{fontSize:'9px', color:'#64748b'}}>ID: {o.id}</span>
                      <span className="slot-num">{o.number}</span>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '10px' }}>
                      {o.otp ? <div className="otp-badge" onClick={() => copy(o.otp)}>{o.otp}</div> : <RefreshCw size={14} className="animate-spin text-blue"/>}
                    </div>
                    <div style={{display: 'flex', gap: '4px'}}>
                      <button onClick={() => copy(o.number)} className="btn-icon"><Copy size={12}/></button>
                      <button onClick={() => handleCancel(o.id)} className="btn-icon text-red"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">Activity Logs</div>
              <div className="scroll-area" style={{padding: 0}}>
                {logs.map((l, i) => (
                  <div key={i} className="log-row">
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '9px'}}>
                      <span className="text-green">SUCCESS</span>
                      <span style={{color: '#64748b'}}>{l.time}</span>
                    </div>
                    <div style={{color: '#fff'}}>{l.number}</div>
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
            <button className="btn-order-mass" style={{width: 'auto', padding: '10px 20px', marginTop:'20px'}} onClick={() => setActiveMenu('dashboard')}>Kembali</button>
          </div>
        )}
      </main>
    </div>
  );
}
