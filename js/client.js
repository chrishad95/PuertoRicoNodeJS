var prGame = {
	players: [],
	name:   "" 
}


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


    $(document).keydown(function(e) {
	});

	$("#txt_input").keydown(function(e) {
		if (e.which == 13 ){
			socket.emit('chat', {message: 'Client says, ' + this.value});
			appendchat(this.value);
			this.value = '';
		}

		console.log(e.which);
	});

	$(document).keyup(function (e) {
	});
        
});

function appendchat(s) {
    var t = $("#chatwindow").val();
    t = t + s;
    $("#chatwindow").val(t);
}
