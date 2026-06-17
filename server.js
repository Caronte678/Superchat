const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 5e7 // 10 MB
});
const path = require('path');   

//consuma datos de la carpeta public

app.use(express.static(path.join(__dirname, 'public')));

// Redirigir raíz al login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Salas predeterminadas y fijas: no se pueden crear ni eliminar más.
const NOMBRES_SALAS_FIJAS = ['General', 'Juegos', 'Lectura', 'Musica'];
const salas = new Map();
NOMBRES_SALAS_FIJAS.forEach(nombre => {
    salas.set(nombre, { creador: 'system', usuarios: new Set() });
});

io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado (ID: ${socket.id})`);

    //escuchar cuando el usuario defina su nombre
    socket.on('nuevoUsuario', (nombre) => {
        // Defensa adicional: si por alguna razón el cliente envía un nombre
        // vacío/undefined (ej. caché de navegador con código viejo), no
        // dejamos socket.username como undefined para evitar el bug
        // "undefined se ha unido a la sala" / mensajes sin nombre.
        socket.username = (nombre && nombre.trim()) ? nombre.trim() : `Usuario-${socket.id.slice(0, 5)}`;
        // Enviar lista de salas (fija)
        socket.emit('actualizar-salas', Array.from(salas.entries()).map(([nombre, data]) => ({
            nombre,
            creador: data.creador,
            usuarios: data.usuarios.size
        })));
        // Avisar a todos que se unió
        io.emit('mensaje-sistema', `${socket.username} se ha conectado`);
    });

    // ─── GESTIÓN DE SALAS ─────────────────────
    // Las salas son fijas (General, Juegos, Lectura, Musica): no se permite
    // crear ni eliminar salas nuevas.

    socket.on('unirse-sala', (nombreSala) => {
        if (salas.has(nombreSala)) {
            // Salir de todas las salas anteriores
            socket.rooms.forEach(room => {
                if (room !== socket.id) {
                    socket.leave(room);
                    const sala = salas.get(room);
                    if (sala) {
                        sala.usuarios.delete(socket.id);
                    }
                }
            });
            
            // Unirse a la nueva sala
            socket.join(nombreSala);
            salas.get(nombreSala).usuarios.add(socket.id);
            
            // Notificar cambio de usuario
            io.to(nombreSala).emit('mensaje-sistema', `${socket.username} se ha unido a la sala`);
            socket.emit('sala-actual', nombreSala);
            
            // Actualizar lista de salas
            io.emit('actualizar-salas', Array.from(salas.entries()).map(([nombre, data]) => ({
                nombre,
                creador: data.creador,
                usuarios: data.usuarios.size
            })));
            
            console.log(`${socket.username} se unió a "${nombreSala}"`);
        } else {
            socket.emit('error-sala', `La sala no existe`);
        }
    });

    // ─── MENSAJES DE CHAT ─────────────────────
    socket.on('mensaje-chat', (msg) => {
        // Obtener la sala actual del socket
        let salaActual = null;
        socket.rooms.forEach(room => {
            if (room !== socket.id) salaActual = room;
        });
        
        if (salaActual) {
            io.to(salaActual).emit('mensaje-chat', {
                usuario: socket.username,
                mensaje: msg,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    //escuchar imágenes y transmitirlas
    socket.on('mensaje-imagen', (imagenData) => {
        let salaActual = null;
        socket.rooms.forEach(room => {
            if (room !== socket.id) salaActual = room;
        });
        
        if (salaActual) {
            io.to(salaActual).emit('mensaje-imagen', {
                usuario: socket.username,
                imagen: imagenData,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    //escuchar audio y transmitirlo
    socket.on('mensaje-audio', (audioData) => {
        let salaActual = null;
        socket.rooms.forEach(room => {
            if (room !== socket.id) salaActual = room;
        });
        
        if (salaActual) {
            io.to(salaActual).emit('mensaje-audio', {
                usuario: socket.username,
                audio: audioData,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    //escuchar archivos y transmitirlos
    socket.on('mensaje-archivo', (archivoData) => {
        let salaActual = null;
        socket.rooms.forEach(room => {
            if (room !== socket.id) salaActual = room;
        });
        
        if (salaActual) {
            io.to(salaActual).emit('mensaje-archivo', {
                usuario: socket.username,
                nombre: archivoData.nombre,
                tipo: archivoData.tipo,
                tamaño: archivoData.tamaño,
                datos: archivoData.datos,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    //escuchar cuando un usuario se desconecta
    socket.on('disconnect', () => {
        if (socket.username) {
            // Remover de todas las salas
            socket.rooms.forEach(room => {
                const sala = salas.get(room);
                if (sala) {
                    sala.usuarios.delete(socket.id);
                }
            });
            
            io.emit('mensaje-sistema', `${socket.username} ha salido del chat`);
            
            // Actualizar lista de salas
            io.emit('actualizar-salas', Array.from(salas.entries()).map(([nombre, data]) => ({
                nombre,
                creador: data.creador,
                usuarios: data.usuarios.size
            })));
        }
    });

});
// levantar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor ejecutando en http://localhost:${PORT}`);
});
