import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import useTheme from '../hooks/useTheme';

const PURPLE = 'var(--theme-primary)';
const PURPLE_DARK = 'var(--theme-primary-dark)';
const PURPLE_LIGHT = 'var(--theme-primary-light)';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  .fp-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; padding: 32px; }
  .fp-card { width: 100%; max-width: 400px; animation: fadeInUp 0.5s ease both; }
  .fp-badge { display: inline-flex; align-items: center; gap: 7px; background: var(--theme-surface-tint); border: 1px solid var(--theme-primary-pale2); border-radius: 20px; padding: 5px 13px; margin-bottom: 26px; }
  .fp-dot { width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; }
  .fp-badge-text { font-size: 11px; font-weight: 700; color: ${PURPLE}; text-transform: uppercase; letter-spacing: 1.2px; }
  .fp-title { font-size: 26px; font-weight: 800; color: var(--theme-text-strongest); margin-bottom: 6px; letter-spacing: -0.4px; }
  .fp-sub { font-size: 13.5px; color: var(--theme-text-strong); margin-bottom: 26px; line-height: 1.6; }
  .fp-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--theme-text-strong); text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .fp-input { width: 100%; padding: 12px 13px; border: 1.5px solid var(--theme-surface-tint); border-radius: 10px; font-size: 14px; background: #fafafa; color: var(--theme-text-strongest); outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; font-family: inherit; }
  .fp-input:focus { border-color: ${PURPLE}; background: #fff; box-shadow: 0 0 0 4px rgba(var(--theme-primary-rgb), 0.09); }
  .fp-btn { width: 100%; margin-top: 18px; background: linear-gradient(135deg, ${PURPLE_DARK} 0%, ${PURPLE} 50%, ${PURPLE_LIGHT} 100%); color: #fff; border: none; padding: 14px; border-radius: 11px; font-size: 14.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 9px; box-shadow: 0 8px 24px rgba(var(--theme-primary-rgb), 0.38); font-family: inherit; }
  .fp-btn:disabled { opacity: 0.72; cursor: not-allowed; }
  .fp-spinner { width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  .fp-error { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 11px 14px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 9px; color: #c53030; font-size: 13px; font-weight: 500; animation: slideIn 0.3s ease both; }
  .fp-success { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 11px 14px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 9px; color: #276749; font-size: 13px; font-weight: 500; animation: slideIn 0.3s ease both; }
  .fp-back { display: block; margin-top: 20px; text-align: center; font-size: 13px; color: ${PURPLE}; text-decoration: none; font-weight: 600; }
  .fp-back:hover { opacity: 0.75; }

  @media (max-width: 480px) {
    .fp-root { padding: 20px 16px; }
    .fp-title { font-size: 22px; }
    .fp-input { font-size: 16px; padding: 11px 12px; }
    .fp-btn { padding: 13px; font-size: 14px; }
  }
`;

export default function ForgotPassword() {
  useTheme('login');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSent(false);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="fp-root">
        <div className="fp-card">
          <div className="fp-badge">
            <div className="fp-dot" />
            <span className="fp-badge-text">AOTMS CRM Portal</span>
          </div>
          <div className="fp-title">Forgot your password?</div>
          <div className="fp-sub">Enter the email linked to your account and we'll send you a link to reset your password.</div>

          {error && (
            <div className="fp-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c53030" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {sent ? (
            <div className="fp-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              If that email exists, a reset link has been sent. Please check your inbox.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="fp-label">Email Address</label>
              <input type="email" placeholder="you@company.com" className="fp-input"
                value={email} onChange={e => setEmail(e.target.value)} required />
              <button type="submit" disabled={loading} className="fp-btn">
                {loading ? <><div className="fp-spinner" /> Sending...</> : 'Send Reset Link'}
              </button>
            </form>
          )}

          <Link to="/login" className="fp-back">← Back to Sign In</Link>
        </div>
      </div>
    </>
  );
}