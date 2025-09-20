# Google OAuth Setup Guide

This guide will help you complete the Google OAuth setup for the Supply Chain Forecasting application.

## Prerequisites

- Google Cloud Platform account
- Node.js and npm installed
- MongoDB Atlas account (already configured)

## Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback`
   - Copy the Client ID and Client Secret

## Step 2: Configure Environment Variables

1. Open the `.env` file in the Backend directory
2. Replace the placeholder values with your actual Google OAuth credentials:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
```

3. Update the session secret for production:

```env
SESSION_SECRET=your_very_secure_random_session_secret_here
```

## Step 3: Install Dependencies

Make sure all required dependencies are installed:

```bash
cd SupplyGraph/Backend
npm install
```

## Step 4: Start the Application

1. Start the backend server:
```bash
cd SupplyGraph/Backend
npm start
```

2. Start the frontend (in a new terminal):
```bash
cd SupplyGraph/Frontend
npm start
```

## Step 5: Test the OAuth Flow

1. Navigate to `http://localhost:3000`
2. Click "Sign In"
3. Click "Continue with Google"
4. Complete the Google OAuth flow
5. You should be redirected back to the application and logged in

## Features Implemented

### Backend
- ✅ Google OAuth strategy with Passport.js
- ✅ Session management with express-session
- ✅ User model with Google ID integration
- ✅ OAuth routes (`/api/auth/google`, `/api/auth/google/callback`, `/api/auth/logout`, `/api/auth/me`)
- ✅ CORS configuration for frontend integration

### Frontend
- ✅ Google OAuth button in Login component
- ✅ OAuth callback handler
- ✅ Session-based authentication with fallback to localStorage
- ✅ Error handling for OAuth failures
- ✅ Loading states during authentication

## Security Notes

1. **Environment Variables**: Never commit the `.env` file to version control
2. **Session Secret**: Use a strong, random session secret in production
3. **HTTPS**: In production, use HTTPS for both frontend and backend
4. **Domain Configuration**: Update OAuth redirect URIs for production domains

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**:
   - Ensure the redirect URI in Google Console matches exactly: `http://localhost:5000/api/auth/google/callback`

2. **"invalid_client" error**:
   - Check that your Google Client ID and Secret are correct in the `.env` file

3. **Session not persisting**:
   - Ensure CORS is configured with `credentials: true`
   - Check that the session secret is set

4. **Frontend not redirecting after OAuth**:
   - Check that the backend is running on port 5000
   - Verify the OAuth callback route is working

### Testing OAuth Endpoints

You can test the OAuth endpoints directly:

- **Start OAuth**: `http://localhost:5000/api/auth/google`
- **Get current user**: `http://localhost:5000/api/auth/me`
- **Logout**: `http://localhost:5000/api/auth/logout`

## Next Steps

1. Set up Google OAuth credentials as described above
2. Update the `.env` file with your credentials
3. Test the complete OAuth flow
4. Deploy to production with proper domain configuration

The OAuth implementation is now complete and ready for use!
