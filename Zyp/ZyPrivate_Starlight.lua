local AuthPlayers = game:GetService("Players")
local AuthHttpService = game:GetService("HttpService")
local AuthPlayer = AuthPlayers.LocalPlayer
local SERVER_CONFIG = "https://zyphor.cc/server.txt"
local VALIDATION_INTERVAL = 20
local MAX_NETWORK_FAILURES = 3
local running = true
local terminating = false
local cleanupTasks = {}
local authKey
local authHwid
local authUserId
local licenseDeadline
local licenseExpiry
local requestFunction

if type(syn) == "table" and type(syn.request) == "function" then
    requestFunction = syn.request
elseif type(http_request) == "function" then
    requestFunction = http_request
elseif type(request) == "function" then
    requestFunction = request
elseif type(http) == "table" and type(http.request) == "function" then
    requestFunction = http.request
end

local function getHardwareId()
    local sources = {
        function() return type(gethwid) == "function" and gethwid() or nil end,
        function() return type(syn) == "table" and type(syn.gethwid) == "function" and syn.gethwid() or nil end,
        function()
            if type(getgenv) == "function" then
                local env = getgenv()
                if type(env) == "table" and type(env.gethwid) == "function" then
                    return env.gethwid()
                end
            end
            return nil
        end
    }
    for _, source in ipairs(sources) do
        local ok, result = pcall(source)
        if ok and result ~= nil and tostring(result) ~= "" then
            return tostring(result)
        end
    end
    return nil
end

local function getExpiry(value)
    if type(value) == "number" then
        return value > 100000000000 and math.floor(value / 1000) or value
    end
    if type(value) ~= "string" or value == "" then
        return nil
    end
    local ok, date = pcall(function() return DateTime.fromIsoDate(value) end)
    if ok and date then
        return date.UnixTimestamp
    end
    local year, month, day, hour, minute, second = value:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)[Tt ](%d%d):(%d%d):(%d%d)")
    if not year then
        return nil
    end
    local success, timestamp = pcall(function()
        return DateTime.fromUniversalTime(tonumber(year), tonumber(month), tonumber(day), tonumber(hour), tonumber(minute), tonumber(second)).UnixTimestamp
    end)
    return success and timestamp or nil
end

local function shutdown(reason, shouldKick, skipStarlight)
    if terminating then
        return
    end
    terminating = true
    running = false
    for index = #cleanupTasks, 1, -1 do
        local entry = cleanupTasks[index]
        if not (skipStarlight and entry.starlight) then
            pcall(entry.callback)
        end
    end
    if shouldKick then
        pcall(function() AuthPlayer:Kick(reason or "Invalid key") end)
    end
end

local function addTask(callback, isStarlight)
    table.insert(cleanupTasks, { callback = callback, starlight = isStarlight == true })
end

local function validate()
    if getHardwareId() ~= authHwid or AuthPlayer.UserId ~= authUserId then
        return "invalid", "HWID or account changed."
    end
    if licenseExpiry and os.time() >= licenseExpiry then
        return "invalid", "Key expired."
    end
    if licenseDeadline and os.clock() >= licenseDeadline then
        return "invalid", "Key expired."
    end
    if not requestFunction then
        return "unavailable", "HTTP requests are unsupported."
    end
    local configOk, base = pcall(function()
        local response = requestFunction({ Url = SERVER_CONFIG, Method = "GET" })
        if type(response) ~= "table" then
            error("Missing server configuration.")
        end
        local status = tonumber(response.StatusCode or response.Status or 0) or 0
        if status < 200 or status >= 300 then
            error("Cannot fetch server configuration.")
        end
        local value = tostring(response.Body or ""):gsub("%s+", ""):gsub("/+$", "")
        if not value:match("^https?://[%w%.%-]+") then
            error("Invalid server configuration.")
        end
        return value
    end)
    if not configOk then
        return "unavailable", tostring(base)
    end
    local requestOk, response = pcall(function()
        return requestFunction({
            Url = base .. "/key-system/validate",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = AuthHttpService:JSONEncode({
                key = authKey,
                hwid = authHwid,
                account = AuthPlayer.Name .. " (" .. tostring(AuthPlayer.UserId) .. ")"
            })
        })
    end)
    if not requestOk or type(response) ~= "table" then
        return "unavailable", "Unable to reach key server."
    end
    local status = tonumber(response.StatusCode or response.Status or 0) or 0
    local decodedOk, data = pcall(function()
        return AuthHttpService:JSONDecode(tostring(response.Body or ""))
    end)
    if not decodedOk or type(data) ~= "table" then
        return "unavailable", "Invalid key server response."
    end
    if status == 429 or status >= 500 or status == 0 then
        return "unavailable", "Key server temporarily unavailable."
    end
    if data.valid == false or data.expired == true or data.disabled == true then
        return "invalid", tostring(data.message or data.error or "Invalid key")
    end
    if status < 200 or status >= 300 then
        return "invalid", tostring(data.message or data.error or "Invalid key")
    end
    if data.valid ~= true then
        return "invalid", "Key was not verified."
    end
    if data.hwid ~= nil and tostring(data.hwid) ~= "" and tostring(data.hwid) ~= authHwid then
        return "invalid", "HWID does not match."
    end
    local expiry = getExpiry(data.expiresAt)
    if expiry then
        licenseExpiry = expiry
        if os.time() >= expiry then
            return "invalid", "Key expired."
        end
    end
    if data.remainingMs ~= nil then
        local remaining = tonumber(data.remainingMs)
        if remaining and remaining <= 0 then
            return "invalid", "Key expired."
        end
        if remaining then
            licenseDeadline = os.clock() + remaining / 1000
        end
    end
    return "valid", data
end

if type(getgenv) == "function" then
    local ok, env = pcall(getgenv)
    if ok and type(env) == "table" and type(env.ZyPrivateShutdown) == "function" then
        pcall(env.ZyPrivateShutdown)
    end
end

local GuiService = game:GetService("GuiService")
local KEY_PAGE = "https://zyphor.cc/getnewkey"
local TOS_PAGE = "https://zyphor.cc/tos.html"
local PP_PAGE = "https://zyphor.cc/pp.html"
local TEAM_PAGE = "https://zyphor.cc/TeamVaprix"
local Starlight = loadstring(game:HttpGet("https://raw.nebulasoftworks.xyz/starlight"))()
local NebulaIcons = loadstring(game:HttpGet("https://raw.nebulasoftworks.xyz/nebula-icon-library-loader"))()

addTask(function()
    Starlight:Destroy()
end, true)

Starlight:OnDestroy(function()
    shutdown(nil, false, true)
end)

local Window = Starlight:CreateWindow({
    Name = "Zy - Private",
    Subtitle = "v1.7 • Key System",
    Icon = 123456789,
    LoadingSettings = {
        Title = "Hold Your Squirtles 💀",
        Subtitle = "Loading ZyPrivate and connecting to the key system."
    },
    FileSettings = {
        ConfigFolder = "Zy - Private"
    }
})

local AccessSection = Window:CreateTabSection("Access 🔑")
local AccessTab = AccessSection:CreateTab({
    Name = "Key System",
    Icon = NebulaIcons:GetIcon("key-round", "Lucide"),
    Columns = 2
}, "ZyphorKeySystemTab")
local VerificationGroup = AccessTab:CreateGroupbox({
    Name = "License Verification",
    Column = 1
}, "ZyphorLicenseVerification")
local InformationGroup = AccessTab:CreateGroupbox({
    Name = "License Information",
    Column = 2
}, "ZyphorLicenseInformation")
local LinksGroup = AccessTab:CreateGroupbox({
    Name = "Links",
    Column = 2
}, "ZyphorLicenseLinks")

local statusText = "Locked — enter your Zyphor key."
local enteredKey = ""
local verified = false
local verifying = false
local retries = 0
local licenceInfo = nil
local buildMainGui

local StatusLabel = VerificationGroup:CreateParagraph({
    Name = "Access Status",
    Content = statusText
}, "ZyphorAccessStatus")

local KeyInput = VerificationGroup:CreateInput({
    Name = "License Key",
    CurrentValue = "",
    PlaceholderText = "Paste your Zyphor key here",
    RemoveTextOnFocus = false,
    RemoveTextAfterFocusLost = false,
    Numeric = false,
    Enter = false,
    MaxCharacters = 256,
    Callback = function(value)
        if not verified then
            enteredKey = tostring(value or "")
        end
    end
}, "ZyphorLicenseInput")

local HwidLabel = InformationGroup:CreateParagraph({
    Name = "HWID",
    Content = getHardwareId() and "Available — the key is bound to your device." or "Unavailable — HWID support is required."
}, "ZyphorHardwareStatus")
local AccountLabel = InformationGroup:CreateParagraph({
    Name = "Account",
    Content = AuthPlayer.Name .. " (" .. tostring(AuthPlayer.UserId) .. ")"
}, "ZyphorLicenseAccount")
local ExpiryLabel = InformationGroup:CreateParagraph({
    Name = "Expires",
    Content = "Verify a key to see its expiration."
}, "ZyphorLicenseExpiry")
local MonitoringLabel = InformationGroup:CreateParagraph({
    Name = "Validation",
    Content = "Checks every 20 seconds after unlocking."
}, "ZyphorLicenseMonitoring")

local function updateLabel(element, name, content)
    if not running or terminating then
        return
    end
    pcall(function()
        element:Set({ Name = name, Content = tostring(content) })
    end)
end

local function setStatus(message)
    statusText = tostring(message)
    updateLabel(StatusLabel, "Access Status", statusText)
end

local function remainingText()
    local remaining
    if licenseExpiry then
        remaining = math.max(0, licenseExpiry - os.time())
    elseif licenseDeadline then
        remaining = math.max(0, licenseDeadline - os.clock())
    end
    if remaining == nil then
        return "Active — expiry not provided by server."
    end
    remaining = math.floor(remaining)
    if remaining <= 0 then
        return "Expired"
    end
    local days = math.floor(remaining / 86400)
    local hours = math.floor(remaining % 86400 / 3600)
    local minutes = math.floor(remaining % 3600 / 60)
    local seconds = remaining % 60
    if days > 0 then
        return string.format("%dd %dh %dm", days, hours, minutes)
    end
    if hours > 0 then
        return string.format("%dh %dm %ds", hours, minutes, seconds)
    end
    return string.format("%dm %ds", minutes, seconds)
end

local function openLink(url)
    local opened = false
    if type(syn) == "table" and type(syn.open_url) == "function" then
        opened = pcall(syn.open_url, url)
    end
    if not opened and type(open_url) == "function" then
        opened = pcall(open_url, url)
    end
    if not opened then
        opened = pcall(function()
            GuiService:OpenBrowserWindow(url)
        end)
    end
    if not opened and type(setclipboard) == "function" then
        opened = pcall(setclipboard, url)
        if opened then
            setStatus("Link copied to your clipboard: " .. url)
        end
    end
    if not opened then
        setStatus("Open in your browser: " .. url)
    end
end

LinksGroup:CreateButton({
    Name = "Get Free Key",
    Style = 2,
    Callback = function()
        openLink(KEY_PAGE)
    end
}, "ZyphorGetKey")
LinksGroup:CreateButton({
    Name = "Terms of Service",
    Style = 2,
    Callback = function()
        openLink(TOS_PAGE)
    end
}, "ZyphorTerms")
LinksGroup:CreateButton({
    Name = "Privacy Policy",
    Style = 2,
    Callback = function()
        openLink(PP_PAGE)
    end
}, "ZyphorPrivacy")
LinksGroup:CreateButton({
    Name = "Team Vaprix",
    Style = 2,
    Callback = function()
        openLink(TEAM_PAGE)
    end
}, "ZyphorTeam")

buildMainGui = function()
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
addTask(function()
    RunService:UnbindFromRenderStep("ZyPrivateAimAssistRenderStep")
    RunService:UnbindFromRenderStep("ZyPrivateESPRenderStep")
end)
local Workspace = game:GetService("Workspace")
local UserInputService = game:GetService("UserInputService")

local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")
local Mouse = LocalPlayer:GetMouse()

Window:CreateHomeTab({
    SupportedExecutors = {},
    UnsupportedExecutors = {},

    DiscordInvite = "1234",
    Backdrop = nil,
    IconStyle = 1,

    Changelog = {
        {
            Title = "Free Key Access",
            Date = "26th October 2026",
            Description = "Added free Zyphor key verification using the existing server.txt API. Keys are free, with no Linkvertise or ads. All script tabs unlock after successful key verification.",
        },
        {
            Title = "Aim Assist Release",
            Date = "26th October 2026",
            Description = "Added Aim Assist with adjustable strength, configurable FOV up to 1000, team checking, and a toggle to show or hide the FOV circle.\n\nAdded mouse-based aiming in third person and center-screen aiming in first person.\n\nImproved FOV circle positioning and fixed mouse input handling.",
        },
        {
            Title = "Aim Assist Controls",
            Date = "26th October 2026",
            Description = "Added a configurable Aim Assist keybind, defaulting to Q.\n\nAdded a target-part dropdown with Head, HumanoidRootPart, and Torso options.\n\nAdded wall checking using raycasting to prevent targeting players behind obstacles.",
        },
        {
            Title = "ESP Visuals Update",
            Date = "26th October 2026",
            Description = "Added configurable ESP box styles, including 2D boxes, 3D boxes, and corner boxes.\n\nAdded individual controls for enabling and disabling boxes, names, chams, and skeleton visuals.",
        },
        {
            Title = "ESP Customization",
            Date = "26th October 2026",
            Description = "Added separate settings groupboxes for Names, Chams, and Skeleton.\n\nAdded configurable visual colors, team checks, wall checks using raycasts, display names, transparency controls, and size settings.",
        },
        {
            Title = "Configuration System",
            Date = "26th October 2026",
            Description = "Added Starlight configuration management support for saving, loading, and managing multiple configurations.\n\nAdded support for selecting an autoload configuration.",
        },
        {
            Title = "Theme Customization",
            Date = "26th October 2026",
            Description = "Added Starlight theme management support, allowing users to customize the interface, select preset themes, save custom themes, and configure automatic theme loading.",
        },
    }
})
local AimSection = Window:CreateTabSection("Aim🎯")
local VisualSection = Window:CreateTabSection("Visual👁️")
local MiscSection = Window:CreateTabSection("Misc🎲")
local SettingsSection = Window:CreateTabSection("Settings⚙️")

local LegitTab = AimSection:CreateTab({
    Name = "Legit",
    Icon = NebulaIcons:GetIcon("view_in_ar", "Material"),
    Columns = 2,
}, "LegitTab")

local AimbotGroupbox = LegitTab:CreateGroupbox({
    Name = "Aimbot",
    Column = 1,
}, "AimbotGroupbox")

local AimAssistGroupbox = LegitTab:CreateGroupbox({
    Name = "Aim Assist",
    Column = 2,
}, "AimAssistGroupbox")

local VisualTab = VisualSection:CreateTab({
    Name = "ESP",
    Icon = NebulaIcons:GetIcon("eye", "Lucide"),
    Columns = 2,
}, "VisualTab")

local BoxesGroupbox = VisualTab:CreateGroupbox({
    Name = "Boxes",
    Column = 1,
}, "BoxesGroupbox")

local NamesGroupbox = VisualTab:CreateGroupbox({
    Name = "Names",
    Column = 2,
}, "NamesGroupbox")

local ChamsGroupbox = VisualTab:CreateGroupbox({
    Name = "Chams",
    Column = 1,
}, "ChamsGroupbox")

local SkeletonGroupbox = VisualTab:CreateGroupbox({
    Name = "Skeleton",
    Column = 2,
}, "SkeletonGroupbox")

local SettingsTab = SettingsSection:CreateTab({
    Name = "Configurations",
    Icon = NebulaIcons:GetIcon("settings", "Lucide"),
    Columns = 2,
}, "ConfigurationsTab")

local MiscTab = MiscSection:CreateTab({
    Name = "General",
    Icon = NebulaIcons:GetIcon("sliders-horizontal", "Lucide"),
    Columns = 1,
}, "MiscTab")

local MiscGroupbox = MiscTab:CreateGroupbox({
    Name = "Miscellaneous",
    Column = 1,
}, "MiscGroupbox")

local AimAssistSettings = {
    Enabled = false,
    ShowFov = false,
    TeamCheck = false,
    WallCheck = false,
    Fov = 100,
    Strength = 50,
    TargetPart = "Head"
}

local ESPSettings = {
    BoxesEnabled = false,
    BoxMode = "2D Boxes",
    BoxTeamCheck = false,
    BoxWallCheck = false,
    BoxUseTeamColor = false,
    BoxColorName = "Blue",
    BoxTransparency = 20,
    BoxThickness = 2,
    NamesEnabled = false,
    DisplayName = true,
    NamesTeamCheck = false,
    NamesWallCheck = false,
    NamesUseTeamColor = false,
    NamesColorName = "Blue",
    NamesTransparency = 20,
    NamesTextSize = 13,
    ChamsEnabled = false,
    ChamsTeamCheck = false,
    ChamsWallCheck = false,
    ChamsUseTeamColor = false,
    ChamsColorName = "Blue",
    ChamsTransparency = 20,
    SkeletonEnabled = false,
    SkeletonTeamCheck = false,
    SkeletonWallCheck = false,
    SkeletonUseTeamColor = false,
    SkeletonColorName = "Blue",
    SkeletonTransparency = 20,
    SkeletonThickness = 2
}

local ESPColors = {
    Blue = Color3.fromRGB(90, 160, 255),
    Red = Color3.fromRGB(255, 85, 85),
    Green = Color3.fromRGB(75, 235, 135),
    Purple = Color3.fromRGB(190, 110, 255),
    White = Color3.fromRGB(245, 245, 245),
    Yellow = Color3.fromRGB(255, 220, 75),
    Cyan = Color3.fromRGB(65, 235, 235),
    Orange = Color3.fromRGB(255, 155, 65)
}

local ExistingGui = PlayerGui:FindFirstChild("ZyPrivateOverlayGui")
if ExistingGui then
    ExistingGui:Destroy()
end

local OverlayGui = Instance.new("ScreenGui")
OverlayGui.Name = "ZyPrivateOverlayGui"
OverlayGui.IgnoreGuiInset = true
OverlayGui.ResetOnSpawn = false
OverlayGui.DisplayOrder = 9999
OverlayGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
OverlayGui.Parent = PlayerGui
addTask(function()
    if OverlayGui.Parent then
        OverlayGui:Destroy()
    end
end)

local FovCircle = Instance.new("Frame")
FovCircle.Name = "AimAssistFovCircle"
FovCircle.AnchorPoint = Vector2.new(0.5, 0.5)
FovCircle.BackgroundTransparency = 1
FovCircle.BorderSizePixel = 0
FovCircle.Position = UDim2.fromScale(0.5, 0.5)
FovCircle.Size = UDim2.fromOffset(200, 200)
FovCircle.Visible = false
FovCircle.Parent = OverlayGui

local FovCorner = Instance.new("UICorner")
FovCorner.CornerRadius = UDim.new(1, 0)
FovCorner.Parent = FovCircle

local FovStroke = Instance.new("UIStroke")
FovStroke.Color = Color3.fromRGB(130, 170, 255)
FovStroke.Thickness = 1.5
FovStroke.Transparency = 0.15
FovStroke.Parent = FovCircle

local function IsFirstPerson(Camera)
    if LocalPlayer.CameraMode == Enum.CameraMode.LockFirstPerson then
        return true
    end

    local Character = LocalPlayer.Character
    local Head = Character and Character:FindFirstChild("Head")

    if Head and Camera then
        return (Camera.CFrame.Position - Head.Position).Magnitude <= 1.25
    end

    return false
end

local function GetMousePosition()
    local Success, Position = pcall(function()
        return UserInputService:GetMouseLocation()
    end)

    if Success and typeof(Position) == "Vector2" then
        return Position
    end

    local MouseSuccess, MousePosition = pcall(function()
        return Vector2.new(Mouse.X, Mouse.Y)
    end)

    if MouseSuccess and typeof(MousePosition) == "Vector2" then
        return MousePosition
    end

    return nil
end

local function GetAimPosition(Camera)
    local ViewportSize = Camera.ViewportSize

    if IsFirstPerson(Camera) then
        return Vector2.new(ViewportSize.X / 2, ViewportSize.Y / 2)
    end

    return GetMousePosition() or Vector2.new(ViewportSize.X / 2, ViewportSize.Y / 2)
end

local function GetAimTargetPart(Character)
    if AimAssistSettings.TargetPart == "Head" then
        return Character:FindFirstChild("Head")
    elseif AimAssistSettings.TargetPart == "HumanoidRootPart" then
        return Character:FindFirstChild("HumanoidRootPart")
    elseif AimAssistSettings.TargetPart == "Torso" then
        return Character:FindFirstChild("UpperTorso")
            or Character:FindFirstChild("Torso")
            or Character:FindFirstChild("LowerTorso")
            or Character:FindFirstChild("HumanoidRootPart")
    end

    return Character:FindFirstChild("Head")
end

local function UpdateFovCircle(Camera)
    if not Camera or not AimAssistSettings.Enabled or not AimAssistSettings.ShowFov then
        FovCircle.Visible = false
        return
    end

    local AimPosition = GetAimPosition(Camera)
    local Diameter = AimAssistSettings.Fov * 2

    FovCircle.Position = UDim2.fromOffset(AimPosition.X, AimPosition.Y)
    FovCircle.Size = UDim2.fromOffset(Diameter, Diameter)
    FovCircle.Visible = true
end

local function IsAimTargetVisible(Character, TargetPart, Camera)
    if not AimAssistSettings.WallCheck then
        return true
    end

    if not Character or not TargetPart or not Camera then
        return false
    end

    local Origin = Camera.CFrame.Position
    local Direction = TargetPart.Position - Origin
    if Direction.Magnitude <= 0 then
        return true
    end

    local Params = RaycastParams.new()
    Params.FilterType = Enum.RaycastFilterType.Exclude
    Params.FilterDescendantsInstances = {LocalPlayer.Character}
    Params.IgnoreWater = true
    Params.RespectCanCollide = false

    local Result = Workspace:Raycast(Origin, Direction, Params)
    return not Result or Result.Instance:IsDescendantOf(Character)
end

local function GetAimTarget(Camera)
    local AimPosition = GetAimPosition(Camera)
    local BestTarget
    local BestDistance = AimAssistSettings.Fov

    if BestDistance <= 0 then
        return nil
    end

    for _, Player in ipairs(Players:GetPlayers()) do
        if Player ~= LocalPlayer then
            local Eligible = true

            if AimAssistSettings.TeamCheck and LocalPlayer.Team ~= nil and Player.Team == LocalPlayer.Team then
                Eligible = false
            end

            if Eligible then
                local Character = Player.Character
                local Humanoid = Character and Character:FindFirstChildOfClass("Humanoid")
                local TargetPart = Character and GetAimTargetPart(Character)

                if Humanoid and Humanoid.Health > 0 and TargetPart then
                    local ScreenPosition, OnScreen = Camera:WorldToViewportPoint(TargetPart.Position)

                    if OnScreen and ScreenPosition.Z > 0 and IsAimTargetVisible(Character, TargetPart, Camera) then
                        local Distance = (Vector2.new(ScreenPosition.X, ScreenPosition.Y) - AimPosition).Magnitude

                        if Distance <= BestDistance then
                            BestDistance = Distance
                            BestTarget = TargetPart
                        end
                    end
                end
            end
        end
    end

    return BestTarget
end

local ESPObjects = {}

local function CreateLine(Parent, Name)
    local Line = Instance.new("Frame")
    Line.Name = Name
    Line.AnchorPoint = Vector2.new(0.5, 0.5)
    Line.BorderSizePixel = 0
    Line.BackgroundColor3 = ESPColors.Blue
    Line.BackgroundTransparency = 0.2
    Line.Visible = false
    Line.Parent = Parent
    return Line
end

local function CreateESPObjects(Player)
    if Player == LocalPlayer or ESPObjects[Player] then
        return
    end

    local Data = {}

    Data.Box2D = Instance.new("Frame")
    Data.Box2D.Name = "ESP2DBox_" .. Player.UserId
    Data.Box2D.BackgroundTransparency = 1
    Data.Box2D.BorderSizePixel = 0
    Data.Box2D.Visible = false
    Data.Box2D.Parent = OverlayGui

    Data.Box2DStroke = Instance.new("UIStroke")
    Data.Box2DStroke.Thickness = ESPSettings.BoxThickness
    Data.Box2DStroke.Transparency = ESPSettings.BoxTransparency / 100
    Data.Box2DStroke.Color = ESPColors[ESPSettings.BoxColorName]
    Data.Box2DStroke.Parent = Data.Box2D

    Data.CornerLines = {}
    for Index = 1, 8 do
        Data.CornerLines[Index] = CreateLine(OverlayGui, "ESPCorner_" .. Player.UserId .. "_" .. Index)
    end

    Data.SkeletonLines = {}
    for Index = 1, 14 do
        Data.SkeletonLines[Index] = CreateLine(OverlayGui, "ESPSkeleton_" .. Player.UserId .. "_" .. Index)
    end

    Data.NameLabel = Instance.new("TextLabel")
    Data.NameLabel.Name = "ESPName_" .. Player.UserId
    Data.NameLabel.AnchorPoint = Vector2.new(0.5, 1)
    Data.NameLabel.BackgroundTransparency = 1
    Data.NameLabel.BorderSizePixel = 0
    Data.NameLabel.Font = Enum.Font.GothamSemibold
    Data.NameLabel.TextSize = ESPSettings.NamesTextSize
    Data.NameLabel.TextStrokeTransparency = 0.2
    Data.NameLabel.TextColor3 = ESPColors[ESPSettings.NamesColorName]
    Data.NameLabel.Size = UDim2.fromOffset(220, 18)
    Data.NameLabel.Visible = false
    Data.NameLabel.Parent = OverlayGui

    Data.Highlight = Instance.new("Highlight")
    Data.Highlight.Name = "ESPHighlight_" .. Player.UserId
    Data.Highlight.Enabled = false
    Data.Highlight.FillColor = ESPColors[ESPSettings.ChamsColorName]
    Data.Highlight.OutlineColor = ESPColors[ESPSettings.ChamsColorName]
    Data.Highlight.FillTransparency = ESPSettings.ChamsTransparency / 100
    Data.Highlight.OutlineTransparency = ESPSettings.ChamsTransparency / 100
    Data.Highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
    Data.Highlight.Parent = Workspace

    Data.Box3D = {}
    for Index = 1, 12 do
        local Edge = Instance.new("Part")
        Edge.Name = "ESP3DEdge_" .. Player.UserId .. "_" .. Index
        Edge.Anchored = true
        Edge.CanCollide = false
        Edge.CanTouch = false
        Edge.CanQuery = false
        Edge.CastShadow = false
        Edge.Material = Enum.Material.Neon
        Edge.Color = ESPColors[ESPSettings.BoxColorName]
        Edge.Transparency = 1
        Edge.Size = Vector3.new(0.03, 0.03, 1)
        Edge.Parent = Workspace
        Data.Box3D[Index] = Edge
    end

    ESPObjects[Player] = Data
end

local function HideESP(Data)
    Data.Box2D.Visible = false
    for _, Line in ipairs(Data.CornerLines) do
        Line.Visible = false
    end
    for _, Line in ipairs(Data.SkeletonLines) do
        Line.Visible = false
    end
    Data.NameLabel.Visible = false
    Data.Highlight.Enabled = false
    for _, Edge in ipairs(Data.Box3D) do
        Edge.Transparency = 1
    end
end

local function RemoveESPObjects(Player)
    local Data = ESPObjects[Player]
    if not Data then
        return
    end

    Data.Box2D:Destroy()
    for _, Line in ipairs(Data.CornerLines) do
        Line:Destroy()
    end
    for _, Line in ipairs(Data.SkeletonLines) do
        Line:Destroy()
    end
    Data.NameLabel:Destroy()
    Data.Highlight:Destroy()
    for _, Edge in ipairs(Data.Box3D) do
        Edge:Destroy()
    end

    ESPObjects[Player] = nil
end

addTask(function()
    for Player in pairs(ESPObjects) do
        RemoveESPObjects(Player)
    end
end)

local function GetESPColor(Player, Feature)
    if ESPSettings[Feature .. "UseTeamColor"] and Player.Team then
        return Player.Team.TeamColor.Color
    end

    return ESPColors[ESPSettings[Feature .. "ColorName"]] or ESPColors.Blue
end

local function IsFeatureVisible(Player, Character, TargetPart, Camera, Feature)
    if ESPSettings[Feature .. "TeamCheck"]
        and LocalPlayer.Team ~= nil
        and Player.Team == LocalPlayer.Team then
        return false
    end

    if not ESPSettings[Feature .. "WallCheck"] then
        return true
    end

    if not Camera or not Character or not TargetPart then
        return false
    end

    local Origin = Camera.CFrame.Position
    local Direction = TargetPart.Position - Origin

    if Direction.Magnitude <= 0 then
        return true
    end

    local Params = RaycastParams.new()
    Params.FilterType = Enum.RaycastFilterType.Exclude
    Params.FilterDescendantsInstances = {LocalPlayer.Character}
    Params.IgnoreWater = true
    Params.RespectCanCollide = false

    local Result = Workspace:Raycast(Origin, Direction, Params)
    return not Result or Result.Instance:IsDescendantOf(Character)
end

local function GetCharacterCorners(Character)
    local Success, BoundingCFrame, BoundingSize = pcall(function()
        return Character:GetBoundingBox()
    end)

    if not Success or not BoundingCFrame or not BoundingSize then
        return nil
    end

    local Half = BoundingSize / 2
    local Offsets = {
        Vector3.new(-Half.X, -Half.Y, -Half.Z),
        Vector3.new(Half.X, -Half.Y, -Half.Z),
        Vector3.new(-Half.X, Half.Y, -Half.Z),
        Vector3.new(Half.X, Half.Y, -Half.Z),
        Vector3.new(-Half.X, -Half.Y, Half.Z),
        Vector3.new(Half.X, -Half.Y, Half.Z),
        Vector3.new(-Half.X, Half.Y, Half.Z),
        Vector3.new(Half.X, Half.Y, Half.Z)
    }

    local WorldCorners = {}
    local ScreenCorners = {}
    local Camera = Workspace.CurrentCamera

    if not Camera then
        return nil
    end

    for Index, Offset in ipairs(Offsets) do
        local WorldPosition = BoundingCFrame:PointToWorldSpace(Offset)
        WorldCorners[Index] = WorldPosition
        local ScreenPosition = Camera:WorldToViewportPoint(WorldPosition)
        ScreenCorners[Index] = {
            Position = Vector2.new(ScreenPosition.X, ScreenPosition.Y),
            Z = ScreenPosition.Z
        }
    end

    return WorldCorners, ScreenCorners, BoundingCFrame, BoundingSize
end

local BoxEdges = {
    {1, 2}, {1, 3}, {2, 4}, {3, 4},
    {5, 6}, {5, 7}, {6, 8}, {7, 8},
    {1, 5}, {2, 6}, {3, 7}, {4, 8}
}

local CornerDefinitions = {
    {"H", 0, 0, 1, 0},
    {"V", 0, 0, 0, 1},
    {"H", 1, 0, -1, 0},
    {"V", 1, 0, 0, 1},
    {"H", 0, 1, 1, 0},
    {"V", 0, 1, 0, -1},
    {"H", 1, 1, -1, 0},
    {"V", 1, 1, 0, -1}
}

local SkeletonConnections = {
    {{"Head"}, {"UpperTorso", "Torso"}},
    {{"UpperTorso", "Torso"}, {"LowerTorso", "HumanoidRootPart"}},
    {{"UpperTorso", "Torso"}, {"LeftUpperArm", "Left Arm"}},
    {{"LeftUpperArm", "Left Arm"}, {"LeftLowerArm"}},
    {{"LeftLowerArm"}, {"LeftHand"}},
    {{"UpperTorso", "Torso"}, {"RightUpperArm", "Right Arm"}},
    {{"RightUpperArm", "Right Arm"}, {"RightLowerArm"}},
    {{"RightLowerArm"}, {"RightHand"}},
    {{"LowerTorso", "Torso", "HumanoidRootPart"}, {"LeftUpperLeg", "Left Leg"}},
    {{"LeftUpperLeg", "Left Leg"}, {"LeftLowerLeg"}},
    {{"LeftLowerLeg"}, {"LeftFoot"}},
    {{"LowerTorso", "Torso", "HumanoidRootPart"}, {"RightUpperLeg", "Right Leg"}},
    {{"RightUpperLeg", "Right Leg"}, {"RightLowerLeg"}},
    {{"RightLowerLeg"}, {"RightFoot"}}
}

local function FindFirstPart(Character, Names)
    for _, Name in ipairs(Names) do
        local Part = Character:FindFirstChild(Name)
        if Part and Part:IsA("BasePart") then
            return Part
        end
    end
    return nil
end

local function SetScreenLine(Line, StartPosition, EndPosition, Color, Thickness, Transparency)
    local Delta = EndPosition - StartPosition
    local Length = Delta.Magnitude

    if Length < 1 then
        Line.Visible = false
        return
    end

    Line.Position = UDim2.fromOffset(
        (StartPosition.X + EndPosition.X) / 2,
        (StartPosition.Y + EndPosition.Y) / 2
    )
    Line.Size = UDim2.fromOffset(Length, Thickness)
    Line.Rotation = math.deg(math.atan2(Delta.Y, Delta.X))
    Line.BackgroundColor3 = Color
    Line.BackgroundTransparency = Transparency
    Line.Visible = true
end

local function UpdateESPForPlayer(Player, Data, Camera)
    if not Camera then
        HideESP(Data)
        return
    end

    local Character = Player.Character
    local Humanoid = Character and Character:FindFirstChildOfClass("Humanoid")
    local Root = Character and Character:FindFirstChild("HumanoidRootPart")
    local TargetPart = Character and (Character:FindFirstChild("Head") or Root)

    if not Character or not Humanoid or Humanoid.Health <= 0 or not Root or not TargetPart then
        HideESP(Data)
        return
    end

    local BoxesVisible = ESPSettings.BoxesEnabled and IsFeatureVisible(Player, Character, TargetPart, Camera, "Box")
    local NamesVisible = ESPSettings.NamesEnabled and IsFeatureVisible(Player, Character, TargetPart, Camera, "Names")
    local ChamsVisible = ESPSettings.ChamsEnabled and IsFeatureVisible(Player, Character, TargetPart, Camera, "Chams")
    local SkeletonVisible = ESPSettings.SkeletonEnabled and IsFeatureVisible(Player, Character, TargetPart, Camera, "Skeleton")

    if not BoxesVisible and not NamesVisible and not ChamsVisible and not SkeletonVisible then
        HideESP(Data)
        return
    end

    local WorldCorners, ScreenCorners, BoundingCFrame, BoundingSize = GetCharacterCorners(Character)

    if not WorldCorners or not ScreenCorners then
        HideESP(Data)
        return
    end

    local MinX = math.huge
    local MinY = math.huge
    local MaxX = -math.huge
    local MaxY = -math.huge
    local ValidPoints = 0

    for _, Point in ipairs(ScreenCorners) do
        if Point.Z > 0 then
            MinX = math.min(MinX, Point.Position.X)
            MinY = math.min(MinY, Point.Position.Y)
            MaxX = math.max(MaxX, Point.Position.X)
            MaxY = math.max(MaxY, Point.Position.Y)
            ValidPoints = ValidPoints + 1
        end
    end

    local ViewportSize = Camera.ViewportSize
    if ValidPoints == 0 or MaxX < 0 or MaxY < 0 or MinX > ViewportSize.X or MinY > ViewportSize.Y then
        HideESP(Data)
        return
    end

    MinX = math.clamp(MinX, 0, ViewportSize.X)
    MinY = math.clamp(MinY, 0, ViewportSize.Y)
    MaxX = math.clamp(MaxX, 0, ViewportSize.X)
    MaxY = math.clamp(MaxY, 0, ViewportSize.Y)

    local Width = math.max(1, MaxX - MinX)
    local Height = math.max(1, MaxY - MinY)
    local CenterX = MinX + Width / 2

    local BoxColor = GetESPColor(Player, "Box")
    local BoxTransparency = math.clamp(ESPSettings.BoxTransparency / 100, 0, 1)
    local BoxThickness = math.clamp(ESPSettings.BoxThickness, 1, 8)
    local Is2DBox = BoxesVisible and ESPSettings.BoxMode == "2D Boxes"
    local IsCornerBox = BoxesVisible and ESPSettings.BoxMode == "Corner Boxes"
    local Is3DBox = BoxesVisible and ESPSettings.BoxMode == "3D Boxes"

    Data.Box2DStroke.Color = BoxColor
    Data.Box2DStroke.Thickness = BoxThickness
    Data.Box2DStroke.Transparency = BoxTransparency
    Data.Box2D.Position = UDim2.fromOffset(MinX, MinY)
    Data.Box2D.Size = UDim2.fromOffset(Width, Height)
    Data.Box2D.Visible = Is2DBox

    local CornerLengthX = math.max(4, Width * 0.25)
    local CornerLengthY = math.max(4, Height * 0.2)
    local CornerSegments = {
        {Vector2.new(MinX, MinY), Vector2.new(MinX + CornerLengthX, MinY)},
        {Vector2.new(MinX, MinY), Vector2.new(MinX, MinY + CornerLengthY)},
        {Vector2.new(MaxX, MinY), Vector2.new(MaxX - CornerLengthX, MinY)},
        {Vector2.new(MaxX, MinY), Vector2.new(MaxX, MinY + CornerLengthY)},
        {Vector2.new(MinX, MaxY), Vector2.new(MinX + CornerLengthX, MaxY)},
        {Vector2.new(MinX, MaxY), Vector2.new(MinX, MaxY - CornerLengthY)},
        {Vector2.new(MaxX, MaxY), Vector2.new(MaxX - CornerLengthX, MaxY)},
        {Vector2.new(MaxX, MaxY), Vector2.new(MaxX, MaxY - CornerLengthY)}
    }

    for Index, Segment in ipairs(CornerSegments) do
        local Line = Data.CornerLines[Index]
        if IsCornerBox then
            SetScreenLine(Line, Segment[1], Segment[2], BoxColor, BoxThickness, BoxTransparency)
        else
            Line.Visible = false
        end
    end

    for Index, EdgePair in ipairs(BoxEdges) do
        local Edge = Data.Box3D[Index]
        local PartA = WorldCorners[EdgePair[1]]
        local PartB = WorldCorners[EdgePair[2]]
        local Distance = (PartB - PartA).Magnitude

        Edge.Color = BoxColor
        Edge.Size = Vector3.new(math.max(0.015, BoxThickness * 0.012), math.max(0.015, BoxThickness * 0.012), math.max(0.01, Distance))
        Edge.CFrame = CFrame.lookAt((PartA + PartB) / 2, PartB)
        Edge.Transparency = Is3DBox and BoxTransparency or 1
    end

    local SkeletonColor = GetESPColor(Player, "Skeleton")
    local SkeletonTransparency = math.clamp(ESPSettings.SkeletonTransparency / 100, 0, 1)
    local SkeletonThickness = math.clamp(ESPSettings.SkeletonThickness, 1, 8)

    for Index, Connection in ipairs(SkeletonConnections) do
        local Line = Data.SkeletonLines[Index]
        if SkeletonVisible then
            local PartA = FindFirstPart(Character, Connection[1])
            local PartB = FindFirstPart(Character, Connection[2])

            if PartA and PartB and PartA ~= PartB then
                local PointA, OnScreenA = Camera:WorldToViewportPoint(PartA.Position)
                local PointB, OnScreenB = Camera:WorldToViewportPoint(PartB.Position)

                if OnScreenA and OnScreenB and PointA.Z > 0 and PointB.Z > 0 then
                    SetScreenLine(
                        Line,
                        Vector2.new(PointA.X, PointA.Y),
                        Vector2.new(PointB.X, PointB.Y),
                        SkeletonColor,
                        SkeletonThickness,
                        SkeletonTransparency
                    )
                else
                    Line.Visible = false
                end
            else
                Line.Visible = false
            end
        else
            Line.Visible = false
        end
    end

    local NamesColor = GetESPColor(Player, "Names")
    local NamesTransparency = math.clamp(ESPSettings.NamesTransparency / 100, 0, 1)

    Data.NameLabel.Text = ESPSettings.DisplayName and Player.DisplayName or Player.Name
    Data.NameLabel.Position = UDim2.fromOffset(CenterX, math.max(16, MinY - 3))
    Data.NameLabel.TextSize = math.clamp(ESPSettings.NamesTextSize, 8, 30)
    Data.NameLabel.TextColor3 = NamesColor
    Data.NameLabel.TextTransparency = NamesTransparency
    Data.NameLabel.Visible = NamesVisible

    local ChamsColor = GetESPColor(Player, "Chams")
    local ChamsTransparency = math.clamp(ESPSettings.ChamsTransparency / 100, 0, 1)

    Data.Highlight.Adornee = Character
    Data.Highlight.FillColor = ChamsColor
    Data.Highlight.OutlineColor = ChamsColor
    Data.Highlight.FillTransparency = ChamsTransparency
    Data.Highlight.OutlineTransparency = ChamsTransparency
    Data.Highlight.DepthMode = ESPSettings.ChamsWallCheck and Enum.HighlightDepthMode.Occluded or Enum.HighlightDepthMode.AlwaysOnTop
    Data.Highlight.Enabled = ChamsVisible
end

for _, Player in ipairs(Players:GetPlayers()) do
    CreateESPObjects(Player)
end

local playerAddedConnection = Players.PlayerAdded:Connect(CreateESPObjects)
local playerRemovingConnection = Players.PlayerRemoving:Connect(RemoveESPObjects)
addTask(function()
    playerAddedConnection:Disconnect()
    playerRemovingConnection:Disconnect()
end)

pcall(function()
    RunService:UnbindFromRenderStep("ZyPrivateAimAssistRenderStep")
end)

pcall(function()
    RunService:UnbindFromRenderStep("ZyPrivateESPRenderStep")
end)

RunService:BindToRenderStep(
    "ZyPrivateAimAssistRenderStep",
    Enum.RenderPriority.Camera.Value + 1,
    function(DeltaTime)
        if not running then return end
        local Camera = Workspace.CurrentCamera

        if not Camera then
            FovCircle.Visible = false
            return
        end

        UpdateFovCircle(Camera)

        if not AimAssistSettings.Enabled or AimAssistSettings.Strength <= 0 then
            return
        end

        local TargetPart = GetAimTarget(Camera)
        if not TargetPart or not TargetPart.Parent then
            return
        end

        local Direction = TargetPart.Position - Camera.CFrame.Position
        if Direction.Magnitude <= 0 then
            return
        end

        local TargetCFrame = CFrame.lookAt(Camera.CFrame.Position, TargetPart.Position)
        local Strength = math.clamp(AimAssistSettings.Strength / 100, 0, 1)
        local Alpha = 1 - math.pow(1 - Strength, math.clamp(DeltaTime * 60, 0, 3))
        Camera.CFrame = Camera.CFrame:Lerp(TargetCFrame, Alpha)
    end
)

RunService:BindToRenderStep(
    "ZyPrivateESPRenderStep",
    Enum.RenderPriority.Camera.Value + 2,
    function()
        if not running then return end
        local Camera = Workspace.CurrentCamera
        if not Camera then
            for _, Data in pairs(ESPObjects) do
                HideESP(Data)
            end
            return
        end

        for Player, Data in pairs(ESPObjects) do
            UpdateESPForPlayer(Player, Data, Camera)
        end
    end
)

local AimAssistToggle = AimAssistGroupbox:CreateToggle({
    Name = "Aim Assist",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        AimAssistSettings.Enabled = Value
        FovCircle.Visible = Value and AimAssistSettings.ShowFov
    end,
}, "AimAssistEnabled")

local AimAssistBind = AimAssistToggle:AddBind({
    HoldToInteract = false,
    CurrentValue = "Q",
    SyncToggleState = true,
}, "AimAssistBind")

local AimAssistTargetDropdown = AimAssistToggle:AddDropdown({
    Options = {"Head", "HumanoidRootPart", "Torso"},
    CurrentOptions = {"Head"},
    Placeholder = "Select target part",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if Selected == "Head" or Selected == "HumanoidRootPart" or Selected == "Torso" then
            AimAssistSettings.TargetPart = Selected
        end
    end,
}, "AimAssistTargetPart")

local AimAssistShowFovToggle = AimAssistGroupbox:CreateToggle({
    Name = "Show/Hide FOV",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        AimAssistSettings.ShowFov = Value
        FovCircle.Visible = AimAssistSettings.Enabled and Value
    end,
}, "AimAssistShowFov")

local AimAssistTeamCheckToggle = AimAssistGroupbox:CreateToggle({
    Name = "Team Check",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        AimAssistSettings.TeamCheck = Value
    end,
}, "AimAssistTeamCheck")

local AimAssistWallCheckToggle = AimAssistGroupbox:CreateToggle({
    Name = "Wall Check (Raycast)",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        AimAssistSettings.WallCheck = Value
    end,
}, "AimAssistWallCheck")

local AimAssistFovSlider = AimAssistGroupbox:CreateSlider({
    Name = "Aim Assist FOV",
    Icon = NebulaIcons:GetIcon("chart-no-axes-column-increasing", "Lucide"),
    Range = {0, 1000},
    Increment = 1,
    CurrentValue = 100,
    Callback = function(Value)
        AimAssistSettings.Fov = math.clamp(Value, 0, 1000)
    end,
}, "AimAssistFov")

local AimAssistStrengthSlider = AimAssistGroupbox:CreateSlider({
    Name = "Aim Assist Strength",
    Icon = NebulaIcons:GetIcon("chart-no-axes-column-increasing", "Lucide"),
    Range = {0, 100},
    Increment = 1,
    CurrentValue = 50,
    Callback = function(Value)
        AimAssistSettings.Strength = math.clamp(Value, 0, 100)
    end,
}, "AimAssistStrength")

local ESPColorOptions = {"Blue", "Red", "Green", "Purple", "White", "Yellow", "Cyan", "Orange"}

local ESPBoxesToggle = BoxesGroupbox:CreateToggle({
    Name = "Enable Boxes",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.BoxesEnabled = Value
    end,
}, "ESPBoxesEnabled")

local ESPBoxModeDropdown = ESPBoxesToggle:AddDropdown({
    Options = {"2D Boxes", "Corner Boxes", "3D Boxes"},
    CurrentOptions = {"2D Boxes"},
    Placeholder = "Choose box style",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if Selected == "2D Boxes" or Selected == "Corner Boxes" or Selected == "3D Boxes" then
            ESPSettings.BoxMode = Selected
        end
    end,
}, "ESPBoxMode")

local ESPBoxColorDropdown = ESPBoxesToggle:AddDropdown({
    Options = ESPColorOptions,
    CurrentOptions = {"Blue"},
    Placeholder = "Choose box color",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if ESPColors[Selected] then
            ESPSettings.BoxColorName = Selected
        end
    end,
}, "ESPBoxColor")

local ESPBoxTeamColorToggle = BoxesGroupbox:CreateToggle({
    Name = "Use Team Color",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.BoxUseTeamColor = Value
    end,
}, "ESPBoxTeamColor")

local ESPBoxTeamCheckToggle = BoxesGroupbox:CreateToggle({
    Name = "Team Check",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.BoxTeamCheck = Value
    end,
}, "ESPBoxTeamCheck")

local ESPBoxWallCheckToggle = BoxesGroupbox:CreateToggle({
    Name = "Wall Check (Raycast)",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.BoxWallCheck = Value
    end,
}, "ESPBoxWallCheck")

local ESPBoxTransparencySlider = BoxesGroupbox:CreateSlider({
    Name = "Box Transparency",
    Icon = NebulaIcons:GetIcon("blend", "Lucide"),
    Range = {0, 100},
    Increment = 1,
    CurrentValue = 20,
    Callback = function(Value)
        ESPSettings.BoxTransparency = math.clamp(Value, 0, 100)
    end,
}, "ESPBoxTransparency")

local ESPBoxThicknessSlider = BoxesGroupbox:CreateSlider({
    Name = "Box Size",
    Icon = NebulaIcons:GetIcon("maximize", "Lucide"),
    Range = {1, 8},
    Increment = 1,
    CurrentValue = 2,
    Callback = function(Value)
        ESPSettings.BoxThickness = math.clamp(Value, 1, 8)
    end,
}, "ESPBoxThickness")

local ESPNamesToggle = NamesGroupbox:CreateToggle({
    Name = "Enable Names",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.NamesEnabled = Value
    end,
}, "ESPNamesEnabled")

local ESPNamesColorDropdown = ESPNamesToggle:AddDropdown({
    Options = ESPColorOptions,
    CurrentOptions = {"Blue"},
    Placeholder = "Choose name color",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if ESPColors[Selected] then
            ESPSettings.NamesColorName = Selected
        end
    end,
}, "ESPNamesColor")

local ESPDisplayNameToggle = NamesGroupbox:CreateToggle({
    Name = "Use Display Name",
    CurrentValue = true,
    Style = 2,
    Callback = function(Value)
        ESPSettings.DisplayName = Value
    end,
}, "ESPDisplayName")

local ESPNamesTeamColorToggle = NamesGroupbox:CreateToggle({
    Name = "Use Team Color",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.NamesUseTeamColor = Value
    end,
}, "ESPNamesTeamColor")

local ESPNamesTeamCheckToggle = NamesGroupbox:CreateToggle({
    Name = "Team Check",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.NamesTeamCheck = Value
    end,
}, "ESPNamesTeamCheck")

local ESPNamesWallCheckToggle = NamesGroupbox:CreateToggle({
    Name = "Wall Check (Raycast)",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.NamesWallCheck = Value
    end,
}, "ESPNamesWallCheck")

local ESPNamesTransparencySlider = NamesGroupbox:CreateSlider({
    Name = "Name Transparency",
    Icon = NebulaIcons:GetIcon("blend", "Lucide"),
    Range = {0, 100},
    Increment = 1,
    CurrentValue = 20,
    Callback = function(Value)
        ESPSettings.NamesTransparency = math.clamp(Value, 0, 100)
    end,
}, "ESPNamesTransparency")

local ESPNamesSizeSlider = NamesGroupbox:CreateSlider({
    Name = "Name Size",
    Icon = NebulaIcons:GetIcon("type", "Lucide"),
    Range = {8, 30},
    Increment = 1,
    CurrentValue = 13,
    Callback = function(Value)
        ESPSettings.NamesTextSize = math.clamp(Value, 8, 30)
    end,
}, "ESPNamesSize")

local ESPChamsToggle = ChamsGroupbox:CreateToggle({
    Name = "Enable Chams",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.ChamsEnabled = Value
    end,
}, "ESPChamsEnabled")

local ESPChamsColorDropdown = ESPChamsToggle:AddDropdown({
    Options = ESPColorOptions,
    CurrentOptions = {"Blue"},
    Placeholder = "Choose chams color",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if ESPColors[Selected] then
            ESPSettings.ChamsColorName = Selected
        end
    end,
}, "ESPChamsColor")

local ESPChamsTeamColorToggle = ChamsGroupbox:CreateToggle({
    Name = "Use Team Color",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.ChamsUseTeamColor = Value
    end,
}, "ESPChamsTeamColor")

local ESPChamsTeamCheckToggle = ChamsGroupbox:CreateToggle({
    Name = "Team Check",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.ChamsTeamCheck = Value
    end,
}, "ESPChamsTeamCheck")

local ESPChamsWallCheckToggle = ChamsGroupbox:CreateToggle({
    Name = "Wall Check (Raycast)",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.ChamsWallCheck = Value
    end,
}, "ESPChamsWallCheck")

local ESPChamsTransparencySlider = ChamsGroupbox:CreateSlider({
    Name = "Chams Transparency",
    Icon = NebulaIcons:GetIcon("blend", "Lucide"),
    Range = {0, 100},
    Increment = 1,
    CurrentValue = 20,
    Callback = function(Value)
        ESPSettings.ChamsTransparency = math.clamp(Value, 0, 100)
    end,
}, "ESPChamsTransparency")

local ESPSkeletonToggle = SkeletonGroupbox:CreateToggle({
    Name = "Enable Skeleton",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.SkeletonEnabled = Value
    end,
}, "ESPSkeletonEnabled")

local ESPSkeletonColorDropdown = ESPSkeletonToggle:AddDropdown({
    Options = ESPColorOptions,
    CurrentOptions = {"Blue"},
    Placeholder = "Choose skeleton color",
    MultipleOptions = false,
    Callback = function(Options)
        local Selected = typeof(Options) == "table" and Options[1] or Options
        if ESPColors[Selected] then
            ESPSettings.SkeletonColorName = Selected
        end
    end,
}, "ESPSkeletonColor")

local ESPSkeletonTeamColorToggle = SkeletonGroupbox:CreateToggle({
    Name = "Use Team Color",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.SkeletonUseTeamColor = Value
    end,
}, "ESPSkeletonTeamColor")

local ESPSkeletonTeamCheckToggle = SkeletonGroupbox:CreateToggle({
    Name = "Team Check",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.SkeletonTeamCheck = Value
    end,
}, "ESPSkeletonTeamCheck")

local ESPSkeletonWallCheckToggle = SkeletonGroupbox:CreateToggle({
    Name = "Wall Check (Raycast)",
    CurrentValue = false,
    Style = 2,
    Callback = function(Value)
        ESPSettings.SkeletonWallCheck = Value
    end,
}, "ESPSkeletonWallCheck")

local ESPSkeletonTransparencySlider = SkeletonGroupbox:CreateSlider({
    Name = "Skeleton Transparency",
    Icon = NebulaIcons:GetIcon("blend", "Lucide"),
    Range = {0, 100},
    Increment = 1,
    CurrentValue = 20,
    Callback = function(Value)
        ESPSettings.SkeletonTransparency = math.clamp(Value, 0, 100)
    end,
}, "ESPSkeletonTransparency")

local ESPSkeletonThicknessSlider = SkeletonGroupbox:CreateSlider({
    Name = "Skeleton Thickness",
    Icon = NebulaIcons:GetIcon("maximize", "Lucide"),
    Range = {1, 8},
    Increment = 1,
    CurrentValue = 2,
    Callback = function(Value)
        ESPSettings.SkeletonThickness = math.clamp(Value, 1, 8)
    end,
}, "ESPSkeletonThickness")

pcall(function()
    SettingsTab:BuildConfigGroupbox(1)
end)

pcall(function()
    SettingsTab:BuildThemeGroupbox(2)
end)

pcall(function()
    Starlight:LoadAutoloadConfig()
end)

pcall(function()
    Starlight:LoadAutoloadTheme()
end)
end
local function verifyKey()
    if not running or terminating or verifying then
        return
    end
    if verified then
        setStatus("Already unlocked. Automatic validation is running.")
        return
    end
    local key = enteredKey:gsub("^%s+", ""):gsub("%s+$", "")
    if key == "" then
        setStatus("Enter your key first.")
        return
    end
    local hwid = getHardwareId()
    if not hwid then
        setStatus("Your executor does not provide a hardware ID.")
        return
    end
    if not requestFunction then
        setStatus("Your executor does not support HTTP requests.")
        return
    end
    verifying = true
    setStatus("Verifying your key and HWID with Zyphor...")
    task.spawn(function()
        authKey = key
        authHwid = hwid
        authUserId = AuthPlayer.UserId
        local state, data = validate()
        if not running then
            return
        end
        verifying = false
        if state ~= "valid" then
            authKey = nil
            authHwid = nil
            authUserId = nil
            licenseDeadline = nil
            licenseExpiry = nil
            setStatus(state == "invalid" and ("Key rejected: " .. tostring(data)) or ("Verification unavailable: " .. tostring(data)))
            return
        end
        verified = true
        licenceInfo = data
        updateLabel(ExpiryLabel, "Expires", remainingText())
        setStatus("Key accepted. Loading your features...")
        local buildOk, buildError = pcall(buildMainGui)
        if not buildOk then
            warn("ZyPrivate failed to initialize: " .. tostring(buildError))
            shutdown(nil, false, false)
            return
        end
        setStatus("Access granted — continuous validation enabled.")
        task.spawn(function()
            local failures = 0
            while running and verified do
                task.wait(VALIDATION_INTERVAL)
                if not running then
                    return
                end
                local state, current = validate()
                if not running then
                    return
                end
                if state == "valid" then
                    failures = 0
                    retries = 0
                    licenceInfo = current
                    updateLabel(MonitoringLabel, "Validation", "Active — last check passed. Next check in 20 seconds.")
                elseif state == "invalid" then
                    verified = false
                    shutdown("Invalid key", true, false)
                    return
                else
                    failures = failures + 1
                    retries = failures
                    updateLabel(MonitoringLabel, "Validation", "Connection issue — retry " .. failures .. "/" .. MAX_NETWORK_FAILURES)
                    if failures >= MAX_NETWORK_FAILURES then
                        verified = false
                        shutdown("Key validation unavailable", true, false)
                        return
                    end
                end
            end
        end)
        task.spawn(function()
            while running and verified do
                updateLabel(ExpiryLabel, "Expires", remainingText())
                task.wait(1)
            end
        end)
    end)
end

VerificationGroup:CreateButton({
    Name = "Verify & Unlock",
    Style = 2,
    Callback = verifyKey
}, "ZyphorVerifyKey")

if type(getgenv) == "function" then
    local ok, env = pcall(getgenv)
    if ok and type(env) == "table" then
        local myShutdown = function()
            shutdown(nil, false, false)
        end
        env.ZyPrivateShutdown = myShutdown
        addTask(function()
            local success, current = pcall(getgenv)
            if success and type(current) == "table" and current.ZyPrivateShutdown == myShutdown then
                current.ZyPrivateShutdown = nil
            end
        end)
    end
end
