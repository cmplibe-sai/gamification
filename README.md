# cMPLi Be — Gamification Platform

Gamified learning and milestone tracking platform for cMPLi Be students. Students log in, complete course checkpoints, and submit work (including audio) for AI-assisted evaluation, earning Learning Coins (LCs) that sync back to their TagMango wallet.

## Features

- OTP-based login via email or phone
- Course timelines and milestone tracking
- Audio submission evaluation using AssemblyAI transcription against grading rubrics
- Tiered LC (Learning Coin) grading and automated TagMango wallet sync
- Optional MongoDB persistence, with a local JSON file store as a fallback

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Static HTML/CSS/JS with Tailwind CSS
- **Database:** MongoDB (optional) or local JSON file storage
- **Transcription:** AssemblyAI

## Getting Started

### Prerequisites

- Node.js >= 18

### Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your configuration values:

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm start
   ```

   For development with auto-restart on file changes:

   ```bash
   npm run dev
   ```

The app serves on `http://localhost:3000` by default (or the port set via `PORT`).

## Project Structure

| File | Purpose |
| --- | --- |
| `server.js` | Express server, API routes, AI evaluation, and TagMango sync |
| `api.js` | Client-side API helper functions |
| `app.js` | Main frontend application logic |
| `courses.js` | Course data and structure |
| `timeline.js` | Milestone/timeline rendering |
| `users.js` | User-related logic |
| `scores.js` | LC scoring logic |
| `data.js` | Shared static data |
| `index.html`, `styles.css` | Frontend markup and styling |
