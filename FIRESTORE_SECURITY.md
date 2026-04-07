# Seguridad de Cloud Firestore (`mapa-cecp-db`)

## 1) Qué está pasando
Tu proyecto probablemente está usando reglas de prueba (`allow read, write: if true;`) que expiran en 30 días.
Cuando expiran, Firebase empieza a negar acceso a clientes.

## 2) Qué se dejó listo en este repositorio
- `firestore.rules`: reglas productivas con:
  - lectura solo para usuarios autenticados (`request.auth != null`);
  - escritura solo para administradores (`custom claim admin` o `UID` en lista);
  - validación de estructura para `roles`, `phases`, `flows`, `activities`;
  - bloqueo de cualquier ruta no contemplada.
- `firebase.json`: configuración para desplegar reglas.
- `.firebaserc`: proyecto por defecto `mapa-cecp-db`.

## 3) Acción obligatoria antes de desplegar
Edita `firestore.rules` y reemplaza:
- `REEMPLAZAR_UID_ADMIN_1`
- `REEMPLAZAR_UID_ADMIN_2`

por UIDs reales de usuarios administradores.

¿Dónde sacar los UID?
1. Firebase Console -> `Authentication` -> `Users`.
2. Copia el `UID` de cada usuario admin.
3. Pégalo en `firestore.rules`.

## 4) Despliegue de reglas
Ya dejamos `firebase-tools` instalado como dependencia local del proyecto.

1. Inicia sesión (abre enlace y pega el código en terminal):
   - `npm run firebase:login`
2. Verifica cuentas activas:
   - `npm run firebase -- login:list`
3. Verifica proyecto:
   - `npm run firebase -- use mapa-cecp-db`
4. Publica reglas:
   - `npm run firestore:deploy`

Nota: los scripts ya están preparados para evitar el error de permisos de `~/.config`.

## 5) Nota importante sobre tu app actual
Actualmente el frontend usa `signInAnonymously()` y una contraseña local de interfaz (`VITE_ADMIN_PASSWORD`) que no protege Firestore.
Con reglas sólidas:
- lo ideal es mantener lectura con anónimo/autenticado;
- para edición, migrar a login real (Google/Email) y asignar `custom claim admin`.

Si quieres conservar el candado visual del editor:
1. Crea `.env.local` desde el ejemplo:
   - `cp .env.example .env.local`
2. Define una contraseña fuerte en `VITE_ADMIN_PASSWORD`.

## 6) Verificación rápida
Después del deploy:
- un usuario normal autenticado debe poder leer;
- un usuario sin rol admin no debe poder escribir;
- un admin sí debe crear/editar/borrar.
