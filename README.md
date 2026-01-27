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
   - Your app will be available at: `https://<username>.github.io/energy_trades/`
   - If you're using a custom domain or different repository name, update the `base` path in `vite.config.ts`

### Manual Build

To build the project locally for GitHub Pages:

```bash
pnpm run build:gh-pages
```

The built files will be in the `dist` directory.

### Local Testing

**Important:** You cannot open `dist/index.html` directly in a browser because the assets use absolute paths that require a web server.

To test the build locally:

1. **For regular build (base `/`):**
   ```bash
   pnpm run build
   pnpm run preview
   ```

2. **For GitHub Pages build (base `/energy_trades/`):**
   ```bash
   pnpm run preview:gh-pages
   ```

This will start a local server where you can preview your built app.
