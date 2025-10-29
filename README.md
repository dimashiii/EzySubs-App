
# 🏀 Ezy Subs – Basketball Substitution Manager

[![Expo](https://img.shields.io/badge/Expo-React%20Native-blue)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Prototype%20Complete-success)]()
[![License](https://img.shields.io/badge/License-Educational-lightgrey)]()

> 📝 **Note:** This project was developed for **Maikazconsult** under the **Curtin University Consultancy Project (MGMT6052)**.  
> It is shared publicly **for portfolio and academic demonstration purposes only**.  
> All intellectual property belongs to **Maikazconsult**.

---

## 📖 Overview

**Ezy Subs** is a basketball substitution management app that enables coaches to efficiently handle **player rotations**, **court time tracking**, and **substitution management** during games.

Originally created as a **web prototype** by the client—a coach and parent managing their child’s basketball team—the system was re-engineered by our consultancy team into a **fully functional, mobile-ready application** using **React Native** and **Expo**, with a redesigned UI, improved usability, and extended functionality for real-world coaching.

---

## 🧠 Project Context

This project was undertaken as part of **Curtin University’s Consultancy Project Unit (MGMT6052)**.  
Our client, **Maikazconsult**, is a Perth-based consulting and publishing firm expanding into sports technology.

### 🎯 Team Objectives
- Convert the client’s **React web app** into a **mobile-first React Native (Expo)** solution.  
- Redesign the entire **user interface and experience**.  
- Implement **new functionality** including player selection, substitution tracking, and live statistics.  
- Deliver a **demonstration-ready prototype** suitable for further scalability.

> All intellectual property (IP) remains with **Maikazconsult**. The app was developed strictly for educational and client demonstration purposes.

---

## ⚙️ Technologies Used

| Category | Tools & Frameworks |
|-----------|--------------------|
| Mobile Framework | **React Native (Expo Framework)** |
| Language | **TypeScript** |
| Navigation | **Expo Router**, **React Navigation** |
| Data Storage | **AsyncStorage** (local persistence) |
| Graphics | **React Native SVG** (animated progress rings) |
| IDE & Testing | **VS Code**, **Expo Go** |

---

## 🚀 Getting Started

### 🧩 Prerequisites

| Tool | Purpose | Link |
|------|----------|------|
| **Node.js (LTS)** | Run JavaScript locally | [nodejs.org](https://nodejs.org) |
| **Expo CLI** | Manage the app lifecycle | Installed via `npm install -g expo-cli` |
| **Expo Go** | Preview app on device | [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) • [App Store](https://apps.apple.com/app/expo-go/id982107779) |

---

### 💻 Setup & Run

```bash
# 1️⃣ Clone the repository
git clone https://github.com/dimashiii/EzySubs-App.git
cd EzySubs-App

# 2️⃣ Install dependencies
npm install

# 3️⃣ Start the development server
npx expo start
````

Then:

* Open **Expo Go** on your phone
* Scan the **QR code** shown in the terminal or browser
* The app will load automatically

---

## 📱 How to Use

1. **Add Players** – Tap the ➕ icon to add, edit, or remove players.
2. **Select Players** – Choose active players for the current game.
3. **Track Statistics** – View court time and substitutions via animated progress rings.
4. **Offline Storage** – All data saved locally, no internet required.
5. **Safe Exit** – Player data remains after app restart.

---

## 🧩 Folder Structure

```
EzySubs-App/
├── app/
│   ├── game-court/        # Live game interface
│   ├── game-settings/     # Add/manage players & game setup
│   ├── game-stat/         # Player statistics
│   ├── home/              # Home interface
│   ├── onboarding/        # Intro & first-run setup
│   └── index.tsx          # App entry (routes)
│
├── lib/                   # Local storage helpers
├── assets/                # Images, icons, and onboarding visuals
├── package.json           # Dependencies
└── README.md              # Project documentation
```

---

## 📊 Core Features

| Feature                  | Description                                |
| ------------------------ | ------------------------------------------ |
| 🧍 **Roster Management** | Add, edit, and delete player profiles      |
| ⚙️ **Game Setup**        | Configure teams and active lineups         |
| 📈 **Statistics View**   | Track player minutes and substitutions     |
| 🔁 **Progress Rings**    | Visual time indicators with SVG animations |
| 💾 **Offline Storage**   | Persistent data with AsyncStorage          |
| 📱 **Cross-Platform**    | Works on Android & iOS via Expo            |

---

## 🧾 Developer Notes

* Based on the **original React web prototype** from Maikazconsult.
* Fully rebuilt in **React Native (Expo)** for mobile performance.
* Introduced a **modern, card-based UI**, consistent theme, and simpler flow.
* Managed using **Agile Scrum**, with client feedback each iteration.
* Optimized for **portability and volunteer-friendly use**.

---

## 👥 Team Members

**Curtin University – Ezy Subs Consultancy Team**

| Role                               | Name               |
| ---------------------------------- | ------------------ |
| **Project Manager**                | Dimashi Gunasinghe |
| **Scrum Master**                   | Rezwanul Islam     |
| **UI/UX Designer**                 | Liu Yang           |
| **Quality & Testing Lead**         | Sudikshya Shrestha |
| **Documentation & Technical Lead** | Kashan Bin Adil    |

**Client:** Jeremiah Mein (Maikazconsult)
**Supervisor:** Noal Atkinson – Curtin University

---

## 🧩 Troubleshooting

| Issue                   | Cause                          | Solution                                |
| ----------------------- | ------------------------------ | --------------------------------------- |
| **QR code not opening** | Expo Go not installed/outdated | Update Expo Go app                      |
| **Blank screen**        | Missing dependencies           | Run `npm install` then `npx expo start` |
| **App stuck loading**   | Firewall or LAN issue          | Use `expo start --tunnel`               |
| **Missing assets**      | Incorrect folder sync          | Ensure `/assets/` is complete           |

---

## 📸 Screenshots *(optional for later)*

> Add your UI mockups or Expo screenshots here:
>
> ```
> assets/images/home-basketball.png
> assets/onboarding/instruction1.png
> ...
> ```

---

## ⚖️ License

```
Ezy Subs – Basketball Substitution Manager
© 2025 Maikazconsult. All rights reserved.

Developed by the Ezy Subs Team at Curtin University (MGMT6052 Consultancy Project).

Originally based on a web prototype by Maikazconsult.
Rebuilt as a mobile app for educational and client demonstration purposes.

This repository is published publicly for academic and portfolio display only.
Commercial use, redistribution, or modification without written permission from Maikazconsult is strictly prohibited.
```

---

## 📬 Contact

**Project Lead:** Kaluarachchige Dimashi Gunasinghe
📧 [dimzii@Dimashis-MacBook-Pro.local](mailto:dimzii@Dimashis-MacBook-Pro.local)
🌐 [GitHub – dimashiii](https://github.com/dimashiii)
📍 Perth, Western Australia

---

> 💬 *“Built for the court, designed for the coach.”*

