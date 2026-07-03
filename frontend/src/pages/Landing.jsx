import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/aotms-global-logo.png';

const FEATURES = [
  { t: 'Smart Lead Management', d: 'Capture, assign and track leads with custom fields, stages and pipelines built for telecom sales teams.', i: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { t: '1-Click Dialer & Call Recording', d: 'Make calls directly from the CRM with automatic call recording, feedback and CallIQ agent analysis.', i: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.42-1.42a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' },
  { t: 'Workflow Automations', d: 'Automate follow-ups, schedules, sales forms, API templates and webhooks with a visual workflow builder.', i: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { t: 'WhatsApp & Messaging', d: 'Send templated WhatsApp messages, track delivery and reply to leads without leaving the CRM.', i: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { t: 'Real Integrations', d: 'Native integrations with Facebook, JustDial, 99acres, WhatsApp Cloud, Google Sheets, Google Meet, Knowlarity, CallerDesk and Maqsam.', i: 'M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83' },
  { t: 'Reports & Leaderboard', d: 'Live dashboards, team leaderboards and exportable reports to track calls, conversions and performance.', i: 'M22 12 18 12 15 21 9 3 6 12 2 12' },
  { t: 'Campaign Management', d: 'Run and track marketing campaigns end to end and route campaign leads straight into your pipeline.', i: 'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0' },
  { t: 'Team Operations & Access Control', d: 'Role-based permission templates, access tokens and team operations to manage users at scale.', i: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4' },
  { t: 'Bulk Import & Blocklist', d: 'Import leads in bulk from Excel, manage stale leads and maintain a blocklist to keep data clean.', i: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' },
];

const INTEGRATIONS = [
  { n: 'Facebook', c: '#1877F2' }, { n: 'JustDial', c: '#E87722' }, { n: 'WhatsApp', c: '#25D366' },
  { n: '99acres', c: '#E01E1E' }, { n: 'CallerDesk', c: '#FF5722' }, { n: 'Google Sheets', c: '#34A853' },
  { n: 'Google Meet', c: '#00BCD4' }, { n: 'Knowlarity', c: '#6C3483' }, { n: 'Maqsam', c: '#C0392B' },
];

const PLANS = [
  {
    name: 'Quarterly', price: 899, cycle: 'billed quarterly', highlight: false,
  },
  {
    name: 'Annual', price: 499, cycle: 'billed annually', highlight: true, save: 44,
  },
];

const CORE_FEATURES = [
  'Excel upload & bulk import', '1-click dialer, call recording', 'Follow-ups & tasks',
  'Reports & leaderboard', 'Workflow automations', 'WhatsApp messaging', 'Integrations (Facebook, JustDial, 99acres...)',
  'Role-based access & permission templates',
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: '#0f172a', background: '#fff' }}>
      {/* NAVBAR */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #eef2f7' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={logoImg} alt="AOTMS" style={{ height: 92, objectFit: 'contain' }} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a onClick={() => scrollTo('features')} style={navLink}>Features</a>
            <a onClick={() => scrollTo('integrations')} style={navLink}>Integrations</a>
            <a onClick={() => scrollTo('pricing')} style={navLink}>Pricing</a>
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              style={{
                background: 'var(--btn-gradient)', color: '#fff', border: 'none', padding: '10px 22px',
                borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,140,60,0.3)',
              }}
            >
              {user ? 'Go to Dashboard' : 'Login'}
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: 'var(--btn-gradient)', backgroundImage: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 55%, #ff9d5c 100%)', padding: '90px 24px 100px', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#86efac' }} />
            All-in-one Telecom Sales CRM
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 18 }}>
            Manage Leads, Calls & Campaigns <br /> with <span style={{ background: 'linear-gradient(90deg, #fff 0%, #ffe8d6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AOTMS CRM</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: 34 }}>
            One dashboard for leads, dialer, call recordings, WhatsApp, automations and real integrations with the tools your telecom sales team already uses.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ background: '#fff', color: '#e8672a', border: 'none', padding: '14px 30px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              Get Started
            </button>
            <button onClick={() => scrollTo('pricing')} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '14px 30px', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '90px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10 }}>Everything your sales team needs</h2>
          <p style={{ color: '#64748b', fontSize: 15 }}>Built for telecom sales, support and operations teams.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 24 }}>
          {FEATURES.map((f) => (
            <div key={f.t} style={{ border: '1px solid #eef2f7', borderRadius: 16, padding: 26, background: '#fbfdff' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--theme-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={f.i} /></svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.t}</h3>
              <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" style={{ padding: '70px 24px', background: 'var(--theme-surface-faint)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Connects with the platforms you already use</h2>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 40 }}>Real, native API integrations — not just webhook stubs.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
            {INTEGRATIONS.map((it) => (
              <div key={it.n} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', fontWeight: 600, fontSize: 13.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: it.c }} />
                {it.n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '90px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10 }}>Simple, Transparent Pricing</h2>
          <p style={{ color: '#64748b', fontSize: 15 }}>Sales CRM Pricing — pick the plan that fits your team.</p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <div style={{ padding: '32px 28px', background: '#fbfdff' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>Core CRM</h3>
            {CORE_FEATURES.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13.5, color: '#334155' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {c}
              </div>
            ))}
          </div>

          {PLANS.map((p) => (
            <div key={p.name} style={{
              padding: '32px 20px', textAlign: 'center', position: 'relative',
              background: p.highlight ? 'var(--theme-surface-tint)' : '#fff',
              borderLeft: '1px solid #e2e8f0',
            }}>
              {p.highlight && (
                <div style={{ position: 'absolute', top: 14, right: 14, background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                  Save {p.save}%
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-primary-dark)', marginBottom: 10 }}>{p.name}</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#0f172a' }}>&#8377;{p.price}</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>/user/mo<br />({p.cycle})</div>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  background: p.highlight ? 'var(--btn-gradient)' : '#fff',
                  color: p.highlight ? '#fff' : 'var(--theme-primary-dark)',
                  border: p.highlight ? 'none' : '1.5px solid var(--theme-primary)',
                }}
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '70px 24px', textAlign: 'center', backgroundImage: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 55%, #ff9d5c 100%)', color: '#fff' }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 14 }}>Ready to streamline your telecom sales?</h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 26, fontSize: 14 }}>Log in and start managing leads, calls and campaigns from one place.</p>
        <button onClick={() => navigate('/login')} style={{ background: '#fff', color: '#e8672a', border: 'none', padding: '14px 34px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Login to AOTMS
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '28px 24px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8', borderTop: '1px solid #eef2f7' }}>
        &copy; {new Date().getFullYear()} AOTMS. All rights reserved.
      </footer>
    </div>
  );
}

const navLink = { fontSize: 14, fontWeight: 600, color: '#334155', cursor: 'pointer' };