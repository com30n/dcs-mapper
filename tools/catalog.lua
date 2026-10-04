local jsonObject = {}

local function isArray(t)
	if getmetatable(t) == jsonObject then return false end
	local n = 0
	for _ in pairs(t) do n = n + 1 end
	return n == #t
end

local function json(v)
	local t = type(v)
	if t == 'table' then
		local out = {}
		if isArray(v) then
			for _, x in ipairs(v) do table.insert(out, json(x)) end
			return '[' .. table.concat(out, ',') .. ']'
		end
		for k, x in pairs(v) do
			if type(x) ~= 'function' then
				table.insert(out, json(tostring(k)) .. ':' .. json(x))
			end
		end
		return '{' .. table.concat(out, ',') .. '}'
	elseif t == 'string' then
		return '"' .. v:gsub('[%c"\\]', function(c) return string.format('\\u%04x', c:byte()) end) .. '"'
	elseif t == 'number' or t == 'boolean' then
		return tostring(v)
	end
	return 'null'
end

local function object(t)
	return setmetatable(t, jsonObject)
end

local function loadTable(filename, env)
	local f = loadfile(filename)
	if not f then return nil end
	setfenv(f, env or {})
	local ok, res = pcall(f)
	return ok and res or nil
end

local blackhole
blackhole = setmetatable({}, {
	__index = function() return blackhole end,
	__call = function() return blackhole end,
	__concat = function() return '' end,
})

local function entries(paths)
	local result = {}
	_ = function(s) return s end
	declare_plugin = function(_, decl)
		for name, folder in pairs(type(decl) == 'table' and decl.InputProfiles or {}) do
			result[name] = folder
		end
	end
	setmetatable(_G, {__index = function() return blackhole end})
	for _, path in ipairs(paths) do
		local f = loadfile(path)
		if f then
			current_mod_path = path:match('^(.*)[/\\]')
			pcall(f)
		end
	end
	setmetatable(_G, nil)
	return object(result)
end

local function keyHash(c)
	return 'd' .. tostring(c.down) .. 'p' .. tostring(c.pressed) .. 'u' .. tostring(c.up) ..
		'cd' .. tostring(c.cockpit_device_id) .. 'vd' .. tostring(c.value_down) ..
		'vp' .. tostring(c.value_pressed) .. 'vu' .. tostring(c.value_up)
end

local function axisHash(c)
	return 'a' .. tostring(c.action) .. 'cd' .. tostring(c.cockpit_device_id)
end

local function comboHash(c)
	local r = {}
	for _, x in ipairs(c.reformers or {}) do table.insert(r, x) end
	table.sort(r)
	return tostring(c.key) .. '|' .. table.concat(r, '+')
end

local function findCombo(combos, combo)
	for i, c in ipairs(combos or {}) do
		if comboHash(c) == comboHash(combo) then return i end
	end
end

local function removeCombos(combos, removed)
	for _, c in ipairs(removed or {}) do
		local i = findCombo(combos, c)
		if i then table.remove(combos, i) end
	end
end

local function addCombos(combos, added)
	for _, c in ipairs(added or {}) do
		if not findCombo(combos, c) then table.insert(combos, c) end
	end
end

local function applyDiff(commands, diff, hashOf)
	local dead = {}
	if not diff or not next(diff) then return dead end
	local infos = {}
	for hash, d in pairs(diff) do
		for _, c in ipairs(d.added or {}) do
			infos[comboHash(c)] = infos[comboHash(c)] or {}
			infos[comboHash(c)].added = hash
		end
		for _, c in ipairs(d.removed or {}) do
			infos[comboHash(c)] = infos[comboHash(c)] or {}
			infos[comboHash(c)].removed = hash
		end
	end
	for _, command in ipairs(commands) do
		local hash = hashOf(command)
		if command.combos then
			local updated = false
			for _, c in ipairs(command.combos) do
				local info = infos[comboHash(c)]
				if info and hash ~= info.added and hash ~= info.removed then updated = true end
			end
			if updated then
				table.insert(dead, hash)
			else
				for _, d in pairs(diff) do
					removeCombos(command.combos, d.added)
					removeCombos(command.combos, d.removed)
					removeCombos(command.combos, d.changed)
				end
			end
		end
		local d = diff[hash]
		if d then
			command.combos = command.combos or {}
			removeCombos(command.combos, d.removed)
			addCombos(command.combos, d.added)
			addCombos(command.combos, d.changed)
		end
	end
	return dead
end

local function templateOf(deviceName)
	return (deviceName:gsub('(.*)(%s{.*})', '%1'))
end

local ASSIGNED = '@'
local PROBE = {default = setmetatable({}, {__index = function(_, name) return ASSIGNED .. name end})}

local function loadDeviceProfile(filename, deviceName, actions, defaultAssignments)
	local template = templateOf(deviceName)
	local load
	load = function(filename, folder)
		local f, err = loadfile(filename)
		if not f then error(err) end
		local env = {}
		for k, v in pairs(actions) do env[k] = v end
		env.folder = folder
		env.filename = filename
		env.deviceName = deviceName
		env._ = function(s) return s end
		env.external_profile = function(name, newFolder) return load(name, newFolder or folder) end
		env.defaultFFB = function()
			local a = defaultAssignments[template]
			return a and a.FFB or {trimmer = 1.0, shake = 0.5, swapAxes = false, invertX = false, invertY = false}
		end
		env.defaultDeviceAssignmentFor = function(name)
			local a = (defaultAssignments[template] or defaultAssignments.default)[name]
			if type(a) == 'table' then
				if a.key ~= nil then return {a} end
			elseif a ~= nil then
				return {{key = a}}
			end
		end
		env.MultiEngineDefaultDeviceAssignmentForThrust = function()
			local common = env.defaultDeviceAssignmentFor('thrust')
			local left = env.defaultDeviceAssignmentFor('thrust_left')
			local right = env.defaultDeviceAssignmentFor('thrust_right')
			if defaultAssignments == PROBE then
				return common, left, right
			end
			if not common or (left and left[1].key and right and right[1].key) then
				return nil, left, right
			end
			return common, nil, nil
		end
		env.join = function(to, from)
			for _, v in ipairs(from) do table.insert(to, v) end
			return to
		end
		env.bindKeyboardCommandsToMouse = function(unitInputFolder)
			local keyboard = load(unitInputFolder .. 'keyboard/default.lua', unitInputFolder .. 'keyboard/')
			local mouse = load('Config/Input/Aircrafts/Default/mouse/default.lua', 'Config/Input/Aircrafts/Default/mouse/')
			for _, command in ipairs(keyboard.keyCommands or {}) do
				command.combos = nil
				table.insert(mouse.keyCommands, command)
			end
			return mouse
		end
		env.ignore_features = function(commands, features)
			local set = {}
			for _, x in ipairs(features) do set[x] = true end
			for i = #commands, 1, -1 do
				for _, x in ipairs(commands[i].features or {}) do
					if set[x] then table.remove(commands, i) break end
				end
			end
		end
		setmetatable(env, {__index = _G})
		setfenv(f, env)
		return f()
	end
	return load(filename, filename:match('^(.*[/\\])'))
end

local function copy(t)
	if type(t) ~= 'table' then return t end
	local r = {}
	for k, v in pairs(t) do r[k] = copy(v) end
	return r
end

local function commandList(commands, hashOf)
	local r = {}
	for _, c in ipairs(commands) do
		table.insert(r, object({hash = hashOf(c), name = c.name, category = c.category, combos = copy(c.combos or {})}))
	end
	return r
end

local function profileFor(inputFolder, deviceName, actions, defaultAssignments)
	local joystick = inputFolder .. '/joystick/'
	local own = joystick .. templateOf(deviceName) .. '.lua'
	local probe = io.open(own)
	if probe then probe:close() end
	local res = loadDeviceProfile(probe and own or joystick .. 'default.lua', deviceName, actions, defaultAssignments)
	return res.keyCommands or {}, res.axisCommands or {}, res.forceFeedback
end

local GUID = ' {00000000-0000-0000-0000-000000000000}'

local function catalog(actionsFile, inputFolder, templates)
	local actions = loadTable(actionsFile)
	local defaultAssignments = loadTable('./Scripts/Input/DefaultAssignments.lua')
	local wanted = {}
	for _, t in ipairs(templates) do wanted[t] = true end
	for t in pairs(defaultAssignments) do
		if t ~= 'default' then wanted[t] = true end
	end
	local name = loadTable(inputFolder .. '/name.lua', {_ = function(s) return s end})
	local out = {name = type(name) == 'string' and name or nil, devices = object({}), presets = object({})}
	local keys, axes, ff = profileFor(inputFolder, 'Generic Device' .. GUID, actions, defaultAssignments)
	out.devices[''] = object({key = commandList(keys, keyHash), axis = commandList(axes, axisHash), forceFeedback = ff})
	out.assignments = object({})
	local _, probed = profileFor(inputFolder, 'Generic Device' .. GUID, actions, PROBE)
	for _, c in ipairs(probed) do
		local key = c.combos and c.combos[1] and c.combos[1].key
		if type(key) == 'string' and key:sub(1, #ASSIGNED) == ASSIGNED then out.assignments[axisHash(c)] = key:sub(#ASSIGNED + 1) end
	end
	local ownMouse = io.open(inputFolder .. '/mouse/default.lua')
	if ownMouse then ownMouse:close() end
	local otherFiles = {
		keyboard = {inputFolder .. '/keyboard/default.lua', 'Keyboard'},
		mouse = {ownMouse and inputFolder .. '/mouse/default.lua' or 'Config/Input/Aircrafts/Default/mouse/default.lua', 'Mouse'},
	}
	for kind, file in pairs(otherFiles) do
		local ok, res = pcall(loadDeviceProfile, file[1], file[2], actions, defaultAssignments)
		res = ok and type(res) == 'table' and res or {}
		out[kind] = object({key = commandList(res.keyCommands or {}, keyHash), axis = commandList(res.axisCommands or {}, axisHash)})
	end
	for t in pairs(wanted) do
		local k, a, f = profileFor(inputFolder, t .. GUID, actions, defaultAssignments)
		out.devices[t] = object({key = commandList(k, keyHash), axis = commandList(a, axisHash), forceFeedback = f})
		local preset = loadTable(inputFolder .. '/joystick/' .. t .. '.diff.lua')
		if preset then
			out.presets[t] = object({keyDiffs = preset.keyDiffs or object({}), axisDiffs = preset.axisDiffs or object({})})
		end
	end
	return out
end

local function applied(actionsFile, inputFolder, templates)
	local actions = loadTable(actionsFile)
	local defaultAssignments = loadTable('./Scripts/Input/DefaultAssignments.lua')
	local out = object({})
	for _, t in ipairs(templates) do
		local preset = loadTable(inputFolder .. '/joystick/' .. t .. '.diff.lua')
		if preset then
			local keys, axes = profileFor(inputFolder, t .. GUID, actions, defaultAssignments)
			local dead = {key = applyDiff(keys, preset.keyDiffs, keyHash), axis = applyDiff(axes, preset.axisDiffs, axisHash)}
			local current = {key = object({}), axis = object({})}
			for _, c in ipairs(keys) do
				if c.combos and #c.combos > 0 then current.key[keyHash(c)] = c.combos end
			end
			for _, c in ipairs(axes) do
				if c.combos and #c.combos > 0 then current.axis[axisHash(c)] = c.combos end
			end
			out[t] = {current = current, updated = dead}
		end
	end
	return out
end

local mode = arg[1]
local rest = {}
for i = 2, #arg do table.insert(rest, arg[i]) end
if mode == 'entries' then
	print(json(entries(rest)))
elseif mode == 'catalog' then
	print(json(catalog(table.remove(rest, 1), table.remove(rest, 1), rest)))
elseif mode == 'applied' then
	print(json(applied(table.remove(rest, 1), table.remove(rest, 1), rest)))
end
