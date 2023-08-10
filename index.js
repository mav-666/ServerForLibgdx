const app = require('express')();
const server = require('http').createServer(app);   
const io = require('socket.io')(server);
const PORT = 8080;

const HIT_POINTS = 10;
const LEATHAL_HIT_POINTS = 30;

const GameStates = {
    wait: "WAITING",
    running: "RUNNING",
    closed: "CLOSED"
}

server.listen(PORT, () => {
    console.log("-=+server started+=-")
});

onlineGames = [];
playersInRooms = {};

tankConfig = {
    "cab": {
        "cabName": "Cab",
        "movementSpeed": 10,
        "agility": 4,
        "HP": 200
    },
    "head": {
        "headName": "Head",
        "rotationSpeed": 2
    },
    "barrel": {
        "barrelName": "Barrel", 
        "rechargeSeconds": 0.75,
        "projectile": {
            "projectileName": "Bullet",
            "radius": 0.1,
            "recoil": 0.2,
            "speed": 5,
            "contactDamage": 20 
        }
    }
}

io.on('connection', (socket) => {
    console.log("playerConnected");
});

io.of("\host").on("connection", (socket) => {
    console.log("host joined")

    socket.on("hostGame", (args, callBack) => {
        console.log("hosting " + args.gameName);
        onlineGameData = {id: socket.id, gameName:args.gameName, state: GameStates.wait};
        onlineGames.push(onlineGameData);
        io.of("\join").emit("newOnlineGame", onlineGameData);
        callBack();

    }).on("startGame", args => {
        console.log("game started " + socket.id);
        
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.state = GameStates.running;
        io.of("\join").emit("gameStarted", hostedGame);

        io.of("\inRoom").to(socket.id).emit("gameStarted");

    }).on("applyGameSettings", args => {
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.gameSettings = {
            width: args.width,
            height: args.height,
            bush: args.bush,
            gasoline: args.gasoline,
            box: args.box
        };

    }).on("disconnecting" , args => {
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.state = GameStates.closed;
        io.of("\join").emit("gameClosed", hostedGame);
        
        console.log("game closed with name: " + socket.id);
        onlineGames.splice(onlineGames.findIndex((val, i, arr) => val.id == socket.id), 1);

        io.of("\inRoom").to(Array.from(socket.rooms)[1]).emit("gameClosed");
    });
});

io.of("\join").on("connection", (socket) => {
    games = [];
    for(i = 0; i < onlineGames.length; i++) {
        if(onlineGames[i].state === GameStates.wait)
            games.push(onlineGames[i]);
    }
        
    socket.emit("getOnlineGames", games);
    
    socket.on("joinGame", (args, callBack) => {
        game = onlineGames.find((val, i, arr) => val.id == args.id);
        if(game && game.state == GameStates.wait){
            console.log("joined " + args.id);
            callBack({roomId: args.id, permitted:true});
        } else 
            callBack({permitted:false});
    });
});

io.of("\inRoom").on("connection", (socket) => {

    socket.on("joinRoom", args => {
        socket.join(args.roomId);
        socket.emit("logPlayer");

    }).on("playerLogged", args => {
        config = JSON.parse(JSON.stringify(tankConfig));
        if(args.disabled) config.barrel.barrelName = "DisabledBarrel";
        player = {id: socket.id, name: args.name, tankConfig: config};
        if(playersInRooms[Array.from(socket.rooms)[1]]) {
            playersInRooms[Array.from(socket.rooms)[1]].push(player);
            socket.broadcast.in(Array.from(socket.rooms)[1]).emit("playerJoined", player);
        } else {
            playersInRooms[Array.from(socket.rooms)[1]] = [player];
        }

        socket.emit("getPlayers", playersInRooms[Array.from(socket.rooms)[1]]);  

    }).on("ready", args => {
        console.log("afafa");
        socket.emit("getPlayers", playersInRooms[Array.from(socket.rooms)[1]]);  

    }).on("getGameSettings", (args, callBack) => {
        hostedGame = onlineGames.find((val, i, arr) => val.id == args.roomId);
        console.log(hostedGame.gameSettings);
        callBack(hostedGame.gameSettings);  

    }).on("disconnect" , args => {
        console.log("player disconnected with name: " + socket.id);
        
        inRoom = playersInRooms[Array.from(socket.rooms)[1]];
        if(!inRoom) return;
        for(i = 0; i < inRoom.length; i++) {
            if(inRoom[i].id == socket.id)
                inRoom.splice(i, 1);
        }

    }) .on("playerShot", () => {
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerShot", {id: socket.id});

    }).on("playerAimed", args => {
        args.id = socket.id
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerAimed", args);

    }).on("playerMoved", args => {
        args.id = socket.id;
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerMoved", args);

    }).on("hit", args => {
        console.log("gained 10 points");
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("gainsPoints", {id:socket.id, points: HIT_POINTS});
        socket.emit("gainsPoints", {id:"player", points: HIT_POINTS});

    }).on("lethalHit", args => {
        console.log("gained 30 points");
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("gainsPoints", {id:socket.id, points: LEATHAL_HIT_POINTS});
        socket.emit("gainsPoints", {id:"player", points: LEATHAL_HIT_POINTS});
    });
});
