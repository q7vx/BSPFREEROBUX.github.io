local source = game:HttpGet([==[https://raw.githubusercontent.com/Nebula-Softworks/Starlight-Interface-Suite/Gen1/Source.lua]==])
local function replaceExact(old, new, expected)
    local from = 1
    local count = 0
    while true do
        local position = source:find(old, from, true)
        if not position then break end
        count += 1
        from = position + #old
    end
    if expected > 0 and count ~= expected then error("Patch mismatch: " .. tostring(expected) .. " / " .. tostring(count)) end
    if expected == -1 and count < 1 then error("Missing patch anchor") end
    local pieces = {}
    local cursor = 1
    while true do
        local position = source:find(old, cursor, true)
        if not position then break end
        table.insert(pieces, source:sub(cursor, position - 1))
        table.insert(pieces, new)
        cursor = position + #old
    end
    table.insert(pieces, source:sub(cursor))
    source = table.concat(pieces)
end
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
			changelogPanel.latest.Header.Text = tostring(latestEntry.Version or latestEntry.Title or "Latest Update")
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
			titleText.Text = tostring(entry.Version or entry.Title or ("Update " .. index))
			titleText.ZIndex = 604
			titleText.Parent = item
				if entry.Version and entry.Title and entry.Version ~= entry.Title then
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
if type(writefile) == "function" then pcall(writefile, "Starlight_Source_RevertedControls.lua", source) end
return loadstring(source)()
