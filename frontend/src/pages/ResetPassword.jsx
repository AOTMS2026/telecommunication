import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import useTheme from '../hooks/useTheme';

const PURPLE = 'var(--theme-primary)';
const PURPLE_DARK = 'var(--theme-primary-dark)';
const PURPLE_LIGHT = 'var(--theme-primary-light)';

const styles = `
  .rp-root { min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; padding: 24px; }
  .rp-card { width: 100%; max-width: 400px; background: #fff; border-radius: 14px; padding: 36px 32px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid var(--theme-surface-tint); }
  .rp-title { font-size: 22px; font-weight: 800; color: var(--theme-text-strongest); margin-bottom: 6px; }
  .rp-sub { font-size: 13.5px; color: var(--theme-text-strong); margin-bottom: 24px; line-height: 1.6; }
  .rp-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--theme-text-strong);
    text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .rp-input { width: 100%; padding: 12px 13px; border: 1.5px solid var(--theme-surface-tint); border-radius: 10px;
    font-size: 14px; background: #fafafa; outline: none; font-family: inherit; margin-bottom: 16px; }
  .rp-input:focus { border-color: ${PURPLE}; background: #fff; }
  .rp-btn { width: 100%; margin-top: 4px; background: linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE}, ${PURPLE_LIGHT});
    color: #fff; border: none; padding: 13px; border-radius: 11px; font-size: 14.5px; font-weight: 700;
    cursor: pointer; font-family: inherit; }
  .rp-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .rp-back { display: block; text-align: center; margin-top: 18px; font-size: 13px; color: ${PURPLE}; text-decoration: none; font-weight: 600; }
  .rp-msg { margin-bottom: 16px; padding: 11px 14px; border-radius: 9px; font-size: 13px; font-weight: 500; }
  .rp-msg.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
  .rp-msg.err { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; }
`;

export default function ResetPassword() {
  useTheme('login');
  const { token } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    authAPI.verifyResetToken(token)
      .then(() => setValid(true))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const res = await authAPI.resetPassword(token, password);
      localStorage.setItem('aotms_token', res.data.token);
      localStorage.setItem('aotms_user', JSON.stringify(res.data.user));
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rp-root">
        <div className="rp-card">
          <div className="rp-title">Reset password</div>

          {checking && <div className="rp-sub">Checking your link…</div>}

          {!checking && !valid && (
            <>
              <div className="rp-msg err">This reset link is invalid or has expired.</div>
              <Link to="/forgot-password" className="rp-back">← Request a new link</Link>
            </>
          )}

          {!checking && valid && !success && (
            <>
              <div className="rp-sub">Enter a new password for your account.</div>
              {error && <div className="rp-msg err">{error}</div>}
              <form onSubmit={handleSubmit}>
                <label className="rp-label">New Password</label>
                <input type="password" className="rp-input" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <label className="rp-label">Confirm Password</label>
                <input type="password" className="rp-input" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                <button type="submit" className="rp-btn" disabled={loading}>
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}

          {success && <div className="rp-msg ok">Password reset successful! Redirecting…</div>}

          {!success && <Link to="/login" className="rp-back">← Back to Sign In</Link>}
        </div>
      </div>
    </>
  );
}