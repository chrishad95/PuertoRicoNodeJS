var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);


var puertorico  = {};

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});
app.get('/css/style.css', function (req, res) {
    res.sendfile(__dirname + '/css/style.css');
});
app.get('/js/client.js', function (req, res) {
    res.sendfile(__dirname + '/js/client.js');
});

function init() {
	puertorico.players = [];
	puertorico.games = [];
	puertorico.player_names = [];
	puertorico.games_counter = 0;
	puertorico.guests = 0;
	puertorico.accounts = [];

	puertorico.names = [];

	puertorico.plantation_types = [];
	puertorico.plantation_types.coffee = 8;
	puertorico.plantation_types.tobacco = 9;
	puertorico.plantation_types.corn = 10;
	puertorico.plantation_types.sugar = 11;
	puertorico.plantation_types.indigo = 12;
	
	puertorico.good_types = [];
	puertorico.good_types.coffee = 9;
	puertorico.good_types.tobacco = 9;
	puertorico.good_types.corn = 10;
	puertorico.good_types.sugar = 11;
	puertorico.good_types.indigo = 11;

	server.listen(9090);
	io.configure( function() {
		io.set("transports", ["websocket"]);
		io.set("log level", 2);
	});
	setEventHandlers();

};

var setEventHandlers = function() {
	io.sockets.on('connection', onSocketConnection);
};

function onSocketConnection(client) {
	console.log("Client connected: " + client.id);

	var p = new Player(client);
	p.inGame = false;

	p.name = "Guest" + puertorico.guests++;
	puertorico.players.push(p);

	client.join('lobby');
	client.on('chat', onChat);


	client.broadcast.to('lobby').emit('chat', {message: p.name + ' has entered the lobby.'});
	client.emit('chat', {message: 'Welcome to the lobby, you are now known as ' + p.name});

	client.on('list players', onListPlayers);

	client.on('new game', onNewGame);
	client.on('login', onLogin);
	client.on('disconnect', onClientDisconnect );
};

function playerById(id){
	var i;
	for (i=0; i<puertorico.players.length; i++){
		if (puertorico.players[i].socket.id == id){
			return puertorico.players[i];
		}
	}
}

function onLogin(data) {
	
	var success = false;
	var found = false;
	var alreadyLoggedIn = false;
	var user = userByUsername(data.username);

	if (user){
		if (user.isLoggedIn){
		} else {
			if (user.username == data.username and user.password == data.password) {
				success = true;
			}
		}
	} else{
		puertorico.accounts.push( {username: data.username, password: data.password, isLoggedIn: true});
		success = true;
		player.name = data.username;
	}



	var player = playerById(this.id);
	var i;
	// need to handle multiple logins with same creds
	// if a cred is logged in, then you should not be able to log 
	// in again with that cred until the first one is disconnected
	if (player && ! player.isLoggedIn){
		for (i=0; i<puertorico.accounts.length; i++){
			if (puertorico.accounts[i].username == data.username){
				found = true;
				if (puertorico.accounts[i].password == data.password){
					for (i=0; i<puertorico.players.length; i++){
						if (puertorico.players[i].name == data.username){
							console.log("This username is already logged in.  (" + data.username + ")");
							alreadyLoggedIn = true;
						}
					}
					if (! alreadyLoggedIn){
						success = true;
						player.name = data.username;
					}
				}
			}
		}
		if (! found){
			// username was not found, add username to the 'table'
			puertorico.accounts.push( {username: data.username, password: data.password});
			success = true;
			player.name = data.username;
		}
	
		player.isLoggedIn = success;
		// so now what should we do if this player is logged in.
		// we should probably check to see if he was in a game and got disconnected
		// and if so reconnect him.

	}
}

function onClientDisconnect() {

	var removePlayer = playerById(this.id);
	console.log(removePlayer.name + " has disconnected.");

	if (!removePlayer){
		return;
	}
	puertorico.players.splice(puertorico.players.indexOf(removePlayer), 1);
	this.broadcast.emit("remove player", {id: this.id});

	//	leaveGame(id);
	//	delete puertorico.players[id];
}

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

function changeRound(game_id){
	puertorico.games[game_id].action = "";
	
	puertorico.games[game_id].governor = puertorico.games[game_id].players[ puertorico.games[game_id].players[puertorico.games[game_id].player_turn].next].next;

	puertorico.games[game_id].player_turn = puertorico.games[game_id].governor;

	puertorico.games[game_id].action = "choose role";
	puertorico.games[game_id].round++;
	for (var i=0; i< puertorico.games[game_id].player_order.length; i++){
		console.log("Player Order: (" + i + ") " + puertorico.games[game_id].players[puertorico.games[game_id].player_order[i]].name);
	}
}

function myTurn(id){

	return (puertorico.players[id].inGame && puertorico.games[puertorico.players[id].game].gameStarted && puertorico.games[puertorico.players[id].game].player_turn == id );

}

function perform_mayor(id, args) {

	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform mayor"){
		var g = puertorico.players[id].game;
		var n = args[1];
		console.log(puertorico.games[g].players[id].name + " is going to " + puertorico.games[puertorico.players[id].game].action);

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// ok so if we switch to the next player and his role is this role then.. 
		// oops there can be more than one prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}

}
function perform_trader(id, args) {

	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform trader"){
		var g = puertorico.players[id].game;
		var n = args[1];
		console.log(puertorico.games[g].players[id].name + " is going to " + puertorico.games[puertorico.players[id].game].action);

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// ok so if we switch to the next player and his role is this role then.. 
		// oops there can be more than one prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}

}
function perform_settler(id, args) {

	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform settler"){
		var g = puertorico.players[id].game;
		var n = args[1];
		console.log(puertorico.games[g].players[id].name + " is going to " + puertorico.games[puertorico.players[id].game].action);

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// ok so if we switch to the next player and his role is this role then.. 
		// oops there can be more than one prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}

}

function perform_builder(id, args) {

	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform builder"){
		var g = puertorico.players[id].game;
		var n = args[1];
		console.log(puertorico.games[g].players[id].name + " is going to " + puertorico.games[puertorico.players[id].game].action);

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// ok so if we switch to the next player and his role is this role then.. 
		// oops there can be more than one prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}

}
function perform_craftsman(id, args) {

	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform craftsman"){
		var g = puertorico.players[id].game;
		var n = args[1];
		console.log(puertorico.games[g].players[id].name + " is going to " + puertorico.games[puertorico.players[id].game].action);

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// ok so if we switch to the next player and his role is this role then.. 
		// oops there can be more than one prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}

}

function perform_captain(id, args) {
	if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "perform captain"){
		var g = puertorico.players[id].game;
		for (var i=0; i< puertorico.games[g].player_order.length; i++){
			console.log("Player Order: (" + i + ") " + puertorico.players[puertorico.games[g].player_order[i]].name);
		}

		var n = args[1];

		console.log(puertorico.games[g].players[id].name + " is performing the role: captain");

		// ok we performed the action time to switch to the next player.  if this was the last player to perform the action,
		// then we need to switch to choose role and switch to the next player to choose a role
		// the rotating player business is kind of a pain to implement.
		// ok so if we switch to the next player and his role is captain (this role) then.. oops prospector
		if (puertorico.games[g].players[id].next == puertorico.games[g].role_turn) {
			// the next player is the one who chose this role, so we need to go back to choose role and pick the next player,
			// but if the next person to choose role is the governor then it is the end of the round.
			if (puertorico.games[g].players[puertorico.games[g].role_turn].next == puertorico.games[g].governor)
			{
				changeRound(g);
			} else {
				// next player is not the governor so the next player chooses a role.

				puertorico.games[g].action = "";
				puertorico.games[g].player_turn = puertorico.games[g].players[puertorico.games[g].role_turn].next;
				puertorico.games[g].action = "choose role";

			}
		} else {
			puertorico.games[g].player_turn = puertorico.games[g].players[id].next;
		}
	} else {
	}
}

function setupGame(id){
	if (puertorico.games[id] != undefined) {
		
		puertorico.games[id].player_order = [];
		for (p in puertorico.games[id].players){
			if (puertorico.games[id].players[p].isPlayer){
				puertorico.games[id].player_order.push(p);
			}
		}

		// shuffle player order
		puertorico.games[id].player_order.sort(function() {return 0.5 - Math.random()});

		// now the player order is set.  let us just make it easy on ourselves
		// and store the player order linked list style in the players info.
		for (var i=0; i< puertorico.games[id].player_order.length; i++){
			if (puertorico.games[id].player_order[i+1] != undefined){
				puertorico.games[id].players[ puertorico.games[id].player_order[i] ].next = puertorico.games[id].player_order[i+1]
			} else {
				puertorico.games[id].players[ puertorico.games[id].player_order[i] ].next = puertorico.games[id].player_order[0]
			}
			console.log("player_order index:" + i + " = " + puertorico.games[id].players[ puertorico.games[id].player_order[i] ].name);
			console.log("player_order  next:" + i + " = " + puertorico.games[id].players[ puertorico.games[id].players[ puertorico.games[id].player_order[i] ].next].name);

		}
		puertorico.games[id].round = 0;
		puertorico.games[id].action = "choose role";
		puertorico.games[id].player_turn = puertorico.games[id].player_order[0];
		puertorico.games[id].governor = puertorico.games[id].player_order[0];


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
		for (p in puertorico.games[id].players){
			if (puertorico.games[id].players[p].isPlayer){
				puertorico.games[id].players[p].plantation_spaces = 12;
				puertorico.games[id].players[p].plantations = [];
			}
		}
		puertorico.games[id].available_plantation_types = new Array();
		for (p_type in puertorico.plantation_types){
			puertorico.games[id].available_plantation_types[p_type] = puertorico.plantation_types[p_type];
		}

		if (puertorico.games[id].num_players == 3){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[1]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[2]].plantations.push({type: 'corn', occupied: 0}  );
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['corn']--;
		}

		if (puertorico.games[id].num_players == 4){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[1]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[2]].plantations.push({type: 'corn', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[3]].plantations.push({type: 'corn', occupied: 0}  );
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['corn']--;
			puertorico.games[id].available_plantation_types['corn']--;
		}
		if (puertorico.games[id].num_players > 4){
			puertorico.games[id].players[puertorico.games[id].player_order[0]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[1]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[2]].plantations.push({type: 'indigo', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[3]].plantations.push({type: 'corn', occupied: 0}  );
			puertorico.games[id].players[puertorico.games[id].player_order[4]].plantations.push({type: 'corn', occupied: 0}  );
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['indigo']--;
			puertorico.games[id].available_plantation_types['corn']--;
			puertorico.games[id].available_plantation_types['corn']--;
		}

		puertorico.games[id].plantations = [];

		for (p_type in puertorico.games[id].available_plantation_types){
			for (var i=0; i< puertorico.games[id].available_plantation_types[p_type]; i++){
				puertorico.games[id].plantations.push( p_type );	
			}
		}

		puertorico.games[id].plantations.sort(function() {return 0.5 - Math.random()});

		// plantation tiles showing
		// one more than number of players

		puertorico.games[id].plantations_flipped = [];
		for (var i=0; i<puertorico.games[id].num_players; i++){
			p = puertorico.games[id].plantations.shift();
			puertorico.games[id].plantations_flipped.unshift(p);
		}
		p = puertorico.games[id].plantations.shift();
		puertorico.games[id].plantations_flipped.unshift(p);

		// setup available roles
		// 3 players: captain, trader, settler, builder, craftsman, mayor
		// 4 players: same as 3 player, plus 1 prospector
		// 5 players: same as 3 player, plus 2 prospectors
		puertorico.games[id].available_roles = [];
		puertorico.games[id].available_roles.push({id: 0, name: 'captain', money: 0, taken: false});
		puertorico.games[id].available_roles.push({id: 1, name: 'craftsman', money: 0, taken: false});
		puertorico.games[id].available_roles.push({id: 2, name: 'trader', money: 0, taken: false});
		puertorico.games[id].available_roles.push({id: 3, name: 'builder', money: 0, taken: false});
		puertorico.games[id].available_roles.push({id: 4, name: 'settler', money: 0, taken: false});
		puertorico.games[id].available_roles.push({id: 5, name: 'mayor', money: 0, taken: false});
		if (puertorico.games[id].num_players > 3){
			puertorico.games[id].available_roles.push({id: 6, name: 'prospector', money: 0, taken: false});
		}
		if (puertorico.games[id].num_players > 4){
			puertorico.games[id].available_roles.push({id: 7, name: 'prospector', money: 0, taken: false});
		}

		// setup ships
		// 3 players: 4, 5, and 6 spaces
		// 4 players: 5, 6, 7
		// 5 players: 6, 7, 8
	
		puertorico.games[id].ships = [];
		puertorico.games[id].ships[0] = {size: puertorico.games[id].num_players + 1, type: "", hold: 0};
		puertorico.games[id].ships[1] = {size: puertorico.games[id].num_players + 2, type: "", hold: 0};
		puertorico.games[id].ships[2] = {size: puertorico.games[id].num_players + 3, type: "", hold: 0};

		// setup colonist ship
		// colonists = number of players (3,4,5)
		puertorico.games[id].colonist_ship = puertorico.games[id].num_players;

		// setup colonists
		// 3 players: 55 colonists
		// 4 players: 75 colonists
		// 5 players: 95 colonists
		if (puertorico.games[id].num_players == 3){
			puertorico.games[id].colonists_remaining = 55;
		}
		if (puertorico.games[id].num_players == 4){
			puertorico.games[id].colonists_remaining = 75;
		}
		if (puertorico.games[id].num_players == 5){
			puertorico.games[id].colonists_remaining = 95;
		}

		// 8 quarry tiles
		puertorico.games[id].quarries = 8;


		// victory points
		// 3 players: 75
		// 4 players: 100
		// 5 players: 122
		if (puertorico.games[id].num_players == 3){
			puertorico.games[id].vp_remaining = 75;
		}
		if (puertorico.games[id].num_players == 4){
			puertorico.games[id].vp_remaining = 100;
		}
		if (puertorico.games[id].num_players == 5){
			puertorico.games[id].vp_remaining = 122;
		}

		puertorico.games[id].status = "Setting up Game, player turn: " + puertorico.games[id].player_turn;
	}
}

function onNewGame(data){
	
	var player = playerById(this.id);
	if (player && player.isLoggedIn){
		console.log("creating new game: " + data.name + ", " + data.password);
		var newGame = new Game(data.name, data.password);
		newGame.addPlayer(player);
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
function User(username, password){
	this.username = username;
	this.password = password;
	this.socketid;
	this.isLoggedIn = true;

	this.games = [];
}

function Player(user){
	this.user = user;
}

function Game(name, password){

	this.name = name;
	this.password = password;
	this.players = [];
	this.spectators = [];
	this.id = puertorico.games_counter++;
	this.max_players = 5;
	this.num_players = 0;
	this.num_spectators = 0;
	this.gameStarted = false;
	this.status = 'Waiting for players';


	// need to store game data for this player 
	// if i store game data in the parent player object
	// then the player can only be in one game...
	// prolly not good.

	this.addPlayer = function (user){
		if (this.num_players >= this.max_players) {
			return;
		} else
		{
			var player = new Player(user);
			this.players.push(player);
			this.num_players++;
			player.game = this; 
			player.user.socket.leave("lobby");
			player.user.socket.join("game" + this.id);
			player.user.socket.broadcast.to("game" + this.id).emit('chat', {message: player.user.username + ' has joined the game.'});
			player.user.socket.emit('chat', {message: 'You are now in the game: ' + this.name });
		}
		return;
	};

	this.addSpectator = function(user){

		this.spectators.push(user);
		this.num_spectators++;
		player.game = this.id; 
		player.socket.join("" + this.id);
		player.socket.emit('chat', {message: 'You are a spectator in the game: ' + this.name });
		return;
	};

	puertorico.games.push(this);
}

function onChat(data){

	console.log("clientid:" + this.id);
	for (r in io.sockets.manager.roomClients[this.id]) {
		console.log("Room:" + r + ":" + this.id + ": " + io.sockets.manager.roomClients[this.id][r]);
	}
	// if player is in a game then only people in the game can see his message.
	var playerChat = playerById(this.id);
	if (playerChat) {
		console.log(playerChat.name + ': ' + data.message);
		if (playerChat.inGame){
			console.log(this.id + " is in a game: " + playerChat.game);
			this.broadcast.to("game" + playerChat.game).emit('chat', {message: playerChat.name + ": " + data.message});
		} else {
			this.broadcast.to("lobby").emit('chat', {message: playerChat.name + ": " + data.message});
		}
	}
}

function onSetNickname(data){
	var player = playerById(this.id);
	if (player) {
		// look to see if this name has already been used once,
		// i know that sucks, but i don't want to spend a lot of time
		// on this when it should really just be a login anyway
		var i;
		for (i=0; i<puertorico.names.length; i++){
			if (puertorico.names[i] == data.name){
				return;
			}
		}
		var oldname = "" + player.name;
		player.name = data.name;
		if (player.inGame){
			socket.broadcast.to(player.game).emit('chat', {message: oldname + ' is now known as ' + player.name});
		} else {
			socket.broadcast.to("lobby").emit('chat', {message: oldname + ' is now known as ' + player.name});
		}
		socket.emit('chat', {message: 'You are now known as ' + player.name});
	}
	
}

function onListPlayers() {
		var names = [];
		for (i in puertorico.players) {
			names.push(puertorico.players[i].name);
		}
		socket.emit('chat', {message: 'Players: ' + names.join(',')});
}

init();
