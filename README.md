# VisionTrack: Advanced Full-Stack Eye-Tracking Platform

[![Full Stack](https://img.shields.io/badge/FullStack-NestJS%20%26%20React-blue)](https://github.com/yourusername/eyetracking-v2)
[![License: UNLICENSED](https://img.shields.io/badge/License-UNLICENSED-red.svg)](license)

VisionTrack is a modern, full-stack eye-tracking and gaze analysis platform. It leverages browser-based eye-tracking (WebGazer.js) to estimate user gaze points in real-time, syncing data across participants and administrators using Socket.io. The platform features a premium, glassmorphism-inspired Admin Dashboard for session management and behavior analysis.

## ✨ Key Features

- **🎯 Real-Time Gaze Estimation**: Browser-based tracking via webcam using WebGazer.js.
- **📊 Admin Dashboard**: A state-of-the-art management panel with glassmorphism design, multi-tab views, and interactive statistics.
- **🔄 Live Session Sync**: Real-time websocket communication for participant monitoring and session control (Join, Invite, End Session).
- **🔥 Heatmap Visualization**: Generate gaze heatmaps and scan-path visualizations to analyze user behavior.
- **🔐 Secure Authentication**: JWT-based authentication for both Admins and Testers.
- **📱 Responsive & Premium UI**: Built with TailwindCSS and Lucide-React for a high-end user experience.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Language**: TypeScript
- **Styling**: TailwindCSS 4.0 (Custom Glassmorphism)
- **Tracking**: WebGazer.js
- **Visualization**: simpleheat, heatmap.js
- **Icons**: Lucide-React
- **Real-time**: Socket.io-client

### Backend
- **Framework**: NestJS 11
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Auth**: Passport.js + JWT

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or on Atlas)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/your-repo-name.git
cd eye-tracking-v2
```

### 2. Setup Backend
```bash
cd backend
npm install
# Create a .env file and set your MONGO_URI and JWT_SECRET
npm run start:dev
```

### 3. Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
```

## 📂 Project Structure

```text
eye-tracking-v2/
├── backend/          # NestJS application (API, WebSockets, DB)
├── frontend/         # React application (Vite, Eye-Tracking Logic)
└── README.md         # Project documentation
```

## 📸 Screenshots
*(Add your stunning screenshots here!)*

## 📄 License
This project is UNLICENSED.
