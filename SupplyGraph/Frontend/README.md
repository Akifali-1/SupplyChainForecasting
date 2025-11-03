# SupplyGraph Frontend

Modern React-based frontend application for supply chain demand forecasting with GAT+LSTM models.

## 🚀 Features

- **User Authentication**: Google OAuth integration
- **Data Upload**: Intuitive CSV file upload interface
- **Model Training**: Fine-tune company-specific models
- **Demand Predictions**: Real-time forecasting with confidence scores
- **Historical Analytics**: Interactive charts with product filtering
- **Inventory Management**: Track and manage supply chain inventory
- **Dark Mode**: Theme switching support
- **Responsive Design**: Works on desktop and mobile devices

## 📦 Tech Stack

- **React 19** - UI library
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - Component library (Radix UI + Tailwind)
- **Chart.js** - Data visualization
- **Axios** - HTTP client
- **React Hook Form** - Form management
- **Zod** - Schema validation

## 🛠️ Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. **Install Dependencies**:
   ```bash
   cd Frontend
   npm install
   ```

2. **Environment Variables**:
   
   Create a `.env` file in the `Frontend` directory:
   ```env
   REACT_APP_API_BASE=http://localhost:5000
   ```

   > ⚠️ **Note**: Never commit `.env` files. They are already in `.gitignore`.

3. **Start Development Server**:
   ```bash
   npm start
   ```
   
   The app will open at `http://localhost:3000`

## 📱 Pages & Routes

### Public Routes
- `/` - Homepage
- `/login` - User login
- `/register` - User registration

### Protected Routes
- `/upload` - Upload CSV data
- `/prediction` - Demand prediction dashboard
- `/inventory` - Inventory management

## 🎨 UI Components

### Built with Shadcn UI

The frontend uses Shadcn UI components built on Radix UI:
- Buttons, Cards, Inputs, Labels
- Dialogs, Dropdowns, Tabs
- Toast notifications
- Progress indicators
- And many more...

### Theme Support

The app supports light and dark themes:
- Toggle via `ThemeToggle` component
- Theme state managed by `ThemeContext`
- Persisted across sessions

## 📊 Features in Detail

### 1. Data Upload (`/upload`)

- **Drag & Drop**: Upload CSV files via drag-and-drop or upload from you storage
- **File Validation**: Checks file format and size
- **Progress Tracking**: Real-time upload progress
- **Multiple Formats**: Supports wide, long, and single dataset formats

### 2. Prediction Dashboard (`/prediction`)

- **Product Selection**: Choose specific products for prediction
- **Real-time Predictions**: Get instant demand forecasts
- **Confidence Scores**: View prediction confidence levels
- **Historical Charts**: Visualize past demand trends
- **Time Aggregation**: Filter by 15-day, 30-day intervals

### 3. Inventory Management (`/inventory`)

- **Inventory Tracking**: Monitor supply chain inventory
- **Trending Items**: Identify high-demand products
- **Stock Alerts**: Get notified of low stock levels

### 4. Historical Analytics

- **Product Filtering**: Filter data by specific products
- **Time Intervals**: Aggregate data by day/week/month
- **Interactive Charts**: Zoom, pan, and explore data
- **Export Options**: Download chart data

## 🔌 API Integration

The frontend communicates with the backend via the API client (`src/lib/api.js`):

## 🎯 State Management

### Contexts

1. **AuthContext**: Manages user authentication state
   - `user` - Current user object
   - `isAuthenticated` - Authentication status
   - `login()` - Login function
   - `logout()` - Logout function

2. **ThemeContext**: Manages theme state
   - `theme` - Current theme ('light' | 'dark')
   - `setTheme()` - Change theme function

## 🎨 Styling

### Tailwind CSS

The project uses Tailwind CSS for styling:
- Utility-first approach
- Custom color scheme
- Dark mode support
- Responsive design utilities

### Custom Configuration

See `tailwind.config.js` for:
- Custom color palette
- Theme variables
- Animation definitions
- Plugin configuration

## 🧪 Development

### Available Scripts

```bash
# Start development server
npm start

# Build for production
npm run build


### Development Tips

1. **Hot Reload**: React Fast Refresh enabled by default
2. **API Proxy**: Configure proxy in `package.json` if needed
3. **Environment Variables**: Use `REACT_APP_*` prefix for env vars
4. **Component Library**: Extend Shadcn UI components as needed

## 📦 Building for Production

1. **Build the App**:
   ```bash
   npm run build
   ```

2. **Output**: Production build in `build/` directory

3. **Deploy**: Serve `build/` directory with a static file server

### Environment Variables for Production

```env
REACT_APP_API_BASE=https://your-api-domain.com
```

## 🔧 Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify `REACT_APP_API_BASE` in `.env`
   - Check backend is running on correct port
   - Verify CORS settings on backend

2. **OAuth Not Working**
   - Check Google OAuth configuration
   - Verify callback URL in Google Cloud Console
   - Ensure backend OAuth routes are accessible

3. **Build Errors**
   - Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Review error messages in console

4. **Theme Not Persisting**
   - Check browser localStorage access
   - Verify ThemeContext implementation
   - Clear browser cache

## 📚 Related Documentation

- **Main README**: `../README.md` - Project overview
- **Backend README**: `../Backend/README.md` - Backend API documentation

---

**Built with React 19, Tailwind CSS UI**
