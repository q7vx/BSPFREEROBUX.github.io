import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const fail = message => errors.push(message);
const text = name => fs.readFileSync(path.join(root, name), "utf8");
const exists = name => fs.existsSync(path.join(root, name));
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(item => {
  if (item.name === ".git" || item.name === "node_modules") return [];
  const full = path.join(folder, item.name);
  return item.isDirectory() ? walk(full) : full.toLowerCase().endsWith(".html") ? [full] : [];
});
const htmlFiles = walk(root);
const adRuntime = /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js|<ins\b[^>]*\badsbygoogle\b|\(\s*adsbygoogle\s*=\s*window\.adsbygoogle/i;
const publicPages = ["index.html", "about.html", "guides.html", "help.html", "community.html", "downloads-guide.html", "privacy-ads.html", "download.html", "PP.html", "TOS.html"];
const privatePages = ["0DMS.html", "1dms.html", "Encrypted.html", "0Support.html", "1Support.html", "0dashboard.html", "1dashboard.html", "dashboard.html", "0profile.html", "1profile.html", "login.html", "signup.html", "2fa.html", "forgot-password.html", "password-reset.html", "settings.html", "trade.html", "Wallet.html", "cloud.html", "collection.html", "megahack.html", "halloween.html", "SquirtleEvent.html"];
const noIndex = /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)[^>]*>/i;
const markupWords = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&[a-z0-9#]+;/gi," ").trim().split(/\s+/).filter(Boolean).length;

for (const file of htmlFiles) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const source = fs.readFileSync(file,"utf8");
  if (adRuntime.test(source)) fail("AdSense runtime is not authorized before publisher and CMP review: " + rel);
  if (/ca-pub-\d+/i.test(source) && !["index.html","about.html"].includes(rel)) fail("Unexpected publisher identifier outside verification pages: " + rel);
}
for (const p of publicPages) {
  if (!exists(p)) { fail("Required public page is missing: " + p); continue; }
  const page = text(p);
  if (noIndex.test(page)) fail("Public page accidentally excluded from search: " + p);
  if (!/<title>[\s\S]+?<\/title>/i.test(page)) fail("Public page has no title: " + p);
}
for (const p of ["index.html","about.html","guides.html","help.html","community.html","downloads-guide.html","privacy-ads.html"]) {
  if (exists(p) && markupWords(text(p)) < 350) fail("Public page needs substantive original text: " + p);
}
for (const p of privatePages) {
  if (exists(p) && !noIndex.test(text(p))) fail("Private or interactive page missing noindex: " + p);
}
for (const code of [401,403,404,429,500,502,503,504]) {
  const p = code + ".html";
  if (!exists(p) || !noIndex.test(text(p))) fail("Error page missing noindex: " + p);
}
if (!/<meta name="google-adsense-account" content="ca-pub-5179004241080538">/.test(text("index.html"))) fail("AdSense verification meta is missing from homepage");
if (!/google\.com, pub-5179004241080538, DIRECT, f08c47fec0942fa0/.test(text("ads.txt"))) fail("Authorized publisher record missing from ads.txt");
if (!/Sitemap:\s*https:\/\/zyphor\.cc\/sitemap\.xml/.test(text("robots.txt"))) fail("Sitemap link missing from robots.txt");
const sitemap = text("sitemap.xml");
for (const p of publicPages) {
  const url = "https://zyphor.cc/" + (p === "index.html" ? "" : p);
  if (!sitemap.includes("<loc>" + url + "</loc>")) fail("Missing sitemap URL: " + url);
}
const policy = JSON.parse(text("PP.json"));
if (!(policy.sections || []).some(s => /advertising.*cookies/i.test(s.title))) fail("Privacy policy needs specific advertising-cookie disclosures");
if (!JSON.stringify(policy).includes("adssettings.google.com")) fail("Google ad personalization opt-out is missing from policy");
for (const p of ["guides.html","help.html","community.html","downloads-guide.html","privacy-ads.html"]) {
  if (!text("index.html").includes('href="/' + p + '"')) fail("Homepage does not link to published guide: " + p);
}
if (errors.length) {
  console.error("Site policy preflight failed:\n" + errors.map((e,i) => (i+1) + ". " + e).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Site policy preflight passed: " + htmlFiles.length + " HTML files checked; ads disabled pending certified CMP and manual review.");
}
