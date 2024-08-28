const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database('chat.db');

// Criar a tabela de mensagens, se não existir
db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        message TEXT,
        image TEXT,
        audio TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Servir o arquivo index.html diretamente da raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let onlineUsers = 0;

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('user count', onlineUsers);

    // Enviar histórico de mensagens ao usuário que se conecta
    db.all('SELECT username, message, image, audio, timestamp FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            if (row.image) {
                socket.emit('chat image', row.image);
            } else if (row.audio) {
                socket.emit('chat audio', row.audio);
            } else {
                socket.emit('chat message', `${row.username}: ${row.message}`);
            }
        });
    });

    // Armazenar e emitir mensagens de texto
    socket.on('chat message', (msg) => {
        const username = 'Anônimo';
        db.run('INSERT INTO messages (username, message) VALUES (?, ?)', [username, msg], (err) => {
            if (err) {
                return console.log(err.message);
            }
            io.emit('chat message', `${username}: ${msg}`);
        });
    });

    // Armazenar e emitir mensagens de imagem
    socket.on('chat image', (imgData) => {
        db.run('INSERT INTO messages (image) VALUES (?)', [imgData], (err) => {
            if (err) {
                return console.log(err.message);
            }
            io.emit('chat image', imgData);
        });
    });

    // Armazenar e emitir mensagens de áudio
    socket.on('chat audio', (audioData) => {
        db.run('INSERT INTO messages (audio) VALUES (?)', [audioData], (err) => {
            if (err) {
                return console.log(err.message);
            }
            io.emit('chat audio', audioData);
        });
    });

    // Emitir e parar o indicador de digitação
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });

    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing');
    });

    socket.on('disconnect', () => {
        onlineUsers--;
        io.emit('user count', onlineUsers);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
