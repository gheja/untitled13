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
S.socket_partners = {};

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
		var game = {
			player1_uid: socket.id,
			player2_uid: null,
			players_swapped: Math.random() < 0.5,
			map: null
		};
		
		S.games.push(game);
		
		console.log(game);
		
		socket.emit("game_created");
	});
	
	socket.on("game_join", function(data) {
		var i;
		
		for (i in S.games)
		{
			if (S.games[i].player1_uid == data)
			{
				if (S.games[i].player2_uid == null)
				{
					S.games[i].player2_uid = socket.id;
					S.log(socket, "connected to player " + S.games[i].player1_uid);
					
					// bind them together
					socket.partner_id = S.games[i].player1_uid;
					io.sockets.socket(S.games[i].player1_uid).partner_id = S.games[i].player2_uid;
					
					socket.emit("game_started", S.games[i]);
					io.sockets.socket(socket.partner_id).emit("game_started", S.games[i]);
					
					return;
				}
			}
		}
		
		socket.emit("game_disconnected");
	});
	
	socket.on("message", function(data) {
		S.log(socket, "message: " + data);
		
		io.sockets.socket(socket.partner_id).emit("message", data);
	});
});

// the public TCP port 80 is forwarded to this port

app.listen(8080);