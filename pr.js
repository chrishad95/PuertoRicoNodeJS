var app = require('express').createServer()
  , io = require('socket.io').listen(app);

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
    socket.emit('chat', { message: 'Server says, Hello World!' });
    socket.on('chat', function (data) {
		socket.broadcast.emit('chat', {message: data.message});
        console.log(data);
    });
});
