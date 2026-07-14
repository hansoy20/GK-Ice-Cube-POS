# 🧊 GK Ice Cube — POS & Inventory Management System

A web-based Point of Sale (POS) and Inventory Management System built for GK Ice Cube. It simplifies daily operations by managing ice production, tracking inventory, recording sales, and generating financial reports.

## Features

- 🧊 Record and monitor daily ice production
- 📊 Track available inventory and carryover stock
- 💰 Record Pickup and Delivery sales transactions
- ⚙️ Configure pricing and production costs
- 📈 Automatically calculate revenue, production costs, and net profit
- 📅 View Daily, Weekly, and Monthly reports
- 🚫 Prevent sales that exceed available inventory

## Tech Stack

- **Frontend:** React 19, Vite
- **Backend & Database:** Supabase (PostgreSQL)
- **Styling:** Custom CSS
- **Libraries:** Lucide React, date-fns

## Getting Started

\`\`\`bash
# Clone the repo
git clone https://github.com/your-username/gk-ice-cube-pos.git
cd gk-ice-cube-pos

# Install dependencies
npm install

# Add your Supabase credentials to a .env file
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Run the app
npm run dev
\`\`\`

## License

MIT
