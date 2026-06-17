import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PURPLE = '#5b3fc7';
const PURPLE_DARK = '#4a2eb8';
const PURPLE_LIGHT = '#7c5cdd';

const LOGO_URL = 'https://res.cloudinary.com/dcmt06mac/image/upload/v1781638554/aotms_logo-2-removebg-preview_iivip1.png';
const CALLER_IMG = 'https://res.cloudinary.com/dcmt06mac/image/upload/v1781513140/loginui_oyryix.png';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fadeInRight { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-14px) rotate(1deg); } }
  @keyframes shimmer { 0% { background-position: -300% 0; } 100% { background-position: 300% 0; } }
  @keyframes slideIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes bgMove { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.05); } 66% { transform: translate(-20px,15px) scale(0.98); } 100% { transform: translate(0,0) scale(1); } }
  @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }

  .lw-root {
    min-height: 100vh; display: flex;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #ffffff;
  }

  /* ── LEFT PANEL ── */
  .lw-left {
    width: 52%; position: relative; overflow: hidden;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 44px 48px; gap: 24px;
    background: linear-gradient(145deg, #1e0860 0%, #3318a0 30%, #5b3fc7 65%, #7c5cdd 100%);
    animation: fadeInLeft 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }
  @media (max-width: 860px) { .lw-left { display: none !important; } .lw-right { width: 100% !important; } }

  .lw-bg-circle {
    position: absolute; border-radius: 50%; pointer-events: none;
    animation: bgMove 12s ease-in-out infinite;
  }
  .lw-bg-c1 { width: 420px; height: 420px; top: -140px; left: -120px; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%); animation-delay: 0s; }
  .lw-bg-c2 { width: 500px; height: 500px; bottom: -180px; right: -150px; background: radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 65%); animation-delay: -4s; }
  .lw-bg-c3 { width: 240px; height: 240px; top: 42%; left: 38%; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%); animation-delay: -8s; }

  .lw-dots {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.055;
    background-image: radial-gradient(circle, #fff 1px, transparent 1px);
    background-size: 28px 28px;
  }

  /* ── LOGO: large transparent PNG, no text ── */
  .lw-logo-area {
    position: relative; z-index: 3;
    animation: fadeInUp 0.6s ease 0.1s both;
  }
  .lw-logo-img {
    width: 400px; height: auto;
    object-fit: contain;
    filter: brightness(0) invert(1) drop-shadow(0 2px 14px rgba(0,0,0,0.2));
  }

  /* Headline */
  .lw-headline { position: relative; z-index: 3; animation: fadeInUp 0.6s ease 0.2s both; }
  .lw-headline h2 {
    font-size: 32px; font-weight: 900; color: #fff; line-height: 1.18;
    letter-spacing: -0.5px; margin-bottom: 12px;
  }
  .lw-gradient-text {
    background: linear-gradient(90deg, #c4b5fd, #e9d5ff, #a78bfa);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .lw-headline p { font-size: 13.5px; color: rgba(255,255,255,0.65); line-height: 1.75; }

  /* Feature chips */
  .lw-chips { position: relative; z-index: 3; display: flex; gap: 8px; flex-wrap: wrap; animation: fadeInUp 0.6s ease 0.3s both; }
  .lw-chip {
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.11); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.18); border-radius: 20px;
    padding: 6px 13px; font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.92);
  }
  .lw-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #86efac; animation: dotPulse 2s ease infinite; flex-shrink: 0; }

  /* Caller image */
  .lw-img-wrap {
    position: relative; z-index: 3; flex: 1;
    display: flex; align-items: center; justify-content: center;
    animation: float 6s ease-in-out infinite 0.5s; min-height: 0;
  }
  .lw-img-glow {
    position: absolute; width: 75%; padding-top: 75%; border-radius: 50%;
    background: radial-gradient(circle, rgba(167,139,250,0.22), transparent 65%);
    top: 50%; left: 50%; transform: translate(-50%, -50%);
  }
  .lw-caller-img {
    width: 82%; max-width: 340px; border-radius: 18px; position: relative; z-index: 2;
    box-shadow: 0 28px 68px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.1);
    object-fit: cover;
  }

  /* Stats */
  .lw-stats { position: relative; z-index: 3; display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; animation: fadeInUp 0.6s ease 0.5s both; }
  .lw-stat {
    background: rgba(255,255,255,0.1); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
    padding: 14px 10px; text-align: center;
    transition: transform 0.2s ease, background 0.2s ease;
    animation: countUp 0.5s ease both;
  }
  .lw-stat:hover { transform: translateY(-3px); background: rgba(255,255,255,0.17); }
  .lw-stat-val { font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
  .lw-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 5px; font-weight: 500; }

  /* ── RIGHT PANEL ── */
  .lw-right {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 40px 32px; background: #ffffff;
    animation: fadeInRight 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }
  .lw-form-card { width: 100%; max-width: 400px; }

  /* Portal badge */
  .lw-portal-badge {
    display: inline-flex; align-items: center; gap: 7px;
    background: #f3f0ff; border: 1px solid #e0d9ff;
    border-radius: 20px; padding: 5px 13px;
    margin-bottom: 26px; animation: fadeInUp 0.5s ease 0.1s both;
  }
  .lw-portal-dot { width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; animation: dotPulse 2.5s ease infinite; }
  .lw-portal-text { font-size: 11px; font-weight: 700; color: ${PURPLE}; text-transform: uppercase; letter-spacing: 1.2px; }

  /* Welcome */
  .lw-welcome { animation: fadeInUp 0.5s ease 0.2s both; margin-bottom: 26px; }
  .lw-welcome h1 { font-size: 26px; font-weight: 800; color: #1a1442; margin-bottom: 5px; letter-spacing: -0.4px; }
  .lw-welcome p { font-size: 13.5px; color: #8a8a9a; }

  /* Error */
  .lw-error {
    display: flex; align-items: center; gap: 9px;
    margin-bottom: 16px; padding: 11px 14px;
    background: #fff5f5; border: 1px solid #fed7d7; border-radius: 9px;
    color: #c53030; font-size: 13px; font-weight: 500;
    animation: slideIn 0.3s ease both;
  }
  .lw-err-icon { width: 16px; height: 16px; background: #fc8181; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* Form */
  .lw-form { display: flex; flex-direction: column; gap: 18px; }
  .lw-field { animation: fadeInUp 0.5s ease both; }
  .lw-field:nth-child(1) { animation-delay: 0.3s; }
  .lw-field:nth-child(2) { animation-delay: 0.4s; }
  .lw-field:nth-child(3) { animation-delay: 0.5s; }

  .lw-label { display: block; font-size: 11.5px; font-weight: 700; color: #4a4a6a; text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .lw-input-wrap { position: relative; }
  .lw-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #b0aecf; z-index: 1; display: flex; }
  .lw-input {
    width: 100%; padding: 12px 13px 12px 40px;
    border: 1.5px solid #e8e4f5; border-radius: 10px;
    font-size: 14px; background: #fafafa; color: #1a1442; outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    font-family: inherit;
  }
  .lw-input:focus { border-color: ${PURPLE}; background: #fff; box-shadow: 0 0 0 4px rgba(91,63,199,0.09); }
  .lw-input::placeholder { color: #c5c2da; }
  .lw-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #b0aecf; display: flex; align-items: center; padding: 2px; transition: color 0.2s; border-radius: 4px; }
  .lw-eye:hover { color: ${PURPLE}; }

  .lw-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .lw-forgot { font-size: 12px; color: ${PURPLE}; text-decoration: none; font-weight: 600; transition: opacity 0.2s; }
  .lw-forgot:hover { opacity: 0.75; }

  /* Button */
  .lw-btn {
    width: 100%; background: linear-gradient(135deg, ${PURPLE_DARK} 0%, ${PURPLE} 50%, ${PURPLE_LIGHT} 100%);
    color: #fff; border: none; padding: 14px; border-radius: 11px;
    font-size: 14.5px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 8px 24px rgba(91,63,199,0.38);
    position: relative; overflow: hidden; font-family: inherit; letter-spacing: 0.2px;
  }
  .lw-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(91,63,199,0.48); }
  .lw-btn:active:not(:disabled) { transform: translateY(0); box-shadow: 0 4px 12px rgba(91,63,199,0.3); }
  .lw-btn:disabled { opacity: 0.72; cursor: not-allowed; }
  .lw-btn::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
    background-size: 300% 100%; animation: shimmer 2.2s infinite;
  }
  .lw-spinner { width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

  /* Divider */
  .lw-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0 12px; animation: fadeInUp 0.5s ease 0.55s both; }
  .lw-divider-line { flex: 1; height: 1px; background: #ede9f8; }
  .lw-divider-text { font-size: 11px; color: #b5b2cc; font-weight: 500; white-space: nowrap; }

  /* Demo box */
  .lw-demo { background: #f8f6ff; border: 1px solid #ede9f8; border-radius: 11px; padding: 14px 16px; animation: fadeInUp 0.5s ease 0.6s both; }
  .lw-demo-title { font-size: 10.5px; font-weight: 700; color: #a09cc0; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 9px; }
  .lw-demo-row { font-size: 12.5px; color: #4a4a6a; display: flex; align-items: center; gap: 6px; padding: 3px 0; flex-wrap: wrap; }
  .lw-demo-role { font-weight: 700; color: ${PURPLE}; min-width: 44px; }
  .lw-demo-code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11.5px; color: #6b68a0; background: #ede9f8; padding: 2px 7px; border-radius: 5px; }

  .lw-footer { margin-top: 20px; text-align: center; font-size: 11px; color: #c0bdda; animation: fadeInUp 0.5s ease 0.7s both; }
`;

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="lw-root">

        {/* ── LEFT PANEL ── */}
        <div className="lw-left">
          <div className="lw-dots" />
          <div className="lw-bg-circle lw-bg-c1" />
          <div className="lw-bg-circle lw-bg-c2" />
          <div className="lw-bg-circle lw-bg-c3" />

          {/* Logo — large transparent PNG only, no text */}
          <div className="lw-logo-area">
            <img src={LOGO_URL} alt="AOTMS Logo" className="lw-logo-img" />
          </div>

          {/* Headline */}
          <div className="lw-headline">
            <h2>
              Supercharge Your<br />
              <span className="lw-gradient-text">Sales Calls</span>
            </h2>
            <p>Manage leads, track performance, and close more deals with the most powerful telecaller dashboard built for modern teams.</p>
          </div>

          {/* Feature chips */}
          <div className="lw-chips">
            {['AI-Powered Dialing', 'Real-time Analytics', 'Smart Follow-ups'].map((f, i) => (
              <div key={i} className="lw-chip">
                <div className="lw-chip-dot" style={{ animationDelay: `${i * 0.4}s` }} />
                {f}
              </div>
            ))}
          </div>

          {/* Caller image */}
          <div className="lw-img-wrap">
            <div className="lw-img-glow" />
            <img src={CALLER_IMG} alt="Telecaller" className="lw-caller-img" />
          </div>

          {/* Stats */}
          <div className="lw-stats">
            {[['10K+', 'Leads Managed', 0.5], ['97%', 'Call Success', 0.6], ['3×', 'Faster Closings', 0.7]].map(([num, lbl, d]) => (
              <div key={lbl} className="lw-stat" style={{ animationDelay: `${d}s` }}>
                <div className="lw-stat-val">{num}</div>
                <div className="lw-stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lw-right">
          <div className="lw-form-card">

            <div className="lw-portal-badge">
              <div className="lw-portal-dot" />
              <span className="lw-portal-text">Caller Portal</span>
            </div>

            <div className="lw-welcome">
              <h1>Welcome back 👋</h1>
              <p>Sign in to your caller dashboard</p>
            </div>

            {error && (
              <div className="lw-error">
                <div className="lw-err-icon">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="lw-form">
              {/* Email */}
              <div className="lw-field">
                <label className="lw-label">Email Address</label>
                <div className="lw-input-wrap">
                  <span className="lw-input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </span>
                  <input type="email" placeholder="you@company.com" className="lw-input"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    autoComplete="off" required />
                </div>
              </div>

              {/* Password */}
              <div className="lw-field">
                <div className="lw-label-row">
                  <label className="lw-label" style={{ margin: 0 }}>Password</label>
                  <a href="#" className="lw-forgot">Forgot password?</a>
                </div>
                <div className="lw-input-wrap">
                  <span className="lw-input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="lw-input"
                    style={{ paddingRight: 42 }} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password" required />
                  <button type="button" className="lw-eye" onClick={() => setShowPass(!showPass)}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="lw-field">
                <button type="submit" disabled={loading} className="lw-btn">
                  {loading
                    ? <><div className="lw-spinner" /> Signing in...</>
                    : <>Sign In <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
                  }
                </button>
              </div>
            </form>

            {/* <div className="lw-divider">
              <div className="lw-divider-line" />
              <span className="lw-divider-text">Demo Access</span>
              <div className="lw-divider-line" />
            </div> */}

            {/* <div className="lw-demo">
              <div className="lw-demo-title">Try with demo credentials</div>
              <div className="lw-demo-row">
                <span className="lw-demo-role">Admin</span>
                <span className="lw-demo-code">admin@aotms.com</span>
                <span className="lw-demo-code">admin123</span>
              </div>
              <div className="lw-demo-row" style={{ marginTop: 5 }}>
                <span className="lw-demo-role">Caller</span>
                <span className="lw-demo-code">poojitha@aotms.com</span>
                <span className="lw-demo-code">caller123</span>
              </div>
            </div> */}

            <div className="lw-footer">© 2025 AOTMS · Secure & Encrypted</div>

          </div>
        </div>

      </div>
    </>
  );
}