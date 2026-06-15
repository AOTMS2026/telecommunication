import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PURPLE = '#5b3fc7';
const PURPLE_DARK = '#4a2eb8';

const LOGO_URL = 'https://res.cloudinary.com/dcmt06mac/image/upload/v1780998283/aotms_logo-2_v8fs1e.jpg';
const CALLER_IMG = 'https://res.cloudinary.com/dcmt06mac/image/upload/v1781513140/loginui_oyryix.png';

const styles = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fadeInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
  @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes countUp { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

  .login-wrapper { min-height: 100vh; display: flex; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0c29; }

  .left-panel {
    width: 55%;
    background: linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #4a2eb8 80%, #6d28d9 100%);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 48px; position: relative; overflow: hidden;
    animation: fadeInLeft 0.7s ease both;
  }
  @media (max-width: 900px) { .left-panel { display: none !important; } .right-panel { width: 100% !important; } }

  .orb1 { position: absolute; top: -80px; left: -80px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%); animation: float 6s ease-in-out infinite; }
  .orb2 { position: absolute; bottom: -100px; right: -60px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(91,63,199,0.3), transparent 70%); animation: float 8s ease-in-out infinite reverse; }
  .orb3 { position: absolute; top: 40%; left: 30%; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(167,139,250,0.15), transparent 70%); animation: float 5s ease-in-out infinite 1s; }

  .caller-img-wrap {
    position: relative; z-index: 2; flex: 1; display: flex; align-items: center; justify-content: center; margin: 20px 0;
    animation: float 5s ease-in-out infinite 0.5s;
  }
  .caller-img {
    width: 85%; max-width: 380px; border-radius: 20px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
    object-fit: cover;
  }

  .stat-card {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px; padding: 16px 12px; text-align: center;
    transition: transform 0.2s, background 0.2s;
    animation: countUp 0.5s ease both;
  }
  .stat-card:hover { transform: translateY(-4px); background: rgba(255,255,255,0.18); }

  .right-panel {
    flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px;
    background: #faf9ff;
    animation: fadeInRight 0.7s ease both;
  }

  .form-card { width: 100%; max-width: 400px; }

  .logo-wrap {
    display: flex; align-items: center; gap: 12; margin-bottom: 36px;
    animation: fadeInUp 0.5s ease 0.2s both;
  }
  .logo-img { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; box-shadow: 0 4px 16px rgba(91,63,199,0.3); }

  .input-field {
    width: 100%; padding: 11px 12px 11px 36px;
    border: 1.5px solid #e0daf5; border-radius: 8px; font-size: 14px;
    background: #fff; color: #2d2d6b; outline: none; box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input-field:focus { border-color: ${PURPLE}; box-shadow: 0 0 0 3px rgba(91,63,199,0.12); }
  .input-field::placeholder { color: #bbb; }

  .sign-btn {
    width: 100%; background: linear-gradient(135deg, ${PURPLE_DARK}, #6d28d9);
    color: #fff; border: none; padding: 13px; border-radius: 10px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 6px 20px rgba(91,63,199,0.4);
    position: relative; overflow: hidden;
  }
  .sign-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(91,63,199,0.5); }
  .sign-btn:active:not(:disabled) { transform: translateY(0); }
  .sign-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .sign-btn::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }

  .demo-box {
    margin-top: 24px; padding: 14px 16px;
    background: #fff; border-radius: 10px; border: 1px solid #e5e2f5;
    animation: fadeInUp 0.5s ease 0.6s both;
  }

  .field-wrap { animation: fadeInUp 0.5s ease both; }
  .field-wrap:nth-child(1) { animation-delay: 0.35s; }
  .field-wrap:nth-child(2) { animation-delay: 0.45s; }
  .field-wrap:nth-child(3) { animation-delay: 0.55s; }
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
      <div className="login-wrapper">

        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="orb1" /><div className="orb2" /><div className="orb3" />

          {/* Top logo - full width */}
          <div style={{ position: 'relative', zIndex: 2, animation: 'fadeInUp 0.6s ease both' }}>
            <img src={LOGO_URL} alt="AOTMS Logo" style={{ width: '100%', maxWidth: 260, height: 'auto', borderRadius: 14, objectFit: 'contain', border: '2px solid rgba(255,255,255,0.15)', display: 'block' }} />
          </div>

          {/* Headline */}
          <div style={{ position: 'relative', zIndex: 2, animation: 'fadeInUp 0.6s ease 0.15s both' }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              Supercharge Your<br />
              <span style={{ background: 'linear-gradient(90deg, #a78bfa, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sales Calls</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7 }}>
              Manage leads, track calls, and close more deals with the most powerful caller dashboard built for teams.
            </p>
          </div>

          {/* Telecaller image */}
          <div className="caller-img-wrap">
            <img src={CALLER_IMG} alt="Telecaller" className="caller-img" />
          </div>

          {/* Stats */}
          <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[['10K+', 'Leads Managed', 0.1], ['97%', 'Call Success', 0.2], ['3x', 'Faster Closings', 0.3]].map(([num, label, delay]) => (
              <div key={label} className="stat-card" style={{ animationDelay: `${delay + 0.4}s` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{num}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="form-card">

            {/* Portal label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, animation: 'fadeInUp 0.5s ease 0.1s both' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PURPLE }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Caller Portal</div>
            </div>

            <div style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a4e', marginBottom: 4 }}>Welcome back 👋</h1>
              <p style={{ color: '#999', marginBottom: 28, fontSize: 14 }}>Sign in to your caller dashboard</p>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, color: '#c53030', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.3s ease both' }}>
                <div style={{ width: 6, height: 6, background: '#e53e3e', borderRadius: '50%', flexShrink: 0 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field-wrap">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input type="email" placeholder="you@company.com" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="off" required />
                </div>
              </div>

              <div className="field-wrap">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
                  <a href="#" style={{ fontSize: 12, color: PURPLE, textDecoration: 'none', fontWeight: 600 }}>Forgot password?</a>
                </div>
                <div style={{ position: 'relative' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="input-field" style={{ paddingRight: 40 }} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', display: 'flex', padding: 0 }}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div className="field-wrap">
                <button type="submit" disabled={loading} className="sign-btn">
                  {loading ? (
                    <><div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in...</>
                  ) : 'Sign in →'}
                </button>
              </div>
            </form>

            <div className="demo-box">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Demo Credentials</div>
              <div style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong style={{ color: '#2d2d6b' }}>Admin:</strong> admin@aotms.com / admin123</div>
                <div><strong style={{ color: '#2d2d6b' }}>Caller:</strong> poojitha@aotms.com / caller123</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}