const express = require("express")
const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const multer = require("multer")

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command
} = require("@aws-sdk/client-s3")

const r2 = new S3Client({
    region: "auto",
    endpoint: "https://e8c16725f7d01df5e05e54afa3ccef6f.r2.cloudflarestorage.com/",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
})
const R2_BUCKET = "zyphor-cloud"

const firebaseAdmin = require("firebase-admin/app")
const { getMessaging } = require("firebase-admin/messaging")

const serviceAccount = require("./firebase-admin.json")

firebaseAdmin.initializeApp({
credential: firebaseAdmin.cert(serviceAccount)
})

const PORT = process.env.PORT || 3000
const WEBSITE_SECRET = process.env.WEBSITE_SECRET || crypto.randomBytes(32).toString("hex")

function validDiscordBotRequest(req){
    return req.headers["x-admin-secret"]===WEBSITE_SECRET || req.body?.secret===WEBSITE_SECRET
}

const app = express()
let runtimeActiveRequests = 0
let runtimeCacheIdleTimer = null
const RUNTIME_CACHE_IDLE_MS = 30000

function clearRuntimeCachesWhenIdle() {
    if (runtimeActiveRequests > 0) {
        scheduleRuntimeCacheCleanup()
        return
    }
    USERS_CACHE.clear()
    USER_FILE_CACHE.clear()
    USER_AUX_CACHE.clear()
    SUBSCRIPTION_CACHE.clear()
    SESSION_USER_CACHE.clear()
    USERS_CACHE_COMPLETE = false
    COLLECTIBLES_NORMALIZED_USERS.clear()
    COLLECTIBLE_INSTANCE_IDS.clear()
    COLLECTIBLE_COPY_INDEX_CACHE.clear()
    HALLOWEEN_SELECTION_CACHE.clear()
    CASE_OPEN_COOLDOWNS.clear()
    COLLECTION_DISCOVERY_CACHE.clear()
    COLLECTIBLE_STATS_CACHE = null
    for (const key of [...HALLOWEEN_COLLECTION_CACHE.keys()]) dropHalloweenCollectionCache(key)
    TRADE_DB_CACHE = null
    TRADE_DB_BY_ID.clear()
    TRADE_ACTIVE_CACHE = []
    TRADE_HISTORY_CACHE = null
    TRADE_HISTORY_COMPACTED = false
    visitCooldown.clear()
}

function scheduleRuntimeCacheCleanup() {
    if (runtimeCacheIdleTimer) clearTimeout(runtimeCacheIdleTimer)
    if (runtimeActiveRequests > 0) {
        runtimeCacheIdleTimer = null
        return
    }
    runtimeCacheIdleTimer = setTimeout(() => {
        runtimeCacheIdleTimer = null
        if (runtimeActiveRequests === 0) clearRuntimeCachesWhenIdle()
    }, RUNTIME_CACHE_IDLE_MS)
    if (typeof runtimeCacheIdleTimer.unref === "function") runtimeCacheIdleTimer.unref()
}

app.use((req, res, next) => {
    runtimeActiveRequests++
    if (runtimeCacheIdleTimer) clearTimeout(runtimeCacheIdleTimer)
    runtimeCacheIdleTimer = null
    let released = false
    const release = () => {
        if (released) return
        released = true
        runtimeActiveRequests = Math.max(0, runtimeActiveRequests - 1)
        if (runtimeActiveRequests === 0) scheduleRuntimeCacheCleanup()
    }
    res.once("finish", release)
    res.once("close", release)
    next()
})

app.use((req,res,next)=>{
    const origin = req.headers.origin

    if(origin){
        res.setHeader("Access-Control-Allow-Origin",origin)
        res.setHeader("Vary","Origin")
        res.setHeader("Access-Control-Allow-Credentials","true")
    }else{
        res.setHeader("Access-Control-Allow-Origin","*")
    }

    res.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,PATCH,DELETE,OPTIONS")
    res.setHeader(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Admin-Target"
    )
    res.setHeader("Access-Control-Expose-Headers","Content-Length,Content-Type,Content-Disposition")
    res.setHeader("Access-Control-Max-Age","86400")

    if(req.method === "OPTIONS"){
        return res.status(204).end()
    }

    next()
})

app.get("/favicon.ico",(req,res)=>res.status(204).end())


const logQueue = [];
let logFlushRunning = false;

function logAction(type,data){
    try{
        const now = new Date();
        const formatter = logAction.formatter || (logAction.formatter = new Intl.DateTimeFormat("en-US",{
            timeZone:"Europe/Copenhagen",
            year:"numeric",
            month:"2-digit",
            day:"2-digit",
            hour:"2-digit",
            hour12:false
        }));
        const parts = Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));
        const file = path.join(
            __dirname,
            "Logs",
            `logs-${parts.year}-${parts.month}-${parts.day}-${parts.hour}.log`
        );
        logQueue.push({
            file,
            entry:JSON.stringify({
                type,
                data,
                time:now.toISOString()
            })+"\n"
        });
        if(logQueue.length>5000) logQueue.splice(0,logQueue.length-5000);
        flushLogs();
    }catch(err){
        if(logQueue.length<10) console.log("LOG FAILED",err.message);
    }
}

function flushLogs(){
    if(logFlushRunning || !logQueue.length) return;
    logFlushRunning=true;
    const batches=new Map();
    while(logQueue.length){
        const item=logQueue.shift();
        if(!batches.has(item.file)) batches.set(item.file,[]);
        batches.get(item.file).push(item.entry);
    }
    const jobs=[];
    for(const [file,entries] of batches){
        jobs.push(
            fs.promises.mkdir(path.dirname(file),{recursive:true})
                .then(()=>fs.promises.appendFile(file,entries.join("")))
                .catch(err=>console.log("LOG FAILED",err.message))
        );
    }
    Promise.allSettled(jobs).finally(()=>{
        logFlushRunning=false;
        if(logQueue.length) setImmediate(flushLogs);
    });
}

setInterval(flushLogs,1000).unref();

function getIP(req){
return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim()
}



function hasAdmin(user){

const perms=loadPerms()

return perms.permissions.Administrator.includes(
user.username
)

}

function generateUniqueMessageId(){
    return crypto.randomBytes(16).toString("hex")
}

const USER_ROOT = path.join(__dirname, "Users")
const LEGACY_USERDATA = path.join(__dirname, "userdata.json")
const USERS_CACHE = new Map()
const USER_FILE_CACHE = new Map()
function userFileFingerprint(user) {
    return crypto.createHash("sha1").update(JSON.stringify(user || {})).digest("hex")
}
const USER_AUX_CACHE = new Map()
const USER_AUX_LOADED = new WeakMap()
const SESSION_TOKEN_INDEX = new Map()
let USERS_CACHE_COMPLETE = false
const USER_DATA_EXCLUDED_FIELDS = new Set(["wallet", "gameStats", "passwordHistory", "loginHistory", "cloudLogs", "ticTacToe", "connect4", "_cloudLogsLoaded"]);

const MEMBERSHIP_VAULT_ROOT = path.join(__dirname,"MembershipVault")
const SUBSCRIPTION_CODES_PATH = path.join(MEMBERSHIP_VAULT_ROOT,"Codes.json")
const SUBSCRIPTION_CACHE = new Map()

const SUBSCRIPTION_PLANS = {
    infinity:{
        id:"infinity",
        name:"Zyphor Infinity",
        prefix:"ZK-ZI",
        requestsPerMinute:null,
        requestsPerSecond:5,
        priority:true,
        bossDamageMultiplier:1,
        pfp:true,
        gif:true
    },
    endless:{
        id:"endless",
        name:"Zyphor Endless",
        prefix:"ZK-ZE",
        requestsPerMinute:null,
        requestsPerSecond:20,
        priority:true,
        bossDamageMultiplier:1,
        pfp:true,
        gif:true
    },
    ascended:{
        id:"ascended",
        name:"Zyphor Ascended",
        prefix:"ZK-ZA",
        requestsPerMinute:null,
        requestsPerSecond:40,
        priority:true,
        bossDamageMultiplier:4,
        pfp:true,
        gif:true
    }
}

const DEFAULT_SUBSCRIPTION = {
    active:false,
    plan:null,
    lifetime:false,
    activatedAt:null,
    expiresAt:null,
    source:null
}

function validSubscriptionUsername(username){
    const safe=typeof safeUsername==="function" ? safeUsername(username) : String(username||"").trim();
    return safe || null;
}

function emptySubscription(){
    return cloneJson(DEFAULT_SUBSCRIPTION)
}

function membershipVaultPath(username){
    const safe=validSubscriptionUsername(username)
    if(!safe) return null
    return path.join(ensureUserFolder(safe),"MembershipVault")
}

function subscriptionPath(username){
    const root=membershipVaultPath(username)
    return root ? path.join(root,"Subscription.json") : null
}

function redeemedCodesPath(username){
    const root=membershipVaultPath(username)
    return root ? path.join(root,"RedeemedCodes.json") : null
}

function loadSubscription(username){
    const safe=validSubscriptionUsername(username)
    if(!safe) return emptySubscription()
    const key=safe
    if(SUBSCRIPTION_CACHE.has(key)) return cloneJson(SUBSCRIPTION_CACHE.get(key))
    const file=subscriptionPath(safe)
    const data=file ? readJson(file,emptySubscription()) : emptySubscription()
    const normalized={
        active:data?.active===true,
        plan:SUBSCRIPTION_PLANS[data?.plan] ? data.plan : null,
        lifetime:data?.lifetime===true || (data?.active===true && !data?.expiresAt),
        activatedAt:data?.activatedAt || null,
        expiresAt:data?.expiresAt || null,
        source:data?.source || null
    }
    if(!normalized.plan) normalized.active=false
    SUBSCRIPTION_CACHE.set(key,normalized)
    return cloneJson(normalized)
}

function saveSubscription(username,data){
    const safe=validSubscriptionUsername(username)
    if(!safe) throw new Error("invalid username")
    const active=data?.active===true && !!SUBSCRIPTION_PLANS[data?.plan]
    const lifetime=active && (data?.lifetime===true || !data?.expiresAt)
    const normalized={
        active,
        plan:active ? data.plan : null,
        lifetime,
        activatedAt:active ? (data?.activatedAt || new Date().toISOString()) : null,
        expiresAt:active && !lifetime ? (data?.expiresAt || null) : null,
        source:active ? (data?.source || null) : null
    }
    if(active && !lifetime && !normalized.expiresAt){
        throw new Error("invalid subscription expiry")
    }
    writeJson(subscriptionPath(safe),normalized)
    SUBSCRIPTION_CACHE.set(safe,normalized)
    return cloneJson(normalized)
}

function loadRedeemedCodes(username){
    const safe=validSubscriptionUsername(username)
    if(!safe) return {codes:[]}
    const data=readJson(redeemedCodesPath(safe),{codes:[]})
    if(!data || typeof data!=="object" || !Array.isArray(data.codes)) return {codes:[]}
    return data
}

function saveRedeemedCodes(username,data){
    const safe=validSubscriptionUsername(username)
    if(!safe) throw new Error("invalid username")
    const normalized=data && typeof data==="object" && Array.isArray(data.codes)
        ? data
        : {codes:[]}
    writeJson(redeemedCodesPath(safe),normalized)
    return normalized
}

function ensureSubscriptionStorage(){
    fs.mkdirSync(MEMBERSHIP_VAULT_ROOT,{recursive:true})
    if(!fs.existsSync(SUBSCRIPTION_CODES_PATH)) writeJson(SUBSCRIPTION_CODES_PATH,{codes:[]})
}

function loadSubscriptionCodes(){
    ensureSubscriptionStorage()
    const data=readJson(SUBSCRIPTION_CODES_PATH,{codes:[]})
    if(!data || typeof data!=="object" || !Array.isArray(data.codes)) return {codes:[]}
    return data
}

function saveSubscriptionCodes(data){
    const normalized=data && typeof data==="object" && Array.isArray(data.codes)
        ? data
        : {codes:[]}
    writeJson(SUBSCRIPTION_CODES_PATH,normalized)
    return normalized
}

function normalizeSubscriptionCode(value){
    return String(value||"").trim().toUpperCase()
}

function generateSubscriptionCode(planId){
    const plan=SUBSCRIPTION_PLANS[planId]
    if(!plan) throw new Error("invalid_plan")
    let code=""
    const data=loadSubscriptionCodes()
    do{
        const groups=Array.from({length:5},()=>crypto.randomBytes(2).toString("hex").toUpperCase())
        code=`${plan.prefix}-${groups.join("-")}`
    }while(data.codes.some(x=>normalizeSubscriptionCode(x.code)===code))
    return code
}

function subscriptionDurationMs(value,unit){
    const amount=Number(value)
    const normalizedUnit=String(unit||"").trim().toLowerCase()
    if(!Number.isFinite(amount) || amount<=0) return null
    if(!["minutes","hours","days"].includes(normalizedUnit)) return null
    const multipliers={minutes:60000,hours:3600000,days:86400000}
    const duration=Math.floor(amount*multipliers[normalizedUnit])
    return Number.isSafeInteger(duration) && duration>0 ? duration : null
}

function getActiveSubscription(username){
    const safe=validSubscriptionUsername(username)
    if(!safe) return null
    const subscription=loadSubscription(safe)
    if(!subscription.active) return null
    const plan=subscription.plan ? SUBSCRIPTION_PLANS[subscription.plan] : null
    if(!plan){
        saveSubscription(safe,emptySubscription())
        return null
    }
    if(subscription.lifetime || !subscription.expiresAt){
        return {
            ...subscription,
            lifetime:true,
            expiresAt:null,
            details:plan,
            remainingMs:null
        }
    }
    const expiresMs=new Date(subscription.expiresAt).getTime()
    if(!Number.isFinite(expiresMs) || Date.now()>=expiresMs){
        saveSubscription(safe,emptySubscription())
        return null
    }
    return {
        ...subscription,
        lifetime:false,
        details:plan,
        remainingMs:Math.max(0,expiresMs-Date.now())
    }
}

function subscriptionResponse(username){
    const active=getActiveSubscription(username)
    if(!active){
        return {
            active:false,
            plan:null,
            name:null,
            lifetime:false,
            activatedAt:null,
            expiresAt:null,
            remainingMs:0,
            requestsPerMinute:null,
            requestsPerSecond:5,
            priority:false,
            bossDamageMultiplier:1,
            pfp:false,
            gif:false
        }
    }
    return {
        active:true,
        plan:active.plan,
        name:active.details.name,
        lifetime:active.lifetime===true,
        activatedAt:active.activatedAt,
        expiresAt:active.expiresAt,
        remainingMs:active.remainingMs,
        requestsPerMinute:active.details.requestsPerMinute,
        requestsPerSecond:active.details.requestsPerSecond,
        priority:active.details.priority,
        bossDamageMultiplier:active.details.bossDamageMultiplier,
        pfp:active.details.pfp,
        gif:active.details.gif
    }
}

function getSubscriptionLimits(user){
    const username=validSubscriptionUsername(user?.username)
    if(!username){
        return {
            active:false,
            plan:null,
            requestsPerMinute:null,
            requestsPerSecond:5,
            priority:false,
            bossDamageMultiplier:1
        }
    }
    const active=getActiveSubscription(username)
    if(!active){
        return {
            active:false,
            plan:null,
            requestsPerMinute:null,
            requestsPerSecond:5,
            priority:false,
            bossDamageMultiplier:1
        }
    }
    return {
        active:true,
        plan:active.plan,
        requestsPerMinute:active.details.requestsPerMinute,
        requestsPerSecond:active.details.requestsPerSecond,
        priority:active.details.priority,
        bossDamageMultiplier:active.details.bossDamageMultiplier
    }
}

function resolveUserRecord(users,username){
    const safe=validSubscriptionUsername(username)
    if(!safe || !users || typeof users!=="object") return null
    if(users[safe]) return users[safe]
    const target=String(safe).toLowerCase()
    return Object.values(users).find(user=>String(user?.username||"").toLowerCase()===target) || null
}

function resolveUserByUsername(users,username){
    return resolveUserRecord(users,username)
}

ensureSubscriptionStorage()

const DEFAULT_CLOUD_METADATA = {
    tags: [],
    favorite: false,
    album: null,
    description: ""
};

function safeUsername(username){
    const value=String(username || "").trim();
    if(!value || value === "." || value === ".." || !/^[a-zA-Z0-9_\- ]{1,40}$/.test(value)) return null;
    return value;
}

function userFolder(username){
    const safe=safeUsername(username);
    if(!safe) return null;
    return path.join(USER_ROOT,safe);
}

function ensureUserFolder(username){
    const folder=userFolder(username);
    if(!folder) throw new Error("invalid username");
    fs.mkdirSync(folder,{recursive:true});
    return folder;
}

function readJson(file,fallback){
    try{return JSON.parse(fs.readFileSync(file,"utf8"))}
    catch{return fallback}
}

function writeJson(file,data){
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const temp=file+".tmp";
    fs.writeFileSync(temp,JSON.stringify(data,null,2));
    fs.renameSync(temp,file);
}

function cloneJson(data){
    return data == null ? data : JSON.parse(JSON.stringify(data));
}

function unlockablesPath(username){
return path.join(ensureUserFolder(username),"Unlockables")
}

function permissionsFolder(username){
return path.join(unlockablesPath(username),"Permissions")
}

function permissionsPath(username){
return path.join(permissionsFolder(username),"Permissions.json")
}

function defaultPermissions(){
return {
PFP:{
enabled:false,
earnedAt:null,
earnedFrom:null,
event:null
}
}
}

function loadUnlockablePermissions(username){

const file=permissionsPath(username)

if(!fs.existsSync(file)){
const permissions=defaultPermissions()
writeJson(file,permissions)
return permissions
}

const permissions=readJson(file,defaultPermissions())

if(!permissions.PFP || typeof permissions.PFP!=="object"){
permissions.PFP={
enabled:false,
earnedAt:null,
earnedFrom:null,
event:null
}
writeJson(file,permissions)
}

return permissions

}

function saveUnlockablePermissions(username,permissions){
writeJson(
permissionsPath(username),
permissions
)
}

function hasPfpPermission(username){

const permissions=loadUnlockablePermissions(username)

return permissions.PFP?.enabled===true || !!getActiveSubscription(username)

}

function grantPfpPermission(username,earnedFrom,event=null){

const permissions=loadUnlockablePermissions(username)

permissions.PFP={
enabled:true,
earnedAt:new Date().toISOString(),
earnedFrom:earnedFrom || "Unknown",
event:event || null
}

saveUnlockablePermissions(
username,
permissions
)

return permissions

}

function revokePfpPermission(username){

const permissions=loadUnlockablePermissions(username)

permissions.PFP.enabled=false

saveUnlockablePermissions(
username,
permissions
)

return permissions

}

function pfpFolder(username){
return path.join(ensureUserFolder(username),"PFP")
}

function pfpHistoryFolder(username){
return path.join(
pfpFolder(username),
"PFPHistory"
)
}

function pfpHistoryPngFolder(username){
return path.join(
pfpHistoryFolder(username),
"Pngs"
)
}

function pfpHistoryPath(username){
return path.join(
pfpHistoryFolder(username),
"PFPHistory.json"
)
}

function currentPfpPath(username){
return path.join(
pfpFolder(username),
"PFP.png"
)
}

function loadPfpHistory(username){

return readJson(
pfpHistoryPath(username),
{
history:[]
}
)

}

function savePfpHistory(username,data){

writeJson(
pfpHistoryPath(username),
data
)

}

function ensurePfpFolders(username){

fs.mkdirSync(
pfpHistoryPngFolder(username),
{recursive:true}
)

}

function getPfpCooldown(username){

const history=loadPfpHistory(username)

if(
!Array.isArray(history.history) ||
history.history.length===0
){
return 0
}

const latest=history.history[
history.history.length-1
]

const changedAt=new Date(
latest.changedAt
).getTime()

if(!changedAt) return 0

const cooldown=4*60*60*1000
const remaining=changedAt+cooldown-Date.now()

return Math.max(
0,
remaining
)

}


function reportsPath(username){
    return path.join(ensureUserFolder(username),"Reports.json")
}

function reportsHistoryPath(username){
    return path.join(ensureUserFolder(username),"ReportsHistory.json")
}

function reportEvidenceFolder(username){
    return path.join(ensureUserFolder(username),"Reports","Evidence")
}

function loadReports(username){
    const data=readJson(reportsPath(username),{reports:[]})
    if(!data || typeof data!=="object") return {reports:[]}
    if(!Array.isArray(data.reports)) data.reports=[]
    return data
}

function saveReports(username,data){
    const normalized=data && typeof data==="object" ? data : {reports:[]}
    if(!Array.isArray(normalized.reports)) normalized.reports=[]
    writeJson(reportsPath(username),normalized)
}

function loadReportsHistory(username){
    const data=readJson(reportsHistoryPath(username),{history:[]})
    if(!data || typeof data!=="object") return {history:[]}
    if(!Array.isArray(data.history)) data.history=[]
    return data
}

function saveReportsHistory(username,data){
    const normalized=data && typeof data==="object" ? data : {history:[]}
    if(!Array.isArray(normalized.history)) normalized.history=[]
    writeJson(reportsHistoryPath(username),normalized)
}

const reportUpload=multer({
    storage:multer.diskStorage({
        destination:(req,file,cb)=>{
            const user=auth(req)
            if(!user) return cb(new Error("unauthorized"))
            const folder=reportEvidenceFolder(user.username)
            fs.mkdirSync(folder,{recursive:true})
            cb(null,folder)
        },
        filename:(req,file,cb)=>{
            const ext=path.extname(file.originalname).toLowerCase()
            cb(null,crypto.randomBytes(16).toString("hex")+ext)
        }
    }),
    limits:{
        fileSize:10*1024*1024,
        files:10
    },
    fileFilter:(req,file,cb)=>{
        const allowed=["image/png","image/jpeg","image/jpg","image/webp"]
        if(!allowed.includes(file.mimetype)) return cb(new Error("Only image proof is allowed"))
        cb(null,true)
    }
})


function userDataPath(username){ return path.join(ensureUserFolder(username),"UserData.json") }
function passwordHistoryPath(username){ return path.join(ensureUserFolder(username),"PasswordHistory.json") }
function walletPath(username){ return path.join(ensureUserFolder(username),"Wallet.json") }
function ticTacToePath(username){ return path.join(ensureUserFolder(username),"TicTacToe.json") }
function fourInARowPath(username){ return path.join(ensureUserFolder(username),"FourInARow.json") }
function cloudRoot(username){ return path.join(ensureUserFolder(username),"Cloud") }
function cloudMetadataPath(username){ return path.join(cloudRoot(username),"Metadata.json") }
function cloudLogsRoot(username){ return path.join(cloudRoot(username),"Logs") }

function normalizePasswordHistory(data){
    if(Array.isArray(data)) return {history:data.map((x,i)=> typeof x === "object" && x !== null ? x : {password:String(x),changedAt:null,index:i})};
    if(data && typeof data === "object" && Array.isArray(data.history)) return data;
    return {history:[]};
}

function loadPasswordHistory(username){
    const key=username+":passwordHistory";
    if(USER_AUX_CACHE.has(key)) return USER_AUX_CACHE.get(key);
    const data=normalizePasswordHistory(readJson(passwordHistoryPath(username),{history:[]}));
    USER_AUX_CACHE.set(key,data);
    USER_AUX_CACHE.set(key+":serialized",JSON.stringify(data,null,2));
    return data;
}

function savePasswordHistory(username,data){
    const normalized=normalizePasswordHistory(data);
    const key=username+":passwordHistory";
    const serialized=JSON.stringify(normalized,null,2);
    if(USER_AUX_CACHE.get(key+":serialized")!==serialized) writeJson(passwordHistoryPath(username),normalized);
    USER_AUX_CACHE.set(key,normalized);
    USER_AUX_CACHE.set(key+":serialized",serialized);
}

function normalizeWallet(data){
    if(!data || typeof data !== "object") data={};
    if(typeof data.balance !== "number") data.balance=Number(data.balance)||0;
    if(!Array.isArray(data.history)) data.history=[];
    if(!Array.isArray(data.payouts)) data.payouts=[];
    return data;
}

function loadWallet(username){
    const key=username+":wallet";
    if(USER_AUX_CACHE.has(key)) return USER_AUX_CACHE.get(key);
    const data=normalizeWallet(readJson(walletPath(username),{}));
    USER_AUX_CACHE.set(key,data);
    return data;
}
function saveWallet(username,data){
    const normalized=normalizeWallet(data);
    const key=username+":wallet";
    const serialized=JSON.stringify(normalized,null,2);
    if(USER_AUX_CACHE.get(key+":serialized")!==serialized){
        writeJson(walletPath(username),normalized);
        USER_AUX_CACHE.set(key+":serialized",serialized);
    }
    USER_AUX_CACHE.set(key,normalized);
}

function normalizeGameStats(data){
    const defaults={wins:0,losses:0,draws:0,gamesPlayed:0,winStreak:0,bestWinStreak:0};
    if(!data || typeof data !== "object") data={};
    for(const game of ["tictactoe","connect4"]){
        if(!data[game] || typeof data[game] !== "object") data[game]={};
        for(const key of Object.keys(defaults)) if(typeof data[game][key] !== "number") data[game][key]=defaults[key];
    }
    return data;
}

function loadGameStatsFile(username){
    const key=username+":gamestats";
    if(USER_AUX_CACHE.has(key)) return USER_AUX_CACHE.get(key);
    const data=normalizeGameStats({
        tictactoe:readJson(ticTacToePath(username),{}),
        connect4:readJson(fourInARowPath(username),{})
    });
    USER_AUX_CACHE.set(key,data);
    return data;
}
function saveGameStatsFile(username,data){
    const normalized=normalizeGameStats(data);
    const key=username+":gamestats";
    const tt=JSON.stringify(normalized.tictactoe,null,2);
    const c4=JSON.stringify(normalized.connect4,null,2);
    if(USER_AUX_CACHE.get(key+":tt")!==tt) writeJson(ticTacToePath(username),normalized.tictactoe);
    if(USER_AUX_CACHE.get(key+":c4")!==c4) writeJson(fourInARowPath(username),normalized.connect4);
    USER_AUX_CACHE.set(key+":tt",tt);
    USER_AUX_CACHE.set(key+":c4",c4);
    USER_AUX_CACHE.set(key,normalized);
}

function loadTicTacToe(username){
    const stats=normalizeGameStats(readJson(ticTacToePath(username),{}));
    return stats.tictactoe;
}

function saveTicTacToe(username,stats){
    writeJson(ticTacToePath(username),normalizeGameStats({tictactoe:stats,connect4:loadGameStatsFile(username).connect4}));
}

function loadFourInARow(username){
    const stats=normalizeGameStats(readJson(fourInARowPath(username),{}));
    return stats.connect4;
}

function saveFourInARow(username,stats){
    writeJson(fourInARowPath(username),normalizeGameStats({connect4:stats,tictactoe:loadGameStatsFile(username).tictactoe}));
}

function loadCloudMetadata(user){
    const data=readJson(cloudMetadataPath(user.username),{});
    return data && typeof data === "object" ? data : {};
}

function saveCloudMetadata(user,data){
    writeJson(cloudMetadataPath(user.username),data && typeof data === "object" ? data : {});
}

function ensureCloudMetadataEntry(metadata,fileName){
    if(!metadata[fileName]) metadata[fileName]=cloneJson(DEFAULT_CLOUD_METADATA);
    if(!Array.isArray(metadata[fileName].tags)) metadata[fileName].tags=[];
    if(typeof metadata[fileName].favorite!=="boolean") metadata[fileName].favorite=!!metadata[fileName].favorite;
    if(!Object.prototype.hasOwnProperty.call(metadata[fileName],"album")) metadata[fileName].album=null;
    if(typeof metadata[fileName].description!=="string") metadata[fileName].description="";
    return metadata[fileName];
}

function hasSupport(user){

const perms=loadPerms()

return (
perms.permissions.Support.includes(user.username) ||
perms.permissions.Administrator.includes(user.username)
)

}

const blockedIPs = new Map();
const requestWindow = new Map();
const globalRequestWindow = [];
const messageCooldown = new Map();
const robloxLinkTokens = new Map();
const dailyEmails = new Map();

const BASE_REQUESTS_PER_SECOND = 5;
const GLOBAL_SERVER_REQUESTS_PER_SECOND = 100;
const PRIORITY_RESERVED_REQUESTS = 20;
const RATE_BLOCK_MS = 1000;
const RATE_CLEANUP_MS = 60000;

app.use((req,res,next)=>{
    if(req.method==="OPTIONS") return next()
    if(req.path.startsWith("/uploads/") || req.path.startsWith("/api/forum/media/") || req.path.endsWith(".html") || req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".png") || req.path.endsWith(".jpg") || req.path.endsWith(".jpeg") || req.path.endsWith(".gif") || req.path==="/server.txt") return next()

    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim() || "unknown"
    const authenticatedUser = auth(req)
    const safeAuthenticatedUsername = validSubscriptionUsername(authenticatedUser?.username)
    const effectiveUser = safeAuthenticatedUsername ? authenticatedUser : null
    const limits = getSubscriptionLimits(effectiveUser)
    const key = safeAuthenticatedUsername ? `user:${safeAuthenticatedUsername}` : `ip:${ip}`
    const now = Date.now()
    const secondAgo = now - 1000

    let client = requestWindow.get(key)
    if(!client){
        client={timestamps:[],lastSeen:now,ip,username:authenticatedUser?.username||null}
        requestWindow.set(key,client)
    }

    client.lastSeen=now
    while(client.timestamps.length && client.timestamps[0] <= secondAgo) client.timestamps.shift()
    while(globalRequestWindow.length && globalRequestWindow[0] <= secondAgo) globalRequestWindow.shift()

    const requestsLastSecond=client.timestamps.length
    const requestLimit=Number.isFinite(Number(limits.requestsPerSecond)) ? Number(limits.requestsPerSecond) : BASE_REQUESTS_PER_SECOND

    if(blockedIPs.has(ip) && !limits.priority){
        const until=blockedIPs.get(ip)
        if(now<until) return res.status(429).json({error:"ratelimited",limit:requestLimit,window:"1s"})
        blockedIPs.delete(ip)
    }

    if(requestsLastSecond>=requestLimit){
        if(!limits.priority) blockedIPs.set(ip,now+RATE_BLOCK_MS)
        return res.status(429).json({
            error:"rate_limit",
            limit:requestLimit,
            window:"1s",
            plan:limits.plan,
            priority:!!limits.priority
        })
    }

    if(globalRequestWindow.length>=GLOBAL_SERVER_REQUESTS_PER_SECOND){
        return res.status(429).json({error:"server_rate_limit",limit:GLOBAL_SERVER_REQUESTS_PER_SECOND,window:"1s"})
    }

    if(!limits.priority && globalRequestWindow.length>=GLOBAL_SERVER_REQUESTS_PER_SECOND-PRIORITY_RESERVED_REQUESTS){
        return res.status(429).json({
            error:"priority_rate_limit",
            limit:GLOBAL_SERVER_REQUESTS_PER_SECOND-PRIORITY_RESERVED_REQUESTS,
            reason:"priority_reserved_for_active_subscriptions"
        })
    }

    client.timestamps.push(now)
    globalRequestWindow.push(now)
    next()
})

setInterval(()=>{
    const cutoff=Date.now()-1000;
    for(const [key,data] of requestWindow){
        while(data.timestamps.length && data.timestamps[0]<=cutoff) data.timestamps.shift();
        if(data.timestamps.length===0 && Date.now()-data.lastSeen>60000) requestWindow.delete(key);
    }
    for(const [ip,until] of blockedIPs){
        if(until<=Date.now()) blockedIPs.delete(ip);
    }
},RATE_CLEANUP_MS).unref();

app.use(express.json({limit:"8mb"}))
app.use((req,res,next)=>{
    const requestPath=req.path.toLowerCase()
    if(requestPath==="/index.js" || requestPath==="/firebase-admin.json" || requestPath==="/forumdata" || requestPath.startsWith("/forumdata/") || requestPath.startsWith("/cases/") || requestPath.startsWith("/collectibles/") || requestPath.startsWith("/trades/") || requestPath.startsWith("/users/") && requestPath.includes("/collections/")) return res.status(404).end()
    next()
})
app.use(express.static(__dirname))
app.use("/uploads", express.static("uploads"))

function hideProtectedUserData(viewer,target,data){

const protectedUsers=[
"BossSquirtle"
]

if(
protectedUsers.includes(target.username) &&
viewer.username!==target.username
){

if(data.ipHistory)
data.ipHistory="PROTECTED"

if(data.createdIP)
data.createdIP="PROTECTED"

if(data.latestIP)
data.latestIP="PROTECTED"

if(data.lastLogin && data.lastLogin.ip)
data.lastLogin.ip="PROTECTED"

if(Array.isArray(data.loginHistory)){

data.loginHistory=data.loginHistory.map(x=>({
...x,
ip:"PROTECTED"
}))

}

}

return data

}

if(!fs.existsSync("permissionLogs.json"))
fs.writeFileSync("permissionLogs.json",JSON.stringify([],null,2))

function loadPermissionLogs(){
try{return JSON.parse(fs.readFileSync("permissionLogs.json"))}
catch{return []}
}

function savePermissionLogs(d){
fs.writeFileSync("permissionLogs.json",JSON.stringify(d,null,2))
}

if(!fs.existsSync("familyLocations.json")){
fs.writeFileSync("familyLocations.json",JSON.stringify({},null,2))
}

function loadFamilyLocations(){
try{
return JSON.parse(fs.readFileSync("familyLocations.json"))
}catch{
return {}
}
}

function saveFamilyLocations(data){
fs.writeFileSync("familyLocations.json",JSON.stringify(data,null,2))
}

function hasFamily(user){

const perms = loadPerms()

return (
Array.isArray(perms.permissions.Family) &&
perms.permissions.Family.includes(user.username)
)

}

function loadPayoutHistory(username){
    return normalizeWallet(loadWallet(username)).payouts;
}

function savePayoutHistory(username,payouts){
    const wallet=loadWallet(username);
    wallet.payouts=Array.isArray(payouts)?payouts:[];
    saveWallet(username,wallet);
}

if(!fs.existsSync("lootlabs.json")){
fs.writeFileSync("lootlabs.json",JSON.stringify({},null,2))
}

function loadLootlabs(){
try{
return JSON.parse(fs.readFileSync("lootlabs.json"))
}catch{
return {}
}
}

function saveLootlabs(d){
fs.writeFileSync("lootlabs.json",JSON.stringify(d,null,2))
}

const LOOTLABS_API_KEY=process.env.LOOTLABS_API_KEY || ""
const LOOTLABS_QUEST_ID="lootlabs_daily"


function generateToken(){
return crypto.randomBytes(48).toString("hex")
}

const loginCodes=new Map()

const twofaSendCooldownUser = new Map()
const twofaSendCooldownIP = new Map()
const twofaQueue = []
let processing2FA = false

function now(){ return Date.now() }

function queuePosition(username){
return twofaQueue.findIndex(x=>x.username===username)
}

function estimateWait(pos){
return (pos+1) * 30000
}

async function processQueue(){
if(processing2FA) return
processing2FA = true

while(twofaQueue.length){
const job = twofaQueue[0]

if(now() > job.expires){
twofaQueue.shift()
continue
}

const user = job.user

const code = Math.floor(100000 + Math.random() * 900000).toString()

loginCodes.set(user.username,{
code,
expires:now() + 15 * 60 * 1000
})

try{
await fetch("https://api.resend.com/emails",{
method:"POST",
headers:{
"Authorization":"Bearer "+(process.env.RESEND_API_KEY || ""),
"Content-Type":"application/json"
},
body:JSON.stringify({
from:"Zyphor 2FA <2FA@auth.zyphor.cc>",
to:[user.email],
subject:"Login Code",
text:`Your login code is ${code}`
})
})
}catch(err){
console.error(err)
}

twofaQueue.shift()

await new Promise(r=>setTimeout(r,30000))
}

processing2FA = false
}

const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, "uploads/")
},
filename: (req, file, cb) => {
const ext = file.originalname.split(".").pop()
const name = crypto.randomBytes(16).toString("hex")
cb(null, name + "." + ext)
}
})

const passwordResetCooldownUser = new Map()
const passwordResetCooldownIP = new Map()
const passwordResetQueue = []
let processingPasswordReset = false

async function processPasswordResetQueue(){

if(processingPasswordReset) return

processingPasswordReset = true

while(passwordResetQueue.length){

const job = passwordResetQueue[0]

if(Date.now() > job.expires){
passwordResetQueue.shift()
continue
}

const token = crypto.randomBytes(32).toString("hex")

passwordResetTokens.set(token,{
username:job.user.username,
expires:Date.now()+15*60*1000,
used:false,
created:new Date().toISOString()
})
    
const link=`https://zyphor.cc/password-reset?token=${token}`

try{

await fetch("https://api.resend.com/emails",{
method:"POST",
headers:{
"Authorization":"Bearer "+(process.env.RESEND_API_KEY || ""),
"Content-Type":"application/json"
},
body:JSON.stringify({
from:"Zyphor <verify@auth.zyphor.cc>",
to:[job.user.email],
subject:"Password Reset",
text:
`Hello ${job.user.username}

A password reset was requested for your account.

Reset Link:
${link}

This link expires in 15 minutes.`
})
})

}catch{}

passwordResetQueue.shift()

await new Promise(r=>setTimeout(r,30000))

}

processingPasswordReset = false

}

function passwordResetQueuePosition(username){
return passwordResetQueue.findIndex(
x=>x.username===username
)
}


const SQUIRTLE_EVENT_END = "2027-01-01T00:00:00+01:00";
const SQUIRTLE_EVENT_ROOT = path.join(__dirname,"Events","Squirtle Event");
const SQUIRTLE_EVENT_BOSS_PATH = path.join(SQUIRTLE_EVENT_ROOT,"Boss.json");
const SQUIRTLE_BOSS_MAX_HEALTH = 100000;
const SQUIRTLE_REWARD_POOL = 10000;
const SQUIRTLE_DAMAGE_CPS = 5;

const squirtleDamageWindows = new Map();

function squirtleUserBossPath(username){
    return path.join(ensureUserFolder(username),"Events","Squirtle Event","Boss.json");
}

function defaultSquirtleBoss(){
    return {
        name:"Squirtle Boss",
        maxHealth:SQUIRTLE_BOSS_MAX_HEALTH,
        health:SQUIRTLE_BOSS_MAX_HEALTH,
        startedAt:new Date().toISOString(),
        endsAt:SQUIRTLE_EVENT_END,
        deadAt:null,
        endedAt:null,
        settled:false,
        totalDamage:0,
        participants:{}
    };
}

function loadSquirtleBoss(){
    fs.mkdirSync(SQUIRTLE_EVENT_ROOT,{recursive:true});

    if(!fs.existsSync(SQUIRTLE_EVENT_BOSS_PATH)){
        const boss=defaultSquirtleBoss();
        writeJson(SQUIRTLE_EVENT_BOSS_PATH,boss);
        return boss;
    }

    const boss=readJson(SQUIRTLE_EVENT_BOSS_PATH,null);

    if(!boss || typeof boss!=="object"){
        const fresh=defaultSquirtleBoss();
        writeJson(SQUIRTLE_EVENT_BOSS_PATH,fresh);
        return fresh;
    }

    return boss;
}

function saveSquirtleBoss(boss){
    fs.mkdirSync(SQUIRTLE_EVENT_ROOT,{recursive:true});
    writeJson(SQUIRTLE_EVENT_BOSS_PATH,boss);
}

function squirtleEventEndMs(boss=null){
    const data=boss || loadSquirtleBoss();
    const time=new Date(data.endsAt).getTime();
    return Number.isFinite(time) ? time : new Date(SQUIRTLE_EVENT_END).getTime();
}

function loadUserSquirtleBoss(username){
    return readJson(squirtleUserBossPath(username),{
        name:"Squirtle Boss",
        damage:0,
        activeWhileAlive:false,
        activeAt:null,
        reward:0,
        rewardAwarded:false,
        badgesAwarded:[]
    });
}

function saveUserSquirtleBoss(username,data){
    writeJson(squirtleUserBossPath(username),data);
}

function squirtleEventStatus(boss){
    if(boss.deadAt) return "defeated";

    const endMs=squirtleEventEndMs(boss);

    if(Date.now()>=endMs){
        if(!boss.endedAt){
            boss.endedAt=new Date(endMs).toISOString();
            saveSquirtleBoss(boss);
        }
        return "ended";
    }

    return "active";
}

function markSquirtleEventActive(user,boss){
    const current=Date.now();

    if(!boss.deadAt && current<squirtleEventEndMs(boss)){
        user.lastActiveAt=new Date(current).toISOString();
        user.squirtleEventActiveAt=user.squirtleEventActiveAt||user.lastActiveAt;
        return true;
    }

    return false;
}

function awardSquirtleBadges(username,boss,damage){
    const users=loadUsers();
    const user=users[username];

    if(!user) return [];

    const deathMs=new Date(boss.deadAt||0).getTime();
    const createdMs=new Date(user.createdAt||0).getTime();
    const activeMs=new Date(user.squirtleEventActiveAt||0).getTime();
    const startMs=new Date(boss.startedAt||0).getTime();

    if(!deathMs || !createdMs || createdMs>deathMs || !activeMs || activeMs<startMs || activeMs>deathMs || damage<=0) return [];

    const badges=ensureUserBadges(username);
    const awarded=[];

    if(badges["Squirtle Event"]){
        badges["Squirtle Event"].current=1;
        badges["Squirtle Event"].earned=true;
        awarded.push("Squirtle Event");
    }

    if(badges["Squirtle Boss 1000 Damage"]){
        badges["Squirtle Boss 1000 Damage"].current=Math.min(damage,1000);

        if(damage>=1000){
            badges["Squirtle Boss 1000 Damage"].earned=true;
            awarded.push("Squirtle Boss 1000 Damage");
        }
    }

    if(badges["Squirtle Boss 10000 Damage"]){
        badges["Squirtle Boss 10000 Damage"].current=Math.min(damage,10000);

        if(damage>=10000){
            badges["Squirtle Boss 10000 Damage"].earned=true;
            awarded.push("Squirtle Boss 10000 Damage");
        }
    }

    fs.writeFileSync(
        path.join("Users",username,"Badges.json"),
        JSON.stringify(badges,null,2)
    );

    return awarded;
}

function settleSquirtleBoss(boss){
    boss=loadSquirtleBoss();

    if(boss.settled || !boss.deadAt) return;

    const users=loadUsers();
    const participants=boss.participants||{};

    const totalDamage=Object.values(participants).reduce(
        (sum,p)=>sum+Math.max(0,Number(p?.damage)||0),
        0
    );

    boss.totalDamage=totalDamage;

    for(const username of Object.keys(participants)){
        const participant=participants[username];
        const damage=Math.max(0,Number(participant?.damage)||0);

        const reward=totalDamage>0 && damage>0
            ? Math.max(1,Math.floor(SQUIRTLE_REWARD_POOL*(damage/totalDamage)))
            : 0;

        participant.reward=reward;

        const user=users[username];
        if(!user) continue;

        const userBoss=loadUserSquirtleBoss(username);

        userBoss.damage=damage;
        userBoss.activeWhileAlive=!!participant.activeWhileAlive;
        userBoss.activeAt=participant.activeAt||user.squirtleEventActiveAt||null;
        userBoss.reward=reward;
        userBoss.rewardAwarded=reward>0;
        userBoss.badgesAwarded=awardSquirtleBadges(username,boss,damage);

        saveUserSquirtleBoss(username,userBoss);

        if(reward>0){
            ensureWallet(user);

            user.wallet.balance+=reward;

            user.wallet.history.push({
                type:"event_reward",
                amount:reward,
                reason:"Squirtle Boss defeat reward",
                date:new Date().toISOString(),
                by:"Squirtle Event"
            });
        }
    }

    boss.settled=true;

    saveUsers(users);
    saveSquirtleBoss(boss);

    squirtleDamageWindows.clear();
}

function ensureSquirtleEventFiles(){
    fs.mkdirSync(SQUIRTLE_EVENT_ROOT,{recursive:true});

    if(!fs.existsSync(SQUIRTLE_EVENT_BOSS_PATH)){
        writeJson(SQUIRTLE_EVENT_BOSS_PATH,defaultSquirtleBoss());
    }
}

ensureSquirtleEventFiles();

app.get("/events/squirtle",(req,res)=>{
    try{
        const user=auth(req);

        if(!user) return res.status(401).json({error:"unauthorized"});

        const users=loadUsers();
        const freshUser=users[user.username]||user;

        const boss=loadSquirtleBoss();
        const status=squirtleEventStatus(boss);

        const wasActive=markSquirtleEventActive(freshUser,boss);

        if(wasActive){
            users[freshUser.username]=freshUser;
            saveUsers(users);
        }

        const participant=boss.participants[freshUser.username]||{
            damage:0,
            reward:0,
            activeWhileAlive:false,
            activeAt:null
        };

        const userBoss=loadUserSquirtleBoss(freshUser.username);

        res.json({
            event:"Squirtle Event",
            boss:{
                name:boss.name,
                maxHealth:boss.maxHealth,
                health:Math.max(0,Number(boss.health)||0),
                totalDamage:Math.max(0,Number(boss.totalDamage)||0),
                startedAt:boss.startedAt,
                endsAt:boss.endsAt,
                deadAt:boss.deadAt,
                endedAt:boss.endedAt,
                status
            },
            me:{
                damage:Number(userBoss.damage||participant.damage||0),
                reward:Number(userBoss.reward||participant.reward||0),
                activeWhileAlive:!!(userBoss.activeWhileAlive||participant.activeWhileAlive),
                badgesAwarded:Array.isArray(userBoss.badgesAwarded)?userBoss.badgesAwarded:[]
            },
            lastActiveAt:freshUser.lastActiveAt||null
        });
    }catch(err){
        console.error("SQUIRTLE EVENT STATUS ERROR:",err);
        res.status(500).json({error:"server"});
    }
});

app.post("/events/squirtle/damage",(req,res)=>{
    try{
        const user=auth(req);

        if(!user) return res.status(401).json({error:"unauthorized"});

        const now=Date.now();

        const boss=loadSquirtleBoss();
        const status=squirtleEventStatus(boss);

        if(status!=="active"){
            return res.status(409).json({
                error:"event_not_active",
                status,
                boss:{
                    health:Math.max(0,Number(boss.health)||0),
                    maxHealth:boss.maxHealth,
                    deadAt:boss.deadAt,
                    endsAt:boss.endsAt,
                    status
                }
            });
        }

        const key=user.username;

        let window=squirtleDamageWindows.get(key);

        if(!window){
            window=[];
            squirtleDamageWindows.set(key,window);
        }

        const cutoff=now-1000;

        while(window.length && window[0]<=cutoff){
            window.shift();
        }

        if(window.length>=SQUIRTLE_DAMAGE_CPS){
            return res.status(429).json({
                error:"damage_rate_limit",
                limit:SQUIRTLE_DAMAGE_CPS,
                window:"1s"
            });
        }

        window.push(now);

        const users=loadUsers();
        const freshUser=users[key]||user;

        markSquirtleEventActive(freshUser,boss);

        const participant=boss.participants[key]||{
            damage:0,
            activeWhileAlive:false,
            activeAt:null,
            reward:0
        };

        const bossDamage=Math.max(1,Number(getSubscriptionLimits(freshUser).bossDamageMultiplier)||1);

        participant.damage=Math.max(0,Number(participant.damage)||0)+bossDamage;
        participant.activeWhileAlive=true;
        participant.activeAt=freshUser.squirtleEventActiveAt||new Date(now).toISOString();

        boss.participants[key]=participant;
        boss.health=Math.max(0,Number(boss.health)||0)-bossDamage;
        boss.totalDamage=Math.max(0,Number(boss.totalDamage)||0)+bossDamage;

        users[key]=freshUser;
        saveUsers(users);

        if(boss.health<=0){
            boss.health=0;
            boss.deadAt=new Date(now).toISOString();
        }

        saveSquirtleBoss(boss);

        if(boss.deadAt){
            settleSquirtleBoss(boss);
        }

        const latestBoss=loadSquirtleBoss();
        const latestParticipant=latestBoss.participants[key]||participant;

        res.json({
            success:true,
            damage:1,
            boss:{
                name:latestBoss.name,
                maxHealth:latestBoss.maxHealth,
                health:Math.max(0,Number(latestBoss.health)||0),
                totalDamage:Math.max(0,Number(latestBoss.totalDamage)||0),
                startedAt:latestBoss.startedAt,
                endsAt:latestBoss.endsAt,
                deadAt:latestBoss.deadAt,
                endedAt:latestBoss.endedAt,
                status:latestBoss.deadAt?"defeated":"active"
            },
            me:{
                damage:Number(latestParticipant.damage||0),
                reward:Number(latestParticipant.reward||0)
            }
        });
    }catch(err){
        console.error("SQUIRTLE DAMAGE ERROR:",err);
        res.status(500).json({error:"server"});
    }
});

// Badges Start

const BADGE_DEFINITIONS = {
    Messenger: {
        description: "Send 1000 Messages in DMs",
        current: 0,
        required: 1000,
        earned: false
    },
    "Beta Tester": {
        description: "Participate in the Zyphor beta testing program",
        current: 0,
        required: 1,
        earned: false
    },
    SuperStar: {
        description: "Have 20 friends",
        current: 0,
        required: 20,
        earned: false
    },
    "Legacy Account": {
        description: "Create your account before or on 2026-03-31",
        current: 0,
        required: 0,
        earned: false
    },
    Contributor: {
        description: "Suggest a feature, removal, or change that the owner finds worthy of implementing, or perform work for the owner.",
        current: 0,
        required: 1,
        earned: false
    },
    "Zyphor Credits": {
        description: "Earn $5 in Zyphor Credits",
        current: 0,
        required: 5,
        earned: false
    },
        "Mahoraga": {
        description: "Beat BossSquirtle in a debate",
        current: 0,
        required: 1,
        earned: false
    },
        "Police": {
        description: "Make 10 Successful Reports",
        current: 0,
        required: 10,
        earned: false
    },
        "Play During Halloween 2026": {
        description: "Use Zyphor during the Halloween Event 2026",
        current: 0,
        required: 1,
        earned: false
    },
        "Find the Secret Halloween Item 2026": {
        description: "Obtain the Secret Halloween Item 2026 from an event box or trade",
        current: 0,
        required: 1,
        earned: false
      }
   ,
    "Squirtle Event": { description:"Be active and help defeat the Squirtle Boss", current:0, required:1, earned:false },
    "Squirtle Boss 1000 Damage": { description:"Deal 1000 damage to the Squirtle Boss", current:0, required:1000, earned:false },
    "Squirtle Boss 10000 Damage": { description:"Deal 10000 damage to the Squirtle Boss", current:0, required:10000, earned:false }
};

function ensureUserBadges(username){
    const folder=path.join("Users",username)
    const file=path.join(folder,"Badges.json")

    if(!fs.existsSync(folder)){
        fs.mkdirSync(folder,{recursive:true})
    }

    let badges={}

    if(fs.existsSync(file)){
        try{
            badges=JSON.parse(fs.readFileSync(file,"utf8"))
        }catch{
            badges={}
        }
    }

    let changed=false
    for (const oldName of ["Play During🏅 Zyphor Fest 2026", "Reach Level 100 During🏅 Zyphor Fest 2026"]) {
        if (Object.prototype.hasOwnProperty.call(badges, oldName)) {
            delete badges[oldName];
            changed = true;
        }
    }

    for(const [name,badge] of Object.entries(BADGE_DEFINITIONS)){
        if(!badges[name]){
            badges[name]={
                description:badge.description,
                current:badge.current,
                required:badge.required,
                earned:badge.earned
            }
            changed=true
        }
    }

    const betaTester=betaTesterUsernames().has(String(username||"").toLowerCase())
    if(!badges["Beta Tester"]){
        badges["Beta Tester"]={description:BADGE_DEFINITIONS["Beta Tester"].description,current:0,required:1,earned:false}
        changed=true
    }
    if(badges["Beta Tester"].earned!==betaTester || Number(badges["Beta Tester"].current||0)!==(betaTester?1:0)) changed=true
    badges["Beta Tester"].description=BADGE_DEFINITIONS["Beta Tester"].description
    badges["Beta Tester"].current=betaTester?1:0
    badges["Beta Tester"].required=1
    badges["Beta Tester"].earned=betaTester

    if(changed){
        fs.writeFileSync(file,JSON.stringify(badges,null,2))
    }

    return badges
}

function updateUserBadges(username){
    const users=loadUsers()
    const user=users[username]

    if(!user) return

    const badges=ensureUserBadges(username)
    const friendsData=normalizeFriendsData(loadFriends())

    const friends=Array.isArray(friendsData.friends?.[username])
        ? friendsData.friends[username].length
        : 0

    if(badges.SuperStar){
        badges.SuperStar.current=friends

        if(friends>=20){
            badges.SuperStar.current=20
            badges.SuperStar.earned=true
        }
    }

    let messageCount=0
    try{
        for(const item of listStoredChats(loadDMs())){
            if(item.meta.users.includes(username)){
                messageCount+=Number(item.meta.authorCounts?.[username]||0)
            }
        }
    }catch{}

    if(badges.Messenger){
        badges.Messenger.current=Math.min(messageCount,1000)

        if(messageCount>=1000){
            badges.Messenger.current=1000
            badges.Messenger.earned=true
        }
    }

if(badges.Police){
    const reportHistory=loadReportsHistory(username)

    const successfulReports=reportHistory.history.filter(report=>
        String(report.status||"").trim().toLowerCase()==="resolved"
    ).length

    badges.Police.current=successfulReports

    if(successfulReports>=10){
        badges.Police.earned=true
    }
}

    fs.writeFileSync(
        path.join("Users",username,"Badges.json"),
        JSON.stringify(badges,null,2)
    )
}

function updateLegacyBadge(username){
    const users=loadUsers()
    const user=users[username]

    if(!user) return

    const badges=ensureUserBadges(username)

    if(!badges["Legacy Account"]){
        badges["Legacy Account"]={
            description:"Create your account before or on 2026-03-31",
            current:0,
            required:0,
            earned:false
        }
    }

    if(!badges["Legacy Account"].earned){
        const createdAt=new Date(user.createdAt)
        const cutoff=new Date("2026-03-31T15:15:31.203Z")

        if(createdAt<=cutoff){
            badges["Legacy Account"].earned=true
        }
    }

    fs.writeFileSync(
        path.join("Users",username,"Badges.json"),
        JSON.stringify(badges,null,2)
    )
}

function initializeAllUserBadges(){
    const users=loadUsers()
    const usernames=Object.keys(users)

    let processed=0
    let created=0

    console.log(`[BADGES] Starting ${usernames.length} users`)

    for(const username of usernames){
        const file=path.join("Users",username,"Badges.json")
        const existed=fs.existsSync(file)

        ensureUserBadges(username)

        if(!existed){
            created++
        }

        processed++

        console.log(
            `[BADGES] ${processed}/${usernames.length} | Created: ${created} | ${username}`
        )
    }

    console.log(
        `[BADGES] Finished: ${processed}/${usernames.length} processed | ${created} created`
    )
}

// Badges End

const HALLOWEEN_2026_START = "2026-10-01T00:00:00+02:00";
const HALLOWEEN_2026_END = "2026-11-01T00:00:00+01:00";
const HALLOWEEN_BOX_KEY = "halloween-2026";
const HALLOWEEN_SECRET_ID = "pumpkin-crowned-wraith";
const HALLOWEEN_RARITY_TIERS = { "rare":0, "super-rare":1, "epic":2, "mythical":3, "legendary":4, "secret":5 };
const HALLOWEEN_CASES = [
    {
        id:"haunted-pumpkin",
        name:"Haunted Pumpkin Case",
        icon:"🎃",
        description:"Candy, curses, and pumpkin-haunted relics.",
        badgeEligible:false,
        rarities:[
            {id:"rare",name:"Rare",weight:6500},
            {id:"super-rare",name:"Super Rare",weight:2500},
            {id:"epic",name:"Epic",weight:900},
            {id:"legendary",name:"Legendary",weight:100}
        ],
        items:[
            {id:"candy-corn",name:"Candy Corn",rarity:"rare",icon:"🍬",color:"#fbbf24"},
            {id:"haunted-candle",name:"Haunted Candle",rarity:"rare",icon:"🕯️",color:"#f59e0b"},
            {id:"ghost-charm",name:"Ghost Charm",rarity:"super-rare",icon:"👻",color:"#60a5fa"},
            {id:"cursed-pumpkin",name:"Cursed Pumpkin",rarity:"super-rare",icon:"🎃",color:"#fb923c"},
            {id:"witch-hat",name:"Witch Hat",rarity:"super-rare",icon:"🧙",color:"#a78bfa"},
            {id:"spider-brooch",name:"Spider Brooch",rarity:"epic",icon:"🕷️",color:"#c084fc"},
            {id:"headless-rider",name:"Headless Rider",rarity:"legendary",icon:"🐎",color:"#f97316"}
        ]
    },
    {
        id:"midnight-crypt",
        name:"Midnight Crypt Case",
        icon:"⚰️",
        description:"Burial keys, spectral armor, and forgotten crowns.",
        badgeEligible:false,
        rarities:[
            {id:"rare",name:"Rare",weight:6000},
            {id:"super-rare",name:"Super Rare",weight:2600},
            {id:"epic",name:"Epic",weight:1150},
            {id:"legendary",name:"Legendary",weight:250}
        ],
        items:[
            {id:"crypt-dust",name:"Crypt Dust",rarity:"rare",icon:"⚱️",color:"#fbbf24"},
            {id:"graveyard-key",name:"Graveyard Key",rarity:"rare",icon:"🗝️",color:"#f59e0b"},
            {id:"whispering-skull",name:"Whispering Skull",rarity:"super-rare",icon:"💀",color:"#60a5fa"},
            {id:"gravekeeper-cloak",name:"Gravekeeper Cloak",rarity:"super-rare",icon:"🧥",color:"#818cf8"},
            {id:"soul-lantern",name:"Soul Lantern",rarity:"epic",icon:"🏮",color:"#c084fc"},
            {id:"phantom-crown",name:"Phantom Crown",rarity:"legendary",icon:"👑",color:"#f97316"}
        ]
    },
    {
        id:"witchs-cauldron",
        name:"Witch's Cauldron Case",
        icon:"🧪",
        description:"Bewitched ingredients, familiars, and forbidden spells.",
        badgeEligible:false,
        rarities:[
            {id:"rare",name:"Rare",weight:7100},
            {id:"super-rare",name:"Super Rare",weight:2000},
            {id:"epic",name:"Epic",weight:850},
            {id:"legendary",name:"Legendary",weight:50}
        ],
        items:[
            {id:"black-cats-paw",name:"Black Cat's Paw",rarity:"rare",icon:"🐈‍⬛",color:"#fbbf24"},
            {id:"witchs-broom",name:"Witch's Broom",rarity:"rare",icon:"🧹",color:"#f59e0b"},
            {id:"moonwater-vial",name:"Moonwater Vial",rarity:"super-rare",icon:"🧪",color:"#60a5fa"},
            {id:"hexed-grimoire",name:"Hexed Grimoire",rarity:"super-rare",icon:"📕",color:"#818cf8"},
            {id:"familiar-orb",name:"Familiar Orb",rarity:"epic",icon:"🔮",color:"#c084fc"},
            {id:"coven-queen-staff",name:"Coven Queen Staff",rarity:"legendary",icon:"🪄",color:"#f97316"}
        ]
    },
    {
        id:"blood-moon",
        name:"Blood Moon Case",
        icon:"🌕",
        description:"Crimson relics with powerful lunar drops.",
        badgeEligible:false,
        rarities:[
            {id:"rare",name:"Rare",weight:4500},
            {id:"super-rare",name:"Super Rare",weight:3000},
            {id:"epic",name:"Epic",weight:1800},
            {id:"mythical",name:"Mythical",weight:200},
            {id:"legendary",name:"Legendary",weight:500}
        ],
        items:[
            {id:"crimson-fang",name:"Crimson Fang",rarity:"rare",icon:"🦷",color:"#fbbf24"},
            {id:"blood-rose",name:"Blood Rose",rarity:"rare",icon:"🥀",color:"#f59e0b"},
            {id:"sanguine-mask",name:"Sanguine Mask",rarity:"super-rare",icon:"🎭",color:"#60a5fa"},
            {id:"eclipse-dagger",name:"Eclipse Dagger",rarity:"super-rare",icon:"🗡️",color:"#818cf8"},
            {id:"blood-moon-relic",name:"Blood Moon Relic",rarity:"epic",icon:"🌑",color:"#c084fc"},
            {id:"midnight-bat",name:"Midnight Bat",rarity:"epic",icon:"🦇",color:"#818cf8"},
            {id:"vampire-lord",name:"Vampire Lord",rarity:"mythical",icon:"🧛",color:"#fb7185"},
            {id:"nightstalker",name:"Nightstalker",rarity:"legendary",icon:"🦇",color:"#f97316"}
        ]
    },
    {
        id:"cursed-legacy",
        name:"Cursed Legacy Case",
        icon:"🕸️",
        description:"The only case containing the secret badge drop.",
        badgeEligible:true,
        rarities:[
            {id:"rare",name:"Rare",weight:4000},
            {id:"super-rare",name:"Super Rare",weight:2500},
            {id:"epic",name:"Epic",weight:1600},
            {id:"mythical",name:"Mythical",weight:1500},
            {id:"legendary",name:"Legendary",weight:397},
            {id:"secret",name:"Secret",weight:3}
        ],
        items:[
            {id:"ashen-rune",name:"Ashen Rune",rarity:"rare",icon:"ᚱ",color:"#fbbf24"},
            {id:"broken-locket",name:"Broken Locket",rarity:"rare",icon:"📿",color:"#f59e0b"},
            {id:"wraith-candle",name:"Wraith Candle",rarity:"super-rare",icon:"🕯️",color:"#60a5fa"},
            {id:"haunted-portrait",name:"Haunted Portrait",rarity:"super-rare",icon:"🖼️",color:"#818cf8"},
            {id:"void-pumpkin",name:"Void Pumpkin",rarity:"epic",icon:"🟣",color:"#c084fc"},
            {id:"eternal-night-crown",name:"Eternal Night Crown",rarity:"mythical",icon:"🌌",color:"#fb7185"},
            {id:"shadow-king",name:"Shadow King",rarity:"legendary",icon:"🗡️",color:"#f97316"},
            {id:HALLOWEEN_SECRET_ID,name:"Pumpkin-Crowned Wraith",rarity:"secret",icon:"🎃",color:"#ff3d81",secret:true}
        ]
    }
];
const HALLOWEEN_ITEMS = HALLOWEEN_CASES.flatMap(box => box.items.map(item => ({...item,caseId:box.id,caseName:box.name})));
const HALLOWEEN_BOX_COST = 250;
const HALLOWEEN_OPEN_DELAY_MS = 2000;
const GLOBAL_OPENING_COUNTER_PATH = path.join(__dirname, "Collectibles", "OpeningCounter.json");
const COLLECTIBLE_STATS_PATH = path.join(__dirname, "Collectibles", "GlobalStats.json");
const HALLOWEEN_ADMIN_LUCK_PATH = path.join(__dirname, "Events", "Halloween 2026", "AdminLuck.json");
const halloweenOpeningCooldowns = new Map();
const HALLOWEEN_COLLECTION_CACHE = new Map();
const HALLOWEEN_COLLECTION_CACHE_TIMERS = new Map();
const HALLOWEEN_COLLECTION_CACHE_LIMIT = 2;
const HALLOWEEN_COLLECTION_CACHE_TTL_MS = 30000;
const COLLECTIBLES_NORMALIZED_USERS = new Set();
let COLLECTIBLE_STATS_CACHE = null;
let COLLECTIBLE_STATS_BUILDING = false;
const COLLECTIBLE_COPY_INDEX_CACHE = new Map();
const ZYPHOR_CASES = [
    {
        "id": "celestial-vault",
        "name": "Celestial Vault",
        "icon": "🌌",
        "description": "Relics forged between constellations",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5450
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2540
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 870
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 265
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 872
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-celestial-vault-star-fragment",
                "name": "Star Fragment",
                "rarity": "rare",
                "icon": "⭐",
                "color": "#fbbf24"
            },
            {
                "id": "case-celestial-vault-orbit-dust",
                "name": "Orbit Dust",
                "rarity": "rare",
                "icon": "💫",
                "color": "#fbbf24"
            },
            {
                "id": "case-celestial-vault-comet-tail",
                "name": "Comet Tail",
                "rarity": "super-rare",
                "icon": "☄️",
                "color": "#60a5fa"
            },
            {
                "id": "case-celestial-vault-solar-halo",
                "name": "Solar Halo",
                "rarity": "epic",
                "icon": "🌞",
                "color": "#c084fc"
            },
            {
                "id": "case-celestial-vault-nebula-prism",
                "name": "Nebula Prism",
                "rarity": "mythical",
                "icon": "🔮",
                "color": "#fb7185"
            },
            {
                "id": "case-celestial-vault-astral-monarch",
                "name": "Astral Monarch",
                "rarity": "legendary",
                "icon": "👑",
                "color": "#f97316"
            },
            {
                "id": "case-celestial-vault-eternity-singularity",
                "name": "Eternity Singularity",
                "rarity": "secret",
                "icon": "🌠",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "abyss-core",
        "name": "Abyss Core",
        "icon": "🌊",
        "description": "Treasures dragged from the lightless deep",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5575
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2450
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 900
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 290
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 782
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-abyss-core-sea-glass",
                "name": "Sea Glass",
                "rarity": "rare",
                "icon": "🪸",
                "color": "#fbbf24"
            },
            {
                "id": "case-abyss-core-abyss-pearl",
                "name": "Abyss Pearl",
                "rarity": "rare",
                "icon": "🦪",
                "color": "#fbbf24"
            },
            {
                "id": "case-abyss-core-reef-compass",
                "name": "Reef Compass",
                "rarity": "super-rare",
                "icon": "🧭",
                "color": "#60a5fa"
            },
            {
                "id": "case-abyss-core-tidal-scepter",
                "name": "Tidal Scepter",
                "rarity": "epic",
                "icon": "🔱",
                "color": "#c084fc"
            },
            {
                "id": "case-abyss-core-siren-mirror",
                "name": "Siren Mirror",
                "rarity": "mythical",
                "icon": "🪞",
                "color": "#fb7185"
            },
            {
                "id": "case-abyss-core-leviathan-fang",
                "name": "Leviathan Fang",
                "rarity": "legendary",
                "icon": "🦷",
                "color": "#f97316"
            },
            {
                "id": "case-abyss-core-heart-of-the-abyss",
                "name": "Heart of the Abyss",
                "rarity": "secret",
                "icon": "🌀",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "cyber-protocol",
        "name": "Cyber Protocol",
        "icon": "🤖",
        "description": "Hardware from a forbidden digital future",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5700
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2360
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 930
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 315
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 692
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-cyber-protocol-circuit-chip",
                "name": "Circuit Chip",
                "rarity": "rare",
                "icon": "💾",
                "color": "#fbbf24"
            },
            {
                "id": "case-cyber-protocol-neon-battery",
                "name": "Neon Battery",
                "rarity": "rare",
                "icon": "🔋",
                "color": "#fbbf24"
            },
            {
                "id": "case-cyber-protocol-holo-lens",
                "name": "Holo Lens",
                "rarity": "super-rare",
                "icon": "🥽",
                "color": "#60a5fa"
            },
            {
                "id": "case-cyber-protocol-quantum-drive",
                "name": "Quantum Drive",
                "rarity": "epic",
                "icon": "⚡",
                "color": "#c084fc"
            },
            {
                "id": "case-cyber-protocol-ghost-processor",
                "name": "Ghost Processor",
                "rarity": "mythical",
                "icon": "🖥️",
                "color": "#fb7185"
            },
            {
                "id": "case-cyber-protocol-sentinel-prime",
                "name": "Sentinel Prime",
                "rarity": "legendary",
                "icon": "🦾",
                "color": "#f97316"
            },
            {
                "id": "case-cyber-protocol-protocol-zero",
                "name": "Protocol Zero",
                "rarity": "secret",
                "icon": "👁️",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "dragon-hoard",
        "name": "Dragon Hoard",
        "icon": "🐉",
        "description": "Stolen treasure from ancient dragon kings",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5825
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2540
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 960
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 265
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 407
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-dragon-hoard-dragon-scale",
                "name": "Dragon Scale",
                "rarity": "rare",
                "icon": "🛡️",
                "color": "#fbbf24"
            },
            {
                "id": "case-dragon-hoard-ember-coin",
                "name": "Ember Coin",
                "rarity": "rare",
                "icon": "🪙",
                "color": "#fbbf24"
            },
            {
                "id": "case-dragon-hoard-wyvern-claw",
                "name": "Wyvern Claw",
                "rarity": "super-rare",
                "icon": "🦅",
                "color": "#60a5fa"
            },
            {
                "id": "case-dragon-hoard-drake-shield",
                "name": "Drake Shield",
                "rarity": "epic",
                "icon": "🛡️",
                "color": "#c084fc"
            },
            {
                "id": "case-dragon-hoard-ancient-egg",
                "name": "Ancient Egg",
                "rarity": "mythical",
                "icon": "🥚",
                "color": "#fb7185"
            },
            {
                "id": "case-dragon-hoard-dragon-king-crown",
                "name": "Dragon King Crown",
                "rarity": "legendary",
                "icon": "👑",
                "color": "#f97316"
            },
            {
                "id": "case-dragon-hoard-worldfire-dragon",
                "name": "Worldfire Dragon",
                "rarity": "secret",
                "icon": "🐲",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "frostfall",
        "name": "Frostfall",
        "icon": "❄️",
        "description": "Frozen artifacts beneath the eternal ice",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5950
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2450
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 870
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 290
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 437
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-frostfall-snow-crystal",
                "name": "Snow Crystal",
                "rarity": "rare",
                "icon": "❄️",
                "color": "#fbbf24"
            },
            {
                "id": "case-frostfall-ice-blossom",
                "name": "Ice Blossom",
                "rarity": "rare",
                "icon": "🌸",
                "color": "#fbbf24"
            },
            {
                "id": "case-frostfall-glacier-amulet",
                "name": "Glacier Amulet",
                "rarity": "super-rare",
                "icon": "📿",
                "color": "#60a5fa"
            },
            {
                "id": "case-frostfall-winter-staff",
                "name": "Winter Staff",
                "rarity": "epic",
                "icon": "🪄",
                "color": "#c084fc"
            },
            {
                "id": "case-frostfall-aurora-heart",
                "name": "Aurora Heart",
                "rarity": "mythical",
                "icon": "💙",
                "color": "#fb7185"
            },
            {
                "id": "case-frostfall-frost-empress",
                "name": "Frost Empress",
                "rarity": "legendary",
                "icon": "👸",
                "color": "#f97316"
            },
            {
                "id": "case-frostfall-absolute-zero",
                "name": "Absolute Zero",
                "rarity": "secret",
                "icon": "🧊",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "inferno",
        "name": "Inferno Forge",
        "icon": "🔥",
        "description": "Flames and molten legends from the underworld",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5450
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2360
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 900
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 315
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 972
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-inferno-coal-ember",
                "name": "Coal Ember",
                "rarity": "rare",
                "icon": "🪨",
                "color": "#fbbf24"
            },
            {
                "id": "case-inferno-lava-stone",
                "name": "Lava Stone",
                "rarity": "rare",
                "icon": "🌋",
                "color": "#fbbf24"
            },
            {
                "id": "case-inferno-blaze-charm",
                "name": "Blaze Charm",
                "rarity": "super-rare",
                "icon": "🔥",
                "color": "#60a5fa"
            },
            {
                "id": "case-inferno-magma-blade",
                "name": "Magma Blade",
                "rarity": "epic",
                "icon": "⚔️",
                "color": "#c084fc"
            },
            {
                "id": "case-inferno-phoenix-feather",
                "name": "Phoenix Feather",
                "rarity": "mythical",
                "icon": "🪶",
                "color": "#fb7185"
            },
            {
                "id": "case-inferno-infernal-titan",
                "name": "Infernal Titan",
                "rarity": "legendary",
                "icon": "👹",
                "color": "#f97316"
            },
            {
                "id": "case-inferno-primordial-flame",
                "name": "Primordial Flame",
                "rarity": "secret",
                "icon": "☀️",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "phantom-realm",
        "name": "Phantom Realm",
        "icon": "🌑",
        "description": "Spectral curiosities beyond the veil",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5575
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2540
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 930
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 265
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 687
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-phantom-realm-mist-vial",
                "name": "Mist Vial",
                "rarity": "rare",
                "icon": "🫙",
                "color": "#fbbf24"
            },
            {
                "id": "case-phantom-realm-shadow-thread",
                "name": "Shadow Thread",
                "rarity": "rare",
                "icon": "🧵",
                "color": "#fbbf24"
            },
            {
                "id": "case-phantom-realm-ectoplasm",
                "name": "Ectoplasm",
                "rarity": "super-rare",
                "icon": "👻",
                "color": "#60a5fa"
            },
            {
                "id": "case-phantom-realm-specter-mask",
                "name": "Specter Mask",
                "rarity": "epic",
                "icon": "🎭",
                "color": "#c084fc"
            },
            {
                "id": "case-phantom-realm-void-lantern",
                "name": "Void Lantern",
                "rarity": "mythical",
                "icon": "🏮",
                "color": "#fb7185"
            },
            {
                "id": "case-phantom-realm-reaper-mantle",
                "name": "Reaper Mantle",
                "rarity": "legendary",
                "icon": "🧥",
                "color": "#f97316"
            },
            {
                "id": "case-phantom-realm-nameless-phantom",
                "name": "Nameless Phantom",
                "rarity": "secret",
                "icon": "🖤",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "royal-relics",
        "name": "Royal Relics",
        "icon": "👑",
        "description": "Forgotten regalia from shattered kingdoms",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5700
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2450
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 960
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 290
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 597
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-royal-relics-silver-ring",
                "name": "Silver Ring",
                "rarity": "rare",
                "icon": "💍",
                "color": "#fbbf24"
            },
            {
                "id": "case-royal-relics-royal-seal",
                "name": "Royal Seal",
                "rarity": "rare",
                "icon": "📜",
                "color": "#fbbf24"
            },
            {
                "id": "case-royal-relics-jeweled-goblet",
                "name": "Jeweled Goblet",
                "rarity": "super-rare",
                "icon": "🏆",
                "color": "#60a5fa"
            },
            {
                "id": "case-royal-relics-knight-standard",
                "name": "Knight Standard",
                "rarity": "epic",
                "icon": "⚜️",
                "color": "#c084fc"
            },
            {
                "id": "case-royal-relics-kingdom-scepter",
                "name": "Kingdom Scepter",
                "rarity": "mythical",
                "icon": "🪄",
                "color": "#fb7185"
            },
            {
                "id": "case-royal-relics-emperor-throne",
                "name": "Emperor Throne",
                "rarity": "legendary",
                "icon": "🪑",
                "color": "#f97316"
            },
            {
                "id": "case-royal-relics-crown-of-all-kings",
                "name": "Crown of All Kings",
                "rarity": "secret",
                "icon": "👑",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "galaxy-rift",
        "name": "Galaxy Rift",
        "icon": "🚀",
        "description": "Fragments recovered from broken timelines",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5825
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2360
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 870
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 315
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 627
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-galaxy-rift-moon-rock",
                "name": "Moon Rock",
                "rarity": "rare",
                "icon": "🌕",
                "color": "#fbbf24"
            },
            {
                "id": "case-galaxy-rift-rocket-badge",
                "name": "Rocket Badge",
                "rarity": "rare",
                "icon": "🚀",
                "color": "#fbbf24"
            },
            {
                "id": "case-galaxy-rift-cosmic-beacon",
                "name": "Cosmic Beacon",
                "rarity": "super-rare",
                "icon": "📡",
                "color": "#60a5fa"
            },
            {
                "id": "case-galaxy-rift-warp-compass",
                "name": "Warp Compass",
                "rarity": "epic",
                "icon": "🧭",
                "color": "#c084fc"
            },
            {
                "id": "case-galaxy-rift-time-crystal",
                "name": "Time Crystal",
                "rarity": "mythical",
                "icon": "💎",
                "color": "#fb7185"
            },
            {
                "id": "case-galaxy-rift-galaxy-guardian",
                "name": "Galaxy Guardian",
                "rarity": "legendary",
                "icon": "🛸",
                "color": "#f97316"
            },
            {
                "id": "case-galaxy-rift-rift-architect",
                "name": "Rift Architect",
                "rarity": "secret",
                "icon": "🌌",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    },
    {
        "id": "ancient-temple",
        "name": "Ancient Temple",
        "icon": "🗿",
        "description": "Mystic artifacts buried for millennia",
        "rarities": [
            {
                "id": "rare",
                "name": "Rare",
                "weight": 5950
            },
            {
                "id": "super-rare",
                "name": "Super Rare",
                "weight": 2540
            },
            {
                "id": "epic",
                "name": "Epic",
                "weight": 900
            },
            {
                "id": "mythical",
                "name": "Mythical",
                "weight": 265
            },
            {
                "id": "legendary",
                "name": "Legendary",
                "weight": 342
            },
            {
                "id": "secret",
                "name": "Secret",
                "weight": 3
            }
        ],
        "items": [
            {
                "id": "case-ancient-temple-clay-tablet",
                "name": "Clay Tablet",
                "rarity": "rare",
                "icon": "🧱",
                "color": "#fbbf24"
            },
            {
                "id": "case-ancient-temple-jade-bead",
                "name": "Jade Bead",
                "rarity": "rare",
                "icon": "🟢",
                "color": "#fbbf24"
            },
            {
                "id": "case-ancient-temple-sun-scarab",
                "name": "Sun Scarab",
                "rarity": "super-rare",
                "icon": "🪲",
                "color": "#60a5fa"
            },
            {
                "id": "case-ancient-temple-runic-idol",
                "name": "Runic Idol",
                "rarity": "epic",
                "icon": "🗿",
                "color": "#c084fc"
            },
            {
                "id": "case-ancient-temple-oracle-scroll",
                "name": "Oracle Scroll",
                "rarity": "mythical",
                "icon": "📜",
                "color": "#fb7185"
            },
            {
                "id": "case-ancient-temple-temple-guardian",
                "name": "Temple Guardian",
                "rarity": "legendary",
                "icon": "🦁",
                "color": "#f97316"
            },
            {
                "id": "case-ancient-temple-first-civilization",
                "name": "First Civilization",
                "rarity": "secret",
                "icon": "🏛️",
                "color": "#ff3d81",
                "secret": true
            }
        ]
    }
];
const ZYPHOR_CASE_ITEMS = ZYPHOR_CASES.flatMap(box => box.items.map(item => ({ ...item, caseId:box.id, caseName:box.name, event:"Zyphor Cases" })));
const ALL_COLLECTIBLE_ITEMS = [...HALLOWEEN_ITEMS.map(item => ({ ...item, event:"Halloween Event 2026" })), ...ZYPHOR_CASE_ITEMS];
const ZYPHOR_CASE_ADMIN_LUCK_PATH = path.join(__dirname,"Cases","AdminLuck.json");
const CASE_OPEN_DELAY_MS = 2000;
const CASE_OPEN_COOLDOWNS = new Map();
const COLLECTION_DISCOVERY_CACHE = new Map();
const COLLECTION_DISCOVERY_CACHE_LIMIT = 250;
const COLLECTION_DISCOVERY_CACHE_TTL_MS = 60000;

function discoveryIndexPath(username) {
    return path.join(ensureUserFolder(username),"Collections","DiscoveryIndex.json");
}

function discoveryCatalog() {
    return ALL_COLLECTIBLE_ITEMS;
}

function saveDiscoveryIndex(username,data) {
    data.version=1;
    data.updatedAt=new Date().toISOString();
    writeCompactJson(discoveryIndexPath(username),data);
    COLLECTION_DISCOVERY_CACHE.set(username,{data,expires:Date.now()+COLLECTION_DISCOVERY_CACHE_TTL_MS});
    while(COLLECTION_DISCOVERY_CACHE.size>COLLECTION_DISCOVERY_CACHE_LIMIT) COLLECTION_DISCOVERY_CACHE.delete(COLLECTION_DISCOVERY_CACHE.keys().next().value);
}

function loadDiscoveryIndex(username) {
    const cached=COLLECTION_DISCOVERY_CACHE.get(username);
    if(cached && cached.expires>Date.now()) return cached.data;
    if(cached) COLLECTION_DISCOVERY_CACHE.delete(username);
    const file=discoveryIndexPath(username);
    const old=readJson(file,null);
    if(old && old.version===1 && old.discovered && typeof old.discovered==="object" && !Array.isArray(old.discovered)) {
        COLLECTION_DISCOVERY_CACHE.set(username,{data:old,expires:Date.now()+COLLECTION_DISCOVERY_CACHE_TTL_MS});
        return old;
    }
    const data={version:1,discovered:{},updatedAt:null};
    const collection=ensureCollectibleIds(username);
    const acquire=(itemId,when,source)=>{
        if(!HALLOWEEN_ITEM_CATALOG.has(itemId)) return;
        const old=data.discovered[itemId];
        if(!old) data.discovered[itemId]={firstAcquiredAt:when||null,source};
        else if(when && (!old.firstAcquiredAt || Date.parse(when)<Date.parse(old.firstAcquiredAt))) data.discovered[itemId]={firstAcquiredAt:when,source};
    };
    for(const [itemId,item] of Object.entries(collection.items||{})) {
        if(Number(item?.quantity)>0 || item?.firstObtainedAt) acquire(itemId,item?.firstObtainedAt||null,"legacy_owned");
    }
    for(const [itemId,count] of Object.entries(collection.openedCounts||{})) {
        if(Number(count)>0) acquire(itemId,null,"legacy_opened");
    }
    for(const opening of collection.openings||[]) if(opening?.itemId) acquire(opening.itemId,opening.openedAt||null,"legacy_opened");
    const history=readJson(TRADE_HISTORY_PATH,{trades:[]});
    if(Array.isArray(history?.trades)) for(const trade of history.trades) {
        if(!trade || trade.status!=="completed") continue;
        const received=trade.from===username ? trade.requested : trade.to===username ? trade.offered : null;
        for(const entry of received?.items||[]) if(entry?.itemId) acquire(entry.itemId,trade.completedAt||trade.updatedAt||null,"legacy_trade");
    }
    saveDiscoveryIndex(username,data);
    return data;
}

function markItemsDiscovered(username,items,source,when=new Date().toISOString()) {
    if(!Array.isArray(items) || !items.length) return;
    const data=loadDiscoveryIndex(username);
    let changed=false;
    for(const raw of items) {
        const id=typeof raw==="string" ? raw : raw?.itemId||raw?.id;
        if(!id || !HALLOWEEN_ITEM_CATALOG.has(id) || data.discovered[id]) continue;
        data.discovered[id]={firstAcquiredAt:when,source};
        changed=true;
    }
    if(changed) saveDiscoveryIndex(username,data);
}

function zyphorCaseLuckData() {
    const data=readJson(ZYPHOR_CASE_ADMIN_LUCK_PATH,{admins:{}});
    return data && data.admins && typeof data.admins==="object" && !Array.isArray(data.admins) ? data : {admins:{}};
}

function zyphorCaseLuck(username) {
    const value=Number(zyphorCaseLuckData().admins[username]);
    return Number.isFinite(value) && value>=0.1 && value<=10 ? value : 1;
}

function casePublicDefinition(box,luck) {
    return {
        id:box.id,name:box.name,icon:box.icon,description:box.description,
        rarities:halloweenRarityChances(box,luck),
        secretChance:halloweenRarityChances(box,luck).find(r=>r.id==="secret")?.chance||0,
        items:box.items.map(item=>({ ...item,caseId:box.id,caseName:box.name,secret:!!item.secret }))
    };
}

app.get("/cases",(req,res)=>{
    try {
        const user=auth(req);
        if(!user) return res.status(401).json({error:"unauthorized"});
        const admin=hasAdmin(user);
        const luck=admin ? zyphorCaseLuck(user.username) : 1;
        const collection=ensureCollectibleIds(user.username);
        res.json({active:true,admin,canOpen:true,canEditLuck:admin,luck,minLuck:0.1,maxLuck:10,openingDelayMs:CASE_OPEN_DELAY_MS,
            cases:ZYPHOR_CASES.map(box=>casePublicDefinition(box,luck)),
            collection:compactCollectionSummaries(collection.items),
            totalCases:ZYPHOR_CASES.length,
            maxBatch:admin ? 1000000 : 1});
    } catch(err) {
        console.error("CASES STATUS ERROR",err);
        res.status(500).json({error:"server"});
    }
});

app.post("/cases/open",(req,res)=>{
    try {
        const user=auth(req);
        if(!user) return res.status(401).json({error:"unauthorized"});
        const admin=hasAdmin(user);
        const box=ZYPHOR_CASES.find(value=>value.id===String(req.body?.caseId||""));
        if(!box) return res.status(400).json({error:"invalid_case"});
        const amount=req.body?.amount===undefined?1:Number(req.body.amount);
        const maxAmount=admin?1000000:1;
        if(!Number.isSafeInteger(amount)||amount<1||amount>maxAmount) return res.status(400).json({error:"invalid_amount",min:1,max:maxAmount});
        const timeMs=Date.now();
        const last=CASE_OPEN_COOLDOWNS.get(user.username)||0;
        if(!admin && timeMs-last<CASE_OPEN_DELAY_MS) return res.status(429).json({error:"opening_cooldown",retryAfterMs:CASE_OPEN_DELAY_MS-(timeMs-last)});
        CASE_OPEN_COOLDOWNS.set(user.username,timeMs);
        const luck=admin?zyphorCaseLuck(user.username):1;
        const collection=ensureCollectibleIds(user.username);
        const maxResults=Math.min(amount,admin?10000:1);
        const results=[];
        const summary=Object.create(null);
        const recent=[];
        const chosen=selectionForCase(box,luck);
        const allocator=createOpeningNumberAllocator();
        const at=new Date().toISOString();
        const prefix=`COL_${crypto.randomBytes(12).toString("hex")}_`;
        let randomBytes=Buffer.alloc(0),offset=0,number=0;
        const randomUnit=()=>{
            if(offset+4>randomBytes.length) {randomBytes=crypto.randomBytes(32768);offset=0;}
            const n=randomBytes.readUInt32BE(offset)/4294967296;
            offset+=4;
            return n;
        };
        const rollItem=()=>{
            const roll=randomUnit()*chosen.total;
            let chosenRarity=chosen.table[chosen.table.length-1];
            for(const candidate of chosen.table) if(roll<candidate.threshold){chosenRarity=candidate;break;}
            return chosenRarity.pool[Math.floor(randomUnit()*chosenRarity.pool.length)];
        };
        for(let i=0;i<amount;i++) {
            const item=rollItem();
            const copyId=prefix+(number++).toString(36);
            const numbers=allocator.next(item.id);
            const copy={id:copyId,caseId:box.id,caseName:box.name,openingNumber:numbers.itemOpeningNumber,itemOpeningNumber:numbers.itemOpeningNumber,globalOpeningNumber:numbers.globalOpeningNumber,openingNumberExact:true,openedAt:at,openedBy:user.username,acquiredAt:at};
            let owned=collection.items[item.id];
            if(!owned){owned={id:item.id,itemId:item.id,name:item.name,rarity:item.rarity,icon:item.icon,color:item.color,caseId:box.id,caseName:box.name,quantity:0,instanceIds:[],copies:[],firstObtainedAt:at};collection.items[item.id]=owned;}
            if(!Array.isArray(owned.copies)) owned.copies=[];
            if(!Array.isArray(owned.instanceIds)) owned.instanceIds=[];
            owned.copies.push(copy);
            owned.instanceIds.push(copyId);
            owned.quantity=owned.copies.length;
            owned.lastObtainedAt=at;
            owned.firstObtainedAt=owned.firstObtainedAt||at;
            if(!summary[item.id]) summary[item.id]={itemId:item.id,name:item.name,rarity:item.rarity,icon:item.icon,color:item.color,quantity:0};
            summary[item.id].quantity++;
            if(i<maxResults||i>=amount-2000){
                const opening={id:`OPEN_${copyId}`,box:box.id,caseId:box.id,caseName:box.name,itemId:item.id,itemName:item.name,icon:item.icon,rarity:item.rarity,instanceId:copyId,copyId,openingNumber:numbers.itemOpeningNumber,itemOpeningNumber:numbers.itemOpeningNumber,globalOpeningNumber:numbers.globalOpeningNumber,openingNumberExact:true,openedAt:at,openedBy:user.username};
                if(i>=amount-2000) recent.push(opening);
                if(i<maxResults) results.push({opening,case:{id:box.id,name:box.name,icon:box.icon},item:{...item,caseId:box.id,caseName:box.name,secret:!!item.secret}});
            }
        }
        if(!collection.openedCounts || typeof collection.openedCounts!=="object") collection.openedCounts={};
        for(const [id,entry] of Object.entries(summary)) collection.openedCounts[id]=Math.max(0,Number(collection.openedCounts[id])||0)+entry.quantity;
        allocator.save();
        collection.openings=recent.reverse().concat(collection.openings||[]).slice(0,2000);
        halloweenSaveCollection(user.username,collection);
        markItemsDiscovered(user.username,Object.keys(summary),"case_open",at);
        const first=results[0]||null;
        logAction("cases_batch_opened",{username:user.username,caseId:box.id,amount,luck,items:Object.values(summary).map(item=>({itemId:item.itemId,quantity:item.quantity}))});
        res.json({success:true,amount,results,resultsReturned:results.length,resultsTruncated:results.length<amount,summary:Object.values(summary),opening:first?.opening||null,case:first?.case||{id:box.id,name:box.name,icon:box.icon},item:first?.item||null,collection:compactCollectionSummaries(collection.items),openingDelayMs:admin?100:CASE_OPEN_DELAY_MS,luck});
    } catch(err) {
        console.error("CASES OPEN ERROR",err);
        res.status(500).json({error:"server"});
    }
});

function selectionForCase(box,luck=1) {
    return halloweenSelectionTable(box,luck);
}

app.post("/cases/admin/luck",(req,res)=>{
    try {
        const user=auth(req);
        if(!user||!hasAdmin(user)) return res.status(403).json({error:"forbidden"});
        const wanted=Number(req.body?.luck);
        if(!Number.isFinite(wanted)||wanted<0.1||wanted>10) return res.status(400).json({error:"invalid_luck",min:0.1,max:10});
        const luck=Math.round(wanted*10)/10;
        const data=zyphorCaseLuckData();
        data.admins[user.username]=luck;
        data.updatedAt=new Date().toISOString();
        writeJson(ZYPHOR_CASE_ADMIN_LUCK_PATH,data);
        logAction("cases_admin_luck_changed",{username:user.username,luck});
        res.json({success:true,luck});
    } catch(err) {
        console.error("CASES LUCK ERROR",err);
        res.status(500).json({error:"server"});
    }
});

app.get("/collection/index",(req,res)=>{
    try {
        const user=auth(req);
        if(!user) return res.status(401).json({error:"unauthorized"});
        const collection=ensureCollectibleIds(user.username);
        const discoveries=loadDiscoveryIndex(user.username).discovered;
        const stats=collectibleOpenedStats();
        const items=discoveryCatalog().map((definition,index)=>{
            const held=collection.items[definition.id];
            const acquired=Object.prototype.hasOwnProperty.call(discoveries,definition.id);
            return {
                number:index+1,
                catalogNumber:`#${String(index+1).padStart(3,"0")}`,
                id:definition.id,caseId:definition.caseId,caseName:definition.caseName,event:definition.event,
                discovered:acquired,locked:!acquired,
                name:acquired?definition.name:"?",icon:acquired?definition.icon:"?",
                rarity:acquired?definition.rarity:"locked",color:acquired?definition.color:"#596071",
                secret:acquired?!!definition.secret:false,
                quantity:Math.max(0,Number(held?.quantity)||0),
                firstAcquiredAt:acquired?discoveries[definition.id]?.firstAcquiredAt||held?.firstObtainedAt||null:null,
                openedEverGlobally:acquired?Math.max(0,Number(stats[definition.id]?.opened)||0):null
            };
        });
        res.json({success:true,items,total:items.length,discovered:items.filter(item=>item.discovered).length,owned:items.filter(item=>item.quantity>0).length,series:[{id:"halloween-2026",name:"Halloween Event 2026"},{id:"zyphor-cases",name:"Zyphor Cases"}]});
    } catch(err) {
        console.error("COLLECTION INDEX ERROR",err);
        res.status(500).json({error:"server"});
    }
});

const HALLOWEEN_ITEM_CATALOG = new Map(ALL_COLLECTIBLE_ITEMS.map(item => [item.id, item]));

function invalidateCollectibleCopyIndexes(username) {
    const prefix = `${String(username || "")}:`;
    for (const key of COLLECTIBLE_COPY_INDEX_CACHE.keys()) {
        if (key.startsWith(prefix)) COLLECTIBLE_COPY_INDEX_CACHE.delete(key);
    }
}

function halloweenAdminLuck(username) {
    const data = readJson(HALLOWEEN_ADMIN_LUCK_PATH, {admins:{}});
    const luck = Number(data?.admins?.[username]);
    return Number.isFinite(luck) && luck >= 0.1 && luck <= 10 ? luck : 1;
}

function halloweenLuckData() {
    const data = readJson(HALLOWEEN_ADMIN_LUCK_PATH, {admins:{}});
    if (!data || typeof data !== "object" || !data.admins || typeof data.admins !== "object" || Array.isArray(data.admins)) return {admins:{}};
    return data;
}

function halloweenRarityChances(box, luck=1) {
    const safeLuck = Number.isFinite(Number(luck)) && Number(luck) >= 0.1 && Number(luck) <= 10 ? Number(luck) : 1;
    const adjusted = box.rarities.map(rarity => ({
        ...rarity,
        adjustedWeight:rarity.weight * Math.pow(safeLuck, (HALLOWEEN_RARITY_TIERS[rarity.id] || 0) / 5)
    }));
    const total = adjusted.reduce((sum, rarity) => sum + rarity.adjustedWeight, 0) || 1;
    return adjusted.map(rarity => ({id:rarity.id,name:rarity.name,chance:rarity.adjustedWeight / total}));
}

function halloweenEventWindow(nowMs=Date.now()) {
    const start = new Date(HALLOWEEN_2026_START).getTime();
    const end = new Date(HALLOWEEN_2026_END).getTime();
    return nowMs >= start && nowMs < end;
}

function halloweenAdminOrActive(user) {
    return !!user && (hasAdmin(user) || halloweenEventWindow());
}

function halloweenInventoryPath(username) {
    return path.join(ensureUserFolder(username), "Collections", "Items.json");
}

function dropHalloweenCollectionCache(key) {
    HALLOWEEN_COLLECTION_CACHE.delete(key);
    const timer = HALLOWEEN_COLLECTION_CACHE_TIMERS.get(key);
    if (timer) clearTimeout(timer);
    HALLOWEEN_COLLECTION_CACHE_TIMERS.delete(key);
}

function cacheHalloweenCollection(key, collection) {
    dropHalloweenCollectionCache(key);
    HALLOWEEN_COLLECTION_CACHE.set(key, collection);
    const timer = setTimeout(() => {
        if (HALLOWEEN_COLLECTION_CACHE.get(key) === collection) HALLOWEEN_COLLECTION_CACHE.delete(key);
        HALLOWEEN_COLLECTION_CACHE_TIMERS.delete(key);
    }, HALLOWEEN_COLLECTION_CACHE_TTL_MS);
    if (typeof timer.unref === "function") timer.unref();
    HALLOWEEN_COLLECTION_CACHE_TIMERS.set(key, timer);
    while (HALLOWEEN_COLLECTION_CACHE.size > HALLOWEEN_COLLECTION_CACHE_LIMIT) {
        const oldest = HALLOWEEN_COLLECTION_CACHE.keys().next().value;
        dropHalloweenCollectionCache(oldest);
    }
    return collection;
}

function halloweenCollectionData(username) {
    const key = String(username || "");
    if (HALLOWEEN_COLLECTION_CACHE.has(key)) return cacheHalloweenCollection(key, HALLOWEEN_COLLECTION_CACHE.get(key));
    const data = readJson(halloweenInventoryPath(key), { items:{}, boxes:{}, openings:[] });
    const collection = data && typeof data === "object" ? data : { items:{}, boxes:{}, openings:[] };
    if (!collection.items || typeof collection.items !== "object" || Array.isArray(collection.items)) collection.items = {};
    if (!collection.boxes || typeof collection.boxes !== "object" || Array.isArray(collection.boxes)) collection.boxes = {};
    if (!Array.isArray(collection.openings)) collection.openings = [];
    return cacheHalloweenCollection(key, collection);
}

function collectionStatsContribution(collection) {
    const contribution = { owned:new Map(), opened:new Map() };
    for (const [itemId, item] of Object.entries(collection?.items || {})) {
        const quantity = Math.max(0, Number(item?.quantity ?? item?.copies?.length) || 0);
        if (quantity) contribution.owned.set(itemId, quantity);
    }
    const lifetime = collection?.openedCounts && typeof collection.openedCounts === "object" && !Array.isArray(collection.openedCounts) ? collection.openedCounts : {};
    if (Object.keys(lifetime).length) {
        for (const [itemId, amount] of Object.entries(lifetime)) {
            const count = Math.max(0, Number(amount) || 0);
            if (count) contribution.opened.set(itemId, count);
        }
    } else {
        for (const opening of Array.isArray(collection?.openings) ? collection.openings : []) {
            if (!opening?.itemId) continue;
            contribution.opened.set(opening.itemId, (contribution.opened.get(opening.itemId) || 0) + 1);
        }
    }
    return contribution;
}

function adjustCollectibleStats(contribution, amount) {
    if (!COLLECTIBLE_STATS_CACHE || !contribution) return;
    adjustStatsObject(COLLECTIBLE_STATS_CACHE, {
        owned:new Map([...contribution.owned].map(([itemId, quantity]) => [itemId, quantity * amount])),
        opened:new Map([...contribution.opened].map(([itemId, quantity]) => [itemId, quantity * amount]))
    });
    for (const stat of Object.values(COLLECTIBLE_STATS_CACHE)) {
        stat.owned = Math.max(0, Number(stat.owned) || 0);
        stat.opened = Math.max(0, Number(stat.opened) || 0);
    }
}

function halloweenSaveCollection(username, data) {
    const key = String(username || "");
    if (!data || typeof data !== "object") return;
    if (!data.items || typeof data.items !== "object" || Array.isArray(data.items)) data.items = {};
    if (!data.boxes || typeof data.boxes !== "object" || Array.isArray(data.boxes)) data.boxes = {};
    if (!Array.isArray(data.openings)) data.openings = [];
    const file = halloweenInventoryPath(key);
    let previousContribution = null;
    let statsReady = !COLLECTIBLE_STATS_BUILDING && !!COLLECTIBLE_STATS_CACHE;
    if (!statsReady && !COLLECTIBLE_STATS_BUILDING && fs.existsSync(COLLECTIBLE_STATS_PATH)) {
        const stored = readJson(COLLECTIBLE_STATS_PATH, null);
        if (stored && stored.schemaVersion === 1 && stored.items && typeof stored.items === "object" && !Array.isArray(stored.items)) {
            COLLECTIBLE_STATS_CACHE = stored.items;
            statsReady = true;
        }
    }
    if (statsReady) previousContribution = collectionStatsContribution(readJson(file, { items:{}, boxes:{}, openings:[] }));
    writeCompactJson(file, data);
    cacheHalloweenCollection(key, data);
    invalidateCollectibleCopyIndexes(key);
    if (statsReady && COLLECTIBLE_STATS_CACHE) {
        adjustCollectibleStats(previousContribution || { owned:new Map(), opened:new Map() }, -1);
        adjustCollectibleStats(collectionStatsContribution(data), 1);
        writeCompactJson(COLLECTIBLE_STATS_PATH, { schemaVersion:1, updatedAt:new Date().toISOString(), items:COLLECTIBLE_STATS_CACHE });
    }
}

function halloweenGiveBadge(username, badgeName) {
    const badges = ensureUserBadges(username);
    if (!badges[badgeName]) return;
    let changed = false;
    if (BADGE_DEFINITIONS[badgeName] && badges[badgeName].description !== BADGE_DEFINITIONS[badgeName].description) {
        badges[badgeName].description = BADGE_DEFINITIONS[badgeName].description;
        changed = true;
    }
    if (badges[badgeName].earned !== true || Number(badges[badgeName].current || 0) < 1) {
        badges[badgeName].current = 1;
        badges[badgeName].earned = true;
        changed = true;
    }
    if (changed) fs.writeFileSync(path.join("Users", username, "Badges.json"), JSON.stringify(badges));
}

function halloweenHasOctoberActivity(user) {
    if (!user || !user.username) return false;
    const start = new Date(HALLOWEEN_2026_START).getTime();
    const end = new Date(HALLOWEEN_2026_END).getTime();
    const inWindow = value => {
        const stamp = new Date(value || 0).getTime();
        return Number.isFinite(stamp) && stamp >= start && stamp < end;
    };
    if (inWindow(user.lastActiveAt) || inWindow(user.halloween2026ActivityAt)) return true;
    const history = Array.isArray(user.loginHistory) ? user.loginHistory : loadLoginHistory(user.username);
    return history.some(entry => inWindow(entry?.date || entry?.timestamp || entry?.time));
}

function halloweenAwardParticipationForHistoricalActivity(user) {
    if (halloweenHasOctoberActivity(user)) halloweenGiveBadge(user.username, "Play During Halloween 2026");
}

function halloweenSyncActivity(user) {
    if (!user || !halloweenAdminOrActive(user)) return false;
    if (!user.halloween2026ActivityAt) {
        const users = loadUsers();
        const record = users[user.username] || user;
        record.halloween2026ActivityAt = new Date().toISOString();
        users[user.username] = record;
        user.halloween2026ActivityAt = record.halloween2026ActivityAt;
        saveUsers(users);
    }
    halloweenGiveBadge(user.username, "Play During Halloween 2026");
    return true;
}

function createOpeningNumberAllocator() {
    let counter = readJson(GLOBAL_OPENING_COUNTER_PATH, { current:0, byItem:{} });
    const currentCounterIsValid = !!counter.updatedAt && Number.isSafeInteger(Number(counter.current)) && Number(counter.current) >= 0 && counter.byItem && typeof counter.byItem === "object" && !Array.isArray(counter.byItem);
    if (!currentCounterIsValid) {
        synchronizeGlobalOpeningCounter();
        counter = readJson(GLOBAL_OPENING_COUNTER_PATH, { current:0, byItem:{} });
    }
    let current = Number.isSafeInteger(Number(counter.current)) && Number(counter.current) > 0 ? Number(counter.current) : 0;
    const sourceByItem = counter.byItem && typeof counter.byItem === "object" && !Array.isArray(counter.byItem) ? counter.byItem : {};
    const byItem = Object.create(null);
    for (const [itemId, value] of Object.entries(sourceByItem)) {
        const number = Number(value);
        if (Number.isSafeInteger(number) && number > 0) byItem[itemId] = number;
    }
    let dirty = false;
    return {
        next(itemId) {
            current += 1;
            const itemOpeningNumber = (byItem[itemId] || 0) + 1;
            byItem[itemId] = itemOpeningNumber;
            dirty = true;
            return { globalOpeningNumber:current, itemOpeningNumber };
        },
        save() {
            if (!dirty) return;
            const file = GLOBAL_OPENING_COUNTER_PATH;
            fs.mkdirSync(path.dirname(file), { recursive:true });
            const temp = file + ".tmp";
            fs.writeFileSync(temp, JSON.stringify({ current, byItem, updatedAt:new Date().toISOString() }));
            fs.renameSync(temp, file);
            dirty = false;
        }
    };
}

function synchronizeGlobalOpeningCounter() {
    const counter = readJson(GLOBAL_OPENING_COUNTER_PATH, { current:0, byItem:{} });
    const counterCurrent = Number(counter.current);
    const counterByItem = counter.byItem;
    if (counter.updatedAt && Number.isSafeInteger(counterCurrent) && counterCurrent >= 0 && counterByItem && typeof counterByItem === "object" && !Array.isArray(counterByItem)) return counterCurrent;
    let maximum = Number.isSafeInteger(counterCurrent) && counterCurrent > 0 ? counterCurrent : 0;
    const byItem = counter.byItem && typeof counter.byItem === "object" && !Array.isArray(counter.byItem) ? { ...counter.byItem } : {};
    const users = loadUsers();
    const lifetimeCounts = {};
    const track = (itemId, globalValue, itemValue) => {
        const globalNumber = Number(globalValue);
        const itemNumber = Number(itemValue);
        if (Number.isSafeInteger(globalNumber) && globalNumber > maximum) maximum = globalNumber;
        if (itemId && Number.isSafeInteger(itemNumber) && itemNumber > Number(byItem[itemId] || 0)) byItem[itemId] = itemNumber;
    };
    for (const user of Object.values(users)) {
        if (!user?.username) continue;
        const collection = halloweenCollectionData(user.username);
        for (const [itemId, count] of Object.entries(collection.openedCounts || {})) {
            lifetimeCounts[itemId] = Math.max(0, Number(lifetimeCounts[itemId]) || 0) + Math.max(0, Number(count) || 0);
        }
        for (const opening of Array.isArray(collection.openings) ? collection.openings : []) {
            track(opening?.itemId, opening?.globalOpeningNumber, opening?.itemOpeningNumber ?? opening?.openingNumber);
        }
        for (const [itemId, item] of Object.entries(collection.items || {})) {
            for (const copy of Array.isArray(item?.copies) ? item.copies : []) {
                track(itemId, copy?.globalOpeningNumber, copy?.itemOpeningNumber ?? copy?.openingNumber);
            }
        }
    }
    for (const [itemId, count] of Object.entries(lifetimeCounts)) {
        if (count > Number(byItem[itemId] || 0)) byItem[itemId] = count;
    }
    if (maximum !== Number(counter.current || 0) || JSON.stringify(byItem) !== JSON.stringify(counter.byItem || {})) {
        writeJson(GLOBAL_OPENING_COUNTER_PATH, { current:maximum, byItem, updatedAt:new Date().toISOString() });
    }
    return maximum;
}

const HALLOWEEN_SELECTION_CACHE = new Map();
const HALLOWEEN_SELECTION_CACHE_LIMIT = 32;

function halloweenSelectionTable(box, luck=1) {
    const safeLuck = Number.isFinite(Number(luck)) && Number(luck) >= 0.1 && Number(luck) <= 10 ? Number(luck) : 1;
    const key = `${box.id}:${safeLuck}`;
    if (HALLOWEEN_SELECTION_CACHE.has(key)) {
        const cached = HALLOWEEN_SELECTION_CACHE.get(key);
        HALLOWEEN_SELECTION_CACHE.delete(key);
        HALLOWEEN_SELECTION_CACHE.set(key, cached);
        return cached;
    }
    let total = 0;
    const table = box.rarities.map(rarity => {
        const weight = rarity.weight * Math.pow(safeLuck, (HALLOWEEN_RARITY_TIERS[rarity.id] || 0) / 5);
        total += weight;
        return { id:rarity.id, weight, threshold:total, pool:box.items.filter(item => item.rarity === rarity.id) };
    }).filter(entry => entry.pool.length > 0);
    const result = { total, table };
    HALLOWEEN_SELECTION_CACHE.set(key, result);
    while (HALLOWEEN_SELECTION_CACHE.size > HALLOWEEN_SELECTION_CACHE_LIMIT) HALLOWEEN_SELECTION_CACHE.delete(HALLOWEEN_SELECTION_CACHE.keys().next().value);
    return result;
}

function halloweenWeightedRarity(box, luck=1) {
    const selection = halloweenSelectionTable(box, luck);
    const roll = (crypto.randomInt(0, 1000000) / 1000000) * selection.total;
    return selection.table.find(rarity => roll < rarity.threshold) || selection.table[selection.table.length - 1];
}

function halloweenChooseItem(box, luck=1) {
    const rarity = halloweenWeightedRarity(box, luck);
    return rarity.pool[crypto.randomInt(0, rarity.pool.length)];
}

app.get("/events/halloween-2026", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ error:"unauthorized" });
        const admin = hasAdmin(user);
        const active = halloweenAdminOrActive(user);
        const luck = admin ? halloweenAdminLuck(user.username) : 1;
        halloweenAwardParticipationForHistoricalActivity(user);
        if (active && halloweenEventWindow()) halloweenSyncActivity(user);
        const data = ensureCollectibleIds(user.username);
        const cases = HALLOWEEN_CASES.map(box => ({
            id:box.id,
            name:box.name,
            icon:box.icon,
            description:box.description,
            badgeEligible:box.badgeEligible,
            secretChance:(halloweenRarityChances(box,luck).find(r => r.id === "secret") || {chance:0}).chance,
            rarities:halloweenRarityChances(box,luck),
            items:box.items.map(item => ({...item,caseId:box.id,caseName:box.name,secret:!!item.secret}))
        }));
        res.json({
            event:"Halloween Event 2026",
            active,
            admin,
            canEditLuck:admin,
            luck,
            minLuck:0.1,
            maxLuck:10,
            startsAt:HALLOWEEN_2026_START,
            endsAt:HALLOWEEN_2026_END,
            boxCost:HALLOWEEN_BOX_COST,
            openingDelayMs:HALLOWEEN_OPEN_DELAY_MS,
            secretChance:0.0003,
            cases,
            rarities:cases[0].rarities,
            items:HALLOWEEN_ITEMS.map(item => ({...item,secret:!!item.secret})),
            boxes:Number(data.boxes[HALLOWEEN_BOX_KEY] || 0),
            collection:compactCollectionSummaries(data.items),
            canOpen:active
        });
    } catch (err) {
        console.error("HALLOWEEN EVENT STATUS ERROR:", err);
        res.status(500).json({ error:"server" });
    }
});

app.post("/events/halloween-2026/open", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ error:"unauthorized" });
        const admin = hasAdmin(user);
        if (!halloweenAdminOrActive(user)) return res.status(403).json({ error:"event_not_active", startsAt:HALLOWEEN_2026_START, endsAt:HALLOWEEN_2026_END });
        const caseId = String(req.body?.caseId || HALLOWEEN_CASES[0].id);
        const box = HALLOWEEN_CASES.find(entry => entry.id === caseId);
        if (!box) return res.status(400).json({ error:"invalid_case" });
        const requestedAmount = req.body?.amount === undefined ? 1 : Number(req.body.amount);
        const maxAmount = admin ? 1000000 : 1;
        if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1 || requestedAmount > maxAmount) {
            return res.status(400).json({ error:"invalid_amount", min:1, max:maxAmount });
        }
        const amount = requestedAmount;
        const nowMs = Date.now();
        const previousOpen = halloweenOpeningCooldowns.get(user.username) || 0;
        if (!admin && nowMs - previousOpen < HALLOWEEN_OPEN_DELAY_MS) {
            return res.status(429).json({ error:"opening_cooldown", retryAfterMs:HALLOWEEN_OPEN_DELAY_MS - (nowMs - previousOpen) });
        }
        halloweenOpeningCooldowns.set(user.username, nowMs);
        const luck = admin ? halloweenAdminLuck(user.username) : 1;
        const data = ensureCollectibleIds(user.username);
        const resultLimit = Math.min(amount, admin ? 10000 : 1);
        const results = [];
        const summary = Object.create(null);
        const openingHistory = [];
        let foundSecret = false;
        const allocator = createOpeningNumberAllocator();
        const selection = halloweenSelectionTable(box, luck);
        const batchCopyPrefix = `COL_${crypto.randomBytes(12).toString("hex")}_`;
        const batchOpenedAt = new Date().toISOString();
        let batchCopyNumber = 0;
        let randomBuffer = Buffer.alloc(0);
        let randomOffset = 0;
        const refillRandomBuffer = () => {
            const remaining = Math.max(16, Math.min(65536, (amount * 8) - (indexRandomBytesUsed || 0)));
            randomBuffer = crypto.randomBytes(remaining);
            randomOffset = 0;
        };
        let indexRandomBytesUsed = 0;
        const nextRandomUnit = () => {
            if (randomOffset + 4 > randomBuffer.length) refillRandomBuffer();
            const value = randomBuffer.readUInt32BE(randomOffset);
            randomOffset += 4;
            indexRandomBytesUsed += 4;
            return value / 4294967296;
        };
        const chooseBatchItem = () => {
            const roll = nextRandomUnit() * selection.total;
            let selected = selection.table[selection.table.length - 1];
            for (const rarity of selection.table) {
                if (roll < rarity.threshold) {
                    selected = rarity;
                    break;
                }
            }
            return selected.pool[Math.floor(nextRandomUnit() * selected.pool.length)];
        };
        const getBatchCopyId = () => `${batchCopyPrefix}${(batchCopyNumber++).toString(36)}`;
        for (let index = 0; index < amount; index++) {
            const item = chooseBatchItem();
            const nowIso = batchOpenedAt;
            const copyId = getBatchCopyId();
            const numbers = allocator.next(item.id);
            const itemOpeningNumber = numbers.itemOpeningNumber;
            const globalOpeningNumber = numbers.globalOpeningNumber;
            const copy = {
                id:copyId,
                caseId:box.id,
                caseName:box.name,
                openingNumber:itemOpeningNumber,
                itemOpeningNumber,
                globalOpeningNumber,
                openingNumberExact:true,
                openedAt:nowIso,
                openedBy:user.username,
                acquiredAt:nowIso
            };
            let owned = data.items[item.id];
            if (!owned) {
                owned = { id:item.id, itemId:item.id, name:item.name, rarity:item.rarity, icon:item.icon, color:item.color, caseId:box.id, caseName:box.name, quantity:0, instanceIds:[], copies:[], firstObtainedAt:null };
                data.items[item.id] = owned;
            }
            owned.caseId = box.id;
            owned.caseName = box.name;
            if (!Array.isArray(owned.instanceIds)) owned.instanceIds = [];
            if (!Array.isArray(owned.copies)) owned.copies = [];
            owned.instanceIds.push(copyId);
            owned.copies.push(copy);
            owned.quantity = (Number(owned.quantity) || 0) + 1;
            owned.firstObtainedAt = owned.firstObtainedAt || nowIso;
            owned.lastObtainedAt = nowIso;
            let opening = null;
            const needsResult = index < resultLimit;
            const needsHistory = index >= Math.max(0, amount - 2000);
            if (needsResult || needsHistory) {
                opening = { id:`OPEN_${copyId}`, box:box.id, caseId:box.id, caseName:box.name, itemId:item.id, itemName:item.name, icon:item.icon, rarity:item.rarity, instanceId:copyId, copyId, openingNumber:itemOpeningNumber, itemOpeningNumber, globalOpeningNumber, openingNumberExact:true, openedAt:nowIso, openedBy:user.username };
            }
            if (needsHistory) openingHistory.push(opening);
            if (!summary[item.id]) summary[item.id] = { itemId:item.id, name:item.name, rarity:item.rarity, icon:item.icon, color:item.color, quantity:0 };
            summary[item.id].quantity += 1;
            if (needsResult) results.push({ opening, case:{ id:box.id, name:box.name, icon:box.icon }, item:{ id:item.id, name:item.name, rarity:item.rarity, icon:item.icon, color:item.color, caseId:box.id, caseName:box.name, secret:!!item.secret } });
            if (item.secret) foundSecret = true;
        }
        for (const [itemId, itemSummary] of Object.entries(summary)) {
            data.openedCounts[itemId] = Math.max(0, Number(data.openedCounts?.[itemId]) || 0) + itemSummary.quantity;
        }
        allocator.save();
        const newestOpenings = openingHistory.reverse();
        data.openings = newestOpenings.concat(data.openings).slice(0, 2000);
        halloweenSaveCollection(user.username, data);
        markItemsDiscovered(user.username,Object.keys(summary),"halloween_open",batchOpenedAt);
        if (foundSecret) halloweenGiveBadge(user.username, "Find the Secret Halloween Item 2026");
        halloweenSyncActivity(user);
        const firstResult = results[0] || null;
        logAction("halloween_box_batch_opened", { username:user.username, caseId:box.id, amount, luck, items:Object.values(summary).map(item => ({ itemId:item.itemId, quantity:item.quantity, rarity:item.rarity })) });
        const compactCollection = compactCollectionSummaries(data.items);
        res.json({
            success:true,
            amount,
            results,
            resultsReturned:results.length,
            resultsTruncated:amount > results.length,
            summary:Object.values(summary),
            opening:firstResult?.opening || null,
            case:firstResult?.case || { id:box.id, name:box.name, icon:box.icon },
            item:firstResult?.item || null,
            boxes:Number(data.boxes[HALLOWEEN_BOX_KEY] || 0),
            collection:compactCollection,
            openingDelayMs:admin ? 100 : HALLOWEEN_OPEN_DELAY_MS,
            luck
        });
    } catch (err) {
        console.error("HALLOWEEN BOX OPEN ERROR:", err);
        res.status(500).json({ error:"server" });
    }
});

app.post("/events/halloween-2026/admin/luck", (req, res) => {
    try {
        const user = auth(req);
        if (!user || !hasAdmin(user)) return res.status(403).json({ error:"forbidden" });
        const requested = Number(req.body?.luck);
        if (!Number.isFinite(requested) || requested < 0.1 || requested > 10) return res.status(400).json({ error:"invalid_luck", min:0.1, max:10 });
        const luck = Math.round(requested * 10) / 10;
        const data = halloweenLuckData();
        data.admins[user.username] = luck;
        data.updatedAt = new Date().toISOString();
        writeJson(HALLOWEEN_ADMIN_LUCK_PATH, data);
        logAction("halloween_admin_luck_changed", { username:user.username, luck });
        res.json({ success:true, luck });
    } catch (err) {
        console.error("HALLOWEEN ADMIN LUCK ERROR:", err);
        res.status(500).json({ error:"server" });
    }
});

function compactCollectionSummary(itemId, item) {
    return {
        id:item.id || itemId,
        itemId:item.itemId || item.id || itemId,
        name:item.name || itemId,
        rarity:item.rarity || "unknown",
        icon:item.icon || "📦",
        color:item.color || "#a1a1aa",
        caseId:item.caseId || null,
        caseName:item.caseName || null,
        quantity:Math.max(0, Number(item.quantity ?? item.copies?.length) || 0),
        firstObtainedAt:item.firstObtainedAt || null,
        lastObtainedAt:item.lastObtainedAt || null
    };
}

function compactCollectionSummaries(items) {
    const summaries = {};
    for (const [itemId, item] of Object.entries(items || {})) summaries[itemId] = compactCollectionSummary(itemId, item);
    return summaries;
}

function collectionResponseItem(item, includeHistory=false) {
    const result = { ...item };
    if (Array.isArray(item?.copies)) {
        result.copies = item.copies.map(copy => {
            if (includeHistory) {
                if (Array.isArray(copy?.ownershipHistory) && copy.ownershipHistory.length) return copy;
                const ownershipHistory = copy?.openedBy ? [{ username:copy.openedBy, event:"opened", acquiredAt:copy.openedAt || copy.acquiredAt || null }] : [];
                return { ...copy, ownershipHistory };
            }
            const { ownershipHistory, ...compact } = copy || {};
            return compact;
        });
    }
    return result;
}

app.get("/collection", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ error:"unauthorized" });
        const data = ensureCollectibleIds(user.username);
        const stats = collectibleOpenedStats();
        const compact = String(req.query?.compact || "") === "1";
        const includeHistory = String(req.query?.details || "") === "1";
        const requestedItemId = String(req.query?.itemId || "");
        const offsetRaw = Number(req.query?.offset ?? 0);
        const limitRaw = Number(req.query?.limit ?? 250);
        const offset = Number.isSafeInteger(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
        const limit = Number.isSafeInteger(limitRaw) ? Math.min(5000, Math.max(1, limitRaw)) : 250;
        let entries = Object.entries(data.items);
        if (requestedItemId) entries = entries.filter(([itemId, item]) => itemId === requestedItemId || item?.itemId === requestedItemId || item?.id === requestedItemId);
        let items;
        let pagination = null;
        if (compact) {
            items = Object.fromEntries(entries.map(([itemId,item]) => [itemId, { ...compactCollectionSummary(itemId, item), openedEver:stats[itemId]?.opened || 0 }]));
        } else if (requestedItemId) {
            const total = entries.length ? Math.max(0, Number(entries[0][1]?.quantity) || 0) : 0;
            items = Object.fromEntries(entries.map(([itemId,item]) => {
                const copies = Array.isArray(item.copies) ? item.copies.slice(offset, offset + limit) : [];
                const page = { ...collectionResponseItem({ ...item, copies, instanceIds:copies.map(copy => copy.id) }, includeHistory), openedEver:stats[itemId]?.opened || 0 };
                return [itemId, page];
            }));
            pagination = { itemId:requestedItemId, offset, limit, total, hasMore:offset + limit < total };
        } else {
            items = Object.fromEntries(entries.map(([itemId,item]) => [itemId, { ...collectionResponseItem(item, includeHistory), openedEver:stats[itemId]?.opened || 0 }]));
        }
        res.json({ items, boxes:data.boxes, openings:data.openings, availableBoxes:[...HALLOWEEN_CASES.map(box => ({id:box.id,name:box.name,icon:box.icon,event:"Halloween Event 2026",count:Number(data.boxes[HALLOWEEN_BOX_KEY] || 0)})),...ZYPHOR_CASES.map(box=>({id:box.id,name:box.name,icon:box.icon,event:"Zyphor Cases",count:Infinity}))], ...(pagination ? { pagination } : {}) });
    } catch (err) {
        console.error("COLLECTION ERROR:", err);
        res.status(500).json({ error:"server" });
    }
});

app.post("/events/halloween-2026/admin/grant-boxes", (req, res) => {
    try {
        const user = auth(req);
        if (!user || !hasAdmin(user)) return res.sendStatus(403);
        const username = safeUsername(req.body?.username);
        const amount = Number(req.body?.amount);
        if (!username || !Number.isInteger(amount) || amount < 1 || amount > 1000) return res.status(400).json({ error:"invalid_input" });
        const users = loadUsers();
        if (!resolveUserRecord(users, username)) return res.status(404).json({ error:"user_not_found" });
        const collection = halloweenCollectionData(username);
        collection.boxes[HALLOWEEN_BOX_KEY] = Math.max(0, Number(collection.boxes[HALLOWEEN_BOX_KEY] || 0)) + amount;
        halloweenSaveCollection(username, collection);
        res.json({ success:true, username, boxes:collection.boxes[HALLOWEEN_BOX_KEY] });
    } catch (err) {
        console.error("HALLOWEEN BOX GRANT ERROR:", err);
        res.status(500).json({ error:"server" });
    }
});


const TRADE_ROOT = path.join(__dirname, "Trades");
const TRADE_DB_PATH = path.join(TRADE_ROOT, "Trades.json");
const TRADE_HISTORY_PATH = path.join(TRADE_ROOT, "History.json");
const TRADE_CONFIRM_MS = 10000;

let TRADE_DB_CACHE = null;
let TRADE_DB_BY_ID = new Map();
let TRADE_ACTIVE_CACHE = [];
let TRADE_HISTORY_CACHE = null;
let TRADE_HISTORY_COMPACTED = false;

function ensureTradeStorage() {
    fs.mkdirSync(TRADE_ROOT, { recursive: true });
    if (!fs.existsSync(TRADE_DB_PATH)) writeJson(TRADE_DB_PATH, { trades: [] });
    if (!fs.existsSync(TRADE_HISTORY_PATH)) writeJson(TRADE_HISTORY_PATH, { trades: [] });
}

function compactTradeSide(side) {
    if (!side || typeof side !== "object") return side;
    return {
        ...side,
        items:Array.isArray(side.items) ? side.items.map(item => ({ itemId:String(item?.itemId || ""), quantity:Math.max(0, Number(item?.quantity) || 0) })) : []
    };
}

function compactTransferredCopies(value) {
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const direction of ["from", "to"]) {
        result[direction] = Array.isArray(value[direction]) ? value[direction].map(item => ({ itemId:String(item?.itemId || ""), quantity:Math.max(0, Number(item?.quantity) || 0) })) : [];
    }
    return result;
}

function compactTradeHistoryEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    return {
        ...entry,
        offered:compactTradeSide(entry.offered),
        requested:compactTradeSide(entry.requested),
        ...(entry.transferredCopies ? { transferredCopies:compactTransferredCopies(entry.transferredCopies) } : {})
    };
}

function writeCompactJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive:true });
    const temp = file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, file);
}

function loadTradeDb() {
    ensureTradeStorage();
    if (TRADE_DB_CACHE) return TRADE_DB_CACHE;
    const data = readJson(TRADE_DB_PATH, { trades: [] });
    if (!Array.isArray(data.trades)) data.trades = [];
    let compacted = false;
    const sideHasCopyIds = side => Array.isArray(side?.items) && side.items.some(item => Array.isArray(item?.copyIds));
    const transferHasCopyIds = value => ["from", "to"].some(direction => Array.isArray(value?.[direction]) && value[direction].some(item => Array.isArray(item?.copyIds)));
    for (const trade of data.trades) {
        if (!trade || ["pending", "confirming"].includes(trade.status)) continue;
        if (sideHasCopyIds(trade.offered)) {
            trade.offered = compactTradeSide(trade.offered);
            compacted = true;
        }
        if (sideHasCopyIds(trade.requested)) {
            trade.requested = compactTradeSide(trade.requested);
            compacted = true;
        }
        if (trade.transferredCopies && transferHasCopyIds(trade.transferredCopies)) {
            trade.transferredCopies = compactTransferredCopies(trade.transferredCopies);
            compacted = true;
        }
    }
    if (compacted) writeCompactJson(TRADE_DB_PATH, data);
    TRADE_DB_CACHE = data;
    rebuildTradeIndexes(data);
    return TRADE_DB_CACHE;
}

function rebuildTradeIndexes(data = TRADE_DB_CACHE) {
    const trades = Array.isArray(data?.trades) ? data.trades : [];
    TRADE_DB_BY_ID = new Map();
    TRADE_ACTIVE_CACHE = [];
    for (const trade of trades) {
        if (!trade) continue;
        if (trade.id) TRADE_DB_BY_ID.set(trade.id, trade);
        if (["pending", "confirming"].includes(trade.status)) TRADE_ACTIVE_CACHE.push(trade);
    }
}

function saveTradeDb(data) {
    if (!data || typeof data !== "object") data = { trades:[] };
    if (!Array.isArray(data.trades)) data.trades = [];
    TRADE_DB_CACHE = data;
    rebuildTradeIndexes(data);
    writeCompactJson(TRADE_DB_PATH, data);
}

function loadTradeHistory() {
    ensureTradeStorage();
    if (TRADE_HISTORY_CACHE) return TRADE_HISTORY_CACHE;
    const data = readJson(TRADE_HISTORY_PATH, { trades: [] });
    if (!Array.isArray(data.trades)) data.trades = [];
    TRADE_HISTORY_CACHE = data;
    return TRADE_HISTORY_CACHE;
}

function appendTradeHistory(entry) {
    const history = loadTradeHistory();
    if (!TRADE_HISTORY_COMPACTED) {
        history.trades = history.trades.map(compactTradeHistoryEntry);
        TRADE_HISTORY_COMPACTED = true;
    }
    history.trades.unshift(compactTradeHistoryEntry(entry));
    if (history.trades.length > 10000) history.trades.length = 10000;
    writeCompactJson(TRADE_HISTORY_PATH, history);
}

function tradeRandomId(prefix) {
    return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

const COLLECTIBLE_INSTANCE_IDS = new Set();

const COLLECTIBLE_INSTANCE_IDS_LIMIT = 4096;

function uniqueCollectibleInstanceId() {
    let id;
    do { id = tradeRandomId("COL"); } while (COLLECTIBLE_INSTANCE_IDS.has(id));
    COLLECTIBLE_INSTANCE_IDS.add(id);
    while (COLLECTIBLE_INSTANCE_IDS.size > COLLECTIBLE_INSTANCE_IDS_LIMIT) COLLECTIBLE_INSTANCE_IDS.delete(COLLECTIBLE_INSTANCE_IDS.values().next().value);
    return id;
}

function tradePublicView(trade, viewer) {
    return {
        id: trade.id,
        from: trade.from,
        to: trade.to,
        offered: compactTradeSide(trade.offered),
        requested: compactTradeSide(trade.requested),
        status: trade.status,
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt,
        expiresAt: trade.expiresAt || null,
        confirmUntil: trade.confirmUntil || null,
        acceptedBy: trade.acceptedBy || [],
        declinedBy: trade.declinedBy || null,
        outcome: trade.outcome || null,
        viewerIsSender: viewer === trade.from,
        canAccept: trade.status === "pending" && viewer === trade.to,
        canConfirm: trade.status === "confirming" && (viewer === trade.from || viewer === trade.to),
        canDecline: ["pending", "confirming"].includes(trade.status) && (viewer === trade.from || viewer === trade.to)
    };
}

function tradeNumber(value, max=1000000000) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}

function tradeItemCatalog() {
    return HALLOWEEN_ITEM_CATALOG;
}

function ensureCollectibleIds(username) {
    const key = String(username || "");
    const collection = halloweenCollectionData(key);
    if (COLLECTIBLES_NORMALIZED_USERS.has(key)) return collection;
    const catalog = HALLOWEEN_ITEM_CATALOG;
    const collectionSeenIds = new Set();
    let changed = false;
    if (!collection.openedCounts || typeof collection.openedCounts !== "object" || Array.isArray(collection.openedCounts)) {
        collection.openedCounts = {};
        changed = true;
    }
    if (!collection.openingCountsMigrated) {
        const recordedCounts = {};
        for (const opening of collection.openings || []) {
            if (!opening?.itemId) continue;
            recordedCounts[opening.itemId] = (recordedCounts[opening.itemId] || 0) + 1;
        }
        for (const [itemId, count] of Object.entries(recordedCounts)) {
            const previous = Math.max(0, Number(collection.openedCounts[itemId]) || 0);
            const next = Math.max(previous, count);
            if (next !== previous) collection.openedCounts[itemId] = next;
        }
        collection.openingCountsMigrated = true;
        changed = true;
    }
    for (const [itemId, raw] of Object.entries(collection.items)) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            delete collection.items[itemId];
            changed = true;
            continue;
        }
        const definition = catalog.get(itemId) || {};
        const existingCopies = Array.isArray(raw.copies) ? raw.copies : [];
        const hadCopiesArray = Array.isArray(raw.copies);
        const originalIds = Array.isArray(raw.instanceIds) ? raw.instanceIds : null;
        const existingIds = originalIds || [];
        const hadIdsArray = !!originalIds;
        const copyIds = existingIds.length ? existingIds : existingCopies.map(copy => String(copy?.id || copy?.instanceId || copy?.copyId || ""));
        const quantity = Math.max(0, Math.floor(Number(raw.quantity) || 0), copyIds.length, existingCopies.length);
        if (!hadCopiesArray || !hadIdsArray || existingCopies.length !== quantity || existingIds.length !== quantity || Number(raw.quantity) !== quantity) changed = true;
        while (copyIds.length < quantity) copyIds.push("");
        let copiesAligned = existingCopies.length === quantity && copyIds.length === quantity;
        if (copiesAligned) {
            for (let index = 0; index < quantity; index++) {
                const copy = existingCopies[index];
                const existingId = String(copy?.id || copy?.instanceId || copy?.copyId || "");
                if (String(copyIds[index] || "") !== existingId) {
                    copiesAligned = false;
                    break;
                }
            }
        }
        const copiesById = copiesAligned ? null : new Map();
        if (copiesById) {
            for (const copy of existingCopies) {
                if (!copy || typeof copy !== "object") continue;
                const copyId = String(copy.id || copy.instanceId || copy.copyId || "");
                if (copyId && !copiesById.has(copyId)) copiesById.set(copyId, copy);
            }
        }
        const copies = new Array(quantity);
        const numberValue = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
        for (let index = 0; index < quantity; index++) {
            const indexed = existingCopies[index];
            const matching = copiesAligned ? indexed : (copyIds[index] ? copiesById.get(String(copyIds[index])) : null);
            const prior = matching || (indexed && !indexed.id && !indexed.instanceId ? indexed : {});
            let id = String(copyIds[index] || prior?.id || prior?.instanceId || prior?.copyId || "");
            if (!id || collectionSeenIds.has(id)) {
                id = uniqueCollectibleInstanceId();
                changed = true;
            }
            while (collectionSeenIds.has(id)) {
                id = uniqueCollectibleInstanceId();
                changed = true;
            }
            collectionSeenIds.add(id);
            const openingNumber = numberValue(prior?.openingNumber ?? prior?.itemOpeningNumber ?? prior?.openedNumber ?? prior?.openingIndex ?? prior?.openNumber);
            const globalOpeningNumber = numberValue(prior?.globalOpeningNumber);
            const openedAt = typeof prior?.openedAt === "string" && Number.isFinite(Date.parse(prior.openedAt)) ? prior.openedAt : null;
            const acquiredAt = typeof prior?.acquiredAt === "string" && Number.isFinite(Date.parse(prior.acquiredAt)) ? prior.acquiredAt : null;
            const openedBy = typeof prior?.openedBy === "string" && prior.openedBy ? prior.openedBy : null;
            const normalizedHistory = Array.isArray(prior?.ownershipHistory) ? prior.ownershipHistory.filter(entry => entry && typeof entry === "object" && typeof entry.username === "string").map(entry => ({
                username:String(entry.username),
                event:String(entry.event || "ownership"),
                acquiredAt:entry.acquiredAt || null,
                ...(entry.from ? { from:String(entry.from) } : {}),
                ...(entry.tradeId ? { tradeId:String(entry.tradeId) } : {})
            })) : [];
            const baselineOnly = normalizedHistory.length === 1 && normalizedHistory[0].event === "opened" && normalizedHistory[0].username === openedBy && (normalizedHistory[0].acquiredAt || null) === (openedAt || acquiredAt || null);
            const ownershipHistory = baselineOnly ? [] : normalizedHistory;
            const itemOpeningNumber = numberValue(prior?.itemOpeningNumber) || openingNumber;
            const openingNumberExact = prior?.openingNumberExact === false ? false : openingNumber !== null;
            if (prior?.id !== id || prior?.openingNumber !== openingNumber || prior?.itemOpeningNumber !== itemOpeningNumber || prior?.globalOpeningNumber !== globalOpeningNumber || prior?.openingNumberExact !== openingNumberExact || prior?.openedAt !== openedAt || prior?.openedBy !== openedBy || prior?.acquiredAt !== acquiredAt) changed = true;
            if (baselineOnly || (Array.isArray(prior?.ownershipHistory) && ownershipHistory.length === 0) || (Object.prototype.hasOwnProperty.call(prior || {}, "ownershipHistory") && !Array.isArray(prior?.ownershipHistory))) changed = true;
            if (Array.isArray(prior?.ownershipHistory)) {
                const originalHistory = prior.ownershipHistory;
                if (originalHistory.length !== normalizedHistory.length) changed = true;
                else {
                    for (let historyIndex = 0; historyIndex < normalizedHistory.length; historyIndex++) {
                        const oldEntry = originalHistory[historyIndex];
                        const newEntry = normalizedHistory[historyIndex];
                        if (!oldEntry || oldEntry.username !== newEntry.username || oldEntry.event !== newEntry.event || (oldEntry.acquiredAt || null) !== newEntry.acquiredAt || (oldEntry.from ? String(oldEntry.from) : null) !== (newEntry.from || null) || (oldEntry.tradeId ? String(oldEntry.tradeId) : null) !== (newEntry.tradeId || null)) {
                            changed = true;
                            break;
                        }
                    }
                }
            }
            const normalizedCopy = {
                id,
                openingNumber,
                itemOpeningNumber,
                globalOpeningNumber,
                openingNumberExact,
                openedAt,
                openedBy,
                acquiredAt
            };
            if (ownershipHistory.length) normalizedCopy.ownershipHistory = ownershipHistory;
            copies[index] = normalizedCopy;
        }
        const normalizedId = String(raw.id || itemId);
        const normalizedName = String(raw.name || definition.name || itemId);
        const normalizedRarity = String(raw.rarity || definition.rarity || "unknown");
        const normalizedIcon = String(raw.icon || definition.icon || "📦");
        const normalizedColor = String(raw.color || definition.color || "#a1a1aa");
        if (raw.id !== normalizedId || raw.itemId !== itemId || raw.name !== normalizedName || raw.rarity !== normalizedRarity || raw.icon !== normalizedIcon || raw.color !== normalizedColor) changed = true;
        raw.id = normalizedId;
        raw.itemId = itemId;
        raw.name = normalizedName;
        raw.rarity = normalizedRarity;
        raw.icon = normalizedIcon;
        raw.color = normalizedColor;
        raw.copies = copies;
        let idsMatch = !!originalIds && originalIds.length === copies.length;
        if (idsMatch) {
            for (let index = 0; index < copies.length; index++) {
                if (originalIds[index] !== copies[index].id) {
                    idsMatch = false;
                    break;
                }
            }
        }
        if (!idsMatch) {
            raw.instanceIds = copies.map(copy => copy.id);
            changed = true;
        } else {
            raw.instanceIds = originalIds;
        }
        raw.quantity = copies.length;
    }
    COLLECTIBLES_NORMALIZED_USERS.delete(key);
    COLLECTIBLES_NORMALIZED_USERS.add(key);
    while (COLLECTIBLES_NORMALIZED_USERS.size > 4096) {
        COLLECTIBLES_NORMALIZED_USERS.delete(COLLECTIBLES_NORMALIZED_USERS.values().next().value);
    }
    if (changed) halloweenSaveCollection(key, collection);
    return collection;
}
function collectibleOpenedStats() {
    const counter = readJson(GLOBAL_OPENING_COUNTER_PATH, { current:0, byItem:{} });
    const counts = counter && counter.byItem && typeof counter.byItem === "object" && !Array.isArray(counter.byItem) ? counter.byItem : {};
    const stats = {};
    for (const item of ALL_COLLECTIBLE_ITEMS) {
        stats[item.id] = { itemId:item.id, name:item.name, rarity:item.rarity, icon:item.icon, opened:Math.max(0, Number(counts[item.id]) || 0), owned:0 };
    }
    return stats;
}

function collectibleStats() {
    if (COLLECTIBLE_STATS_CACHE) return COLLECTIBLE_STATS_CACHE;
    if (fs.existsSync(COLLECTIBLE_STATS_PATH)) {
        const stored = readJson(COLLECTIBLE_STATS_PATH, null);
        if (stored && stored.schemaVersion === 1 && stored.items && typeof stored.items === "object" && !Array.isArray(stored.items)) {
            COLLECTIBLE_STATS_CACHE = stored.items;
            return COLLECTIBLE_STATS_CACHE;
        }
    }
    const stats = {};
    for (const item of ALL_COLLECTIBLE_ITEMS) stats[item.id] = { itemId:item.id, name:item.name, rarity:item.rarity, icon:item.icon, opened:0, owned:0 };
    COLLECTIBLE_STATS_BUILDING = true;
    try {
        if (fs.existsSync(USER_ROOT)) {
            for (const entry of fs.readdirSync(USER_ROOT, { withFileTypes:true })) {
                if (!entry.isDirectory()) continue;
                const core = readJson(path.join(USER_ROOT, entry.name, "UserData.json"), null);
                if (!core || typeof core !== "object") continue;
                const username = String(core.username || entry.name);
                if (!username) continue;
                const wasCached = HALLOWEEN_COLLECTION_CACHE.has(username);
                const collection = ensureCollectibleIds(username);
                const contribution = collectionStatsContribution(collection);
                adjustStatsObject(stats, contribution);
                if (!wasCached && HALLOWEEN_COLLECTION_CACHE.get(username) === collection) dropHalloweenCollectionCache(username);
            }
        }
    } finally {
        COLLECTIBLE_STATS_BUILDING = false;
    }
    COLLECTIBLE_STATS_CACHE = stats;
    writeCompactJson(COLLECTIBLE_STATS_PATH, { schemaVersion:1, updatedAt:new Date().toISOString(), items:stats });
    return stats;
}
function adjustStatsObject(stats, contribution) {
    for (const [itemId, quantity] of contribution.owned) {
        if (!stats[itemId]) {
            const definition = HALLOWEEN_ITEM_CATALOG.get(itemId) || {};
            stats[itemId] = { itemId, name:definition.name || itemId, rarity:definition.rarity || "unknown", icon:definition.icon || "📦", opened:0, owned:0 };
        }
        stats[itemId].owned += quantity;
    }
    for (const [itemId, quantity] of contribution.opened) {
        if (!stats[itemId]) {
            const definition = HALLOWEEN_ITEM_CATALOG.get(itemId) || {};
            stats[itemId] = { itemId, name:definition.name || itemId, rarity:definition.rarity || "unknown", icon:definition.icon || "📦", opened:0, owned:0 };
        }
        stats[itemId].opened += quantity;
    }
}
function normalizeTradeSide(side) {
    if (!side || typeof side !== "object") return null;
    const items = [];
    const itemsById = new Map();
    const rawItems = Array.isArray(side.items) ? side.items : [];
    if (rawItems.length > 50) return null;
    for (const value of rawItems) {
        const itemId = String(value?.itemId || "");
        const quantity = tradeNumber(value?.quantity, 1000000);
        if (!itemId || quantity === null || quantity < 1) return null;
        let copyIds = null;
        if (Object.prototype.hasOwnProperty.call(value || {}, "copyIds")) {
            if (!Array.isArray(value.copyIds) || value.copyIds.length !== quantity) return null;
            copyIds = value.copyIds.map(id => String(id || ""));
            if (copyIds.some(id => !id) || new Set(copyIds).size !== copyIds.length) return null;
        }
        const prior = itemsById.get(itemId);
        if (prior) {
            if (!!prior.copyIds !== !!copyIds) return null;
            prior.quantity += quantity;
            if (prior.quantity > 1000000) return null;
            if (copyIds) {
                const seenCopyIds = new Set(prior.copyIds);
                for (const copyId of copyIds) {
                    if (seenCopyIds.has(copyId)) return null;
                    seenCopyIds.add(copyId);
                    prior.copyIds.push(copyId);
                }
            }
        } else {
            const normalized = { itemId, quantity };
            if (copyIds) normalized.copyIds = copyIds;
            items.push(normalized);
            itemsById.set(itemId, normalized);
        }
    }
    const zyphium = Number(side.zyphium || 0);
    if (!Number.isFinite(zyphium) || zyphium < 0 || zyphium > 1000000000000) return null;
    return { items, zyphium: Math.floor(zyphium * 100) / 100 };
}

function collectibleCopyIdIndex(username, itemId, copies) {
    const key = `${username}:${itemId}`;
    let index = COLLECTIBLE_COPY_INDEX_CACHE.get(key);
    if (index) {
        COLLECTIBLE_COPY_INDEX_CACHE.delete(key);
        COLLECTIBLE_COPY_INDEX_CACHE.set(key, index);
        return index;
    }
    index = new Set();
    for (const copy of copies || []) if (copy?.id) index.add(copy.id);
    if ((copies || []).length <= 10000) {
        COLLECTIBLE_COPY_INDEX_CACHE.set(key, index);
        while (COLLECTIBLE_COPY_INDEX_CACHE.size > 4) COLLECTIBLE_COPY_INDEX_CACHE.delete(COLLECTIBLE_COPY_INDEX_CACHE.keys().next().value);
    }
    return index;
}

function tradeReservedCopyIds(username, trades=loadTradeDb().trades) {
    const reserved = new Set();
    const candidates = TRADE_DB_CACHE && trades === TRADE_DB_CACHE.trades ? TRADE_ACTIVE_CACHE : trades.filter(trade => trade && ["pending", "confirming"].includes(trade.status));
    for (const trade of candidates) {
        if (!trade || !["pending", "confirming"].includes(trade.status)) continue;
        const side = trade.from === username ? trade.offered : trade.to === username ? trade.requested : null;
        if (!side || !Array.isArray(side.items)) continue;
        for (const item of side.items) for (const id of Array.isArray(item.copyIds) ? item.copyIds : []) reserved.add(String(id));
    }
    return reserved;
}

function bindTradeOfferCopies(username, offer, trades=loadTradeDb().trades) {
    const collection = ensureCollectibleIds(username);
    const reserved = tradeReservedCopyIds(username, trades);
    const items = [];
    for (const wanted of offer.items) {
        const owned = collection.items[wanted.itemId];
        const copies = Array.isArray(owned?.copies) ? owned.copies : [];
        let copyIds;
        if (Array.isArray(wanted.copyIds)) {
            const ownedIds = collectibleCopyIdIndex(username, wanted.itemId, copies);
            copyIds = wanted.copyIds.map(String);
            if (copyIds.some(id => reserved.has(id) || !ownedIds.has(id)) || new Set(copyIds).size !== copyIds.length) {
                return { ok:false, error:"collectibles_reserved_or_unavailable", itemId:wanted.itemId };
            }
        } else {
            copyIds = [];
            for (const copy of copies) {
                if (!reserved.has(copy.id)) copyIds.push(copy.id);
                if (copyIds.length >= wanted.quantity) break;
            }
            if (copyIds.length < wanted.quantity) return { ok:false, error:"collectibles_reserved_or_unavailable", itemId:wanted.itemId };
        }
        if (copyIds.length !== wanted.quantity) return { ok:false, error:"invalid_copy_selection", itemId:wanted.itemId };
        for (const id of copyIds) reserved.add(id);
        items.push({ itemId:wanted.itemId, quantity:wanted.quantity, copyIds });
    }
    return { ok:true, offer:{ items, zyphium:offer.zyphium } };
}

function validateTradeOffer(username, offer) {
    const collection = ensureCollectibleIds(username);
    for (const wanted of offer.items) {
        const owned = collection.items[wanted.itemId];
        const copies = Array.isArray(owned?.copies) ? owned.copies : [];
        if (!owned || Number(owned.quantity) < wanted.quantity || copies.length < wanted.quantity) {
            return { ok: false, error: "insufficient_collectibles", itemId: wanted.itemId };
        }
        if (Array.isArray(wanted.copyIds)) {
            const ownedIds = collectibleCopyIdIndex(username, wanted.itemId, copies);
            if (wanted.copyIds.length !== wanted.quantity || new Set(wanted.copyIds).size !== wanted.copyIds.length || wanted.copyIds.some(id => !ownedIds.has(id))) {
                return { ok:false, error:"insufficient_collectibles", itemId:wanted.itemId };
            }
        }
    }
    const account = ensureZyphiumAccount(username);
    if (account.balance + 0.000001 < offer.zyphium) return { ok: false, error: "insufficient_zyphium" };
    return { ok: true };
}

function tradeReserveIsValid(trade) {
    if (!trade || !["pending", "confirming"].includes(trade.status)) return false;
    const from = validateTradeOffer(trade.from, trade.offered);
    const to = validateTradeOffer(trade.to, trade.requested);
    return from.ok && to.ok;
}

function tradeGet(id) {
    loadTradeDb();
    return TRADE_DB_BY_ID.get(id) || null;
}

function tradeSaveRecord(trade) {
    const db = loadTradeDb();
    const existing = TRADE_DB_BY_ID.get(trade.id);
    if (!existing) {
        db.trades.unshift(trade);
        TRADE_DB_BY_ID.set(trade.id, trade);
    } else if (existing !== trade) {
        const index = db.trades.indexOf(existing);
        if (index >= 0) db.trades[index] = trade;
        TRADE_DB_BY_ID.set(trade.id, trade);
    }
    rebuildTradeIndexes(db);
    writeCompactJson(TRADE_DB_PATH, db);
}

function tradeFail(trade, status, outcome) {
    trade.status = status;
    trade.outcome = outcome;
    trade.updatedAt = new Date().toISOString();
    appendTradeHistory({ ...trade, archivedAt:trade.updatedAt });
    trade.offered = compactTradeSide(trade.offered);
    trade.requested = compactTradeSide(trade.requested);
    tradeSaveRecord(trade);
    return trade;
}

function tradeFinalize(trade) {
    if (trade.status !== "confirming") return { ok: false, error: "not_confirming" };
    if (Date.now() < new Date(trade.confirmUntil).getTime()) return { ok: false, error: "confirmation_time_remaining" };
    if (!tradeReserveIsValid(trade)) {
        tradeFail(trade, "cancelled", "inventory_changed");
        return { ok: false, error: "inventory_changed" };
    }
    const fromCollection = ensureCollectibleIds(trade.from);
    const toCollection = ensureCollectibleIds(trade.to);
    const fromAccount = ensureZyphiumAccount(trade.from);
    const toAccount = ensureZyphiumAccount(trade.to);
    const tx = tradeRandomId("TRX");
    const time = new Date().toISOString();
    const transferLog = { from:[], to:[] };
    const itemCatalog = tradeItemCatalog();
    const transferItems = (senderCollection, receiverCollection, senderName, receiverName, offer, direction) => {
        for (const offered of offer.items) {
            const source = senderCollection.items[offered.itemId];
            if (!source) throw new Error("trade_source_item_missing");
            if (!Array.isArray(source.copies)) source.copies = [];
            const selectedIds = Array.isArray(offered.copyIds) ? offered.copyIds : source.copies.slice(0, offered.quantity).map(copy => copy.id);
            const selectedSet = new Set(selectedIds);
            const movedCopies = [];
            const remainingCopies = [];
            for (const copy of source.copies) {
                if (selectedSet.has(copy.id)) movedCopies.push(copy);
                else remainingCopies.push(copy);
            }
            if (movedCopies.length !== offered.quantity) throw new Error("trade_copy_selection_changed");
            const definition = itemCatalog.get(offered.itemId) || {};
            const dest = receiverCollection.items[offered.itemId] || {
                ...source,
                id:offered.itemId,
                itemId:offered.itemId,
                name:source.name || definition.name || offered.itemId,
                rarity:source.rarity || definition.rarity || "unknown",
                icon:source.icon || definition.icon || "📦",
                color:source.color || definition.color || "#a1a1aa",
                quantity:0,
                instanceIds:[],
                copies:[],
                firstObtainedAt:time,
                lastObtainedAt:time
            };
            if (!Array.isArray(dest.copies)) dest.copies = [];
            source.copies = remainingCopies;
            for (const copy of movedCopies) {
                if (!Array.isArray(copy.ownershipHistory)) copy.ownershipHistory = copy.openedBy ? [{ username:copy.openedBy, event:"opened", acquiredAt:copy.openedAt || copy.acquiredAt || time }] : [];
                copy.acquiredAt = time;
                copy.ownershipHistory.push({ username:receiverName, event:"trade_received", acquiredAt:time, from:senderName, tradeId:trade.id });
            }
            dest.copies.push(...movedCopies);
            source.instanceIds = source.copies.map(copy => copy.id);
            source.quantity = source.copies.length;
            dest.instanceIds = dest.copies.map(copy => copy.id);
            dest.quantity = dest.copies.length;
            dest.lastObtainedAt = time;
            receiverCollection.items[offered.itemId] = dest;
            if (source.quantity <= 0) delete senderCollection.items[offered.itemId];
            transferLog[direction].push({ itemId:offered.itemId, quantity:offered.quantity });
        }
    };
    try {
        transferItems(fromCollection, toCollection, trade.from, trade.to, trade.offered, "from");
        transferItems(toCollection, fromCollection, trade.to, trade.from, trade.requested, "to");
    } catch (err) {
        console.error("TRADE COPY TRANSFER ERROR", err);
        tradeFail(trade, "cancelled", "inventory_changed");
        return { ok:false, error:"inventory_changed" };
    }
    const fromZ = trade.offered.zyphium;
    const toZ = trade.requested.zyphium;
    fromAccount.balance = Math.floor((fromAccount.balance - fromZ + toZ) * 100) / 100;
    toAccount.balance = Math.floor((toAccount.balance - toZ + fromZ) * 100) / 100;
    if (fromZ || toZ) {
        const txn = (type, amount, other, balanceAfter) => ({ transactionId: tx, type, amount, balanceAfter, note: `Trade ${trade.id}`, from: trade.from, to: trade.to, counterparty: other, time });
        fromAccount.transactions.unshift(txn("trade", toZ - fromZ, trade.to, fromAccount.balance));
        toAccount.transactions.unshift(txn("trade", fromZ - toZ, trade.from, toAccount.balance));
        fromAccount.transactions = fromAccount.transactions.slice(0, 500);
        toAccount.transactions = toAccount.transactions.slice(0, 500);
        saveZyphium(trade.from, fromAccount);
        saveZyphium(trade.to, toAccount);
    }
    markItemsDiscovered(trade.from,Object.keys(fromCollection.items),"legacy_owned",time);
    markItemsDiscovered(trade.to,Object.keys(toCollection.items),"legacy_owned",time);
    halloweenSaveCollection(trade.from, fromCollection);
    halloweenSaveCollection(trade.to, toCollection);
    markItemsDiscovered(trade.from,(trade.requested?.items||[]).map(item=>item.itemId),"trade",time);
    markItemsDiscovered(trade.to,(trade.offered?.items||[]).map(item=>item.itemId),"trade",time);
    if (trade.offered.items.some(item => item.itemId === HALLOWEEN_SECRET_ID)) halloweenGiveBadge(trade.to, "Find the Secret Halloween Item 2026");
    if (trade.requested.items.some(item => item.itemId === HALLOWEEN_SECRET_ID)) halloweenGiveBadge(trade.from, "Find the Secret Halloween Item 2026");
    trade.status = "completed";
    trade.outcome = "completed";
    trade.completedAt = time;
    trade.transactionId = tx;
    trade.transferredCopies = transferLog;
    trade.updatedAt = time;
    appendTradeHistory({ ...trade, archivedAt:time });
    trade.offered = compactTradeSide(trade.offered);
    trade.requested = compactTradeSide(trade.requested);
    trade.transferredCopies = compactTransferredCopies(transferLog);
    tradeSaveRecord(trade);
    logAction("trade_completed", { tradeId:trade.id, from:trade.from, to:trade.to, transactionId:tx, transferredCopies:transferLog });
    return { ok:true, trade };
}

function scheduleTradeFinalization(trade) {
    const deadline = new Date(trade.confirmUntil || 0).getTime();
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(() => {
        const fresh = tradeGet(trade.id);
        if (!fresh || fresh.status !== "confirming") return;
        if (Date.now() >= new Date(fresh.confirmUntil || 0).getTime()) tradeFinalize(fresh);
        else scheduleTradeFinalization(fresh);
    }, Math.max(0, deadline - Date.now()));
    if (typeof timer.unref === "function") timer.unref();
}

app.get("/trades", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        ensureCollectibleIds(user.username);
        const db = loadTradeDb();
        const now = Date.now();
        const ownActive = TRADE_ACTIVE_CACHE.filter(trade => trade.from === user.username || trade.to === user.username);
        for (const trade of ownActive) {
            if (trade.status === "pending" && trade.expiresAt && now >= new Date(trade.expiresAt).getTime()) tradeFail(trade, "expired", "request_expired");
            else if (trade.status === "confirming" && trade.confirmUntil && now >= new Date(trade.confirmUntil).getTime()) tradeFinalize(trade);
        }
        const current = TRADE_ACTIVE_CACHE.filter(trade => trade.from === user.username || trade.to === user.username).map(trade => tradePublicView(trade, user.username));
        const collection = ensureCollectibleIds(user.username);
        const account = ensureZyphiumAccount(user.username);
        const stat = collectibleStats();
        res.json({ success:true, username:user.username, zyphium:account.balance, items:Object.values(collection.items).map(item => ({ ...collectionResponseItem(item, false), openedEver:stat[item.itemId || item.id]?.opened || 0 })), itemCatalog:ALL_COLLECTIBLE_ITEMS.map(item => ({ id:item.id, name:item.name, rarity:item.rarity, icon:item.icon, color:item.color, openedEver:stat[item.id]?.opened || 0, ownedEver:stat[item.id]?.owned || 0 })), users:listPublicUsers(user.username), trades:current, history:loadTradeHistory().trades.filter(t => t.from === user.username || t.to === user.username).slice(0, 200).map(t => ({ ...compactTradeHistoryEntry(t), viewerIsSender:user.username === t.from })) });
    } catch (err) {
        console.error("TRADES STATUS ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

app.get("/trades/inventory", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        const targetName = safeUsername(req.query?.username);
        const target = targetName ? loadUserRecord(targetName) : null;
        if (!target || target.banned || target.disabled) return res.status(404).json({ success: false, error: "user_not_found" });
        const collection = ensureCollectibleIds(target.username);
        const stats = collectibleOpenedStats();
        res.json({ success:true, username:target.username, items:Object.values(collection.items).map(item => ({ ...collectionResponseItem(item, false), openedEver:stats[item.itemId || item.id]?.opened || 0 })) });
    } catch (err) {
        console.error("TRADE INVENTORY ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

app.post("/trades", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        const targetName = safeUsername(req.body?.to);
        const target = targetName ? loadUserRecord(targetName) : null;
        if (!target || target.username === user.username || target.banned || target.disabled) return res.status(400).json({ success: false, error: "invalid_target" });
        let offered = normalizeTradeSide(req.body?.offered);
        let requested = normalizeTradeSide(req.body?.requested);
        if (!offered || !requested || (!offered.items.length && !requested.items.length && offered.zyphium <= 0 && requested.zyphium <= 0)) return res.status(400).json({ success: false, error: "invalid_offer" });
        const db = loadTradeDb();
        const ownBound = bindTradeOfferCopies(user.username, offered, db.trades);
        if (!ownBound.ok) return res.status(400).json({ success:false, error:ownBound.error, itemId:ownBound.itemId });
        const theirBound = bindTradeOfferCopies(target.username, requested, db.trades);
        if (!theirBound.ok) return res.status(400).json({ success:false, error:theirBound.error, itemId:theirBound.itemId, side:"target" });
        offered = ownBound.offer;
        requested = theirBound.offer;
        const ownCheck = validateTradeOffer(user.username, offered);
        if (!ownCheck.ok) return res.status(400).json({ success: false, ...ownCheck });
        const theirCheck = validateTradeOffer(target.username, requested);
        if (!theirCheck.ok) return res.status(400).json({ success: false, ...theirCheck, side: "target" });
        const active = TRADE_ACTIVE_CACHE.filter(t => t.from === user.username || t.to === user.username);
        if (active.length >= 25) return res.status(429).json({ success: false, error: "too_many_active_trades" });
        const now = new Date();
        const trade = { id: tradeRandomId("TRD"), from: user.username, to: target.username, offered, requested, status: "pending", acceptedBy: [user.username], declinedBy: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), confirmUntil: null, outcome: null };
        db.trades.unshift(trade);
        saveTradeDb(db);
        logAction("trade_requested", { tradeId: trade.id, from: user.username, to: target.username });
        res.json({ success: true, trade: tradePublicView(trade, user.username) });
    } catch (err) {
        console.error("TRADE CREATE ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

app.post("/trades/:id/accept", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        const trade = tradeGet(String(req.params.id || ""));
        if (!trade || ![trade.from, trade.to].includes(user.username)) return res.status(404).json({ success: false, error: "trade_not_found" });
        if (trade.status !== "pending") return res.status(409).json({ success: false, error: "trade_not_pending", status: trade.status });
        if (user.username !== trade.to) return res.status(403).json({ success: false, error: "only_recipient_can_accept" });
        if (Date.now() >= new Date(trade.expiresAt).getTime()) {
            tradeFail(trade, "expired", "request_expired");
            return res.status(409).json({ success: false, error: "trade_expired" });
        }
        if (!tradeReserveIsValid(trade)) {
            tradeFail(trade, "cancelled", "inventory_changed");
            return res.status(409).json({ success: false, error: "inventory_changed" });
        }
        trade.acceptedBy = [...new Set([...(trade.acceptedBy || []), user.username])];
        trade.status = "confirming";
        trade.confirmUntil = new Date(Date.now() + TRADE_CONFIRM_MS).toISOString();
        trade.updatedAt = new Date().toISOString();
        tradeSaveRecord(trade);
        scheduleTradeFinalization(trade);
        logAction("trade_accepted", { tradeId: trade.id, username: user.username, confirmUntil: trade.confirmUntil });
        res.json({ success: true, trade: tradePublicView(trade, user.username), confirmationMs: TRADE_CONFIRM_MS });
    } catch (err) {
        console.error("TRADE ACCEPT ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

app.post("/trades/:id/confirm", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        const trade = tradeGet(String(req.params.id || ""));
        if (!trade || ![trade.from, trade.to].includes(user.username)) return res.status(404).json({ success: false, error: "trade_not_found" });
        if (trade.status !== "confirming") return res.status(409).json({ success: false, error: "trade_not_confirming" });
        if (Date.now() >= new Date(trade.confirmUntil).getTime()) {
            const result = tradeFinalize(trade);
            return res.status(result.ok ? 200 : 409).json({ success: result.ok, error: result.error, status: result.ok ? "completed" : "cancelled" });
        }
        return res.status(409).json({ success: false, error: "confirmation_time_remaining", confirmUntil: trade.confirmUntil, remainingMs: new Date(trade.confirmUntil).getTime() - Date.now() });
    } catch (err) {
        console.error("TRADE CONFIRM ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

app.post("/trades/:id/decline", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });
        const trade = tradeGet(String(req.params.id || ""));
        if (!trade || ![trade.from, trade.to].includes(user.username)) return res.status(404).json({ success: false, error: "trade_not_found" });
        if (!["pending", "confirming"].includes(trade.status)) return res.status(409).json({ success: false, error: "trade_not_declineable", status: trade.status });
        if (trade.status === "confirming" && Date.now() >= new Date(trade.confirmUntil).getTime()) {
            const result = tradeFinalize(trade);
            return res.status(result.ok ? 409 : 409).json({ success: false, error: result.ok ? "confirmation_period_ended" : result.error, status: result.ok ? "completed" : "cancelled" });
        }
        trade.declinedBy = user.username;
        tradeFail(trade, "declined", "declined_by_user");
        logAction("trade_declined", { tradeId: trade.id, username: user.username });
        res.json({ success: true, status: trade.status });
    } catch (err) {
        console.error("TRADE DECLINE ERROR", err);
        res.status(500).json({ success: false, error: "server" });
    }
});

ensureTradeStorage();
for (const trade of loadTradeDb().trades) {
    if (trade.status === "confirming" && trade.confirmUntil) scheduleTradeFinalization(trade);
}

const upload = multer({
storage,
limits:{
fileSize:5*1024*1024
},
fileFilter:(req,file,cb)=>{

const allowed=[
"image/png",
"image/jpg",
"image/jpeg"
]

if(!allowed.includes(file.mimetype)){
return cb(new Error("Only images allowed"))
}

cb(null,true)

}
})

if(!fs.existsSync(USER_ROOT)) fs.mkdirSync(USER_ROOT,{recursive:true})
ensureSubscriptionStorage()
if(!fs.existsSync("uploads")) fs.mkdirSync("uploads")
if(!fs.existsSync("quests.json")) fs.writeFileSync("quests.json",JSON.stringify({quests:[]}))
if(!fs.existsSync("logs.json")) fs.writeFileSync("logs.json",JSON.stringify([]))
if(!fs.existsSync("permissions.json")) fs.writeFileSync("permissions.json",JSON.stringify({permissions:{Support:[],Administrator:[]}},null,2))

if(!fs.existsSync("friends.json")) fs.writeFileSync("friends.json",JSON.stringify({friendRequests:[],friends:{}},null,2))
const LEGACY_DMS_PATH = path.join(__dirname, "dms.json")
if(!fs.existsSync(LEGACY_DMS_PATH)) fs.writeFileSync(LEGACY_DMS_PATH,JSON.stringify({chats:[]},null,2))

function loadFriends(){
try{return JSON.parse(fs.readFileSync("friends.json"))}
catch{return {friendRequests:[],friends:{}}}
}

function normalizeFriendsData(input){
    const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{}
    const rawFriends=source.friends&&typeof source.friends==="object"&&!Array.isArray(source.friends)?source.friends:{}
    const friends={}
    const canonicalNames=new Map()
    const remember=name=>{
        const value=String(name||"").trim()
        if(!value) return null
        const key=value.toLowerCase()
        if(!canonicalNames.has(key)) canonicalNames.set(key,value)
        return canonicalNames.get(key)
    }

    for(const [owner,rawList] of Object.entries(rawFriends)){
        remember(owner)
        const list=Array.isArray(rawList)?rawList:Array.isArray(rawList?.friends)?rawList.friends:[]
        for(const friend of list){
            if(typeof friend==="string") remember(friend)
            else if(friend&&typeof friend==="object") remember(friend.username||friend.name||friend.user)
        }
    }

    const requestsSource=Array.isArray(source.friendRequests)?source.friendRequests:Array.isArray(source.requests)?source.requests:[]
    for(const request of requestsSource){
        if(!request||typeof request!=="object") continue
        remember(request.from||request.sender||request.username)
        remember(request.to||request.receiver||request.target)
    }

    const findName=name=>{
        const value=String(name||"").trim()
        return value?(canonicalNames.get(value.toLowerCase())||value):null
    }

    for(const [owner,rawList] of Object.entries(rawFriends)){
        const canonicalOwner=findName(owner)
        if(!canonicalOwner) continue
        const list=Array.isArray(rawList)?rawList:Array.isArray(rawList?.friends)?rawList.friends:[]
        const normalized=[]
        const seen=new Set()
        for(const entry of list){
            const rawName=typeof entry==="string"?entry:entry&&typeof entry==="object"?(entry.username||entry.name||entry.user):""
            const friend=findName(rawName)
            if(!friend||friend.toLowerCase()===canonicalOwner.toLowerCase()||seen.has(friend.toLowerCase())) continue
            seen.add(friend.toLowerCase())
            normalized.push(friend)
        }
        const existingKey=Object.keys(friends).find(name=>name.toLowerCase()===canonicalOwner.toLowerCase())
        if(existingKey) friends[existingKey]=[...new Set([...friends[existingKey],...normalized])]
        else friends[canonicalOwner]=normalized
    }

    const friendRequests=[]
    const requestIds=new Set()
    for(const request of requestsSource){
        if(!request||typeof request!=="object") continue
        const from=findName(request.from||request.sender||request.username)
        const to=findName(request.to||request.receiver||request.target)
        if(!from||!to||from.toLowerCase()===to.toLowerCase()) continue
        const fallbackId=crypto.createHash("sha256").update(`${from.toLowerCase()}::${to.toLowerCase()}::${String(request.time||request.createdAt||"")}`).digest("hex").slice(0,16)
        const id=String(request.id||request.requestId||fallbackId)
        if(requestIds.has(id)) continue
        requestIds.add(id)
        friendRequests.push({...request,id,from,to})
    }

    return {...source,friendRequests,friends}
}

function friendListFor(friendsData,username){
    const friends=normalizeFriendsData(friendsData).friends
    const key=Object.keys(friends).find(name=>name.toLowerCase()===String(username||"").trim().toLowerCase())
    return key?friends[key]:[]
}

function areFriends(friendsData,username,otherUsername){
    const a=String(username||"").trim()
    const b=String(otherUsername||"").trim()
    if(!a||!b||a.toLowerCase()===b.toLowerCase()) return false
    return friendListFor(friendsData,a).some(name=>String(name).toLowerCase()===b.toLowerCase())||
        friendListFor(friendsData,b).some(name=>String(name).toLowerCase()===a.toLowerCase())
}

function addFriendPair(friendsData,username,otherUsername){
    const normalized=normalizeFriendsData(friendsData)
    const a=String(username||"").trim()
    const b=String(otherUsername||"").trim()
    if(!a||!b||a.toLowerCase()===b.toLowerCase()) return normalized
    const ensureKey=name=>{
        let key=Object.keys(normalized.friends).find(value=>value.toLowerCase()===name.toLowerCase())
        if(!key){key=name;normalized.friends[key]=[]}
        return key
    }
    const aKey=ensureKey(a)
    const bKey=ensureKey(b)
    if(!normalized.friends[aKey].some(name=>String(name).toLowerCase()===b.toLowerCase())) normalized.friends[aKey].push(b)
    if(!normalized.friends[bKey].some(name=>String(name).toLowerCase()===a.toLowerCase())) normalized.friends[bKey].push(a)
    return normalized
}

function removeFriendPair(friendsData,username,otherUsername){
    const normalized=normalizeFriendsData(friendsData)
    const a=String(username||"").trim().toLowerCase()
    const b=String(otherUsername||"").trim().toLowerCase()
    for(const [owner,list] of Object.entries(normalized.friends)){
        const ownerKey=owner.toLowerCase()
        if(ownerKey!==a&&ownerKey!==b) continue
        normalized.friends[owner]=list.filter(name=>{
            const target=String(name||"").toLowerCase()
            return ownerKey===a?target!==b:target!==a
        })
    }
    return normalized
}

function saveFriends(d){
fs.writeFileSync("friends.json",JSON.stringify(d,null,2))
}

function loadDMs(){
    const folder=path.resolve(__dirname,"dms")
    fs.mkdirSync(folder,{recursive:true})
    migrateLegacyDmFiles(folder)
    migrateLegacyDmStore(folder)
    return {folder}
}

function dmPairHash(users){
    return crypto.createHash("sha256").update(users.map(x=>String(x).toLowerCase()).sort().join("::")).digest("hex").slice(0,10)
}

function dmFolderName(users){
    const sorted=users.slice().sort((a,b)=>a.localeCompare(b))
    const slug=sorted.map(x=>String(x).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,40)||"user").join("--")
    return `${slug}-${dmPairHash(sorted)}`
}

function dmFolderForUsers(dmsData,a,b){
    const users=[String(a||"").trim(),String(b||"").trim()].sort((x,y)=>x.localeCompare(y))
    return path.join(dmsData.folder,dmFolderName(users))
}

function dmMetaPath(folder){return path.join(folder,"meta.json")}
function dmPreviewPath(folder){return path.join(folder,"preview.json")}
function dmHourKey(time){
    const d=new Date(time||Date.now())
    if(Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,13).replace("T","-")
    return d.toISOString().slice(0,13).replace("T","-")
}
function dmHourPath(folder,time){return path.join(folder,`${dmHourKey(time)}.json`)}
function isDmHourFile(name){return /^\d{4}-\d{2}-\d{2}-\d{2}\.json$/.test(name)}

function readDmMeta(folder){
    const meta=readJson(dmMetaPath(folder),null)
    if(!meta || !Array.isArray(meta.users)) return null
    if(!meta.lastRead || typeof meta.lastRead!=="object") meta.lastRead={}
    if(!meta.unreadCounts || typeof meta.unreadCounts!=="object") meta.unreadCounts={}
    if(!Array.isArray(meta.activeUsers)) meta.activeUsers=[]
    if(!Number.isFinite(Number(meta.messageCount))) meta.messageCount=0
    return meta
}

function readDmPreview(folder){
    const data=readJson(dmPreviewPath(folder),{})
    return data && typeof data==="object" ? data : {}
}

function dmPartitionFiles(folder,descending=false){
    let names=[]
    try{names=fs.readdirSync(folder).filter(isDmHourFile)}catch{}
    names.sort((a,b)=>a.localeCompare(b))
    if(descending) names.reverse()
    return names.map(name=>path.join(folder,name))
}

function readDmPartition(file){
    const data=readJson(file,{messages:[]})
    if(Array.isArray(data)) return data
    return Array.isArray(data?.messages)?data.messages:[]
}

function readAllDmMessages(folder){
    return dmPartitionFiles(folder).flatMap(readDmPartition).sort((a,b)=>new Date(a.time||0)-new Date(b.time||0))
}

function writeStoredChat(dmsData,chat){
    const users=(chat.users||[]).slice().sort((a,b)=>a.localeCompare(b))
    if(users.length!==2) throw new Error("invalid dm users")
    const folder=dmFolderForUsers(dmsData,users[0],users[1])
    fs.mkdirSync(folder,{recursive:true})
    const messages=(Array.isArray(chat.messages)?chat.messages:[]).slice().sort((a,b)=>new Date(a.time||0)-new Date(b.time||0))
    const groups=new Map()
    for(const message of messages){
        const file=dmHourPath(folder,message.time)
        if(!groups.has(file)) groups.set(file,[])
        groups.get(file).push(message)
    }
    for(const file of dmPartitionFiles(folder)) if(!groups.has(file)) fs.rmSync(file,{force:true})
    for(const [file,items] of groups) writeJson(file,{hour:path.basename(file,".json"),messages:items})
    const now=new Date().toISOString()
    const last=messages[messages.length-1]||null
    const old=readDmMeta(folder)||{}
    const lastRead=chat.lastRead&&typeof chat.lastRead==="object"?chat.lastRead:(old.lastRead||{})
    const unreadCounts={...(old.unreadCounts||{})}
    for(const username of users){
        unreadCounts[username]=messages.filter(m=>m.author!==username&&new Date(m.time||0).getTime()>(new Date(lastRead[username]||0).getTime()||0)).length
    }
    const meta={
        id:chat.id||old.id||crypto.randomBytes(8).toString("hex"),
        users,
        createdAt:chat.createdAt||old.createdAt||now,
        updatedAt:chat.updatedAt||last?.time||old.updatedAt||now,
        messageCount:messages.length,
        authorCounts:Object.fromEntries(users.map(username=>[username,messages.filter(message=>message.author===username).length])),
        lastRead,
        unreadCounts,
        activeUsers:Array.isArray(chat.activeUsers)?chat.activeUsers:(old.activeUsers||[])
    }
    writeJson(dmMetaPath(folder),meta)
    writeJson(dmPreviewPath(folder),{message:last,messageCount:messages.length,updatedAt:meta.updatedAt})
    return {folder,meta,messages}
}

const DM_MIGRATION_ATTEMPTS = new Set()

function legacyDmChatEntries(data){
    const attachKeys=entries=>entries.map(([key,value])=>{
        if(!value||typeof value!=="object"||Array.isArray(value)) return value
        return {...value,legacyKey:value.legacyKey||key}
    })
    if(Array.isArray(data)) return data
    if(!data || typeof data!=="object") return []
    for(const key of ["chats","dms","conversations","directMessages"]){
        const value=data[key]
        if(Array.isArray(value)) return value
        if(value && typeof value==="object") return attachKeys(Object.entries(value))
    }
    if(Array.isArray(data.users) && Array.isArray(data.messages)) return [data]
    return attachKeys(Object.entries(data).filter(([,value])=>value && typeof value==="object" && (Array.isArray(value.messages)||Array.isArray(value.users)||Array.isArray(value.participants))))
}

function dmUserValue(value){
    if(typeof value==="string") return value.trim()
    if(value && typeof value==="object") return String(value.username||value.name||value.user||"").trim()
    return ""
}

function legacyDmUsers(chat){
    const lists=[chat?.users,chat?.participants,chat?.members]
    for(const raw of lists){
        if(Array.isArray(raw)){
            const names=[...new Set(raw.map(dmUserValue).filter(Boolean))]
            if(names.length===2) return names
        }
        if(raw && typeof raw==="object" && !Array.isArray(raw)){
            const names=[...new Set(Object.values(raw).map(dmUserValue).filter(Boolean))]
            if(names.length===2) return names
        }
    }
    const pairs=[
        [chat?.user1,chat?.user2],
        [chat?.from,chat?.to],
        [chat?.sender,chat?.recipient],
        [chat?.owner,chat?.with],
        [chat?.username,chat?.otherUser],
        [chat?.user,chat?.friend]
    ]
    for(const pair of pairs){
        const names=[...new Set(pair.map(dmUserValue).filter(Boolean))]
        if(names.length===2) return names
    }
    const key=String(chat?.legacyKey||"").trim()
    for(const delimiter of ["::","|","__","--","~~","~","/"]){
        const parts=key.split(delimiter).map(value=>value.trim()).filter(Boolean)
        if(parts.length!==2) continue
        const cleaned=parts.map(value=>value.replace(/-[a-f0-9]{10}$/i,""))
        if(cleaned[0]&&cleaned[1]&&cleaned[0].toLowerCase()!==cleaned[1].toLowerCase()) return cleaned
    }
    return []
}

function legacyDmMessage(message,index,users,baseTime){
    const source=message && typeof message==="object" && !Array.isArray(message)?message:{text:String(message??"")}
    const authorRaw=source.author||source.sender||source.from||source.username||source.user||users[0]
    const authorName=dmUserValue(authorRaw)||users[0]
    const canonicalAuthor=users.find(name=>name.toLowerCase()===authorName.toLowerCase())||authorName
    const textValue=source.text??source.message??source.content??source.body??""
    let rawTime=source.time??source.timestamp??source.createdAt??source.date??source.sentAt??null
    let stamp=rawTime===null?NaN:(typeof rawTime==="number"&&rawTime>0&&rawTime<1000000000000?rawTime*1000:new Date(rawTime).getTime())
    if(!Number.isFinite(stamp)) stamp=baseTime+index
    let images=Array.isArray(source.images)?source.images.filter(Boolean):[]
    if(!images.length && source.image){
        images=Array.isArray(source.image)?source.image.filter(Boolean):[source.image]
    }
    images=images.map(image=>typeof image==="string"?{url:image}:image)
    const time=new Date(stamp).toISOString()
    const normalized={...source,messageId:String(source.messageId||source.id||""),author:canonicalAuthor,text:String(textValue??""),images,time}
    if(!normalized.messageId){
        normalized.messageId="legacy-"+crypto.createHash("sha256").update(JSON.stringify([canonicalAuthor,time,normalized.text,images])).digest("hex").slice(0,32)
    }
    if(typeof normalized.edited!=="boolean") normalized.edited=false
    if(typeof normalized.deleted!=="boolean") normalized.deleted=false
    return normalized
}

function dmMessageFingerprint(message){
    return crypto.createHash("sha256").update(JSON.stringify([
        String(message?.author||""),
        String(message?.time||""),
        String(message?.text||""),
        Array.isArray(message?.images)?message.images:[]
    ])).digest("hex")
}

function mergeLegacyDmChat(dmsData,rawChat){
    if(!rawChat || typeof rawChat!=="object") throw new Error("invalid chat record")
    const users=legacyDmUsers(rawChat)
    if(users.length!==2 || users[0].toLowerCase()===users[1].toLowerCase()) throw new Error("chat needs two distinct users")
    const current=getStoredChat(dmsData,users[0],users[1],false)
    const existingMessages=current?readAllDmMessages(current.folder):[]
    const rawMessages=Array.isArray(rawChat.messages)?rawChat.messages:[]
    const parsedBase=Date.parse(rawChat.createdAt||rawChat.created||rawChat.createdTime||"")
    const baseTime=Number.isFinite(parsedBase)?parsedBase:Date.now()
    const incomingMessages=rawMessages.map((message,index)=>legacyDmMessage(message,index,users,baseTime))
    const idSet=new Set(existingMessages.map(message=>String(message.messageId||"")).filter(Boolean))
    const fingerprints=new Map()
    for(const message of existingMessages){
        const key=dmMessageFingerprint(message)
        fingerprints.set(key,(fingerprints.get(key)||0)+1)
    }
    const mergedMessages=existingMessages.slice()
    for(const message of incomingMessages){
        const id=String(message.messageId||"")
        if(id&&idSet.has(id)) continue
        const fingerprint=dmMessageFingerprint(message)
        const count=fingerprints.get(fingerprint)||0
        if(count>0){
            fingerprints.set(fingerprint,count-1)
            if(id) idSet.add(id)
            continue
        }
        mergedMessages.push(message)
        if(id) idSet.add(id)
    }
    mergedMessages.sort((a,b)=>new Date(a.time||0)-new Date(b.time||0))
    const legacyLastRead=rawChat.lastRead&&typeof rawChat.lastRead==="object"?rawChat.lastRead:{}
    const existingLastRead=current?.meta?.lastRead&&typeof current.meta.lastRead==="object"?current.meta.lastRead:{}
    const lastRead={...legacyLastRead,...existingLastRead}
    const activeUsers=[...new Set([
        ...(Array.isArray(rawChat.activeUsers)?rawChat.activeUsers:[]),
        ...(Array.isArray(current?.meta?.activeUsers)?current.meta.activeUsers:[])
    ])]
    const oldCreated=Date.parse(current?.meta?.createdAt||rawChat.createdAt||rawChat.created||"")
    const createdAt=Number.isFinite(oldCreated)?new Date(oldCreated).toISOString():new Date(baseTime).toISOString()
    const latestMessage=mergedMessages[mergedMessages.length-1]||null
    const legacyUpdated=Date.parse(rawChat.updatedAt||rawChat.updated||"")
    const lastUpdated=Math.max(
        latestMessage?Date.parse(latestMessage.time||0)||0:0,
        Number.isFinite(legacyUpdated)?legacyUpdated:0,
        Date.parse(current?.meta?.updatedAt||"")||0
    )
    const chat={
        ...rawChat,
        id:current?.meta?.id||rawChat.id||rawChat.chatId||crypto.randomBytes(8).toString("hex"),
        users,
        messages:mergedMessages,
        createdAt,
        updatedAt:lastUpdated?new Date(lastUpdated).toISOString():createdAt,
        lastRead,
        activeUsers
    }
    const result=writeStoredChat(dmsData,chat)
    return { ...result, importedMessages:incomingMessages.length, mergedMessages:mergedMessages.length }
}

function migrateLegacyDmFiles(folder){
    let names=[]
    try{names=fs.readdirSync(folder).filter(name=>name.endsWith(".json"))}catch{}
    for(const name of names){
        if(isDmHourFile(name)) continue
        const file=path.join(folder,name)
        const data=readJson(file,null)
        if(!data || !Array.isArray(data.messages)) continue
        try{
            const result=mergeLegacyDmChat({folder},data)
            if(result.folder!==file){
                const backupRoot=path.join(__dirname,"dms.legacy-backups")
                fs.mkdirSync(backupRoot,{recursive:true})
                const safeName=name.replace(/[^a-zA-Z0-9._-]/g,"_")
                const backupPath=path.join(backupRoot,`${Date.now()}-${safeName}`)
                fs.copyFileSync(file,backupPath)
                fs.rmSync(file,{force:true})
            }
        }catch(err){console.error("DM MIGRATION ERROR:",name,err.message)}
    }
}

function migrateLegacyDmStore(folder){
    const source=LEGACY_DMS_PATH
    if(!fs.existsSync(source)) return
    const markerPath=path.join(folder,".legacy-migration-v1.json")
    let stat
    try{stat=fs.statSync(source)}catch{return}
    const signature=`${stat.size}:${stat.mtimeMs}`
    const marker=readJson(markerPath,null)
    if(marker?.completed===true && marker.sourceSignature===signature) return
    if(DM_MIGRATION_ATTEMPTS.has(signature)) return
    DM_MIGRATION_ATTEMPTS.add(signature)
    let raw
    let data
    try{
        raw=fs.readFileSync(source,"utf8")
        data=JSON.parse(raw)
    }catch(err){
        console.error("DM LEGACY MIGRATION ERROR: Could not parse dms.json:",err.message)
        return
    }
    const chats=legacyDmChatEntries(data)
    if(!chats.length){
        const hasKnownShape=Array.isArray(data)||Array.isArray(data?.chats)||Array.isArray(data?.dms)||Array.isArray(data?.conversations)||Array.isArray(data?.directMessages)
        if(!hasKnownShape){
            console.error("DM LEGACY MIGRATION ERROR: Unrecognized dms.json format; original file preserved")
            return
        }
        writeJson(markerPath,{completed:true,sourceSignature:signature,sourceSize:stat.size,sourceMtimeMs:stat.mtimeMs,migratedChats:0,migratedMessages:0,completedAt:new Date().toISOString()})
        return
    }
    let migratedChats=0
    let migratedMessages=0
    let failed=0
    for(let index=0;index<chats.length;index++){
        try{
            const chat=chats[index]
            if(!chat||typeof chat!=="object") throw new Error("invalid chat record at index "+index)
            const result=mergeLegacyDmChat({folder},chat)
            migratedChats++
            migratedMessages+=result.importedMessages
        }catch(err){
            failed++
            console.error("DM LEGACY MIGRATION ERROR:",`chat ${index+1}/${chats.length}`,err.message)
        }
    }
    if(failed){
        writeJson(markerPath,{completed:false,sourceSignature:signature,sourceSize:stat.size,sourceMtimeMs:stat.mtimeMs,migratedChats,migratedMessages,failedChats:failed,lastAttemptAt:new Date().toISOString()})
        console.error("DM LEGACY MIGRATION INCOMPLETE:",`${migratedChats} chats migrated; ${failed} records need attention. Original dms.json preserved.`)
        return
    }
    const completedAt=new Date().toISOString()
    let backupName=null
    if(migratedChats>0){
        backupName=`dms.legacy-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`
        const backupPath=path.join(__dirname,backupName)
        try{
            fs.copyFileSync(source,backupPath)
            writeJson(source,{chats:[],migratedTo:"hourly-dm-folders",migratedAt:completedAt,backup:backupName})
        }catch(err){
            console.error("DM MIGRATION BACKUP ERROR:",err.message)
            writeJson(markerPath,{completed:false,sourceSignature:signature,sourceSize:stat.size,sourceMtimeMs:stat.mtimeMs,migratedChats,migratedMessages,failedChats:1,lastAttemptAt:completedAt})
            return
        }
    }
    const finalStat=fs.statSync(source)
    writeJson(markerPath,{completed:true,sourceSignature:`${finalStat.size}:${finalStat.mtimeMs}`,sourceSize:stat.size,sourceMtimeMs:stat.mtimeMs,migratedChats,migratedMessages,backup:backupName,completedAt})
    console.log("DM LEGACY MIGRATION COMPLETE:",`${migratedChats} chats processed; ${migratedMessages} legacy messages checked; backup=${backupName||"not needed"}`)
}

function listStoredChats(dmsData){
    let entries=[]
    try{entries=fs.readdirSync(dmsData.folder,{withFileTypes:true})}catch{}
    const chats=[]
    for(const entry of entries){
        if(!entry.isDirectory()) continue
        const folder=path.join(dmsData.folder,entry.name)
        const meta=readDmMeta(folder)
        if(!meta) continue
        chats.push({folder,meta,preview:readDmPreview(folder)})
    }
    return chats
}

function getStoredChat(dmsData,a,b,create=false){
    const folder=dmFolderForUsers(dmsData,a,b)
    let meta=readDmMeta(folder)
    if(!meta && create){
        const now=new Date().toISOString()
        meta={id:crypto.randomBytes(8).toString("hex"),users:[String(a),String(b)].sort((x,y)=>x.localeCompare(y)),createdAt:now,updatedAt:now,messageCount:0,authorCounts:{[String(a)]:0,[String(b)]:0},lastRead:{},unreadCounts:{[String(a)]:0,[String(b)]:0},activeUsers:[]}
        fs.mkdirSync(folder,{recursive:true})
        writeJson(dmMetaPath(folder),meta)
        writeJson(dmPreviewPath(folder),{message:null,messageCount:0,updatedAt:now})
    }
    if(!meta) return null
    return {folder,meta,preview:readDmPreview(folder)}
}

function loadFullStoredChat(dmsData,a,b,create=false){
    const stored=getStoredChat(dmsData,a,b,create)
    if(!stored) return null
    return {...stored.meta,messages:readAllDmMessages(stored.folder)}
}

function saveDMs(chat){
    const dmsData={folder:path.resolve(__dirname,"dms")}
    fs.mkdirSync(dmsData.folder,{recursive:true})
    return writeStoredChat(dmsData,chat)
}

function ensureChat(dmsData,a,b){
    const stored=getStoredChat(dmsData,a,b,true)
    return {...stored.meta,messages:readAllDmMessages(stored.folder)}
}

function appendStoredDmMessage(dmsData,a,b,message){
    const stored=getStoredChat(dmsData,a,b,true)
    const file=dmHourPath(stored.folder,message.time)
    const bucket=readJson(file,{hour:dmHourKey(message.time),messages:[]})
    if(!Array.isArray(bucket.messages)) bucket.messages=[]
    bucket.messages.push(message)
    writeJson(file,bucket)
    const meta=stored.meta
    meta.messageCount=Number(meta.messageCount||0)+1
    if(!meta.authorCounts || typeof meta.authorCounts!=="object") meta.authorCounts={}
    meta.authorCounts[a]=Number(meta.authorCounts[a]||0)+1
    meta.updatedAt=message.time
    if(!meta.lastRead || typeof meta.lastRead!=="object") meta.lastRead={}
    if(!meta.unreadCounts || typeof meta.unreadCounts!=="object") meta.unreadCounts={}
    const other=meta.users.find(name=>name!==a)
    if(other) meta.unreadCounts[other]=Number(meta.unreadCounts[other]||0)+1
    if(!Number.isFinite(Number(meta.unreadCounts[a]))) meta.unreadCounts[a]=0
    writeJson(dmMetaPath(stored.folder),meta)
    writeJson(dmPreviewPath(stored.folder),{message,messageCount:meta.messageCount,updatedAt:message.time})
    return {...meta,preview:{message,messageCount:meta.messageCount,updatedAt:message.time},folder:stored.folder}
}

function dmHourFileStartMs(file){
    const key=path.basename(file,".json")
    const iso=key.replace(/^(\d{4}-\d{2}-\d{2})-(\d{2})$/,"$1T$2:00:00.000Z")
    const time=Date.parse(iso)
    return Number.isFinite(time)?time:NaN
}

function getDmMessagesPage(folder,before=null,limit=50){
    const max=Math.max(1,Math.min(100,Number.parseInt(limit,10)||50))
    const beforeMs=before ? new Date(before).getTime() : Infinity
    const files=dmPartitionFiles(folder,true)
    const found=[]
    for(const file of files){
        const hourStart=dmHourFileStartMs(file)
        if(Number.isFinite(beforeMs)&&Number.isFinite(hourStart)&&hourStart>=beforeMs) continue
        const batch=readDmPartition(file)
        const eligible=batch.filter(message=>{
            const time=new Date(message.time||0).getTime()
            return Number.isFinite(time)&&time<beforeMs
        }).sort((a,b)=>new Date(b.time||0)-new Date(a.time||0))
        for(const message of eligible){
            found.push(message)
            if(found.length>max) break
        }
        if(found.length>max) break
    }
    const hasMore=found.length>max
    found.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0))
    const page=found.slice(0,max).reverse()
    return {messages:page,hasMore,nextBefore:page.length?page[0].time:null}
}

function unreadCount(chat,username){
    if(chat?.unreadCounts && Number.isFinite(Number(chat.unreadCounts[username]))) return Number(chat.unreadCounts[username])
    const lastRead=chat.lastRead?.[username] ? new Date(chat.lastRead[username]).getTime() : 0
    return (chat.messages||[]).filter(m=>new Date(m.time).getTime()>lastRead&&m.author!==username).length
}

function chatSummary(chat,username){
    const other=(chat.users||[]).find(u=>u!==username)||null
    const last=chat.preview?.message || chat.messages?.[(chat.messages||[]).length-1] || null
    return {
        id:chat.id,
        with:other,
        unread:unreadCount(chat,username),
        lastMessage:last?(last.text||""):(chat.preview?.lastMessage||""),
        lastAuthor:last?(last.author||""):(chat.preview?.lastAuthor||""),
        lastTime:last?last.time:(chat.updatedAt||chat.createdAt||null),
        messageCount:Number(chat.messageCount??chat.preview?.messageCount??chat.messages?.length??0)
    }
}

try{
    const dmStorage=loadDMs()
    const migration=readJson(path.join(dmStorage.folder,".legacy-migration-v1.json"),null)
    if(migration?.completed){
        console.log("DM STORAGE READY:",`${listStoredChats(dmStorage).length} conversations`,migration.migratedMessages!==undefined?`legacy messages checked: ${migration.migratedMessages}`:"")
    }else{
        console.log("DM STORAGE READY:",`${listStoredChats(dmStorage).length} conversations`)
    }
}catch(error){
    console.error("DM STORAGE INITIALIZATION ERROR:",error.message)
}

function pinnedDmsPath(username){
    return path.join(ensureUserFolder(username),"PinnedDms.json")
}

function loadPinnedDms(username){
    const file=pinnedDmsPath(username)
    if(!fs.existsSync(file)) writeJson(file,{pinned:[],updatedAt:new Date().toISOString()})
    const value=readJson(file,{pinned:[]})
    const list=Array.isArray(value)?value:(Array.isArray(value?.pinned)?value.pinned:[])
    return [...new Set(list.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()))]
}

function savePinnedDms(username,list){
    const friendsData=normalizeFriendsData(loadFriends())
    const friends=Array.isArray(friendsData.friends?.[username])?friendsData.friends[username]:[]
    const friendByLower=new Map(friends.map(name=>[String(name).toLowerCase(),name]))
    const normalized=[...new Set((Array.isArray(list)?list:[]).filter(x=>typeof x==="string").map(x=>friendByLower.get(x.trim().toLowerCase())).filter(Boolean))].slice(0,500)
    writeJson(pinnedDmsPath(username),{pinned:normalized,updatedAt:new Date().toISOString()})
    return normalized
}

function betaTesterUsernames(){
    const perms=loadPerms()
    const list=Array.isArray(perms?.permissions?.["Beta Tester"])?perms.permissions["Beta Tester"]:Array.isArray(perms?.["Beta Tester"])?perms["Beta Tester"]:[]
    return new Set(list.map(x=>String(x).toLowerCase()))
}

function betaTesterAdminAccounts(){
    const users=loadUsers()
    const byLower=new Map(Object.values(users).filter(user=>user&&safeUsername(user.username)).map(user=>[String(user.username).toLowerCase(),user]))
    const names=betaTesterUsernames()
    try{
        for(const entry of fs.readdirSync(USER_ROOT,{withFileTypes:true})){
            if(!entry.isDirectory()) continue
            const username=safeUsername(entry.name)
            if(!username) continue
            const file=path.join(USER_ROOT,username,"BetaTesterWorkspace.json")
            if(fs.existsSync(file)) names.add(username.toLowerCase())
        }
    }catch(err){
        console.error("BETA WORKSPACE DIRECTORY SCAN ERROR:",err.message)
    }
    const unique=new Map()
    for(const name of names){
        const user=byLower.get(String(name).toLowerCase())
        if(user) unique.set(String(user.username).toLowerCase(),user)
    }
    return [...unique.values()].sort((a,b)=>String(a.username).localeCompare(String(b.username)))
}

function friendBadgesFor(username){
    const badges=[]
    const normalized=String(username||"").trim().toLowerCase()
    if(betaTesterUsernames().has(normalized)) badges.push({name:"Beta Tester",role:"betaTester",icon:"flask-conical",color:"#b69aff"})
    const permissions=loadPerms()?.permissions||{}
    const staffRoles=[
        {name:"Administrator",icon:"crown",color:"#f5c451"},
        {name:"Support",icon:"headset",color:"#52d9ff"},
        {name:"Moderator",icon:"shield-check",color:"#70dfa0"}
    ]
    for(const role of staffRoles){
        const members=Array.isArray(permissions[role.name])?permissions[role.name]:[]
        if(members.some(name=>String(name||"").trim().toLowerCase()===normalized)){
            badges.push({name:role.name,role:role.name,icon:role.icon,color:role.color})
        }
    }
    return badges
}

function loginHistoryPath(username){
return path.join(ensureUserFolder(username),"LoginHistory.json")
}

function unreadCount(chat,username){
    if(chat?.unreadCounts && Number.isFinite(Number(chat.unreadCounts[username]))) return Number(chat.unreadCounts[username])
    const lastRead=chat?.lastRead?.[username] ? new Date(chat.lastRead[username]).getTime() : 0
    return (chat.messages||[]).filter(message=>new Date(message.time||0).getTime()>lastRead&&message.author!==username).length
}

function chatSummary(chat,username){
    const other=(chat.users||[]).find(user=>String(user).toLowerCase()!==String(username||"").toLowerCase())||null
    const last=chat.preview?.message||(chat.messages||[])[(chat.messages||[]).length-1]||null
    return {
        id:chat.id,
        with:other,
        unread:unreadCount(chat,username),
        lastMessage:last?String(last.text||last.message||""):(chat.preview?.lastMessage||""),
        lastAuthor:last?String(last.author||last.sender||""):(chat.preview?.lastAuthor||""),
        lastTime:last?.time||chat.preview?.updatedAt||chat.updatedAt||chat.createdAt||null,
        messageCount:Number(chat.messageCount??chat.preview?.messageCount??chat.messages?.length??0)
    }
}

app.use((req,res,next)=>{
logAction("request",{
url:req.url,
method:req.method,
ip:req.headers["x-forwarded-for"]||req.socket.remoteAddress,
time:new Date().toISOString()
})
next()
})

function migrateLegacyUsers(){

if(!fs.existsSync(LEGACY_USERDATA)) return

const legacy=readJson(LEGACY_USERDATA,{})

if(!legacy || typeof legacy!=="object") return

for(const [username,raw] of Object.entries(legacy)){

if(!raw || typeof raw!=="object"){
console.log("MIGRATION SKIPPED INVALID USER DATA:",username)
continue
}

const actualUsername=String(raw.username || username || "").trim()

if(!actualUsername){
console.log("MIGRATION SKIPPED EMPTY USERNAME:",{
key:username,
raw
})
continue
}

let folder

try{

folder=ensureUserFolder(actualUsername)

}catch(err){

console.log("MIGRATION FAILED FOR USER:",{
key:username,
actualUsername,
rawUsername:raw.username,
error:err.message
})

continue

}

console.log("MIGRATING USER:",actualUsername)

const user=cloneJson(raw)

const oldPasswords=Array.isArray(user.oldPasswords) ? user.oldPasswords : [];
const loginHistory=Array.isArray(user.loginHistory) ? user.loginHistory : [];
const wallet=normalizeWallet(user.wallet);
const gameStats=normalizeGameStats(user.gameStats)
const cloudLogs=Array.isArray(user.cloudLogs)?user.cloudLogs:[]

delete user.oldPasswords;
delete user.loginHistory;
delete user.wallet;
delete user.gameStats
delete user.cloudLogs

if(!fs.existsSync(path.join(folder,"UserData.json"))){
writeJson(
path.join(folder,"UserData.json"),
user
)
}

if(!fs.existsSync(path.join(folder,"PasswordHistory.json"))){
writeJson(
path.join(folder,"PasswordHistory.json"),
{
history:oldPasswords.map((password,i)=>({
password:String(password),
changedAt:null,
index:i,
source:"legacy"
}))
}
)
}

if(!fs.existsSync(path.join(folder,"LoginHistory.json"))){
writeJson(
path.join(folder,"LoginHistory.json"),
{
history:loginHistory
}
)
}

if(!fs.existsSync(path.join(folder,"Wallet.json"))){
writeJson(
path.join(folder,"Wallet.json"),
wallet
)
}

if(!fs.existsSync(path.join(folder,"TicTacToe.json"))){
writeJson(
path.join(folder,"TicTacToe.json"),
{
...gameStats.tictactoe
}
)
}

if(!fs.existsSync(path.join(folder,"FourInARow.json"))){
writeJson(
path.join(folder,"FourInARow.json"),
{
...gameStats.connect4
}
)
}

if(cloudLogs.length){

const logFolder=cloudLogsRoot(actualUsername)

fs.mkdirSync(logFolder,{
recursive:true
})

const file=path.join(
logFolder,
"legacy.json"
)

if(!fs.existsSync(file)){
writeJson(file,cloudLogs)
}

}

}

try{

fs.renameSync(
LEGACY_USERDATA,
LEGACY_USERDATA+".backup"
)

console.log("USER MIGRATION COMPLETE")

}catch(err){

console.log("COULD NOT RENAME LEGACY USERDATA:",err.message)

}

}

function migrateLegacyCloudMetadata() {
    const legacy = path.join(__dirname, "cloudMetadata.json");
    if (!fs.existsSync(legacy)) return;
    const data = readJson(legacy, {});
    if (fs.existsSync(USER_ROOT)) {
        for (const entry of fs.readdirSync(USER_ROOT, { withFileTypes:true })) {
            if (!entry.isDirectory()) continue;
            const username = entry.name;
            const core = readJson(path.join(USER_ROOT, username, "UserData.json"), null);
            if (!core?.cloudId || !data[core.cloudId]) continue;
            const file = path.join(USER_ROOT, username, "Cloud", "Metadata.json");
            if (!fs.existsSync(file)) writeJson(file, data[core.cloudId]);
        }
    }
    try { fs.renameSync(legacy, legacy + ".backup"); } catch {}
}

function setUserAuxValue(username, field, value) {
    const key = String(username || "");
    if (field === "wallet") {
        USER_AUX_CACHE.set(key + ":wallet", normalizeWallet(value));
        USER_AUX_CACHE.delete(key + ":wallet:serialized");
        return;
    }
    if (field === "gameStats") {
        USER_AUX_CACHE.set(key + ":gamestats", normalizeGameStats(value));
        USER_AUX_CACHE.delete(key + ":gamestats:tt");
        USER_AUX_CACHE.delete(key + ":gamestats:c4");
        return;
    }
    if (field === "passwordHistory") {
        USER_AUX_CACHE.set(key + ":passwordHistory", normalizePasswordHistory(value));
        USER_AUX_CACHE.delete(key + ":passwordHistory:serialized");
        return;
    }
    if (field === "loginHistory") {
        USER_AUX_CACHE.set(key + ":loginHistory", Array.isArray(value) ? value : []);
        USER_AUX_CACHE.delete(key + ":loginHistory:serialized");
    }
}

function hydrateUser(username, core) {
    const user = core && typeof core === "object" ? core : {};
    const loadedFields = new Set();
    USER_AUX_LOADED.set(user, loadedFields);
    const fields = {
        wallet: () => loadWallet(username),
        gameStats: () => loadGameStatsFile(username),
        passwordHistory: () => loadPasswordHistory(username),
        loginHistory: () => loadLoginHistory(username)
    };
    for (const [field, loader] of Object.entries(fields)) {
        Object.defineProperty(user, field, {
            enumerable: true,
            configurable: true,
            get() {
                loadedFields.add(field);
                return loader();
            },
            set(value) {
                loadedFields.add(field);
                setUserAuxValue(username, field, value);
            }
        });
    }
    return user;
}

function isUserAuxLoaded(user, field) {
    const loaded = user && USER_AUX_LOADED.get(user);
    if (loaded?.has(field)) return true;
    const descriptor = user && Object.getOwnPropertyDescriptor(user, field);
    return !!descriptor && typeof descriptor.get !== "function";
}

function getLoginHistoryFile(username){
return loginHistoryPath(username)
}

function loadLoginHistory(username){
const key=String(username||"")+":loginHistory"
if(USER_AUX_CACHE.has(key)) return USER_AUX_CACHE.get(key)
const data=readJson(loginHistoryPath(username),{history:[]})
const history=Array.isArray(data)?data:(Array.isArray(data?.history)?data.history:[])
USER_AUX_CACHE.set(key,history)
USER_AUX_CACHE.set(key+":serialized",JSON.stringify({history},null,2))
return history
}

function saveLoginHistory(username,history){
const key=String(username||"")+":loginHistory"
const normalized=Array.isArray(history)?history:[]
const serialized=JSON.stringify({history:normalized},null,2)
if(USER_AUX_CACHE.get(key+":serialized")!==serialized){
writeJson(loginHistoryPath(username),{history:normalized})
USER_AUX_CACHE.set(key+":serialized",serialized)
}
USER_AUX_CACHE.set(key,normalized)
}

function loadUsers(){
    migrateLegacyUsers();

    if (USERS_CACHE_COMPLETE) return Object.fromEntries(USERS_CACHE);

    if(!fs.existsSync(USER_ROOT)){
        fs.mkdirSync(USER_ROOT,{recursive:true});
    }

    for(const entry of fs.readdirSync(USER_ROOT,{withFileTypes:true})){

        if(!entry.isDirectory()) continue;

        const username=entry.name;

        const file=path.join(
            USER_ROOT,
            username,
            "UserData.json"
        );

        if(!fs.existsSync(file)) continue;

        const core=readJson(file,null);

        if(!core || typeof core!=="object") continue;

        const user = hydrateUser(username, core);
        const actualUsername = user.username || username;
        if (user.sessionToken) SESSION_TOKEN_INDEX.set(String(user.sessionToken), actualUsername);

        USERS_CACHE.set(
            actualUsername,
            user
        );

        USER_FILE_CACHE.set(actualUsername, userFileFingerprint(stripUserData(user)));
    }

    USERS_CACHE_COMPLETE = true;
    return Object.fromEntries(USERS_CACHE);
}

function stripUserData(user) {
    const core = {};
    for (const key of Object.keys(user || {})) {
        if (USER_DATA_EXCLUDED_FIELDS.has(key)) continue;
        core[key] = user[key];
    }
    return core;
}
function loadUserRecord(username) {
    const safe = safeUsername(username);
    if (!safe) return null;
    const cachedExact = USERS_CACHE.get(safe);
    if (cachedExact) return cachedExact;
    const targetLower = safe.toLowerCase();
    for (const cached of USERS_CACHE.values()) {
        if (String(cached?.username || "").toLowerCase() === targetLower) return cached;
    }
    let folderName = safe;
    let file = path.join(USER_ROOT, folderName, "UserData.json");
    let core = fs.existsSync(file) ? readJson(file, null) : null;
    if (!core || typeof core !== "object" || String(core.username || folderName).toLowerCase() !== targetLower) {
        core = null;
        if (fs.existsSync(USER_ROOT)) {
            for (const entry of fs.readdirSync(USER_ROOT, { withFileTypes:true })) {
                if (!entry.isDirectory()) continue;
                const candidate = path.join(USER_ROOT, entry.name, "UserData.json");
                if (!fs.existsSync(candidate)) continue;
                const data = readJson(candidate, null);
                if (data && typeof data === "object" && String(data.username || entry.name).toLowerCase() === targetLower) {
                    folderName = entry.name;
                    file = candidate;
                    core = data;
                    break;
                }
            }
        }
    }
    if (!core || typeof core !== "object") return null;
    const actualUsername = String(core.username || folderName);
    const user = hydrateUser(folderName, core);
    USERS_CACHE.set(actualUsername, user);
    USER_FILE_CACHE.set(actualUsername, userFileFingerprint(stripUserData(user)));
    if (user.sessionToken) SESSION_TOKEN_INDEX.set(String(user.sessionToken), actualUsername);
    return user;
}

function listPublicUsers(excludeUsername) {
    const users = [];
    if (!fs.existsSync(USER_ROOT)) return users;
    for (const entry of fs.readdirSync(USER_ROOT, { withFileTypes:true })) {
        if (!entry.isDirectory()) continue;
        const core = readJson(path.join(USER_ROOT, entry.name, "UserData.json"), null);
        if (!core || typeof core !== "object") continue;
        const username = String(core.username || entry.name);
        if (!username || username === excludeUsername || core.banned || core.disabled) continue;
        users.push({ username, id:core.id || null });
    }
    users.sort((a, b) => a.username.localeCompare(b.username));
    return users;
}

function saveUsers(d){
    const current=d && typeof d === "object" ? d : {};
    const nextNames=new Set(Object.keys(current));
    for(const oldName of USERS_CACHE.keys()){
        if(!nextNames.has(oldName)){
            const folder=userFolder(oldName);
            if(folder && fs.existsSync(folder)) fs.rmSync(folder,{recursive:true,force:true});
            USERS_CACHE.delete(oldName);
            USER_FILE_CACHE.delete(oldName);
            for(const suffix of [":wallet",":gamestats",":passwordHistory",":loginHistory",":wallet:serialized",":gamestats:tt",":gamestats:c4",":passwordHistory:serialized",":loginHistory:serialized"]) USER_AUX_CACHE.delete(oldName+suffix);
            dropHalloweenCollectionCache(oldName);
            COLLECTIBLES_NORMALIZED_USERS.delete(oldName);
            invalidateCollectibleCopyIndexes(oldName);
        }
    }
    for(const [key,raw] of Object.entries(current)){
        if(!raw || typeof raw !== "object") continue;
        const username=String(raw.username || key).trim();
        const priorKey = key!==username && USERS_CACHE.has(key) ? key : username;
        if(key!==username && USERS_CACHE.has(key)){
            const oldFolder=userFolder(key);
            const newFolder=userFolder(username);
            if(oldFolder && newFolder && oldFolder!==newFolder && fs.existsSync(oldFolder) && !fs.existsSync(newFolder)){
                fs.renameSync(oldFolder,newFolder);
            }
            USERS_CACHE.delete(key);
            USER_FILE_CACHE.delete(key);
            for(const suffix of [":wallet",":gamestats",":passwordHistory",":loginHistory",":wallet:serialized",":gamestats:tt",":gamestats:c4",":passwordHistory:serialized",":loginHistory:serialized"]) USER_AUX_CACHE.delete(key+suffix);
        }
        const core=stripUserData(raw);
        const serialized=JSON.stringify(core,null,2);
        const fingerprint=userFileFingerprint(core);
        if(USER_FILE_CACHE.get(username)!==fingerprint) writeJson(path.join(ensureUserFolder(username),"UserData.json"),core);
        USER_FILE_CACHE.set(username,fingerprint);
        if (isUserAuxLoaded(raw, "wallet")) saveWallet(username, raw.wallet);
        if (isUserAuxLoaded(raw, "gameStats")) saveGameStatsFile(username, raw.gameStats);
        if (isUserAuxLoaded(raw, "passwordHistory")) savePasswordHistory(username, raw.passwordHistory);
        if (isUserAuxLoaded(raw, "loginHistory")) saveLoginHistory(username, raw.loginHistory);
        const oldCachedUser = USERS_CACHE.get(priorKey) || USERS_CACHE.get(username);
        if (oldCachedUser?.sessionToken && oldCachedUser.sessionToken !== core.sessionToken) SESSION_TOKEN_INDEX.delete(String(oldCachedUser.sessionToken));
        if (core.sessionToken) SESSION_TOKEN_INDEX.set(String(core.sessionToken), username);
        USERS_CACHE.set(username, hydrateUser(username, core));
    }
}

function ensureUserIds() {
    if (!fs.existsSync(USER_ROOT)) fs.mkdirSync(USER_ROOT, { recursive:true });
    const missingUsers = [];
    let maxId = 0;
    SESSION_TOKEN_INDEX.clear();
    for (const entry of fs.readdirSync(USER_ROOT, { withFileTypes:true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(USER_ROOT, entry.name, "UserData.json");
        if (!fs.existsSync(file)) continue;
        const user = readJson(file, null);
        if (!user || typeof user !== "object") continue;
        const username = String(user.username || entry.name);
        if (user.sessionToken) SESSION_TOKEN_INDEX.set(String(user.sessionToken), username);
        const id = Number(user.id);
        if (Number.isSafeInteger(id) && id > 0) maxId = Math.max(maxId, id);
        else missingUsers.push({ file, username, createdAt:new Date(user.createdAt || 0).getTime() || 0 });
    }
    missingUsers.sort((a, b) => a.createdAt - b.createdAt);
    for (const missing of missingUsers) {
        const user = readJson(missing.file, null);
        if (!user || typeof user !== "object") continue;
        user.id = ++maxId;
        writeJson(missing.file, user);
        if (user.sessionToken) SESSION_TOKEN_INDEX.set(String(user.sessionToken), missing.username);
        USER_FILE_CACHE.delete(missing.username);
        const cached = USERS_CACHE.get(missing.username);
        if (cached) cached.id = user.id;
    }
}

async function sendPhoneNotification(username, title, body, senderUsername){
try{
const users=loadUsers()
const user=users[username]
if(!user || !Array.isArray(user.devices)) return
for(const deviceToken of user.devices){
try{
await getMessaging().send({token:deviceToken,data:{title,body,username: senderUsername},android:{priority:"high"}})
}catch(err){console.log("FCM FAILED",username,err.message)}
}
}catch(err){console.log("NOTIFICATION ERROR",err)}
}

migrateLegacyUsers();

ensureUserIds();

migrateLegacyCloudMetadata();

function loadQuests(){
  try{
    const data = JSON.parse(fs.readFileSync("quests.json"))
    return data.quests || []
  }catch{
    return []
  }
}

function generateCode(){

let code=""

do{

code=Math.floor(
10000000 + Math.random()*90000000
).toString()

}while(
Object.values(loadUsers()).find(u=>u.code===code) ||
robloxLinkTokens.has(code)
)

return code
}

function generateLinkCode(){

const words=[
"pink","ocean","apple","galaxy","dream","shadow","cloud","river",
"sunset","forest","cookie","storm","crystal","dragon","berry","flame",
"ghost","night","light","wolf","tiger","rain","snow","mint",
"banana","grape","pearl","silver","gold","space","star","moon",
"lava","ice","fire","water","wind","frog","panda","music",
"magic","pixel","happy","dark","blue","green","purple","orange",
"neon","cyber","silent","alpha","omega","emerald","ruby","diamond",
"falcon","hunter","legend","phantom","spirit","thunder","venom","vortex",
"matrix","future","cosmic","ninja","wizard","knight","rocket","comet"
]

const pick=()=>words[Math.floor(Math.random()*words.length)]

let code=""

do{

code=[
pick(),pick(),pick(),pick(),
pick(),pick(),pick(),pick()
].join("-")

}while(
Object.values(loadUsers()).find(u=>u.linkCode===code) ||
robloxLinkTokens.has(code)
)

return code
}

const SESSION_USER_CACHE = new Map();

function auth(req) {
  let token = req.headers.authorization || req.headers.Authorization;
  if (Array.isArray(token)) token = token[0];
  token = String(token || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
  if (!token) return null;

  const cachedUsername = SESSION_USER_CACHE.get(token) || SESSION_TOKEN_INDEX.get(token);
  if (cachedUsername) {
      const cachedUser = USERS_CACHE.get(cachedUsername);
      if (cachedUser && cachedUser.sessionToken === token) {
          SESSION_USER_CACHE.set(token, cachedUsername);
          return cachedUser;
      }
      const file = path.join(USER_ROOT, cachedUsername, "UserData.json");
      const core = readJson(file, null);
      if (core && core.sessionToken === token) {
          const user = hydrateUser(cachedUsername, core);
          USERS_CACHE.set(cachedUsername, user);
          USER_FILE_CACHE.set(cachedUsername, userFileFingerprint(stripUserData(user)));
          SESSION_USER_CACHE.set(token, cachedUsername);
          while (SESSION_USER_CACHE.size > 2048) SESSION_USER_CACHE.delete(SESSION_USER_CACHE.keys().next().value);
          return user;
      }
      SESSION_USER_CACHE.delete(token);
      SESSION_TOKEN_INDEX.delete(token);
  }

  if (USERS_CACHE_COMPLETE) {
      for (const user of USERS_CACHE.values()) {
          if (user.sessionToken === token) {
              SESSION_USER_CACHE.set(token, user.username);
              while (SESSION_USER_CACHE.size > 2048) SESSION_USER_CACHE.delete(SESSION_USER_CACHE.keys().next().value);
              return user;
          }
      }
  }
  return null;
}

function formatRemaining(ms){
  let s=Math.floor(ms/1000)
  const d=Math.floor(s/86400); s%=86400
  const h=Math.floor(s/3600); s%=3600
  const m=Math.floor(s/60); s%=60
  return `${d}D ${h}H ${m}M ${s}S`
}

function isBanned(user,users){
  if(!user.banned) return false
  if(user.banExpires && Date.now()>user.banExpires){
    user.banned=false
    user.banReason=null
    user.banExpires=null
    saveUsers(users)
    return false
  }
  return true
}

function addNotification(ticket,target,message){
if(!ticket.notifications){
ticket.notifications={}
}

if(!ticket.notifications[target]){
ticket.notifications[target]=[]
}

ticket.notifications[target].push({
id:crypto.randomBytes(8).toString("hex"),
message,
ticketId:ticket.id,
time:new Date().toISOString(),
seen:false
})
}

const TICKET_ROOT=path.join(__dirname,"Tickets")

function ticketFolder(ticketId){
return path.join(TICKET_ROOT,String(ticketId))
}

function ticketJsonPath(ticketId){
return path.join(ticketFolder(ticketId),"ticket.json")
}

function ticketInfoPath(ticketId){
return path.join(ticketFolder(ticketId),"Information.txt")
}

function ensureTicketFolder(ticketId){
const folder=ticketFolder(ticketId)
fs.mkdirSync(folder,{recursive:true})
return folder
}

function writeTicketInformation(ticket){
const messages=Array.isArray(ticket.messages)?ticket.messages:[]
const notifications=ticket.notifications && typeof ticket.notifications==="object"
?Object.values(ticket.notifications).reduce((count,list)=>count+(Array.isArray(list)?list.length:0),0)
:0

const lines=[
`Ticket ID: ${ticket.id || "Unknown"}`,
`Created by: ${ticket.owner || "Unknown"}`,
`Title: ${ticket.title || "Untitled"}`,
`Status: ${ticket.status || "Unknown"}`,
`Locked: ${ticket.locked ? "Yes" : "No"}`,
`Created at: ${ticket.createdAt || "Unknown"}`,
`Closed at: ${ticket.closedAt || "Not closed"}`,
`Reason: ${ticket.reason || "No reason provided"}`,
`Information: ${ticket.info || "No additional information"}`,
`Messages: ${messages.length}`,
`Notifications: ${notifications}`
]

fs.writeFileSync(ticketInfoPath(ticket.id),lines.join("\n"))
}

function saveTicket(ticket){
if(!ticket || !ticket.id) return
ensureTicketFolder(ticket.id)
writeJson(ticketJsonPath(ticket.id),ticket)
writeTicketInformation(ticket)
}

function loadTicket(ticketId){
const file=ticketJsonPath(ticketId)
if(!fs.existsSync(file)) return null
const ticket=readJson(file,null)
if(!ticket || typeof ticket!=="object") return null
return ticket
}

function migrateLegacyTickets(){
const legacyFile=path.join(__dirname,"tickets.json")
if(!fs.existsSync(legacyFile)) return

const legacy=readJson(legacyFile,[])
if(!Array.isArray(legacy)) return

fs.mkdirSync(TICKET_ROOT,{recursive:true})

for(const ticket of legacy){
if(!ticket || !ticket.id) continue
if(!fs.existsSync(ticketJsonPath(ticket.id))){
saveTicket(ticket)
}
}

try{
fs.renameSync(legacyFile,legacyFile+".backup")
}catch{}
}

function loadTickets(){
migrateLegacyTickets()
fs.mkdirSync(TICKET_ROOT,{recursive:true})

const tickets=[]

for(const entry of fs.readdirSync(TICKET_ROOT,{withFileTypes:true})){
if(!entry.isDirectory()) continue
const ticket=loadTicket(entry.name)
if(ticket) tickets.push(ticket)
}

return tickets
}

function saveTickets(d){
if(!Array.isArray(d)) return
fs.mkdirSync(TICKET_ROOT,{recursive:true})

for(const ticket of d){
saveTicket(ticket)
}
}

function generateTicketId(){
let id
do{
id=crypto.randomBytes(8).toString("hex")
}while(fs.existsSync(ticketFolder(id)))
return id
}

let PERMISSIONS_CACHE = null;
let PERMISSIONS_CACHE_MTIME = -1;
let PERMISSIONS_CACHE_SIZE = -1;

function loadPerms(){
    const file=path.join(__dirname,"permissions.json");
    try{
        const stat=fs.statSync(file);
        if(PERMISSIONS_CACHE && PERMISSIONS_CACHE_MTIME===stat.mtimeMs && PERMISSIONS_CACHE_SIZE===stat.size) return PERMISSIONS_CACHE;
        const data=JSON.parse(fs.readFileSync(file,"utf8"));
        if(!data.permissions) data.permissions={};
        for(const role of ["Support","Administrator","VIP","Family","Moderator"]){
            if(!Array.isArray(data.permissions[role])) data.permissions[role]=[];
        }
        PERMISSIONS_CACHE=data;
        PERMISSIONS_CACHE_MTIME=stat.mtimeMs;
        PERMISSIONS_CACHE_SIZE=stat.size;
        return data;
    }catch{
        return {
            permissions:{
                Support:[],
                Administrator:[],
                VIP:[],
                Family:[],
                Moderator:[],
                "Beta Tester":[]
            }
        };
    }
}


app.get("/site/messages",(req,res)=>{
    try{
        const messages=activeSiteMessages().map(m=>({
            id:m.id,
            title:m.title||"Zyphor",
            message:m.message||"",
            type:m.type||"info",
            startAt:m.startAt||null,
            endAt:m.endAt||null,
            createdAt:m.createdAt||null,
            createdBy:m.createdBy||null,
            pinned:m.pinned===true
        }))
        res.json({success:true,messages})
    }catch(err){
        res.status(500).json({success:false,error:"server"})
    }
})

app.use((req,res,next)=>{
    const token=String(req.headers.authorization||req.headers.Authorization||"").replace(/^Bearer\\s+/i,"").trim()
    if(!token) return next()
    const publicPaths=new Set(["/me","/login","/signup","/password-reset","/password-reset/change","/password-reset/request","/site/messages","/favicon.ico"])
    if(publicPaths.has(req.path)) return next()
    const user=auth(req)
    if(!user) return next()
    const users=loadUsers()
    if(isBanned(user,users)){
        const remaining=user.banExpires ? Math.max(0,user.banExpires-Date.now()) : null
        return res.status(403).json({
            success:false,
            banned:true,
            reason:user.banReason||"No reason provided",
            message:user.banMessage||user.banReason||"Your account has been banned.",
            expiresAt:user.banExpires ? new Date(user.banExpires).toISOString() : null,
            remaining
        })
    }
    const settings=loadSystemSettings()
    if(settings.maintenance && !hasAdmin(user) && !req.path.startsWith("/admin/")) return res.status(503).json({success:false,error:"maintenance",message:"Zyphor is temporarily under maintenance."})
    if(settings.readOnly && ["POST","PUT","PATCH","DELETE"].includes(req.method) && !hasAdmin(user)) return res.status(423).json({success:false,error:"read_only",message:"Zyphor is currently in read-only mode."})
    next()
})

app.post("/signup",(req,res)=>{
try{
const settings=loadSystemSettings()
if(settings.registrationLocked) return res.status(423).json({error:"registration_locked",message:"New registrations are temporarily disabled."})
const {username,password}=req.body

if(!username||username.length<3) return res.json({error:"username"})
if(username.length>40) return res.json({error:"toolong"})
if(/https?:\/\/|www\./i.test(username)) return res.json({error:"linknotallowed"})
if(!password||password.length<4) return res.json({error:"password"})

const users=loadUsers()

if(users[username]) return res.json({error:"exists"})

const existingIds=Object.values(users)
.map(user=>Number(user.id))
.filter(id=>Number.isInteger(id)&&id>0)

const id=existingIds.length?Math.max(...existingIds)+1:1
const ip=getIP(req)

users[username]={
id,
username,
password,
sessionToken:null,
banned:false,
banReason:null,
banMessage:null,
banExpires:null,
linkedDiscord:null,
linkCode:generateLinkCode(),
completedQuests:[],
createdAt:new Date().toISOString(),
lastActiveAt:new Date().toISOString(),
squirtleEventActiveAt:null,
createdIP:ip,
questHistory:[],
loginHistory:[]
}

saveUsers(users)
ensureUserBadges(username)

res.json({
success:true,
id
})
}catch(err){
console.error(err)
res.status(500).json({error:"server"})
}
})


app.get("/admin/all-page-history",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const logs=loadPageLogs()

res.json(logs)
})

app.get("/admin/schedule/all",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

let data=loadSchedule()

res.json({
slots: data.slots || {},
booked: data.booked || {}
})
})

function cloudLogFileFor(username, date=new Date()){
    const dk=new Date(date.toLocaleString("en-US",{timeZone:"Europe/Copenhagen"}));
    const day=String(dk.getDate()).padStart(2,"0");
    const month=String(dk.getMonth()+1).padStart(2,"0");
    const year=String(dk.getFullYear());
    const hour=String(dk.getHours()).padStart(2,"0");
    return path.join(cloudLogsRoot(username),`${day}-${month}-${year}-${hour}.json`);
}

function addCloudLog(user,type,data){
    const file=cloudLogFileFor(user.username);
    const logs=readJson(file,[]);
    const entry={type,time:new Date().toISOString(),ip:(user.username==="BossSquirtle"?"PROTECTED":(data.ip||null)),file:data.file||null,size:data.size||null,target:data.target||null};
    logs.push(entry);
    if(logs.length>5000) logs.splice(0,logs.length-5000);
    writeJson(file,logs);
}

app.post("/account/add-email",async(req,res)=>{

try{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

const {email}=req.body

if(!email)
return res.json({error:"missing"})

const cleanEmail=String(email).trim().toLowerCase()

if(
!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
){
return res.json({error:"invalidemail"})
}

const users=loadUsers()

const taken=Object.values(users).find(u=>
u.email &&
String(u.email).toLowerCase()===cleanEmail &&
u.username!==user.username
)

if(taken)
return res.json({error:"emailused"})

const verifyCode=Math.floor(
100000+Math.random()*900000
).toString()

user.pendingEmail=cleanEmail
user.emailVerifyCode=verifyCode
user.emailVerifyExpires=Date.now()+15*60*1000

users[user.username]=user

saveUsers(users)

try{

await fetch("https://api.resend.com/emails",{
method:"POST",
headers:{
"Authorization":"Bearer "+(process.env.RESEND_API_KEY || ""),
"Content-Type":"application/json"
},
body:JSON.stringify({
from:"Zyphor <verify@auth.zyphor.cc>",
to:[cleanEmail],
subject:"Verify your email",
text:`Your Zyphor verification code is ${verifyCode}`
})
})

}catch(err){

console.error(err)

return res.json({error:"emailsendfailed"})

}

res.json({
success:true
})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}

})

app.post("/account/verify-email",(req,res)=>{

try{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

const {code}=req.body

if(!code)
return res.json({error:"missing"})

const users=loadUsers()

if(!user.emailVerifyCode)
return res.json({error:"nocode"})

if(Date.now()>user.emailVerifyExpires){

user.pendingEmail=null
user.emailVerifyCode=null
user.emailVerifyExpires=null

users[user.username]=user

saveUsers(users)

return res.json({error:"expired"})

}

if(String(user.emailVerifyCode)!==String(code).trim())
return res.json({error:"wrongcode"})

user.email=user.pendingEmail

user.pendingEmail=null
user.emailVerifyCode=null
user.emailVerifyExpires=null
user.emailVerifiedAt=new Date().toISOString()

users[user.username]=user

saveUsers(users)

res.json({
success:true,
email:user.email
})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}

})


app.post("/2fa/verify",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {code}=req.body

const entry=loginCodes.get(user.username)

if(!entry) return res.json({error:"nocode"})
if(Date.now()>entry.expires) return res.json({error:"expired"})
if(entry.code!==code) return res.json({error:"wrong"})

user.twofa=true

const users=loadUsers()
users[user.username]=user
saveUsers(users)

loginCodes.delete(user.username)

res.json({success:true})
})

app.post("/2fa/toggle",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {enabled}=req.body

if(enabled && !user.email)
return res.json({error:"noemail"})

user.twofa=enabled

const users=loadUsers()
users[user.username]=user
saveUsers(users)

res.json({success:true})
})

app.post("/2fa/login",(req,res)=>{
const {username,code}=req.body

const data=loginCodes.get(username)
if(!data) return res.json({error:"nocode"})
if(Date.now()>data.expires) return res.json({error:"expired"})
if(data.code!==code) return res.json({error:"wrong"})

const users=loadUsers()
const user=users[username]

user.sessionToken=generateToken()
saveUsers(users)

loginCodes.delete(username)

res.json({token:user.sessionToken})
})

if(!fs.existsSync("pageLogs.json")) fs.writeFileSync("pageLogs.json",JSON.stringify({}))

function loadPageLogs(){
try{return JSON.parse(fs.readFileSync("pageLogs.json"))}
catch{return {}}
}

function savePageLogs(d){
fs.writeFileSync("pageLogs.json",JSON.stringify(d,null,2))
}

const visitCooldown = new Map()

app.post("/track/page",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {page}=req.body
if(!page) return res.json({error:"nopage"})

const key=user.username+"_"+page
const now=Date.now()

if(visitCooldown.has(key)){
if(now-visitCooldown.get(key)<5000){
return res.json({success:true})
}
}

visitCooldown.set(key,now)

let logs=loadPageLogs()

if(!logs[user.username]) logs[user.username]=[]

logs[user.username].push({
page,
time:new Date().toISOString()
})

savePageLogs(logs)

res.json({success:true})
})

const SUGGESTIONS_FILE = path.join(__dirname,"Suggestions.json")

function loadSuggestions(){
    try{
        if(!fs.existsSync(SUGGESTIONS_FILE)){
            fs.writeFileSync(
                SUGGESTIONS_FILE,
                JSON.stringify({suggestions:[]},null,2)
            )
        }

        const data=JSON.parse(
            fs.readFileSync(SUGGESTIONS_FILE,"utf8")
        )

        if(!data || typeof data!=="object"){
            return {suggestions:[]}
        }

        if(!Array.isArray(data.suggestions)){
            data.suggestions=[]
        }

        return data
    }catch{
        return {suggestions:[]}
    }
}

function saveSuggestions(data){
    writeJson(SUGGESTIONS_FILE,data)
}

app.post("/suggestions",(req,res)=>{
    try{
        const user=auth(req)

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            })
        }

        const suggestion=String(
            req.body.suggestion || ""
        ).trim()

        if(!suggestion){
            return res.status(400).json({
                success:false,
                error:"empty"
            })
        }

        if(suggestion.length>5000){
            return res.status(400).json({
                success:false,
                error:"too_long"
            })
        }

        const data=loadSuggestions()

        const entry={
            id:crypto.randomBytes(12).toString("hex"),
            username:user.username,
            suggestion,
            createdAt:new Date().toISOString()
        }

        data.suggestions.unshift(entry)

        if(data.suggestions.length>5000){
            data.suggestions.length=5000
        }

        saveSuggestions(data)

        res.json({
            success:true,
            id:entry.id
        })
    }catch(err){
        console.error("SUGGESTION ERROR:",err)
        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.get("/admin/suggestions",(req,res)=>{
    try{
        const user=auth(req)

        if(!user || !hasAdmin(user)){
            return res.sendStatus(403)
        }

        const data=loadSuggestions()

        res.json({
            success:true,
            suggestions:data.suggestions
        })
    }catch(err){
        console.error("ADMIN SUGGESTIONS ERROR:",err)
        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.post("/webhooks/komerza",express.json(),async(req,res)=>{

try{

const event=req.body || {}

const type=
event.event ||
event.type ||
""

if(type!=="order.completed"){
return res.sendStatus(200)
}

const order=
event.data ||
event.order ||
{}

const customerEmail=String(
order.customerEmail ||
order.email ||
order.customer?.email ||
""
).trim().toLowerCase()

if(!customerEmail){
return res.sendStatus(400)
}

const users=loadUsers()

const user=Object.values(users).find(u=>
String(u.email || "")
.trim()
.toLowerCase()===customerEmail
)

if(!user){
return res.sendStatus(404)
}

const perms=loadPerms()

if(!perms.permissions.VIP){
perms.permissions.VIP=[]
}

if(
!perms.permissions.VIP.includes(user.username)
){

perms.permissions.VIP.push(user.username)

fs.writeFileSync(
"permissions.json",
JSON.stringify(perms,null,2)
)

}

user.vip=true
user.vipSince=new Date().toISOString()

users[user.username]=user

saveUsers(users)

logAction("vip_purchase",{
username:user.username,
email:customerEmail,
orderId:order.id || null,
time:new Date().toISOString()
})

res.json({
success:true,
granted:"VIP",
username:user.username
})

}catch(err){

console.error(err)

res.sendStatus(500)

}

})

app.get("/admin/page-history",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {username}=req.query

let logs=loadPageLogs()

res.json(logs[username] || [])
})

if(!fs.existsSync("changelogs.json")) fs.writeFileSync("changelogs.json",JSON.stringify([]))

function loadChangelogs(){
try{return JSON.parse(fs.readFileSync("changelogs.json"))}
catch{return []}
}

function saveChangelogs(d){
fs.writeFileSync("changelogs.json",JSON.stringify(d,null,2))
}

app.get("/changelogs",(req,res)=>{
const logs=loadChangelogs()

logs.sort((a,b)=>parseFloat(b.version)-parseFloat(a.version))

res.json(logs)
})

app.post("/admin/changelog/add",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {version,title,text,timezone}=req.body

let logs=loadChangelogs()

logs.push({
id:crypto.randomBytes(6).toString("hex"),
version,
title,
text,
time:new Date().toISOString(),
timezone:timezone || "UTC"
})

saveChangelogs(logs)

res.json({success:true})
})

if(!fs.existsSync("schedule.json")) fs.writeFileSync("schedule.json",JSON.stringify({
slots:{},
booked:{}
},null,2))

function loadSchedule(){
try{return JSON.parse(fs.readFileSync("schedule.json"))}
catch{return {slots:{},booked:{}}}
}

function saveSchedule(d){
fs.writeFileSync("schedule.json",JSON.stringify(d,null,2))
}

function hasApproved(ticket){
return ticket.messages.some(m=>String(m.text||"").toLowerCase().trim()==="approve")
}

app.post("/admin/schedule/set",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {date,start,end}=req.body

let data=loadSchedule()

if(!data.slots[date]) data.slots[date]=[]

data.slots[date].push({start,end})

saveSchedule(data)

res.json({success:true})
})

app.get("/schedule/available",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {date}=req.query

let data=loadSchedule()

const slots=data.slots[date]||[]
const booked=data.booked[date]||[]

const available=slots.filter(s=>{
return !booked.find(b=>b.start===s.start && b.end===s.end)
})

res.json({slots:available})
})

app.post("/schedule/book",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {ticketId,date,start,end}=req.body

let tickets=loadTickets()
const t=tickets.find(x=>x.id===ticketId)
if(!t) return res.json({error:"notfound"})

if(t.owner!==user.username) return res.json({error:"noperms"})
if(!hasApproved(t)) return res.json({error:"notapproved"})
if(t.booked) return res.json({error:"alreadybooked"})

const now=new Date()
const selected=new Date(date)
if(selected-now>7*24*60*60*1000) return res.json({error:"toofar"})

let data=loadSchedule()

if(!data.booked[date]) data.booked[date]=[]

if(data.booked[date].find(b=>b.start===start && b.end===end))
return res.json({error:"taken"})

data.booked[date].push({
start,
end,
user:user.username,
ticketId
})

t.booked={
date,
start,
end
}

t.messages.push({
author:"System",
text:`Successfully booked ${start} - ${end} on ${date}. Be online the entire time.`,
time:new Date().toISOString()
})

saveSchedule(data)
saveTickets(tickets)

res.json({success:true})
})

//APP

app.post("/app/register-device",(req,res)=>{

try{

const loginToken=req.headers.authorization

if(!loginToken){

return res.status(401).json({
success:false,
error:"missing auth token"
})

}


const {fcmToken}=req.body


if(!fcmToken){

return res.status(400).json({
success:false,
error:"missing fcm token"
})

}


const users=loadUsers()


let user=null
let username=null


for(const name in users){

if(users[name].sessionToken===loginToken){

user=users[name]
username=name

break

}

}


if(!user){

return res.status(401).json({
success:false,
error:"invalid session"
})

}


if(!Array.isArray(users[username].devices)){

users[username].devices=[]

}


if(!users[username].devices.includes(fcmToken)){

users[username].devices.push(fcmToken)

}


saveUsers(users)


console.log(
"FCM registered:",
username
)


res.json({
success:true,
username:username,
devices:users[username].devices.length
})


}catch(err){


console.error(
"REGISTER DEVICE ERROR:",
err
)


res.status(500).json({
success:false,
error:"server"
})


}

})


const ADMIN_AUDIT_PATH=path.join(__dirname,"AdminAudit.json")
const SITE_MESSAGES_PATH=path.join(__dirname,"SiteMessages.json")
const SYSTEM_SETTINGS_PATH=path.join(__dirname,"SystemSettings.json")

function loadSiteMessages(){
    const data=readJson(SITE_MESSAGES_PATH,{messages:[]})
    if(!data || typeof data!=="object" || !Array.isArray(data.messages)) return {messages:[]}
    return data
}

function saveSiteMessages(data){
    const normalized=data && typeof data==="object" && Array.isArray(data.messages) ? data : {messages:[]}
    writeJson(SITE_MESSAGES_PATH,normalized)
    return normalized
}

function activeSiteMessages(){
    const now=Date.now()
    const data=loadSiteMessages()
    let changed=false
    data.messages=data.messages.filter(m=>{
        const start=m.startAt ? new Date(m.startAt).getTime() : 0
        const end=m.endAt ? new Date(m.endAt).getTime() : null
        const expired=end && Number.isFinite(end) && end<=now
        if(expired && m.active!==false) changed=true
        if(expired) return false
        return m.active!==false && (!start || !Number.isFinite(start) || start<=now)
    })
    if(changed) saveSiteMessages(data)
    return data.messages.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)
)
}

function loadSystemSettings(){
    const data=readJson(SYSTEM_SETTINGS_PATH,{maintenance:false,readOnly:false,registrationLocked:false,loginLocked:false})
    return {
        maintenance:data?.maintenance===true,
        readOnly:data?.readOnly===true,
        registrationLocked:data?.registrationLocked===true,
        loginLocked:data?.loginLocked===true
    }
}

function saveSystemSettings(data){
    const normalized={
        maintenance:data?.maintenance===true,
        readOnly:data?.readOnly===true,
        registrationLocked:data?.registrationLocked===true,
        loginLocked:data?.loginLocked===true
    }
    writeJson(SYSTEM_SETTINGS_PATH,normalized)
    return normalized
}


function loadAdminAudit(){
    const data=readJson(ADMIN_AUDIT_PATH,[])
    return Array.isArray(data)?data:[]
}

function saveAdminAudit(data){
    writeJson(ADMIN_AUDIT_PATH,Array.isArray(data)?data:[])
}

function addAdminAudit(admin,action,target,details={}){
    const logs=loadAdminAudit()
    logs.unshift({
        id:crypto.randomBytes(12).toString("hex"),
        admin:admin.username,
        action,
        target:target || null,
        details,
        time:new Date().toISOString()
    })
    if(logs.length>5000) logs.length=5000
    saveAdminAudit(logs)
}

function adminTarget(req){
    const admin=auth(req)
    if(!admin || !hasAdmin(admin)) return null
    return admin
}

const BETA_TESTER_DATA_FIELDS = new Set(["checks","issues","ideas","session","preferences","scratchpad","diagnostics"])
const BETA_TESTER_CHECK_IDS = ["login","profile","messages","notifications","wallet","cloud","quests","badges","integrations","support","errors","accessibility"]
const BETA_TESTER_ISSUE_STATUSES = ["Open","Re-test","Resolved locally","In Review","Closed","Won't Fix"]
const BETA_TESTER_IDEA_STATUSES = ["Draft","Under Review","Accepted","Planned","In Progress","Completed","Declined"]

function betaTesterAllowed(user){
    return !!user && betaTesterUsernames().has(String(user.username||"").toLowerCase())
}

function betaTesterWorkspacePath(username){
    return path.join(ensureUserFolder(username),"BetaTesterWorkspace.json")
}

function betaTesterDefaultWorkspace(username){
    const now=new Date().toISOString()
    return {
        version:1,
        username:String(username||""),
        checks:{},
        issues:[],
        ideas:[],
        session:{runningSince:null,accumulatedMs:0,history:[]},
        preferences:{accent:"cyan",density:"comfortable",motion:true,glow:true},
        scratchpad:"",
        diagnostics:{},
        adminReview:{notes:[],recordReviews:{issues:{},ideas:{}},lastReviewedAt:null,lastReviewedBy:null},
        createdAt:now,
        updatedAt:now
    }
}

function betaTesterCleanText(value,max=8000){
    return String(value??"").slice(0,max)
}

function betaTesterNormalizeItems(value,kind){
    const items=Array.isArray(value)?value.slice(0,500):[]
    return items.filter(item=>item&&typeof item==="object").map(item=>{
        const common={
            id:betaTesterCleanText(item.id||crypto.randomBytes(10).toString("hex"),100),
            title:betaTesterCleanText(item.title,100),
            area:betaTesterCleanText(item.area,80),
            status:betaTesterCleanText(item.status,40),
            createdAt:betaTesterCleanText(item.createdAt,80)||new Date().toISOString()
        }
        if(kind==="issues"){
            const severity=["Low","Medium","High","Critical"].includes(item.severity)?item.severity:"Medium"
            if(!BETA_TESTER_ISSUE_STATUSES.includes(common.status)) common.status="Open"
            return {...common,notes:betaTesterCleanText(item.notes,2500),severity,repro:betaTesterCleanText(item.repro,80)||"Not confirmed"}
        }
        if(!BETA_TESTER_IDEA_STATUSES.includes(common.status)) common.status="Draft"
        const priority=["Nice to have","Useful","Important","Critical need","High impact","Critical"].includes(item.priority)?item.priority:betaTesterCleanText(item.priority,40)||"Useful"
        return {...common,description:betaTesterCleanText(item.description,2500),priority}
    }).filter(item=>item.title.trim())
}

function betaTesterNormalizeWorkspace(data,username,existing=null){
    const defaults=betaTesterDefaultWorkspace(username)
    const source=data&&typeof data==="object"?data:{}
    const previous=existing&&typeof existing==="object"?existing:{}
    const base={...defaults,...previous,...source}
    const checks={}
    const incomingChecks=base.checks&&typeof base.checks==="object"?base.checks:{}
    for(const id of BETA_TESTER_CHECK_IDS) checks[id]=incomingChecks[id]===true
    const sessionInput=base.session&&typeof base.session==="object"?base.session:{}
    const running=Number(sessionInput.runningSince)
    const accumulated=Number(sessionInput.accumulatedMs)
    const history=Array.isArray(sessionInput.history)?sessionInput.history.slice(0,100).map(item=>({
        id:betaTesterCleanText(item?.id,100),
        startedAt:betaTesterCleanText(item?.startedAt,80),
        endedAt:betaTesterCleanText(item?.endedAt,80),
        durationMs:Math.max(0,Math.min(365*24*60*60*1000,Number(item?.durationMs)||0))
    })):[]
    const pref=base.preferences&&typeof base.preferences==="object"?base.preferences:{}
    const accent=["cyan","ocean","violet","emerald","amber","rose"].includes(pref.accent)?pref.accent:"cyan"
    const density=["comfortable","compact","spacious"].includes(pref.density)?pref.density:"comfortable"
    const diag=base.diagnostics&&typeof base.diagnostics==="object"?base.diagnostics:{}
    const review=base.adminReview&&typeof base.adminReview==="object"?base.adminReview:{}
    const notes=Array.isArray(review.notes)?review.notes.slice(0,500).map(note=>({
        id:betaTesterCleanText(note?.id,100),
        author:betaTesterCleanText(note?.author,80),
        note:betaTesterCleanText(note?.note,2000),
        createdAt:betaTesterCleanText(note?.createdAt,80)
    })):[]
    const recordReviews=review.recordReviews&&typeof review.recordReviews==="object"?review.recordReviews:{}
    return {
        version:1,
        username:String(username||base.username||""),
        checks,
        issues:betaTesterNormalizeItems(base.issues,"issues"),
        ideas:betaTesterNormalizeItems(base.ideas,"ideas"),
        session:{
            runningSince:Number.isFinite(running)&&running>0?running:null,
            accumulatedMs:Math.max(0,Math.min(365*24*60*60*1000,Number.isFinite(accumulated)?accumulated:0)),
            startedAt:betaTesterCleanText(sessionInput.startedAt,80)||null,
            sessionId:betaTesterCleanText(sessionInput.sessionId,100)||null,
            history
        },
        preferences:{accent,density,motion:pref.motion!==false,glow:pref.glow!==false},
        scratchpad:betaTesterCleanText(base.scratchpad,8000),
        diagnostics:{
            capturedAt:betaTesterCleanText(diag.capturedAt,80),
            browser:betaTesterCleanText(diag.browser,300),
            platform:betaTesterCleanText(diag.platform,120),
            language:betaTesterCleanText(diag.language,80),
            languages:Array.isArray(diag.languages)?diag.languages.slice(0,10).map(x=>betaTesterCleanText(x,80)):[],
            timezone:betaTesterCleanText(diag.timezone,100),
            viewport:diag.viewport&&typeof diag.viewport==="object"?{width:Number(diag.viewport.width)||0,height:Number(diag.viewport.height)||0}:{width:0,height:0},
            screen:diag.screen&&typeof diag.screen==="object"?{width:Number(diag.screen.width)||0,height:Number(diag.screen.height)||0}:{width:0,height:0},
            devicePixelRatio:Number(diag.devicePixelRatio)||1,
            online:diag.online===true,
            colorScheme:diag.colorScheme==="light"?"light":"dark",
            reducedMotion:diag.reducedMotion===true,
            hardwareConcurrency:Number(diag.hardwareConcurrency)||null
        },
        adminReview:{
            notes,
            recordReviews:{issues:recordReviews.issues&&typeof recordReviews.issues==="object"?recordReviews.issues:{},ideas:recordReviews.ideas&&typeof recordReviews.ideas==="object"?recordReviews.ideas:{}},
            lastReviewedAt:betaTesterCleanText(review.lastReviewedAt,80)||null,
            lastReviewedBy:betaTesterCleanText(review.lastReviewedBy,80)||null
        },
        createdAt:betaTesterCleanText(previous.createdAt||base.createdAt,80)||new Date().toISOString(),
        updatedAt:betaTesterCleanText(base.updatedAt,80)||new Date().toISOString()
    }
}

function betaTesterClientWorkspace(workspace){
    const {adminReview,...clientWorkspace}=workspace
    return clientWorkspace
}

function loadBetaTesterWorkspace(username){
    const file=betaTesterWorkspacePath(username)
    const exists=fs.existsSync(file)
    const raw=exists?readJson(file,null):null
    return {exists,workspace:betaTesterNormalizeWorkspace(raw,username)}
}

function saveBetaTesterWorkspace(username,data,existing=null,preserveReview=false){
    const current=existing||loadBetaTesterWorkspace(username).workspace
    const incoming=data&&typeof data==="object"?{...data}:{}
    if(preserveReview) incoming.adminReview=current.adminReview
    const workspace=betaTesterNormalizeWorkspace(incoming,username,current)
    workspace.updatedAt=new Date().toISOString()
    writeJson(betaTesterWorkspacePath(username),workspace)
    return workspace
}

function betaTesterWorkspaceSummary(workspace,hasServerData){
    const complete=BETA_TESTER_CHECK_IDS.filter(id=>workspace.checks?.[id]===true).length
    const runningSince=Number(workspace.session?.runningSince)||0
    const totalSessionMs=Math.max(0,Number(workspace.session?.accumulatedMs)||0)+(runningSince?Math.max(0,Date.now()-runningSince):0)
    return {
        username:workspace.username,
        hasServerData,
        updatedAt:workspace.updatedAt,
        createdAt:workspace.createdAt,
        completedChecks:complete,
        totalChecks:BETA_TESTER_CHECK_IDS.length,
        issueCount:workspace.issues.length,
        openIssueCount:workspace.issues.filter(x=>!["Resolved locally","Closed","Won't Fix"].includes(x.status)).length,
        proposalCount:workspace.ideas.length,
        unreviewedProposalCount:workspace.ideas.filter(x=>["Draft","Under Review"].includes(x.status)).length,
        running:!!runningSince,
        totalSessionMs,
        sessionCount:Array.isArray(workspace.session?.history)?workspace.session.history.length:0,
        scratchpadLength:workspace.scratchpad.length,
        diagnosticsAt:workspace.diagnostics?.capturedAt||null,
        reviewNoteCount:Array.isArray(workspace.adminReview?.notes)?workspace.adminReview.notes.length:0,
        lastReviewedAt:workspace.adminReview?.lastReviewedAt||null,
        lastReviewedBy:workspace.adminReview?.lastReviewedBy||null
    }
}

app.get("/beta-tester/workspace",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({success:false,error:"unauthorized"})
    if(!betaTesterAllowed(user)) return res.status(403).json({success:false,error:"beta_tester_required"})
    try{
        const result=loadBetaTesterWorkspace(user.username)
        res.json({success:true,hasServerData:result.exists,workspace:betaTesterClientWorkspace(result.workspace)})
    }catch(err){
        console.error("BETA WORKSPACE READ ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

app.put("/beta-tester/workspace",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({success:false,error:"unauthorized"})
    if(!betaTesterAllowed(user)) return res.status(403).json({success:false,error:"beta_tester_required"})
    try{
        const incoming=req.body?.workspace&&typeof req.body.workspace==="object"?req.body.workspace:req.body
        const existing=loadBetaTesterWorkspace(user.username)
        const workspace=saveBetaTesterWorkspace(user.username,incoming,existing.workspace,true)
        res.json({success:true,hasServerData:true,workspace:betaTesterClientWorkspace(workspace)})
    }catch(err){
        console.error("BETA WORKSPACE SAVE ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

app.patch("/beta-tester/workspace",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({success:false,error:"unauthorized"})
    if(!betaTesterAllowed(user)) return res.status(403).json({success:false,error:"beta_tester_required"})
    try{
        const loaded=loadBetaTesterWorkspace(user.username)
        const fields=req.body?.fields&&typeof req.body.fields==="object"?req.body.fields:{}
        const updated={...loaded.workspace}
        for(const [field,value] of Object.entries(fields)){
            if(!BETA_TESTER_DATA_FIELDS.has(field)) continue
            updated[field]=value
        }
        const workspace=saveBetaTesterWorkspace(user.username,updated,loaded.workspace,true)
        res.json({success:true,workspace:betaTesterClientWorkspace(workspace)})
    }catch(err){
        console.error("BETA WORKSPACE UPDATE ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/beta-tester/workspaces/export",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.status(403).json({success:false,error:"administrator_required"})
    try{
        const testers=betaTesterAdminAccounts()
        const workspaces=testers.map(user=>{
            const result=loadBetaTesterWorkspace(user.username)
            return {...result.workspace,summary:betaTesterWorkspaceSummary(result.workspace,result.exists)}
        })
        res.json({success:true,exportedAt:new Date().toISOString(),count:workspaces.length,workspaces})
    }catch(err){
        console.error("BETA WORKSPACE EXPORT ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/beta-tester/workspaces",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.status(403).json({success:false,error:"administrator_required"})
    try{
        const testers=betaTesterAdminAccounts().map(user=>{
            const result=loadBetaTesterWorkspace(user.username)
            return betaTesterWorkspaceSummary(result.workspace,result.exists)
        }).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")))
        res.json({success:true,testers,stats:{testers:testers.length,issues:testers.reduce((n,x)=>n+x.issueCount,0),openIssues:testers.reduce((n,x)=>n+x.openIssueCount,0),proposals:testers.reduce((n,x)=>n+x.proposalCount,0),running:testers.filter(x=>x.running).length,notes:testers.reduce((n,x)=>n+x.scratchpadLength,0)}})
    }catch(err){
        console.error("BETA WORKSPACE ADMIN LIST ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/beta-tester/workspaces/:username",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.status(403).json({success:false,error:"administrator_required"})
    const username=safeUsername(req.params.username)
    if(!username) return res.status(400).json({success:false,error:"invalid_username"})
    const users=loadUsers()
    const target=resolveUserRecord(users,username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    const result=loadBetaTesterWorkspace(target.username)
    if(!result.exists&&!betaTesterAllowed(target)) return res.status(404).json({success:false,error:"workspace_not_found"})
    res.json({success:true,summary:betaTesterWorkspaceSummary(result.workspace,result.exists),workspace:result.workspace})
})

app.patch("/admin/beta-tester/workspaces/:username",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.status(403).json({success:false,error:"administrator_required"})
    const username=safeUsername(req.params.username)
    if(!username) return res.status(400).json({success:false,error:"invalid_username"})
    const users=loadUsers()
    const target=resolveUserRecord(users,username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    try{
        const loaded=loadBetaTesterWorkspace(target.username)
        const workspace=loaded.workspace
        const body=req.body||{}
        const action=String(body.action||"")
        if(action==="add_note"){
            const note=betaTesterCleanText(body.note,2000).trim()
            if(!note) return res.status(400).json({success:false,error:"note_required"})
            workspace.adminReview.notes.unshift({id:crypto.randomBytes(12).toString("hex"),author:admin.username,note,createdAt:new Date().toISOString()})
            workspace.adminReview.notes=workspace.adminReview.notes.slice(0,500)
            workspace.adminReview.lastReviewedAt=new Date().toISOString()
            workspace.adminReview.lastReviewedBy=admin.username
        }else if(action==="record_review"){
            const kind=body.kind==="issues"?"issues":body.kind==="ideas"?"ideas":null
            if(!kind) return res.status(400).json({success:false,error:"invalid_record_kind"})
            const id=String(body.id||"")
            const record=workspace[kind].find(item=>item.id===id)
            if(!record) return res.status(404).json({success:false,error:"record_not_found"})
            const status=String(body.status||"")
            const statuses=kind==="issues"?BETA_TESTER_ISSUE_STATUSES:BETA_TESTER_IDEA_STATUSES
            if(!statuses.includes(status)) return res.status(400).json({success:false,error:"invalid_status"})
            record.status=status
            const note=betaTesterCleanText(body.note,2000).trim()
            workspace.adminReview.recordReviews[kind][id]={status,note,reviewedBy:admin.username,reviewedAt:new Date().toISOString()}
            workspace.adminReview.lastReviewedAt=new Date().toISOString()
            workspace.adminReview.lastReviewedBy=admin.username
        }else if(action==="delete_record"){
            const kind=body.kind==="issues"?"issues":body.kind==="ideas"?"ideas":null
            if(!kind) return res.status(400).json({success:false,error:"invalid_record_kind"})
            const id=String(body.id||"")
            const before=workspace[kind].length
            workspace[kind]=workspace[kind].filter(item=>item.id!==id)
            if(workspace[kind].length===before) return res.status(404).json({success:false,error:"record_not_found"})
            delete workspace.adminReview.recordReviews[kind][id]
        }else if(action==="clear_scratchpad"){
            workspace.scratchpad=""
        }else{
            return res.status(400).json({success:false,error:"invalid_action"})
        }
        const saved=saveBetaTesterWorkspace(target.username,workspace,loaded.workspace)
        addAdminAudit(admin,"beta_tester_"+action,target.username,{kind:body.kind||null,id:body.id||null,status:body.status||null})
        res.json({success:true,workspace:saved,summary:betaTesterWorkspaceSummary(saved,true)})
    }catch(err){
        console.error("BETA WORKSPACE ADMIN UPDATE ERROR:",err.message)
        res.status(500).json({success:false,error:"server"})
    }
})

function adminHeaderTarget(req){
    return String(req.headers["x-admin-target"]||"").trim()
}

function validateAdminTargetHeader(req,username){
    const headerTarget=adminHeaderTarget(req)
    const bodyTarget=String(username||"").trim()
    if(headerTarget && bodyTarget && headerTarget!==bodyTarget) return false
    return true
}

function adminResolveUser(username){
    const users=loadUsers()
    const target=resolveUserRecord(users,String(username||"").trim())
    return {users,target}
}

function adminStorageSummary(username){
    const root=ensureUserFolder(username)
    let totalBytes=0
    let fileCount=0
    let dirCount=0
    const files=[]
    function walk(dir,relative=""){
        let entries=[]
        try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
        for(const entry of entries){
            const full=path.join(dir,entry.name)
            const rel=path.join(relative,entry.name)
            if(entry.isDirectory()){
                dirCount++
                walk(full,rel)
            }else if(entry.isFile()){
                fileCount++
                let size=0
                try{size=fs.statSync(full).size}catch{}
                totalBytes+=size
                if(files.length<1000) files.push({name:rel.replaceAll("\\","/"),size})
            }
        }
    }
    walk(root)
    return {path:root,fileCount,dirCount,totalBytes,files}
}

function adminLoadUserChats(username){
    const dms=loadDMs()
    const friendsData=normalizeFriendsData(loadFriends())
    return listStoredChats(dms).filter(item=>item.meta.users.includes(username)).map(item=>{
        const chat={...item.meta,messages:readAllDmMessages(item.folder)}
        const other=chat.users.find(x=>x!==username)||username
        const messages=chat.messages.map(m=>({
            messageId:m.messageId||null,
            author:m.author||m.from||"Unknown",
            text:m.text||m.message||"",
            attachment:m.attachment||null,
            time:m.time||m.timestamp||null
        }))
        return {id:chat.id,with:other,users:chat.users,areFriends:areFriends(friendsData,username,other),createdAt:chat.createdAt||null,updatedAt:chat.updatedAt||null,messageCount:Number(chat.messageCount||messages.length),messages}
    }).sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))
}
function adminLoadUserTickets(username,status="all"){
    const tickets=loadTickets()
    return tickets.filter(t=>t && t.owner===username).filter(t=>status==="all" || String(t.status||"").toLowerCase()===status).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(t=>({
        id:t.id,
        owner:t.owner,
        title:t.title||"Untitled",
        reason:t.reason||"",
        info:t.info||"",
        status:t.status||"unknown",
        locked:t.locked===true,
        archived:t.archived===true,
        priority:t.priority||"normal",
        tags:Array.isArray(t.tags)?t.tags:[],
        assignedTo:t.assignedTo||null,
        createdAt:t.createdAt||null,
        closedAt:t.closedAt||null,
        activeUsers:Array.isArray(t.activeUsers)?t.activeUsers:[],
        messages:Array.isArray(t.messages)?t.messages.map(m=>({author:m.author||"Unknown",text:m.text||"",attachment:m.attachment||null,time:m.time||null})):[]
    }))
}

function adminSafeUser(admin,target){
    const perms=loadPerms()
    const subscription=subscriptionResponse(target.username)
    const badges=ensureUserBadges(target.username)
    const zy=ensureZyphiumAccount(target.username)
    const wallet=normalizeWallet(loadWallet(target.username))
    const logs=loadPageLogs()
    const tickets=loadTickets()
    const reports=loadReports(target.username)
    const activeResetMetadata=Object.entries(passwordResetTokens)
        .filter(([token,data])=>data && data.username===target.username && data.used!==true && Date.now()<data.expires)
        .map(([token,data])=>({
            tokenPrefix:token.slice(0,10),
            created:data.created||null,
            expires:new Date(data.expires).toISOString()
        }))
    const gifts=Object.values(loadZyphiumGifts())
        .filter(g=>g && g.sender===target.username)
        .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
        .slice(0,200)
        .map(g=>({
            id:g.id,
            amount:Number(g.amount)||0,
            message:g.message||"",
            createdAt:g.createdAt||null,
            claimed:g.claimed===true,
            claimedBy:g.claimedBy||null,
            claimedAt:g.claimedAt||null,
            revoked:g.revoked===true,
            revokedAt:g.revokedAt||null,
            link:`https://zyphor.cc/ZyphiumGift?ID=${encodeURIComponent(String(g.id||""))}`
        }))
    const userPageHistory=Array.isArray(logs[target.username])?logs[target.username]:[]
    const targetTickets=tickets.filter(t=>t && t.owner===target.username).map(t=>({
        id:t.id,
        title:t.title,
        status:t.status,
        createdAt:t.createdAt,
        closedAt:t.closedAt||null,
        locked:t.locked===true
    })).slice(0,200)
    let cloudLogs=[]
    try{
        const root=cloudLogsRoot(target.username)
        if(fs.existsSync(root)){
            const files=fs.readdirSync(root).filter(x=>x.endsWith(".json")).sort().reverse().slice(0,100)
            for(const file of files){
                const entries=readJson(path.join(root,file),[])
                if(Array.isArray(entries)) cloudLogs.push(...entries)
            }
            cloudLogs.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0))
            cloudLogs=cloudLogs.slice(0,500)
        }
    }catch{}
    return hideProtectedUserData(admin,target,{
        username:target.username,
        id:target.id||null,
        createdAt:target.createdAt||null,
        createdIP:target.createdIP||null,
        email:target.email||null,
        emailVerifiedAt:target.emailVerifiedAt||null,
        pendingEmail:target.pendingEmail||null,
        twofa:target.twofa===true,
        passwordChangedAt:target.passwordChangedAt||null,
        sessionActive:!!target.sessionToken,
        devicesCount:Array.isArray(target.devices)?target.devices.length:0,
        linkedDiscord:target.linkedDiscord||null,
        roblox:target.roblox||null,
        linkCode:target.linkCode||null,
        code:target.code||null,
        banned:target.banned===true,
        banReason:target.banReason||null,
        banMessage:target.banMessage||null,
        banExpires:target.banExpires||null,
        disabled:target.disabled===true,
        muted:target.muted===true,
        shadowBanned:target.shadowBanned===true,
        frozen:target.frozen===true,
        vip:target.vip===true,
        lastActiveAt:target.lastActiveAt||null,
        latestIP:Array.isArray(target.loginHistory)&&target.loginHistory.length ? (target.loginHistory.at(-1)?.ip||null) : (target.createdIP||null),
        latestLoginAt:Array.isArray(target.loginHistory)&&target.loginHistory.length ? (target.loginHistory.at(-1)?.date||null) : null,
        latestSessionId:target.sessionToken ? target.sessionToken.slice(0,12)+"…" : null,
        passwordSet:!!target.password,
        passwordLength:target.password ? String(target.password).length : 0,
        loginHistory:Array.isArray(target.loginHistory)?target.loginHistory:[],
        banHistory:Array.isArray(target.banHistory)?target.banHistory:[],
        punishmentHistory:Array.isArray(target.punishmentHistory)?target.punishmentHistory:[],
        completedQuests:Array.isArray(target.completedQuests)?target.completedQuests:[],
        questHistory:Array.isArray(target.questHistory)?target.questHistory:[],
        permissions:{
            Administrator:Array.isArray(perms.permissions.Administrator)&&perms.permissions.Administrator.includes(target.username),
            Support:Array.isArray(perms.permissions.Support)&&perms.permissions.Support.includes(target.username),
            VIP:Array.isArray(perms.permissions.VIP)&&perms.permissions.VIP.includes(target.username),
            Family:Array.isArray(perms.permissions.Family)&&perms.permissions.Family.includes(target.username),
            Moderator:Array.isArray(perms.permissions.Moderator)&&perms.permissions.Moderator.includes(target.username)
        },
        subscription,
        badges,
        zyphium:{
            ZAccountID:zy.ZAccountID,
            balance:zy.balance,
            transactions:zy.transactions||[]
        },
        wallet:{
            balance:wallet.balance,
            history:wallet.history||[],
            payouts:wallet.payouts||[]
        },
        pageHistory:userPageHistory,
        reports:reports.reports||[],
        tickets:targetTickets,
        resetLinks:activeResetMetadata,
        activeResetCount:activeResetMetadata.length,
        giftLinks:gifts,
        cloudLogs,
        notifications:Array.isArray(target.notifications)?target.notifications:[],
        adminNotes:Array.isArray(target.adminNotes)?target.adminNotes:[],
        noTransactionLog:target.noTransactionLog===true,
        adminTransactionLogging:target.adminTransactionLogging!==false,
        storage:adminStorageSummary(target.username),
        passwordView:"hidden",
        sessionTokenView:"hidden",
        twofaCodeView:"hidden"
    })
}

function adminBool(value){
    return value===true || String(value).toLowerCase()==="true"
}

app.get("/admin/control/target",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.query.username||"").trim()
    if(!username) return res.status(400).json({success:false,error:"username_required"})
    const {target}=adminResolveUser(username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    res.json({success:true,target:{username:target.username,id:target.id||null,createdAt:target.createdAt||null,sessionActive:!!target.sessionToken,banned:target.banned===true,frozen:target.frozen===true,disabled:target.disabled===true,subscription:subscriptionResponse(target.username)}})
})

app.get("/admin/control/user",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    try{
        const username=String(req.query.username||adminHeaderTarget(req)).trim()
        if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
        const {target}=adminResolveUser(username)
        if(!target) return res.status(404).json({success:false,error:"user_not_found"})
        res.json({success:true,user:adminSafeUser(admin,target)})
    }catch(err){
        console.error("ADMIN CONTROL USER ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/users",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    try{
        const users=loadUsers()
        const perms=loadPerms()
        const q=String(req.query.q||"").trim().toLowerCase()
        const status=String(req.query.status||"all").trim().toLowerCase()
        const limit=Math.min(500,Math.max(1,Number(req.query.limit)||100))
        const result=Object.values(users)
            .filter(u=>u && u.username)
            .filter(u=>!q || u.username.toLowerCase().includes(q))
            .filter(u=>{
                if(status==="banned") return u.banned===true
                if(status==="disabled") return u.disabled===true
                if(status==="frozen") return u.frozen===true
                if(status==="admin") return Array.isArray(perms.permissions.Administrator)&&perms.permissions.Administrator.includes(u.username)
                if(status==="online") return !!u.sessionToken
                if(status==="sub") return !!getActiveSubscription(u.username)
                return true
            })
            .sort((a,b)=>a.username.localeCompare(b.username))
            .slice(0,limit)
            .map(u=>({
                username:u.username,
                id:u.id||null,
                banned:u.banned===true,
                disabled:u.disabled===true,
                frozen:u.frozen===true,
                muted:u.muted===true,
                shadowBanned:u.shadowBanned===true,
                sessionActive:!!u.sessionToken,
                email:!!u.email,
                twofa:u.twofa===true,
                subscription:subscriptionResponse(u.username).plan,
                devicesCount:Array.isArray(u.devices)?u.devices.length:0,
                lastActiveAt:u.lastActiveAt||null
            }))
        res.json({success:true,users:result,total:result.length})
    }catch(err){
        console.error("ADMIN CONTROL USERS ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/visits",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    try{
        const logs=loadPageLogs()
        const from=String(req.query.from||"").trim()
        const to=String(req.query.to||"").trim()
        const fromMs=from ? new Date(from).getTime() : NaN
        const toMs=to ? new Date(to).getTime() : NaN
        const bucketMs=String(req.query.bucket||"day")==="hour" ? 3600000 : 86400000
        const buckets=new Map()
        let total=0
        let uniqueUsers=new Set()
        let pages=new Map()
        for(const [username,entries] of Object.entries(logs)){
            if(!Array.isArray(entries)) continue
            for(const entry of entries){
                const ms=new Date(entry.time||0).getTime()
                if(!Number.isFinite(ms)) continue
                if(Number.isFinite(fromMs) && ms<fromMs) continue
                if(Number.isFinite(toMs) && ms>toMs) continue
                total++
                uniqueUsers.add(username)
                const page=String(entry.page||"Unknown")
                pages.set(page,(pages.get(page)||0)+1)
                const bucket=Math.floor(ms/bucketMs)*bucketMs
                buckets.set(bucket,(buckets.get(bucket)||0)+1)
            }
        }
        const points=[...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([time,visits])=>({time:new Date(time).toISOString(),visits}))
        const topPages=[...pages.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([page,visits])=>({page,visits}))
        res.json({success:true,total,uniqueUsers:uniqueUsers.size,points,topPages,from:Number.isFinite(fromMs)?new Date(fromMs).toISOString():null,to:Number.isFinite(toMs)?new Date(toMs).toISOString():null,bucket:bucketMs===3600000?"hour":"day"})
    }catch(err){
        console.error("ADMIN CONTROL VISITS ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/audit",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const limit=Math.min(1000,Math.max(1,Number(req.query.limit)||200))
    res.json({success:true,logs:loadAdminAudit().slice(0,limit)})
})

app.post("/admin/control/action",async(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const action=String(req.body?.action||"").trim()
    const username=String(req.body?.username||adminHeaderTarget(req)).trim()
    if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
    const {users,target}=adminResolveUser(username)
    try{
        if(!target && !["generate_codes","delete_code","audit_cleanup","changelog_add","changelog_edit","changelog_delete","changelog_publish","changelog_unpublish","changelog_pin","changelog_unpin","changelog_duplicate","site_message_create","site_message_update","site_message_delete","site_message_expire_all","site_message_clear_all","site_message_pin","site_message_unpin","system_toggle"].includes(action)) return res.status(404).json({success:false,error:"user_not_found"})
        const time=new Date().toISOString()
        const reason=String(req.body?.reason||"").trim().slice(0,1000)
        const amount=Math.floor(Number(req.body?.amount)*100)/100
        const silent=req.body?.silent===true
        const ok=()=>res.json({success:true})

        if(action==="site_message_create"){
            const title=String(req.body?.title||"").trim().slice(0,160)
            const message=String(req.body?.message||"").trim().slice(0,5000)
            const type=String(req.body?.type||"info").trim().slice(0,32)
            const startAt=req.body?.startAt ? new Date(req.body.startAt).toISOString() : time
            let endAt=null
            if(req.body?.endAt){
                const parsed=new Date(req.body.endAt)
                if(!Number.isFinite(parsed.getTime())) return res.status(400).json({success:false,error:"invalid_end_time"})
                endAt=parsed.toISOString()
                if(parsed.getTime()<=Date.now()) return res.status(400).json({success:false,error:"end_time_must_be_future"})
            }
            if(!message) return res.status(400).json({success:false,error:"message_required"})
            const data=loadSiteMessages()
            const item={id:crypto.randomBytes(10).toString("hex"),title:title||"Zyphor",message,type,startAt,endAt,createdAt:time,createdBy:admin.username,active:true,pinned:req.body?.pinned===true}
            data.messages.push(item)
            saveSiteMessages(data)
            addAdminAudit(admin,"site_message_create",null,{id:item.id,title:item.title,type:item.type,startAt:item.startAt,endAt:item.endAt,pinned:item.pinned})
            return res.json({success:true,message:{id:item.id,title:item.title,type:item.type,startAt:item.startAt,endAt:item.endAt,createdAt:item.createdAt,pinned:item.pinned}})
        }else if(action==="site_message_update"){
            const id=String(req.body?.messageId||"").trim()
            const data=loadSiteMessages()
            const item=data.messages.find(x=>x && x.id===id)
            if(!item) return res.status(404).json({success:false,error:"message_not_found"})
            if(req.body?.title!==undefined) item.title=String(req.body.title||"").trim().slice(0,160)||"Zyphor"
            if(req.body?.message!==undefined) item.message=String(req.body.message||"").trim().slice(0,5000)
            if(req.body?.type!==undefined) item.type=String(req.body.type||"info").trim().slice(0,32)
            if(req.body?.startAt!==undefined) item.startAt=req.body.startAt?new Date(req.body.startAt).toISOString():null
            if(req.body?.endAt!==undefined){
                const parsed=req.body.endAt?new Date(req.body.endAt):null
                if(parsed && !Number.isFinite(parsed.getTime())) return res.status(400).json({success:false,error:"invalid_end_time"})
                item.endAt=parsed?parsed.toISOString():null
            }
            if(req.body?.active!==undefined) item.active=req.body.active===true
            if(req.body?.pinned!==undefined) item.pinned=req.body.pinned===true
            item.updatedAt=time
            item.updatedBy=admin.username
            saveSiteMessages(data)
        }else if(action==="site_message_delete"){
            const id=String(req.body?.messageId||"").trim()
            const data=loadSiteMessages()
            const before=data.messages.length
            data.messages=data.messages.filter(x=>x?.id!==id)
            if(data.messages.length===before) return res.status(404).json({success:false,error:"message_not_found"})
            saveSiteMessages(data)
        }else if(action==="site_message_expire_all"){
            const data=loadSiteMessages()
            for(const item of data.messages) item.endAt=time
            saveSiteMessages(data)
        }else if(action==="site_message_clear_all"){
            saveSiteMessages({messages:[]})
        }else if(action==="site_message_pin" || action==="site_message_unpin"){
            const id=String(req.body?.messageId||"").trim()
            const data=loadSiteMessages()
            const item=data.messages.find(x=>x?.id===id)
            if(!item) return res.status(404).json({success:false,error:"message_not_found"})
            item.pinned=action==="site_message_pin"
            item.updatedAt=time
            saveSiteMessages(data)
        }else if(action==="system_toggle"){
            const key=String(req.body?.key||"").trim()
            const allowed=["maintenance","readOnly","registrationLocked","loginLocked"]
            if(!allowed.includes(key)) return res.status(400).json({success:false,error:"invalid_system_setting"})
            const settings=loadSystemSettings()
            settings[key]=req.body?.enabled===true
            saveSystemSettings(settings)
            return res.json({success:true,settings})
        }else if(action==="logout"){
            target.sessionToken=null
            saveUsers(users)
        }else if(action==="delete"){
            delete users[target.username]
            saveUsers(users)
        }else if(action==="rename"){
            const next=safeUsername(req.body?.newUsername)
            if(!next) return res.status(400).json({success:false,error:"invalid_username"})
            if(users[next]) return res.status(409).json({success:false,error:"username_exists"})
            delete users[target.username]
            target.username=next
            users[next]=target
            saveUsers(users)
        }else if(action==="set_flags"){
            for(const key of ["disabled","muted","shadowBanned","frozen"]){
                if(req.body[key]!==undefined) target[key]=adminBool(req.body[key])
            }
            if(target.frozen===true) target.sessionToken=null
            if(!Array.isArray(target.punishmentHistory)) target.punishmentHistory=[]
            target.punishmentHistory.unshift({type:"admin_flags",admin:admin.username,reason:reason||"Administrative flag change",date:time})
            saveUsers(users)
        }else if(action==="ban"){
            const duration=Number(req.body?.durationMs)
            target.banned=true
            target.banReason=reason||"No reason provided"
            target.banMessage=String(req.body?.banMessage||target.banReason||"Your account has been banned.").trim().slice(0,3000)
            target.banExpires=Number.isFinite(duration)&&duration>0 ? Date.now()+duration : null
            if(!Array.isArray(target.banHistory)) target.banHistory=[]
            target.banHistory.unshift({action:"ban",admin:admin.username,reason:target.banReason,duration:duration||"permanent",date:time})
            target.sessionToken=null
            saveUsers(users)
        }else if(action==="unban"){
            target.banned=false
            target.banReason=null
            target.banMessage=null
            target.banExpires=null
            if(!Array.isArray(target.banHistory)) target.banHistory=[]
            target.banHistory.unshift({action:"unban",admin:admin.username,reason:reason||"No reason provided",date:time})
            saveUsers(users)
        }else if(action==="set_permission"){
            const permission=String(req.body?.permission||"").trim()
            const allowed=["Administrator","Support","VIP","Family","Moderator"]
            if(!allowed.includes(permission)) return res.status(400).json({success:false,error:"invalid_permission"})
            const perms=loadPerms()
            if(!Array.isArray(perms.permissions[permission])) perms.permissions[permission]=[]
            if(req.body?.enabled===true){
                if(!perms.permissions[permission].includes(target.username)) perms.permissions[permission].push(target.username)
            }else{
                perms.permissions[permission]=perms.permissions[permission].filter(x=>x!==target.username)
            }
            fs.writeFileSync("permissions.json",JSON.stringify(perms,null,2))
        }else if(action==="set_badge"){
            const name=String(req.body?.badge||"").trim()
            const earned=req.body?.earned===true
            const current=Number(req.body?.current)
            const badges=ensureUserBadges(target.username)
            if(!badges[name]) return res.status(404).json({success:false,error:"badge_not_found"})
            badges[name].earned=earned
            if(Number.isFinite(current)) badges[name].current=current
            writeJson(path.join("Users",target.username,"Badges.json"),badges)
        }else if(action==="set_subscription"){
            const plan=String(req.body?.plan||"").toLowerCase()
            if(!SUBSCRIPTION_PLANS[plan]) return res.status(400).json({success:false,error:"invalid_plan"})
            const lifetime=req.body?.lifetime===true
            let expiresAt=null
            if(!lifetime){
                const durationMs=subscriptionDurationMs(req.body?.durationValue,req.body?.durationUnit)
                if(!durationMs) return res.status(400).json({success:false,error:"invalid_duration"})
                expiresAt=new Date(Date.now()+durationMs).toISOString()
            }
            saveSubscription(target.username,{active:true,plan,lifetime,activatedAt:time,expiresAt,source:"admin"})
        }else if(action==="remove_subscription"){
            saveSubscription(target.username,emptySubscription())
        }else if(action==="generate_reset"){
            const token=crypto.randomBytes(32).toString("hex")
            passwordResetTokens.set(token,{username:target.username,expires:Date.now()+15*60*1000,used:false,created:time})
            return res.json({success:true,link:`https://zyphor.cc/password-reset?token=${token}`,expiresAt:new Date(Date.now()+15*60*1000).toISOString()})
        }else if(action==="revoke_reset"){
            const prefix=String(req.body?.tokenPrefix||"")
            for(const [token,data] of passwordResetTokens){
                if(data?.username===target.username && token.startsWith(prefix)) passwordResetTokens.delete(token)
            }
        }else if(action==="revoke_all_resets"){
            for(const [token,data] of passwordResetTokens){
                if(data?.username===target.username) passwordResetTokens.delete(token)
            }
        }else if(action==="reset_2fa"){
            target.twofa=false
            target.emailVerifyCode=null
            target.emailVerifyExpires=null
            users[target.username]=target
            saveUsers(users)
        }else if(action==="set_link_code"){
            target.linkCode=generateLinkCode()
            saveUsers(users)
            return res.json({success:true,linkCode:target.linkCode})
        }else if(action==="unlink_discord"){
            target.linkedDiscord=null
            saveUsers(users)
        }else if(action==="unlink_roblox"){
            target.roblox=null
            saveUsers(users)
        }else if(action==="complete_quest"){
            const questId=String(req.body?.questId||"").trim()
            if(!questId) return res.status(400).json({success:false,error:"quest_id_required"})
            if(!Array.isArray(target.completedQuests)) target.completedQuests=[]
            if(!target.completedQuests.includes(questId)) target.completedQuests.push(questId)
            if(!Array.isArray(target.questHistory)) target.questHistory=[]
            target.questHistory.unshift({questId,time,completedBy:admin.username,adminGranted:true})
            saveUsers(users)
        }else if(action==="set_pfp_permission"){
            if(req.body?.enabled===true) grantPfpPermission(target.username,"Administrator")
            else revokePfpPermission(target.username)
        }else if(action==="remove_pfp"){
            try{
                if(fs.existsSync(currentPfpPath(target.username))) fs.unlinkSync(currentPfpPath(target.username))
            }catch{}
        }else if(action==="send_notification"){
            const message=String(req.body?.message||"").trim().slice(0,2000)
            if(!message) return res.status(400).json({success:false,error:"message_required"})
            addUserNotification(target.username,message,String(req.body?.type||"system").slice(0,40))
            if(!silent) await sendPhoneNotification(target.username,String(req.body?.title||"Zyphor").slice(0,120),message,admin.username)
        }else if(action==="delete_notification"){
            const id=String(req.body?.notificationId||"")
            const current=users[target.username]
            if(Array.isArray(current?.notifications)){
                current.notifications=current.notifications.filter(n=>String(n.id||"")!==id)
                users[target.username]=current
                saveUsers(users)
            }
        }else if(action==="clear_notifications"){
            target.notifications=[]
            saveUsers(users)
        }else if(action==="mark_notifications_read"){
            if(!Array.isArray(target.notifications)) target.notifications=[]
            target.notifications.forEach(n=>n.seen=true)
            saveUsers(users)
        }else if(action==="send_push"){
            await sendPhoneNotification(target.username,String(req.body?.title||"Zyphor").slice(0,120),String(req.body?.message||"Notification").slice(0,2000),admin.username)
        }else if(action==="set_balance"){
            if(!Number.isFinite(amount) || amount<0) return res.status(400).json({success:false,error:"invalid_amount"})
            const account=ensureZyphiumAccount(target.username)
            const old=account.balance
            account.balance=amount
            saveZyphium(target.username,account)
            if(!silent){
                addZyphiumTransaction(target.username,{transactionId:crypto.randomBytes(16).toString("hex"),type:"admin_balance_edit",amount:amount-old,oldBalance:old,newBalance:amount,balanceAfter:amount,administrator:admin.username,reason:reason||"Balance edited by administrator",time})
            }
        }else if(action==="credit"){
            if(!Number.isFinite(amount) || amount<=0) return res.status(400).json({success:false,error:"invalid_amount"})
            const account=ensureZyphiumAccount(target.username)
            account.balance=Math.floor((account.balance+amount)*100)/100
            saveZyphium(target.username,account)
            if(!silent){
                addZyphiumTransaction(target.username,{transactionId:crypto.randomBytes(16).toString("hex"),type:"admin_credit",amount,balanceAfter:account.balance,from:"Account System",to:target.username,note:reason||"",time})
            }
        }else if(action==="debit"){
            if(!Number.isFinite(amount) || amount<=0) return res.status(400).json({success:false,error:"invalid_amount"})
            const account=ensureZyphiumAccount(target.username)
            if(account.balance<amount) return res.status(400).json({success:false,error:"insufficient_balance"})
            account.balance=Math.floor((account.balance-amount)*100)/100
            saveZyphium(target.username,account)
            if(!silent){
                addZyphiumTransaction(target.username,{transactionId:crypto.randomBytes(16).toString("hex"),type:"admin_debit",amount:-amount,balanceAfter:account.balance,from:target.username,to:"Account System",note:reason||"",time})
            }
        }else if(action==="set_transaction_log"){
            target.adminTransactionLogging=req.body?.enabled!==false
            saveUsers(users)
        }else if(action==="send_gift"){
            if(!Number.isFinite(amount) || amount<=0) return res.status(400).json({success:false,error:"invalid_amount"})
            const account=ensureZyphiumAccount(admin.username)
            if(account.balance<amount) return res.status(400).json({success:false,error:"insufficient_admin_balance"})
            account.balance=Math.floor((account.balance-amount)*100)/100
            const giftId=generateZyphiumGiftId()
            const giftTime=time
            if(!silent) addZyphiumTransaction(admin.username,{transactionId:giftId,type:"gift_created",amount,balanceAfter:account.balance,from:admin.username,fromZAccountID:account.ZAccountID,note:reason||"",time:giftTime})
            saveZyphium(admin.username,account)
            const gifts=loadZyphiumGifts()
            gifts[giftId]={id:giftId,amount,message:String(req.body?.message||"").trim().slice(0,1000),sender:admin.username,senderZAccountID:account.ZAccountID,createdAt:giftTime,claimed:false,claimedBy:null,claimedAt:null,revoked:false}
            saveZyphiumGifts(gifts)
            addUserNotification(target.username,`You received ${amount} Zyphium from a gift from ${admin.username}${req.body?.message?`: ${String(req.body.message).trim().slice(0,1000)}`:"."}`,"gift")
            return res.json({success:true,giftId,link:`https://zyphor.cc/ZyphiumGift?ID=${giftId}`})
        }else if(action==="revoke_gift"){
            const id=String(req.body?.giftId||"")
            const gifts=loadZyphiumGifts()
            const gift=gifts[id]
            if(!gift || gift.sender!==target.username) return res.status(404).json({success:false,error:"gift_not_found"})
            gift.revoked=true
            gift.revokedAt=time
            gift.revokedBy=admin.username
            saveZyphiumGifts(gifts)
        }else if(action==="revoke_all_gifts"){
            const gifts=loadZyphiumGifts()
            for(const gift of Object.values(gifts)){
                if(gift && gift.sender===target.username && gift.claimed!==true){
                    gift.revoked=true
                    gift.revokedAt=time
                    gift.revokedBy=admin.username
                }
            }
            saveZyphiumGifts(gifts)
        }else if(action==="generate_codes"){
            const plan=String(req.body?.plan||"").toLowerCase()
            if(!SUBSCRIPTION_PLANS[plan]) return res.status(400).json({success:false,error:"invalid_plan"})
            const quantity=Math.min(100,Math.max(1,Math.floor(Number(req.body?.quantity)||1)))
            const lifetime=req.body?.lifetime===true
            let durationValue=null
            let durationUnit="lifetime"
            let durationMs=null
            if(!lifetime){
                durationValue=Number(req.body?.durationValue)
                durationUnit=String(req.body?.durationUnit||"").toLowerCase()
                durationMs=subscriptionDurationMs(durationValue,durationUnit)
                if(!durationMs) return res.status(400).json({success:false,error:"invalid_duration"})
            }
            const data=loadSubscriptionCodes()
            const created=[]
            for(let i=0;i<quantity;i++){
                const code=generateSubscriptionCode(plan)
                const entry={code,plan,planName:SUBSCRIPTION_PLANS[plan].name,durationValue,durationUnit,durationMs,lifetime,createdAt:time,createdBy:admin.username,redeemedAt:null,redeemedBy:null,expiresAt:null}
                data.codes.push(entry)
                created.push(entry)
            }
            saveSubscriptionCodes(data)
            return res.json({success:true,codes:created})
        }else if(action==="delete_code"){
            const code=normalizeSubscriptionCode(req.body?.code)
            const data=loadSubscriptionCodes()
            const idx=data.codes.findIndex(x=>normalizeSubscriptionCode(x.code)===code)
            if(idx===-1) return res.status(404).json({success:false,error:"code_not_found"})
            data.codes.splice(idx,1)
            saveSubscriptionCodes(data)
        }else if(action==="set_no_transaction_log"){
            target.noTransactionLog=req.body?.enabled===true
            saveUsers(users)
        }else if(action==="set_note"){
            if(!Array.isArray(target.adminNotes)) target.adminNotes=[]
            target.adminNotes.unshift({id:crypto.randomBytes(8).toString("hex"),text:reason,by:admin.username,time})
            saveUsers(users)
        }else if(action==="clear_note"){
            const noteId=String(req.body?.noteId||"")
            target.adminNotes=Array.isArray(target.adminNotes)?target.adminNotes.filter(n=>n.id!==noteId):[]
            saveUsers(users)
        }else if(action==="force_friend" || action==="remove_friend" || action==="force_friend_request" || action==="clear_friend_requests"){
            const otherUsername=String(req.body?.otherUsername||"").trim()
            const friendsData=normalizeFriendsData(loadFriends())
            if(action==="clear_friend_requests"){
                friendsData.friendRequests=friendsData.friendRequests.filter(r=>r.from!==target.username && r.to!==target.username)
                saveFriends(friendsData)
            }else{
                const other=adminResolveUser(otherUsername).target
                if(!other) return res.status(404).json({success:false,error:"other_user_not_found"})
                if(other.username===target.username) return res.status(400).json({success:false,error:"self_relationship"})
                if(action==="force_friend"){
                    Object.assign(friendsData,addFriendPair(friendsData,target.username,other.username))
                    friendsData.friendRequests=friendsData.friendRequests.filter(r=>!((r.from===target.username&&r.to===other.username)||(r.from===other.username&&r.to===target.username)))
                }else if(action==="remove_friend"){
                    removeFriendPair(friendsData,target.username,other.username)
                }else if(action==="force_friend_request"){
                    if(!areFriends(friendsData,target.username,other.username)){
                        friendsData.friendRequests=friendsData.friendRequests.filter(r=>!((r.from===target.username&&r.to===other.username)||(r.from===other.username&&r.to===target.username)))
                        friendsData.friendRequests.push({id:crypto.randomBytes(8).toString("hex"),from:target.username,to:other.username,time,forcedBy:admin.username})
                    }
                }
                saveFriends(friendsData)
                addAdminAudit(admin,"relationship_"+action,target.username,{otherUsername:other.username})
            }
        }else if(action==="ticket_close" || action==="ticket_reopen" || action==="ticket_lock" || action==="ticket_unlock" || action==="ticket_delete" || action==="ticket_assign" || action==="ticket_tag" || action==="ticket_escalate" || action==="ticket_archive" || action==="ticket_unarchive"){
            const ticketId=String(req.body?.ticketId||"").trim()
            if(!ticketId) return res.status(400).json({success:false,error:"ticket_id_required"})
            const tickets=loadTickets()
            const ticket=tickets.find(t=>t && t.id===ticketId && t.owner===target.username)
            if(!ticket) return res.status(404).json({success:false,error:"ticket_not_found"})
            if(action==="ticket_close"){
                ticket.status="closed"
                ticket.closedAt=ticket.closedAt||time
            }else if(action==="ticket_reopen"){
                ticket.status="open"
                ticket.closedAt=null
            }else if(action==="ticket_lock"){
                ticket.locked=true
            }else if(action==="ticket_unlock"){
                ticket.locked=false
            }else if(action==="ticket_delete"){
                const folder=ticketFolder(ticket.id)
                tickets.splice(tickets.indexOf(ticket),1)
                try{fs.rmSync(folder,{recursive:true,force:true})}catch{}
            }else if(action==="ticket_assign"){
                const assignee=String(req.body?.assignedTo||"").trim()
                if(assignee && !adminResolveUser(assignee).target) return res.status(404).json({success:false,error:"assignee_not_found"})
                ticket.assignedTo=assignee||null
            }else if(action==="ticket_tag"){
                const tag=String(req.body?.tag||"").trim().slice(0,60)
                if(!tag) return res.status(400).json({success:false,error:"tag_required"})
                if(!Array.isArray(ticket.tags)) ticket.tags=[]
                if(!ticket.tags.includes(tag)) ticket.tags.push(tag)
            }else if(action==="ticket_escalate"){
                ticket.priority="high"
            }else if(action==="ticket_archive"){
                ticket.archived=true
            }else if(action==="ticket_unarchive"){
                ticket.archived=false
            }
            saveTickets(tickets)
        }else if(action==="changelog_add" || action==="changelog_edit" || action==="changelog_delete" || action==="changelog_publish" || action==="changelog_unpublish" || action==="changelog_pin" || action==="changelog_unpin" || action==="changelog_duplicate"){
            let logs=loadChangelogs()
            const id=String(req.body?.changelogId||"").trim()
            if(action==="changelog_add"){
                const version=String(req.body?.version||"").trim().slice(0,80)
                const title=String(req.body?.title||"").trim().slice(0,200)
                const text=String(req.body?.text||"").trim().slice(0,20000)
                if(!version||!title||!text) return res.status(400).json({success:false,error:"changelog_fields_required"})
                logs.push({id:crypto.randomBytes(6).toString("hex"),version,title,text,time,published:req.body?.published!==false,pinned:req.body?.pinned===true,createdBy:admin.username})
            }else{
                const item=logs.find(x=>x.id===id)
                if(!item) return res.status(404).json({success:false,error:"changelog_not_found"})
                if(action==="changelog_edit"){
                    item.version=String(req.body?.version||item.version||"").trim().slice(0,80)
                    item.title=String(req.body?.title||item.title||"").trim().slice(0,200)
                    item.text=String(req.body?.text||item.text||"").trim().slice(0,20000)
                    item.updatedAt=time
                    item.updatedBy=admin.username
                }else if(action==="changelog_delete"){
                    logs=logs.filter(x=>x.id!==id)
                }else if(action==="changelog_publish"){
                    item.published=true
                    item.publishedAt=item.publishedAt||time
                }else if(action==="changelog_unpublish"){
                    item.published=false
                }else if(action==="changelog_pin"){
                    item.pinned=true
                }else if(action==="changelog_unpin"){
                    item.pinned=false
                }else if(action==="changelog_duplicate"){
                    logs.push({...item,id:crypto.randomBytes(6).toString("hex"),title:String(item.title||"")+" (Copy)",time,createdBy:admin.username,updatedAt:null,updatedBy:null})
                }
            }
            saveChangelogs(logs)
            if(action==="changelog_add") return res.json({success:true,id:logs.at(-1)?.id||null})
        }else if(action==="audit_cleanup"){
            saveAdminAudit([])
        }else if(action==="resend_link_code"){
            target.linkCode=generateLinkCode()
            saveUsers(users)
            return res.json({success:true,linkCode:target.linkCode})
        }else if(action==="clear_pending_email"){
            target.pendingEmail=null
            target.emailVerifyCode=null
            target.emailVerifyExpires=null
            saveUsers(users)
        }else if(action==="set_email"){
            const email=String(req.body?.email||"").trim().toLowerCase()
            if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,error:"invalid_email"})
            target.email=email
            target.emailVerifiedAt=req.body?.verified===true ? time : null
            target.pendingEmail=null
            target.emailVerifyCode=null
            target.emailVerifyExpires=null
            saveUsers(users)
        }else if(action==="rotate_session"){
            target.sessionToken=generateToken()
            saveUsers(users)
            return res.json({success:true,sessionActive:true})
        }else if(action==="reset_code"){
            target.code=generateCode()
            saveUsers(users)
            return res.json({success:true,code:target.code})
        }else if(action==="set_vip_flag"){
            target.vip=req.body?.enabled===true
            target.vipSince=target.vip ? (target.vipSince||time) : null
            saveUsers(users)
        }else if(action==="set_field"){
            const field=String(req.body?.field||"").trim()
            const allowed=["disabled","muted","shadowBanned","frozen","vip","twofa"]
            if(!allowed.includes(field)) return res.status(400).json({success:false,error:"field_not_allowed"})
            target[field]=req.body?.value===true
            if(field==="frozen" && target.frozen===true) target.sessionToken=null
            saveUsers(users)
        }else{
            return res.status(400).json({success:false,error:"unknown_action"})
        }

        addAdminAudit(admin,action,target?.username||null,{reason,amount:Number.isFinite(amount)?amount:null,silent})
        res.json({success:true})
    }catch(err){
        console.error("ADMIN CONTROL ACTION ERROR:",err)
        res.status(500).json({success:false,error:"server",message:String(err?.message||"")})
    }
})

app.get("/admin/control/site-messages",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const data=loadSiteMessages()
    res.json({success:true,messages:data.messages})
})

app.get("/admin/control/system-settings",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    res.json({success:true,settings:loadSystemSettings()})
})

app.get("/admin/control/codes",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const data=loadSubscriptionCodes()
    res.json({success:true,codes:data.codes,total:data.codes.length})
})

app.get("/admin/control/notifications",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.query.username||adminHeaderTarget(req)).trim()
    if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
    const {target}=adminResolveUser(username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    res.json({success:true,notifications:Array.isArray(target.notifications)?target.notifications:[]})
})

app.get("/admin/control/gift-links",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.query.username||"").trim()
    const gifts=Object.values(loadZyphiumGifts()).filter(g=>g && (!username || g.sender===username)).slice(0,1000)
    res.json({success:true,gifts})
})

app.post("/admin/control/toggle",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.body?.username||adminHeaderTarget(req)).trim()
    if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
    const {users,target}=adminResolveUser(username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    const field=String(req.body?.field||"").trim()
    if(!["disabled","muted","shadowBanned","frozen","vip","twofa"].includes(field)) return res.status(400).json({success:false,error:"invalid_field"})
    target[field]=!target[field]
    if(field==="frozen" && target.frozen) target.sessionToken=null
    saveUsers(users)
    addAdminAudit(admin,"toggle_"+field,target.username,{value:target[field]})
    res.json({success:true,value:target[field]})
})




app.get("/admin/control/social",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.query.username||adminHeaderTarget(req)).trim()
    if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
    const {target}=adminResolveUser(username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    try{
        const friendsData=normalizeFriendsData(loadFriends())
        const friends=Array.isArray(friendsData.friends[target.username])?[...friendsData.friends[target.username]]:[]
        const incomingRequests=friendsData.friendRequests.filter(r=>r && r.to===target.username)
        const outgoingRequests=friendsData.friendRequests.filter(r=>r && r.from===target.username)
        const chats=adminLoadUserChats(target.username)
        addAdminAudit(admin,"view_social",target.username,{friends:friends.length,chats:chats.length})
        res.json({success:true,username:target.username,friends,incomingRequests,outgoingRequests,chats})
    }catch(err){
        console.error("ADMIN SOCIAL ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/tickets",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const username=String(req.query.username||adminHeaderTarget(req)).trim()
    if(!validateAdminTargetHeader(req,username)) return res.status(409).json({success:false,error:"selected_user_mismatch"})
    const {target}=adminResolveUser(username)
    if(!target) return res.status(404).json({success:false,error:"user_not_found"})
    try{
        const status=String(req.query.status||"all").trim().toLowerCase()
        const tickets=adminLoadUserTickets(target.username,["all","open","closed"].includes(status)?status:"all")
        addAdminAudit(admin,"view_tickets",target.username,{count:tickets.length,status})
        res.json({success:true,username:target.username,tickets})
    }catch(err){
        console.error("ADMIN TICKETS ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/changelogs",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const logs=loadChangelogs().sort((a,b)=>{
        const ap=a.pinned===true?1:0
        const bp=b.pinned===true?1:0
        if(ap!==bp) return bp-ap
        return new Date(b.time||0)-new Date(a.time||0)
    })
    res.json({success:true,logs})
})

app.get("/admin/control/metrics",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    try{
        const users=Object.values(loadUsers()).filter(Boolean)
        const perms=loadPerms()
        const tickets=loadTickets()
        const friendsData=normalizeFriendsData(loadFriends())
        const chatFiles=fs.existsSync("dms")?fs.readdirSync("dms").filter(x=>x.endsWith(".json")):[]
        let dmMessages=0
        for(const file of chatFiles){
            try{
                const chat=JSON.parse(fs.readFileSync(path.join("dms",file),"utf8"))
                dmMessages+=Array.isArray(chat.messages)?chat.messages.length:0
            }catch{}
        }
        let friendEdges=0
        for(const list of Object.values(friendsData.friends||{})) if(Array.isArray(list)) friendEdges+=list.length
        const normalizedFriendships=Math.floor(friendEdges/2)
        let notifications=0
        let unreadNotifications=0
        let totalBalance=0
        let transactionCount=0
        let subscribed=0
        let earnedBadges=0
        for(const u of users){
            if(Array.isArray(u.notifications)){
                notifications+=u.notifications.length
                unreadNotifications+=u.notifications.filter(n=>n && n.seen!==true).length
            }
            const account=ensureZyphiumAccount(u.username)
            totalBalance+=Number(account.balance)||0
            transactionCount+=Array.isArray(account.transactions)?account.transactions.length:0
            if(getActiveSubscription(u.username)) subscribed++
            try{
                const b=ensureUserBadges(u.username)
                earnedBadges+=Object.values(b).filter(x=>x && x.earned===true).length
            }catch{}
        }
        const pageLogs=loadPageLogs()
        let visits=0
        const uniqueVisitUsers=new Set()
        const uniquePages=new Set()
        let recentActivity=[]
        for(const [username,entries] of Object.entries(pageLogs)){
            if(!Array.isArray(entries)) continue
            uniqueVisitUsers.add(username)
            for(const e of entries){
                visits++
                if(e.page) uniquePages.add(String(e.page))
                if(recentActivity.length<500) recentActivity.push({username,page:e.page||"Unknown",time:e.time||null})
            }
        }
        recentActivity.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0))
        const metrics={
            users:users.length,
            online:users.filter(u=>!!u.sessionToken).length,
            banned:users.filter(u=>u.banned===true).length,
            disabled:users.filter(u=>u.disabled===true).length,
            frozen:users.filter(u=>u.frozen===true).length,
            muted:users.filter(u=>u.muted===true).length,
            shadowBanned:users.filter(u=>u.shadowBanned===true).length,
            administrators:Array.isArray(perms.permissions.Administrator)?perms.permissions.Administrator.length:0,
            support:Array.isArray(perms.permissions.Support)?perms.permissions.Support.length:0,
            vip:Array.isArray(perms.permissions.VIP)?perms.permissions.VIP.length:0,
            family:Array.isArray(perms.permissions.Family)?perms.permissions.Family.length:0,
            moderator:Array.isArray(perms.permissions.Moderator)?perms.permissions.Moderator.length:0,
            subscribed,
            totalZyphium:Math.round(totalBalance*100)/100,
            transactionCount,
            notifications,
            unreadNotifications,
            tickets:tickets.length,
            openTickets:tickets.filter(t=>t.status==="open").length,
            closedTickets:tickets.filter(t=>t.status==="closed").length,
            lockedTickets:tickets.filter(t=>t.locked===true).length,
            dmChats:chatFiles.length,
            dmMessages,
            friends:normalizedFriendships,
            friendRequests:friendsData.friendRequests.length,
            earnedBadges,
            pageVisits:visits,
            uniqueVisitUsers:uniqueVisitUsers.size,
            uniquePages:uniquePages.size,
            changelogs:loadChangelogs().length,
            uptimeSeconds:Math.floor(process.uptime()),
            node:process.version,
            memoryMB:Math.round(process.memoryUsage().rss/1024/1024),
            recentActivity:recentActivity.slice(0,100)
        }
        addAdminAudit(admin,"view_metrics",null,{})
        res.json({success:true,metrics})
    }catch(err){
        console.error("ADMIN METRICS ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

app.get("/admin/control/search-all",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const q=String(req.query.q||"").trim().toLowerCase()
    if(!q) return res.json({success:true,results:[]})
    try{
        const users=Object.values(loadUsers()).filter(u=>u && u.username)
        const userResults=users.filter(u=>String(u.username).toLowerCase().includes(q)||String(u.id||"").toLowerCase()===q||String(u.email||"").toLowerCase().includes(q)||String(u.linkedDiscord?.id||"").toLowerCase()===q||String(u.roblox?.id||"").toLowerCase()===q).slice(0,100).map(u=>({type:"user",username:u.username,id:u.id,email:u.email||null}))
        const ticketResults=[]
        for(const t of loadTickets()){
            const hay=JSON.stringify({id:t.id,title:t.title,reason:t.reason,info:t.info,messages:t.messages}).toLowerCase()
            if(hay.includes(q)) ticketResults.push({type:"ticket",id:t.id,owner:t.owner,title:t.title,status:t.status})
            if(ticketResults.length>=100) break
        }
        const dmResults=[]
        const chats=adminLoadAllChatsForSearch(q)
        for(const c of chats) dmResults.push(c)
        const changelogResults=loadChangelogs().filter(c=>JSON.stringify(c).toLowerCase().includes(q)).slice(0,100).map(c=>({type:"changelog",id:c.id,version:c.version,title:c.title,time:c.time}))
        const notificationResults=[]
        for(const u of users){
            for(const n of (Array.isArray(u.notifications)?u.notifications:[])){
                if(JSON.stringify(n).toLowerCase().includes(q)) notificationResults.push({type:"notification",username:u.username,id:n.id,message:n.message,time:n.time})
                if(notificationResults.length>=100) break
            }
            if(notificationResults.length>=100) break
        }
        addAdminAudit(admin,"global_search",null,{query:q,userResults:userResults.length,ticketResults:ticketResults.length,dmResults:dmResults.length,changelogResults:changelogResults.length,notificationResults:notificationResults.length})
        res.json({success:true,results:[...userResults,...ticketResults,...dmResults,...changelogResults,...notificationResults]})
    }catch(err){
        console.error("ADMIN SEARCH ERROR:",err)
        res.status(500).json({success:false,error:"server"})
    }
})

function adminLoadAllChatsForSearch(q){
    const out=[]
    for(const item of listStoredChats(loadDMs())){
        const messages=readAllDmMessages(item.folder)
        const matched=messages.filter(m=>JSON.stringify(m).toLowerCase().includes(q)).slice(0,10)
        if(matched.length) out.push({type:"dm",id:item.meta.id||item.folder,users:item.meta.users||[],matches:matched.map(m=>({author:m.author||m.from||"Unknown",text:m.text||m.message||"",time:m.time||m.timestamp||null}))})
        if(out.length>=100) break
    }
    return out
}

app.post("/admin/control/bulk-action",async(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    const usernames=Array.isArray(req.body?.usernames)?[...new Set(req.body.usernames.map(x=>String(x||"").trim()).filter(Boolean))].slice(0,500):[]
    const action=String(req.body?.action||"").trim()
    if(!usernames.length) return res.status(400).json({success:false,error:"no_users"})
    const allowed=["ban","unban","logout","freeze","unfreeze","reset_2fa","clear_notifications","mark_notifications_read","grant_vip","revoke_vip","grant_pfp","revoke_pfp","remove_subscription","no_tx_log","tx_log"]
    if(!allowed.includes(action)) return res.status(400).json({success:false,error:"invalid_bulk_action"})
    const users=loadUsers()
    const results=[]
    for(const username of usernames){
        const target=resolveUserRecord(users,username)
        if(!target){results.push({username,success:false,error:"user_not_found"});continue}
        try{
            if(action==="ban"){target.banned=true;target.banReason="Bulk administrator action";target.banExpires=null;target.sessionToken=null}
            else if(action==="unban"){target.banned=false;target.banReason=null;target.banExpires=null}
            else if(action==="logout"){target.sessionToken=null}
            else if(action==="freeze"){target.frozen=true;target.sessionToken=null}
            else if(action==="unfreeze"){target.frozen=false}
            else if(action==="reset_2fa"){target.twofa=false;target.emailVerifyCode=null;target.emailVerifyExpires=null}
            else if(action==="clear_notifications"){target.notifications=[]}
            else if(action==="mark_notifications_read"){if(!Array.isArray(target.notifications))target.notifications=[];target.notifications.forEach(n=>n.seen=true)}
            else if(action==="grant_vip"){target.vip=true;target.vipSince=target.vipSince||new Date().toISOString()}
            else if(action==="revoke_vip"){target.vip=false;target.vipSince=null}
            else if(action==="grant_pfp"){grantPfpPermission(target.username,"Administrator")}
            else if(action==="revoke_pfp"){revokePfpPermission(target.username)}
            else if(action==="remove_subscription"){saveSubscription(target.username,emptySubscription())}
            else if(action==="no_tx_log"){target.noTransactionLog=true}
            else if(action==="tx_log"){target.noTransactionLog=false}
            users[target.username]=target
            results.push({username:target.username,success:true})
        }catch(err){results.push({username:target.username,success:false,error:String(err?.message||"error")})}
    }
    saveUsers(users)
    addAdminAudit(admin,"bulk_"+action,null,{count:usernames.length,successful:results.filter(x=>x.success).length})
    res.json({success:true,results})
})

app.get("/adminpanel",(req,res)=>{
    const admin=adminTarget(req)
    if(!admin) return res.sendStatus(403)
    res.sendFile(path.join(__dirname,"adminpanel.html"))
})

app.post("/admin/send-notification",async(req,res)=>{

try{

const sessionToken=req.headers.authorization

if(!sessionToken){

return res.status(401).json({
success:false,
error:"missing session"
})

}

const users=loadUsers()
const perms=loadPerms()


let adminUser=null


for(const username in users){

if(users[username].sessionToken===sessionToken){

adminUser=users[username]

break

}

}


if(!adminUser){

return res.status(401).json({
success:false,
error:"invalid session"
})

}


if(
!perms.permissions.Administrator.includes(adminUser.username)
){

return res.status(403).json({
success:false,
error:"not administrator"
})

}


const {
username,
title,
body
}=req.body


const target=users[username]


if(!target){

return res.json({
success:false,
error:"user not found"
})

}


if(
!Array.isArray(target.devices) ||
target.devices.length===0
){

return res.json({
success:false,
error:"user has no devices"
})

}


let sent=0
let failed=[]


for(const deviceToken of target.devices){


try{


await getMessaging().send({

    token: deviceToken,

    data: {

        title: title || "Zyphor",

        body: body || "Notification"

    },

    android: {

        priority: "high"

    }

})


sent++


}catch(err){


failed.push(err.message)


}


}



res.json({

success:true,
admin:adminUser.username,
target:username,
sent,
failed

})


}catch(err){


console.error(err)


res.status(500).json({

success:false,
error:err.message

})


}


})

app.post("/admin/schedule/delete",(req,res)=>{
const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {date,start,end}=req.body

let data=loadSchedule()

if(!data.booked[date]) return res.json({success:true})

data.booked[date]=data.booked[date].filter(b=>!(b.start===start && b.end===end))

let tickets=loadTickets()

tickets.forEach(t=>{
if(t.booked && t.booked.date===date && t.booked.start===start && t.booked.end===end){
t.booked=null
t.messages.push({
author:"System",
text:"Your booking was removed. Please select a new time.",
time:new Date().toISOString()
})
}
})

saveSchedule(data)
saveTickets(tickets)

res.json({success:true})
})

const CONTRIBUTIONS_FILE = path.join(__dirname, "Contributions.json")

function loadContributions(){
    try{
        if(!fs.existsSync(CONTRIBUTIONS_FILE)){
            fs.writeFileSync(CONTRIBUTIONS_FILE, JSON.stringify({}, null, 2))
        }

        const data = JSON.parse(
            fs.readFileSync(CONTRIBUTIONS_FILE, "utf8")
        )

        return data && typeof data === "object" ? data : {}
    }catch{
        return {}
    }
}

app.get("/contributions",(req,res)=>{
    try{
        const contributions = loadContributions()
        const users = loadUsers()

        const result = Object.entries(contributions).map(([username,data])=>{
            const user = users[username]

            return {
                username,
                pfp: `/account/pfp/${encodeURIComponent(username)}?v=${Date.now()}`,
                contributions:
                    Array.isArray(data)
                        ? data
                        : Array.isArray(data?.contributions)
                            ? data.contributions
                            : []
            }
        })

        res.json({
            success:true,
            contributions:result
        })
    }catch(err){
        console.error("CONTRIBUTIONS ERROR:",err)
        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.post("/password-reset/request",async(req,res)=>{

try{

const {username,email}=req.body

if(!username || !email)
return res.json({error:"missing"})

const users=loadUsers()

const user=users[username]

if(!user)
return res.json({success:true})

if(
String(user.email||"").toLowerCase().trim() !==
String(email).toLowerCase().trim()
){
return res.json({success:true})
}

const ip=getIP(req)

const lastUser=
passwordResetCooldownUser.get(user.username)||0

if(Date.now()-lastUser < 15*60*1000){
return res.json({
error:"cooldown",
remaining:
15*60*1000-(Date.now()-lastUser)
})
}

const lastIP=
passwordResetCooldownIP.get(ip)||0

if(Date.now()-lastIP < 30000){

const remaining=
30000-(Date.now()-lastIP)

return res.json({
error:"globalcooldown",
remaining
})
}

const existingPos=
passwordResetQueuePosition(user.username)

if(existingPos!==-1){

const remaining=Math.max(
0,
30000-(Date.now()%30000)
)

return res.json({
queued:true,
position:existingPos+1,
eta:(existingPos+1)*30000,
globalCooldown:remaining
})
}

passwordResetCooldownUser.set(
user.username,
Date.now()
)

passwordResetCooldownIP.set(
ip,
Date.now()
)

passwordResetQueue.push({
username:user.username,
user,
expires:Date.now()+60000
})

processPasswordResetQueue()

const pos=
passwordResetQueuePosition(user.username)

const remaining=Math.max(
0,
30000-(Date.now()%30000)
)

res.json({
success:true,
queued:true,
position:pos+1,
eta:(pos+1)*30000,
globalCooldown:remaining
})

}catch(err){

console.error(err)

res.json({error:"server"})

}

})

const passwordResetTokens = new Map()

function getPasswordHistoryFile(username){
return path.join("Users",username,"PasswordHistory.json")
}

function loadPasswordHistory(username){
const file=getPasswordHistoryFile(username)

try{
const data=JSON.parse(fs.readFileSync(file,"utf8"))
return Array.isArray(data.history)?data.history:[]
}catch{
return []
}
}

function savePasswordHistory(username,history){
const folder=path.join("Users",username)

if(!fs.existsSync(folder)){
fs.mkdirSync(folder,{recursive:true})
}

fs.writeFileSync(
getPasswordHistoryFile(username),
JSON.stringify({history},null,2)
)
}

function addPasswordHistory(username,password,changedBy,reason){
if(!password) return

const history=loadPasswordHistory(username)

history.push({
password:String(password),
changedAt:new Date().toISOString(),
changedBy:changedBy || "system",
reason:reason || "Password changed"
})

while(history.length>10){
history.shift()
}

savePasswordHistory(username,history)
}

function hasUsedPassword(username,password){
return loadPasswordHistory(username)
.some(entry=>String(entry.password).trim()===String(password).trim())
}

app.post("/admin/generate-password-reset",(req,res)=>{
const user=auth(req)

if(!user || !hasAdmin(user))
return res.sendStatus(403)

const {username}=req.body

if(!username)
return res.json({error:"missing"})

const users=loadUsers()
const target=users[username]

if(!target)
return res.json({error:"nouser"})

const token=crypto.randomBytes(32).toString("hex")

passwordResetTokens.set(token,{
username,
expires:Date.now()+15*60*1000,
used:false,
created:new Date().toISOString()
})

const link=`https://zyphor.cc/password-reset?token=${token}`

res.json({
success:true,
link,
expiresIn:"15 minutes"
})
})

app.get("/password-reset",(req,res)=>{
res.sendFile(__dirname + "/password-reset.html")
})

app.post("/password-reset/change",(req,res)=>{

let {token,password}=req.body

if(!token || !password)
return res.json({error:"missing"})

password=String(password).trim()

if(password.length<4)
return res.json({error:"weakpassword"})

const data=passwordResetTokens.get(token)

if(!data)
return res.json({error:"invalid"})

if(data.used)
return res.json({error:"used"})

if(Date.now()>data.expires){

passwordResetTokens.delete(token)

return res.json({error:"expired"})
}

const users=loadUsers()

const user=users[data.username]

if(!user)
return res.json({error:"nouser"})

const oldPassword=String(user.password||"").trim()

if(oldPassword===password)
return res.json({error:"samepassword"})

if(hasUsedPassword(user.username,password))
return res.json({error:"oldpassword"})

addPasswordHistory(
user.username,
oldPassword,
"password_reset",
"Password reset"
)

user.password=password

user.passwordChangedAt=new Date().toISOString()

users[data.username]=user

saveUsers(users)

data.used=true
data.usedAt=new Date().toISOString()

res.json({
success:true
})

})

app.post("/family/login",(req,res)=>{

const token=req.headers.authorization

if(!token){
return res.json({
success:false,
error:"missing_session"
})
}

const users=loadUsers()

const user=Object.values(users).find(u=>u.sessionToken===token)

if(!user){
return res.json({
success:false,
error:"invalid_session"
})
}

if(!hasFamily(user)){
return res.json({
success:false,
error:"not_family"
})
}

res.json({
success:true,
username:user.username
})

})


app.post("/family/location/update",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({
error:"unauthorized"
})
}

if(!hasFamily(user)){
return res.json({
error:"denied"
})
}

const {
latitude,
longitude,
accuracy
}=req.body

if(
typeof latitude !== "number" ||
typeof longitude !== "number"
){
return res.json({
error:"missing_location"
})
}

let data=loadFamilyLocations()

data[user.username]={
username:user.username,
latitude,
longitude,
accuracy: accuracy ?? null,
updated:Date.now()
}

saveFamilyLocations(data)

res.json({
success:true
})

})

const pfpUpload=multer({
storage:multer.memoryStorage(),
limits:{
fileSize:50*1024*1024
},
fileFilter:(req,file,cb)=>{

const allowed=[
"image/png",
"image/jpeg",
"image/webp",
"image/gif"
]

if(!allowed.includes(file.mimetype)){
return cb(new Error("invalid file type"))
}

cb(null,true)

}
})

app.get(
"/account/pfp/status",
(req,res)=>{

const user=auth(req)

if(!user){
return res.status(401).json({
error:"unauthorized"
})
}

const permissions=loadUnlockablePermissions(
user.username
)

const remaining=getPfpCooldown(
user.username
)

const subscription=getActiveSubscription(user.username)

res.json({
permission:{
...permissions.PFP,
enabled:permissions.PFP?.enabled===true||!!subscription
},
canUpload:(
hasPfpPermission(user.username)||
hasAdmin(user)
)&&remaining===0,
gifAllowed:!!subscription?.details?.gif||hasAdmin(user),
cooldownRemaining:remaining,
nextChangeAt:remaining>0
?new Date(
Date.now()+remaining
).toISOString()
:null,
isAdministrator:hasAdmin(user)
})

}
)

app.post(
"/account/pfp/upload",
pfpUpload.single("pfp"),
(req,res)=>{

try{

const user=auth(req)

if(!user){
return res.status(401).json({
error:"unauthorized"
})
}

if(!req.file){
return res.status(400).json({
error:"no_file"
})
}

const isGif=req.file.mimetype==="image/gif"

if(isGif&&!hasAdmin(user)&&!getActiveSubscription(user.username)?.details?.gif){
return res.status(403).json({
error:"gif_requires_subscription"
})
}

if(!hasPfpPermission(user.username)&&!hasAdmin(user)){
return res.status(403).json({
error:"no_pfp_permission"
})
}

const maxSize=isGif
?50*1024*1024
:5*1024*1024

if(req.file.size>maxSize){
return res.status(413).json({
error:"file_too_large",
maxSize:maxSize
})
}

const cooldownRemaining=getPfpCooldown(
user.username
)

if(cooldownRemaining>0){
return res.status(429).json({
error:"cooldown",
remaining:cooldownRemaining,
nextChangeAt:new Date(
Date.now()+cooldownRemaining
).toISOString()
})
}

ensurePfpFolders(
user.username
)

const currentPng=path.join(
pfpFolder(user.username),
"PFP.png"
)

const currentJpg=path.join(
pfpFolder(user.username),
"PFP.jpg"
)

const currentWebp=path.join(
pfpFolder(user.username),
"PFP.webp"
)

const currentGif=path.join(
pfpFolder(user.username),
"PFP.gif"
)

const history=loadPfpHistory(
user.username
)

if(!Array.isArray(history.history)){
history.history=[]
}

let oldFile=null
let oldExtension=null

if(fs.existsSync(currentGif)){
oldFile=currentGif
oldExtension="gif"
}else if(fs.existsSync(currentPng)){
oldFile=currentPng
oldExtension="png"
}else if(fs.existsSync(currentJpg)){
oldFile=currentJpg
oldExtension="jpg"
}else if(fs.existsSync(currentWebp)){
oldFile=currentWebp
oldExtension="webp"
}

if(oldFile){

const changeTime=new Date()

const historyId=
`${changeTime.getTime()}-${crypto.randomBytes(6).toString("hex")}`

const historyFileName=
`${historyId}.${oldExtension}`

const historyFile=path.join(
pfpHistoryPngFolder(user.username),
historyFileName
)

fs.copyFileSync(
oldFile,
historyFile
)

history.history.push({
id:historyId,
file:`Pngs/${historyFileName}`,
changedAt:changeTime.toISOString(),
type:"previous",
format:oldExtension
})

}

fs.mkdirSync(
pfpFolder(user.username),
{recursive:true}
)

for(const file of [
currentPng,
currentJpg,
currentWebp,
currentGif
]){

if(fs.existsSync(file)){
fs.unlinkSync(file)
}

}

let extension="png"

if(req.file.mimetype==="image/jpeg"){
extension="jpg"
}

if(req.file.mimetype==="image/webp"){
extension="webp"
}

if(isGif){
extension="gif"
}

const currentFile=path.join(
pfpFolder(user.username),
`PFP.${extension}`
)

fs.writeFileSync(
currentFile,
req.file.buffer
)

const changedAt=new Date().toISOString()

history.history.push({
id:crypto.randomBytes(8).toString("hex"),
file:`PFP.${extension}`,
changedAt:changedAt,
type:"current",
format:extension
})

savePfpHistory(
user.username,
history
)

res.json({
success:true,
changedAt:changedAt,
format:extension,
url:`/account/pfp/${encodeURIComponent(user.username)}?v=${Date.now()}`
})

}catch(err){

console.error(
"PFP UPLOAD ERROR:",
err
)

res.status(500).json({
error:"server"
})

}

}
)

app.get(
"/account/pfp/:username",
(req,res)=>{

const requestedUsername=safeUsername(req.params.username);
if(!requestedUsername) return res.sendStatus(404);
const allUsers=loadUsers();
const profileOwner=Object.values(allUsers).find(candidate=>
    String(candidate.username||"").toLowerCase()===requestedUsername.toLowerCase() ||
    String(candidate.CheatBait?.displayName||"").trim().toLowerCase()===requestedUsername.toLowerCase()
);
const username=profileOwner?.username || requestedUsername;
if(profileOwner?.CheatBait?.displayPfpExt){
    const ext=profileOwner.CheatBait.displayPfpExt;
    const baitFile=path.join(ensureUserFolder(username),"CheatBait",`DisplayPFP.${ext}`);
    if(fs.existsSync(baitFile)) return res.sendFile(baitFile);
}

const files=[
"PFP.gif",
"PFP.png",
"PFP.jpg",
"PFP.webp"
]

for(const fileName of files){

const file=path.join(
pfpFolder(username),
fileName
)

if(fs.existsSync(file)){
return res.sendFile(file)
}

}

return res.sendStatus(404)

}
)

app.get("/family/locations",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({
error:"unauthorized"
})
}

if(!hasFamily(user)){
return res.json({
error:"denied"
})
}

const data=loadFamilyLocations()

let locations=[]

for(const name in data){

locations.push({
username:data[name].username,
latitude:data[name].latitude,
longitude:data[name].longitude,
accuracy:data[name].accuracy ?? null,
updated:data[name].updated
})

}

res.json({
success:true,
locations
})

})

app.post("/admin/complete-quest",(req,res)=>{
  try{
    const { secret, username, questId } = req.body

    if(secret !== WEBSITE_SECRET)
      return res.status(403).json({ error: "unauthorized" })

    const users = loadUsers()
    const user = users[username]
    if(!user) return res.json({ error: "nouser" })

    if(!Array.isArray(user.completedQuests))
      user.completedQuests = []

    if(user.completedQuests.includes(questId))
      return res.json({ error: "alreadycompleted" })

    user.completedQuests.push(questId)

    if(!Array.isArray(user.questHistory))
      user.questHistory = []

    user.questHistory.push({
      questId,
      completedAt: new Date().toISOString()
    })

    saveUsers(users)

    res.json({ success: true })
  }catch(err){
    console.error("COMPLETE QUEST ERROR:", err)
    res.status(500).json({ error: "server" })
  }
})

app.get(
"/account/pfp/status",
(req,res)=>{

const user=auth(req)

if(!user){
return res.status(401).json({
error:"unauthorized"
})
}

const permissions=
loadUnlockablePermissions(
user.username
)

const remaining=
getPfpCooldown(
user.username
)

res.json({
permission:permissions.PFP,
canUpload:
(
permissions.PFP?.enabled===true ||
hasAdmin(user)
) &&
remaining===0,
cooldownRemaining:remaining,
nextChangeAt:
remaining>0
?new Date(
Date.now()+remaining
).toISOString()
:null,
isAdministrator:hasAdmin(user)
})

}
)

app.post("/create-roblox-link",(req,res)=>{
const {secret,discordId}=req.body
if(secret!==WEBSITE_SECRET) return res.sendStatus(403)

const token=generateLinkCode()

robloxLinkTokens.set(token,{
discordId,
expires:Date.now()+5*60*1000
})

res.json({token})
})

app.post("/link-roblox", async (req,res)=>{
try{

const {token,username}=req.body

const data=robloxLinkTokens.get(token)
if(!data) return res.json({error:"invalid"})

if(Date.now()>data.expires){
robloxLinkTokens.delete(token)
return res.json({error:"expired"})
}

const users=loadUsers()

let found=null
for(const u of Object.values(users)){
if(u.linkedDiscord && u.linkedDiscord.id===data.discordId){
found=u
break
}
}

if(!found) return res.json({error:"nodiscordlink"})

const r = await fetch("https://users.roblox.com/v1/usernames/users",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
usernames:[username],
excludeBannedUsers:true
})
})

const d = await r.json()

if(!d.data.length)
return res.json({error:"nouser"})

const robloxId = d.data[0].id

const profile = await fetch(`https://users.roblox.com/v1/users/${robloxId}`)
const profileData = await profile.json()

if(!profileData.description || !profileData.description.includes(token)){
return res.json({error:"nobio"})
}

found.roblox={
id:robloxId,
username
}

saveUsers(users)

robloxLinkTokens.delete(token)

res.json({success:true})

}catch(err){
console.error(err)
res.status(500).json({error:"server"})
}
})

app.post("/admin/unban",(req,res)=>{
  try{
    const { secret, username, reason } = req.body

    if(secret !== WEBSITE_SECRET)
      return res.status(403).json({ error: "unauthorized" })

    const users = loadUsers()
    const user = users[username]
    if(!user) return res.json({ error: "nouser" })

    user.banned = false
    user.banReason = null
    user.banExpires = null

    if(!Array.isArray(user.banHistory))
      user.banHistory = []

    user.banHistory.push({
      action: "unban",
      reason: reason || "No reason provided",
      date: new Date().toISOString()
    })

    saveUsers(users)

    res.json({ success: true })
  }catch(err){
    console.error("UNBAN ERROR:", err)
    res.status(500).json({ error: "server" })
  }
})

app.get("/url/:page", (req, res) => {
    try {
        const requestedUrl = String(req.params.page || "").trim()

        if (!requestedUrl) {
            return res.status(400).send("Missing URL")
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(requestedUrl)) {
            return res.status(400).send("Invalid URL")
        }

        const filePath = path.join(
            __dirname,
            "Urls",
            requestedUrl + ".html"
        )

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("Page not found")
        }

        res.sendFile(filePath)
    } catch (err) {
        console.error("URL LOAD ERROR:", err)
        res.status(500).send("Server error")
    }
})

app.post("/reports/submit",reportUpload.array("evidence",10),(req,res)=>{
try{
    const reporter=auth(req)
    if(!reporter) return res.status(401).json({error:"unauthorized"})

    const targetUsername=safeUsername(req.body.targetUsername)
    const category=String(req.body.category||"").trim()
    const reason=String(req.body.reason||"").trim().slice(0,2000)
    const allowedCategories=[
        "Inappropriate Username",
        "Inappropriate Profile Picture",
        "Harassment",
        "Spam or Scam",
        "Botted Account",
        "Other"
    ]

    if(!targetUsername || !allowedCategories.includes(category))
        return res.json({error:"invalid"})

    if(category==="Other" && !reason)
        return res.json({error:"reasonrequired"})

    const users=loadUsers()
    const target=users[targetUsername]

    if(!target) return res.json({error:"nouser"})
    if(isBanned(target,users)) return res.json({error:"targetbanned",message:"You cannot report a banned account"})
    if(reporter.username===targetUsername) return res.json({error:"selfreport"})

    const evidence=(req.files||[]).map(file=>({
        name:file.filename,
        originalName:file.originalname,
        size:file.size,
        type:file.mimetype,
        path:path.relative(ensureUserFolder(reporter.username),file.path).replace(/\\/g,"/")
    }))

    const report={
        id:crypto.randomBytes(12).toString("hex"),
        reporter:reporter.username,
        target:targetUsername,
        category,
        reason:category==="Other"?reason:"",
        evidence,
        status:"open",
        createdAt:new Date().toISOString()
    }

    const reports=loadReports(reporter.username)
    reports.reports.unshift(report)
    saveReports(reporter.username,reports)

    logAction("report_submit",{
        reporter:reporter.username,
        target:targetUsername,
        category,
        id:report.id
    })

    res.json({success:true,id:report.id})
}catch(err){
    console.error("REPORT SUBMIT ERROR:",err)
    res.status(500).json({error:"server"})
}
})

app.get("/admin/reports",(req,res)=>{
    try{
        const admin=auth(req)

        if(!admin || !hasAdmin(admin)){
            return res.sendStatus(403)
        }

        const users=loadUsers()
        const reports=[]

        for(const username of Object.keys(users)){
            const active=loadReports(username)

            for(const report of active.reports){
                reports.push({
                    ...report,
                    status:report.status||"open"
                })
            }

            const history=loadReportsHistory(username)

            for(const report of history.history){
                reports.push(report)
            }
        }

        reports.sort((a,b)=>{
            return new Date(b.createdAt)-new Date(a.createdAt)
        })

        res.json({reports})

    }catch(err){
        console.error("ADMIN REPORTS ERROR:",err)

        res.status(500).json({
            error:"server"
        })
    }
})

app.get("/admin/reports/:reporter/:id/evidence/:name",(req,res)=>{
    const token=req.headers.authorization || req.query.token
    const admin=Object.values(loadUsers()).find(u=>u.sessionToken===token)

    if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

    const reporter=safeUsername(req.params.reporter)
    const name=path.basename(req.params.name)
    if(!reporter || !name) return res.sendStatus(404)

    const reports=loadReports(reporter)
    const report=reports.reports.find(x=>x.id===req.params.id)
    if(!report) return res.sendStatus(404)

    const evidence=Array.isArray(report.evidence)?report.evidence.find(x=>x.name===name):null
    if(!evidence) return res.sendStatus(404)

    const file=path.join(reportEvidenceFolder(reporter),name)
    if(!fs.existsSync(file)) return res.sendStatus(404)

    res.type(evidence.type||"application/octet-stream")
    res.sendFile(path.resolve(file))
})

app.post("/admin/reports/resolve",async(req,res)=>{
try{
    const admin=auth(req)
    if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

    const reporter=safeUsername(req.body.reporter)
    const id=String(req.body.id||"")
    const action=String(req.body.action||"resolved").trim().toLowerCase()
    const note=String(req.body.note||"").trim().slice(0,2000)

    if(!reporter || !id){
        return res.json({error:"invalid"})
    }

    const reports=loadReports(reporter)
    const index=reports.reports.findIndex(x=>x.id===id)

    if(index===-1){
        return res.json({error:"notfound"})
    }

    const report=reports.reports.splice(index,1)[0]

    const normalizedAction=
        action==="dismissed" || action==="dismiss" || action==="noaction"
        ? "dismissed"
        : "resolved"

    report.status=normalizedAction
    report.resolvedAt=new Date().toISOString()
    report.resolvedBy=admin.username
    report.adminNote=note

    saveReports(reporter,reports)

    const history=loadReportsHistory(reporter)

    history.history.unshift(report)

    if(history.history.length>1000){
        history.history.length=1000
    }

    saveReportsHistory(reporter,history)

    updateUserBadges(reporter)

    const targetUsername=String(report.target||"Unknown User")

    let notificationMessage

    if(normalizedAction==="resolved"){
        notificationMessage=`The user you reported has been punished: ${targetUsername}`
    }else{
        notificationMessage=`No action was taken against ${targetUsername}.`
    }

    addUserNotification(
        reporter,
        notificationMessage,
        "report"
    )

    await sendPhoneNotification(
        reporter,
        "Report Update",
        notificationMessage,
        "Zyphor"
    )

    logAction("report_resolve",{
        admin:admin.username,
        reporter,
        target:report.target,
        id,
        action:normalizedAction
    })

    res.json({
        success:true,
        status:normalizedAction
    })

}catch(err){
    console.error("REPORT RESOLVE ERROR:",err)

    res.status(500).json({
        error:"server"
    })
}
})

function findProfileUser(users, queryName){
    const requested=String(queryName||"").trim().toLowerCase();
    if(!requested) return null;
    return Object.values(users).find(candidate=>
        String(candidate?.username||"").toLowerCase()===requested ||
        String(candidate?.CheatBait?.displayName||"").trim().toLowerCase()===requested
    ) || null;
}

function normalizeCheatBait(user){
    if(!user.CheatBait || typeof user.CheatBait!=="object" || Array.isArray(user.CheatBait)) user.CheatBait={};
    if(!Array.isArray(user.CheatBait.statusBadges)) user.CheatBait.statusBadges=[];
    user.CheatBait.statusBadges=[...new Set(user.CheatBait.statusBadges.map(value=>String(value||"").trim()).filter(value=>EXTENSION_STATUS_BADGES.includes(value)))];
    if(!Array.isArray(user.CheatBait.events)) user.CheatBait.events=[];
    return user.CheatBait;
}

const EXTENSION_STATUS_BADGES=["Staff","Support","Admin","Mod","VIP","Beta Tester"];
const extensionPfpUpload=multer({
    storage:multer.memoryStorage(),
    limits:{fileSize:5*1024*1024},
    fileFilter:(req,file,cb)=>{
        const allowed={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"};
        if(!allowed[file.mimetype]) return cb(new Error("invalid_file_type"));
        cb(null,true);
    }
});

function recordExtensionBait(user,action,details={}){
    const now=new Date().toISOString();
    user.AntiCheatDetected=true;
    const bait=normalizeCheatBait(user);
    bait.firstDetectedAt=bait.firstDetectedAt||now;
    bait.lastDetectedAt=now;
    bait.events.push({action,at:now,details});
    if(bait.events.length>100) bait.events=bait.events.slice(-100);
    logAction("AntiCheatDetected",{username:user.username,action,details});
    return bait;
}

app.get("/extension-honeypot/me",(req,res)=>{
    const user=auth(req);
    if(!user) return res.status(401).json({error:"unauthorized"});
    const users=loadUsers();
    const fresh=users[user.username]||user;
    const bait=normalizeCheatBait(fresh);
    res.json({
        success:true,
        username:fresh.username,
        detected:fresh.AntiCheatDetected===true,
        displayName:bait.displayName||"",
        statusBadges:bait.statusBadges,
        displayPfp:bait.displayPfpExt?`/account/pfp/${encodeURIComponent(fresh.username)}?v=${Date.now()}`:null
    });
});

app.post("/extension-honeypot/action",(req,res)=>{
    try{
        const user=auth(req);
        if(!user) return res.status(401).json({error:"unauthorized"});
        const users=loadUsers();
        const fresh=users[user.username];
        if(!fresh) return res.status(404).json({error:"notfound"});
        const action=String(req.body?.action||"").trim().toLowerCase();
        const baitDetails={};
        let bait=normalizeCheatBait(fresh);

        if(action==="membership"){
            const plan=String(req.body?.plan||"").trim().toLowerCase();
            const duration=String(req.body?.duration||"").trim();
            if(!["infinity","endless","ascended"].includes(plan)) return res.status(400).json({error:"invalid_plan"});
            if(!/^(1S|1D|1M|1Y|PERM)$/i.test(duration)) return res.status(400).json({error:"invalid_duration"});
            baitDetails.plan=plan;
            baitDetails.duration=duration.toUpperCase();
        }else if(action==="force_friend"){
            const target=String(req.body?.target||"").trim().slice(0,40);
            if(!target) return res.status(400).json({error:"missing_target"});
            baitDetails.target=target;
        }else if(action==="display_name"){
            const displayName=String(req.body?.displayName||"").trim();
            if(!/^[A-Za-z0-9 _-]{2,24}$/.test(displayName)) return res.status(400).json({error:"invalid_display_name"});
            const used=Object.values(users).some(candidate=>{
                if(String(candidate.username||"").toLowerCase()===String(fresh.username).toLowerCase()) return false;
                const candidateName=String(candidate.username||"").toLowerCase();
                const candidateDisplay=String(candidate.CheatBait?.displayName||"").trim().toLowerCase();
                return candidateName===displayName.toLowerCase() || candidateDisplay===displayName.toLowerCase();
            });
            if(used) return res.status(409).json({error:"name_taken"});
            bait=recordExtensionBait(fresh,action,{requestedDisplayName:displayName});
            bait.displayName=displayName;
            saveUsers(users);
            return res.json({success:true,detected:true,displayName,profileUrl:`/profile?username=${encodeURIComponent(fresh.username)}`});
        }else if(action==="profile_badges"){
            const submitted=req.body?.badges;
            if(!Array.isArray(submitted)) return res.status(400).json({error:"invalid_badges"});
            const badges=[...new Set(submitted.map(x=>String(x).trim()).filter(x=>EXTENSION_STATUS_BADGES.includes(x)))];
            bait=recordExtensionBait(fresh,action,{badges});
            bait.statusBadges=badges;
            saveUsers(users);
            return res.json({success:true,detected:true,statusBadges:badges});
        }else{
            return res.status(400).json({error:"invalid_action"});
        }

        recordExtensionBait(fresh,action,baitDetails);
        saveUsers(users);
        res.json({success:true,detected:true,recorded:true});
    }catch(err){
        console.error("EXTENSION HONEYPOT ERROR:",err);
        res.status(500).json({error:"server"});
    }
});

app.post("/extension-honeypot/pfp",extensionPfpUpload.single("image"),(req,res)=>{
    try{
        const user=auth(req);
        if(!user) return res.status(401).json({error:"unauthorized"});
        if(!req.file) return res.status(400).json({error:"no_file"});
        const users=loadUsers();
        const fresh=users[user.username];
        if(!fresh) return res.status(404).json({error:"notfound"});
        const bait=recordExtensionBait(fresh,"pfp",{format:req.file.mimetype,size:req.file.size});
        const ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"}[req.file.mimetype];
        const folder=path.join(ensureUserFolder(fresh.username),"CheatBait");
        fs.mkdirSync(folder,{recursive:true});
        for(const oldExt of ["png","jpg","webp","gif"]){
            const oldPath=path.join(folder,`DisplayPFP.${oldExt}`);
            if(fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        fs.writeFileSync(path.join(folder,`DisplayPFP.${ext}`),req.file.buffer);
        bait.displayPfpExt=ext;
        bait.displayPfpUpdatedAt=new Date().toISOString();
        saveUsers(users);
        res.json({success:true,detected:true,url:`/account/pfp/${encodeURIComponent(fresh.username)}?v=${Date.now()}`});
    }catch(err){
        console.error("EXTENSION HONEYPOT PFP ERROR:",err);
        res.status(500).json({error:"server"});
    }
});

app.get("/profile",(req,res)=>{
try{

const username=req.query.username
if(!username) return res.json({error:"nousername"})

const users=loadUsers()
const user=findProfileUser(users,username)

if(!user) return res.json({error:"notfound"})

if(isBanned(user,users)){
return res.json({error:"banned"})
}

const quests=loadQuests()

let totalRewards={}
let completedCount=0

if(Array.isArray(user.questHistory)){
user.questHistory.forEach(h=>{
const q=quests.find(x=>x.id===h.questId)
if(!q) return

completedCount++

if(!totalRewards[q.reward.currency])
totalRewards[q.reward.currency]=0

totalRewards[q.reward.currency]+=q.reward.amount
})
}

const perms=loadPerms()

const isSupport=perms.permissions.Support.includes(user.username)
const isAdmin=perms.permissions.Administrator.includes(user.username)
const isModerator=perms.permissions.Moderator.includes(user.username)
const isBetaTester=betaTesterUsernames().has(String(user.username||"").toLowerCase())

const badgesFile=path.join("Users",user.username,"Badges.json")

let badges={}

if(fs.existsSync(badgesFile)){
try{
badges=JSON.parse(fs.readFileSync(badgesFile,"utf8"))
}catch{
badges={}
}
}

if(!badges || typeof badges!=="object" || Array.isArray(badges)) badges={};

const bait=normalizeCheatBait(user);

res.json({
username:bait.displayName || user.username,
accountUsername:user.username,
displayName:bait.displayName || null,
statusBadges:bait.statusBadges.filter(badgeName=>EXTENSION_STATUS_BADGES.includes(badgeName)),
displayPfp:bait.displayPfpExt?`/account/pfp/${encodeURIComponent(user.username)}?v=${Date.now()}`:null,
id:user.id || null,
created:user.createdAt || null,
linked:user.linkedDiscord || null,
roblox:user.roblox || null,
questsCompleted:completedCount,
earnings:totalRewards,
badges,
subscription:subscriptionResponse(user.username),
permissions:{
support:isSupport,
admin:isAdmin,
moderator:isModerator,
vip:perms.permissions.VIP.includes(user.username),
betaTester:isBetaTester
}
})

}catch(err){
console.error(err)
res.status(500).json({error:"server"})
}
})

function zyphiumPath(username){
    return path.join(ensureUserFolder(username),"Zyphium.json")
}

function defaultZyphium(){
    return {
        ZAccountID:null,
        balance:0,
        transactions:[]
    }
}

function normalizeZyphium(data){
    if(!data || typeof data!=="object") data={}

    if(typeof data.ZAccountID!=="string" || !data.ZAccountID.trim()){
        data.ZAccountID=null
    }

    data.balance=Number(data.balance)

    if(!Number.isFinite(data.balance)){
        data.balance=0
    }

    data.balance=Math.max(0,Math.floor(data.balance*100)/100)

    if(!Array.isArray(data.transactions)){
        data.transactions=[]
    }

    return data
}

function loadZyphium(username){
    return normalizeZyphium(
        readJson(
            zyphiumPath(username),
            defaultZyphium()
        )
    )
}

function saveZyphium(username,data){
    writeJson(
        zyphiumPath(username),
        normalizeZyphium(data)
    )
}

const RECENT_Z_ACCOUNT_IDS = new Set();
const RECENT_Z_ACCOUNT_IDS_LIMIT = 4096;

function generateZAccountID() {
    let id;
    do {
        id = "Z" + crypto.randomBytes(8).toString("hex").toUpperCase();
    } while (RECENT_Z_ACCOUNT_IDS.has(id));
    RECENT_Z_ACCOUNT_IDS.add(id);
    while (RECENT_Z_ACCOUNT_IDS.size > RECENT_Z_ACCOUNT_IDS_LIMIT) RECENT_Z_ACCOUNT_IDS.delete(RECENT_Z_ACCOUNT_IDS.values().next().value);
    return id;
}

function ensureZyphiumAccount(username){
    const account=loadZyphium(username)

    if(!account.ZAccountID){
        account.ZAccountID=generateZAccountID()
        account.balance=0

        saveZyphium(username,account)
    }

    return account
}

function initializeAllZyphiumAccounts(){
    const users=loadUsers()

    for(const user of Object.values(users)){
        if(user && user.username){
            ensureZyphiumAccount(user.username)
        }
    }
}

function findUserByZAccountID(zAccountID){
    const clean=String(zAccountID||"").trim().toUpperCase()

    if(!clean){
        return null
    }

    const users=loadUsers()

    for(const user of Object.values(users)){
        if(!user || !user.username) continue

        const account=ensureZyphiumAccount(user.username)

        if(account.ZAccountID.toUpperCase()===clean){
            return user
        }
    }

    return null
}

function addZyphiumTransaction(username,transaction){
    const account=ensureZyphiumAccount(username)

    account.transactions.unshift(transaction)

    if(account.transactions.length>500){
        account.transactions.length=500
    }

    saveZyphium(username,account)
}


app.get("/zyphium/account",(req,res)=>{
    try{
        const user=auth(req)

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            })
        }

        const account=ensureZyphiumAccount(user.username)

        res.json({
            success:true,
            username:user.username,
            ZAccountID:account.ZAccountID,
            balance:account.balance,
            transactions:account.transactions
        })
    }catch(err){
        console.error(err)

        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.post("/zyphium/transfer",(req,res)=>{
    try{
        const user=auth(req)

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            })
        }

        const {
            ZAccountID,
            amount,
            note
        }=req.body

        const cleanID=String(ZAccountID||"").trim().toUpperCase()

        const transferAmount=Math.floor(Number(amount)*100)/100

        if(!cleanID){
            return res.json({
                success:false,
                error:"missing_account"
            })
        }

        if(!Number.isFinite(transferAmount) || transferAmount<=0){
            return res.json({
                success:false,
                error:"invalid_amount"
            })
        }

        const senderAccount=ensureZyphiumAccount(
            user.username
        )

        if(senderAccount.ZAccountID===cleanID){
            return res.json({
                success:false,
                error:"same_account"
            })
        }

        const receiver=findUserByZAccountID(cleanID)

        if(!receiver){
            return res.json({
                success:false,
                error:"account_not_found"
            })
        }

        if(senderAccount.balance<transferAmount){
            return res.json({
                success:false,
                error:"insufficient_balance"
            })
        }

        const receiverAccount=ensureZyphiumAccount(
            receiver.username
        )

        const transactionId=crypto.randomBytes(16)
            .toString("hex")

        const time=new Date().toISOString()

        const cleanNote=String(note||"")
            .trim()
            .slice(0,200)

        senderAccount.balance=Math.floor(
            (senderAccount.balance-transferAmount)*100
        )/100

        receiverAccount.balance=Math.floor(
            (receiverAccount.balance+transferAmount)*100
        )/100

        saveZyphium(
            user.username,
            senderAccount
        )

        saveZyphium(
            receiver.username,
            receiverAccount
        )

        addZyphiumTransaction(
            user.username,
            {
                transactionId,
                type:"transfer_sent",
                amount:transferAmount,
                balanceAfter:senderAccount.balance,
                from:user.username,
                fromZAccountID:senderAccount.ZAccountID,
                to:receiver.username,
                toZAccountID:receiverAccount.ZAccountID,
                note:cleanNote,
                time
            }
        )

        addZyphiumTransaction(
            receiver.username,
            {
                transactionId,
                type:"transfer_received",
                amount:transferAmount,
                balanceAfter:receiverAccount.balance,
                from:user.username,
                fromZAccountID:senderAccount.ZAccountID,
                to:receiver.username,
                toZAccountID:receiverAccount.ZAccountID,
                note:cleanNote,
                time
            }
        )

        logAction("zyphium_transfer",{
            transactionId,
            from:user.username,
            fromZAccountID:senderAccount.ZAccountID,
            to:receiver.username,
            toZAccountID:receiverAccount.ZAccountID,
            amount:transferAmount,
            note:cleanNote
        })

        res.json({
            success:true,
            transactionId,
            balance:senderAccount.balance
        })
    }catch(err){
        console.error(err)

        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.get("/admin/zyphium/accounts",(req,res)=>{
    try{
        const user=auth(req)

        if(!user || !hasAdmin(user)){
            return res.sendStatus(403)
        }

        const users=loadUsers()

        const accounts=Object.values(users)
            .filter(user=>user && user.username)
            .map(user=>{
                const account=ensureZyphiumAccount(
                    user.username
                )

                return {
                    username:user.username,
                    ZAccountID:account.ZAccountID,
                    balance:account.balance,
                    transactionCount:account.transactions.length
                }
            })
            .sort((a,b)=>
                a.username.localeCompare(b.username)
            )

        res.json({
            success:true,
            accounts
        })
    }catch(err){
        console.error(err)

        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.post("/admin/zyphium/set-balance",(req,res)=>{
    try{
        const admin=auth(req)

        if(!admin || !hasAdmin(admin)){
            return res.sendStatus(403)
        }

        const {
            username,
            balance,
            reason
        }=req.body

        const users=loadUsers()

        const target=resolveUserByUsername(
            users,
            username
        )

        if(!target){
            return res.json({
                success:false,
                error:"user_not_found"
            })
        }

        const newBalance=Math.floor(
            Number(balance)*100
        )/100

        if(!Number.isFinite(newBalance) || newBalance<0){
            return res.json({
                success:false,
                error:"invalid_balance"
            })
        }

        const account=ensureZyphiumAccount(
            target.username
        )

        const oldBalance=account.balance

        account.balance=newBalance

        saveZyphium(
            target.username,
            account
        )

        const transactionId=crypto.randomBytes(16)
            .toString("hex")

        const time=new Date().toISOString()

        addZyphiumTransaction(
            target.username,
            {
                transactionId,
                type:"admin_balance_edit",
                amount:newBalance-oldBalance,
                oldBalance,
                newBalance,
                balanceAfter:newBalance,
                administrator:admin.username,
                reason:String(reason||"")
                    .trim()
                    .slice(0,200),
                time
            }
        )

        logAction("zyphium_admin_balance_edit",{
            transactionId,
            administrator:admin.username,
            username:target.username,
            oldBalance,
            newBalance,
            reason:String(reason||"")
                .trim()
                .slice(0,200)
        })

        res.json({
            success:true,
            username:target.username,
            ZAccountID:account.ZAccountID,
            oldBalance,
            balance:newBalance
        })
    }catch(err){
        console.error(err)

        res.status(500).json({
            success:false,
            error:"server"
        })
    }
})

app.post("/login",async (req,res)=>{
try{

const settings=loadSystemSettings()
if(settings.loginLocked) return res.status(423).json({error:"login_locked",message:"Logins are temporarily disabled."})
const {username,password}=req.body

const users=loadUsers()

const cleanUsername=String(username||"").trim()

const user=Object.values(users).find(u=>
String(u.username||"").toLowerCase()===cleanUsername.toLowerCase()
)

if(!user)
return res.json({error:"invalid"})


const storedPassword=String(user.password||"")

const incomingPassword=String(password||"").trim()


if(storedPassword!==incomingPassword)
return res.json({error:"invalid"})


if(isBanned(user,users))
return res.json({

banned:true,

reason:user.banReason,
message:user.banMessage||user.banReason||"Your account has been banned.",
expiresAt:user.banExpires ? new Date(user.banExpires).toISOString() : null,
remaining:user.banExpires ? Math.max(0,user.banExpires-Date.now()) : null

})


if(user.frozen){

return res.json({

frozen:true,

error:"account_frozen",

message:"Your account has been frozen by an administrator."

})

}



if(user.twofa && user.email){


const existingPos=queuePosition(user.username)


if(existingPos!==-1){


const remaining=Math.max(
0,
30000-(Date.now()%30000)
)


return res.json({

twofa:true,

queue:true,

position:existingPos+1,

eta:estimateWait(existingPos)-30000+remaining,

globalCooldown:remaining,

username:user.username

})

}



twofaQueue.push({

username:user.username,

user,

expires:now()+60000

})


const pos=queuePosition(user.username)


const remaining=Math.max(
0,
30000-(Date.now()%30000)
)


processQueue()


return res.json({

twofa:true,

queue:true,

position:pos+1,

eta:estimateWait(pos)-30000+remaining,

globalCooldown:remaining,

username:user.username

})

}



user.sessionToken=generateToken()



if(!Array.isArray(user.loginHistory))
user.loginHistory=[]



user.loginHistory.push({

date:new Date().toISOString(),

ip:getIP(req)

})



saveUsers(users)



res.json({

token:user.sessionToken

})


}catch(err){

console.error(err)

res.status(500).json({

error:"server"

})

}

})

if(!fs.existsSync("gameLogs.json")) fs.writeFileSync("gameLogs.json",JSON.stringify([],null,2))
if(!fs.existsSync("gameLobbies.json")) fs.writeFileSync("gameLobbies.json",JSON.stringify({},null,2))

app.use("/games",(req,res,next)=>{

const publicRoutes=[
"/games/login.html"
]

if(publicRoutes.includes(req.path)){
return next()
}

const user=auth(req)

if(!user){
return res.redirect("/login.html")
}

req.user=user

next()
})

function loadGameLogs(){
try{
return JSON.parse(fs.readFileSync("gameLogs.json"))
}catch{
return []
}
}

function saveGameLogs(data){
fs.writeFileSync("gameLogs.json",JSON.stringify(data,null,2))
}

function loadGameLobbies(){
try{
return JSON.parse(fs.readFileSync("gameLobbies.json"))
}catch{
return {}
}
}

function saveGameLobbies(data){
fs.writeFileSync("gameLobbies.json",JSON.stringify(data,null,2))
}

function ensureGameStats(user){
    user.gameStats=normalizeGameStats(user.gameStats || loadGameStatsFile(user.username));
    return user.gameStats;
}

function syncGameFiles(user){
    const stats=normalizeGameStats(user.gameStats);
    writeJson(ticTacToePath(user.username),stats.tictactoe);
    writeJson(fourInARowPath(user.username),stats.connect4);
    saveGameStatsFile(user.username,stats);
}

function createBoard(type){

if(type==="connect4"){
return Array.from({length:6},()=>Array(7).fill(null))
}

return Array(9).fill(null)
}

function generateLobbyCode(){
return crypto.randomBytes(4).toString("hex").toUpperCase()
}

function checkTicTacToe(board){

const wins=[
[0,1,2],
[3,4,5],
[6,7,8],
[0,3,6],
[1,4,7],
[2,5,8],
[0,4,8],
[2,4,6]
]

for(const combo of wins){

const [a,b,c]=combo

if(board[a] && board[a]===board[b] && board[a]===board[c]){
return board[a]
}
}

if(board.every(x=>x)) return "draw"

return null
}

function checkConnect4(board){

const rows=6
const cols=7

for(let r=0;r<rows;r++){

for(let c=0;c<cols;c++){

const player=board[r][c]

if(!player) continue

if(
c+3<cols &&
player===board[r][c+1] &&
player===board[r][c+2] &&
player===board[r][c+3]
){
return player
}

if(
r+3<rows &&
player===board[r+1][c] &&
player===board[r+2][c] &&
player===board[r+3][c]
){
return player
}

if(
r+3<rows &&
c+3<cols &&
player===board[r+1][c+1] &&
player===board[r+2][c+2] &&
player===board[r+3][c+3]
){
return player
}

if(
r-3>=0 &&
c+3<cols &&
player===board[r-1][c+1] &&
player===board[r-2][c+2] &&
player===board[r-3][c+3]
){
return player
}
}
}

let full=true

for(let r=0;r<rows;r++){
for(let c=0;c<cols;c++){
if(!board[r][c]) full=false
}
}

if(full) return "draw"

return null
}
function finalizeMatch(lobby,winner){

const users=loadUsers()

const p1=users[lobby.host]
const p2=users[lobby.guest]

if(!p1 || !p2) return

ensureGameStats(p1)
ensureGameStats(p2)

const game=lobby.game

p1.gameStats[game].gamesPlayed++
p2.gameStats[game].gamesPlayed++

if(winner==="draw"){

p1.gameStats[game].draws++
p2.gameStats[game].draws++

p1.gameStats[game].winStreak=0
p2.gameStats[game].winStreak=0

}else{

const winUser=
winner==="X"
? p1
: p2

const loseUser=
winner==="X"
? p2
: p1

winUser.gameStats[game].wins++
loseUser.gameStats[game].losses++

winUser.gameStats[game].winStreak++

if(
winUser.gameStats[game].winStreak >
winUser.gameStats[game].bestWinStreak
){
winUser.gameStats[game].bestWinStreak=
winUser.gameStats[game].winStreak
}

loseUser.gameStats[game].winStreak=0
}

for(const player of [p1,p2]) syncGameFiles(player)
saveUsers(users)

const logs=loadGameLogs()

logs.unshift({
id:crypto.randomBytes(10).toString("hex"),
game:lobby.game,
host:lobby.host,
guest:lobby.guest,
winner,
moves:lobby.moves,
createdAt:lobby.createdAt,
endedAt:new Date().toISOString(),
hostIP:lobby.hostIP,
guestIP:lobby.guestIP
})

saveGameLogs(logs)
}

app.post("/games/create",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {game}=req.body

if(!["tictactoe","connect4"].includes(game)){
return res.json({error:"invalidgame"})
}

const lobbies=loadGameLobbies()

let code

do{
code=generateLobbyCode()
}while(lobbies[code])

lobbies[code]={
code,
game,
host:user.username,
hostReady:false,
guest:null,
guestReady:false,
turn:"X",
board:createBoard(game),
moves:[],
createdAt:new Date().toISOString(),
hostIP:getIP(req),
guestIP:null,
winner:null
}

saveGameLobbies(lobbies)

res.json({
success:true,
code
})
})

app.post("/games/join",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {code}=req.body

const lobbies=loadGameLobbies()

const lobby=lobbies[code]

if(!lobby){
return res.json({error:"notfound"})
}

if(lobby.guest){
return res.json({error:"full"})
}

if(lobby.host===user.username){
return res.json({error:"self"})
}

lobby.guest=user.username
lobby.guestIP=getIP(req)

saveGameLobbies(lobbies)

res.json({
success:true
})
})

app.post("/games/ready",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {code}=req.body

const lobbies=loadGameLobbies()

const lobby=lobbies[code]

if(!lobby){
return res.json({error:"notfound"})
}

if(user.username===lobby.host){
lobby.hostReady=true
}

if(user.username===lobby.guest){
lobby.guestReady=true
}

saveGameLobbies(lobbies)

res.json({
success:true,
started:lobby.hostReady && lobby.guestReady
})
})

app.get("/games/lobby",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {code}=req.query

const lobbies=loadGameLobbies()

const lobby=lobbies[code]

if(!lobby){
return res.json({error:"notfound"})
}

const users=loadUsers()

const host=users[lobby.host]
const guest=users[lobby.guest]

if(host) ensureGameStats(host)
if(guest) ensureGameStats(guest)

res.json({
code:lobby.code,
game:lobby.game,
host:lobby.host,
guest:lobby.guest,
hostReady:lobby.hostReady,
guestReady:lobby.guestReady,
turn:lobby.turn,
board:lobby.board,
winner:lobby.winner,
started:lobby.hostReady && lobby.guestReady,
hostStats:host ? host.gameStats : null,
guestStats:guest ? guest.gameStats : null
})
})

app.post("/games/move",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {
code,
index,
column,
fromIndex
}=req.body

const lobbies=loadGameLobbies()

const lobby=lobbies[code]

if(!lobby){
return res.json({error:"notfound"})
}

if(lobby.winner){
return res.json({error:"ended"})
}

if(!(lobby.hostReady && lobby.guestReady)){
return res.json({error:"notstarted"})
}

const symbol=
user.username===lobby.host
? "X"
: user.username===lobby.guest
? "O"
: null

if(!symbol){
return res.json({error:"noplayer"})
}

if(symbol!==lobby.turn){
return res.json({error:"turn"})
}

if(lobby.game==="tictactoe"){

const owned=lobby.board
.map((v,i)=>v===symbol?i:null)
.filter(v=>v!==null)

if(owned.length>=3){

if(fromIndex===undefined || fromIndex===null){
return res.json({
error:"mustmove"
})
}

if(lobby.board[fromIndex]!==symbol){
return res.json({
error:"notyours"
})
}

if(index===fromIndex){
return res.json({
error:"samecell"
})
}

if(lobby.board[index]){
return res.json({
error:"taken"
})
}

lobby.board[fromIndex]=null

}else{

if(lobby.board[index]){
return res.json({
error:"taken"
})
}
}

lobby.board[index]=symbol

lobby.moves.push({
player:user.username,
symbol,
index,
fromIndex:
fromIndex!==undefined
? fromIndex
: null,
time:new Date().toISOString(),
ip:getIP(req)
})

const result=checkTicTacToe(lobby.board)

if(result){

lobby.winner=result

finalizeMatch(lobby,result)

}else{

lobby.turn=
lobby.turn==="X"
? "O"
: "X"
}

}else{

if(
column===undefined ||
column===null ||
column<0 ||
column>6
){
return res.json({
error:"invalidcolumn"
})
}

let placedRow=null

for(let r=5;r>=0;r--){

if(!lobby.board[r][column]){

placedRow=r

break
}
}

if(placedRow===null){
return res.json({
error:"fullcolumn"
})
}

lobby.board[placedRow][column]=symbol

lobby.moves.push({
player:user.username,
symbol,
column,
row:placedRow,
time:new Date().toISOString(),
ip:getIP(req)
})

const result=checkConnect4(lobby.board)

if(result){

lobby.winner=result

finalizeMatch(lobby,result)

}else{

lobby.turn=
lobby.turn==="X"
? "O"
: "X"
}
}

saveGameLobbies(lobbies)

res.json({
success:true,
board:lobby.board,
turn:lobby.turn,
winner:lobby.winner
})
})

app.post("/admin/panel/ban",(req,res)=>{

const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {
username,
reason,
duration
}=req.body

const users=loadUsers()
const target=users[username]

if(!target)
return res.json({error:"nouser"})

target.banned=true
target.banReason=reason || "No reason provided"

target.banExpires=
duration
? Date.now()+Number(duration)
: null

if(!Array.isArray(target.banHistory))
target.banHistory=[]

target.banHistory.push({
action:"ban",
admin:user.username,
reason:target.banReason,
duration:duration || "permanent",
date:new Date().toISOString()
})

saveUsers(users)

res.json({
success:true
})

})

app.get("/account/by-id/:id",(req,res)=>{
    try{
        const id=Number(req.params.id)

        if(!Number.isInteger(id) || id<1){
            return res.json({error:"invalidid"})
        }

        const users=loadUsers()

        const user=Object.values(users).find(
            u=>Number(u.id)===id
        )

        if(!user){
            return res.json({error:"notfound"})
        }

        res.json({
            success:true,
            id:user.id,
            username:user.username
        })

    }catch(err){
        console.error("ACCOUNT ID LOOKUP ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/admin/panel/unban",(req,res)=>{

const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {username}=req.body

const users=loadUsers()

const target=users[username]

if(!target)
return res.json({error:"nouser"})

target.banned=false
target.banReason=null
target.banExpires=null

if(!Array.isArray(target.banHistory))
target.banHistory=[]

target.banHistory.push({
action:"unban",
admin:user.username,
date:new Date().toISOString()
})

saveUsers(users)

res.json({
success:true
})

})


app.get("/admin/users",(req,res)=>{

const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const users=loadUsers()

res.json(Object.values(users).map(x=>({
username:x.username,
banned:x.banned,
banReason:x.banReason,
banExpires:x.banExpires,
createdAt:x.createdAt
})))

})


app.post("/admin/schedule/edit",(req,res)=>{

const user=auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {
oldDate,
oldStart,
oldEnd,
newDate,
newStart,
newEnd
}=req.body

let schedule=loadSchedule()
let tickets=loadTickets()

let booking=null

if(schedule.booked[oldDate]){

booking=schedule.booked[oldDate].find(x=>
x.start===oldStart &&
x.end===oldEnd
)

schedule.booked[oldDate]=schedule.booked[oldDate].filter(x=>
!(x.start===oldStart && x.end===oldEnd)
)

}

if(booking){

if(!schedule.booked[newDate])
schedule.booked[newDate]=[]

booking.start=newStart
booking.end=newEnd

schedule.booked[newDate].push(booking)

let ticket=tickets.find(x=>x.id===booking.ticketId)

if(ticket){

ticket.booked={
date:newDate,
start:newStart,
end:newEnd
}

ticket.messages.push({
author:"System",
text:
`Your booking time was changed by an administrator.

Old:
${oldDate} ${oldStart}-${oldEnd}

New:
${newDate} ${newStart}-${newEnd}

Please convert this time to your timezone if needed.`,
time:new Date().toISOString()
})

}

}else{

if(schedule.slots[oldDate]){

schedule.slots[oldDate]=schedule.slots[oldDate].filter(x=>
!(x.start===oldStart && x.end===oldEnd)
)

}

if(!schedule.slots[newDate])
schedule.slots[newDate]=[]

schedule.slots[newDate].push({
start:newStart,
end:newEnd
})

}

saveSchedule(schedule)
saveTickets(tickets)

res.json({
success:true
})

})

app.get("/games/leaderboard",(req,res)=>{

const viewer=auth(req)

if(!viewer){
return res.json({error:"unauthorized"})
}

const {game}=req.query

if(!["tictactoe","connect4"].includes(game)){
return res.json({error:"invalidgame"})
}

const users=loadUsers()

const list=Object.values(users).map(user=>{

ensureGameStats(user)

const stats=user.gameStats[game]

return{
username:user.username,
wins:stats.wins || 0,
losses:stats.losses || 0,
gamesPlayed:stats.gamesPlayed || 0,
winStreak:stats.winStreak || 0,
bestWinStreak:stats.bestWinStreak || 0
}
})

const wins=[...list]
.sort((a,b)=>b.wins-a.wins)

const losses=[...list]
.sort((a,b)=>b.losses-a.losses)

const played=[...list]
.sort((a,b)=>b.gamesPlayed-a.gamesPlayed)

const streak=[...list]
.sort((a,b)=>b.winStreak-a.winStreak)

const bestStreak=[...list]
.sort((a,b)=>b.bestWinStreak-a.bestWinStreak)

function rank(arr,user){

const i=arr.findIndex(x=>x.username===user)

return i===-1
? null
: i+1
}

res.json({

winsTop:wins.slice(0,100),
lossesTop:losses.slice(0,100),
playedTop:played.slice(0,100),
streakTop:streak.slice(0,100),
bestStreakTop:bestStreak.slice(0,100),

yourRanks:{

wins:rank(wins,viewer.username),
losses:rank(losses,viewer.username),
played:rank(played,viewer.username),
streak:rank(streak,viewer.username),
bestStreak:rank(bestStreak,viewer.username)

}
})
})

app.get("/games/history",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const logs=loadGameLogs()

const filtered=logs.filter(x=>
x.host===user.username ||
x.guest===user.username
)

res.json({
games:filtered
})
})

app.post("/games/quit",(req,res)=>{

const user=auth(req)

if(!user){
return res.json({error:"unauthorized"})
}

const {code}=req.body

const lobbies=loadGameLobbies()

const lobby=lobbies[code]

if(!lobby){
return res.json({error:"notfound"})
}

if(
lobby.host!==user.username &&
lobby.guest!==user.username
){
return res.json({error:"noperms"})
}

delete lobbies[code]

saveGameLobbies(lobbies)

res.json({
success:true
})
})

app.get("/games/replay/:id",(req,res)=>{

const logs=loadGameLogs()

const game=logs.find(x=>x.id===req.params.id)

if(!game){
return res.json({error:"notfound"})
}

res.json(game)
})

app.get("/games/stats/:username",(req,res)=>{

const users=loadUsers()

const user=users[req.params.username]

if(!user){
return res.json({error:"notfound"})
}

ensureGameStats(user)

res.json(user.gameStats)
})


const CALLS_ROOT=path.join(__dirname,"Calls")
const GROUPS_ROOT=path.join(__dirname,"DMGroups")
const CALL_RING_MS=45000
const CALL_IDLE_MS=180000
const MAX_GROUP_MEMBERS=25
const CALL_STATE_CACHE=new Map()
function isBetaTester(username){
    const safe=safeUsername(username)
    if(!safe) return false
    return betaTesterUsernames().has(safe.toLowerCase())
}
function requireBetaTester(req,res){
    const user=auth(req)
    if(!user) { res.status(401).json({error:"unauthorized"}); return null }
    if(!isBetaTester(user.username)) { res.status(403).json({error:"beta_tester_required"}); return null }
    return user
}
function safeGroupId(value){
    const id=String(value||"").trim()
    return /^[a-f0-9]{32}$/.test(id)?id:null
}
function groupPath(id){
    const safe=safeGroupId(id)
    return safe?path.join(GROUPS_ROOT,safe+".json"):null
}
function readGroup(id){
    const file=groupPath(id)
    if(!file||!fs.existsSync(file)) return null
    const group=readJson(file,null)
    if(!group||!Array.isArray(group.members)||!Array.isArray(group.messages)) return null
    return group
}
function writeGroup(group){
    const file=groupPath(group.id)
    if(!file) throw new Error("invalid_group_id")
    writeJson(file,group)
    return group
}
function normalizeGroupMembers(members,owner){
    if(!Array.isArray(members)) return null
    const users=loadUsers()
    const byLower=new Map(Object.values(users).filter(x=>x&&safeUsername(x.username)).map(x=>[String(x.username).toLowerCase(),x.username]))
    const unique=[...new Set(members.map(x=>byLower.get(String(x||"").trim().toLowerCase())).filter(Boolean))]
    if(!unique.includes(owner)) unique.unshift(owner)
    if(unique.length<3||unique.length>MAX_GROUP_MEMBERS) return null
    const friendsData=normalizeFriendsData(loadFriends())
    for(const name of unique){
        if(name===owner) continue
        if(!areFriends(friendsData,owner,name)) return null
    }
    return unique
}
function visibleGroup(group){
    return {id:group.id,name:group.name,members:group.members,owner:group.owner,createdAt:group.createdAt,updatedAt:group.updatedAt,messageCount:group.messages.length,lastMessage:group.messages[group.messages.length-1]||null}
}
function userGroups(username){
    fs.mkdirSync(GROUPS_ROOT,{recursive:true})
    const out=[]
    let files=[]
    try{files=fs.readdirSync(GROUPS_ROOT).filter(x=>/^[a-f0-9]{32}\.json$/.test(x))}catch{}
    for(const file of files){
        const group=readJson(path.join(GROUPS_ROOT,file),null)
        if(group&&Array.isArray(group.members)&&group.members.includes(username)) out.push(visibleGroup(group))
    }
    return out.sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))
}
function canAccessGroup(group,username){return !!group&&Array.isArray(group.members)&&group.members.includes(username)}
function callFile(id){
    const safe=safeGroupId(id)
    return safe?path.join(CALLS_ROOT,safe+".json"):null
}
function readCall(id){
    const file=callFile(id)
    if(!file||!fs.existsSync(file)) return null
    const call=readJson(file,null)
    if(!call||!Array.isArray(call.participants)||!Array.isArray(call.signals)) return null
    return call
}
function writeCall(call){
    const file=callFile(call.id)
    if(!file) throw new Error("invalid_call_id")
    writeJson(file,call)
    CALL_STATE_CACHE.set(call.id,call.updatedAt||Date.now())
    return call
}
function callForUser(id,username){
    const call=readCall(id)
    if(!call||!call.participants.includes(username)) return null
    return call
}
function expireCall(call){
    if(!call||call.status==="ended") return call
    const now=Date.now()
    if(call.status==="ringing"&&now-new Date(call.createdAt).getTime()>CALL_RING_MS){call.status="ended";call.endedAt=new Date().toISOString()}
    else if(now-new Date(call.lastActivityAt||call.createdAt).getTime()>CALL_IDLE_MS){call.status="ended";call.endedAt=new Date().toISOString()}
    if(call.status==="ended") writeCall(call)
    return call
}
function callResponse(call,username){
    return {
        callId:call.id,
        type:call.type,
        from:call.from,
        to:call.to||null,
        status:call.status,
        createdAt:call.createdAt,
        answeredAt:call.answeredAt||null,
        endedAt:call.endedAt||null,
        peer:call.participants.find(x=>x!==username)||null,
        groupCall:call.groupCall===true,
        groupId:call.groupId||null,
        groupName:call.groupName||null,
        owner:call.owner||call.from,
        participants:Array.isArray(call.participants)?call.participants:[],
        accepted:Array.isArray(call.accepted)?call.accepted:[],
        declined:Array.isArray(call.declined)?call.declined:[],
        left:Array.isArray(call.left)?call.left:[]
    }
}
function sendCallSignal(call,from,type,payload,to=null){
    if(!["offer","answer","candidate","hangup"].includes(type)) return false
    if(!Array.isArray(call.participants)||!call.participants.includes(from)) return false
    const target=typeof to==="string"?to.trim():""
    if(target&&(!call.participants.includes(target)||target===from)) return false
    if(call.groupCall===true&&(!Array.isArray(call.accepted)||!call.accepted.includes(from)||(target&&!call.accepted.includes(target)))) return false
    const safePayload=payload&&typeof payload==="object"?payload:{}
    const serialized=JSON.stringify(safePayload)
    if(serialized.length>250000) return false
    call.signals.push({id:crypto.randomBytes(12).toString("hex"),from,to:target||null,type,payload:safePayload,time:new Date().toISOString()})
    if(call.signals.length>1000) call.signals.splice(0,call.signals.length-1000)
    call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt
    writeCall(call)
    return true
}
app.post("/dms/groups",(req,res)=>{
    const user=requireBetaTester(req,res)
    if(!user) return
    const name=String(req.body?.name||"").trim().slice(0,60)
    const members=normalizeGroupMembers(req.body?.members,user.username)
    if(!members) return res.status(400).json({error:"invalid_members"})
    fs.mkdirSync(GROUPS_ROOT,{recursive:true})
    const now=new Date().toISOString()
    const group={id:crypto.randomBytes(16).toString("hex"),name:name||"Group chat",owner:user.username,members,createdAt:now,updatedAt:now,messages:[]}
    writeGroup(group)
    logAction("dm_group_created",{id:group.id,owner:user.username,members:members.length})
    res.json({success:true,group:visibleGroup(group)})
})
app.get("/dms/groups/:id",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const group=readGroup(req.params.id)
    if(!canAccessGroup(group,user.username)) return res.status(404).json({error:"notfound"})
    res.json({success:true,group:visibleGroup(group),messages:group.messages.slice(-200)})
})
app.post("/dms/groups/:id/send",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const group=readGroup(req.params.id)
    if(!canAccessGroup(group,user.username)) return res.status(404).json({error:"notfound"})
    const text=String(req.body?.message||"").trim()
    if(!text) return res.status(400).json({error:"empty"})
    if(text.length>4000) return res.status(400).json({error:"too_long"})
    const message={messageId:generateUniqueMessageId(),author:user.username,text,images:[],time:new Date().toISOString()}
    group.messages.push(message)
    if(group.messages.length>10000) group.messages.splice(0,group.messages.length-10000)
    group.updatedAt=message.time
    writeGroup(group)
    for(const target of group.members){
        if(target===user.username) continue
        sendPhoneNotification(target,"New group message · "+group.name,user.username+": "+text.slice(0,160),user.username)
    }
    res.json({success:true,message})
})
app.post("/calls/start",(req,res)=>{
    const user=requireBetaTester(req,res)
    if(!user) return
    const type=req.body?.type==="video"?"video":"audio"
    const rawGroupId=req.body?.groupId
    const groupId=rawGroupId?safeGroupId(rawGroupId):null
    if(rawGroupId&&!groupId) return res.status(400).json({error:"invalid_group"})
    const now=new Date().toISOString()
    if(groupId){
        const group=readGroup(groupId)
        if(!canAccessGroup(group,user.username)) return res.status(404).json({error:"notfound"})
        const participants=[...new Set(group.members)]
        if(participants.length<3||participants.length>MAX_GROUP_MEMBERS) return res.status(400).json({error:"invalid_group"})
        const busy=participants.filter(name=>userCalls(name).length>0)
        if(busy.length) return res.status(409).json({error:"participant_busy"})
        const call={id:crypto.randomBytes(16).toString("hex"),type,from:user.username,to:null,groupCall:true,groupId:group.id,groupName:group.name||"Group chat",owner:user.username,participants,accepted:[user.username],declined:[],left:[],status:"ringing",createdAt:now,lastActivityAt:now,updatedAt:now,answeredAt:null,endedAt:null,signals:[]}
        writeCall(call)
        logAction("dm_group_call_started",{id:call.id,groupId:group.id,owner:user.username,participants:participants.length,type})
        return res.json({success:true,...callResponse(call,user.username)})
    }
    const targetName=safeUsername(req.body?.to)
    if(!targetName||targetName.toLowerCase()===user.username.toLowerCase()) return res.status(400).json({error:"invalid_target"})
    const users=loadUsers()
    const target=resolveUserByUsername(users,targetName)
    if(!target) return res.status(404).json({error:"notfound"})
    if(!areFriends(normalizeFriendsData(loadFriends()),user.username,target.username)) return res.status(403).json({error:"notfriends"})
    if(userCalls(user.username).length) return res.status(409).json({error:"already_in_call"})
    if(userCalls(target.username).length) return res.status(409).json({error:"recipient_busy"})
    const call={id:crypto.randomBytes(16).toString("hex"),type,from:user.username,to:target.username,groupCall:false,owner:user.username,participants:[user.username,target.username],accepted:[user.username],declined:[],left:[],status:"ringing",createdAt:now,lastActivityAt:now,updatedAt:now,answeredAt:null,endedAt:null,signals:[]}
    writeCall(call)
    res.json({success:true,...callResponse(call,user.username)})
})
function userCalls(username){
    fs.mkdirSync(CALLS_ROOT,{recursive:true})
    let files=[]
    try{files=fs.readdirSync(CALLS_ROOT).filter(x=>/^[a-f0-9]{32}\.json$/.test(x))}catch{}
    const calls=[]
    for(const file of files){let call=readJson(path.join(CALLS_ROOT,file),null);if(call&&Array.isArray(call.participants)&&call.participants.includes(username)){call=expireCall(call);if(call.status!=="ended")calls.push(call)}}
    return calls
}
app.get("/calls/incoming",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const calls=userCalls(user.username).filter(call=>{
        if(call.groupCall===true){
            return ["ringing","connected"].includes(call.status)&&call.from!==user.username&&!call.accepted?.includes(user.username)&&!call.declined?.includes(user.username)&&!call.left?.includes(user.username)
        }
        return call.to===user.username&&call.status==="ringing"
    }).map(call=>callResponse(call,user.username))
    res.json({calls})
})
app.post("/calls/answer",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.groupCall===true){
        if(!["ringing","connected"].includes(call.status)) return res.status(409).json({error:"not_ringing"})
        if(call.declined?.includes(user.username)||call.left?.includes(user.username)) return res.status(409).json({error:"call_invite_closed"})
        if(call.accepted?.includes(user.username)) return res.json({success:true,call:callResponse(call,user.username)})
        if(userCalls(user.username).some(active=>active.id!==call.id)) return res.status(409).json({error:"already_in_call"})
        if(!Array.isArray(call.accepted)) call.accepted=[]
        call.accepted.push(user.username)
        call.declined=(call.declined||[]).filter(name=>name!==user.username)
        call.left=(call.left||[]).filter(name=>name!==user.username)
        call.status="connected"
        call.answeredAt=call.answeredAt||new Date().toISOString()
        call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt
        writeCall(call)
        return res.json({success:true,call:callResponse(call,user.username)})
    }
    if(call.status!=="ringing"||call.to!==user.username) return res.status(409).json({error:"not_ringing"})
    call.status="connected"
    call.accepted=[...new Set([...(call.accepted||[]),user.username])]
    call.answeredAt=new Date().toISOString();call.lastActivityAt=call.answeredAt;call.updatedAt=call.answeredAt;writeCall(call)
    res.json({success:true,call:callResponse(call,user.username)})
})
app.post("/calls/decline",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.status==="ended") return res.status(410).json({error:"call_ended"})
    if(call.groupCall===true){
        if(call.accepted?.includes(user.username)) return res.status(409).json({error:"already_joined"})
        if(!Array.isArray(call.declined)) call.declined=[]
        if(!call.declined.includes(user.username)) call.declined.push(user.username)
        call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt
        writeCall(call)
        return res.json({success:true})
    }
    if(call.to!==user.username||call.status!=="ringing") return res.status(409).json({error:"not_ringing"})
    sendCallSignal(call,user.username,"hangup",{})
    call.status="ended";call.endedAt=new Date().toISOString();call.lastActivityAt=call.endedAt;call.updatedAt=call.endedAt;writeCall(call)
    res.json({success:true})
})
app.post("/calls/leave",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.status==="ended") return res.status(410).json({error:"call_ended"})
    if(call.groupCall!==true) return res.status(400).json({error:"not_group_call"})
    if(call.owner===user.username) return res.status(403).json({error:"owner_must_end_call"})
    if(!Array.isArray(call.left)) call.left=[]
    if(!call.left.includes(user.username)) call.left.push(user.username)
    sendCallSignal(call,user.username,"hangup",{})
    call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt
    writeCall(call)
    res.json({success:true})
})
app.post("/calls/signal",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.status==="ended") return res.status(410).json({error:"call_ended"})
    const target=typeof req.body?.to==="string"?req.body.to:null
    if(!sendCallSignal(call,user.username,String(req.body?.type||""),req.body?.payload,target)) return res.status(400).json({error:"invalid_signal"})
    res.json({success:true})
})
app.get("/calls/signals",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.query?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.groupCall===true&&!call.accepted?.includes(user.username)) return res.status(403).json({error:"not_in_call"})
    call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt;writeCall(call)
    const signals=call.signals.filter(signal=>signal.from!==user.username&&(!signal.to||signal.to===user.username))
    res.json({status:call.status,signals,call:callResponse(call,user.username)})
})
app.post("/calls/heartbeat",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    expireCall(call)
    if(call.status==="ended") return res.status(410).json({error:"call_ended"})
    if(call.groupCall===true&&!call.accepted?.includes(user.username)) return res.status(403).json({error:"not_in_call"})
    call.lastActivityAt=new Date().toISOString();call.updatedAt=call.lastActivityAt;writeCall(call)
    res.json({success:true,status:call.status})
})
app.post("/calls/end",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const call=callForUser(req.body?.callId,user.username)
    if(!call) return res.status(404).json({error:"notfound"})
    if(call.groupCall===true&&call.owner!==user.username) return res.status(403).json({error:"owner_must_end_call"})
    if(call.status!=="ended") sendCallSignal(call,user.username,"hangup",{})
    call.status="ended";call.endedAt=new Date().toISOString();call.lastActivityAt=call.endedAt;call.updatedAt=call.endedAt;writeCall(call)
    res.json({success:true})
})

app.get("/dms/state",(req,res)=>{
    const user=auth(req)
    if(!user) return res.json({error:"unauthorized"})
    const friendsData=normalizeFriendsData(loadFriends())
    const friends=Array.from(new Set(friendsData.friends[user.username]||[])).sort((a,b)=>a.localeCompare(b))
    const incomingRequests=(friendsData.friendRequests||[]).filter(r=>r.to===user.username).sort((a,b)=>new Date(b.time)-new Date(a.time))
    const outgoingRequests=(friendsData.friendRequests||[]).filter(r=>r.from===user.username).sort((a,b)=>new Date(b.time)-new Date(a.time))
    const dmsData=loadDMs()
    const chats=listStoredChats(dmsData).filter(item=>item.meta.users.includes(user.username)).map(item=>{
        const chat={...item.meta,preview:item.preview}
        return chatSummary(chat,user.username)
    }).sort((a,b)=>new Date(b.lastTime||0)-new Date(a.lastTime||0))
    const friendBadges={}
    for(const friend of friends){
        const badges=friendBadgesFor(friend)
        if(badges.length) friendBadges[friend]=badges
    }
    res.json({
        username:user.username,
        friends,
        incomingRequests,
        outgoingRequests,
        chats,
        pinnedDms:loadPinnedDms(user.username),
        friendBadges,
        groups:userGroups(user.username),
        groupChats:userGroups(user.username),
        unreadMessages:chats.reduce((sum,c)=>sum+(c.unread||0),0),
        unreadRequests:incomingRequests.length
    })
})

app.post("/dms/pinned",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const pinned=savePinnedDms(user.username,req.body?.pinnedDms ?? req.body?.pinned ?? [])
    res.json({success:true,pinnedDms:pinned})
})

app.get("/admin/user/search",(req,res)=>{

const admin=auth(req)
if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

const q=String(req.query.q||"").toLowerCase()

const users=loadUsers()
const perms=loadPerms()

let result=Object.values(users)
.filter(u=>u.username.toLowerCase().includes(q))
.map(u=>hideProtectedUserData(admin,u,{

username:u.username,
id:u.id,
created:u.createdAt,

password:"hidden",

email:{
address:u.email || "None",
added:!!u.email,
verified:!!u.emailVerifiedAt
},

permissions:{
administrator:perms.permissions.Administrator.includes(u.username),
support:perms.permissions.Support.includes(u.username),
vip:perms.permissions.VIP.includes(u.username),
family:perms.permissions.Family.includes(u.username)
},

linkedDiscord:u.linkedDiscord || null,
linkedRoblox:u.roblox || null,

devices:Array.isArray(u.devices)?u.devices.length:0,
sessionActive:!!u.sessionToken,

lastLogin:
u.loginHistory?.length
? u.loginHistory[u.loginHistory.length-1]
: null,

ipHistory:u.loginHistory || [],

banned:u.banned,
banReason:u.banReason,
banExpires:u.banExpires,

banHistory:u.banHistory || [],
punishmentHistory:u.punishmentHistory || [],

disabled:u.disabled || false,
muted:u.muted || false,
shadowBanned:u.shadowBanned || false,
frozen:u.frozen || false

}))

res.json(result)

})



app.post("/admin/user/edit",(req,res)=>{

const admin=auth(req)
if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

const {
username,
newUsername,
password,
disabled,
muted,
shadowBanned,
frozen,
note
}=req.body

let users=loadUsers()

let user=users[username]

if(!user)
return res.json({error:"nouser"})


if(newUsername && newUsername!==username){

if(users[newUsername]) return res.json({error:"exists"})

delete users[username]

user.username=newUsername

users[newUsername]=user

}else{

users[username]=user

}


if(password){

const oldPassword=String(user.password||"").trim()
const newPassword=String(password).trim()

if(oldPassword!==newPassword){

const history=normalizePasswordHistory(user.passwordHistory)

history.history.push({
password:oldPassword,
changedAt:new Date().toISOString(),
changedBy:admin.username,
reason:"Changed by administrator"
})

if(history.history.length>20){
history.history.shift()
}

user.passwordHistory=history
user.password=newPassword
user.passwordChangedAt=new Date().toISOString()

}

}


if(disabled!==undefined)
user.disabled=disabled


if(muted!==undefined)
user.muted=muted


if(shadowBanned!==undefined)
user.shadowBanned=shadowBanned


if(frozen!==undefined){

user.frozen=frozen

if(frozen===true){

user.sessionToken=null

if(!Array.isArray(user.punishmentHistory))
user.punishmentHistory=[]

user.punishmentHistory.push({
type:"freeze",
admin:admin.username,
reason:note || "Account frozen",
date:new Date().toISOString()
})

}

}



if(!Array.isArray(user.punishmentHistory))
user.punishmentHistory=[]


if(note){

user.punishmentHistory.push({

admin:admin.username,
note,
date:new Date().toISOString()

})

}


saveUsers(users)


res.json({success:true})

})




app.post("/admin/user/logout",(req,res)=>{

const admin=auth(req)
if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

const users=loadUsers()

const user=users[req.body.username]

if(!user)
return res.json({error:"nouser"})

user.sessionToken=null

saveUsers(users)

res.json({success:true})

})





app.post("/admin/user/delete",(req,res)=>{

const admin=auth(req)
if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

const users=loadUsers()

if(!users[req.body.username])
return res.json({error:"nouser"})

delete users[req.body.username]

saveUsers(users)

res.json({success:true})

})




app.post("/admin/permission/set",(req,res)=>{

const admin=auth(req)
if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

const {
username,
permission,
enabled,
reason
}=req.body


const allowed=[
"Administrator",
"Support",
"VIP",
"Family"
]


if(!allowed.includes(permission))
return res.json({error:"permission"})


const perms=loadPerms()


if(!perms.permissions[permission])
perms.permissions[permission]=[]


if(enabled){

if(!perms.permissions[permission].includes(username))
perms.permissions[permission].push(username)

}else{

perms.permissions[permission]=
perms.permissions[permission]
.filter(x=>x!==username)

}


fs.writeFileSync(
"permissions.json",
JSON.stringify(perms,null,2)
)



let logs=loadPermissionLogs()

logs.unshift({

admin:admin.username,
target:username,
permission,
action:enabled?"give":"remove",
reason:reason || "No reason",
date:new Date().toISOString()

})

savePermissionLogs(logs)



res.json({success:true})

})





app.get("/admin/permission/logs",(req,res)=>{

const admin=auth(req)

if(!admin || !hasAdmin(admin))
return res.sendStatus(403)


res.json(loadPermissionLogs())


})

app.get("/dms/chat",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const targetName=String(req.query.with||"").trim()
    if(!targetName) return res.json({error:"missing"})
    const users=loadUsers()
    const target=resolveUserByUsername(users,targetName)
    if(!target) return res.json({error:"notfound"})
    if(target.username===user.username) return res.json({error:"self"})
    const friendsData=normalizeFriendsData(loadFriends())
    if(!areFriends(friendsData,user.username,target.username)) return res.json({error:"notfriends"})
    const dmsData=loadDMs()
    const stored=getStoredChat(dmsData,user.username,target.username,true)
    const page=getDmMessagesPage(stored.folder,req.query.before||null,req.query.limit||50)
    res.json({success:true,chat:{...chatSummary({...stored.meta,preview:stored.preview},user.username),users:stored.meta.users,messages:page.messages,lastRead:stored.meta.lastRead||{},hasMore:page.hasMore,nextBefore:page.nextBefore,totalMessages:Number(stored.meta.messageCount||0)}})
})

app.post("/dms/send", upload.array("images",3), (req,res)=>{

const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {chatId,message}=req.body
const files=req.files||[]

if(!chatId)
return res.json({error:"missing"})

const text=String(message||"").trim()

if(
text.length===0 &&
files.length===0
){
return res.json({error:"empty"})
}

const perms=loadPerms()

const canSendImages=
Array.isArray(perms.permissions.DmImagePerms) &&
perms.permissions.DmImagePerms.includes(user.username)

if(
files.length>0 &&
!canSendImages
){
return res.json({error:"nopermission"})
}

const friendsData=normalizeFriendsData(loadFriends())
const dmsData=loadDMs()

const other=String(chatId).trim()

if(
!areFriends(
friendsData,
user.username,
other
)
){
return res.json({error:"notfriends"})
}

const storedChat=getStoredChat(dmsData,user.username,other,true)

const images=[]

for(const file of files){

images.push({
url:"/uploads/"+file.filename,
filename:file.filename,
originalName:file.originalname,
size:file.size
})

}

const newMessage={
    messageId:generateUniqueMessageId(),
    author:user.username,
    text,
    images,
    time:new Date().toISOString(),
    edited:false,
    deleted:false
}
const chat=appendStoredDmMessage(dmsData,user.username,other,newMessage)

updateUserBadges(user.username)

if(
    !chat.activeUsers ||
    !chat.activeUsers.includes(other)
){

sendPhoneNotification(
other,
"New DM from "+user.username,
text || (images.length+" image"+(images.length===1?"":"s")),
user.username
)

}

res.json({
success:true
})

})

app.post("/lootlabs/start",async(req,res)=>{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

if(user.completedQuests?.includes(LOOTLABS_QUEST_ID))
return res.json({error:"completed"})

let data=loadLootlabs()

if(!data[user.username]){
data[user.username]={
progress:0,
tokens:[]
}
}

const token=crypto.randomBytes(32).toString("hex")

data[user.username].tokens.push({
token:token
})

saveLootlabs(data)

try{

const serverResponse=await fetch("https://zyphor.cc/server.txt")

const backendUrl=(await serverResponse.text()).trim()

const finalUrl=
`${backendUrl}/lootlabs/verify?token=${token}`

const response=await fetch(
"https://creators.lootlabs.gg/api/public/content_locker",
{
method:"POST",
headers:{
"Authorization":"Bearer "+LOOTLABS_API_KEY,
"Content-Type":"application/json"
},
body:JSON.stringify({
title:"Zyphor Quest",
url:finalUrl,
tier_id:3,
number_of_tasks:5,
theme:3,
postback:`${backendUrl}/lootlabs/postback?token=${token}`
})
}
)

const result=await response.json()

console.log("LOOTLABS CREATE:",result)

if(result.type!=="created"){

data[user.username].tokens=
data[user.username].tokens.filter(x=>x.token!==token)

saveLootlabs(data)

return res.json({
error:"lootlabs",
details:result
})

}

res.json({
success:true,
url:result.message[0].loot_url
})

}catch(err){

console.log(err)

data[user.username].tokens=
data[user.username].tokens.filter(x=>x.token!==token)

saveLootlabs(data)

res.json({
error:"lootlabs_failed"
})

}

})

app.get("/desktop/test",(req,res)=>{

res.json({
success:true,
message:"Desktop API working"
})

})

app.get("/desktop/state", (req, res) => {

    const user = auth(req);

    if (!user)
        return res.json({
            error: "unauthorized"
        });

    const friends = loadFriends();
    const tickets = loadTickets();

    const chats = [];
    const dmsData = loadDMs();
    for (const item of listStoredChats(dmsData)) {
        if (!item.meta.users.includes(user.username)) continue;
        const unread = unreadCount(item.meta, user.username);
        const last = item.preview?.message;
        if (unread > 0 && last) chats.push({id:item.meta.id,from:last.author,message:last.text||"",unread,time:last.time});
    }

    const requests = friends.friendRequests
        .filter(x => x.to === user.username)
        .map(x => ({
            id: x.id || x.from,
            from: x.from
        }));

    const ticketUpdates = [];

    for (const ticket of tickets) {

        if (
            ticket.owner !== user.username &&
            !hasSupport(user)
        )
            continue;

        if (
            ticket.notifications &&
            ticket.notifications[user.username]
        ) {

            for (const note of ticket.notifications[user.username]) {

                if (!note.seen) {

                    ticketUpdates.push({
                        id: note.id,
                        ticketId: ticket.id,
                        message: note.message
                    });

                }

            }

        }

    }

    res.json({
        success: true,
        dms: chats,
        friendRequests: requests,
        tickets: ticketUpdates
    });

});

app.get("/lootlabs/verify",(req,res)=>{

const {token}=req.query

if(!token)
return res.send("Invalid")

let data=loadLootlabs()
let users=loadUsers()

let found=null

for(const name in data){

const foundToken=
data[name].tokens.find(x=>x.token===token)

if(foundToken){

found=name

data[name].tokens=
data[name].tokens.filter(x=>x.token!==token)

break

}

}

if(!found)
return res.send("Invalid or already used")

if(!data[found].progress)
data[found].progress=0

if(data[found].progress<3){
data[found].progress++
}

if(data[found].progress>=3){

const user=users[found]

if(!Array.isArray(user.completedQuests))
user.completedQuests=[]

if(!user.completedQuests.includes(LOOTLABS_QUEST_ID)){

user.completedQuests.push(LOOTLABS_QUEST_ID)

if(!Array.isArray(user.questHistory))
user.questHistory=[]

user.questHistory.push({
questId:LOOTLABS_QUEST_ID,
completedAt:new Date().toISOString()
})

}

users[found]=user

saveUsers(users)

}

saveLootlabs(data)

res.send(`
<h1>LootLabs Complete</h1>
<p>You can close this tab.</p>
`)

})


app.get("/lootlabs/status",(req,res)=>{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

const data=loadLootlabs()

res.json({
progress:data[user.username]?.progress || 0,
completed:user.completedQuests?.includes(LOOTLABS_QUEST_ID)
})

})

app.post("/dms/activity",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const chatId=String(req.body?.chatId||"").trim()
    const active=req.body?.active===true
    const dmsData=loadDMs()
    let stored=null
    for(const item of listStoredChats(dmsData)){
        if(item.meta.id===chatId || item.meta.users.some(name=>name.toLowerCase()===chatId.toLowerCase())&&item.meta.users.includes(user.username)){
            if(item.meta.users.includes(user.username)){stored=item;break}
        }
    }
    if(!stored) return res.json({error:"notfound"})
    if(!stored.meta.users.includes(user.username)) return res.status(403).json({error:"noperms"})
    const other=stored.meta.users.find(name=>name!==user.username)
    if(!areFriends(normalizeFriendsData(loadFriends()),user.username,other)) return res.status(403).json({error:"notfriends"})
    stored.meta.activeUsers=Array.isArray(stored.meta.activeUsers)?stored.meta.activeUsers:[]
    if(active){if(!stored.meta.activeUsers.includes(user.username)) stored.meta.activeUsers.push(user.username)}
    else stored.meta.activeUsers=stored.meta.activeUsers.filter(name=>name!==user.username)
    stored.meta.updatedAt=new Date().toISOString()
    writeJson(dmMetaPath(stored.folder),stored.meta)
    res.json({success:true})
})

app.post("/tickets/activity",(req,res)=>{

let user=auth(req)

if(!user && req.body.token){

const users=loadUsers()

for(const name in users){

if(users[name].sessionToken===req.body.token){

user=users[name]

break

}

}

}


if(!user){

return res.json({
error:"unauthorized"
})

}


const {
ticketId,
active
}=req.body


const data=loadTickets()


const ticket=data.find(
t=>t.id===ticketId
)


if(!ticket){

return res.json({
error:"ticket not found"
})

}


if(!ticket.activeUsers){

ticket.activeUsers=[]

}


if(active){


if(!ticket.activeUsers.includes(user.username)){

ticket.activeUsers.push(user.username)

}


}else{


ticket.activeUsers =
ticket.activeUsers.filter(
x=>x!==user.username
)


}


saveTickets(data)


res.json({
success:true
})


})

app.post("/dms/seen",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({error:"unauthorized"})
    const other=String(req.body?.chatId||"").trim()
    if(!other) return res.json({error:"missing"})
    if(!areFriends(normalizeFriendsData(loadFriends()),user.username,other)) return res.status(403).json({error:"notfriends"})
    const stored=getStoredChat(loadDMs(),user.username,other,false)
    if(!stored) return res.json({error:"notfound"})
    if(!stored.meta.users.includes(user.username)) return res.status(403).json({error:"noperms"})
    const now=new Date().toISOString()
    stored.meta.lastRead[user.username]=now
    stored.meta.unreadCounts[user.username]=0
    writeJson(dmMetaPath(stored.folder),stored.meta)
    res.json({success:true})
})

app.post("/friends/request",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const targetName=String(req.body.username||req.body.to||"").trim()
if(!targetName) return res.json({error:"missing"})

const users=loadUsers()
const target=resolveUserByUsername(users,targetName)

if(!target) return res.json({error:"notfound"})
if(target.username===user.username) return res.json({error:"self"})

const friendsData=normalizeFriendsData(loadFriends())
const existing=friendsData.friendRequests.find(r=>
(r.from===user.username && r.to===target.username) ||
(r.from===target.username && r.to===user.username)
)

if(areFriends(friendsData,user.username,target.username)) return res.json({error:"friends"})
if(existing) return res.json({error:"pending"})

friendsData.friendRequests.push({
id:crypto.randomBytes(8).toString("hex"),
from:user.username,
to:target.username,
time:new Date().toISOString()
})

saveFriends(friendsData)

res.json({success:true})
})

app.post("/friends/accept",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {requestId}=req.body
if(!requestId) return res.json({error:"missing"})

const friendsData=normalizeFriendsData(loadFriends())
const request=friendsData.friendRequests.find(r=>r.id===requestId && r.to===user.username)

if(!request) return res.json({error:"notfound"})

friendsData.friendRequests=friendsData.friendRequests.filter(r=>r.id!==requestId)
Object.assign(friendsData,addFriendPair(friendsData,request.from,request.to))

saveFriends(friendsData)

updateUserBadges(user.username)
updateUserBadges(request.from)

const dmsData=loadDMs()
const chat=ensureChat(dmsData,request.from,request.to)
saveDMs(chat)

res.json({success:true,friend:request.from})
})

app.post("/friends/decline",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const {requestId}=req.body
if(!requestId) return res.json({error:"missing"})

const friendsData=normalizeFriendsData(loadFriends())
const request=friendsData.friendRequests.find(r=>r.id===requestId && r.to===user.username)

if(!request) return res.json({error:"notfound"})

friendsData.friendRequests=friendsData.friendRequests.filter(r=>r.id!==requestId)
saveFriends(friendsData)

res.json({success:true})
})

app.post("/friends/remove",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const targetName=String(req.body.username||"").trim()
if(!targetName) return res.json({error:"missing"})

const users=loadUsers()
const target=resolveUserByUsername(users,targetName)

if(!target) return res.json({error:"notfound"})

const friendsData=normalizeFriendsData(loadFriends())

if(!areFriends(friendsData,user.username,target.username)) return res.json({error:"notfriends"})

removeFriendPair(friendsData,user.username,target.username)
saveFriends(friendsData)

res.json({success:true})
})

app.post("/2fa/send",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})
if(!user.email) return res.json({error:"noemail"})

const ip=getIP(req)

const lastUser=twofaSendCooldownUser.get(user.username)||0
const lastIP=twofaSendCooldownIP.get(ip)||0

if(now()-lastUser<60000) return res.json({error:"cooldown_user"})
if(now()-lastIP<30000) return res.json({error:"cooldown_ip"})

const dayKey = user.username + "_" + new Date().toDateString()
const count = dailyEmails.get(dayKey)||0

if(count>=10) return res.json({error:"daily_limit"})
dailyEmails.set(dayKey,count+1)

twofaSendCooldownUser.set(user.username,now())
twofaSendCooldownIP.set(ip,now())

const existingPos=queuePosition(user.username)

if(existingPos!==-1){
return res.json({
queued:true,
position:existingPos+1,
eta:estimateWait(existingPos)
})
}

twofaQueue.push({
username:user.username,
user,
expires:now()+60000
})

processQueue()

const pos=queuePosition(user.username)

res.json({
queued:true,
position:pos+1,
eta:estimateWait(pos)
})
})

app.get("/2fa/status",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const pos=queuePosition(user.username)

if(pos===-1){
return res.json({status:"none"})
}

res.json({
status:"queued",
position:pos+1,
eta:estimateWait(pos)
})
})

const cloudUpload = multer({
storage:multer.memoryStorage(),
limits:{
fileSize:10*1024*1024
}
})

function ensureCloudUser(user){

if(!user.cloudId){

user.cloudId = crypto.randomBytes(16).toString("hex")

const users = loadUsers()
users[user.username] = user
saveUsers(users)

}

return user.cloudId

}

function sanitizeFileName(name){
return String(name||"")
.replace(/[<>:"/\\|?*\x00-\x1F]/g,"_")
.trim()
}

app.post("/cloud/upload", cloudUpload.single("file"), async (req, res) => {
try{

const user = auth(req)

if(!user)
return res.json({error:"unauthorized"})

if(!req.file)
return res.json({error:"nofile"})

const cloudId = ensureCloudUser(user)

const limit = 1024 * 1024 * 1024

let used = 0

let objects

try{

objects = await r2.send(new ListObjectsV2Command({
Bucket: R2_BUCKET,
Prefix: cloudId + "/"
}))

}catch(err){

console.error(err)

return res.status(500).json({error:"server"})

}

if(objects.Contents){

for(const object of objects.Contents){

used += object.Size || 0

}

}

const incoming = req.file.size

if(used + incoming > limit){

return res.json({
error:"storagefull",
limit,
used,
remaining:Math.max(0,limit-used)
})

}

const original = sanitizeFileName(req.file.originalname)

await r2.send(new PutObjectCommand({

Bucket: R2_BUCKET,

Key: `${cloudId}/${original}`,

Body: req.file.buffer,

ContentType: req.file.mimetype,

Metadata:{
uploadedAt:new Date().toISOString()
}

}))

const metadata = loadCloudMetadata(user)

if(!metadata[cloudId])
metadata[cloudId] = {}

if(!metadata[cloudId][original]){

metadata[cloudId][original] = {
tags: [],
favorite: false,
album: null,
description: ""
}

saveCloudMetadata(user,metadata)

}

addCloudLog(user,"upload",{
ip:getIP(req),
file:original,
size:req.file.size
})

res.json({
success:true,
parts:1,
used:used+incoming,
limit
})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})

app.get("/cloud/list", async (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        const metadata = loadCloudMetadata(user);
        const userMetadata = metadata[cloudId] || {};

        const result = await r2.send(new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: cloudId + "/"
        }));

        const files = [];

        for (const object of result.Contents || []) {

            if (object.Key === cloudId + "/")
                continue;

            const name = object.Key.substring((cloudId + "/").length);

            const meta = userMetadata[name] || {};

            files.push({
                name,
                size: object.Size,
                uploadedAt: object.LastModified,
                type: "application/octet-stream",

                tags: Array.isArray(meta.tags)
                    ? meta.tags
                    : [],

                favorite: !!meta.favorite,

                album: meta.album || null,

                description: meta.description || ""
            });

        }

        res.json({ files });

    } catch (err) {

        console.error(err);

        res.status(500).json({ error: "server" });

    }
});

app.post("/cloud/tags/add", (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        let { files, tags } = req.body;

        if (!Array.isArray(files) || !Array.isArray(tags))
            return res.json({ error: "invalid" });

        tags = tags
            .map(tag => String(tag).trim())
            .filter(tag => tag.length);

        if (!tags.length)
            return res.json({ error: "no tags" });

        const metadata = loadCloudMetadata(user);

        if (!metadata[cloudId])
            metadata[cloudId] = {};

        for (const file of files) {

            if (!metadata[cloudId][file]) {
                metadata[cloudId][file] = {
                    tags: [],
                    favorite: false,
                    album: null,
                    description: ""
                };
            }

            for (const tag of tags) {

                if (!metadata[cloudId][file].tags.includes(tag))
                    metadata[cloudId][file].tags.push(tag);

            }

        }

        saveCloudMetadata(user,metadata);

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "server"
        });

    }
});

app.post("/cloud/tags/remove", (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        let { files, tags } = req.body;

        if (!Array.isArray(files) || !Array.isArray(tags))
            return res.json({ error: "invalid" });

        tags = tags
            .map(tag => String(tag).trim())
            .filter(tag => tag.length);

        const metadata = loadCloudMetadata(user);

        if (!metadata[cloudId])
            return res.json({ success: true });

        for (const file of files) {

            if (!metadata[cloudId][file])
                continue;

            metadata[cloudId][file].tags =
                metadata[cloudId][file].tags.filter(tag => !tags.includes(tag));

        }

        saveCloudMetadata(user,metadata);

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "server"
        });

    }
});

app.post("/cloud/search", async (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        const query = String(req.body.query || "")
            .trim()
            .toLowerCase();

        const metadata = loadCloudMetadata(user);
        const userMetadata = metadata[cloudId] || {};

        const result = await r2.send(new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: cloudId + "/"
        }));

        const files = [];

        for (const object of result.Contents || []) {

            if (object.Key === cloudId + "/")
                continue;

            const name = object.Key.substring((cloudId + "/").length);

            const meta = userMetadata[name] || {};

            const tags = Array.isArray(meta.tags)
                ? meta.tags
                : [];

            const favorite = !!meta.favorite;

            const album = meta.album || "";

            const description = meta.description || "";

            if (query) {

                const match =
                    name.toLowerCase().includes(query) ||
                    tags.some(tag => tag.toLowerCase().includes(query)) ||
                    album.toLowerCase().includes(query) ||
                    description.toLowerCase().includes(query);

                if (!match)
                    continue;

            }

            files.push({
                name,
                size: object.Size,
                uploadedAt: object.LastModified,
                type: "application/octet-stream",
                tags,
                favorite,
                album,
                description
            });

        }

        res.json({ files });

    } catch (err) {

        console.error(err);

        res.status(500).json({ error: "server" });

    }
});

app.post("/cloud/favorite", (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        const { name, favorite } = req.body;

        if (!name)
            return res.json({ error: "invalid" });

        const metadata = loadCloudMetadata(user);

        if (!metadata[cloudId])
            metadata[cloudId] = {};

        if (!metadata[cloudId][name]) {
            metadata[cloudId][name] = {
                tags: [],
                favorite: false,
                album: null,
                description: ""
            };
        }

        metadata[cloudId][name].favorite = !!favorite;

        saveCloudMetadata(user,metadata);

        res.json({
            success: true,
            favorite: metadata[cloudId][name].favorite
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "server"
        });

    }
});

app.post("/cloud/album", (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        const { files, album } = req.body;

        if (!Array.isArray(files))
            return res.json({ error: "invalid" });

        const metadata = loadCloudMetadata(user);

        if (!metadata[cloudId])
            metadata[cloudId] = {};

        for (const file of files) {

            if (!metadata[cloudId][file]) {
                metadata[cloudId][file] = {
                    tags: [],
                    favorite: false,
                    album: null,
                    description: ""
                };
            }

            metadata[cloudId][file].album =
                album && String(album).trim()
                    ? String(album).trim()
                    : null;

        }

        saveCloudMetadata(user,metadata);

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "server"
        });

    }
});

app.post("/cloud/description", (req, res) => {
    try {

        const user = auth(req);

        if (!user)
            return res.json({ error: "unauthorized" });

        const cloudId = ensureCloudUser(user);

        const { name, description } = req.body;

        if (!name)
            return res.json({ error: "invalid" });

        const metadata = loadCloudMetadata(user);

        if (!metadata[cloudId])
            metadata[cloudId] = {};

        if (!metadata[cloudId][name]) {
            metadata[cloudId][name] = {
                tags: [],
                favorite: false,
                album: null,
                description: ""
            };
        }

        metadata[cloudId][name].description =
            String(description || "").trim();

        saveCloudMetadata(user,metadata);

        res.json({
            success: true,
            description: metadata[cloudId][name].description
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "server"
        });

    }
});

app.get("/admin/cloud-logs/:username",(req,res)=>{
try{

const user=auth(req)

if(!user || !hasAdmin(user))
return res.sendStatus(403)

const users=loadUsers()

const target=users[req.params.username]

if(!target)
return res.json({error:"nouser"})

const folder=cloudLogsRoot(target.username)
let logs=[]
if(fs.existsSync(folder)){
for(const file of fs.readdirSync(folder)){
if(!file.endsWith(".json")) continue
const data=readJson(path.join(folder,file),[])
if(Array.isArray(data)) logs.push(...data)
}
}
logs.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0))
res.json({logs})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})

app.get("/cloud/download/:name", async (req,res)=>{
try{

const user=auth(req)

if(!user)
return res.status(401).json({error:"unauthorized"})

const fileName=sanitizeFileName(req.params.name)

const cloudId=ensureCloudUser(user)

let object

try{

object=await r2.send(new GetObjectCommand({
Bucket:R2_BUCKET,
Key:`${cloudId}/${fileName}`
}))

}catch{

return res.json({error:"notfound"})

}

const chunks=[]

for await(const chunk of object.Body){
chunks.push(chunk)
}

const buffer=Buffer.concat(chunks)

res.setHeader(
"Content-Disposition",
`attachment; filename="${fileName}"`
)

res.setHeader(
"Content-Type",
object.ContentType || "application/octet-stream"
)

addCloudLog(user,"download",{
ip:getIP(req),
file:fileName,
size:buffer.length
})

res.send(buffer)

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})

app.post("/admin/payout/add",(req,res)=>{

const user=auth(req)

if(!user || !hasAdmin(user))
return res.sendStatus(403)

const {
username,
amount,
currency,
reason,
time
}=req.body

if(!username || !amount || !currency || !reason)
return res.json({error:"missing"})

const users=loadUsers()

if(!users[username])
return res.json({error:"nouser"})

let payouts=loadPayoutHistory(username)
payouts.unshift({
id:crypto.randomBytes(8).toString("hex"),
amount,
currency,
reason,
time:time || new Date().toISOString(),
addedBy:user.username
})
if(payouts.length>1000) payouts.length=1000
savePayoutHistory(username,payouts)

res.json({
success:true
})

})


app.get("/payout/history",(req,res)=>{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

const payouts=loadPayoutHistory(user.username)

res.json({
history:payouts
})

})

app.post("/cloud/delete", async (req,res)=>{
try{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

const fileName=sanitizeFileName(req.body.name)

const cloudId=ensureCloudUser(user)

try{

await r2.send(new DeleteObjectCommand({
Bucket:R2_BUCKET,
Key:`${cloudId}/${fileName}`
}))

}catch{

return res.json({error:"notfound"})

}

const metadata=loadCloudMetadata(user)

if(metadata[cloudId]){

delete metadata[cloudId][fileName]

if(Object.keys(metadata[cloudId]).length===0)
delete metadata[cloudId]

saveCloudMetadata(user,metadata)

}

addCloudLog(user,"delete",{
ip:getIP(req),
file:fileName
})

res.json({success:true})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})

app.get("/admin/cloud/:username", async (req,res)=>{
try{

const user=auth(req)

if(!user || !hasAdmin(user))
return res.sendStatus(403)

const users=loadUsers()

const target=users[req.params.username]

if(!target)
return res.json({error:"nouser"})

const cloudId=ensureCloudUser(target)

const result=await r2.send(new ListObjectsV2Command({
Bucket:R2_BUCKET,
Prefix:cloudId+"/"
}))

const files=[]

for(const object of result.Contents || []){

if(object.Key===cloudId+"/")
continue

files.push({
name:object.Key.substring((cloudId+"/").length),
size:object.Size,
uploadedAt:object.LastModified,
type:"application/octet-stream"
})

}

res.json({
username:target.username,
files
})

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})

app.get("/admin/cloud/:username/download/:name", async (req,res)=>{
try{

const user=auth(req)

if(!user || !hasAdmin(user))
return res.sendStatus(403)

const users=loadUsers()

const target=users[req.params.username]

if(!target)
return res.json({error:"nouser"})

const fileName=sanitizeFileName(req.params.name)

const cloudId=ensureCloudUser(target)

let object

try{

object=await r2.send(new GetObjectCommand({
Bucket:R2_BUCKET,
Key:`${cloudId}/${fileName}`
}))

}catch{

return res.json({error:"notfound"})

}

const chunks=[]

for await(const chunk of object.Body){
chunks.push(chunk)
}

const buffer=Buffer.concat(chunks)

res.setHeader(
"Content-Disposition",
`attachment; filename="${fileName}"`
)

res.setHeader(
"Content-Type",
object.ContentType || "application/octet-stream"
)

res.send(buffer)

}catch(err){

console.error(err)

res.status(500).json({error:"server"})

}
})


app.get("/subscriptions/me",(req,res)=>{
    try{
        const user=auth(req)
        if(!user) return res.status(401).json({error:"unauthorized"})
        res.json({subscription:subscriptionResponse(user.username)})
    }catch(err){
        console.error("SUBSCRIPTION STATUS ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/subscriptions/redeem",(req,res)=>{
    try{
        const user=auth(req)
        if(!user) return res.status(401).json({error:"unauthorized"})

        const safeUser=validSubscriptionUsername(user.username)
        if(!safeUser) return res.status(400).json({error:"invalid_user"})

        const code=normalizeSubscriptionCode(req.body?.code)
        if(!code) return res.status(400).json({error:"missing_code"})

        const data=loadSubscriptionCodes()
        const entry=data.codes.find(x=>normalizeSubscriptionCode(x.code)===code)

        if(!entry) return res.status(404).json({error:"invalid_code"})
        if(entry.redeemedAt) return res.status(409).json({error:"code_already_redeemed"})

        const plan=SUBSCRIPTION_PLANS[entry.plan]
        if(!plan) return res.status(400).json({error:"invalid_plan"})

        const existing=getActiveSubscription(safeUser)
        if(existing){
            return res.status(409).json({
                error:"subscription_already_active",
                subscription:subscriptionResponse(safeUser)
            })
        }

        const redeemedAt=new Date()
        const lifetime=entry.lifetime===true || String(entry.durationUnit||"").toLowerCase()==="lifetime"
        let expiry=null

        if(!lifetime){
            const durationMs=Number(entry.durationMs)||subscriptionDurationMs(entry.durationValue,entry.durationUnit)
            if(!Number.isSafeInteger(durationMs) || durationMs<=0){
                return res.status(400).json({error:"invalid_code_duration"})
            }
            expiry=new Date(redeemedAt.getTime()+durationMs).toISOString()
        }

        const redeemedAtIso=redeemedAt.toISOString()
        entry.lifetime=lifetime
        entry.redeemedAt=redeemedAtIso
        entry.redeemedBy=safeUser
        entry.expiresAt=expiry

        saveSubscriptionCodes(data)
        saveSubscription(safeUser,{
            active:true,
            plan:entry.plan,
            lifetime,
            activatedAt:redeemedAtIso,
            expiresAt:expiry,
            source:"redeemed_code"
        })

        const redeemed=loadRedeemedCodes(safeUser)
        redeemed.codes.unshift({
            code,
            plan:entry.plan,
            planName:plan.name,
            durationValue:lifetime ? null : entry.durationValue,
            durationUnit:lifetime ? "lifetime" : entry.durationUnit,
            durationMs:lifetime ? null : entry.durationMs,
            lifetime,
            redeemedAt:redeemedAtIso,
            expiresAt:expiry
        })
        saveRedeemedCodes(safeUser,redeemed)

        logAction("subscription_redeemed",{
            user:safeUser,
            plan:entry.plan,
            codePrefix:code.split("-").slice(0,2).join("-"),
            lifetime,
            redeemedAt:redeemedAtIso,
            expiresAt:expiry
        })

        res.json({success:true,subscription:subscriptionResponse(safeUser)})
    }catch(err){
        console.error("SUBSCRIPTION REDEEM ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

function parseMembershipDurationToken(value){
    const raw=String(value||"").trim().toLowerCase()
    if(raw==="perm" || raw==="permanent" || raw==="lifetime"){
        return {lifetime:true,durationValue:null,durationUnit:"lifetime",durationMs:null}
    }
    const match=raw.match(/^(\d+)\s*([sdmy])$/)
    if(!match) return null
    const amount=Number(match[1])
    const multipliers={s:1000,d:86400000,m:30*86400000,y:365*86400000}
    if(!Number.isSafeInteger(amount) || amount<1 || amount>10000) return null
    const durationMs=amount*multipliers[match[2]]
    if(!Number.isSafeInteger(durationMs) || durationMs<=0) return null
    const units={s:"seconds",d:"days",m:"months",y:"years"}
    return {lifetime:false,durationValue:amount,durationUnit:units[match[2]],durationMs}
}

const DISCORD_REWARD_CODES_PATH=path.join(__dirname,"DiscordRewardCodes.json")
function loadDiscordRewardCodes(){
    const data=readJson(DISCORD_REWARD_CODES_PATH,{codes:[]})
    return data && typeof data==="object" && Array.isArray(data.codes) ? data : {codes:[]}
}
function saveDiscordRewardCodes(data){
    writeJson(DISCORD_REWARD_CODES_PATH,{codes:Array.isArray(data?.codes)?data.codes:[]})
}
function normalizeDiscordRewardCode(value){
    return String(value||"").trim().toUpperCase()
}
function generateDiscordRewardCode(type,existingCodes){
    const prefix=type==="xp" ? "ZXP" : "ZLVL"
    let code
    do{
        code=`${prefix}-${Array.from({length:4},()=>crypto.randomBytes(2).toString("hex").toUpperCase()).join("-")}`
    }while(existingCodes.some(entry=>normalizeDiscordRewardCode(entry.code)===code))
    return code
}

app.post("/discord/generate-zkey",(req,res)=>{
    try{
        if(!validDiscordBotRequest(req)) return res.sendStatus(403)
        const planId=String(req.body?.plan||"").trim().toLowerCase()
        if(!SUBSCRIPTION_PLANS[planId]) return res.status(400).json({error:"invalid_plan"})
        const duration=parseMembershipDurationToken(req.body?.duration)
        if(!duration) return res.status(400).json({error:"invalid_duration"})
        const data=loadSubscriptionCodes()
        const code=generateSubscriptionCode(planId)
        const entry={
            code,
            plan:planId,
            planName:SUBSCRIPTION_PLANS[planId].name,
            durationValue:duration.durationValue,
            durationUnit:duration.durationUnit,
            durationMs:duration.durationMs,
            lifetime:duration.lifetime,
            createdAt:new Date().toISOString(),
            createdBy:String(req.body?.createdBy||"Discord bot"),
            redeemedAt:null,
            redeemedBy:null,
            expiresAt:null
        }
        data.codes.push(entry)
        saveSubscriptionCodes(data)
        logAction("discord_subscription_code_created",{
            createdBy:entry.createdBy,
            plan:planId,
            lifetime:duration.lifetime,
            durationValue:duration.durationValue,
            durationUnit:duration.durationUnit
        })
        res.json({success:true,code,plan:planId,planName:entry.planName,lifetime:duration.lifetime,duration:req.body.duration})
    }catch(err){
        console.error("DISCORD ZKEY GENERATION ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/discord/generate-reward-code",(req,res)=>{
    try{
        if(!validDiscordBotRequest(req)) return res.sendStatus(403)
        const type=String(req.body?.type||"").trim().toLowerCase()
        const amount=Number(req.body?.amount)
        if(!["xp","level"].includes(type)) return res.status(400).json({error:"invalid_type"})
        if(!Number.isSafeInteger(amount) || amount<1 || amount>1000000000) return res.status(400).json({error:"invalid_amount"})
        if(type==="level" && amount>10) return res.status(400).json({error:"level_amount_too_large"})
        const data=loadDiscordRewardCodes()
        const code=generateDiscordRewardCode(type,data.codes)
        data.codes.push({
            code,
            type,
            amount,
            createdAt:new Date().toISOString(),
            createdBy:String(req.body?.createdBy||"Discord bot"),
            redeemedAt:null,
            redeemedBy:null
        })
        saveDiscordRewardCodes(data)
        logAction("discord_reward_code_created",{type,amount,createdBy:String(req.body?.createdBy||"Discord bot")})
        res.json({success:true,code,type,amount})
    }catch(err){
        console.error("DISCORD REWARD CODE GENERATION ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/discord/redeem-reward-code",(req,res)=>{
    try{
        if(!validDiscordBotRequest(req)) return res.sendStatus(403)
        const type=String(req.body?.type||"").trim().toLowerCase()
        const code=normalizeDiscordRewardCode(req.body?.code)
        const discordId=String(req.body?.discordId||"").trim()
        if(!["xp","level"].includes(type) || !code || !discordId) return res.status(400).json({error:"missing"})
        const data=loadDiscordRewardCodes()
        const entry=data.codes.find(item=>normalizeDiscordRewardCode(item.code)===code && item.type===type)
        if(!entry) return res.status(404).json({error:"invalid_code"})
        if(entry.redeemedAt) return res.status(409).json({error:"code_already_redeemed"})
        entry.redeemedAt=new Date().toISOString()
        entry.redeemedBy=discordId
        saveDiscordRewardCodes(data)
        logAction("discord_reward_code_redeemed",{type,amount:entry.amount,discordId,codePrefix:code.split("-")[0]})
        res.json({success:true,type,amount:entry.amount})
    }catch(err){
        console.error("DISCORD REWARD CODE REDEMPTION ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/discord/password-reset",(req,res)=>{
    try{
        if(!validDiscordBotRequest(req)) return res.sendStatus(403)
        const username=String(req.body?.username||"").trim()
        const email=String(req.body?.email||"").trim().toLowerCase()
        if(!username || !email) return res.status(400).json({error:"missing"})
        const users=loadUsers()
        const target=users[username] || Object.values(users).find(user=>String(user?.username||"").toLowerCase()===username.toLowerCase())
        if(!target || String(target.email||"").trim().toLowerCase()!==email) return res.status(404).json({error:"account_email_mismatch"})
        const now=Date.now()
        const lastUser=passwordResetCooldownUser.get(target.username)||0
        if(now-lastUser<15*60*1000) return res.status(429).json({error:"cooldown",remaining:15*60*1000-(now-lastUser)})
        const existingPos=passwordResetQueuePosition(target.username)
        if(existingPos!==-1) return res.json({success:true,queued:true,position:existingPos+1})
        passwordResetCooldownUser.set(target.username,now)
        passwordResetQueue.push({username:target.username,user:target,expires:now+60000})
        processPasswordResetQueue()
        const position=passwordResetQueuePosition(target.username)
        logAction("discord_password_reset_queued",{username:target.username})
        res.json({success:true,queued:true,position:Math.max(1,position+1)})
    }catch(err){
        console.error("DISCORD PASSWORD RESET ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/admin/subscriptions/codes",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

        const planId=String(req.body?.plan||"").trim().toLowerCase()
        if(!SUBSCRIPTION_PLANS[planId]) return res.status(400).json({error:"invalid_plan"})

        const lifetime=req.body?.lifetime===true || String(req.body?.durationUnit||"").trim().toLowerCase()==="lifetime"
        const quantity=Math.min(100,Math.max(1,Math.floor(Number(req.body?.quantity)||1)))
        let durationValue=null
        let durationUnit="lifetime"
        let durationMs=null

        if(!lifetime){
            durationValue=Number(req.body?.durationValue)
            durationUnit=String(req.body?.durationUnit||"").trim().toLowerCase()
            durationMs=subscriptionDurationMs(durationValue,durationUnit)
            if(!durationMs) return res.status(400).json({error:"invalid_duration"})
        }

        const data=loadSubscriptionCodes()
        const created=[]
        for(let i=0;i<quantity;i++){
            const code=generateSubscriptionCode(planId)
            const entry={
                code,
                plan:planId,
                planName:SUBSCRIPTION_PLANS[planId].name,
                durationValue,
                durationUnit,
                durationMs,
                lifetime,
                createdAt:new Date().toISOString(),
                createdBy:admin.username,
                redeemedAt:null,
                redeemedBy:null,
                expiresAt:null
            }
            data.codes.push(entry)
            created.push(entry)
        }

        saveSubscriptionCodes(data)

        logAction("subscription_codes_created",{
            admin:admin.username,
            plan:planId,
            quantity,
            lifetime,
            durationValue,
            durationUnit
        })

        res.json({
            success:true,
            plan:planId,
            planName:SUBSCRIPTION_PLANS[planId].name,
            quantity,
            lifetime,
            codes:created
        })
    }catch(err){
        console.error("SUBSCRIPTION CODE CREATE ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.get("/admin/subscriptions/codes",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)
        const data=loadSubscriptionCodes()
        res.json({codes:data.codes,total:data.codes.length,plans:SUBSCRIPTION_PLANS})
    }catch(err){
        console.error("SUBSCRIPTION CODE LIST ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.delete("/admin/subscriptions/codes/:code",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

        const code=normalizeSubscriptionCode(req.params.code)
        const data=loadSubscriptionCodes()
        const index=data.codes.findIndex(x=>normalizeSubscriptionCode(x.code)===code)
        if(index===-1) return res.status(404).json({error:"notfound"})

        const [deleted]=data.codes.splice(index,1)
        saveSubscriptionCodes(data)

        logAction("subscription_code_deleted",{
            admin:admin.username,
            codePrefix:code.split("-").slice(0,2).join("-"),
            redeemed:!!deleted.redeemedAt
        })

        res.json({success:true,deleted})
    }catch(err){
        console.error("SUBSCRIPTION CODE DELETE ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.delete("/admin/subscriptions/codes",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

        const data=loadSubscriptionCodes()
        const deleted=data.codes.length
        saveSubscriptionCodes({codes:[]})

        logAction("subscription_codes_deleted_all",{admin:admin.username,deleted})
        res.json({success:true,deleted})
    }catch(err){
        console.error("SUBSCRIPTION CODE DELETE ALL ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.get("/admin/subscriptions/users",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)
        const users=loadUsers()
        const subscriptions=[]
        for(const username of Object.keys(users)){
            const active=getActiveSubscription(username)
            if(active){
                subscriptions.push({
                    username,
                    subscription:subscriptionResponse(username)
                })
            }
        }
        res.json({users:subscriptions,total:subscriptions.length})
    }catch(err){
        console.error("ADMIN SUBSCRIPTION USERS ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.get("/admin/subscriptions/users/:username",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)
        const users=loadUsers()
        const target=resolveUserRecord(users,decodeURIComponent(req.params.username))
        if(!target) return res.status(404).json({error:"nouser"})
        res.json({
            username:target.username,
            subscription:subscriptionResponse(target.username),
            redeemedCodes:loadRedeemedCodes(target.username).codes
        })
    }catch(err){
        console.error("ADMIN SUBSCRIPTION USER GET ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.post("/admin/subscriptions/users/:username",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

        const users=loadUsers()
        const target=resolveUserRecord(users,decodeURIComponent(req.params.username))
        if(!target) return res.status(404).json({error:"nouser"})

        const planId=String(req.body?.plan||"").trim().toLowerCase()
        if(!SUBSCRIPTION_PLANS[planId]) return res.status(400).json({error:"invalid_plan"})

        const lifetime=req.body?.lifetime===true || String(req.body?.durationUnit||"").trim().toLowerCase()==="lifetime"
        let expiresAt=null
        let durationMs=null

        if(!lifetime){
            durationMs=subscriptionDurationMs(req.body?.durationValue,req.body?.durationUnit)
            if(!durationMs) return res.status(400).json({error:"invalid_duration"})
            expiresAt=new Date(Date.now()+durationMs).toISOString()
        }

        const activatedAt=new Date().toISOString()
        saveSubscription(target.username,{
            active:true,
            plan:planId,
            lifetime,
            activatedAt,
            expiresAt,
            source:"admin"
        })

        logAction("subscription_admin_assigned",{
            admin:admin.username,
            username:target.username,
            plan:planId,
            lifetime,
            expiresAt
        })

        res.json({success:true,username:target.username,subscription:subscriptionResponse(target.username)})
    }catch(err){
        console.error("ADMIN SUBSCRIPTION ASSIGN ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.delete("/admin/subscriptions/users/:username",(req,res)=>{
    try{
        const admin=auth(req)
        if(!admin || !hasAdmin(admin)) return res.sendStatus(403)

        const users=loadUsers()
        const target=resolveUserRecord(users,decodeURIComponent(req.params.username))
        if(!target) return res.status(404).json({error:"nouser"})

        const previous=subscriptionResponse(target.username)
        saveSubscription(target.username,emptySubscription())

        logAction("subscription_admin_removed",{
            admin:admin.username,
            username:target.username,
            previousPlan:previous.plan,
            previousLifetime:previous.lifetime
        })

        res.json({success:true,username:target.username,subscription:subscriptionResponse(target.username)})
    }catch(err){
        console.error("ADMIN SUBSCRIPTION REMOVE ERROR:",err)
        res.status(500).json({error:"server"})
    }
})

app.get("/me",(req,res)=>{
  try{
    const users=loadUsers()
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

halloweenAwardParticipationForHistoricalActivity(user)
user.lastActiveAt=new Date().toISOString()
if(halloweenEventWindow()) halloweenSyncActivity(user)
const squirtleBoss=loadSquirtleBoss()
if(!squirtleBoss.deadAt && Date.now()<squirtleEventEndMs()){
    user.squirtleEventActiveAt=user.squirtleEventActiveAt||user.lastActiveAt
}
saveUsers(users)

ensureUserBadges(user.username)
updateUserBadges(user.username)
updateLegacyBadge(user.username)

if(isBanned(user,users))
      return res.json({
        banned:true,
        reason:user.banReason,
        message:user.banMessage||user.banReason||"Your account has been banned.",
        expiresAt:user.banExpires ? new Date(user.banExpires).toISOString() : null,
        remaining:user.banExpires ? Math.max(0,user.banExpires-Date.now()) : null
      })

    if(!user.linkCode){
      user.linkCode=generateLinkCode()
      saveUsers(users)
    }

    const perms=loadPerms()

    res.json({
       username:user.username,
       linkCode:user.linkCode,
       linkedDiscord:user.linkedDiscord,
        permissions:{
            support: perms.permissions.Support.includes(user.username),
            admin: perms.permissions.Administrator.includes(user.username),
            vip: perms.permissions.VIP.includes(user.username),
            betaTester: isBetaTester(user.username),
            pfp: hasPfpPermission(user.username),
            gifPfp: !!getActiveSubscription(user.username)?.details?.gif || hasAdmin(user)
        },
        subscription:subscriptionResponse(user.username)
     })
  }catch(err){
    console.error(err)
    res.status(500).json({error:"server"})
  }
})

app.post("/quests",(req,res)=>{

try{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})

let quests=loadQuests()

const lootData=loadLootlabs()

if(!Array.isArray(user.completedQuests))
user.completedQuests=[]

quests=quests.map(q=>{

if(q.type==="lootlabs"){

return {
...q,
progress:lootData[user.username]?.progress || 0
}

}

return q

})

const completed=quests.filter(q=>
user.completedQuests.includes(q.id)
)

const available=quests.filter(q=>
!user.completedQuests.includes(q.id)
)

res.json({
completed,
available
})

}catch(err){

console.error("QUEST ERROR:",err)

res.status(500).json({
error:"server"
})

}

})

function ensureWallet(user){
user.wallet=normalizeWallet(user.wallet || loadWallet(user.username))
}

app.post("/admin/payout",(req,res)=>{
try{

const user = auth(req)
if(!user || !hasAdmin(user)) return res.sendStatus(403)

const {username,amount,reason,type}=req.body

const users=loadUsers()
const target=users[username]
if(!target) return res.json({error:"nouser"})

ensureWallet(target)

if(type==="take"){
if(target.wallet.balance<amount) return res.json({error:"notenough"})
target.wallet.balance-=amount
}else{
target.wallet.balance+=amount
}

target.wallet.history.push({
type,
amount,
reason,
date:new Date().toISOString(),
by:user.username
})

saveUsers(users)

res.json({success:true})

}catch(e){
res.status(500).json({error:"server"})
}
})

app.get("/balance",(req,res)=>{
try{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

ensureWallet(user)

res.json({
balance:user.wallet.balance,
history:user.wallet.history
})
}catch(e){
res.status(500).json({error:"server"})
}
})

app.get("/history",(req,res)=>{
  try{

    const user = auth(req)
    if(!user) return res.json({error:"unauthorized"})

    const quests = loadQuests()

    let totalRewards = {}
    let completedCount = 0
    let questDetails = []

    if(Array.isArray(user.questHistory)){
      user.questHistory.forEach(h=>{
        const q = quests.find(x=>x.id===h.questId)
        if(!q) return

        completedCount++

        if(!totalRewards[q.reward.currency])
          totalRewards[q.reward.currency]=0

        totalRewards[q.reward.currency]+=q.reward.amount

        questDetails.push({
          id:q.id,
          title:q.title,
          amount:q.reward.amount,
          currency:q.reward.currency,
          completedAt:h.completedAt
        })
      })
    }

res.json({
  username:user.username,
  created:user.createdAt || null,
  linked:user.linkedDiscord || null,
  questsCompleted:completedCount,
  earnings:totalRewards,
  history:questDetails,
  logins:user.loginHistory || []
})

  }catch(err){
    console.error(err)
    res.status(500).json({error:"server"})
  }
})

app.post("/link-discord",(req,res)=>{
  try{
    const { secret, username, discordId, code } = req.body

    if(secret !== WEBSITE_SECRET)
      return res.status(403).json({ error: "unauthorized" })

    const users = loadUsers()
    const user = users[username]

    if(!user)
      return res.json({ error: "nouser" })

    if(!user.linkCode)
      return res.json({ error: "nolinkcode" })

    if(user.linkCode !== code)
      return res.json({ error: "wrongcode" })

    if(user.linkedDiscord)
      return res.json({ error: "alreadylinked" })

    user.linkedDiscord = {
  id: discordId,
  username: req.body.discordUsername || null
}
    saveUsers(users)

    res.json({ success: true })
  }catch(err){
    console.error("LINK ERROR:",err)
    res.status(500).json({error:"server"})
  }
})

function addUserNotification(username,message,type="system"){
    const users=loadUsers()
    const user=users[username]

    if(!user) return false

    if(!Array.isArray(user.notifications)){
        user.notifications=[]
    }

    user.notifications.unshift({
        id:crypto.randomBytes(12).toString("hex"),
        type,
        message:String(message),
        time:new Date().toISOString(),
        seen:false
    })

    if(user.notifications.length>100){
        user.notifications.length=100
    }

    saveUsers(users)

    return true
}

app.get("/notifications",(req,res)=>{
    const user=auth(req)
    if(!user) return res.json({error:"unauthorized"})

    const tickets=loadTickets()
    const notifications=[]

    if(Array.isArray(user.notifications)){
        notifications.push(
            ...user.notifications.filter(n=>!n.seen)
        )
    }

    for(const ticket of tickets){
        if(!ticket.notifications) continue

        const list=(ticket.notifications[user.username]||[])
            .filter(n=>!n.seen)

        for(const n of list){
            notifications.push({
                ...n,
                title:ticket.title,
                type:"support"
            })
        }
    }

    notifications.sort((a,b)=>
        new Date(b.time)-new Date(a.time)
    )

    res.json({
        notifications,
        unread:notifications.filter(x=>!x.seen).length
    })
})

app.post("/notifications/read-all",(req,res)=>{
    const user=auth(req)
    if(!user) return res.status(401).json({success:false,error:"unauthorized"})

    const users=loadUsers()
    const currentUser=users[user.username]
    if(!currentUser) return res.status(404).json({success:false,error:"user_not_found"})

    if(!Array.isArray(currentUser.notifications)) currentUser.notifications=[]
    currentUser.notifications.forEach(n=>{
        if(n && typeof n === "object") n.seen=true
    })
    saveUsers(users)

    const tickets=loadTickets()
    let changed=false
    for(const ticket of tickets){
        if(ticket?.notifications?.[user.username] && Array.isArray(ticket.notifications[user.username])){
            for(const n of ticket.notifications[user.username]){
                if(n && typeof n === "object" && n.seen!==true){
                    n.seen=true
                    changed=true
                }
            }
        }
    }
    if(changed) saveTickets(tickets)

    res.json({success:true})
})

app.post("/notifications/seen",(req,res)=>{
    const user=auth(req)
    if(!user) return res.json({error:"unauthorized"})

    const users=loadUsers()
    const currentUser=users[user.username]

    if(Array.isArray(currentUser?.notifications)){
        currentUser.notifications.forEach(n=>{
            if(n.type==="report"){
                n.seen=true
            }
        })

        saveUsers(users)
    }

    const tickets=loadTickets()
    const {ticketId}=req.body

    if(ticketId){
        const ticket=tickets.find(x=>x.id===ticketId)

        if(ticket?.notifications?.[user.username]){
            ticket.notifications[user.username].forEach(n=>{
                n.seen=true
            })

            saveTickets(tickets)
        }
    }

    res.json({success:true})
})

app.post("/admin/ban",(req,res)=>{
  try{
    const {secret,username,durationMs,reason}=req.body
    if(secret!==WEBSITE_SECRET) return res.sendStatus(403)

    const users=loadUsers()
    const user=users[username]
    if(!user) return res.json({error:"nouser"})

    user.banned=true
    user.banReason=reason
    user.banExpires=Date.now()+durationMs

    saveUsers(users)
    res.json({success:true})
  }catch(err){
    console.error(err)
    res.status(500).json({error:"server"})
  }
})

app.post("/link-info",(req,res)=>{
  try{
    const {secret,discordId}=req.body
    if(secret!==WEBSITE_SECRET) return res.sendStatus(403)

    const users=loadUsers()

    for(const u of Object.values(users)){
      if(u.linkedDiscord && String(u.linkedDiscord.id)===String(discordId)){
        const roblox=u.roblox && u.roblox.username ? {
          id:u.roblox.id || null,
          username:u.roblox.username,
          profileUrl:u.roblox.id ? `https://www.roblox.com/users/${u.roblox.id}/profile` : null
        } : null
        return res.json({username:u.username,roblox})
      }
    }

    res.json({})
  }catch(err){
    console.error(err)
    res.status(500).json({error:"server"})
  }
})

app.post("/support/create",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

let tickets=loadTickets()

const open=tickets.filter(t=>t.owner===user.username && t.status==="open")
if(open.length>=2) return res.json({error:"max2tickets"})

const id=generateTicketId()

tickets.push({
id,
owner:user.username,
title:req.body.title || "Untitled",
reason:req.body.reason || "",
info:req.body.info || "",
status:"open",
locked:false,
createdAt:new Date().toISOString(),
closedAt:null,
notifications:{},
messages:[{
author:user.username,
text:req.body.reason || "",
time:new Date().toISOString()
}]
})

saveTickets(tickets)
logAction("ticket_create",{user:user.username,id})

res.json({success:true})
})

app.post("/support/message",upload.single("file"),(req,res)=>{

const user=auth(req)

if(!user)
return res.json({error:"unauthorized"})


const now=Date.now()

const last=messageCooldown.get(user.username)||0


if(now-last<2000)
return res.json({error:"cooldown"})


messageCooldown.set(
user.username,
now
)


let tickets=loadTickets()


const t=tickets.find(
x=>x.id===req.body.ticketId
)


if(!t)
return res.json({error:"notfound"})


let author=user.username


if(req.body.anonymous && hasAdmin(user)){

author=
"Support Staff Member#"+
Math.floor(1000+Math.random()*9000)

}


let attachment=null


if(req.file){

attachment={

name:req.file.originalname,

path:req.file.filename,

size:req.file.size

}

}



t.messages.push({

author,

text:req.body.message||"",

attachment,

time:new Date().toISOString()

})



const perms=loadPerms()


const receivers=new Set()


receivers.add(
t.owner
)


for(const member of perms.permissions.Support || []){

receivers.add(member)

}


for(const member of perms.permissions.Administrator || []){

receivers.add(member)

}



for(const member of receivers){


if(member===user.username){

continue

}



addNotification(

t,

member,

`New reply from ${author}`

)



if(
!t.activeUsers ||
!t.activeUsers.includes(member)
){


sendPhoneNotification(

member,

"New Ticket Reply",

author+": "+(req.body.message||"Attachment")

)


}


}



saveTickets(tickets)


logAction(
"ticket_message",
{
user:user.username,
id:t.id
}
)


res.json({
success:true
})


})

app.get("/support/list",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

const tickets=loadTickets()

const mine=tickets.filter(t=>
t.owner===user.username &&
t.status!=="closed"
)

let all=[]

if(hasAdmin(user)){
all=tickets
}else if(hasSupport(user)){
all=tickets.filter(t=>t.status!=="closed")
}

res.json({
mine,
all
})

})



app.post("/support/close",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})

let tickets=loadTickets()
const t=tickets.find(x=>x.id===req.body.ticketId)
if(!t) return res.json({error:"notfound"})

if(t.locked && !hasAdmin(user))
return res.json({error:"locked"})

if(t.owner!==user.username && !hasSupport(user))
return res.json({error:"noperms"})

t.status="closed"
t.closedAt=new Date().toISOString()

saveTickets(tickets)
logAction("ticket_close",{user:user.username,id:t.id})

res.json({success:true})
})

app.post("/support/lock",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})
if(!hasSupport(user)) return res.json({error:"noperms"})

let tickets=loadTickets()
const t=tickets.find(x=>x.id===req.body.ticketId)
if(!t) return res.json({error:"notfound"})

t.locked=true

saveTickets(tickets)
logAction("ticket_lock",{user:user.username,id:t.id})

res.json({success:true})
})

app.post("/support/unlock",(req,res)=>{
const user=auth(req)
if(!user) return res.json({error:"unauthorized"})
if(!hasSupport(user)) return res.json({error:"noperms"})

let tickets=loadTickets()
const t=tickets.find(x=>x.id===req.body.ticketId)
if(!t) return res.json({error:"notfound"})

t.locked=false

saveTickets(tickets)
logAction("ticket_unlock",{user:user.username,id:t.id})

res.json({success:true})
})

let cloudflared=null
let retryTimeout=null

function startTunnel(){

if(cloudflared){

try{
cloudflared.kill()
}catch{}

}

console.log("Starting Cloudflare tunnel...")

cloudflared=spawn(
"npx",
[
"--yes",
"cloudflared",
"tunnel",
"--url",
`http://127.0.0.1:${PORT}`
],
{
stdio:["ignore","pipe","pipe"]
}
)

let found=false

cloudflared.stdout.on("data",(d)=>{

const msg=d.toString()

process.stdout.write(msg)

const match=msg.match(
/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/
)

if(match){

found=true

const url=match[0]

fs.writeFileSync("server.txt",url)

console.log("Public URL:",url)

}

})

cloudflared.stderr.on("data",(d)=>{

const msg=d.toString()

process.stderr.write(msg)

})

cloudflared.on("close",()=>{

console.log("Tunnel closed. Retrying in 5 seconds...")

if(retryTimeout){
clearTimeout(retryTimeout)
}

retryTimeout=setTimeout(()=>{
startTunnel()
},5000)

})
}

const ZYPHIUM_GIFT_PATH = path.join(__dirname,"ZyphiumGifts.json");

function loadZyphiumGifts(){
    return readJson(ZYPHIUM_GIFT_PATH,{});
}

function saveZyphiumGifts(data){
    writeJson(ZYPHIUM_GIFT_PATH,data && typeof data==="object" ? data : {});
}

function generateZyphiumGiftId(){
    let id;
    const gifts=loadZyphiumGifts();
    do{
        id=crypto.randomBytes(32).toString("hex");
    }while(gifts[id]);
    return id;
}

function addZyphiumGiftNotification(username,amount,message,from){
    const users=loadUsers();
    const target=users[username];
    if(!target) return;

    if(!Array.isArray(target.notifications)){
        target.notifications=[];
    }

    target.notifications.unshift({
        id:crypto.randomBytes(12).toString("hex"),
        type:"gift",
        message:`You received ${amount} Zyphium from a gift${from ? ` from ${from}` : ""}${message ? `: ${message}` : "."}`,
        time:new Date().toISOString(),
        seen:false
    });

    if(target.notifications.length>100){
        target.notifications.length=100;
    }

    users[username]=target;
    saveUsers(users);
}

if(!fs.existsSync(ZYPHIUM_GIFT_PATH)){
    saveZyphiumGifts({});
}

app.get("/ZyphiumGift",(req,res)=>{
    try{
        res.sendFile(path.join(__dirname,"ZyphiumGift.html"));
    }catch(err){
        console.error(err);
        res.status(500).send("Unable to load Zyphium Gift");
    }
});

app.post("/zyphium/gift/create",(req,res)=>{
    try{
        const user=auth(req);

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            });
        }

        const amount=Math.floor(Number(req.body?.amount)*100)/100;
        const message=String(req.body?.message || "").trim().slice(0,1000);

        if(!Number.isFinite(amount) || amount<=0){
            return res.json({
                success:false,
                error:"invalid_amount"
            });
        }

        if(amount>1000000){
            return res.json({
                success:false,
                error:"amount_too_large"
            });
        }

        const account=ensureZyphiumAccount(user.username);

        if(account.balance<amount){
            return res.json({
                success:false,
                error:"insufficient_balance"
            });
        }

        const giftId=generateZyphiumGiftId();
        const time=new Date().toISOString();

        account.balance=Math.floor((account.balance-amount)*100)/100;

        account.transactions.unshift({
            transactionId:giftId,
            type:"gift_created",
            amount,
            balanceAfter:account.balance,
            from:user.username,
            fromZAccountID:account.ZAccountID,
            note:message,
            time
        });

        if(account.transactions.length>500){
            account.transactions.length=500;
        }

        saveZyphium(user.username,account);

        const gifts=loadZyphiumGifts();

        gifts[giftId]={
            id:giftId,
            amount,
            message,
            sender:user.username,
            senderZAccountID:account.ZAccountID,
            createdAt:time,
            claimed:false,
            claimedBy:null,
            claimedAt:null
        };

        saveZyphiumGifts(gifts);

        res.json({
            success:true,
            id:giftId,
            amount,
            message,
            link:`https://zyphor.cc/ZyphiumGift?ID=${giftId}`,
            balance:account.balance
        });
    }catch(err){
        console.error("ZYPHIUM GIFT CREATE ERROR:",err);
        res.status(500).json({
            success:false,
            error:"server"
        });
    }
});

app.get("/zyphium/gift/active",(req,res)=>{
    try{
        const user=auth(req);

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            });
        }

        const gifts=loadZyphiumGifts();
        const username=String(user.username||"");

        const active=Object.values(gifts)
            .filter(gift=>{
                if(!gift || typeof gift!=="object") return false;
                if(String(gift.sender||"")!==username) return false;
                return gift.claimed!==true;
            })
            .sort((a,b)=>{
                const at=new Date(a.createdAt||0).getTime();
                const bt=new Date(b.createdAt||0).getTime();
                return bt-at;
            })
            .slice(0,100)
            .map(gift=>({
                id:String(gift.id||""),
                amount:Number(gift.amount)||0,
                message:String(gift.message||""),
                sender:username,
                createdAt:gift.createdAt||null,
                claimed:false,
                link:`https://zyphor.cc/ZyphiumGift?ID=${encodeURIComponent(String(gift.id||""))}`
            }));

        return res.status(200).json({
            success:true,
            gifts:active
        });
    }catch(err){
        console.error("ZYPHIUM GIFT ACTIVE ERROR:",err);
        return res.status(500).json({
            success:false,
            error:"server",
            message:String(err?.message||"unknown_error")
        });
    }
});

app.get("/zyphium/gift/info",(req,res)=>{
    try{
        const id=String(req.query?.ID || "").trim();

        if(!/^[a-f0-9]{64}$/i.test(id)){
            return res.json({
                success:false,
                error:"invalid_gift"
            });
        }

        const gifts=loadZyphiumGifts();
        const gift=gifts[id];

        if(!gift){
            return res.json({
                success:false,
                error:"gift_not_found"
            });
        }

        res.json({
            success:true,
            amount:Number(gift.amount)||0,
            message:String(gift.message||""),
            sender:String(gift.sender||""),
            claimed:gift.claimed===true,
            claimedBy:gift.claimedBy||null,
            claimedAt:gift.claimedAt||null,
            createdAt:gift.createdAt||null
        });
    }catch(err){
        console.error("ZYPHIUM GIFT INFO ERROR:",err);
        res.status(500).json({
            success:false,
            error:"server"
        });
    }
});

app.post("/zyphium/gift/claim",(req,res)=>{
    try{
        const user=auth(req);

        if(!user){
            return res.status(401).json({
                success:false,
                error:"unauthorized"
            });
        }

        const id=String(req.body?.id || "").trim();

        if(!/^[a-f0-9]{64}$/i.test(id)){
            return res.json({
                success:false,
                error:"invalid_gift"
            });
        }

        const gifts=loadZyphiumGifts();
        const gift=gifts[id];

        if(!gift){
            return res.json({
                success:false,
                error:"gift_not_found"
            });
        }

        if(gift.claimed===true){
            return res.json({
                success:false,
                error:"gift_claimed",
                claimedBy:gift.claimedBy||null,
                claimedAt:gift.claimedAt||null
            });
        }

        if(gift.revoked===true){
            return res.json({
                success:false,
                error:"gift_revoked"
            });
        }

        const amount=Math.floor(Number(gift.amount)*100)/100;

        if(!Number.isFinite(amount) || amount<=0){
            return res.json({
                success:false,
                error:"invalid_gift"
            });
        }

        const receiverAccount=ensureZyphiumAccount(user.username);
        const time=new Date().toISOString();

        gift.claimed=true;
        gift.claimedBy=user.username;
        gift.claimedByZAccountID=receiverAccount.ZAccountID;
        gift.claimedAt=time;

        receiverAccount.balance=Math.floor((receiverAccount.balance+amount)*100)/100;

        receiverAccount.transactions.unshift({
            transactionId:id,
            type:"gift_received",
            amount,
            balanceAfter:receiverAccount.balance,
            from:gift.sender||"Unknown",
            fromZAccountID:gift.senderZAccountID||null,
            to:user.username,
            toZAccountID:receiverAccount.ZAccountID,
            note:String(gift.message||"").slice(0,200),
            time
        });

        if(receiverAccount.transactions.length>500){
            receiverAccount.transactions.length=500;
        }

        saveZyphium(user.username,receiverAccount);
        saveZyphiumGifts(gifts);

        addZyphiumGiftNotification(
            user.username,
            amount,
            String(gift.message||"").slice(0,200),
            gift.sender||""
        );

        logAction("zyphium_gift_claimed",{
            giftId:id,
            amount,
            sender:gift.sender||null,
            receiver:user.username
        });

        res.json({
            success:true,
            id,
            amount,
            message:String(gift.message||""),
            sender:String(gift.sender||""),
            balance:receiverAccount.balance
        });
    }catch(err){
        console.error("ZYPHIUM GIFT CLAIM ERROR:",err);
        res.status(500).json({
            success:false,
            error:"server"
        });
    }
});

const ZYPHOR_KEY_SYSTEM_ROOT = path.join(__dirname, "KeySystem");
const ZYPHOR_KEY_SYSTEM_DB = path.join(ZYPHOR_KEY_SYSTEM_ROOT, "Keys.json");
const ZYPHOR_KEY_SYSTEM_AUDIT = path.join(ZYPHOR_KEY_SYSTEM_ROOT, "Audit.json");
const ZYPHOR_KEY_DEFAULT_MINUTES = 10080;
const ZYPHOR_KEY_MAX_MINUTES = 525600;

function ensureZyphorKeyStorage(){
    fs.mkdirSync(ZYPHOR_KEY_SYSTEM_ROOT,{recursive:true});
    if(!fs.existsSync(ZYPHOR_KEY_SYSTEM_DB)) writeJson(ZYPHOR_KEY_SYSTEM_DB,{keys:[]});
    if(!fs.existsSync(ZYPHOR_KEY_SYSTEM_AUDIT)) writeJson(ZYPHOR_KEY_SYSTEM_AUDIT,{events:[]});
}

function loadZyphorKeys(){
    ensureZyphorKeyStorage();
    const data=readJson(ZYPHOR_KEY_SYSTEM_DB,{keys:[]});
    if(!data || typeof data!=="object" || !Array.isArray(data.keys)) return {keys:[]};
    return data;
}

function saveZyphorKeys(data){
    const normalized=data && typeof data==="object" && Array.isArray(data.keys) ? data : {keys:[]};
    writeJson(ZYPHOR_KEY_SYSTEM_DB,normalized);
    return normalized;
}

function addZyphorKeyAudit(event){
    ensureZyphorKeyStorage();
    const data=readJson(ZYPHOR_KEY_SYSTEM_AUDIT,{events:[]});
    if(!Array.isArray(data.events)) data.events=[];
    data.events.push({...event,at:new Date().toISOString()});
    if(data.events.length>5000) data.events=data.events.slice(-5000);
    writeJson(ZYPHOR_KEY_SYSTEM_AUDIT,data);
}

function normalizeZyphorKey(value){
    return String(value||"").trim().toUpperCase();
}

function getZyphorKeyRecord(id){
    const db=loadZyphorKeys();
    return db.keys.find(item=>item.id===String(id||""))||null;
}

function zyphorKeyAdmin(req,res){
    const user=auth(req);
    if(!user){
        res.status(401).json({success:false,error:"unauthorized"});
        return null;
    }
    if(!hasAdmin(user)){
        res.status(403).json({success:false,error:"administrator_required"});
        return null;
    }
    return user;
}

ensureZyphorKeyStorage();

app.post("/key-system/create",(req,res)=>{
    try{
        const user=auth(req);
        if(!user) return res.status(401).json({success:false,error:"login_required"});
        const username=String(user.username||"").trim();
        if(!username) return res.status(401).json({success:false,error:"login_required"});
        const db=loadZyphorKeys();
        let key;
        do{
            key="ZYPHOR-"+crypto.randomBytes(24).toString("hex").toUpperCase();
        }while(db.keys.some(item=>normalizeZyphorKey(item.key)===key));
        const createdAt=new Date();
        const record={
            id:crypto.randomBytes(12).toString("hex"),
            key,
            createdAt:createdAt.toISOString(),
            expiresAt:new Date(createdAt.getTime()+ZYPHOR_KEY_DEFAULT_MINUTES*60000).toISOString(),
            durationMinutes:ZYPHOR_KEY_DEFAULT_MINUTES,
            disabled:false,
            createdBy:username,
            hwid:null,
            hwidHash:null,
            firstUsedAt:null,
            lastUsedAt:null,
            lastAccount:null,
            usageHistory:[],
            lastHwidResetAt:null,
            adminChangedAt:null,
            adminChangedBy:null
        };
        db.keys.push(record);
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"created",keyId:record.id,createdBy:username,durationMinutes:record.durationMinutes});
        res.status(201).json({success:true,key:record.key,id:record.id,createdAt:record.createdAt,expiresAt:record.expiresAt,durationMinutes:record.durationMinutes});
    }catch(err){
        console.error("ZYPHOR KEY CREATE ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

app.post("/key-system/validate",(req,res)=>{
    try{
        const key=normalizeZyphorKey(req.body?.key);
        const hwid=String(req.body?.hwid||"").trim().slice(0,256);
        const account=String(req.body?.account||"Unknown").trim().slice(0,100)||"Unknown";
        if(!key || !hwid) return res.status(400).json({success:false,valid:false,error:!key?"missing_key":"missing_hwid",message:"A key and HWID are required."});
        const db=loadZyphorKeys();
        const record=db.keys.find(item=>normalizeZyphorKey(item.key)===key);
        if(!record) return res.status(200).json({success:true,valid:false,error:"invalid_key",message:"Invalid key."});
        if(record.disabled===true) return res.status(200).json({success:true,valid:false,error:"disabled",message:"This key has been disabled."});
        if(record.expiresAt && Date.now()>=new Date(record.expiresAt).getTime()) return res.status(200).json({success:true,valid:false,error:"expired",message:"This key has expired."});
        if(record.hwid && record.hwid!==hwid) return res.status(200).json({success:true,valid:false,error:"hwid_mismatch",message:"This key is already bound to a different HWID."});
        const conflictingRecord=db.keys.find(item=>item.id!==record.id&&item.disabled!==true&&(!item.expiresAt||Date.now()<new Date(item.expiresAt).getTime())&&item.hwid===hwid);
        if(conflictingRecord) return res.status(200).json({success:true,valid:false,error:"hwid_already_assigned",message:"Another active key is already bound to this HWID."});
        const usedAt=new Date().toISOString();
        if(!record.hwid){
            record.hwid=hwid;
            record.hwidHash=crypto.createHash("sha256").update(hwid).digest("hex");
            record.firstUsedAt=usedAt;
        }
        record.lastUsedAt=usedAt;
        record.lastAccount=account;
        if(!Array.isArray(record.usageHistory)) record.usageHistory=[];
        record.usageHistory.push({hwid,hwidHash:record.hwidHash,account,usedAt});
        if(record.usageHistory.length>1000) record.usageHistory=record.usageHistory.slice(-1000);
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"validated",keyId:record.id,account,hwidHash:record.hwidHash,usedAt});
        res.json({success:true,valid:true,message:"correct key",keyId:record.id,hwid:record.hwid,hwidHash:record.hwidHash,expiresAt:record.expiresAt,durationMinutes:record.durationMinutes,remainingMs:record.expiresAt?Math.max(0,new Date(record.expiresAt).getTime()-Date.now()):null,lastUsedAt:record.lastUsedAt,lastAccount:record.lastAccount,lastHwidResetAt:record.lastHwidResetAt||null,hwidResetAvailableAt:record.lastHwidResetAt?new Date(new Date(record.lastHwidResetAt).getTime()+86400000).toISOString():null});
    }catch(err){
        console.error("ZYPHOR KEY VALIDATION ERROR:",err);
        res.status(500).json({success:false,valid:false,error:"server",message:"The key service is unavailable."});
    }
});

app.post("/key-system/inspect",(req,res)=>{
    try{
        const key=normalizeZyphorKey(req.body?.key);
        if(!key) return res.status(400).json({success:false,error:"missing_key",message:"Enter your key."});
        const record=loadZyphorKeys().keys.find(item=>normalizeZyphorKey(item.key)===key);
        if(!record) return res.status(404).json({success:false,error:"invalid_key",message:"That key was not found."});
        const expired=Boolean(record.expiresAt)&&Date.now()>=new Date(record.expiresAt).getTime();
        const resetAt=record.lastHwidResetAt?new Date(new Date(record.lastHwidResetAt).getTime()+86400000).toISOString():null;
        res.json({success:true,valid:!record.disabled&&!expired,disabled:record.disabled===true,expired,hwid:record.hwid||null,hwidHash:record.hwidHash||null,createdAt:record.createdAt,expiresAt:record.expiresAt||null,remainingMs:record.expiresAt?Math.max(0,new Date(record.expiresAt).getTime()-Date.now()):null,durationMinutes:record.durationMinutes,lastUsedAt:record.lastUsedAt||null,lastAccount:record.lastAccount||null,firstUsedAt:record.firstUsedAt||null,lastHwidResetAt:record.lastHwidResetAt||null,hwidResetAvailableAt:resetAt,hwidResetRemainingMs:resetAt?Math.max(0,new Date(resetAt).getTime()-Date.now()):0});
    }catch(err){
        console.error("ZYPHOR KEY INSPECT ERROR:",err);
        res.status(500).json({success:false,error:"server",message:"The key service is unavailable."});
    }
});

app.post("/key-system/reset-hwid",(req,res)=>{
    try{
        const key=normalizeZyphorKey(req.body?.key);
        if(!key) return res.status(400).json({success:false,error:"missing_key",message:"Enter your key."});
        const db=loadZyphorKeys();
        const record=db.keys.find(item=>normalizeZyphorKey(item.key)===key);
        if(!record) return res.status(404).json({success:false,error:"invalid_key",message:"That key was not found."});
        if(record.disabled===true) return res.status(403).json({success:false,error:"disabled",message:"This key has been disabled."});
        if(record.expiresAt&&Date.now()>=new Date(record.expiresAt).getTime()) return res.status(403).json({success:false,error:"expired",message:"This key has expired."});
        const nowMs=Date.now();
        const resetAt=record.lastHwidResetAt?new Date(record.lastHwidResetAt).getTime()+86400000:0;
        if(nowMs<resetAt) return res.status(429).json({success:false,error:"reset_cooldown",message:"HWID reset is available in 24 hours.",hwidResetAvailableAt:new Date(resetAt).toISOString(),hwidResetRemainingMs:resetAt-nowMs});
        const oldHwidHash=record.hwidHash||null;
        record.hwid=null;
        record.hwidHash=null;
        record.lastHwidResetAt=new Date(nowMs).toISOString();
        record.lastHwidResetBy="key-holder";
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"hwid_reset",keyId:record.id,source:"key-holder",oldHwidHash});
        res.json({success:true,message:"HWID reset. The next successful validation will bind this key to the new device.",hwid:null,lastHwidResetAt:record.lastHwidResetAt,hwidResetAvailableAt:new Date(nowMs+86400000).toISOString(),hwidResetRemainingMs:86400000});
    }catch(err){
        console.error("ZYPHOR KEY HWID RESET ERROR:",err);
        res.status(500).json({success:false,error:"server",message:"The key service is unavailable."});
    }
});

app.post("/key-system/admin/keys/:id/reset-hwid",(req,res)=>{
    try{
        const user=zyphorKeyAdmin(req,res);
        if(!user) return;
        const db=loadZyphorKeys();
        const record=db.keys.find(item=>item.id===String(req.params.id||""));
        if(!record) return res.status(404).json({success:false,error:"key_not_found"});
        const oldHwidHash=record.hwidHash||null;
        record.hwid=null;
        record.hwidHash=null;
        record.lastHwidResetAt=new Date().toISOString();
        record.lastHwidResetBy=user.username;
        record.adminChangedAt=record.lastHwidResetAt;
        record.adminChangedBy=user.username;
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"admin_hwid_reset",keyId:record.id,admin:user.username,oldHwidHash});
        res.json({success:true,key:record});
    }catch(err){
        console.error("ZYPHOR KEY ADMIN HWID RESET ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

app.get("/key-system/admin/audit",(req,res)=>{
    try{
        const user=zyphorKeyAdmin(req,res);
        if(!user) return;
        ensureZyphorKeyStorage();
        const data=readJson(ZYPHOR_KEY_SYSTEM_AUDIT,{events:[]});
        res.json({success:true,events:Array.isArray(data.events)?data.events.slice(-1000).reverse():[]});
    }catch(err){
        console.error("ZYPHOR KEY ADMIN AUDIT ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

app.get("/key-system/admin/keys",(req,res)=>{
    try{
        const user=zyphorKeyAdmin(req,res);
        if(!user) return;
        const db=loadZyphorKeys();
        const keys=db.keys.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
        res.json({success:true,keys});
    }catch(err){
        console.error("ZYPHOR KEY ADMIN LIST ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

app.patch("/key-system/admin/keys/:id",(req,res)=>{
    try{
        const user=zyphorKeyAdmin(req,res);
        if(!user) return;
        const db=loadZyphorKeys();
        const record=db.keys.find(item=>item.id===String(req.params.id||""));
        if(!record) return res.status(404).json({success:false,error:"key_not_found"});
        const changes={};
        if(Object.prototype.hasOwnProperty.call(req.body||{},"disabled")){
            if(typeof req.body.disabled!=="boolean") return res.status(400).json({success:false,error:"invalid_disabled_value"});
            record.disabled=req.body.disabled;
            changes.disabled=record.disabled;
        }
        if(Object.prototype.hasOwnProperty.call(req.body||{},"durationMinutes")){
            const durationMinutes=Number(req.body.durationMinutes);
            if(!Number.isInteger(durationMinutes)||durationMinutes<0||durationMinutes>ZYPHOR_KEY_MAX_MINUTES){
                return res.status(400).json({success:false,error:"invalid_duration",message:`Duration must be 0 to ${ZYPHOR_KEY_MAX_MINUTES} minutes. Use 0 for no expiry.`});
            }
            record.durationMinutes=durationMinutes;
            record.expiresAt=durationMinutes===0?null:new Date(Date.now()+durationMinutes*60000).toISOString();
            changes.durationMinutes=durationMinutes;
            changes.expiresAt=record.expiresAt;
        }
        if(!Object.keys(changes).length) return res.status(400).json({success:false,error:"no_changes"});
        record.adminChangedAt=new Date().toISOString();
        record.adminChangedBy=user.username;
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"updated",keyId:record.id,admin:user.username,changes});
        res.json({success:true,key:record});
    }catch(err){
        console.error("ZYPHOR KEY ADMIN UPDATE ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

app.delete("/key-system/admin/keys/:id",(req,res)=>{
    try{
        const user=zyphorKeyAdmin(req,res);
        if(!user) return;
        const db=loadZyphorKeys();
        const index=db.keys.findIndex(item=>item.id===String(req.params.id||""));
        if(index<0) return res.status(404).json({success:false,error:"key_not_found"});
        const [record]=db.keys.splice(index,1);
        saveZyphorKeys(db);
        addZyphorKeyAudit({action:"deleted",keyId:record.id,createdBy:record.createdBy,admin:user.username,lastAccount:record.lastAccount,hwidHash:record.hwidHash});
        res.json({success:true,deleted:true,id:record.id});
    }catch(err){
        console.error("ZYPHOR KEY ADMIN DELETE ERROR:",err);
        res.status(500).json({success:false,error:"server"});
    }
});

const FREE_ROBUX_VOTES_PATH = path.join(__dirname, "FreeRobuxVotes.json");

function loadFreeRobuxVotes() {
    const data = readJson(FREE_ROBUX_VOTES_PATH, { votes: {} });
    if (!data || typeof data !== "object" || !data.votes || typeof data.votes !== "object" || Array.isArray(data.votes)) {
        return { votes: {} };
    }
    return data;
}

function getFreeRobuxVoteCounts(data) {
    const votes = Object.values(data.votes);
    return {
        yes: votes.filter(vote => vote.choice === "yes").length,
        no: votes.filter(vote => vote.choice === "no").length,
        total: votes.length
    };
}

app.get("/freerobux/votes", (req, res) => {
    try {
        const data = loadFreeRobuxVotes();
        const votes = Object.values(data.votes)
            .map(vote => ({
                username: String(vote.username || "Unknown account"),
                choice: vote.choice === "no" ? "no" : "yes",
                reason: String(vote.reason || ""),
                createdAt: vote.createdAt || null
            }))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return res.json({ success: true, ...getFreeRobuxVoteCounts(data), votes });
    } catch (err) {
        console.error("FREE ROBUX VOTE RESULTS ERROR:", err);
        return res.status(500).json({ success: false, error: "server" });
    }
});

app.get("/freerobux/my-vote", (req, res) => {
    const user = auth(req);
    if (!user) return res.status(401).json({ success: false, error: "unauthorized" });

    const data = loadFreeRobuxVotes();
    const vote = data.votes[String(user.username).toLowerCase()];
    return res.json({ success: true, voted: !!vote, choice: vote?.choice || null });
});

app.post("/freerobux/vote", (req, res) => {
    try {
        const user = auth(req);
        if (!user) return res.status(401).json({ success: false, error: "unauthorized" });

        const choice = String(req.body?.vote || "").trim().toLowerCase();
        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

        if (!["yes", "no"].includes(choice)) {
            return res.status(400).json({ success: false, error: "invalid_vote" });
        }
        if (reason.length < 10) {
            return res.status(400).json({ success: false, error: "invalid_reason" });
        }
        if (reason.length > 1000) {
            return res.status(400).json({ success: false, error: "reason_too_long" });
        }

        const data = loadFreeRobuxVotes();
        const accountKey = String(user.username).toLowerCase();

        if (data.votes[accountKey]) {
            return res.status(409).json({ success: false, error: "already_voted" });
        }

        data.votes[accountKey] = {
            username: user.username,
            choice,
            reason,
            createdAt: new Date().toISOString()
        };

        writeJson(FREE_ROBUX_VOTES_PATH, data);
        logAction("free_robux_vote", { username: user.username, choice });
        return res.json({ success: true, ...getFreeRobuxVoteCounts(data) });
    } catch (err) {
        console.error("FREE ROBUX VOTE SUBMISSION ERROR:", err);
        return res.status(500).json({ success: false, error: "server" });
    }
});

function installCommunityForum() {
  const { DatabaseSync } = require('node:sqlite')
  const userRoot = USER_ROOT
  const root = path.join(__dirname, 'ForumData')
  const mediaRoot = path.join(root, 'Media')
  fs.mkdirSync(mediaRoot, { recursive: true })
  const db = new DatabaseSync(path.join(root, 'Forum.sqlite'), { timeout: 3000 })
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-4096; PRAGMA journal_size_limit=4194304; PRAGMA busy_timeout=3000;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, author_key TEXT NOT NULL, author TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]', category TEXT NOT NULL DEFAULT 'discussion', status TEXT NOT NULL DEFAULT 'published',
      reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL, score INTEGER NOT NULL DEFAULT 0, reply_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0,
      edited_by TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS posts_new_idx ON posts(status,pinned,created_at DESC);
    CREATE INDEX IF NOT EXISTS posts_active_idx ON posts(status,last_activity DESC);
    CREATE INDEX IF NOT EXISTS posts_score_idx ON posts(status,score DESC,created_at DESC);
    CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_key,status,created_at DESC);
    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), parent_id TEXT REFERENCES replies(id),
      author_key TEXT NOT NULL, author TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published',
      reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      child_count INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, edited_by TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS replies_tree_idx ON replies(post_id,parent_id,created_at);
    CREATE INDEX IF NOT EXISTS replies_author_idx ON replies(author_key,created_at DESC);
    CREATE TABLE IF NOT EXISTS votes (user_key TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(user_key,target_type,target_id));
    CREATE INDEX IF NOT EXISTS votes_target_idx ON votes(target_type,target_id);
    CREATE TABLE IF NOT EXISTS saves (user_key TEXT NOT NULL,post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(user_key,post_id));
    CREATE TABLE IF NOT EXISTS follows (follower_key TEXT NOT NULL,following_key TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(follower_key,following_key));
    CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_key);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES posts(id),owner_key TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS media_post_idx ON media(post_id);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,recipient_key TEXT NOT NULL,actor TEXT NOT NULL,kind TEXT NOT NULL,post_id TEXT,reply_id TEXT,body TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS events_recipient_idx ON events(recipient_key,created_at DESC);
    CREATE TABLE IF NOT EXISTS notification_state (user_key TEXT PRIMARY KEY,seen_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS notification_reads (user_key TEXT NOT NULL,notification_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_key,notification_id));
    CREATE TABLE IF NOT EXISTS moderation_log (id TEXT PRIMARY KEY,admin TEXT NOT NULL,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS moderation_idx ON moderation_log(created_at DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_search USING fts5(title,content,tags,content='posts',content_rowid='rowid',tokenize='unicode61');
    CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN INSERT INTO posts_search(rowid,title,content,tags) VALUES (new.rowid,new.title,new.content,new.tags); END;
    CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN INSERT INTO posts_search(posts_search,rowid,title,content,tags) VALUES('delete',old.rowid,old.title,old.content,old.tags); END;
    CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE OF title,content,tags ON posts BEGIN
      INSERT INTO posts_search(posts_search,rowid,title,content,tags) VALUES('delete',old.rowid,old.title,old.content,old.tags);
      INSERT INTO posts_search(rowid,title,content,tags) VALUES(new.rowid,new.title,new.content,new.tags);
    END;
  `)
  const stats = Object.create(null)
  const statement = sql => stats[sql] || (stats[sql] = db.prepare(sql))
  const all = (sql, ...params) => statement(sql).all(...params)
  const one = (sql, ...params) => statement(sql).get(...params)
  const run = (sql, ...params) => statement(sql).run(...params)
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE')
    try { const value = fn(); db.exec('COMMIT'); return value }
    catch (error) { db.exec('ROLLBACK'); throw error }
  }
  const now = () => Date.now()
  const id = () => crypto.randomBytes(12).toString('hex')
  const key = value => String(value || '').trim().toLowerCase()
  const clean = (value, max) => String(value || '').trim().slice(0, max)
  const username = req => auth(req)?.username || ''
  const me = req => { const user = auth(req); return user && safeUsername(user.username) ? user : null }
  const admin = user => !!user && hasAdmin(user)
  const error = (res, code, value) => res.status(code).json({ success: false, error: value })
  const requireUser = (req, res) => { const user = me(req); if (!user) {error(res, 401, 'unauthorized');return null} if (user.banned) {error(res, 403, 'account_banned');return null} return user }
  const validCategory = value => ['discussion', 'question', 'guide', 'news', 'showcase', 'feedback'].includes(value) ? value : 'discussion'
  const maxPage = value => Math.max(1, Math.min(40, Math.floor(Number(value) || 20)))
  const page = value => Math.max(0, Math.min(10000, Math.floor(Number(value) || 0)))
  const normalizeTags = value => {
    const input = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/)
    return [...new Set(input.map(x => String(x).toLowerCase().replace(/^#+/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 28)).filter(x => x.length >= 2))].slice(0, 6)
  }
  const readTags = value => { try { return JSON.parse(value || '[]') } catch { return [] } }
  const followCount = who => {
    const count = one('SELECT COUNT(*) AS count FROM follows WHERE following_key=?', key(who)).count
    return Number(count) + (key(who) === 'somin' ? Math.max(0, countAccounts() - 1) : 0)
  }
  let userCount = 0
  let userCountTime = 0
  function countAccounts() {
    if (now() - userCountTime < 300000) return userCount
    try { userCount = fs.readdirSync(userRoot, { withFileTypes: true }).filter(x => x.isDirectory() && x.name.toLowerCase() !== 'somin').length + 1 }
    catch { userCount = 1 }
    userCountTime = now()
    return userCount
  }
  function findUser(name) {
    const requested = safeUsername(name)
    if (!requested) return null
    try {
      const direct = path.join(userRoot, requested, 'UserData.json')
      if (fs.existsSync(direct)) { const item = JSON.parse(fs.readFileSync(direct,'utf8')); return item.username || requested }
      const match = fs.readdirSync(userRoot).find(x => x.toLowerCase() === requested.toLowerCase())
      if (match && fs.existsSync(path.join(userRoot,match,'UserData.json'))) return match
    } catch {}
    return null
  }
  function mediaFor(postId) {
    return all('SELECT id,mime,bytes FROM media WHERE post_id=? ORDER BY created_at', postId).map(x => ({ id: x.id, url: '/api/forum/media/' + x.id, mime: x.mime, bytes: x.bytes }))
  }
  const isFollowing = (viewer, who) => !!viewer && (key(who) === 'somin' || !!one('SELECT 1 FROM follows WHERE follower_key=? AND following_key=?', key(viewer), key(who)))
  function formatPost(p, viewer, includeContent = true) {
    if (!p) return null
    const person = key(viewer)
    const output = { id:p.id, author:p.author, title:p.title, tags:readTags(p.tags), category:p.category, status:p.status, createdAt:p.created_at, updatedAt:p.updated_at, lastActivity:p.last_activity, score:p.score, replies:p.reply_count, views:p.view_count, pinned:!!p.pinned, locked:!!p.locked, editedBy:p.edited_by || null, reason: p.status === 'review' ? p.reason : '', following:isFollowing(viewer,p.author), mine:person === p.author_key, vote:person ? (one('SELECT value FROM votes WHERE user_key=? AND target_type=? AND target_id=?',person,'post',p.id)?.value || 0) : 0, saved: person ? !!one('SELECT 1 FROM saves WHERE user_key=? AND post_id=?', person,p.id) : false }
    if (includeContent) { output.content = p.content; output.images = mediaFor(p.id) }
    return output
  }
  function formatReply(r, viewer) {
    const person = key(viewer)
    return { id:r.id,postId:r.post_id,parentId:r.parent_id,author:r.author,content:r.status === 'deleted' ? '' : r.content,status:r.status,reason:r.reason,createdAt:r.created_at,updatedAt:r.updated_at,children:r.child_count,score:r.score,editedBy:r.edited_by || null,mine:person === r.author_key,vote:person ? (one('SELECT value FROM votes WHERE user_key=? AND target_type=? AND target_id=?',person,'reply',r.id)?.value || 0) : 0 }
  }
  const visible = (row,user) => row && (row.status === 'published' || (user && (admin(user) || key(user.username) === row.author_key)))
  const isValidImage = bytes => {
    if (bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) return { mime:'image/png',ext:'png' }
    if (bytes.length >= 3 && bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))) return { mime:'image/jpeg',ext:'jpg' }
    if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return { mime:'image/webp',ext:'webp' }
    if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) return { mime:'image/gif',ext:'gif' }
    return null
  }
  const upload = multer({ storage:multer.diskStorage({ destination: (req,file,cb)=>cb(null,mediaRoot), filename:(req,file,cb)=>cb(null,'upload-' + id()) }), limits:{files:4,fileSize:5*1024*1024,fields:12,fieldSize:12000},fileFilter:(req,file,cb)=>['image/png','image/jpeg','image/webp','image/gif'].includes(file.mimetype)?cb(null,true):cb(new Error('unsupported_image')) }).array('images',4)
  function receiveImages(req,res,next) { upload(req,res,err => { if (err) { for (const f of req.files || []) fs.rmSync(f.path,{force:true}); return error(res,400,'invalid_image_upload') } next() }) }
  function discard(files) { for (const f of files || []) try { fs.rmSync(f.path,{force:true}) } catch {} }
  function storeMedia(files,postId,owner) {
    for (const file of files || []) {
      const header = Buffer.alloc(16)
      const fd = fs.openSync(file.path,'r')
      try { fs.readSync(fd,header,0,16,0) } finally { fs.closeSync(fd) }
      const format = isValidImage(header)
      if (!format) throw new Error('unsupported_image')
      const mid = id()
      fs.renameSync(file.path,path.join(mediaRoot,mid))
      run('INSERT INTO media(id,post_id,owner_key,mime,bytes,created_at) VALUES(?,?,?,?,?,?)',mid,postId,key(owner),format.mime,file.size,now())
    }
  }
  const record = (administrator,action,type,target,reason) => {
    run('INSERT INTO moderation_log VALUES(?,?,?,?,?,?,?)',id(),administrator,action,type,target,reason,now())
    try { logAction('forum_moderation',{administrator,action,type,target,reason}) } catch {}
  }
  function notify(to, from, kind,postId,replyId,body) {
    if (!to || key(to) === key(from)) return
    run('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)',id(),key(to),from,kind,postId || null,replyId || null,clean(body,200),now())
  }
  function route(fn) { return (req,res,next) => { try { const result = fn(req,res); if (result && typeof result.then === 'function') result.catch(next) } catch (e) { next(e) } } }
  app.get('/community', (req,res)=>res.redirect(302,'/forum.html'))
  app.get('/community/forum', (req,res)=>res.redirect(302,'/forum.html'))
  app.get('/api/forum/bootstrap',route((req,res)=>{
    const user=me(req)
    const categories=['discussion','question','guide','news','showcase','feedback']
    const total = one("SELECT COUNT(*) AS count FROM posts WHERE status='published'").count
    const replies = one("SELECT COUNT(*) AS count FROM replies WHERE status='published'").count
    const members = countAccounts()
    const trendingTags = all("SELECT tags FROM posts WHERE status='published' ORDER BY created_at DESC LIMIT 250").flatMap(x=>readTags(x.tags)).reduce((a,t)=>(a[t]=(a[t]||0)+1,a),{})
    return res.json({success:true,me:user ? {username:user.username,admin:admin(user)} : null,stats:{posts:total,replies,members},categories,tags:Object.entries(trendingTags).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([tag,count])=>({tag,count})),featured:{username:'Somin',followers:followCount('Somin'),following:!!user}})
  }))
  app.get('/api/forum/posts',route((req,res)=>{
    const user=me(req), sort=String(req.query.sort||'trending'), limit=maxPage(req.query.limit), offset=page(req.query.page)*limit
    const where=["p.status='published'"]
    const params=[]
    if (req.query.category && req.query.category !== 'all') { where.push('p.category=?');params.push(validCategory(req.query.category)) }
    if (req.query.tag) { const tag=normalizeTags([req.query.tag])[0]; if (!tag) return error(res,400,'invalid_tag');where.push("EXISTS (SELECT 1 FROM json_each(p.tags) WHERE json_each.value=?)");params.push(tag) }
    if (req.query.author) { where.push('p.author_key=?');params.push(key(req.query.author)) }
    if (sort === 'unanswered') where.push('p.reply_count=0')
    if (sort === 'following') { if (!user) return error(res,401,'unauthorized');where.push("(p.author_key='somin' OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_key=? AND f.following_key=p.author_key))");params.push(key(user.username)) }
    if (sort === 'saved') { if (!user) return error(res,401,'unauthorized');where.push('EXISTS (SELECT 1 FROM saves s WHERE s.post_id=p.id AND s.user_key=?)');params.push(key(user.username)) }
    if (sort === 'topweek') { where.push('p.created_at>=?');params.push(now()-7*86400000) }
    let searchJoin=''
    const q = clean(req.query.q,100)
    if (q) {
      const terms=q.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu)?.slice(0,8) || []
      if (!terms.length) return res.json({success:true,posts:[],hasMore:false})
      searchJoin=' JOIN posts_search ON posts_search.rowid=p.rowid '
      where.push('posts_search MATCH ?');params.push(terms.map(x=>'"'+x.replace(/"/g,'')+'"*').join(' AND '))
    }
    const order = { latest:'p.created_at DESC', active:'p.last_activity DESC', top:'p.score DESC,p.created_at DESC', topweek:'p.score DESC,p.created_at DESC', unanswered:'p.created_at DESC', following:'p.created_at DESC', saved:'p.created_at DESC', trending:'(p.score*5 + p.reply_count*2 + MIN(p.view_count,200)/10.0)/(1.0+(? - p.created_at)/21600000.0) DESC,p.created_at DESC' }
    const sorting=q ? 'bm25(posts_search),p.created_at DESC' : (order[sort] || order.trending)
    const orderParams=!q && !order[sort] || (!q && sort==='trending') ? [now()] : []
    const rows = all('SELECT p.* FROM posts p '+searchJoin+' WHERE '+where.join(' AND ')+' ORDER BY p.pinned DESC,'+sorting+',p.id DESC LIMIT ? OFFSET ?',...params,...orderParams,limit+1,offset)
    res.json({success:true,posts:rows.slice(0,limit).map(p=>formatPost(p,user?.username)),hasMore:rows.length>limit,page:page(req.query.page)})
  }))
  app.get('/api/forum/posts/:id',route((req,res)=>{
    const user=me(req), p=one('SELECT * FROM posts WHERE id=?',req.params.id)
    if (!visible(p,user)) return error(res,404,'post_not_found')
    if (p.status==='published') run('UPDATE posts SET view_count=view_count+1 WHERE id=?',p.id)
    const result=formatPost({...p,view_count:p.view_count+1},user?.username)
    res.json({success:true,post:result})
  }))
  app.post('/api/forum/posts',receiveImages,route((req,res)=>{
    const files=req.files || [],user=requireUser(req,res)
    if (!user) { discard(files);return }
    const title=clean(req.body.title,140),content=clean(req.body.content,12000)
    if (title.length < 5 || content.length < 3) { discard(files);return error(res,400,'title_or_content_too_short') }
    const tags=normalizeTags(req.body.tags),at=now(),postId=id()
    try {
      transaction(()=>{
        run('INSERT INTO posts(id,author_key,author,title,content,tags,category,created_at,updated_at,last_activity) VALUES(?,?,?,?,?,?,?,?,?,?)',postId,key(user.username),user.username,title,content,JSON.stringify(tags),validCategory(req.body.category),at,at,at)
        storeMedia(files,postId,user.username)
      })
    } catch(e) {discard(files); for(const media of all('SELECT id FROM media WHERE post_id=?',postId)) fs.rmSync(path.join(mediaRoot,media.id),{force:true}); throw e }
    res.status(201).json({success:true,postId})
  }))
  app.patch('/api/forum/posts/:id',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const p=one('SELECT * FROM posts WHERE id=?',req.params.id)
    if (!p || p.status==='deleted') return error(res,404,'post_not_found')
    if (!admin(user) && p.author_key!==key(user.username)) return error(res,403,'forbidden')
    const title=clean(req.body.title ?? p.title,140),content=clean(req.body.content ?? p.content,12000)
    if(title.length<5 || content.length<3)return error(res,400,'invalid_content')
    const tags=req.body.tags===undefined ? p.tags : JSON.stringify(normalizeTags(req.body.tags))
    run('UPDATE posts SET title=?,content=?,tags=?,category=?,updated_at=?,edited_by=? WHERE id=?',title,content,tags,validCategory(req.body.category ?? p.category),now(),user.username,p.id)
    res.json({success:true})
  }))
  app.get('/api/forum/posts/:id/replies',route((req,res)=>{
    const user=me(req),p=one('SELECT * FROM posts WHERE id=?',req.params.id)
    if(!visible(p,user))return error(res,404,'post_not_found')
    const parent=req.query.parent && req.query.parent !== 'root' ? String(req.query.parent) : null
    const limit=maxPage(req.query.limit),offset=page(req.query.page)*limit
    const rows=all('SELECT * FROM replies WHERE post_id=? AND parent_id IS ? AND (status IN (\'published\',\'deleted\') OR (?=1 AND status=\'review\')) ORDER BY created_at ASC LIMIT ? OFFSET ?',p.id,parent,admin(user)?1:0,limit+1,offset)
    res.json({success:true,replies:rows.slice(0,limit).map(r=>formatReply(r,user?.username)),hasMore:rows.length>limit})
  }))
  app.post('/api/forum/posts/:id/replies',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const p=one('SELECT * FROM posts WHERE id=?',req.params.id)
    if(!p || p.status!=='published')return error(res,404,'post_not_found')
    if(p.locked && !admin(user))return error(res,423,'post_locked')
    const content=clean(req.body.content,5000)
    if(content.length<1)return error(res,400,'empty_reply')
    const parent=req.body.parentId ? one('SELECT * FROM replies WHERE id=? AND post_id=?',String(req.body.parentId),p.id) : null
    if(req.body.parentId && (!parent || parent.status!=='published'))return error(res,400,'invalid_parent')
    const rid=id(),at=now()
    transaction(()=>{
      run('INSERT INTO replies(id,post_id,parent_id,author_key,author,content,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',rid,p.id,parent?.id||null,key(user.username),user.username,content,at,at)
      run('UPDATE posts SET reply_count=reply_count+1,last_activity=? WHERE id=?',at,p.id)
      if(parent)run('UPDATE replies SET child_count=child_count+1 WHERE id=?',parent.id)
      notify(parent?.author || p.author,user.username,'reply',p.id,rid,content.slice(0,130))
    })
    res.status(201).json({success:true,replyId:rid})
  }))
  app.patch('/api/forum/replies/:id',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const r=one('SELECT * FROM replies WHERE id=?',req.params.id)
    if(!r || (r.status!=='published' && !(admin(user) && r.status==='review')))return error(res,404,'reply_not_found')
    if(!admin(user) && key(user.username)!==r.author_key)return error(res,403,'forbidden')
    const content=clean(req.body.content,5000)
    if(!content)return error(res,400,'empty_reply')
    run('UPDATE replies SET content=?,updated_at=?,edited_by=? WHERE id=?',content,now(),user.username,r.id)
    res.json({success:true})
  }))
  app.post('/api/forum/vote',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const type=req.body.type==='reply'?'reply':'post',identifier=String(req.body.id||''),value=Number(req.body.value)
    if(![-1,0,1].includes(value))return error(res,400,'invalid_vote')
    const table=type==='post'?'posts':'replies',target=one('SELECT status FROM '+table+' WHERE id=?',identifier)
    if(!target || target.status!=='published')return error(res,404,'not_found')
    const previous=one('SELECT value FROM votes WHERE user_key=? AND target_type=? AND target_id=?',key(user.username),type,identifier)?.value||0
    transaction(()=>{
      if(value===0)run('DELETE FROM votes WHERE user_key=? AND target_type=? AND target_id=?',key(user.username),type,identifier)
      else run('INSERT INTO votes(user_key,target_type,target_id,value) VALUES(?,?,?,?) ON CONFLICT(user_key,target_type,target_id) DO UPDATE SET value=excluded.value',key(user.username),type,identifier,value)
      run('UPDATE '+table+' SET score=score+? WHERE id=?',value-previous,identifier)
    })
    res.json({success:true,vote:value,score:one('SELECT score FROM '+table+' WHERE id=?',identifier).score})
  }))
  app.post('/api/forum/posts/:id/save',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    if(!one("SELECT 1 FROM posts WHERE id=? AND status='published'",req.params.id))return error(res,404,'post_not_found')
    const exists=one('SELECT 1 FROM saves WHERE user_key=? AND post_id=?',key(user.username),req.params.id)
    if(exists)run('DELETE FROM saves WHERE user_key=? AND post_id=?',key(user.username),req.params.id)
    else run('INSERT INTO saves VALUES(?,?,?)',key(user.username),req.params.id,now())
    res.json({success:true,saved:!exists})
  }))
  app.get('/api/forum/users/:username',route((req,res)=>{
    const who=findUser(req.params.username)
    if(!who)return error(res,404,'user_not_found')
    const viewer=me(req)?.username
    const posts=one("SELECT COUNT(*) AS n FROM posts WHERE author_key=? AND status='published'",key(who)).n
    const replies=one("SELECT COUNT(*) AS n FROM replies WHERE author_key=? AND status='published'",key(who)).n
    res.json({success:true,user:{username:who,followers:followCount(who),following:one('SELECT COUNT(*) AS n FROM follows WHERE follower_key=?',key(who)).n+(key(who)==='somin'?0:1),posts,replies,followed:isFollowing(viewer,who),canUnfollow:key(who)!=='somin'}})
  }))
  app.post('/api/forum/users/:username/follow',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const who=findUser(req.params.username)
    if(!who)return error(res,404,'user_not_found')
    if(key(who)===key(user.username))return error(res,400,'cannot_follow_self')
    if(key(who)==='somin')return res.json({success:true,following:true,locked:true,followers:followCount(who)})
    run('INSERT OR IGNORE INTO follows VALUES(?,?,?)',key(user.username),key(who),now())
    res.json({success:true,following:true,followers:followCount(who)})
  }))
  app.delete('/api/forum/users/:username/follow',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    if(key(req.params.username)==='somin')return error(res,403,'cannot_unfollow_somin')
    run('DELETE FROM follows WHERE follower_key=? AND following_key=?',key(user.username),key(req.params.username))
    res.json({success:true,following:false,followers:followCount(req.params.username)})
  }))
  app.get('/api/forum/notifications',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    const person=key(user.username),since=now()-30*86400000,seen=one('SELECT seen_at FROM notification_state WHERE user_key=?',person)?.seen_at||0
    const events=all('SELECT * FROM events WHERE recipient_key=? AND created_at>=? ORDER BY created_at DESC LIMIT 50',person,since)
      .map(e=>({id:'e:'+e.id,kind:e.kind,actor:e.actor,postId:e.post_id,replyId:e.reply_id,body:e.body,createdAt:e.created_at}))
    const follows=all(`SELECT p.id,p.author,p.title,p.created_at FROM posts p WHERE p.status='published' AND p.created_at>=? AND p.author_key<>? AND (p.author_key='somin' OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_key=? AND f.following_key=p.author_key AND f.created_at<=p.created_at)) ORDER BY p.created_at DESC LIMIT 50`,since,person,person)
      .map(p=>({id:'p:'+p.id,kind:'follow_post',actor:p.author,postId:p.id,replyId:null,body:p.title,createdAt:p.created_at}))
    const merged=[...events,...follows].sort((a,b)=>b.createdAt-a.createdAt).slice(0,60)
    const readIds=new Set(merged.length ? all('SELECT notification_id FROM notification_reads WHERE user_key=? AND notification_id IN ('+merged.map(()=>'?').join(',')+')',person,...merged.map(n=>n.id)).map(x=>x.notification_id) : [])
    const notifications=merged.map(n=>({...n,seen:n.createdAt<=seen||readIds.has(n.id)}))
    res.json({success:true,notifications,unread:notifications.filter(x=>!x.seen).length})
  }))
  app.post('/api/forum/notifications/read',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    if(req.body.all){run('INSERT INTO notification_state(user_key,seen_at) VALUES(?,?) ON CONFLICT(user_key) DO UPDATE SET seen_at=excluded.seen_at',key(user.username),now())}
    else { const nid=clean(req.body.id,70);if(!/^[pe]:[a-f0-9]{24}$/.test(nid))return error(res,400,'invalid_notification');run('INSERT OR IGNORE INTO notification_reads VALUES(?,?,?)',key(user.username),nid,now()) }
    res.json({success:true})
  }))
  const mediaRequests=new Map()
  setInterval(()=>{const cutoff=now()-30000;for(const [ip,item] of mediaRequests)if(item.at<cutoff)mediaRequests.delete(ip)},30000).unref()
  app.get('/api/forum/media/:id',route((req,res)=>{
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0]
    const stamp=now(),bucket=mediaRequests.get(ip)
    if(bucket&&stamp-bucket.at<1000){if(bucket.count>=50)return res.status(429).end();bucket.count++}
    else mediaRequests.set(ip,{at:stamp,count:1})
    const file=one('SELECT m.*,p.status,p.author_key FROM media m JOIN posts p ON p.id=m.post_id WHERE m.id=?',req.params.id)
    if(!file)return res.status(404).end()
    const user=me(req)
    if(file.status!=='published' && !(user && (admin(user)||key(user.username)===file.author_key)))return res.status(404).end()
    const filePath=path.join(mediaRoot,file.id)
    if(!fs.existsSync(filePath))return res.status(404).end()
    res.setHeader('Content-Type',file.mime)
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Cache-Control','private, max-age=300')
    res.sendFile(filePath)
  }))
  app.get('/api/forum/admin/queue',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    if(!admin(user))return error(res,403,'forbidden')
    const rows=all("SELECT * FROM posts WHERE status='review' ORDER BY updated_at DESC LIMIT 100")
    const replies=all("SELECT id,post_id,author,content,reason,updated_at FROM replies WHERE status='review' ORDER BY updated_at DESC LIMIT 100")
    res.json({success:true,posts:rows.map(p=>formatPost(p,user.username)),replies,history:all('SELECT * FROM moderation_log ORDER BY created_at DESC LIMIT 40')})
  }))
  app.post('/api/forum/admin/moderate',route((req,res)=>{
    const user=requireUser(req,res);if(!user)return
    if(!admin(user))return error(res,403,'forbidden')
    const type=req.body.type==='reply'?'reply':'post',target=clean(req.body.id,50),action=clean(req.body.action,30),reason=clean(req.body.reason,500)
    const table=type==='post'?'posts':'replies',row=one('SELECT * FROM '+table+' WHERE id=?',target)
    if(!row)return error(res,404,'not_found')
    if(type==='post' && !['review','restore','delete','pin','unpin','lock','unlock'].includes(action))return error(res,400,'invalid_action')
    if(type==='reply' && !['review','restore','delete'].includes(action))return error(res,400,'invalid_action')
    if(row.status==='deleted' && action!=='delete')return error(res,409,'already_deleted')
    transaction(()=>{
      if(type==='reply' && row.status!=='deleted' && ['review','restore'].includes(action) && (row.status==='published') !== (action==='restore')) {
        run('UPDATE posts SET reply_count=MAX(0,reply_count+?) WHERE id=?',action==='restore'?1:-1,row.post_id)
        if(row.parent_id)run('UPDATE replies SET child_count=MAX(0,child_count+?) WHERE id=?',action==='restore'?1:-1,row.parent_id)
      }
      if(action==='review')run('UPDATE '+table+" SET status='review',reason=?,updated_at=? WHERE id=?",reason,now(),target)
      if(action==='restore')run('UPDATE '+table+" SET status='published',reason='',updated_at=? WHERE id=?",now(),target)
      if(action==='delete'){
        if(type==='reply'){
          if(row.status==='published') { run('UPDATE posts SET reply_count=MAX(0,reply_count-1) WHERE id=?',row.post_id);if(row.parent_id)run('UPDATE replies SET child_count=MAX(0,child_count-1) WHERE id=?',row.parent_id) }
          run("UPDATE replies SET content='',status='deleted',updated_at=?,reason=? WHERE id=?",now(),reason,target)
        } else {
          run("UPDATE posts SET title='[Deleted]',content='',tags='[]',status='deleted',updated_at=?,reason=? WHERE id=?",now(),reason,target)
          for(const m of all('SELECT id FROM media WHERE post_id=?',target)) fs.rmSync(path.join(mediaRoot,m.id),{force:true})
          run('DELETE FROM media WHERE post_id=?',target)
          run("DELETE FROM votes WHERE (target_type='post' AND target_id=?) OR (target_type='reply' AND target_id IN (SELECT id FROM replies WHERE post_id=?))",target,target)
          run('DELETE FROM events WHERE post_id=?',target)
          run('DELETE FROM saves WHERE post_id=?',target)
          run('DELETE FROM replies WHERE post_id=?',target)
        }
      }
      if(['pin','unpin'].includes(action))run('UPDATE posts SET pinned=? WHERE id=?',action==='pin'?1:0,target)
      if(['lock','unlock'].includes(action))run('UPDATE posts SET locked=? WHERE id=?',action==='lock'?1:0,target)
      record(user.username,action,type,target,reason)
      if(['review','restore','delete'].includes(action))notify(row.author,user.username,'moderation',type==='post'?target:row.post_id,type==='reply'?target:null,'Your '+type+' was '+(action==='review'?'placed under review':action==='restore'?'restored':'deleted')+'. '+reason)
    })
    res.json({success:true})
  }))
  app.use('/api/forum',(err,req,res,next)=>{
    if(res.headersSent)return next(err)
    console.error('FORUM ERROR',err)
    res.status(500).json({success:false,error:'forum_server_error'})
  })
  const cleanup=()=>{
    try {
      const cutoff=now()-60*86400000
      run('DELETE FROM notification_reads WHERE created_at<?',cutoff)
      run('DELETE FROM events WHERE created_at<?',cutoff)
      run('DELETE FROM moderation_log WHERE created_at<?',now()-180*86400000)
      const existing=new Set(all('SELECT id FROM media').map(x=>x.id))
      let removed=0
      for(const item of fs.readdirSync(mediaRoot)) {
        if(removed>=100)break
        const file=path.join(mediaRoot,item)
        if(!existing.has(item) && fs.statSync(file).mtimeMs<now()-86400000){fs.rmSync(file,{force:true});removed++}
      }
    } catch(e) {console.error('FORUM CLEANUP',e.message)}
  }
  setTimeout(cleanup,5000).unref()
  setInterval(cleanup,6*3600000).unref()
  console.log('Community forum ready (SQLite WAL)')
}

installCommunityForum()

app.listen(PORT,"0.0.0.0",()=>{

console.log("Server running on port",PORT)

startTunnel()

})