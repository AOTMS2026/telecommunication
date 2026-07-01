import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useTheme from '../hooks/useTheme';

const PURPLE = 'var(--theme-primary)';
const PURPLE_DARK = 'var(--theme-primary-dark)';
const PURPLE_LIGHT = 'var(--theme-primary-light)';

import logoImg from '../assets/aotms-global-logo.png';

const LOGO_URL = logoImg;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fadeInRight { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes shimmer { 0% { background-position: -300% 0; } 100% { background-position: 300% 0; } }
  @keyframes slideIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes bgMove { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.05); } 66% { transform: translate(-20px,15px) scale(0.98); } 100% { transform: translate(0,0) scale(1); } }
  @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }

  /* ── 3D ORB SCENE ── */
  @keyframes orbSpin3d { 0% { transform: rotateY(0deg) rotateX(8deg); } 100% { transform: rotateY(360deg) rotateX(8deg); } }
  @keyframes ringSpinA { 0% { transform: rotateX(72deg) rotateZ(0deg); } 100% { transform: rotateX(72deg) rotateZ(360deg); } }
  @keyframes ringSpinB { 0% { transform: rotateX(60deg) rotateY(20deg) rotateZ(0deg); } 100% { transform: rotateX(60deg) rotateY(20deg) rotateZ(-360deg); } }
  @keyframes ringSpinC { 0% { transform: rotateY(80deg) rotateZ(0deg); } 100% { transform: rotateY(80deg) rotateZ(360deg); } }
  @keyframes corePulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.08); filter: brightness(1.25); } }
  @keyframes nodeOrbit1 { 0% { transform: rotate(0deg) translateX(150px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(150px) rotate(-360deg); } }
  @keyframes nodeOrbit2 { 0% { transform: rotate(0deg) translateX(190px) rotate(0deg); } 100% { transform: rotate(-360deg) translateX(190px) rotate(360deg); } }
  @keyframes nodeOrbit3 { 0% { transform: rotate(0deg) translateX(120px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); } }
  @keyframes floatPhone { 0%,100% { transform: translateY(0) rotateY(-18deg) rotateX(6deg); } 50% { transform: translateY(-16px) rotateY(-18deg) rotateX(6deg); } }
  @keyframes waveBar { 0%,100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
  @keyframes typingDot { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
  @keyframes glowPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

  .lw-root {
    min-height: 100vh; display: flex;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--theme-text-strongest);
  }

  /* ── LEFT PANEL ── */
  .lw-left {
    width: 52%; flex-shrink: 0; position: relative; overflow: hidden;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 40px 48px; gap: 18px; perspective: 1400px; margin-right: -1px;
    background: linear-gradient(145deg, var(--theme-text-strongest) 0%, var(--theme-text-strongest) 28%, var(--theme-primary) 65%, var(--theme-primary-light) 100%);
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

  .lw-logo-area { position: relative; z-index: 5; animation: fadeInUp 0.6s ease 0.1s both; }
  .lw-logo-img { width: 220px; height: auto; object-fit: contain; display: block; filter: drop-shadow(0 2px 14px rgba(0,0,0,0.25)); }

  .lw-headline { position: relative; z-index: 5; animation: fadeInUp 0.6s ease 0.2s both; }
  .lw-headline h2 { font-size: 27px; font-weight: 900; color: #fff; line-height: 1.18; letter-spacing: -0.5px; margin-bottom: 8px; }
  .lw-gradient-text {
    background: linear-gradient(90deg, var(--theme-primary-pale), var(--theme-primary-pale), var(--theme-primary-soft));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .lw-headline p { font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.7; max-width: 420px; }

  .lw-chips { position: relative; z-index: 5; display: flex; gap: 8px; flex-wrap: wrap; animation: fadeInUp 0.6s ease 0.3s both; }
  .lw-chip {
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.11); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.18); border-radius: 20px;
    padding: 6px 13px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.92);
  }
  .lw-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #86efac; animation: dotPulse 2s ease infinite; flex-shrink: 0; }

  /* ── 3D AI CALL SCENE ── */
  .lw-scene-wrap {
    position: relative; z-index: 4; flex: 1; min-height: 0;
    display: flex; align-items: center; justify-content: center;
    transform-style: preserve-3d;
  }
  .lw-orb-stage {
    position: relative; width: 280px; height: 280px;
    transform-style: preserve-3d;
    animation: orbSpin3d 16s linear infinite;
  }
  .lw-orb-ring { position: absolute; inset: 0; border-radius: 50%; transform-style: preserve-3d; border: 1.5px solid rgba(255,255,255,0.35); }
  .lw-orb-ring.r1 { animation: ringSpinA 7s linear infinite; border-color: rgba(255,255,255,0.45); box-shadow: 0 0 18px rgba(255,255,255,0.15); }
  .lw-orb-ring.r2 { inset: 26px; animation: ringSpinB 10s linear infinite; border-color: rgba(216,180,254,0.55); box-shadow: 0 0 18px rgba(216,180,254,0.2); }
  .lw-orb-ring.r3 { inset: -26px; animation: ringSpinC 13s linear infinite; border-color: rgba(255,255,255,0.22); }

  .lw-orb-core {
    position: absolute; top: 50%; left: 50%; width: 96px; height: 96px;
    transform: translate(-50%,-50%) translateZ(20px);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff, var(--theme-primary-light) 45%, var(--theme-primary) 80%);
    box-shadow: 0 0 50px 10px rgba(216,180,254,0.55), inset -8px -8px 18px rgba(0,0,0,0.18), inset 6px 6px 14px rgba(255,255,255,0.5);
    animation: corePulse 2.6s ease-in-out infinite;
    display: flex; align-items: center; justify-content: center;
  }
  .lw-orb-core svg { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.25)); }

  .lw-orb-node {
    position: absolute; top: 50%; left: 50%; width: 30px; height: 30px; margin: -15px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.16); backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,0.35); box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    transform-style: preserve-3d;
  }
  .lw-orb-node.n1 { animation: nodeOrbit1 9s linear infinite; }
  .lw-orb-node.n2 { animation: nodeOrbit2 13s linear infinite reverse; }
  .lw-orb-node.n3 { animation: nodeOrbit3 7s linear infinite; }

  .lw-orb-glow {
    position: absolute; width: 90%; padding-top: 90%; border-radius: 50%;
    top: 50%; left: 50%; transform: translate(-50%,-50%) translateZ(-40px);
    background: radial-gradient(circle, rgba(167,139,250,0.35), transparent 68%);
    animation: glowPulse 3s ease-in-out infinite;
  }

  /* floating call card */
  .lw-call-card {
    position: absolute; bottom: 6%; right: 2%; z-index: 6;
    width: 168px; padding: 12px 14px; border-radius: 14px;
    background: rgba(255,255,255,0.13); backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 18px 40px rgba(0,0,0,0.3);
    transform-style: preserve-3d; animation: floatPhone 5s ease-in-out infinite;
  }
  .lw-call-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .lw-call-avatar { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--theme-primary-light), var(--theme-primary)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-call-name { font-size: 11.5px; font-weight: 700; color: #fff; line-height: 1.2; }
  .lw-call-status { font-size: 9.5px; color: rgba(255,255,255,0.6); }
  .lw-wave-row { display: flex; align-items: flex-end; gap: 2.5px; height: 18px; }
  .lw-wave-bar { width: 3px; border-radius: 2px; background: linear-gradient(180deg, var(--theme-primary-pale), var(--theme-primary-soft)); animation: waveBar 1s ease-in-out infinite; transform-origin: bottom; }

  /* AI thinking chip */
  .lw-ai-chip {
    position: absolute; top: 10%; left: -2%; z-index: 6;
    display: flex; align-items: center; gap: 7px;
    background: rgba(255,255,255,0.13); backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.25); border-radius: 20px;
    padding: 7px 12px; box-shadow: 0 14px 30px rgba(0,0,0,0.25);
    animation: floatPhone 6.5s ease-in-out infinite 0.4s;
  }
  .lw-ai-chip span { font-size: 10.5px; font-weight: 700; color: #fff; }
  .lw-typing { display: flex; gap: 3px; }
  .lw-typing i { width: 4px; height: 4px; border-radius: 50%; background: #86efac; display: block; animation: typingDot 1.2s ease infinite; }
  .lw-typing i:nth-child(2) { animation-delay: 0.15s; }
  .lw-typing i:nth-child(3) { animation-delay: 0.3s; }

  /* Stats */
  .lw-stats { position: relative; z-index: 5; display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; animation: fadeInUp 0.6s ease 0.5s both; }
  .lw-stat {
    background: rgba(255,255,255,0.1); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
    padding: 13px 10px; text-align: center;
    transition: transform 0.2s ease, background 0.2s ease;
    animation: countUp 0.5s ease both;
  }
  .lw-stat:hover { transform: translateY(-3px); background: rgba(255,255,255,0.17); }
  .lw-stat-val { font-size: 19px; font-weight: 800; color: #fff; line-height: 1; }
  .lw-stat-lbl { font-size: 9.5px; color: rgba(255,255,255,0.6); margin-top: 5px; font-weight: 500; }

  /* ── RIGHT PANEL ── */
  .lw-right {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 40px 32px; background: #ffffff; perspective: 1200px;
    animation: fadeInRight 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }
  .lw-form-card {
    width: 100%; max-width: 400px;
    transform-style: preserve-3d;
    transition: transform 0.12s ease-out;
    will-change: transform;
  }

  .lw-portal-badge {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--theme-surface-tint); border: 1px solid var(--theme-primary-pale2);
    border-radius: 20px; padding: 5px 13px;
    margin-bottom: 26px; animation: fadeInUp 0.5s ease 0.1s both;
  }
  .lw-portal-dot { width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; animation: dotPulse 2.5s ease infinite; }
  .lw-portal-text { font-size: 11px; font-weight: 700; color: ${PURPLE}; text-transform: uppercase; letter-spacing: 1.2px; }

  .lw-welcome { animation: fadeInUp 0.5s ease 0.2s both; margin-bottom: 26px; }
  .lw-welcome h1 { font-size: 26px; font-weight: 800; color: var(--theme-text-strongest); margin-bottom: 5px; letter-spacing: -0.4px; }
  .lw-welcome p { font-size: 13.5px; color: var(--theme-text-strong); }

  .lw-error {
    display: flex; align-items: center; gap: 9px;
    margin-bottom: 16px; padding: 11px 14px;
    background: #fff5f5; border: 1px solid #fed7d7; border-radius: 9px;
    color: #c53030; font-size: 13px; font-weight: 500;
    animation: slideIn 0.3s ease both;
  }
  .lw-err-icon { width: 16px; height: 16px; background: #fc8181; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  .lw-form { display: flex; flex-direction: column; gap: 18px; }
  .lw-field { animation: fadeInUp 0.5s ease both; }
  .lw-field:nth-child(1) { animation-delay: 0.3s; }
  .lw-field:nth-child(2) { animation-delay: 0.4s; }
  .lw-field:nth-child(3) { animation-delay: 0.5s; }

  .lw-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--theme-text-strong); text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 7px; }
  .lw-input-wrap { position: relative; }
  .lw-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--theme-primary-soft); z-index: 1; display: flex; }
  .lw-input {
    width: 100%; padding: 12px 13px 12px 40px;
    border: 1.5px solid var(--theme-surface-tint); border-radius: 10px;
    font-size: 14px; background: #fafafa; color: var(--theme-text-strongest); outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    font-family: inherit;
  }
  .lw-input:focus { border-color: ${PURPLE}; background: #fff; box-shadow: 0 0 0 4px rgba(var(--theme-primary-rgb), 0.09); }
  .lw-input::placeholder { color: var(--theme-primary-pale); }
  .lw-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--theme-primary-soft); display: flex; align-items: center; padding: 2px; transition: color 0.2s; border-radius: 4px; }
  .lw-eye:hover { color: ${PURPLE}; }

  .lw-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .lw-forgot { font-size: 12px; color: ${PURPLE}; text-decoration: none; font-weight: 600; transition: opacity 0.2s; }
  .lw-forgot:hover { opacity: 0.75; }

  .lw-btn {
    width: 100%; background: linear-gradient(135deg, ${PURPLE_DARK} 0%, ${PURPLE} 50%, ${PURPLE_LIGHT} 100%);
    color: #fff; border: none; padding: 14px; border-radius: 11px;
    font-size: 14.5px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 8px 24px rgba(var(--theme-primary-rgb), 0.38);
    position: relative; overflow: hidden; font-family: inherit; letter-spacing: 0.2px;
  }
  .lw-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(var(--theme-primary-rgb), 0.48); }
  .lw-btn:active:not(:disabled) { transform: translateY(0); box-shadow: 0 4px 12px rgba(var(--theme-primary-rgb), 0.3); }
  .lw-btn:disabled { opacity: 0.72; cursor: not-allowed; }
  .lw-btn::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
    background-size: 300% 100%; animation: shimmer 2.2s infinite;
  }
  .lw-spinner { width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

  .lw-footer { margin-top: 20px; text-align: center; font-size: 11px; color: var(--theme-primary-pale); animation: fadeInUp 0.5s ease 0.7s both; }
`;

export default function Login() {
  useTheme('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  };
  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'rotateY(0deg) rotateX(0deg)';
  };

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

        {/* ── LEFT PANEL: 3D AI Calling Scene ── */}
        <div className="lw-left">
          <div className="lw-dots" />
          <div className="lw-bg-circle lw-bg-c1" />
          <div className="lw-bg-circle lw-bg-c2" />
          <div className="lw-bg-circle lw-bg-c3" />
          <div className="lw-logo-area">
            <img src={LOGO_URL} alt="AOTMS Global Pvt. Ltd" className="lw-logo-img" />
          </div>

          <div className="lw-headline">
            <h2>
              AI-Powered<br />
              <span className="lw-gradient-text">Telecom Operations</span>
            </h2>
            <p>AOTMS automates your outbound calling, tracks every lead, and gives your team real-time intelligence — all in one CRM built for modern telecom operations.</p>
          </div>

          <div className="lw-chips">
            {['AI Voice Agent', 'Auto Dialing', 'Live Call Analytics'].map((f, i) => (
              <div key={i} className="lw-chip">
                <div className="lw-chip-dot" style={{ animationDelay: `${i * 0.4}s` }} />
                {f}
              </div>
            ))}
          </div>

          {/* 3D Orb Scene */}
          <div className="lw-scene-wrap">
            <div className="lw-ai-chip">
              <div className="lw-typing"><i /><i /><i /></div>
              <span>AI Agent Calling…</span>
            </div>

            <div className="lw-orb-stage">
              <div className="lw-orb-glow" />
              <div className="lw-orb-ring r1" />
              <div className="lw-orb-ring r2" />
              <div className="lw-orb-ring r3" />

              <div className="lw-orb-core">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>

              <div className="lw-orb-node n1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="lw-orb-node n2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div className="lw-orb-node n3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
            </div>

            <div className="lw-call-card">
              <div className="lw-call-row">
                <div className="lw-call-avatar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div className="lw-call-name">Live Call · 02:41</div>
                  <div className="lw-call-status">Connected · AI Agent</div>
                </div>
              </div>
              <div className="lw-wave-row">
                {[6,12,18,10,16,8,14,7].map((h, i) => (
                  <div key={i} className="lw-wave-bar" style={{ height: h, animationDelay: `${i * 0.09}s` }} />
                ))}
              </div>
            </div>
          </div>

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
        <div className="lw-right" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="lw-form-card" ref={cardRef}>

            <div className="lw-portal-badge">
              <div className="lw-portal-dot" />
              <span className="lw-portal-text">AOTMS CRM Portal</span>
            </div>

            <div className="lw-welcome">
              <h1>Welcome back 👋</h1>
              <p>Sign in to your AOTMS CRM dashboard</p>
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

            <div className="lw-footer">© 2025 AOTMS · Secure & Encrypted</div>

          </div>
        </div>

      </div>
    </>
  );
}