import { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Check, X, Terminal, Trash2, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';
import { subscribeNetworkErrors, getNetworkLogs, clearNetworkLogs } from '../utils/networkInspector';

export default function NetworkErrorOverlay() {
  const [activeToast, setActiveToast] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    // Initial logs load
    setLogs(getNetworkLogs());

    // Subscribe to new error events
    const unsubscribe = subscribeNetworkErrors((latestLog, updatedLogs) => {
      setLogs(updatedLogs);
      if (latestLog) {
        setActiveToast(latestLog);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-dismiss toast after 7s
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const copyLogToClipboard = (log) => {
    const text = `[Network Error Log]\nTime: ${log.timestamp}\nStatus: ${log.status} (${log.statusText})\nMethod: ${log.method}\nURL: ${log.url}\nDuration: ${log.duration}ms\nResponse Error: ${log.error}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllLogsToClipboard = () => {
    if (logs.length === 0) return;
    const formatted = logs.map((log, idx) => 
      `#${idx + 1} [${log.timestamp}] ${log.method} ${log.url}\nStatus: ${log.status} (${log.statusText})\nDuration: ${log.duration}ms\nError: ${log.error}\n----------------------------------------`
    ).join('\n\n');

    navigator.clipboard.writeText(`=== TUNELY NETWORK DEBUG LOGS (${logs.length}) ===\n\n${formatted}`);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Shorten long URLs for display
  const formatDisplayUrl = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch (e) {
      return url;
    }
  };

  return (
    <>
      {/* 1. TOP-RIGHT ACTIVE TOAST BANNER */}
      {activeToast && (
        <div className="network-toast-banner">
          <div className="toast-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="toast-content">
            <div className="toast-header">
              <span className="toast-badge">
                {activeToast.status ? `HTTP ${activeToast.status}` : 'NETWORK ERROR'}
              </span>
              <span className="toast-method">{activeToast.method}</span>
              <span className="toast-time">{activeToast.timestamp}</span>
            </div>
            <div className="toast-url" title={activeToast.url}>
              {formatDisplayUrl(activeToast.url)}
            </div>
            <div className="toast-message">
              {activeToast.error || activeToast.statusText}
            </div>
          </div>
          <div className="toast-actions">
            <button 
              className="toast-action-btn" 
              onClick={() => copyLogToClipboard(activeToast)}
              title="Copy error details to clipboard"
            >
              {copiedId === activeToast.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copiedId === activeToast.id ? 'Copied' : 'Copy'}</span>
            </button>
            <button 
              className="toast-action-btn view-logs" 
              onClick={() => { setIsDrawerOpen(true); setActiveToast(null); }}
              title="Open full error inspector"
            >
              <Terminal size={14} />
              <span>Logs ({logs.length})</span>
            </button>
            <button 
              className="toast-close-btn" 
              onClick={() => setActiveToast(null)}
              title="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 2. FLOATING NETWORK INSPECTOR TRIGGER BUTTON */}
      {logs.length > 0 && !isDrawerOpen && (
        <button 
          className="network-inspector-trigger-btn"
          onClick={() => setIsDrawerOpen(true)}
          title="Open API & Network Error Logs"
        >
          <AlertTriangle size={14} className="pulse-alert-icon" />
          <span>Network Errors ({logs.length})</span>
        </button>
      )}

      {/* 3. FULL NETWORK INSPECTOR DRAWER / MODAL */}
      {isDrawerOpen && (
        <div className="network-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="network-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-top-bar">
              <div className="drawer-title-group">
                <Terminal size={20} className="title-icon" />
                <div>
                  <h3>Network & API Debug Inspector</h3>
                  <p>{logs.length} error{logs.length === 1 ? '' : 's'} intercepted during session</p>
                </div>
              </div>

              <div className="drawer-header-actions">
                <button 
                  className="drawer-btn primary"
                  onClick={copyAllLogsToClipboard}
                  disabled={logs.length === 0}
                >
                  {copiedAll ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedAll ? 'Copied All Logs!' : 'Copy All Logs'}</span>
                </button>

                <button 
                  className="drawer-btn danger"
                  onClick={() => { clearNetworkLogs(); setLogs([]); }}
                  disabled={logs.length === 0}
                  title="Clear error history"
                >
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>

                <button 
                  className="drawer-btn icon-only"
                  onClick={() => setIsDrawerOpen(false)}
                  title="Close Inspector"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ERROR LOGS LIST */}
            <div className="drawer-logs-scroll">
              {logs.length === 0 ? (
                <div className="drawer-empty-state">
                  <Check size={36} className="success-icon" />
                  <h4>No Network Errors Detected</h4>
                  <p>All API requests during this session have completed successfully with 200 OK responses.</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div key={log.id || index} className="network-log-card">
                      <div 
                        className="log-card-header"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      >
                        <span className={`status-pill ${log.status >= 500 ? 'status-500' : (log.status >= 400 ? 'status-400' : 'status-0')}`}>
                          {log.status ? `HTTP ${log.status}` : 'FAIL'}
                        </span>
                        <span className="log-method">{log.method}</span>
                        <span className="log-url" title={log.url}>{formatDisplayUrl(log.url)}</span>
                        <span className="log-duration">{log.duration}ms</span>
                        <span className="log-time">{log.timestamp}</span>
                        <button className="expand-toggle-btn">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {/* EXPANDABLE DETAILS CONTAINER */}
                      {isExpanded && (
                        <div className="log-card-body">
                          <div className="log-detail-row">
                            <strong>Full URL:</strong>
                            <code className="code-block">{log.url}</code>
                          </div>
                          <div className="log-detail-row">
                            <strong>Status Text:</strong>
                            <span>{log.statusText}</span>
                          </div>
                          <div className="log-detail-row">
                            <strong>Error Response / Traceback:</strong>
                            <pre className="code-pre">{log.error}</pre>
                          </div>
                          <div className="log-card-actions">
                            <button className="copy-single-btn" onClick={() => copyLogToClipboard(log)}>
                              {copiedId === log.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                              <span>{copiedId === log.id ? 'Copied Log' : 'Copy Log Snippet'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMBEDDED CSS FOR NETWORK ERROR OVERLAY */}
      <style>{`
        /* 1. Toast Banner Styles */
        .network-toast-banner {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 460px;
          width: calc(100vw - 40px);
          background: rgba(18, 12, 22, 0.95);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-left: 4px solid #ef4444;
          border-radius: 12px;
          padding: 14px 16px;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.2);
          animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .toast-icon {
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-top: 2px;
          flex-shrink: 0;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .toast-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .toast-badge {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .toast-method {
          color: var(--text-dimmed, #94a3b8);
          font-weight: 600;
        }

        .toast-time {
          color: var(--text-dimmed, #64748b);
          margin-left: auto;
        }

        .toast-url {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: monospace;
        }

        .toast-message {
          font-size: 12px;
          color: #cbd5e1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
        }

        .toast-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
          margin-left: 4px;
        }

        .toast-action-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toast-action-btn:hover {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .toast-action-btn.view-logs {
          background: rgba(0, 229, 255, 0.12);
          border-color: rgba(0, 229, 255, 0.25);
          color: #00e5ff;
        }

        .toast-action-btn.view-logs:hover {
          background: rgba(0, 229, 255, 0.22);
        }

        .toast-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          align-self: flex-end;
          margin-bottom: 2px;
        }

        .toast-close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* 2. Floating Inspector Trigger Button */
        .network-inspector-trigger-btn {
          position: fixed;
          bottom: 90px;
          left: 20px;
          z-index: 999;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 20px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transition: all 0.2s ease;
        }

        .network-inspector-trigger-btn:hover {
          background: rgba(239, 68, 68, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.3);
        }

        .pulse-alert-icon {
          animation: alertPulse 1.5s infinite alternate;
        }

        @keyframes alertPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        /* 3. Debug Drawer Overlay */
        .network-drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 10001;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        .network-drawer-content {
          width: 100%;
          max-width: 840px;
          max-height: 85vh;
          background: #0d0f18;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8);
        }

        .drawer-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-wrap: wrap;
          gap: 12px;
        }

        .drawer-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .drawer-title-group .title-icon {
          color: #00e5ff;
        }

        .drawer-title-group h3 {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .drawer-title-group p {
          font-size: 12px;
          color: #94a3b8;
          margin: 2px 0 0;
        }

        .drawer-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .drawer-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.18s ease;
        }

        .drawer-btn.primary {
          background: rgba(0, 229, 255, 0.15);
          border-color: rgba(0, 229, 255, 0.3);
          color: #00e5ff;
        }

        .drawer-btn.primary:hover:not(:disabled) {
          background: rgba(0, 229, 255, 0.25);
        }

        .drawer-btn.danger {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .drawer-btn.danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
        }

        .drawer-btn.icon-only {
          background: transparent;
          color: #94a3b8;
          padding: 6px;
          border-radius: 50%;
        }

        .drawer-btn.icon-only:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .drawer-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .drawer-logs-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .drawer-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #94a3b8;
        }

        .drawer-empty-state .success-icon {
          color: #10b981;
          margin-bottom: 12px;
        }

        .drawer-empty-state h4 {
          font-size: 17px;
          color: #fff;
          margin: 0 0 6px;
        }

        .drawer-empty-state p {
          font-size: 13px;
          max-width: 360px;
          margin: 0;
          line-height: 1.4;
        }

        .network-log-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .network-log-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .log-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          cursor: pointer;
          font-size: 13px;
        }

        .status-pill {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          font-family: monospace;
          flex-shrink: 0;
        }

        .status-pill.status-500 { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-pill.status-400 { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .status-pill.status-0 { background: rgba(220, 38, 38, 0.3); color: #fca5a5; border: 1px solid rgba(220, 38, 38, 0.4); }

        .log-method {
          font-weight: 700;
          font-size: 11px;
          color: #94a3b8;
          flex-shrink: 0;
        }

        .log-url {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: monospace;
          color: #e2e8f0;
        }

        .log-duration {
          font-size: 11px;
          color: #64748b;
          flex-shrink: 0;
        }

        .log-time {
          font-size: 11px;
          color: #64748b;
          flex-shrink: 0;
        }

        .expand-toggle-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .log-card-body {
          padding: 14px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 12px;
        }

        .log-detail-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .log-detail-row strong {
          color: #94a3b8;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .code-block {
          background: #07080d;
          padding: 6px 10px;
          border-radius: 6px;
          font-family: monospace;
          color: #38bdf8;
          word-break: break-all;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .code-pre {
          background: #07080d;
          padding: 10px;
          border-radius: 6px;
          font-family: monospace;
          color: #fca5a5;
          max-height: 160px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .log-card-actions {
          display: flex;
          justify-content: flex-end;
        }

        .copy-single-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .copy-single-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </>
  );
}
