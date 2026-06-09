# 🔥 Configuración de Firebase - Guía Rápida

## 1. Habilitar Authentication en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto "superchat-5fb0d"
3. Ve a **Authentication** → **Sign-in method**
4. Habilita **Email/Password**

## 2. Crear Realtime Database

1. Ve a **Realtime Database**
2. Haz clic en **Create Database**
3. Selecciona región: `us-central1`
4. Inicia en modo **Test**
5. Copia la URL de la base de datos (algo como `https://superchat-5fb0d-default-rtdb.firebaseio.com`)

## 3. Configurar Reglas de Seguridad

En **Realtime Database** → **Rules**, reemplaza con esto:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        ".validate": "newData.hasChildren(['email', 'username'])"
      }
    },
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": "root.child('users').child(auth.uid).exists()",
        "members": {
          "$uid": {
            ".write": "$uid === auth.uid || auth.uid === root.child('rooms').child($roomId).child('createdBy').val()"
          }
        }
      }
    },
    "messages": {
      "$roomId": {
        ".read": true,
        ".write": "root.child('users').child(auth.uid).exists()"
      }
    }
  }
}
```

Después haz clic en **Publish**

## 4. Variables de Entorno (Opcional para Producción)

Si quieres proteger la clave API, crea un archivo `.env.local` en la raíz:

```
VITE_FIREBASE_API_KEY=AIzaSyCPGiohg9ldHyxkt27gLwDQxlOr75bjuEI
VITE_FIREBASE_AUTH_DOMAIN=superchat-5fb0d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=superchat-5fb0d
VITE_FIREBASE_STORAGE_BUCKET=superchat-5fb0d.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=793648413217
VITE_FIREBASE_APP_ID=1:793648413217:web:bfbf9655cc059f72798160
VITE_FIREBASE_DATABASE_URL=https://superchat-5fb0d-default-rtdb.firebaseio.com
```

Y actualiza `firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};
```

## 5. Probar la Integración

1. Inicia el servidor: `node server.js`
2. Ve a `http://localhost:3000`
3. Crea una nueva cuenta
4. En Firebase Console → Realtime Database, deberías ver la estructura:
   ```
   users/
   └── [uid]/
       ├── email: "..."
       ├── username: "..."
       ├── createdAt: "..."
       └── updatedAt: "..."
   ```

## 6. Desplegar en Firebase Hosting

### Instalación

```bash
npm install -g firebase-tools
firebase login
cd "tu-proyecto"
firebase init hosting
```

### Configurar `firebase.json`

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/Index.html"
      }
    ]
  }
}
```

### Desplegar

```bash
firebase deploy
```

Tu sitio estará en: `https://superchat-5fb0d.web.app`

## ✅ Checklist

- [ ] Authentication habilitado (Email/Password)
- [ ] Realtime Database creada
- [ ] Reglas de seguridad configuradas
- [ ] `firebase-config.js` tiene la URL correcta
- [ ] `auth.js` está importando Firebase correctamente
- [ ] El servidor inicia sin errores
- [ ] El login/registro funciona
- [ ] Puedes ver los datos en Realtime Database

## 🔧 Troubleshooting

### Error: "Cannot import module"
→ Asegúrate de que estés usando `type="module"` en los scripts HTML

### Error: "auth is not defined"
→ Espera a que `window.auth` esté disponible antes de usarlo

### Error: "Permission denied" en Database
→ Verifica que las reglas de seguridad estén publicadas correctamente

### Error: "Email already in use"
→ Normal, significa que el email ya está registrado en Firebase

---

¡Listo! 🚀 Tu Superchat está conectado a Firebase.
