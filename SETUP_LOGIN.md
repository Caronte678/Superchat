# 🔐 Sistema de Login - Documentación

## ✅ Lo que ya está implementado

### 1. **Autenticación Local** (`auth.js`)
- ✓ Sistema de registro con validaciones
- ✓ Validación de contraseñas (8+ caracteres, mayúsculas, minúsculas, números)
- ✓ Validación de emails
- ✓ Prevención de duplicados
- ✓ Almacenamiento en `localStorage`
- ✓ Login con sesión persistente
- ✓ Opción "Recuérdame"

### 2. **Páginas y Estilos**
- ✓ `login.html` - Página de login/registro
- ✓ `login-style.css` - Estilos responsivos
- ✓ `login.js` - Lógica de validación en tiempo real

### 3. **Protección de Rutas**
- ✓ El chat (`Index.html`) requiere autenticación
- ✓ Si no estás autenticado, te redirige a `/login.html`
- ✓ La raíz (`/`) redirige a `/login.html`

### 4. **Interfaz de Usuario**
- ✓ Nombre de usuario en el header
- ✓ Botón de logout con confirmación
- ✓ Mensajes de sistema para conexiones

## 🚀 Usuario Demo (Localmente)

Para probar el login sin crear una cuenta:
- **Email**: `demo@superchat.com`
- **Contraseña**: `Demo1234`

---

## 🔥 Integración con Firebase (Siguiente Paso)

Para migrar a Firebase Realtime Database y Authentication, sigue estos pasos:

### 1. **Configurar Proyecto Firebase**

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Registra tu aplicación web
4. Copia las credenciales de configuración

### 2. **Actualizar `auth.js` para Firebase**

Reemplaza el archivo `public/auth.js` con:

```javascript
// Importar Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js";

// Configuración de Firebase (REEMPLAZAR CON TUS DATOS)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ─── CLASE DE AUTENTICACIÓN ──────────────────

class Auth {
    constructor() {
        this.storageKey = 'superchat_user';
        this.user = null;
        this.setupAuthStateListener();
    }

    // Escuchar cambios de autenticación
    setupAuthStateListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = {
                    id: user.uid,
                    email: user.email,
                    username: user.displayName || user.email.split('@')[0],
                    loginAt: new Date().toISOString()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(this.user));
            } else {
                this.user = null;
                localStorage.removeItem(this.storageKey);
            }
        });
    }

    // Validaciones
    validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    validatePassword(password) {
        return {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password)
        };
    }

    // Registrar usuario
    async register(email, username, password) {
        try {
            // Validaciones
            if (!this.validateEmail(email)) {
                return { success: false, message: 'Email inválido' };
            }

            const validation = this.validatePassword(password);
            if (!Object.values(validation).every(v => v)) {
                return { success: false, message: 'La contraseña no cumple los requisitos' };
            }

            // Crear usuario en Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Guardar datos adicionales en Realtime Database
            await set(ref(database, 'users/' + user.uid), {
                email: email,
                username: username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return { success: true, message: 'Cuenta creada exitosamente' };
        } catch (error) {
            console.error('Error en registro:', error);
            
            if (error.code === 'auth/email-already-in-use') {
                return { success: false, message: 'Este email ya está registrado' };
            }
            
            return { success: false, message: 'Error al crear la cuenta' };
        }
    }

    // Iniciar sesión
    async login(email, password) {
        try {
            if (!this.validateEmail(email)) {
                return { success: false, message: 'Email inválido' };
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Obtener datos del usuario desde Realtime Database
            const userRef = ref(database, 'users/' + user.uid);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                this.user = {
                    id: user.uid,
                    email: user.email,
                    username: userData.username,
                    loginAt: new Date().toISOString()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(this.user));
                return { success: true, message: 'Sesión iniciada', user: this.user };
            }

            return { success: true, message: 'Sesión iniciada', user: { id: user.uid, email: user.email } };
        } catch (error) {
            console.error('Error en login:', error);
            
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                return { success: false, message: 'Email o contraseña inválidos' };
            }
            
            return { success: false, message: 'Error al iniciar sesión' };
        }
    }

    // Obtener usuario actual
    getCurrentUser() {
        if (this.user) return this.user;
        const session = localStorage.getItem(this.storageKey);
        return session ? JSON.parse(session) : null;
    }

    // Verificar si está autenticado
    isAuthenticated() {
        return auth.currentUser !== null;
    }

    // Cerrar sesión
    async logout() {
        try {
            await signOut(auth);
            localStorage.removeItem(this.storageKey);
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
}

// Instancia global
const auth_instance = new Auth();
```

### 3. **Actualizar `login.html`**

Agrega esta línea antes del cierre de `</body>`:

```html
<script type="module" src="auth.js"></script>
<script type="module" src="login.js"></script>
```

Actualiza también `chat.js` para que sea un módulo:

```html
<script type="module" src="chat.js"></script>
```

### 4. **Configurar Reglas de Seguridad en Firebase**

En la sección "Realtime Database" > "Reglas", establece:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 5. **Habilitar Authentication Methods**

En Firebase Console:
1. Ve a Authentication > Sign-in method
2. Habilita "Email/Password"

### 6. **Actualizar `server.js` (Opcional)**

Si quieres validar tokens de Firebase en el servidor:

```javascript
const admin = require('firebase-admin');

// Inicializar Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(require('./path/to/serviceAccountKey.json')),
    databaseURL: 'https://your-project.firebaseio.com'
});

// Middleware para verificar token
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error('Authentication error'));
    }

    admin.auth().verifyIdToken(token)
        .then(decodedToken => {
            socket.userId = decodedToken.uid;
            socket.username = decodedToken.email;
            next();
        })
        .catch(error => next(new Error('Authentication error')));
});
```

---

## 📦 Hosting en Firebase

### 1. **Instalar Firebase CLI**

```bash
npm install -g firebase-tools
```

### 2. **Inicializar Firebase Hosting**

```bash
firebase login
firebase init hosting
```

### 3. **Deploy**

```bash
firebase deploy
```

Tu sitio estará en: `https://your-project.web.app`

---

## 🔒 Seguridad

**En Producción, asegúrate de:**

1. ✅ Usar HTTPS
2. ✅ No expongas claves de Firebase en el código
3. ✅ Configura CORS correctamente
4. ✅ Valida todo en el servidor también
5. ✅ Usa variables de entorno para configuración sensible

---

## 📝 Estructura de Datos Firebase Sugerida

```
/users/{uid}
  - email: string
  - username: string
  - createdAt: timestamp
  - updatedAt: timestamp
  - avatar: string (URL)
  - bio: string

/rooms/{roomId}
  - name: string
  - createdBy: uid
  - createdAt: timestamp
  - members: {uid: true}

/messages/{roomId}/{messageId}
  - sender: uid
  - text: string
  - type: "text" | "image" | "audio" | "file"
  - timestamp: timestamp
  - file: {name, size, type, url}
```

---

## ✨ Próximas Mejoras

- [ ] Recuperación de contraseña
- [ ] Autenticación con Google/GitHub
- [ ] Verificación de email
- [ ] Perfiles de usuario
- [ ] Avatar personalizado
- [ ] Historial de mensajes persistente

---

¡Listo para migrar a Firebase cuando lo necesites! 🚀
