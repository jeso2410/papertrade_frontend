import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './apiConfig';
import './TradeHistory.css';

const TradeHistory = ({ userId, onBack, isEmbedded }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/trade/history/${userId}`);
        const data = await response.json();

        if (data.status === 'success' && Array.isArray(data.data)) {
            setTrades(data.data);
        } else if (Array.isArray(data)) {
            setTrades(data);
        } else {
            console.error("Unexpected data format:", data);
            setTrades([]);
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
        setError("Failed to load trade history.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  return (
    <div className="history-container">
      <div className="history-content">
        <div className="history-header">
            {!isEmbedded && <button onClick={onBack} className="back-btn">← Back to Dashboard</button>}
            <h2>Trade History</h2>
        </div>

        {loading ? (
            <div className="loading-state">Loading History...</div>
        ) : error ? (
            <div className="error-state">{error}</div>
        ) : trades.length === 0 ? (
            <div className="empty-state">No past trades found.</div>
        ) : (
            <div className="table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Symbol</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Buy Price</th>
                            <th>Sell Price</th>
                            <th>Gross P&L</th>
                            <th>Brokerage</th>
                            <th>Net P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trades.map((trade, index) => {
                            const netPnl = trade.net_pnl || 0;
                            const isProfit = netPnl >= 0;
                            const date = new Date(trade.created_at).toLocaleString();
                            
                            return (
                                <tr key={index}>
                                    <td className="text-muted">{date}</td>
                                    <td className="font-bold">{trade.symbol_name}</td>
                                    <td>
                                        <span className={`badge ${trade.trade_type === 'LONG_EXIT' ? 'badge-long' : 'badge-short'}`}>
                                            {trade.trade_type === 'LONG_EXIT' ? 'LONG' : 'SHORT'}
                                        </span>
                                    </td>
                                    <td>{trade.quantity}</td>
                                    <td>₹{trade.buy_price?.toFixed(2)}</td>
                                    <td>₹{trade.sell_price?.toFixed(2)}</td>
                                    <td className={trade.pnl >= 0 ? 'text-green' : 'text-red'}>
                                        {trade.pnl?.toFixed(2)}
                                    </td>
                                    <td className="text-red">-₹{trade.brokerage}</td>
                                    <td className={`font-bold ${isProfit ? 'text-green' : 'text-red'}`}>
                                        {isProfit ? '+' : ''}{netPnl.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default TradeHistory;
