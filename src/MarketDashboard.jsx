import React, { useState, useEffect, useRef } from 'react';
import './Signup.css'; // Use the same premium styling

const MarketDashboard = ({ ws_id, userId }) => {
  const [marketData, setMarketData] = useState({});
  const [status, setStatus] = useState('Connecting...');
  
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
            const response = await fetch(`https://backend-1-mpd2.onrender.com/watchlist/${userId}`);
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

    const socketUrl = `wss://backend-1-mpd2.onrender.com/ws/market/${ws_id}`;
    
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log("✅ Connected to Market Data Stream");
      setStatus('Online');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Only process if it's one of our watched tokens
        // We check watchedTokens state, but inside useEffect we need to be careful with closures.
        // However, since we simply update marketData based on the incoming token key, 
        // we can just filter during render or check if the token exists in our map.
        // To be safe and reactive, we update state.
        
        setMarketData(prevData => {
            // Check if this token is currently watched (we do this check here or just store everything)
            // Storing everything is fine, we filter at render time.
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

  // Search Function
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
        const response = await fetch(`https://backend-1-mpd2.onrender.com/search-symbol?q=${searchQuery}`);
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
          const response = await fetch(`https://backend-1-mpd2.onrender.com/watchlist/add?user_id=${userId}&ws_id=${ws_id}&token=${tokenData.token}`, {
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

      try {
          await fetch(`https://backend-1-mpd2.onrender.com/watchlist/remove?user_id=${userId}&ws_id=${ws_id}&token=${token}`, {
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
    <div className="signup-container" style={{ padding: '20px', alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="signup-card" style={{ maxWidth: '800px', width: '100%', margin: '40px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>Market Dashboard</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className={`message ${status === 'Online' ? 'success' : 'error'}`} style={{ margin: 0, padding: '5px 15px' }}>
                    {status}
                </div>
                <button 
                    onClick={handleLogout}
                    className="signup-button"
                    style={{ 
                        width: 'auto', 
                        marginTop: 0, 
                        background: 'rgba(239, 68, 68, 0.2)', 
                        border: '1px solid rgba(239, 68, 68, 0.5)', 
                        color: '#fca5a5' 
                    }}
                >
                    Logout
                </button>
            </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '30px', position: 'relative' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    className="signup-input" 
                    placeholder="Search Symbol (e.g. RELIANCE)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="signup-button" style={{ width: 'auto', marginTop: 0 }} disabled={isSearching}>
                    {isSearching ? '...' : 'Search'}
                </button>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
                <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    background: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    marginTop: '5px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}>
                    {searchResults.map((result) => (
                        <div 
                            key={result.token} 
                            onClick={() => addSymbol(result)}
                            style={{ 
                                padding: '12px 16px', 
                                borderBottom: '1px solid #334155',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                color: '#cbd5e1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontWeight: 'bold' }}>{formatTokenName(result)}</span>
                            <span style={{ 
                                fontSize: '0.8em', 
                                background: 'rgba(255, 255, 255, 0.1)', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.2)' 
                            }}>{result.exchange}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Watchlist Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Render cards for watched tokens */}
            {Object.keys(watchedTokens).map(token => {
                const data = marketData[token];
                const name = watchedTokens[token];
                const price = data ? data.ltp : '---';
                const change = data ? data.change_diff : 0;
                const percent = data ? data.percent_change : 0;
                const isPositive = change >= 0;

                return (
                    <div key={token} className="input-group" style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '20px', 
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative'
                    }}>
                        {/* Delete Button - Hide for default tokens */}
                        {token !== "99926000" && token !== "99926009" && (
                            <button 
                                onClick={() => removeSymbol(token)}
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ef4444',
                                    fontSize: '1.2em',
                                    cursor: 'pointer',
                                    padding: '5px'
                                }}
                                title="Remove Symbol"
                            >
                                ×
                            </button>
                        )}

                        <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>{name}</h3>
                        <div style={{ fontSize: '2.5em', fontWeight: 'bold', marginBottom: '10px' }}>
                            {typeof price === 'number' ? price.toFixed(2) : price}
                        </div>
                        <div style={{ 
                            color: isPositive ? '#4ade80' : '#f87171',
                            fontSize: '1.2em',
                            fontWeight: '500' 
                        }}>
                            {isPositive ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : '0.00'} ({typeof percent === 'number' ? percent.toFixed(2) : '0.00'}%)
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default MarketDashboard;