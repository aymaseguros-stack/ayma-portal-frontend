/**
 * MARKETING STUDIO - AYMA ADVISORS
 * Editor Gráfico + Publicador de Contenido para Redes Sociales
 * 
 * Integra: Brand Kit v1 + Workers MUSANTE/ORTE/CAMPAZ/FERRETI
 * Flujo: Generar → Editar → Preview → Aprobar → Publicar
 * 
 * Versión: 2.1 (API Connected)
 * Fecha: 26 Febrero 2026
 * 
 * Backend: https://ayma-portal-backend.onrender.com/api/v1/marketing
 * Auth: JWT desde localStorage
 * Endpoints: POST /contenido, POST /generar, POST /{id}/aprobar, GET /dashboard
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = import.meta?.env?.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const fetchAPI = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...options,
  };
  try {
    const res = await fetch(`${API_URL}${endpoint}`, config);
    if (res.status === 401) {
      console.warn('Token expirado');
      return null;
    }
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('fetchAPI error:', err);
    return null;
  }
};

// ============================================
// BRAND KIT AYMA v1.0
// ============================================
const BRAND = {
  colors: {
    primary: '#1e3a5f',
    primaryLight: '#2563eb',
    accent: '#60a5fa',
    cta: '#f59e0b',
    ctaHover: '#d97706',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    dark: '#0f172a',
    gray: '#374151',
    grayLight: '#9ca3af',
    grayBg: '#f1f5f9',
    white: '#ffffff',
  },
  fonts: {
    display: "'DM Sans', sans-serif",
    body: "'DM Sans', sans-serif",
  },
  gradients: {
    hero: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)',
    card: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
    accent: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    cta: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    dark: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
  },
  disclaimer: 'AYMA Advisors - PAS 68323 - SSN',
  tagline: 'Gerencia de Riesgos',
};

// ============================================
// CONFIGURACIÓN REDES SOCIALES
// ============================================
const REDES = {
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: '#E4405F',
    formats: {
      post: { w: 1080, h: 1080, label: 'Post Feed' },
      story: { w: 1080, h: 1920, label: 'Story' },
      reel: { w: 1080, h: 1920, label: 'Reel Cover' },
    },
    maxChars: 2200,
    maxHashtags: 30,
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    formats: {
      post: { w: 1200, h: 630, label: 'Post' },
      story: { w: 1080, h: 1920, label: 'Story' },
    },
    maxChars: 500,
    maxHashtags: 10,
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0077B5',
    formats: {
      post: { w: 1200, h: 627, label: 'Post' },
      article: { w: 1200, h: 644, label: 'Artículo' },
    },
    maxChars: 3000,
    maxHashtags: 5,
  },
  x_twitter: {
    name: 'X (Twitter)',
    icon: '𝕏',
    color: '#000000',
    formats: {
      post: { w: 1200, h: 675, label: 'Post' },
    },
    maxChars: 280,
    maxHashtags: 3,
  },
};

// ============================================
// TEMPLATES DE DISEÑO
// ============================================
const TEMPLATES = [
  {
    id: 'tip-auto',
    name: 'Tip de Seguros',
    category: 'educativo',
    layout: 'centered',
    bgStyle: 'gradient-dark',
    elements: {
      hasIcon: true,
      hasTitle: true,
      hasSubtitle: true,
      hasCTA: true,
      hasDisclaimer: true,
    },
  },
  {
    id: 'promo-producto',
    name: 'Promoción Producto',
    category: 'comercial',
    layout: 'split',
    bgStyle: 'gradient-accent',
    elements: {
      hasIcon: true,
      hasTitle: true,
      hasPrice: true,
      hasCTA: true,
      hasDisclaimer: true,
    },
  },
  {
    id: 'testimonial',
    name: 'Testimonial Cliente',
    category: 'testimonial',
    layout: 'quote',
    bgStyle: 'solid-white',
    elements: {
      hasQuote: true,
      hasAuthor: true,
      hasRating: true,
      hasDisclaimer: true,
    },
  },
  {
    id: 'noticia',
    name: 'Noticia del Sector',
    category: 'noticia',
    layout: 'editorial',
    bgStyle: 'gradient-dark',
    elements: {
      hasTag: true,
      hasTitle: true,
      hasSubtitle: true,
      hasDisclaimer: true,
    },
  },
  {
    id: 'institucional',
    name: 'Institucional AYMA',
    category: 'institucional',
    layout: 'brand',
    bgStyle: 'gradient-hero',
    elements: {
      hasLogo: true,
      hasTitle: true,
      hasSubtitle: true,
      hasStats: true,
      hasDisclaimer: true,
    },
  },
  {
    id: 'art-empresa',
    name: 'ART para Empresas',
    category: 'comercial',
    layout: 'benefit-list',
    bgStyle: 'gradient-accent',
    elements: {
      hasIcon: true,
      hasTitle: true,
      hasBenefits: true,
      hasCTA: true,
      hasDisclaimer: true,
    },
  },
];

// ============================================
// CALENDARIO EDITORIAL
// ============================================
const CALENDARIO = {
  Monday: { tipo: 'educativo', tema: 'Tips de seguros', emoji: '📚' },
  Tuesday: { tipo: 'testimonial', tema: 'Historias de clientes', emoji: '⭐' },
  Wednesday: { tipo: 'comercial', tema: 'Promoción producto', emoji: '💰' },
  Thursday: { tipo: 'noticia', tema: 'Noticias del sector', emoji: '📰' },
  Friday: { tipo: 'institucional', tema: 'AYMA marca', emoji: '🏢' },
};

const PRODUCTOS_SEGUROS = [
  { id: 'auto', name: 'Seguro Automotor', icon: '🚗', color: '#3b82f6' },
  { id: 'hogar', name: 'Seguro Hogar', icon: '🏠', color: '#22c55e' },
  { id: 'art', name: 'ART Empresas', icon: '👷', color: '#f59e0b' },
  { id: 'vida', name: 'Seguro de Vida', icon: '❤️', color: '#ef4444' },
  { id: 'comercio', name: 'Integral Comercio', icon: '🏪', color: '#8b5cf6' },
  { id: 'moto', name: 'Seguro Moto', icon: '🏍️', color: '#06b6d4' },
  { id: 'flota', name: 'Flota Vehicular', icon: '🚛', color: '#0d9488' },
  { id: 'rc', name: 'Resp. Civil', icon: '⚖️', color: '#6366f1' },
  { id: 'incendio', name: 'Seg. Incendio', icon: '🔥', color: '#dc2626' },
  { id: 'transporte', name: 'Seg. Transporte', icon: '📦', color: '#059669' },
  { id: 'caucion', name: 'Caución', icon: '📋', color: '#7c3aed' },
  { id: 'ap', name: 'Acc. Personales', icon: '🛡️', color: '#0284c7' },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function MarketingStudio() {
  const [view, setView] = useState('dashboard');
  const [contenidos, setContenidos] = useState([]);
  const [editingContent, setEditingContent] = useState(null);
  const [selectedRed, setSelectedRed] = useState('instagram');
  const [selectedFormat, setSelectedFormat] = useState('post');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const canvasRef = useRef(null);

  // Estado del editor
  const [editor, setEditor] = useState({
    titulo: '',
    subtitulo: '',
    cuerpo: '',
    cta: 'Cotizá gratis ahora',
    hashtags: ['#seguros', '#AYMA', '#Rosario'],
    producto: PRODUCTOS_SEGUROS[0],
    bgColor: BRAND.colors.primary,
    bgGradient: BRAND.gradients.hero,
    textColor: '#ffffff',
    accentColor: BRAND.colors.cta,
    showLogo: true,
    showDisclaimer: true,
    showIcon: true,
    overlayOpacity: 0.7,
    fontSize: 'large',
    customImage: null,
  });

  // Cargar contenidos reales del backend
  useEffect(() => {
    const cargarDatos = async () => {
      // Intentar cargar dashboard real
      const dashboard = await fetchAPI('/api/v1/marketing/dashboard');
      if (dashboard?.contenidos_recientes) {
        setContenidos(dashboard.contenidos_recientes.map(c => ({
          id: c.id,
          titulo: c.titulo || c.texto?.slice(0, 50) || 'Sin título',
          red: c.red_social || 'instagram',
          formato: c.formato || 'post',
          estado: c.estado || 'pendiente',
          fecha: c.fecha_creacion?.split('T')[0] || new Date().toISOString().split('T')[0],
          categoria: c.categoria || 'educativo',
          token: c.token_marketing || `AYMA-MKT-${c.id}`,
        })));
      }
      // Si no hay backend disponible, cargar pendientes
      if (!dashboard) {
        const pendientes = await fetchAPI('/api/v1/marketing/contenido/pendiente');
        if (pendientes && Array.isArray(pendientes)) {
          setContenidos(pendientes.map(c => ({
            id: c.id,
            titulo: c.titulo || 'Sin título',
            red: c.red_social || 'instagram',
            formato: 'post',
            estado: c.estado || 'pendiente',
            fecha: c.fecha_creacion?.split('T')[0] || new Date().toISOString().split('T')[0],
            categoria: c.categoria || 'educativo',
            token: c.token_marketing || `AYMA-MKT-${c.id}`,
          })));
        }
      }
    };
    cargarDatos();
  }, []);

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Generar contenido con Claude API (via backend)
  const generateContent = async () => {
    setGenerating(true);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const cal = CALENDARIO[dayName] || CALENDARIO.Monday;

    // Intentar generación real via backend
    const result = await fetchAPI('/api/v1/marketing/generar', {
      method: 'POST',
      body: JSON.stringify({
        red_social: selectedRed,
        categoria: cal.tipo,
        producto: editor.producto.name,
        instrucciones: `Generar contenido ${cal.tipo} para ${REDES[selectedRed].name} sobre ${editor.producto.name}. Incluir título, subtítulo, cuerpo y CTA. Estilo AYMA: profesional pero cercano, orientado a Rosario/Argentina.`,
      }),
    });

    if (result?.contenido) {
      // Backend devolvió contenido real generado por IA
      setEditor(prev => ({
        ...prev,
        titulo: result.contenido.titulo || prev.titulo,
        subtitulo: result.contenido.subtitulo || prev.subtitulo,
        cuerpo: result.contenido.texto || result.contenido.cuerpo || prev.cuerpo,
        cta: result.contenido.cta || prev.cta,
        hashtags: result.contenido.hashtags || prev.hashtags,
      }));
      showNotif('Contenido generado por IA (MUSANTE)');
    } else {
      // Fallback: generación local
      const generated = {
        titulo: getRandomTitle(cal.tipo, editor.producto),
        subtitulo: getRandomSubtitle(cal.tipo),
        cuerpo: getRandomBody(cal.tipo, editor.producto),
        cta: getRandomCTA(cal.tipo),
        hashtags: getRandomHashtags(editor.producto),
      };
      setEditor(prev => ({ ...prev, ...generated }));
      showNotif('Contenido generado (modo local)');
    }

    setGenerating(false);
  };

  // Guardar y aprobar contenido (backend real)
  const approveContent = async () => {
    const payload = {
      titulo: editor.titulo,
      texto: editor.cuerpo,
      red_social: selectedRed,
      formato: selectedFormat,
      categoria: selectedTemplate.category,
      cta: editor.cta,
      hashtags: editor.hashtags,
      producto: editor.producto.name,
      subtitulo: editor.subtitulo,
    };

    // 1. Crear contenido en backend
    const created = await fetchAPI('/api/v1/marketing/contenido', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    let token = `AYMA-MKT-${Date.now()}`;

    if (created?.id) {
      // 2. Aprobar inmediatamente
      const approved = await fetchAPI(`/api/v1/marketing/contenido/${created.id}/aprobar`, {
        method: 'POST',
        body: JSON.stringify({ notas_aprobacion: 'Aprobado desde Marketing Studio' }),
      });
      token = approved?.token_marketing || created.token_marketing || token;
    }

    // 3. Actualizar lista local
    const newContent = {
      id: created?.id || Date.now(),
      titulo: editor.titulo,
      red: selectedRed,
      formato: selectedFormat,
      estado: 'aprobado',
      fecha: new Date().toISOString().split('T')[0],
      categoria: selectedTemplate.category,
      token: token,
    };
    setContenidos(prev => [newContent, ...prev]);
    showNotif(`✅ Aprobado — Token: ${token}`);
    setView('dashboard');
  };

  // ============================================
  // RENDER: DASHBOARD
  // ============================================
  if (view === 'dashboard') {
    return (
      <div style={{
        minHeight: '100vh',
        background: BRAND.gradients.dark,
        fontFamily: BRAND.fonts.body,
        color: BRAND.colors.white,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              background: BRAND.gradients.accent,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700,
            }}>A</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Marketing Studio
              </div>
              <div style={{ fontSize: 12, color: BRAND.colors.grayLight }}>
                AYMA Advisors - Editor & Publicador
              </div>
            </div>
          </div>
          <button
            onClick={() => setView('editor')}
            style={{
              background: BRAND.gradients.cta,
              color: BRAND.colors.dark,
              border: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'transform 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            + Crear Contenido
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16, padding: '24px 32px',
        }}>
          {[
            { label: 'Pendientes', value: contenidos.filter(c => c.estado === 'pendiente').length, color: '#f59e0b', icon: '⏳' },
            { label: 'Aprobados', value: contenidos.filter(c => c.estado === 'aprobado').length, color: '#22c55e', icon: '✅' },
            { label: 'Publicados', value: contenidos.filter(c => c.estado === 'publicado').length, color: '#8b5cf6', icon: '📡' },
            { label: 'Este Mes', value: contenidos.length, color: '#3b82f6', icon: '📊' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>{stat.icon}</span>
                <span style={{
                  fontSize: 32, fontWeight: 800, color: stat.color,
                  letterSpacing: '-0.03em',
                }}>{stat.value}</span>
              </div>
              <div style={{ fontSize: 13, color: BRAND.colors.grayLight, marginTop: 8 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Calendario Semanal */}
        <div style={{ padding: '0 32px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: BRAND.colors.grayLight }}>
            Calendario Editorial Semanal
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {Object.entries(CALENDARIO).map(([day, info]) => {
              const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
              return (
                <div key={day} style={{
                  background: isToday ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)',
                  border: isToday ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  const tpl = TEMPLATES.find(t => t.category === info.tipo) || TEMPLATES[0];
                  setSelectedTemplate(tpl);
                  setView('editor');
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'}
                onMouseOut={e => e.currentTarget.style.background = isToday ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)'}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{info.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {day.slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: BRAND.colors.grayLight, marginTop: 4 }}>
                    {info.tema}
                  </div>
                  {isToday && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: BRAND.colors.accent,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>HOY</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista Contenidos */}
        <div style={{ padding: '0 32px 32px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: BRAND.colors.grayLight }}>
            Contenidos Recientes
          </h3>
          {contenidos.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 8,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>{REDES[c.red]?.icon || '📱'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.titulo}</div>
                  <div style={{ fontSize: 11, color: BRAND.colors.grayLight, marginTop: 2 }}>
                    {c.token} · {c.fecha}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  background: c.estado === 'aprobado' ? 'rgba(34,197,94,0.15)' :
                             c.estado === 'publicado' ? 'rgba(139,92,246,0.15)' :
                             'rgba(245,158,11,0.15)',
                  color: c.estado === 'aprobado' ? '#22c55e' :
                         c.estado === 'publicado' ? '#8b5cf6' : '#f59e0b',
                }}>
                  {c.estado.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Notificación */}
        {notification && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: notification.type === 'success' ? '#22c55e' : '#ef4444',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease',
          }}>
            {notification.msg}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: EDITOR
  // ============================================
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0e1a',
      fontFamily: BRAND.fonts.body,
      color: BRAND.colors.white,
      display: 'grid',
      gridTemplateColumns: '320px 1fr 320px',
      gridTemplateRows: 'auto 1fr',
    }}>
      {/* Top Bar */}
      <div style={{
        gridColumn: '1 / -1',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setView('dashboard')}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ← Volver
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {selectedTemplate.name} — {REDES[selectedRed].name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={generateContent}
            disabled={generating}
            style={{
              background: generating ? 'rgba(255,255,255,0.06)' : BRAND.gradients.accent,
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              cursor: generating ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {generating ? '⏳ Generando...' : '🤖 Generar con IA'}
          </button>
          <button
            onClick={approveContent}
            style={{
              background: BRAND.gradients.cta,
              color: BRAND.colors.dark,
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ✅ Aprobar y Publicar
          </button>
        </div>
      </div>

      {/* Panel Izquierdo: Controles */}
      <div style={{
        padding: '16px',
        overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)',
        maxHeight: 'calc(100vh - 52px)',
      }}>
        {/* Red Social */}
        <SectionLabel>Red Social</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16 }}>
          {Object.entries(REDES).map(([key, red]) => (
            <button key={key} onClick={() => { setSelectedRed(key); setSelectedFormat('post'); }}
              style={{
                background: selectedRed === key ? `${red.color}20` : 'rgba(255,255,255,0.03)',
                border: selectedRed === key ? `1px solid ${red.color}60` : '1px solid rgba(255,255,255,0.06)',
                color: selectedRed === key ? red.color : BRAND.colors.grayLight,
                borderRadius: 8, padding: '8px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {red.icon} {red.name}
            </button>
          ))}
        </div>

        {/* Formato */}
        <SectionLabel>Formato</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(REDES[selectedRed].formats).map(([key, fmt]) => (
            <button key={key} onClick={() => setSelectedFormat(key)}
              style={{
                background: selectedFormat === key ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)',
                border: selectedFormat === key ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedFormat === key ? BRAND.colors.accent : BRAND.colors.grayLight,
                borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                fontSize: 11, fontWeight: 500,
              }}
            >
              {fmt.label} ({fmt.w}x{fmt.h})
            </button>
          ))}
        </div>

        {/* Template */}
        <SectionLabel>Template</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
              style={{
                background: selectedTemplate.id === tpl.id ? 'rgba(37,99,235,0.12)' : 'transparent',
                border: selectedTemplate.id === tpl.id ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                color: selectedTemplate.id === tpl.id ? '#fff' : BRAND.colors.grayLight,
                borderRadius: 6, padding: '8px 12px', cursor: 'pointer',
                fontSize: 12, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: selectedTemplate.id === tpl.id ? BRAND.colors.accent : 'rgba(255,255,255,0.2)',
              }} />
              {tpl.name}
            </button>
          ))}
        </div>

        {/* Producto */}
        <SectionLabel>Producto</SectionLabel>
        <select
          value={editor.producto.id}
          onChange={e => setEditor(prev => ({
            ...prev,
            producto: PRODUCTOS_SEGUROS.find(p => p.id === e.target.value) || PRODUCTOS_SEGUROS[0],
          }))}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {PRODUCTOS_SEGUROS.map(p => (
            <option key={p.id} value={p.id} style={{ background: '#1a1a2e' }}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>

        {/* Colores */}
        <SectionLabel>Colores</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 16 }}>
          {['#0f172a', '#1e3a5f', '#1e40af', '#2563eb', '#60a5fa', '#f59e0b',
            '#22c55e', '#ef4444', '#8b5cf6', '#0d9488', '#dc2626', '#ffffff'].map(c => (
            <button key={c} onClick={() => setEditor(prev => ({ ...prev, bgColor: c }))}
              style={{
                width: 32, height: 32,
                background: c,
                border: editor.bgColor === c ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Toggles */}
        <SectionLabel>Opciones</SectionLabel>
        {[
          { key: 'showLogo', label: 'Mostrar Logo' },
          { key: 'showDisclaimer', label: 'Disclaimer SSN' },
          { key: 'showIcon', label: 'Icono Producto' },
        ].map(({ key, label }) => (
          <div key={key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0',
          }}>
            <span style={{ fontSize: 12, color: BRAND.colors.grayLight }}>{label}</span>
            <button
              onClick={() => setEditor(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{
                width: 38, height: 20,
                background: editor[key] ? BRAND.colors.accent : 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16,
                background: '#fff',
                borderRadius: '50%',
                position: 'absolute',
                top: 2,
                left: editor[key] ? 20 : 2,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* Centro: Canvas Preview */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
        overflow: 'auto',
      }}>
        <CanvasPreview
          ref={canvasRef}
          editor={editor}
          template={selectedTemplate}
          red={selectedRed}
          format={REDES[selectedRed].formats[selectedFormat]}
          brand={BRAND}
        />
      </div>

      {/* Panel Derecho: Texto */}
      <div style={{
        padding: '16px',
        overflowY: 'auto',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)',
        maxHeight: 'calc(100vh - 52px)',
      }}>
        <SectionLabel>Título</SectionLabel>
        <textarea
          value={editor.titulo}
          onChange={e => setEditor(prev => ({ ...prev, titulo: e.target.value }))}
          placeholder="Título principal del post..."
          rows={2}
          style={textareaStyle}
        />

        <SectionLabel>Subtítulo</SectionLabel>
        <textarea
          value={editor.subtitulo}
          onChange={e => setEditor(prev => ({ ...prev, subtitulo: e.target.value }))}
          placeholder="Subtítulo o descripción breve..."
          rows={2}
          style={textareaStyle}
        />

        <SectionLabel>Texto del Post ({editor.cuerpo.length}/{REDES[selectedRed].maxChars})</SectionLabel>
        <textarea
          value={editor.cuerpo}
          onChange={e => {
            if (e.target.value.length <= REDES[selectedRed].maxChars)
              setEditor(prev => ({ ...prev, cuerpo: e.target.value }));
          }}
          placeholder="Texto completo para la publicación..."
          rows={6}
          style={textareaStyle}
        />

        <SectionLabel>CTA (Call to Action)</SectionLabel>
        <input
          value={editor.cta}
          onChange={e => setEditor(prev => ({ ...prev, cta: e.target.value }))}
          style={{ ...textareaStyle, height: 'auto', padding: '8px 12px' }}
        />

        <SectionLabel>Hashtags</SectionLabel>
        <input
          value={editor.hashtags.join(' ')}
          onChange={e => setEditor(prev => ({
            ...prev,
            hashtags: e.target.value.split(' ').filter(h => h.startsWith('#') || h === ''),
          }))}
          placeholder="#seguros #AYMA #Rosario"
          style={{ ...textareaStyle, height: 'auto', padding: '8px 12px' }}
        />
        <div style={{ fontSize: 10, color: BRAND.colors.grayLight, marginTop: 4 }}>
          {editor.hashtags.length}/{REDES[selectedRed].maxHashtags} hashtags
        </div>

        {/* Copy Button */}
        <button
          onClick={() => {
            const fullText = `${editor.titulo}\n\n${editor.cuerpo}\n\n${editor.cta}\n\n${editor.hashtags.join(' ')}\n\n${BRAND.disclaimer}`;
            navigator.clipboard?.writeText(fullText);
            showNotif('Texto copiado al portapapeles');
          }}
          style={{
            width: '100%',
            marginTop: 16,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '10px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          📋 Copiar Texto Completo
        </button>

        {/* Preview multi-red */}
        <SectionLabel style={{ marginTop: 20 }}>Preview por Red</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(REDES).map(([key, red]) => (
            <button key={key} onClick={() => setSelectedRed(key)}
              style={{
                background: selectedRed === key ? `${red.color}15` : 'transparent',
                border: `1px solid ${selectedRed === key ? red.color + '40' : 'rgba(255,255,255,0.06)'}`,
                color: '#fff',
                borderRadius: 6, padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{red.icon} {red.name}</span>
              <span style={{ color: BRAND.colors.grayLight, fontSize: 10 }}>
                {editor.cuerpo.length}/{red.maxChars}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notificación */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: notification.type === 'success' ? '#22c55e' : '#ef4444',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 13,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          zIndex: 999,
        }}>
          {notification.msg}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ============================================
// CANVAS PREVIEW COMPONENT
// ============================================
const CanvasPreview = React.forwardRef(({ editor, template, red, format, brand }, ref) => {
  const scale = Math.min(480 / format.w, 600 / format.h);
  const w = format.w * scale;
  const h = format.h * scale;

  const bgStyle = {
    'gradient-dark': brand.gradients.hero,
    'gradient-accent': brand.gradients.accent,
    'gradient-hero': brand.gradients.dark,
    'solid-white': '#ffffff',
  }[template.bgStyle] || brand.gradients.hero;

  const textColor = template.bgStyle === 'solid-white' ? brand.colors.dark : '#ffffff';

  return (
    <div ref={ref} style={{
      width: w,
      height: h,
      background: bgStyle,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: w * 0.06,
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 80% 20%, ${brand.colors.accent}15 0%, transparent 50%),
                     radial-gradient(circle at 20% 80%, ${brand.colors.primary}20 0%, transparent 50%)`,
        pointerEvents: 'none',
      }} />

      {/* Top: Logo + Tag */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 2,
      }}>
        {editor.showLogo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: w * 0.065,
              height: w * 0.065,
              background: 'linear-gradient(135deg, #1e40af, #60a5fa)',
              borderRadius: w * 0.012,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: w * 0.03,
              fontWeight: 900,
              color: '#fff',
            }}>A</div>
            <div>
              <div style={{
                fontSize: w * 0.025,
                fontWeight: 800,
                color: textColor,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}>AYMA</div>
              <div style={{
                fontSize: w * 0.015,
                color: brand.colors.accent,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>SEGUROS</div>
            </div>
          </div>
        )}
        {template.elements.hasTag && (
          <div style={{
            background: brand.colors.cta,
            color: brand.colors.dark,
            padding: `${w * 0.008}px ${w * 0.02}px`,
            borderRadius: w * 0.008,
            fontSize: w * 0.02,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {template.category}
          </div>
        )}
      </div>

      {/* Middle: Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        gap: h * 0.02,
      }}>
        {editor.showIcon && (
          <div style={{ fontSize: w * 0.08, marginBottom: h * 0.01 }}>
            {editor.producto.icon}
          </div>
        )}

        {editor.titulo && (
          <div style={{
            fontSize: w * 0.055,
            fontWeight: 900,
            color: textColor,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            maxWidth: '90%',
          }}>
            {editor.titulo}
          </div>
        )}

        {editor.subtitulo && (
          <div style={{
            fontSize: w * 0.028,
            color: template.bgStyle === 'solid-white' ? brand.colors.gray : `${textColor}cc`,
            lineHeight: 1.4,
            maxWidth: '80%',
          }}>
            {editor.subtitulo}
          </div>
        )}

        {template.elements.hasCTA && editor.cta && (
          <div style={{ marginTop: h * 0.02 }}>
            <span style={{
              background: brand.colors.cta,
              color: brand.colors.dark,
              padding: `${w * 0.015}px ${w * 0.04}px`,
              borderRadius: w * 0.06,
              fontSize: w * 0.025,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              display: 'inline-block',
            }}>
              {editor.cta} →
            </span>
          </div>
        )}

        {template.elements.hasStats && (
          <div style={{
            display: 'flex', gap: w * 0.04, marginTop: h * 0.02,
          }}>
            {[
              { n: '17+', l: 'Años' },
              { n: '1200+', l: 'Clientes' },
              { n: '35%', l: 'Ahorro' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{
                  fontSize: w * 0.04, fontWeight: 900, color: brand.colors.cta,
                  letterSpacing: '-0.02em',
                }}>{s.n}</div>
                <div style={{
                  fontSize: w * 0.015, color: `${textColor}99`,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {template.elements.hasQuote && editor.cuerpo && (
          <div style={{
            fontSize: w * 0.03,
            fontStyle: 'italic',
            color: textColor,
            lineHeight: 1.5,
            borderLeft: `3px solid ${brand.colors.cta}`,
            paddingLeft: w * 0.03,
            maxWidth: '85%',
          }}>
            "{editor.cuerpo.slice(0, 150)}"
          </div>
        )}

        {template.elements.hasBenefits && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: h * 0.012 }}>
            {['Cobertura integral para tu equipo', 'Cumplimiento normativo SRT', 'Gestión de siniestros 24/7'].map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: w * 0.02,
                fontSize: w * 0.022, color: textColor,
              }}>
                <span style={{
                  width: w * 0.025, height: w * 0.025,
                  background: brand.colors.cta,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: w * 0.014, color: brand.colors.dark,
                  fontWeight: 700, flexShrink: 0,
                }}>✓</span>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Disclaimer */}
      {editor.showDisclaimer && (
        <div style={{
          position: 'relative',
          zIndex: 2,
          fontSize: w * 0.014,
          color: template.bgStyle === 'solid-white' ? `${brand.colors.gray}99` : 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          letterSpacing: '0.03em',
          paddingTop: h * 0.01,
          borderTop: `1px solid ${template.bgStyle === 'solid-white' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          {brand.disclaimer}
        </div>
      )}

      {/* Corner decoration */}
      <div style={{
        position: 'absolute',
        bottom: 0, right: 0,
        width: w * 0.3, height: w * 0.3,
        background: `radial-gradient(circle at 100% 100%, ${brand.colors.accent}10, transparent 70%)`,
        pointerEvents: 'none',
      }} />
    </div>
  );
});

// ============================================
// HELPERS
// ============================================
const SectionLabel = ({ children, style }) => (
  <div style={{
    fontSize: 11,
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    marginTop: 4,
    ...style,
  }}>{children}</div>
);

const textareaStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 13,
  resize: 'vertical',
  marginBottom: 12,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

// Content generators (fallback local cuando backend no responde)
function getRandomTitle(tipo, producto) {
  const titles = {
    educativo: [
      `${producto.icon} ¿Sabías esto sobre tu ${producto.name}?`,
      `5 errores al elegir ${producto.name.toLowerCase()}`,
      `Lo que nadie te dice sobre ${producto.name.toLowerCase()}`,
    ],
    comercial: [
      `${producto.icon} ${producto.name}: protección real`,
      `Cotizá tu ${producto.name.toLowerCase()} sin compromiso`,
      `Nuevo plan ${producto.name} con 35% de ahorro`,
    ],
    testimonial: [
      `"AYMA cambió la forma en que veo los seguros"`,
      `Historia real: cómo ${producto.name.toLowerCase()} salvó el día`,
    ],
    noticia: [
      `Novedades del sector asegurador argentino`,
      `Cambios normativos SSN: lo que debés saber`,
    ],
    institucional: [
      `17 años gestionando riesgos en Rosario`,
      `AYMA Advisors: tu socio en protección`,
    ],
  };
  const list = titles[tipo] || titles.educativo;
  return list[Math.floor(Math.random() * list.length)];
}

function getRandomSubtitle(tipo) {
  const subs = {
    educativo: 'Te compartimos información clave para tomar mejores decisiones.',
    comercial: 'Elegí la cobertura que se adapta a tu realidad.',
    testimonial: 'Nuestros clientes son nuestra mejor carta de presentación.',
    noticia: 'Mantente informado con las últimas novedades del mercado.',
    institucional: 'Gestores de Riesgos desde 2008.',
  };
  return subs[tipo] || subs.educativo;
}

function getRandomBody(tipo, producto) {
  const bodies = {
    educativo: `Muchas personas eligen su ${producto.name.toLowerCase()} solo por precio. Pero hay factores críticos que podés estar pasando por alto.\n\nEn AYMA Advisors te ayudamos a entender qué cobertura realmente necesitás, sin letra chica ni sorpresas.\n\nConsultá sin compromiso.`,
    comercial: `Protegé lo que más importa con ${producto.name} de AYMA Advisors.\n\nComparamos las mejores opciones del mercado para que vos elijas con información clara y transparente.\n\nCotización en menos de 24 horas.`,
    testimonial: `Hace 3 años que confío en AYMA para todos mis seguros. La diferencia está en el asesoramiento personalizado y la respuesta rápida ante cualquier situación.`,
    noticia: `El mercado asegurador argentino atraviesa cambios importantes. Te contamos las novedades que pueden impactar en tus coberturas actuales.`,
    institucional: `Desde 2008, AYMA Advisors gestiona riesgos con un enfoque integral. No vendemos seguros: asesoramos para que cada cliente tenga la protección que realmente necesita.`,
  };
  return bodies[tipo] || bodies.educativo;
}

function getRandomCTA(tipo) {
  const ctas = {
    educativo: 'Conocé más →',
    comercial: 'Cotizá gratis ahora',
    testimonial: 'Sumate a AYMA',
    noticia: 'Leé la nota completa',
    institucional: 'Conocenos',
  };
  return ctas[tipo] || 'Consultá sin compromiso';
}

function getRandomHashtags(producto) {
  const base = ['#AYMA', '#Seguros', '#Rosario'];
  const specific = {
    auto: ['#SeguroAuto', '#Automotor'],
    hogar: ['#SeguroHogar', '#Vivienda'],
    art: ['#ART', '#RiesgosTrabajo', '#PYME'],
    vida: ['#SeguroVida', '#Protección'],
    comercio: ['#Comercio', '#PYME'],
    moto: ['#SeguroMoto', '#Moto'],
    flota: ['#Flota', '#Transporte'],
    rc: ['#ResponsabilidadCivil', '#RC'],
    incendio: ['#Incendio', '#Patrimonio'],
    transporte: ['#Transporte', '#Logística'],
    caucion: ['#Caución', '#Garantía'],
    ap: ['#AccidentesPersonales', '#Protección'],
  };
  return [...base, ...(specific[producto.id] || ['#GestiónDeRiesgos'])];
}
