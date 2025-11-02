import type { Express, Request } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { setupGoogleAuth } from "./googleAuth";

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Unauthorized");
}

// Setup session middleware
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Setup Passport Local Strategy
export async function setupAuth(app: Express) {
  // Set trust proxy for session cookies
  app.set("trust proxy", 1);

  // Setup session middleware BEFORE passport
  app.use(getSession());
  
  // Configure Passport Local Strategy
  passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: "Invalid username or password" });
      }

      // Check if user has a password (OAuth users might not have one)
      if (!user.password) {
        return done(null, false, { message: "Please sign in with Google" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: "Invalid username or password" });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    // Handle pending Google users (they don't have an id yet)
    if (user.isNewGoogleUser) {
      done(null, { isNewGoogleUser: true, data: user });
    } else {
      done(null, { isNewGoogleUser: false, id: user.id });
    }
  });

  // Deserialize user from session
  passport.deserializeUser(async (data: any, done) => {
    try {
      // Handle pending Google users
      if (data.isNewGoogleUser) {
        return done(null, data.data);
      }

      // Handle regular users
      const user = await storage.getUser(data.id);
      if (!user) {
        // User not found - clear the session
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      // Return false instead of error to clear invalid sessions
      done(null, false);
    }
  });

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup Google OAuth
  await setupGoogleAuth(app);

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, role } = req.body;

      // Validate inputs
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email, and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      if (!["creator", "company"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with all required fields
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role,
        accountStatus: 'active', // ✅ Required field
        profileImageUrl: null,   // ✅ Required field
      });

      // Create profile based on role
      if (role === 'creator') {
        await storage.createCreatorProfile({
          userId: user.id,
          bio: null,
          youtubeUrl: null,
          tiktokUrl: null,
          instagramUrl: null,
          youtubeFollowers: null,
          tiktokFollowers: null,
          instagramFollowers: null,
          niches: [],
        });
      } else if (role === 'company') {
        await storage.createCompanyProfile({
          userId: user.id,
          legalName: username,
          tradeName: null,
          websiteUrl: null,
          description: null,
          logoUrl: null,
          industry: null,
          companySize: null,
          yearFounded: null,
          contactName: null,
          contactJobTitle: null,
          phoneNumber: null,
          businessAddress: null,
          verificationDocumentUrl: null,
          status: 'pending',
          rejectionReason: null,
        });
      }

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }

      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session login error:", loginErr);
          return res.status(500).json({ error: "Login failed" });
        }
        
        res.json({ 
          success: true, 
          user: { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            role: user.role 
          },
          role: user.role
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}