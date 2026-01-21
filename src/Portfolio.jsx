import React, { useState, useEffect } from 'react';
import { API_BASE_URL, WS_BASE_URL } from './apiConfig';
import './Portfolio.css';
import TradeModal from './TradeModal';

const Portfolio = ({ userId, onBack, isEmbedded, refreshTrigger, marketData }) => {
  const [positions, setPositions] = useState([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Trade Modal State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedTokenForTrade, setSelectedTokenForTrade] = useState(null);
  const [tradeType, setTradeType] = useState('BUY');
  const ws = React.useRef(null);
  
  const fetchPositions = async () => {
      // Don't set loading on re-fetch to avoid flickering
      // setLoading(true); 
      try {
        const response = await fetch(`${API_BASE_URL}/trade/positions/${userId}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.positions) {
            setPositions(data.positions);
            setTotalPnl(data.total_pnl || 0);
        } else if (Array.isArray(data)) {
            setPositions(data);
        } else {
             setPositions([]);
        }

      } catch (err) {
        console.error("Failed to fetch positions:", err);
        setError("Failed to load portfolio.");
      } finally {
        setLoading(false);
      }
    };

  // Initial Fetch & Refresh Trigger
  useEffect(() => {
    fetchPositions();
  }, [userId, refreshTrigger]);

  // Listen to marketData updates from parent
  useEffect(() => {
    if (!marketData || Object.keys(marketData).length === 0) return;
    
    setPositions(prevPositions => {
        let updated = false;
        const newPositions = prevPositions.map(pos => {
            const token = String(pos.token);
            // Check if we have an update for this token
            if (marketData[token]) {
                const data = marketData[token];
                // Only update if price changed to avoid unnecessary re-renders? 
                // React handles diffing, but we want to update P&L
                const newLtp = parseFloat(data.last_price || data.ltp || 0);
                
                if (newLtp > 0 && newLtp !== pos.ltp) {
                    updated = true;
                    // Recalculate values
                    const qty = parseFloat(pos.quantity || 0);
                    const avg = parseFloat(pos.avg_price || 0);
                    const currentVal = newLtp * qty;
                    const newPnl = (newLtp - avg) * qty;
                    const pnlPercent = avg !== 0 ? ((newLtp - avg) / avg) * 100 : 0;

                    return {
                        ...pos,
                        ltp: newLtp,
                        current_value: currentVal,
                        pnl: newPnl,
                        pnl_percent: pnlPercent.toFixed(2)
                    };
                }
            }
            return pos;
        });

        if (updated) {
            // Recalculate Total P&L
            const newTotal = newPositions.reduce((sum, p) => sum + (parseFloat(p.pnl) || 0), 0);
            setTotalPnl(newTotal);
            return newPositions;
        }
        return prevPositions;
    });

  }, [marketData]);

  const openTradeModal = (pos, type) => {
      setSelectedTokenForTrade({
          token: pos.token,
          name: pos.symbol,
          symbol: pos.symbol,
          ltp: pos.ltp,
          change_diff: pos.pnl // Use P&L as proxy for color, or just 0
      });
      setTradeType(type);
      setIsTradeModalOpen(true);
  };

  return (
    <div className="portfolio-container">
      <div className="portfolio-content">
        <div className="portfolio-header">
            {!isEmbedded && <button onClick={onBack} className="back-btn">← Back to Dashboard</button>}
            <h2>My Portfolio</h2>
        </div>

        {/* Total P&L Summary Card */}
        {!loading && !error && (
            <div className="pnl-summary-card">
                <h3>Total P&L</h3>
                <div className={`pnl-value ${(parseFloat(totalPnl || 0)) >= 0 ? 'text-green' : 'text-red'}`}>
                    {(parseFloat(totalPnl || 0)) >= 0 ? '+' : ''}{parseFloat(totalPnl || 0).toFixed(2)}
                </div>
            </div>
        )}

        {loading ? (
            <div className="loading-state">Loading Positions...</div>
        ) : error ? (
            <div className="error-state">{error}</div>
        ) : positions.length === 0 ? (
            <div className="empty-state">No open positions found.</div>
        ) : (
            <div className="positions-table-wrapper">
                <table className="positions-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Qty</th>
                            <th>Avg Price</th>
                            <th>LTP</th>
                            <th>Current Value</th>
                            <th>P&L</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos, index) => {
                            const pnl = pos.pnl || 0;
                            const isProfit = pnl >= 0;
                            return (
                                <tr key={index}>
                                    <td className="font-bold">{pos.symbol || "Unknown"}</td>
                                    <td>{pos.quantity}</td>
                                    <td>₹{parseFloat(pos.avg_price || 0).toFixed(2)}</td>
                                    <td>₹{parseFloat(pos.ltp || 0).toFixed(2)}</td>
                                    <td>₹{parseFloat(pos.current_value || 0).toFixed(2)}</td>
                                    <td className={isProfit ? 'text-green' : 'text-red'}>
                                        {isProfit ? '+' : ''}{parseFloat(pnl || 0).toFixed(2)} ({pos.pnl_percent}%)
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button 
                                                className="mini-btn btn-buy"
                                                onClick={() => openTradeModal(pos, 'BUY')}
                                            >
                                                B
                                            </button>
                                            <button 
                                                className="mini-btn btn-sell"
                                                onClick={() => openTradeModal(pos, 'SELL')}
                                            >
                                                S
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
        
        <TradeModal 
            isOpen={isTradeModalOpen}
            onClose={() => setIsTradeModalOpen(false)}
            tokenData={selectedTokenForTrade || {}}
            type={tradeType}
            userId={userId}
            onOrderSuccess={() => {
                // Refresh positions after successful trade
                fetchPositions();
            }}
        />
      </div>
    </div>
  );
};

export default Portfolio;
