// ─── LÓGICA DE LOGIN ──────────────────────────

// Esperar a que el objeto auth esté disponible
async function waitForAuth() {
    return new Promise((resolve) => {
        const checkAuth = setInterval(() => {
            if (window.auth) {
                clearInterval(checkAuth);
                resolve(window.auth);
            }
        }, 50);
    });
}

const auth = await waitForAuth();

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabButtons = document.querySelectorAll('.tab-btn');

let activeTab = 'login';

// ─── GESTIÓN DE TABS ──────────────────────────
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        
        // Actualizar tabs activos
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Mostrar contenido
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${activeTab}-form`).classList.add('active');

        // Limpiar errores
        clearErrors();
    });
});

// ─── TOGGLE VISIBILIDAD CONTRASEÑA ─────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const inputId = btn.dataset.input;
        const input = document.getElementById(inputId);
        
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    });
});

// ─── VALIDACIÓN EN TIEMPO REAL (REGISTRO) ──────
const registerPassword = document.getElementById('register-password');
const requirementsItems = {
    length: document.getElementById('req-length'),
    upper: document.getElementById('req-upper'),
    lower: document.getElementById('req-lower'),
    number: document.getElementById('req-number')
};

if (registerPassword) {
    registerPassword.addEventListener('input', () => {
        const validation = auth.validatePassword(registerPassword.value);
        
        updateRequirement('length', validation.length, requirementsItems.length);
        updateRequirement('upper', validation.uppercase, requirementsItems.upper);
        updateRequirement('lower', validation.lowercase, requirementsItems.lower);
        updateRequirement('number', validation.number, requirementsItems.number);
    });
}

function updateRequirement(key, isValid, element) {
    if (isValid) {
        element.classList.add('valid');
        element.classList.remove('invalid');
    } else {
        element.classList.add('invalid');
        element.classList.remove('valid');
    }
}

// ─── VALIDACIÓN DE CAMPOS ──────────────────────
function validateLoginEmail(email) {
    const errorEl = document.getElementById('login-email-error');
    
    if (!email.trim()) {
        errorEl.textContent = 'El email es requerido';
        return false;
    }
    
    if (!auth.validateEmail(email)) {
        errorEl.textContent = 'Email inválido';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

function validateLoginPassword(password) {
    const errorEl = document.getElementById('login-password-error');
    
    if (!password.trim()) {
        errorEl.textContent = 'La contraseña es requerida';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

function validateRegisterUsername(username) {
    const errorEl = document.getElementById('username-error');
    
    if (!username.trim()) {
        errorEl.textContent = 'El nombre de usuario es requerido';
        return false;
    }
    
    if (username.length < 3) {
        errorEl.textContent = 'Mínimo 3 caracteres';
        return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorEl.textContent = 'Solo letras, números y guiones bajos';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

function validateRegisterEmail(email) {
    const errorEl = document.getElementById('register-email-error');
    
    if (!email.trim()) {
        errorEl.textContent = 'El email es requerido';
        return false;
    }
    
    if (!auth.validateEmail(email)) {
        errorEl.textContent = 'Email inválido';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

function validateRegisterPassword(password) {
    const errorEl = document.getElementById('register-password-error');
    
    if (!password.trim()) {
        errorEl.textContent = 'La contraseña es requerida';
        return false;
    }
    
    const validation = auth.validatePassword(password);
    if (!Object.values(validation).every(v => v)) {
        errorEl.textContent = 'La contraseña no cumple los requisitos';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

function validateRegisterConfirm(password, confirm) {
    const errorEl = document.getElementById('confirm-error');
    
    if (!confirm.trim()) {
        errorEl.textContent = 'Confirma tu contraseña';
        return false;
    }
    
    if (password !== confirm) {
        errorEl.textContent = 'Las contraseñas no coinciden';
        return false;
    }
    
    errorEl.textContent = '';
    return true;
}

// ─── LIMPIAR ERRORES ──────────────────────────
function clearErrors() {
    document.querySelectorAll('.error').forEach(el => {
        el.textContent = '';
    });
}

// ─── SUBMIT LOGIN ──────────────────────────────
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Validar campos
    if (!validateLoginEmail(email) || !validateLoginPassword(password)) {
        return;
    }

    // Intentar login
    const result = await auth.login(email, password);

    if (result.success) {
        if (rememberMe) {
            localStorage.setItem('superchat_remember', email);
        }
        
        // Redirigir al chat
        setTimeout(() => {
            window.location.href = '/Index.html';
        }, 500);
    } else {
        document.getElementById('login-error').textContent = result.message;
    }
});

// ─── SUBMIT REGISTRO ──────────────────────────
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    // Validar campos
    if (!validateRegisterUsername(username) || 
        !validateRegisterEmail(email) || 
        !validateRegisterPassword(password) ||
        !validateRegisterConfirm(password, confirm)) {
        return;
    }

    // Intentar registro
    const result = await auth.register(email, username, password);

    if (result.success) {
        setTimeout(() => {
            window.location.href = '/Index.html';
        }, 500);
    } else {
        document.getElementById('register-error').textContent = result.message;
    }
});

// ─── CARGAR EMAIL RECORDADO ──────────────────
window.addEventListener('DOMContentLoaded', () => {
    const remembered = localStorage.getItem('superchat_remember');
    if (remembered) {
        document.getElementById('login-email').value = remembered;
        document.getElementById('remember-me').checked = true;
    }
});
