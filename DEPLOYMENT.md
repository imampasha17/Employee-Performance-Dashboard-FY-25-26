# Vercel Deployment Guide

This guide describes how to deploy the Employee Performance Dashboard to Vercel.

## 1. Prerequisites

- A GitHub repository containing the project code.
- A Firebase project with Firestore enabled.

## 2. Deployment Steps

1.  **Import to Vercel**: 
    - Log in to [Vercel](https://vercel.com).
    - Click **"Add New"** > **"Project"**.
    - Import your GitHub repository.

2.  **Configure Project Settings**:
    - **Framework Preset**: Vite (should be auto-detected).
    - **Root Directory**: `./`
    - **Build Command**: `npm run build`
    - **Output Directory**: `dist`
    - **Install Command**: `npm install`

3.  **Environment Variables**:
    You MUST add the following environment variables in the Vercel Dashboard (**Settings > Environment Variables**):

    ### Server Configuration
    - `JWT_SECRET`: A random string used for signing login tokens.
    - `GEMINI_API_KEY`: Your Google Gemini API key.
    - `APP_URL`: Your deployment URL (e.g., `https://your-app.vercel.app`).

    ### Firebase Configuration
    To avoid committing your `firebase-applet-config.json` file, add these individual variables:
    - `FIREBASE_PROJECT_ID`
    - `FIREBASE_API_KEY`
    - `FIREBASE_APP_ID`
    - `FIREBASE_AUTH_DOMAIN`
    - `FIREBASE_STORAGE_BUCKET`
    - `FIREBASE_MESSAGING_SENDER_ID`
    - `FIREBASE_FIRESTORE_DB_ID`: (Optional, defaults to `(default)`)

    *All these values can be found in your Firebase Console project settings.*

4.  **Deploy**:
    - Click **Deploy**. Vercel will build the frontend and set up the `api/` directory as Serverless Functions.

## 3. How it Works

- **Frontend**: Built using Vite and served as static files.
- **Backend**: The Express server in `api/server.ts` is exported via `api/index.ts`.
- **Routing**: `vercel.json` ensures that all requests to `/api/*` are routed to the Express backend.

## 4. Verification

Once deployed, you can verify the status by visiting:
- `https://your-app.vercel.app/api/health`
- `https://your-app.vercel.app/api/debug` (Check if `authReady` is true and `projectId` matches)
