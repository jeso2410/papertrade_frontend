import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, WS_BASE_URL } from './apiConfig';
import './theme.css'; // Global Theme Variables
import './MarketDashboard.css'; // Dashboard Specific Styles
import TradeModal from './TradeModal';
import ErrorBoundary from './ErrorBoundary';

import Portfolio from './Portfolio';
import TradeHistory from './TradeHistory';

const MarketDashboard = ({ ws_id, userId, activeView, onNavigateToDashboard, onNavigateToPortfolio, onNavigateToHistory, onLogout }) => {
  const [marketData, setMarketData] = useState({});
  const [status, setStatus] = useState('Connecting...');
  
  // Trade Modal State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedTokenForTrade, setSelectedTokenForTrade] = useState(null);
  const [tradeType, setTradeType] = useState('BUY');
  const [refreshPortfolioCount, setRefreshPortfolioCount] = useState(0);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Dynamic Token List
  // Default tokens: NIFTY (99926000) and BANKNIFTY (99926009)
  const [watchedTokens, setWatchedTokens] = useState({
    "99926000": "NIFTY",
    "99926009": "BANKNIFTY"
  });
  
  const ws = useRef(null);

  // Format Token Name (Moved up for access in useEffect)
  const formatTokenName = (result) => {
      // Check for Option (Expiry + Strike)
      if (result.expiry && result.strike && result.strike > 0) {
          const day = result.expiry.slice(0, 2);
          const month = result.expiry.slice(2, 5);
          
          let type = "";
          if (result.symbol.endsWith('CE')) type = "CALL";
          else if (result.symbol.endsWith('PE')) type = "PUT";
          
          return `${result.name} ${day} ${month} ${Math.floor(result.strike)} ${type}`;
      }
      
      // Check for Future (Expiry only)
      if (result.expiry) {
          const day = result.expiry.slice(0, 2);
          const month = result.expiry.slice(2, 5);
          return `${result.name} ${day} ${month} FUT`;
      }

      return result.symbol;
  };

  // Fetch Watchlist on Load
  useEffect(() => {
    const fetchWatchlist = async () => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/watchlist/${userId}`);
            const data = await response.json();
            
            const newTokens = {};
            if (Array.isArray(data)) {
                data.forEach(item => {
                    let token, name;

                    // Handle if item is just a token string/number
                    if (typeof item === 'string' || typeof item === 'number') {
                        token = String(item);
                        // Fallback name since backend doesn't provide it
                        name = `Token ${token}`; 
                    } 
                    // Handle if item is an object (legacy or future proof)
                    else if (typeof item === 'object' && item !== null) {
                       token = item.token;
                       name = formatTokenName(item);
                    }

                    // Strict Filter
                    if (token && token !== "null" && token !== "undefined") {
                         // If we have a name, use it. If not, fallback.
                         // Note: We might want to fetch details for this token if possible, 
                         // but for now we just display it to ensure it shows up.
                         if (!name || name === "---" || name === "undefined") {
                             name = `Token ${token}`;
                         }
                         newTokens[token] = name;
                    }
                });
                
                // Ensure default tokens are preserved/re-added
                newTokens["99926000"] = "NIFTY";
                newTokens["99926009"] = "BANKNIFTY";
                
                setWatchedTokens(newTokens); 
            }
        } catch (error) {
            console.error("Failed to fetch watchlist:", error);
        }
    };
    fetchWatchlist();
  }, [userId]);

  useEffect(() => {
    if (!ws_id) return;

    const socketUrl = `${WS_BASE_URL}/ws/market/${ws_id}`;
    
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log("✅ Connected to Market Data Stream");
      setStatus('Online');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS Data Packet:", data); // DEBUG: Check if symbol name is here
        
        // Only process if it's one of our watched tokens
        // We check watchedTokens state, but inside useEffect we need to be careful with closures.
        // However, since we simply update marketData based on the incoming token key, 
        // we can just filter during render or check if the token exists in our map.
        // To be safe and reactive, we update state.
        
        // Dynamically update token name if we have better info from WS
        // and currently we only have a fallback "Token ..." name.
        setWatchedTokens(prev => {
            const currentName = prev[data.token];
            const hasPlaceholder = !currentName || currentName.startsWith("Token ");
            
            // Prefer 'name' (e.g. BANKNIFTY) over 'symbol' (e.g. Nifty Bank) as per user preference
            // But if it's an Option/Future, we might want to construct it if fields exist? 
            // The WS data shown by user didn't have expiry/strike for Index, 
            // but for Options they might. 
            // Let's try to use formatTokenName if possible, else fallback to data.name or data.symbol
            
            if (hasPlaceholder && (data.name || data.symbol)) {
                let newName = data.name || data.symbol;
                
                // If we have enough info to format it nicely (like options), try that
                // Example WS packet for option might have expiry/strike if getting full depth?
                // If not, we stick to data.name/symbol.
                const formatted = formatTokenName(data); 
                if (formatted && formatted !== "undefined" && formatted !== "null") {
                    newName = formatted;
                }

                return {
                    ...prev,
                    [data.token]: newName
                };
            }
            return prev;
        });
        
        setMarketData(prevData => {
            return {
                ...prevData,
                [data.token]: data
            };
        });

      } catch (error) {
        console.error("Data parsing error:", error);
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setStatus('Error');
    };

    ws.current.onclose = () => {
      console.log("Connection Closed");
      setStatus('Disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [ws_id]);

  const openTradeModal = (token, name, type) => {
      // Construct token data from marketData or watchedTokens
      const currentData = marketData[token] || {};
      // Use passed name, or fallback to watchedTokens, or "Unknown"
      const resolvedName = name || watchedTokens[token] || "Unknown";
      
      setSelectedTokenForTrade({
          token: token,
          name: resolvedName,
          symbol: currentData.symbol || resolvedName, // Fallback
          ltp: currentData.ltp || 0,
          change_diff: currentData.change_diff || 0
      });
      setTradeType(type);
      setIsTradeModalOpen(true);
  };

  // Search Function
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
        const response = await fetch(`${API_BASE_URL}/search-symbol?q=${searchQuery}`);
        const data = await response.json();
        setSearchResults(data);
    } catch (error) {
        console.error("Search Error:", error);
    } finally {
        setIsSearching(false);
    }
  };



  // Add Symbol to Watchlist
  const addSymbol = async (tokenData) => {
      const formattedName = formatTokenName(tokenData);

      // Optimistic update
      setWatchedTokens(prev => ({
          ...prev,
          [tokenData.token]: formattedName
      }));
      setSearchResults([]); // Clear search results
      setSearchQuery(''); // Clear query

      // Call API to persist watchlist
      try {
          // User requested POST method with query parameters
          // Strictly matching user's Postman screenshot: user_id, ws_id, token ONLY
          const response = await fetch(`${API_BASE_URL}/watchlist/add?user_id=${userId}&ws_id=${ws_id}&token=${tokenData.token}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();
          console.log("Watchlist Add Response:", data);
          if (data.status === 'success' || data.status === 'added') {
             // Optional: Show success toast
          }
      } catch (error) {
          console.error("Failed to add to watchlist API:", error);
          // Optional: Revert state if API fails
      }


  };

  // Remove Symbol
  const removeSymbol = async (token) => {
      // Prevent removing default tokens
      if (token === "99926000" || token === "99926009") return;

      // Optimistic update
      setWatchedTokens(prev => {
          const newTokens = { ...prev };
          delete newTokens[token];
          return newTokens;
      });

      // Call API to remove from watchlist
      try {
          await fetch(`${API_BASE_URL}/watchlist/remove?user_id=${userId}&ws_id=${ws_id}&token=${token}`, {
              method: 'POST'
          });
      } catch (error) {
          console.error("Failed to remove symbol:", error);
      }
  };

  // Logout
  const handleLogout = () => {
      localStorage.removeItem('user_session');
      window.location.reload();
  };

  return (
      <div className="dashboard-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden', padding: 0 }}>
      
      {/* SIDEBAR - WATCHLIST */}
      <div className="sidebar" style={{ 
          width: '350px', 
          background: 'rgba(15, 23, 42, 0.95)', 
          borderRight: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px'
      }}>
          {/* Header & Status */}
          <div style={{ marginBottom: '20px' }}>
             <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#fff' }}>Market Watch</h2>
             <div className={`status-indicator ${status.toLowerCase()}`}>
                 <span className="status-dot"></span>
                 {status}
             </div>
          </div>

          {/* Search Bar */}
          <div className="search-container" style={{ marginBottom: '16px' }}>
             <div className="search-input-wrapper">
                 <span className="search-icon">🔍</span>
                 <input 
                     type="text" 
                     placeholder="Search & Add (e.g. RELIANCE)" 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onKeyDown={(e) => {
                         if (e.key === 'Enter') handleSearch();
                     }}
                 />
                 {isSearching && <div className="spinner-small"></div>}
             </div>
             {/* Search Results Dropdown */}
             {searchResults.length > 0 && (
                 <div className="search-results" style={{ position: 'absolute', zIndex: 100, width: '90%' }}>
                     {searchResults.map((result) => (
                         <div 
                             key={result.token} 
                             className="search-result-item"
                             onClick={() => addSymbol(result)}
                         >
                             <span>{result.name || result.symbol}</span>
                             <span className="exchange-tag">{result.exchange}</span>
                         </div>
                     ))}
                 </div>
             )}
          </div>

          {/* Watchlist Items (Scrollable) */}
          <div className="watchlist-items" style={{ flex: 1, overflowY: 'auto' }}>
            {Object.keys(watchedTokens).map((token) => {
              const name = watchedTokens[token];
              const data = marketData[token] || {};
              const price = data.ltp ? parseFloat(data.ltp).toFixed(2) : "---";
              const change = data.percent_change ? parseFloat(data.percent_change).toFixed(2) : "0.00";
              const isPositive = parseFloat(change) >= 0;

              return (
              <div key={token} className="token-card" style={{ padding: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between',  alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
                    <div className="token-symbol" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{name}</div>
                    <div className="token-price" style={{ fontSize: '1rem', fontWeight: 'bold' }}>₹{price}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                     <div className={`token-change ${isPositive ? 'positive' : 'negative'}`} style={{ fontSize: '0.85rem' }}>
                        {isPositive ? '▲' : '▼'} {Math.abs(change)}%
                     </div>
                     <div style={{ marginTop: '5px', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                             className="trade-btn buy-btn" 
                             style={{ padding: '4px 8px', fontSize: '10px', minWidth: '24px' }}
                             onClick={() => openTradeModal(token, name, 'BUY')}
                             title="Buy"
                        >B</button>
                        <button 
                             className="trade-btn sell-btn" 
                             style={{ padding: '4px 8px', fontSize: '10px', minWidth: '24px' }}
                             onClick={() => openTradeModal(token, name, 'SELL')}
                             title="Sell"
                        >S</button>
                        {!["99926000", "99926009"].includes(token) && (
                            <button 
                                className="delete-btn"
                                onClick={(e) => { e.stopPropagation(); removeSymbol(token); }}
                                style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '2px', minWidth: '24px' }}
                                title="Remove"
                            >✕</button>
                        )}
                     </div>
                  </div>
              </div>
              );
            })}
          </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
          
          {/* Top Header */}
          <header className="dashboard-header">
            <div className="header-left">
                <h1 className="header-title">
                    {activeView === 'dashboard' ? 'Market Overview' : 
                     activeView === 'portfolio' ? 'My Portfolio' : 'Trade History'}
                </h1>
            </div>
            
            <div className="dashboard-header-right" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="nav-tabs">
                    <button 
                        className={`nav-tab ${activeView === 'dashboard' ? 'active' : ''}`}
                        onClick={onNavigateToDashboard}
                    >
                        Dashboard
                    </button>
                    <button 
                        className={`nav-tab ${activeView === 'portfolio' ? 'active' : ''}`}
                        onClick={onNavigateToPortfolio}
                    >
                        Portfolio
                    </button>
                    <button 
                        className={`nav-tab ${activeView === 'history' ? 'active' : ''}`}
                        onClick={onNavigateToHistory}
                    >
                        History
                    </button>
                </div>
                
                <button 
                    onClick={onLogout}
                    className="logout-btn"
                >
                    Logout
                </button>
            </div>
          </header>

          {/* Dynamic Content Body */}
          <div className="content-body">
              {activeView === 'dashboard' && (
                  <div className="welcome-section" style={{ textAlign: 'center', marginTop: '40px' }}>
                      <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                          Welcome back!
                      </h2>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>
                          Market is open. What will you trade today?
                      </p>
                      
                      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <div className="market-stat-card">
                              <div className="stat-label">NIFTY 50</div>
                              <div className="stat-value">
                                  {marketData['99926000']?.last_price ? parseFloat(marketData['99926000'].last_price).toFixed(2) : <span style={{fontSize: '1rem', opacity: 0.5}}>Loading...</span>}
                              </div>
                              <div style={{ color: (marketData['99926000']?.change_percent || 0) >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '8px', fontWeight: 600 }}>
                                  {marketData['99926000']?.change_percent ? `${marketData['99926000'].change_percent}%` : '--'}
                              </div>
                          </div>
                          
                          <div className="market-stat-card">
                              <div className="stat-label">BANKNIFTY</div>
                              <div className="stat-value">
                                  {marketData['99926009']?.last_price ? parseFloat(marketData['99926009'].last_price).toFixed(2) : <span style={{fontSize: '1rem', opacity: 0.5}}>Loading...</span>}
                              </div>
                              <div style={{ color: (marketData['99926009']?.change_percent || 0) >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '8px', fontWeight: 600 }}>
                                  {marketData['99926009']?.change_percent ? `${marketData['99926009'].change_percent}%` : '--'}
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeView === 'portfolio' && (
                  <ErrorBoundary>
                    <Portfolio 
                        userId={userId} 
                        // ws_id={ws_id} // No longer needed for direct connection
                        isEmbedded={true} 
                        refreshTrigger={refreshPortfolioCount}
                        marketData={marketData}
                    />
                  </ErrorBoundary>
              )}

              {activeView === 'history' && (
                  <TradeHistory userId={userId} isEmbedded={true} />
              )}
          </div>
      </div>  
      
      <TradeModal 
            isOpen={isTradeModalOpen}
            onClose={() => setIsTradeModalOpen(false)}
            tokenData={selectedTokenForTrade || {}}
            marketData={marketData} // Pass live market data
            type={tradeType}
            userId={userId}
            onOrderSuccess={() => {
                console.log("Order Placed Successfully. Navigating to Portfolio...");
                setRefreshPortfolioCount(prev => prev + 1);
                onNavigateToPortfolio();
            }}
      />
    </div>
  );
};

export default MarketDashboard;