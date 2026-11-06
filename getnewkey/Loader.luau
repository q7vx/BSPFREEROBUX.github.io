local Players = game:GetService("Players")
local CoreGui = game:GetService("CoreGui")
local GuiService = game:GetService("GuiService")
local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local MarketplaceService = game:GetService("MarketplaceService")
local ContentProvider = game:GetService("ContentProvider")
local LocalPlayer = Players.LocalPlayer
if not LocalPlayer then return end

local BASE_WIDTH, BASE_HEIGHT = 824, 562
local SERVER_CONFIG = "https://zyphor.cc/server.txt"
local LOGO_URL = "https://zyphor.cc/Logo1.png"
local KEY_URL = "https://zyphor.cc/getnewkey"
local TOS_URL = "https://zyphor.cc/tos.html"
local PRIVACY_URL = "https://zyphor.cc/pp.html"
local TEAM_URL = "https://zyphor.cc/TeamVaprix"
local C = {
    base = Color3.fromRGB(9, 12, 23),
    panel = Color3.fromRGB(18, 23, 42),
    panelLight = Color3.fromRGB(26, 30, 53),
    border = Color3.fromRGB(59, 64, 112),
    text = Color3.fromRGB(247, 249, 255),
    muted = Color3.fromRGB(158, 169, 198),
    faint = Color3.fromRGB(111, 124, 159),
    violet = Color3.fromRGB(145, 80, 255),
    violet2 = Color3.fromRGB(114, 99, 255),
    lilac = Color3.fromRGB(197, 137, 255),
    cyan = Color3.fromRGB(91, 212, 255),
    green = Color3.fromRGB(105, 237, 190),
    red = Color3.fromRGB(255, 133, 165),
    amber = Color3.fromRGB(255, 200, 120)
}

local activeRequest
if type(syn) == "table" and type(syn.request) == "function" then
    activeRequest = syn.request
elseif type(http_request) == "function" then
    activeRequest = http_request
elseif type(request) == "function" then
    activeRequest = request
elseif type(http) == "table" and type(http.request) == "function" then
    activeRequest = http.request
end

local function httpCall(url, method, body)
    if type(activeRequest) ~= "function" then error("Your executor does not support HTTP requests.") end
    local args = { Url = url, Method = method or "GET", Headers = { ["Accept"] = "application/json" } }
    if body ~= nil then
        args.Headers["Content-Type"] = "application/json"
        args.Body = HttpService:JSONEncode(body)
    end
    local response = activeRequest(args)
    if type(response) ~= "table" then error("The server did not return a response.") end
    local code = tonumber(response.StatusCode or response.Status or 0) or 0
    local text = tostring(response.Body or "")
    if code < 200 or code >= 300 then
        local decoded
        pcall(function() decoded = HttpService:JSONDecode(text) end)
        error((type(decoded) == "table" and (decoded.message or decoded.error)) or ("Request failed (HTTP " .. tostring(code) .. ")."))
    end
    return text
end

local function apiServer()
    local address = httpCall(SERVER_CONFIG):gsub("%s+", ""):gsub("/+$", "")
    if not address:match("^https?://[%w%p]+$") then error("The Zyphor server address is invalid.") end
    return address
end

local function getHWID()
    local attempts = {
        function() if type(gethwid) == "function" then return gethwid() end end,
        function() if type(syn) == "table" and type(syn.gethwid) == "function" then return syn.gethwid() end end,
        function() if type(getgenv) == "function" then local e = getgenv() if type(e) == "table" and type(e.gethwid) == "function" then return e.gethwid() end end end
    }
    for _, fn in ipairs(attempts) do
        local ok, result = pcall(fn)
        if ok and result ~= nil and tostring(result) ~= "" then return tostring(result) end
    end
end

local function normalizeJson(text)
    local decoded = HttpService:JSONDecode(text)
    if type(decoded) ~= "table" then error("The license server returned invalid data.") end
    return decoded
end

local function externalURL(url)
    if type(syn) == "table" and type(syn.open_url) == "function" then
        if pcall(syn.open_url, url) then return "opened" end
    end
    if type(open_url) == "function" and pcall(open_url, url) then return "opened" end
    if pcall(function() GuiService:OpenBrowserWindow(url) end) then return "opened" end
    if type(setclipboard) == "function" and pcall(setclipboard, url) then return "copied" end
    return "manual"
end

local function make(class, parent, properties)
    local obj = Instance.new(class)
    for property, value in pairs(properties or {}) do obj[property] = value end
    obj.Parent = parent
    return obj
end

local function corner(obj, pixels)
    make("UICorner", obj, { CornerRadius = UDim.new(0, pixels or 12) })
    return obj
end

local function stroke(obj, color, transparency, thickness)
    return make("UIStroke", obj, { Color = color or C.border, Transparency = transparency or 0, Thickness = thickness or 1 })
end

local function gradient(obj, colors, rotation)
    local points = {}
    for i, color in ipairs(colors) do
        points[i] = ColorSequenceKeypoint.new((i - 1) / (#colors - 1), color)
    end
    return make("UIGradient", obj, { Color = ColorSequence.new(points), Rotation = rotation or 0 })
end

local function label(parent, name, content, x, y, w, h, font, size, color, align)
    return make("TextLabel", parent, {
        Name = name,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(w, h),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        Text = content,
        Font = font or Enum.Font.Gotham,
        TextSize = size or 13,
        TextColor3 = color or C.text,
        TextXAlignment = align or Enum.TextXAlignment.Left,
        TextYAlignment = Enum.TextYAlignment.Center,
        TextTruncate = Enum.TextTruncate.AtEnd,
        ZIndex = 7
    })
end

local function pill(parent, name, content, x, y, w, h, background, foreground, fontSize)
    local item = make("TextButton", parent, {
        Name = name,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(w, h),
        BackgroundColor3 = background or C.panelLight,
        BorderSizePixel = 0,
        AutoButtonColor = false,
        Text = content,
        Font = Enum.Font.GothamBold,
        TextSize = fontSize or 12,
        TextColor3 = foreground or C.text,
        ZIndex = 8
    })
    corner(item, math.min(13, h / 3))
    return item
end

local function panel(parent, name, x, y, w, h, background, borderColor)
    local item = corner(make("Frame", parent, {
        Name = name,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(w, h),
        BackgroundColor3 = background or C.panel,
        BorderSizePixel = 0,
        ZIndex = 5
    }), 17)
    stroke(item, borderColor or C.border, 0.23)
    return item
end

local function animate(obj, props, seconds, style)
    if not obj or not obj.Parent then return end
    local t = TweenService:Create(obj, TweenInfo.new(seconds or 0.22, style or Enum.EasingStyle.Quint, Enum.EasingDirection.Out), props)
    t:Play()
    return t
end

local rootParent = CoreGui
if type(gethui) == "function" then
    local ok, result = pcall(gethui)
    if ok and typeof(result) == "Instance" then rootParent = result end
end
local root = make("ScreenGui", rootParent, {
    Name = "ZyphorNeonLicenseUI",
    ResetOnSpawn = false,
    IgnoreGuiInset = true,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
    DisplayOrder = 9876
})
if not root.Parent then
    root.Parent = LocalPlayer:WaitForChild("PlayerGui")
end
pcall(function()
    for _, c in ipairs(root.Parent:GetChildren()) do
        if c ~= root and (c.Name == "ZyphorNeonLicenseUI" or c.Name == "ZyphorKeyClient") then c:Destroy() end
    end
end)

local holder = make("Frame", root, {
    Name = "MovingWindow",
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.fromScale(0.5, 0.5),
    Size = UDim2.fromOffset(BASE_WIDTH, BASE_HEIGHT),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
    ZIndex = 1
})
local uiScale = make("UIScale", holder, { Scale = 1 })
local aura = corner(make("Frame", holder, {
    Name = "OuterNeonBloom",
    Position = UDim2.fromOffset(4, 4),
    Size = UDim2.fromOffset(BASE_WIDTH - 8, BASE_HEIGHT - 8),
    BackgroundColor3 = C.violet,
    BackgroundTransparency = 0.98,
    BorderSizePixel = 0,
    ZIndex = 1
}), 30)
local auraStroke = stroke(aura, C.violet, 0.6, 5)
local auraStroke2 = stroke(aura, C.cyan, 0.87, 10)
local main = corner(make("Frame", holder, {
    Name = "NeonShell",
    Position = UDim2.fromOffset(10, 10),
    Size = UDim2.fromOffset(BASE_WIDTH - 20, BASE_HEIGHT - 20),
    BackgroundColor3 = C.base,
    BorderSizePixel = 0,
    ClipsDescendants = true,
    ZIndex = 2
}), 22)
local mainStroke = stroke(main, C.violet, 0.35, 2)
gradient(main, { Color3.fromRGB(19, 19, 39), Color3.fromRGB(8, 12, 27), Color3.fromRGB(12, 14, 31) }, 112)

local ambientPlate = corner(make("Frame", main, {
    Name = "SeamlessAmbientPlate",
    Position = UDim2.fromOffset(11, 11),
    Size = UDim2.fromOffset(782, 520),
    BackgroundColor3 = Color3.fromRGB(11, 15, 35),
    BackgroundTransparency = 0.06,
    BorderSizePixel = 0,
    ClipsDescendants = true,
    ZIndex = 2
}), 15)
gradient(ambientPlate, { Color3.fromRGB(26, 16, 57), Color3.fromRGB(11, 22, 47), Color3.fromRGB(8, 13, 32), Color3.fromRGB(25, 16, 49) }, 30)

local backgroundEffects = make("Frame", ambientPlate, {
    Name = "AnimatedAmbientField",
    Size = UDim2.fromScale(1, 1),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
    ClipsDescendants = true,
    ZIndex = 3
})

local function glowOrb(name, x, y, diameter, color, transparency, duration)
    local orb = corner(make("Frame", backgroundEffects, {
        Name = name,
        AnchorPoint = Vector2.new(0.5, 0.5),
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(diameter, diameter),
        BackgroundColor3 = color,
        BackgroundTransparency = transparency,
        BorderSizePixel = 0,
        ZIndex = 3
    }), diameter)
    make("UIGradient", orb, {
        Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 0.66),
            NumberSequenceKeypoint.new(0.5, 0.25),
            NumberSequenceKeypoint.new(1, 0.8)
        }),
        Rotation = 30
    })
    TweenService:Create(orb, TweenInfo.new(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Size = UDim2.fromOffset(diameter + 58, diameter + 58),
        BackgroundTransparency = math.min(0.99, transparency + 0.035)
    }):Play()
    return orb
end

glowOrb("VioletAurora", 98, 361, 310, C.violet, 0.938, 8.6)
glowOrb("CyanAurora", 675, 108, 290, C.cyan, 0.953, 10.8)
glowOrb("RoseAurora", 563, 431, 235, C.lilac, 0.966, 12.6)

for i = 1, 19 do
    local x = i * 41
    local line = make("Frame", backgroundEffects, {
        Name = "GridVertical" .. i,
        Position = UDim2.fromOffset(x, 9),
        Size = UDim2.fromOffset(1, 498),
        BackgroundColor3 = (i % 3 == 0) and C.cyan or C.violet,
        BackgroundTransparency = 0.962,
        BorderSizePixel = 0,
        ZIndex = 3
    })
    make("UIGradient", line, {
        Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 1),
            NumberSequenceKeypoint.new(0.32, 0.15),
            NumberSequenceKeypoint.new(0.7, 0.28),
            NumberSequenceKeypoint.new(1, 1)
        })
    })
end
for i = 1, 12 do
    local y = i * 41
    local line = make("Frame", backgroundEffects, {
        Name = "GridHorizontal" .. i,
        Position = UDim2.fromOffset(9, y),
        Size = UDim2.fromOffset(765, 1),
        BackgroundColor3 = (i % 3 == 0) and C.lilac or C.cyan,
        BackgroundTransparency = 0.968,
        BorderSizePixel = 0,
        ZIndex = 3
    })
    make("UIGradient", line, {
        Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 1),
            NumberSequenceKeypoint.new(0.2, 0.18),
            NumberSequenceKeypoint.new(0.76, 0.3),
            NumberSequenceKeypoint.new(1, 1)
        })
    })
end

local rng = Random.new(20626)
for i = 1, 64 do
    local dotSize = rng:NextInteger(2, 4)
    local x = rng:NextInteger(23, 756)
    local y = rng:NextInteger(18, 502)
    local color = i % 4 == 0 and C.cyan or i % 4 == 1 and C.lilac or i % 4 == 2 and C.violet or C.text
    local dot = corner(make("Frame", backgroundEffects, {
        Name = "DriftingParticle" .. i,
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(dotSize, dotSize),
        BackgroundColor3 = color,
        BackgroundTransparency = rng:NextNumber(0.60, 0.88),
        BorderSizePixel = 0,
        ZIndex = 3
    }), dotSize)
    local travelX = math.clamp(x + rng:NextInteger(-38, 38), 23, 756)
    local travelY = math.clamp(y + rng:NextInteger(-48, 26), 18, 502)
    TweenService:Create(dot, TweenInfo.new(rng:NextNumber(3.0, 8.5), Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true, rng:NextNumber(0, 4)), {
        Position = UDim2.fromOffset(travelX, travelY),
        BackgroundTransparency = rng:NextNumber(0.91, 0.99)
    }):Play()
end

local function ring(name, x, y, diameter, color, alpha, time)
    local r = corner(make("Frame", backgroundEffects, {
        Name = name,
        AnchorPoint = Vector2.new(0.5, 0.5),
        Position = UDim2.fromOffset(x, y),
        Size = UDim2.fromOffset(diameter, diameter),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        ZIndex = 3
    }), diameter)
    local line = stroke(r, color, alpha, 1.3)
    TweenService:Create(r, TweenInfo.new(time, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Size = UDim2.fromOffset(diameter + 34, diameter + 34),
        Rotation = 18
    }):Play()
    TweenService:Create(line, TweenInfo.new(time, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Transparency = math.min(0.99, alpha + 0.15)
    }):Play()
    return r
end
ring("OrbitalCircuitA", 639, 320, 156, C.cyan, 0.84, 9)
ring("OrbitalCircuitB", 639, 320, 216, C.violet, 0.91, 11)
ring("OrbitalCircuitC", 141, 276, 210, C.lilac, 0.91, 13)

for i = 1, 5 do
    local y = 125 + i * 66
    local streak = make("Frame", backgroundEffects, {
        Name = "NeonDataStream" .. i,
        Position = UDim2.fromOffset(-185 - (i * 32), y),
        Size = UDim2.fromOffset(rng:NextInteger(92, 167), 1),
        BackgroundColor3 = i % 2 == 0 and C.cyan or C.lilac,
        BackgroundTransparency = 0.68,
        BorderSizePixel = 0,
        ZIndex = 3
    })
    make("UIGradient", streak, {
        Transparency = NumberSequence.new({
            NumberSequenceKeypoint.new(0, 1),
            NumberSequenceKeypoint.new(0.5, 0.05),
            NumberSequenceKeypoint.new(1, 1)
        }),
        Rotation = 0
    })
    TweenService:Create(streak, TweenInfo.new(7.4 + i * 1.5, Enum.EasingStyle.Linear, Enum.EasingDirection.In, -1, false, i * 0.6), {
        Position = UDim2.fromOffset(810, y - (i * 8))
    }):Play()
end

local scanBeam = make("Frame", backgroundEffects, {
    Name = "AmbientScanningWave",
    Position = UDim2.fromOffset(15, -34),
    Size = UDim2.fromOffset(754, 37),
    BackgroundColor3 = C.cyan,
    BackgroundTransparency = 0.977,
    BorderSizePixel = 0,
    ZIndex = 3
})
make("UIGradient", scanBeam, {
    Transparency = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 1),
        NumberSequenceKeypoint.new(0.78, 0.36),
        NumberSequenceKeypoint.new(1, 0.95)
    }),
    Rotation = 90
})
TweenService:Create(scanBeam, TweenInfo.new(12, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1, false, 1), {
    Position = UDim2.fromOffset(15, 537)
}):Play()

local lowerAmbient = make("Frame", backgroundEffects, {
    Name = "LowerFrequencyBand",
    Position = UDim2.fromOffset(25, 462),
    Size = UDim2.fromOffset(732, 2),
    BackgroundColor3 = C.cyan,
    BackgroundTransparency = 0.90,
    BorderSizePixel = 0,
    ZIndex = 3
})
local lowerGradient = gradient(lowerAmbient, { C.violet, C.cyan, C.violet, C.lilac }, 0)
TweenService:Create(lowerGradient, TweenInfo.new(6.4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
    Offset = Vector2.new(0.34, 0)
}):Play()

local topRadiance = corner(make("Frame", main, {
    Name = "HeaderLuminescence",
    Position = UDim2.fromOffset(16, 10),
    Size = UDim2.fromOffset(772, 68),
    BackgroundColor3 = Color3.fromRGB(16, 18, 39),
    BackgroundTransparency = 0.32,
    BorderSizePixel = 0,
    ZIndex = 4
}), 13)
gradient(topRadiance, { Color3.fromRGB(68, 36, 127), Color3.fromRGB(19, 24, 55), Color3.fromRGB(11, 29, 56) }, 7)

local upperLine = make("Frame", main, {
    Name = "LightTrace",
    Position = UDim2.fromOffset(24, 3),
    Size = UDim2.fromOffset(757, 2),
    BackgroundColor3 = C.violet,
    BackgroundTransparency = 0.04,
    BorderSizePixel = 0,
    ZIndex = 9
})
local upperGradient = gradient(upperLine, { C.lilac, C.violet2, C.cyan }, 0)
local horizontalRule = make("Frame", main, {
    Position = UDim2.fromOffset(25, 82),
    Size = UDim2.fromOffset(752, 1),
    BackgroundColor3 = Color3.fromRGB(68, 70, 123),
    BackgroundTransparency = 0.46,
    BorderSizePixel = 0,
    ZIndex = 5
})

local logoBox = corner(make("Frame", main, {
    Name = "OfficialZyphorLogoSlot",
    Position = UDim2.fromOffset(31, 21),
    Size = UDim2.fromOffset(49, 49),
    BackgroundColor3 = Color3.fromRGB(41, 29, 90),
    BorderSizePixel = 0,
    ZIndex = 8
}), 13)
stroke(logoBox, C.lilac, 0.33, 1.2)
gradient(logoBox, { Color3.fromRGB(80, 32, 145), Color3.fromRGB(32, 40, 102) }, 30)
local logoFallback = label(logoBox, "LogoFallback", "Z", 5, 0, 39, 49, Enum.Font.GothamBlack, 31, C.text, Enum.TextXAlignment.Center)
local logoImage = make("ImageLabel", logoBox, {
    Name = "OfficialZyphorLogo",
    Position = UDim2.fromOffset(3, 3),
    Size = UDim2.fromOffset(43, 43),
    BackgroundTransparency = 1,
    ScaleType = Enum.ScaleType.Fit,
    Visible = false,
    ZIndex = 10
})
local brand = label(main, "BrandName", "ZYPHOR", 95, 19, 205, 30, Enum.Font.GothamBlack, 23, C.text)
brand.TextStrokeColor3 = Color3.fromRGB(74, 69, 121)
brand.TextStrokeTransparency = 0.85
label(main, "BrandSubtitle", "KEY SYSTEM  /  SECURE ACCESS", 96, 46, 280, 19, Enum.Font.GothamMedium, 10, C.muted)

local readyCard = corner(make("Frame", main, {
    Name = "ReadyBadge",
    Position = UDim2.fromOffset(529, 30),
    Size = UDim2.fromOffset(127, 30),
    BackgroundColor3 = Color3.fromRGB(12, 46, 40),
    BorderSizePixel = 0,
    ZIndex = 9
}), 15)
stroke(readyCard, C.green, 0.55)
local readyDot = corner(make("Frame", readyCard, {
    Position = UDim2.fromOffset(12, 11),
    Size = UDim2.fromOffset(8, 8),
    BackgroundColor3 = C.green,
    BorderSizePixel = 0,
    ZIndex = 10
}), 4)
local readyTitle = label(readyCard, "ReadyText", "SYSTEM READY", 28, 3, 94, 23, Enum.Font.GothamBold, 10, C.green)
local minimizeButton = pill(main, "Minimize", "−", 677, 28, 40, 33, Color3.fromRGB(30, 35, 58), C.text, 20)
local closeButton = pill(main, "Close", "×", 726, 28, 40, 33, Color3.fromRGB(40, 30, 55), Color3.fromRGB(244, 213, 235), 20)
stroke(minimizeButton, C.border, 0.4)
stroke(closeButton, C.border, 0.4)

local footerRule = make("Frame", main, {
    Position = UDim2.fromOffset(25, 498),
    Size = UDim2.fromOffset(752, 1),
    BackgroundColor3 = C.border,
    BackgroundTransparency = 0.54,
    BorderSizePixel = 0,
    ZIndex = 5
})
local footerTos = pill(main, "TermsOfService", "▤  TOS", 29, 506, 75, 27, C.panelLight, C.text, 10)
local footerPrivacy = pill(main, "PrivacyPolicy", "◇  PRIVACY", 113, 506, 109, 27, C.panelLight, C.text, 10)
local footerTeam = pill(main, "TeamVaprix", "♧  TEAM  ↗", 231, 506, 111, 27, C.panelLight, C.text, 10)
for _, b in ipairs({ footerTos, footerPrivacy, footerTeam }) do stroke(b, C.border, 0.45) end
label(main, "FooterBrand", "ZYPHOR.CC  •  MADE BY TEAM VAPRIX", 433, 507, 342, 24, Enum.Font.GothamMedium, 10, Color3.fromRGB(188, 185, 214), Enum.TextXAlignment.Right)

local entryPage = make("Frame", main, {
    Name = "LicenseEntry",
    Position = UDim2.fromOffset(0, 85),
    Size = UDim2.fromOffset(804, 412),
    BackgroundTransparency = 1,
    ZIndex = 5
})
local accountPage = make("Frame", main, {
    Name = "AccountSummary",
    Position = UDim2.fromOffset(0, 85),
    Size = UDim2.fromOffset(804, 412),
    BackgroundTransparency = 1,
    Visible = false,
    ZIndex = 5
})

local leftGlass = panel(entryPage, "EntryPanel", 21, 16, 443, 386, Color3.fromRGB(13, 16, 35), Color3.fromRGB(52, 50, 101))
leftGlass.BackgroundTransparency = 0.22
local entryTint = make("Frame", leftGlass, {
    Position = UDim2.fromOffset(0, 0),
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Color3.fromRGB(16, 21, 40),
    BackgroundTransparency = 0.40,
    BorderSizePixel = 0,
    ZIndex = 6
})
corner(entryTint, 17)
gradient(entryTint, { Color3.fromRGB(20, 24, 53), Color3.fromRGB(15, 16, 38), Color3.fromRGB(15, 30, 48) }, 28)
label(leftGlass, "IntroEyebrow", "✦   ZYPHOR PRIVATE ACCESS", 25, 16, 388, 20, Enum.Font.GothamBold, 10, C.lilac)
local headline = label(leftGlass, "Headline", "Unlock your script.", 25, 44, 391, 44, Enum.Font.GothamBlack, 28, C.text)
local headlineAccent = make("Frame", leftGlass, {
    Position = UDim2.fromOffset(27, 88),
    Size = UDim2.fromOffset(173, 2),
    BackgroundColor3 = C.violet,
    BackgroundTransparency = 0.08,
    BorderSizePixel = 0,
    ZIndex = 7
})
gradient(headlineAccent, { C.violet, C.cyan }, 0)
local desc = label(leftGlass, "Description", "Enter your Zyphor license to verify access\nand unlock your protected script.", 26, 98, 390, 42, Enum.Font.Gotham, 12, C.muted)
desc.TextWrapped = true
desc.TextYAlignment = Enum.TextYAlignment.Top
desc.TextTruncate = Enum.TextTruncate.None
label(leftGlass, "KeyLabel", "◇   LICENSE KEY", 27, 142, 260, 24, Enum.Font.GothamBold, 11, Color3.fromRGB(220, 215, 249))
local inputGlow = panel(leftGlass, "InputGlow", 25, 170, 393, 52, Color3.fromRGB(15, 16, 43), C.violet)
inputGlow.ZIndex = 7
local inputBorder = inputGlow:FindFirstChildOfClass("UIStroke")
inputBorder.Thickness = 1.5
inputBorder.Transparency = 0.13
local inputBg = make("Frame", inputGlow, {
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Color3.fromRGB(15, 19, 43),
    BorderSizePixel = 0,
    ZIndex = 7
})
corner(inputBg, 16)
gradient(inputBg, { Color3.fromRGB(35, 22, 68), Color3.fromRGB(17, 22, 48), Color3.fromRGB(13, 36, 61) }, 0)
local keySymbol = label(inputGlow, "KeyIcon", "♢", 14, 4, 33, 44, Enum.Font.GothamBold, 27, C.lilac, Enum.TextXAlignment.Center)
local keyBox = make("TextBox", inputGlow, {
    Name = "KeyInput",
    Position = UDim2.fromOffset(57, 6),
    Size = UDim2.fromOffset(325, 40),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
    ClearTextOnFocus = false,
    Font = Enum.Font.Code,
    TextSize = 14,
    TextColor3 = C.text,
    PlaceholderColor3 = Color3.fromRGB(150, 150, 188),
    PlaceholderText = "Paste your key here...",
    Text = "",
    TextXAlignment = Enum.TextXAlignment.Left,
    ZIndex = 10
})

local verifyButton = pill(leftGlass, "VerifyKey", "VERIFY KEY   →", 25, 233, 393, 53, C.violet, C.text, 15)
verifyButton.ZIndex = 9
local verifyGradient = gradient(verifyButton, { Color3.fromRGB(172, 77, 255), Color3.fromRGB(116, 68, 246), Color3.fromRGB(93, 105, 255) }, 6)
stroke(verifyButton, C.lilac, 0.36, 1.4)
local verifySheen = make("Frame", verifyButton, {
    Position = UDim2.fromScale(0, 0),
    Size = UDim2.fromScale(0.35, 1),
    BackgroundColor3 = Color3.new(1, 1, 1),
    BackgroundTransparency = 0.97,
    BorderSizePixel = 0,
    ZIndex = 8
})
corner(verifySheen, 11)
local getKeyButton = pill(leftGlass, "GetKey", "↗   GET A KEY", 25, 294, 393, 43, Color3.fromRGB(32, 34, 66), C.text, 13)
getKeyButton.ZIndex = 9
stroke(getKeyButton, C.border, 0.13, 1.1)
local statusPanel = panel(leftGlass, "StatusPanel", 25, 346, 393, 33, Color3.fromRGB(15, 37, 56), Color3.fromRGB(65, 157, 220))
statusPanel.ZIndex = 9
local statusDot = corner(make("Frame", statusPanel, {
    Name = "StateDot",
    Position = UDim2.fromOffset(15, 12),
    Size = UDim2.fromOffset(9, 9),
    BackgroundColor3 = C.cyan,
    BorderSizePixel = 0,
    ZIndex = 10
}), 5)
local statusLabel = label(statusPanel, "StateText", "Enter a license key to get started.", 35, 3, 350, 26, Enum.Font.GothamMedium, 11, Color3.fromRGB(205, 218, 245))
statusLabel.TextWrapped = true
statusLabel.TextTruncate = Enum.TextTruncate.None

local experienceHeader = label(entryPage, "CurrentExperienceLabel", "▱   CURRENT EXPERIENCE", 481, 20, 294, 29, Enum.Font.GothamBold, 13, C.text)
local gamePanel = panel(entryPage, "DetectedGameCard", 481, 55, 298, 142, Color3.fromRGB(22, 28, 60), Color3.fromRGB(61, 113, 188))
gradient(gamePanel, { Color3.fromRGB(30, 32, 68), Color3.fromRGB(15, 31, 62), Color3.fromRGB(22, 29, 59) }, 0)
local gameInner = panel(gamePanel, "ExperienceMeta", 12, 15, 274, 111, Color3.fromRGB(25, 28, 56), Color3.fromRGB(74, 74, 134))
gameInner.ZIndex = 7
local gameThumbFrame = corner(make("Frame", gameInner, {
    Name = "GameIconHalo",
    Position = UDim2.fromOffset(11, 15),
    Size = UDim2.fromOffset(77, 77),
    BackgroundColor3 = Color3.fromRGB(55, 32, 115),
    BackgroundTransparency = 0.18,
    BorderSizePixel = 0,
    ZIndex = 8
}), 16)
local gameIconHaloStroke = stroke(gameThumbFrame, C.lilac, 0.35, 2)
local gameThumb = corner(make("ImageLabel", gameInner, {
    Name = "CurrentGameIcon",
    Position = UDim2.fromOffset(14, 18),
    Size = UDim2.fromOffset(71, 71),
    BackgroundColor3 = Color3.fromRGB(31, 28, 83),
    BorderSizePixel = 0,
    Image = "",
    ScaleType = Enum.ScaleType.Crop,
    ZIndex = 9
}), 14)
stroke(gameThumb, C.violet, 0.4)
label(gameInner, "Detected", "DETECTED GAME", 98, 19, 164, 18, Enum.Font.GothamBold, 10, C.muted)
local gameName = label(gameInner, "GameTitle", game.Name, 98, 42, 163, 29, Enum.Font.GothamBold, 17, C.text)
local gameFallback = label(gameInner, "GameIconFallback", "◈", 14, 18, 71, 71, Enum.Font.GothamBlack, 36, C.lilac, Enum.TextXAlignment.Center)
gameFallback.ZIndex = 10
gameThumb.ImageTransparency = 1
local gameLoaded = false
label(gameInner, "GameId", "PLACE ID  " .. tostring(game.PlaceId), 98, 75, 160, 18, Enum.Font.Code, 10, C.muted)

local gameAccentBar = make("Frame", gamePanel, {
    Name = "LiveExperienceAccent",
    Position = UDim2.fromOffset(14, 6),
    Size = UDim2.fromOffset(267, 2),
    BackgroundColor3 = C.cyan,
    BackgroundTransparency = 0.42,
    BorderSizePixel = 0,
    ZIndex = 7
})
local gameAccentGradient = gradient(gameAccentBar, { C.violet, C.cyan, C.lilac }, 0)
TweenService:Create(gameAccentGradient, TweenInfo.new(3.4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
    Offset = Vector2.new(0.36, 0)
}):Play()

label(entryPage, "AccountHeader", "♙   YOUR ACCOUNT", 481, 210, 298, 27, Enum.Font.GothamBold, 13, C.text)
local userCard = panel(entryPage, "UserPanel", 481, 244, 298, 158, Color3.fromRGB(21, 25, 53), Color3.fromRGB(72, 62, 151))
gradient(userCard, { Color3.fromRGB(33, 28, 73), Color3.fromRGB(23, 32, 69), Color3.fromRGB(18, 25, 54) }, 24)
local avatarGlow = corner(make("Frame", userCard, {
    Position = UDim2.fromOffset(17, 16),
    Size = UDim2.fromOffset(76, 76),
    BackgroundColor3 = Color3.fromRGB(83, 53, 164),
    BorderSizePixel = 0,
    ZIndex = 7
}), 38)
stroke(avatarGlow, C.lilac, 0.16, 2)
local avatar = corner(make("ImageLabel", avatarGlow, {
    Name = "PlayerAvatar",
    Position = UDim2.fromOffset(4, 4),
    Size = UDim2.fromOffset(68, 68),
    BackgroundColor3 = C.panelLight,
    BorderSizePixel = 0,
    Image = "",
    ZIndex = 8
}), 34)
label(userCard, "Welcome", "Welcome back,", 109, 33, 177, 22, Enum.Font.Gotham, 13, C.muted)
local username = label(userCard, "AccountName", LocalPlayer.DisplayName .. "!", 109, 58, 178, 31, Enum.Font.GothamBold, 19, C.text)
label(userCard, "UserHandle", "@" .. LocalPlayer.Name, 109, 89, 179, 15, Enum.Font.GothamMedium, 10, C.lilac)
local chips = {}
for i, entry in ipairs({ { "▣  7 DAYS", 12, 91, C.lilac }, { "◈  HWID", 108, 82, C.cyan }, { "⬡  SECURE", 198, 88, C.green } }) do
    local chip = corner(make("Frame", userCard, {
        Name = "SecurityChip" .. i,
        Position = UDim2.fromOffset(entry[2], 119),
        Size = UDim2.fromOffset(entry[3], 28),
        BackgroundColor3 = Color3.fromRGB(26, 35, 65),
        BorderSizePixel = 0,
        ZIndex = 8
    }), 10)
    stroke(chip, entry[4], 0.48)
    label(chip, "ChipText", entry[1], 0, 0, entry[3], 28, Enum.Font.GothamBold, 10, entry[4], Enum.TextXAlignment.Center)
    chips[#chips + 1] = chip
end

label(accountPage, "SummaryEyebrow", "✦   VERIFIED SESSION", 33, 23, 337, 23, Enum.Font.GothamBold, 11, C.green)
label(accountPage, "SummaryTitle", "License dashboard", 32, 53, 521, 45, Enum.Font.GothamBlack, 30, C.text)
label(accountPage, "SummaryDescription", "Your key is active and bound to this device.", 33, 102, 500, 23, Enum.Font.Gotham, 13, C.muted)
local detailsTab = pill(accountPage, "DetailsTab", "LICENSE DETAILS", 33, 147, 170, 38, C.violet, C.text, 12)
local securityTab = pill(accountPage, "SecurityTab", "DEVICE SECURITY", 211, 147, 179, 38, C.panelLight, C.muted, 12)
local backTab = pill(accountPage, "BackTab", "← BACK TO KEY", 609, 147, 165, 38, C.panelLight, C.muted, 11)
for _, tab in ipairs({ detailsTab, securityTab, backTab }) do stroke(tab, C.border, 0.42) end
local summaryPanel = panel(accountPage, "LicenseFields", 32, 202, 742, 193, Color3.fromRGB(20, 25, 52), Color3.fromRGB(62, 75, 135))
local function field(name, tag, x, y, width)
    label(summaryPanel, name .. "Header", tag, x, y, width, 23, Enum.Font.GothamBold, 11, C.muted)
    return label(summaryPanel, name .. "Value", "—", x, y + 24, width, 30, Enum.Font.GothamBold, 17, C.text)
end
local timeValue = field("TimeRemaining", "TIME REMAINING", 22, 18, 330)
local accountValue = field("LatestAccount", "LAST ACCOUNT", 391, 18, 328)
local lastUsedValue = field("LastUsed", "LAST USED", 22, 106, 330)
local resetValue = field("ResetAvailable", "HWID RESET AVAILABLE", 391, 106, 328)
local securityPanel = panel(accountPage, "DevicePanel", 32, 202, 742, 193, Color3.fromRGB(19, 32, 46), Color3.fromRGB(55, 111, 122))
securityPanel.Visible = false
label(securityPanel, "SecurityStatus", "✓   Device authentication is active", 22, 17, 695, 39, Enum.Font.GothamBold, 19, C.green)
label(securityPanel, "SecurityInstructions", "Hold the value below to reveal your bound hardware ID.", 22, 55, 688, 28, Enum.Font.Gotham, 12, C.muted)
local hwidButton = pill(securityPanel, "HoldToRevealHWID", "••••••••••••••••••••", 20, 96, 701, 65, Color3.fromRGB(11, 24, 38), Color3.fromRGB(183, 239, 225), 15)
hwidButton.Font = Enum.Font.Code
stroke(hwidButton, C.green, 0.7)

local gameCardPulse = gamePanel:FindFirstChildOfClass("UIStroke")
if gameCardPulse then
    TweenService:Create(gameCardPulse, TweenInfo.new(4.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Color = C.cyan,
        Transparency = 0.46
    }):Play()
end
TweenService:Create(gameIconHaloStroke, TweenInfo.new(3.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
    Color = C.cyan,
    Transparency = 0.08
}):Play()

local accountPulse = userCard:FindFirstChildOfClass("UIStroke")
if accountPulse then
    TweenService:Create(accountPulse, TweenInfo.new(5.1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Color = C.lilac,
        Transparency = 0.5
    }):Play()
end

local themeState = { open = true, minimized = false, page = "entry", selection = "details", busy = false, keyValid = false, key = nil, hwid = nil, info = nil, stopping = false, lastCheck = 0 }
local function showStatus(message, kind)
    statusLabel.Text = tostring(message)
    local color = kind == "error" and C.red or kind == "success" and C.green or kind == "warning" and C.amber or C.cyan
    statusLabel.TextColor3 = color
    animate(statusDot, { BackgroundColor3 = color }, 0.18)
    local outline = statusPanel:FindFirstChildOfClass("UIStroke")
    if outline then animate(outline, { Color = color, Transparency = 0.49 }, 0.19) end
end

local function setPage(page)
    themeState.page = page
    entryPage.Visible = not themeState.minimized and page == "entry"
    accountPage.Visible = not themeState.minimized and page == "account"
end
local function setSummaryTab(which)
    themeState.selection = which
    summaryPanel.Visible = which == "details"
    securityPanel.Visible = which == "security"
    detailsTab.BackgroundColor3 = which == "details" and C.violet or C.panelLight
    securityTab.BackgroundColor3 = which == "security" and C.violet or C.panelLight
    detailsTab.TextColor3 = which == "details" and C.text or C.muted
    securityTab.TextColor3 = which == "security" and C.text or C.muted
end

detailsTab.MouseButton1Click:Connect(function() setSummaryTab("details") end)
securityTab.MouseButton1Click:Connect(function() setSummaryTab("security") end)
backTab.MouseButton1Click:Connect(function() setPage("entry") end)

local function hover(btn, rest, active)
    btn.MouseEnter:Connect(function()
        if btn.Active then animate(btn, { BackgroundColor3 = active }, 0.18) end
    end)
    btn.MouseLeave:Connect(function() animate(btn, { BackgroundColor3 = rest }, 0.20) end)
end
for _, obj in ipairs({ footerTos, footerPrivacy, footerTeam, backTab }) do
    hover(obj, C.panelLight, Color3.fromRGB(59, 50, 92))
end
hover(getKeyButton, Color3.fromRGB(32, 34, 66), Color3.fromRGB(57, 48, 103))
hover(minimizeButton, Color3.fromRGB(30, 35, 58), Color3.fromRGB(56, 56, 104))
hover(closeButton, Color3.fromRGB(40, 30, 55), Color3.fromRGB(105, 48, 71))
verifyButton.MouseEnter:Connect(function()
    if not themeState.busy then
        animate(verifyGradient, { Rotation = 22 }, 0.22)
        animate(verifyButton, { TextSize = 16 }, 0.18)
    end
end)
verifyButton.MouseLeave:Connect(function()
    animate(verifyGradient, { Rotation = 6 }, 0.22)
    animate(verifyButton, { TextSize = 15 }, 0.18)
end)
keyBox.Focused:Connect(function()
    animate(inputBorder, { Color = C.cyan, Thickness = 2.4, Transparency = 0 }, 0.2)
end)
keyBox.FocusLost:Connect(function()
    animate(inputBorder, { Color = C.violet, Thickness = 1.5, Transparency = 0.13 }, 0.2)
end)

local function statusLink(url, name)
    local result = externalURL(url)
    if result == "opened" then showStatus("Opening " .. name .. "...", "info")
    elseif result == "copied" then showStatus(name .. " URL copied to clipboard.", "info")
    else showStatus("Open " .. url .. " in your browser.", "warning") end
end
getKeyButton.MouseButton1Click:Connect(function() statusLink(KEY_URL, "key page") end)
footerTos.MouseButton1Click:Connect(function() statusLink(TOS_URL, "Terms of Service") end)
footerPrivacy.MouseButton1Click:Connect(function() statusLink(PRIVACY_URL, "Privacy Policy") end)
footerTeam.MouseButton1Click:Connect(function() statusLink(TEAM_URL, "Team Vaprix") end)

local function clockFromIso(iso)
    if type(iso) ~= "string" then return nil end
    local year, month, day, hour, minute, sec = iso:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)[Tt ](%d%d):(%d%d):(%d%d)")
    if not year then return nil end
    local ok, value = pcall(function()
        return DateTime.fromUniversalTime(tonumber(year), tonumber(month), tonumber(day), tonumber(hour), tonumber(minute), tonumber(sec)).UnixTimestamp
    end)
    if ok then return value end
end

local function duration(ms)
    if ms == nil then return "No expiration" end
    local secs = math.max(0, math.floor((tonumber(ms) or 0) / 1000))
    local days = math.floor(secs / 86400)
    local hours = math.floor((secs % 86400) / 3600)
    local mins = math.floor((secs % 3600) / 60)
    if days > 0 then return string.format("%dd %dh %dm", days, hours, mins) end
    if hours > 0 then return string.format("%dh %dm", hours, mins) end
    return string.format("%dm %ds", mins, secs % 60)
end

local function resetGlobals()
    _G.ZyphorKeyValid = false
    _G.ZyphorKeyInfo = nil
    _G.ZyphorKeyHWID = nil
    _G.ZyphorKeyExpiresAt = nil
    _G.ZyphorKeyRemainingMs = nil
    if type(getgenv) == "function" then
        pcall(function()
            local e = getgenv()
            e.ZyphorKeyValid = false
            e.ZyphorKeyInfo = nil
            e.ZyphorKeyHWID = nil
            e.ZyphorKeyExpiresAt = nil
            e.ZyphorKeyRemainingMs = nil
        end)
    end
end

local function publishGlobals(info)
    _G.ZyphorKeyValid = true
    _G.ZyphorKeyInfo = info
    _G.ZyphorKeyHWID = info.hwid
    _G.ZyphorKeyExpiresAt = info.expiresAt
    _G.ZyphorKeyRemainingMs = info.remainingMs
    if type(getgenv) == "function" then
        pcall(function()
            local e = getgenv()
            e.ZyphorKeyValid = true
            e.ZyphorKeyInfo = info
            e.ZyphorKeyHWID = info.hwid
            e.ZyphorKeyExpiresAt = info.expiresAt
            e.ZyphorKeyRemainingMs = info.remainingMs
        end)
    end
end

local function fetchLicense(key, hwid)
    local server = apiServer()
    local response = normalizeJson(httpCall(server .. "/key-system/validate", "POST", {
        key = key,
        hwid = hwid,
        account = LocalPlayer.Name .. " (" .. tostring(LocalPlayer.UserId) .. ")"
    }))
    if response.valid ~= true then return response end
    local inspectOk, inspect = pcall(function()
        return normalizeJson(httpCall(server .. "/key-system/inspect", "POST", { key = key }))
    end)
    if inspectOk and type(inspect) == "table" then
        for _, fieldName in ipairs({ "keyId", "hwid", "createdAt", "expiresAt", "remainingMs", "durationMinutes", "lastUsedAt", "lastAccount", "account", "hwidResetAvailableAt", "hwidResetRemainingMs", "disabled", "expired", "valid" }) do
            if inspect[fieldName] ~= nil then response[fieldName] = inspect[fieldName] end
        end
    end
    if response.disabled == true or response.expired == true or response.valid == false then
        return { valid = false, message = "The license is disabled or expired." }
    end
    return response
end

local function updateLicenseUI()
    if not themeState.keyValid or not themeState.info then return end
    local info = themeState.info
    local remaining = info.remainingMs
    local expiration = clockFromIso(info.expiresAt)
    if expiration then
        remaining = math.max(0, (expiration - os.time()) * 1000)
    elseif tonumber(info.remainingMs) then
        local elapsed = os.clock() - (info.checkedAt or os.clock())
        remaining = math.max(0, tonumber(info.remainingMs) - elapsed * 1000)
    end
    timeValue.Text = duration(remaining)
    timeValue.TextColor3 = remaining ~= nil and remaining < 1800000 and C.amber or C.green
    accountValue.Text = tostring(info.lastAccount or (LocalPlayer.Name .. " (" .. tostring(LocalPlayer.UserId) .. ")"))
    lastUsedValue.Text = tostring(info.lastUsedAt or "Just now")
    resetValue.Text = tostring(info.hwidResetAvailableAt or "Contact Zyphor support")
    _G.ZyphorKeyRemainingMs = remaining
    if type(getgenv) == "function" then pcall(function() getgenv().ZyphorKeyRemainingMs = remaining end) end
    if remaining ~= nil and remaining <= 0 then
        themeState.keyValid = false
        resetGlobals()
        setPage("entry")
        showStatus("Your license has expired. Generate a new key.", "error")
        verifyButton.Text = "VERIFY KEY   →"
        readyTitle.Text = "KEY EXPIRED"
        readyTitle.TextColor3 = C.red
        readyDot.BackgroundColor3 = C.red
    end
end

local function verifyKey(recheck)
    if themeState.busy or not root.Parent then return end
    local key = recheck and themeState.key or keyBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
    if type(key) ~= "string" or key == "" then showStatus("Enter your license key first.", "error") return end
    local hwid = getHWID()
    if not hwid then showStatus("HWID unavailable. Use an executor with gethwid().", "error") return end
    themeState.busy = true
    verifyButton.Active = false
    verifyButton.Text = "VERIFYING LICENSE..."
    showStatus("Contacting Zyphor license servers...", "info")
    task.spawn(function()
        local ok, result = pcall(fetchLicense, key, hwid)
        if not root.Parent then return end
        themeState.busy = false
        verifyButton.Active = true
        if not ok or type(result) ~= "table" or result.valid ~= true then
            local msg = ok and type(result) == "table" and (result.message or result.error) or tostring(result)
            themeState.keyValid = false
            if recheck then resetGlobals() setPage("entry") end
            verifyButton.Text = "VERIFY KEY   →"
            showStatus(tostring(msg or "Invalid license key."), "error")
            animate(inputBorder, { Color = C.red }, 0.22)
            readyTitle.Text = "CHECK FAILED"
            readyTitle.TextColor3 = C.red
            readyDot.BackgroundColor3 = C.red
            return
        end
        local info = {
            keyId = result.keyId,
            hwid = result.hwid or hwid,
            expiresAt = result.expiresAt,
            remainingMs = result.remainingMs,
            durationMinutes = result.durationMinutes,
            lastUsedAt = result.lastUsedAt,
            lastAccount = result.lastAccount or result.account or LocalPlayer.Name,
            hwidResetAvailableAt = result.hwidResetAvailableAt,
            checkedAt = os.clock()
        }
        if not info.remainingMs and info.expiresAt then
            local expiry = clockFromIso(info.expiresAt)
            if expiry then info.remainingMs = math.max(0, (expiry - os.time()) * 1000) end
        end
        themeState.keyValid = true
        themeState.hwid = hwid
        themeState.info = info
        themeState.key = key
        themeState.lastCheck = os.clock()
        publishGlobals(info)
        updateLicenseUI()
        readyTitle.Text = "KEY VERIFIED"
        readyTitle.TextColor3 = C.green
        readyDot.BackgroundColor3 = C.green
        verifyButton.Text = "ACCESS GRANTED   ✓"
        showStatus("License verified. Welcome to Zyphor.", "success")
        animate(mainStroke, { Color = C.green, Transparency = 0.13 }, 0.24)
        task.delay(0.72, function()
            if root.Parent then animate(mainStroke, { Color = C.violet, Transparency = 0.35 }, 0.65) end
        end)
        task.delay(0.6, function()
            if root.Parent and themeState.keyValid and not themeState.minimized then
                setPage("account")
                setSummaryTab("details")
            end
        end)
    end)
end
verifyButton.MouseButton1Click:Connect(function() verifyKey(false) end)
keyBox.FocusLost:Connect(function(submitted)
    if submitted then verifyKey(false) end
end)

local hiddenHwid = ""
local function hideHwid()
    hwidButton.Text = hiddenHwid ~= "" and "BOUND HWID  ••••••••••••••••••   (HOLD TO REVEAL)" or "HWID UNAVAILABLE"
end
hwidButton.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        hiddenHwid = tostring(themeState.info and themeState.info.hwid or themeState.hwid or "")
        hwidButton.Text = hiddenHwid ~= "" and hiddenHwid or "HWID unavailable"
    end
end)
hwidButton.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then hideHwid() end
end)
local hwidInputEndedConnection = UserInputService.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then hideHwid() end
end)
hideHwid()

local function updateSize()
    local camera = workspace.CurrentCamera
    if not camera then return end
    local v = camera.ViewportSize
    local safeW = math.max(1, v.X - 24)
    local safeH = math.max(1, v.Y - 24)
    uiScale.Scale = math.min(safeW / BASE_WIDTH, safeH / (themeState.minimized and 96 or BASE_HEIGHT), 1)
end
local viewportConnection
local function attachCamera()
    if viewportConnection then viewportConnection:Disconnect() end
    local camera = workspace.CurrentCamera
    if camera then viewportConnection = camera:GetPropertyChangedSignal("ViewportSize"):Connect(updateSize) end
    updateSize()
end
attachCamera()
local cameraChanged = workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(attachCamera)

local dragged, firstPointer, firstLocation, lastDrag = false, nil, nil, nil
local dragTarget = topRadiance
dragTarget.Active = true
dragTarget.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragged = true
        firstPointer = input.Position
        firstLocation = holder.Position
        lastDrag = input
        input.Changed:Connect(function()
            if input.UserInputState == Enum.UserInputState.End then dragged = false end
        end)
    end
end)
dragTarget.InputChanged:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement then lastDrag = input end
end)
local draggingConnection = UserInputService.InputChanged:Connect(function(input)
    if dragged and input == lastDrag and firstPointer and firstLocation then
        local delta = (input.Position - firstPointer) / math.max(uiScale.Scale, 0.01)
        holder.Position = UDim2.new(firstLocation.X.Scale, firstLocation.X.Offset + delta.X, firstLocation.Y.Scale, firstLocation.Y.Offset + delta.Y)
    end
end)

local function minimize()
    themeState.minimized = not themeState.minimized
    minimizeButton.Text = themeState.minimized and "+" or "−"
    entryPage.Visible = not themeState.minimized and themeState.page == "entry"
    accountPage.Visible = not themeState.minimized and themeState.page == "account"
    footerRule.Visible = not themeState.minimized
    ambientPlate.Visible = not themeState.minimized
    for _, obj in ipairs({ footerTos, footerPrivacy, footerTeam }) do obj.Visible = not themeState.minimized end
    local footerLabel = main:FindFirstChild("FooterBrand")
    if footerLabel then footerLabel.Visible = not themeState.minimized end
    local endH = themeState.minimized and 88 or 542
    animate(main, { Size = UDim2.fromOffset(804, endH) }, 0.32)
    animate(aura, { Size = UDim2.fromOffset(BASE_WIDTH - 8, themeState.minimized and 100 or BASE_HEIGHT - 8) }, 0.32)
    animate(holder, { Size = UDim2.fromOffset(BASE_WIDTH, themeState.minimized and 110 or BASE_HEIGHT) }, 0.32)
    updateSize()
end
minimizeButton.MouseButton1Click:Connect(minimize)

local function shutDown()
    if themeState.stopping then return end
    themeState.stopping = true
    themeState.open = false
    animate(main, { BackgroundTransparency = 1 }, 0.12)
    animate(auraStroke, { Transparency = 1 }, 0.12)
    animate(auraStroke2, { Transparency = 1 }, 0.12)
    task.delay(0.15, function()
        if root and root.Parent then root:Destroy() end
    end)
end
closeButton.MouseButton1Click:Connect(shutDown)
root.Destroying:Connect(function()
    themeState.open = false
    if viewportConnection then viewportConnection:Disconnect() end
    if cameraChanged then cameraChanged:Disconnect() end
    if draggingConnection then draggingConnection:Disconnect() end
    if hwidInputEndedConnection then hwidInputEndedConnection:Disconnect() end
end)

local function imageFromFile(name, raw)
    if type(writefile) ~= "function" then return nil end
    local asset = type(getcustomasset) == "function" and getcustomasset or type(getsynasset) == "function" and getsynasset or nil
    if not asset then return nil end
    local ok, result = pcall(function()
        local file = "zyphor_" .. name .. ".png"
        if type(isfile) ~= "function" or not isfile(file) then
            if type(raw) ~= "string" then return nil end
            writefile(file, raw)
        end
        return asset(file)
    end)
    return ok and result or nil
end

local function populateGameIcon()
    local universeId = tonumber(game.GameId) or 0
    local placeId = tonumber(game.PlaceId) or 0
    local iconUrl
    if universeId > 0 then
        iconUrl = "rbxthumb://type=GameIcon&id=" .. tostring(universeId) .. "&w=150&h=150"
    elseif placeId > 0 then
        iconUrl = "rbxthumb://type=GameThumbnail&id=" .. tostring(placeId) .. "&w=768&h=432"
    end
    if not iconUrl then return end
    local function updateIconVisibility()
        if not root.Parent or gameLoaded then return end
        if gameThumb.IsLoaded then
            gameLoaded = true
            gameFallback.Visible = false
            animate(gameThumb, { ImageTransparency = 0 }, 0.40)
        end
    end
    local loadedConnection = gameThumb:GetPropertyChangedSignal("IsLoaded"):Connect(updateIconVisibility)
    root.Destroying:Once(function()
        if loadedConnection then loadedConnection:Disconnect() end
    end)
    gameThumb.Image = iconUrl
    pcall(function() ContentProvider:PreloadAsync({ gameThumb }) end)
    updateIconVisibility()
    if not gameLoaded and placeId > 0 and universeId > 0 then
        task.wait(3)
        if root.Parent and not gameLoaded then
            gameThumb.Image = "rbxthumb://type=GameThumbnail&id=" .. tostring(placeId) .. "&w=768&h=432"
            pcall(function() ContentProvider:PreloadAsync({ gameThumb }) end)
            updateIconVisibility()
        end
    end
end

task.spawn(populateGameIcon)

task.spawn(function()
    local ok, thumb = pcall(function()
        return Players:GetUserThumbnailAsync(LocalPlayer.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100)
    end)
    if ok and root.Parent then avatar.Image = thumb end
end)

task.spawn(function()
    local ok, info = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId, Enum.InfoType.Asset)
    end)
    if ok and type(info) == "table" and type(info.Name) == "string" and root.Parent then
        gameName.Text = info.Name
    end
end)

task.spawn(function()
    local ok, logoAsset = pcall(function()
        if type(activeRequest) ~= "function" then return nil end
        if type(isfile) == "function" and isfile("zyphor_official_logo_v2.png") then
            return imageFromFile("official_logo_v2")
        end
        local raw = httpCall(LOGO_URL, "GET")
        if #raw < 32 or #raw > 2097152 or raw:sub(2, 4) ~= "PNG" then return nil end
        return imageFromFile("official_logo_v2", raw)
    end)
    if ok and type(logoAsset) == "string" and root.Parent then
        logoImage.Image = logoAsset
        logoImage.Visible = true
        logoFallback.Visible = false
    elseif type(getgenv) == "function" then
        local good, custom = pcall(function() return getgenv().ZyphorLogoAsset end)
        if good and type(custom) == "string" and custom ~= "" and root.Parent then
            logoImage.Image = custom
            logoImage.Visible = true
            logoFallback.Visible = false
        end
    end
end)

task.spawn(function()
    while root.Parent and themeState.open do
        if themeState.keyValid then updateLicenseUI() end
        task.wait(1)
    end
end)

task.spawn(function()
    while root.Parent and themeState.open do
        if themeState.keyValid and not themeState.busy and os.clock() - themeState.lastCheck > 90 then
            verifyKey(true)
        end
        task.wait(10)
    end
end)

task.spawn(function()
    local phase = false
    while root.Parent and themeState.open do
        phase = not phase
        animate(upperGradient, { Offset = Vector2.new(phase and 0.25 or -0.25, 0) }, 3.7, Enum.EasingStyle.Sine)
        animate(auraStroke, { Transparency = phase and 0.72 or 0.50, Color = phase and C.cyan or C.violet }, 3.7, Enum.EasingStyle.Sine)
        animate(readyDot, { BackgroundTransparency = phase and 0.40 or 0 }, 3.7, Enum.EasingStyle.Sine)
        animate(verifyGradient, { Offset = Vector2.new(phase and 0.12 or -0.12, 0) }, 3.7, Enum.EasingStyle.Sine)
        task.wait(3.8)
    end
end)

resetGlobals()
updateSize()
