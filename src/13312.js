window.onload = function()
{
	A = {};
	
	A.frame_number = 0;
	A.time_passed_since_last_tick = 0;
	A.last_tick_timestamp = 0;
	A.inputs = { modified: 0, mouse_position: [ 640, 360 ], mouse_click_position: [ 0, 0 ], mouse_button_statuses: [ 0, 0, 0 ] };
	A.inputs_prev = {};
	A.cursor_position_in_world = [ 10, 10 ]; /* tiles */
	A.scroll = [ 0, -40 ] /* pixels */
	A.map = {};
	A.layers = {};
	A.palette = { 0: "rgba(0,0,0,0.2)", 1: "rgba(0,0,0.4)", 2: "#4a3", 3: "#391", 4: "#682", 5: "#462", 6: "rgba(190, 60, 5, 0.7)", 7: "#821", 8: "#ddd", 9: "#dd0", "a": "#ee0" };
	A.textures = {};
	A.objects = [];
	
	A.BasicObject = function(owner_player, position, speed, direction, sprites)
	{
		var obj = {};
		
		obj.owner_player = owner_player;
		obj.position = position; /* tiles on map */
		obj.speed = speed; /* tiles per second */
		obj.direction = direction; /* 0: up, 1: right, 2: down, 3: left */
		obj.sprites = sprites; /* array of sprites and properties: [ [ sprite_id, screen_position_x, screen_positon_y ], ... ] */
		
		obj.shadow_sprite_id = 6;
		obj.destroyed = 0;
		obj.class = 0;
		
		obj.on_click = function()
		{
		}
		
		return obj;
	}
	
	A.ArrowObject = function(valid_directions, direction)
	{
		var obj = new A.BasicObject(0, [ 0, 0 ], 0, 0, []);
		
		obj.valid_directions = valid_directions;
		obj.direction = direction;
		obj.shadow_sprite_id = -1;
		
		if (valid_directions & 1)
		{
			obj.sprites.push([ "a1", -32, -16 ]);
		}
		if (valid_directions & 2)
		{
			obj.sprites.push([ "a2", -32, -16 ]);
		}
		if (valid_directions & 4)
		{
			obj.sprites.push([ "a3", -32, -16 ]);
		}
		if (valid_directions & 8)
		{
			obj.sprites.push([ "a4", -32, -16 ]);
		}
		
		obj.on_click = function()
		{
			alert('clicked!');
		}
		
		return obj;
	}
	
	A.Ghost1Object = function(position, speed, direction)
	{
		var obj = new A.BasicObject(1, position, speed, direction, [ [ 5, -16, -32, 2, 2 ], [ 4, -16, -32, 2, 2 ], [ 3, -16, -32, 2, 2 ] ]);
		
		// candy for the eye!
		for (j=0; j<3; j++)
		{
			obj.sprites[j][5] = A._random_float(0, 1);
			obj.sprites[j][6] = A._random_float(0, 1);
			obj.sprites[j][7] = A._random_float(1, 4);
			obj.sprites[j][8] = A._random_float(1, 4);
		}
		
		obj.on_click = function()
		{
			this.position = [ 10, 10 ];
		}
		
		return obj;
	}
	
	A._decode = function(s, start, length)
	{
		var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var args = [];
		for (var i=0; i<length; i++)
		{
			args[i] = chars.indexOf(s[i + start]) / (chars.length - 1);
		}
		return args;
	}
	
	A._world_position_to_layer_position = function(a, b)
	{
		return [ a * 32 - b * 32 + (1280 / 2), a * 16 + b * 16 + 32 ];
	}
	
	A._layer_position_to_world_position = function(x, y)
	{
		x -= (1280 / 2);
		y -= 32;
		return [ (y/16 + x/32) / 2, (-x/32 + y/16) / 2];
	}
	
	A._random_float = function(min, max)
	{
		return Math.random() * (max - min) + min;
	}
	
	A._random_int = function(min, max, multiplier)
	{
		return Math.round((Math.random() * (max - min) + min) * multiplier);
	}
	
	A._create_cv = function(w, h)
	{
		var obj = {};
		
		obj.cv = document.createElement("canvas");
		obj.cv.width = w ? w : 32;
		obj.cv.height = h ? h : 32;
		obj.ctx = obj.cv.getContext("2d");
		
		return obj;
	}
	
	A.texture_create = function(id, recipe, w, h)
	{
		w = w ? w : 32;
		h = h ? h : 32;
		
		var i, j, k, r, g, b, args, s
			cv = A._create_cv(w, h),
			c = cv.ctx;
		
		for (i=0; i<recipe.length; i++)
		{
			switch (recipe[i])
			{
				case "f": // [f]ill (color, start_x, start_y, end_x, end_y)
				break;
				
				case "F": // [F]ullfill (color)
					c.fillStyle = A.palette[recipe[++i]];
					c.fillRect(0, 0, w, h);
				break; 
				
				case "r": // [r]andom (start_x, start_y, end_x, end_y, min_r, min_g, min_b, max_r, max_g, max_b)
					args = A._decode(recipe, i + 1, 10);
					for (j = w * args[0]; j < w * args[2]; j++)
					{
						for (k = h * args[1]; k < h * args[3]; k++)
						{
							r = A._random_int(args[4], args[7], 255);
							g = A._random_int(args[5], args[8], 255);
							b = A._random_int(args[6], args[9], 255);
							c.fillStyle = "rgb(" + r + ", " + g + ", " + b + ")";
							c.fillRect(j, k, j+1, k+1);
						}
					}
					i += 7;
				break;
				
				case "p": // [p]olygon (color, pos_x, pos_y, [pos_x, pos_y], ".")
					c.fillStyle = A.palette[recipe[++i]];
					c.strokeStyle =  A.palette[recipe[++i]];
					
					c.beginPath();
					args = A._decode(recipe, i + 1, 2);
					c.moveTo(args[0] * w, args[1] * h);
					
					i += 2;
					
					s = "";
					i++;
					while (recipe[i] != ".")
					{
						s += recipe[i];
						i++;
					}
					args = A._decode(s, 0, s.length);
					for (j=0; j<args.length; j += 2)
					{
						c.lineTo(args[j] * w, args[j+1] * h);
					}
					c.closePath();
					c.fill();
					c.stroke();
				break;
			}
		}
		A.textures[id] = cv;
	}
	
	A.layer_clear = function(layer_id)
	{
		A.layers[layer_id].ctx.clearRect(0, 0, 1280, 720);
	}
	
	A.texture_show = function(layer_id, texture_id, x, y)
	{
		A.layers[layer_id].ctx.drawImage(A.textures[texture_id].cv, x, y);
	}
	
	A.render_canvas = function()
	{
		A.cv.ctx.fillStyle = "#111";
		A.cv.ctx.fillRect(0, 0, 1280, 720);
		A.cv.ctx.save();
		A.cv.ctx.translate(-A.scroll[0], -A.scroll[1]);
		for (var i=0; i<3; i++)
		{
			A.cv.ctx.drawImage(A.layers[i].cv, 0, 0);
		}
		A.cv.ctx.restore();
	}
	
	A.render_layer_map = function()
	{
		var a, b, p;
		
		for (b=0; b<20; b++)
		{
			for (a=0; a<20; a++)
			{
				p = A._world_position_to_layer_position(a, b);
				A.texture_show(0, A.map[b][a], p[0] - 32, p[1] - 16);
			}
		}
	}
	
	A.render_layer1 = function()
	{
		p = A._world_position_to_layer_position(Math.floor(A.cursor_position_in_world[0] - 0.5), Math.floor(A.cursor_position_in_world[1] + 0.5));
		A.layer_clear(1);
		A.texture_show(1, 1, p[0], p[1]);
	}
	
	A.render_layer2 = function()
	{
		var i, obj, sprite, p;
		
		// TODO: do proper depth ordering for sprites
		
		A.layer_clear(2);
		for (i in A.objects)
		{
			obj = A.objects[i];
			
			if (obj.destroyed)
			{
				continue;
			}
			
			p = A._world_position_to_layer_position(obj.position[0], obj.position[1]);
			
			// shadow
			if (obj.shadow_sprite_id != -1)
			{
				// TODO: this is for 64x32 sprites only
				A.texture_show(2, obj.shadow_sprite_id, p[0] - 32, p[1] - 16);
			}
			
			for (j in obj.sprites)
			{
				sprite = obj.sprites[j];
				
				// this is heavily eyecandy, that's why it's here and not in process_objects()
				sprite[5] += sprite[7] * A.time_passed_since_last_tick;
				sprite[6] += sprite[8] * A.time_passed_since_last_tick;
				rx = (Math.cos(sprite[5]) * sprite[3]) || 0;
				ry = (Math.sin(sprite[6]) * sprite[4]) || 0;
				
				A.texture_show(2, sprite[0], p[0] + sprite[1] + rx, p[1] + sprite[2] + ry);
			}
		}
	}
	
	A.handle_mousemove = function(event)
	{
		var a = A.cv.cv.getBoundingClientRect();
		A.inputs.modified = 1;
		A.inputs.mouse_position = [ event.clientX - a.left, event.clientY - a.top ];
	}
	
	A.handle_mousedown = function(event)
	{
		// handle left click only
		if (event.which != 1)
		{
			return;
		}
		A.handle_mousemove(event);
		A.inputs.mouse_click_position = A.inputs.mouse_position;
		A.inputs.mouse_button_statuses[0] |= 1; // press happened
	}
	
	A.handle_mouseup = function(event)
	{
		// handle left click only
		if (event.which != 1)
		{
			return;
		}
		A.inputs.mouse_button_statuses[0] |= 2; // release happened
	}
	
	A.init = function()
	{
		A.cv = A._create_cv(1280, 720);
		A.layers[0] = A._create_cv(1280, 720);
		A.layers[1] = A._create_cv(1280, 720);
		A.layers[2] = A._create_cv(1280, 720);
		A.cv.cv.addEventListener("mousemove", A.handle_mousemove);
		A.cv.cv.addEventListener("mousedown", A.handle_mousedown);
		A.cv.cv.addEventListener("mouseup", A.handle_mouseup);
		document.getElementById("canvas0").appendChild(A.cv.cv);
	}
	
	A.init_map = function()
	{
		var i, j, obj;
		
		for (j=0; j<32; j++)
		{
			A.map[j] = {};
			for (i=0; i<32; i++)
			{
				A.map[j][i] = 0;
			}
		}
		
		for (i=0; i<10; i++)
		{
			A.map[4 + i][4] = 2;
		}
		
		for (i=0; i<20; i++)
		{
			A.objects.push(new A.Ghost1Object([ A._random_int(2, 18, 1), A._random_int(2, 18, 1) ], 0.5, A._random_int(0, 3, 1)));
		}
		
		obj = new A.ArrowObject(15, 1);
		A.objects.push(obj);
	}
	
	A.init_textures = function()
	{
		A.texture_create(0, "p23fAAff//f.", 64, 32);
		A.texture_create(1, "p01fAAff//f.", 64, 32);
		A.texture_create(2, "p45fAAff//f.", 64, 32);
		A.texture_create(3, "p67M2W5etkvq702wOhJPQIM.p87VUfdmR.", 32, 32);
		A.texture_create(4, "p678lvybeHZEsQ0gt.", 32, 32);
		A.texture_create(5, "p67MTcpwopV.", 32, 32);
		A.texture_create(6, "p00eZYcamgonlmc.", 64, 32);
		A.texture_create("a1", "p00SSSeeS.", 64, 32);
		A.texture_create("a2", "p00SgSses.", 64, 32);
		A.texture_create("a3", "p00gssssg.", 64, 32);
		A.texture_create("a4", "p00gSsesS.", 64, 32);
		A.texture_create("b1", "p9aSSSeeS.", 64, 32);
		A.texture_create("b2", "p9aSgSses.", 64, 32);
		A.texture_create("b3", "p9agssssg.", 64, 32);
		A.texture_create("b4", "p9agSsesS.", 64, 32);
	}
	
	A.process_tick_begin = function()
	{
		var now = (new Date()).getTime();
		A.time_passed_since_last_tick = (now - A.last_tick_timestamp) / 1000;
		A.last_tick_timestamp = now;
	}
	
	A.process_input = function()
	{
		if (A.inputs.mouse_button_statuses[0] & 1)
		{
			// pressed
			A.scroll[0] -= A.inputs.mouse_position[0] - A.inputs_prev.mouse_position[0];
			A.scroll[1] -= A.inputs.mouse_position[1] - A.inputs_prev.mouse_position[1];
		}
		
		if (A.inputs.mouse_button_statuses[0] & 2)
		{
			// released
			A.inputs.mouse_button_statuses[0] = 0;
			
			// clicked (no move made)
			if (A.inputs.mouse_position[0] == A.inputs.mouse_click_position[0] && A.inputs.mouse_position[1] == A.inputs.mouse_click_position[1])
			{
				for (var i in A.objects)
				{
					if (Math.round(A.cursor_position_in_world[0]) == Math.round(A.objects[i].position[0]) && Math.round(A.cursor_position_in_world[1]) == Math.round(A.objects[i].position[1]))
					{
						A.objects[i].on_click();
					}
				}
			}
		}
		
		A.inputs_prev.mouse_position = A.inputs.mouse_position;
		
		A.cursor_position_in_world = A._layer_position_to_world_position(A.inputs.mouse_position[0] + A.scroll[0], A.inputs.mouse_position[1] + A.scroll[1]);
	}
	
	A.process_objects = function()
	{
		var i, moved;
		for (i in A.objects)
		{
			moved =  A.objects[i].speed * A.time_passed_since_last_tick;
			if (A.objects[i].direction == 0)
			{
				A.objects[i].position[1] -= moved;
			}
			else if (A.objects[i].direction == 1)
			{
				A.objects[i].position[0] += moved;
			}
			else if (A.objects[i].direction == 2)
			{
				A.objects[i].position[1] += moved;
			}
			else if (A.objects[i].direction == 3)
			{
				A.objects[i].position[0] -= moved;
			}
		}
	}
	
	A.tick = function()
	{
		A.frame_number++;
		A.process_tick_begin();
		A.process_input();
		A.process_objects();
		A.render_layer_map();
		A.render_layer1();
		A.render_layer2();
		A.render_canvas();
	}
	
	A.init_tick = function()
	{
		A.last_tick_timestamp = (new Date()).getTime();
		window.setInterval(A.tick, 1000 / 30);
	}
	
	A.start = function()
	{
		A.init();
		A.init_map();
		A.init_textures();
		A.init_tick();
	}
	
	A.start();
}
