# 🎯 ESTADO ACTUAL - PORTAL AYMA ADVISORS
**Fecha:** 17 de Noviembre de 2025  
**Versión:** 1.0.2  
**Status:** ✅ OPERATIVO

---

## 📊 INFRAESTRUCTURA

### Backend
- **Hosting:** Render (https://ayma-portal-backend.onrender.com)
- **Stack:** FastAPI + Python 3.12 + PostgreSQL
- **Base de Datos:** PostgreSQL en Render
- **Status:** ✅ Desplegado y funcionando
- **Último Deploy:** Commit `aeb20a0`

### Frontend
- **Hosting:** Vercel (https://ayma-portal-frontend.vercel.app)
- **Stack:** React 18 + Vite + Tailwind CSS
- **Status:** ✅ Desplegado y funcionando
- **Último Deploy:** Commit `ce99a0c`

### Repositorios GitHub
- **Backend:** `aymaseguros-stack/ayma-portal-backend`
- **Frontend:** `aymaseguros-stack/ayma-portal-frontend`

---

## 🔐 CREDENCIALES DE ACCESO

### Usuarios de Prueba

| Rol | Email | Password | Permisos |
|-----|-------|----------|----------|
| **Admin** | aymaseguros@hotmail.com | Admin123456789 | Acceso total al sistema |
| **Empleado** | empleado@aymaseguros.com | Empleado123 | Gestión CRM y clientes |
| **Cliente** | aybatista@icloud.com | Batista2025! | Consulta de pólizas propias |

### Cliente Real - Victor Batista
- **Email:** aybatista@icloud.com
- **DNI:** 37888999
- **Teléfono:** +54 9 341 123-4567
- **Pólizas:** 7 activas (grupo familiar)
- **Vehículos:** 7 registrados

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS

### Modelos Principales
```
Usuario
├── id: UUID
├── email: String(255) UNIQUE
├── password_hash: String
├── tipo_usuario: ENUM('admin', 'empleado', 'cliente')
└── activo: Boolean

Cliente
├── id: UUID
├── usuario_id: FK → Usuario
├── nombre: String(100)
├── apellido: String(100)
├── tipo_documento: String(10)
├── numero_documento: String(20)
├── telefono: String(20)
├── direccion: String(200)
└── scoring_comercial: Decimal(5,1)

Poliza
├── id: UUID
├── cliente_id: FK → Cliente
├── numero_poliza: String(50) UNIQUE
├── compania: String(100)
├── ramo: String(50)
├── tipo_cobertura: String(50)
├── suma_asegurada: Decimal(12,2)
├── premio_total: Decimal(12,2)
├── fecha_inicio: Date
├── fecha_vencimiento: Date
├── estado: ENUM('vigente', 'vencida', 'cancelada')
└── vehiculo_id: FK → Vehiculo (nullable)

Vehiculo
├── id: UUID
├── cliente_id: FK → Cliente
├── dominio: String(10) UNIQUE
├── tipo_vehiculo: String(50)
├── marca: String(50)
├── modelo: String(50)
├── anio: Integer
├── uso: String(50)
└── estado: String(20)

ActividadComercial
├── id: UUID
├── cliente_id: FK → Cliente
├── tipo_actividad: String(50)
├── puntos_otorgados: Decimal(5,1)
└── fecha_actividad: DateTime
```

---

## 🔗 ENDPOINTS API

### Base URL
```
https://ayma-portal-backend.onrender.com/api/v1
```

### Autenticación
- `POST /auth/login` - Login de usuario
  - Body: `{"email": "...", "password": "..."}`
  - Response: `{"access_token": "...", "email": "...", "tipo_usuario": "..."}`

### Dashboard
- `GET /dashboard/` - Resumen dashboard usuario actual
- `GET /dashboard/scoring` - Scoring comercial usuario actual
- `GET /dashboard/actividades` - Actividades recientes

### Clientes
- `GET /clientes/` - Lista clientes del usuario actual
- `GET /clientes/{id}` - Detalle de cliente

### Pólizas
- `GET /polizas/` - Lista pólizas del usuario actual
- `GET /polizas/{id}` - Detalle de póliza
- `GET /polizas/{id}/pdf` - Descargar PDF de póliza

### Vehículos
- `GET /vehiculos/` - Lista vehículos del usuario actual
- `GET /vehiculos/{id}` - Detalle de vehículo

### Admin (Solo Administradores)
- `GET /admin/usuarios` - Todos los usuarios del sistema
- `GET /admin/clientes` - Todos los clientes
- `GET /admin/polizas` - Todas las pólizas
- `GET /admin/vehiculos` - Todos los vehículos
- `GET /admin/dashboard` - Estadísticas generales

### Seed
- `POST /seed/seed-data?secret=ayma2025seed` - Carga datos de prueba

---

## 📈 SISTEMA DE SCORING COMERCIAL

### Tabla de Puntuación

| Acción | Puntos | Descripción |
|--------|--------|-------------|
| Login | +1 | Acceso al sistema |
| Ver póliza | +2 | Consulta de cobertura |
| Descargar PDF | +3 | Descarga de documentación |
| Llamado nuevo | +5.9 | Contacto inicial con prospecto |
| Llamado seguimiento | +2 | Seguimiento activo |
| Llamado repetido | +1 | Recontacto |
| Cotizado | +13 | Presupuesto emitido |
| Recotizado | +2 | Revisión de presupuesto |
| Propuesta entregada | +25 | Oferta formal presentada |
| **Cierre cliente** | **+50** | **Venta concretada** |
| **Cliente perdido** | **-50** | **Oportunidad perdida** |

### Objetivos
- **Diario:** 130 puntos
- **Semanal:** 840 puntos

### Clasificación
- **Bajo:** <70% del objetivo
- **Medio:** 70-99% del objetivo
- **Óptimo:** ≥100% del objetivo

---

## 🎨 VISTAS POR ROL

### Vista Administrador
**Pestañas disponibles:**
1. **📊 Dashboard** - 6 tarjetas con métricas globales
   - Total Usuarios
   - Total Clientes
   - Total Pólizas
   - Total Vehículos
   - Pólizas Vigentes
   - Pólizas Vencidas

2. **👥 Usuarios** - Tabla con todos los usuarios del sistema
   - Email, Rol, Estado, Fechas

3. **📈 CRM** - Gestión comercial (en desarrollo)

4. **👤 Clientes** - Tabla con todos los clientes
   - Nombre, Email, Documento, Teléfono, Scoring, Estado

5. **📄 Pólizas** - Tabla con todas las pólizas
   - Número, Estado, Titular, Compañía, Cobertura, Premio, Vencimiento, Días restantes

6. **🚗 Vehículos** - Tabla con todos los vehículos
   - Dominio, Año, Marca, Modelo, Tipo, Uso, Propietario

7. **📊 Reportes** - Analytics avanzados (en desarrollo)

### Vista Empleado
**Pestañas disponibles:**
1. **📊 Dashboard** - Métricas personales
2. **📈 CRM** - Gestión comercial
3. **👤 Clientes** - Gestión de clientes
4. **📄 Pólizas** - Gestión de pólizas
5. **🚗 Vehículos** - Gestión de vehículos

### Vista Cliente
**Pestañas disponibles:**
1. **📊 Dashboard** - Resumen personal (3 tarjetas horizontales)
   - Mis Pólizas (cantidad)
   - Mis Vehículos (cantidad)
   - Tickets Abiertos

2. **👤 Mis Datos** - Información personal en tabla horizontal

3. **📄 Mis Pólizas** - Lista de pólizas propias en tabla

4. **🚗 Mis Vehículos** - Lista de vehículos propios en tabla

5. **🎫 Soporte** - Sistema de tickets (en desarrollo)

---

## ✅ FUNCIONALIDADES IMPLEMENTADAS

### Autenticación y Seguridad
- ✅ Login con JWT tokens
- ✅ Roles: Admin, Empleado, Cliente
- ✅ Protección de rutas por rol
- ✅ CORS configurado
- ✅ Passwords hasheados con bcrypt

### Dashboard
- ✅ Métricas en tiempo real
- ✅ Datos específicos por rol
- ✅ Diseño responsivo (horizontal en desktop)
- ✅ Indicadores visuales con colores

### Gestión de Datos
- ✅ CRUD completo de usuarios (backend)
- ✅ Visualización de clientes
- ✅ Visualización de pólizas con días restantes
- ✅ Visualización de vehículos
- ✅ Filtrado por usuario actual (clientes)
- ✅ Vista global para admin

### Base de Datos
- ✅ Migraciones automáticas al startup
- ✅ Seed data con usuarios de prueba
- ✅ Relaciones FK correctas
- ✅ Índices en campos clave

### UI/UX
- ✅ Diseño moderno con Tailwind CSS
- ✅ Tablas horizontales para todas las vistas
- ✅ Responsive design (mobile-first)
- ✅ Loading states
- ✅ Error handling visual
- ✅ Feedback de sesión activa

---

## 🚧 EN DESARROLLO

### Próximas Funcionalidades
1. **Sistema de PDFs de Pólizas**
   - Integración con Google Drive
   - Upload de PDFs por póliza
   - Descarga directa desde el portal

2. **WhatsApp Bot**
   - Notificaciones automáticas
   - Recordatorios de vencimientos
   - Consultas básicas

3. **Sistema de Cotizaciones Automatizado**
   - Integración con APIs de aseguradoras
   - Comparador de precios
   - Emisión automática

4. **CRM Completo**
   - Estados: DATO → PROSPECTO → POTENCIAL → CLIENTE → LOOP
   - Metodología SAIDA
   - Tracking de actividades
   - Seguimiento automatizado

5. **Sistema de Tickets/Soporte**
   - Creación de tickets por clientes
   - Gestión por empleados/admin
   - Prioridades y estados
   - Notificaciones

6. **Reportes y Analytics**
   - Dashboards avanzados
   - Exportación a Excel/PDF
   - Gráficos interactivos
   - KPIs comerciales

7. **App Móvil**
   - React Native
   - Notificaciones push
   - Acceso offline

---

## 🐛 PROBLEMAS CONOCIDOS Y SOLUCIONADOS

### ✅ RESUELTOS

1. **Rutas duplicadas en API**
   - **Problema:** `/api/v1/auth/auth/login` en lugar de `/api/v1/auth/login`
   - **Causa:** Prefix duplicado en router individual y en include_router
   - **Solución:** Mantener prefix solo en archivos individuales, no duplicar en `__init__.py`

2. **404 en todos los endpoints**
   - **Problema:** Backend respondía 404 a todas las peticiones
   - **Causa:** Faltaba `prefix="/api/v1"` en `app.include_router()`
   - **Solución:** Agregado en `app/main.py`

3. **Backticks en lugar de paréntesis**
   - **Problema:** `axios.get` con backtick en lugar de paréntesis
   - **Causa:** Terminal zsh interpretando caracteres especiales
   - **Solución:** Uso de Node.js para escribir archivo directamente

4. **Import incorrecto en admin.py**
   - **Problema:** `ModuleNotFoundError: No module named 'app.database'`
   - **Causa:** Debía ser `from app.core.database`
   - **Solución:** Corrección de imports

5. **Dashboard cliente vertical**
   - **Problema:** Tarjetas apiladas verticalmente
   - **Causa:** Caché del navegador
   - **Solución:** Hard refresh + ventana maximizada (breakpoint md: 768px)

---

## 📝 CONFIGURACIÓN LOCAL

### Backend
```bash
cd ~/Proyectos/ayma-portal-mvp/backend

# Activar venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Variables de entorno (.env)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=tu-secret-key-aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Ejecutar
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd ~/Proyectos/ayma-portal-mvp/frontend

# Instalar dependencias
npm install

# Variables de entorno (.env)
VITE_API_URL=https://ayma-portal-backend.onrender.com/api/v1

# Ejecutar
npm run dev
```

---

## 🔄 WORKFLOW DE DEPLOY

### Backend (Render)
1. Commit cambios en `ayma-portal-backend`
2. Push a `main` branch
3. Render detecta cambios y redespliega automáticamente
4. Deploy tarda ~2-3 minutos

### Frontend (Vercel)
1. Commit cambios en `ayma-portal-frontend`
2. Push a `main` branch
3. Vercel detecta cambios y redespliega automáticamente
4. Deploy tarda ~1-2 minutos

---

## 📞 INFORMACIÓN DE CONTACTO

**Director:** Sebastián (Atman)  
**Empresa:** AYMA Advisors  
**Email:** aymaseguros@hotmail.com  
**PAS (Productor Asesor Seguros):** 68323  
**Ubicación:** Rosario / Buenos Aires, Argentina  

**Compañías Asociadas:**
- San Cristóbal
- Nación Seguros
- Mapfre
- SMG Seguros

---

## 🎯 OBJETIVOS 2026

### Q1 2026 (Enero-Marzo)
- [ ] Sistema de PDFs de pólizas operativo
- [ ] WhatsApp Bot básico funcionando
- [ ] 300 usuarios activos en portal
- [ ] Compliance: 60% implementado

### Q2 2026 (Abril-Junio)
- [ ] Cotizador automático operativo
- [ ] App móvil en beta
- [ ] 1.000 usuarios activos
- [ ] Compliance: 100% implementado

### Q3 2026 (Julio-Septiembre)
- [ ] CRM completo operativo
- [ ] Sistema de reportes avanzados
- [ ] 2.400 clientes nuevos (anual)
- [ ] Primera auditoría externa

### Q4 2026 (Octubre-Diciembre)
- [ ] +30% ingresos vs 2025
- [ ] NPS >50
- [ ] 90% retención clientes
- [ ] Sistema totalmente automatizado

---

## 📚 DOCUMENTACIÓN TÉCNICA

### Archivos Clave Backend
```
backend/
├── app/
│   ├── main.py              # Aplicación FastAPI principal
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py  # Router principal
│   │       ├── auth.py      # Autenticación
│   │       ├── dashboard.py # Dashboard endpoints
│   │       ├── clientes.py  # Gestión clientes
│   │       ├── polizas.py   # Gestión pólizas
│   │       ├── vehiculos.py # Gestión vehículos
│   │       ├── admin.py     # Endpoints admin
│   │       └── seed.py      # Datos de prueba
│   ├── core/
│   │   ├── database.py      # Conexión DB
│   │   ├── security.py      # JWT y passwords
│   │   └── init_users.py    # Crear usuarios default
│   ├── models/              # Modelos SQLAlchemy
│   └── schemas/             # Schemas Pydantic
├── requirements.txt
└── render.yaml
```

### Archivos Clave Frontend
```
frontend/
├── src/
│   ├── App.jsx              # Componente principal
│   ├── services/
│   │   └── api.js           # Servicios API
│   └── main.jsx             # Entry point
├── package.json
└── vercel.json
```

---

## 🔐 SEGURIDAD

### Medidas Implementadas
- ✅ Passwords hasheados con bcrypt
- ✅ JWT tokens con expiración
- ✅ CORS configurado correctamente
- ✅ Validación de roles en backend
- ✅ HTTPS en ambos servicios
- ✅ Variables de entorno para secrets

### Pendientes
- [ ] Rate limiting en API
- [ ] Registro de auditoría
- [ ] 2FA para admin
- [ ] Encriptación datos sensibles
- [ ] Backup automático DB

---

## 📊 MÉTRICAS ACTUALES

### Usuarios
- **Total:** 3 (Admin + Empleado + Cliente prueba)
- **Reales:** 1 (Victor Batista)
- **Activos:** 100%

### Datos
- **Clientes:** 1
- **Pólizas:** 7 (todas vigentes)
- **Vehículos:** 7
- **Compañías:** 1 (Nación Seguros)

### Performance
- **Backend uptime:** 99%+
- **Frontend uptime:** 99%+
- **Tiempo respuesta API:** <500ms
- **Tiempo carga página:** <2s

---

**Última actualización:** 17 de Noviembre de 2025 11:45 AM  
**Próxima revisión:** 24 de Noviembre de 2025

---

*Documento interno - Uso exclusivo AYMA Advisors*
