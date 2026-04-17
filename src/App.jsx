import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { 
  Layout, Plus, Trash2, Edit2, Save, Network, Clock, Filter, 
  CornerDownRight, RotateCcw, Users, AlertTriangle, Lock, Unlock, CheckCircle2, GitBranch, ChevronUp, ChevronDown, Info
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
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

const DEFAULT_ADMIN_UID = "3VTYUmCkqNU3g2U8qvDdUzChuK13";
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || import.meta.env.VITE_ADMIN_UID || DEFAULT_ADMIN_UID)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_ADMIN_EMAIL || "platafcecp_med@unal.edu.co")
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);
const isAdminSessionUser = (currentUser) => {
  if (!currentUser) return false;
  const email = (currentUser.email || '').toLowerCase();
  const uid = currentUser.uid || '';
  return ADMIN_UIDS.includes(uid) || (email && ADMIN_EMAILS.includes(email));
};

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
  const code = (role.code || role.shortName || role.name || role.label || role.role || role.id || '').trim();
  const name = (role.name || role.full_name || role.fullName || code || role.id || '').trim();
  const color = role.color || '#e2e8f0';
  const textColor = role.textColor || getReadableTextColor(color);
  return { ...role, code: code || name, name: name || code, color, textColor };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('diagram_node');
  const [activeStage, setActiveStage] = useState('formulacion');
  
  // Estados de Base de Datos
  const [phases, setPhases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [flows, setFlows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Estados de Seguridad
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState(ADMIN_EMAILS[0] || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Estados de Interfaz
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    confirmTone: 'danger',
    isSubmitting: false,
    error: '',
    onConfirm: null
  });
  const [tempFilters, setTempFilters] = useState({ flow: 'all', role: 'all' });
  const [activeFilters, setActiveFilters] = useState({ flow: 'all', role: 'all' });
  const [tempSearch, setTempSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [showRoleLegend, setShowRoleLegend] = useState(false);
  const [lines, setLines] = useState([]);
  const [phaseDrafts, setPhaseDrafts] = useState({});
  const [flowDrafts, setFlowDrafts] = useState({});
  const [roleDrafts, setRoleDrafts] = useState({});
  
  const nodeRefs = useRef({});
  const containerRef = useRef(null);
  const roleLegendRef = useRef(null);
  const nextActivityRefCounter = useRef(1);

  // Estados de Edición
  const [isEditingActivity, setIsEditingActivity] = useState(null);
  const [managementMode, setManagementMode] = useState('activities');
  const [formData, setFormData] = useState(() => buildEmptyFormData(''));
  const [formErrors, setFormErrors] = useState({});
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
  const roleById = useMemo(
    () => Object.fromEntries(roles.map(role => [role.id, role])),
    [roles]
  );
  const roleByCode = useMemo(() => {
    const map = {};
    roles.forEach(role => {
      if (role.code) map[role.code] = role;
      if (role.name && !map[role.name]) map[role.name] = role;
    });
    return map;
  }, [roles]);
  const roleIdByCode = useMemo(() => {
    const map = {};
    roles.forEach(role => {
      if (role.code) map[role.code] = role.id;
      if (role.name && !map[role.name]) map[role.name] = role.id;
    });
    return map;
  }, [roles]);
  const availableRoles = useMemo(
    () => roles.map(role => role.code).filter(Boolean),
    [roles]
  );
  const safeTempRoleFilter = useMemo(
    () => (tempFilters.role !== 'all' && !availableRoles.includes(tempFilters.role) ? 'all' : tempFilters.role),
    [availableRoles, tempFilters.role]
  );
  const safeActiveRoleFilter = useMemo(
    () => (activeFilters.role !== 'all' && !availableRoles.includes(activeFilters.role) ? 'all' : activeFilters.role),
    [availableRoles, activeFilters.role]
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
  const resolveRoleCode = useCallback((roleId, fallbackName = '') => {
    if (roleId && roleById[roleId]?.code) return roleById[roleId].code;
    if (fallbackName && roleByCode[fallbackName]?.code) return roleByCode[fallbackName].code;
    return fallbackName || '';
  }, [roleByCode, roleById]);
  const getActivityRoles = useCallback((activity) => {
    if (Array.isArray(activity.activity_roles) && activity.activity_roles.length > 0) {
      return activity.activity_roles
        .map((currentRole, index) => {
          const role_name = resolveRoleCode(currentRole.role_id, currentRole.role_name || '');
          const role_id = currentRole.role_id || roleIdByCode[role_name] || '';
          return {
            ...currentRole,
            id: currentRole.id || `ar-${activity.id}-${index}`,
            activity_id: currentRole.activity_id || activity.id,
            role_id,
            role_name,
            role_type: currentRole.role_type || 'SUPPORT',
          };
        })
        .filter(currentRole => currentRole.role_name);
    }

    const roles = [];
    const primaryCode = resolveRoleCode(activity.primary_role_id, activity.role || '');
    if (primaryCode) {
      roles.push({
        id: `legacy-primary-${activity.id}`,
        activity_id: activity.id,
        role_id: activity.primary_role_id || roleIdByCode[primaryCode] || '',
        role_name: primaryCode,
        role_type: 'PRIMARY',
      });
    }

    const supportCodesById = Array.isArray(activity.support_role_ids)
      ? activity.support_role_ids.map(roleId => resolveRoleCode(roleId, '')).filter(Boolean)
      : [];
    const supportCodesLegacy = Array.isArray(activity.support_roles)
      ? activity.support_roles.map(roleName => resolveRoleCode('', roleName)).filter(Boolean)
      : [];
    const supportCodes = [...new Set([...supportCodesById, ...supportCodesLegacy])]
      .filter(roleCode => roleCode && roleCode !== primaryCode);
    supportCodes.forEach((roleCode, index) => {
      roles.push({
        id: `legacy-support-${activity.id}-${index}`,
        activity_id: activity.id,
        role_id: roleIdByCode[roleCode] || '',
        role_name: roleCode,
        role_type: 'SUPPORT',
      });
    });
    return roles;
  }, [resolveRoleCode, roleIdByCode]);
  const getRoleBadgeStyle = useCallback((roleCode) => {
    if (!roleCode) return { backgroundColor: '#f1f5f9', color: '#475569' };
    const role = roleByCode[roleCode];
    const color = role?.color || '#e2e8f0';
    const textColor = role?.textColor || getReadableTextColor(color);
    return { backgroundColor: color, color: textColor };
  }, [roleByCode]);
  const getRoleFullName = useCallback((roleCode) => roleByCode[roleCode]?.name || roleCode || '', [roleByCode]);
  const getRoleOptionLabel = useCallback((roleCode) => {
    const fullName = getRoleFullName(roleCode);
    return fullName && fullName !== roleCode ? `${roleCode} · ${fullName}` : roleCode;
  }, [getRoleFullName]);
  const getPrimaryRoleName = useCallback((activity) => getActivityRoles(activity).find(role => role.role_type === 'PRIMARY')?.role_name || resolveRoleCode(activity.primary_role_id, activity.role || ''), [getActivityRoles, resolveRoleCode]);
  const getSupportRoleNames = useCallback((activity) => getActivityRoles(activity).filter(role => role.role_type === 'SUPPORT').map(role => role.role_name), [getActivityRoles]);
  const normalizeActivityModel = useCallback((activity) => {
    const normalizedRoles = getActivityRoles(activity);
    const primary = normalizedRoles.find(role => role.role_type === 'PRIMARY');
    const support = normalizedRoles.filter(role => role.role_type === 'SUPPORT');
    return {
      ...activity,
      role: primary?.role_name || '',
      primary_role_id: primary?.role_id || activity.primary_role_id || '',
      support_roles: support.map(role => role.role_name),
      support_role_ids: support.map(role => role.role_id).filter(Boolean),
      activity_roles: normalizedRoles,
    };
  }, [getActivityRoles]);

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
  const isFormValid = Boolean(formData.text.trim() && formData.role && formData.duration.trim());

  const matchesSearch = useCallback((activity) => {
    if (activeTab !== 'diagram_list') return true;
    if (!activeSearch.trim()) return true;
    const query = activeSearch.trim().toLowerCase();
    const roleNames = getActivityRoles(activity)
      .map(role => `${role.role_name} ${getRoleFullName(role.role_name)}`)
      .join(' ')
      .toLowerCase();
    const haystack = [
      activityRefById[activity.id] || '',
      activity.text || '',
      activity.description || '',
      activity.origin || '',
      activity.condition || '',
      roleNames,
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  }, [activeSearch, activityRefById, getActivityRoles, getRoleFullName, activeTab]);

  // --- FIREBASE: AUTENTICACIÓN Y LECTURA ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(isAdminSessionUser(currentUser));
        return;
      }

      setIsAuthenticated(false);
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error conectando a Firebase:", error);
        // Fallback para evitar bloqueo si la Autenticación Anónima no está habilitada
        setUser({ uid: 'usuario-temporal-test' });
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

      const roleBatch = writeBatch(db);
      let hasRoleFixes = false;
      data.forEach(role => {
        const updates = {};
        if (!role.code) {
          updates.code = role.name;
        }
        if (Object.keys(updates).length > 0) {
          hasRoleFixes = true;
          roleBatch.set(doc(db, getRolesColPath(), role.id), updates, { merge: true });
        }
      });

      if (hasRoleFixes) {
        await roleBatch.commit();
        if (isDisposed) return;
      }

      data = data.map(normalizeRole);
      data.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
      setRoles(data);
      setRoleDrafts(current => {
        const next = { ...current };
        data.forEach(role => {
          const existing = current[role.id];
          if (!existing) {
            next[role.id] = { name: role.name, code: role.code, color: role.color };
          }
        });
        return next;
      });
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

    const listen = async () => {
      unsubFlows = onSnapshot(collection(db, stageColPath('flows')), async (snapshot) => {
        if (isDisposed) return;
        let data = snapshot.docs.map(currentDoc => ({ id: currentDoc.id, ...currentDoc.data() }));

        const batch = writeBatch(db);
        let hasFixes = false;
        const sorted = [...data].sort((a, b) => {
          const aOrder = typeof a.order_index === 'number' ? a.order_index : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.order_index === 'number' ? b.order_index : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.label || '').localeCompare(b.label || '');
        });

        sorted.forEach((flow, index) => {
          const expectedOrder = (index + 1) * ORDER_GAP;
          if (typeof flow.order_index !== 'number') {
            hasFixes = true;
            flow.order_index = expectedOrder;
            batch.set(doc(db, stageColPath('flows'), flow.id), { order_index: expectedOrder }, { merge: true });
          }
        });

        if (hasFixes) {
          await batch.commit();
          if (isDisposed) return;
        }

        sorted.sort((a, b) => {
          const aOrder = typeof a.order_index === 'number' ? a.order_index : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.order_index === 'number' ? b.order_index : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.label || '').localeCompare(b.label || '');
        });
        setFlows(sorted);
        setFlowDrafts(current => {
          const next = { ...current };
          sorted.forEach(flow => {
            if (!next[flow.id]) next[flow.id] = { label: flow.label || '', color: flow.color || '#64748b' };
          });
          return next;
        });
      }, (error) => console.error(error));

      unsubPhases = onSnapshot(collection(db, stageColPath('phases')), async (snapshot) => {
        if (isDisposed) return;
        let data = snapshot.docs.map(currentDoc => ({ id: currentDoc.id, ...currentDoc.data() }));

        const batch = writeBatch(db);
        let hasFixes = false;
        const sorted = [...data].sort((a, b) => {
          const aOrder = typeof a.order_index === 'number' ? a.order_index : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.order_index === 'number' ? b.order_index : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.title || '').localeCompare(b.title || '');
        });

        sorted.forEach((phase, index) => {
          const expectedOrder = (index + 1) * ORDER_GAP;
          if (typeof phase.order_index !== 'number') {
            hasFixes = true;
            phase.order_index = expectedOrder;
            batch.set(doc(db, stageColPath('phases'), phase.id), { order_index: expectedOrder }, { merge: true });
          }
        });

        if (hasFixes) {
          await batch.commit();
          if (isDisposed) return;
        }

        sorted.sort((a, b) => {
          const aOrder = typeof a.order_index === 'number' ? a.order_index : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.order_index === 'number' ? b.order_index : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.title || '').localeCompare(b.title || '');
        });
        setPhases(sorted);
        setPhaseDrafts(current => {
          const next = { ...current };
          sorted.forEach(phase => {
            if (!next[phase.id]) next[phase.id] = { title: phase.title || '', color: getPhaseHexColor(phase) };
          });
          return next;
        });
      }, (error) => console.error(error));

      unsubActs = onSnapshot(collection(db, stageColPath('activities')), async (snapshot) => {
        if (isDisposed) return;
        let data = snapshot.docs.map(currentDoc => {
          const currentData = currentDoc.data();
          const fallbackId = Number.parseInt(currentDoc.id, 10);
          return {
            id: Number.isFinite(fallbackId) ? fallbackId : currentData.id,
            ...currentData,
          };
        });

        const phaseBuckets = new Map();
        data.forEach(activity => {
          if (!phaseBuckets.has(activity.phaseId)) phaseBuckets.set(activity.phaseId, []);
          phaseBuckets.get(activity.phaseId).push(activity);
        });

        const batch = writeBatch(db);
        let hasActivityFixes = false;
        let maxRef = data.reduce((max, activity) => Math.max(max, getActivityRefNumber(activity.activity_ref)), 0);

        phaseBuckets.forEach((phaseActivities) => {
          phaseActivities.sort((a, b) => {
            const aOrder = typeof a.order_index === 'number' ? a.order_index : Number.MAX_SAFE_INTEGER;
            const bOrder = typeof b.order_index === 'number' ? b.order_index : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.id - b.id;
          });

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

            if (!Array.isArray(activity.predecessors)) {
              updates.predecessors = [];
              activity.predecessors = [];
            }

            if (!Array.isArray(activity.flows) || activity.flows.length === 0) {
              updates.flows = ['all'];
              activity.flows = ['all'];
            }

            const primaryRoleCode = resolveRoleCode(activity.primary_role_id || '', activity.role || '');
            const primaryRoleId = primaryRoleCode ? (roleIdByCode[primaryRoleCode] || activity.primary_role_id || '') : '';
            const supportByLegacy = Array.isArray(activity.support_roles) ? activity.support_roles.map(roleName => resolveRoleCode('', roleName)).filter(Boolean) : [];
            const supportByIds = Array.isArray(activity.support_role_ids) ? activity.support_role_ids.map(roleId => resolveRoleCode(roleId, '')).filter(Boolean) : [];
            const supportRoleCodes = [...new Set([...supportByIds, ...supportByLegacy])]
              .filter(roleCode => roleCode && roleCode !== primaryRoleCode);
            const supportRoleIds = supportRoleCodes.map(roleCode => roleIdByCode[roleCode] || '').filter(Boolean);
            const normalizedActivityRoles = [
              ...(primaryRoleCode ? [{
                id: activity.activity_roles?.find(role => role.role_type === 'PRIMARY')?.id || `ar-primary-${activity.id}`,
                activity_id: activity.id,
                role_id: primaryRoleId,
                role_name: primaryRoleCode,
                role_type: 'PRIMARY',
              }] : []),
              ...supportRoleCodes.map((roleCode, supportIndex) => ({
                id: activity.activity_roles?.find(role => role.role_type === 'SUPPORT' && resolveRoleCode(role.role_id, role.role_name || '') === roleCode)?.id || `ar-support-${activity.id}-${supportIndex}`,
                activity_id: activity.id,
                role_id: roleIdByCode[roleCode] || '',
                role_name: roleCode,
                role_type: 'SUPPORT',
              })),
            ];

            if ((activity.role || '') !== primaryRoleCode) {
              updates.role = primaryRoleCode;
              activity.role = primaryRoleCode;
            }

            if ((activity.primary_role_id || '') !== (primaryRoleId || '')) {
              updates.primary_role_id = primaryRoleId;
              activity.primary_role_id = primaryRoleId;
            }

            const currentSupportRoles = Array.isArray(activity.support_roles) ? activity.support_roles : [];
            if (JSON.stringify(currentSupportRoles) !== JSON.stringify(supportRoleCodes)) {
              updates.support_roles = supportRoleCodes;
              activity.support_roles = supportRoleCodes;
            }

            const currentSupportRoleIds = Array.isArray(activity.support_role_ids) ? activity.support_role_ids.filter(Boolean) : [];
            if (JSON.stringify(currentSupportRoleIds) !== JSON.stringify(supportRoleIds)) {
              updates.support_role_ids = supportRoleIds;
              activity.support_role_ids = supportRoleIds;
            }

            const currentActivityRoles = Array.isArray(activity.activity_roles) ? activity.activity_roles : [];
            if (JSON.stringify(currentActivityRoles) !== JSON.stringify(normalizedActivityRoles)) {
              updates.activity_roles = normalizedActivityRoles;
              activity.activity_roles = normalizedActivityRoles;
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
  }, [user, activeStage, normalizeActivityModel, resolveRoleCode, roleIdByCode]);


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
    const matchesRole = safeActiveRoleFilter === 'all' || getActivityRoles(act).some(role => role.role_name === safeActiveRoleFilter);
    const matchesSearchQuery = matchesSearch(act);
    if (!matchesFlow || !matchesRole || !matchesSearchQuery) return 'hidden';
    if (selectedActivityId) {
      const downstream = getDownstreamPath(selectedActivityId);
      const upstream = getUpstreamPath(selectedActivityId);
      if (downstream.has(act.id) || upstream.has(act.id)) return 'opacity-100 scale-100';
      return 'opacity-20 grayscale';
    }
    return 'opacity-100';
  }, [activeFilters.flow, safeActiveRoleFilter, getActivityRoles, matchesSearch, getDownstreamPath, getUpstreamPath, selectedActivityId]);

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
      if (isAuthenticated) {
        setActiveTab('editor');
        return;
      }
      setAuthError('');
      setLoginPassword('');
      setShowAuthModal(true);
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      const email = loginEmail.trim().toLowerCase();
      if (!email || !loginPassword.trim()) {
        setAuthError('Ingresa correo y contraseña.');
        return;
      }

      try {
        const credentials = await signInWithEmailAndPassword(auth, email, loginPassword);
        const sessionUser = credentials.user;
        if (!isAdminSessionUser(sessionUser)) {
          await signOut(auth);
          setAuthError(`El usuario ${email} no tiene permisos de editor.`);
          return;
        }
        setIsAuthenticated(true);
        setShowAuthModal(false);
        setAuthError('');
        setLoginPassword('');
        setActiveTab('editor');
      } catch (error) {
        console.error(error);
        if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found') {
          setAuthError('Correo o contraseña incorrectos.');
          return;
        }
        if (error?.code === 'auth/too-many-requests') {
          setAuthError('Demasiados intentos. Espera un momento y vuelve a intentar.');
          return;
        }
        setAuthError(`No se pudo iniciar sesión. ${error?.message || 'Error inesperado.'}`);
      }
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

  const applyFilters = () => {
    setActiveFilters({ ...tempFilters, role: safeTempRoleFilter });
    setActiveSearch(tempSearch);
    setSelectedActivityId(null);
    setShowRoleLegend(false);
  };
  const clearFilters = () => { const reset = { flow: 'all', role: 'all' }; setTempFilters(reset); setActiveFilters(reset); setTempSearch(''); setActiveSearch(''); setSelectedActivityId(null); setShowRoleLegend(false); };

  useEffect(() => {
    if (!showRoleLegend) return undefined;
    const handleOutsideClick = (event) => {
      if (roleLegendRef.current && !roleLegendRef.current.contains(event.target)) {
        setShowRoleLegend(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [showRoleLegend]);

  // --- CRUD A FIREBASE (Guardado en Tiempo Real) ---
  const getConfirmErrorMessage = (error) => {
    if (!error) return 'No se pudo completar la operación.';
    if (error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied') {
      return 'Firestore rechazó la operación por permisos. Verifica que tu UID admin esté en firestore.rules y despliega reglas.';
    }
    if (error?.code === 'unavailable' || error?.code === 'firestore/unavailable') {
      return 'Firestore no está disponible en este momento. Intenta de nuevo en unos segundos.';
    }
    return error?.message || 'No se pudo completar la operación.';
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(current => ({
      ...current,
      isOpen: false,
      isSubmitting: false,
      error: '',
    }));
  };

  const openConfirmDialog = ({ title, message, confirmLabel = 'Confirmar', confirmTone = 'primary', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmLabel,
      confirmTone,
      isSubmitting: false,
      error: '',
      onConfirm: async () => {
        setConfirmDialog(current => ({ ...current, isSubmitting: true, error: '' }));
        try {
          await onConfirm?.();
          closeConfirmDialog();
        } catch (error) {
          console.error(error);
          setConfirmDialog(current => ({
            ...current,
            isSubmitting: false,
            error: getConfirmErrorMessage(error),
          }));
        }
      }
    });
  };

  const requestDeleteActivity = (id) => {
      openConfirmDialog({
        title: 'Eliminar Actividad',
        message: `¿Estás seguro de que deseas eliminar la actividad #${id}?`,
        confirmLabel: 'Sí, eliminar',
        confirmTone: 'danger',
        onConfirm: async () => {
          await deleteDoc(doc(db, getStageColPath(activeStage, 'activities'), id.toString()));
          const batch = writeBatch(db);
          activities.forEach(activity => {
            if (activity.predecessors.includes(id)) {
              const updatedPredecessors = activity.predecessors.filter(predecessorId => predecessorId !== id);
              batch.update(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()), { predecessors: updatedPredecessors });
            }
          });
          await batch.commit();
          if (isEditingActivity === id) setIsEditingActivity(null);
        }
      });
  };

  const requestDeletePhase = (id) => {
      openConfirmDialog({
        title: 'Eliminar Fase Completa',
        message: '¡Atención! Al borrar esta fase, también se eliminarán TODAS las actividades que pertenecen a ella.',
        confirmLabel: 'Sí, eliminar',
        confirmTone: 'danger',
        onConfirm: async () => {
          const batch = writeBatch(db);
          batch.delete(doc(db, getStageColPath(activeStage, 'phases'), id));
          activities.forEach(activity => {
            if (activity.phaseId === id) batch.delete(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()));
          });
          await batch.commit();
        }
      });
  };

  const requestDeleteFlow = (id) => {
      openConfirmDialog({
        title: 'Eliminar Ruta',
        message: '¿Borrar esta ruta? Las actividades seguirán existiendo, pero perderán su asignación a este flujo.',
        confirmLabel: 'Sí, eliminar',
        confirmTone: 'danger',
        onConfirm: async () => {
          const batch = writeBatch(db);
          batch.delete(doc(db, getStageColPath(activeStage, 'flows'), id));
          activities.forEach(activity => {
            if (activity.flows.includes(id)) {
              const updatedFlows = activity.flows.filter(flowId => flowId !== id);
              batch.update(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()), { flows: updatedFlows });
            }
          });
          await batch.commit();
        }
      });
  };

  const swapOrderIndex = async (collectionName, currentItem, targetItem) => {
    const batch = writeBatch(db);
    batch.set(
      doc(db, getStageColPath(activeStage, collectionName), currentItem.id),
      { order_index: targetItem.order_index ?? ORDER_GAP },
      { merge: true }
    );
    batch.set(
      doc(db, getStageColPath(activeStage, collectionName), targetItem.id),
      { order_index: currentItem.order_index ?? (ORDER_GAP * 2) },
      { merge: true }
    );
    await batch.commit();
  };

  const movePhaseByStep = async (phaseId, direction) => {
    const currentIndex = phases.findIndex(phase => phase.id === phaseId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= phases.length) return;
    const currentPhase = phases[currentIndex];
    const targetPhase = phases[targetIndex];
    openConfirmDialog({
      title: 'Reordenar Fase',
      message: `¿Mover "${currentPhase.title}" ${direction === 'up' ? 'arriba' : 'abajo'}?`,
      confirmLabel: 'Sí, mover',
      onConfirm: async () => {
        await swapOrderIndex('phases', currentPhase, targetPhase);
      }
    });
  };

  const moveFlowByStep = async (flowId, direction) => {
    const currentIndex = flows.findIndex(flow => flow.id === flowId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= flows.length) return;
    const currentFlow = flows[currentIndex];
    const targetFlow = flows[targetIndex];
    openConfirmDialog({
      title: 'Reordenar Ruta',
      message: `¿Mover "${currentFlow.label}" ${direction === 'up' ? 'arriba' : 'abajo'}?`,
      confirmLabel: 'Sí, mover',
      onConfirm: async () => {
        await swapOrderIndex('flows', currentFlow, targetFlow);
      }
    });
  };

  const addPhase = async () => {
    const nextOrder = ((phases.length + 1) * ORDER_GAP);
    openConfirmDialog({
      title: 'Crear Fase',
      message: '¿Crear una nueva fase al final de la etapa actual?',
      confirmLabel: 'Sí, crear',
      onConfirm: async () => {
        const newId = `p${Date.now()}`;
        const newPhase = { id: newId, title: 'Nueva Fase', color: '#3b82f6', order_index: nextOrder };
        await setDoc(doc(db, getStageColPath(activeStage, 'phases'), newId), newPhase);
      }
    });
  };

  const addFlow = async () => {
    const nextOrder = ((flows.length + 1) * ORDER_GAP);
    openConfirmDialog({
      title: 'Crear Ruta',
      message: '¿Crear una nueva ruta al final de la etapa actual?',
      confirmLabel: 'Sí, crear',
      onConfirm: async () => {
        const newId = `ruta_${Date.now()}`;
        const newFlow = { id: newId, label: 'Nueva Ruta', color: '#64748b', order_index: nextOrder };
        await setDoc(doc(db, getStageColPath(activeStage, 'flows'), newId), newFlow);
      }
    });
  };

  const savePhaseDraft = async (phaseId) => {
    const phase = phases.find(current => current.id === phaseId);
    const draft = phaseDrafts[phaseId];
    if (!phase || !draft) return;
    const title = (draft.title || '').trim();
    const color = draft.color || getPhaseHexColor(phase);
    if (!title) return;
    const changed = title !== (phase.title || '') || color !== getPhaseHexColor(phase);
    if (!changed) return;
    openConfirmDialog({
      title: 'Guardar Fase',
      message: `¿Guardar cambios en la fase "${phase.title}"?`,
      confirmLabel: 'Sí, guardar',
      onConfirm: async () => {
        await setDoc(doc(db, getStageColPath(activeStage, 'phases'), phaseId), { title, color }, { merge: true });
      }
    });
  };

  const saveFlowDraft = async (flowId) => {
    const flow = flows.find(current => current.id === flowId);
    const draft = flowDrafts[flowId];
    if (!flow || !draft) return;
    const label = (draft.label || '').trim();
    const color = draft.color || flow.color || '#64748b';
    if (!label) return;
    const changed = label !== (flow.label || '') || color !== (flow.color || '#64748b');
    if (!changed) return;
    openConfirmDialog({
      title: 'Guardar Ruta',
      message: `¿Guardar cambios en la ruta "${flow.label}"?`,
      confirmLabel: 'Sí, guardar',
      onConfirm: async () => {
        await setDoc(doc(db, getStageColPath(activeStage, 'flows'), flowId), { label, color }, { merge: true });
      }
    });
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
      await batch.commit();
    }
  };

  const syncRoleAcrossStages = async (roleId, oldCode, newCode) => {
    if (!roleId || !newCode) return;
    const updates = [];
    for (const stage of processStages) {
      const snapshot = await getDocs(collection(db, getStageColPath(stage.id, 'activities')));
      snapshot.forEach((activityDoc) => {
        const activity = activityDoc.data();
        const update = {};
        let changed = false;

        const currentPrimaryRole = resolveRoleCode(activity.primary_role_id || '', activity.role || '');
        const isPrimaryMatch = activity.primary_role_id === roleId || currentPrimaryRole === oldCode;
        if (isPrimaryMatch) {
          update.role = newCode;
          update.primary_role_id = roleId;
          changed = true;
        }

        if (Array.isArray(activity.support_roles)) {
          const updatedSupport = [...new Set(activity.support_roles.map(role => role === oldCode ? newCode : role).filter(Boolean))];
          if (JSON.stringify(updatedSupport) !== JSON.stringify(activity.support_roles)) {
            update.support_roles = updatedSupport;
            changed = true;
          }
          if (updatedSupport.includes(newCode)) {
            const updatedSupportRoleIds = Array.isArray(activity.support_role_ids) ? [...new Set([...activity.support_role_ids, roleId])] : [roleId];
            if (JSON.stringify(updatedSupportRoleIds) !== JSON.stringify(activity.support_role_ids || [])) {
              update.support_role_ids = updatedSupportRoleIds;
              changed = true;
            }
          }
        }

        if (Array.isArray(activity.support_role_ids) && activity.support_role_ids.includes(roleId)) {
          const normalizedSupportRoles = Array.isArray(update.support_roles) ? update.support_roles : (activity.support_roles || []);
          if (!normalizedSupportRoles.includes(newCode)) {
            update.support_roles = [...normalizedSupportRoles, newCode];
            changed = true;
          }
        }

        if (Array.isArray(activity.activity_roles)) {
          const updatedRoles = activity.activity_roles.map(role => (
            (role.role_id === roleId || role.role_name === oldCode)
              ? { ...role, role_id: roleId, role_name: newCode }
              : role
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

  const removeRoleAcrossStages = async (roleId, roleCode) => {
    if (!roleId && !roleCode) return;
    const updates = [];
    for (const stage of processStages) {
      const snapshot = await getDocs(collection(db, getStageColPath(stage.id, 'activities')));
      snapshot.forEach((activityDoc) => {
        const activity = activityDoc.data();
        const update = {};
        let changed = false;

        const currentPrimaryRole = resolveRoleCode(activity.primary_role_id || '', activity.role || '');
        if (activity.primary_role_id === roleId || currentPrimaryRole === roleCode) {
          update.role = '';
          update.primary_role_id = '';
          changed = true;
        }

        if (Array.isArray(activity.support_roles)) {
          const updatedSupport = activity.support_roles.filter(role => role !== roleCode);
          if (updatedSupport.length !== activity.support_roles.length) {
            update.support_roles = updatedSupport;
            changed = true;
          }
        }

        if (Array.isArray(activity.support_role_ids)) {
          const updatedSupportRoleIds = activity.support_role_ids.filter(currentRoleId => currentRoleId !== roleId);
          if (updatedSupportRoleIds.length !== activity.support_role_ids.length) {
            update.support_role_ids = updatedSupportRoleIds;
            changed = true;
          }
        }

        if (Array.isArray(activity.activity_roles)) {
          const updatedRoles = activity.activity_roles.filter(role => role.role_id !== roleId && role.role_name !== roleCode);
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
    openConfirmDialog({
      title: 'Crear Rol',
      message: '¿Crear un nuevo rol disponible para todas las etapas?',
      confirmLabel: 'Sí, crear',
      onConfirm: async () => {
        const defaultCode = `ROL${roles.length + 1}`;
        const newRole = {
          id: `role_${Date.now()}`,
          code: defaultCode,
          name: 'Nuevo Rol',
          color: palette.color,
          textColor: palette.textColor,
        };
        await setDoc(doc(db, getRolesColPath(), newRole.id), newRole);
      }
    });
  };

  const saveRoleDraft = async (role) => {
    const draft = roleDrafts[role.id] || { name: role.name, code: role.code, color: role.color };
    const nextName = (draft.name || '').trim();
    const nextCode = (draft.code || '').trim();
    const nextColor = draft.color || role.color;
    if (!nextName || !nextCode) return;

    const duplicatedCode = roles.some(currentRole => currentRole.id !== role.id && currentRole.code === nextCode);
    if (duplicatedCode) {
      openConfirmDialog({
        title: 'Convención Duplicada',
        message: `La convención "${nextCode}" ya está en uso. Debe ser única para evitar ambigüedades.`,
        confirmLabel: 'Entendido',
        confirmTone: 'danger',
        onConfirm: async () => {}
      });
      return;
    }

    const changed = nextName !== role.name || nextCode !== role.code || nextColor !== role.color;
    if (!changed) return;

    openConfirmDialog({
      title: 'Guardar Rol',
      message: `¿Guardar cambios en el rol "${role.code}"?`,
      confirmLabel: 'Sí, guardar',
      onConfirm: async () => {
        await setDoc(
          doc(db, getRolesColPath(), role.id),
          { name: nextName, code: nextCode, color: nextColor, textColor: getReadableTextColor(nextColor) },
          { merge: true }
        );
        if (nextCode !== role.code) {
          await syncRoleAcrossStages(role.id, role.code, nextCode);
        }
      }
    });
  };

  const requestDeleteRole = (role) => {
    openConfirmDialog({
      title: 'Eliminar Rol',
      message: `¿Eliminar el rol "${role.code}"? Se eliminará de todas las actividades.`,
      confirmLabel: 'Sí, eliminar',
      confirmTone: 'danger',
      onConfirm: async () => {
        await deleteDoc(doc(db, getRolesColPath(), role.id));
        await removeRoleAcrossStages(role.id, role.code);
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
    setFormErrors({});
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

  const validateForm = () => {
    const errors = {};
    if (!formData.text.trim()) errors.text = 'El nombre es obligatorio.';
    if (!formData.role) errors.role = 'El responsable es obligatorio.';
    if (!formData.duration.trim()) errors.duration = 'La duración es obligatoria.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFormError = (field) => {
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  
  const handleSaveActivity = async () => {
    if (!validateForm()) return;
    let preds = formData.predecessors;
    if (typeof preds === 'string') { preds = preds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); }

    const primaryRole = resolveRoleCode('', formData.role || '');
    const primaryRoleId = roleIdByCode[primaryRole] || '';
    const supportRoles = [...new Set((formData.support_roles || []).map(role => resolveRoleCode('', role)).filter(role => role && role !== primaryRole))];
    const supportRoleIds = supportRoles.map(role => roleIdByCode[role] || '').filter(Boolean);
    const baseRoleTimestamp = Date.now();
    const activity_roles = [
      ...(primaryRole ? [{
        id: `ar-primary-${baseRoleTimestamp}`,
        role_id: primaryRoleId,
        role_name: primaryRole,
        role_type: 'PRIMARY'
      }] : []),
      ...supportRoles.map((roleName, idx) => ({
        id: `ar-support-${baseRoleTimestamp}-${idx}`,
        role_id: roleIdByCode[roleName] || '',
        role_name: roleName,
        role_type: 'SUPPORT'
      })),
    ];

    const newActivity = {
      ...formData,
      role: primaryRole,
      primary_role_id: primaryRoleId,
      support_roles: supportRoles,
      support_role_ids: supportRoleIds,
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
    setFormErrors({});
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
                  title={getRoleFullName(primaryRole)}
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
                  <div className="mb-3 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2 py-1" title={supportRoles.map(roleCode => getRoleOptionLabel(roleCode)).join(' | ')}>
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
                  <p className="text-sm text-center text-slate-500 mb-4">Inicia sesión con tu correo institucional para acceder al editor.</p>
                  <p className="text-[11px] text-center text-slate-400 mb-6">Solo usuarios admin (UID/email autorizados) pueden editar.</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <input
                              type="email" autoFocus placeholder="Correo"
                              className={`w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-all mb-3 ${authError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`}
                              value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                          />
                          <input 
                              type="password" placeholder="Contraseña"
                              className={`w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${authError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`}
                              value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                          />
                          {authError && <p className="text-xs text-red-500 mt-1 font-medium">{authError}</p>}
                      </div>
                      <div className="flex gap-3">
                          <button type="button" onClick={() => { setShowAuthModal(false); setAuthError(''); setLoginPassword(''); }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg font-bold hover:bg-slate-200">Cancelar</button>
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center gap-2"><Unlock className="w-4 h-4"/> Iniciar sesión</button>
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${confirmDialog.confirmTone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          <AlertTriangle className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">{confirmDialog.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={closeConfirmDialog} disabled={confirmDialog.isSubmitting} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed">Cancelar</button>
                      <button
                        onClick={confirmDialog.onConfirm}
                        disabled={confirmDialog.isSubmitting}
                        className={`px-4 py-2 text-white rounded-lg font-bold shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${confirmDialog.confirmTone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {confirmDialog.isSubmitting ? 'Guardando...' : (confirmDialog.confirmLabel || 'Confirmar')}
                      </button>
                  </div>
                  {confirmDialog.error && (
                    <p className="text-xs text-red-600 mt-3 font-medium">{confirmDialog.error}</p>
                  )}
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
                    <select value={safeTempRoleFilter} onChange={(e) => setTempFilters({...tempFilters, role: e.target.value})} className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:ring-0 cursor-pointer py-0.5 pl-0 pr-6 w-28 sm:w-34 truncate hover:text-purple-600 transition-colors">
                      <option value="all">Todos los Roles</option>
                      {availableRoles.map(roleCode => <option key={roleCode} value={roleCode}>{getRoleOptionLabel(roleCode)}</option>)}
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
                  <div className="ml-auto flex items-center gap-1">
                    {roles.length > 0 && (
                      <div ref={roleLegendRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setShowRoleLegend(current => !current)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                        >
                          <Info className="w-3 h-3 text-blue-600" />
                          <span>Convenciones</span>
                          <span className="text-slate-400">{showRoleLegend ? 'Ocultar' : 'Ver'}</span>
                        </button>
                        {showRoleLegend && (
                          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                            <div className="grid grid-cols-[84px_1fr] gap-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              <span>Convención</span>
                              <span>Nombre</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                              {roles.map(role => (
                                <div key={`legend-${role.id}`} className="grid grid-cols-[84px_1fr] items-center gap-2 text-[11px]">
                                  <span
                                    className="inline-flex w-fit max-w-full truncate px-2 py-0.5 rounded-md font-extrabold uppercase"
                                    style={getRoleBadgeStyle(role.code)}
                                    title={role.name}
                                  >
                                    {role.code}
                                  </span>
                                  <span className="text-slate-600 font-medium truncate" title={role.name}>{role.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                                                          title={getRoleFullName(primaryRoleName || '')}
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
                                                        title={getRoleFullName(primaryRoleName || '')}
                                                      >
                                                        Primary: {primaryRoleName || 'No definido'}
                                                      </span>
                                                      {supportRoleNames.map(role => (
                                                        <span key={`${act.id}-${role}`} className="text-[10px] px-2 py-1 rounded-md font-medium bg-slate-100 text-slate-500 border border-slate-200" title={getRoleFullName(role)}>
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
                      const draft = phaseDrafts[phase.id] || { title: phase.title || '', color: getPhaseHexColor(phase) };
                      const phaseColor = draft.color || getPhaseHexColor(phase);
                      return (
                      <div key={phase.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer relative shadow-inner">
                            <input 
                                type="color" 
                                value={phaseColor} 
                                onChange={(e) => setPhaseDrafts(current => ({
                                  ...current,
                                  [phase.id]: { ...(current[phase.id] || { title: phase.title || '', color: getPhaseHexColor(phase) }), color: e.target.value }
                                }))}
                                className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                                title="Cambiar color de la fase"
                            />
                        </div>
                        <input
                          className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                          value={draft.title}
                          onChange={(e) => setPhaseDrafts(current => ({
                            ...current,
                            [phase.id]: { ...(current[phase.id] || { title: phase.title || '', color: getPhaseHexColor(phase) }), title: e.target.value }
                          }))}
                        />
                        <button type="button" onClick={() => movePhaseByStep(phase.id, 'up')} className="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed" disabled={phases[0]?.id === phase.id} title="Mover arriba"><ChevronUp className="w-4 h-4"/></button>
                        <button type="button" onClick={() => movePhaseByStep(phase.id, 'down')} className="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed" disabled={phases[phases.length - 1]?.id === phase.id} title="Mover abajo"><ChevronDown className="w-4 h-4"/></button>
                        <button type="button" onClick={() => savePhaseDraft(phase.id)} className="text-slate-300 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded" title="Guardar cambios de la fase"><Save className="w-4 h-4"/></button>
                        <button type="button" onClick={() => requestDeletePhase(phase.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    )})}
                    <button onClick={addPhase} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-600 flex justify-center gap-2 transition-colors"><Plus className="w-4 h-4"/> Nueva Fase</button>
                  </div>
                )}
                {managementMode === 'flows' && (
                  <div className="space-y-3">
                    {flows.map((flow) => {
                      const draft = flowDrafts[flow.id] || { label: flow.label || '', color: flow.color || '#64748b' };
                      return (
                      <div key={flow.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer relative shadow-inner">
                            <input
                              type="color"
                              value={draft.color}
                              onChange={(e) => setFlowDrafts(current => ({
                                ...current,
                                [flow.id]: { ...(current[flow.id] || { label: flow.label || '', color: flow.color || '#64748b' }), color: e.target.value }
                              }))}
                              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                              title="Cambiar color de la ruta"
                            />
                         </div>
                         <input
                           className="flex-1 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                           value={draft.label}
                           onChange={(e) => setFlowDrafts(current => ({
                             ...current,
                             [flow.id]: { ...(current[flow.id] || { label: flow.label || '', color: flow.color || '#64748b' }), label: e.target.value }
                           }))}
                         />
                         <button type="button" onClick={() => moveFlowByStep(flow.id, 'up')} className="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed" disabled={flows[0]?.id === flow.id} title="Mover arriba"><ChevronUp className="w-4 h-4"/></button>
                         <button type="button" onClick={() => moveFlowByStep(flow.id, 'down')} className="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed" disabled={flows[flows.length - 1]?.id === flow.id} title="Mover abajo"><ChevronDown className="w-4 h-4"/></button>
                         <button type="button" onClick={() => saveFlowDraft(flow.id)} className="text-slate-300 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded" title="Guardar cambios de la ruta"><Save className="w-4 h-4"/></button>
                         <button type="button" onClick={() => requestDeleteFlow(flow.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    )})}
                    <button onClick={addFlow} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-600 flex justify-center gap-2 transition-colors"><Plus className="w-4 h-4"/> Nueva Ruta</button>
                  </div>
                )}
                {managementMode === 'roles' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[96px_1fr] gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Convencion</span>
                      <span>Nombre completo</span>
                    </div>
                    {roles.map((role) => {
                      const draft = roleDrafts[role.id] || { name: role.name, code: role.code, color: role.color };
                      const duplicatedCode = roles.some(currentRole => currentRole.id !== role.id && currentRole.code === draft.code);
                      return (
                        <div key={role.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer relative shadow-inner">
                            <input
                              type="color"
                              value={draft.color}
                              onChange={(e) => setRoleDrafts(current => ({
                                ...current,
                                [role.id]: { ...(current[role.id] || { name: role.name, code: role.code, color: role.color }), color: e.target.value }
                              }))}
                              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                              title="Cambiar color del rol"
                            />
                          </div>
                          <input
                            className="w-24 text-sm font-bold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                            value={draft.code}
                            onChange={(e) => setRoleDrafts(current => ({
                              ...current,
                              [role.id]: { ...(current[role.id] || { name: role.name, code: role.code, color: role.color }), code: e.target.value.toUpperCase() }
                            }))}
                            placeholder="Sigla"
                          />
                          <input
                            className="flex-1 text-sm font-semibold text-slate-700 bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                            value={draft.name}
                            onChange={(e) => setRoleDrafts(current => ({
                              ...current,
                              [role.id]: { ...(current[role.id] || { name: role.name, code: role.code, color: role.color }), name: e.target.value }
                            }))}
                            placeholder="Nombre completo del rol"
                          />
                          <button type="button" onClick={() => saveRoleDraft(role)} className="text-slate-300 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded" title="Guardar rol"><Save className="w-4 h-4"/></button>
                          <button type="button" onClick={() => requestDeleteRole(role)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        {duplicatedCode && (
                          <p className="mt-2 text-[11px] text-red-600 font-semibold">
                            La convención "{draft.code}" ya existe. Usa una sigla única.
                          </p>
                        )}
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
                        className={`w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:outline-none ${formErrors.text ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-500'}`}
                        placeholder="Ej: Busqueda de posible docente"
                        value={formData.text}
                        onChange={e=>{
                          const nextValue = e.target.value;
                          setFormData({...formData, text: nextValue});
                          if (nextValue.trim()) clearFormError('text');
                        }}
                      />
                      {formErrors.text && <p className="mt-1 text-[11px] text-red-600 font-semibold">{formErrors.text}</p>}
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
                          className={`w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:outline-none ${formErrors.duration ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-500'}`}
                          placeholder="Ej: 3 dias"
                          value={formData.duration}
                          onChange={e => {
                            const nextValue = e.target.value;
                            setFormData({...formData, duration: nextValue});
                            if (nextValue.trim()) clearFormError('duration');
                          }}
                        />
                        {formErrors.duration && <p className="mt-1 text-[11px] text-red-600 font-semibold">{formErrors.duration}</p>}
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
                        <select className={`w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:outline-none ${formErrors.role ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-500'}`} value={formData.role} onChange={e=>{
                          const nextValue = e.target.value;
                          setFormData({...formData, role: nextValue});
                          if (nextValue) clearFormError('role');
                        }}>
                            <option value="">Seleccionar...</option>
                            {availableRoles.map(roleCode => <option key={roleCode} value={roleCode}>{getRoleOptionLabel(roleCode)}</option>)}
                        </select>
                        {formErrors.role && <p className="mt-1 text-[11px] text-red-600 font-semibold">{formErrors.role}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Roles de Soporte</label>
                        <div className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableRoles.filter(role => role !== formData.role).map(role => (
                            <label key={role} className="flex items-center gap-2 text-slate-600" title={getRoleFullName(role)}>
                              <input
                                type="checkbox"
                                checked={(formData.support_roles || []).includes(role)}
                                onChange={(event) => {
                                  const current = formData.support_roles || [];
                                  const support_roles = event.target.checked ? [...current, role] : current.filter(item => item !== role);
                                  setFormData({ ...formData, support_roles });
                                }}
                              />
                              {getRoleOptionLabel(role)}
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
                      <button
                        onClick={handleSaveActivity}
                        disabled={!isFormValid}
                        className={`flex-1 py-2.5 rounded-lg font-bold shadow-lg transition-all transform flex justify-center items-center gap-2 ${isFormValid ? 'bg-slate-900 text-white hover:bg-black active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                        <Save className="w-4 h-4"/> Guardar Cambios
                      </button>
                      {(isEditingActivity || insertBeforeId) && (<button onClick={resetForm} className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>)}
                  </div>
                  {!isFormValid && (
                    <p className="text-[11px] text-slate-500">
                      Completa nombre, responsable y duracion para guardar.
                    </p>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
