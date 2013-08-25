window.onload = function()
{
	A = {};
	
	TEXTURE_SIZE_32X32 = 0;
	TEXTURE_SIZE_64X32 = 1;
	A.texture_sizes = [ [ 32, 32 ], [ 64, 32 ] ];
	
	A.frame_number = 0;
	A.time_passed_since_last_tick = 0;
	A.last_tick_timestamp = 0;
	A.inputs = { modified: 0, mouse_position: [ 640, 360 ], mouse_click_position: [ 0, 0 ], mouse_button_statuses: [ 0, 0, 0 ] };
	A.inputs_prev = {};
	A.cursor_position_in_world = [ 10, 10 ]; /* tiles */
	A.scroll = [ 0, -40 ] /* pixels */
	A.map = {};
	A.layers = {};
	A.palette = { 0: "rgba(0,0,0,0.2)", 1: "rgba(0,0,0.4)", 2: "#4a3", 3: "#391", 4: "#682", 5: "#462", 6: "rgba(190, 60, 5, 0.7)", 7: "#821", 8: "#ddd", 9: "#dd0", "a": "#ee0", "b": "#bbb", "c": "#ccc", "d": "#ddd", "e": "#248", "f": "rgba(0,128,255,0.7)" };
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
		
		obj.position_prev = obj.position;
		obj.shadow_sprite_id = 6;
		obj.destroyed = 0;
		obj.class = 0;
		
		obj.on_click = function()
		{
		}
		
		obj.on_collision = function(obj2, id, distance)
		{
		}
		
		// object is just passing by the middle of the object
		obj.on_collision_middle = function(obj2, id, distance)
		{
		}
		
		obj.collision_check = function()
		{
			var i, distance, distance_prev, distance_next;
			for (i in A.objects)
			{
				if (A.objects[i] == this)
				{
					continue;
				}
				
				distance = Math.sqrt(Math.pow(this.position[0] - A.objects[i].position[0], 2) + Math.pow(this.position[1] - A.objects[i].position[1], 2));
				if (distance < 0.5)
				{
					this.on_collision(A.objects[i], i, distance);
					
					// TODO: BUG: the following needs to be rethought as it misses some pass-bys... sometimes...
					
					distance_prev = Math.sqrt(Math.pow(this.position[0] - A.objects[i].position_prev[0], 2) + Math.pow(this.position[1] - A.objects[i].position_prev[1], 2));
					distance_next = Math.sqrt(
						Math.pow(this.position[0] - (A.objects[i].position[0] + (A.objects[i].position[0] - A.objects[i].position_prev[0])), 2) + 
						Math.pow(this.position[1] - (A.objects[i].position[1] + (A.objects[i].position[1] - A.objects[i].position_prev[1])), 2)
					);
					
					if (distance_prev >  distance && distance_next > distance)
					{
						this.on_collision_middle(A.objects[i], i, distance);
					}
				}
			}
		}
		
		obj.on_tick = function()
		{
		}
		
		return obj;
	}
	
	A.ArrowObject = function(position, valid_directions, direction)
	{
		var obj = new A.BasicObject(1, position, 0, 0, []);
		
		obj.valid_directions = valid_directions;
		obj.direction = direction;
		obj.shadow_sprite_id = -1;
		
		
		obj.update = function()
		{
			this.sprites = [];
			
			if (valid_directions[0])
			{
				this.sprites.push([ this.direction == 0 ? "b0" : "a0", -32, -16 ]);
			}
			if (valid_directions[1])
			{
				this.sprites.push([ this.direction == 1 ? "b1" : "a1", -32, -16 ]);
			}
			if (valid_directions[2])
			{
				this.sprites.push([ this.direction == 2 ? "b2" : "a2", -32, -16 ]);
			}
			if (valid_directions[3])
			{
				this.sprites.push([ this.direction == 3 ? "b3" : "a3", -32, -16 ]);
			}
		}
		
		obj.on_collision_middle = function(obj2, i, distance)
		{
			obj2.position = [ Math.round(obj2.position[0]), Math.round(obj2.position[1]) ];
			obj2.position_prev = [ obj2.position[0], obj2.position[1] ];
			obj2.direction = this.direction;
		}
		
		obj.on_tick = function()
		{
			this.collision_check();
		}
		
		obj.on_click = function()
		{
			var first = 1;
			
			while (first || this.valid_directions[this.direction] == 0)
			{
				this.direction = (this.direction + 1) % 4;
				first = 0;
			}
			
			this.update();
		}
		
		obj.update();
		
		return obj;
	}
	
	A.Ghost1Object = function(position, direction)
	{
		var obj = new A.BasicObject(1, position, 0.75, direction, [ [ 5, -16, -32, 2, 2 ], [ 4, -16, -32, 2, 2 ], [ 3, -16, -32, 2, 2 ] ]);
		
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
		multiplier = multiplier ? multiplier : 1;
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
	
	A._place_roads_on_map = function(roads, arrows)
	{
		var i, a, b;
		
		for (i in roads)
		{
			for (a=roads[i][0]; a<=roads[i][2]; a++)
			{
				for (b=roads[i][1]; b<=roads[i][3]; b++)
				{
					A.map[a][b] = 2;
				}
			}
		}
		
		// this should be replaced with auto-placement by the previous road tiles
		for (i in arrows)
		{
			A.objects.push(new A.ArrowObject([ arrows[i][0], arrows[i][1] ], [ arrows[i][2] & 1, arrows[i][2] & 2, arrows[i][2] & 4, arrows[i][2] & 8 ], arrows[i][3]));
		}
	}
	
	A.texture_create = function(id, recipe, texture_size_id)
	{
		var i, j, k, r, g, b, args, s,
			w = A.texture_sizes[texture_size_id][0],
			h = A.texture_sizes[texture_size_id][1],
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
				
				case "a": // random [a]lpha overlay (min_alpha, max_alpha)
					var pixels = c.getImageData(0, 0, w, h);
					
					args = A._decode(recipe, i + 1, 2);
					for (k = 0; k < h; k++)
					{
						for (j = 0; j < w; j++)
						{
							var a = (k * w + j) * 4 + 3;
							if (pixels.data[a] > 0)
							{
								c.fillStyle = "rgba(0,0,0," + A._random_float(args[0], args[1]) + ")";
								c.fillRect(j, k, 1, 1);
							}
						}
					}
					i += 2;
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
		
		for (a=0; a<20; a++)
		{
			for (b=0; b<20; b++)
			{
				p = A._world_position_to_layer_position(a, b);
				A.texture_show(0, A.map[a][b], p[0] - 32, p[1] - 16);
			}
		}
		// A.texture_show(0, "r1", 0, 0);
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
		
		A._place_roads_on_map(
			[
				[ 0, 1, 12, 1 ],
				[ 12, 1, 12, 10 ],
				[ 13, 6, 18, 6 ],
				[ 0, 14, 6, 14 ],
				[ 6, 1, 6, 14 ],
				[ 6, 10, 12, 10 ]
			],
			[
				[ 6, 1, 14, 1 ],
				[ 12, 1, 12, 2 ],
				[ 12, 6, 7, 1 ],
				[ 6, 14, 9, 0 ],
				[ 6, 10, 7, 1 ],
				[ 12, 10, 9, 0 ]
			]
		);
		
		for (i=0; i<5; i++)
		{
			A.objects.push(new A.Ghost1Object([ -2 - i, 1 ], 1));
			A.objects.push(new A.Ghost1Object([ -2 - i, 14 ], 1));
		}
		
		A.map[7][7] = 7;
		A.map[7][8] = 7;
		A.map[7][9] = 7;
	}
	
	A.init_textures = function()
	{
		A.texture_create(0, "p23fAAff//f.aAF", TEXTURE_SIZE_64X32);
		A.texture_create(1, "p01fAAff//f.", TEXTURE_SIZE_64X32);
		A.texture_create(2, "p45fAAff//f.aAF", TEXTURE_SIZE_64X32);
		A.texture_create(3, "p67M2W5etkvq702wOhJPQIM.p87VUfdmR.", TEXTURE_SIZE_32X32);
		A.texture_create(4, "p678lvybeHZEsQ0gt.", TEXTURE_SIZE_32X32);
		A.texture_create(5, "p67MTcpwopV.", TEXTURE_SIZE_32X32);
		A.texture_create(6, "p00eZYcamgonlmc.", TEXTURE_SIZE_64X32);
		A.texture_create(7, "pb0fAAff//f.aDM", TEXTURE_SIZE_64X32);
		A.texture_create("a0", "p00gSsesS.", TEXTURE_SIZE_64X32);
		A.texture_create("a1", "p00gssssg.", TEXTURE_SIZE_64X32);
		A.texture_create("a2", "p00SgSses.", TEXTURE_SIZE_64X32);
		A.texture_create("a3", "p00SSSeeS.", TEXTURE_SIZE_64X32);
		A.texture_create("b0", "p9agSsesS.", TEXTURE_SIZE_64X32);
		A.texture_create("b1", "p9agssssg.", TEXTURE_SIZE_64X32);
		A.texture_create("b2", "p9aSgSses.", TEXTURE_SIZE_64X32);
		A.texture_create("b3", "p9aSSSeeS.", TEXTURE_SIZE_64X32);
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
			A.objects[i].on_tick();
		}
		for (i in A.objects)
		{
			A.objects[i].position_prev = [ A.objects[i].position[0], A.objects[i].position[1] ];
			
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
