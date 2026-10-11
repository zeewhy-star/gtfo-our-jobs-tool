# Install day

About 15 minutes. Claude Code on your laptop does the typing; you sign in and click Allow.

## Before you start

- Sign in to Chrome (or your default browser) with the Google account that should own everything: zoyacoub@gmail.com.
- The Apps Script API is on at script.google.com/home/usersettings.
- The Anthropic API key isn't needed yet. Phase 1 doesn't call Claude. Keep it somewhere safe for Phase 2.

## Steps

Open the Claude desktop app, start a Claude Code session in a folder you'll keep (for example Documents/job-search), and paste this:

> Clone https://github.com/zeewhy-star/gtfo-our-jobs-tool and walk me through INSTALL.md, doing every step you can yourself.

Claude Code will work through the steps below. Each one says who does it.

1. **Clone the repo** (Claude Code): `git clone https://github.com/zeewhy-star/gtfo-our-jobs-tool` and `cd` into it.
2. **Check Node** (Claude Code): `node --version` should print 20 or higher. If Node is missing, install the LTS version from nodejs.org.
3. **Run the tests** (Claude Code): `npm test`. All tests must pass before anything goes to Google.
4. **Install Google's Apps Script tool** (Claude Code): `npm install -g @google/clasp`.
5. **Sign in to Google** (you): Claude Code runs `clasp login`. A browser window opens. Pick zoyacoub@gmail.com and click Allow.
6. **Create the Sheet and its script** (Claude Code):

   ```
   clasp create --type sheets --title "Job Search System" --rootDir src
   git checkout -- src/appsscript.json
   clasp push --force
   ```

   On clasp version 3, the first command is also called `clasp create-script`; either works. It makes a new Google Sheet in your Drive with a script attached. The second puts back this project's settings file in case `clasp create` replaced it. The third uploads the code.
7. **Open the script editor** (Claude Code then you): Claude Code runs `clasp open-script` (or `clasp open` on older versions) and the Apps Script editor opens in your browser.
8. **Run setup** (you): in the editor, pick `setup` from the function menu at the top and click Run.
   - Google asks for permission. Click Review permissions, pick your account, then Advanced, then "Go to Job Search System (unsafe)." It says unsafe only because the script is yours and hasn't been through Google's review. Click Allow.
   - When it finishes, open the Sheet. You'll see every tab, the Settings tab filled in, and 65 employers on the Watchlist.
9. **Turn on a first employer** (you, or ask Claude Code for help finding board details): fill in careers_system and board_token for at least one Watchlist employer, and tick active. The README explains how to read a careers page address.
10. **Check it** (you): in the editor, run `checkWatchlist`. The log at the bottom shows how many open jobs each active employer returned.
11. **First run** (you): run `runCollector`, then open the Run log tab. You should see a collector row. Then run `sendDigest` and check your inbox for the test digest.

That's it. From here the collector runs every 15 minutes and the digest arrives at 7am.

## What to expect in week one

The first 7 days build the baseline. Every job already open at your watchlist employers is marked Old, because the system has no history to prove otherwise. Only jobs with an employer posting date from the past 24 hours reach the digest that week, so the first few digests will be short. That's expected.

## Later updates

When new code lands in GitHub, ask Claude Code: "Pull the latest from GitHub, run the tests, and push to Apps Script." It runs `git pull` and `npm run push`.

## Setting up Clint's copy (Phase 5)

Clint repeats steps 1 to 8 on his own laptop, signed in to his own Google account. Phase 5 adds the settings that point his copy at the shared Sheet.
