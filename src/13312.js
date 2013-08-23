window.onload = function()
{
	A = {};
	
	A.frame_number = 0;
	A.inputs = { modified: 0, mouse_position: [ 640, 360 ] };
	A.inputs_prev = {};
	A.cursor_position_in_world = [ 10, 10 ]; /* tiles */
	A.scroll = [ 0, -40 ] /* pixels */
	A.map = {};
	A.layers = {};
	A.palette = { 0: "rgba(0,0,0,0.2)", 1: "#4a3", 2: "rgba(0,0,0.4)", 3: "#391" };
	A.textures = {};
	
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
		return [ a * 32 - b * 32 + (1280 / 2 - 64 / 2), a * 16 + b * 16 ];
	}
	
	A._layer_position_to_world_position = function(x, y)
	{
		x -= (1280 / 2 - 64 / 2);
		return [ (y/16 + x/32) / 2, (-x/32 + y/16) / 2];
	}
	
/*
	A._random_float = function(min, max)
	{
		return Math.random() * (max - min) + min;
	}
*/
	
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
		for (var i=0; i<2; i++)
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
				A.texture_show(0, 0, p[0], p[1]);
			}
		}
	}
	
	A.render_layer1 = function()
	{
		p = A._world_position_to_layer_position(Math.floor(A.cursor_position_in_world[0]), Math.floor(A.cursor_position_in_world[1]));
		A.layer_clear(1);
		A.texture_show(1, 1, p[0], p[1]);
	}
	
	A.update_mouse_coordinates = function(event)
	{
		var a = A.cv.cv.getBoundingClientRect();
		A.inputs.modified = 1;
		A.inputs.mouse_position = [ event.clientX - a.left, event.clientY - a.top ];
	}
	
	A.init = function()
	{
		A.cv = A._create_cv(1280, 720);
		A.layers[0] = A._create_cv(1280, 720);
		A.layers[1] = A._create_cv(1280, 720);
		A.cv.cv.addEventListener("mousemove", A.update_mouse_coordinates);
		document.getElementById("canvas0").appendChild(A.cv.cv);
	}
	
	A.init_map = function()
	{
		var i, j;
		for (j=0; j<32; j++)
		{
			A.map[j] = {};
			for (i=0; i<32; i++)
			{
				A.map[j][i] = 0;
			}
		}
	}
	
	A.init_textures = function()
	{
		A.texture_create(0, "p13fAAff//f.", 64, 32);
		A.texture_create(1, "p02fAAff//f.", 64, 32);
	}
	
	A.process_input = function()
	{
		if (A.inputs.mouse_position[0] < 20)
		{
			A.scroll[0] -= 20;
		}
		else if (A.inputs.mouse_position[0] > 1260)
		{
			A.scroll[0] += 20;
		}
		if (A.inputs.mouse_position[1] < 20)
		{
			A.scroll[1] -= 20;
		}
		else if (A.inputs.mouse_position[1] > 700)
		{
			A.scroll[1] += 20;
		}
		
		A.cursor_position_in_world = A._layer_position_to_world_position(A.inputs.mouse_position[0] + A.scroll[0], A.inputs.mouse_position[1] + A.scroll[1]);
	}
	
	A.tick = function()
	{
		A.frame_number++;
		A.process_input();
		A.render_layer_map();
		A.render_layer1();
		A.render_canvas();
	}
	
	A.init_tick = function()
	{
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
