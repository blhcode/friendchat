# Friends Chat — Setup Guide

One-time setup to deploy your encrypted friends chat on GitHub Pages.

## Prerequisites

- A **private** GitHub repository for this project
- A GitHub account (yours — friends do not need GitHub accounts)

## 1. Create a GitHub PAT

1. Go to **GitHub → Settings → Developer settings → Fine-grained personal access tokens**
2. Click **Generate new token**
3. Set **Repository access** to **Only select repositories** → choose your chat repo
4. Under **Permissions → Repository permissions → Contents**, set **Read and write**
5. Generate and copy the token (you will not see it again)

> Keep this token secret. It is encrypted per-user in the repo and never stored in plaintext.

## 2. Configure the base path

Edit [`vite.config.ts`](vite.config.ts) and set `base` to match your repo name:

```ts
base: '/Your-Repo-Name/',
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial friends chat"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 4. Enable GitHub Pages

1. Open your repo on GitHub
2. Go to **Settings → Pages**
3. Under **Build and deployment → Source**, choose **Deploy from a branch**
4. Select branch **main**, folder **/docs**
5. Save

After the deploy workflow runs, your site will be at:

`https://YOUR_USERNAME.github.io/YOUR_REPO/`

## 5. Run the setup wizard

1. Visit your GitHub Pages URL
2. Complete the one-time setup form:
   - GitHub username and repo name
   - Your PAT
   - Admin username and password (your login)
3. This creates `data/users.json` and `data/messages.json` in your repo

## 6. Share access with friends

Friends log in with the username and password you create in the **Admin** panel.

On a **new browser/device**, they need the site access token once:

- **Option A:** Share this link (replace values):  
  `https://YOUR_USERNAME.github.io/YOUR_REPO/?bootstrap=YOUR_PAT`
- **Option B:** They enter the token manually on the login screen

After the first login on a device, the token is saved in that browser.

> For better security, create a second fine-grained PAT with **Contents: Read only** and share that for bootstrap instead of your write token.

## 7. Add users (Admin panel)

1. Log in with your admin account
2. Click **Admin** in the chat header
3. Enter a username and password for each friend
4. Share those credentials with them securely (not over the chat)

## Security notes

- Use strong passwords for all accounts — they protect the encrypted API token
- Never commit plaintext PATs or `.env` files
- Messages are end-to-end encrypted; GitHub only stores ciphertext
- Usernames, timestamps, and message counts are still visible in the repo
- Rotate your PAT if a password may be compromised
- Poll-based updates mean messages appear within ~3 seconds, not instantly

## Local development (no GitHub required)

Test everything on your machine with files — no PAT or GitHub account needed.

### 1. Create your config file

```bash
cp config.example.json config.json
```

### 2. Edit `config.json`

```json
{
  "mode": "local",
  "admin": {
    "username": "admin",
    "password": "your-password-here"
  },
  "github": {
    "owner": "",
    "repo": "",
    "pat": ""
  }
}
```

Set `"mode": "local"` and choose your **admin username** and **password**. These are your login credentials.

### 3. Start the dev server

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

### 4. Log in

Use the username and password from `config.json`. On first visit, the app auto-creates `data/users.json` and `data/messages.json` in the project folder.

Chat messages and users are stored in the `data/` folder. You can inspect those JSON files to confirm encryption is working (message bodies should be ciphertext, not plain text).

### GitHub mode via config file

To use GitHub with a config file instead of the web setup wizard, set:

```json
{
  "mode": "github",
  "admin": {
    "username": "admin",
    "password": "your-password"
  },
  "github": {
    "owner": "your-github-username",
    "repo": "Friends-Chat-Online",
    "pat": "github_pat_..."
  }
}
```

> `config.json` is gitignored — never commit it with real passwords or PATs.
