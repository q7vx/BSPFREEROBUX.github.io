local Players = game:GetService("Players")
local CoreGui = game:GetService("CoreGui")
local HttpService = game:GetService("HttpService")
local GuiService = game:GetService("GuiService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local LocalPlayer = Players.LocalPlayer
local KEY_PAGE = "https://zyphor.cc/getnewkey"
local TOS_PAGE = "https://zyphor.cc/tos.html"
local PP_PAGE = "https://zyphor.cc/pp.html"
local TEAM_PAGE = "https://zyphor.cc/TeamVaprix"
local SERVER_CONFIG = "https://zyphor.cc/server.txt"
local KEY_VALID = false
local KEY_INFO = nil

local requestFunction = nil
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
        function()
            if type(gethwid) == "function" then
                return gethwid()
            end
            return nil
        end,
        function()
            if type(syn) == "table" and type(syn.gethwid) == "function" then
                return syn.gethwid()
            end
            return nil
        end,
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
        local ok, value = pcall(source)
        if ok and value ~= nil and tostring(value) ~= "" then
            return tostring(value)
        end
    end
    return nil
end

local function getServerUrl()
    local response = requestFunction({ Url = SERVER_CONFIG, Method = "GET" })
    if type(response) ~= "table" then
        error("Could not retrieve the Zyphor server URL.")
    end
    local statusCode = tonumber(response.StatusCode or response.Status or 0) or 0
    if statusCode < 200 or statusCode >= 300 then
        error("Could not retrieve the Zyphor server URL.")
    end
    local url = tostring(response.Body or ""):gsub("%s+", "")
    url = url:gsub("/+$", "")
    if not url:match("^https?://") then
        error("The Zyphor server URL is invalid.")
    end
    return url
end

local function openUrl(url)
    local opened = false
    if type(syn) == "table" and type(syn.open_url) == "function" then
        opened = pcall(function()
            syn.open_url(url)
        end)
    end
    if not opened and type(open_url) == "function" then
        opened = pcall(function()
            open_url(url)
        end)
    end
    if not opened then
        opened = pcall(function()
            GuiService:OpenBrowserWindow(url)
        end)
    end
    if not opened and type(setclipboard) == "function" then
        opened = pcall(function()
            setclipboard(url)
        end)
    end
    return opened
end

local function openKeyPage()
    return openUrl(KEY_PAGE)
end

local function make(instanceType, properties, parent)
    local item = Instance.new(instanceType)
    for property, value in pairs(properties or {}) do
        item[property] = value
    end
    item.Parent = parent
    return item
end


local MarketplaceService = game:GetService("MarketplaceService")
local palette = {
    bg = Color3.fromRGB(12, 14, 19),
    panel = Color3.fromRGB(20, 23, 32),
    raised = Color3.fromRGB(26, 29, 42),
    border = Color3.fromRGB(47, 51, 69),
    text = Color3.fromRGB(244, 246, 251),
    muted = Color3.fromRGB(163, 169, 184),
    violet = Color3.fromRGB(124, 131, 255),
    violetSoft = Color3.fromRGB(167, 139, 250),
    cyan = Color3.fromRGB(133, 215, 255),
    success = Color3.fromRGB(113, 229, 180),
    danger = Color3.fromRGB(255, 131, 154)
}

local parent = CoreGui
if type(gethui) == "function" then
    local ok, result = pcall(gethui)
    if ok and result then
        parent = result
    end
end

pcall(function()
    local existing = parent:FindFirstChild("ZyphorKeyClient")
    if existing then
        existing:Destroy()
    end
end)

local gui = make("ScreenGui", {
    Name = "ZyphorKeyClient",
    ResetOnSpawn = false,
    IgnoreGuiInset = true,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
    DisplayOrder = 999
}, parent)

local window = make("Frame", {
    Name = "Window",
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.fromScale(0.5, 0.5),
    Size = UDim2.fromOffset(660, 440),
    BackgroundTransparency = 1
}, gui)

local scale = make("UIScale", { Scale = 1 }, window)

local glow = make("Frame", {
    Name = "Glow",
    Position = UDim2.fromOffset(1, 2),
    Size = UDim2.fromOffset(658, 436),
    BackgroundColor3 = palette.violet,
    BackgroundTransparency = 0.92,
    BorderSizePixel = 0
}, window)
make("UICorner", { CornerRadius = UDim.new(0, 24) }, glow)
make("UIStroke", {
    Color = palette.violet,
    Transparency = 0.77,
    Thickness = 2.5
}, glow)

local frame = make("Frame", {
    Name = "Main",
    Position = UDim2.fromOffset(8, 8),
    Size = UDim2.fromOffset(644, 424),
    BackgroundColor3 = palette.bg,
    BorderSizePixel = 0,
    ClipsDescendants = true
}, window)
make("UICorner", { CornerRadius = UDim.new(0, 18) }, frame)
local border = make("UIStroke", {
    Color = palette.border,
    Transparency = 0.05,
    Thickness = 1.3
}, frame)
make("UIGradient", {
    Rotation = 105,
    Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(25, 27, 43)),
        ColorSequenceKeypoint.new(0.47, palette.bg),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(9, 12, 20))
    })
}, frame)

local function round(target, radius)
    make("UICorner", { CornerRadius = UDim.new(0, radius or 11) }, target)
    return target
end

local function stroke(target, color, transparency, thickness)
    return make("UIStroke", {
        Color = color or palette.border,
        Transparency = transparency or 0,
        Thickness = thickness or 1
    }, target)
end

local function text(parentObject, name, value, x, y, width, height, fontSize, color, font)
    return make("TextLabel", {
        Name = name,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(width, height),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        Text = value,
        Font = font or Enum.Font.Gotham,
        TextSize = fontSize,
        TextColor3 = color or palette.text,
        TextXAlignment = Enum.TextXAlignment.Left,
        TextYAlignment = Enum.TextYAlignment.Center,
        TextTruncate = Enum.TextTruncate.AtEnd,
        ZIndex = 4
    }, parentObject)
end

local function button(parentObject, name, value, x, y, width, height, background, foreground)
    local item = make("TextButton", {
        Name = name,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(width, height),
        BackgroundColor3 = background,
        BorderSizePixel = 0,
        Text = value,
        TextColor3 = foreground or palette.text,
        Font = Enum.Font.GothamBold,
        TextSize = 12,
        AutoButtonColor = false,
        ZIndex = 5
    }, parentObject)
    round(item, 10)
    return item
end

local topAccent = make("Frame", {
    Name = "TopAccent",
    Size = UDim2.new(1, 0, 0, 3),
    BackgroundColor3 = palette.violet,
    BorderSizePixel = 0,
    ZIndex = 5
}, frame)
local accentGradient = make("UIGradient", {
    Rotation = 0,
    Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, palette.violet),
        ColorSequenceKeypoint.new(0.5, palette.violetSoft),
        ColorSequenceKeypoint.new(1, palette.cyan)
    })
}, topAccent)

local orb = make("Frame", {
    Name = "AmbientGlow",
    Position = UDim2.fromOffset(432, -135),
    Size = UDim2.fromOffset(340, 260),
    BackgroundColor3 = palette.violet,
    BackgroundTransparency = 0.95,
    BorderSizePixel = 0,
    ZIndex = 1
}, frame)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, orb)

local header = make("Frame", {
    Name = "Header",
    Position = UDim2.fromOffset(22, 14),
    Size = UDim2.fromOffset(600, 53),
    BackgroundTransparency = 1,
    Active = true,
    ZIndex = 3
}, frame)

local logo = make("Frame", {
    Name = "ZyphorMark",
    Position = UDim2.fromOffset(2, 3),
    Size = UDim2.fromOffset(42, 42),
    BackgroundColor3 = Color3.fromRGB(33, 34, 65),
    BorderSizePixel = 0,
    ZIndex = 5
}, header)
round(logo, 12)
stroke(logo, Color3.fromRGB(92, 96, 163), 0.13)
make("UIGradient", {
    Rotation = 45,
    Color = ColorSequence.new(palette.violet, Color3.fromRGB(79, 59, 120))
}, logo)
text(logo, "Symbol", "✦", 5, 0, 32, 41, 29, palette.text, Enum.Font.GothamBlack).TextXAlignment = Enum.TextXAlignment.Center
text(header, "Brand", "ZYPHOR", 56, 2, 165, 25, 21, palette.text, Enum.Font.GothamBlack)
text(header, "Subtitle", "KEY SYSTEM  /  SECURE ACCESS", 57, 26, 255, 17, 9, palette.muted, Enum.Font.GothamBold)

local badge = round(make("Frame", {
    Name = "SecurityBadge",
    Position = UDim2.fromOffset(392, 10),
    Size = UDim2.fromOffset(103, 27),
    BackgroundColor3 = Color3.fromRGB(23, 43, 43),
    BorderSizePixel = 0,
    ZIndex = 5
}, header), 14)
stroke(badge, Color3.fromRGB(44, 97, 86), 0.25)
local badgeDot = round(make("Frame", {
    Position = UDim2.fromOffset(10, 10),
    Size = UDim2.fromOffset(7, 7),
    BackgroundColor3 = palette.success,
    BorderSizePixel = 0,
    ZIndex = 6
}, badge), 4)
text(badge, "BadgeText", "SYSTEM READY", 21, 2, 79, 22, 9, palette.success, Enum.Font.GothamBold)

local minimize = button(header, "Minimize", "−", 508, 9, 32, 29, palette.raised, palette.muted)
local close = button(header, "Close", "×", 548, 9, 32, 29, Color3.fromRGB(51, 30, 44), Color3.fromRGB(255, 158, 184))
minimize.TextSize = 18
close.TextSize = 19

make("Frame", {
    Name = "HeaderRule",
    Position = UDim2.fromOffset(22, 78),
    Size = UDim2.fromOffset(600, 1),
    BackgroundColor3 = palette.border,
    BackgroundTransparency = 0.36,
    BorderSizePixel = 0,
    ZIndex = 3
}, frame)

local content = make("Frame", {
    Name = "KeyPage",
    Position = UDim2.fromOffset(0, 0),
    Size = UDim2.fromScale(1, 1),
    BackgroundTransparency = 1
}, frame)

text(content, "Eyebrow", "LICENSE / 01", 26, 99, 170, 15, 10, palette.violetSoft, Enum.Font.GothamBold)
text(content, "Heading", "Unlock your script.", 25, 117, 354, 38, 26, palette.text, Enum.Font.GothamBlack)
text(content, "Info", "Paste a valid Zyphor license to continue.", 26, 154, 345, 24, 12, palette.muted)

text(content, "InputLabel", "LICENSE KEY", 26, 192, 175, 17, 9, Color3.fromRGB(198, 201, 224), Enum.Font.GothamBold)

local keyArea = round(make("Frame", {
    Name = "KeyArea",
    Position = UDim2.fromOffset(25, 216),
    Size = UDim2.fromOffset(345, 48),
    BackgroundColor3 = Color3.fromRGB(9, 12, 21),
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 11)
local keyStroke = stroke(keyArea, palette.border, 0.06)
text(keyArea, "KeyGlyph", "◇", 13, 6, 23, 35, 22, palette.violetSoft, Enum.Font.GothamBold)
local keyBox = make("TextBox", {
    Name = "KeyInput",
    Position = UDim2.fromOffset(45, 6),
    Size = UDim2.fromOffset(288, 36),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
    ClearTextOnFocus = false,
    Font = Enum.Font.Code,
    PlaceholderText = "Paste your key here...",
    PlaceholderColor3 = Color3.fromRGB(106, 113, 143),
    Text = "",
    TextColor3 = palette.text,
    TextSize = 13,
    TextXAlignment = Enum.TextXAlignment.Left,
    ZIndex = 5
}, keyArea)

local validateButton = button(content, "Validate", "VERIFY KEY   →", 25, 276, 168, 43, palette.violet, Color3.new(1, 1, 1))
make("UIGradient", {
    Rotation = 10,
    Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(124, 131, 255)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(145, 108, 243))
    })
}, validateButton)
stroke(validateButton, Color3.fromRGB(189, 180, 255), 0.60)
local getKeyButton = button(content, "GetKey", "◎   GET A KEY", 202, 276, 168, 43, palette.raised, palette.text)
stroke(getKeyButton, palette.border, 0.09)

local statusCard = round(make("Frame", {
    Name = "StatusCard",
    Position = UDim2.fromOffset(25, 332),
    Size = UDim2.fromOffset(345, 47),
    BackgroundColor3 = Color3.fromRGB(22, 26, 38),
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 10)
local statusStroke = stroke(statusCard, palette.border, 0.34)
local statusDot = round(make("Frame", {
    Name = "StatusDot",
    Position = UDim2.fromOffset(14, 20),
    Size = UDim2.fromOffset(8, 8),
    BackgroundColor3 = palette.muted,
    BorderSizePixel = 0,
    ZIndex = 5
}, statusCard), 4)
local status = text(statusCard, "Status", "Enter a license key to get started.", 32, 5, 304, 38, 11, palette.muted, Enum.Font.GothamMedium)
status.TextWrapped = true
status.TextTruncate = Enum.TextTruncate.None

make("Frame", {
    Name = "ColumnRule",
    Position = UDim2.fromOffset(386, 98),
    Size = UDim2.fromOffset(1, 281),
    BackgroundColor3 = palette.border,
    BackgroundTransparency = 0.28,
    BorderSizePixel = 0,
    ZIndex = 3
}, content)

text(content, "GameEyebrow", "CURRENT EXPERIENCE", 405, 99, 218, 18, 10, palette.violetSoft, Enum.Font.GothamBold)
local gameCard = round(make("Frame", {
    Name = "GameCard",
    Position = UDim2.fromOffset(404, 127),
    Size = UDim2.fromOffset(218, 100),
    BackgroundColor3 = palette.panel,
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 12)
stroke(gameCard, palette.border, 0.12)
text(gameCard, "GameHeader", "DETECTED GAME", 13, 8, 185, 14, 8, palette.muted, Enum.Font.GothamBold)
local gamePicture = round(make("ImageLabel", {
    Name = "GameIcon",
    Position = UDim2.fromOffset(12, 30),
    Size = UDim2.fromOffset(55, 55),
    BackgroundColor3 = palette.raised,
    BorderSizePixel = 0,
    Image = "rbxthumb://type=GameIcon&id=" .. tostring(game.PlaceId) .. "&w=150&h=150",
    ScaleType = Enum.ScaleType.Crop,
    ZIndex = 4
}, gameCard), 10)
local gameName = text(gameCard, "GameName", game.Name, 79, 34, 126, 29, 12, palette.text, Enum.Font.GothamBold)
gameName.TextWrapped = true
gameName.TextTruncate = Enum.TextTruncate.AtEnd
text(gameCard, "GameId", "PLACE  " .. tostring(game.PlaceId), 79, 67, 128, 17, 9, palette.muted, Enum.Font.Code)

text(content, "IdentityLabel", "YOUR ACCOUNT", 405, 237, 215, 19, 10, palette.violetSoft, Enum.Font.GothamBold)
local identityCard = round(make("Frame", {
    Name = "IdentityCard",
    Position = UDim2.fromOffset(404, 263),
    Size = UDim2.fromOffset(218, 73),
    BackgroundColor3 = palette.panel,
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 12)
stroke(identityCard, palette.border, 0.12)
local avatar = round(make("ImageLabel", {
    Name = "Avatar",
    Position = UDim2.fromOffset(11, 12),
    Size = UDim2.fromOffset(49, 49),
    BackgroundColor3 = palette.raised,
    BorderSizePixel = 0,
    Image = "",
    ZIndex = 4
}, identityCard), 25)
text(identityCard, "Welcome", "WELCOME BACK", 72, 9, 130, 18, 9, palette.muted, Enum.Font.GothamBold)
text(identityCard, "Username", LocalPlayer.DisplayName, 72, 27, 132, 25, 14, palette.text, Enum.Font.GothamBold)
text(identityCard, "Handle", "@" .. LocalPlayer.Name, 72, 51, 130, 14, 9, palette.violetSoft, Enum.Font.GothamMedium)

local chipOne = round(make("Frame", {
    Position = UDim2.fromOffset(404, 348),
    Size = UDim2.fromOffset(67, 31),
    BackgroundColor3 = palette.raised,
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 8)
local chipTwo = round(make("Frame", {
    Position = UDim2.fromOffset(480, 348),
    Size = UDim2.fromOffset(67, 31),
    BackgroundColor3 = palette.raised,
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 8)
local chipThree = round(make("Frame", {
    Position = UDim2.fromOffset(556, 348),
    Size = UDim2.fromOffset(66, 31),
    BackgroundColor3 = palette.raised,
    BorderSizePixel = 0,
    ZIndex = 3
}, content), 8)
for _, chip in ipairs({ chipOne, chipTwo, chipThree }) do
    stroke(chip, palette.border, 0.26)
end
text(chipOne, "Label", "✦  7 DAYS", 6, 4, 58, 22, 8, palette.violetSoft, Enum.Font.GothamBold)
text(chipTwo, "Label", "◇  HWID", 8, 4, 58, 22, 8, palette.cyan, Enum.Font.GothamBold)
text(chipThree, "Label", "✓  SECURE", 5, 4, 60, 22, 8, palette.success, Enum.Font.GothamBold)

make("Frame", {
    Name = "FooterRule",
    Position = UDim2.fromOffset(22, 388),
    Size = UDim2.fromOffset(600, 1),
    BackgroundColor3 = palette.border,
    BackgroundTransparency = 0.26,
    BorderSizePixel = 0,
    ZIndex = 3
}, frame)

text(frame, "Copyright", "ZYPHOR.CC  •  MADE BY TEAM VAPRIX", 25, 397, 290, 18, 9, Color3.fromRGB(120, 128, 155), Enum.Font.GothamBold)
local tosButton = button(frame, "TermsOfService", "TOS", 401, 396, 48, 22, palette.raised, palette.muted)
local ppButton = button(frame, "PrivacyPolicy", "PRIVACY", 457, 396, 75, 22, palette.raised, palette.muted)
local teamButton = button(frame, "TeamVaprix", "TEAM ↗", 540, 396, 82, 22, palette.raised, palette.muted)
tosButton.TextSize = 9
ppButton.TextSize = 9
teamButton.TextSize = 9

local accountGui = make("Frame", {
    Name = "AccountPage",
    Size = UDim2.fromScale(1, 1),
    BackgroundTransparency = 1,
    Visible = false,
    ZIndex = 3
}, frame)

text(accountGui, "Eyebrow", "ACCOUNT / 02", 26, 98, 200, 17, 10, palette.violetSoft, Enum.Font.GothamBold)
text(accountGui, "Title", "Your license dashboard", 25, 118, 447, 40, 25, palette.text, Enum.Font.GothamBlack)
text(accountGui, "Description", "Active license details for this Roblox session.", 26, 160, 490, 20, 11, palette.muted)

local accountTabs = make("Frame", {
    Name = "Tabs",
    Position = UDim2.fromOffset(25, 194),
    Size = UDim2.fromOffset(322, 35),
    BackgroundTransparency = 1,
    ZIndex = 4
}, accountGui)
local accountTabButton = button(accountTabs, "Details", "LICENSE DETAILS", 0, 0, 155, 35, palette.violet, palette.text)
local accessTabButton = button(accountTabs, "Access", "SECURITY", 165, 0, 155, 35, palette.raised, palette.muted)
accountTabButton.TextSize = 10
accessTabButton.TextSize = 10

local accountPanel = round(make("Frame", {
    Name = "AccountPanel",
    Position = UDim2.fromOffset(25, 240),
    Size = UDim2.fromOffset(598, 122),
    BackgroundColor3 = palette.panel,
    BorderSizePixel = 0,
    ZIndex = 4
}, accountGui), 13)
stroke(accountPanel, palette.border, 0.14)

local function field(name, title, x, y, w)
    text(accountPanel, name .. "Label", title, x, y, w, 16, 9, palette.muted, Enum.Font.GothamBold)
    return text(accountPanel, name, "—", x, y + 20, w, 23, 13, palette.text, Enum.Font.GothamBold)
end

local expiryValue = field("TimeLeft", "TIME REMAINING", 16, 12, 255)
local accountValue = field("LastAccount", "LAST ACCOUNT", 305, 12, 275)
local lastUsedValue = field("LastUsed", "LAST USED", 16, 66, 255)
local resetValue = field("ResetAvailable", "HWID RESET AVAILABLE", 305, 66, 275)

local accountAccessPanel = round(make("Frame", {
    Name = "SecurityPanel",
    Position = UDim2.fromOffset(25, 240),
    Size = UDim2.fromOffset(598, 122),
    BackgroundColor3 = palette.panel,
    BorderSizePixel = 0,
    Visible = false,
    ZIndex = 4
}, accountGui), 13)
stroke(accountAccessPanel, palette.border, 0.14)
text(accountAccessPanel, "SecurityTitle", "✓   Your device is authenticated", 18, 12, 495, 27, 16, palette.success, Enum.Font.GothamBold)
local hwidValue = button(accountAccessPanel, "BoundHWID", "••••••••••••••••", 18, 52, 561, 49, Color3.fromRGB(12, 20, 27), Color3.fromRGB(191, 223, 214))
hwidValue.Font = Enum.Font.Code
hwidValue.TextSize = 12
hwidValue.TextXAlignment = Enum.TextXAlignment.Left
make("UIPadding", {
    PaddingLeft = UDim.new(0, 13),
    PaddingRight = UDim.new(0, 13)
}, hwidValue)
stroke(hwidValue, Color3.fromRGB(55, 96, 87), 0.4)

local accountBackButton = button(accountGui, "Back", "←  BACK TO ACCESS PORTAL", 372, 194, 250, 35, palette.raised, palette.muted)
accountBackButton.TextSize = 10

local function tween(object, properties, duration)
    local t = TweenService:Create(object, TweenInfo.new(duration or 0.20, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), properties)
    t:Play()
    return t
end

local function setStatus(message, level)
    status.Text = tostring(message)
    if level == "error" then
        status.TextColor3 = palette.danger
    elseif level == "success" then
        status.TextColor3 = palette.success
    elseif level == "info" then
        status.TextColor3 = palette.violetSoft
    else
        status.TextColor3 = palette.muted
    end
end

status:GetPropertyChangedSignal("TextColor3"):Connect(function()
    statusDot.BackgroundColor3 = status.TextColor3
    if status.TextColor3 == palette.danger then
        statusStroke.Color = Color3.fromRGB(112, 55, 79)
    elseif status.TextColor3 == palette.success then
        statusStroke.Color = Color3.fromRGB(43, 99, 84)
    else
        statusStroke.Color = palette.border
    end
end)

local function addHover(item, rest, hover)
    item.MouseEnter:Connect(function()
        if item.Active then
            tween(item, { BackgroundColor3 = hover }, 0.13)
        end
    end)
    item.MouseLeave:Connect(function()
        tween(item, { BackgroundColor3 = rest }, 0.14)
    end)
end

addHover(getKeyButton, palette.raised, Color3.fromRGB(42, 45, 70))
addHover(close, Color3.fromRGB(51, 30, 44), Color3.fromRGB(96, 45, 70))
addHover(minimize, palette.raised, Color3.fromRGB(47, 50, 77))
for _, item in ipairs({ tosButton, ppButton, teamButton, accountBackButton }) do
    addHover(item, palette.raised, Color3.fromRGB(43, 46, 69))
end

keyBox.Focused:Connect(function()
    tween(keyStroke, { Color = palette.violet, Transparency = 0, Thickness = 1.5 }, 0.15)
end)
keyBox.FocusLost:Connect(function()
    tween(keyStroke, { Color = palette.border, Transparency = 0.06, Thickness = 1 }, 0.15)
end)

local function openLink(url)
    local ok = openUrl(url)
    if ok then
        setStatus("Opened or copied: " .. url, "info")
    else
        setStatus("Open this link manually: " .. url, "info")
    end
end
tosButton.MouseButton1Click:Connect(function() openLink(TOS_PAGE) end)
ppButton.MouseButton1Click:Connect(function() openLink(PP_PAGE) end)
teamButton.MouseButton1Click:Connect(function() openLink(TEAM_PAGE) end)
getKeyButton.MouseButton1Click:Connect(function() openLink(KEY_PAGE) end)

local minimized = false
local activePage = "key"
local function updateScale()
    local camera = workspace.CurrentCamera
    if not camera then return end
    local viewport = camera.ViewportSize
    scale.Scale = math.clamp(math.min((viewport.X - 26) / 660, (viewport.Y - 26) / 440, 1), 0.42, 1)
end
updateScale()
local cameraConnection
local function connectCamera(camera)
    if cameraConnection then cameraConnection:Disconnect() end
    if camera then cameraConnection = camera:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale) end
    updateScale()
end
connectCamera(workspace.CurrentCamera)
local cameraChanged = workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
    connectCamera(workspace.CurrentCamera)
end)
gui.Destroying:Connect(function()
    cameraChanged:Disconnect()
    if cameraConnection then cameraConnection:Disconnect() end
end)

local dragging = false
local dragStart
local startPosition
local dragInput
header.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        startPosition = window.Position
        dragInput = input
        input.Changed:Connect(function()
            if input.UserInputState == Enum.UserInputState.End then
                dragging = false
            end
        end)
    end
end)
header.InputChanged:Connect(function(input)
    if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
        dragInput = input
    end
end)
UserInputService.InputChanged:Connect(function(input)
    if dragging and dragInput == input and dragStart and startPosition then
        local delta = (input.Position - dragStart) / scale.Scale
        window.Position = UDim2.new(startPosition.X.Scale, startPosition.X.Offset + delta.X, startPosition.Y.Scale, startPosition.Y.Offset + delta.Y)
    end
end)

local function updateVisible()
    content.Visible = not minimized and activePage == "key"
    accountGui.Visible = not minimized and activePage == "account"
end

close.MouseButton1Click:Connect(function()
    tween(window, { BackgroundTransparency = 1 }, 0.12)
    tween(frame, { BackgroundTransparency = 1 }, 0.15)
    tween(glow, { BackgroundTransparency = 1 }, 0.15)
    task.delay(0.17, function()
        if gui and gui.Parent then gui:Destroy() end
    end)
end)
minimize.MouseButton1Click:Connect(function()
    minimized = not minimized
    minimize.Text = minimized and "+" or "−"
    updateVisible()
    tween(frame, { Size = minimized and UDim2.fromOffset(644, 68) or UDim2.fromOffset(644, 424) }, 0.22)
    tween(glow, { Size = minimized and UDim2.fromOffset(658, 81) or UDim2.fromOffset(658, 436) }, 0.22)
    tween(window, { Size = minimized and UDim2.fromOffset(660, 83) or UDim2.fromOffset(660, 440) }, 0.22)
end)

task.spawn(function()
    local ok, thumbnail = pcall(function()
        return Players:GetUserThumbnailAsync(LocalPlayer.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100)
    end)
    if ok and gui.Parent then avatar.Image = thumbnail end
end)
task.spawn(function()
    local ok, info = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId, Enum.InfoType.Asset)
    end)
    if ok and type(info) == "table" and type(info.Name) == "string" and gui.Parent then
        gameName.Text = info.Name
    end
end)

task.spawn(function()
    while gui.Parent do
        tween(accentGradient, { Offset = Vector2.new(0.35, 0) }, 4.5)
        task.wait(4.5)
        if not gui.Parent then break end
        tween(accentGradient, { Offset = Vector2.new(-0.35, 0) }, 4.5)
        task.wait(4.5)
    end
end)
local function formatDuration(milliseconds)
    if milliseconds == nil then
        return "No expiry"
    end
    local numericMilliseconds = tonumber(milliseconds)
    if numericMilliseconds == nil then
        return "Unknown expiry"
    end
    local seconds = math.max(0, math.floor(numericMilliseconds / 1000))
    local days = math.floor(seconds / 86400)
    seconds = seconds % 86400
    local hours = math.floor(seconds / 3600)
    seconds = seconds % 3600
    local minutes = math.floor(seconds / 60)
    if days > 0 then
        return string.format("%dd %dh", days, hours)
    end
    if hours > 0 then
        return string.format("%dh %dm", hours, minutes)
    end
    return string.format("%dm", minutes)
end

local function parseIsoTimestamp(value)
    if type(value) ~= "string" then
        return nil
    end
    local yearText, monthText, dayText, hourText, minuteText, secondText = string.match(value, "^(%d%d%d%d)%-(%d%d)%-(%d%d)[Tt ](%d%d):(%d%d):(%d%d)")
    if not yearText or not monthText or not dayText or not hourText or not minuteText or not secondText then
        return nil
    end
    local year = tonumber(yearText)
    local month = tonumber(monthText)
    local day = tonumber(dayText)
    local hour = tonumber(hourText)
    local minute = tonumber(minuteText)
    local second = tonumber(secondText)
    if year == nil or month == nil or day == nil or hour == nil or minute == nil or second == nil then
        return nil
    end
    local ok, timestamp = pcall(function()
        return DateTime.fromUniversalTime(year, month, day, hour, minute, second).UnixTimestamp
    end)
    if ok and type(timestamp) == "number" then
        return timestamp
    end
    return nil
end


local function showAccountTab()
    activePage = "account"
    if minimized then
        minimized = false
        minimize.Text = "−"
        frame.Size = UDim2.fromOffset(644, 424)
        glow.Size = UDim2.fromOffset(658, 436)
        window.Size = UDim2.fromOffset(660, 440)
    end
    updateVisible()
end

local function setAccountTab(tab)
    local details = tab == "details"
    accountPanel.Visible = details
    accountAccessPanel.Visible = not details
    accountTabButton.BackgroundColor3 = details and palette.violet or palette.raised
    accessTabButton.BackgroundColor3 = details and palette.raised or palette.violet
    accountTabButton.TextColor3 = details and palette.text or palette.muted
    accessTabButton.TextColor3 = details and palette.muted or palette.text
end
accountTabButton.MouseButton1Click:Connect(function() setAccountTab("details") end)
accessTabButton.MouseButton1Click:Connect(function() setAccountTab("security") end)
accountBackButton.MouseButton1Click:Connect(function()
    activePage = "key"
    updateVisible()
end)

local boundHwid = ""
local function maskHwid()
    hwidValue.Text = boundHwid == "" and "HWID unavailable" or "BOUND HWID   " .. string.rep("•", math.clamp(#boundHwid, 10, 26)) .. "   (hold to reveal)"
end
local function revealHwid()
    if boundHwid ~= "" then hwidValue.Text = boundHwid end
end
hwidValue.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then revealHwid() end
end)
hwidValue.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then maskHwid() end
end)
UserInputService.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then maskHwid() end
end)

local function updateAccountDetails()
    if not KEY_INFO then return end
    local remainingMs = KEY_INFO.remainingMs
    local expirySeconds = KEY_INFO.expiresAt and parseIsoTimestamp(KEY_INFO.expiresAt) or nil
    if expirySeconds then
        remainingMs = math.max(0, (expirySeconds - os.time()) * 1000)
    elseif remainingMs ~= nil then
        remainingMs = math.max(0, remainingMs - 1000)
        KEY_INFO.remainingMs = remainingMs
    end
    expiryValue.Text = formatDuration(remainingMs)
    accountValue.Text = tostring(KEY_INFO.lastAccount or LocalPlayer.Name)
    lastUsedValue.Text = tostring(KEY_INFO.lastUsedAt or "Just now")
    resetValue.Text = tostring(KEY_INFO.hwidResetAvailableAt or "Not provided by server")
    expiryValue.TextColor3 = remainingMs ~= nil and remainingMs <= 0 and palette.danger or palette.success
end

task.spawn(function()
    while gui.Parent do
        updateAccountDetails()
        task.wait(1)
    end
end)

local function verifyKey()
    if KEY_VALID then
        print("Zyphor key verified")
        status.Text = "License verified. Welcome to Zyphor."
        status.TextColor3 = Color3.fromRGB(113, 229, 180)
        return
    end
    local key = keyBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
    if key == "" then
        status.Text = "Enter your key first."
        status.TextColor3 = Color3.fromRGB(255, 131, 154)
        return
    end
    local hwid = getHardwareId()
    if not hwid then
        status.Text = "This executor does not expose a HWID function."
        status.TextColor3 = Color3.fromRGB(255, 131, 154)
        return
    end
    validateButton.Text = "VERIFYING KEY…"
    validateButton.Active = false
    validateButton.AutoButtonColor = false
    status.Text = "Checking with Zyphor…"
    status.TextColor3 = Color3.fromRGB(155, 164, 193)
    task.spawn(function()
        local ok, result = pcall(function()
            local base = getServerUrl()
            local response = requestFunction({
                Url = base .. "/key-system/validate",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode({
                    key = key,
                    hwid = hwid,
                    account = LocalPlayer.Name .. " (" .. tostring(LocalPlayer.UserId) .. ")"
                })
            })
            if type(response) ~= "table" then
                error("The server returned no response.")
            end
            local statusCode = tonumber(response.StatusCode or response.Status or 0) or 0
            local body = tostring(response.Body or "")
            local decoded = HttpService:JSONDecode(body)
            if statusCode < 200 or statusCode >= 300 then
                error(decoded.message or decoded.error or ("HTTP " .. tostring(statusCode)))
            end
            return decoded
        end)
        validateButton.Text = "VERIFY KEY   →"
        validateButton.Active = true
        validateButton.AutoButtonColor = true
        if not ok then
            status.Text = tostring(result)
            status.TextColor3 = Color3.fromRGB(255, 131, 154)
            return
        end
        if result and result.valid == true then
            local inspectOk, inspectResult = pcall(function()
                local base = getServerUrl()
                local response = requestFunction({
                    Url = base .. "/key-system/inspect",
                    Method = "POST",
                    Headers = { ["Content-Type"] = "application/json" },
                    Body = HttpService:JSONEncode({ key = key })
                })
                if type(response) ~= "table" then return nil end
                local statusCode = tonumber(response.StatusCode or response.Status or 0) or 0
                if statusCode < 200 or statusCode >= 300 then return nil end
                return HttpService:JSONDecode(tostring(response.Body or ""))
            end)
            if inspectOk and type(inspectResult) == "table" then
                for _, field in ipairs({ "keyId", "hwid", "createdAt", "expiresAt", "remainingMs", "durationMinutes", "lastUsedAt", "lastAccount", "account", "hwidResetAvailableAt", "hwidResetRemainingMs", "valid", "expired", "disabled" }) do
                    if inspectResult[field] ~= nil then result[field] = inspectResult[field] end
                end
            end
            KEY_VALID = true
            local remainingMs = result.remainingMs
            if remainingMs == nil and result.expiresAt then
                local expirySeconds = parseIsoTimestamp(result.expiresAt)
                if expirySeconds ~= nil then
                    remainingMs = math.max(0, (expirySeconds - os.time()) * 1000)
                end
            end
            KEY_INFO = {
                keyId = result.keyId,
                hwid = result.hwid or hwid,
                expiresAt = result.expiresAt,
                remainingMs = remainingMs,
                durationMinutes = result.durationMinutes,
                lastUsedAt = result.lastUsedAt,
                lastAccount = result.lastAccount or result.account or (LocalPlayer.Name .. " (" .. tostring(LocalPlayer.UserId) .. ")"),
                hwidResetAvailableAt = result.hwidResetAvailableAt
            }
            _G.ZyphorKeyValid = true
            _G.ZyphorKeyInfo = KEY_INFO
            _G.ZyphorKeyHWID = KEY_INFO.hwid
            _G.ZyphorKeyExpiresAt = KEY_INFO.expiresAt
            _G.ZyphorKeyRemainingMs = KEY_INFO.remainingMs
            if type(getgenv) == "function" then
                pcall(function()
                    local env = getgenv()
                    env.ZyphorKeyValid = true
                    env.ZyphorKeyInfo = KEY_INFO
                    env.ZyphorKeyHWID = KEY_INFO.hwid
                    env.ZyphorKeyExpiresAt = KEY_INFO.expiresAt
                    env.ZyphorKeyRemainingMs = KEY_INFO.remainingMs
                end)
            end
            boundHwid = tostring(KEY_INFO.hwid or "")
            maskHwid()
            updateAccountDetails()
            print("Zyphor key verified")
            status.Text = "License verified. Welcome to Zyphor."
            status.TextColor3 = Color3.fromRGB(113, 229, 180)
            validateButton.Text = "ACCESS GRANTED   ✓"
            tween(validateButton, { BackgroundColor3 = Color3.fromRGB(40, 157, 119) }, 0.2)
            task.delay(0.65, function()
                if gui and gui.Parent then
                    showAccountTab()
                    setAccountTab("details")
                end
            end)
        else
            status.Text = tostring(result and (result.message or result.error) or "Invalid key.")
            status.TextColor3 = Color3.fromRGB(255, 131, 154)
        end
    end)
end

validateButton.MouseButton1Click:Connect(verifyKey)
keyBox.FocusLost:Connect(function(enterPressed)
    if enterPressed and validateButton.Active then
        verifyKey()
    end
end)
