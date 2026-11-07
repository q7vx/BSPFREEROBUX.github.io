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
		local searchButton = Instance.new("TextButton")
		searchButton.Name = "FeatureSearchButton"
		searchButton.Size = UDim2.fromScale(1, 1)
		searchButton.BackgroundTransparency = 1
		searchButton.Text = ""
		searchButton.ZIndex = searchIcon.ZIndex + 1
		searchButton.Parent = searchIcon
		local searchGui
		local searchLayer = 1000
		local searchEscape
		local function closeFeatureSearch(immediate)
			if searchEscape then
				searchEscape:Disconnect()
				searchEscape = nil
			end
			local oldGui = searchGui
			if not oldGui then return end
			searchGui = nil
			if immediate then
				oldGui:Destroy()
				return
			end
			local backdrop = oldGui:FindFirstChild("Backdrop")
			local panel = oldGui:FindFirstChild("FeatureSearchPanel")
			if not backdrop or not panel then
				oldGui:Destroy()
				return
			end
			local outside = oldGui:FindFirstChild("Outside")
			if outside then outside.Active = false end
			local closeTween = TweenService:Create(backdrop, TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { BackgroundTransparency = 1 })
			local scale = panel:FindFirstChildOfClass("UIScale")
			if scale then
				TweenService:Create(scale, TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Scale = 0.96 }):Play()
			end
			closeTween.Completed:Once(function()
				if oldGui.Parent then oldGui:Destroy() end
			end)
			closeTween:Play()
		end
		local function makeSearchText(parent, text, position, size, fontSize, color, zIndex)
			local label = Instance.new("TextLabel")
			label.BackgroundTransparency = 1
			label.Text = tostring(text or "")
			label.Position = position
			label.Size = size
			label.TextSize = fontSize
			label.TextColor3 = color
			label.Font = Enum.Font.Gotham
			label.TextXAlignment = Enum.TextXAlignment.Left
			label.TextTruncate = Enum.TextTruncate.AtEnd
			label.ZIndex = searchLayer + (zIndex or 4)
			label.Parent = parent
			return label
		end
		local function openFeatureSearch()
			if searchGui then
				closeFeatureSearch()
				return
			end
			if not StarlightUI.Parent then return end
			searchLayer = 1000
			for _, descendant in ipairs(StarlightUI:GetDescendants()) do
				if descendant:IsA("GuiObject") and descendant.Name ~= "StarlightFeatureSearch" and not descendant:FindFirstAncestor("StarlightFeatureSearch") then
					searchLayer = math.max(searchLayer, descendant.ZIndex + 50)
				end
			end
			local gui = Instance.new("Frame")
			gui.Name = "StarlightFeatureSearch"
			gui.Size = UDim2.fromScale(1, 1)
			gui.BackgroundTransparency = 1
			gui.BorderSizePixel = 0
			gui.Active = true
			gui.ZIndex = searchLayer
			gui.Parent = StarlightUI
			searchGui = gui
			local backdrop = Instance.new("Frame")
			backdrop.Name = "Backdrop"
			backdrop.BackgroundColor3 = Color3.new(0, 0, 0)
			backdrop.BackgroundTransparency = 1
			backdrop.BorderSizePixel = 0
			backdrop.Size = UDim2.fromOffset(0, 0)
			backdrop.ZIndex = searchLayer + 1
			backdrop.Parent = gui
			local backdropCorner = Instance.new("UICorner")
			backdropCorner.CornerRadius = UDim.new(0, 9)
			backdropCorner.Parent = backdrop
			local outside = Instance.new("TextButton")
			outside.Name = "Outside"
			outside.BackgroundTransparency = 1
			outside.Text = ""
			outside.Size = UDim2.fromScale(1, 1)
			outside.ZIndex = searchLayer + 2
			outside.Parent = gui
			local panel = Instance.new("Frame")
			panel.Name = "FeatureSearchPanel"
			panel.Size = UDim2.fromOffset(680, 470)
			panel.AnchorPoint = Vector2.new(0.5, 0.5)
			panel.Position = UDim2.fromScale(0.5, 0.5)
			panel.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Medium
			panel.BorderSizePixel = 0
			panel.ZIndex = searchLayer + 3
			panel.Parent = gui
			local sizeLimit = Instance.new("UISizeConstraint")
			sizeLimit.MinSize = Vector2.new(260, 215)
			sizeLimit.MaxSize = Vector2.new(720, 560)
			sizeLimit.Parent = panel
			local corner = Instance.new("UICorner")
			corner.CornerRadius = UDim.new(0, 10)
			corner.Parent = panel
			local stroke = Instance.new("UIStroke")
			stroke.Color = Starlight.CurrentTheme.Foregrounds.Dark
			stroke.Parent = panel
			local scale = Instance.new("UIScale")
			scale.Scale = 0.94
			scale.Parent = panel
			local syncConnections = {}
			local function syncSearchGeometry()
				if not gui.Parent or not mainWindow.Parent then return end
				local position = mainWindow.AbsolutePosition - gui.AbsolutePosition
				local size = mainWindow.AbsoluteSize
				backdrop.Position = UDim2.fromOffset(position.X, position.Y)
				backdrop.Size = UDim2.fromOffset(size.X, size.Y)
				panel.Position = UDim2.fromOffset(position.X + size.X * 0.5, position.Y + size.Y * 0.5)
				panel.Size = UDim2.fromOffset(math.min(720, math.max(260, size.X - 36)), math.min(560, math.max(215, size.Y - 36)))
			end
			table.insert(syncConnections, mainWindow:GetPropertyChangedSignal("AbsolutePosition"):Connect(syncSearchGeometry))
			table.insert(syncConnections, mainWindow:GetPropertyChangedSignal("AbsoluteSize"):Connect(syncSearchGeometry))
			table.insert(syncConnections, gui:GetPropertyChangedSignal("AbsolutePosition"):Connect(syncSearchGeometry))
			gui.Destroying:Once(function()
				for _, connection in ipairs(syncConnections) do connection:Disconnect() end
			end)
			syncSearchGeometry()
			TweenService:Create(backdrop, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundTransparency = 0.67 }):Play()
			TweenService:Create(scale, TweenInfo.new(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
			local title = makeSearchText(panel, "Search Features", UDim2.fromOffset(18, 9), UDim2.new(1, -75, 0, 34), 18, Starlight.CurrentTheme.Foregrounds.Light, 5)
			title.Font = Enum.Font.GothamBold
			local exit = Instance.new("TextButton")
			exit.Name = "Close"
			exit.Size = UDim2.fromOffset(44, 42)
			exit.Position = UDim2.new(1, -48, 0, 4)
			exit.BackgroundTransparency = 1
			exit.Text = "×"
			exit.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			exit.TextSize = 27
			exit.Font = Enum.Font.GothamBold
			exit.ZIndex = searchLayer + 8
			exit.Parent = panel
			local field = Instance.new("TextBox")
			field.Name = "SearchInput"
			field.Position = UDim2.fromOffset(15, 52)
			field.Size = UDim2.new(1, -30, 0, 40)
			field.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Dark
			field.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
			field.PlaceholderColor3 = Starlight.CurrentTheme.Foregrounds.Medium
			field.Text = ""
			field.PlaceholderText = "Search a tab, feature, or setting..."
			field.ClearTextOnFocus = false
			field.TextXAlignment = Enum.TextXAlignment.Left
			field.Font = Enum.Font.Gotham
			field.TextSize = 14
			field.ZIndex = searchLayer + 6
			field.Parent = panel
			local fieldCorner = Instance.new("UICorner")
			fieldCorner.CornerRadius = UDim.new(0, 7)
			fieldCorner.Parent = field
			local fieldPadding = Instance.new("UIPadding")
			fieldPadding.PaddingLeft = UDim.new(0, 12)
			fieldPadding.Parent = field
			local summary = makeSearchText(panel, "Loading features...", UDim2.fromOffset(17, 98), UDim2.new(1, -34, 0, 20), 12, Starlight.CurrentTheme.Foregrounds.Medium, 5)
			local results = Instance.new("ScrollingFrame")
			results.Name = "Results"
			results.Position = UDim2.fromOffset(15, 124)
			results.Size = UDim2.new(1, -30, 1, -138)
			results.BackgroundTransparency = 1
			results.BorderSizePixel = 0
			results.ScrollBarThickness = 4
			results.ScrollBarImageTransparency = 0.2
			results.VerticalScrollBarInset = Enum.ScrollBarInset.ScrollBar
			results.ScrollingDirection = Enum.ScrollingDirection.Y
			results.ScrollingEnabled = true
			results.ClipsDescendants = true
			results.AutomaticCanvasSize = Enum.AutomaticSize.Y
			results.CanvasSize = UDim2.fromOffset(0, 0)
			results.ZIndex = searchLayer + 5
			results.Parent = panel
			local listLayout = Instance.new("UIListLayout")
			listLayout.Padding = UDim.new(0, 6)
			listLayout.SortOrder = Enum.SortOrder.LayoutOrder
			listLayout.Parent = results
			local listPadding = Instance.new("UIPadding")
			listPadding.PaddingTop = UDim.new(0, 4)
			listPadding.PaddingBottom = UDim.new(0, 7)
			listPadding.PaddingRight = UDim.new(0, 8)
			listPadding.Parent = results
			local emptyState = makeSearchText(panel, "Start typing to search features", UDim2.fromOffset(22, 160), UDim2.new(1, -44, 0, 55), 14, Starlight.CurrentTheme.Foregrounds.Medium, 6)
			emptyState.TextXAlignment = Enum.TextXAlignment.Center
			emptyState.TextWrapped = true
			results.Visible = false
			local function sizeResults()
				if not panel.Parent then return end
				local available = math.max(70, panel.AbsoluteSize.Y - 138)
				local rowCount = math.max(1, math.floor((available - 11 + 6) / 62))
				local fittedHeight = rowCount * 56 + math.max(0, rowCount - 1) * 6 + 11
				results.Size = UDim2.new(1, -30, 0, fittedHeight)
				emptyState.Size = UDim2.new(1, -44, 0, math.max(55, panel.AbsoluteSize.Y - 195))
			end
			panel:GetPropertyChangedSignal("AbsoluteSize"):Connect(sizeResults)
			task.defer(sizeResults)
			local records = {}
			local seen = {}
			local function record(name, path, tab, target, priority, hints)
				name = tostring(name or "")
				path = tostring(path or "")
				if name == "" or name == "nil" then return end
				local normalizedName = name:lower()
				if normalizedName:find("prebuilt", 1, true) == 1 or normalizedName:find("template", 1, true) == 1 or normalizedName:find("__", 1, true) == 1 then return end
				local key = tostring(tab) .. ":" .. normalizedName .. ":" .. path:lower()
				if seen[key] then return end
				seen[key] = true
				table.insert(records, { name = name, path = path, tab = tab, target = target, priority = priority or 0, hints = tostring(hints or "") })
			end
			local indexed, indexError = pcall(function()
				for sectionKey, section in pairs(Starlight.Window.TabSections or {}) do
					if type(section) == "table" and type(section.Tabs) == "table" then
						local sectionName = tostring(section.Name or sectionKey)
						for tabKey, tab in pairs(section.Tabs) do
							if type(tab) == "table" and type(tab.Instances) == "table" and tab.Instances.Page then
								local tabName = tostring(tab.Values and tab.Values.Name or tabKey)
								record(tabName, sectionName, tab, nil, 0, tostring(tabKey))
								for groupKey, group in pairs(tab.Groupboxes or {}) do
									if type(group) == "table" then
										local groupName = tostring(group.Values and group.Values.Name or groupKey)
										local groupPath = sectionName .. " / " .. tabName
										record(groupName, groupPath, tab, group.Instance, 1, tostring(groupKey))
										for elementKey, element in pairs(group.Elements or {}) do
											if type(element) == "table" then
												local name = tostring(element.Values and element.Values.Name or elementKey)
												local target = element.Instance or (element.Instances and element.Instances[1])
												record(name, groupPath .. " / " .. groupName, tab, target, 2, tostring(elementKey) .. " " .. tostring(element.Values and element.Values.Tooltip or ""))
												for nestedKey, nested in pairs(element.NestedElements or {}) do
													if type(nested) == "table" then
														local nestedName = tostring(nested.Values and nested.Values.Name or nested.Class or nestedKey)
														local nestedTarget = nested.Instance or (nested.Instances and nested.Instances[1])
														record(nestedName, groupPath .. " / " .. groupName .. " / " .. name, tab, nestedTarget, 3, nestedKey)
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
			end)
			if not indexed then warn("[Starlight Search] " .. tostring(indexError)) end
			local scanned, scanError = pcall(function()
				local scannedCount = 0
				for sectionKey, section in pairs(Starlight.Window.TabSections or {}) do
					if type(section) == "table" then
						for _, tab in pairs(section.Tabs or {}) do
							if type(tab) == "table" and type(tab.Instances) == "table" and typeof(tab.Instances.Page) == "Instance" then
								local page = tab.Instances.Page
								local tabName = tostring(tab.Values and tab.Values.Name or tab.Index or "Tab")
								for _, label in ipairs(page:GetDescendants()) do
									if scannedCount >= 4000 then break end
									scannedCount += 1
									if (label:IsA("TextLabel") or label:IsA("TextButton")) and (label.Name == "Header" or label.Name == "header") then
										local name = tostring(label.Text or "")
										if #name > 1 and #name < 70 and not name:find("<", 1, true) then
											record(name, tostring(sectionKey) .. " / " .. tabName, tab, label, 4, "")
										end
									end
								end
							end
						end
					end
				end
			end)
			if not scanned then warn("[Starlight Search] " .. tostring(scanError)) end
			local function navigate(entry)
				closeFeatureSearch()
				local tab = entry.tab
				if tab and type(tab.Select) == "function" then
					pcall(tab.Select)
				end
				local target = entry.target
				if typeof(target) == "Instance" and target:IsA("GuiObject") then
					task.defer(function()
						if not target.Parent then return end
						local current = target.Parent
						while current and not current:IsA("ScrollingFrame") do
							current = current.Parent
						end
						if current then
							local y = math.max(0, current.CanvasPosition.Y + target.AbsolutePosition.Y - current.AbsolutePosition.Y - 16)
							TweenService:Create(current, TweenInfo.new(0.22, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { CanvasPosition = Vector2.new(current.CanvasPosition.X, y) }):Play()
						end
						local marker = Instance.new("UIStroke")
						marker.Color = Starlight.CurrentTheme.Accents.Main
						marker.Thickness = 2
						marker.Parent = target
						TweenService:Create(marker, TweenInfo.new(0.9), { Transparency = 1 }):Play()
						task.delay(1, function() if marker.Parent then marker:Destroy() end end)
					end)
				end
			end
			local function createResult(entry, number)
				local button = Instance.new("TextButton")
				button.Name = "Result" .. tostring(number)
				button.LayoutOrder = number
				button.Size = UDim2.new(1, -4, 0, 56)
				button.BackgroundColor3 = Starlight.CurrentTheme.Backgrounds.Light
				button.BackgroundTransparency = 0.12
				button.Text = tostring(entry.name or "Feature")
				button.TextColor3 = Starlight.CurrentTheme.Foregrounds.Light
				button.TextTransparency = 0
				button.TextSize = 14
				button.Font = Enum.Font.GothamBold
				button.TextXAlignment = Enum.TextXAlignment.Left
				button.TextYAlignment = Enum.TextYAlignment.Top
				button.AutoButtonColor = false
				button.ZIndex = searchLayer + 6
				button.Parent = results
				local pad = Instance.new("UIPadding")
				pad.PaddingTop = UDim.new(0, 9)
				pad.PaddingLeft = UDim.new(0, 14)
				pad.PaddingRight = UDim.new(0, 28)
				pad.Parent = button
				local corner = Instance.new("UICorner")
				corner.CornerRadius = UDim.new(0, 7)
				corner.Parent = button
				local pathLabel = Instance.new("TextLabel")
				pathLabel.Name = "Path"
				pathLabel.Text = tostring(entry.path or "")
				pathLabel.TextColor3 = Starlight.CurrentTheme.Foregrounds.Medium
				pathLabel.TextTransparency = 0
				pathLabel.BackgroundTransparency = 1
				pathLabel.TextSize = 11
				pathLabel.Font = Enum.Font.Gotham
				pathLabel.TextXAlignment = Enum.TextXAlignment.Left
				pathLabel.TextTruncate = Enum.TextTruncate.AtEnd
				pathLabel.Position = UDim2.fromOffset(0, 23)
				pathLabel.Size = UDim2.new(1, -8, 0, 19)
				pathLabel.ZIndex = searchLayer + 7
				pathLabel.Parent = button
				button.MouseEnter:Connect(function()
					TweenService:Create(button, TweenInfo.new(0.13, Enum.EasingStyle.Quad), { BackgroundTransparency = 0 }):Play()
				end)
				button.MouseLeave:Connect(function()
					TweenService:Create(button, TweenInfo.new(0.13, Enum.EasingStyle.Quad), { BackgroundTransparency = 0.12 }):Play()
				end)
				button.Activated:Connect(function()
					if not button.Parent then return end
					TweenService:Create(button, TweenInfo.new(0.08), { BackgroundTransparency = 0.28 }):Play()
					navigate(entry)
				end)
			end
			local function renderResults()
				for _, child in ipairs(results:GetChildren()) do
					if child:IsA("GuiObject") then child:Destroy() end
				end
				results.CanvasPosition = Vector2.zero
				local query = field.Text:lower():match("^%s*(.-)%s*$")
				local matched = {}
				for _, entry in ipairs(records) do
					local haystack = (entry.name .. " " .. entry.path .. " " .. entry.hints):lower()
					local match = true
					for term in query:gmatch("%S+") do
						if not haystack:find(term, 1, true) then match = false; break end
					end
					if match then table.insert(matched, entry) end
				end
				table.sort(matched, function(a, b)
					local aStarts = a.name:lower():sub(1, #query) == query
					local bStarts = b.name:lower():sub(1, #query) == query
					if aStarts ~= bStarts then return aStarts end
					if a.priority ~= b.priority then return a.priority < b.priority end
					return a.name:lower() < b.name:lower()
				end)
				local count = math.min(#matched, 100)
				summary.Text = tostring(#matched) .. " features found" .. (#matched > count and " (showing first 100)" or "")
				if #matched == 0 then
					results.Visible = false
					emptyState.Visible = true
					emptyState.Text = "No matching features found."
					return
				end
				results.Visible = true
				emptyState.Visible = false
				for i = 1, count do
					local ok, err = pcall(createResult, matched[i], i)
					if not ok then
						warn("[Starlight Search] Result rendering: " .. tostring(err))
						local item = results:FindFirstChild("Result" .. tostring(i))
						if item and item:IsA("TextButton") then
							item.Text = tostring(matched[i].name or "Feature")
							item.TextColor3 = Color3.fromRGB(242, 245, 255)
							item.TextTransparency = 0
							item.TextSize = 14
						end
					end
				end
			end
			local function safeRender()
					local ok, err = pcall(renderResults)
					if not ok then
						summary.Text = "Search error: " .. tostring(err)
						warn("[Starlight Search] " .. tostring(err))
					end
				end
			field:GetPropertyChangedSignal("Text"):Connect(safeRender)
			safeRender()
			outside.Activated:Connect(function() closeFeatureSearch() end)
			exit.Activated:Connect(function() closeFeatureSearch() end)
			searchEscape = UserInputService.InputBegan:Connect(function(input)
				if input.KeyCode == Enum.KeyCode.Escape then closeFeatureSearch() end
			end)
			local thisEscape = searchEscape
			gui.Destroying:Once(function()
				if thisEscape then thisEscape:Disconnect() end
				if searchEscape == thisEscape then searchEscape = nil end
				if searchGui == gui then searchGui = nil end
			end)
			task.defer(function() if field.Parent and gui.Parent then field:CaptureFocus() end end)
		end
		local searchIconScale = Instance.new("UIScale")
		searchIconScale.Scale = 1
		searchIconScale.Parent = searchIcon
		searchButton.MouseEnter:Connect(function()
			TweenService:Create(searchIconScale, TweenInfo.new(0.15), { Scale = 1.13 }):Play()
		end)
		searchButton.MouseLeave:Connect(function()
			TweenService:Create(searchIconScale, TweenInfo.new(0.15), { Scale = 1 }):Play()
		end)
		searchButton.Activated:Connect(function()
			local success, err = pcall(openFeatureSearch)
			if not success then
				warn("[Starlight Search] " .. tostring(err))
				closeFeatureSearch(true)
			end
		end)
		mainWindow:GetPropertyChangedSignal("Visible"):Connect(function()
			if not mainWindow.Visible then closeFeatureSearch(true) end
		end)
		StarlightUI.Destroying:Once(function()
			closeFeatureSearch(true)
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
							trigger.Header.TextScaled = false
							local popup = NestedElement.Instances[2]
							local list = popup.List
							local dropdownOpen = false
							local dropdownInputConnection
							local transitionToken = 0
							local popupTween
							popup.ClipsDescendants = true
							list.ClipsDescendants = true
							list.ScrollingEnabled = false
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
							local function stopTransition()
								if popupTween then
									popupTween:Cancel()
									popupTween = nil
								end
							end
							local function close(immediate)
								transitionToken += 1
								local token = transitionToken
								dropdownOpen = false
								if Starlight.ActiveDropdownClose == close then
									Starlight.ActiveDropdownClose = nil
								end
								stopTransition()
								if not popup.Parent then return end
								local width = math.max(1, math.ceil(trigger.AbsoluteSize.X))
								list.ScrollBarImageTransparency = 1
								list.ScrollingEnabled = false
								AcrylicObject.Model.Transparency = 1
								if immediate == true or not popup.Visible then
									popup.Size = UDim2.fromOffset(width, 0)
									popup.Visible = false
									return
								end
								popupTween = TweenService:Create(
									popup,
									TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
									{ Size = UDim2.fromOffset(width, 0) }
								)
								popupTween.Completed:Once(function(playbackState)
									if transitionToken ~= token or dropdownOpen or not popup.Parent then return end
									if playbackState == Enum.PlaybackState.Completed then
										popup.Visible = false
									end
								end)
								popupTween:Play()
							end
							local function measureDropdownHeight()
								local layout = list:FindFirstChildOfClass("UIListLayout")
								local padding = list:FindFirstChildOfClass("UIPadding")
								local count = 0
								local rowHeight = 0
								for _, item in ipairs(list:GetChildren()) do
									if item:IsA("GuiObject") and item.Visible and item.Name ~= "Option_TEMPLATE" then
										count += 1
										local size = item.AbsoluteSize.Y
										if size <= 0 then size = item.Size.Y.Offset end
										rowHeight += size > 0 and size or 30
									end
								end
								local spacing = layout and (layout.Padding.Offset + layout.Padding.Scale * list.AbsoluteSize.Y) or 0
								local calculated = rowHeight + math.max(0, count - 1) * spacing
								local measured = layout and layout.AbsoluteContentSize.Y or 0
								if measured <= 0 or (calculated > 0 and measured > calculated * 1.35) then
									measured = calculated
								end
								local margins = 0
								if padding then
									margins = padding.PaddingTop.Offset + padding.PaddingBottom.Offset
										+ (padding.PaddingTop.Scale + padding.PaddingBottom.Scale) * list.AbsoluteSize.Y
								end
								return math.max(34, math.ceil(measured + margins + 6))
							end
							local function open()
								if not trigger.Parent or not popup.Parent or not mainWindow.Visible or not StarlightUI.Enabled then return end
								if type(Starlight.ActiveDropdownClose) == "function" and Starlight.ActiveDropdownClose ~= close then
									pcall(Starlight.ActiveDropdownClose)
								end
								transitionToken += 1
								local token = transitionToken
								dropdownOpen = true
								Starlight.ActiveDropdownClose = close
								stopTransition()
								local contentHeight = measureDropdownHeight()
								height = math.min(contentHeight, 175)
								list.AutomaticCanvasSize = Enum.AutomaticSize.None
								list.CanvasSize = UDim2.fromOffset(0, contentHeight)
								if contentHeight <= height then
									list.CanvasPosition = Vector2.zero
								end
								local width = math.max(1, math.ceil(trigger.AbsoluteSize.X))
								updPos()
								list.Size = UDim2.new(1, 0, 0, height)
								list.ScrollBarImageTransparency = 1
								list.ScrollingEnabled = false
								if not popup.Visible then
									popup.Size = UDim2.fromOffset(width, 0)
								end
								popup.Visible = true
								AcrylicObject.Model.Transparency = 0.98
								popupTween = TweenService:Create(
									popup,
									TweenInfo.new(0.19, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
									{ Size = UDim2.fromOffset(width, height) }
								)
								popupTween.Completed:Once(function(playbackState)
									if transitionToken ~= token or not dropdownOpen or not popup.Parent then return end
									if playbackState == Enum.PlaybackState.Completed then
										local needsScrolling = contentHeight > height
										list.ScrollBarImageTransparency = needsScrolling and 0 or 1
										list.ScrollingEnabled = needsScrolling
									end
								end)
								popupTween:Play()
							end
							local function toggle()
								if dropdownOpen then close() else open() end
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
								popup.Size = UDim2.fromOffset(math.max(1, math.ceil(trigger.AbsoluteSize.X)), popup.Size.Y.Offset)
								if dropdownOpen then
									updPos()
								end
								if NestedElement and NestedElement.truncate then
									NestedElement:truncate()
								end
							end)
							updPos()
							close(true)
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
								close(true)
							end
							popup.Destroying:Once(cleanupDropdownInput)
							trigger.Destroying:Once(cleanupDropdownInput)

]==] .. source:sub(dropdownHoverStart)
replaceExact([==[									optioninstance.header.Text = option]==], [==[									optioninstance.header.Text = option
									optioninstance.header.TextScaled = false]==], 1)
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
