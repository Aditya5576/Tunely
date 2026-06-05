import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const AuthModal = ({ onClose, required = false }) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;
    if (tab === 'login') {
      result = await login(email.trim(), password);
    } else {
      if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
      result = await register(email.trim(), name.trim(), password);
    }

    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className={`auth-modal-overlay ${required ? 'forced-login-screen' : ''}`} onClick={(e) => { if (!required && e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-logo">🎵</div>
          <h2>{tab === 'login' ? 'Welcome to Tunely' : 'Create your account'}</h2>
          <p>{required ? 'Sign in or create an account to continue' : tab === 'login' ? 'Sign in to sync your music across devices' : 'Create an account to sync your liked songs and playlists'}</p>
          {!required && <button className="auth-close-btn" onClick={onClose}>✕</button>}
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="auth-field">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="e.g. Aditya"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>Password {tab === 'register' && <span className="auth-hint">(min 6 characters)</span>}</label>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-show-password"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : (tab === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Footer note */}
        <p className="auth-footer-note">
          {tab === 'login'
            ? <>Don't have an account? <button className="auth-link" onClick={() => { setTab('register'); setError(''); }}>Create one</button></>
            : <>Already have an account? <button className="auth-link" onClick={() => { setTab('login'); setError(''); }}>Sign in</button></>
          }
        </p>
        {!required && (
          <p className="auth-footer-note auth-footer-sub">
            Without an account, Tunely still works — your data is just saved to this browser only.
          </p>
        )}

        <style>{`
      .auth-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: authFadeIn 0.2s ease;
      }

      .auth-modal-overlay.forced-login-screen {
        background: radial-gradient(circle at top right, rgba(124, 58, 237, 0.12), transparent 50%),
                    radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.1), transparent 50%),
                    #09090e;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        z-index: 10000;
      }

      .forced-login-screen .auth-modal {
        background: rgba(18, 18, 28, 0.6) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
      }

      @keyframes authFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .auth-modal {
        background: rgba(18, 18, 28, 0.97);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 32px 28px;
        width: 100%;
        max-width: 420px;
        position: relative;
        animation: authSlideUp 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      }

      @keyframes authSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .auth-modal-header {
        text-align: center;
        margin-bottom: 24px;
        position: relative;
      }

      .auth-logo {
        font-size: 32px;
        margin-bottom: 12px;
      }

      .auth-modal-header h2 {
        font-size: 22px;
        font-weight: 700;
        color: var(--text-main);
        margin: 0 0 6px;
      }

      .auth-modal-header p {
        font-size: 13px;
        color: var(--text-muted);
        margin: 0;
        line-height: 1.4;
      }

      .auth-close-btn {
        position: absolute;
        top: -4px;
        right: -4px;
        background: rgba(255,255,255,0.08);
        border: none;
        color: var(--text-muted);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .auth-close-btn:hover { background: rgba(255,255,255,0.15); color: var(--text-main); }

      .auth-tabs {
        display: flex;
        background: rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 4px;
        margin-bottom: 24px;
        gap: 4px;
      }

      .auth-tab {
        flex: 1;
        padding: 8px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 500;
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .auth-tab.active {
        background: var(--primary);
        color: #fff;
        font-weight: 600;
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .auth-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .auth-field label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .auth-hint {
        font-weight: 400;
        text-transform: none;
        color: var(--text-muted);
        font-size: 11px;
        letter-spacing: 0;
      }

      .auth-field input {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 11px 14px;
        color: var(--text-main);
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s, background 0.2s;
        width: 100%;
        box-sizing: border-box;
      }
      .auth-field input:focus {
        border-color: var(--primary);
        background: rgba(255,255,255,0.09);
      }
      .auth-field input::placeholder { color: var(--text-muted); }

      .auth-password-wrap {
        position: relative;
      }
      .auth-password-wrap input { padding-right: 44px; }

      .auth-show-password {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        color: var(--text-muted);
        padding: 4px;
        line-height: 1;
      }

      .auth-error {
        background: rgba(255, 80, 80, 0.12);
        border: 1px solid rgba(255, 80, 80, 0.3);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        color: #ff8080;
      }

      .auth-submit-btn {
        background: var(--primary);
        border: none;
        border-radius: 10px;
        padding: 13px;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
      }
      .auth-submit-btn:hover:not(:disabled) {
        filter: brightness(1.15);
        transform: translateY(-1px);
      }
      .auth-submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .auth-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        display: inline-block;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .auth-footer-note {
        text-align: center;
        font-size: 13px;
        color: var(--text-muted);
        margin: 16px 0 0;
      }
      .auth-footer-sub {
        font-size: 11px;
        margin-top: 8px;
        opacity: 0.7;
      }
      .auth-link {
        background: none;
        border: none;
        color: var(--primary);
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        padding: 0;
        text-decoration: underline;
      }

      @media (max-width: 480px) {
        .auth-modal { padding: 24px 18px; }
        .auth-modal-header h2 { font-size: 19px; }
      }
      `}</style>
      </div>
    </div>
  );
};
