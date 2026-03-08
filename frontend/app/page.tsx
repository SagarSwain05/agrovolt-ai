'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [backendData, setBackendData] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:5001/')
      .then(res => res.json())
      .then(data => {
        setBackendStatus('✅ Connected');
        setBackendData(data);
      })
      .catch(() => {
        setBackendStatus('❌ Not Running');
      });
  }, []);

  const features = [
    {
      icon: '🌾',
      title: 'Crop Intelligence',
      desc: 'AI-powered crop recommendations based on soil type, weather, and market demand. Disease detection with 90%+ accuracy.',
      items: ['Shade-tolerant crop suggestions', 'Yield prediction', 'Disease scanning'],
    },
    {
      icon: '⚡',
      title: 'Solar Optimization',
      desc: 'Maximize panel efficiency with AR tilt guidance and bio-cooling from crops. 10-18% efficiency improvement.',
      items: ['Optimal tilt calculation', 'Soiling detection', 'Performance tracking'],
    },
    {
      icon: '💰',
      title: 'Carbon Credits',
      desc: 'Earn from sustainable farming practices. Track water savings and CO2 reduction. ₹5,000-₹10,000 additional income.',
      items: ['Automated calculation', 'Digital wallet', 'Withdrawal system'],
    },
  ];

  const stats = [
    { value: '10-18%', label: 'Solar Efficiency Gain' },
    { value: '20-30%', label: 'Water Savings' },
    { value: '₹40,000', label: 'Additional Annual Income' },
    { value: '1.2 tons', label: 'CO₂ Reduction/Acre' },
  ];

  const techStack = ['Next.js', 'TypeScript', 'Node.js', 'Express', 'MongoDB', 'TailwindCSS', 'JWT Auth', 'REST API'];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--color-green-50) 0%, var(--color-blue-50) 50%, var(--color-solar-50) 100%)' }}>

      {/* ─── Navigation ─── */}
      <nav style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-green-100)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0.875rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🌾⚡</span>
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, var(--color-green-700), var(--color-blue-600))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>AgroVolt AI</span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>
              Backend:{' '}
              <span style={{
                fontWeight: 700,
                color: backendStatus.includes('✅') ? 'var(--color-green-600)' : 'var(--color-red-500)',
              }}>
                {backendStatus}
              </span>
            </span>
            <Link href="/login" style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-green-600)',
              textDecoration: 'none',
            }}>
              Login
            </Link>
            <Link href="/register" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '4rem 1.5rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          marginBottom: '1.25rem',
          padding: '0.375rem 1rem',
          background: 'var(--color-green-100)',
          color: 'var(--color-green-700)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}>
          🚀 Production-Ready Pilot Version
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
          fontWeight: 800,
          color: 'var(--color-gray-900)',
          marginBottom: '1rem',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}>
          India's First<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--color-green-600), var(--color-blue-600))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Bio-Solar Intelligence Platform
          </span>
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--color-gray-500)',
          maxWidth: 640,
          margin: '0 auto 2rem',
          lineHeight: 1.7,
        }}>
          Optimize Agrivoltaic farming with AI. Generate dual income from crops and solar energy while saving water and earning carbon credits.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            View Dashboard Demo
          </Link>
          <Link href="/register" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            Get Started Free
          </Link>
        </div>

        {/* Backend Status (conditional) */}
        {backendData && (
          <div className="card" style={{
            maxWidth: 440,
            margin: '0 auto',
            background: 'linear-gradient(135deg, var(--color-green-50), var(--color-blue-50))',
            border: '2px solid var(--color-green-200)',
            textAlign: 'left',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🎉 Backend is Live!</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
              <p><strong>Message:</strong> {backendData.message}</p>
              <p><strong>Version:</strong> {backendData.version}</p>
              <p><strong>Status:</strong> <span style={{ color: 'var(--color-green-600)', fontWeight: 700 }}>{backendData.status}</span></p>
              <p style={{ color: 'var(--color-gray-400)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                ✅ 25+ API endpoints ready &nbsp;|&nbsp; ✅ 7 database models &nbsp;|&nbsp; ✅ JWT auth
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ─── Feature Cards ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{
              display: 'flex',
              flexDirection: 'column',
              transition: 'box-shadow 0.3s, transform 0.3s',
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xl)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.375rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
                color: 'var(--color-gray-800)',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '0.9375rem',
                color: 'var(--color-gray-500)',
                lineHeight: 1.65,
                flex: 1,
                marginBottom: '1rem',
              }}>{f.desc}</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {f.items.map((item) => (
                  <li key={item} style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ color: 'var(--color-green-500)', fontWeight: 700 }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Impact Stats ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-green-700), var(--color-blue-600))',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          boxShadow: 'var(--shadow-xl)',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#fff',
            textAlign: 'center',
            marginBottom: '2rem',
          }}>Expected Impact</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1.5rem',
            textAlign: 'center',
          }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.375rem',
              }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>{s.value}</span>
                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '3rem 1.5rem 1rem',
        textAlign: 'center',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-gray-800)',
          marginBottom: '1.25rem',
        }}>Built with Production-Grade Technology</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
          {techStack.map(tech => (
            <span key={tech} style={{
              padding: '0.5rem 1rem',
              background: '#fff',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-gray-700)',
              border: '1px solid var(--color-gray-100)',
            }}>{tech}</span>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '3rem 1.5rem',
      }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, var(--color-blue-50), var(--color-green-50))',
          border: '2px solid var(--color-green-200)',
          textAlign: 'center',
          padding: '3rem 2rem',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--color-gray-900)',
            marginBottom: '0.75rem',
          }}>Ready to Transform Agriculture?</h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--color-gray-500)',
            maxWidth: 560,
            margin: '0 auto 1.5rem',
            lineHeight: 1.7,
          }}>
            Join the agrivoltaic revolution. Empower farmers with AI-driven insights for dual income and sustainable farming.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
              Start Free Trial
            </Link>
            <a href="https://github.com/SagarSwain05/agrovolt-ai" target="_blank" rel="noopener noreferrer"
              className="btn-secondary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{
        background: 'var(--color-gray-800)',
        color: '#fff',
        padding: '2.5rem 1.5rem',
        marginTop: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '1.0625rem', marginBottom: '0.5rem' }}>Built with ❤️ for Indian Farmers</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-400)' }}>
          Empowering Rural India with AI &nbsp;|&nbsp; AgroVolt AI © 2026
        </p>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1.25rem', fontSize: '0.875rem' }}>
          <a href="https://github.com/SagarSwain05/agrovolt-ai" style={{ color: 'var(--color-green-400)', textDecoration: 'none' }}>GitHub</a>
          <span style={{ color: 'var(--color-gray-600)' }}>|</span>
          <Link href="/dashboard" style={{ color: 'var(--color-green-400)', textDecoration: 'none' }}>Dashboard</Link>
          <span style={{ color: 'var(--color-gray-600)' }}>|</span>
          <Link href="/register" style={{ color: 'var(--color-green-400)', textDecoration: 'none' }}>Register</Link>
        </div>
      </footer>
    </div>
  );
}
