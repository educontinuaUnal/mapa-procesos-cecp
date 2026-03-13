diff --git a/src/App.jsx b/src/App.jsx
index 4b71982484c4204538baeca99f9e1f7b33e8ec32..9e8d7e63825f0a9886a10f9a6eb522d89d79ca70 100644
--- a/src/App.jsx
+++ b/src/App.jsx
@@ -1,26 +1,26 @@
-import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
+import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
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
 
@@ -148,50 +148,80 @@ export default function App() {
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
+  const [insertBeforeId, setInsertBeforeId] = useState(null);
+  const [insertPhaseId, setInsertPhaseId] = useState(null);
+  const [isDraggingNewActivity, setIsDraggingNewActivity] = useState(false);
+  const [draggedActivityId, setDraggedActivityId] = useState(null);
+  const [dragDropTarget, setDragDropTarget] = useState('none');
+
+  const ORDER_GAP = 1024;
+
+  const sortedActivities = useMemo(
+    () => [...activities].sort((a, b) => {
+      if (a.phaseId !== b.phaseId) return a.phaseId.localeCompare(b.phaseId);
+      const aOrder = a.order_index ?? (a.id * ORDER_GAP);
+      const bOrder = b.order_index ?? (b.id * ORDER_GAP);
+      if (aOrder !== bOrder) return aOrder - bOrder;
+      return a.id - b.id;
+    }),
+    [activities]
+  );
+
+  const getPhaseSortedActivities = (phaseId) => sortedActivities.filter(activity => activity.phaseId === phaseId);
+  const getTargetKey = (targetId, phaseId) => (targetId === null ? `end:${phaseId}` : `before:${targetId}`);
+  const displayOrderByActivityId = useMemo(() => {
+    const result = {};
+    phases.forEach(phase => {
+      sortedActivities.filter(activity => activity.phaseId === phase.id).forEach((activity, index) => {
+        result[activity.id] = index + 1;
+      });
+    });
+    return result;
+  }, [phases, sortedActivities]);
 
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
 
@@ -205,214 +235,241 @@ export default function App() {
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
-           stageDefaultsData.activities.forEach(a => batch.set(doc(db, stageColPath('activities'), a.id.toString()), a));
+           stageDefaultsData.activities.forEach((a, index) => batch.set(doc(db, stageColPath('activities'), a.id.toString()), { ...a, order_index: (index + 1) * ORDER_GAP }));
            await batch.commit();
-           data = stageDefaultsData.activities;
+           data = stageDefaultsData.activities.map((a, index) => ({ ...a, order_index: (index + 1) * ORDER_GAP }));
+        }
+
+        const missingOrder = data.filter(activity => typeof activity.order_index !== 'number');
+        if (missingOrder.length > 0) {
+          const batch = writeBatch(db);
+          const phaseCatalog = data.length > 0
+            ? Array.from(new Set(data.map(activity => activity.phaseId))).map(id => ({ id }))
+            : stageDefaultsData.phases;
+
+          phaseCatalog.forEach(phase => {
+            const phaseActivities = data
+              .filter(activity => activity.phaseId === phase.id)
+              .sort((a, b) => a.id - b.id);
+            phaseActivities.forEach((activity, index) => {
+              if (typeof activity.order_index !== 'number') {
+                const order_index = (index + 1) * ORDER_GAP;
+                activity.order_index = order_index;
+                batch.set(doc(db, stageColPath('activities'), activity.id.toString()), { order_index }, { merge: true });
+              }
+            });
+          });
+          await batch.commit();
         }
 
         setActivities(data);
         setIsLoading(false);
       }, (error) => console.error(error));
 
       return () => { unsubFlows(); unsubPhases(); unsubActs(); };
     };
 
     const cleanup = setupDatabase();
     return () => cleanup;
   }, [user, activeStage]);
 
 
-  // --- CALCULO DE LÍNEAS ROBUSTO ---
-  const calculateLines = () => {
-    if (activeTab !== 'diagram_node' || !containerRef.current || activities.length === 0) return;
+  const getDownstreamPath = useCallback((startId, allActs = activities) => {
+    let path = new Set([startId]);
+    let queue = [startId];
+    while(queue.length > 0) {
+      const current = queue.shift();
+      const children = allActs.filter(a => a.predecessors.includes(current));
+      children.forEach(child => { if (!path.has(child.id)) { path.add(child.id); queue.push(child.id); } });
+    }
+    return path;
+  }, [activities]);
 
-    const newLines = [];
-    const containerRect = containerRef.current.getBoundingClientRect();
-    const scrollLeft = containerRef.current.scrollLeft;
-    const scrollTop = containerRef.current.scrollTop;
+  const getUpstreamPath = useCallback((startId, allActs = activities) => {
+    let path = new Set([startId]);
+    const findParents = (id) => {
+      const act = allActs.find(a => a.id === id);
+      if(act && act.predecessors) { act.predecessors.forEach(pid => { path.add(pid); findParents(pid); }); }
+    };
+    findParents(startId);
+    return path;
+  }, [activities]);
 
-    activities.forEach(act => {
-      if (getOpacity(act) === 'hidden') return;
+  const getOpacity = useCallback((act) => {
+    const matchesFlow = activeFilters.flow === 'all' || (act.flows && act.flows.includes(activeFilters.flow));
+    const matchesRole = activeFilters.role === 'all' || act.role === activeFilters.role;
+    if (!matchesFlow || !matchesRole) return 'hidden';
+    if (selectedActivityId) {
+      const downstream = getDownstreamPath(selectedActivityId);
+      const upstream = getUpstreamPath(selectedActivityId);
+      if (downstream.has(act.id) || upstream.has(act.id)) return 'opacity-100 scale-100';
+      return 'opacity-20 grayscale';
+    }
+    return 'opacity-100';
+  }, [activeFilters.flow, activeFilters.role, getDownstreamPath, getUpstreamPath, selectedActivityId]);
 
-      if (act.predecessors && act.predecessors.length > 0) {
-        const endNode = nodeRefs.current[act.id];
-        
-        act.predecessors.forEach(predId => {
-          const startNode = nodeRefs.current[predId];
-          const predAct = activities.find(a => a.id === predId);
-
-          if (startNode && endNode && predAct && getOpacity(predAct) !== 'hidden') {
-             const startRect = startNode.getBoundingClientRect();
-             const endRect = endNode.getBoundingClientRect();
-
-             const startX = startRect.right - containerRect.left + scrollLeft;
-             const startY = startRect.top + (startRect.height / 2) - containerRect.top + scrollTop;
-             const endX = endRect.left - containerRect.left + scrollLeft;
-             const endY = endRect.top + (endRect.height / 2) - containerRect.top + scrollTop;
-
-             let strokeColor = '#e2e8f0'; 
-             let strokeWidth = 2;
-             let zIndex = 0;
-             let isFlowActive = false;
-             
-             if (activeFilters.flow !== 'all') {
+  useLayoutEffect(() => {
+    const calculateLines = () => {
+      if (activeTab !== 'diagram_node' || !containerRef.current || activities.length === 0) return;
+
+      const newLines = [];
+      const containerRect = containerRef.current.getBoundingClientRect();
+      const scrollLeft = containerRef.current.scrollLeft;
+      const scrollTop = containerRef.current.scrollTop;
+
+      activities.forEach(act => {
+        if (getOpacity(act) === 'hidden') return;
+
+        if (act.predecessors && act.predecessors.length > 0) {
+          const endNode = nodeRefs.current[act.id];
+
+          act.predecessors.forEach(predId => {
+            const startNode = nodeRefs.current[predId];
+            const predAct = activities.find(a => a.id === predId);
+
+            if (startNode && endNode && predAct && getOpacity(predAct) !== 'hidden') {
+              const startRect = startNode.getBoundingClientRect();
+              const endRect = endNode.getBoundingClientRect();
+
+              const startX = startRect.right - containerRect.left + scrollLeft;
+              const startY = startRect.top + (startRect.height / 2) - containerRect.top + scrollTop;
+              const endX = endRect.left - containerRect.left + scrollLeft;
+              const endY = endRect.top + (endRect.height / 2) - containerRect.top + scrollTop;
+
+              let strokeColor = '#e2e8f0';
+              let strokeWidth = 2;
+              let zIndex = 0;
+              let isFlowActive = false;
+
+              if (activeFilters.flow !== 'all') {
                 if (act.flows.includes(activeFilters.flow) && predAct.flows.includes(activeFilters.flow)) {
-                    const flowObj = flows.find(f => f.id === activeFilters.flow);
-                    if (flowObj) strokeColor = flowObj.color;
-                    strokeWidth = 3;
-                    zIndex = 10;
-                    isFlowActive = true;
+                  const flowObj = flows.find(f => f.id === activeFilters.flow);
+                  if (flowObj) strokeColor = flowObj.color;
+                  strokeWidth = 3;
+                  zIndex = 10;
+                  isFlowActive = true;
                 }
-             } else if (selectedActivityId) {
+              } else if (selectedActivityId) {
                 const downstream = getDownstreamPath(selectedActivityId);
                 const upstream = getUpstreamPath(selectedActivityId);
                 const isRelated = (downstream.has(act.id) && downstream.has(predId)) || (upstream.has(act.id) && upstream.has(predId));
-                
+
                 if (isRelated) {
-                    strokeColor = '#64748b'; 
-                    strokeWidth = 3;
-                    zIndex = 10;
-                    isFlowActive = true;
+                  strokeColor = '#64748b';
+                  strokeWidth = 3;
+                  zIndex = 10;
+                  isFlowActive = true;
                 }
-             }
-
-             const dist = Math.abs(endX - startX);
-             const cpOffset = dist * 0.5; 
-
-             newLines.push({
-               id: `${predId}-${act.id}`,
-               d: `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`,
-               color: strokeColor,
-               width: strokeWidth,
-               zIndex: zIndex,
-               animated: isFlowActive
-             });
-          }
-        });
-      }
-    });
-    setLines(newLines);
-  };
+              }
+
+              const dist = Math.abs(endX - startX);
+              const cpOffset = dist * 0.5;
+
+              newLines.push({
+                id: `${predId}-${act.id}`,
+                d: `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`,
+                color: strokeColor,
+                width: strokeWidth,
+                zIndex,
+                animated: isFlowActive,
+              });
+            }
+          });
+        }
+      });
+
+      setLines(newLines);
+    };
 
-  useLayoutEffect(() => {
     calculateLines();
     const container = containerRef.current;
     if (container) container.addEventListener('scroll', calculateLines);
     window.addEventListener('resize', calculateLines);
     return () => {
         if (container) container.removeEventListener('scroll', calculateLines);
         window.removeEventListener('resize', calculateLines);
     };
-  }, [activities, activeFilters, activeTab, selectedActivityId, phases, flows]);
+  }, [activities, activeFilters, activeTab, flows, selectedActivityId, getDownstreamPath, getOpacity, getUpstreamPath]);
 
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
+    setInsertBeforeId(null);
+    setInsertPhaseId(null);
+    setIsDraggingNewActivity(false);
+    setDraggedActivityId(null);
+    setDragDropTarget('none');
     setTempFilters({ flow: 'all', role: 'all' });
     setActiveFilters({ flow: 'all', role: 'all' });
     setFormData({ text: '', role: '', duration: '', phaseId: '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
   };
 
   const applyFilters = () => { setActiveFilters(tempFilters); setSelectedActivityId(null); };
   const clearFilters = () => { const reset = { flow: 'all', role: 'all' }; setTempFilters(reset); setActiveFilters(reset); setSelectedActivityId(null); };
 
-  const getDownstreamPath = (startId, allActs = activities) => {
-    let path = new Set([startId]);
-    let queue = [startId];
-    while(queue.length > 0) {
-      const current = queue.shift();
-      const children = allActs.filter(a => a.predecessors.includes(current));
-      children.forEach(child => { if (!path.has(child.id)) { path.add(child.id); queue.push(child.id); } });
-    }
-    return path;
-  };
-
-  const getUpstreamPath = (startId, allActs = activities) => {
-    let path = new Set([startId]);
-    const findParents = (id) => {
-      const act = allActs.find(a => a.id === id);
-      if(act && act.predecessors) { act.predecessors.forEach(pid => { path.add(pid); findParents(pid); }); }
-    };
-    findParents(startId);
-    return path;
-  };
-
-  const getOpacity = (act) => {
-    const matchesFlow = activeFilters.flow === 'all' || (act.flows && act.flows.includes(activeFilters.flow));
-    const matchesRole = activeFilters.role === 'all' || act.role === activeFilters.role;
-    if (!matchesFlow || !matchesRole) return 'hidden';
-    if (selectedActivityId) {
-      const downstream = getDownstreamPath(selectedActivityId);
-      const upstream = getUpstreamPath(selectedActivityId);
-      if (downstream.has(act.id) || upstream.has(act.id)) return 'opacity-100 scale-100';
-      return 'opacity-20 grayscale';
-    }
-    return 'opacity-100';
-  };
-
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
@@ -456,114 +513,255 @@ export default function App() {
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
+
+  const resetForm = () => {
+    setIsEditingActivity(null);
+    setInsertBeforeId(null);
+    setInsertPhaseId(null);
+    setDragDropTarget('none');
+    setIsDraggingNewActivity(false);
+    setDraggedActivityId(null);
+    setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
+  };
+
+  const getOrderedActivitiesForPhase = (phaseId, excludeActivityId = null) => {
+    return getPhaseSortedActivities(phaseId).filter(activity => activity.id !== excludeActivityId);
+  };
+
+  const rebalancePhaseOrderIndexes = async (phaseId, excludeActivityId = null) => {
+    const phaseActivities = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
+    const batch = writeBatch(db);
+    phaseActivities.forEach((activity, index) => {
+      const order_index = (index + 1) * ORDER_GAP;
+      if (activity.order_index !== order_index) {
+        batch.set(doc(db, getStageColPath(activeStage, 'activities'), activity.id.toString()), { order_index }, { merge: true });
+      }
+    });
+    await batch.commit();
+  };
+
+  const calculateOrderIndex = async (phaseId, beforeActivityId = null, excludeActivityId = null) => {
+    const phaseActivities = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
+    const targetIndex = beforeActivityId === null
+      ? phaseActivities.length
+      : phaseActivities.findIndex(activity => activity.id === beforeActivityId);
+
+    const insertionIndex = targetIndex === -1 ? phaseActivities.length : targetIndex;
+    const prev = phaseActivities[insertionIndex - 1] || null;
+    const next = phaseActivities[insertionIndex] || null;
+
+    const prevOrder = prev ? prev.order_index : null;
+    const nextOrder = next ? next.order_index : null;
+
+    if (prevOrder === null && nextOrder === null) return ORDER_GAP;
+    if (prevOrder !== null && nextOrder === null) return prevOrder + ORDER_GAP;
+    if (prevOrder === null && nextOrder !== null) return nextOrder - ORDER_GAP;
+
+    const midpoint = (prevOrder + nextOrder) / 2;
+    if ((nextOrder - prevOrder) > 0.0001) return midpoint;
+
+    await rebalancePhaseOrderIndexes(phaseId, excludeActivityId);
+    const rebalanced = getOrderedActivitiesForPhase(phaseId, excludeActivityId);
+    const idx = beforeActivityId === null
+      ? rebalanced.length
+      : rebalanced.findIndex(activity => activity.id === beforeActivityId);
+    const safeIndex = idx === -1 ? rebalanced.length : idx;
+    const prevRebalanced = rebalanced[safeIndex - 1] || null;
+    const nextRebalanced = rebalanced[safeIndex] || null;
+    if (!prevRebalanced && !nextRebalanced) return ORDER_GAP;
+    if (prevRebalanced && !nextRebalanced) return prevRebalanced.order_index + ORDER_GAP;
+    if (!prevRebalanced && nextRebalanced) return nextRebalanced.order_index - ORDER_GAP;
+    return (prevRebalanced.order_index + nextRebalanced.order_index) / 2;
+  };
+
+  const startNewActivityDrag = (event) => {
+    resetForm();
+    event.dataTransfer.effectAllowed = 'copy';
+    event.dataTransfer.setData('text/plain', 'new');
+    setIsDraggingNewActivity(true);
+  };
+
+  const endNewActivityDrag = () => {
+    setIsDraggingNewActivity(false);
+    setDragDropTarget('none');
+  };
+
+  const startActivityDrag = (event, activityId) => {
+    setDraggedActivityId(activityId);
+    setIsDraggingNewActivity(false);
+    event.dataTransfer.effectAllowed = 'move';
+    event.dataTransfer.setData('text/plain', `existing:${activityId}`);
+  };
+
+  const endActivityDrag = () => {
+    setDraggedActivityId(null);
+    setDragDropTarget('none');
+  };
+
+  const handleDragOverInsertion = (event, targetId, phaseId) => {
+    if (!isDraggingNewActivity && !draggedActivityId) return;
+    event.preventDefault();
+    event.dataTransfer.dropEffect = isDraggingNewActivity ? 'copy' : 'move';
+    setDragDropTarget(getTargetKey(targetId, phaseId));
+  };
+
+  const moveExistingActivity = async (activityId, targetBeforeId, targetPhaseId) => {
+    const movingActivity = activities.find(activity => activity.id === activityId);
+    if (!movingActivity) return;
+
+    const nextOrderIndex = await calculateOrderIndex(targetPhaseId, targetBeforeId, activityId);
+    await setDoc(
+      doc(db, getStageColPath(activeStage, 'activities'), activityId.toString()),
+      { phaseId: targetPhaseId, order_index: nextOrderIndex },
+      { merge: true }
+    );
+  };
+
+  const handleDropInsertion = (event, targetId, phaseId) => {
+    if (!isDraggingNewActivity && !draggedActivityId) return;
+    event.preventDefault();
+    setDragDropTarget(getTargetKey(targetId, phaseId));
+
+    if (draggedActivityId) {
+      moveExistingActivity(draggedActivityId, targetId, phaseId);
+      setDraggedActivityId(null);
+      return;
+    }
+
+    setInsertBeforeId(targetId);
+    setInsertPhaseId(phaseId);
+    setIsDraggingNewActivity(false);
+    setFormData(current => ({ ...current, phaseId }));
+  };
   
   const handleSaveActivity = async () => {
     let preds = formData.predecessors;
     if (typeof preds === 'string') { preds = preds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)); }
     
     const newActivity = { ...formData, predecessors: preds };
-    const docId = isEditingActivity ? isEditingActivity.toString() : (Math.max(0, ...activities.map(a => a.id)) + 1).toString();
-    newActivity.id = parseInt(docId);
 
-    await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), newActivity);
-    
-    setIsEditingActivity(null);
-    setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' });
+    if (isEditingActivity) {
+      const docId = isEditingActivity.toString();
+      const currentActivity = activities.find(activity => activity.id === isEditingActivity);
+      newActivity.id = parseInt(docId);
+      if (currentActivity && currentActivity.phaseId !== newActivity.phaseId) {
+        newActivity.order_index = await calculateOrderIndex(newActivity.phaseId, null, isEditingActivity);
+      } else {
+        newActivity.order_index = currentActivity?.order_index ?? newActivity.order_index;
+      }
+      await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), newActivity);
+    } else {
+      const phaseId = insertPhaseId || newActivity.phaseId;
+      const order_index = await calculateOrderIndex(phaseId, insertBeforeId, null);
+      const nextId = Math.max(0, ...activities.map(a => a.id)) + 1;
+      const docId = nextId.toString();
+      await setDoc(doc(db, getStageColPath(activeStage, 'activities'), docId), {
+        ...newActivity,
+        id: nextId,
+        phaseId,
+        order_index,
+      });
+    }
+
+    resetForm();
   };
 
   const startEdit = (activity) => {
     setIsEditingActivity(activity.id);
+    setInsertBeforeId(null);
+    setInsertPhaseId(null);
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
+    const displayNumber = displayOrderByActivityId[activity.id] || 0;
     
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
-            <span className={`${contentRotate}`}>{activity.id}</span>
+            <span className={`${contentRotate}`}>{displayNumber}</span>
         </div>
         <div className={`absolute left-16 top-1/2 -translate-y-1/2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 transition-all duration-300 pointer-events-none origin-left z-[101] ${isSelected ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-x-4 pointer-events-none'}`}>
             <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white border-b-[6px] border-b-transparent drop-shadow-sm"></div>
             <div className="flex justify-between items-center p-3 border-b border-slate-50 bg-slate-50/50 rounded-t-xl">
-                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isDecision ? 'Decisión' : 'Actividad'} #{activity.id}</span>
+                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isDecision ? 'Decisión' : 'Actividad'} #{displayNumber}</span>
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
@@ -692,100 +890,100 @@ export default function App() {
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
-                          {activities.filter(a => a.phaseId === phase.id).map(act => (
+                          {getPhaseSortedActivities(phase.id).map(act => (
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
-                        const phaseActivities = activities.filter(a => a.phaseId === phase.id);
+                        const phaseActivities = getPhaseSortedActivities(phase.id);
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
-                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md tracking-wider">ID: {act.id}</span>
+                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md tracking-wider">N°: {displayOrderByActivityId[act.id] || 0}</span>
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
@@ -844,75 +1042,136 @@ export default function App() {
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
-                  <div className="space-y-2">
+                  <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Inventario</h3>
-                        <button onClick={() => { setIsEditingActivity(null); setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' }); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all">+ Nueva</button>
+                        <button
+                          draggable
+                          onDragStart={startNewActivityDrag}
+                          onDragEnd={endNewActivityDrag}
+                          onClick={resetForm}
+                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all cursor-grab active:cursor-grabbing"
+                          title="Arrastra para insertar por posición o haz click para agregar al final"
+                        >
+                          + Nueva
+                        </button>
                      </div>
-                     {activities.map(act => (
-                        <div key={act.id} onClick={() => startEdit(act)} className={`relative p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer transition-all ${isEditingActivity === act.id ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-50' : ''}`}>
-                            <div className="pr-6">
-                                <p className="text-xs font-bold text-slate-700 truncate">{act.text}</p>
-                                <span className="text-[10px] text-slate-400">ID: {act.id}</span>
+                     {phases.map((phase) => {
+                        const phaseActivities = getPhaseSortedActivities(phase.id);
+                        const phaseColor = getPhaseHexColor(phase);
+                        return (
+                          <div key={phase.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
+                            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: phaseColor }}>
+                              {phase.title}
                             </div>
-                            <button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActivity(act.id); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
-                        </div>
-                     ))}
+
+                            {(isDraggingNewActivity || draggedActivityId) && phaseActivities.length > 0 && (
+                              <div
+                                onDragOver={(event) => handleDragOverInsertion(event, phaseActivities[0].id, phase.id)}
+                                onDrop={(event) => handleDropInsertion(event, phaseActivities[0].id, phase.id)}
+                                className={`mb-1 h-8 rounded-md border-2 border-dashed text-[11px] font-bold transition-all flex items-center justify-center ${dragDropTarget === getTargetKey(phaseActivities[0].id, phase.id) ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-400 bg-white'}`}
+                              >
+                                Insertar al inicio de {phase.title}
+                              </div>
+                            )}
+
+                            {phaseActivities.map(act => (
+                              <React.Fragment key={act.id}>
+                                {(isDraggingNewActivity || draggedActivityId) && (
+                                  <div
+                                    onDragOver={(event) => handleDragOverInsertion(event, act.id, phase.id)}
+                                    onDrop={(event) => handleDropInsertion(event, act.id, phase.id)}
+                                    className={`h-3 rounded transition-all ${dragDropTarget === getTargetKey(act.id, phase.id) ? 'bg-emerald-200' : 'bg-transparent'}`}
+                                  />
+                                )}
+                                <div
+                                  draggable
+                                  onDragStart={(event) => startActivityDrag(event, act.id)}
+                                  onDragEnd={endActivityDrag}
+                                  onClick={() => startEdit(act)}
+                                  className={`relative p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer transition-all ${isEditingActivity === act.id ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-50' : ''} ${insertBeforeId === act.id ? 'ring-2 ring-emerald-300 border-emerald-400' : ''} ${draggedActivityId === act.id ? 'opacity-40' : ''}`}
+                                >
+                                    <div className="pr-6">
+                                        <p className="text-xs font-bold text-slate-700 truncate">{act.text}</p>
+                                        <span className="text-[10px] text-slate-400">N°: {displayOrderByActivityId[act.id] || 0}</span>
+                                    </div>
+                                    <button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActivity(act.id); }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
+                                </div>
+                              </React.Fragment>
+                            ))}
+
+                            {(isDraggingNewActivity || draggedActivityId) && (
+                              <div
+                                onDragOver={(event) => handleDragOverInsertion(event, null, phase.id)}
+                                onDrop={(event) => handleDropInsertion(event, null, phase.id)}
+                                className={`mt-1 p-2 border-2 border-dashed rounded-lg text-[11px] font-bold transition-all ${dragDropTarget === getTargetKey(null, phase.id) ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-white'}`}
+                              >
+                                Soltar al final de {phase.title}
+                              </div>
+                            )}
+                          </div>
+                        );
+                     })}
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
+               {!isEditingActivity && insertBeforeId && (
+                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
+                    La nueva actividad se insertará en la fase {phases.find(p => p.id === insertPhaseId)?.title || 'seleccionada'} en la posición del ID {insertBeforeId}.
+                  </div>
+               )}
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
@@ -927,35 +1186,35 @@ export default function App() {
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
-                      {isEditingActivity && (<button onClick={() => { setIsEditingActivity(null); setFormData({ text: '', role: '', duration: '', phaseId: phases[0]?.id || '', type: 'process', predecessors: [], flows: ['all'], origin: '', condition: '' }); }} className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>)}
+                      {(isEditingActivity || insertBeforeId) && (<button onClick={resetForm} className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>)}
                   </div>
                </div>
             </div>
           </div>
         )}
       </main>
     </div>
   );
 }
