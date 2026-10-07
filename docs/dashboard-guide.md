# Finishing the setup: Cloudflare, search and the Pro link

Everything here is done in your browser, with no code. Plan about 40 minutes. Do the parts in this order. Cloudflare renames menu items now and then, so if something isn't where this says, look for the words in **bold**, or send me a screenshot and I'll point you to it.

Open https://dash.cloudflare.com and sign in. You'll use two places:

- **Your domain:** click **valwidgets.live**. This is where security, SSL and rules live.
- **Your Worker:** **Workers & Pages**, then **valorant-stream-widgets**. This is where builds and settings live.

---

## 1. Turn on usage counting (done on 4 October 2026)

Cloudflare refuses to deploy the counter until Analytics Engine has been switched on once for your account. It is free at this size (the free plan includes 100,000 counts a day). This is already done and working; the steps are here for a new account or a fork.

1. In the left menu open **Storage & databases**, then **Analytics Engine**, and click **Enable**. Creating a dataset on that page is not enough: the deploy kept failing with "You need to enable Analytics Engine" (code 10089) until Enable was clicked.
2. The binding (`EVENTS`, dataset `tally_events`) is already in `wrangler.jsonc`, so the next deploy picks it up. If a build failed before you clicked Enable, open it and click **Retry build**.
3. Check it in PowerShell. You want `204` and `x-counted: yes` (this adds one test count):

```powershell
curl.exe -i -X POST https://valwidgets.live/api/e -H "Origin: https://valwidgets.live" -d '{\"e\":\"visit\",\"a\":\"other\",\"b\":\"direct\"}'
```

Reading the numbers, a few days later:

1. Click your profile icon, **My Profile**, **API Tokens**, **Create Token**, **Create Custom Token**. Give it one permission: **Account**, **Account Analytics**, **Read**. Create it and copy the token (you only see it once).
2. Copy your **Account ID** from the right-hand column of **Workers & Pages**, Overview.
3. In PowerShell, in the project folder (don't paste the token anywhere else, and don't commit it):

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "your account id"
$env:CLOUDFLARE_API_TOKEN = "your token"
npm run stats
```

---

## 2. Let AI search and assistants in (10 minutes)

Today PerplexityBot is blocked at the network level (it gets a 403), and Cloudflare's own `robots.txt` section tells ChatGPT-User, Claude-User and Perplexity-User to stay out. Your site's own `robots.txt` already asks only the training crawlers (GPTBot, ClaudeBot and similar) to stay out, so Cloudflare's part is the only thing in the way.

1. Click your domain, then **Security**, then **Settings**. Filter by **Bot traffic**.
2. Switch **off** "Set your preference to block training in robots.txt". Cloudflare then stops adding its long block list and `ai-train=no` to your `robots.txt`.
3. If you see **Block AI bots**, set it to **Allow (do not block)**. If you see the newer **Search**, **Training** and **Agent** controls instead (Cloudflare replaced the single switch on 15 September 2026), set **Search** and **Agent** to **Allow**. **Training** is your choice: Block keeps GPTBot and ClaudeBot out at the network level, and it doesn't stop you appearing in AI answers.
4. Click your domain, then **AI Crawl Control**, then the **Crawlers** tab. In the **Action** column set **Allow** for PerplexityBot, Perplexity-User, ChatGPT-User and Claude-User. Leave GPTBot, ClaudeBot and the other training crawlers on **Block** if you want to opt out of training.
5. Wait a minute, then check in PowerShell. You want 200 for all four:

```powershell
foreach ($ua in "PerplexityBot/1.0","OAI-SearchBot/1.0","ChatGPT-User/1.0","Claude-User/1.0") { "$ua  " + (curl.exe -s -o NUL -w "%{http_code}" -A $ua https://valwidgets.live/) }
```

---

## 3. Send http:// and www to the one real address (10 minutes)

Right now `http://valwidgets.live` and `https://www.valwidgets.live` both show the site instead of redirecting, which makes duplicate copies of every page.

1. Click your domain, then **SSL/TLS**, **Overview**, **Edge Certificates**. Turn on **Always Use HTTPS**. (If the toggle is missing, your SSL/TLS mode is set to Off; pick Full or Full (strict) first.)
2. Click your domain, then **Rules**, **Redirect Rules**, **Create rule**. Choose the template **Redirect from WWW to root**, or fill it in yourself:
   - Rule name: `Redirect www to root`
   - When incoming requests match: **Wildcard pattern**, Request URL: `https://www.*`
   - Then: **Static**, URL: `https://${1}`, Status code: **301**, and tick **Preserve query string**
   - Click **Deploy**.
3. Check in PowerShell. Both should show `301` and a `location:` line pointing at `https://valwidgets.live/`:

```powershell
curl.exe -sI http://valwidgets.live/ | Select-String "^HTTP|^location"
curl.exe -sI https://www.valwidgets.live/ | Select-String "^HTTP|^location"
```

---

## 4. Turn off the blocked analytics script (2 minutes)

Cloudflare adds its own analytics script to every page, and your site's security policy blocks it. It collects nothing and prints a red error in the browser console on every page.

1. In the left menu open **Analytics & Logs**, then **Web Analytics**. Click the card for valwidgets.live, then **Manage site**.
2. Choose **Disable**.
3. Check: open https://valwidgets.live, press **F12**, open the **Console** tab and reload. The red message about `cloudflareinsights.com` should be gone.

---

## 5. Add the "Pro (coming soon)" link (10 minutes)

The link only shows once the site knows your form's address.

1. **Make the form.** Go to https://forms.google.com and start a blank form. Title it `Tally Pro: what would you pay for?`. Add these two questions:
   - Question 1, **Checkboxes**: `Which of these would you pay for?` with the options `A permanent link, so I never paste a new one into OBS`, `Custom looks: my logo, colours and fonts`, `More widgets`, `Overlays for tournaments and teams`, `Something else`.
   - Question 2, **Short answer**, not required: `Email, only if you want to hear when it's ready`.
2. Click **Send**, the **link** tab, tick **Shorten URL**, and copy the `https://forms.gle/...` address.
3. In Cloudflare go to **Workers & Pages**, **valorant-stream-widgets**, **Settings**, **Build**, then **Build variables and secrets**. Add a variable:
   - Name: `NEXT_PUBLIC_PRO_INTEREST_URL`
   - Value: the form address you copied
   - **Save**.
4. Build again, because variables only apply to the next build. Open the latest build in the project's builds list and use **Retry build** (the button name may differ), or push any small change.
5. When the build is done, https://valwidgets.live shows **Pro (coming soon)** in the footer, and under the OBS link once someone has a working link. Click it to make sure the form opens.
6. In about three months, count the clicks (the `npm run stats` report shows them once counting is on) and read the form answers. Build Pro only if enough people ask for it.

---

## 6. Get found in search (15 minutes)

**Google Search Console**

1. Go to https://search.google.com/search-console and open the property list, then **Add property**.
2. Choose **URL prefix** and enter `https://valwidgets.live/`. Your site already contains Google's verification tag, so if it asks how to verify, pick **HTML tag** and it should pass at once. If the property already exists, skip to the next step.
3. In the left menu open **Sitemaps**, enter `sitemap.xml` and click **Submit**. The status should become **Success**.
4. Paste `https://valwidgets.live/` into the search bar at the top (URL inspection), wait for the result, and click **Request indexing**. Repeat for `https://valwidgets.live/valorant-rank-calculator` and `https://valwidgets.live/valorant-agent-mastery-calculator`.
5. Expect days or weeks, not hours. Check the **Pages** report now and then.

**Bing Webmaster Tools** (Bing feeds Copilot and DuckDuckGo)

1. Go to https://www.bing.com/webmasters and sign in.
2. Choose **Import** from Google Search Console (the fastest), or add the site and verify it.
3. Open **Sitemaps** and submit `https://valwidgets.live/sitemap.xml`.

---

## 7. Add the Feedback link (10 minutes)

People can send you feedback from a quiet "Feedback" link in the footer (and from the Ctrl+K search). It opens a Google Form in a new tab, so the site stores nothing and needs no server for it. Each answer reaches you as an email, and all of them pile up in a spreadsheet.

1. **Make the form.** Go to https://forms.google.com and start a blank form. Title it `Tally feedback`. In the description write: `Tell me what's not working or what you'd like. Please don't include your HenrikDev key or any password.` Add these questions:
   - **Multiple choice**, required: `What is it?` with the options `An idea`, `A problem`, `Something else`.
   - **Paragraph**, required: `What happened, or what would you like?`
   - **Dropdown**, not required: `Where?` with the options `Rank overlay`, `Mastery overlay`, `Rank calculator`, `Mastery calculator`, `Somewhere else`.
   - **Short answer**, not required: `Email or Discord, only if you want a reply`.
2. **Keep it easy to answer.** Open the **Settings** tab and make sure **Collect email addresses** and **Limit to 1 response** are both off (each one makes people sign in to Google). Under **Presentation** you can change the confirmation message to `Thanks, that helps.`
3. **Get an email for every answer.** Open the **Responses** tab, click the three dots, and choose **Get email notifications for new responses**. Also click **Link to Sheets** to keep every answer in a spreadsheet.
4. Click **Send**, the **link** tab, tick **Shorten URL**, and copy the `https://forms.gle/...` address.
5. **Tell me the link** (it isn't secret). The address goes into `wrangler.jsonc` and ships with the next push, so there is nothing to type into Cloudflare. (You could add a build variable named `NEXT_PUBLIC_FEEDBACK_URL` instead; it wins over the file.)
6. When the deploy is done, https://valwidgets.live shows **Feedback** in the footer. Click it to check the form opens, then send a test answer to see the email arrive.

---

## Final check

When you've done parts 2, 3 and 4, run this. Every line should look as described:

```powershell
"redirects (want 301):"; curl.exe -sI http://valwidgets.live/ | Select-String "^HTTP"; curl.exe -sI https://www.valwidgets.live/ | Select-String "^HTTP"
"crawlers (want 200):"; foreach ($ua in "PerplexityBot/1.0","OAI-SearchBot/1.0","ChatGPT-User/1.0","Claude-User/1.0") { "$ua  " + (curl.exe -s -o NUL -w "%{http_code}" -A $ua https://valwidgets.live/) }
"pages (want 200):"; foreach ($p in "/","/manifest.webmanifest","/opengraph-image-12o0cb","/robots.txt","/sitemap.xml") { "$p  " + (curl.exe -s -o NUL -w "%{http_code}" "https://valwidgets.live$p") }
```

If something doesn't match, or a screen looks different from what's described, send me a screenshot and what you clicked, and I'll work out the next step.
