// Load environment variables FIRST before anything else
require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { randomUUID } = require("crypto");
const { docClient, TABLE_NAME } = require("./dynamodb");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

// Get callback URL from environment or use default
const getCallbackURL = () => {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

  // Ensure we have the protocol
  let url = backendUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = process.env.NODE_ENV === 'production' ? `https://${url}` : `http://${url}`;
  }

  const callbackURL = `${url}/api/auth/google/callback`;

  // Log the callback URL for debugging
  console.log('🔐 OAuth Callback URL:', callbackURL);

  return callbackURL;
};

// ── DynamoDB helper: find user by googleId or email ────────────────────────
async function findUserByGoogleIdOrEmail(googleId, email) {
  // 1. Try GSI1 lookup by googleId (fast O(1) path)
  try {
    const byGoogleId = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1_PK = :gid AND GSI1_SK = :meta",
      ExpressionAttributeValues: {
        ":gid": `GOOGLE#${googleId}`,
        ":meta": "METADATA"
      }
    }));
    if (byGoogleId.Items && byGoogleId.Items.length > 0) {
      return byGoogleId.Items[0];
    }
  } catch (e) {
    console.error("GSI1 lookup by googleId failed:", e.message);
  }

  // 2. Try GSI1 lookup by email
  try {
    const byEmail = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1_PK = :em AND GSI1_SK = :meta",
      ExpressionAttributeValues: {
        ":em": `EMAIL#${email.toLowerCase()}`,
        ":meta": "METADATA"
      }
    }));
    if (byEmail.Items && byEmail.Items.length > 0) {
      return byEmail.Items[0];
    }
  } catch (e) {
    console.error("GSI1 lookup by email failed:", e.message);
  }

  return null;
}

// ── DynamoDB helper: find invite by token ─────────────────────────────────
async function findInviteByToken(token) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1_PK = :inv AND GSI1_SK = :meta",
      ExpressionAttributeValues: {
        ":inv": `INVITE#${token}`,
        ":meta": "METADATA"
      }
    }));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (e) {
    console.error("Invite lookup by token failed:", e.message);
    return null;
  }
}

// ── DynamoDB helper: get user by userId (PK) ──────────────────────────────
async function getUserById(userId) {
  // userId is stored as "COMPANY#<companyId>|USER#<userId>" for O(1) lookup
  // We store it differently: the session stores "<companyId>|<userId>"
  const [companyId, uid] = (userId || "").split("|");
  if (!companyId || !uid) return null;
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `COMPANY#${companyId}`, SK: `USER#${uid}` }
    }));
    return result.Item || null;
  } catch (e) {
    console.error("getUserById failed:", e.message);
    return null;
  }
}

// Validate OAuth credentials
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. OAuth will not work.');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL(),
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || !profile.emails[0]) {
          console.error('❌ OAuth Error: No email in profile', profile);
          return done(new Error('No email found in Google profile'), null);
        }

        const email = profile.emails[0].value;
        let user = await findUserByGoogleIdOrEmail(profile.id, email);

        if (!user) {
          let companyId = null;
          let role = "user";

          const inviteToken = req.session && req.session.inviteToken;
          if (inviteToken) {
            console.log('🔗 Found invite token in session:', inviteToken);
            const invite = await findInviteByToken(inviteToken);

            if (invite && !invite.used && new Date() < new Date(invite.expiresAt)) {
              companyId = invite.companyId;
              role = "user";

              // Mark the invite as used
              await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: invite.PK, SK: invite.SK },
                UpdateExpression: "SET #used = :t",
                ExpressionAttributeNames: { "#used": "used" },
                ExpressionAttributeValues: { ":t": true }
              }));
              console.log(`✅ Joined existing company ${companyId} via invite link`);
            } else {
              console.warn('⚠️ Invite token found but is invalid or expired. Falling back to new company creation.');
            }

            // Clean up session token
            delete req.session.inviteToken;
          }

          // If not joining via invite, create a blank company shell and mark as admin
          if (!companyId) {
            companyId = randomUUID();
            const now = new Date().toISOString();
            await docClient.send(new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                PK: `COMPANY#${companyId}`,
                SK: 'METADATA',
                companyId,
                name: null,
                setupComplete: false,
                createdAt: now
              }
            }));
            role = "admin";
            console.log(`🏢 Created blank company shell (ID: ${companyId}) — admin must complete setup`);
          }

          // Create user record
          const userId = randomUUID();
          const now = new Date().toISOString();
          user = {
            PK: `COMPANY#${companyId}`,
            SK: `USER#${userId}`,
            // GSI1: used for lookup by googleId and email
            GSI1_PK: `GOOGLE#${profile.id}`,
            GSI1_SK: "METADATA",
            userId,
            companyId,
            googleId: profile.id,
            email,
            name: profile.displayName,
            role,
            createdAt: now
          };

          await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));

          // Also write an email-lookup record so we can find by email too
          await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              PK: `COMPANY#${companyId}`,
              SK: `EMAIL#${email.toLowerCase()}`,
              GSI1_PK: `EMAIL#${email.toLowerCase()}`,
              GSI1_SK: "METADATA",
              userId,
              companyId
            }
          }));

          console.log('✅ New user created via OAuth:', email, 'Role:', role);
        } else {
          // User exists — if googleId was missing, update it
          if (!user.googleId) {
            await docClient.send(new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { PK: user.PK, SK: user.SK },
              UpdateExpression: "SET googleId = :gid, GSI1_PK = :gsi",
              ExpressionAttributeValues: {
                ":gid": profile.id,
                ":gsi": `GOOGLE#${profile.id}`
              }
            }));
            user.googleId = profile.id;
          }
          console.log('✅ Existing user logged in via OAuth:', email);
        }

        return done(null, user);
      } catch (err) {
        console.error('❌ OAuth Error:', err);
        return done(err, null);
      }
    }
  )
);

// Serialize: store "<companyId>|<userId>" in session
passport.serializeUser((user, done) => {
  done(null, `${user.companyId}|${user.userId}`);
});

// Deserialize: look up full user from DynamoDB
passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    if (!user) {
      console.error("❌ Deserialize failed: user not found for id", id);
    }
    done(null, user);
  } catch (err) {
    console.error("❌ Deserialize user error:", err);
    done(err, null);
  }
});

module.exports = passport;
