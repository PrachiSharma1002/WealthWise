# WealthWise

An intelligent personal finance platform built with the MERN stack. It does more than log spending: it explains why spending changed, forecasts next month, and suggests what to do.

## Features

- **Accounts:** register and log in with JWT tokens, and protected pages
- **Transactions:** income and expenses sorted into Needs, Lifestyle and Savings, with sub-categories you can add yourself, plus search, filters, edit and delete
- **Budgets:** monthly limits with progress bars, budgets created and carried forward automatically, a custom income split (for example 40 / 25 / 35), and rule-based suggestions
- **Goals:** progress, a saving history, a measured saving pace, estimated finish dates, on-track or behind status, and plain-English advice
- **Insights:** this month against last month, unusual-spending alerts, a next-month forecast, recurring-payment detection, and a Financial Health Score out of 100
- **Dashboard:** summary cards, a 6-month trend chart, a spending donut chart, a plan-versus-actual chart, goals, recurring payments and recent transactions
- **Notifications:** in-app alerts for budgets, goals and payments, with a navbar bell

## Tech stack

- **Frontend:** React (Vite), React Router, Axios, Recharts
- **Backend:** Node.js, Express, Mongoose, JSON Web Tokens, bcrypt
- **Database:** MongoDB Atlas

## Running it on your computer

You need Node.js and a MongoDB Atlas cluster.

1. Clone the project and open it.
2. In `backend`, copy `.env.example` to `.env` and fill in your own values.
3. Start the backend:
cd backend
npm install
npm run dev
4. In a second terminal, start the frontend:
cd frontend
npm install
npm run dev
5. Open http://localhost:5173

If the backend cannot connect to the database, check that your current IP address is on the Atlas **Network Access** list.

## Tests

The money math (spending analysis, trends, forecast, recurring payments, health score, goals and alerts) has automatic tests:

cd backend
npm test


## Project structure