#!/usr/bin/env node

/**
 * Module dependencies.
 */

const app = require('../app');
const debug = require('debug')('webrtc-true:server');
const http = require('http');
// const fs = require("fs");
// const crypto = require('crypto');

/**
 * Add HTTPS Support
 */

// const privateKey = fs.readFileSync('public/ssl/privatekey.pem').toString();
// const certificate = fs.readFileSync('public/ssl/certificate.pem').toString();
// const credentials = crypto.createCredentials({key: privateKey, cert: certificate});

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);
const io = require('socket.io')(server);
let agents = new Map();
let customers = new Map();

// server.setSecure(credentials);



io.on('connection', (socket) => {

    debug('Connected to signalling server, Peer ID: %s', socket.id);
    socket.on('connect-client', (data) => {
        debug("Client Connected: " + data.id);
        socket.username = data.name;
        customers.set(socket.id, data.name);
        for (let key of agents.keys()) {
            io.to(key).emit('clientList', {queue: Array.from(customers)});
        }
    });

    socket.on('connect-agent', (data) => {
        debug(data);
        socket.username = data.name;
        agents.set(socket.id, data.name);
        io.to(socket.id).emit('clientList', {queue: Array.from(customers)});
    });

    socket.on('webrtc-room', (data) => {
        debug("Joining:", data);
        socket.join(data.room);
    });

    socket.on('client-join-request', (data) => {
        io.to(data.clientID).emit('joinRoom', {agentName: data.agentName, room: socket.id});
    });

    // P2P
    socket.on('signal', (data) => {
        socket.to(data.room).emit('signal', {signal: data.signal});
        debug("Signal Received", data)
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            if (socket.username.startsWith("Customer")) {
                customers.delete(socket.id);
                for (let key of agents.keys()) {
                    io.to(key).emit('clientQueue', {queue: Array.from(customers)});
                }
            } else if (socket.username.startsWith("Agent")) {
                agents.delete(socket.id);
                //TODO: Delete room after agent disconnects
            }
        }
    });


});

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}
