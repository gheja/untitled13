// requires no special packages, just the base "npm install socket.io"

var app = require('http').createServer(handler),
	io = require('socket.io').listen(app),
	fs = require('fs');

function handler(request, response)
{
	S.log({}, "http request: " + request.url);
	
	var url = request.url, files = { "/": "index.html", "/13312.js": "13312.js" };
	
	if (url.indexOf("/?") == 0)
	{
		url = "/";
	}
	
	if (!files[url])
	{
		S.log({}, " 302 redirecting");
		response.writeHead(302, { "Location": "/" } );
		response.end();
		return;
	}
	
	fs.readFile(files[url], function(error, data) {
		if (!error)
		{
			S.log({}, "  200 found");
			response.writeHead(200);
			return response.end(data);
			
		}
		S.log({}, " 404 not found");
		response.writeHead(404);
		response.end("not found");
	});
}


var S = {};

S.games = [];

// DEBUG BEGIN
S.log = function(socket, s)
{
	console.log("[" + (new Date()).getTime() + "] [" + socket.id + "] " + s);
}
// DEBUG END

io.sockets.on("connection", function(socket) {
	S.log(socket, "connected");
	
	socket.ping_result = 0; // ms
	
	socket.emit2 = function(s, data)
	{
		S.log(socket, "sending: " + s + " " + data);
		try
		{
			socket.emit(s, data);
		}
		catch (e)
		{
			S.log(socket, "ERROR: could not send data!");
		}
	}
	
	socket.emit2_partner = function(s, data)
	{
		if (socket.partner_id != null)
		{
			var partner_socket = io.sockets.socket(socket.partner_id);
			
			// when a socket gets disconnected, io.sockets.socket() returns a default socket (with no added methods)
			partner_socket.emit2 && partner_socket.emit2(s, data);
		}
	}
	
	socket.on("disconnect", function() {
		S.log(socket, "disconnected");
		io.sockets.socket(socket.partner_id).partner_id = null;
		socket.emit2_partner("game_disconnected");
	});
	
	socket.on("game_create", function() {
		var game = {
			player1_uid: socket.id,
			player2_uid: null,
			players_swapped: Math.random() < 0.5,
			map: null
		};
		
		S.games.push(game);
		
		socket.emit2("game_created", game);
	});
	
	socket.on("game_join", function(data) {
		var i, partner_socket;
		
		for (i in S.games)
		{
			if (S.games[i].player1_uid == data)
			{
				if (S.games[i].player2_uid == null)
				{
					S.games[i].player2_uid = socket.id;
					S.log(socket, "connected to player " + S.games[i].player1_uid);
					
					partner_socket = io.sockets.socket(S.games[i].player1_uid);
					
					// bind them together
					socket.partner_id = S.games[i].player1_uid;
					socket.options = [ 1, 0, 0 ];
					partner_socket.partner_id = S.games[i].player2_uid;
					partner_socket.options = [ 1, 0, 0 ];
					
					socket.emit2("menu");
					socket.emit2_partner("menu");
					
					return;
				}
			}
		}
		
		socket.emit2("game_disconnected");
	});
	
	socket.on("message", function(data) {
		S.log(socket, "message: " + data);
		socket.emit2_partner("message", data);
	});
	
	socket.on("ping", function(data) {
		// socket.emit2_to_partner("heartbeat");
		
		socket.ping_start = (new Date()).getTime();
		socket.emit2("ping_request", socket.ping_start);
	});
	
	socket.on("ping_response", function(data) {
		var now = (new Date()).getTime();
		
		socket.ping_result = (now - socket.ping_start);
		
		// DEBUG BEGIN
		var a = Math.round(socket.ping_result / 2 + io.sockets.socket(socket.partner_id).ping_result / 2);
		S.log(socket, "latency: " + a);
		socket.emit2("debug_log", "server-client-server latencies: you: " + (socket.ping_result) + " ms, partner: " + (io.sockets.socket(socket.partner_id).ping_result) + " ms");
		socket.emit2("debug_log", "client1-server-client2 latency: about " + a + " ms");
		// DEBUG END
	});
	
	socket.on("options_update", function(data) {
		var i, partner_socket = io.sockets.socket(socket.partner_id);
		
		// do some checks before using the options
		if (data.length != 3)
		{
			return;
		}
		data = [ data[0] | 0, data[1] | 0, data[2] | 0 ];
		
		S.log(socket, "options_update: " + data);
		socket.emit2_partner("options_update", data);
		socket.options = data;
		
		// check if options match for players and they are ready to play
		if (socket.options[0] == partner_socket.options[0] && // new game
			socket.options[1] == partner_socket.options[1] && // switch sides
			socket.options[2] == partner_socket.options[2] && // ready to play
			socket.options[2] == 1
		)
		{
			for (i in S.games)
			{
				if (S.games[i].player1_uid == socket.id || S.games[i].player2_uid == socket.id)
				{
					if (data[1])
					{
						// S.games[i].player_swapped should be an integer
						S.games[i].player_swapped = (!S.games[i].player_swapped) | 0;
					}
					socket.emit2("game_started", [ S.games[i].player1_uid, S.games[i].player2_uid, S.games[i].player_swapped, null ]);
					socket.emit2_partner("game_started", [ S.games[i].player1_uid, S.games[i].player2_uid, S.games[i].player_swapped, null ]);
					
					return;
				}
			}
		}
	});
	
	// [ socket_id, version ]
	socket.emit2("welcome", [ socket.id, 1 ]);
});

// the public TCP port 80 is forwarded to this port

app.listen(8080);
