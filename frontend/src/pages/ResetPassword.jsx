import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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

  .rp-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; padding: 32px; }
  .rp-card { width: 100%; max-width: 400px; animation: fadeInUp 0.5s ease both; }
  .rp-badge { display: inline-flex; align-items: center; gap: 7px; background: var(--theme-surface-tint); border: 1px solid var(--theme-primary-pale2); border-radius: 20px; padding: 5px 13px; margin-bottom: 26px; }
  .rp-dot { width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; }
  .rp-badge-text { font-size: 11px; font-weight: 700; color: ${PURPLE}; text-transform: uppercase; letter-spacing: 1.2px; }
  .rp-title { font-size: 26px; font-weight: 800; color: var(--theme-text-strongest); margin-bottom: 6px; letter-spacing: -0.4px; }
  .rp-sub { font-size: 13.5px; color: var(--theme-text-strong); margin-bottom: 26px; line-height: 1.6; }
  .rp-field { margin-bottom: 18px; }
  .rp-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--theme-text-strong); text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .rp-input-wrap { position: relative; }
  .rp-input { width: 100%; padding: 12px 42px 12px 13px; border: 1.5px solid var(--theme-surface-tint); border-radius: 10px; font-size: 14px; background: #fafafa; color: var(--theme-text-strongest); outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; font-family: inherit; }
  .rp-input:focus { border-color: ${PURPLE}; background: #fff; box-shadow: 0 0 0 4px rgba(var(--theme-primary-rgb), 0.09); }
  .rp-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--theme-primary-soft); display: flex; align-items: center; padding: 2px; }
  .rp-btn { width: 100%; margin-top: 4px; background: linear-gradient(135deg, ${PURPLE_DARK} 0%, ${PURPLE} 50%, ${PURPLE_LIGHT} 100%); color: #fff; border: none; padding: 14px; border-radius: 11px; font-size: 14.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 9px; box-shadow: 0 8px 24px rgba(var(--theme-primary-rgb), 0.38); font-family: inherit; }
  .rp-btn:disabled { opacity: 0.72; cursor: not-allowed; }
  .rp-spinner { width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  .rp-error { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 11px 14px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 9px; color: #c53030; font-size: 13px; font-weight: 500; animation: slideIn 0.3s ease both; }
  .rp-success { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 11px 14px; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 9px; color: #276749; font-size: 13px; font-weight: 500; animation: slideIn 0.3s ease both; }
  .rp-back { display: block; margin-top: 20px; text-align: center; font-size: 13px; color: ${PURPLE}; text-decoration: none; font-weight: 600; }
  .rp-back:hover { opacity: 0.75; }

  @media (max-width: 480px) {
    .rp-root { padding: 20px 16px; }
    .rp-title { font-size: 22px; }
    .rp-input { font-size: 16px; padding: 11px 42px 11px 12px; }
    .rp-btn { padding: 13px; font-size: 14px; }
  }
`;

export default function ResetPassword() {
  useTheme('login');
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(token, { password });
      localStorage.setItem('aotms_token', res.data.token);
      localStorage.setItem('aotms_user', JSON.stringify(res.data.user));
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired');
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rp-root">
        <div className="rp-card">
          <div className="rp-badge">
            <div className="rp-dot" />
            <span className="rp-badge-text">AOTMS CRM Portal</span>
          </div>
          <div className="rp-title">Reset your password</div>
          <div className="rp-sub">Choose a new password for your account.</div>

          {error && (
            <div className="rp-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c53030" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {success ? (
            <div className="rp-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Password reset successful. Redirecting...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="rp-field">
                <label className="rp-label">New Password</label>
                <div className="rp-input-wrap">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="rp-input"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" className="rp-eye" onClick={() => setShowPass(!showPass)}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div className="rp-field">
                <label className="rp-label">Confirm New Password</label>
                <div className="rp-input-wrap">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="rp-input"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="rp-btn">
                {loading ? <><div className="rp-spinner" /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          )}

          <Link to="/login" className="rp-back">← Back to Sign In</Link>
        </div>
      </div>
    </>
  );
}