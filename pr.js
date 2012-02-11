var app = require('express').createServer()
  , io = require('socket.io').listen(app);

var puertorico  = {
	games: new Array(),
	players: new Array(),
	player_names: new Array(),
	games_counter: 0
};

var guests = 0;

app.listen(9090);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});
app.get('/css/style.css', function (req, res) {
    res.sendfile(__dirname + '/css/style.css');
});
app.get('/js/client.js', function (req, res) {
    res.sendfile(__dirname + '/js/client.js');
});

io.sockets.on('connection', function (socket) {
	
	var id = guests++;
	var p = new Player(socket, "Guest" + id );
	p.inGame = false;

	puertorico.players["" + id] = p;
	puertorico.players["" + id].names = [];
	puertorico.players[id].names.unshift({name: p.name, tick: new Date().getTime()});

	socket.emit('chat', {message: 'You are now known as ' + p.name});
	socket.set('id',id);


    socket.on('chat', function (data) {
		socket.get('id', function(err,id){
			// if player is in a game then only people in the game can see his message.
			if (puertorico.players[id].inGame ){
				sendToGame(puertorico.players[id].game, puertorico.players[id].name + ': ' + data.message, id);
			} else {
				for (i in puertorico.players){
					if (! puertorico.players[i].inGame && id != i)
					{
						puertorico.players[i].socket.emit('chat',  {message: puertorico.players[id].name + ': ' + data.message});
					}
				}
			}
        	console.log(puertorico.players[id].name + ': ' + data.message);
		});
    });

	socket.on('set nickname', function(name) {
		socket.get('id', function(err,id){
			puertorico.players[id].names.unshift({name: name, tick: new Date().getTime() });
			var oldname = puertorico.players[id].name;
			puertorico.players[id].name = name;
			var changed = true;
			for (p in puertorico.players){
				if (p != id && puertorico.players[p].name == name){
					if (puertorico.players[p].names[0].tick < puertorico.players[id].names[0].tick){
						puertorico.players[id].names.shift();
						puertorico.players[id].name = puertorico.players[id].names[0].name;
						changed = false;
					} else {
						puertorico.players[p].names.shift();
						puertorico.players[p].name = puertorico.players[p].names[0].name;
					}
				}
			}
			for (var i=0; i<puertorico.players[id].names.length; i++){
				console.log("Name: " + puertorico.players[id].names[i].name + ", time:" + puertorico.players[id].names[i].tick);
			}
			if (changed) {
				socket.broadcast.emit('chat', {message: oldname + ' is now known as ' + name});
				socket.emit('chat', {message: 'You are now known as ' + name});
			}
		});

	});

	socket.on('list players', function() {
		var names = [];
		for (i in puertorico.players) {
			names.push(puertorico.players[i].name);
		}
		socket.emit('chat', {message: 'Players: ' + names.join(',')});
	});

	socket.on('private message', function(data) {
		console.log("private message code");
		socket.get('id', function(err,id){
			var elem = data.split(' ');
			var n = elem.shift();

			for (i in puertorico.players) {
				if (puertorico.players[i].name == n){
					puertorico.players[i].socket.emit("chat", {message: "Private Message from " + puertorico.players[id].name + ": " + elem.join(" ")});
				}
			}
			console.log("private message from id: " + id);
		});
	});

	socket.on('game', function(action) {
		socket.get('id', function(err,id){

			if (action.indexOf('new') == 0){
				var elem = action.split(' ');
				var g = new Game(elem[1], elem[2]);
				g.id = puertorico.games_counter++;
				g.max_players = 2;
				g.players["" + id] = {id: id};
				g.num_players = 1;
				g.num_spectators = 0;
				g.gameStarted = false;
				g.status = 'Waiting for players';

				puertorico.players[id].inGame = true;
				puertorico.players[id].game = g.id; 
				puertorico.games["" + g.id] = g;

			} else if (action.indexOf('list') == 0){
				var names = [];
				for (i in puertorico.games) {
					names.push ("" + i + ":" + puertorico.games[i].name) ;
				}
				socket.emit('chat', {message: 'Games: ' + names.join(',')});

			} else if (action.indexOf('my games') == 0){
				var names = [];
				for (g in puertorico.games) {
					for (p in puertorico.games[g].players){
						if (puertorico.games[g].players[p].id == id){
							names.push(puertorico.games[g].name);
						}
					}
				}
				socket.emit('chat', {message: 'Your Games: ' + names.join(',')});

			} else if (action.indexOf('leave') == 0){
				leaveGame(id);
			} else if (action.indexOf('status') == 0){
				if (puertorico.players[id].inGame){
					if (puertorico.games[puertorico.players[id].game] != undefined){
						socket.emit('chat', {message: 'Game Status: ' + puertorico.games[puertorico.players[id].game].status });
					}
				}

			} else if (action.indexOf('join') == 0){

				var elem = action.split(' ');
				var n = elem[1];
				var pword = elem[2]; /// optional password

				if (puertorico.players[id].inGame)
				{
					socket.emit('chat', {message: 'You are already in a game.'});
				} else {
					if (puertorico.games[n] != undefined){
							puertorico.games[n].players["" + id] = {id: id};
							if (puertorico.games[n].num_players < puertorico.games[n].max_players ){
								puertorico.games[n].players[id].isPlayer = true;	
								puertorico.games[n].num_players++;
							} else {
								puertorico.games[n].players[id].isPlayer = false;	
								puertorico.games[n].num_spectators++;
							}
							puertorico.players[id].inGame = true;
							puertorico.players[id].game = n;
							sendToGame(n, puertorico.players[id].name + " has joined the game.", id);
							if (puertorico.games[n].players[id].isPlayer){
								socket.emit('chat', {message: 'You have joined the game, ' + puertorico.games[n].name + ', as a player.' });
							} else {
								socket.emit('chat', {message: 'You have joined the game, ' + puertorico.games[n].name + ', as a spectator.' });
							}
					}
				}
			} else if (action.indexOf('start') == 0){
				// should be at least 3 puertorico.players first 3-5 puertorico.players will be puertorico.players, else will be spectators.
				if (puertorico.players[id].inGame && ! puertorico.games[puertorico.players[id].game].gameStarted && puertorico.games[puertorico.players[id].game].num_players > 2){
					
					setupGame(puertorico.players[id].game);

					puertorico.games[puertorico.players[id].game].gameStarted	= true;
					sendToGame(puertorico.players[id].game, puertorico.players[id].name + " has started the game.", -1);
				} else {
					if (! puertorico.players[id].inGame){
						socket.emit('chat', {message: 'Sorry, you are not in a game!'});
					} else if (puertorico.games[puertorico.players[id].game].gameStarted) {
						socket.emit('chat', {message: 'The game is already started.'});
					} else if (puertorico.games[puertorico.players[id].game].num_players <3) {
						socket.emit('chat', {message: 'Sorry, you need at least 3 players.'});
					}
				}
			}
		});

	});
	socket.on('disconnect', function() {
		socket.get('id', function(err,id){
			leaveGame(id);
			console.log(puertorico.players[id].name + " disconnected.");
			delete puertorico.players[id];
		});

	});

});

function leaveGame(id){
	if(puertorico.players[id].inGame) {
		var g = puertorico.players[id].game;
		if (puertorico.games[g] != undefined){
			var player_idx = -1;
			if (puertorico.games[g].players[id] != undefined){
				if (puertorico.games[g].players[id].isPlayer){
					puertorico.games[g].num_players--;
				} else {
					puertorico.games[g].num_spectators--;
				}

				delete puertorico.games[g].players[id];
			}
		}
		puertorico.players[id].inGame = false;
		if (puertorico.games[g].num_players + puertorico.games[g].num_spectators >0){
			sendToGame(g, puertorico.players[id].name + " has left the game.", id);
		} else {
			// remove the game nobody in it.
			delete puertorico.games[g];
		}
		puertorico.players[id].game = -1;
	}
}

function setupGame(id){
	if (puertorico.games[id] != undefined) {
		puertorico.games[id].governor = Math.floor(puertorico.games[id].num_players * Math.random());
		puertorico.games[id].player_turn = puertorico.games[id].governor;
		puertorico.games[id].player_order = [];
		for (p in puertorico.games[id].players){
			if (puertorico.games[id].players[p].isPlayer){
				puertorico.games[id].player_order.push(p);
			}
		}

		// shuffle player order
		puertorico.games[id].player_order.sort(function() {return 0.5 - Math.random()});
		puertorico.games[id].round = 1;

		// setup money
		// 3 players 2 doubloons, 4 players 3 doubloons, 5 players 4 doubloons
		if (puertorico.games[id].num_players == 3){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].money = 2;
			puertorico.games[id].players[puertorico.games[id].player_order[1]].money = 2;
			puertorico.games[id].players[puertorico.games[id].player_order[2]].money = 2;
		}
		if (puertorico.games[id].num_players == 4){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].money = 3;
			puertorico.games[id].players[puertorico.games[id].player_order[1]].money = 3;
			puertorico.games[id].players[puertorico.games[id].player_order[2]].money = 3;
			puertorico.games[id].players[puertorico.games[id].player_order[3]].money = 3;
		}
		if (puertorico.games[id].num_players > 4){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].money = 4;
			puertorico.games[id].players[puertorico.games[id].player_order[1]].money = 4;
			puertorico.games[id].players[puertorico.games[id].player_order[2]].money = 4;
			puertorico.games[id].players[puertorico.games[id].player_order[3]].money = 4;
			puertorico.games[id].players[puertorico.games[id].player_order[4]].money = 4;
		}

		// initial plantations
		// 3 players, indigo, indigo, corn
		// 4 players: indigo, indigo, corn, corn
		// 5 players: indigo, indigo, indigo, corn, corn
		


		// setup available roles
		// 3 players: captain, trader, settler, builder, craftsman, mayor
		// 4 players: same as 3 player, plus 1 prospector
		// 5 players: same as 3 player, plus 2 prospectors
		puertorico.games[id].available_roles = [];
		puertorico.games[id].available_roles.push({name: 'captain', money: 0, taken: false});
		puertorico.games[id].available_roles.push({name: 'craftsman', money: 0, taken: false});
		puertorico.games[id].available_roles.push({name: 'trader', money: 0, taken: false});
		puertorico.games[id].available_roles.push({name: 'builder', money: 0, taken: false});
		puertorico.games[id].available_roles.push({name: 'settler', money: 0, taken: false});
		puertorico.games[id].available_roles.push({name: 'mayor', money: 0, taken: false});
		if (puertorico.games[id].num_players > 3){
			puertorico.games[id].available_roles.push({name: 'prospector', money: 0, taken: false});
		}
		if (puertorico.games[id].num_players > 4){
			puertorico.games[id].available_roles.push({name: 'prospector', money: 0, taken: false});
		}

		// setup ships
		// 3 players: 4, 5, and 6 spaces
		// 4 players: 5, 6, 7
		// 5 players: 6, 7, 8
	
		puertorico.games[id].ships = [];
		puertorico.games[id].ships[0] = {size: puertorico.games[id].num_players + 1};
		puertorico.games[id].ships[1] = {size: puertorico.games[id].num_players + 2};
		puertorico.games[id].ships[2] = {size: puertorico.games[id].num_players + 3};

		// setup colonist ship
		// colonists = number of players (3,4,5)

		// setup colonists
		// 3 players: 55 colonists
		// 4 players: 75 colonists
		// 5 players: 95 colonists

		// plantation tiles 
		// one more than number of players

		// 8 quarry tiles

		// victory points
		// 3 players: 75
		// 4 players: 100
		// 5 players: 122

		puertorico.games[id].status = "Setting up Game, player turn: " + puertorico.games[id].player_turn;
	}
}

function sendToGame(id, message, player_id){
	for (i in puertorico.players){
		if (puertorico.players[i].inGame && puertorico.players[i].game == id && i != player_id)
		{
			puertorico.players[i].socket.emit('chat',  {message: message});
		}
	}
}

function Player(socket, name){
	this.socket = socket;
	this.name = name;
}

function Game(name, password){
	this.name = name;
	this.password = password;
	this.players = [];
}
