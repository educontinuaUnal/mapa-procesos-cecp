import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { 
  Layout, Plus, Trash2, Edit2, Save, Network, Clock, Filter, 
  CornerDownRight, RotateCcw, Users, AlertTriangle, Lock, Unlock, CheckCircle2, GitBranch, ChevronUp, ChevronDown
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";

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
const getRolesColPath = () => `artifacts/${APP_ID}/public/data/roles`;
const ACTIVITY_REF_PREFIX = 'ACT-';
const formatActivityRef = (value) => `${ACTIVITY_REF_PREFIX}${String(value).padStart(3, '0')}`;
const getActivityRefNumber = (activityRef = '') => {
  const match = `${activityRef}`.match(/^(?:ACT-)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
};

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

const roleDefaults = [
  { id: 'role_gt', name: 'GT', color: '#dbeafe', textColor: '#1d4ed8' },
  { id: 'role_ga', name: 'GA', color: '#d1fae5', textColor: '#047857' },
  { id: 'role_gom', name: 'GOM', color: '#fef3c7', textColor: '#b45309' },
  { id: 'role_gca', name: 'GCA', color: '#f3e8ff', textColor: '#7e22ce' },
  { id: 'role_dc', name: 'DC', color: '#ffe4e6', textColor: '#be123c' },
  { id: 'role_gp', name: 'GP', color: '#cffafe', textColor: '#0e7490' },
  { id: 'role_director', name: 'Director', color: '#f1f5f9', textColor: '#334155' },
  { id: 'role_sistema', name: 'Sistema', color: '#f3f4f6', textColor: '#374151' },
];

const rolePalette = [
  { color: '#dbeafe', textColor: '#1d4ed8' },
  { color: '#d1fae5', textColor: '#047857' },
  { color: '#fef3c7', textColor: '#b45309' },
  { color: '#fce7f3', textColor: '#be185d' },
  { color: '#e9d5ff', textColor: '#7e22ce' },
  { color: '#cffafe', textColor: '#0e7490' },
  { color: '#e0e7ff', textColor: '#4338ca' },
  { color: '#fee2e2', textColor: '#b91c1c' },
  { color: '#f1f5f9', textColor: '#334155' },
];

const ADMIN_PASSWORD = "admin123";

const getReadableTextColor = (hexColor) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#334155';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#f8fafc';
};

// Función inteligente para migrar colores viejos de la base de datos a los nuevos códigos HEX
const getPhaseHexColor = (phase) => {
    if (!phase) return '#cbd5e1';
    if (phase.color && phase.color.startsWith('#')) return phase.color;
    // Compatibilidad con la versión anterior guardada en tu Firebase
    const oldColors = { 'bg-blue-100': '#3b82f6', 'bg-indigo-100': '#6366f1', 'bg-purple-100': '#a855f7', 'bg-fuchsia-100': '#d946ef', 'bg-pink-100': '#ec4899', 'bg-rose-100': '#f43f5e' };
    const matched = phase.color ? Object.keys(oldColors).find(key => phase.color.includes(key)) : null;
    return matched ? oldColors[matched] : '#3b82f6';
};

const buildEmptyFormData = (phaseId = '') => ({
  text: '',
  description: '',
  role: '',
  support_roles: [],
  duration: '',
  phaseId,
  type: 'process',
  predecessors: [],
  flows: ['all'],
  origin: '',
  condition: '',
  activity_roles: [],
});

const normalizeRole = (role) => {
  const name = role.name || role.label || role.role || role.id || '';
  const color = role.color || '#e2e8f0';
  const textColor = role.textColor || getReadableTextColor(color);
  return { ...role, name, color, textColor };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('diagram_node');
  const [activeStage, setActiveStage] = useState('formulacion');
  
  // Estados de Base de Datos
  const [phases, setPhases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [flows, setFlows] = useState([]);
  const [roles, setRoles] = useState(() => roleDefaults.map(normalizeRole));
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
  const [tempSearch, setTempSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [lines, setLines] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  
  const nodeRefs = useRef({});
  const containerRef = useRef(null);
  const initializedRef = useRef({});
  const rolesInitializedRef = useRef(false);
  const nextActivityRefCounter = useRef(1);

  // Estados de Edición
  const [isEditingActivity, setIsEditingActivity] = useState(null);
  const [managementMode, setManagementMode] = useState('activities');
  const [formData, setFormData] = useState(() => buildEmptyFormData(''));
  const [insertBeforeId, setInsertBeforeId] = useState(null);
  const [insertPhaseId, setInsertPhaseId] = useState(null);
  const [isDraggingNewActivity, setIsDraggingNewActivity] = useState(false);
  const [draggedActivityId, setDraggedActivityId] = useState(null);
  const [dragDropTarget, setDragDropTarget] = useState('none');

  const ORDER_GAP = 1024;
  const phaseOrderMap = useMemo(
    () => Object.fromEntries(phases.map((phase, index) => [phase.id, index])),
    [phases]
  );
  const roleByName = useMemo(
    () => Object.fromEntries(roles.map(role => [role.name, role])),
    [roles]
  );
  const availableRoles = useMemo(
    () => roles.map(role => role.name),
    [roles]
  );

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => {
      const phaseOrderA = phaseOrderMap[a.phaseId] ?? Number.MAX_SAFE_INTEGER;
      const phaseOrderB = phaseOrderMap[b.phaseId] ?? Number.MAX_SAFE_INTEGER;
      if (phaseOrderA !== phaseOrderB) return phaseOrderA - phaseOrderB;
      const aOrder = a.order_index ?? (a.id * ORDER_GAP);
      const bOrder = b.order_index ?? (b.id * ORDER_GAP);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id - b.id;
    }),
    [activities, phaseOrderMap]
  );

  const activitiesByPhase = useMemo(() => {
    const map = new Map();
    sortedActivities.forEach(activity => {
      if (!map.has(activity.phaseId)) map.set(activity.phaseId, []);
      map.get(activity.phaseId).push(activity);
    });
    return map;
  }, [sortedActivities]);
  const getPhaseSortedActivities = (phaseId) => activitiesByPhase.get(phaseId) || [];
  const getActivityRoles = useCallback((activity) => {
    if (Array.isArray(activity.activity_roles) && activity.activity_roles.length > 0) return activity.activity_roles;
    const roles = [];
    if (activity.role) {
      roles.push({ id: `legacy-primary-${activity.id}`, activity_id: activity.id, role_name: activity.role, role_type: 'PRIMARY' });
    }
    if (Array.isArray(activity.support_roles)) {
      activity.support_roles.forEach((roleName, index) => {
        roles.push({ id: `legacy-support-${activity.id}-${index}`, activity_id: activity.id, role_name: roleName, role_type: 'SUPPORT' });
      });
    }
    return roles;
  }, []);
  const getRoleBadgeStyle = useCallback((roleName) => {
    if (!roleName) return { backgroundColor: '#f1f5f9', color: '#475569' };
    const role = roleByName[roleName];
    const color = role?.color || '#e2e8f0';
    const textColor = role?.textColor || getReadableTextColor(color);
    return { backgroundColor: color, color: textColor };
  }, [roleByName]);
  const getPrimaryRoleName = useCallback((activity) => getActivityRoles(activity).find(role => role.role_type === 'PRIMARY')?.role_name || activity.role || '', [getActivityRoles]);
  const getSupportRoleNames = useCallback((activity) => getActivityRoles(activity).filter(role => role.role_type === 'SUPPORT').map(role => role.role_name), [getActivityRoles]);
  const normalizeActivityModel = useCallback((activity) => {
    const roles = getActivityRoles(activity);
    return {
      ...activity,
      role: getPrimaryRoleName(activity),
      activity_roles: roles,
    };
  }, [getActivityRoles, getPrimaryRoleName]);

  const getTargetKey = (targetId, phaseId) => (targetId === null ? `end:${phaseId}` : `before:${targetId}`);
  const displayOrderByActivityId = useMemo(() => {
    const result = {};
    sortedActivities.forEach((activity, index) => {
      result[activity.id] = index + 1;
    });
    return result;
  }, [sortedActivities]);

  const maxActivityRefNumber = useMemo(
    () => activities.reduce((max, activity) => Math.max(max, getActivityRefNumber(activity.activity_ref)), 0),
    [activities]
  );

  useEffect(() => {
    const roleSet = new Set(availableRoles);
    if (tempFilters.role !== 'all' && !roleSet.has(tempFilters.role)) {
      setTempFilters(current => ({ ...current, role: 'all' }));
    }
    if (activeFilters.role !== 'all' && !roleSet.has(activeFilters.role)) {
      setActiveFilters(current => ({ ...current, role: 'all' }));
    }
  }, [availableRoles, tempFilters.role, activeFilters.role]);

  useEffect(() => {
    nextActivityRefCounter.current = Math.max(nextActivityRefCounter.current, maxActivityRefNumber + 1);
  }, [maxActivityRefNumber]);

  const activitiesById = useMemo(
    () => Object.fromEntries(activities.map(activity => [activity.id, activity])),
    [activities]
  );

  const childrenByPredecessorId = useMemo(() => {
    const map = new Map();
    activities.forEach(activity => {
      (activity.predecessors || []).forEach((predecessorId) => {
        if (!map.has(predecessorId)) map.set(predecessorId, []);
        map.get(predecessorId).push(activity.id);
      });
    });
    return map;
  }, [activities]);

  const activityRefById = useMemo(() => {
    const result = {};
    activities.forEach(activity => {
      if (activity.activity_ref) {
        result[activity.id] = activity.activity_ref;
      }
    });
    return result;
  }, [activities]);

  const editingActivityRef = isEditingActivity
    ? (activityRefById[isEditingActivity] || `ID-${isEditingActivity}`)
    : '';
  const editingActivityOrder = isEditingActivity
    ? (displayOrderByActivityId[isEditingActivity] || isEditingActivity)
    : '';

  const matchesSearch = useCallback((activity) => {
    if (activeTab !== 'diagram_list') return true;
    if (!activeSearch.trim()) return true;
    const query = activeSearch.trim().toLowerCase();
    const roleNames = getActivityRoles(activity).map(role => role.role_name).join(' ').toLowerCase();
    const haystack = [
      activityRefById[activity.id] || '',
      activity.text || '',
      activity.description || '',
      activity.origin || '',
      activity.condition || '',
      roleNames,
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  }, [activeSearch, activityRefById, getActivityRoles, activeTab]);

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
    let isDisposed = false;
    const rolesCol = collection(db, getRolesColPath());
    const unsubscribe = onSnapshot(rolesCol, async (snapshot) => {
      if (isDisposed) return;
      let data = snapshot.docs.map(roleDoc => normalizeRole({ id: roleDoc.id, ...roleDoc.data() }));
      if (data.length === 0 && !rolesInitializedRef.current) {
        rolesInitializedRef.current = true;
        const batch = writeBatch(db);
        roleDefaults.forEach(role => batch.set(doc(db, getRolesColPath(), role.id), role));
        await batch.commit();
        data = roleDefaults.map(normalizeRole);
      }
      data.sort((a, b) => a.name.localeCompare(b.name));
      setRoles(data);
    }, (error) => console.error(error));

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let isDisposed = false;
    let unsubFlows = () => {};
    let unsubPhases = () => {};
    let unsubActs = () => {};

    const stageColPath = (colName) => getStageColPath(activeStage, colName);
    const stageDefaultsData = stageDefaults[activeStage];

    const bootstrapStageData = async () => {
      initializedRef.current[activeStage] = true;
      const batch = writeBatch(db);
      stageDefaultsData.flows.forEach(f => batch.set(doc(db, stageColPath('flows'), f.id), f));
      stageDefaultsData.phases.forEach(p => batch.set(doc(db, stageColPath('phases'), p.id), p));
      stageDefaultsData.activities.forEach((a, index) => {
        const activity_ref = formatActivityRef(index + 1);
        batch.set(doc(db, stageColPath('activities'), a.id.toString()), { ...a, order_index: (index + 1) * ORDER_GAP, activity_ref });
      });
      await batch.commit();
      nextActivityRefCounter.current = Math.max(nextActivityRefCounter.current, stageDefaultsData.activities.length + 1);
    };

    const listen = async () => {
      unsubFlows = onSnapshot(collection(db, stageColPath('flows')), (snapshot) => {
        let data = snapshot.docs.map(doc => doc.data());
        if (data.length === 0 && !initializedRef.current[activeStage]) {
          data = stageDefaultsData.flows;
        }
        setFlows(data);
      }, (error) => console.error(error));

      unsubPhases = onSnapshot(collection(db, stageColPath('phases')), (snapshot) => {
        let data = snapshot.docs.map(doc => doc.data());
        data.sort((a, b) => a.title.localeCompare(b.title));
        if (data.length === 0 && !initializedRef.current[activeStage]) {
          data = stageDefaultsData.phases;
        }
        setPhases(data);
      }, (error) => console.error(error));

      unsubActs = onSnapshot(collection(db, stageColPath('activities')), async (snapshot) => {
        if (isDisposed) return;
        let data = snapshot.docs.map(currentDoc => currentDoc.data());

        if (data.length === 0 && !initializedRef.current[activeStage]) {
          await bootstrapStageData();
          if (isDisposed) return;
          data = stageDefaultsData.activities.map((a, index) => ({ ...a, order_index: (index + 1) * ORDER_GAP, activity_ref: formatActivityRef(index + 1) }));
        }

        const phaseBuckets = new Map();
        data.forEach(activity => {
          if (!phaseBuckets.has(activity.phaseId)) phaseBuckets.set(activity.phaseId, []);
          phaseBuckets.get(activity.phaseId).push(activity);
        });

        const batch = writeBatch(db);
        let hasActivityFixes = false;
        let maxRef = data.reduce((max, activity) => Math.max(max, getActivityRefNumber(activity.activity_ref)), 0);

        phaseBuckets.forEach((phaseActivities) => {
          phaseActivities.sort((a, b) => a.id - b.id);
          phaseActivities.forEach((activity, index) => {
            const updates = {};
            if (typeof activity.order_index !== 'number') {
              updates.order_index = (index + 1) * ORDER_GAP;
              activity.order_index = updates.order_index;
            }
            if (!activity.activity_ref) {
              maxRef += 1;
              updates.activity_ref = formatActivityRef(maxRef);
              activity.activity_ref = updates.activity_ref;
            }
            if (Object.keys(updates).length > 0) {
              hasActivityFixes = true;
              batch.set(doc(db, stageColPath('activities'), activity.id.toString()), updates, { merge: true });
            }
          });
        });

        if (hasActivityFixes) {
          await batch.commit();
          if (isDisposed) return;
        }

        nextActivityRefCounter.current = Math.max(nextActivityRefCounter.current, maxRef + 1);
        setActivities(data.map(normalizeActivityModel));
        setIsLoading(false);
      }, (error) => console.error(error));
    };

    listen();
    return () => {
      isDisposed = true;
      unsubFlows();
      unsubPhases();
      unsubActs();
    };
  }, [user, activeStage, normalizeActivityModel]);


  const getDownstreamPath = useCallback((startId) => {
    const path = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift();
      const children = childrenByPredecessorId.get(current) || [];
      children.forEach((childId) => {
        if (!path.has(childId)) {
          path.add(childId);
          queue.push(childId);
        }
      });
    }
    return path;
  }, [childrenByPredecessorId]);

  const getUpstreamPath = useCallback((startId) => {
    const path = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift();
      const activity = activitiesById[current];
      (activity?.predecessors || []).forEach((predecessorId) => {
        if (!path.has(predecessorId)) {
          path.add(predecessorId);
          queue.push(predecessorId);
        }
      });
    }
    return path;
  }, [activitiesById]);

  const getOpacity = useCallback((act) => {
    const matchesFlow = activeFilters.flow === 'all' || (act.flows && act.flows.includes(activeFilters.flow));
    const matchesRole = activeFilters.role === 'all' || getActivityRoles(act).some(role => role.role_name === activeFilters.role);
    const matchesSearchQuery = matchesSearch(act);
    if (!matchesFlow || !matchesRole || !matchesSearchQuery) return 'hidden';
    if (selectedActivityId) {
      const downstream = getDownstreamPath(selectedActivityId);
      const upstream = getUpstreamPath(selectedActivityId);
      if (downstream.has(act.id) || upstream.has(act.id)) return 'opacity-100 scale-100';
      return 'opacity-20 grayscale';
    }
    return 'opacity-100';
  }, [activeFilters.flow, activeFilters.role, getActivityRoles, matchesSearch, getDownstreamPath, getUpstreamPath, selectedActivityId]);

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
            const predAct = activitiesById[predId];

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
  }, [activities, activitiesById, activeFilters, activeTab, flows, selectedActivityId, getDownstreamPath, getOpacity, getUpstreamPath]);

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
    setDraggedActivityId(null);
    setDragDropTarget('none');
    setTempFilters({ flow: 'all', role: 'all' });
    setActiveFilters({ flow: 'all', role: 'all' });
    setTempSearch('');
    setActiveSearch('');
    setFormData(buildEmptyFormData(''));
  };

  const applyFilters = () => { setActiveFilters(tempFilters); setActiveSearch(tempSearch); setSelectedActivityId(null); };
  const clearFilters = () => { const reset = { flow: 'all', role: 'all' }; setTempFilters(reset); setActiveFilters(reset); setTempSearch(''); setActiveSearch(''); setSelectedActivityId(null); };

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

  const commitActivityRoleUpdates = async (updates) => {
    const chunks = [];
    for (let i = 0; i < updates.length; i += 450) {
      chunks.push(updates.slice(i, i + 450));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(({ stageId, activityId, data }) => {
        batch.set(doc(db, getStageColPath(stageId, 'activities'), activityId), data, { merge: true });
      });
      await batch.acommit();
    }
  };

  const renameRoleAcrossStages = async (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    const updates = [];
    for (const stage of processStages) {
      const snapshot = await getDocs(collection(db, getStageColPath(stage.id, 'activities')));
      snapshot.forEach((activityDoc) => {
        const activity = activityDoc.data();
        let changed = false;
        const update = {};

        if (activity.role === oldName) {
          update.role = newName;
          changed = true;
        }

        if (Array.isArray(activity.support_roles)) {
          const updatedSupport = activity.support_roles.map(role => role === oldName ? newName : role);
          if (updatedSupport.join('|') !== activity.support_roles.join('|')) {
            update.support_roles = updatedSupport;
            changed = true;
          }
        }

        if (Array.isArray(activity.activity_roles)) {
          const updatedRoles = activity.activity_roles.map(role => (
            role.role_name === oldName ? { ...role, role_name: newName } : role
          ));
          if (JSON.stringify(updatedRoles) !== JSON.stringify(activity.activity_roles)) {
            update.activity_roles = updatedRoles;
            changed = true;
          }
        }

        if (changed) {
          updates.push({ stageId: stage.id, activityId: activityDoc.id, data: update });
        }
      });
    }
    if (updates.length > 0) await commitActivityRoleUpdates(updates);
  };

  const removeRoleAcrossStages = async (roleName) => {
    if (!roleName) return;
    const updates = [];
    for (const stage of processStages) {
      const snapshot = await getDocs(collection(db, getStageColPath(stage.id, 'activities')));
      snapshot.forEach((activityDoc) => {
        const activity = activityDoc.data();
        let changed = false;
        const update = {};

        if (activity.role === roleName) {
          update.role = '';
          changed = true;
        }

        if (Array.isArray(activity.support_roles)) {
          const updatedSupport = activity.support_roles.filter(role => role !== roleName);
          if (updatedSupport.length !== activity.support_roles.length) {
            update.support_roles = updatedSupport;
            changed = true;
          }
        }

        if (Array.isArray(activity.activity_roles)) {
          const updatedRoles = activity.activity_roles.filter(role => role.role_name !== roleName);
          if (updatedRoles.length !== activity.activity_roles.length) {
            update.activity_roles = updatedRoles;
            changed = true;
          }
        }

        if (changed) {
          updates.push({ stageId: stage.id, activityId: activityDoc.id, data: update });
        }
      });
    }
    if (updates.length > 0) await commitActivityRoleUpdates(updates);
  };

  const addRole = async () => {
    const palette = rolePalette[roles.length % rolePalette.length];
    const newRole = {
      id: `role_${Date.now()}`,
      name: 'Nuevo Rol',
      color: palette.color,
      textColor: palette.textColor,
    };
    await setDoc(doc(db, getRolesColPath(), newRole.id), newRole);
    setRoleDrafts(current => ({ ...current, [newRole.id]: newRole.name }));
  };

  const updateRoleColor = async (roleId, newColor) => {
    await setDoc(
      doc(db, getRolesColPath(), roleId),
      { color: newColor, textColor: getReadableTextColor(newColor) },
      { merge: true }
    );
  };

  const commitRoleRename = async (role, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === role.name) {
      setRoleDrafts(current => ({ ...current, [role.id]: role.name }));
      return;
    }
    await setDoc(doc(db, getRolesColPath(), role.id), { name: trimmed }, { merge: true });
    await renameRoleAcrossStages(role.name, trimmed);
    setRoleDrafts(current => ({ ...current, [role.id]: trimmed }));
  };

  const requestDeleteRole = (role) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Rol',
      message: `¿Eliminar el rol "${role.name}"? Se eliminará de todas las actividades.`,
      onConfirm: async () => {
        await deleteDoc(doc(db, getRolesColPath(), role.id));
        await removeRoleAcrossStages(role.name);
        setConfirmDialog({ isOpen: false });
      }
    });
  };

  const resetForm = () => {
    setIsEditingActivity(null);
    setInsertBeforeId(null);
    setInsertPhaseId(null);
    setDragDropTarget('none');
    setIsDraggingNewActivity(false);
    setDraggedActivityId(null);
    setFormData(buildEmptyFormData(phases[0]?.id || ''));
  };

  const getOrderedActivitiesForPhase = (phaseId, excludeActivityId = null) => {
    return getPhaseSortedActivities(phaseId).filter(activity => activity.id !== excludeActivityId);
  };

  const rebalancePhaseOrderIndexes = async (phaseId, excludeActivityId = null) => {
    const phaseActivities = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
    const batch = writeBatch(db);
    phaseActivities.forEach((activity, index) => {
      const order_index = (index + 1) * ORDER_GAP;
      if (activity.order_index !== order_index) {
        batch.set(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()), { order_index }, { merge: true });
      }
    });
    await batch.commit();
  };

  const calculateOrderIndex = async (phaseId, beforeActivityId = null, excludeActivityId = null) => {
    const phaseActivities = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
    const targetIndex = beforeActivityId === null
      ? phaseActivities.length
      : phaseActivities.findIndex(activity => activity.id === beforeActivityId);

    const insertionIndex = targetIndex === -1 ? phaseActivities.length : targetIndex;
    const prev = phaseActivities[insertionIndex - 1] || null;
    const next = phaseActivities[insertionIndex] || null;

    const prevOrder = prev ? prev.order_index : null;
    const nextOrder = next ? next.order_index : null;

    if (prevOrder === null && nextOrder === null) return ORDER_GAP;
    if (prevOrder !== null && nextOrder === null) return prevOrder + ORDER_GAP;
    if (prevOrder === null && nextOrder !== null) return nextOrder - ORDER_GAP;

    const midpoint = (prevOrder + nextOrder) / 2;
    if ((nextOrder - prevOrder) > 0.0001) return midpoint;

    await rebalancePhaseOrderIndexes(phaseId, excludeActivityId);
    const rebalanced = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
    const idx = beforeActivityId === null
      ? rebalanced.length
      : rebalanced.findIndex(activity => activity.id === beforeActivityId);
    const safeIndex = idx === -1 ? rebalanced.length : idx;
    const prevRebalanced = rebalanced[safeIndex - 1] || null;
    const nextRebalanced = rebalanced[safeIndex] || null;
    if (!prevRebalanced && !nextRebalanced) return ORDER_GAP;
    if (prevRebalanced && !nextRebalanced) return prevRebalanced.order_index + ORDER_GAP;
    if (!prevRebalanced && nextRebalanced) return nextRebalanced.order_index - ORDER_GAP;
    return (prevRebalanced.order_index + nextRebalanced.order_index) / 2;
  };

  const startNewActivityDrag = (event) => {
    resetForm();
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'new');
    setIsDraggingNewActivity(true);
  };

  const endNewActivityDrag = () => {
    setIsDraggingNewActivity(false);
    setDragDropTarget('none');
  };

  const startActivityDrag = (event, activityId) => {
    setDraggedActivityId(activityId);
    setIsDraggingNewActivity(false);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `existing:${activityId}`);
  };

  const endActivityDrag = () => {
    setDraggedActivityId(null);
    setDragDropTarget('none');
  };

  const handleDragOverInsertion = (event, targetId, phaseId) => {
    if (!isDraggingNewActivity && !draggedActivityId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isDraggingNewActivity ? 'copy' : 'move';
    setDragDropTarget(getTargetKey(targetId, phaseId));
  };

  const moveExistingActivity = async (activityId, targetBeforeId, targetPhaseId, keepSelection = true) => {
    const movingActivity = activities.find(activity => activity.id === activityId);
    if (!movingActivity) return;
    if (targetBeforeId === activityId) return;

    const nextOrderIndex = await calculateOrderIndex(targetPhaseId, targetBeforeId, activityId);
    await setDoc(
      doc(db, getStageColPath(activeStage, 'activities'), activityId.toString()),
      { phaseId: targetPhaseId, order_index: nextOrderIndex },
      { merge: true }
    );

    if (keepSelection) {
      setIsEditingActivity(activityId);
      setSelectedActivityId(activityId);
    }
  };

  const moveActivityByStep = async (activityId, direction) => {
    const activity = activities.find(item => item.id === activityId);
    if (!activity) return;

    const phaseActivities = getPhaseSortedActivities(activity.phaseId);
    const currentIndex = phaseActivities.findIndex(item => item.id === activityId);
    if (currentIndex === -1) return;

    if (direction === 'up') {
      if (currentIndex === 0) return;
      const targetBeforeId = phaseActivities[currentIndex - 1].id;
      await moveExistingActivity(activityId, targetBeforeId, activity.phaseId, true);
      return;
    }

    if (currentIndex >= phaseActivities.length - 1) return;
    const targetBeforeId = phaseActivities[currentIndex + 2]?.id ?? null;
    await moveExistingActivity(activityId, targetBeforeId, activity.phaseId, true);
  };

  const handleDropInsertion = async (event, targetId, phaseId) => {
    if (!isDraggingNewActivity && !draggedActivityId) return;
    event.preventDefault();
    setDragDropTarget(getTargetKey(targetId, phaseId));

    if (draggedActivityId) {
      await moveExistingActivity(draggedActivityId, targetId, phaseId, true);
      setDraggedActivityId(null);
      return;
    }

    setInsertBeforeId(targetId);
    setInsertPhaseId(phaseId);
    setIsDraggingNewActivity(false);
    setFormData(current => ({ ...current, phaseId }));
  };
  
  const handleSaveActivity = async () => {
    let preds = formData.predecessors;
    if (typeof preds === 'string') { preds = preds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); }

    const primaryRole = formData.role || '';
    const supportRoles = (formData.support_roles || []).filter(role => role && role !== primaryRole);
    const activity_roles = [
      ...(primaryRole ? [{ id: `ar-primary-${Date.now()}`, role_name: primaryRole, role_type: 'PRIMARY' }] : []),
      ...supportRoles.map((roleName, idx) => ({ id: `ar-support-${Date.now()}-${idx}`, role_name: roleName, role_type: 'SUPPORT' })),
    ];

    const newActivity = {
      ...formData,
      role: primaryRole,
      activity_roles,
      predecessors: preds,
    };

    if (isEditingActivity) {
      const docId = isEditingActivity.toString();
      const currentActivity = activities.find(activity => activity.id === isEditingActivity);
      newActivity.id = parseInt(docId);
      newActivity.activity_ref = currentActivity?.activity_ref || newActivity.activity_ref;
      if (currentActivity && currentActivity.phaseId !== newActivity.phaseId) {
        newActivity.order_index = await calculateOrderIndex(newActivity.phaseId, null, isEditingActivity);
      } else {
        newActivity.order_index = currentActivity?.order_index ?? newActivity.order_index;
      }
      await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), newActivity);
    } else {
      const phaseId = insertPhaseId || newActivity.phaseId;
      const order_index = await calculateOrderIndex(phaseId, insertBeforeId, null);
      const nextId = Math.max(0, ...activities.map(a => a.id)) + 1;
      const docId = nextId.toString();
      await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), {
        ...newActivity,
        id: nextId,
        phaseId,
        order_index,
        activity_ref: formatActivityRef(nextActivityRefCounter.current),
      });
      nextActivityRefCounter.current += 1;
    }

    resetForm();
  };

  const startEdit = (activity) => {
    setIsEditingActivity(activity.id);
    setInsertBeforeId(null);
    setInsertPhaseId(null);
    const primaryRole = getPrimaryRoleName(activity);
    const supportRoles = getSupportRoleNames(activity);
    setFormData({ ...activity, role: primaryRole, support_roles: supportRoles, origin: activity.origin || '', condition: activity.condition || '', description: activity.description || '', flows: activity.flows || ['all'], predecessors: activity.predecessors || [] });
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
    const activityRef = activityRefById[activity.id] || `ID-${activity.id}`;
    const primaryRole = getPrimaryRoleName(activity) || 'Sin rol';
    const supportRoles = getSupportRoleNames(activity);
    
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activityRef} · #{displayNumber}</span>
                <span
                  className="text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ring-1 ring-inset ring-white/60"
                  style={getRoleBadgeStyle(primaryRole)}
                >
                  {primaryRole}
                </span>
            </div>
            <div className="p-4">
                <p className="text-sm font-medium text-slate-800 leading-snug mb-2">{activity.text}</p>
                {activity.description && (
                  <p className="text-xs text-slate-500 leading-snug mb-3">
                    {activity.description}
                  </p>
                )}
                {supportRoles.length > 0 && (
                  <div className="mb-3 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2 py-1">
                    <span className="font-semibold text-slate-600">Support:</span> <span className="text-slate-400">{supportRoles.join(', ')}</span>
                  </div>
                )}
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 pb-1.5">Filtros de visualización</p>
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <select value={tempFilters.flow} onChange={(e) => setTempFilters({...tempFilters, flow: e.target.value})} className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:ring-0 cursor-pointer py-0.5 pl-0 pr-6 w-32 sm:w-40 truncate hover:text-blue-600 transition-colors">
                      <option value="all">Todas las Rutas</option>
                      {flows.map(f => <option key={f.id} value={f.id}>{f.label.replace('Ruta: ', '')}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200">
                    <Users className="w-4 h-4 text-purple-600" />
                    <select value={tempFilters.role} onChange={(e) => setTempFilters({...tempFilters, role: e.target.value})} className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:ring-0 cursor-pointer py-0.5 pl-0 pr-6 w-28 sm:w-34 truncate hover:text-purple-600 transition-colors">
                      <option value="all">Todos los Roles</option>
                      {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {activeTab === 'diagram_list' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 grow sm:grow-0">
                      <input
                        value={tempSearch}
                        onChange={(e) => setTempSearch(e.target.value)}
                        placeholder="Search by activity name, code, or role..."
                        className="bg-transparent border-none px-1 py-0.5 text-xs w-full sm:w-60 focus:outline-none focus:ring-0"
                      />
                    </div>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <button onClick={applyFilters} className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-black shadow-sm transition-transform active:scale-95">Filtrar</button>
                    <button onClick={clearFilters} className="bg-white text-slate-500 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold hover:text-red-600 hover:border-red-200 shadow-sm transition-transform active:scale-95"><RotateCcw className="w-3 h-3" /></button>
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
                                        const primaryRoleName = getPrimaryRoleName(act);
                                        const supportRoleNames = getSupportRoleNames(act);

                                        return (
                                            <div key={act.id} className={`group relative rounded-xl shadow-sm border p-5 hover:shadow-md transition-all flex flex-col h-full overflow-hidden ${supportRoleNames.length > 0 ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                {/* Línea indicadora de herencia de color */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: phaseColor }}></div>
                                                
                                                {/* Header de la Tarjeta */}
                                                <div className="flex justify-between items-start mb-3 pl-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md tracking-wider">{activityRefById[act.id] || `ID-${act.id}`}</span>
                                                        <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-md tracking-wider">#{displayOrderByActivityId[act.id] || 0}</span>
                                                        <span
                                                          className="text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider"
                                                          style={getRoleBadgeStyle(primaryRoleName || '')}
                                                        >
                                                            {primaryRoleName || 'Sin rol'}
                                                        </span>
                                                    </div>
                                                    {act.duration && act.duration !== 'N/A' && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                            <Clock className="w-3 h-3"/> {act.duration}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Título / Descripción */}
                                                <div className="pl-2 mb-4 flex-1">
                                                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                                                      {act.text}
                                                  </p>
                                                  {act.description && (
                                                    <p className="text-xs text-slate-500 mt-2 leading-snug line-clamp-2">
                                                      {act.description}
                                                    </p>
                                                  )}
                                                </div>

                                                {/* Meta información compacta en el fondo de la tarjeta */}
                                                <div className="flex flex-col gap-2 pl-2 mt-auto">
                                                    <div className="flex flex-wrap gap-1">
                                                      <span
                                                        className="text-[10px] px-2 py-1 rounded-md font-bold uppercase"
                                                        style={getRoleBadgeStyle(primaryRoleName || '')}
                                                      >
                                                        Primary: {primaryRoleName || 'No definido'}
                                                      </span>
                                                      {supportRoleNames.map(role => (
                                                        <span key={`${act.id}-${role}`} className="text-[10px] px-2 py-1 rounded-md font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                          Support: {role}
                                                        </span>
                                                      ))}
                                                    </div>
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
                                                                <span>Dep: {(act.predecessors || []).map((predecessorId) => activityRefById[predecessorId] || `ID-${predecessorId}`).join(', ')}</span>
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
                <button onClick={() => setManagementMode('roles')} className={`flex-1 py-3 text-xs font-bold ${managementMode === 'roles' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>Roles</button>
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
                {managementMode === 'roles' && (
                  <div className="space-y-3">
                    {roles.map((role) => {
                      const draftValue = roleDrafts[role.id] ?? role.name;
                      return (
                        <div key={role.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer relative shadow-inner">
                            <input
                              type="color"
                              value={role.color}
                              onChange={(e) => updateRoleColor(role.id, e.target.value)}
                              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                              title="Cambiar color del rol"
                            />
                          </div>
                          <input
                            className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                            value={draftValue}
                            onChange={(e) => setRoleDrafts(current => ({ ...current, [role.id]: e.target.value }))}
                            onBlur={() => commitRoleRename(role, draftValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                          />
                          <button type="button" onClick={() => requestDeleteRole(role)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      );
                    })}
                    <button onClick={addRole} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-600 flex justify-center gap-2 transition-colors"><Plus className="w-4 h-4"/> Nuevo Rol</button>
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

                            {(isDraggingNewActivity || draggedActivityId) && phaseActivities.length > 0 && (
                              <div
                                onDragOver={(event) => handleDragOverInsertion(event, phaseActivities[0].id, phase.id)}
                                onDrop={(event) => handleDropInsertion(event, phaseActivities[0].id, phase.id)}
                                className={`mb-1 h-8 rounded-md border-2 border-dashed text-[11px] font-bold transition-all flex items-center justify-center ${dragDropTarget === getTargetKey(phaseActivities[0].id, phase.id) ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-400 bg-white'}`}
                              >
                                Insertar al inicio de {phase.title}
                              </div>
                            )}

                            {phaseActivities.map((act, index) => {
                              const primaryRoleName = getPrimaryRoleName(act);
                              const supportRoleNames = getSupportRoleNames(act);
                              return (
                              <React.Fragment key={act.id}>
                                {(isDraggingNewActivity || draggedActivityId) && (
                                  <div
                                    onDragOver={(event) => handleDragOverInsertion(event, act.id, phase.id)}
                                    onDrop={(event) => handleDropInsertion(event, act.id, phase.id)}
                                    className={`h-3 rounded transition-all ${dragDropTarget === getTargetKey(act.id, phase.id) ? 'bg-emerald-200' : 'bg-transparent'}`}
                                  />
                                )}
                                <div
                                  draggable
                                  onDragStart={(event) => startActivityDrag(event, act.id)}
                                  onDragEnd={endActivityDrag}
                                  onClick={() => startEdit(act)}
                                  className={`relative p-3 rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer transition-all ${supportRoleNames.length > 0 ? 'bg-slate-50/80' : 'bg-white'} ${isEditingActivity === act.id ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-50' : ''} ${insertBeforeId === act.id ? 'ring-2 ring-emerald-300 border-emerald-400' : ''} ${draggedActivityId === act.id ? 'opacity-40' : ''}`}
                                >
                                    <div className="pr-6">
                                        <p className="text-[10px] font-black text-slate-500 tracking-wider">{activityRefById[act.id] || `ID-${act.id}`} | #{displayOrderByActivityId[act.id] || 0}</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{act.text}</p>
                                        <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold">Primary:</span> {primaryRoleName || 'No definido'}</p>
                                        {supportRoleNames.length > 0 && (
                                          <p className="text-[10px] text-slate-400 truncate"><span className="font-semibold">Support:</span> {supportRoleNames.join(', ')}</p>
                                        )}
                                    </div>
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveActivityByStep(act.id, 'up');
                                        }}
                                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Mover arriba"
                                      >
                                        <ChevronUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={index === phaseActivities.length - 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveActivityByStep(act.id, 'down');
                                        }}
                                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Mover abajo"
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActivity(act.id); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </React.Fragment>
                              );
                            })}

                            {(isDraggingNewActivity || draggedActivityId) && (
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
               <div className="mb-6 border-b border-slate-100 pb-4">
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   {isEditingActivity ? <Edit2 className="w-5 h-5 text-blue-600"/> : <Plus className="w-5 h-5 text-emerald-600"/>}
                   {isEditingActivity ? `Editar Actividad ${editingActivityRef}` : 'Crear Nueva Actividad'}
                 </h2>
                 {isEditingActivity && (
                   <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                     <span className="px-2 py-1 rounded-md bg-slate-100 font-semibold text-slate-600">Codigo: {editingActivityRef}</span>
                     <span className="px-2 py-1 rounded-md bg-blue-50 font-semibold text-blue-700">Orden: #{editingActivityOrder}</span>
                   </div>
                 )}
               </div>
               {!isEditingActivity && insertBeforeId && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    La nueva actividad se insertará en la fase {phases.find(p => p.id === insertPhaseId)?.title || 'seleccionada'} antes de {activityRefById[insertBeforeId] || `ID-${insertBeforeId}`}.
                  </div>
               )}
               <div className="grid grid-cols-1 gap-6 max-w-3xl">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Informacion basica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fase del Proceso</label>
                        <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={formData.phaseId} onChange={e=>setFormData({...formData, phaseId: e.target.value})}>
                            {phases.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo de Nodo</label>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => setFormData({...formData, type: 'process'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'process' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>Proceso</button>
                            <button onClick={() => setFormData({...formData, type: 'decision'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'decision' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600'}`}>Decision</button>
                            <button onClick={() => setFormData({...formData, type: 'start'})} className={`px-3 py-1.5 text-xs rounded-md border ${formData.type === 'start' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-600'}`}>Inicio</button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
                      <input
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Ej: Busqueda de posible docente"
                        value={formData.text}
                        onChange={e=>setFormData({...formData, text: e.target.value})}
                      />
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripcion</label>
                      <textarea
                        className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all min-h-[110px]"
                        placeholder="Detalle breve de la actividad"
                        value={formData.description}
                        onChange={e=>setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Duracion</label>
                        <input
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Ej: 3 dias"
                          value={formData.duration}
                          onChange={e => setFormData({...formData, duration: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Condicion</label>
                        <input
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Ej: Si es viable"
                          value={formData.condition}
                          onChange={e => setFormData({...formData, condition: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Origen</label>
                        <input
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Ej: Tendencias"
                          value={formData.origin}
                          onChange={e => setFormData({...formData, origin: e.target.value})}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Roles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Rol Responsable</label>
                        <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})}>
                            <option value="">Seleccionar...</option>
                            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Roles de Soporte</label>
                        <div className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableRoles.filter(role => role !== formData.role).map(role => (
                            <label key={role} className="flex items-center gap-2 text-slate-600">
                              <input
                                type="checkbox"
                                checked={(formData.support_roles || []).includes(role)}
                                onChange={(event) => {
                                  const current = formData.support_roles || [];
                                  const support_roles = event.target.checked ? [...current, role] : current.filter(item => item !== role);
                                  setFormData({ ...formData, support_roles });
                                }}
                              />
                              {role}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Dependencias</h3>
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-1">
                       {sortedActivities
                         .filter(activity => activity.id !== isEditingActivity)
                         .map(activity => {
                           const selected = (Array.isArray(formData.predecessors) ? formData.predecessors : []).includes(activity.id);
                           return (
                             <label key={activity.id} className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer ${selected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-white'}`}>
                               <input
                                 type="checkbox"
                                 checked={selected}
                                 onChange={(event) => {
                                   const current = Array.isArray(formData.predecessors) ? formData.predecessors : [];
                                   const predecessors = event.target.checked
                                     ? [...current, activity.id]
                                     : current.filter(id => id !== activity.id);
                                   setFormData({ ...formData, predecessors });
                                 }}
                               />
                               <span>{`${activityRefById[activity.id] || `ID-${activity.id}`} — ${activity.text}`}</span>
                             </label>
                           );
                         })}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Rutas Asociadas</h3>
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
                  </section>

                  <div className="flex gap-3 pt-2">
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
