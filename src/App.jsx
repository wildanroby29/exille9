import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Zap, Smartphone, Search, Copy, Trash2, History, RefreshCw, CheckCircle, Lock, User, LogOut, Clock, Globe, ShieldCheck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://wildanrobians29-otp-gateway-api.hf.space';

export default function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(() => localStorage.getItem('logged_user') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [balance, setBalance] = useState(0); 
  const [livePrices, setLivePrices] = useState([]);
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

  // --- DATABASE NEGARA HERO-SMS LENGKAP ---
  const countryNames = {
    "0": "Russia", "1": "Ukraine", "2": "Kazakhstan", "3": "China", "4": "Philippines",
    "5": "Myanmar", "6": "Indonesia", "7": "Malaysia", "8": "Kenya", "9": "Tanzania",
    "10": "Vietnam", "11": "Kyrgyzstan", "12": "USA", "13": "Israel", "14": "Hong Kong",
    "15": "Poland", "16": "United Kingdom", "17": "Madagascar", "18": "Congo", "19": "Nigeria",
    "20": "Macao", "21": "Egypt", "22": "India", "23": "Ireland", "24": "Cambodia",
    "25": "Laos", "26": "Haiti", "27": "Ivory Coast", "28": "Gambia", "29": "Serbia",
    "30": "Yemen", "31": "South Africa", "32": "Romania", "33": "Colombia", "34": "Estonia",
    "35": "Azerbaijan", "36": "Canada", "37": "Morocco", "38": "Ghana", "39": "Argentina",
    "40": "Uzbekistan", "41": "Cameroon", "42": "Chad", "43": "Germany", "44": "Lithuania",
    "45": "Croatia", "46": "Sweden", "47": "Iraq", "48": "Netherlands", "49": "Latvia",
    "50": "Austria", "51": "Belarus", "52": "Thailand", "53": "Saudi Arabia", "54": "Mexico",
    "55": "Taiwan", "56": "Spain", "57": "Iran", "58": "Algeria", "59": "Slovenia",
    "60": "Bangladesh", "61": "Senegal", "62": "Turkey", "63": "Czech Republic", "64": "Sri Lanka",
    "65": "Peru", "66": "Pakistan", "67": "New Zealand", "68": "Guinea", "69": "Mali",
    "70": "Venezuela", "71": "Ethiopia", "72": "Mongolia", "73": "Brazil", "74": "Afghanistan",
    "75": "Uganda", "76": "Angola", "77": "Cyprus", "78": "France", "79": "Papua New Guinea",
    "80": "Mozambique", "81": "Nepal", "82": "Singapore", "83": "Bahrain", "84": "Armenia",
    "85": "Moldova", "86": "UAE", "87": "Burkina Faso", "88": "Tunisia", "89": "Mauritius",
    "90": "Liberia", "91": "Georgia", "92": "Greece", "93": "Portugal", "94": "Dortmund",
    "95": "Suriname", "96": "Burundi", "144": "Benin", "145": "Mauritania", "146": "Sierra Leone",
    "187": "USA (Virtual)"
  };

  // --- AUTHENTICATION ---
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
        } else { setLoginError('❌ Akses Ditolak: Username/Password Salah!'); }
    } catch (err) { setLoginError('❌ Server Gateway Offline!'); }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setUser('');
    setCredentials({ username: '', password: '' });
  };

  // --- DATA FETCHING & SYNC ---
  const fetchBalance = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/get-user-balance?username=${user}`);
      const data = await res.json();
      if (data.status === 'success') setBalance(parseFloat(data.balance));
    } catch (err) { console.log("Balance Sync Error"); }
  };

  const fetchRealPrices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/get-real-prices`);
      const data = await res.json();
      if (data.status === 'success') {
        const allData = data.prices.map(p => ({ 
            ...p, 
            name: countryNames[p.code] || `Negara ${p.code}`,
            count: p.count || 0 
        }));
        setLivePrices(allData);

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

        const current = sorted.find(p => p.code === selectedCountry.code) || sorted[0];
        if (current) {
            const options = allData.filter(p => p.code === current.code).sort((a, b) => a.priceIdr - b.priceIdr);
            setSelectedPriceOption(options[0]);
        }
      }
    } catch (err) { console.log("Price Sync Error"); }
    setIsLoading(false);
  };

  // --- PERSISTENCE ---
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

  // --- ORDER SYSTEM ---
  const handleOrder = async (qty = 1) => {
    if (isOrdering.current || !selectedPriceOption) return;
    isOrdering.current = true;
    setIsOrderingState(true); 
    setErrorMsg('');
    
    for (let i = 0; i < qty; i++) {
      try {
        const op = selectedProvider.toLowerCase() === 'any' ? '' : `&operator=${selectedProvider.toLowerCase()}`;
        const res = await fetch(`${API_URL}/order-wa?country=${selectedCountry.code}&username=${user}&price=${selectedPriceOption.priceIdr}${op}`);
        const data = await res.json();
        
        if (data.status === 'success') {
          setActiveOrders(prev => [{ 
              id: data.id, 
              number: data.number, 
              otp: null, 
              status: 'WAITING', 
              createdAt: Date.now() 
          }, ...prev]);
          fetchBalance();
          if (qty > 1) await new Promise(r => setTimeout(r, 1200));
        } else { 
            setErrorMsg(`⚠️ Gagal: ${data.message}`); 
            break; 
        }
      } catch (err) { 
          setErrorMsg("⚠️ Error Koneksi API!"); 
          break; 
      }
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
    } catch (e) { console.error("Cancel Process Error"); }
  };

  // --- AUTO CHECKER OTP ---
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      // Check Expiration
      setActiveOrders(prev => {
        return prev.map(o => {
          const isTooOld = (Date.now() - o.createdAt) / 1000 > 300;
          if (!o.otp && isTooOld && o.status === 'WAITING') {
            fetch(`${API_URL}/cancel-order?id=${o.id}`).then(() => fetchBalance());
            return { ...o, status: 'EXPIRED' };
          }
          return o;
        });
      });

      // Check OTP Status
      activeOrders.filter(o => o.status === 'WAITING').forEach(async (order) => {
        try {
          const res = await fetch(`${API_URL}/check-otp?id=${order.id}`);
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            setActiveOrders(prev => prev.map(o => o.id === order.id ? { ...o, otp: data.code, status: 'SUCCESS' } : o));
            setLogs(l => [{ 
                number: order.number, 
                otp: data.code, 
                time: new Date().toLocaleTimeString(),
                country: selectedCountry.name 
            }, ...l].slice(0, 50));
            fetchBalance();
          }
        } catch (e) {}
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [user, activeOrders]);

  // --- HELPERS ---
  const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const copyToClipboard = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      // Optional: Add toast notification here
    }
  };

  // --- RENDER LOGIN ---
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <div className="brand-header">
            <Zap size={40} className="text-blue" fill="currentColor"/>
            <h1>E X I L L E 9</h1>
            <p>OTP Gateway System v2.1</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-field">
              <User size={18}/>
              <input type="text" placeholder="Username" value={credentials.username} onChange={(e) => setCredentials({...credentials, username: e.target.value})} required />
            </div>
            <div className="input-field">
              <Lock size={18}/>
              <input type="password" placeholder="Password" value={credentials.password} onChange={(e) => setCredentials({...credentials, password: e.target.value})} required />
            </div>
            {loginError && <div className="error-alert">{loginError}</div>}
            <button type="submit" className="btn-primary-login">AUTHORIZE SYSTEM</button>
          </form>
          <div className="login-footer">© 2026 Powered by Exille AI Protocol</div>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Zap size={20} className="text-blue" fill="currentColor"/>
          <span>EXILLE9 CORE</span>
        </div>
        
        <div className="sidebar-user">
          <div className="user-avatar">{user[0].toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user.toUpperCase()}</span>
            <span className="user-status"><ShieldCheck size={10}/> Verified User</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className={`nav-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('dashboard')}>
            <Smartphone size={16}/> <span>Dashboard</span>
          </div>
          <div className={`nav-item ${activeMenu === 'history' ? 'active' : ''}`} onClick={() => setActiveMenu('history')}>
            <History size={16}/> <span>History Log</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16}/> Keluar Sesi
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-nav">
          <div className="nav-left">
            <h2>{activeMenu === 'dashboard' ? 'Control Panel' : 'System History'}</h2>
          </div>
          <div className="nav-right">
            <div className="balance-display">
              <span className="label">BALANCE IDR</span>
              <span className="value">{formatIDR(balance)}</span>
            </div>
            <button className="btn-refresh-circle" onClick={() => { fetchBalance(); fetchRealPrices(); }} disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </header>

        {activeMenu === 'dashboard' ? (
          <div className="content-grid">
            {/* Left: Configuration */}
            <div className="card-panel config-panel">
              <div className="card-header">
                <Globe size={16}/> <span>Setup Gateway Hero-SMS</span>
              </div>
              <div className="card-body">
                <label className="input-label">PILIH OPERATOR</label>
                <div className="operator-selector">
                  {['Any', 'Telkomsel', 'Indosat', 'XL', 'Axis', 'Three', 'Smartfren'].map(op => (
                    <button key={op} className={selectedProvider === op ? 'active' : ''} onClick={() => setSelectedProvider(op)}>{op}</button>
                  ))}
                </div>

                <label className="input-label">CARI & PILIH NEGARA</label>
                <div className="search-box">
                  <Search size={14}/>
                  <input type="text" placeholder="Ketik nama negara..." onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="country-list-container">
                  {displayCountries
                    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.includes(searchTerm))
                    .map(c => (
                      <div key={c.code} className={`country-item ${selectedCountry.code === c.code ? 'selected' : ''}`} onClick={() => {
                        setSelectedCountry({ code: c.code, name: c.name });
                        const opts = livePrices.filter(p => p.code === c.code).sort((a,b) => a.priceIdr - b.priceIdr);
                        setSelectedPriceOption(opts[0]);
                      }}>
                        <span className="c-name">{c.name}</span>
                        <span className="c-id">ID: {c.code}</span>
                      </div>
                  ))}
                </div>

                <label className="input-label">OPSI HARGA & STOK (SINKRON)</label>
                <select 
                  className="custom-select"
                  value={selectedPriceOption?.priceIdr || ''}
                  onChange={(e) => setSelectedPriceOption(livePrices.find(p => p.code === selectedCountry.code && p.priceIdr == e.target.value))}
                >
                  {livePrices
                    .filter(p => p.code === selectedCountry.code)
                    .sort((a, b) => a.priceIdr - b.priceIdr)
                    .map((opt, idx) => (
                      <option key={idx} value={opt.priceIdr}>
                        {idx === 0 ? '💎 TERMURAH: ' : 'Kategori: '} {formatIDR(opt.priceIdr)} — Stok: {opt.count} pcs
                      </option>
                  ))}
                </select>

                <div className="action-buttons">
                  <button className="btn-order-single" onClick={() => handleOrder(1)} disabled={isOrderingState}>
                    {isOrderingState ? 'PROCESSING...' : `ORDER 1 NOMOR`}
                  </button>
                  <button className="btn-order-multi" onClick={() => handleOrder(5)} disabled={isOrderingState}>
                    MASS ORDER 5X
                  </button>
                </div>
                {errorMsg && <div className="error-msg-box">{errorMsg}</div>}
              </div>
            </div>

            {/* Middle: Live Monitor */}
            <div className="card-panel monitor-panel">
              <div className="card-header">
                <Clock size={16}/> <span>Live OTP Monitor</span>
              </div>
              <div className="card-body">
                {activeOrders.length === 0 ? (
                    <div className="empty-state">Menunggu order baru...</div>
                ) : (
                  activeOrders.map(order => {
                    const timeLeft = Math.max(0, Math.floor(300 - (Date.now() - order.createdAt) / 1000));
                    return (
                      <div key={order.id} className={`order-slot ${order.status.toLowerCase()}`}>
                        <div className="slot-info">
                          <span className="phone-display">{order.number}</span>
                          <span className="id-display">Ref ID: {order.id}</span>
                          {order.status === 'WAITING' && <span className="countdown">Sisa Waktu: {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>}
                        </div>
                        <div className="slot-otp">
                          {order.otp ? (
                              <div className="otp-value" onClick={() => copyToClipboard(order.otp)}>{order.otp} <Copy size={10}/></div>
                          ) : order.status === 'EXPIRED' ? (
                              <span className="status-label-red">EXPIRED</span>
                          ) : (
                              <RefreshCw size={18} className="animate-spin text-blue"/>
                          )}
                        </div>
                        <div className="slot-actions">
                          <button onClick={() => copyToClipboard(order.number)} className="btn-mini"><Copy size={14}/></button>
                          <button onClick={() => handleCancel(order.id)} className="btn-mini text-red"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Small Logs */}
            <div className="card-panel log-panel">
              <div className="card-header">
                <CheckCircle size={16}/> <span>Recent Success</span>
              </div>
              <div className="card-body p-0">
                {logs.slice(0, 10).map((log, i) => (
                  <div key={i} className="log-entry">
                    <div className="log-top">
                      <span className="log-num">{log.number}</span>
                      <span className="log-time">{log.time}</span>
                    </div>
                    <div className="log-otp-val">OTP: {log.otp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="history-full-view">
             <div className="history-card">
                <h3>Full History Log</h3>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Country</th>
                      <th>Phone Number</th>
                      <th>OTP Code</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, i) => (
                      <tr key={i}>
                        <td>{l.time}</td>
                        <td>{l.country || 'N/A'}</td>
                        <td>{l.number}</td>
                        <td className="text-blue font-bold">{l.otp}</td>
                        <td className="text-green">SUCCESS</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
