local bootStarted = os.clock()
local bootGui
local bootStage
local bootFill
local bootOverlay
local bootPanel
local bootTweenService = game:GetService("TweenService")
local bootRunService = game:GetService("RunService")

local function makeBootLabel(parent, name, value, size, color, position, dimensions, font, alignment)
    local label = Instance.new("TextLabel")
    label.Name = name
    label.BackgroundTransparency = 1
    label.BorderSizePixel = 0
    label.Text = value
    label.Font = font or Enum.Font.Gotham
    label.TextSize = size
    label.TextColor3 = color
    label.TextXAlignment = alignment or Enum.TextXAlignment.Left
    label.TextYAlignment = Enum.TextYAlignment.Center
    label.TextTruncate = Enum.TextTruncate.AtEnd
    label.Position = position
    label.Size = dimensions
    label.ZIndex = 105
    label.Parent = parent
    return label
end

local function makeBootRounded(parent, radius)
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, radius)
    corner.Parent = parent
    return corner
end

local function makeBootCredit(parent, order, service, handle)
    local row = Instance.new("Frame")
    row.Name = service
    row.LayoutOrder = order
    row.Size = UDim2.new(1, 0, 0, 33)
    row.BackgroundColor3 = Color3.fromRGB(30, 58, 44)
    row.BackgroundTransparency = 0.12
    row.BorderSizePixel = 0
    row.ZIndex = 104
    row.Parent = parent
    makeBootRounded(row, 6)
    makeBootLabel(row, "Platform", service, 12, Color3.fromRGB(164, 175, 205), UDim2.fromOffset(12, 0), UDim2.new(0, 90, 1, 0), Enum.Font.GothamMedium)
    makeBootLabel(row, "Handle", handle, 13, Color3.fromRGB(231, 234, 248), UDim2.fromOffset(101, 0), UDim2.new(1, -111, 1, 0), Enum.Font.GothamMedium)
    return row
end

local function createBootScreen()
    local parent
    if type(gethui) == "function" then
        local ok, candidate = pcall(gethui)
        if ok and typeof(candidate) == "Instance" then
            parent = candidate
        end
    end
    if not parent then
        local ok, candidate = pcall(function()
            return game:GetService("CoreGui")
        end)
        if ok then
            parent = candidate
        end
    end
    if not parent then
        parent = game:GetService("Players").LocalPlayer:FindFirstChildOfClass("PlayerGui")
    end
    if not parent then
        return
    end

    local oldScreen = parent:FindFirstChild("StarlightReworkedSplash")
    if oldScreen then
        oldScreen:Destroy()
    end

    local screen = Instance.new("ScreenGui")
    screen.Name = "StarlightReworkedSplash"
    screen.IgnoreGuiInset = true
    screen.ResetOnSpawn = false
    screen.DisplayOrder = 99999
    screen.ZIndexBehavior = Enum.ZIndexBehavior.Global

    local overlay = Instance.new("Frame")
    overlay.Name = "Dim"
    overlay.Size = UDim2.fromScale(1, 1)
    overlay.Position = UDim2.fromScale(0, 0)
    overlay.BackgroundColor3 = Color3.fromRGB(5, 14, 11)
    overlay.BackgroundTransparency = 1
    overlay.BorderSizePixel = 0
    overlay.ZIndex = 100
    overlay.Parent = screen

    local panel = Instance.new("Frame")
    panel.Name = "StarlightLoading"
    panel.AnchorPoint = Vector2.new(0.5, 0.5)
    panel.Position = UDim2.fromScale(0.5, 0.5)
    panel.Size = UDim2.new(0.88, 0, 0, 330)
    panel.BackgroundColor3 = Color3.fromRGB(18, 39, 31)
    panel.BorderSizePixel = 0
    panel.ZIndex = 102
    panel.Parent = screen
    makeBootRounded(panel, 10)

    local size = Instance.new("UISizeConstraint")
    size.MinSize = Vector2.new(276, 320)
    size.MaxSize = Vector2.new(450, 330)
    size.Parent = panel

    local shadow = Instance.new("ImageLabel")
    shadow.Name = "SoftShadow"
    shadow.AnchorPoint = Vector2.new(0.5, 0.5)
    shadow.Position = UDim2.fromScale(0.5, 0.5)
    shadow.Size = UDim2.new(1, 62, 1, 60)
    shadow.Image = "rbxassetid://8992230677"
    shadow.ScaleType = Enum.ScaleType.Slice
    shadow.SliceCenter = Rect.new(99, 99, 99, 99)
    shadow.ImageColor3 = Color3.fromRGB(0, 0, 0)
    shadow.ImageTransparency = 0.55
    shadow.BackgroundTransparency = 1
    shadow.ZIndex = 101
    shadow.Parent = panel

    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(197, 157, 83)
    stroke.Transparency = 0.38
    stroke.Thickness = 1
    stroke.Parent = panel

    local headerBg = Instance.new("Frame")
    headerBg.Name = "Header"
    headerBg.Size = UDim2.new(1, 0, 0, 78)
    headerBg.BackgroundColor3 = Color3.fromRGB(29, 75, 53)
    headerBg.BorderSizePixel = 0
    headerBg.ZIndex = 103
    headerBg.Parent = panel
    makeBootRounded(headerBg, 10)

    local headerRepair = Instance.new("Frame")
    headerRepair.Name = "FlatHeaderBottom"
    headerRepair.Position = UDim2.new(0, 0, 1, -10)
    headerRepair.Size = UDim2.new(1, 0, 0, 10)
    headerRepair.BorderSizePixel = 0
    headerRepair.BackgroundColor3 = headerBg.BackgroundColor3
    headerRepair.ZIndex = 103
    headerRepair.Parent = headerBg

    local iconBack = Instance.new("Frame")
    iconBack.Name = "Icon"
    iconBack.Position = UDim2.fromOffset(18, 17)
    iconBack.Size = UDim2.fromOffset(43, 43)
    iconBack.BackgroundColor3 = Color3.fromRGB(155, 48, 55)
    iconBack.BorderSizePixel = 0
    iconBack.ZIndex = 104
    iconBack.Parent = headerBg
    makeBootRounded(iconBack, 9)

    makeBootLabel(iconBack, "Symbol", "S", 24, Color3.fromRGB(240, 242, 255), UDim2.fromScale(0, 0), UDim2.fromScale(1, 1), Enum.Font.GothamBold, Enum.TextXAlignment.Center)
    makeBootLabel(headerBg, "Title", "STARLIGHT", 20, Color3.fromRGB(240, 242, 255), UDim2.fromOffset(73, 12), UDim2.new(1, -92, 0, 31), Enum.Font.GothamBold)
    makeBootLabel(headerBg, "Subtitle", "HOLIDAY INTERFACE EDITION", 10, Color3.fromRGB(220, 205, 161), UDim2.fromOffset(75, 41), UDim2.new(1, -95, 0, 20), Enum.Font.GothamMedium)

    local bootTree = Instance.new("Frame")
    bootTree.Name = "HolidayTree"
    bootTree.BackgroundTransparency = 1
    bootTree.Position = UDim2.new(1, -58, 0, 7)
    bootTree.Size = UDim2.fromOffset(45, 65)
    bootTree.ZIndex = 106
    bootTree.Parent = headerBg
    local function bootTreeText(name, text, position, size, textSize, color)
        local label = Instance.new("TextLabel")
        label.Name = name
        label.BackgroundTransparency = 1
        label.Text = text
        label.Font = Enum.Font.GothamBlack
        label.TextSize = textSize
        label.TextColor3 = color
        label.TextXAlignment = Enum.TextXAlignment.Center
        label.TextYAlignment = Enum.TextYAlignment.Center
        label.Position = position
        label.Size = size
        label.ZIndex = 107
        label.Parent = bootTree
        return label
    end
    bootTreeText("Star", "✦", UDim2.fromOffset(15, -1), UDim2.fromOffset(16, 16), 14, Color3.fromRGB(255, 215, 126))
    bootTreeText("Top", "▲", UDim2.fromOffset(5, 7), UDim2.fromOffset(36, 28), 28, Color3.fromRGB(48, 143, 85))
    bootTreeText("Middle", "▲", UDim2.fromOffset(8, 18), UDim2.fromOffset(30, 25), 24, Color3.fromRGB(35, 119, 70))
    bootTreeText("Bottom", "▲", UDim2.fromOffset(11, 29), UDim2.fromOffset(24, 21), 20, Color3.fromRGB(27, 98, 59))
    local bootTrunk = Instance.new("Frame")
    bootTrunk.Name = "Trunk"
    bootTrunk.Position = UDim2.fromOffset(20, 48)
    bootTrunk.Size = UDim2.fromOffset(7, 9)
    bootTrunk.BackgroundColor3 = Color3.fromRGB(112, 70, 43)
    bootTrunk.BorderSizePixel = 0
    bootTrunk.ZIndex = 107
    bootTrunk.Parent = bootTree
    local bootTreeBulb = Instance.new("Frame")
    bootTreeBulb.Name = "RedOrnament"
    bootTreeBulb.Position = UDim2.fromOffset(11, 29)
    bootTreeBulb.Size = UDim2.fromOffset(5, 5)
    bootTreeBulb.BackgroundColor3 = Color3.fromRGB(225, 76, 78)
    bootTreeBulb.BorderSizePixel = 0
    bootTreeBulb.ZIndex = 108
    bootTreeBulb.Parent = bootTree
    makeBootRounded(bootTreeBulb, 5)
    local bootTreeBulb2 = bootTreeBulb:Clone()
    bootTreeBulb2.Name = "GoldOrnament"
    bootTreeBulb2.Position = UDim2.fromOffset(27, 37)
    bootTreeBulb2.BackgroundColor3 = Color3.fromRGB(255, 215, 126)
    bootTreeBulb2.Parent = bootTree


    makeBootLabel(panel, "CreditTitle", "Reworked by", 15, Color3.fromRGB(239, 241, 253), UDim2.fromOffset(20, 94), UDim2.new(1, -40, 0, 24), Enum.Font.GothamBold)

    local credits = Instance.new("Frame")
    credits.Name = "Credits"
    credits.Position = UDim2.fromOffset(20, 124)
    credits.Size = UDim2.new(1, -40, 0, 109)
    credits.BackgroundTransparency = 1
    credits.ZIndex = 103
    credits.Parent = panel

    local list = Instance.new("UIListLayout")
    list.SortOrder = Enum.SortOrder.LayoutOrder
    list.Padding = UDim.new(0, 5)
    list.Parent = credits

    makeBootCredit(credits, 1, "Discord", "@BossSquirtle")
    makeBootCredit(credits, 2, "GitHub", "q7vx")
    makeBootCredit(credits, 3, "Zyphor.cc", "BossSquirtle")

    makeBootLabel(panel, "LoadingLabel", "INITIALIZING", 10, Color3.fromRGB(165, 175, 205), UDim2.fromOffset(20, 249), UDim2.new(1, -40, 0, 16), Enum.Font.GothamBold)

    local track = Instance.new("Frame")
    track.Name = "Track"
    track.Position = UDim2.fromOffset(20, 273)
    track.Size = UDim2.new(1, -40, 0, 5)
    track.BackgroundColor3 = Color3.fromRGB(66, 34, 38)
    track.BorderSizePixel = 0
    track.ZIndex = 104
    track.Parent = panel
    makeBootRounded(track, 5)

    local fill = Instance.new("Frame")
    fill.Name = "Fill"
    fill.Size = UDim2.fromScale(0.05, 1)
    fill.BackgroundColor3 = Color3.fromRGB(43, 147, 91)
    fill.BorderSizePixel = 0
    fill.ZIndex = 105
    fill.Parent = track
    makeBootRounded(fill, 5)

    local gradient = Instance.new("UIGradient")
    gradient.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(174, 47, 57)),
        ColorSequenceKeypoint.new(0.52, Color3.fromRGB(237, 190, 93)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(48, 157, 98))
    })
    gradient.Parent = fill

    makeBootLabel(panel, "Tagline", "Snow is falling. The holiday interface is getting ready.", 11, Color3.fromRGB(191, 213, 197), UDim2.fromOffset(20, 285), UDim2.new(1, -40, 0, 23), Enum.Font.Gotham)

    bootGui = screen
    bootOverlay = overlay
    bootPanel = panel
    bootStage = panel.LoadingLabel
    bootFill = fill
    screen.Parent = parent
    local bootSnow = Instance.new("Frame")
    bootSnow.Name = "HolidaySnowfall"
    bootSnow.BackgroundTransparency = 1
    bootSnow.BorderSizePixel = 0
    bootSnow.Size = UDim2.fromScale(1, 1)
    bootSnow.Active = false
    bootSnow.ZIndex = 130
    bootSnow.Parent = screen
    local bootFlakes = {}
    for index = 1, 30 do
        local flake = Instance.new("TextLabel")
        flake.Name = "Snowflake" .. tostring(index)
        flake.BackgroundTransparency = 1
        flake.BorderSizePixel = 0
        flake.Text = index % 4 == 0 and "✧" or "❄"
        flake.Font = Enum.Font.Gotham
        flake.TextSize = math.random(9, 16)
        flake.TextColor3 = Color3.fromRGB(235, 246, 242)
        flake.TextTransparency = math.random(25, 48) / 100
        flake.Size = UDim2.fromOffset(18, 18)
        flake.Position = UDim2.fromOffset(math.random(0, 1200), math.random(-700, 900))
        flake.Active = false
        flake.ZIndex = 131
        flake.Parent = bootSnow
        bootFlakes[index] = {
            Object = flake,
            Speed = math.random(22, 58),
            Drift = math.random(-16, 16),
            Phase = math.random() * math.pi * 2,
            Sway = math.random(3, 13),
        }
    end
    local bootSnowConnection = bootRunService.RenderStepped:Connect(function(deltaTime)
        if not screen.Parent then
            return
        end
        local viewport = bootSnow.AbsoluteSize
        for _, item in ipairs(bootFlakes) do
            local object = item.Object
            if object.Parent then
                local position = object.Position
                local x = position.X.Offset + (item.Drift + math.sin(os.clock() * 1.6 + item.Phase) * item.Sway) * deltaTime
                local y = position.Y.Offset + item.Speed * deltaTime
                if y > viewport.Y + 20 then
                    y = -24
                    x = math.random(0, math.max(1, viewport.X))
                end
                if x < -20 then x = viewport.X + 10 end
                if x > viewport.X + 20 then x = -10 end
                object.Position = UDim2.fromOffset(x, y)
            end
        end
    end)
    screen.Destroying:Once(function()
        bootSnowConnection:Disconnect()
    end)
    bootTweenService:Create(overlay, TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundTransparency = 0.34 }):Play()
end

pcall(createBootScreen)

local starlightTemplate
local starlightPreloadReady = false
local starlightPreloadProgress = 0
local starlightPreloadCancelled = false
local starlightPreloadKey = "__ZyphorStarlightPreloadedTemplate"
local starlightCoreImages = {
    "rbxassetid://116767744785553",
    "rbxassetid://90155503712202",
    "rbxassetid://18824089198",
    "rbxassetid://129398364168201",
    "rbxassetid://3926305904",
    "rbxassetid://108613279334326",
    "rbxassetid://6031625148",
    "rbxassetid://4155801252",
    "rbxassetid://16423157073",
    "rbxassetid://123097456061373",
    "rbxassetid://114684871091583",
    "rbxassetid://6034304908",
    "rbxassetid://8445471332",
    "rbxassetid://92421933997743",
    "rbxassetid://80990588449079",
    "rbxassetid://8992230677",
}

task.spawn(function()
    local success = pcall(function()
        local models = game:GetObjects("rbxassetid://132866968194043")
        if not models or not models[1] or not models[1]:IsA("ScreenGui") then
            return
        end
        local template = models[1]
        if starlightPreloadCancelled then
            template:Destroy()
            return
        end
        starlightTemplate = template
        starlightPreloadProgress = 0.25
        local images = {}
        local existing = {}
        local function addImage(path)
            if type(path) ~= "string" or path == "" or existing[path] or #images >= 92 then
                return
            end
            if path:sub(1, 13) ~= "rbxassetid://" and path:sub(1, 11) ~= "rbxasset://" then
                return
            end
            existing[path] = true
            images[#images + 1] = path
        end
        for _, path in ipairs(starlightCoreImages) do
            addImage(path)
        end
        local mainWindow = template:FindFirstChild("MainWindow")
        if mainWindow then
            for _, root in ipairs({ mainWindow:FindFirstChild("Sidebar"), mainWindow:FindFirstChild("Content") }) do
                if root then
                    for _, descendant in ipairs(root:GetDescendants()) do
                        if descendant:IsA("ImageLabel") or descendant:IsA("ImageButton") then
                            addImage(descendant.Image)
                        end
                    end
                end
            end
        end
        local resources = template:FindFirstChild("Resources")
        if resources then
            for _, descendant in ipairs(resources:GetDescendants()) do
                if #images >= 92 then
                    break
                end
                if descendant:IsA("ImageLabel") or descendant:IsA("ImageButton") then
                    addImage(descendant.Image)
                end
            end
        end
        local contentProvider = game:GetService("ContentProvider")
        for offset = 1, #images, 16 do
            if starlightPreloadCancelled then
                return
            end
            local batch = {}
            for index = offset, math.min(offset + 15, #images) do
                batch[#batch + 1] = images[index]
            end
            pcall(function()
                contentProvider:PreloadAsync(batch)
            end)
            starlightPreloadProgress = 0.25 + 0.75 * math.min(1, (offset + #batch - 1) / math.max(1, #images))
            task.wait()
        end
    end)
    if not success and starlightTemplate then
        starlightTemplate:Destroy()
        starlightTemplate = nil
    end
    starlightPreloadReady = true
end)


local function updateBootScreen(label, fraction)
    if bootStage and bootStage.Parent then
        bootStage.Text = string.upper(label)
    end
    if bootFill and bootFill.Parent then
        bootTweenService:Create(bootFill, TweenInfo.new(0.23, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
            Size = UDim2.fromScale(math.clamp(fraction, 0.05, 1), 1)
        }):Play()
    end
end

local function closeBootScreen()
    if not bootGui then
        return
    end
    local gui = bootGui
    bootGui = nil
    local duration = 0.22
    if gui.Parent then
        for _, descendant in ipairs(gui:GetDescendants()) do
            if descendant:IsA("TextLabel") then
                bootTweenService:Create(descendant, TweenInfo.new(duration), { TextTransparency = 1 }):Play()
            elseif descendant:IsA("Frame") then
                bootTweenService:Create(descendant, TweenInfo.new(duration), { BackgroundTransparency = 1 }):Play()
            elseif descendant:IsA("ImageLabel") then
                bootTweenService:Create(descendant, TweenInfo.new(duration), { ImageTransparency = 1 }):Play()
            elseif descendant:IsA("UIStroke") then
                bootTweenService:Create(descendant, TweenInfo.new(duration), { Transparency = 1 }):Play()
            end
        end
        task.wait(duration + 0.02)
    end
    gui:Destroy()
end

local function launchStarlight()
    updateBootScreen("Downloading interface", 0.18)
local source = game:HttpGet([==[https://raw.githubusercontent.com/Nebula-Softworks/Starlight-Interface-Suite/1ec0fb9ce4aacd8f396a9bd493e0251a6acf450a/Source.lua?starlight_revision=1ec0fb9c]==])
updateBootScreen("Applying rework", 0.49)
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
    if expected ~= nil and expected > 0 and count ~= expected then
        table.insert(patchWarnings, string.format("Patch %d: expected %d, found %d", patchIndex, expected, count))
    elseif expected == -1 and count == 0 then
        table.insert(patchWarnings, string.format("Patch %d: anchor missing", patchIndex))
    end
    if count == 0 then return end
    local maxReplacements
    if expected == -1 or expected == 0 or expected == nil then
        maxReplacements = count
    else
        maxReplacements = math.min(expected, count)
    end
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
    if patchIndex % 6 == 0 then
        task.wait()
    end
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
local christmasPresetCount
source, christmasPresetCount = source:gsub('(\n)(\t*)"Hollywood Fluent",', function(newline, indent)
    return newline .. indent .. '"Hollywood Fluent",\n' .. indent .. '"Christmas",'
end)
if christmasPresetCount < 1 then
    error("Christmas preset insertion anchor missing")
end
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

	local applied = 0
	local skipped = 0
	for _, object in pairs(decoded.objects) do
		if type(object) == "table" and type(object.idx) == "string" and type(object.data) == "table" then
			local ok, result = pcall(ConfigMethods.Load, object.idx, object.data)
			if ok and result == true then
				applied += 1
			else
				skipped += 1
			end
		else
			skipped += 1
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
		end]==], [==[		if type(Idx) ~= "string" or type(Data) ~= "table" then
			return false
		end
		local found, target = pcall(GetNestedValue, Starlight.Window.TabSections, Idx)
		if not found or type(target) ~= "table" or type(target.Class) ~= "string" or type(target.Set) ~= "function" then
			return false
		end
		local allowed = ClassInterfacer[target.Class]
		if type(allowed) ~= "table" then
			return false
		end
		for key, originalValue in pairs(Data) do
			if table.find(allowed, key) then
				pcall(function()
					local value = originalValue
					if target.Class == "ColorPicker" and key == "CurrentValue" and type(value) == "table" then
						value = Color.Pack(value)
					end
					target:Set({ [key] = value })
				end)
			end
		end
		return true]==], 1)
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
		Tab.Select = Activate]==], -1)
replaceExact([==[--// ENDSUBSECTION

if UserInputService.TouchEnabled then]==], [==[--// ENDSUBSECTION

do
    local sidebar = mainWindow.Sidebar
    local topbar = mainWindow.Content.Topbar
    local sidebarShadow = sidebar:FindFirstChild("DropShadowHolder")
    if sidebarShadow then
        if sidebarShadow:IsA("GuiObject") then
            sidebarShadow.Visible = false
        end
        for _, layer in ipairs(sidebarShadow:GetDescendants()) do
            if layer:IsA("GuiObject") then
                layer.Visible = false
                if layer:IsA("ImageLabel") or layer:IsA("ImageButton") then
                    layer.ImageTransparency = 1
                end
            end
        end
    end
    local function flattenJoinCorner(panel, name, atLeft)
        local cover = Instance.new("Frame")
        cover.Name = name
        cover.BorderSizePixel = 0
        cover.Active = false
        cover.Selectable = false
        cover.Size = UDim2.fromOffset(13, 13)
        cover.ZIndex = 450
        cover.Parent = mainWindow
        local function sync()
            if not cover.Parent or not panel.Parent then return end
            local offset = panel.AbsolutePosition - mainWindow.AbsolutePosition
            local x = offset.X + (atLeft and 0 or (panel.AbsoluteSize.X - 13))
            cover.Position = UDim2.fromOffset(math.floor(x + 0.5), math.floor(offset.Y + 0.5))
            cover.BackgroundColor3 = panel.BackgroundColor3
            cover.BackgroundTransparency = panel.BackgroundTransparency
        end
        local events = {
            panel:GetPropertyChangedSignal("AbsolutePosition"):Connect(sync),
            panel:GetPropertyChangedSignal("AbsoluteSize"):Connect(sync),
            panel:GetPropertyChangedSignal("BackgroundColor3"):Connect(sync),
            panel:GetPropertyChangedSignal("BackgroundTransparency"):Connect(sync),
            mainWindow:GetPropertyChangedSignal("AbsolutePosition"):Connect(sync),
        }
        cover.Destroying:Once(function()
            for _, connection in ipairs(events) do
                connection:Disconnect()
            end
        end)
        sync()
        task.defer(sync)
    end
    flattenJoinCorner(sidebar, "SidebarJoinCornerRepair", false)
    flattenJoinCorner(topbar, "TopbarJoinCornerRepair", true)
end

if UserInputService.TouchEnabled then]==], 1)
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
local dropdownPositionStart = source:find([==[							local function updPos()]==], dropdownMethod, true)
local dropdownCloseStart = dropdownPositionStart and source:find([==[							local function close()]==], dropdownPositionStart, true)
local dropdownHoverStart = dropdownCloseStart and source:find([==[							local function hover()]==], dropdownCloseStart, true)
if not dropdownPositionStart or not dropdownCloseStart or not dropdownHoverStart then
    error("[Starlight] Dropdown popup section not found")
end
source = source:sub(1, dropdownPositionStart - 1) .. [==[
							local desiredHeight = 175
							local function updPos()
								local trigger = NestedElement.Instances[1]
								local popup = NestedElement.Instances[2]
								local layer = Starlight.DropdownLayer
								if not layer or not layer.Parent or not trigger.Parent or not popup.Parent then return end
								local position = trigger.AbsolutePosition - layer.AbsolutePosition
								local width = math.min(math.max(1, math.ceil(trigger.AbsoluteSize.X)), math.max(1, layer.AbsoluteSize.X - 12))
								local x = math.clamp(position.X, 6, math.max(6, layer.AbsoluteSize.X - width - 6))
								local below = position.Y + trigger.AbsoluteSize.Y + 5
								local above = position.Y - 5
								local spaceBelow = math.max(0, layer.AbsoluteSize.Y - below - 6)
								local spaceAbove = math.max(0, above - 6)
								if spaceBelow < desiredHeight and spaceAbove > spaceBelow then
									height = math.min(desiredHeight, spaceAbove)
									popup.AnchorPoint = Vector2.new(0, 1)
									popup.Position = UDim2.fromOffset(math.floor(x + 0.5), math.floor(above + 0.5))
								else
									height = math.min(desiredHeight, spaceBelow)
									popup.AnchorPoint = Vector2.new(0, 0)
									popup.Position = UDim2.fromOffset(math.floor(x + 0.5), math.floor(below + 0.5))
								end
							end
							local trigger = NestedElement.Instances[1]
							trigger.Header.TextScaled = false
							local popup = NestedElement.Instances[2]
							local dropdownLayer = Starlight.DropdownLayer
							if not dropdownLayer or not dropdownLayer.Parent then
								dropdownLayer = Instance.new("Frame")
								dropdownLayer.Name = "StarlightDropdownLayer"
								dropdownLayer.BackgroundTransparency = 1
								dropdownLayer.BorderSizePixel = 0
								dropdownLayer.Position = UDim2.fromScale(0, 0)
								dropdownLayer.Size = UDim2.fromScale(1, 1)
								dropdownLayer.ClipsDescendants = false
								dropdownLayer.Visible = false
								dropdownLayer.ZIndex = 10000
								dropdownLayer.Parent = StarlightUI
								local dismiss = Instance.new("TextButton")
								dismiss.Name = "DismissDropdown"
								dismiss.Text = ""
								dismiss.AutoButtonColor = false
								dismiss.BackgroundTransparency = 1
								dismiss.BorderSizePixel = 0
								dismiss.Active = true
								dismiss.Size = UDim2.fromScale(1, 1)
								dismiss.ZIndex = 10
								dismiss.Parent = dropdownLayer
								Starlight.DropdownRegistry = Starlight.DropdownRegistry or {}
								dismiss.Activated:Connect(function(input)
									local position = input and input.Position or UserInputService:GetMouseLocation()
									local point = Vector2.new(position.X, position.Y)
									local activeClose = Starlight.ActiveDropdownClose
									local chosen
									for item, handlers in pairs(Starlight.DropdownRegistry) do
										if item.Parent and item.Visible then
											local ancestor = item.Parent
											local visible = true
											while ancestor and ancestor ~= StarlightUI do
												if ancestor:IsA("GuiObject") and not ancestor.Visible then
													visible = false
													break
												end
												ancestor = ancestor.Parent
											end
											if visible and ancestor == StarlightUI then
												local pos = item.AbsolutePosition
												local size = item.AbsoluteSize
												if point.X >= pos.X and point.X <= pos.X + size.X
													and point.Y >= pos.Y and point.Y <= pos.Y + size.Y then
													chosen = handlers
													break
												end
											end
										end
									end
									if chosen and chosen.close == activeClose then
										activeClose()
										return
									end
									if type(activeClose) == "function" then
										activeClose(true)
									end
									if chosen and type(chosen.open) == "function" then
										chosen.open()
									end
								end)
								Starlight.DropdownLayer = dropdownLayer
							end
							popup.Parent = dropdownLayer
							popup.ZIndex = 20
							popup.Active = true
							if StarlightUI.ZIndexBehavior == Enum.ZIndexBehavior.Global then
								dropdownLayer.DismissDropdown.ZIndex = 10010
								popup.ZIndex = 10020
								local function promote(descendant)
									if descendant:IsA("GuiObject") then
										local base = descendant:GetAttribute("ZyDropdownBaseZ")
										if base == nil then
											base = descendant.ZIndex
											descendant:SetAttribute("ZyDropdownBaseZ", base)
										end
										descendant.ZIndex = 10020 + base
									end
								end
								for _, descendant in ipairs(popup:GetDescendants()) do
									promote(descendant)
								end
								popup.DescendantAdded:Connect(promote)
							end
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
								if not popup.Parent then
									if not Starlight.ActiveDropdownClose and dropdownLayer.Parent then
										dropdownLayer.Visible = false
									end
									return
								end
								local width = math.max(1, math.ceil(trigger.AbsoluteSize.X))
								list.ScrollBarImageTransparency = 1
								list.ScrollingEnabled = false
								AcrylicObject.Model.Transparency = 1
								if immediate == true or not popup.Visible then
									popup.Size = UDim2.fromOffset(width, 0)
									popup.Visible = false
									if not Starlight.ActiveDropdownClose then
										dropdownLayer.Visible = false
									end
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
										if not Starlight.ActiveDropdownClose then
											dropdownLayer.Visible = false
										end
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
									pcall(Starlight.ActiveDropdownClose, true)
								end
								transitionToken += 1
								local token = transitionToken
								dropdownOpen = true
								Starlight.ActiveDropdownClose = close
								dropdownLayer.Visible = true
								stopTransition()
								local contentHeight = measureDropdownHeight()
								desiredHeight = math.min(contentHeight, 175)
								height = desiredHeight
								list.AutomaticCanvasSize = Enum.AutomaticSize.None
								list.CanvasSize = UDim2.fromOffset(0, contentHeight)
								if contentHeight <= height then
									list.CanvasPosition = Vector2.zero
								end
								updPos()
								local width = math.min(math.max(1, math.ceil(trigger.AbsoluteSize.X)), math.max(1, dropdownLayer.AbsoluteSize.X - 12))
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
									list.Size = UDim2.new(1, 0, 0, height)
									popup.Size = UDim2.fromOffset(popup.Size.X.Offset, height)
									list.ScrollingEnabled = list.CanvasSize.Y.Offset > height
								end
							end)
							trigger:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
								if not popup.Parent then
									return
								end
								popup.Size = UDim2.fromOffset(
									math.min(math.max(1, math.ceil(trigger.AbsoluteSize.X)), math.max(1, dropdownLayer.AbsoluteSize.X - 12)),
									popup.Size.Y.Offset
								)
								if dropdownOpen then
									updPos()
									list.Size = UDim2.new(1, 0, 0, height)
									popup.Size = UDim2.fromOffset(popup.Size.X.Offset, height)
									list.ScrollingEnabled = list.CanvasSize.Y.Offset > height
								end
								if NestedElement and NestedElement.truncate then
									NestedElement:truncate()
								end
							end)
							updPos()
							close(true)
							Starlight.DropdownRegistry[trigger] = { open = open, close = close }
							dropdownInputConnection = UserInputService.InputBegan:Connect(function(input)
								if dropdownOpen and input.KeyCode == Enum.KeyCode.Escape then
									close()
								end
							end)
							trigger.Interact.Activated:Connect(toggle)
							local mainVisibilityConnection = mainWindow:GetPropertyChangedSignal("Visible"):Connect(function()
								if dropdownOpen and not mainWindow.Visible then close(true) end
							end)
							local uiVisibilityConnection = StarlightUI:GetPropertyChangedSignal("Enabled"):Connect(function()
								if dropdownOpen and not StarlightUI.Enabled then close(true) end
							end)
							local function cleanupDropdownInput()
								Starlight.DropdownRegistry[trigger] = nil
								mainVisibilityConnection:Disconnect()
								uiVisibilityConnection:Disconnect()
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
replaceExact([==[									local function ToggleOption(option)
										if not NestedElement.Values.MultipleOptions then
											for i, v in pairs(NestedElement.Instances[2].List:GetChildren()) do
												if v.ClassName == "Frame" and v ~= option then
													Deactivate(v)
													NestedElement.Values.CurrentOption = {}
												end
											end
										end]==], [==[									local function ToggleOption(option)
										if not NestedElement.Values.MultipleOptions then
											if option:GetAttribute("Active") == true then
												return
											end
											NestedElement.Values.CurrentOption = {}
											for _, other in ipairs(NestedElement.Instances[2].List:GetChildren()) do
												if other:IsA("Frame") and other ~= option and other:GetAttribute("Active") then
													Deactivate(other)
												end
											end
										end]==], 0)
local toggleOptionStart = source:find([==[local function ToggleOption(option)]==], 1, true)
if toggleOptionStart then
    local singleSelectStart = source:find([==[if not NestedElement.Values.MultipleOptions then]==], toggleOptionStart, true)
    local selectedOptionStart = singleSelectStart and source:find([==[if option:GetAttribute("Active") == false then]==], singleSelectStart, true)
    if singleSelectStart and selectedOptionStart then
        local currentBlock = source:sub(singleSelectStart, selectedOptionStart - 1)
        if not currentBlock:find([==[option:GetAttribute("Active") == true]==], 1, true) then
            local lineStart = (source:sub(1, singleSelectStart):match(".*()\n") or 0) + 1
            local indent = source:sub(lineStart, singleSelectStart - 1)
            local inner = indent .. "\t"
            local deeper = inner .. "\t"
            local deepest = deeper .. "\t"
            local replacement = table.concat({
                "if not NestedElement.Values.MultipleOptions then",
                inner .. 'if option:GetAttribute("Active") == true then',
                deeper .. "return",
                inner .. "end",
                inner .. "NestedElement.Values.CurrentOption = {}",
                inner .. "for _, other in ipairs(NestedElement.Instances[2].List:GetChildren()) do",
                deeper .. 'if other:IsA("Frame") and other ~= option and other:GetAttribute("Active") then',
                deepest .. "Deactivate(other)",
                deeper .. "end",
                inner .. "end",
                indent .. "end",
                "",
            }, "\n")
            source = source:sub(1, singleSelectStart - 1) .. replacement .. source:sub(selectedOptionStart)
        end
    end
end
if not toggleOptionStart or not source:sub(toggleOptionStart):find([==[option:GetAttribute("Active") == true]==], 1, true) then
    error("Starlight Patch 72 fallback could not locate the dropdown single-select block")
end
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
replaceExact([==[local StarlightUI: ScreenGui = isStudio and script.Parent:WaitForChild("Starlight V2")
	or game:GetObjects("rbxassetid://" .. modelId)[1]]==], [==[local bootEnvironment = type(getgenv) == "function" and getgenv() or _G
local preloadedStarlightTemplate = bootEnvironment.__ZyphorStarlightPreloadedTemplate
local function acquireStarlightGui()
    if typeof(preloadedStarlightTemplate) == "Instance" and preloadedStarlightTemplate:IsA("ScreenGui") then
        local success, clone = pcall(function()
            return preloadedStarlightTemplate:Clone()
        end)
        if success and clone then
            return clone
        end
    end
    return game:GetObjects("rbxassetid://" .. modelId)[1]
end
local StarlightUI: ScreenGui = isStudio and script.Parent:WaitForChild("Starlight V2")
    or acquireStarlightGui()]==], 1)
replaceExact([==[isStudio and script.Parent:FindFirstChild("Starlight V2") or game:GetObjects("rbxassetid://" .. modelId)[1]]==], [==[isStudio and script.Parent:FindFirstChild("Starlight V2") or acquireStarlightGui()]==], 1)
replaceExact([==[		ContentProvider:PreloadAsync({
			"rbxassetid://116767744785553", -- cursor
			"rbxassetid://90155503712202", -- cursor shadow
			"rbxassetid://18824089198", -- player blurred
			"rbxassetid://129398364168201", -- warning
			"rbxassetid://3926305904", -- dropdown arrows
			"rbxassetid://108613279334326", -- linking colorpicker
			"rbxassetid://6031625148", -- rainbow colorpicker
			"rbxassetid://4155801252", -- color picker
			"rbxassetid://16423157073", -- close
			"rbxassetid://123097456061373", -- minimise
			"rbxassetid://114684871091583", -- maximise
			"rbxassetid://6034304908", -- notification
			"rbxassetid://8445471332", -- search
			"rbxassetid://92421933997743", -- Corner Repair
			"rbxassetid://80990588449079", -- loading circle
		}, function(asset)
			if debugV then
				print(`loaded asset {asset}`)
			end
		end)]==], [==[]==], 1)
local christmasThemeAnchor = [==[Starlight.CurrentTheme = deepCopy(Themes.Starlight)]==]
local christmasThemePosition = source:find(christmasThemeAnchor, 1, true)
if not christmasThemePosition then
    error("Christmas theme initialization anchor missing")
end
local christmasThemeDefinition = [==[
Themes.Christmas = {
    Backgrounds = {
        Dark = Color3.fromRGB(11, 25, 20),
        Medium = Color3.fromRGB(17, 38, 30),
        Light = Color3.fromRGB(24, 49, 39),
        Groupbox = Color3.fromRGB(20, 43, 34),
        Highlight = Color3.fromRGB(31, 62, 48),
    },
    Foregrounds = {
        Active = Color3.fromRGB(255, 244, 220),
        Light = Color3.fromRGB(245, 246, 235),
        Medium = Color3.fromRGB(183, 202, 185),
        Dark = Color3.fromRGB(77, 103, 87),
        MediumHover = Color3.fromRGB(216, 226, 207),
        DarkHover = Color3.fromRGB(104, 132, 108),
    },
    Miscellaneous = {
        Divider = Color3.fromRGB(117, 137, 108),
        Shadow = Color3.fromRGB(7, 17, 13),
        LighterShadow = Color3.fromRGB(24, 42, 32),
    },
    Accents = {
        Main = ColorSequence.new({
            ColorSequenceKeypoint.new(0.0, Color3.fromRGB(181, 48, 59)),
            ColorSequenceKeypoint.new(0.5, Color3.fromRGB(239, 190, 94)),
            ColorSequenceKeypoint.new(1.0, Color3.fromRGB(47, 157, 95)),
        }),
        Brighter = ColorSequence.new({
            ColorSequenceKeypoint.new(0.0, Color3.fromRGB(230, 104, 105)),
            ColorSequenceKeypoint.new(0.5, Color3.fromRGB(255, 221, 151)),
            ColorSequenceKeypoint.new(1.0, Color3.fromRGB(111, 207, 146)),
        }),
    },
}
Starlight.CurrentTheme = deepCopy(Themes.Christmas)
]==]
source = source:sub(1, christmasThemePosition - 1)
    .. christmasThemeAnchor
    .. christmasThemeDefinition
    .. source:sub(christmasThemePosition + #christmasThemeAnchor)
source = source:gsub('CurrentOption = "Starlight"', 'CurrentOption = "Christmas"', 1)
source = source:gsub('or "Starlight",', 'or "Christmas",', 1)

local christmasDecorAnchor = [==[StarlightUI.Enabled = true]==]
local christmasDecorPosition = source:find(christmasDecorAnchor, 1, true)
if not christmasDecorPosition then
    error("Christmas decorations insertion anchor missing")
end
local christmasDecorSource = [==[
do
    local oldDecorations = mainWindow:FindFirstChild("ZyphorChristmasDecorations")
    if oldDecorations then
        oldDecorations:Destroy()
    end
    local previousSidebar = mainWindow:FindFirstChild("Sidebar")
    if previousSidebar then
        for _, name in ipairs({ "SidebarChristmasTree", "ChristmasSidebarAccent" }) do
            local previous = previousSidebar:FindFirstChild(name)
            if previous then previous:Destroy() end
        end
    end
    local previousContent = mainWindow:FindFirstChild("Content")
    local previousTopbar = previousContent and previousContent:FindFirstChild("Topbar")
    local previousGarland = previousTopbar and previousTopbar:FindFirstChild("ChristmasGarland")
    local previousHolly = previousTopbar and previousTopbar:FindFirstChild("ChristmasHolly")
    if previousGarland then previousGarland:Destroy() end
    if previousHolly then previousHolly:Destroy() end
    for _, name in ipairs({ "ChristmasSnowfall", "ChristmasGoldOutline" }) do
        local previous = mainWindow:FindFirstChild(name)
        if previous then previous:Destroy() end
    end
    local decorations = Instance.new("Folder")
    decorations.Name = "ZyphorChristmasDecorations"
    decorations.Parent = mainWindow
    local function makeTree(parent, name, position, width, height, zIndex)
        local holder = Instance.new("Frame")
        holder.Name = name
        holder.BackgroundTransparency = 1
        holder.BorderSizePixel = 0
        holder.Position = position
        holder.Size = UDim2.fromOffset(width, height)
        holder.Active = false
        holder.ZIndex = zIndex
        holder.Parent = parent
        local function treeText(objectName, text, pos, size, textSize, color)
            local label = Instance.new("TextLabel")
            label.Name = objectName
            label.BackgroundTransparency = 1
            label.BorderSizePixel = 0
            label.Text = text
            label.Font = Enum.Font.GothamBlack
            label.TextSize = textSize
            label.TextColor3 = color
            label.TextXAlignment = Enum.TextXAlignment.Center
            label.TextYAlignment = Enum.TextYAlignment.Center
            label.Position = pos
            label.Size = size
            label.Active = false
            label.ZIndex = zIndex + 1
            label.Parent = holder
            return label
        end
        treeText("Star", "✦", UDim2.fromOffset(width * 0.31, 0), UDim2.fromOffset(width * 0.38, 14), 13, Color3.fromRGB(255, 214, 124))
        treeText("CanopyTop", "▲", UDim2.fromOffset(width * 0.05, 7), UDim2.new(0.9, 0, 0, height * 0.48), 25, Color3.fromRGB(49, 145, 84))
        treeText("CanopyMiddle", "▲", UDim2.fromOffset(width * 0.15, height * 0.23), UDim2.new(0.7, 0, 0, height * 0.40), 21, Color3.fromRGB(34, 121, 70))
        treeText("CanopyBottom", "▲", UDim2.fromOffset(width * 0.25, height * 0.42), UDim2.new(0.5, 0, 0, height * 0.31), 17, Color3.fromRGB(25, 99, 58))
        local trunk = Instance.new("Frame")
        trunk.Name = "Trunk"
        trunk.AnchorPoint = Vector2.new(0.5, 0)
        trunk.Position = UDim2.new(0.5, 0, 0.79, 0)
        trunk.Size = UDim2.fromOffset(6, 8)
        trunk.BackgroundColor3 = Color3.fromRGB(119, 77, 47)
        trunk.BorderSizePixel = 0
        trunk.ZIndex = zIndex + 2
        trunk.Parent = holder
        local function ornament(objectName, x, y, color)
            local bead = Instance.new("Frame")
            bead.Name = objectName
            bead.Position = UDim2.fromOffset(x, y)
            bead.Size = UDim2.fromOffset(5, 5)
            bead.BackgroundColor3 = color
            bead.BorderSizePixel = 0
            bead.ZIndex = zIndex + 3
            bead.Parent = holder
            local corner = Instance.new("UICorner")
            corner.CornerRadius = UDim.new(1, 0)
            corner.Parent = bead
        end
        ornament("Ruby", width * 0.28, height * 0.48, Color3.fromRGB(231, 77, 80))
        ornament("Gold", width * 0.64, height * 0.59, Color3.fromRGB(255, 210, 112))
        ornament("Snow", width * 0.42, height * 0.69, Color3.fromRGB(225, 241, 235))
        return holder
    end
    local sidebar = mainWindow:FindFirstChild("Sidebar")
    local content = mainWindow:FindFirstChild("Content")
    local topbar = content and content:FindFirstChild("Topbar")
    if sidebar then
        makeTree(sidebar, "SidebarChristmasTree", UDim2.new(1, -43, 0, 4), 38, 56, math.max(1, sidebar.ZIndex + 40))
        local accent = Instance.new("Frame")
        accent.Name = "ChristmasSidebarAccent"
        accent.Position = UDim2.new(0, 14, 0, 74)
        accent.Size = UDim2.new(1, -28, 0, 2)
        accent.BackgroundColor3 = Color3.fromRGB(184, 52, 61)
        accent.BorderSizePixel = 0
        accent.ZIndex = math.max(1, sidebar.ZIndex + 8)
        accent.Active = false
        accent.Parent = sidebar
        local accentGradient = Instance.new("UIGradient")
        accentGradient.Color = ColorSequence.new({
            ColorSequenceKeypoint.new(0, Color3.fromRGB(184, 52, 61)),
            ColorSequenceKeypoint.new(0.5, Color3.fromRGB(237, 191, 101)),
            ColorSequenceKeypoint.new(1, Color3.fromRGB(49, 148, 91)),
        })
        accentGradient.Parent = accent
    end
    local holidayBulbs = {}
    if topbar then
        local garland = Instance.new("Frame")
        garland.Name = "ChristmasGarland"
        garland.BackgroundTransparency = 1
        garland.BorderSizePixel = 0
        garland.Position = UDim2.new(0, 10, 1, -8)
        garland.Size = UDim2.new(1, -20, 0, 8)
        garland.Active = false
        garland.ZIndex = math.max(1, topbar.ZIndex + 35)
        garland.Parent = topbar
        local wire = Instance.new("Frame")
        wire.Name = "LightString"
        wire.Position = UDim2.new(0, 0, 0, 1)
        wire.Size = UDim2.new(1, 0, 0, 1)
        wire.BackgroundColor3 = Color3.fromRGB(125, 148, 94)
        wire.BackgroundTransparency = 0.2
        wire.BorderSizePixel = 0
        wire.ZIndex = garland.ZIndex
        wire.Parent = garland
        local bulbColors = {
            Color3.fromRGB(220, 73, 76),
            Color3.fromRGB(255, 211, 117),
            Color3.fromRGB(73, 187, 118),
            Color3.fromRGB(227, 239, 237),
        }
        for index = 1, 14 do
            local bulb = Instance.new("Frame")
            bulb.Name = "HolidayLight" .. tostring(index)
            bulb.AnchorPoint = Vector2.new(0.5, 0.5)
            bulb.Position = UDim2.new((index - 1) / 13, 0, 0.65, 0)
            bulb.Size = UDim2.fromOffset(5, 5)
            bulb.BackgroundColor3 = bulbColors[(index - 1) % #bulbColors + 1]
            bulb.BorderSizePixel = 0
            bulb.ZIndex = garland.ZIndex + 1
            bulb.Parent = garland
            local bulbCorner = Instance.new("UICorner")
            bulbCorner.CornerRadius = UDim.new(1, 0)
            bulbCorner.Parent = bulb
            local bulbStroke = Instance.new("UIStroke")
            bulbStroke.Color = Color3.fromRGB(255, 224, 164)
            bulbStroke.Transparency = 0.42
            bulbStroke.Thickness = 0.7
            bulbStroke.Parent = bulb
            holidayBulbs[#holidayBulbs + 1] = {
                Object = bulb,
                Stroke = bulbStroke,
                Phase = index * 0.72,
            }
        end
        local holly = Instance.new("TextLabel")
        holly.Name = "ChristmasHolly"
        holly.BackgroundTransparency = 1
        holly.BorderSizePixel = 0
        holly.Text = "✦"
        holly.Font = Enum.Font.GothamBlack
        holly.TextSize = 15
        holly.TextColor3 = Color3.fromRGB(255, 219, 143)
        holly.TextXAlignment = Enum.TextXAlignment.Center
        holly.TextYAlignment = Enum.TextYAlignment.Center
        holly.AnchorPoint = Vector2.new(1, 0)
        holly.Position = UDim2.new(1, -82, 0, 2)
        holly.Size = UDim2.fromOffset(18, 18)
        holly.Active = false
        holly.ZIndex = garland.ZIndex + 2
        holly.Parent = topbar
    end
    local border = Instance.new("UIStroke")
    border.Name = "ChristmasGoldOutline"
    border.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    border.Color = Color3.fromRGB(172, 133, 70)
    border.Thickness = 1
    border.Transparency = 0.48
    border.Parent = mainWindow
    local snow = Instance.new("Frame")
    snow.Name = "ChristmasSnowfall"
    snow.BackgroundTransparency = 1
    snow.BorderSizePixel = 0
    snow.Size = UDim2.fromScale(1, 1)
    snow.ClipsDescendants = true
    snow.Active = false
    snow.Selectable = false
    snow.ZIndex = 8500
    snow.Parent = mainWindow
    local flakes = {}
    local function createFlake(index)
        local label = Instance.new("TextLabel")
        label.Name = "Snowflake" .. tostring(index)
        label.BackgroundTransparency = 1
        label.BorderSizePixel = 0
        label.Text = index % 5 == 0 and "✧" or (index % 3 == 0 and "❅" or "❄")
        label.Font = Enum.Font.Gotham
        label.TextSize = math.random(9, 16)
        label.TextColor3 = Color3.fromRGB(231, 245, 240)
        label.TextTransparency = math.random(32, 58) / 100
        label.TextStrokeColor3 = Color3.fromRGB(97, 137, 116)
        label.TextStrokeTransparency = 0.82
        label.Size = UDim2.fromOffset(18, 18)
        label.Position = UDim2.fromOffset(math.random(0, math.max(1, mainWindow.AbsoluteSize.X)), math.random(0, math.max(1, mainWindow.AbsoluteSize.Y)))
        label.Active = false
        label.Selectable = false
        label.ZIndex = snow.ZIndex + 1
        label.Parent = snow
        return {
            Object = label,
            Speed = math.random(18, 47),
            Drift = math.random(-12, 12),
            Sway = math.random(3, 12),
            Phase = math.random() * math.pi * 2,
        }
    end
    for index = 1, 22 do
        flakes[index] = createFlake(index)
    end
    local snowConnection
    snowConnection = RunService.RenderStepped:Connect(function(deltaTime)
        if not snow.Parent or not mainWindow.Parent then
            if snowConnection then snowConnection:Disconnect() end
            return
        end
        if not mainWindow.Visible or not StarlightUI.Enabled then
            snow.Visible = false
            return
        end
        snow.Visible = true
        local size = mainWindow.AbsoluteSize
        for _, flake in ipairs(flakes) do
            local object = flake.Object
            if object.Parent then
                local x = object.Position.X.Offset + (flake.Drift + math.sin(os.clock() * 1.5 + flake.Phase) * flake.Sway) * deltaTime
                local y = object.Position.Y.Offset + flake.Speed * deltaTime
                if y > size.Y + 22 then
                    y = -22
                    x = math.random(0, math.max(1, size.X))
                end
                if x < -18 then x = size.X + 8 end
                if x > size.X + 18 then x = -8 end
                object.Position = UDim2.fromOffset(x, y)
            end
        end
        local clock = os.clock()
        for _, bulbData in ipairs(holidayBulbs) do
            if bulbData.Object.Parent then
                local pulse = (math.sin(clock * 2.1 + bulbData.Phase) + 1) * 0.5
                bulbData.Object.BackgroundTransparency = 0.03 + pulse * 0.22
                bulbData.Stroke.Transparency = 0.25 + pulse * 0.4
            end
        end
    end)
    StarlightUI.Destroying:Once(function()
        if snowConnection then snowConnection:Disconnect() end
    end)
end
]==]
source = source:sub(1, christmasDecorPosition - 1)
    .. christmasDecorSource
    .. "\n"
    .. source:sub(christmasDecorPosition)

if #patchWarnings > 0 then
    warn("[Starlight] " .. table.concat(patchWarnings, "; "))
end
updateBootScreen("Preloading interface assets", 0.70)
local preloadWaitStarted = os.clock()
local shownProgress = -1
while not starlightPreloadReady and os.clock() - preloadWaitStarted < 12 do
    local progress = 0.70 + 0.16 * math.clamp(starlightPreloadProgress, 0, 1)
    if progress - shownProgress >= 0.025 then
        updateBootScreen("Preloading interface assets", progress)
        shownProgress = progress
    end
    task.wait(0.08)
end
if not starlightPreloadReady then
    starlightPreloadCancelled = true
end
local environment = type(getgenv) == "function" and getgenv() or _G
if starlightTemplate and not starlightPreloadCancelled then
    environment[starlightPreloadKey] = starlightTemplate
end
updateBootScreen("Preparing interface", 0.89)
task.wait()
local compiled, compilationError = loadstring(source)
if not compiled then
    error("[Starlight] Source failed to compile: " .. tostring(compilationError))
end
task.wait()
updateBootScreen("Creating interface", 0.95)
local library = compiled()
pcall(function()
    if type(library) == "table" and type(library.SetTheme) == "function" and library.Themes and library.Themes.Christmas then
        library:SetTheme("Christmas")
    end
end)
return library

end

local succeeded, result = pcall(launchStarlight)
local environment = type(getgenv) == "function" and getgenv() or _G
if environment[starlightPreloadKey] == starlightTemplate then
    environment[starlightPreloadKey] = nil
end
starlightPreloadCancelled = true
if starlightTemplate then
    starlightTemplate:Destroy()
    starlightTemplate = nil
end
if succeeded then
    updateBootScreen("Ready", 1)
    task.wait(0.12)
    closeBootScreen()
    return result
end

updateBootScreen("Unable to load interface", 1)
task.wait(0.15)
closeBootScreen()
error(result, 0)
