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

var socket;

$(function () {
	socket = io.connect('http://rasputin.dnsalias.com:9090');
	socket.on('chat', function (data) {
		appendchat(data.message);
		});
	socket.on('game', function (data) {
		console.log(data);
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

	$(document).keyup(function (e) {
	});
	setInterval(gameloop, 30);
});

function gameloop(){
}

function appendchat(s) {
    var t = $("#chatwindow").val();
    t = t + String.fromCharCode(13) + s;
    $("#chatwindow").val(t);
}
