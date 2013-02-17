var prGame = {
	players: [],
	name:   "" 
}

var lines = [];

var KEY = {
	UP: 38,
	DOWN: 40,
	W:87,
	S:83,
	ENTER: 13,
	RIGHT: 39,
	SPACE: 32,
    LEFT: 37
}

var random_commands = false;

var socket;
var image_loaded = false;
var img = new Image();
var message_buffer = new Array();

$(function () {
	img.src = 'cards.png';
	img.onload = function(){
		image_loaded = true;
	}

	socket = io.connect('http://localhost:9090');
	socket.on('chat', function (data) {
		appendchat(data.message);
		});
	socket.on('game', function (data) {
		if(data.type == 'cards'){
			var cardvals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
			var cardsuits = ['C','D','H','S'];
			var positions = {};

			for (var i=0; i<cardsuits.length; i++){
				for (var j=0; j<cardvals.length; j++){
					positions[cardvals[j] + cardsuits[i]] = {x: ( j*79), y:(i*123)};	
				}
			}
			console.log(positions);
			// need to draw cards onto the canvas

			var canvas = document.getElementById("game");
			var ctx = canvas.getContext("2d");
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			if (image_loaded)
			{
				//context.drawImage(img,sx,sy,swidth,sheight,dx,dy,dwidth,dheight);
				//ctx.drawImage(img,0,0,79,123,0,0,79,123);

				var card_counter = 0;
				for (c in data.cards)
				{
					ctx.drawImage(img,positions[data.cards[c]].x,positions[data.cards[c]].y,79,123,card_counter * 79,0,79,123);
					console.log(data.cards[c] + ' x=' + positions[data.cards[c]].x + ' y=' + positions[data.cards[c]].y );
					card_counter++;
				}
				console.log("board:");
				card_counter = 0;
				for (c in data.board)
				{
					console.log(data.board[c] + ' x=' + positions[data.board[c]].x + ' y=' + positions[data.board[c]].y );
					ctx.drawImage(img,positions[data.board[c]].x,positions[data.board[c]].y,79,123,card_counter * 79,124,79,123);
					card_counter++;
				}
			}
		}else{
			console.log(data);
		}
		});

	
    $(document).keydown(function(e) {
	});

	$("#txt_input").keydown(function(e) {
		if (e.which == 13 ){

			var t = this.value;
			if (t.substr(0,5) == '/nick') {
				socket.emit('set nickname', t.substr(6));
			} else if (t.substr(0,5) == '/game') {
				socket.emit('game', t.substr(6));
			} else if (t.substr(0,6) == '/login') {
				socket.emit('login', t.substr(7));
			} else if (t.substr(0,4) == '/msg') {
				socket.emit('private message', t.substr(5) );
			} else if (t.substr(0,5) == '/list') {
				socket.emit('list players');
			} else if (t.substr(0,6) == '/clear') {
    			$("#chatwindow").val("");
			} else
			{
				socket.emit('chat', {message: this.value});
				appendchat(this.value);
			}
			this.value = '';
		}

	});

	$("#btnListGames").click (function() {socket.emit('game', 'list');});
	$("#btnStartGame").click (function() {socket.emit('game', 'start');});
	$("#btnLeaveGame").click (function() {socket.emit('game', 'leave');});
	$("#btnBetOne").click (function() {socket.emit('game', 'bet 1');});
	$("#btnBetPot").click (function() {socket.emit('game', 'bet pot');});
	$("#btnBetHalfPot").click (function() {socket.emit('game', 'bet halfpot');});
	$("#btnBetTwo").click (function() {socket.emit('game', 'bet 2');});
	$("#btnCheck").click (function() {socket.emit('game', 'bet 0');});
	$("#btnCall").click (function() {socket.emit('game', 'call');});
	$("#btnFold").click (function() {socket.emit('game', 'fold');});

	$(document).keyup(function (e) {
		if (e.which == 82){
			//random_commands = (! random_commands);
			//if(random_commands){
			//	appendchat("Random commands turned on.");
			//} else {
			//	appendchat("Random commands turned off.");
			//}

		}

	});
	setInterval(gameloop, 5000);
});

function gameloop(){
	if (random_commands){
		console.log("random commands = " + random_commands);
		commands = [];
		names = ['jimmy', 'bob', 'bill', 'randal', 'chris', 'dick', 'jack', 'george', 'carla', 'sue', 'betty', 'Taylor', 'Olivia'];
		game_names = ['fun', 'hell', 'football', 'baseball', 'soccer', 'ping pong', 'rugby', 'darts', 'polo', 'monopoly', 'checkers', 'chess', 'othello'];

		commands.push( {type: 'game', message: 'new ' + game_names[Math.floor((Math.random()* game_names.length ))]} );
		commands.push( {type: 'game', message: 'join 0'} );
		commands.push( {type: 'game', message: 'join ' +  Math.floor((Math.random()* commands.length ))} );
		commands.push( {type: 'set nickname', message: names[Math.floor((Math.random()* names.length ))]} );
		commands.push( {type: 'game', message: 'bet 1'} );
		commands.push( {type: 'game', message: 'bet 2'} );
		commands.push( {type: 'game', message: 'bet 0'} );
		commands.push( {type: 'game', message: 'list'} );
		commands.push( {type: 'game', message: 'leave'} );
		commands.push( {type: 'game', message: 'start'} );
		commands.push( {type: 'game', message: 'status'} );
		c = Math.floor((Math.random()* commands.length ));
		console.log(commands[c]);
		appendchat("command: /" + commands[c].type + " " + commands[c].message);
		socket.emit(commands[c].type, commands[c].message);
	}
}
function appendchat(s) {
	message_buffer.push(s);
	if (message_buffer.length > 20)
	{
		message_buffer = message_buffer.splice(-20);
	}
    $("#chatwindow").val('');
    $("#chatwindow").val(message_buffer.join(String.fromCharCode(13)  ));
}
