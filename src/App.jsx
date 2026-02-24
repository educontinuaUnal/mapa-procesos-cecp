import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  Layout, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  GitBranch,
  PlayCircle,
  Clock,
  Filter,
  ArrowDown,
  ArrowUp,
  Map,
  Layers,
  CornerDownRight,
  Route,
  Search,
  RotateCcw,
  Users,
  AlertTriangle,
  Network,
  Info,
  CheckCircle2,
  Lock,
  Unlock
} from 'lucide-react';

// --- DATA INICIAL ---

const defaultFlows = [
  { id: 'oferta_abierta', label: 'Oferta Abierta', color: '#3b82f6' }, // Azul
  { id: 'proyectos', label: 'Proyectos y Licitaciones', color: '#8b5cf6' }, // Violeta
];

const defaultPhases = [
  { id: 'p1', title: '1. Búsqueda', color: 'bg-blue-100 border-blue-300 text-blue-800', nodeColor: 'bg-blue-500' },
  { id: 'p2', title: '2. Viabilidad', color: 'bg-indigo-100 border-indigo-300 text-indigo-800', nodeColor: 'bg-indigo-500' },
  { id: 'p3', title: '3. Propuestas', color: 'bg-purple-100 border-purple-300 text-purple-800', nodeColor: 'bg-purple-500' },
  { id: 'p4', title: '4. Validación', color: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800', nodeColor: 'bg-fuchsia-500' },
  { id: 'p5', title: '5. Ejecución', color: 'bg-pink-100 border-pink-300 text-pink-800', nodeColor: 'bg-pink-500' },
  { id: 'p6', title: '6. Gestión', color: 'bg-rose-100 border-rose-300 text-rose-800', nodeColor: 'bg-rose-500' }
];

const defaultActivities = [
  { id: 1, phaseId: 'p1', text: 'Seguimiento de tendencias en reportes', role: 'GT', duration: 'Permanente', type: 'start', predecessors: [], flows: ['oferta_abierta'], origin: 'Tendencias' },
  { id: 2, phaseId: 'p1', text: 'Recepción de iniciativas individuales', role: 'GOA', duration: 'N/A', type: 'start', predecessors: [], flows: ['oferta_abierta'], origin: 'Iniciativas' },
  { id: 3, phaseId: 'p1', text: 'Rastreo en plataformas (SECOP, Hermes)', role: 'GOM', duration: 'Diario', type: 'start', predecessors: [], flows: ['proyectos'], origin: 'Plataformas' },
  { id: 4, phaseId: 'p1', text: 'Reunión con empresa/entidad', role: 'GOM', duration: 'N/A', type: 'start', predecessors: [], flows: ['proyectos'], origin: 'Institucional' },
  { id: 5, phaseId: 'p1', text: 'Participación en Ferias/Eventos', role: 'GT', duration: 'Eventual', type: 'start', predecessors: [], flows: ['proyectos', 'oferta_abierta'], origin: 'Eventos' },
  { id: 6, phaseId: 'p2', text: 'Estudio de mercado y tendencias', role: 'GT', duration: '3 días', type: 'process', predecessors: [1, 2, 5], flows: ['oferta_abierta'], condition: '' },
  { id: 7, phaseId: 'p2', text: 'Revisión Financiera Inicial', role: 'GA', duration: '2 días', type: 'process', predecessors: [2], flows: ['oferta_abierta'], condition: '' },
  { id: 8, phaseId: 'p2', text: 'Revisión de pliegos de condiciones', role: 'GOM', duration: '1 día', type: 'decision', predecessors: [3, 4], flows: ['proyectos'], condition: '' },
  { id: 9, phaseId: 'p3', text: 'Búsqueda de posible docente', role: 'GA', duration: 'Varía', type: 'process', predecessors: [6], flows: ['oferta_abierta'], condition: 'Si es viable' },
  { id: 10, phaseId: 'p3', text: 'Creación ficha extensión', role: 'D', duration: '2 días', type: 'process', predecessors: [7, 9], flows: ['oferta_abierta'], condition: '' },
  { id: 11, phaseId: 'p3', text: 'Manifestación de interés (Hermes)', role: 'GOM', duration: '1 día', type: 'process', predecessors: [8], flows: ['proyectos'], condition: 'Si cumple pliegos' },
  { id: 12, phaseId: 'p3', text: 'Construcción propuesta técnica/económica', role: 'GOM', duration: '3-5 días', type: 'process', predecessors: [11], flows: ['proyectos'], condition: 'Si hay aval' },
  { id: 13, phaseId: 'p4', text: 'Aprobación Comité de Extensión', role: 'DC', duration: 'Semanal', type: 'process', predecessors: [10], flows: ['oferta_abierta'], condition: '' },
  { id: 14, phaseId: 'p4', text: 'Elaboración de Acuerdo/Contrato', role: 'GOM', duration: '5 días', type: 'process', predecessors: [12], flows: ['proyectos'], condition: 'Si ganamos licitación' },
  { id: 15, phaseId: 'p5', text: 'Decisión: ¿Existe Proyecto en SAP?', role: 'Sistema', duration: 'N/A', type: 'decision', predecessors: [13, 14], flows: ['all'], condition: '' },
  { id: 16, phaseId: 'p5', text: 'Creación de PAC y Resolución', role: 'GA', duration: '5 días', type: 'process', predecessors: [15], flows: ['all'], condition: 'NO existe' },
  { id: 17, phaseId: 'p5', text: 'Formulación de Subproyectos', role: 'GP', duration: '3 días', type: 'process', predecessors: [15, 16], flows: ['all'], condition: 'SI existe / Ya creado' },
  { id: 18, phaseId: 'p6', text: 'Campaña de expectativa', role: 'GT', duration: '15 días', type: 'process', predecessors: [17], flows: ['oferta_abierta'], condition: '' },
  { id: 19, phaseId: 'p6', text: 'Ejecución del Proyecto (Inicio)', role: 'Director', duration: 'N/A', type: 'process', predecessors: [17], flows: ['proyectos'], condition: '' },
];

const availableRoles = ['GT', 'GA', 'GOM', 'GCA', 'DC', 'GP', 'Director', 'Sistema'];

const roleBadges = {
    'GT': 'bg-blue-100 text-blue-700',
    'GA': 'bg-emerald-100 text-emerald-700',
    'GOM': 'bg-amber-100 text-amber-700',
    'GCA': 'bg-purple-100 text-purple-700',
    'DC': 'bg-rose-100 text-rose-700',
    'GP': 'bg-cyan-100 text-cyan-700',
    'Director': 'bg-slate-100 text-slate-700',
    'Sistema': 'bg-gray-100 text-gray-700',
};

const ADMIN_PASSWORD = "admin123"; // <-- Cambia la contraseña aquí si lo deseas

export default function ProcessManager() {
  const [activeTab, setActiveTab] = useState('diagram_node');
  const [phases, setPhases] = useState(defaultPhases);
  const [activities, setActivities] = useState(defaultActivities);
  const [flows, setFlows] = useState(defaultFlows);
  
  // --- ESTADO DE SEGURIDAD (PASSWORD) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // --- ESTADO DE DIÁLOGOS (Reemplazo de window.confirm) ---
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  
  // --- ESTADO DE FILTROS ---
  const [tempFilters, setTempFilters] = useState({ flow: 'all', role: 'all' });
  const [activeFilters, setActiveFilters] = useState({ flow: 'all', role: 'all' });
  
  // Interacción Visual
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [lines, setLines] = useState([]);
  
  const nodeRefs = useRef({});
  const containerRef = useRef(null);

  // Edición
  const [isEditingActivity, setIsEditingActivity] = useState(null);
  const [managementMode, setManagementMode] = useState('activities');
  
  const [formData, setFormData] = useState({
    text: '', role: '', duration: '', phaseId: '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: ''
  });

  // --- CALCULO DE LÍNEAS ROBUSTO ---
  const calculateLines = () => {
    if (activeTab !== 'diagram_node' || !containerRef.current) return;

    const newLines = [];
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;

    activities.forEach(act => {
      if (getOpacity(act) === 'hidden') return;

      if (act.predecessors && act.predecessors.length > 0) {
        const endNode = nodeRefs.current[act.id];
        
        act.predecessors.forEach(predId => {
          const startNode = nodeRefs.current[predId];
          const predAct = activities.find(a => a.id === predId);

          if (startNode && endNode && predAct && getOpacity(predAct) !== 'hidden') {
             const startRect = startNode.getBoundingClientRect();
             const endRect = endNode.getBoundingClientRect();

             const startX = startRect.right - containerRect.left + scrollLeft;
             const startY = startRect.top + (startRect.height / 2) - containerRect.top + scrollTop;
             const endX = endRect.left - containerRect.left + scrollLeft;
             const endY = endRect.top + (endRect.height / 2) - containerRect.top + scrollTop;

             let strokeColor = '#e2e8f0'; 
             let strokeWidth = 2;
             let zIndex = 0;
             let isFlowActive = false;
             
             if (activeFilters.flow !== 'all') {
                if (act.flows.includes(activeFilters.flow) && predAct.flows.includes(activeFilters.flow)) {
                    const flowObj = flows.find(f => f.id === activeFilters.flow);
                    if (flowObj) strokeColor = flowObj.color;
                    strokeWidth = 3;
                    zIndex = 10;
                    isFlowActive = true;
                }
             } else if (selectedActivityId) {
                const downstream = getDownstreamPath(selectedActivityId);
                const upstream = getUpstreamPath(selectedActivityId);
                const isRelated = (downstream.has(act.id) && downstream.has(predId)) || (upstream.has(act.id) && upstream.has(predId));
                
                if (isRelated) {
                    strokeColor = '#64748b'; 
                    strokeWidth = 3;
                    zIndex = 10;
                    isFlowActive = true;
                }
             }

             const dist = Math.abs(endX - startX);
             const cpOffset = dist * 0.5; 

             newLines.push({
               id: `${predId}-${act.id}`,
               d: `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`,
               color: strokeColor,
               width: strokeWidth,
               zIndex: zIndex,
               animated: isFlowActive
             });
          }
        });
      }
    });
    setLines(newLines);
  };

  useLayoutEffect(() => {
    calculateLines();
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', calculateLines);
    window.addEventListener('resize', calculateLines);
    return () => {
        if (container) container.removeEventListener('scroll', calculateLines);
        window.removeEventListener('resize', calculateLines);
    };
  }, [activities, activeFilters, activeTab, selectedActivityId, phases, flows]);

  // --- NAVEGACIÓN Y SEGURIDAD ---
  const handleEditorTabClick = () => {
      if (isAuthenticated) {
          setActiveTab('editor');
      } else {
          setShowAuthModal(true);
      }
  };

  const handleLogin = (e) => {
      e.preventDefault();
      if (passwordInput === ADMIN_PASSWORD) {
          setIsAuthenticated(true);
          setShowAuthModal(false);
          setAuthError('');
          setPasswordInput('');
          setActiveTab('editor');
      } else {
          setAuthError('Contraseña incorrecta');
      }
  };

  // --- FILTROS & SELECCION ---
  const applyFilters = () => { setActiveFilters(tempFilters); setSelectedActivityId(null); };
  const clearFilters = () => { const reset = { flow: 'all', role: 'all' }; setTempFilters(reset); setActiveFilters(reset); setSelectedActivityId(null); };

  // --- TRAZABILIDAD ---
  const getDownstreamPath = (startId, allActs = activities) => {
    let path = new Set([startId]);
    let queue = [startId];
    while(queue.length > 0) {
      const current = queue.shift();
      const children = allActs.filter(a => a.predecessors.includes(current));
      children.forEach(child => { if (!path.has(child.id)) { path.add(child.id); queue.push(child.id); } });
    }
    return path;
  };

  const getUpstreamPath = (startId, allActs = activities) => {
    let path = new Set([startId]);
    const findParents = (id) => {
      const act = allActs.find(a => a.id === id);
      if(act && act.predecessors) { act.predecessors.forEach(pid => { path.add(pid); findParents(pid); }); }
    };
    findParents(startId);
    return path;
  };

  const getOpacity = (act) => {
    const matchesFlow = activeFilters.flow === 'all' || (act.flows && act.flows.includes(activeFilters.flow));
    const matchesRole = activeFilters.role === 'all' || act.role === activeFilters.role;
    if (!matchesFlow || !matchesRole) return 'hidden';
    if (selectedActivityId) {
      const downstream = getDownstreamPath(selectedActivityId);
      const upstream = getUpstreamPath(selectedActivityId);
      if (downstream.has(act.id) || upstream.has(act.id)) return 'opacity-100 scale-100';
      return 'opacity-20 grayscale';
    }
    return 'opacity-100';
  };

  // --- CRUD SEGURO (CON MODALES PROPIOS) ---
  const requestDeleteActivity = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Actividad',
          message: `¿Estás seguro de que deseas eliminar la actividad #${id}? Esta acción no se puede deshacer y eliminará las dependencias asociadas.`,
          onConfirm: () => {
              setActivities(prev => prev.filter(a => a.id !== id));
              setActivities(prev => prev.map(a => ({ ...a, predecessors: a.predecessors.filter(pid => pid !== id) })));
              if (isEditingActivity === id) setIsEditingActivity(null);
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const requestDeletePhase = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Fase Completa',
          message: '¡Atención! Al borrar esta fase, también se eliminarán TODAS las actividades que pertenecen a ella. ¿Deseas continuar?',
          onConfirm: () => {
              setPhases(prev => prev.filter(p => p.id !== id));
              setActivities(prev => prev.filter(a => a.phaseId !== id));
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const requestDeleteFlow = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Ruta',
          message: '¿Borrar esta ruta? Las actividades seguirán existiendo, pero perderán su asignación a este flujo.',
          onConfirm: () => {
              setFlows(prev => prev.filter(f => f.id !== id));
              setActivities(prev => prev.map(a => ({ ...a, flows: a.flows.filter(fid => fid !== id) })));
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const addPhase = () => {
     const newId = `p${Date.now()}`;
     setPhases([...phases, { 
       id: newId, 
       title: 'Nueva Fase', 
       color: 'bg-slate-100 border-slate-300 text-slate-800', 
       nodeColor: 'bg-slate-500' 
     }]);
  };

  const addFlow = () => {
      const id = `ruta_${Date.now()}`;
      setFlows([...flows, { id, label: 'Nueva Ruta', color: '#64748b' }]);
  };

  const updatePhaseTitle = (id, newTitle) => {
    setPhases(phases.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  const updateFlowLabel = (id, newLabel) => {
    setFlows(flows.map(f => f.id === id ? { ...f, label: newLabel } : f));
  };
  
  const handleSaveActivity = () => {
    let preds = formData.predecessors;
    if (typeof preds === 'string') { preds = preds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); }
    const newActivity = { ...formData, predecessors: preds };
    if (isEditingActivity) {
      setActivities(activities.map(a => a.id === isEditingActivity ? { ...newActivity, id: isEditingActivity } : a));
      setIsEditingActivity(null);
    } else {
      const newId = Math.max(...activities.map(a => a.id), 0) + 1;
      setActivities([...activities, { ...newActivity, id: newId }]);
    }
    setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
  };

  const startEdit = (activity) => {
    setIsEditingActivity(activity.id);
    setFormData({ ...activity, origin: activity.origin || '', condition: activity.condition || '', flows: activity.flows || ['all'], predecessors: activity.predecessors || [] });
    setActiveTab('editor');
  };

  // --- COMPONENTES VISUALES ---
  const NodeCard = ({ activity }) => {
    const isSelected = selectedActivityId === activity.id;
    const opacityClass = getOpacity(activity);
    if (opacityClass === 'hidden') return null;
    
    const phaseObj = phases.find(p => p.id === activity.phaseId);
    const nodeColor = phaseObj ? phaseObj.nodeColor : 'bg-slate-500';
    const isDecision = activity.type === 'decision';
    const shapeClasses = isDecision 
        ? 'w-10 h-10 rotate-45 bg-gray-400 border-2 border-gray-500 rounded-sm' 
        : `w-10 h-10 rounded-full border-2 border-white shadow-md ${nodeColor} text-white`;
    const contentRotate = isDecision ? '-rotate-45' : '';

    return (
      <div ref={el => nodeRefs.current[activity.id] = el} className={`group relative flex items-center justify-center mb-8 transition-all duration-300 ${opacityClass}`} style={{ zIndex: isSelected ? 100 : 20 }}>
        <div 
            onClick={(e) => { e.stopPropagation(); setSelectedActivityId(isSelected ? null : activity.id); }}
            className={`flex items-center justify-center font-bold text-xs cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 shadow-sm ${shapeClasses} ${isSelected ? 'ring-4 ring-offset-2 ring-blue-300' : ''}`}
        >
            <span className={`${contentRotate} ${isDecision ? 'text-white' : ''}`}>{activity.id}</span>
        </div>
        <div className={`absolute left-16 top-1/2 -translate-y-1/2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 transition-all duration-300 pointer-events-none origin-left z-[101] ${isSelected ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-x-4 pointer-events-none'}`}>
            <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white border-b-[6px] border-b-transparent drop-shadow-sm"></div>
            <div className="flex justify-between items-center p-3 border-b border-slate-50 bg-slate-50/50 rounded-t-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isDecision ? 'Decisión' : 'Actividad'} #{activity.id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${roleBadges[activity.role] || 'bg-slate-100'}`}>{activity.role}</span>
            </div>
            <div className="p-4">
                <p className="text-sm font-medium text-slate-800 leading-snug mb-3">{activity.text}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {activity.condition && (<div className="bg-amber-50 text-amber-700 text-[10px] px-2 py-1 rounded-md border border-amber-100 flex items-center gap-1 font-medium"><CornerDownRight className="w-3 h-3"/> {activity.condition}</div>)}
                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md"><Clock className="w-3 h-3"/> {activity.duration}</div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* --- MODAL DE AUTENTICACIÓN --- */}
      {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up">
                  <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                          <Lock className="w-8 h-8" />
                      </div>
                  </div>
                  <h2 className="text-xl font-bold text-center text-slate-800 mb-2">Acceso Restringido</h2>
                  <p className="text-sm text-center text-slate-500 mb-6">Ingresa la contraseña para acceder al editor de diagramas.</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <input 
                              type="password" 
                              autoFocus
                              placeholder="Contraseña"
                              className={`w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${authError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`}
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                          />
                          {authError && <p className="text-xs text-red-500 mt-1 font-medium">{authError}</p>}
                      </div>
                      <div className="flex gap-3">
                          <button type="button" onClick={() => { setShowAuthModal(false); setAuthError(''); setPasswordInput(''); }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"><Unlock className="w-4 h-4"/> Entrar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- MODAL DE CONFIRMACIÓN GENÉRICO --- */}
      {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">{confirmDialog.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setConfirmDialog({ isOpen: false })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg hover:bg-red-700 transition-colors">Sí, eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 p-3 shadow-sm z-40 flex flex-col xl:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg shadow-lg"><Network className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-base font-bold text-slate-900 leading-tight">Mapa de Procesos</h1><p className="text-[10px] text-slate-500 uppercase tracking-wider">Gestión CECP</p></div>
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full xl:w-auto shadow-inner">
          <div className="flex items-center gap-2 px-2 border-r border-slate-300">
            <Filter className="w-4 h-4 text-blue-600" />
            <select value={tempFilters.flow} onChange={(e) => setTempFilters({...tempFilters, flow: e.target.value})} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-1 pl-0 pr-6 w-32 sm:w-40 truncate hover:text-blue-600 transition-colors">
              <option value="all">Todas las Rutas</option>
              {flows.map(f => <option key={f.id} value={f.id}>{f.label.replace('Ruta: ', '')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-2 border-r border-slate-300">
            <Users className="w-4 h-4 text-purple-600" />
            <select value={tempFilters.role} onChange={(e) => setTempFilters({...tempFilters, role: e.target.value})} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-1 pl-0 pr-6 w-28 sm:w-32 truncate hover:text-purple-600 transition-colors">
              <option value="all">Todos los Roles</option>
              {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-1 ml-auto sm:ml-0">
            <button onClick={applyFilters} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition-transform active:scale-95">Filtrar</button>
            <button onClick={clearFilters} className="bg-white text-slate-500 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-bold hover:text-red-600 hover:border-red-200 shadow-sm transition-transform active:scale-95"><RotateCcw className="w-3 h-3" /></button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full xl:w-auto">
          <button onClick={() => setActiveTab('diagram_node')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'diagram_node' ? 'bg-white text-blue-700 shadow ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Network className="w-3 h-3"/> Diagrama</button>
          <button onClick={() => setActiveTab('diagram_list')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'diagram_list' ? 'bg-white text-blue-700 shadow ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Layout className="w-3 h-3"/> Lista</button>
          
          {/* BOTÓN EDITOR (CON CANDADO) */}
          <button onClick={handleEditorTabClick} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'editor' ? 'bg-amber-100 text-amber-800 shadow ring-1 ring-amber-300' : 'text-slate-500 hover:text-slate-700'}`}>
             {isAuthenticated ? <Edit2 className="w-3 h-3 text-amber-600"/> : <Lock className="w-3 h-3"/>} Editor
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-hidden relative flex bg-slate-50">
        
        {/* DIAGRAMA NODOS */}
        {activeTab === 'diagram_node' && (
          <div 
            className="flex-1 h-full overflow-auto relative cursor-grab active:cursor-grabbing" 
            ref={containerRef}
            onClick={() => setSelectedActivityId(null)} // Des-seleccionar al hacer click fuera
          >
            <div className="absolute inset-0 pointer-events-none opacity-[0.4] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] z-0 min-w-max min-h-full"></div>

            <svg className="absolute top-0 left-0 w-full h-full min-w-max min-h-max pointer-events-none z-10 overflow-visible">
              <defs>
                 <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" /></marker>
                 <marker id="arrowhead-active" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#3b82f6" /></marker>
              </defs>
              {lines.map(line => (
                  <path key={line.id} d={line.d} stroke={line.color} strokeWidth={line.width} fill="none" markerEnd={line.color.includes('f6') ? `url(#arrowhead-active)` : `url(#arrowhead)`} className={`transition-all duration-500 ${line.animated ? 'opacity-100' : 'opacity-40'}`} style={{ zIndex: line.zIndex }} />
              ))}
            </svg>

            <div className="flex min-w-max h-full relative z-20 p-8 space-x-16">
               {phases.map((phase, idx) => (
                  <div key={phase.id} className="w-24 flex flex-col h-full items-center">
                      <div className="mb-10 sticky top-0 z-30 w-full flex flex-col items-center">
                          <div className={`bg-white border-b-4 ${phase.color.split(' ')[1]} px-4 py-2 rounded-t-lg shadow-sm text-center min-w-[140px]`}>
                              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">FASE {idx + 1}</span>
                              <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wide">{phase.title.replace(/^\d+\.\s/, '')}</h2>
                          </div>
                          <div className="w-px h-full bg-slate-200 absolute top-full mt-0 -z-10"></div>
                      </div>
                      <div className="flex-1 w-full flex flex-col items-center pb-20 pt-4 space-y-4">
                          {activities.filter(a => a.phaseId === phase.id).map(act => (
                              <NodeCard key={act.id} activity={act} />
                          ))}
                      </div>
                  </div>
               ))}
               <div className="flex flex-col justify-center h-full pb-32 ml-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 bg-white flex items-center justify-center shadow-inner group">
                      <span className="font-bold text-xs text-slate-300 group-hover:text-red-500 transition-colors">FIN</span>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* LISTA VISTA */}
        {activeTab === 'diagram_list' && (
             <div className="flex-1 h-full overflow-y-auto bg-slate-50 p-8 scroll-smooth relative" onClick={() => setSelectedActivityId(null)}>
                <div className="max-w-4xl mx-auto space-y-8 pb-20">
                    {phases.map((phase, index) => {
                        const phaseActivities = activities.filter(a => a.phaseId === phase.id);
                        if(phaseActivities.length === 0) return null;
                        return (
                            <div key={phase.id} className="relative pl-8 border-l-2 border-slate-200 ml-4">
                                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center font-bold text-slate-400 text-sm z-10 shadow-sm">{index + 1}</div>
                                <h3 className="font-bold text-lg text-slate-800 mb-4 pl-2">{phase.title}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {phaseActivities.map(act => {
                                        if (getOpacity(act) === 'hidden') return null;
                                        return (
                                            <div key={act.id} onClick={(e)=>{ e.stopPropagation(); startEdit(act); }} className={`group p-4 bg-white rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all`}>
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-400">ID: {act.id}</span>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${roleBadges[act.role] || 'bg-slate-100'}`}>{act.role}</span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{act.text}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
        )}

        {/* EDITOR */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex flex-col md:flex-row h-full bg-white">
            <div className="w-full md:w-1/3 min-w-[300px] border-r border-slate-200 bg-slate-50 flex flex-col">
              <div className="flex border-b border-slate-200 bg-white">
                <button onClick={() => setManagementMode('activities')} className={`flex-1 py-3 text-xs font-bold ${managementMode === 'activities' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>Actividades</button>
                <button onClick={() => setManagementMode('phases')} className={`flex-1 py-3 text-xs font-bold ${managementMode === 'phases' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>Fases</button>
                <button onClick={() => setManagementMode('flows')} className={`flex-1 py-3 text-xs font-bold ${managementMode === 'flows' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>Rutas</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {managementMode === 'phases' && (
                  <div className="space-y-3">
                    {phases.map((phase) => (
                      <div key={phase.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                        <input className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500" value={phase.title} onChange={(e) => updatePhaseTitle(phase.id, e.target.value)} />
                        <button type="button" onClick={() => requestDeletePhase(phase.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button onClick={addPhase} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-600 flex justify-center gap-2 transition-colors"><Plus className="w-4 h-4"/> Nueva Fase</button>
                  </div>
                )}
                {managementMode === 'flows' && (
                  <div className="space-y-3">
                    {flows.map((flow) => (
                      <div key={flow.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full" style={{backgroundColor: flow.color || '#ccc'}}></div>
                         <input className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500" value={flow.label} onChange={(e) => updateFlowLabel(flow.id, e.target.value)} />
                         <button type="button" onClick={() => requestDeleteFlow(flow.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button onClick={addFlow} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-600 flex justify-center gap-2 transition-colors"><Plus className="w-4 h-4"/> Nueva Ruta</button>
                  </div>
                )}
                {managementMode === 'activities' && (
                  <div className="space-y-2">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Inventario</h3>
                        <button onClick={() => { setIsEditingActivity(null); setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' }); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all">+ Nueva</button>
                     </div>
                     {activities.map(act => (
                        <div key={act.id} onClick={() => startEdit(act)} className={`relative p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer transition-all ${isEditingActivity === act.id ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-50' : ''}`}>
                            <div className="pr-6">
                                <p className="text-xs font-bold text-slate-700 truncate">{act.text}</p>
                                <span className="text-[10px] text-slate-400">ID: {act.id}</span>
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActivity(act.id); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
                        </div>
                     ))}
                  </div>
                )}
              </div>
            </div>

            {/* FORMULARIO EDITAR */}
            <div className="flex-1 bg-white p-8 overflow-y-auto" onClick={() => setSelectedActivityId(null)}>
               <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                 {isEditingActivity ? <Edit2 className="w-5 h-5 text-blue-600"/> : <Plus className="w-5 h-5 text-emerald-600"/>}
                 {isEditingActivity ? `Editar Actividad #${isEditingActivity}` : 'Crear Nueva Actividad'}
               </h2>
               <div className="grid grid-cols-1 gap-5 max-w-2xl">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fase del Proceso</label>
                      <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={formData.phaseId} onChange={e=>setFormData({...formData, phaseId: e.target.value})}>
                          {phases.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción</label>
                      <textarea className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all h-24" value={formData.text} onChange={e=>setFormData({...formData, text: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Rol Responsable</label>
                         <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})}>
                             <option value="">Seleccionar...</option>
                             {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Predecesores (IDs)</label>
                         <input className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ej: 1, 3" value={Array.isArray(formData.predecessors) ? formData.predecessors.join(',') : formData.predecessors} onChange={e=>setFormData({...formData, predecessors: e.target.value})} />
                     </div>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo de Nodo</label>
                      <div className="flex gap-2">
                          <button onClick={() => setFormData({...formData, type: 'process'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'process' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>Proceso</button>
                          <button onClick={() => setFormData({...formData, type: 'decision'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'decision' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600'}`}>Decisión</button>
                          <button onClick={() => setFormData({...formData, type: 'start'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'start' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-600'}`}>Inicio</button>
                      </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Rutas Asociadas</label>
                      <div className="flex gap-2 flex-wrap">
                          {flows.map(f => (
                              <label key={f.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full cursor-pointer border transition-all ${formData.flows.includes(f.id) ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                                  <input type="checkbox" className="hidden" checked={formData.flows.includes(f.id)} onChange={e => {
                                      const newFlows = e.target.checked ? [...formData.flows, f.id] : formData.flows.filter(id => id !== f.id);
                                      setFormData({...formData, flows: newFlows});
                                  }} /> 
                                  {formData.flows.includes(f.id) && <CheckCircle2 className="w-3 h-3"/>}
                                  {f.label.replace('Ruta: ','')}
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                      <button onClick={handleSaveActivity} className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg font-bold shadow-lg hover:bg-black transition-all transform active:scale-95 flex justify-center items-center gap-2"><Save className="w-4 h-4"/> Guardar Cambios</button>
                      {isEditingActivity && (<button onClick={() => { setIsEditingActivity(null); setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' }); }} className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>)}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}