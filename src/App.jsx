import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { 
  Layout, Plus, Trash2, Edit2, Save, X, Network, Clock, Filter, 
  CornerDownRight, RotateCcw, Users, AlertTriangle, Lock, Unlock, CheckCircle2, GitBranch
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCmabKvkwXx6NYctn4jG-_GVYwcCJOl4-E",
  authDomain: "mapa-cecp-db.firebaseapp.com",
  projectId: "mapa-cecp-db",
  storageBucket: "mapa-cecp-db.firebasestorage.app",
  messagingSenderId: "1026122082021",
  appId: "1:1026122082021:web:c46c4ed386683c58e5960c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Rutas de colección para la base de datos
const APP_ID = 'mapa-cecp-app';
const getStageColPath = (stageId, colName) => `artifacts/${APP_ID}/public/data/stages/${stageId}/${colName}`;

const processStages = [
  { id: 'formulacion', title: 'Formulación', description: 'Diseño y estructuración del proceso', color: 'from-blue-600 to-indigo-600' },
  { id: 'ejecucion', title: 'Ejecución', description: 'Despliegue operativo y seguimiento', color: 'from-emerald-600 to-teal-600' },
  { id: 'liquidacion', title: 'Liquidación', description: 'Cierre técnico, financiero y lecciones', color: 'from-fuchsia-600 to-rose-600' },
];

// --- DATA INICIAL POR ETAPA (Por si la base de datos está vacía) ---
const stageDefaults = {
  formulacion: {
    flows: [
      { id: 'oferta_abierta', label: 'Oferta Abierta', color: '#3b82f6' },
      { id: 'proyectos', label: 'Proyectos y Licitaciones', color: '#8b5cf6' },
    ],
    phases: [
      { id: 'p1', title: '1. Búsqueda', color: '#3b82f6' },
      { id: 'p2', title: '2. Viabilidad', color: '#6366f1' },
      { id: 'p3', title: '3. Propuestas', color: '#a855f7' },
      { id: 'p4', title: '4. Validación', color: '#d946ef' },
      { id: 'p5', title: '5. Ejecución', color: '#ec4899' },
      { id: 'p6', title: '6. Gestión', color: '#f43f5e' }
    ],
    activities: [
      { id: 1, phaseId: 'p1', text: 'Seguimiento de tendencias en reportes', role: 'GT', duration: 'Permanente', type: 'start', predecessors: [], flows: ['oferta_abierta'], origin: 'Tendencias', condition: '' },
      { id: 2, phaseId: 'p1', text: 'Recepción de iniciativas individuales', role: 'GOA', duration: 'N/A', type: 'start', predecessors: [], flows: ['oferta_abierta'], origin: 'Iniciativas', condition: '' },
      { id: 3, phaseId: 'p1', text: 'Rastreo en plataformas (SECOP, Hermes)', role: 'GOM', duration: 'Diario', type: 'start', predecessors: [], flows: ['proyectos'], origin: 'Plataformas', condition: '' },
      { id: 4, phaseId: 'p1', text: 'Reunión con empresa/entidad', role: 'GOM', duration: 'N/A', type: 'start', predecessors: [], flows: ['proyectos'], origin: 'Institucional', condition: '' },
      { id: 5, phaseId: 'p1', text: 'Participación en Ferias/Eventos', role: 'GT', duration: 'Eventual', type: 'start', predecessors: [], flows: ['proyectos', 'oferta_abierta'], origin: 'Eventos', condition: '' },
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
    ],
  },
  ejecucion: {
    flows: [
      { id: 'academica', label: 'Ejecución Académica', color: '#0ea5e9' },
      { id: 'administrativa', label: 'Ejecución Administrativa', color: '#14b8a6' },
    ],
    phases: [
      { id: 'e1', title: '1. Alistamiento', color: '#0ea5e9' },
      { id: 'e2', title: '2. Operación', color: '#14b8a6' },
      { id: 'e3', title: '3. Control', color: '#22c55e' },
      { id: 'e4', title: '4. Cierre Operativo', color: '#10b981' },
    ],
    activities: [
      { id: 1, phaseId: 'e1', text: 'Reunión de inicio y plan de trabajo', role: 'Director', duration: '1 día', type: 'start', predecessors: [], flows: ['all'], origin: '', condition: '' },
      { id: 2, phaseId: 'e1', text: 'Asignación de equipo y recursos', role: 'GA', duration: '2 días', type: 'process', predecessors: [1], flows: ['administrativa'], origin: '', condition: '' },
      { id: 3, phaseId: 'e2', text: 'Ejecución de actividades académicas', role: 'GP', duration: 'Variable', type: 'process', predecessors: [1], flows: ['academica'], origin: '', condition: '' },
      { id: 4, phaseId: 'e2', text: 'Gestión contractual y compras', role: 'GOM', duration: 'Semanal', type: 'process', predecessors: [2], flows: ['administrativa'], origin: '', condition: '' },
      { id: 5, phaseId: 'e3', text: 'Seguimiento de indicadores', role: 'GT', duration: 'Quincenal', type: 'decision', predecessors: [3, 4], flows: ['all'], origin: '', condition: 'Si hay desviaciones' },
      { id: 6, phaseId: 'e4', text: 'Informe final de ejecución', role: 'DC', duration: '3 días', type: 'process', predecessors: [5], flows: ['all'], origin: '', condition: '' },
    ],
  },
  liquidacion: {
    flows: [
      { id: 'financiero', label: 'Cierre Financiero', color: '#a855f7' },
      { id: 'tecnico', label: 'Cierre Técnico', color: '#ec4899' },
    ],
    phases: [
      { id: 'l1', title: '1. Consolidación', color: '#a855f7' },
      { id: 'l2', title: '2. Validación', color: '#d946ef' },
      { id: 'l3', title: '3. Formalización', color: '#ec4899' },
    ],
    activities: [
      { id: 1, phaseId: 'l1', text: 'Consolidar soportes técnicos y financieros', role: 'GA', duration: '4 días', type: 'start', predecessors: [], flows: ['all'], origin: '', condition: '' },
      { id: 2, phaseId: 'l1', text: 'Verificación documental de cumplimiento', role: 'GCA', duration: '2 días', type: 'process', predecessors: [1], flows: ['tecnico'], origin: '', condition: '' },
      { id: 3, phaseId: 'l2', text: 'Conciliación de ejecución presupuestal', role: 'GA', duration: '3 días', type: 'process', predecessors: [1], flows: ['financiero'], origin: '', condition: '' },
      { id: 4, phaseId: 'l2', text: 'Decisión: ¿Se requieren ajustes?', role: 'Sistema', duration: 'N/A', type: 'decision', predecessors: [2, 3], flows: ['all'], origin: '', condition: '' },
      { id: 5, phaseId: 'l3', text: 'Firma de acta de liquidación', role: 'Director', duration: '1 día', type: 'process', predecessors: [4], flows: ['all'], origin: '', condition: 'Sin ajustes pendientes' },
    ],
  }
};

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

const ADMIN_PASSWORD = "admin123";

// Función inteligente para migrar colores viejos de la base de datos a los nuevos códigos HEX
const getPhaseHexColor = (phase) => {
    if (!phase) return '#cbd5e1';
    if (phase.color && phase.color.startsWith('#')) return phase.color;
    // Compatibilidad con la versión anterior guardada en tu Firebase
    const oldColors = { 'bg-blue-100': '#3b82f6', 'bg-indigo-100': '#6366f1', 'bg-purple-100': '#a855f7', 'bg-fuchsia-100': '#d946ef', 'bg-pink-100': '#ec4899', 'bg-rose-100': '#f43f5e' };
    const matched = phase.color ? Object.keys(oldColors).find(key => phase.color.includes(key)) : null;
    return matched ? oldColors[matched] : '#3b82f6';
};

export default function App() {
  const [activeTab, setActiveTab] = useState('diagram_node');
  const [activeStage, setActiveStage] = useState('formulacion');
  
  // Estados de Base de Datos
  const [phases, setPhases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Estados de Seguridad
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Estados de Interfaz
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [tempFilters, setTempFilters] = useState({ flow: 'all', role: 'all' });
  const [activeFilters, setActiveFilters] = useState({ flow: 'all', role: 'all' });
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [lines, setLines] = useState([]);
  
  const nodeRefs = useRef({});
  const containerRef = useRef(null);
  const initializedRef = useRef({});

  // Estados de Edición
  const [isEditingActivity, setIsEditingActivity] = useState(null);
  const [managementMode, setManagementMode] = useState('activities');
  const [formData, setFormData] = useState({
    text: '', role: '', duration: '', phaseId: '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: ''
  });
  const [insertBeforeId, setInsertBeforeId] = useState(null);
  const [insertPhaseId, setInsertPhaseId] = useState(null);
  const [isDraggingNewActivity, setIsDraggingNewActivity] = useState(false);
  const [dragDropTarget, setDragDropTarget] = useState('none');

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => b.id - a.id),
    [activities]
  );

  const getPhaseSortedActivities = (phaseId) => sortedActivities.filter(activity => activity.phaseId === phaseId);
  const getTargetKey = (targetId, phaseId) => (targetId === null ? `end:${phaseId}` : `before:${targetId}`);

  // --- FIREBASE: AUTENTICACIÓN Y LECTURA ---
  useEffect(() => {
    const initAuth = async () => {
      try { 
        await signInAnonymously(auth); 
      } catch (error) { 
        console.error("Error conectando a Firebase:", error); 
        // Fallback para evitar bloqueo si la Autenticación Anónima no está habilitada
        setUser({ uid: 'usuario-temporal-test' });
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const setupDatabase = async () => {
      // Escuchar Rutas
      const stageColPath = (colName) => getStageColPath(activeStage, colName);
      const stageDefaultsData = stageDefaults[activeStage];

      const unsubFlows = onSnapshot(collection(db, stageColPath('flows')), (snapshot) => {
        let data = snapshot.docs.map(doc => doc.data());
        if (data.length === 0 && !initializedRef.current[activeStage]) {
           data = stageDefaultsData.flows;
        }
        setFlows(data);
      }, (error) => console.error(error));

      // Escuchar Fases
      const unsubPhases = onSnapshot(collection(db, stageColPath('phases')), (snapshot) => {
        let data = snapshot.docs.map(doc => doc.data());
        data.sort((a, b) => a.title.localeCompare(b.title));
        if (data.length === 0 && !initializedRef.current[activeStage]) {
           data = stageDefaultsData.phases;
        }
        setPhases(data);
      }, (error) => console.error(error));

      // Escuchar Actividades
      const unsubActs = onSnapshot(collection(db, stageColPath('activities')), async (snapshot) => {
        let data = snapshot.docs.map(doc => doc.data());

        if (data.length === 0 && !initializedRef.current[activeStage]) {
           initializedRef.current[activeStage] = true;
           const batch = writeBatch(db);
           stageDefaultsData.flows.forEach(f => batch.set(doc(db, stageColPath('flows'), f.id), f));
           stageDefaultsData.phases.forEach(p => batch.set(doc(db, stageColPath('phases'), p.id), p));
           stageDefaultsData.activities.forEach((a, index) => batch.set(doc(db, stageColPath('activities'), a.id.toString()), { ...a, order_index: (index + 1) * ORDER_GAP }));
           await batch.commit();
           data = stageDefaultsData.activities.map((a, index) => ({ ...a, order_index: (index + 1) * ORDER_GAP }));
        }

        const missingOrder = data.filter(activity => typeof activity.order_index !== 'number');
        if (missingOrder.length > 0) {
          const batch = writeBatch(db);
          const phaseCatalog = data.length > 0
            ? Array.from(new Set(data.map(activity => activity.phaseId))).map(id => ({ id }))
            : stageDefaultsData.phases;

          phaseCatalog.forEach(phase => {
            const phaseActivities = data
              .filter(activity => activity.phaseId === phase.id)
              .sort((a, b) => a.id - b.id);
            phaseActivities.forEach((activity, index) => {
              if (typeof activity.order_index !== 'number') {
                const order_index = (index + 1) * ORDER_GAP;
                activity.order_index = order_index;
                batch.set(doc(db, stageColPath('activities'), activity.id.toString()), { order_index }, { merge: true });
              }
            });
          });
          await batch.commit();
        }

        setActivities(data);
        setIsLoading(false);
      }, (error) => console.error(error));

      return () => { unsubFlows(); unsubPhases(); unsubActs(); };
    };

    const cleanup = setupDatabase();
    return () => cleanup;
  }, [user, activeStage]);


  const getDownstreamPath = useCallback((startId, allActs = activities) => {
    let path = new Set([startId]);
    let queue = [startId];
    while(queue.length > 0) {
      const current = queue.shift();
      const children = allActs.filter(a => a.predecessors.includes(current));
      children.forEach(child => { if (!path.has(child.id)) { path.add(child.id); queue.push(child.id); } });
    }
    return path;
  }, [activities]);

  const getUpstreamPath = useCallback((startId, allActs = activities) => {
    let path = new Set([startId]);
    const findParents = (id) => {
      const act = allActs.find(a => a.id === id);
      if(act && act.predecessors) { act.predecessors.forEach(pid => { path.add(pid); findParents(pid); }); }
    };
    findParents(startId);
    return path;
  }, [activities]);

  const getOpacity = useCallback((act) => {
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
  }, [activeFilters.flow, activeFilters.role, getDownstreamPath, getUpstreamPath, selectedActivityId]);

  useLayoutEffect(() => {
    const calculateLines = () => {
      if (activeTab !== 'diagram_node' || !containerRef.current || activities.length === 0) return;

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
                zIndex,
                animated: isFlowActive,
              });
            }
          });
        }
      });

      setLines(newLines);
    };

    calculateLines();
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', calculateLines);
    window.addEventListener('resize', calculateLines);
    return () => {
        if (container) container.removeEventListener('scroll', calculateLines);
        window.removeEventListener('resize', calculateLines);
    };
  }, [activities, activeFilters, activeTab, flows, selectedActivityId, getDownstreamPath, getOpacity, getUpstreamPath]);

  // --- NAVEGACIÓN Y SEGURIDAD ---
  const handleEditorTabClick = () => {
      if (isAuthenticated) { setActiveTab('editor'); } else { setShowAuthModal(true); }
  };

  const handleLogin = (e) => {
      e.preventDefault();
      if (passwordInput === ADMIN_PASSWORD) {
          setIsAuthenticated(true);
          setShowAuthModal(false);
          setAuthError('');
          setPasswordInput('');
          setActiveTab('editor');
      } else { setAuthError('Contraseña incorrecta'); }
  };

  const handleStageChange = (stageId) => {
    setIsLoading(true);
    setActiveStage(stageId);
    setSelectedActivityId(null);
    setLines([]);
    setIsEditingActivity(null);
    setInsertBeforeId(null);
    setInsertPhaseId(null);
    setIsDraggingNewActivity(false);
    setDragDropTarget('none');
    setTempFilters({ flow: 'all', role: 'all' });
    setActiveFilters({ flow: 'all', role: 'all' });
    setFormData({ text: '', role: '', duration: '', phaseId: '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
  };

  const applyFilters = () => { setActiveFilters(tempFilters); setSelectedActivityId(null); };
  const clearFilters = () => { const reset = { flow: 'all', role: 'all' }; setTempFilters(reset); setActiveFilters(reset); setSelectedActivityId(null); };

  // --- CRUD A FIREBASE (Guardado en Tiempo Real) ---

  const requestDeleteActivity = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Actividad',
          message: `¿Estás seguro de que deseas eliminar la actividad #${id}?`,
          onConfirm: async () => {
              // 1. Borrar actividad principal
              await deleteDoc(doc(db, getStageColPath(activeStage, 'activities'), id.toString()));
              
              // 2. Limpiar dependencias en otras actividades
              const batch = writeBatch(db);
              activities.forEach(a => {
                  if (a.predecessors.includes(id)) {
                      const updatedPredecessors = a.predecessors.filter(pid => pid !== id);
                      batch.update(doc(db, getStageColPath(activeStage, 'activities'), a.id.toString()), { predecessors: updatedPredecessors });
                  }
              });
              await batch.commit();
              
              if (isEditingActivity === id) setIsEditingActivity(null);
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const requestDeletePhase = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Fase Completa',
          message: '¡Atención! Al borrar esta fase, también se eliminarán TODAS las actividades que pertenecen a ella.',
          onConfirm: async () => {
              const batch = writeBatch(db);
              batch.delete(doc(db, getStageColPath(activeStage, 'phases'), id));
              activities.forEach(a => {
                  if (a.phaseId === id) batch.delete(doc(db, getStageColPath(activeStage, 'activities'), a.id.toString()));
              });
              await batch.commit();
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const requestDeleteFlow = (id) => {
      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar Ruta',
          message: '¿Borrar esta ruta? Las actividades seguirán existiendo, pero perderán su asignación a este flujo.',
          onConfirm: async () => {
              const batch = writeBatch(db);
              batch.delete(doc(db, getStageColPath(activeStage, 'flows'), id));
              activities.forEach(a => {
                  if (a.flows.includes(id)) {
                      const updatedFlows = a.flows.filter(fid => fid !== id);
                      batch.update(doc(db, getStageColPath(activeStage, 'activities'), a.id.toString()), { flows: updatedFlows });
                  }
              });
              await batch.commit();
              setConfirmDialog({ isOpen: false });
          }
      });
  };

  const addPhase = async () => {
     const newId = `p${Date.now()}`;
     const newPhase = { id: newId, title: 'Nueva Fase', color: '#3b82f6' };
     await setDoc(doc(db, getStageColPath(activeStage, 'phases'), newId), newPhase);
  };

  const addFlow = async () => {
      const newId = `ruta_${Date.now()}`;
      const newFlow = { id: newId, label: 'Nueva Ruta', color: '#64748b' };
      await setDoc(doc(db, getStageColPath(activeStage, 'flows'), newId), newFlow);
  };

  const updatePhaseTitle = async (id, newTitle) => {
      await setDoc(doc(db, getStageColPath(activeStage, 'phases'), id), { title: newTitle }, { merge: true });
  };

  const updatePhaseColor = async (id, newColor) => {
      await setDoc(doc(db, getStageColPath(activeStage, 'phases'), id), { color: newColor }, { merge: true });
  };

  const updateFlowLabel = async (id, newLabel) => {
      await setDoc(doc(db, getStageColPath(activeStage, 'flows'), id), { label: newLabel }, { merge: true });
  };

  const resetForm = () => {
    setIsEditingActivity(null);
    setInsertBeforeId(null);
    setInsertPhaseId(null);
    setDragDropTarget('none');
    setIsDraggingNewActivity(false);
    setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
  };

  const startNewActivityDrag = (event) => {
    resetForm();
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'new-activity');
    setIsDraggingNewActivity(true);
  };

  const endNewActivityDrag = () => {
    setIsDraggingNewActivity(false);
    setDragDropTarget('none');
  };

  const handleDragOverInsertion = (event, targetId, phaseId) => {
    if (!isDraggingNewActivity) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragDropTarget(getTargetKey(targetId, phaseId));
  };

  const handleDropInsertion = (event, targetId, phaseId) => {
    if (!isDraggingNewActivity) return;
    event.preventDefault();
    setInsertBeforeId(targetId);
    setInsertPhaseId(phaseId);
    setDragDropTarget(getTargetKey(targetId, phaseId));
    setIsDraggingNewActivity(false);
    setFormData(current => ({ ...current, phaseId }));
  };

  const remapId = (currentId, threshold) => (currentId >= threshold ? currentId + 1 : currentId);

  const saveActivitiesWithReindex = async (newActivity, insertionId, phaseId) => {
    const sortedByIdAsc = [...activities].sort((a, b) => a.id - b.id);
    const nextId = insertionId || (Math.max(0, ...activities.map(a => a.id)) + 1);
    const reindexedExisting = sortedByIdAsc.map(activity => ({
      ...activity,
      id: remapId(activity.id, nextId),
      predecessors: (activity.predecessors || []).map(predId => remapId(predId, nextId)),
    }));

    const newActivityWithId = {
      ...newActivity,
      id: nextId,
      phaseId: phaseId || newActivity.phaseId,
      predecessors: (newActivity.predecessors || []).map(predId => remapId(predId, nextId)),
    };

    const batch = writeBatch(db);
    sortedByIdAsc.forEach(activity => {
      batch.delete(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()));
    });

    [...reindexedExisting, newActivityWithId].forEach(activity => {
      batch.set(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()), activity);
    });

    await batch.commit();
  };
  
  const handleSaveActivity = async () => {
    let preds = formData.predecessors;
    if (typeof preds === 'string') { preds = preds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); }
    
    const newActivity = { ...formData, predecessors: preds };

    if (isEditingActivity) {
      const docId = isEditingActivity.toString();
      newActivity.id = parseInt(docId);
      await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), newActivity);
    } else {
      await saveActivitiesWithReindex(newActivity, insertBeforeId, insertPhaseId);
    }

    resetForm();
  };

  const startEdit = (activity) => {
    setIsEditingActivity(activity.id);
    setInsertBeforeId(null);
    setInsertPhaseId(null);
    setFormData({ ...activity, origin: activity.origin || '', condition: activity.condition || '', flows: activity.flows || ['all'], predecessors: activity.predecessors || [] });
    setActiveTab('editor');
  };

  // --- PANTALLA DE CARGA ---
  if (isLoading) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
              <Network className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
              <h2 className="text-slate-600 font-bold">Conectando con la base de datos...</h2>
          </div>
      );
  }

  // --- COMPONENTES VISUALES ---
  const NodeCard = ({ activity }) => {
    const isSelected = selectedActivityId === activity.id;
    const opacityClass = getOpacity(activity);
    if (opacityClass === 'hidden') return null;
    
    const phaseObj = phases.find(p => p.id === activity.phaseId);
    const phaseColor = getPhaseHexColor(phaseObj);
    const isDecision = activity.type === 'decision';
    const displayNumber = displayOrderByActivityId[activity.id] || 0;
    
    const shapeClasses = isDecision 
        ? 'w-10 h-10 rotate-45 border-2 rounded-sm text-white' 
        : `w-10 h-10 rounded-full border-2 border-white shadow-md text-white`;
        
    const customStyle = isDecision 
        ? { backgroundColor: '#9ca3af', borderColor: '#6b7280' } 
        : { backgroundColor: phaseColor };
        
    const contentRotate = isDecision ? '-rotate-45' : '';

    return (
      <div ref={el => nodeRefs.current[activity.id] = el} className={`group relative flex items-center justify-center mb-8 transition-all duration-300 ${opacityClass}`} style={{ zIndex: isSelected ? 100 : 20 }}>
        <div 
            onClick={(e) => { e.stopPropagation(); setSelectedActivityId(isSelected ? null : activity.id); }}
            className={`flex items-center justify-center font-bold text-xs cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 shadow-sm ${shapeClasses} ${isSelected ? 'ring-4 ring-offset-2 ring-blue-300' : ''}`}
            style={customStyle}
        >
            <span className={`${contentRotate}`}>{displayNumber}</span>
        </div>
        <div className={`absolute left-16 top-1/2 -translate-y-1/2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 transition-all duration-300 pointer-events-none origin-left z-[101] ${isSelected ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-x-4 pointer-events-none'}`}>
            <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white border-b-[6px] border-b-transparent drop-shadow-sm"></div>
            <div className="flex justify-between items-center p-3 border-b border-slate-50 bg-slate-50/50 rounded-t-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isDecision ? 'Decisión' : 'Actividad'} #{displayNumber}</span>
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
                  <p className="text-sm text-center text-slate-500 mb-6">Ingresa la contraseña para acceder al editor.</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <input 
                              type="password" autoFocus placeholder="Contraseña"
                              className={`w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${authError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`}
                              value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
                          />
                          {authError && <p className="text-xs text-red-500 mt-1 font-medium">{authError}</p>}
                      </div>
                      <div className="flex gap-3">
                          <button type="button" onClick={() => { setShowAuthModal(false); setAuthError(''); setPasswordInput(''); }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg font-bold hover:bg-slate-200">Cancelar</button>
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center gap-2"><Unlock className="w-4 h-4"/> Entrar</button>
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
                      <button onClick={() => setConfirmDialog({ isOpen: false })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">Cancelar</button>
                      <button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg hover:bg-red-700">Sí, eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-40">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-lg shadow-lg"><Network className="w-5 h-5 text-white" /></div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">Mapa de Procesos</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Gestión CECP · {processStages.find(stage => stage.id === activeStage)?.title}</p>
              </div>
            </div>

            {/* NAVEGACIÓN PRINCIPAL */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full xl:w-auto">
              <button onClick={() => setActiveTab('diagram_node')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all flex-1 xl:flex-none ${activeTab === 'diagram_node' ? 'bg-white text-blue-700 shadow ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Network className="w-3 h-3"/> Diagrama</button>
              <button onClick={() => setActiveTab('diagram_list')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all flex-1 xl:flex-none ${activeTab === 'diagram_list' ? 'bg-white text-blue-700 shadow ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Layout className="w-3 h-3"/> Lista</button>
              <button onClick={handleEditorTabClick} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all flex-1 xl:flex-none ${activeTab === 'editor' ? 'bg-amber-100 text-amber-800 shadow ring-1 ring-amber-300' : 'text-slate-500 hover:text-slate-700'}`}>
                {isAuthenticated ? <Edit2 className="w-3 h-3 text-amber-600"/> : <Lock className="w-3 h-3"/>} Editor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.15fr_0.85fr] gap-3">
            {/* ETAPAS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-2">Etapas del proceso</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {processStages.map(stage => {
                  const isActive = stage.id === activeStage;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => handleStageChange(stage.id)}
                      className={`text-left rounded-xl border p-2.5 transition-all ${isActive ? 'border-transparent text-white shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className={`rounded-lg p-2 ${isActive ? `bg-gradient-to-r ${stage.color}` : 'bg-slate-50'}`}>
                        <p className={`text-xs font-extrabold uppercase tracking-wide ${isActive ? 'text-white/90' : 'text-slate-500'}`}>{stage.title}</p>
                        <p className={`text-[10px] mt-1 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{stage.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FILTROS */}
            {activeTab !== 'editor' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-2">Filtros de visualización</p>
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <div className="flex items-center gap-2 px-2 border-r border-slate-300">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <select value={tempFilters.flow} onChange={(e) => setTempFilters({...tempFilters, flow: e.target.value})} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-1 pl-0 pr-6 w-36 sm:w-44 truncate hover:text-blue-600 transition-colors">
                      <option value="all">Todas las Rutas</option>
                      {flows.map(f => <option key={f.id} value={f.id}>{f.label.replace('Ruta: ', '')}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 px-2 border-r border-slate-300">
                    <Users className="w-4 h-4 text-purple-600" />
                    <select value={tempFilters.role} onChange={(e) => setTempFilters({...tempFilters, role: e.target.value})} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-1 pl-0 pr-6 w-32 sm:w-36 truncate hover:text-purple-600 transition-colors">
                      <option value="all">Todos los Roles</option>
                      {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1 ml-auto sm:ml-0">
                    <button onClick={applyFilters} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition-transform active:scale-95">Filtrar</button>
                    <button onClick={clearFilters} className="bg-white text-slate-500 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-bold hover:text-red-600 hover:border-red-200 shadow-sm transition-transform active:scale-95"><RotateCcw className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-hidden relative flex bg-slate-50">
        
        {/* DIAGRAMA NODOS */}
        {activeTab === 'diagram_node' && (
          <div className="flex-1 h-full overflow-auto relative cursor-grab active:cursor-grabbing" ref={containerRef} onClick={() => setSelectedActivityId(null)}>
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
               {phases.map((phase, idx) => {
                  const phaseColor = getPhaseHexColor(phase);
                  return (
                  <div key={phase.id} className="w-24 flex flex-col h-full items-center">
                      <div className="mb-10 sticky top-0 z-30 w-full flex flex-col items-center">
                          <div className={`border-b-4 px-4 py-2 rounded-t-lg shadow-sm text-center min-w-[140px]`} style={{ borderBottomColor: phaseColor, backgroundColor: `${phaseColor}15` }}>
                              <span className="block text-[10px] font-bold uppercase mb-0.5" style={{ color: phaseColor }}>FASE {idx + 1}</span>
                              <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wide">{phase.title.replace(/^\d+\.\s/, '')}</h2>
                          </div>
                          <div className="w-px h-full bg-slate-200 absolute top-full mt-0 -z-10"></div>
                      </div>
                      <div className="flex-1 w-full flex flex-col items-center pb-20 pt-4 space-y-4">
                          {getPhaseSortedActivities(phase.id).map(act => (
                              <NodeCard key={act.id} activity={act} />
                          ))}
                      </div>
                  </div>
               )})}
               <div className="flex flex-col justify-center h-full pb-32 ml-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 bg-white flex items-center justify-center shadow-inner group">
                      <span className="font-bold text-xs text-slate-300 group-hover:text-red-500 transition-colors">FIN</span>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* LISTA VISTA COMPLETAMENTE REDISEÑADA */}
        {activeTab === 'diagram_list' && (
             <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 p-6 md:p-10 scroll-smooth relative" onClick={() => setSelectedActivityId(null)}>
                <div className="max-w-6xl mx-auto space-y-12 pb-24">
                    {phases.map((phase, index) => {
                        const phaseActivities = getPhaseSortedActivities(phase.id);
                        if(phaseActivities.length === 0) return null;
                        
                        const phaseColor = getPhaseHexColor(phase);
                        
                        return (
                            <div key={phase.id} className="relative">
                                {/* Encabezado de la Fase estilo Timeline */}
                                <div className="flex items-center gap-4 mb-6 sticky top-0 bg-slate-50/90 backdrop-blur-sm py-2 z-20">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm`} style={{ backgroundColor: phaseColor }}>
                                        {index + 1}
                                    </div>
                                    <h3 className="font-bold text-xl text-slate-800 tracking-tight">{phase.title}</h3>
                                    <div className="h-px flex-1 bg-slate-200 ml-4"></div>
                                </div>

                                {/* Cuadrícula de Tarjetas de Información */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pl-4 md:pl-14">
                                    {phaseActivities.map(act => {
                                        if (getOpacity(act) === 'hidden') return null;
                                        
                                        return (
                                            <div key={act.id} className="group relative bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all flex flex-col h-full overflow-hidden">
                                                {/* Línea indicadora de herencia de color */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: phaseColor }}></div>
                                                
                                                {/* Header de la Tarjeta */}
                                                <div className="flex justify-between items-start mb-3 pl-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md tracking-wider">N°: {displayOrderByActivityId[act.id] || 0}</span>
                                                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${roleBadges[act.role] || 'bg-slate-100 text-slate-600'}`}>
                                                            {act.role}
                                                        </span>
                                                    </div>
                                                    {act.duration && act.duration !== 'N/A' && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                            <Clock className="w-3 h-3"/> {act.duration}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Título / Descripción */}
                                                <p className="text-sm font-semibold text-slate-800 mb-4 pl-2 leading-relaxed flex-1">
                                                    {act.text}
                                                </p>

                                                {/* Meta información compacta en el fondo de la tarjeta */}
                                                <div className="flex flex-col gap-2 pl-2 mt-auto">
                                                    {/* Condicional */}
                                                    {act.condition && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-100 font-medium w-full">
                                                            <CornerDownRight className="w-3.5 h-3.5 flex-shrink-0" />
                                                            <span className="truncate" title={act.condition}>{act.condition}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Badges de Rutas y Dependencias */}
                                                    <div className="flex flex-wrap gap-2">
                                                        {act.predecessors && act.predecessors.length > 0 && (
                                                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                                <GitBranch className="w-3 h-3 text-slate-400" />
                                                                <span>Dep: {act.predecessors.join(', ')}</span>
                                                            </div>
                                                        )}
                                                        {act.flows && act.flows.length > 0 && (
                                                            <div 
                                                              className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100" 
                                                              title={act.flows.map(fId => flows.find(f => f.id === fId)?.label).join(', ')}
                                                            >
                                                                <Network className="w-3 h-3 text-slate-400" />
                                                                <span>{act.flows.length} {act.flows.length === 1 ? 'Ruta' : 'Rutas'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                    {phases.map((phase) => {
                      const phaseColor = getPhaseHexColor(phase);
                      return (
                      <div key={phase.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer relative shadow-inner">
                            <input 
                                type="color" 
                                value={phaseColor} 
                                onChange={(e) => updatePhaseColor(phase.id, e.target.value)}
                                className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                                title="Cambiar color de la fase"
                            />
                        </div>
                        <input className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500" value={phase.title} onChange={(e) => updatePhaseTitle(phase.id, e.target.value)} />
                        <button type="button" onClick={() => requestDeletePhase(phase.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    )})}
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
                  <div className="space-y-4">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Inventario</h3>
                        <button
                          draggable
                          onDragStart={startNewActivityDrag}
                          onDragEnd={endNewActivityDrag}
                          onClick={resetForm}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all cursor-grab active:cursor-grabbing"
                          title="Arrastra para insertar por posición o haz click para agregar al final"
                        >
                          + Nueva
                        </button>
                     </div>
                     {phases.map((phase) => {
                        const phaseActivities = getPhaseSortedActivities(phase.id);
                        const phaseColor = getPhaseHexColor(phase);
                        return (
                          <div key={phase.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: phaseColor }}>
                              {phase.title}
                            </div>

                            {isDraggingNewActivity && phaseActivities.length > 0 && (
                              <div
                                onDragOver={(event) => handleDragOverInsertion(event, phaseActivities[0].id, phase.id)}
                                onDrop={(event) => handleDropInsertion(event, phaseActivities[0].id, phase.id)}
                                className={`mb-1 h-8 rounded-md border-2 border-dashed text-[11px] font-bold transition-all flex items-center justify-center ${dragDropTarget === getTargetKey(phaseActivities[0].id, phase.id) ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-400 bg-white'}`}
                              >
                                Insertar al inicio de {phase.title}
                              </div>
                            )}

                            {phaseActivities.map(act => (
                              <React.Fragment key={act.id}>
                                {isDraggingNewActivity && (
                                  <div
                                    onDragOver={(event) => handleDragOverInsertion(event, act.id, phase.id)}
                                    onDrop={(event) => handleDropInsertion(event, act.id, phase.id)}
                                    className={`h-3 rounded transition-all ${dragDropTarget === getTargetKey(act.id, phase.id) ? 'bg-emerald-200' : 'bg-transparent'}`}
                                  />
                                )}
                                <div
                                  onClick={() => startEdit(act)}
                                  className={`relative p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer transition-all ${isEditingActivity === act.id ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-50' : ''} ${insertBeforeId === act.id ? 'ring-2 ring-emerald-300 border-emerald-400' : ''}`}
                                >
                                    <div className="pr-6">
                                        <p className="text-xs font-bold text-slate-700 truncate">{act.text}</p>
                                        <span className="text-[10px] text-slate-400">ID: {act.id}</span>
                                    </div>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActivity(act.id); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </React.Fragment>
                            ))}

                            {isDraggingNewActivity && (
                              <div
                                onDragOver={(event) => handleDragOverInsertion(event, null, phase.id)}
                                onDrop={(event) => handleDropInsertion(event, null, phase.id)}
                                className={`mt-1 p-2 border-2 border-dashed rounded-lg text-[11px] font-bold transition-all ${dragDropTarget === getTargetKey(null, phase.id) ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-white'}`}
                              >
                                Soltar al final de {phase.title}
                              </div>
                            )}
                          </div>
                        );
                     })}
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
               {!isEditingActivity && insertBeforeId && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    La nueva actividad se insertará en la fase {phases.find(p => p.id === insertPhaseId)?.title || 'seleccionada'} en la posición del ID {insertBeforeId}.
                  </div>
               )}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Rol Responsable</label>
                         <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})}>
                             <option value="">Seleccionar...</option>
                             {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Duración</label>
                         <input
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej: 3 días"
                            value={formData.duration}
                            onChange={e => setFormData({...formData, duration: e.target.value})}
                         />
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
                      {(isEditingActivity || insertBeforeId) && (<button onClick={resetForm} className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>)}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
