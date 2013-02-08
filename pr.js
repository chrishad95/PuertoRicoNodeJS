var app = require('express').createServer()
  , io = require('socket.io').listen(app);

var puertorico  = {
	games: new Array(),
	players: new Array(),
	player_names: new Array(),
	games_counter: 0,
	guests: 0
};

puertorico.plantation_types = new Array();
puertorico.plantation_types["coffee"] = 8;
puertorico.plantation_types["tobacco"] = 9;
puertorico.plantation_types["corn"] = 10;
puertorico.plantation_types["sugar"] = 11;
puertorico.plantation_types["indigo"] = 12;

puertorico.good_types = new Array();
puertorico.good_types["coffee"] = 9;
puertorico.good_types["tobacco"] = 9;
puertorico.good_types["corn"] = 10;
puertorico.good_types["sugar"] = 11;
puertorico.good_types["indigo"] = 11;


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
	
	var id = puertorico.guests++;
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
			name = name.split(' ')[0];
			
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
				if (puertorico.players[id].inGame){
					puertorico.games[puertorico.players[id].game].players[id].name = name;
				}
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
				g.max_players = 5;
				g.players["" + id] = {id: id};
				g.players[id].isPlayer = true;	
				g.players[id].name = puertorico.players[id].name;	
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
					socket.emit('game', puertorico.games[puertorico.players[id].game]);
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
							puertorico.games[n].players[id].name = puertorico.players[id].name;
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
			} else if (action.indexOf('perform_captain') == 0){

				perform_captain(id, action.split(' '));

			} else if (action.indexOf('perform_craftsman') == 0){
				console.log("can " + id + " perform craftsman?");

				perform_craftsman(id, action.split(' '));
				
			} else if (action.indexOf('perform_trader') == 0){

				perform_trader(id, action.split(' '));
				
			} else if (action.indexOf('perform_builder') == 0){

				perform_builder(id, action.split(' '));
				
			} else if (action.indexOf('perform_settler') == 0){

				perform_settler(id, action.split(' '));
				
			} else if (action.indexOf('perform_mayor') == 0){

				perform_mayor(id, action.split(' '));

			} else if (action.indexOf('choose_role') == 0){
				console.log("my turn?" + myTurn(id));
				if (myTurn(id) && puertorico.games[puertorico.players[id].game].action == "choose role"){
					var g = puertorico.players[id].game;
					for (var i=0; i< puertorico.games[g].player_order.length; i++){
						console.log("Player Order: (" + i + ") " + puertorico.players[puertorico.games[g].player_order[i]].name);
						console.log("Player Order: (" + i + ") " + puertorico.games[g].players[puertorico.games[g].player_order[i]].name);
					}

					var elem = action.split(' ');
					var n = elem[1];
					var role_is_available = false;
					
					for (r in puertorico.games[g].available_roles){
						if (puertorico.games[g].available_roles[r].id == n && ! puertorico.games[g].available_roles[r].taken ){
							puertorico.games[g].available_roles[r].taken = true;
							puertorico.games[g].players[id].role = puertorico.games[g].available_roles[r].name;
							puertorico.games[g].role_turn = id; // need to keep track of the player who chooses the role so we know when we are done performing the role

							sendToGame(puertorico.players[id].game, puertorico.players[id].name + " chose the role: " + puertorico.games[g].available_roles[r].name, id);
							socket.emit('chat', {message: 'You chose the role: ' + puertorico.games[g].available_roles[r].name + '.' });
							puertorico.games[g].players[id].money += puertorico.games[g].available_roles[r].money;
							puertorico.games[g].available_roles[r].money = 0;

							// if the role is not prospector, then every player will have a turn to perform the role
							// if the role IS prospector, the player takes the money and it is the next player's turn to choose role.
							if (puertorico.games[g].players[id].role == 'prospector'){
								// switch to the next player to choose role.
								if (puertorico.games[g].players[id].next == puertorico.games[g].governor)
								{
									changeRound(g);
								} else {
									// next player is not the governor so the next player chooses a role.
									puertorico.games[g].player_turn = puertorico.games[g].players[id].next;

								}


								console.log(puertorico.players[id].name + " chose the role prospector.  Now it is " + puertorico.games[g].player_turn + "'s turn to choose role.")

							} else {
								// now this player gets to perform this role
								puertorico.games[g].action = "perform " + puertorico.games[g].players[id].role;
								sendToGame(g, "It is " + puertorico.players[puertorico.games[g].player_turn].name + "'s turn to " + puertorico.games[g].action + ".", -1);
							}
						}
					}
				} else {
				}
			} else if (action.indexOf('start') == 0){
				// should be at least 3 puertorico.players first 3-5 puertorico.players will be puertorico.players, else will be spectators.
				if (puertorico.players[id].inGame && ! puertorico.games[puertorico.players[id].game].gameStarted && puertorico.games[puertorico.players[id].game].num_players > 2){
					
					var g = puertorico.players[id].game;

					setupGame(g);
					//changeRound(g);

					puertorico.games[g].gameStarted	= true;
					sendToGame(g, puertorico.players[id].name + " has started the game.", -1);
					sendToGame(g, "It is " + puertorico.players[puertorico.games[g].player_turn].name + "'s turn to " + puertorico.games[g].action + ".", -1);


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
