// requires no special packages, just the base "npm install socket.io"

var app = require('http').createServer(handler),
	io = require('socket.io').listen(app);

function handler(request, response)
{
	console.log(request);
	response.writeHead(302, { "Location": "http://github.com/gheja/13312" } );
	response.end();
}


var S = {};

S.games = [];

S.log = function(socket, s)
{
	console.log((new Date()).getTime() + ": " + socket.id + ": " + s);
}

io.sockets.on("connection", function(socket) {
	S.log(socket, "connected");
	
	socket.emit("welcome", { uid: socket.id, version: 1 });
	
	socket.on("disconnect", function() {
		S.log(socket, "disconnected");
	});
	
	socket.on("game_create", function() {
	});
	
	socket.on("game_join", function(data) {
	});
	
	socket.on("message", function(data) {
	});
});

// the public TCP port 80 is forwarded to this port

app.listen(8080);
