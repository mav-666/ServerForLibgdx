const app = require('express')();
const server = require('http').createServer(app);   
const io = require('socket.io')(server);
const PORT = process.env.PORT;

server.listen(PORT, () => {
    console.log("-=+server started+=-")
});

players = [];

io.on('connection', (socket) => {
    console.log("player connected with name: " + socket.id);
    socket.emit("getPlayers", players);
    socket.broadcast.emit("playerJoined", {id: socket.id});
    players.push({id: socket.id});

    socket.on("disconnect" , args => {
        console.log("player disconnected with name: " + socket.id);
        for(i = 0; i < players.length; i++) {
            if(players[i].id == socket.id)
                players.splice(i, 1);
        }
    }).on("playerShot", () => {
        socket.broadcast.emit("playerShot", {id: socket.id});
    }).on("playerAimed", args => {
        args.id = socket.id
        socket.broadcast.emit("playerAimed", args);
    }).on("playerMoved", args => {
        args.id = socket.id;
        socket.broadcast.emit("playerMoved", args);
    });
});