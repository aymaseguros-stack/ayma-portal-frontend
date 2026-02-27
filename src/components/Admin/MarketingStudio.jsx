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
// ICONOGRAFÍA SVG PROFESIONAL (Heroicons-style)
// Consistente con landing page aymaseguros.com.ar
// ============================================
const SvgIcon = ({ d, size = 20, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

// UI Icons (Heroicons outline)
const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  editor: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  ai: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  send: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  money: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  newspaper: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
};

// Redes Sociales - SVG Brand Icons
const SocialIcon = ({ red, size = 20 }) => {
  const paths = {
    instagram: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>,
    facebook: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>,
    linkedin: <><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></>,
    x_twitter: <path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M20 4l-6.768 6.768"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {paths[red]}
    </svg>
  );
};

// Product Icon - renders PNG from /icons/ folder
const ProductIcon = ({ productId, size = 32 }) => {
  const iconMap = {
    auto: '/icons/icons500x500_vehiculo.png',
    hogar: '/icons/icons500x500_vivienda.png',
    art: '/icons/seguroart.png',
    vida: '/icons/Segurodevida.png',
    comercio: '/icons/seguros_integral.png',
    moto: '/icons/icons500x500_vehiculo.png',
    flota: '/icons/seguros_transporte.png',
    rc: '/icons/seguros_responsabilidadcivil.png',
    incendio: '/icons/icons500x500_incendio.png',
    transporte: '/icons/seguros_transporte.png',
    caucion: '/icons/seguros_caucion.png',
    ap: '/icons/accidentespersonales.png',
  };
  const src = iconMap[productId];
  if (!src) return <SvgIcon d={ICONS.tag} size={size} />;
  return <img src={src} alt={productId} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover' }} />;
};

// ============================================
// CONFIGURACIÓN REDES SOCIALES
// ============================================
const REDES = {
  instagram: {
    name: 'Instagram',
    icon: 'instagram',
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
    icon: 'facebook',
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
    icon: 'linkedin',
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
    icon: 'x_twitter',
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
  Monday: { tipo: 'educativo', tema: 'Tips de seguros', iconKey: 'book' },
  Tuesday: { tipo: 'testimonial', tema: 'Historias de clientes', iconKey: 'star' },
  Wednesday: { tipo: 'comercial', tema: 'Promoción producto', iconKey: 'money' },
  Thursday: { tipo: 'noticia', tema: 'Noticias del sector', iconKey: 'newspaper' },
  Friday: { tipo: 'institucional', tema: 'AYMA marca', iconKey: 'building' },
};

const PRODUCTOS_SEGUROS = [
  { id: 'auto', name: 'Seguro Automotor', color: '#3b82f6' },
  { id: 'hogar', name: 'Seguro Hogar', color: '#22c55e' },
  { id: 'art', name: 'ART Empresas', color: '#f59e0b' },
  { id: 'vida', name: 'Seguro de Vida', color: '#ef4444' },
  { id: 'comercio', name: 'Integral Comercio', color: '#8b5cf6' },
  { id: 'moto', name: 'Seguro Moto', color: '#06b6d4' },
  { id: 'flota', name: 'Flota Vehicular', color: '#0d9488' },
  { id: 'rc', name: 'Resp. Civil', color: '#6366f1' },
  { id: 'incendio', name: 'Seg. Incendio', color: '#dc2626' },
  { id: 'transporte', name: 'Seg. Transporte', color: '#059669' },
  { id: 'caucion', name: 'Caución', color: '#7c3aed' },
  { id: 'ap', name: 'Acc. Personales', color: '#0284c7' },
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
    showNotif(`Aprobado — Token: ${token}`);
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
            { label: 'Pendientes', value: contenidos.filter(c => c.estado === 'pendiente').length, color: '#f59e0b', iconKey: 'clock' },
            { label: 'Aprobados', value: contenidos.filter(c => c.estado === 'aprobado').length, color: '#22c55e', iconKey: 'check' },
            { label: 'Publicados', value: contenidos.filter(c => c.estado === 'publicado').length, color: '#8b5cf6', iconKey: 'send' },
            { label: 'Este Mes', value: contenidos.length, color: '#3b82f6', iconKey: 'chart' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: stat.color }}><SvgIcon d={ICONS[stat.iconKey]} size={24} /></span>
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
                  <div style={{ marginBottom: 6, color: '#3b82f6' }}><SvgIcon d={ICONS[info.iconKey]} size={22} /></div>
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
                <span style={{ color: REDES[c.red]?.color || '#666' }}><SocialIcon red={c.red} size={22} /></span>
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
            {generating ? 'Generando...' : <><SvgIcon d={ICONS.sparkles} size={16} /> Generar con IA</>}
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
            <><SvgIcon d={ICONS.check} size={16} /> Aprobar y Publicar</>
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
              <SocialIcon red={key} size={16} /> {red.name}
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
              {p.name}
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
          <><SvgIcon d={ICONS.copy} size={16} /> Copiar Texto Completo</>
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
              <span style={{display:"flex",alignItems:"center",gap:6}}><SocialIcon red={key} size={14} /> {red.name}</span>
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
        {editor.showIcon && editor.producto && (
          <div style={{ marginBottom: h * 0.01 }}>
            <ProductIcon productId={editor.producto.id} size={Math.round(w * 0.12)} />
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
      `¿Sabías esto sobre tu ${producto.name}?`,
      `5 errores al elegir ${producto.name.toLowerCase()}`,
      `Lo que nadie te dice sobre ${producto.name.toLowerCase()}`,
    ],
    comercial: [
      `${producto.name}: protección real`,
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
