local source = game:HttpGet([==[https://raw.githubusercontent.com/Nebula-Softworks/Starlight-Interface-Suite/1ec0fb9ce4aacd8f396a9bd493e0251a6acf450a/Source.lua?starlight_revision=1ec0fb9c]==])
local patchIndex = 0
local patchWarnings = {}
local function replaceExact(old, new, expected)
    patchIndex += 1
    local cursor = 1
    local count = 0
    while true do
        local position = source:find(old, cursor, true)
        if not position then break end
        count += 1
        cursor = position + #old
    end
    if expected > 0 and count ~= expected then
        table.insert(patchWarnings, string.format("Patch %d: expected %d, found %d", patchIndex, expected, count))
    elseif expected == -1 and count == 0 then
        table.insert(patchWarnings, string.format("Patch %d: anchor missing", patchIndex))
    end
    if count == 0 then return end
    local maxReplacements = expected == -1 and count or math.min(expected, count)
    local pieces = {}
    local from = 1
    for _ = 1, maxReplacements do
        local position = source:find(old, from, true)
        if not position then break end
        table.insert(pieces, source:sub(from, position - 1))
        table.insert(pieces, new)
        from = position + #old
    end
    table.insert(pieces, source:sub(from))
    source = table.concat(pieces)
end
replaceExact([==[local Acrylic = isStudio and require(ReplicatedStorage.AcrylicBundled)
	or loadstring(game:HttpGet("https://raw." .. website .. "/AcrylicModule.luau"))()
Acrylic.Init()]==], [==[local previousBlur = Lighting:FindFirstChild("starlightBlur")
if previousBlur and previousBlur:IsA("DepthOfFieldEffect") then
	previousBlur:Destroy()
end
local cameraBlurFolder = Camera and Camera:FindFirstChild("Starlight Blur Elements")
if cameraBlurFolder and cameraBlurFolder:IsA("Folder") then
	cameraBlurFolder:Destroy()
end
local function AcrylicPaintFlat()
	local frame = Instance.new("Frame")
	frame.Name = "Acrylic"
	frame.Size = UDim2.fromScale(1, 1)
	frame.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	frame.BackgroundTransparency = 0.9
	frame.BorderSizePixel = 0
	frame.ZIndex = 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame
	local shadow = Instance.new("ImageLabel")
	shadow.Name = "shadow"
	shadow.Image = "rbxassetid://8992230677"
	shadow.ScaleType = Enum.ScaleType.Slice
	shadow.SliceCenter = Rect.new(Vector2.new(99, 99), Vector2.new(99, 99))
	shadow.AnchorPoint = Vector2.new(0.5, 0.5)
	shadow.Size = UDim2.new(1, 120, 1, 116)
	shadow.Position = UDim2.fromScale(0.5, 0.5)
	shadow.BackgroundTransparency = 1
	shadow.ImageColor3 = Color3.new(0, 0, 0)
	shadow.ImageTransparency = 0.7
	shadow.Parent = frame
	for _, name in ipairs({ "tint", "Noise" }) do
		local layer = Instance.new("ImageLabel")
		layer.Name = name
		layer.Image = name == "tint" and "rbxassetid://9968344105" or "rbxassetid://9968344227"
		layer.ImageTransparency = name == "tint" and 0.98 or 0.9
		layer.ScaleType = Enum.ScaleType.Tile
		layer.TileSize = UDim2.fromOffset(128, 128)
		layer.Size = UDim2.fromScale(1, 1)
		layer.BackgroundTransparency = 1
		layer.Parent = frame
		local round = Instance.new("UICorner")
		round.CornerRadius = UDim.new(0, 8)
		round.Parent = layer
	end
	local model = { Transparency = 1, Size = Vector3.new(1, 1, 0) }
	return {
		Frame = frame,
		Model = model,
		AddParent = function() end,
		SetVisibility = function() end,
	}
end
local Acrylic = { Init = function() end, AcrylicPaint = AcrylicPaintFlat }
Acrylic.Init()]==], 1)
replaceExact([==[themeEvent.Event:Connect(set)
		set()]==], [==[local themeConnection = themeEvent.Event:Connect(set)
		object.Destroying:Once(function()
			themeConnection:Disconnect()
		end)
		set()]==], 1)
replaceExact([==[		RunService.RenderStepped:Connect(function(dt)
			if not IsHovering then]==], [==[		local tooltipConnection = RunService.RenderStepped:Connect(function(dt)
			if not IsHovering then]==], 1)
replaceExact([==[		end)
	end

	updateTooltipPos()]==], [==[		end)
		HoverInstance.Destroying:Once(function()
			tooltipConnection:Disconnect()
			tooltip:Destroy()
		end)
	end

	updateTooltipPos()]==], 1)
replaceExact([==[		task.spawn(function() end)
		table.insert(
			connections,
			RunService.RenderStepped:Connect(function()
				pcall(setDuration, tick() - creationTime)
			end)
		)]==], [==[		task.spawn(function()
			while newNotification.Parent do
				pcall(setDuration, tick() - creationTime)
				task.wait(1)
			end
		end)]==], 1)
replaceExact([==[			if Element.Values.MaxCharacters < 0 then]==], [==[			if Element.Values.MaxCharacters >= 0 then]==], 1)
replaceExact([==[									== Element.Values.MaxCharacters]==], [==[									>= Element.Values.MaxCharacters]==], 1)
replaceExact([==[					if Action.MaxCharacters < 0 then]==], [==[					if Action.MaxCharacters >= 0 then]==], 1)
replaceExact([==[						if (#ActionInput.PART_Input.Text - 1) == Action.MaxCharacters then]==], [==[						if #ActionInput.PART_Input.Text > Action.MaxCharacters then]==], 1)
replaceExact([==[									(#Element.Instance.PART_Backdrop.PART_Input.Text - 1)]==], [==[									#Element.Instance.PART_Backdrop.PART_Input.Text]==], 1)
replaceExact([==[if Element.Values.Enter then
								local Success, Response = pcall(function()]==], [==[if Element.Values.Enter and Enter then
							local Success, Response = pcall(function()]==], 1)
replaceExact([==[								if
										NestedElement.Values.Required == true
										and NestedElement.Values.CurrentOption ~= {}
									then]==], [==[								if NestedElement.Values.Required and #NestedElement.Values.CurrentOption <= 1 then]==], 1)
replaceExact([==[ConfigMethods.Save(`{fullidx}.NestedElements.{nestedidx}`, nestedobject.Values)]==], [==[ConfigMethods.Save(`{fullidx}.NestedElements.{nestedidx}`, nestedobject.Values, nestedobject.Class)]==], 1)
replaceExact([==[{Starlight.FileSystem.Folder}/{FileSettings.RootFolder}}/{FileSettings.ConfigFolder}/themes]==], [==[{Starlight.FileSystem.Folder}/{FileSettings.RootFolder}/{FileSettings.ConfigFolder}/themes]==], 1)
replaceExact([==[						if not newName.CurrentValue or String.IsEmptyOrNull(newName.CurrentValue) then]==], [==[						if not newName.Values.CurrentValue or String.IsEmptyOrNull(newName.Values.CurrentValue) then]==], 1)
replaceExact([==[newName.CurrentValue]==], [==[newName.Values.CurrentValue]==], -1)
replaceExact([==[themesArray[newName.Values.CurrentValue]]==], [==[table.find(themesArray, newName.Values.CurrentValue)]==], 1)
replaceExact([==[							local success, encoded = pcall(HttpService.JSONEncode, HttpService, Starlight.CurrentTheme)
							if not success then
								return false, "Unable to encode into JSON data"
							end

							writefile(fullPath, encoded)]==], [==[							local success, encoded = ThemeMethods.encodeTheme(Starlight.CurrentTheme)
							if not success then
								error(encoded)
							end

							writefile(fullPath, encoded)]==], 1)
replaceExact([==[							local success, encoded = ThemeMethods.encodeTheme(Starlight.CurrentTheme)
							if not success then
								return false, "Unable to encode into JSON data"
							end]==], [==[							local success, encoded = ThemeMethods.encodeTheme(Starlight.CurrentTheme)
							if not success then
								error(encoded)
							end]==], 1)
replaceExact([==[						if Themes[newThemeToApply] ~= nil then]==], [==[						if not newThemeToApply then
							Starlight:Notification({ Title = "Theme Error", Content = "Select a theme first." })
							return
						end
						if Themes[newThemeToApply] ~= nil then]==], 1)
replaceExact([==[			local success, decoded = pcall(HttpService.JSONDecode, HttpService, content)
			if not success then
				return false, "Unable to decode JSON data."
			end

			Starlight:SetTheme(decoded)]==], [==[			local decoded, err = ThemeMethods.decodeTheme(content)
			if not decoded then
				return false, err
			end

			Starlight:SetTheme(decoded)]==], 1)
replaceExact([==[							"Hollywood Fluent",
						}]==], [==[							"Hollywood Fluent",
							"Catppuccin Mocha",
							"Catppuccin Macchiato",
							"Catppuccin Frappe",
							"Catppuccin Latte",
						}]==], 2)
replaceExact([==[		function TabSection:Set(NewName)
			Name = NewName
			TabSection.Instance.Header.Text = Name]==], [==[		function TabSection:Set(NewName)
			Starlight.Window.TabSections[Name] = nil
			Name = NewName
			TabSection.Name = Name
			TabSection.Instance.Header.Text = Name]==], 1)
replaceExact([==[							connections[ParentIndex .. "_" .. Index] = UserInputService.InputBegan:Connect(]==], [==[							local connectionKey = table.concat({ tostring(Name), tostring(TabIndex), tostring(GroupIndex), tostring(ParentIndex), tostring(NestedIndex) }, "_")
							connections[connectionKey] = UserInputService.InputBegan:Connect(]==], 1)
replaceExact([==[connections[ParentIndex .. "_" .. Index]]==], [==[connections[connectionKey]]==], -1)
replaceExact([==[								NestedElement.Instances[1]:Destroy()
								NestedElement.Instances[2]:Destroy()
								Parent.Instance.Size = UDim2.fromOffset(0, Parent.Instance.Size.Y.Offset - additionSize)]==], [==[								NestedElement.Instances[1]:Destroy()
								NestedElement.Instances[2]:Destroy()
								for _, connection in ipairs(localConnections) do
									connection:Disconnect()
								end
								Parent.Instance.Size = UDim2.fromOffset(0, Parent.Instance.Size.Y.Offset - additionSize)]==], 1)
replaceExact([==[								end)
								local c
								c = Players.ChildRemoved:Connect(function()]==], [==[								end)
								table.insert(localConnections, c)
								local c
								c = Players.ChildRemoved:Connect(function()]==], 1)
replaceExact([==[								end)
							end
							if NestedElement.Values.Special == 2 then]==], [==[								end)
								table.insert(localConnections, c)
							end
							if NestedElement.Values.Special == 2 then]==], 1)
replaceExact([==[								end)
								local c
								c = Teams.ChildRemoved:Connect(function()]==], [==[								end)
								table.insert(localConnections, c)
								local c
								c = Teams.ChildRemoved:Connect(function()]==], 1)
replaceExact([==[								end)
							end

							ThemeMethods.bindTheme(]==], [==[								end)
								table.insert(localConnections, c)
							end

							ThemeMethods.bindTheme(]==], 1)
replaceExact([==[								UserInputService.InputEnded:Connect(function(input, processed)]==], [==[								local inputEndedConnection = UserInputService.InputEnded:Connect(function(input, processed)]==], 1)
replaceExact([==[								ThemeMethods.bindTheme(ElementInstance.PART_Backdrop.Accent, "Color", "Accents.Main")]==], [==[								ElementInstance.Destroying:Once(function()
									inputEndedConnection:Disconnect()
								end)
								ThemeMethods.bindTheme(ElementInstance.PART_Backdrop.Accent, "Color", "Accents.Main")]==], 1)
replaceExact([==[					ElementSettings.Increment = ElementSettings.Increment or 1]==], [==[					ElementSettings.Increment = tonumber(ElementSettings.Increment) or 1
					if ElementSettings.Increment <= 0 then
						ElementSettings.Increment = 1
					end]==], 1)
replaceExact([==[								Element.Values.CurrentValue = Value

								Tween(]==], [==[								Value = math.clamp(Value, Element.Values.Range[1], Element.Values.Range[2])
								Element.Values.CurrentValue = Value

								Tween(]==], 1)
replaceExact([==[											/ (Element.Values.Range[2] - Element.Values.Range[1]),]==], [==[											/ math.max(Element.Values.Range[2] - Element.Values.Range[1], 0.000001),]==], 1)
replaceExact([==[									Location = Mouse.X]==], [==[									Location = (CurrentDragInput and CurrentDragInput.UserInputType == Enum.UserInputType.Touch) and CurrentDragInput.Position.X or Mouse.X]==], 1)
replaceExact([==[						local dragFunction = function(X)]==], [==[						local dragFunction = function(X, CurrentDragInput)]==], 1)
replaceExact([==[						Element.Instance.PART_Backdrop.Interact.MouseButton1Down:Connect(function(X)]==], [==[						for _, part in ipairs({ Element.Instance.PART_Backdrop.Interact, Element.Instance.PART_Backdrop.PART_Progress.Knob.Interact }) do
							part.InputBegan:Connect(function(input)
								if input.UserInputType == Enum.UserInputType.Touch then
									dragFunction(input.Position.X, input)
								end
							end)
						end
						Element.Instance.PART_Backdrop.Interact.MouseButton1Down:Connect(function(X)]==], 1)
replaceExact([==[	local success, decoded = pcall(HttpService.JSONDecode, HttpService, readfile(fullPath))
	if not success then
		return false, "Unable to decode JSON data."
	end

	for _, object in next, decoded.objects do
		task.spawn(function()
			ConfigMethods.Load(object.idx, object.data)
		end)
	end

	return true]==], [==[	local loaded, decoded = pcall(function()
		return HttpService:JSONDecode(readfile(fullPath))
	end)
	if not loaded or type(decoded) ~= "table" or type(decoded.objects) ~= "table" then
		return false, "Unable to decode configuration data."
	end

	for _, object in ipairs(decoded.objects) do
		if type(object) ~= "table" or type(object.idx) ~= "string" or type(object.data) ~= "table" then
			return false, "Invalid configuration entry."
		end
		local success, err = pcall(ConfigMethods.Load, object.idx, object.data)
		if not success then
			return false, tostring(err)
		end
	end

	return true]==], 1)
replaceExact([==[		if GetNestedValue(Starlight.Window.TabSections, Idx) then
			if GetNestedValue(Starlight.Window.TabSections, Idx) then
				for key, value in pairs(Data) do
					if table.find(ClassInterfacer[GetNestedValue(Starlight.Window.TabSections, Idx).Class], key) then
						GetNestedValue(Starlight.Window.TabSections, Idx):Set({ [key] = value })
					end
				end
			end
		end]==], [==[		local target = GetNestedValue(Starlight.Window.TabSections, Idx)
		if not target or not target.Class then
			return false, "Configuration target missing: " .. Idx
		end
		local allowed = ClassInterfacer[target.Class]
		if not allowed then
			return false, "Unsupported configuration element: " .. tostring(target.Class)
		end
		for key, value in pairs(Data) do
			if table.find(allowed, key) then
				if target.Class == "ColorPicker" and key == "CurrentValue" and type(value) == "table" then
					value = Color.Pack(value)
				end
				target:Set({ [key] = value })
			end
		end
		return true]==], 1)
replaceExact([==[		local success, err = pcall(ConfigMethods.Load, object.idx, object.data)
		if not success then
			return false, tostring(err)
		end]==], [==[		local success, result, err = pcall(ConfigMethods.Load, object.idx, object.data)
		if not success or result == false then
			return false, tostring(err or result)
		end]==], 1)
replaceExact([==[	writefile(fullPath, encoded)
	return true]==], [==[	local wrote, err = pcall(writefile, fullPath, encoded)
	if not wrote then
		return false, tostring(err)
	end
	return true]==], 1)
replaceExact([==[	Starlight.CurrentTheme = deepCopy(themeToCopy)
	themeEvent:Fire()]==], [==[	if type(themeToCopy) ~= "table" or type(themeToCopy.Backgrounds) ~= "table" or type(themeToCopy.Foregrounds) ~= "table" or type(themeToCopy.Accents) ~= "table" then
		return false, "Invalid theme."
	end
	Starlight.CurrentTheme = deepCopy(themeToCopy)
	themeEvent:Fire()
	return true]==], 1)
replaceExact([==[			if Action.Enter then]==], [==[			if Action.Enter and Enter then]==], 1)
replaceExact([==[				Action.Enter = Action.Enter or true]==], [==[				if Action.Enter == nil then
					Action.Enter = true
				end]==], 1)
replaceExact([==[							if isStudio or not isfile then
								return "File System unavailable."
							end]==], [==[							if isStudio or not isfile or not writefile then
								error("File System unavailable.")
							end]==], 2)
replaceExact([==[		checkFriends()
		Start = TimeFunction()]==], [==[		pcall(checkFriends)
		Start = TimeFunction()]==], 1)
replaceExact([==[			setclipboard(tostring("https://discord.gg/" .. TabSettings.DiscordInvite))]==], [==[			if type(setclipboard) == "function" then
				setclipboard(tostring("https://discord.gg/" .. TabSettings.DiscordInvite))
			end]==], 1)
replaceExact([==[			setclipboard(`game:GetService("TeleportService"):TeleportToPlaceInstance({game.PlaceId}, "{game.JobId}", game:GetService("Players").LocalPlayer)`)]==], [==[			if type(setclipboard) == "function" then
				setclipboard(`game:GetService("TeleportService"):TeleportToPlaceInstance({game.PlaceId}, "{game.JobId}", game:GetService("Players").LocalPlayer)`)
			end]==], 1)
replaceExact([==[Save = function(Idx, Data, Type)
		if Type == "ColorPicker" then
			local appendedData = {}
			for i, v in pairs(Data) do
				if i == "CurrentValue" then
					appendedData[i] = Color.Unpack(v)
				else
					appendedData[i] = v
				end
			end
			return {
				type = Type,
				idx = Idx,
				data = appendedData,
			}
		else
			return {
				type = Type,
				idx = Idx,
				data = Data,
			}
		end
	end,]==], [==[Save = function(Idx, Data, Type)
		local saved = {}
		for _, key in ipairs(ClassInterfacer[Type] or {}) do
			local value = Data[key]
			if value ~= nil then
				if Type == "ColorPicker" and key == "CurrentValue" and typeof(value) == "Color3" then
					value = Color.Unpack(value)
				end
				saved[key] = value
			end
		end
		return { type = Type, idx = Idx, data = saved }
	end,]==], 1)
replaceExact([==[		if TabSettings.Changelog[1] then
			Tab.Instances.Page.Holder.Center.Changelog.latest.Visible = true
			Tab.Instances.Page.Holder.Center.Changelog.latest.Header.Text = TabSettings.Changelog[1].Title
			Tab.Instances.Page.Holder.Center.Changelog.latest.date.Text = TabSettings.Changelog[1].Date
			Tab.Instances.Page.Holder.Center.Changelog.latest.desc.Text = TabSettings.Changelog[1].Description
		end
]==], [==[
		local changelogPanel = Tab.Instances.Page.Holder.Center.Changelog
		local latestEntry = TabSettings.Changelog[1]
		if latestEntry then
			changelogPanel.latest.Visible = true
			changelogPanel.latest.Header.Text = tostring(latestEntry.Version or "Update 1") .. " - " .. tostring(latestEntry.Title or "Latest Update")
			changelogPanel.latest.date.Text = tostring(latestEntry.Date or "")
			changelogPanel.latest.desc.Text = tostring(latestEntry.Description or "")
		else
			changelogPanel.latest.Visible = false
		end
		local function openChangelogHistory()
			if Starlight.Window.ActiveChangelogOverlay then
				Starlight.Window.ActiveChangelogOverlay:Destroy()
				Starlight.Window.ActiveChangelogOverlay = nil
			end
			local overlay = Instance.new("TextButton")
			overlay.Name = "StarlightChangelogOverlay"
			overlay.Text = ""
			overlay.AutoButtonColor = false
			overlay.Modal = true
			overlay.BackgroundColor3 = Color3.new(0, 0, 0)
			overlay.BackgroundTransparency = 0.35
			overlay.BorderSizePixel = 0
			overlay.Size = UDim2.fromScale(1, 1)
			overlay.ZIndex = 600
			overlay.Parent = mainWindow
			Starlight.Window.ActiveChangelogOverlay = overlay
			local dialog = Instance.new("Frame")
			dialog.Name = "History"
			dialog.Size = UDim2.fromScale(0.75, 0.77)
			dialog.AnchorPoint = Vector2.new(0.5, 0.5)
			dialog.Position = UDim2.fromScale(0.5, 0.5)
			dialog.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Medium
			dialog.BorderSizePixel = 0
			dialog.ZIndex = 601
			dialog.Parent = overlay
			local popupScale = Instance.new("UIScale")
			popupScale.Scale = 0.93
			popupScale.Parent = dialog
			overlay.BackgroundTransparency = 1
			TweenService:Create(overlay, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundTransparency = 0.35 }):Play()
			TweenService:Create(popupScale, TweenInfo.new(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
			local constraint = Instance.new("UISizeConstraint")
			constraint.MinSize = Vector2.new(260, 200)
			constraint.MaxSize = Vector2.new(820, 720)
			constraint.Parent = dialog
			local corner = Instance.new("UICorner")
			corner.CornerRadius = UDim.new(0, 10)
			corner.Parent = dialog
			local stroke = Instance.new("UIStroke")
			stroke.Color = Starlight.CurrentTheme.Foregrounds.Dark
			stroke.Parent = dialog
			local header = Instance.new("TextLabel")
			header.Name = "Title"
			header.BackgroundTransparency = 1
			header.Position = UDim2.fromOffset(18, 12)
			header.Size = UDim2.new(1, -70, 0, 32)
			header.Font = Enum.Font.GothamBold
			header.TextSize = 19
			header.TextXAlignment = Enum.TextXAlignment.Left
			header.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			header.Text = "Complete Changelog"
			header.ZIndex = 602
			header.Parent = dialog
			local versionCount = Instance.new("TextLabel")
			versionCount.BackgroundTransparency = 1
			versionCount.Position = UDim2.fromOffset(18, 44)
			versionCount.Size = UDim2.new(1, -34, 0, 20)
			versionCount.Font = Enum.Font.Gotham
			versionCount.TextSize = 12
			versionCount.TextXAlignment = Enum.TextXAlignment.Left
			versionCount.TextColor3 = Starlight.CurrentTheme.Foregrounds.Medium
			versionCount.Text = tostring(#TabSettings.Changelog) .. " update(s)"
			versionCount.ZIndex = 602
			versionCount.Parent = dialog
			local closeButton = Instance.new("TextButton")
			closeButton.Name = "Close"
			closeButton.BackgroundTransparency = 1
			closeButton.Text = "×"
			closeButton.Font = Enum.Font.GothamBold
			closeButton.TextSize = 28
			closeButton.Size = UDim2.fromOffset(40, 40)
			closeButton.Position = UDim2.new(1, -46, 0, 8)
			closeButton.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			closeButton.ZIndex = 603
			closeButton.Parent = dialog
			local scroll = Instance.new("ScrollingFrame")
			scroll.Name = "Entries"
			scroll.Position = UDim2.fromOffset(12, 75)
			scroll.Size = UDim2.new(1, -24, 1, -87)
			scroll.BackgroundTransparency = 1
			scroll.BorderSizePixel = 0
			scroll.ScrollBarThickness = 4
			scroll.ScrollBarImageColor3 = Starlight.CurrentTheme.Foregrounds.Medium
			scroll.ScrollingDirection = Enum.ScrollingDirection.Y
			scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
			scroll.CanvasSize = UDim2.fromOffset(0, 0)
			scroll.ZIndex = 602
			scroll.Parent = dialog
			local listLayout = Instance.new("UIListLayout")
			listLayout.SortOrder = Enum.SortOrder.LayoutOrder
			listLayout.Padding = UDim.new(0, 10)
			listLayout.Parent = scroll
			local padding = Instance.new("UIPadding")
			padding.PaddingTop = UDim.new(0, 4)
			padding.PaddingBottom = UDim.new(0, 8)
			padding.PaddingLeft = UDim.new(0, 4)
			padding.PaddingRight = UDim.new(0, 10)
			padding.Parent = scroll
			for index, entry in ipairs(TabSettings.Changelog) do
				local item = Instance.new("Frame")
				item.Name = "Update" .. tostring(index)
				item.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Light
				item.BackgroundTransparency = 0.08
				item.BorderSizePixel = 0
				item.Size = UDim2.new(1, -4, 0, 0)
				item.AutomaticSize = Enum.AutomaticSize.Y
				item.LayoutOrder = index
				item.ZIndex = 603
				item.Parent = scroll
				local itemCorner = Instance.new("UICorner")
				itemCorner.CornerRadius = UDim.new(0, 7)
				itemCorner.Parent = item
				local itemPadding = Instance.new("UIPadding")
				itemPadding.PaddingTop = UDim.new(0, 12)
				itemPadding.PaddingBottom = UDim.new(0, 12)
				itemPadding.PaddingLeft = UDim.new(0, 12)
				itemPadding.PaddingRight = UDim.new(0, 12)
				itemPadding.Parent = item
				local itemLayout = Instance.new("UIListLayout")
				itemLayout.Padding = UDim.new(0, 6)
				itemLayout.SortOrder = Enum.SortOrder.LayoutOrder
				itemLayout.Parent = item
				local titleText = Instance.new("TextLabel")
				titleText.Name = "Version"
				titleText.LayoutOrder = 1
				titleText.BackgroundTransparency = 1
				titleText.Size = UDim2.new(1, 0, 0, 23)
				titleText.Font = Enum.Font.GothamBold
				titleText.TextSize = 16
			titleText.TextXAlignment = Enum.TextXAlignment.Left
			titleText.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			titleText.Text = tostring(entry.Version or ("Update " .. index))
			titleText.ZIndex = 604
			titleText.Parent = item
				if entry.Title and entry.Version ~= entry.Title then
					local subtitle = Instance.new("TextLabel")
					subtitle.Name = "UpdateName"
					subtitle.LayoutOrder = 2
					subtitle.BackgroundTransparency = 1
					subtitle.Size = UDim2.new(1, 0, 0, 19)
					subtitle.Font = Enum.Font.GothamMedium
					subtitle.TextSize = 13
					subtitle.TextXAlignment = Enum.TextXAlignment.Left
					subtitle.TextColor3 = Starlight.CurrentTheme.Foregrounds.Medium
					subtitle.Text = tostring(entry.Title)
					subtitle.ZIndex = 604
					subtitle.Parent = item
				end
				local dateText = Instance.new("TextLabel")
				dateText.Name = "Date"
				dateText.LayoutOrder = 3
				dateText.BackgroundTransparency = 1
				dateText.Size = UDim2.new(1, 0, 0, 16)
				dateText.Font = Enum.Font.Gotham
				dateText.TextSize = 12
				dateText.TextXAlignment = Enum.TextXAlignment.Left
				dateText.TextColor3 = Starlight.CurrentTheme.Foregrounds.Medium
				dateText.Text = tostring(entry.Date or "")
				dateText.ZIndex = 604
				dateText.Parent = item
				local bodyText = Instance.new("TextLabel")
				bodyText.Name = "Description"
				bodyText.LayoutOrder = 4
				bodyText.BackgroundTransparency = 1
				bodyText.Size = UDim2.new(1, 0, 0, 0)
				bodyText.AutomaticSize = Enum.AutomaticSize.Y
				bodyText.TextWrapped = true
				bodyText.TextXAlignment = Enum.TextXAlignment.Left
				bodyText.TextYAlignment = Enum.TextYAlignment.Top
				bodyText.Font = Enum.Font.Gotham
				bodyText.TextSize = 13
				bodyText.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
				bodyText.Text = tostring(entry.Description or "")
				bodyText.ZIndex = 604
				bodyText.Parent = item
			end
			if #TabSettings.Changelog == 0 then
				local empty = Instance.new("TextLabel")
				empty.Size = UDim2.new(1, -12, 0, 40)
				empty.BackgroundTransparency = 1
				empty.Text = "No changelog entries have been provided."
				empty.TextColor3 = Starlight.CurrentTheme.Foregrounds.Medium
				empty.Font = Enum.Font.Gotham
				empty.TextSize = 13
				empty.ZIndex = 604
				empty.Parent = scroll
			end
			local closed = false
			local escapeConnection
			local function closeHistory()
				if closed then return end
				closed = true
				if escapeConnection then escapeConnection:Disconnect() end
				if Starlight.Window and Starlight.Window.ActiveChangelogOverlay == overlay then
					Starlight.Window.ActiveChangelogOverlay = nil
				end
				overlay:Destroy()
			end
			overlay.MouseButton1Click:Connect(closeHistory)
			closeButton.MouseButton1Click:Connect(closeHistory)
			escapeConnection = UserInputService.InputBegan:Connect(function(input, processed)
				if not processed and input.KeyCode == Enum.KeyCode.Escape then
					closeHistory()
				end
			end)
			overlay.Destroying:Once(function()
				if escapeConnection then escapeConnection:Disconnect() end
			end)
		end
		if changelogPanel:FindFirstChild("Interact") then
			changelogPanel.Interact.MouseButton1Click:Connect(openChangelogHistory)
		end
]==], 1)
replaceExact([==[if not getgenv().SecureMode then
	InputManager = GetService("VirtualInputManager")
end]==], [==[if not (type(getgenv) == "function" and getgenv().SecureMode) then
	local managerOk, manager = pcall(GetService, "VirtualInputManager")
	if managerOk then
		InputManager = manager
	end
end]==], 1)
replaceExact([==[		local newNotification = Resources.Elements.NotificationTemplate:Clone()
		newNotification.Name = data.Title]==], [==[		local newNotification = Resources.Elements.NotificationTemplate:Clone()
		newNotification.Name = tostring(data.Title or "Notification")]==], 1)
replaceExact([==[		notificationAcrylicEvent.Event:Connect(function()
			if newNotification.BackgroundTransparency == 1 then]==], [==[		local notificationAcrylicConnection = notificationAcrylicEvent.Event:Connect(function()
			if newNotification.BackgroundTransparency == 1 then]==], 1)
replaceExact([==[		end)

		-- Set Data]==], [==[		end)
		newNotification.Destroying:Once(function()
			notificationAcrylicConnection:Disconnect()
		end)

		-- Set Data]==], 1)
replaceExact([==[				CollectionService:AddTag(newNotification, "__starlight_ExpiredNotification")]==], [==[				CollectionService:AddTag(newNotification, "__starlight_ExpiredNotification")
				local history = CollectionService:GetTagged("__starlight_ExpiredNotification")
				if #history > 75 then
					table.sort(history, function(a, b)
						return (a:GetAttribute("StarlightCreated") or 0) < (b:GetAttribute("StarlightCreated") or 0)
					end)
					for index = 1, #history - 75 do
						history[index]:Destroy()
					end
				end]==], 1)
replaceExact([==[		newNotification.LayoutOrder = #StarlightUI.Notifications:GetChildren()
		newNotification.Visible = false]==], [==[		newNotification.LayoutOrder = #StarlightUI.Notifications:GetChildren()
		newNotification:SetAttribute("StarlightCreated", os.clock())
		newNotification.Visible = false]==], 1)
replaceExact([==[							local hover = false
							local sliders = {}]==], [==[							local hover = false
							local sliders = {}
							local popupInputConnection]==], 1)
replaceExact([==[							local hover = false
							local height = 175]==], [==[							local hover = false
							local height = 175
							local popupInputConnection]==], 1)
replaceExact([==[							acrylicEvent.Event:Connect(function()
								if mainAcrylic then]==], [==[							local popupAcrylicConnection = acrylicEvent.Event:Connect(function()
								if mainAcrylic then]==], 2)
replaceExact([==[							AcrylicObject.AddParent(NestedElement.Instances[2])
							AcrylicObject.Frame.Parent = NestedElement.Instances[2]]==], [==[							AcrylicObject.AddParent(NestedElement.Instances[2])
							AcrylicObject.Frame.Parent = NestedElement.Instances[2]
							NestedElement.Instances[2].Destroying:Once(function()
								popupAcrylicConnection:Disconnect()
								if popupInputConnection then
									popupInputConnection:Disconnect()
									popupInputConnection = nil
								end
							end)]==], 2)
replaceExact([==[							local function close()
]==], [==[							local function close()
								if popupInputConnection then
									popupInputConnection:Disconnect()
									popupInputConnection = nil
								end
]==], 2)
replaceExact([==[									local connection
									connection = UserInputService.InputBegan:Connect(function(i)]==], [==[									if popupInputConnection then
										popupInputConnection:Disconnect()
									end
									popupInputConnection = UserInputService.InputBegan:Connect(function(i)]==], 2)
replaceExact([==[											close()
											connection:Disconnect()]==], [==[											close()]==], 2)
replaceExact([==[				instance:CreateToggle({
					Name = "Acrylic",
					CurrentValue = false,
					Tooltip = "Enables The Glass And Acrylic Style for the main UI",
					Icon = 6031371068,
					Callback = function(v)
						mainAcrylic = v
						acrylicEvent:Fire()
					end,
				}, "mainacrylic")
				instance:CreateToggle({
					Name = "Notification Acrylic",
					CurrentValue = true,
					Tooltip = "Enables The Glass And Acrylic Style for notifications",
					Icon = 6031488930,
					Callback = function(v)
						notificationAcrylic = v
						notificationAcrylicEvent:Fire()
					end,
				}, "notitficationacrylic")]==], [==[]==], 1)
replaceExact([==[		Tab.Instances.Page.Thumbnail.ImageLabel.Image =
			Players:GetUserThumbnailAsync(Player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100)]==], [==[		pcall(function()
			Tab.Instances.Page.Thumbnail.ImageLabel.Image =
				Players:GetUserThumbnailAsync(Player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100)
		end)]==], 1)
replaceExact([==[		Tab.Instances.Page.Holder.Left.Server.Subheader.Text = "Currently Playing "
			.. MarketplaceService:GetProductInfo(game.PlaceId).Name
		Tab.Instances.Page.Holder.Left.Server.Frame.serverregion.Text = '<font size="14" color="#FFF" weight="semibold">Region</font>\n'
			.. Localization:GetCountryRegionForPlayerAsync(Player)]==], [==[		local placeName = "Unknown experience"
		local regionName = "Unknown"
		pcall(function()
			placeName = MarketplaceService:GetProductInfo(game.PlaceId).Name
		end)
		pcall(function()
			regionName = Localization:GetCountryRegionForPlayerAsync(Player)
		end)
		Tab.Instances.Page.Holder.Left.Server.Subheader.Text = "Currently Playing " .. tostring(placeName)
		Tab.Instances.Page.Holder.Left.Server.Frame.serverregion.Text = '<font size="14" color="#FFF" weight="semibold">Region</font>\n' .. tostring(regionName)]==], 1)
replaceExact([==[		mainWindow.Sidebar.Player.PlayerIcon.Image =
			Players:GetUserThumbnailAsync(Player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size48x48)]==], [==[		pcall(function()
			mainWindow.Sidebar.Player.PlayerIcon.Image =
				Players:GetUserThumbnailAsync(Player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size48x48)
		end)]==], 1)
replaceExact([==[
			Tab.Instances.Button.Interact["MouseButton1Click"]:Connect(Activate)]==], [==[
			Tab.Instances.Button.Interact["MouseButton1Click"]:Connect(Activate)
			Tab.Select = Activate]==], 2)
replaceExact([==[
		Tab.Instances.Button.Interact["MouseButton1Click"]:Connect(Activate)]==], [==[
		Tab.Instances.Button.Interact["MouseButton1Click"]:Connect(Activate)
		Tab.Select = Activate]==], 1)
replaceExact([==[		mainWindow.Content.Topbar.Search["MouseLeave"]:Connect(function()
			Tween(mainWindow.Content.Topbar.Search, { ImageColor3 = Starlight.CurrentTheme.Foregrounds.Dark })
		end)]==], [==[		mainWindow.Content.Topbar.Search["MouseLeave"]:Connect(function()
			Tween(mainWindow.Content.Topbar.Search, { ImageColor3 = Starlight.CurrentTheme.Foregrounds.Dark })
		end)

		local searchIcon = mainWindow.Content.Topbar.Search
		local searchTrigger = Instance.new("TextButton")
		searchTrigger.Name = "FeatureSearchButton"
		searchTrigger.Size = UDim2.fromScale(1, 1)
		searchTrigger.BackgroundTransparency = 1
		searchTrigger.Text = ""
		searchTrigger.ZIndex = searchIcon.ZIndex + 1
		searchTrigger.Parent = searchIcon
		local searchOverlay = nil
		local searchKeyConnection = nil
		local function closeFeatureSearch()
			if searchKeyConnection then
				searchKeyConnection:Disconnect()
				searchKeyConnection = nil
			end
			if searchOverlay then
				local old = searchOverlay
				searchOverlay = nil
				old:Destroy()
			end
		end
		local function makeSearchLabel(parent, text, y, height, size, color)
			local label = Instance.new("TextLabel")
			label.Size = UDim2.new(1, -34, 0, height)
			label.Position = UDim2.fromOffset(17, y)
			label.Text = text
			label.BackgroundTransparency = 1
			label.TextColor3 = color
			label.TextSize = size
			label.Font = Enum.Font.GothamSemibold
			label.TextXAlignment = Enum.TextXAlignment.Left
			label.ZIndex = 704
			label.Parent = parent
			return label
		end
		local function openFeatureSearch()
			if searchOverlay then
				closeFeatureSearch()
				return
			end
			local overlay = Instance.new("TextButton")
			overlay.Name = "StarlightFeatureSearch"
			overlay.BackgroundColor3 = Color3.new(0, 0, 0)
			overlay.BackgroundTransparency = 0.28
			overlay.BorderSizePixel = 0
			overlay.Size = UDim2.fromScale(1, 1)
			overlay.Text = ""
			overlay.Modal = true
			overlay.ZIndex = 700
			overlay.Parent = mainWindow
			searchOverlay = overlay
			local panel = Instance.new("Frame")
			panel.Name = "FeatureSearchPanel"
			panel.AnchorPoint = Vector2.new(0.5, 0.5)
			panel.Position = UDim2.fromScale(0.5, 0.5)
			panel.Size = UDim2.fromScale(0.84, 0.82)
			panel.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Medium
			panel.BorderSizePixel = 0
			panel.ZIndex = 701
			panel.Parent = overlay
			local limit = Instance.new("UISizeConstraint")
			limit.MinSize = Vector2.new(230, 190)
			limit.MaxSize = Vector2.new(760, 640)
			limit.Parent = panel
			local round = Instance.new("UICorner")
			round.CornerRadius = UDim.new(0, 10)
			round.Parent = panel
			local outline = Instance.new("UIStroke")
			outline.Color = Starlight.CurrentTheme.Foregrounds.Dark
			outline.Parent = panel
			makeSearchLabel(panel, "Search Features", 11, 30, 18, Starlight.CurrentTheme.Foregrounds.Light)
			local exit = Instance.new("TextButton")
			exit.Name = "Close"
			exit.Size = UDim2.fromOffset(35, 35)
			exit.Position = UDim2.new(1, -41, 0, 6)
			exit.Text = "×"
			exit.Font = Enum.Font.GothamBold
			exit.TextSize = 25
			exit.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			exit.BackgroundTransparency = 1
			exit.ZIndex = 705
			exit.Parent = panel
			local field = Instance.new("TextBox")
			field.Name = "SearchInput"
			field.Position = UDim2.fromOffset(14, 49)
			field.Size = UDim2.new(1, -28, 0, 39)
			field.Text = ""
			field.PlaceholderText = "Search a tab, feature, or setting..."
			field.ClearTextOnFocus = false
			field.Font = Enum.Font.Gotham
			field.TextSize = 14
			field.TextXAlignment = Enum.TextXAlignment.Left
			field.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			field.PlaceholderColor3 = Starlight.CurrentTheme.Foregrounds.Medium
			field.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Dark
			field.ZIndex = 703
			field.Parent = panel
			local fieldCorner = Instance.new("UICorner")
			fieldCorner.CornerRadius = UDim.new(0, 7)
			fieldCorner.Parent = field
			local fieldPadding = Instance.new("UIPadding")
			fieldPadding.PaddingLeft = UDim.new(0, 12)
			fieldPadding.PaddingRight = UDim.new(0, 10)
			fieldPadding.Parent = field
			local summary = makeSearchLabel(panel, "Type to find features", 96, 22, 12, Starlight.CurrentTheme.Foregrounds.Medium)
			local results = Instance.new("ScrollingFrame")
			results.Name = "Results"
			results.Position = UDim2.fromOffset(13, 123)
			results.Size = UDim2.new(1, -26, 1, -135)
			results.BackgroundTransparency = 1
			results.BorderSizePixel = 0
			results.ScrollBarThickness = 4
			results.ScrollingDirection = Enum.ScrollingDirection.Y
			results.CanvasSize = UDim2.fromOffset(0, 0)
			results.AutomaticCanvasSize = Enum.AutomaticSize.Y
			results.ZIndex = 703
			results.Parent = panel
			local layout = Instance.new("UIListLayout")
			layout.Padding = UDim.new(0, 6)
			layout.SortOrder = Enum.SortOrder.LayoutOrder
			layout.Parent = results
			local pad = Instance.new("UIPadding")
			pad.PaddingTop = UDim.new(0, 5)
			pad.PaddingBottom = UDim.new(0, 8)
			pad.PaddingRight = UDim.new(0, 6)
			pad.Parent = results
			local function addSearchResult(entry, index)
				local result = Instance.new("TextButton")
				result.Name = "Result" .. tostring(index)
				result.LayoutOrder = index
				result.Size = UDim2.new(1, -7, 0, 54)
				result.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Light
				result.BackgroundTransparency = 0.1
				result.Text = ""
				result.ZIndex = 704
				result.Parent = results
				local resultCorner = Instance.new("UICorner")
				resultCorner.CornerRadius = UDim.new(0, 7)
				resultCorner.Parent = result
				local heading = makeSearchLabel(result, entry.title, 6, 24, 14, Starlight.CurrentTheme.Foregrounds.Light)
				heading.Size = UDim2.new(1, -18, 0, 24)
				heading.Position = UDim2.fromOffset(10, 5)
				heading.TextTruncate = Enum.TextTruncate.AtEnd
				local path = makeSearchLabel(result, entry.path, 29, 18, 11, Starlight.CurrentTheme.Foregrounds.Medium)
				path.Size = UDim2.new(1, -18, 0, 18)
				path.Position = UDim2.fromOffset(10, 29)
				path.TextTruncate = Enum.TextTruncate.AtEnd
				result.MouseButton1Click:Connect(function()
					local targetTab = entry.tab
					if not targetTab or not targetTab.Instances or not targetTab.Instances.Page then
						return
					end
					closeFeatureSearch()
					if type(targetTab.Select) == "function" then
						pcall(targetTab.Select)
					end
					task.defer(function()
						local target = entry.element and (entry.element.Instance or (entry.element.Instances and entry.element.Instances[1]))
						if typeof(target) ~= "Instance" then
							target = entry.group and entry.group.Instance
						end
						if typeof(target) ~= "Instance" or not target:IsA("GuiObject") then return end
						local ancestor = target.Parent
						while ancestor and not ancestor:IsA("ScrollingFrame") do
							ancestor = ancestor.Parent
						end
						if ancestor then
							ancestor.CanvasPosition = Vector2.new(ancestor.CanvasPosition.X, math.max(0, ancestor.CanvasPosition.Y + target.AbsolutePosition.Y - ancestor.AbsolutePosition.Y - 18))
						end
						local highlight = Instance.new("UIStroke")
						highlight.Name = "SearchResultHighlight"
						highlight.Color = Starlight.CurrentTheme.Accents.Main
						highlight.Thickness = 2
						highlight.Parent = target
						task.delay(1.5, function()
							if highlight.Parent then highlight:Destroy() end
						end)
					end)
				end)
			end
			local function addRecord(matches, title, path, tab, group, element, hints)
				local searchable = (tostring(title) .. " " .. tostring(path) .. " " .. tostring(hints or "")):lower()
				for word in field.Text:lower():gmatch("%S+") do
					if not searchable:find(word, 1, true) then return end
				end
				table.insert(matches, { title = tostring(title), path = tostring(path), tab = tab, group = group, element = element })
			end
			local function updateResults()
				if not results.Parent then return end
				for _, child in ipairs(results:GetChildren()) do
					if child:IsA("GuiObject") then child:Destroy() end
				end
				results.CanvasPosition = Vector2.zero
				local matches = {}
				if Starlight.Window and Starlight.Window.TabSections then
					for sectionName, section in pairs(Starlight.Window.TabSections) do
						if type(section) == "table" and type(section.Tabs) == "table" then
							for _, tab in pairs(section.Tabs) do
								if type(tab) == "table" and tab.Instances and tab.Instances.Page and tab.Instances.Page.Parent then
									local tabName = tostring(tab.Values and tab.Values.Name or tab.Index or "Tab")
									local sectionPath = tostring(section.Name or sectionName or "")
									addRecord(matches, tabName, sectionPath, tab, nil, nil, tab.Index)
									for groupKey, group in pairs(tab.Groupboxes or {}) do
										if type(group) == "table" then
											local groupName = tostring(group.Values and group.Values.Name or groupKey)
											local groupPath = sectionPath .. "  /  " .. tabName
											addRecord(matches, groupName, groupPath, tab, group, nil, groupKey)
											for elementKey, element in pairs(group.Elements or {}) do
												if type(element) == "table" and type(element.Values) == "table" then
												local itemName = tostring(element.Values.Name or elementKey)
												local itemPath = groupPath .. "  /  " .. groupName
												addRecord(matches, itemName, itemPath, tab, group, element, tostring(elementKey) .. " " .. tostring(element.Values.Tooltip or "") .. " " .. tostring(element.Class or ""))
												for nestedKey, nested in pairs(element.NestedElements or {}) do
													if type(nested) == "table" then
														local nestedName = tostring(nested.Values and nested.Values.Name or nested.Class or nestedKey)
														addRecord(matches, nestedName, itemPath .. "  /  " .. itemName, tab, group, nested, nestedKey)
													end
												end
												end
											end
										end
									end
								end
							end
						end
					end
				end
				table.sort(matches, function(a, b)
					local query = field.Text:lower()
					local aExact = a.title:lower() == query
					local bExact = b.title:lower() == query
					if aExact ~= bExact then return aExact end
					return a.title:lower() < b.title:lower()
				end)
				local shown = math.min(#matches, 90)
				for index = 1, shown do
					addSearchResult(matches[index], index)
				end
				summary.Text = tostring(#matches) .. " feature(s) found" .. (#matches > shown and " (showing first 90)" or "")
			end
			field:GetPropertyChangedSignal("Text"):Connect(updateResults)
			updateResults()
			exit.MouseButton1Click:Connect(closeFeatureSearch)
			overlay.MouseButton1Click:Connect(closeFeatureSearch)
			searchKeyConnection = UserInputService.InputBegan:Connect(function(input, processed)
				if input.KeyCode == Enum.KeyCode.Escape then closeFeatureSearch() end
			end)
			overlay.Destroying:Once(function()
				if searchKeyConnection then searchKeyConnection:Disconnect(); searchKeyConnection = nil end
				if searchOverlay == overlay then searchOverlay = nil end
			end)
			task.defer(function()
				if field.Parent then field:CaptureFocus() end
			end)
		end
		searchTrigger.MouseButton1Click:Connect(openFeatureSearch)
		mainWindow:GetPropertyChangedSignal("Visible"):Connect(function()
			if not mainWindow.Visible then closeFeatureSearch() end
		end)]==], 1)
local dropdownMethod = source:find([==[function Element:AddDropdown(NestedSettings, NestedIndex, Parent, ParentIndex)]==], 1, true)
if not dropdownMethod then
    error("[Starlight] Dropdown method not found")
end
local dropdownCloseStart = source:find([==[							local function close()]==], dropdownMethod, true)
local dropdownHoverStart = dropdownCloseStart and source:find([==[							local function hover()]==], dropdownCloseStart, true)
if not dropdownCloseStart or not dropdownHoverStart then
    error("[Starlight] Dropdown popup section not found")
end
source = source:sub(1, dropdownCloseStart - 1) .. [==[							local trigger = NestedElement.Instances[1]
							local popup = NestedElement.Instances[2]
							local dropdownOpen = false
							local dropdownInputConnection
							local function contains(target, point)
								if not target or not target.Parent or not target.Visible then
									return false
								end
								local position = target.AbsolutePosition
								local size = target.AbsoluteSize
								return size.X > 0 and size.Y > 0
									and point.X >= position.X and point.Y >= position.Y
									and point.X <= position.X + size.X
									and point.Y <= position.Y + size.Y
							end
							local function close()
								dropdownOpen = false
								if Starlight.ActiveDropdownClose == close then
									Starlight.ActiveDropdownClose = nil
								end
								if not popup.Parent then
									return
								end
								popup.Visible = false
								popup.Size = UDim2.fromOffset(math.max(1, math.ceil(trigger.AbsoluteSize.X)), 0)
								popup.List.Size = UDim2.new(1, 0, 0, 0)
								popup.List.ScrollBarImageTransparency = 1
								AcrylicObject.Model.Transparency = 1
							end
							local function open()
								if not trigger.Parent or not popup.Parent or not mainWindow.Visible or not StarlightUI.Enabled then
									return
								end
								if type(Starlight.ActiveDropdownClose) == "function" and Starlight.ActiveDropdownClose ~= close then
									pcall(Starlight.ActiveDropdownClose)
								end
								Starlight.ActiveDropdownClose = close
								dropdownOpen = true
								local contentHeight = tonumber(popup.List.AbsoluteCanvasSize.Y) or 0
								if contentHeight < 32 then
									local itemCount = 0
									for _, item in ipairs(popup.List:GetChildren()) do
										if item:IsA("Frame") and item.Visible then
											itemCount += 1
										end
									end
									contentHeight = math.max(contentHeight, itemCount * 30 + 10)
								end
								height = math.clamp(contentHeight, 40, 175)
								updPos()
								popup.Size = UDim2.fromOffset(math.max(1, math.ceil(trigger.AbsoluteSize.X)), height)
								popup.List.Size = UDim2.new(1, 0, 0, height)
								popup.List.ScrollBarImageTransparency = 0
								AcrylicObject.Model.Transparency = 0.98
								popup.Visible = true
							end
							local function toggle()
								if dropdownOpen then
									close()
								else
									open()
								end
							end
							trigger:GetPropertyChangedSignal("AbsolutePosition"):Connect(function()
								if dropdownOpen and popup.Parent then
									updPos()
								end
							end)
							trigger:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
								if not popup.Parent then
									return
								end
								popup.Size = UDim2.fromOffset(math.max(1, math.ceil(trigger.AbsoluteSize.X)), dropdownOpen and height or 0)
								if dropdownOpen then
									updPos()
								end
								if NestedElement and NestedElement.truncate then
									NestedElement:truncate()
								end
							end)
							updPos()
							close()
							dropdownInputConnection = UserInputService.InputBegan:Connect(function(input)
								if input.UserInputType ~= Enum.UserInputType.MouseButton1
									and input.UserInputType ~= Enum.UserInputType.Touch then
									return
								end
								if not popup.Parent or not trigger.Parent then
									close()
									return
								end
								if not mainWindow.Visible or not StarlightUI.Enabled then
									if dropdownOpen then
										close()
									end
									return
								end
								local point = Vector2.new(input.Position.X, input.Position.Y)
								if contains(trigger.Interact, point) or contains(trigger, point) then
									toggle()
								elseif dropdownOpen and not contains(popup, point) then
									close()
								end
							end)
							trigger.Interact.Activated:Connect(function(input)
								if input and (input.UserInputType == Enum.UserInputType.MouseButton1
									or input.UserInputType == Enum.UserInputType.Touch) then
									return
								end
								toggle()
							end)
							local function cleanupDropdownInput()
								if dropdownInputConnection then
									dropdownInputConnection:Disconnect()
									dropdownInputConnection = nil
								end
								if popupInputConnection then
									popupInputConnection:Disconnect()
									popupInputConnection = nil
								end
								close()
							end
							popup.Destroying:Once(cleanupDropdownInput)
							trigger.Destroying:Once(cleanupDropdownInput)

]==] .. source:sub(dropdownHoverStart)
local startPos = source:find([==[				function Groupbox:Set(NewGroupboxSettings)]==], 1, true)
local endPos = startPos and source:find([==[				function Groupbox:Destroy()]==], startPos, true)
if not startPos or not endPos then error("Groupbox patch mismatch") end
source = source:sub(1, startPos - 1) .. [==[				function Groupbox:Set(NewGroupboxSettings)
					local oldInstance = Groupbox.Instance
					if not oldInstance then
						return false
					end
					local nextSettings = table.clone(GroupboxSettings)
					for key, value in pairs(NewGroupboxSettings) do
						nextSettings[key] = value
					end
					nextSettings.Icon = nextSettings.Icon or ""
					nextSettings.Column = nextSettings.Column or 1
					nextSettings.Style = nextSettings.Style or 1
					local changedStyle = nextSettings.Style ~= GroupboxSettings.Style
					local newInstance = oldInstance
					if changedStyle then
						if nextSettings.Style == 1 then
							newInstance = tabs["Tab_TEMPLATE"].ScrollingCollumnTemplate["Groupbox_Style1"]:Clone()
						else
							newInstance = tabs["Tab_TEMPLATE"].ScrollingCollumnTemplate2["Groupbox_Style2"]:Clone()
						end
						for _, child in ipairs(newInstance.PART_Content:GetChildren()) do
							if child:IsA("GuiObject") then
								child:Destroy()
							end
						end
						for _, child in ipairs(oldInstance.PART_Content:GetChildren()) do
							if child:IsA("GuiObject") then
								child.Parent = newInstance.PART_Content
							end
						end
						newInstance.LayoutOrder = oldInstance.LayoutOrder
						Groupbox.Instance = newInstance
						Groupbox.ParentingItem = newInstance.PART_Content
						newInstance.PART_Content:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
							if newInstance.Parent and newInstance:FindFirstChild("PART_Backdrop") then
								newInstance.PART_Backdrop.Inner.Size = UDim2.fromOffset(
									math.max(newInstance.PART_Backdrop.AbsoluteSize.X - 2, 0),
									math.max(newInstance.PART_Backdrop.AbsoluteSize.Y - 2, 0)
								)
							end
						end)
						newInstance.PART_Backdrop.BackgroundTransparency = mainAcrylic and 0.7 or 0
						newInstance.PART_Backdrop.Inner.BackgroundTransparency = mainAcrylic and 0.7 or 0
						newInstance.PART_Backdrop.UIStroke.Transparency = mainAcrylic and 0.6 or 0
						ThemeMethods.bindTheme(newInstance.Header, "TextColor3", "Foregrounds.Medium")
						ThemeMethods.bindTheme(newInstance.Header.Icon, "ImageColor3", "Foregrounds.Medium")
						ThemeMethods.bindTheme(newInstance.PART_Backdrop, "BackgroundColor3", "Backgrounds.Medium")
						ThemeMethods.bindTheme(newInstance.PART_Backdrop.Inner, "BackgroundColor3", "Backgrounds.Groupbox")
						ThemeMethods.bindTheme(newInstance.PART_Backdrop.UIStroke, "Color", "Miscellaneous.Shadow")
					end
					newInstance.Header.Text = tostring(nextSettings.Name or "")
					newInstance.Header.UIPadding.PaddingLeft = UDim.new(0, not String.IsEmptyOrNull(nextSettings.Icon) and 32 or 6)
					newInstance.Header.Icon.Image = not String.IsEmptyOrNull(nextSettings.Icon) and "rbxassetid://" .. tostring(nextSettings.Icon) or ""
					newInstance.Name = "GROUPBOX_" .. tostring(GroupIndex)
					newInstance.Parent = Tab.Instances.Page["Column_" .. nextSettings.Column]
					GroupboxSettings = nextSettings
					Groupbox.Values = nextSettings
					if changedStyle then
						oldInstance:Destroy()
					end
					return true
				end

]==] .. source:sub(endPos)
local cursor = source:find([==[Name = "Autoload Configuration"]==], 1, true)
local target = cursor and source:find([==["__prebuiltConfigLoader"]==], cursor, true)
if not target then error("Autoload index mismatch") end
source = source:sub(1, target - 1) .. [==["__prebuiltConfigAutoload"]==] .. source:sub(target + 24)
cursor = source:find([==[Name = "Clear Autoload"]==], 1, true)
target = cursor and source:find([==["__prebuiltConfigDeleter"]==], cursor, true)
if not target then error("Clear Autoload index mismatch") end
source = source:sub(1, target - 1) .. [==["__prebuiltConfigClearAutoload"]==] .. source:sub(target + 25)
if #patchWarnings > 0 then
    warn("[Starlight] " .. table.concat(patchWarnings, "; "))
end
if type(writefile) == "function" then pcall(writefile, "Starlight_FullFix_Source.lua", source) end
local compiled, compilationError = loadstring(source)
if not compiled then
    error("[Starlight] Source failed to compile: " .. tostring(compilationError))
end
return compiled()
