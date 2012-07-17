var app = require('express').createServer()
  , io = require('socket.io').listen(app);

var holdem  = {
	games: new Array(),
	players: new Array(),
	player_names: new Array(),
	games_counter: 0,
	min_players: 2,
	guests: 0,
	check_hands: []
};

app.listen(9090);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});
app.get('/cards.png', function (req, res) {
    res.sendfile(__dirname + '/cards.png');
});
app.get('/css/style.css', function (req, res) {
    res.sendfile(__dirname + '/css/style.css');
});
app.get('/js/client.js', function (req, res) {
    res.sendfile(__dirname + '/js/client.js');
});

io.sockets.on('connection', function (socket) {
	
	var id = holdem.guests++;
	var p = new Player(socket, "Guest" + id );
	p.inGame = false;

	holdem.players["" + id] = p;
	holdem.players["" + id].names = [];
	holdem.players[id].names.unshift({name: p.name, tick: new Date().getTime()});

	socket.emit('chat', {message: 'You are now known as ' + p.name});
	socket.set('id',id);


    socket.on('login', function (data) {
		socket.get('id', function(err,id){
			var elem = data.split(' ');
			var username = elem.shift();
			var password = elem.shift();

			console.log("user is attempting to login - username:" + username);
			if (holdem.players[id].loggedin ){
			} else {
				holdem.players[id].loggedin = true;
				holdem.players[id].name = username;
				// would probably set the users data here from a store.
			}
		});
	});

    socket.on('chat', function (data) {
		socket.get('id', function(err,id){
			// if player is in a game then only people in the game can see his message.
			if (holdem.players[id].inGame ){
				sendToGame(holdem.players[id].game, holdem.players[id].name + ': ' + data.message, id);
			} else {
				for (i in holdem.players){
					if (! holdem.players[i].inGame && id != i)
					{
						holdem.players[i].socket.emit('chat',  {message: holdem.players[id].name + ': ' + data.message});
					}
				}
			}
        	console.log(holdem.players[id].name + ': ' + data.message);
		});
    });

	socket.on('set nickname', function(name) {
		socket.get('id', function(err,id){
			name = name.split(' ')[0];
			
			holdem.players[id].names.unshift({name: name, tick: new Date().getTime() });
			var oldname = holdem.players[id].name;
			holdem.players[id].name = name;
			var changed = true;
			for (p in holdem.players){
				if (p != id && holdem.players[p].name == name){
					if (holdem.players[p].names[0].tick < holdem.players[id].names[0].tick){
						holdem.players[id].names.shift();
						holdem.players[id].name = holdem.players[id].names[0].name;
						changed = false;
					} else {
						holdem.players[p].names.shift();
						holdem.players[p].name = holdem.players[p].names[0].name;
					}
				}
			}
			for (var i=0; i<holdem.players[id].names.length; i++){
				console.log("Name: " + holdem.players[id].names[i].name + ", time:" + holdem.players[id].names[i].tick);
			}
			if (changed) {
				if (holdem.players[id].inGame){
					holdem.games[holdem.players[id].game].players[id].name = name;
				}
				socket.broadcast.emit('chat', {message: oldname + ' is now known as ' + name});
				socket.emit('chat', {message: 'You are now known as ' + name});
			}
		});

	});

	socket.on('list players', function() {
		var names = [];
		for (i in holdem.players) {
			names.push(holdem.players[i].name);
		}
		socket.emit('chat', {message: 'Players: ' + names.join(',')});
	});

	socket.on('private message', function(data) {
		console.log("private message code");
		socket.get('id', function(err,id){
			var elem = data.split(' ');
			var n = elem.shift();

			for (i in holdem.players) {
				if (holdem.players[i].name == n){
					holdem.players[i].socket.emit("chat", {message: "Private Message from " + holdem.players[id].name + ": " + elem.join(" ")});
				}
			}
			console.log("private message from id: " + id);
		});
	});

	socket.on('game', function(action) {
		socket.get('id', function(err,id){

			if (action.indexOf('new') == 0){
				var elem = action.split(' ');
				if (holdem.players[id].inGame)
				{
					socket.emit('chat', {message: 'You are already in a game.'});
				} else {
					// name, password
					var g = new Game(elem[1], elem[2]);
					g.id = holdem.games_counter++;
					g.max_players = 6;
					g.players["" + id] = {id: id};
					g.players[id].isPlayer = true;	
					g.players[id].name = holdem.players[id].name;	
					g.num_players = 1;
					g.num_spectators = 0;
					g.gameStarted = false;
					g.status = 'Waiting for players';

					holdem.players[id].inGame = true;
					holdem.players[id].game = g.id; 
					holdem.games["" + g.id] = g;
				}

			} else if (action.indexOf('list') == 0){
				var names = [];
				for (i in holdem.games) {
					names.push ("" + i + ":" + holdem.games[i].name) ;
				}
				socket.emit('chat', {message: 'Games: ' + names.join(',')});

			} else if (action.indexOf('my games') == 0){
				var names = [];
				for (g in holdem.games) {
					for (p in holdem.games[g].players){
						if (holdem.games[g].players[p].id == id){
							names.push(holdem.games[g].name);
						}
					}
				}
				socket.emit('chat', {message: 'Your Games: ' + names.join(',')});

			} else if (action.indexOf('leave') == 0){
				leaveGame(id);
			} else if (action.indexOf('cards') == 0){
				if (holdem.players[id].inGame){
					g = holdem.games[holdem.players[id].game];
					if (g.gameStarted)
					{
						socket.emit('game', {type: 'cards', cards: g.players[id].cards, board: g.board});
						socket.emit('chat', {message: 'Your Cards: ' + g.players[id].cards.join(",") });
						socket.emit('chat', {message: 'Board Cards: ' + g.board.join(",") });
						socket.emit('chat', {message: 'Hand Rank: ' + rank_cards(g.players[id].cards.concat(g.board)) });
					}
				}

			} else if (action.indexOf('status') == 0){
				if (holdem.players[id].inGame){
					g = holdem.games[holdem.players[id].game];
					socket.emit('game', g);
					socket.emit('chat', {message: 'Game Name: ' + g.name});
					socket.emit('chat', {message: 'Game Status: ' + g.status});
					if (g.gameStarted)
					{
						socket.emit('chat', {message: 'Game Pot: ' + g.pot});
						socket.emit('chat', {message: 'Player Turn: ' + g.players[g.player_turn].name});
						socket.emit('chat', {message: 'Current Bet: ' + g.required_bet});
						socket.emit('chat', {message: 'Your Bet: ' + g.players[id].bet});
						socket.emit('chat', {message: 'Your Money: ' + g.players[id].money});
						socket.emit('chat', {message: 'Your Status: ' + g.players[id].status});
						socket.emit('chat', {message: 'Your Cards: ' + g.players[id].cards.join(",") });
						socket.emit('chat', {message: 'Board Cards: ' + g.board.join(",") });
						socket.emit('chat', {message: 'Hand Rank: ' + rank_cards(g.players[id].cards.concat(g.board)) });
					}
				}

			} else if (action.indexOf('join') == 0){

				var elem = action.split(' ');
				var n = elem[1];
				var pword = elem[2]; /// optional password

				if (holdem.players[id].inGame)
				{
					socket.emit('chat', {message: 'You are already in a game.'});
				} else {
					if (holdem.games[n] != undefined){
							holdem.games[n].players["" + id] = {id: id};
							holdem.games[n].players[id].name = holdem.players[id].name;
							if (holdem.games[n].num_players < holdem.games[n].max_players ){
								holdem.games[n].players[id].isPlayer = true;	
								holdem.games[n].num_players++;
							} else {
								holdem.games[n].players[id].isPlayer = false;	
								holdem.games[n].num_spectators++;
							}
							holdem.players[id].inGame = true;
							holdem.players[id].game = n;
							sendToGame(n, holdem.players[id].name + " has joined the game.", id);
							if (holdem.games[n].players[id].isPlayer){
								socket.emit('chat', {message: 'You have joined the game, ' + holdem.games[n].name + ', as a player.' });
							} else {
								socket.emit('chat', {message: 'You have joined the game, ' + holdem.games[n].name + ', as a spectator.' });
							}
					}
				}
			} else if (action.indexOf('fold') == 0){
				if (myTurn(id) && holdem.games[holdem.players[id].game].action == "bet"){
					var game = holdem.games[holdem.players[id].game];
					game.players[id].status = 'fold';					
					game.active_players--;

					sendToGame(game.id, holdem.players[id].name + " has folded.", -1);
					change_player(game.id);
				}
			} else if (action.indexOf('hand') == 0){
				var elem = action.split(' ');
				holdem.check_hands.push(elem[1]);
				for (h in holdem.check_hands){
					socket.emit('chat', {message: '' + holdem.check_hands[h] + ':' + evalHand2(holdem.check_hands[h]).score });
				}

			} else if (action.indexOf('call') == 0){
				if (myTurn(id) && holdem.games[holdem.players[id].game].action == "bet"){
					var game = holdem.games[holdem.players[id].game];
					var elem = action.split(' ');
					
					bet = game.required_bet - game.players[id].bet;

					total_bet = bet + game.players[id].bet;

					if (total_bet == game.required_bet){
						if (bet > 0){
							game.players[id].money = game.players[id].money - bet;
						}
						game.players[id].status = 'call';
						game.players[id].bet = total_bet;
						sendToGame(game.id, holdem.players[id].name + " has called the bet. The current bet is " + game.required_bet + '.', -1);
						change_player(game.id);
					} else
					{
						if ( bet >= game.min_bet && total_bet > game.required_bet )
						{
							game.players[id].status = 'call';
							game.players[id].money = game.players[id].money - bet;
							game.players[id].bet = total_bet;
							game.required_bet = total_bet;
							sendToGame(game.id, holdem.players[id].name + " has raised the bet. The current bet is " + game.required_bet + '.', -1);
							change_player(game.id);
						} else {
									socket.emit('chat', {message: 'The minimum bet is ' + game.min_bet + '. and the required bet is ' + game.required_bet + ' and your bet was ' + bet + ' for a total of ' + total_bet +'. Sorry not enough.' });

						}
					}
				}
			} else if (action.indexOf('bet') == 0){
				if (myTurn(id) && holdem.games[holdem.players[id].game].action == "bet"){
					var game = holdem.games[holdem.players[id].game];
					var elem = action.split(' ');
					bet = parseInt(elem[1]);
					total_bet = bet + game.players[id].bet;

					if (total_bet == game.required_bet){
						if (bet > 0){
							game.players[id].money = game.players[id].money - bet;
						}
						game.players[id].status = 'call';
						game.players[id].bet = total_bet;
						sendToGame(game.id, holdem.players[id].name + " has called the bet. The current bet is " + game.required_bet + '.', -1);
						change_player(game.id);
					} else
					{
						if ( bet >= game.min_bet && total_bet > game.required_bet )
						{
							game.players[id].status = 'call';
							game.players[id].money = game.players[id].money - bet;
							game.players[id].bet = total_bet;
							game.required_bet = total_bet;
							sendToGame(game.id, holdem.players[id].name + " has raised the bet. The current bet is " + game.required_bet + '.', -1);
							change_player(game.id);
						} else {
									socket.emit('chat', {message: 'The minimum bet is ' + game.min_bet + '. and the required bet is ' + game.required_bet + ' and your bet was ' + bet + ' for a total of ' + total_bet +'. Sorry not enough.' });

						}
					}
				}

			} else if (action.indexOf('start') == 0){
				// should be at least 2 holdem.players first 3-5 holdem.players will be holdem.players, else will be spectators.
				if (holdem.players[id].inGame && ! holdem.games[holdem.players[id].game].gameStarted && holdem.games[holdem.players[id].game].num_players >= holdem.min_players){
					
					var g = holdem.players[id].game;

					setupGame(g);

					holdem.games[g].gameStarted	= true;
					sendToGame(g, holdem.players[id].name + " has started the game.", -1);
					sendToGame(g, "It is " + holdem.players[holdem.games[g].player_turn].name + "'s turn to " + holdem.games[g].action + ".", -1);

				} else {
					if (! holdem.players[id].inGame){
						socket.emit('chat', {message: 'Sorry, you are not in a game!'});
					} else if (holdem.games[holdem.players[id].game].gameStarted) {
						socket.emit('chat', {message: 'The game is already started.'});
					} else if (holdem.games[holdem.players[id].game].num_players < holdem.min_players) {
						socket.emit('chat', {message: 'Sorry, you need at least ' + holdem.min_players + ' players.'});
					}
				}
			}
		});

	});
	socket.on('disconnect', function() {
		socket.get('id', function(err,id){
			leaveGame(id);
			console.log(holdem.players[id].name + " disconnected.");
			delete holdem.players[id];
		});

	});

});

function change_player(g){
	console.log("inside change_player");

	game = holdem.games[g];

	// if the current player just folded,
	// then check to see if there are 2 players, because if there are,
	// then the other player won the round.

	if (game.active_players.length == 1){
		game.status = "end of round";	
		// end of round, the player still in gets the pot, if players still have money, then
		// start another round, else, end of game.
		pot = 0;
		winner = -1;
	 	for (p in game.players){
			if(game.players[p].isPlayer)
			{
				if (game.players[p].status != "fold"){
					winner = p;
				}
				pot = pot + game.players[p].bet;
			}
	 	}

		game.players[winner].money = game.players[winner].money + pot;
		sendToGame(g, "The round is over. " + game.players[winner].name + " won the pot. $" + pot, -1);
		next_dealer = game.players[game.dealer].next;
		while (next_dealer != game.dealer && game.players[next_dealer].money < 1){
			next_dealer = game.players[game.dealer].next;
		}
		if (next_dealer == game.dealer){
			game.status = "game over";
			game.action = "";
		} else {
			game.dealer = next_dealer;
			resetGame(game.id);
		}

	} else {
		// find the next player that has not called and has not folded.
		next_player = game.players[game.player_turn].next;

		// loop thru all players stop if we go all the way around
		while( next_player != game.player_turn ){
			if(game.players[next_player].status == "fold") {
				console.log(game.players[next_player].name + " is not the next player. folded");
				next_player = game.players[next_player].next;
		    } else {
		    	if (game.players[next_player].status == "call" && game.players[next_player].bet ==  game.required_bet) {
					console.log(game.players[next_player].name + " is not the next player. call");
					next_player = game.players[next_player].next;
				} else {
					break;
		   		}
		    }
		}

		if (next_player == game.player_turn){
			console.log("Could not find a player that has not called.");
			// everyboy has folded or called so it is time for the next phase of the round
			if (game.status == "pre-flop"){
				game.status = "the flop";
				game.board = [];
				game.burn = [];
				game.burn.push(game.cards.shift());
				game.board.push(game.cards.shift());
				game.board.push(game.cards.shift());
				game.board.push(game.cards.shift());

				// find the next player that has not called and has not folded.
				for(p in game.players){
					if(game.players[p].status != "fold"){
						game.players[p].status = "bet";
					}
				}
				next_player = game.players[game.dealer].next;
				while( game.players[next_player].status == "fold" ){
					next_player = game.players[next_player].next;
				}
				game.player_turn = next_player;

			} else if(game.status == "the flop"){
				game.status = "the turn";
				game.burn.push(game.cards.shift());
				game.board.push(game.cards.shift());

				// find the next player that has not called and has not folded.
				for(p in game.players){
					if(game.players[p].status != "fold"){
						game.players[p].status = "bet";
					}
				}
				next_player = game.players[game.dealer].next;
				while( game.players[next_player].status == "fold" ){
					next_player = game.players[next_player].next;
				}
				game.player_turn = next_player;
			} else if(game.status == "the turn"){
				game.status = "the river";
				game.burn.push(game.cards.shift());
				game.board.push(game.cards.shift());

				// find the next player that has not called and has not folded.
				for(p in game.players){
					if(game.players[p].status != "fold"){
						game.players[p].status = "bet";
					}
				}
				next_player = game.players[game.dealer].next;
				while( game.players[next_player].status == "fold" ){
					next_player = game.players[next_player].next;
				}
				game.player_turn = next_player;
			} else if(game.status == "the river"){
				game.status = "the showdown";
				best_score = 0;
				winners = [];
				pot = 0;

				for (p in game.players) {
					if (game.players[p].isPlayer){
						pot = pot + game.players[p].bet;
						if (game.players[p].status != "fold"){
							player_score = rank_cards(game.players[p].cards.concat(game.board));
							if (player_score == best_score) {
								winners.push(p);
							} else if (player_score > best_score){
								// new winner
								winners = [p];
								best_score = player_score;
							}
						}
					}
					
				}
				// figure out who has the best cards.
				if (winners.length > 1) {
					winner_names = ""; 
					add_comma = "";
					for (p in winners) {
						// house keeps fractions of a dollar.  suck it.
						game.players[winners[p]].money += Math.floor(pot / winners.length);
						winner_names = winner_names + add_comma + game.players[ winners[p] ].name;
						add_comma = ", ";

					}
					sendToGame(game.id, "End of round. " + winner_names + ' split the pot: ' + pot, -1);
				} else {
					game.players[winners[0]].money += pot;
					sendToGame(game.id, "End of round. " + game.players[winners[0]].name + ' won ' + pot, -1);
				}


				next_dealer = game.players[game.dealer].next;
				while (next_dealer != game.dealer && game.players[next_dealer].money < 1){
					next_dealer = game.players[game.dealer].next;
				}
				if (next_dealer == game.dealer){
					game.status = "game over";
					game.action = "";
				} else {
					game.dealer = next_dealer;
					resetGame(game.id);
				}
			}
		} else {
			game.player_turn = next_player;
			sendToGame(g, "The current bet is " + game.required_bet + ' It is now ' + holdem.players[game.player_turn].name + "'s turn.", -1);
		}


	}
}

function setupGame(id){
	if (holdem.games[id] != undefined) {
		game = holdem.games[id];
		game.player_order = [];
		game.min_bet = 1;
		game.pot = 0;
		game.active_players = 0;

		for (p in game.players){
			if (game.players[p].isPlayer){
				game.players[p].money = 100;
				game.player_order.push(p);
				game.active_players++;
				game.players[p].next = -1;
			}
		}

		while(game.players[game.player_order[0]].next == -1)
		{
			p = game.player_order.shift();
			game.players[p].next = game.player_order[0];
			game.players[game.player_order[0]].previous = p;
			game.player_order.push(p);
		}

		game.round = 0;
		game.action = "";

		game.dealer = game.player_order[0];
		game.players[game.dealer].isDealer = true;

		resetGame(game.id);
		game.action = "bet";
	}
}

function resetGame(id){

	// dealer is already set
	if (holdem.games[id] != undefined) {
		game = holdem.games[id];
		game.cards = [];
		suits = ['S','H','D','C'];
		ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
		// create the deck
		for (suit in suits) {
			for (rank in ranks){
				game.cards.push(ranks[rank] + suits[suit]);
			}
		}	
		// shuffle the cards
		game.cards.sort(function() {return 0.5 - Math.random()});
		for (p in game.players){
			if(game.players[p].isPlayer){
				game.players[p].bet = 0;
				game.players[p].status = "";
				game.players[p].cards = [];
				game.players[p].cards.push(game.cards.shift());
				game.players[p].cards.push(game.cards.shift());
			}
		}

		game.required_bet = 2;
		
		game.board = [];
		game.burn = [];
		game.status = "pre-flop";

		// player turn
		// 2 players dealer is small blind and has to call or fold or raise
		// 3 or more players the player after big blind has to call or fold or raise (in 3 player games this is the dealer)
		
		if (holdem.games[id].num_players < 3)
		{
			game.players[game.dealer].bet = 1;
			game.players[game.dealer].status = "small blind";
			game.players[game.dealer].money--;
			game.pot++;
			game.players[game.players[game.dealer].next].bet = 2;
			game.players[game.players[game.dealer].next].status = "big blind";
			game.players[game.players[game.dealer].next].money--;
			game.players[game.players[game.dealer].next].money--;
			game.pot++;
			game.pot++;
			
		} else
		{
			game.players[game.players[game.dealer].next].bet = 1;
			game.players[game.players[game.dealer].next].status = "small blind";
			game.players[game.players[game.dealer].next].money--;
			game.pot++;
			game.players[game.players[game.players[game.dealer].next].next].bet = 2;
			game.players[game.players[game.players[game.dealer].next].next].status = "big blind";
			game.players[game.players[game.players[game.dealer].next].next].money--;
			game.players[game.players[game.players[game.dealer].next].next].money--;
			game.pot++;
			game.pot++;
		}
		game.player_turn = game.players[ game.players[ game.dealer ].next ].next;
	}

}
function leaveGame(id){
	// if a player leaves the game after it starts, but before the game is over
	// then the player loses the money they have left, any money they have bet
	// is in the pot for the hand, but the money in their bank is just gone.
	// eventually if you can keep money outside of the game then you would lose any
	// money that you have bet in the game but keep money in ur bank
	if(holdem.players[id].inGame) {
		if (holdem.games[holdem.players[id].game] != undefined){
			var g = holdem.games[holdem.players[id].game];
			var player_idx = -1;
			if (g.players[id] != undefined){
				if (g.players[id].isPlayer){
					g.players[id].isPlayer = false;
					g.players[id].leftgame = true;
					if (g.gameStarted){
						g.active_players--;
						g.players[id].status = "fold";
						g.players[id].money = 0;
						if (g.playerTurn == id){
							change_player(g.id);
						}
					}
					g.num_players--;
				} else {
					g.num_spectators--;
				}

				delete g.players[id];
				if (g.num_players + g.num_spectators >0){
					sendToGame(g.id, holdem.players[id].name + " has left the game.", id);
				} else {
					// remove the game nobody in it.
					delete holdem.games[g.id];
				}
			}
		}
		holdem.players[id].inGame = false;
		holdem.players[id].game = -1;
	}
}

function comb(s,n){
    var combos = Array();
    if (n ==1){
        for (i in s){ 
            combos.push([s[i]]);
        }
    } else {
        for (var i=0; i<= (s.length - n); i++) {
            var r_combos = comb(s.slice(i+1), n-1);
            for (var c in r_combos) {
                combos.push([ r_combos[c].concat([s[i]])]);
            }
        }
    }
    
    return combos;
}

function rank_cards(cards){
	// generate combinations from the 7 cards
	var highest_rank = 0;
	if (cards.length >= 5) {
		var card_combos = comb(cards, 5);
		for (var i in card_combos) {
				temp = card_combos[i].join(',');
				highest_rank = Math.max(highest_rank, evalHand2(temp).score);
    	}
	}
	return highest_rank;
}

function myTurn(id){

	return (holdem.players[id].inGame && holdem.games[holdem.players[id].game].gameStarted && holdem.games[holdem.players[id].game].player_turn == id );

}

function sendToGame(id, message, player_id){
	for (i in holdem.players){
		if (holdem.players[i].inGame && holdem.players[i].game == id && i != player_id)
		{
			holdem.players[i].socket.emit('chat',  {message: message});
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


var evalHand2 = function(input){
    if (!input) return;

    input = input.replace(/\s+/g, '').replace(/[Jj]/g, '11').replace(/[Qq]/g, '12').replace(/[Kk]/g, '13').replace(/[Aa]/g, '14').toUpperCase().split(',');

	var f = false; // flush
	var s = false; // straight
	var k4 = false;
	var k3 = false;
	var p2 = false;
	var p1 = false;
	var fh = false;

    var hand = {D: [], H: [], C: [], S:[]};
	var cards_of_suit = {D: 0, H: 0, C: 0, S: 0};
	var cards = []; // array of ranks i.e. ['3','4','6','K']
	var kickers = []; 
	var high_cards = []; 
	var score = 0;

    for (var i = 0, len = input.length; i < len; i++)
    {
		if (input[i]){
        	hand[input[i].slice(input[i].length - 1)][input[i].slice(0, input[i].length - 1)] = 1; 
			cards_of_suit[input[i].slice(input[i].length - 1)]++;
			cards.push(input[i].slice(0, input[i].length - 1));
		}
    }
	high_cards = cards.sort();
	f = (cards_of_suit['D'] >= 5 || cards_of_suit['H'] >= 5 || cards_of_suit['S'] >= 5 || cards_of_suit['C'] >= 5);
	if (f){
		high_cards = [cards[ cards.length -1]];
		high_cards = high_cards.sort(function(a,b){return b-a});
	}
	high_cards = high_cards.sort(function(a,b){return b-a});

	cards = cards.sort(function(a,b){return a-b});
	for(var i=2; i<11; i++){
		 if(cards.join(',') ==  [i,i+1,i+2,i+3,i+4].join(',') )
		 {
		 	s = true;
			high_cards = [i+4];
		}

	}
	// straight special case
	if (cards.join(',') == [2,3,4,5,14].join(',')){
		s = true;
		high_cards = ['5'];
	}

	// check for four of a kind
	for (var i=2; i<15; i++){
		if (cards.slice(0,-1).join(',') == [i,i,i,i].join(','))
		{
			k4 = true;
			score = 7;
			high_cards = [i];
			kickers = cards.slice(-1);
		}
		if (cards.slice(1).join(',') == [i,i,i,i].join(','))
		{
			k4 = true;
			score = 7;
			high_cards = [i];
			kickers = [cards[0]];
		}
	}
	if (!k4 && !s && !f)
	{
		// check for three of a kind
		for (var i=2; i<15; i++){
			if (cards.slice(0,3).join(',') == [i,i,i].join(','))
			{
				k3 = true;
				score = 3;
				high_cards = [i];
				kickers = [cards[3], cards[4]];
			}
			if (cards.slice(1,4).join(',') == [i,i,i].join(','))
			{
				k3 = true;
				score = 3;
				high_cards = [i];
				kickers = [cards[0], cards[4]];
			}
			if (cards.slice(2,5).join(',') == [i,i,i].join(','))
			{
				k3 = true;
				score = 3;
				high_cards = [i];
				kickers = cards.slice(0,2);
			}
		}
		if (k3){
			// check for full house
			if (kickers[0] == kickers[1]){
				fh = true;
				score = 6;
				k3 = false;
				high_cards.push(kickers[0]);
				kickers = [];
			}
		}
	}
	if (!k4 && !s && !f && !fh && !k3)
	{
		// check for pair
		for (var i=0; i<4; i++){
			if (cards[i] == cards[i+1]){
				if (p1){
					p2 = true;
					score = 2;
					p1 = false;
					high_cards = [cards[i], high_cards[0]];
				} else {
					p1 = true;
					score = 1;
					high_cards = [cards[i]];
				}

			}
		}
		if (p1 || p2)
		{
			for (var i=0; i<5; i++)
			{
			   if (high_cards.indexOf(cards[i]) == -1)
			   {
			   	kickers.push(cards[i]);
			   }
			}
		}
		high_cards = high_cards.sort(function(a,b){return b-a});
	}

	console.log('cards:' + cards.join(','));
	console.log('flush:' + f);
	console.log('straight:' + s);
	console.log('four of a kind:' + k4);
	console.log('three of a kind:' + k3);
	console.log('full house:' + fh);
	console.log('two pair:' + p2);
	console.log('pair:' + p1);
	console.log('high cards:' + high_cards.join(','));
	console.log('kickers:' + kickers.join(','));

	//.sort(function(a,b){return b-a})

	if (s){
		score = 4;
	}
	if (f){
		score = 5;
	}
	if (s && f)
	{
		score = 8;
	}
	score = ("00" + score).substr(-2) + ".";
	for (i in high_cards)
	{
		score = score + ("00" + high_cards[i]).substr(-2);
	}
	kickers = kickers.sort(function(a,b){return b-a});
	for (i in kickers)
	{
		score = score + ("00" + kickers[i]).substr(-2);
	}
    return {
		score: score, 
		high_cards: high_cards, // sixes over threes
		kickers: kickers // no kickers in full house
    };
};


