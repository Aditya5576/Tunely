import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const mapFriendlyError = (rawError) => {
  if (!rawError) return 'Something went wrong. Please try again.';
  const lower = rawError.toLowerCase();
  
  if (lower.includes('limit exceeded') || lower.includes('kv put') || lower.includes('kv')) {
    return 'Server is busy. Please try again later or continue as Guest.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network error') || lower.includes('networkerror')) {
    return 'Network Error: Could not connect to the server. Please check your connection.';
  }
  if (lower.includes('invalid credentials') || lower.includes('wrong password') || lower.includes('incorrect password')) {
    return 'Invalid email or password. Please try again.';
  }
  if (lower.includes('user not found') || lower.includes('email not found')) {
    return 'No account found with this email.';
  }
  if (lower.includes('email already exists') || lower.includes('email registered')) {
    return 'An account with this email already exists.';
  }
  
  return rawError;
};

// tab: 'login' | 'register' | 'forgot_step1' | 'forgot_step2'
export const AuthModal = ({ onClose, required = false }) => {
  const { login, register, requestPasswordReset, confirmPasswordReset, loginAsGuest } = useAuth();

  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goTo = (t) => { setTab(t); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;

    if (tab === 'login') {
      result = await login(email.trim(), password);
      if (result.success) {
        setLoading(false);
        if (onClose) onClose();
        window.location.href = '/';
        return;
      }
    } else if (tab === 'register') {
      if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
      result = await register(email.trim(), name.trim(), password);
      if (result.success) {
        setLoading(false);
        if (onClose) onClose();
        window.location.href = '/';
        return;
      }
    } else if (tab === 'forgot_step1') {
      result = await requestPasswordReset(email.trim());
      if (result.success) {
        setLoading(false);
        goTo('forgot_step2');
        return;
      }
    } else if (tab === 'forgot_step2') {
      if (!otp.trim()) { setError('Please enter the reset code'); setLoading(false); return; }
      if (!password) { setError('Please enter a new password'); setLoading(false); return; }
      result = await confirmPasswordReset(email.trim(), otp.trim(), password);
      if (result.success) {
        setLoading(false);
        if (onClose) onClose();
        window.location.href = '/';
        return;
      }
    }

    setLoading(false);
    setError(mapFriendlyError(result?.error));
  };

  const isForgot = tab === 'forgot_step1' || tab === 'forgot_step2';

  return (
    <div
      className={`auth-modal-overlay ${required ? 'forced-login-screen' : ''}`}
      onClick={(e) => { if (!required && e.target === e.currentTarget) onClose(); }}
    >
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-modal-header">
          <img src="/logo.jpg" alt="Tunely Logo" className="auth-brand-logo" />
          {!required && <button className="auth-close-btn" onClick={onClose}>✕</button>}
        </div>

        {/* Tab bar — only shown on login/register */}
        {!isForgot && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => goTo('login')}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => goTo('register')}
              type="button"
            >
              Create Account
            </button>
          </div>
        )}

        {/* Forgot password header */}
        {isForgot && (
          <div className="auth-forgot-header">
            <h2>{tab === 'forgot_step1' ? 'Reset Password' : 'Enter Reset Code'}</h2>
            <p>
              {tab === 'forgot_step1'
                ? "Enter your email and we'll send a 6-digit code"
                : 'Check your email for the code, then set your new password'}
            </p>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>

          {tab === 'register' && (
            <div className="auth-field">
              <label>Your Name</label>
              <input type="text" placeholder="e.g. Aditya" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}

          {(tab === 'login' || tab === 'register' || tab === 'forgot_step1') && (
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
          )}

          {tab === 'forgot_step2' && (
            <>
              <div className="auth-reset-email-tag">
                📧 Code sent to <strong>{email}</strong>
                <button type="button" className="auth-link" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => goTo('forgot_step1')}>Change</button>
              </div>

              <div className="auth-field">
                <label>Reset Code <span className="auth-hint">(6 digits from your email)</span></label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="auth-otp-input"
                />
              </div>
            </>
          )}

          {(tab === 'login' || tab === 'register' || tab === 'forgot_step2') && (
            <div className="auth-field">
              <label style={{ display: 'flex', justifycontent: 'space-between', width: '100%' }}>
                <span>
                  {tab === 'forgot_step2' ? 'New Password' : 'Password'}
                  {tab === 'register' && <span className="auth-hint"> (min 6 chars)</span>}
                </span>
                {tab === 'login' && (
                  <button type="button" className="auth-forgot-trigger" onClick={() => goTo('forgot_step1')}>
                    Forgot Password?
                  </button>
                )}
              </label>
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
                <button type="button" className="auth-show-password" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? <span className="auth-spinner" />
              : tab === 'login' ? 'Sign In'
              : tab === 'register' ? 'Create Account'
              : tab === 'forgot_step1' ? 'Send Reset Code'
              : 'Set New Password & Sign In'
            }
          </button>
        </form>

        {(tab === 'login' || tab === 'register') && (
          <>
            <div className="auth-separator"><span>or</span></div>
            <button type="button" className="auth-guest-btn" onClick={() => { loginAsGuest(); onClose(); }}>
              Continue as Guest
            </button>
          </>
        )}

        {isForgot && (
          <p className="auth-footer-note">
            Remembered it? <button className="auth-link" onClick={() => goTo('login')}>Sign in</button>
          </p>
        )}

        {!required && (tab === 'login' || tab === 'register') && (
          <p className="auth-footer-note auth-footer-sub">
            Without an account, Tunely still works — your data is just saved to this browser only.
          </p>
        )}

        <style>{`
      .auth-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        z-index: 9999; display: flex; align-items: center; justify-content: center;
        padding: 40px 16px; animation: authFadeIn 0.2s ease;
        overflow-y: auto; /* Enable scroll if modal is taller than screen */
      }
      .auth-modal-overlay.forced-login-screen {
        background: radial-gradient(circle at top right, rgba(124,58,237,0.12), transparent 50%),
                    radial-gradient(circle at bottom left, rgba(236,72,153,0.1), transparent 50%), #09090e;
        backdrop-filter: none; -webkit-backdrop-filter: none; z-index: 10000;
      }
      .forced-login-screen .auth-modal {
        background: rgba(18,18,28,0.6) !important; backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05) !important;
      }
      @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .auth-modal {
        background: rgba(18,18,28,0.97); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px; padding: 28px 28px 24px; width: 100%; max-width: 420px;
        position: relative; animation: authSlideUp 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        margin: auto; /* Clean scrolling alignment in flex overlay */
      }
      @keyframes authSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .auth-modal-header { text-align: center; margin-bottom: 20px; position: relative; }
      .auth-logo { font-size: 32px; margin-bottom: 4px; }
      .auth-close-btn {
        position: absolute; top: -4px; right: -4px;
        background: rgba(255,255,255,0.08); border: none; color: var(--text-muted);
        width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 12px;
        display: flex; align-items: center; justify-content: center; transition: all 0.2s;
      }
      .auth-close-btn:hover { background: rgba(255,255,255,0.15); color: var(--text-main); }

      /* Tab bar */
      .auth-tabs {
        display: flex; gap: 0; background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
        padding: 4px; margin-bottom: 20px;
      }
      .auth-tab {
        flex: 1; padding: 9px 0; border: none; border-radius: 9px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        background: transparent; color: var(--text-muted); transition: all 0.2s;
      }
      .auth-tab.active {
        background: var(--primary); color: #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      .auth-tab:not(.active):hover { background: rgba(255,255,255,0.06); color: var(--text-main); }

      .auth-forgot-header { text-align: center; margin-bottom: 20px; }
      .auth-forgot-header h2 { font-size: 20px; font-weight: 700; color: var(--text-main); margin: 0 0 6px; }
      .auth-forgot-header p { font-size: 13px; color: var(--text-muted); margin: 0; line-height: 1.4; }

      .auth-form { display: flex; flex-direction: column; gap: 14px; }
      .auth-field { display: flex; flex-direction: column; gap: 6px; }
      .auth-field label {
        font-size: 12px; font-weight: 600; color: var(--text-secondary);
        text-transform: uppercase; letter-spacing: 0.05em;
        display: flex; align-items: center; gap: 6px;
      }
      .auth-hint { font-weight: 400; text-transform: none; color: var(--text-muted); font-size: 11px; letter-spacing: 0; }
      .auth-field input {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; padding: 11px 14px; color: var(--text-main); font-size: 14px;
        outline: none; transition: border-color 0.2s, background 0.2s; width: 100%; box-sizing: border-box;
      }
      .auth-field input:focus { border-color: var(--primary); background: rgba(255,255,255,0.09); }
      .auth-field input::placeholder { color: var(--text-muted); }
      .auth-otp-input { letter-spacing: 0.3em; text-align: center; font-size: 22px !important; font-weight: 700 !important; }
      .auth-password-wrap { position: relative; }
      .auth-password-wrap input { padding-right: 44px; }
      .auth-show-password {
        position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; font-size: 16px;
        color: var(--text-muted); padding: 4px; line-height: 1;
      }
      .auth-forgot-trigger {
        background: none; border: none; color: var(--primary); font-size: 11px;
        cursor: pointer; padding: 0; font-weight: 500; text-transform: none; letter-spacing: 0;
      }
      .auth-reset-email-tag {
        background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
        border-radius: 10px; padding: 10px 14px; font-size: 13px;
        color: rgba(255,255,255,0.75); display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
      }
      .auth-dev-otp {
        background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3);
        border-radius: 10px; padding: 14px; display: flex; flex-direction: column;
        align-items: center; gap: 6px; font-size: 13px; color: #fbbf24; text-align: center;
      }
      .auth-dev-otp-code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; }
      .auth-error {
        background: rgba(255,80,80,0.12); border: 1px solid rgba(255,80,80,0.3);
        border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #ff8080;
      }
      .auth-submit-btn {
        background: var(--primary); border: none; border-radius: 10px; padding: 13px;
        color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;
      }
      .auth-submit-btn:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
      .auth-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      .auth-spinner {
        width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .auth-footer-note { text-align: center; font-size: 13px; color: var(--text-muted); margin: 14px 0 0; }
      .auth-footer-sub { font-size: 11px; margin-top: 8px; opacity: 0.7; }
      .auth-link {
        background: none; border: none; color: var(--primary); cursor: pointer;
        font-size: 13px; font-weight: 600; padding: 0; text-decoration: underline;
      }
      .auth-separator {
        display: flex; align-items: center; text-align: center; margin: 14px 0;
        color: var(--text-dimmed); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
      }
      .auth-separator::before, .auth-separator::after { content: ''; flex: 1; border-bottom: 1px solid var(--border-color); }
      .auth-separator::before { margin-right: .5em; }
      .auth-separator::after { margin-left: .5em; }
      .auth-guest-btn {
        width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px; padding: 12px; color: var(--text-main); font-size: 14px; font-weight: 600;
        cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      }
      .auth-guest-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); color: #fff; transform: translateY(-1px); }
      @media (max-width: 480px) {
        .auth-modal { padding: 22px 16px 20px; }
      }
      `}</style>
      </div>
    </div>
  );
};
