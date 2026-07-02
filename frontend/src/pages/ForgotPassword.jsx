import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import useTheme from '../hooks/useTheme';

const PURPLE = 'var(--theme-primary)';
const PURPLE_DARK = 'var(--theme-primary-dark)';
const PURPLE_LIGHT = 'var(--theme-primary-light)';

const styles = `
  .fp-root { min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; padding: 24px; }
  .fp-card { width: 100%; max-width: 400px; background: #fff; border-radius: 14px; padding: 36px 32px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid var(--theme-surface-tint); }
  .fp-title { font-size: 22px; font-weight: 800; color: var(--theme-text-strongest); margin-bottom: 6px; }
  .fp-sub { font-size: 13.5px; color: var(--theme-text-strong); margin-bottom: 24px; line-height: 1.6; }
  .fp-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--theme-text-strong);
    text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .fp-input { width: 100%; padding: 12px 13px; border: 1.5px solid var(--theme-surface-tint); border-radius: 10px;
    font-size: 14px; background: #fafafa; outline: none; font-family: inherit; }
  .fp-input:focus { border-color: ${PURPLE}; background: #fff; }
  .fp-btn { width: 100%; margin-top: 18px; background: linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE}, ${PURPLE_LIGHT});
    color: #fff; border: none; padding: 13px; border-radius: 11px; font-size: 14.5px; font-weight: 700;
    cursor: pointer; font-family: inherit; }
  .fp-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .fp-back { display: block; text-align: center; margin-top: 18px; font-size: 13px; color: ${PURPLE}; text-decoration: none; font-weight: 600; }
  .fp-msg { margin-bottom: 16px; padding: 11px 14px; border-radius: 9px; font-size: 13px; font-weight: 500; }
  .fp-msg.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
  .fp-msg.err { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; }
`;

export default function ForgotPassword() {
  useTheme('login');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword(email);
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
          <div className="fp-title">Forgot password?</div>
          <div className="fp-sub">Enter your account email and we'll send you a link to reset your password.</div>

          {error && <div className="fp-msg err">{error}</div>}
          {sent && <div className="fp-msg ok">If an account exists for that email, a reset link has been sent. Please check your inbox.</div>}

          {!sent && (
            <form onSubmit={handleSubmit}>
              <label className="fp-label">Email Address</label>
              <input type="email" className="fp-input" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button type="submit" className="fp-btn" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link to="/login" className="fp-back">← Back to Sign In</Link>
        </div>
      </div>
    </>
  );
}