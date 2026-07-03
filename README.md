# Tunely 🎵

**Tunely** is a modern, high-fidelity music streaming web application built with a focus on premium user experience, real-time audio processing, and sleek UI/UX. It offers a seamless, app-like experience directly in the browser.

<p align="center">
  <img src="public/favicon.svg" width="150" alt="Tunely Logo">
</p>

## ✨ Features

- **Premium Audio Engine**: Enforces 320kbps high-fidelity playback by default for crisp, clear audio.
- **Dynamic Content Discovery**: The Home page shuffles through curated playlists (Viral Hits, Lo-Fi Chill, Global Top 50, etc.) automatically, ensuring your feed is always fresh.
- **Spotify Integration**: Import public Spotify playlists directly into Tunely with a single click. Includes robust error handling and progress tracking.
- **Guest Mode**: Allows users to try out the app without creating an account (with limited access to premium features).
- **Responsive "Glassmorphism" UI**: Built with dynamic, responsive CSS media queries that provide a sleek, padded, and modern UI on both Desktop and Mobile.
- **Real-time Lyrics**: Synchronized lyrics viewer panel.
- **Super Admin Dashboard**: A live management console for viewing active sessions, users, and server-side metrics.
- **Dynamic Themes**: Multiple aesthetic themes to personalize your listening experience.

## 🚀 Tech Stack

### Frontend
- **React.js** (v18+)
- **Vite** (Build Tool)
- **CSS3** (Custom properties, animations, media queries)
- **Lucide React** (Iconography)
- **React Router v6**

### Backend / API
- **Cloudflare Workers** (Serverless edge API)
- **Hono** (Web framework)
- **Cloudflare D1** (SQLite Database)
- **Resend** (Email delivery for OTPs)
- **JioSaavn API wrapper** (Music data source)

## 📦 Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aditya5576/Tunely.git
   cd Tunely
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *The app will be available at http://localhost:5173*

4. **Backend Setup**
   Navigate to the `jiosaavn-api` folder, install its dependencies, and run the Cloudflare Wrangler dev server to test API routes locally.

## ☁️ Deployment

Tunely is deployed on **Cloudflare Pages**. 

To deploy manually:
```bash
npm run build
npx wrangler pages deploy dist --project-name tunely
```

## 🛡️ Admin Access
The Super Admin dashboard is accessible by logging in with the designated root email. From there, you can monitor live streams, ban/unban users, and oversee the real-time activity of the application.

---
*Developed by [Aditya Patil](https://github.com/Aditya5576)*
