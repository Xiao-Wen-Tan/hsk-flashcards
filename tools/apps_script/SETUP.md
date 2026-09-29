# Setting up the Google Sheet backup

This takes about 10 minutes. You need a computer signed in to your Google account, and the
learner's phone with the app open at Settings. Nothing you create here goes into the public
GitHub repository.

## What the two values are

- **The secret code.** A random code of 24 letters and digits, such as
  `k7mq-2xrt-9pwd-hc4n-fz6b-y3ja`, that the app makes. The script in your Sheet only accepts
  requests that carry this code, so a stranger who finds the web app address still cannot read
  or change your Sheet. It lives in two places only: the phone's browser and your copy of the
  script.
- **The web app address.** The link Google gives your script when you deploy it, such as
  `https://script.google.com/macros/s/AKfycb.../exec`. The phone sends its progress to this
  address. It lives only in the phone's browser.

## 1. Get the secret code from the phone

1. On the phone, open the app, tap **Settings**, and scroll to **Google Sheet backup**.
2. The box **Secret code** shows the code. Tap **Share code** (or **Copy code**) and send it to
   yourself, for example by e-mail or a message. You paste it in step 3.

## 2. Make the Sheet

1. On the computer, open https://sheets.google.com and sign in.
2. Click **Blank spreadsheet** (the large plus).
3. Click the title "Untitled spreadsheet" at the top left and type `HSK Flashcards progress`.

## 3. Add the script

1. In the Sheet's menu, click **Extensions**, then **Apps Script**. A new tab opens with the
   script editor and a file called `Code.gs`.
2. Click the title "Untitled project" at the top and type `HSK Flashcards backup`, then **Rename**.
3. Open `tools/apps_script/Code.gs` from the project (Claude can give you its text, or open it on
   GitHub and click **Copy raw file**).
4. In the editor, select everything in `Code.gs` (Ctrl+A), delete it, and paste the project's text.
5. Near the top, find this line:
   `var SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';`
   Replace `PASTE-THE-CODE-FROM-THE-APP` with the code from step 1, keeping the quote marks.
   It then looks like `var SECRET_CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';` with your code.
6. Click the disk icon (**Save project**), or press Ctrl+S.

## 4. Run setup once

1. In the toolbar above the code, the box next to **Debug** shows a function name. Choose `setup`.
2. Click **Run**.
3. Google asks for permission the first time:
   - Click **Review permissions** and choose your Google account.
   - A page says "Google hasn't verified this app". This is expected for a script you wrote
     yourself. Click **Advanced**, then **Go to HSK Flashcards backup (unsafe)**.
   - Click **Allow**. The script may then read and change your spreadsheets. It only opens
     this one Sheet.
4. The **Execution log** at the bottom shows
   `Setup done. The tabs Dashboard, Progress, Log, Daily and Meta are ready. Now deploy the web app.`
   If it says to replace PASTE-THE-CODE-FROM-THE-APP, step 3.5 was missed.
5. Switch back to the Sheet's tab. It now has the tabs Dashboard, Progress, Log, Daily and Meta.

## 5. Deploy it as a web app

1. In the script editor, click the blue **Deploy** button (top right), then **New deployment**.
2. Next to "Select type", click the gear icon and choose **Web app**.
3. Fill in:
   - **Description:** `HSK backup`
   - **Execute as:** `Me (your address)`
   - **Who has access:** `Anyone`
   "Anyone" is needed because the phone does not sign in to Google. The secret code is what
   keeps strangers out.
4. Click **Deploy**. If Google asks for permission again, allow it as in step 4.3.
5. Copy the **Web app URL** (it ends with `/exec`) and click **Done**.
6. Optional check: open that address in a new browser tab. It shows
   `{"ok":true,"app":"hsk-flashcards-backup","message":"The HSK Flashcards backup is running."}`.

## 6. Connect the phone

1. Send the web app address to the phone (for example by e-mail or a message) and copy it there.
2. In the app, go to **Settings**, **Google Sheet backup**, paste the address into
   **Web app address**, and tap **Save address and code**.
3. Tap **Test connection**. It says `Connected. The Sheet has saved answers up to number 0.`
4. Tap **Back up now**. It says `Backed up. N changes sent.` (or 0 before the first session),
   and the Sheet's tabs fill with rows.

## Later changes

- **A new version of the script.** Paste the new text (keeping your code on the SECRET_CODE
  line), save, then **Deploy**, **Manage deployments**, the pencil icon, **Version: New version**,
  **Deploy**. The web app address stays the same.
- **A new secret code.** After **Make a new code** on the phone, paste the new code into the
  script, save, and deploy a new version as above. Until then the phone's backups are refused.
- **A new phone.** Install the app and open **Settings**, **Google Sheet backup**. Paste the
  web app address. Replace the code in **Secret code** with the code on the SECRET_CODE line of
  your script, tap **Save address and code**, then **Restore from Google Sheet**.
- **Two phones or browsers.** Only one of them backs up to the Sheet. The other one is told
  "Another phone or browser backs up to this Sheet" and offers two buttons: **Restore from
  Google Sheet** (take the Sheet's progress) or **Replace the Sheet with this phone's
  progress**.

## If something goes wrong

| The app says | What to do |
|---|---|
| Could not reach the Sheet... | Check that the phone is online and that the address ends with `/exec`. In **Manage deployments**, "Who has access" must be **Anyone**. |
| The Sheet refused the secret code | The code on the SECRET_CODE line must be exactly the code shown in Settings. Fix it, save, and deploy a new version. |
| The script in the Sheet is not set up | Run `setup` once (step 4). |
| The progress on this phone no longer matches the Sheet | Happens after "Restore from a backup file". Choose one of the two buttons shown. |
