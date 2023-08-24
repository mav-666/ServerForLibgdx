const app = require('express')();
const server = require('http').createServer(app);   
const io = require('socket.io')(server);
const PORT = 8080;

const HIT_POINTS = 10;
const LEATHAL_HIT_POINTS = 30;

const GameStates = {
    wait: "WAITING",
    run: "RUNNING",
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
        
        console.log("hosting " + args.gameName + " " + socket.id);
        onlineGameData = {id: socket.id, gameName:args.gameName, seed:args.seed, state: GameStates.wait};
        onlineGameData.gameSettings = {
            width: 15,
            height: 15,
            bush: 0,
            gasoline: 0,
            box: 0
        };
        onlineGames.push(onlineGameData);
        io.of("\join").emit("newOnlineGame", onlineGameData);
        callBack();

    }).on("startGame", args => {
        console.log("game started " + socket.id);
        
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.seed = Math.floor(Math.random() * 10000);
        hostedGame.state = GameStates.run;
        io.of("\join").emit("gameStarted", hostedGame);

        io.of("\inRoom").to(socket.id).emit("gameStarted");

    }).on("endGame", args => {
        playersInRooms[socket.id].forEach((player) => player.score = 0);

        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.state = GameStates.wait;

        io.of("\join").emit("gameEnded", hostedGame);

    }).on("settingChanged", args => {
        console.log(args);
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.gameSettings[args.name] = args.value;
        io.of("\inRoom").to(socket.id).emit("settingChanged", args);
        
    }).on("disconnecting" , args => {
        hostedGame = onlineGames.find((val, i, arr) => val.id == socket.id);
        hostedGame.state = GameStates.closed;
        io.of("\join").emit("gameClosed", hostedGame);
        
        console.log("game closed with name: " + socket.id);
        onlineGames.splice(onlineGames.findIndex((val, i, arr) => val.id == socket.id), 1);

        io.of("\inRoom").to(socket.id).emit("gameClosed");

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
        player = {id: socket.id, name: args.name, tankConfig: config, score: 0};

        if(playersInRooms[Array.from(socket.rooms)[1]]) {
            playersInRooms[Array.from(socket.rooms)[1]].push(player);
            socket.broadcast.in(Array.from(socket.rooms)[1]).emit("playerJoined", player);
        } else {
            playersInRooms[Array.from(socket.rooms)[1]] = [player];
        }

        socket.emit("getPlayers", playersInRooms[Array.from(socket.rooms)[1]]);  

    }).on("ready", args => {
        socket.emit("getPlayers", playersInRooms[Array.from(socket.rooms)[1]]);  

    }).on("getGameSettings", (args, callBack) => {
        hostedGame = onlineGames.find((val, i, arr) => val.id == args.roomId);
        console.log(hostedGame.gameSettings);
        callBack({gameSettings:hostedGame.gameSettings, seed:hostedGame.seed});  

    }).on("getScore", (args, callBack) => {
        inRoom = playersInRooms[Array.from(socket.rooms)[1]]
        callBack(inRoom);

    }).on("disconnecting", args => {
        socket.broadcast.in(Array.from(socket.rooms)[1]).emit("playerLeft", {id:socket.id});
        
        inRoom = playersInRooms[Array.from(socket.rooms)[1]];
        if(inRoom);
            inRoom.splice(inRoom.findIndex((val, i, arr) => val.id == socket.id), 1); 

    }).on("disconnect" , args => {
        console.log("player disconnected with name: " + socket.id);

    }) .on("playerShot", () => {
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerShot", {id: socket.id});

    }).on("playerAimed", args => {
        args.id = socket.id
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerAimed", args);

    }).on("playerMoved", args => {
        args.id = socket.id;
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("playerMoved", args);
    
    }).on("takeDamage", args => {
        console.log(socket.id + " took damage " + args.damage);
        args.id = socket.id;
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("takesDamage", args);

    }).on("hit", args => {
        console.log(socket.id + " gained " + HIT_POINTS + " points");
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("gainsPoints", {id:socket.id, points: HIT_POINTS});

        inRoom = playersInRooms[Array.from(socket.rooms)[1]];
        inRoom.find((val, i, arr) => val.id == socket.id).score += HIT_POINTS;
        socket.emit("gainsPoints", {id:"player", points: HIT_POINTS});

    }).on("lethalHit", args => {
        console.log(socket.id + " gained " + LEATHAL_HIT_POINTS + " points");
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit("gainsPoints", {id:socket.id, points: LEATHAL_HIT_POINTS});

        inRoom = playersInRooms[Array.from(socket.rooms)[1]];
        inRoom.find((val, i, arr) => val.id == socket.id).score += LEATHAL_HIT_POINTS;

        socket.emit("gainsPoints", {id:"player", points: LEATHAL_HIT_POINTS});
    });
});
