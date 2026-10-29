# Zyphor AdSense & Google policy preflight

This pull request is a conservative remediation for the AdSense **Low value content** review. It makes the public site easier to evaluate and prevents ad code from loading on screens that are unsuitable for display advertising. It does **not** certify legal compliance, Google approval, backend behavior, or any live consent configuration.

## Current serving state

- Google AdSense's script has been removed from the existing HTML pages, including low-content screens, error pages, private conversations, dashboard, account administration, purchases, user-generated content, interactive games, rewards and previews.
- The Google ownership-verification meta tag `google-adsense-account` is retained on the homepage and About page. The valid `ads.txt` file is retained. Neither loads an ad.
- This deliberately means **no AdSense display ads will show until the site owner completes the remaining account and consent steps**. Do not reintroduce ad tags globally or through a template used by private pages.
- Original public resources were added at `guides.html`, `help.html`, `community.html`, `downloads-guide.html`, `privacy-ads.html`; the homepage, About and Downloads were expanded. The XML sitemap includes public information pages, not private or transient UI.
- `PP.json`, `TOS.json` and the readable policy pages disclose cookie use, user choices and standards. These are drafts requiring the operator's verification of real practices.

## Manual steps before a new AdSense review

1. Deploy and open **https://zyphor.cc/** in a logged-out browser, including a mobile browser. Confirm the homepage and documentation load directly with real text, no login requirement, and that all links work.
2. Check **https://zyphor.cc/ads.txt**, **https://zyphor.cc/sitemap.xml**, and **https://zyphor.cc/PP.html** on the actual production domain. The publisher ID must match the AdSense account. Verify the site using the existing meta tag or ads.txt according to Google AdSense > Sites.
3. In the AdSense account, choose **Privacy & messaging > European regulations**, select zyphor.cc, enter the actual privacy policy URL **https://zyphor.cc/PP.html**, and configure/publish a Google-certified CMP with IAB TCF support for the EEA, UK and Switzerland. Ensure options for users to decline and update consent, vendor transparency, and compliance with local law. This step cannot be completed by writing GitHub code alone.
4. Review data collection and third-party services against the public Privacy Policy. In particular confirm retention, disclosure, contact processes, underage access, sensitive information, phone and desktop app features, and any remaining first/third-party tracking. A drafted policy is not proof that backend data handling meets GDPR.
5. Check whether the Google account uses Auto Ads. Do not enable it for a site-wide layout that contains private messages, auth, payment, games or redirect pages. Choose carefully scoped public editorial inventory if and when ad serving is permitted.
6. Re-review the Mega Hack third-party account offer and Roblox executor scripts against publisher rules on unauthorized software access, intellectual property, third-party licensing and honesty. Publishing a `noindex` tag does not erase policy risk if content is still publicly accessible.
7. Confirm the random Halloween cases involve no prohibited real-money wagering; verify any reward values, conversion paths, and trade functionality. **Do not reward Google ad views or clicks with transferable Zyphium, cash, tradable collectibles, or goods.** Rewarded ad incentives have special rules.
8. Moderate public profiles, user-generated descriptions, uploaded pictures and community text; give users a real reporting path and remove policy-violating content. Be sure that privacy-law requests can actually be fulfilled server-side.
9. Once the site has enough substantive public content and all account/CMP checks are done, request an AdSense review. **Google makes the approval decision** and may identify other issues.

## Re-enabling ads after approval

Only reintroduce AdSense loader code on selected, substantial, public editorial pages **after** AdSense approval and the certified CMP/consent implementation have been verified. Do not add the loader to `PP.html`, `TOS.html`, `privacy-ads.html`, error pages, private chats, sign-in, account utilities, payment screens, popups or interactive reward interfaces. Avoid auto-redirects, auto-refresh, forced clicks, ad/view exchanges, or layouts with more ads than content.

The automated policy checker intentionally blocks **all** AdSense display-ad scripts. To authorize ads in the future, update the checker to allow only a reviewed explicit page allowlist, and require the documented account/CMP approval before merging. Do not weaken the checker to allow global script injection.

## Review references

- Site verification / meta tag: https://support.google.com/adsense/answer/12169212
- Pages without substantive publisher content: https://support.google.com/publisherpolicies/answer/11112688
- Private communications and ad placement: https://support.google.com/adsense/answer/1346295
- AdSense privacy policy disclosures: https://support.google.com/adsense/answer/1348695
- Add privacy policy URL to CMP: https://support.google.com/adsense/answer/10961370
- Certified CMP requirements: https://support.google.com/adsense/answer/13554116
- Rewarded ad rules: https://support.google.com/adsense/answer/9121589
- Prohibited unauthorized hacking/cracking: https://support.google.com/publisherpolicies/answer/10436828

## Quick test

```bash
node scripts/check-site-policy.mjs
```

Run it before merging; it checks basic static protections and the presence of public content. It does **not** replace a live browser audit, backend inspection, expert privacy review, security test or Google policy decision.
