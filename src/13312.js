window.onload = function()
{
	A = {};
	
	A.config = {
		ticks_per_seconds: 30,
		target_frames_per_seconds: 30,
		world_width: 20,
		world_height: 20,
		bad_luck_mode: 0,
		game_duration: 30
	};
	
	/** @const */ A.BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	
	/** @const */ A.TEXTURE_SIZE_32X32 = 0;
	/** @const */ A.TEXTURE_SIZE_64X32 = 1;
	/** @const */ A.TEXTURE_SIZE_64X64 = 2;
	/** @const */ A.TEXTURE_SIZE_24X24 = 3;
	/** @const */ A.ATTACK_STATUS_NONE = -1;
	/** @const */ A.ATTACK_STATUS_RELOADING = 0;
	/** @const */ A.ATTACK_STATUS_CYCLING = 1;
	/** @const */ A.ATTACK_STATUS_READY = 2;
	A.texture_sizes = [ [ 32, 32 ], [ 64, 32 ], [ 64, 64 ], [ 24, 24 ] ];
	
	A.tick_number = 0;
	A.tick_interval = 1000 / A.config.ticks_per_seconds; /* milliseconds */
	A.seconds_passed_since_last_tick = A.tick_interval / 1000; /* fixed value, ticks will always catch up if called late */
	A.last_tick_timestamp = 0;
	
	A.frame_number = 0;
	A.frame_interval = 1000 / A.config.target_frames_per_seconds; /* milliseconds */
	A.seconds_passed_since_last_frame = 0;
	A.last_frame_timestamp = 0;
	
	A.game_time = 0;
	A.current_player = 1;
	A.shake = 0;
	A.selected_tool = 0;
	A.gui_buttons = []; /* array of GUI buttons: [ [ [ position_x, position_y ], texture, hotkey, function_to_call, [ function_arg1, function_arg2, ... ] ], ... ] */
	A.golds = []; /* golds of player 1 and player 2 */
	A.player1_queues = []; /* array of queues: [ [ [ position_x, position_y ], direction, ticks_until_pop, ticks_until_pop_total, [ obj1, obj2, ... ], is_started ], ... ] */
	A.player1_current_queue = 0;
	A.inputs = { modified: 0, mouse_position: [ 640, 360 ], mouse_on_canvas: 0, mouse_click_position: [ 0, 0, 0 ], mouse_button_statuses: [ 0, 0, 0 ] };
	A.inputs_prev = {};
	A.cursor_position_in_world = [ 10, 10 ]; /* tiles */
	A.scroll = [ 0, -40 ] /* pixels */
	A.map = {};
	A.palette = {
		0: "rgba(0,0,0,0.2)",
		1: "rgba(0,0,0,0.4)",
		2: "#4a3",
		3: "#391",
		4: "#682",
		5: "#462",
		6: "rgba(190,60,5,0.7)",
		7: "#821",
		8: "#ddd",
		9: "#dd0",
		"a": "#ee0",
		"b": "#bbb",
		"c": "#ccc",
		"d": "#ddd",
		"e": "#248",
		"f": "rgba(0,128,255,0.7)",
		"g": "#fff",
		"h": "rgba(0,255,0,0.8)",
		"i": "rgba(0,255,0,0.3)",
		"j": "rgba(160,0,0,0.4)",
		"k": "rgba(255,0,0,0.7)",
		"l": "#842",
		"m": "rgba(255,128,0,0.7)"
	};
	A.textures = {};
	A.objects = [];
	A.fog = []; /* hidden tiles from the current player */
	
	A.shots = []; /* array of real shots: [ [ [ pos_x, pos_y ], [ speed_x, speed_y ], [ speed_multiplier_x, speed_multiplier_y ], class, ticks_left, damage, radius, attacker_player ], ... ] */
	/* shot classes: 1: fire */
	
	/* just the effects */
	A.gfx_effect_shot = []; /* array of shots: [ [ [ start_x, start_y ], [ end_x, end_y ], width, seconds_left_to_display, seconds_total_display ], ... ] */
	A.gfx_effect_fire = []; /* array of fire particles: [ [ [ pos_x, pos_y ], [ speed_x, speed_y ], seconds_left_to_display, seconds_total_display ], ... ] */
	
	A.hexagon_neighbours = [ // we will not calculate them every time
		[ [0,  0] ],
		[ [-1,-1], [ 0,-1], [-1, 0], [+1, 0], [ 0,+1], [+1,+1] ],
		[ [-2,-2], [-1,-2], [ 0,-2], [-2,-1], [+1,-1], [-2, 0], [+2, 0], [-1,+1], [+2,+1], [ 0,+2], [+1,+2], [+2,+2] ],
		[ [-3,-3], [-2,-3], [-1,-3], [ 0,-3], [-3,-2], [+1,-2], [-3,-1], [+2,-1], [-3, 0], [+3,0], [-2,+1], [+3,+1], [-1,+2], [+3,+2], [ 0,+3], [+1,+3], [+2,+3], [+3,+3] ]
	];
	
	/** @constructor */
	A.ObjectBase = function(owner_player, position, speed, direction, health, sprites)
	{
		var obj = {};
		
		obj.owner_player = owner_player;
		obj.position = position; /* tiles on map */
		obj.speed = speed; /* tiles per second */
		obj.direction = direction; /* 0: up, 1: right, 2: down, 3: left */
		obj.sprites = sprites; /* array of sprites and properties: [ [ sprite_id, screen_position_x, screen_positon_y ], ... ] */
		obj.health = [ health, health ]; /* current, maximal */
		obj.uid = A._generate_uid();
		
		obj.position_on_layer = A._world_position_to_layer_position(position);
		obj.gui_show_bars_until_tick = 0;
		obj.position_prev = obj.position;
		obj.shadow_sprite_id = 6;
		obj.selection_sprite_id = 11;
		obj.destroyed = 0;
		obj.permanent = (health == -1); /* this object cannot be hurt or destroyed */
		obj.hidden_from_other_player = 0;
		obj.detection_distance = 3;
		obj.selected = 0;
		
		obj.explode = function()
		{
			if (this.permanent)
			{
				return;
			}
			
			this.destroyed = 1;
			A.hit_nearby_objects(this.position, 50, 3, this.owner_player);
			this.speed = [ 0, 0 ];
			this.position = [ -10, -10 ];
			A.shake += 10;
		}
		
		obj.gui_show_bars = function()
		{
			// 3 seconds
			this.gui_show_bars_until_tick = A.tick_number + 3 / A.seconds_passed_since_last_tick;
		}
		
		obj.on_hit = function(damage, attacker_player)
		{
			// no friendly fire, except on bad luck ;)
			if (attacker_player == this.owner_player && !A.config.bad_luck_mode)
			{
				return;
			}
			
			if (this.health == -1 || this.destroyed)
			{
				return;
			}
			
			this.gui_show_bars();
			this.health[0] -= damage;
			if (this.health[0] <= 0)
			{
				this.health[0] = 0;
				
				// make sure the object is really exploded on both side
				B.send("object_destroy", [ this.uid, 1 ]);
			}
		}
		
		obj.on_owner_click = function()
		{
			if (A.selected_tool == 1)
			{
				this.selected = !this.selected;
			}
			else if (A.selected_tool == 2)
			{
				// make sure the object is really exploded on both side
				B.send("object_destroy", [ this.uid, 1 ]);
			}
		}
		
		obj.on_enemy_click = function()
		{
		}
		
		obj.on_click = function()
		{
			if (A.current_player == this.owner_player)
			{
				this.on_owner_click();
			}
			else
			{
				this.on_enemy_click();
			}
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
				
				distance = A._distance(this.position, A.objects[i].position);
				if (distance < 0.5)
				{
					this.on_collision(A.objects[i], i, distance);
					
					// TODO: BUG: the following needs to be rethought as it misses some pass-bys... sometimes...
					
					distance_prev = A._distance(this.position, A.objects[i].position_prev);
					distance_next = A._distance(this.position, A._2d_add(A.objects[i].position, A._2d_subtract(A.objects[i].position, A.objects[i].position_prev)));
					
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
	
	/** @constructor */
	A.ObjectPlayer1Base = function(position, speed, direction, health, sprites)
	{
		var obj = new A.ObjectBase(1, position, speed, direction, health, sprites);
		return obj;
	}
	
	/** @constructor */
	A.ObjectPlayer2Base = function(position, health, ammo, shoot_cycle_time, reload_time, sprites)
	{
		var obj = new A.ObjectBase(2, position, 0, 0, health, sprites);
		obj.shadow_sprite_id = -1;
		
		obj.attack_status = ammo > 0 ? A.ATTACK_STATUS_RELOADING : A.ATTACK_STATUS_NONE;
		obj.attack_ammo = [ 0, ammo ];
		obj.attack_cycle_time = [ 0, shoot_cycle_time ]; /* seconds */
		obj.attack_reload_time = [ 0, reload_time ]; /* seconds */
		obj.attack_distance = 3;
		obj.attack_damage = 20;
		obj.attack_impact_radius = 0.1;
		obj.attack_target_object_id = -1;
		obj.attack_target_selection_method = 0; /* select the 0: nearest, 1: farthest, 2: weakest, 3: strongest */
		obj.attack_target_selection_lock = 1; /* 0: always rerun the selection method, 1: lock on selected target */
		
		obj.attack = function()
		{
		}
		
		obj.on_ready_to_attack = function()
		{
			var targets;
			
			// if we have a target, check it
			if (this.attack_target_object_id != -1)
			{
				// check if we use target locking, the target is still alive and it is in range
				if (this.attack_target_selection_lock == 0 ||
					A.objects[this.attack_target_object_id].destroyed ||
					A._distance(A.objects[this.attack_target_object_id].position, this.position) > this.attack_distance)
				{
					this.attack_target_object_id = -1;
				}
			}
			
			// try to find a target if we do not have one
			if (this.attack_target_object_id == -1)
			{
				targets = A.find_targets(this.position, this.attack_distance, 1, 1);
				this.attack_target_object_id = targets[this.attack_target_selection_method];
			}
			
			// skip the attack if we have no targets
			if (this.attack_target_object_id == -1)
			{
				return;
			}
			
			this.attack();
			
			// generic part of the attack
			this.attack_cycle_time[0] = 0;
			this.attack_ammo[0]--;
			
			if (this.attack_ammo[0] == 0)
			{
				this.attack_reload_time[0] = 0;
				this.attack_status = A.ATTACK_STATUS_RELOADING;
			}
			else
			{
				this.attack_status = A.ATTACK_STATUS_CYCLING;
			}
		}
		
		obj.on_tick = function()
		{
			if (this.attack_status == A.ATTACK_STATUS_READY)
			{
				this.on_ready_to_attack();
			}
			else if (this.attack_status == A.ATTACK_STATUS_CYCLING)
			{
				this.gui_show_bars();
				this.attack_cycle_time[0] += A.seconds_passed_since_last_tick;
				if (this.attack_cycle_time[0] >= this.attack_cycle_time[1])
				{
					this.attack_cycle_time[0] = this.attack_cycle_time[1];
					this.attack_status = A.ATTACK_STATUS_READY;
				}
			}
			else if (this.attack_status == A.ATTACK_STATUS_RELOADING)
			{
				this.gui_show_bars();
				this.attack_reload_time[0] += A.seconds_passed_since_last_tick;
				if (this.attack_reload_time[0] >= this.attack_reload_time[1])
				{
					this.attack_reload_time[0] = this.attack_reload_time[1];
					this.attack_ammo[0] = this.attack_ammo[1];
					// reload also recycles, no need to go back to "cycling"
					this.attack_cycle_time[0] = this.attack_cycle_time[1];
					this.attack_status = A.ATTACK_STATUS_READY;
				}
			}
		}
		
		return obj;
	}
	
	/** @constructor */
	A.ObjectPlayer1Switch = function(position, valid_directions, direction)
	{
		var obj = new A.ObjectPlayer1Base(position, 0, 0, -1, []);
		
		obj.valid_directions = valid_directions;
		obj.direction = direction;
		obj.shadow_sprite_id = -1;
		obj.hidden_from_other_player = 1;
		obj.detection_distance = 0;
		
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
		
		obj.on_owner_click = function()
		{
			if (A.selected_tool != 1)
			{
				return;
			}
			
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
	
	/** @constructor */
	A.ObjectPlayer1Destination = function(position, valid_directions, direction)
	{
		var obj = new A.ObjectPlayer1Base(position, 0, 0, -1, [ [ 13, -32, -16 ] ] );
		obj.shadow_sprite_id = -1;
		obj.hidden_from_other_player = 1;
		obj.detection_distance = 0;
		
		obj.on_collision_middle = function(obj2, i, distance)
		{
			// make sure the object is really exploded on both side
			B.send("object_destroy", [ obj2.uid, 1 ]);
		}
		
		obj.on_tick = function()
		{
			this.collision_check();
		}
		
		return obj;
	}
	
	/** @constructor */
	A.ObjectPlayer2Tower1 = function(position)
	{
		var obj = new A.ObjectPlayer2Base(position, 100, 40, 0.1, 2, [ [ 20, -32, -48 ], [ 21, -32, -48 ] ]);
		
		obj.attack_damage = 5;
		
		obj.attack = function()
		{
			// attack gfx
			// TODO: move the start and end points to their correct positions
			A.gfx_effect_shot.push([
				A._2d_subtract(this.position_on_layer, [ 0, 32 ]), // start position
				A._2d_subtract(A.objects[this.attack_target_object_id].position_on_layer, [ A._random_int(-4, 4, 1), A._random_int(12, 20, 1) ]), // end position
				2, // width
				0.2, // seconds left to display
				0.2 // seconds total display
			]);
			
			A.hit_nearby_objects(A.objects[this.attack_target_object_id].position, this.attack_damage, this.attack_impact_radius, this.owner_player);
		}
		
		return obj;
	}
	
	/** @constructor */
	A.ObjectPlayer2Tower2 = function(position)
	{
		var obj = new A.ObjectPlayer2Base(position, 100, 100, 0, 2, [ [ 20, -32, -48 ], [ 22, -32, -48 ] ]);
		
		obj.attack_damage = 1;
		obj.attack_impact_radius = 0.5;
		
		obj.attack = function()
		{
			var angle = A._2d_angle(this.position, A.objects[this.attack_target_object_id].position);
			
			A.shots.push([ A._2d_copy(this.position), [ Math.sin(angle) * -10, Math.cos(angle) * -10 ], [ 0.9, 0.9 ], 1, 25, this.attack_damage, this.attack_impact_radius, this.owner_player ]);
		}
		
		return obj;
	}
	
	/** @constructor */
	A.ObjectPlayer1Ghost1 = function(position, direction)
	{
		var obj = new A.ObjectPlayer1Base(position, 0.75, direction, 100, [ [ 5, -16, -32, 2, 2 ], [ 4, -16, -32, 2, 2 ], [ 3, -16, -32, 2, 2 ] ]);
		
		// candy for the eye!
		for (j=0; j<3; j++)
		{
			obj.sprites[j][5] = A._random_float(0, 1);
			obj.sprites[j][6] = A._random_float(0, 1);
			obj.sprites[j][7] = A._random_float(1, 4);
			obj.sprites[j][8] = A._random_float(1, 4);
		}
		
		return obj;
	}
	
	// DEBUG BEGIN
	A.log = function(s)
	{
		console.log("[" + A.tick_number + "] " + s);
	}
	// DEBUG END
	
	A._generate_uid = function()
	{
		var i, result = "";
		for (i=0; i<32; i++)
		{
			result += A.BASE64_CHARS[Math.floor(Math.random() * (A.BASE64_CHARS.length - 1))];
		}
		return result;
	}
	
	A._distance = function(p, q)
	{
		return Math.sqrt(Math.pow(p[0] - q[0], 2)+ Math.pow(p[1] - q[1], 2));
	}
	
	A._decode = function(s, start, length)
	{
		var args = [];
		for (var i=0; i<length; i++)
		{
			args[i] = A.BASE64_CHARS.indexOf(s[i + start]) / (A.BASE64_CHARS.length - 1);
		}
		return args;
	}
	
	A._world_position_to_layer_position = function(ab)
	{
		c = 1280 / 2;
		d = 32;
		
		x = ab[0] * 55 - ab[1] * 40 + c;
		y = ab[0] * 8 + ab[1] * 20 + d;
		return [ x, y ];
	}
	
	A._layer_position_to_world_position = function(xy)
	{
		c = 1280 / 2;
		d = 32;
		
		a = (xy[0] - c + (xy[1] - d) * 2) / 71;
		b = (a * 55 + c - xy[0]) / 40;
		
		return [ a, b ]
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
			A.objects.push(new A.ObjectPlayer1Switch([ arrows[i][0], arrows[i][1] ], [ arrows[i][2] & 1, arrows[i][2] & 2, arrows[i][2] & 4, arrows[i][2] & 8 ], arrows[i][3]));
		}
	}
	
	A._remove_array_item = function(array, id)
	{
		var i, result = [];
		
		for (i in array)
		{
			if (i != id)
			{
				result[i] = array[i];
			}
		}
		
		return result;
	}
	
	A._cv_gradient = function(c, p1, p2, stops)
	{
		var i, gradient;
		
		gradient = c.createLinearGradient(p1[0], p1[1], p2[0], p2[1]);
		
		for (i in stops)
		{
			gradient.addColorStop(stops[i][0], stops[i][1]);
		}
		
		return gradient;
	}
	
	A._cv_arc = function(c, position, radius, state, color)
	{
		var start = -Math.PI / 2;
		var max = 2 * Math.PI;
		
		c.beginPath();
		c.fillStyle = color;
		c.moveTo(position[0], position[1]);
		c.arc(position[0], position[1], radius, start, start + max * state, false);
		c.fill();
		c.closePath();
	}
	
	A._2d_add = function(a, b)
	{
		return [ a[0] + b[0], a[1] + b[1] ];
	}
	
	A._2d_subtract = function(a, b)
	{
		return [ a[0] - b[0], a[1] - b[1] ];
	}
	
	A._2d_copy = function(a)
	{
		return [ a[0], a[1] ];
	}
	
	A._2d_angle = function(a, b)
	{
		return Math.atan2(a[0] - b[0], a[1] - b[1]);
	}
	
	A._2d_between = function(x, a, b)
	{
		return x[0] >= a[0] && x[0] < b[0] && x[1] >= a[1] && x[1] < b[1];
	}
	
	A._2d_equals = function(a, b)
	{
		return a[0] == b[0] && a[1] == b[1];
	}
	
	A._format_time = function(seconds)
	{
		var m, s, minus = seconds < 0;
		if (minus)
		{
			seconds *= -1;
		}
		m = Math.floor(seconds / 60);
		s = Math.floor(seconds % 60);
		// z = Math.floor(seconds * 10 - Math.floor(seconds) * 10;
		return (minus ? "-" : "") + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
	}
	
	A.set_tool = function(button_order)
	{
		// TODO: validate selection
		if (A.current_player == 1)
		{
			if (button_order == 3)
			{
				A.golds[0] -= 100;
				A.player1_queues[A.player1_current_queue][4].push(1);
			}
			else
			{
				A.selected_tool = button_order;
			}
		}
		else
		{
			A.selected_tool = button_order;
		}
	}
	
	A.selection_clear = function()
	{
		var i;
		
		for (i in A.objects)
		{
			A.objects[i].selected = 0;
		}
	}
	
	A.selection_set = function(p1, p2)
	{
		var i;
		
		A.selection_clear();
		
		for (i in A.objects)
		{
			if (
				A.objects[i].owner_player == A.current_player &&
				!A.objects[i].permanent &&
				A.objects[i].position_on_layer[0] >= p1[0] &&
				A.objects[i].position_on_layer[0] <= p2[0] &&
				A.objects[i].position_on_layer[1] >= p1[1] &&
				A.objects[i].position_on_layer[1] <= p2[1]
			)
			{
				A.objects[i].selected = 1;
			}
		}
	}
	
	A.player1_queue_select = function(queue_id)
	{
		A.player1_current_queue = queue_id;
	}
	
	A.player1_queue_decrease_pop_time = function(queue_id)
	{
		A.player1_queues[queue_id][3] -= 20;
		if (A.player1_queues[queue_id][3] == 0)
		{
			A.player1_queues[queue_id][3] = 120;
		}
		A.player1_queue_select(queue_id);
	}
	
	A.player1_queue_startstop = function(queue_id)
	{
		A.player1_queues[queue_id][5] = !A.player1_queues[queue_id][5];
		A.player1_queue_select(queue_id);
	}
	
	A.player2_build_tower = function(position, tower_id)
	{
		var i;
		
		// if a concrete tile is under the cursor
		if (A.map[position[0]][position[1]] != 7)
		{
			return false;
		}
		
		// if the tile is not used yet
		for (i in A.objects)
		{
			if (A.objects[i].owner_player == 2 && A._2d_equals(A.objects[i].position, position))
			{
				return false;
			}
		}
		
		if (tower_id == 1)
		{
			A.objects.push(new A.ObjectPlayer2Tower1(position));
		}
		else if (tower_id == 2)
		{
			A.objects.push(new A.ObjectPlayer2Tower2(position));
		}
		
		return true;
	}
	
	A.create_object = function(args)
	{
		if (args[0] == 1)
		{
			A.objects.push(new A.ObjectPlayer1Ghost1(args[2], args[3]));
		}
		else
		{
			return false;
		}
		
		// synchronize object UID across players (indexes can be different)
		A.objects[A.objects.length - 1].uid = args[1];
	}
	
	A.object_destroy = function(args)
	{
		var i;
		
		for (i in A.objects)
		{
			if (A.objects[i].uid == args[0])
			{
				A.objects[i].explode();
			}
		}
	}
	
	A.set_player = function(player_id)
	{
		A.current_player = player_id;
		A.selection_clear();
		A.set_tool(1);
		
		if (player_id == 1)
		{
			A.gui_buttons = [
				[ [  8,  8 ], "c1", "1", A.set_tool, 1 ],
				[ [ 34,  8 ], "c2", "2", A.set_tool, 2 ],
				[ [ 60,  8 ], "c3", "3", A.set_tool, 3 ],
				[ [  4, 40 ], "cx", "Q", A.player1_queue_startstop, 0 ],
				[ [ 28, 40 ], "cx", "W", A.player1_queue_decrease_pop_time, 0 ],
				[ [ 52, 40 ], "cx", "E", A.player1_queue_select, 0 ],
				[ [  4, 66 ], "cx", "A", A.player1_queue_startstop, 1 ],
				[ [ 28, 66 ], "cx", "S", A.player1_queue_decrease_pop_time, 1 ],
				[ [ 52, 66 ], "cx", "D", A.player1_queue_select, 1 ],
				[ [  4, 92 ], "cx", "Z", A.player1_queue_startstop, 2 ],
				[ [ 28, 92 ], "cx", "X", A.player1_queue_decrease_pop_time, 2 ],
				[ [ 52, 92 ], "cx", "C", A.player1_queue_select, 2 ]
			];
		}
		else
		{
			A.gui_buttons = [
				[ [  8,  4 ], "c1", "1", A.set_tool, 1 ],
				[ [ 34,  4 ], "c2", "2", A.set_tool, 2 ],
				[ [ 60,  4 ], "c3", "3", A.set_tool, 3 ],
				[ [ 86,  4 ], "c3", "4", A.set_tool, 4 ]
			];
		}
	}
	
	A.gfx__texture_create = function(id, recipe, texture_size_id)
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
/*
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
*/
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
	
	A.gfx__texture_put = function(texture_id, x, y)
	{
		A.cv.ctx.drawImage(A.textures[texture_id].cv, x, y);
	}
	
	A.gfx__render_fire_particle = function(position, progress)
	{
		var a, radius, c = A.cv.ctx;
		
		if (progress < 0.2)
		{
			a = (progress / 0.2);
			radius = 6 + a * 8;
			c.fillStyle = "rgba(255,255," + Math.floor(255 - a * 255) + ",0.7)";
		}
		else if (progress < 0.5)
		{
			a = (progress - 0.2) / 0.3;
			radius = 14 + a * 6;
			c.fillStyle = "rgba(255," + Math.floor(255 - a * 255) + ",0," + (0.7 - a * 0.5) + ")";
		}
		else if (progress < 0.7)
		{
			a = (progress - 0.5) / 0.2;
			radius = 20 + a * -4;
			c.fillStyle = "rgba(" + Math.floor(255 - a * 255) + ",0,0," + (0.2 - a * 0.2) + ")";
		}
		else
		{
			a = (progress - 0.7) / 0.3;
			radius = 16 + a * -2;
			c.fillStyle = "rgba(0,0,0," + (0.1 - a * 0.1) + ")";
		}
		
		c.beginPath();
		c.arc(position[0], position[1], radius, 0, 2 * Math.PI, false);
		c.fill();
		c.closePath();
	}
	
	A.gfx__render_gui_button = function(button)
	{
		var c = A.cv.ctx;
		
		if (A.selected_tool == button[2])
		{
			c.fillStyle = "#000";
			c.fillRect(button[0][0], button[0][1], 24, 24);
			c.strokeStyle = "#fff";
			c.strokeRect(button[0][0], button[0][1], 24, 24);
			A.gfx__texture_put(button[1], button[0][0], button[0][1]);
		}
		else
		{
			A.gfx__texture_put(button[1], button[0][0], button[0][1]);
			c.fillStyle = "rgba(0,0,0,0.1)";
			c.fillRect(button[0][0], button[0][1], 24, 24);
		}
		// A.gfx__texture_put(button[1], button[0][0], button[0][1]);
	}
	
	A.gfx__render_gui_bar_background = function(x, y, width, height)
	{
		A.cv.ctx.fillStyle = "rgba(0,0,0,0.3)";
		A.cv.ctx.fillRect(x, y, width, height);
	}
	
	A.gfx__render_gui_bar = function(x, y, width, value, color)
	{
		A.cv.ctx.fillStyle = color;
		A.cv.ctx.fillRect(x, y, width, 4);
		
		A.cv.ctx.fillStyle = "rgba(0,0,0,0.8)";
		A.cv.ctx.fillRect(x + (width * value), y, width - (width * value), 4);
		
		A.cv.ctx.fillStyle = A._cv_gradient(A.cv.ctx, [ x, y ], [ x, y + 4 ],
			[
				[ 0, "rgba(0,0,0,0.1)" ],
				[ 0.7, "rgba(0,0,0,0.4)" ],
				[ 1, "rgba(0,0,0,0.3)" ]
			]
		);
		A.cv.ctx.fillRect(x, y, width, 4);
		
	}
	
	A.gfx_render_map = function()
	{
		var a, b, p;
		
		for (a=0; a<A.config.world_width; a++)
		{
			for (b=0; b<A.config.world_height; b++)
			{
				p = A._world_position_to_layer_position([ a, b ]);
				A.gfx__texture_put(A.map[a][b], p[0] - 32, p[1] - 16);
			}
		}
		// A.gfx__texture_put(0, "r1", 0, 0);
	}
	
	A.gfx_render_markers = function()
	{
		var i, j, p;
		
		p = A._world_position_to_layer_position([ Math.floor(A.cursor_position_in_world[0] + 0.5), Math.floor(A.cursor_position_in_world[1] + 0.5) ]);
		A.gfx__texture_put(1, p[0] - 32, p[1] - 16);
		
		for (i in A.objects)
		{
			p = A.objects[i].position_on_layer;
			
			if (A.objects[i].selected)
			{
				A.gfx__texture_put(A.objects[i].selection_sprite_id, p[0] - 32, p[1] - 16);
			}
			
			// show the targets for player 2
			if (A.current_player == 2)
			{
				for (j in A.objects)
				{
					if (A.objects[j].owner_player == 2 && A.objects[j].attack_target_object_id == i)
					{
						A.gfx__texture_put(12, p[0] - 32, p[1] - 16);
					}
				}
			}
		}
	}
	
	A.gfx_render_fog = function()
	{
		var a, b, p;
		
		for (a=0; a<A.config.world_width; a++)
		{
			for (b=0; b<A.config.world_height; b++)
			{
				if (A.fog[a][b] == 2)
				{
					p = A._world_position_to_layer_position([ a, b ]);
					A.gfx__texture_put(9, p[0] - 32, p[1] - 16);
				}
				else if (A.fog[a][b] == 1)
				{
					p = A._world_position_to_layer_position([ a, b ]);
					A.gfx__texture_put(10, p[0] - 32, p[1] - 16);
				}
			}
		}
	}
	
	A.gfx_render_objects = function(min_position, max_position) /* in world */
	{
		var i, p, obj, sprite;
		
		for (i in A.objects)
		{
			if (!A._2d_between(A.objects[i].position, min_position, max_position))
			{
				continue;
			}
			
			obj = A.objects[i];
			
			if (obj.destroyed || (obj.owner_player != A.current_player && obj.hidden_from_other_player))
			{
				continue;
			}
			
			// out of screen
			if (!(obj.position[0] >= 0 && obj.position[0] < A.config.world_width && obj.position[1] >= 0 && obj.position[1] < A.config.world_height))
			{
				continue;
			}
			
			if (A.fog[Math.round(obj.position[0])][Math.round(obj.position[1])] == 2)
			{
				continue;
			}
			
			p = obj.position_on_layer;
			
			// shadow
			if (obj.shadow_sprite_id != -1)
			{
				// TODO: this is for 64x32 sprites only
				A.gfx__texture_put(obj.shadow_sprite_id, p[0] - 32, p[1] - 16);
			}
			
			for (j in obj.sprites)
			{
				sprite = obj.sprites[j];
				
				// this is heavily eyecandy, that's why it's here and not in process_objects()
				sprite[5] += sprite[7] * A.seconds_passed_since_last_frame;
				sprite[6] += sprite[8] * A.seconds_passed_since_last_frame;
				rx = (Math.cos(sprite[5]) * sprite[3]) || 0;
				ry = (Math.sin(sprite[6]) * sprite[4]) || 0;
				
				A.gfx__texture_put(sprite[0], p[0] + sprite[1] + rx, p[1] + sprite[2] + ry);
			}
		}
	}
	
	A.gfx_render_fire = function(min_position, max_position) /* position on layer */
	{
		var i;
		
		for (i in A.gfx_effect_fire)
		{
			if (!A._2d_between(A.gfx_effect_fire[i][0], min_position, max_position))
			{
				continue;
			}
			// TODO: this does not calculate the passed time (effect is fps-dependent)
			A.gfx_effect_fire[i][0][0] += A.gfx_effect_fire[i][1][0] * A.seconds_passed_since_last_frame;
			A.gfx_effect_fire[i][0][1] += A.gfx_effect_fire[i][1][1] * A.seconds_passed_since_last_frame;
			
			A.gfx_effect_fire[i][1][0] *= 0.99;
			A.gfx_effect_fire[i][1][1] *= 0.99;
			
			A.gfx__render_fire_particle(A.gfx_effect_fire[i][0], 1 - A.gfx_effect_fire[i][2] / A.gfx_effect_fire[i][3]);
			
			A.gfx_effect_fire[i][2] -= A.seconds_passed_since_last_frame;
			
			if (A.gfx_effect_fire[i][2] < 0)
			{
				A.gfx_effect_fire = A._remove_array_item(A.gfx_effect_fire, i);
			}
		}
	}
	
	A.gfx_render_shots = function(min_position, max_position) /* position on layer */
	{
		var i, a, c = A.cv.ctx;
		
		for (i in A.gfx_effect_shot)
		{
			if (!A._2d_between(A.gfx_effect_shot[i][0], min_position, max_position))
			{
				continue;
			}
			
			a = (A.gfx_effect_shot[i][3]/A.gfx_effect_shot[i][4]);
			
			c.strokeStyle = A._cv_gradient(c, A.gfx_effect_shot[i][0], A.gfx_effect_shot[i][1],
				[
					[ 0, "rgba(255,255,0," + (0.7 * a) +")" ],
					[ 0.5, "rgba(255,255,255," + a + ")" ],
					[ 1, "rgba(255,255,255," + (0.9 * a) + ")" ]
				]
			);
			
			c.beginPath();
			c.moveTo(A.gfx_effect_shot[i][0][0], A.gfx_effect_shot[i][0][1]);
			c.lineTo(A.gfx_effect_shot[i][1][0], A.gfx_effect_shot[i][1][1]);
			c.closePath();
			c.lineWidth = A.gfx_effect_shot[i][2];
			c.stroke();
			
			A.gfx_effect_shot[i][3] -= A.seconds_passed_since_last_frame;
			
			if (A.gfx_effect_shot[i][3] <= 0)
			{
				A.gfx_effect_shot = A._remove_array_item(A.gfx_effect_shot, i);
			}
		}
	}
	
	A.gfx_render_gui_selection = function()
	{
		var p, c = A.cv.ctx;
		
		if (A.inputs.mouse_button_statuses[0] & 1)
		{
			p = A._2d_subtract(A.inputs.mouse_position, A.inputs.mouse_click_position);
			c.fillStyle = "rgba(255,255,255,0.2)";
			c.strokeStyle = "#fff";
			c.fillRect(A.inputs.mouse_click_position[0], A.inputs.mouse_click_position[1], p[0], p[1]);
			c.strokeRect(A.inputs.mouse_click_position[0], A.inputs.mouse_click_position[1], p[0], p[1]);
		}
	}
	
	A.gfx_render_gui_toolbars = function()
	{
		var i, j, k, p, c = A.cv.ctx;
		var color1;
		
		if (A.current_player == 1)
		{
			c.fillStyle = A._cv_gradient(c, [ 0, 4 ], [ 0, 32 ],
				[
					[ 0, "#b00" ],
					[ 0.8, "#600" ],
					[ 1, "#800" ]
				]
			);
			c.fillRect(4, 4, 300, 32);
			color1 = "#000";
			
			for (i in A.player1_queues)
			{
				c.fillStyle = "rgba(200,0,0," + ((A.player1_current_queue == i) ? "0.3" : "0.1") + ")";
				c.fillRect(4, 40 + i * 26, 72, 24);
				k = 0;
				for (j in A.player1_queues[i][4])
				{
					if (A.player1_queues[i][4][j] == 1)
					{
						A.gfx__texture_put("c3", 72 + k*24, 40 + i*26);
						k++;
					}
				}
			}
			
			color1 = "#a20";
		}
		else
		{
			c.fillStyle = A._cv_gradient(c, [ 0, 4 ], [ 0, 32 ],
				[
					[ 0, "#06e" ],
					[ 0.8, "#038" ],
					[ 1, "#04a" ]
				]
			);
			c.fillRect(4, 4, 300, 32);
			
			color1 = "#04c";
		}
		c.fillStyle = "rgba(0,0,0,0.2)";
		c.fillRect(6, 6, 296, 28);
		
		for (i in A.gui_buttons)
		{
			A.gfx__render_gui_button(A.gui_buttons[i]);
		}
		
		if (A.current_player == 1)
		{
			for (i in A.player1_queues)
			{
				A.gfx__texture_put(A.player1_queues[i][5] == 1 ? "cc" : "cd", 4, 40 + i * 26);
				A.gfx__texture_put(A.player1_current_queue == i ? "cb" : "ca", 52, 40 + i * 26);
				A._cv_arc(c, [ 40, 52 + i * 26 ], 10, 1, "#411");
				A._cv_arc(c, [ 40, 52 + i * 26 ], 10, (A.player1_queues[i][3] / 120), "#922");
				A._cv_arc(c, [ 40, 52 + i * 26 ], 8, (A.player1_queues[i][2] / 120), "#fff");
			}
		}
		
		c.font = "16px Arial bold";
		c.textAlign = "right";
		c.fillStyle = "#fff";
		c.fillText(A.golds[A.current_player - 1], A.cv.cv.width - 4, 18);
		c.fillStyle = (A.config.game_duration - A.game_time) > 0 ? "#fff" : "#ff0";
		c.fillText(A._format_time(A.config.game_duration - A.game_time), A.cv.cv.width - 70, 18);
	}
	
	A.gfx_render_gui_bars = function()
	{
		var i, p, c = A.cv.ctx;
		
		for (i in A.objects)
		{
			if (A.objects[i].owner_player != A.current_player || A.objects[i].permanent || (A.objects[i].gui_show_bars_until_tick < A.tick_number && !A.objects[i].selected))
			{
				continue;
			}
			
			p = A._2d_subtract(A.objects[i].position_on_layer, A.scroll);
			
			if (A.objects[i].owner_player == 1)
			{
				A.gfx__render_gui_bar_background(p[0] - 18, p[1] + 6, 36, 8);
				A.gfx__render_gui_bar(p[0] - 16, p[1] + 8, 32, A.objects[i].health[0] / A.objects[i].health[1], "#5f0");
			}
			else
			{
				A.gfx__render_gui_bar_background(p[0] - 24, p[1] + 6, 48, 14);
				A.gfx__render_gui_bar(p[0] - 22, p[1] + 8, 44, A.objects[i].health[0] / A.objects[i].health[1] , "#5f0");
				if (A.objects[i].attack_status == A.ATTACK_STATUS_RELOADING)
				{
					A.gfx__render_gui_bar(p[0] - 22, p[1] + 14, 44, A.objects[i].attack_reload_time[0] / A.objects[i].attack_reload_time[1], "#bbb");
				}
				else
				{
					A.gfx__render_gui_bar(p[0] - 22, p[1] + 14, 32, A.objects[i].attack_ammo[0] / A.objects[i].attack_ammo[1], "#ee0");
					A.gfx__render_gui_bar(p[0] + 10, p[1] + 14, 12, A.objects[i].attack_cycle_time[0] / A.objects[i].attack_cycle_time[1], "#eee");
				}
			}
		}
	}
	
	A.gfx_render_gui_cursor = function()
	{
		A.gfx__texture_put(8, A.inputs.mouse_position[0], A.inputs.mouse_position[1]);
	}
	
	A.fog_set = function(a, b, c)
	{
		if (a >= 0 && a < A.config.world_width && b >= 0 && b < A.config.world_height)
		{
			if (A.fog[a][b] > c)
			{
				A.fog[a][b] = c;
			}
		}
	}
	
	A.fog_set_array = function(x, y, array_index, c)
	{
		var i;
		for (i in A.hexagon_neighbours[array_index])
		{
			A.fog_set(x + A.hexagon_neighbours[array_index][i][0], y + A.hexagon_neighbours[array_index][i][1], c);
		}
	}
	
	A.process_fog = function()
	{
		var i, j, k, x, y, obj;
		for (i=0; i<A.config.world_width; i++)
		{
			for (j=0; j<A.config.world_height; j++)
			{
				A.fog[i][j] = 2;
			}
		}
		
		for (i in A.objects)
		{
			if (A.objects[i].owner_player == A.current_player)
			{
				obj = A.objects[i];
				x = Math.round(obj.position[0]);
				y = Math.round(obj.position[1]);
				
				A.fog_set_array(x, y, 0, 0);
				
				if (obj.detection_distance == 1)
				{
					A.fog_set_array(x, y, 1, 1);
				}
				else if (obj.detection_distance == 2)
				{
					A.fog_set_array(x, y, 1, 0);
					A.fog_set_array(x, y, 2, 1);
				}
				else if (obj.detection_distance == 3)
				{
					A.fog_set_array(x, y, 1, 0);
					A.fog_set_array(x, y, 2, 0);
					A.fog_set_array(x, y, 3, 1);
				}
			}
		}
	}
	
	A.render_canvas = function()
	{
		A.cv.ctx.fillStyle = "#111";
		A.cv.ctx.fillRect(0, 0, A.cv.cv.width, A.cv.cv.height);
		
		A.cv.ctx.save();
		if (A.shake > 0)
		{
			A.cv.ctx.translate(A._random_int(-A.shake, A.shake, 1), A._random_int(-A.shake, A.shake, 1));
			// TODO: this does not calculate the passed time (effect is fps-dependent)
			A.shake = Math.floor(A.shake / 2);
		}
		
		A.cv.ctx.save();
		A.cv.ctx.translate(-A.scroll[0], -A.scroll[1]);
		A.render_layer2();
		
		// DEBUG BEGIN
		var i, p;
		for (i in A.shots)
		{
			p = A._world_position_to_layer_position(A.shots[i][0]);
			A.cv.ctx.fillStyle = "#f0f";
			A.cv.ctx.fillRect(p[0]-1, p[1]-1, 3, 3);
		}
		// DEBUG END
		
		A.cv.ctx.restore();
		
		// fixed to the screen not to the world
		A.render_layer3();
		
		A.cv.ctx.restore();
	}
	
	A.render_layer2 = function()
	{
		var i, x, y, p, q, a, b;
		
		A.gfx_render_map();
		A.gfx_render_markers();
		A.gfx_render_fog();
		
		/* TODO: replace this ugly tile-by-tile and always-loop-through-all-objects-and-skip-the-ones-we-don't-need thing with a single sort of object/fire/shot ids into arrays by tile and loop through them */
		for (x=0; x<A.config.world_width; x++)
		{
			for (y=0; y<A.config.world_height; y++)
			{
				p = [ x - 0.5, y - 0.5 ];
				q = [ x + 0.5, y + 0.5 ];
				
				A.gfx_render_objects(p, q);
				
				/* TODO: this is a rough approximation, also it has some overlaps, need to be fixed */
				a = A._2d_subtract(A._world_position_to_layer_position([ x, y ]), [ 32, 16 ]);
				b = A._2d_add(a, [ 55, 28 ]);
				A.gfx_render_fire(a, b);
				A.gfx_render_shots(a, b);
			}
		}
	}
	
	A.render_layer3 = function()
	{
		A.gfx_render_gui_selection();
		A.gfx_render_gui_toolbars();
		A.gfx_render_gui_bars(); // health, ammo, ...
		A.gfx_render_gui_cursor();
	}
	
	A.handle_mouseout = function(event)
	{
		A.inputs.mouse_on_canvas = 0;
		A.inputs.modified = 1;
	}
	
	A.handle_mousemove = function(event)
	{
		var a = A.cv.cv.getBoundingClientRect();
		
		A.inputs.mouse_on_canvas = 1;
		A.inputs.modified = 1;
		A.inputs.mouse_position = [ event.clientX - a.left, event.clientY - a.top ];
		
		event.preventDefault();
	}
	
	A.handle_mousedown_gui = function()
	{
		var i;
		
		for (i in A.gui_buttons)
		{
			// if button was hit
			if (A._2d_between(A.inputs.mouse_position, A.gui_buttons[i][0], A._2d_add(A.gui_buttons[i][0], [ 24, 24 ])))
			{
				// call the button's function
				A.gui_buttons[i][3](A.gui_buttons[i][4]);
				return true;
			}
		}
		return false;
	}
	
	A.handle_mousedown_object = function()
	{
		var i, p;
		
		for (i in A.objects)
		{
			if (A._distance(A.cursor_position_in_world, A.objects[i].position) < 0.5)
			{
				A.objects[i].on_click();
				return true;
			}
		}
		return false;
	}
	
	A.handle_mousedown_tile = function()
	{
		var p = [  Math.floor(A.cursor_position_in_world[0] + 0.5), Math.floor(A.cursor_position_in_world[1] + 0.5) ];
		
		if (A.current_player == 2)
		{
			if (A.selected_tool == 3)
			{
				A.player2_build_tower(p, 1);
			}
			else if (A.selected_tool == 4)
			{
				A.player2_build_tower(p, 2);
			}
		}
		return true;
	}
	
	A.handle_mousedown = function(event)
	{
		// handle left click only
		if (event.which != 1)
		{
			return;
		}
		
		A.handle_mousemove(event);
		
		A.inputs.mouse_button_statuses[0] |= 1; // press happened
		A.inputs.mouse_click_position = A.inputs.mouse_position;
		
		A.inputs.mouse_click_position[2] = 1;
		if (!A.handle_mousedown_gui())
		{
			A.inputs.mouse_click_position[2] = 2;
			if (!A.handle_mousedown_object())
			{
				A.inputs.mouse_click_position[2] = 3;
				A.handle_mousedown_tile();
			}
		}
		
		event.preventDefault();
	}
	
	A.handle_mouseup = function(event)
	{
		// handle left click only
		if (event.which != 1)
		{
			return;
		}
		
		// if pressed...
		if (A.inputs.mouse_button_statuses[0] & 1)
		{
			A.inputs.mouse_button_statuses[0] |= 2; // release happened
			
			if (A.inputs.mouse_click_position[2] == 3)
			{
				A.selection_set(A._2d_add(A.inputs.mouse_click_position, A.scroll), A._2d_add(A.inputs.mouse_position, A.scroll));
			}
		}
		
		event.preventDefault();
	}
	
	A.handle_resize = function()
	{
		A.scroll[0] -= (window.innerWidth - A.cv.cv.width) / 2;
		A.scroll[1] -= (window.innerHeight - A.cv.cv.height) / 2;
		A.cv.cv.width = window.innerWidth;
		A.cv.cv.height = window.innerHeight;
	}
	
	A.init = function()
	{
		A.cv = A._create_cv(1280, 720);
		A.cv.cv.addEventListener("mousemove", A.handle_mousemove, false);
		A.cv.cv.addEventListener("mousedown", A.handle_mousedown, false);
		A.cv.cv.addEventListener("mouseup", A.handle_mouseup, false);
		A.cv.cv.addEventListener("mouseout", A.handle_mouseout, false);
		window.addEventListener("resize", A.handle_resize, false);
		/* move the world to the middle of the page */
		A.handle_resize();
		document.getElementById("canvas0").appendChild(A.cv.cv);
	}
	
	A.init_map = function()
	{
		var i, j, obj;
		
		A.game_time = 0;
		A.golds = [ 1000, 1000 ];
		A.player1_queues = [ [ [ 0, 1 ], 1, 40, 40, [], 0 ], [ [ 0, 14 ], 1, 40, 40, [], 0 ], [ [ 6, 19 ], 0, 40, 40, [], 0 ] ];
		
		for (j=0; j<A.config.world_width; j++)
		{
			A.fog[j] = [];
			A.map[j] = {};
			for (i=0; i<A.config.world_height; i++)
			{
				A.fog[j][i] = 2;
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
				[ 6, 10, 12, 10 ],
				[ 6, 15, 6, 19 ]
			],
			[
				[ 6, 1, 14, 1 ],
				[ 12, 1, 12, 2 ],
				[ 12, 6, 7, 1 ],
				[ 6, 14, 13, 0 ],
				[ 6, 10, 7, 1 ],
				[ 12, 10, 9, 0 ]
			]
		);
		
		A.map[7][7] = 7;
		A.map[7][8] = 7;
		A.map[7][9] = 7;
		A.map[13][10] = 7;
		A.map[10][11] = 7;
		A.map[11][11] = 7;
		A.map[12][11] = 7;
		A.map[13][11] = 7;
		A.map[11][12] = 7;
		A.map[12][12] = 7;
		A.map[13][12] = 7;
		
		A.objects.push(new A.ObjectPlayer2Tower1([ 10, 11 ]));
		A.objects.push(new A.ObjectPlayer2Tower2([ 13, 10 ]));
		A.objects.push(new A.ObjectPlayer1Destination([ 18, 6 ]));
	}
	
	A.init_textures = function()
	{
		var grid = "IJAoY/23/YoA.";
		var grid2 = "LMElX40y7YnF.";
		A.gfx__texture_create(0, "p23" + grid + "aAF", A.TEXTURE_SIZE_64X32); // grass tile
		A.gfx__texture_create(1, "p01" + grid, A.TEXTURE_SIZE_64X32); // highlighted tile (cursor)
		A.gfx__texture_create(2, "p45" + grid + "aAF", A.TEXTURE_SIZE_64X32); // road tile
		A.gfx__texture_create(3, "p67M2W5etkvq702wOhJPQIM.p87VUfdmR.", A.TEXTURE_SIZE_32X32); // ObjectPlayer1Ghost1 sprite
		A.gfx__texture_create(4, "p678lvybeHZEsQ0gt.", A.TEXTURE_SIZE_32X32); // ObjectPlayer1Ghost1 sprite
		A.gfx__texture_create(5, "p67MTcpwopV.", A.TEXTURE_SIZE_32X32); // ObjectPlayer1Ghost1 sprite
		A.gfx__texture_create(6, "p00eZYcamgonlmc.", A.TEXTURE_SIZE_64X32); // small object shadow
		A.gfx__texture_create(7, "pb0" + grid + "aDM", A.TEXTURE_SIZE_64X32); // concrete tile
		A.gfx__texture_create(8, "pggAAAkKWbW.", A.TEXTURE_SIZE_32X32); // cursor
		A.gfx__texture_create(9, "p00" + grid + "aHK", A.TEXTURE_SIZE_64X32); // fog (light)
		A.gfx__texture_create(10, "p00" + grid + "aAC", A.TEXTURE_SIZE_64X32); // fog (heavy)
		A.gfx__texture_create(11, "pih" + grid2, A.TEXTURE_SIZE_64X32); // small object selection
		A.gfx__texture_create(12, "pkjMUKcTa.pkjjrizqw.pkjsOqVxT.", A.TEXTURE_SIZE_64X32); // small object selection
		A.gfx__texture_create(13, "pkj" + grid2, A.TEXTURE_SIZE_64X32); // ObjectPlayer1Destination sprite
		A.gfx__texture_create("a0", "p00gSsesS.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("a1", "p00gssssg.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("a2", "p00SgSses.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("a3", "p00SSSeeS.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("b0", "p9agSsesS.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("b1", "p9agssssg.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("b2", "p9aSgSses.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create("b3", "p9aSSSeeS.", A.TEXTURE_SIZE_64X32); // ObjectPlayer1Switch sprite
		A.gfx__texture_create(20, "pbbf7f//w/s.aAFpdbAsAwf/f7.aAFpdbAsf7/sfc.aAF", A.TEXTURE_SIZE_64X64); // ObjectPlayer2* concrete base tile
		A.gfx__texture_create(21, "peebgYrftmrjg.pfeLiutmV.peecabgfjjgia.pfeaTUete.peeeRcafciagR.pcffIYMYQZRfUkRmOkK.", A.TEXTURE_SIZE_64X64); // ObjectPlayer2Tower1
		A.gfx__texture_create(22, "pllbgYrftmrjg.pmlLiutmV.pllcabgfjjgia.pmlaTUete.plleRcafciagR.pcmfIYMYQZRfUkRmOkK.", A.TEXTURE_SIZE_64X64); // ObjectPlayer2Tower2
		// A.gfx__texture_create(21, "peebgYrftmrjg.pfeLiutmV.aAKpeecabgfjjgia.pfeaTUete.aAKpeeeRcafciagR.pcffIYMYQZRfUkRmOkK.aAF", A.TEXTURE_SIZE_64X64);
		A.gfx__texture_create("c1", "pggRRR1chuh.", A.TEXTURE_SIZE_24X24); // toolbar icon, mouse
		A.gfx__texture_create("c2", "pgghJZbGbbmQ2kp7xpg4WmW.", A.TEXTURE_SIZE_24X24); // toolbar icon, explode
		A.gfx__texture_create("c3", "pggagTlR7Z6b1j1l6u7rlkh.p11blftjl.", A.TEXTURE_SIZE_24X24); // toolbar icon, explode
		A.gfx__texture_create("c0", "p11RdRTcKjKuTuyRyRdqdqTjOcOVTVd.", A.TEXTURE_SIZE_24X24); // toolbar icon, locked
		A.gfx__texture_create("cx", "", A.TEXTURE_SIZE_24X24); // toolbar icon, empty
		A.gfx__texture_create("ca", "p1gdddhhhhd.", A.TEXTURE_SIZE_24X24); // toolbar icon, middle dot
		A.gfx__texture_create("cb", "pggdVdcVcVhdhdphphhphpdhdhV.", A.TEXTURE_SIZE_24X24); // toolbar icon, plus
		A.gfx__texture_create("cc", "pggUTUrZrZT.pgglTlrsrsT.", A.TEXTURE_SIZE_24X24); // toolbar icon, pause
		A.gfx__texture_create("cd", "pggXTXrof.", A.TEXTURE_SIZE_24X24); // toolbar icon, play
	}
	
	A.find_targets = function(position, max_distance, player_id, skip_permanents)
	{
		var i, distance, targets = [ -1, -1, -1, -1 ], properties = [ 9999, 0, 9999, 0 ];
		
		/* 0: nearest, 1: farthest, 2: weakest, 3: strongest */
		
		for (i in A.objects)
		{
			if (A.objects[i].owner_player == player_id && (!skip_permanents || (skip_permanents && !A.objects[i].permanent)))
			{
				distance = A._distance(position, A.objects[i].position);
				if (distance > max_distance)
				{
					continue;
				}
				
				if (distance < properties[0])
				{
					properties[0] = distance;
					targets[0] = i;
				}
				
				if (distance > properties[1])
				{
					properties[1] = distance;
					targets[1] = i;
				}
				
				if (A.objects[i].health[0] < properties[2])
				{
					properties[2] = A.objects[i].health[0];
					targets[2] = i;
				}
				
				if (A.objects[i].health[0] > properties[3])
				{
					properties[3] = A.objects[i].health[0];
					targets[3] = i;
				}
			}
		}
		
		return targets;
	}
	
	A.hit_nearby_objects = function(position, damage, distance, attacker_player)
	{
		var i, obj_distance, obj_damage;
		
		for (i in A.objects)
		{
			if (A.objects[i].destroyed == 1)
			{
				continue;
			}
			
			obj_distance = A._distance(position, A.objects[i].position);
			if (obj_distance >= distance)
			{
				continue;
			}
			
			obj_damage = damage * ((distance - obj_distance) / distance);
			A.objects[i].on_hit(obj_damage, attacker_player);
		}
	}
	
	A.process_input = function()
	{
		// TODO: fix scroll while selecting, until then this is disabled...
		if (!(A.inputs.mouse_button_statuses[0] & 1) && A.inputs.mouse_on_canvas)
		{
			if (A.inputs.mouse_position[0] < 50 && A.inputs.mouse_position[1] > (A.current_player == 1 ? 146 : 52))
			{
				A.scroll[0] -= 200 * A.seconds_passed_since_last_tick;
			}
			else if (A.inputs.mouse_position[0] > A.cv.cv.width - 50)
			{
				A.scroll[0] += 200 * A.seconds_passed_since_last_tick;
			}
			
			if (A.inputs.mouse_position[1] < 50 && A.inputs.mouse_position[0] > 320)
			{
				A.scroll[1] -= 200 * A.seconds_passed_since_last_tick;
			}
			else if (A.inputs.mouse_position[1] > A.cv.cv.height - 50)
			{
				A.scroll[1] += 200 * A.seconds_passed_since_last_tick;
			}
		}
/*
		if (A.inputs.mouse_button_statuses[0] & 1)
		{
			// pressed
			A.scroll[0] -= A.inputs.mouse_position[0] - A.inputs_prev.mouse_position[0];
			A.scroll[1] -= A.inputs.mouse_position[1] - A.inputs_prev.mouse_position[1];
		}
*/
		
		if (A.inputs.mouse_button_statuses[0] & 2)
		{
			// released
			A.inputs.mouse_button_statuses[0] = 0;
			
/*
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
*/
		}
		
		A.inputs_prev.mouse_position = A.inputs.mouse_position;
		
		A.cursor_position_in_world = A._layer_position_to_world_position([ A.inputs.mouse_position[0] + A.scroll[0], A.inputs.mouse_position[1] + A.scroll[1] ]);
	}
	
	A.process_player1_queues = function()
	{
		var i, j, q;
		for (i in A.player1_queues)
		{
			q = A.player1_queues[i];
			q[2]--;
			if (q[2] == 0)
			{
				q[2] = q[3];
				
				// check if running
				if (q[5] == 1)
				{
					j = q[4].pop();
					if (j == 1)
					{
						B.send("create_object", [ 1, A._generate_uid(), A._2d_copy(q[0]), q[1] ]);
					}
				}
				
				// stop the queue if it is empty
				if (q[4][0] == undefined)
				{
					q[5] = 0;
				}
			}
		}
	}
	
	A.process_shots = function()
	{
		var i, p;
		
		for (i in A.shots)
		{
			// hit the objects nearby shot
			A.hit_nearby_objects(A.shots[i][0], A.shots[i][5], A.shots[i][6], A.shots[i][7]);
			
			p = A._world_position_to_layer_position(A.shots[i][0]);
			
			A.gfx_effect_fire.push([ [ p[0] + A._random_float(-10, 10), p[1] + A._random_float(-10, 10) ], [ A.shots[i][1][0], A.shots[i][1][0] - 50 ], 1, 1 ]);
			
			// move the shot
			A.shots[i][0][0] += A.shots[i][1][0] * A.seconds_passed_since_last_tick;
			A.shots[i][0][1] += A.shots[i][1][1] * A.seconds_passed_since_last_tick;
			
			// apply the multiplier
			A.shots[i][1][0] *= A.shots[i][2][0];
			A.shots[i][1][1] *= A.shots[i][2][1];
			
			// decrease remaining ticks
			A.shots[i][4]--;
			
			// clean up if no ticks remaining
			if (A.shots[i][4] == 0)
			{
				A.shots = A._remove_array_item(A.shots, i);
			}
		}
	}
	
	A.process_objects = function()
	{
		var i, j, moved;
		
		for (i in A.objects)
		{
			A.objects[i].on_tick();
		}
		
		// clean up destroyed objects
		for (i in A.objects)
		{
			if (A.objects[i].destroyed)
			{
				A.objects = A._remove_array_item(A.objects, i);
				for (j in A.objects)
				{
					// invalidate all targets
					if (A.objects[j].attack_target_object_id == i)
					{
						A.objects[j].attack_target_object_id = -1;
					}
				}
			}
		}
		
		// move the objects
		for (i in A.objects)
		{
			// dead objects don't move...
			if (A.objects[i].destroyed)
			{
				continue;
			}
			
			A.objects[i].position_prev = [ A.objects[i].position[0], A.objects[i].position[1] ];
			
			moved =  A.objects[i].speed * A.seconds_passed_since_last_tick;
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
			A.objects[i].position_on_layer = A._world_position_to_layer_position(A.objects[i].position);
		}
	}
	
	A.process_game_status = function()
	{
		A.game_time += A.seconds_passed_since_last_tick;
	}
	
	A.tick = function()
	{
		// DEBUG BEGIN
		if (A.tick_number % 100 == 0)
		{
			A.log("ticks: " + A.tick_number + ", frames: " + A.frame_number + ", game_time*1000: " + Math.round(A.game_time * 1000));
		}
		// DEBUG END
		
		A.tick_number++;
		B.process_tick(A.tick_number);
		A.process_input();
		A.process_player1_queues();
		A.process_shots();
		A.process_objects();
		A.process_game_status();
	}
	
	A.render_frame = function()
	{
		var now = (new Date()).getTime();
		var ticks_needed = Math.floor((now - A.last_tick_timestamp) / A.tick_interval);
		var i;
		
		for (i=0; i<ticks_needed; i++)
		{
			A.tick();
		}
		
		A.frame_number++;
		A.seconds_passed_since_last_frame = (now - A.last_frame_timestamp) / 1000;
		
		A.process_fog();
		A.render_canvas();
		
		A.last_tick_timestamp = A.last_tick_timestamp + ticks_needed * A.tick_interval;
		A.last_frame_timestamp = now;
	}
	
	A.init_ticks = function()
	{
		A.last_tick_timestamp = (new Date()).getTime();
		A.last_frame_timestamp = A.last_tick_timestamp;
		window.setInterval(A.render_frame, A.frame_interval);
	}
	
	A.start = function()
	{
		A.init();
		A.init_map();
		A.init_textures();
		A.init_ticks();
		A.set_player(1);
	}
	
	/* client-server communication */
	B = {};
	B.message_queue = [];
	B.delay = 10;
	
	/* TODO: add pings, auto correction of delay based on pings (ie. good -1, normal +0, bad +5), warning about slow network */
	
	// DEBUG BEGIN
	B.log = function(s)
	{
		A.log("[net] " + s);
	}
	// DEBUG END
	
	B.send = function(command, args)
	{
		var message = JSON.stringify([ (A.tick_number + B.delay), command, args ]);
		
		// DEBUG BEGIN
		B.log("sending: " + message);
		// DEBUG END
		
		B.receive(message);
		
		// TODO: also send over network :)
	}
	
	B.receive = function(message)
	{
		// DEBUG BEGIN
		B.log("received: " + message);
		// DEBUG END
		
		B.message_queue.push(JSON.parse(message));
	}
	
	B.process_tick = function(tick_number)
	{
		var i;
		
		for (i in B.message_queue)
		{
			if (B.message_queue[i][0] <= tick_number)
			{
				// DEBUG BEGIN
				if (B.message_queue[i][0] < tick_number)
				{
					B.log("WARNING: late message processing");
				}
				B.log("processing: " + JSON.stringify(B.message_queue[i]));
				// DEBUG END
				
				// we DO NOT want direct function calls here based on the message just came from the other half of the Earth...
				if (B.message_queue[i][1] == "create_object")
				{
					A.create_object(B.message_queue[i][2]);
				} else if (B.message_queue[i][1] == "object_destroy")
				{
					A.object_destroy(B.message_queue[i][2]);
				}
				
				B.message_queue = A._remove_array_item(B.message_queue, i);
			}
		}
	}
	
	A.start();
}
