// ─── SISTEMA DE AUTENTICACIÓN CON FIREBASE ────

import { auth as firebaseAuth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    ref, 
    set, 
    get, 
    update 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

class Auth {
    constructor() {
        this.storageKey = 'superchat_user';
        this.user = null;
        this.authReady = false; // true solo cuando this.user ya quedó resuelto (con username) o confirmado null
        this.setupAuthStateListener();
    }

    // Escuchar cambios de autenticación
    setupAuthStateListener() {
        onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
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
                    } else {
                        this.user = {
                            id: user.uid,
                            email: user.email,
                            username: user.email.split('@')[0],
                            loginAt: new Date().toISOString()
                        };
                    }
                    localStorage.setItem(this.storageKey, JSON.stringify(this.user));
                } catch (error) {
                    console.error('Error al obtener datos del usuario:', error);
                    // Aunque falle la consulta a Database, no dejamos username vacío:
                    // usamos el prefijo del email como respaldo para no romper el chat.
                    this.user = {
                        id: user.uid,
                        email: user.email,
                        username: user.email.split('@')[0],
                        loginAt: new Date().toISOString()
                    };
                }
            } else {
                this.user = null;
                localStorage.removeItem(this.storageKey);
            }
            this.authReady = true; // recién aquí está garantizado que this.user tiene username (o es null)
        });
    }

    // Validar email
    validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    // Validar contraseña
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

            if (!username || username.trim().length < 3) {
                return { success: false, message: 'El nombre de usuario debe tener al menos 3 caracteres' };
            }

            const validation = this.validatePassword(password);
            if (!Object.values(validation).every(v => v)) {
                return { success: false, message: 'La contraseña no cumple los requisitos' };
            }

            // Crear usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            const user = userCredential.user;

            // Actualizar perfil con el nombre de usuario
            await updateProfile(user, { displayName: username });

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
            if (error.code === 'auth/weak-password') {
                return { success: false, message: 'La contraseña es muy débil' };
            }
            
            return { success: false, message: error.message || 'Error al crear la cuenta' };
        }
    }

    // Iniciar sesión
    async login(email, password) {
        try {
            if (!this.validateEmail(email)) {
                return { success: false, message: 'Email inválido' };
            }

            const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
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
            if (error.code === 'auth/too-many-requests') {
                return { success: false, message: 'Demasiados intentos fallidos. Intenta más tarde.' };
            }
            
            return { success: false, message: error.message || 'Error al iniciar sesión' };
        }
    }

    // Obtener usuario actual
    getCurrentUser() {
        if (this.user) return this.user;
        const session = localStorage.getItem(this.storageKey);
        return session ? JSON.parse(session) : null;
    }

    // True solo cuando this.user ya fue resuelto desde Firebase (con username garantizado) o confirmado como null
    isAuthReady() {
        return this.authReady;
    }

    // Verificar si está autenticado
    isAuthenticated() {
        return firebaseAuth.currentUser !== null;
    }

    // Cerrar sesión
    async logout() {
        try {
            await signOut(firebaseAuth);
            localStorage.removeItem(this.storageKey);
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            window.location.href = '/login.html';
        }
    }

    // Obtener token de autenticación (para Socket.io)
    async getIdToken() {
        if (firebaseAuth.currentUser) {
            return await firebaseAuth.currentUser.getIdToken();
        }
        return null;
    }
}

// Instancia global
window.auth = new Auth();
