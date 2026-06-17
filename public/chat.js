// ─── VERIFICAR AUTENTICACIÓN ──────────────────

import { database } from './firebase-config.js';
import { ref, push, query, orderByChild, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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

// Esperar a que Firebase determine el estado de autenticación
async function ensureAuthenticated() {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Authentication timeout'));
        }, 5000);
        
        const checkInterval = setInterval(() => {
            // Esperamos a que authReady sea true: recién ahí this.user
            // está garantizado con un username válido (o confirmado null).
            // Antes de esto, getCurrentUser() podía devolver un valor
            // cacheado en localStorage sin username, causando que el
            // servidor recibiera socket.username = undefined.
            if (!auth.isAuthReady()) return;

            clearInterval(checkInterval);
            clearTimeout(timeout);

            const currentUser = auth.getCurrentUser();
            if (currentUser && currentUser.username) {
                resolve(currentUser);
            } else {
                window.location.href = '/login.html';
                reject(new Error('Not authenticated'));
            }
        }, 100);
    });
}

let currentUser;
try {
    currentUser = await ensureAuthenticated();
} catch (error) {
    console.error('Auth error:', error);
    window.location.href = '/login.html';
}

if (!currentUser) {
    window.location.href = '/login.html';
}

const socket = io();
const form = document.getElementById('form-container');
const input = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');
const imageInput = document.getElementById('image-input');
const fileInput = document.getElementById('file-input');
const btnImage = document.getElementById('btn-image');
const btnFile = document.getElementById('btn-file');
const btnRecord = document.getElementById('btn-record');
const btnEmoji = document.getElementById('btn-emoji');
const btnLogout = document.getElementById('btn-logout');
const usuarioNombre = document.getElementById('usuario-nombre');
const emojiPicker = document.getElementById('emoji-picker');
const salasContainer = document.getElementById('salas-container');
const salasActualTitle = document.getElementById('sala-actual-title');
const emoji = new EmojiConvertor();
emoji.replace_mode = 'unified';
emoji.allow_native = true;

// Mostrar nombre del usuario
usuarioNombre.textContent = currentUser.username;

// Logout
btnLogout.addEventListener('click', () => {
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: `¿Estás seguro de que deseas cerrar sesión?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f85149'
    }).then((result) => {
        if (result.isConfirmed) {
            auth.logout();
        }
    });
});

// Estado
let miNombre = currentUser.username;
let salaActual = 'General';
let miSocketId = null;
let salasDisponibles = [];
let mediaRecorder = null;
let grabando = false;
let audioChunks = [];

// Función para procesar emojis en el texto
function procesarEmojis(texto) {
  return emoji.replace_colons(emoji.replace_unified(texto));
} 
 
/* ─── EMOJIS ──────────────────────────────────── */
const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😢','😡','👍','👎',
  '❤️','🔥','💯','✅','🎉','🙌','👏','🤝','💪','🫡',
  '😴','🤣','😇','😈','👀','💀','🤯','🥳','😏','😬',
  '🌟','⚡','🎯','🚀','💡','🔑','📢','🎵','🍕','🍺',
];
 
EMOJIS.forEach(em => {
  const span = document.createElement('span');
  span.textContent = em;
  span.title = em;
  span.addEventListener('click', () => {
    input.value += em;
    input.focus();
  });
  emojiPicker.appendChild(span);
});
 
btnEmoji.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('visible');
});
 
document.addEventListener('click', (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== btnEmoji) {
    emojiPicker.classList.remove('visible');
  }
});

/* ─── NOMBRE DE USUARIO ───────────────────────── */
// Notificar al servidor del nuevo usuario
socket.emit('nuevoUsuario', miNombre);
// Unirse a la sala General por defecto
socket.emit('unirse-sala', 'General');

/* ─── GESTIÓN DE SALAS ────────────────────────── */

function renderizarSalas() {
  salasContainer.innerHTML = '';
  salasDisponibles.forEach(sala => {
    const div = document.createElement('div');
    div.classList.add('sala-item');
    if (sala.nombre === salaActual) {
      div.classList.add('activa');
    }

    const nombre = document.createElement('span');
    nombre.classList.add('sala-nombre');
    nombre.textContent = sala.nombre;
    nombre.addEventListener('click', () => {
      socket.emit('unirse-sala', sala.nombre);
    });
    div.appendChild(nombre);

    // Mostrar número de usuarios
    const usuarios = document.createElement('span');
    usuarios.classList.add('sala-usuarios');
    usuarios.textContent = sala.usuarios;
    div.appendChild(usuarios);

    salasContainer.appendChild(div);
  });
}

/* ─── PERSISTENCIA DE MENSAJES EN FIREBASE ────── */
// Cada mensaje se guarda bajo mensajes/{nombreSala}/{id-autogenerado}.
// El guardado lo hace el navegador de quien envía el mensaje (no quien lo
// recibe), para evitar que el mismo mensaje se escriba varias veces si hay
// varias personas en la sala.
function guardarMensaje(nombreSala, tipo, payload) {
  const refSala = ref(database, `mensajes/${nombreSala}`);
  push(refSala, {
    tipo, // 'texto' | 'imagen' | 'audio' | 'archivo'
    ...payload,
    timestamp: Date.now()
  }).catch((error) => {
    console.error('Error al guardar mensaje en Firebase:', error);
  });
}

// Trae el historial guardado de una sala y lo renderiza en orden cronológico.
async function cargarHistorial(nombreSala) {
  try {
    const refSala = ref(database, `mensajes/${nombreSala}`);
    const consulta = query(refSala, orderByChild('timestamp'));
    const snapshot = await get(consulta);

    chatContainer.innerHTML = '';
    if (!snapshot.exists()) return;

    snapshot.forEach((child) => {
      renderizarMensajeGuardado(child.val());
    });
    scrollAbajo();
  } catch (error) {
    console.error('Error al cargar historial de la sala:', error);
  }
}

// Renderiza un mensaje ya guardado (viene de Firebase, no de socket.io en vivo).
function renderizarMensajeGuardado(data) {
  switch (data.tipo) {
    case 'texto': {
      const esPropio = data.usuario === miNombre;
      const div = crearBurbuja(data.usuario, esPropio, data.hora);
      const contenedor = document.createElement('span');
      contenedor.innerHTML = procesarEmojis(data.mensaje);
      div.appendChild(contenedor);
      agregarHora(div, data.hora);
      chatContainer.appendChild(div);
      break;
    }
    case 'imagen': {
      const esPropio = data.usuario === miNombre;
      const div = crearBurbuja(data.usuario, esPropio, data.hora);
      const img = document.createElement('img');
      img.src = data.imagen;
      img.classList.add('chat-img');
      img.alt = `Imagen de ${data.usuario}`;
      img.addEventListener('click', () => window.open(data.imagen, '_blank'));
      div.appendChild(img);
      agregarHora(div, data.hora);
      chatContainer.appendChild(div);
      break;
    }
    case 'audio': {
      const esPropio = data.usuario === miNombre;
      const div = crearBurbuja(data.usuario, esPropio, data.hora);
      const audio = document.createElement('audio');
      audio.src = data.audio;
      audio.controls = true;
      audio.classList.add('chat-audio');
      div.appendChild(audio);
      agregarHora(div, data.hora);
      chatContainer.appendChild(div);
      break;
    }
    case 'archivo': {
      const esPropio = data.usuario === miNombre;
      const div = crearBurbuja(data.usuario, esPropio, data.hora);
      const contenedor = document.createElement('div');
      contenedor.classList.add('chat-archivo');
      const enlace = document.createElement('a');
      enlace.href = data.datos;
      enlace.download = data.nombre;
      enlace.textContent = `📥 ${data.nombre}`;
      enlace.classList.add('archivo-link');
      enlace.title = `Tamaño: ${(data.tamaño / 1024).toFixed(2)} KB`;
      contenedor.appendChild(enlace);
      const tamaño = document.createElement('span');
      tamaño.classList.add('archivo-tamaño');
      tamaño.textContent = `(${(data.tamaño / 1024).toFixed(2)} KB)`;
      contenedor.appendChild(tamaño);
      div.appendChild(contenedor);
      agregarHora(div, data.hora);
      chatContainer.appendChild(div);
      break;
    }
  }
}

/* ─── ENVÍO DE TEXTO ──────────────────────────── */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = input.value.trim();
  if (texto) {
    socket.emit('mensaje-chat', texto);
    input.value = '';
    emojiPicker.classList.remove('visible');
  }
});
 
/* ─── ENVÍO DE IMAGEN ─────────────────────────── */
btnImage.addEventListener('click', () => imageInput.click());
 
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit('mensaje-imagen', reader.result); // base64 data URL
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

/* ─── ENVÍO DE ARCHIVOS ───────────────────────── */
btnFile.addEventListener('click', () => fileInput.click());
 
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit('mensaje-archivo', {
      nombre: file.name,
      tipo: file.type,
      tamaño: file.size,
      datos: reader.result // base64 data URL
    });
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});
 
/* ─── GRABACIÓN DE AUDIO ──────────────────────── */
btnRecord.addEventListener('click', async () => {
  if (!grabando) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
 
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
 
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('mensaje-audio', reader.result); // base64 data URL
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
 
      mediaRecorder.start();
      grabando = true;
      btnRecord.classList.add('grabando');
      btnRecord.title = 'Detener grabación';
      btnRecord.textContent = '⏹';
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Sin acceso al micrófono',
        text: 'Permite el acceso al micrófono para grabar audio.',
        confirmButtonText: 'Entendido'
      });
    }
  } else {
    mediaRecorder.stop();
    grabando = false;
    btnRecord.classList.remove('grabando');
    btnRecord.title = 'Grabar audio';
    btnRecord.textContent = '🎤';
  }
});
 
/* ─── HELPER: HORA ACTUAL ─────────────────────── */
function horaActual() {
  return new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}
 
/* ─── HELPER: CREAR BURBUJA ───────────────────── */
function crearBurbuja(usuario, esPropio, hora) {
  const div = document.createElement('div');
  div.classList.add('mensaje');
  if (esPropio) div.classList.add('propio');
 
  const autorSpan = document.createElement('span');
  autorSpan.classList.add('autor');
  autorSpan.textContent = usuario;
  div.appendChild(autorSpan);
 
  return div;
}
 
function agregarHora(div, hora) {
  const horaSpan = document.createElement('span');
  horaSpan.classList.add('hora');
  horaSpan.textContent = hora;
  div.appendChild(horaSpan);
}
 
function scrollAbajo() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
 
/* ─── RECIBIR MENSAJE DE TEXTO ────────────────── */
socket.on('mensaje-chat', (data) => {
  const esPropio = data.usuario === miNombre;
  const div = crearBurbuja(data.usuario, esPropio, data.hora);
 
  const contenedor = document.createElement('span');
  contenedor.textContent = data.mensaje;
  contenedor.innerHTML = procesarEmojis(data.mensaje);
  div.appendChild(contenedor);
  agregarHora(div, data.hora);
  chatContainer.appendChild(div);
  scrollAbajo();

  // Solo quien envió el mensaje lo guarda, para no duplicarlo en Firebase.
  if (esPropio) {
    guardarMensaje(salaActual, 'texto', { usuario: data.usuario, mensaje: data.mensaje, hora: data.hora });
  }
});
 
/* ─── RECIBIR IMAGEN ──────────────────────────── */
socket.on('mensaje-imagen', (data) => {
  const esPropio = data.usuario === miNombre;
  const div = crearBurbuja(data.usuario, esPropio, data.hora);
 
  const img = document.createElement('img');
  img.src = data.imagen;
  img.classList.add('chat-img');
  img.alt = `Imagen de ${data.usuario}`;
  img.addEventListener('click', () => window.open(data.imagen, '_blank'));
  div.appendChild(img);
 
  agregarHora(div, data.hora);
  chatContainer.appendChild(div);
  scrollAbajo();

  if (esPropio) {
    guardarMensaje(salaActual, 'imagen', { usuario: data.usuario, imagen: data.imagen, hora: data.hora });
  }
});
 
/* ─── RECIBIR AUDIO ───────────────────────────── */
socket.on('mensaje-audio', (data) => {
  const esPropio = data.usuario === miNombre;
  const div = crearBurbuja(data.usuario, esPropio, data.hora);
 
  const audio = document.createElement('audio');
  audio.src = data.audio;
  audio.controls = true;
  audio.classList.add('chat-audio');
  div.appendChild(audio);
 
  agregarHora(div, data.hora);
  chatContainer.appendChild(div);
  scrollAbajo();

  if (esPropio) {
    guardarMensaje(salaActual, 'audio', { usuario: data.usuario, audio: data.audio, hora: data.hora });
  }
});

/* ─── RECIBIR ARCHIVO ────────────────────────── */
socket.on('mensaje-archivo', (data) => {
  const esPropio = data.usuario === miNombre;
  const div = crearBurbuja(data.usuario, esPropio, data.hora);

  const contenedor = document.createElement('div');
  contenedor.classList.add('chat-archivo');

  const enlace = document.createElement('a');
  enlace.href = data.datos;
  enlace.download = data.nombre;
  enlace.textContent = `📥 ${data.nombre}`;
  enlace.classList.add('archivo-link');
  enlace.title = `Tamaño: ${(data.tamaño / 1024).toFixed(2)} KB`;
  contenedor.appendChild(enlace);

  const tamaño = document.createElement('span');
  tamaño.classList.add('archivo-tamaño');
  tamaño.textContent = `(${(data.tamaño / 1024).toFixed(2)} KB)`;
  contenedor.appendChild(tamaño);

  div.appendChild(contenedor);
  agregarHora(div, data.hora);
  chatContainer.appendChild(div);
  scrollAbajo();

  if (esPropio) {
    guardarMensaje(salaActual, 'archivo', {
      usuario: data.usuario,
      nombre: data.nombre,
      tipo: data.tipo,
      tamaño: data.tamaño,
      datos: data.datos,
      hora: data.hora
    });
  }
});
 
/* ─── MENSAJES DE SISTEMA ─────────────────────── */
socket.on('mensaje-sistema', (msg) => {
  const div = document.createElement('div');
  div.classList.add('mensaje', 'sistema');
  div.textContent = msg;
  chatContainer.appendChild(div);
  scrollAbajo();
});

/* ─── SOCKET EVENTS PARA SALAS ──────────────── */
socket.on('connect', () => {
  miSocketId = socket.id;
});

socket.on('actualizar-salas', (salas) => {
  salasDisponibles = salas;
  renderizarSalas();
});

socket.on('sala-actual', (nombreSala) => {
  salaActual = nombreSala;
  salasActualTitle.textContent = nombreSala;
  cargarHistorial(nombreSala); // trae y renderiza el historial guardado de la sala
  renderizarSalas();
});

socket.on('error-sala', (mensaje) => {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: mensaje,
    confirmButtonText: 'Entendido'
  });
});
