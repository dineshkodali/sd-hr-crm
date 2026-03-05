# SD HR CRM - Human Resources & Case Management System

A comprehensive HR and case management system built with React (Vite) frontend and Node.js/Express backend.

## 🚀 Features

- **User Management** - Role-based access control (Admin, Manager, Staff)
- **Authentication** - JWT-based auth with 2FA support (TOTP & Email OTP)
- **Hotels & Rooms Management** - Manage properties and accommodations
- **Service Users** - Track and manage service user information
- **HR Management** - Employee records, payroll, performance tracking
- **Case Management** - Comprehensive case tracking and documentation
- **Compliance & Audits** - HSE compliance, risk assessments, inspections
- **Email Notifications** - Automated email system with OTP delivery
- **Forms Builder** - Dynamic form creation and management
- **Reporting & Analytics** - Dashboard with charts and data visualization

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## 🛠️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/sd-hr-crm.git
cd sd-hr-crm
```

### 2. Install Dependencies
```bash
# Install root dependencies and bootstrap both frontend and backend
npm run bootstrap

# Or install all at once
npm run install-all
```

### 3. Configure Environment Variables

**Backend (.env)**
```bash
cd Backend
cp .env.example .env
# Edit .env with your configuration
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS` - Email configuration

**Frontend (.env)**
```bash
cd frontend
cp .env.example .env
# Edit .env if needed (optional for local dev)
```

### 4. Setup Database

Create a PostgreSQL database and run migrations:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE sd_hr_crm;

# Run schema scripts (if available)
# psql -U postgres -d sd_hr_crm -f Backend/scripts/schema.sql
```

### 5. Run Development Servers

```bash
# From root directory - runs both frontend and backend
npm run dev

# Or run separately:
npm run frontend  # Frontend on http://localhost:443
npm run backend   # Backend on http://localhost:4000
```

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:

- AWS Amplify (Frontend)
- AWS Elastic Beanstalk (Backend)
- AWS RDS (Database)
- Environment configuration
- CI/CD setup

### Quick Deploy to AWS Amplify

1. Push code to GitHub
2. Connect repository to AWS Amplify
3. Amplify will auto-detect `amplify.yml` configuration
4. Set environment variables in Amplify Console
5. Deploy!

## 📁 Project Structure

```
sd-hr-crm/
├── Backend/                 # Node.js/Express API
│   ├── config/             # Database and email configuration
│   ├── controllers/        # Business logic
│   ├── middleware/         # Auth and validation middleware
│   ├── routes/             # API endpoints
│   ├── utils/              # Helper functions
│   ├── server.js           # Entry point
│   └── package.json
├── frontend/               # React/Vite application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── src/                # Source files
│   ├── utils/              # Frontend utilities
│   ├── vite.config.js      # Vite configuration
│   └── package.json
├── amplify.yml             # AWS Amplify build config
├── DEPLOYMENT.md           # Deployment guide
└── package.json            # Root package.json
```

## 🔐 Authentication

The system supports multiple authentication methods:

1. **Email/Password** - Basic authentication
2. **TOTP (Authenticator App)** - Google Authenticator, Authy, etc.
3. **Email OTP** - One-time password sent via email
4. **Backup Codes** - Recovery codes for account access

## 📧 Email Configuration

Configure email settings for OTP delivery:

**Using Outlook:**
```env
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
EMAIL_FROM=your-email@outlook.com
```

**Using Gmail:**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

Note: Gmail requires an [App Password](https://myaccount.google.com/apppasswords) if 2FA is enabled.

## 🧪 Testing

```bash
# Test frontend build
cd frontend
npm run build
npm run preview

# Test backend
cd Backend
npm start
```

## 📦 Available Scripts

### Root Level
- `npm run bootstrap` - Install dependencies for frontend and backend
- `npm run dev` - Run both frontend and backend in development mode
- `npm run frontend` - Run only frontend
- `npm run backend` - Run only backend
- `npm run install-all` - Force install all dependencies

### Frontend
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend
- `npm start` - Start production server
- `npm run dev` - Start with nodemon (auto-reload)

## 🔧 Configuration Files

- `amplify.yml` - AWS Amplify build configuration
- `vite.config.js` - Vite bundler configuration
- `tailwind.config.cjs` - Tailwind CSS configuration
- `.env.example` - Environment variables template

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4000 (backend)
npx kill-port 4000

# Kill process on port 443 (frontend)
npx kill-port 443
```

### Database Connection Issues
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists

### Email Not Sending
- Verify email credentials in `.env`
- Check email service configuration
- Review backend logs for errors

## 📄 License

ISC

## 👥 Contributors

- Development Team

## 🆘 Support

For issues and questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
2. Review backend logs for errors
3. Check browser console for frontend issues

---

**Built with ❤️ using React, Node.js, PostgreSQL, and AWS**
