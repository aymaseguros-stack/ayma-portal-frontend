import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronUp, ChevronDown, Eye, Edit, Phone, Mail, FileText, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';

const AdminPanel = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ campo: 'nombre', direccion: 'asc' });
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [metricas, setMetricas] = useState(null);
  const [vencimientos, setVencimientos] = useState([]);
  const [vista, setVista] = useState('clientes'); // clientes, metricas, vencimientos, leads
  const [leads, setLeads] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Cargar clientes
      const resClientes = await fetch(
        `${API_URL}/api/v1/admin/clientes?orden=${orden.campo}&direccion=${orden.direccion}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (resClientes.ok) {
        const data = await resClientes.json();
        setClientes(data);
      }

      // Cargar mÃ©tricas
      const resMetricas = await fetch(`${API_URL}/api/v1/admin/metricas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (resMetricas.ok) {
        const data = await resMetricas.json();
        setMetricas(data);
      }

      // Cargar leads
      const resLeads = await fetch(`${API_URL}/api/v1/leads/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resLeads.ok) {
        const data = await resLeads.json();
        setLeads(data);
      }

      // Cargar vencimientos
      const resVencimientos = await fetch(`${API_URL}/api/v1/admin/vencimientos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (resVencimientos.ok) {
        const data = await resVencimientos.json();
        setVencimientos(data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarClientes = async () => {
    if (!busqueda.trim()) {
      cargarDatos();
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/v1/admin/clientes?busqueda=${encodeURIComponent(busqueda)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setClientes(data);
      }
    } catch (error) {
      console.error('Error buscando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const verDetalleCliente = async (clienteId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/clientes/${clienteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setClienteSeleccionado(data);
        setMostrarDetalle(true);
      }
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      setLoading(false);
    }
  };

  const registrarActividad = async (clienteId, tipoActividad) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/clientes/${clienteId}/actividad`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_actividad: tipoActividad,
          descripcion: `Actividad registrada desde panel admin`
        })
      });
      
      if (res.ok) {
        alert('Actividad registrada exitosamente');
        verDetalleCliente(clienteId); // Recargar detalle
        cargarDatos(); // Recargar lista
      }
    } catch (error) {
      console.error('Error registrando actividad:', error);
    }
  };

  const cambiarOrden = (campo) => {
    setOrden(prev => ({
      campo: campo,
      direccion: prev.campo === campo && prev.direccion === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportarCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/exportar/clientes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes_ayma_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
    } catch (error) {
      console.error('Error exportando CSV:', error);
    }
  };

  // Vista de MÃ©tricas
  const VistaMetricas = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricas && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Clientes</p>
                <p className="text-3xl font-bold text-gray-900">{metricas.clientes.total}</p>
                <p className="text-sm text-green-600">+{metricas.clientes.nuevos_periodo} este mes</p>
              </div>
              <Users className="h-12 w-12 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">PÃ³lizas Vigentes</p>
                <p className="text-3xl font-bold text-gray-900">{metricas.polizas.vigentes}</p>
                <p className="text-sm text-orange-600">{metricas.polizas.por_vencer_30_dias} por vencer</p>
              </div>
              <FileText className="h-12 w-12 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Prima Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${metricas.polizas.prima_total_administrada.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Administrada</p>
              </div>
              <DollarSign className="h-12 w-12 text-yellow-500 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Scoring del Mes</p>
                <p className="text-3xl font-bold text-gray-900">{metricas.scoring.puntos_periodo.toFixed(1)}</p>
                <p className="text-sm text-blue-600">{metricas.scoring.cumplimiento}% objetivo</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-500 opacity-50" />
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Vista de Vencimientos
  const VistaVencimientos = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">PrÃ³ximos Vencimientos (30 dÃ­as)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PÃ³liza</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CompaÃ±Ã­a</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DÃ­as</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vencimientos.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.cliente.nombre}</div>
                    <div className="text-sm text-gray-500">{item.cliente.telefono}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.poliza.numero}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.poliza.compania}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(item.poliza.fecha_vencimiento).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.urgencia === 'alta' ? 'bg-red-100 text-red-800' :
                    item.urgencia === 'media' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {item.poliza.dias_restantes} dÃ­as
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => window.open(`https://wa.me/${item.cliente.whatsapp}`, '_blank')}
                    className="text-green-600 hover:text-green-900 mr-3"
                    title="WhatsApp"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => window.open(`mailto:${item.cliente.email}`, '_blank')}
                    className="text-blue-600 hover:text-blue-900"
                    title="Email"
                  >
                    <Mail className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Cambiar estado de lead
  const cambiarEstadoLead = async (leadId, nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.ok) {
        cargarDatos(); // Recargar lista
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  // Estados CRM AYMA
  const ESTADOS_LEAD = [
    { value: 'dato', label: 'Dato', color: 'bg-gray-100 text-gray-800' },
    { value: 'prospecto', label: 'Prospecto', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'potencial', label: 'Potencial', color: 'bg-blue-100 text-blue-800' },
    { value: 'cliente', label: 'Cliente', color: 'bg-green-100 text-green-800' },
    { value: 'perdido', label: 'Perdido', color: 'bg-red-100 text-red-800' }
  ];

  const getEstadoColor = (estado) => {
    const e = ESTADOS_LEAD.find(x => x.value === estado);
    return e ? e.color : 'bg-gray-100 text-gray-800';
  };

  // Vista de Leads
  const VistaLeads = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
        <h3 className="text-xl font-semibold">Leads del Landing ({leads.filter(l => 
          (!filtroEstado || l.estado === filtroEstado) && 
          (!filtroTipo || l.tipo_seguro === filtroTipo)
        ).length})</h3>
        <div className="flex gap-2">
          <select 
            value={filtroEstado} 
            onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_LEAD.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select 
            value={filtroTipo} 
            onChange={e => setFiltroTipo(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="vehiculos">Vehículos</option>
            <option value="hogar">Hogar</option>
            <option value="art">ART</option>
            <option value="comercio">Comercio</option>
            <option value="vida">Vida</option>
          </select>
          <button 
            onClick={() => {setFiltroEstado(''); setFiltroTipo('');}}
            className="px-3 py-1 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
          >
            Limpiar
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Seguro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.filter(l => (!filtroEstado || l.estado === filtroEstado) && (!filtroTipo || l.tipo_seguro === filtroTipo)).map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(lead.created_at).toLocaleString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {lead.nombre}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {lead.telefono}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {lead.tipo_seguro}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full \${
                    lead.estado === 'nuevo' ? 'bg-yellow-100 text-yellow-800' :
                    lead.estado === 'contactado' ? 'bg-blue-100 text-blue-800' :
                    lead.estado === 'convertido' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => window.open(`https://wa.me/\${lead.telefono}`, '_blank')}
                    className="text-green-600 hover:text-green-900 mr-3"
                    title="WhatsApp"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p className="text-center text-gray-500 py-8">No hay leads registrados</p>
        )}
      </div>
    </div>
  );

  // Vista de Clientes
  const VistaClientes = () => (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">GestiÃ³n de Clientes</h3>
          <button
            onClick={exportarCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Exportar CSV
          </button>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre, email, documento..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarClientes()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <button
            onClick={buscarClientes}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Buscar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => cambiarOrden('nombre')}
              >
                <div className="flex items-center">
                  Cliente
                  {orden.campo === 'nombre' && (
                    orden.direccion === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PÃ³lizas
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => cambiarOrden('scoring')}
              >
                <div className="flex items-center">
                  Scoring
                  {orden.campo === 'scoring' && (
                    orden.direccion === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ãšltima Actividad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{cliente.nombre_completo}</div>
                  <div className="text-sm text-gray-500">{cliente.domicilio}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{cliente.email}</div>
                  <div className="text-sm text-gray-500">{cliente.telefono}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {cliente.tipo_documento} {cliente.numero_documento}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    <span className="font-semibold text-green-600">{cliente.polizas_vigentes}</span> vigentes
                  </div>
                  <div className="text-xs text-gray-500">
                    {cliente.polizas_totales} totales
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{cliente.scoring_comercial}</div>
                  <div className="text-xs text-gray-500">Mes: {cliente.scoring_mes_actual.toFixed(1)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {cliente.ultima_actividad ? (
                    <div>
                      <div className="text-sm text-gray-900">{cliente.tipo_ultima_actividad}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(cliente.ultima_actividad).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Sin actividad</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => verDetalleCliente(cliente.id)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Ver detalle"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    className="text-gray-600 hover:text-gray-900"
                    title="Editar"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Modal de Detalle de Cliente
  const DetalleCliente = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-gray-900">
            {clienteSeleccionado.cliente.nombre} {clienteSeleccionado.cliente.apellido}
          </h3>
          <button
            onClick={() => setMostrarDetalle(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* InformaciÃ³n Personal */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">InformaciÃ³n Personal</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Email:</strong> {clienteSeleccionado.cliente.email}</div>
              <div><strong>TelÃ©fono:</strong> {clienteSeleccionado.cliente.telefono}</div>
              <div><strong>WhatsApp:</strong> {clienteSeleccionado.cliente.whatsapp || 'N/A'}</div>
              <div><strong>Documento:</strong> {clienteSeleccionado.cliente.tipo_documento} {clienteSeleccionado.cliente.numero_documento}</div>
              <div><strong>DirecciÃ³n:</strong> {clienteSeleccionado.cliente.domicilio.calle} {clienteSeleccionado.cliente.domicilio.numero}, {clienteSeleccionado.cliente.domicilio.localidad}</div>
            </div>
          </div>

          {/* MÃ©tricas */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">MÃ©tricas</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Scoring Total:</strong> {clienteSeleccionado.metricas.scoring_total}</div>
              <div><strong>Scoring Mes:</strong> {clienteSeleccionado.metricas.scoring_mes}</div>
              <div><strong>Scoring Semana:</strong> {clienteSeleccionado.metricas.scoring_semana}</div>
              <div><strong>PÃ³lizas Vigentes:</strong> {clienteSeleccionado.metricas.polizas_vigentes}</div>
              <div><strong>Prima Total:</strong> ${clienteSeleccionado.metricas.total_primas.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* PÃ³lizas */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3">PÃ³lizas</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">NÃºmero</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CompaÃ±Ã­a</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ramo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Premio</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clienteSeleccionado.polizas.map((poliza) => (
                  <tr key={poliza.id}>
                    <td className="px-4 py-2 text-sm">{poliza.numero}</td>
                    <td className="px-4 py-2 text-sm">{poliza.compania}</td>
                    <td className="px-4 py-2 text-sm">{poliza.ramo}</td>
                    <td className="px-4 py-2 text-sm">{new Date(poliza.fecha_vencimiento).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-sm">${poliza.premio_total.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        poliza.estado === 'vigente' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {poliza.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acciones RÃ¡pidas */}
        <div className="mt-6 border-t pt-4">
          <h4 className="font-semibold mb-3">Registrar Actividad</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => registrarActividad(clienteSeleccionado.cliente.id, 'llamado_nuevo')}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Llamado Nuevo (+5.9)
            </button>
            <button
              onClick={() => registrarActividad(clienteSeleccionado.cliente.id, 'cotizado')}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            >
              Cotizado (+13)
            </button>
            <button
              onClick={() => registrarActividad(clienteSeleccionado.cliente.id, 'propuesta_entregada')}
              className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
            >
              Propuesta (+25)
            </button>
            <button
              onClick={() => registrarActividad(clienteSeleccionado.cliente.id, 'cliente_cerrado')}
              className="px-3 py-1 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600"
            >
              Cliente Cerrado (+50)
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel de AdministraciÃ³n</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setVista('metricas')}
              className={`px-4 py-2 rounded-lg ${vista === 'metricas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >
              MÃ©tricas
            </button>
            <button
              onClick={() => setVista('clientes')}
              className={`px-4 py-2 rounded-lg ${vista === 'clientes' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >
              Clientes
            </button>
            <button
              onClick={() => setVista('vencimientos')}
              className={`px-4 py-2 rounded-lg ${vista === 'vencimientos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >
              Vencimientos
            </button>
            <button
              onClick={() => setVista('leads')}
              className={`px-4 py-2 rounded-lg ${vista === 'leads' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
            >
              Leads
            </button>
          </div>
        </div>

        {vista === 'metricas' && <VistaMetricas />}
        {vista === 'clientes' && <VistaClientes />}
        {vista === 'vencimientos' && <VistaVencimientos />}
        {vista === 'leads' && <VistaLeads />}

        {mostrarDetalle && clienteSeleccionado && <DetalleCliente />}
      </div>
    </div>
  );
};

export default AdminPanel;
