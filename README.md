# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages.

### Setup Instructions

1. **Enable GitHub Pages in your repository:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

2. **Push to main/master branch:**
   - The GitHub Actions workflow will automatically build and deploy your app when you push to the `main` or `master` branch
   - You can also manually trigger the deployment from the **Actions** tab

3. **Access your deployed app:**
   - Your app will be available at: `https://<username>.github.io/energy-trades/`
   - If you're using a custom domain or different repository name, update the `base` path in `vite.config.ts`

### Manual Build

To build the project locally for GitHub Pages:

```bash
GITHUB_PAGES=true pnpm run build
```

The built files will be in the `dist` directory.
