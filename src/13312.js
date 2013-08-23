window.onload = function()
{
	A = {};
	A.scroll_x = 10; /* pixels */
	A.scroll_y = 60; /* pixels */
	A.map = {};
	A.layers = {};
	A.palette = { 0: "rgba(0,0,0,0.2)", 1: "#4a3", 2: "#aaa", 3: "#391" };
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
	
	A.texture_show = function(layer_id, texture_id, x, y)
	{
		A.layers[layer_id].ctx.drawImage(A.textures[texture_id].cv, x, y);
	}
	
	A.render_canvas = function()
	{
		A.cv.ctx.save();
		A.cv.ctx.translate(-A.scroll_x, -A.scroll_y);
		for (var i=0; i<2; i++)
		{
			A.cv.ctx.drawImage(A.layers[i].cv, 0, 0);
		}
		A.cv.ctx.restore();
	}
	
	A.render_layer_map = function()
	{
		for (j=0; j<32; j++)
		{
			for (i=0; i<32; i++)
			{
				A.texture_show(0, 0, 1280 / 2 - 64 / 2 + i * 32 - j * 32, i * 16 + j * 16);
			}
		}
		A.texture_show(0, 1, 96, 48);
	}
	
	A.init = function()
	{
		A.cv = A._create_cv(1280, 720);
		A.layers[0] = A._create_cv(1280, 720);
		A.layers[1] = A._create_cv(1280, 720);
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
		A.texture_create(1, "p23fAAff//f.", 64, 32);
	}
	
	A.start = function()
	{
		A.init();
		A.init_map();
		A.init_textures();
		A.render_layer_map();
		A.render_canvas();
	}
	
	A.start();
}
