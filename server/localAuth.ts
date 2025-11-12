import type { Express, Request } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { setupGoogleAuth } from "./googleAuth";
import crypto from "crypto";
import { NotificationService } from "./notifications/notificationService";

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Unauthorized");
}

// Middleware to check if user's email is verified
export function isEmailVerified(req: Request, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as any;
  if (!user.emailVerified) {
    return res.status(403).json({
      error: "Email verification required",
      message: "Please verify your email address to perform this action.",
      emailVerified: false
    });
  }

  next();
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

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

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
        emailVerified: false,    // Email not verified yet
        emailVerificationToken,
        emailVerificationTokenExpiry,
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
        const companyProfile = await storage.createCompanyProfile({
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

        // Notify all admins about new company registration
        try {
          const notificationService = new NotificationService(storage);
          const adminUsers = await storage.getUsersByRole('admin');

          console.log(`[Auth] Company profile created with ID: ${companyProfile.id} for user ${username} (User ID: ${user.id})`);

          for (const admin of adminUsers) {
            await notificationService.sendNotification(
              admin.id,
              'new_application',
              'New Company Registration',
              `${username} has registered as a new company and is awaiting approval.`,
              {
                companyName: username,
                companyUserId: user.id,
                linkUrl: `/admin/companies/${companyProfile.id}`
              }
            );
          }
          console.log(`[Auth] Notified ${adminUsers.length} admin(s) about new company registration: ${username} (Company Profile ID: ${companyProfile.id})`);
        } catch (notificationError) {
          console.error('[Auth] Failed to send admin notification for new company registration:', notificationError);
          // Don't fail registration if notification fails
        }
      }

      // Send email verification email
      try {
        const notificationService = new NotificationService(storage);
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}`;
        await notificationService.sendEmailNotification(
          email,
          'email_verification',
          {
            userName: firstName || username,
            verificationUrl,
            linkUrl: verificationUrl,
          }
        );
        console.log(`[Auth] Verification email sent to ${email}`);
      } catch (emailError) {
        console.error('[Auth] Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            emailVerified: user.emailVerified
          },
          message: "Registration successful! Please check your email to verify your account."
        });
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

  // Update account information (username, firstName, lastName)
  app.put("/api/auth/account", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { username, firstName, lastName } = req.body;

      // Validate required fields
      if (!username || !username.trim()) {
        return res.status(400).json({ error: "Username is required" });
      }

      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username.trim());
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Username is already taken" });
      }

      // Update user
      const updatedUser = await storage.updateUser(userId, {
        username: username.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating account:", error);
      res.status(500).json({ error: error.message || "Failed to update account" });
    }
  });

  // Change password
  app.put("/api/auth/password", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { currentPassword, newPassword } = req.body;

      // Validate required fields
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a password (OAuth users don't)
      if (!user.password) {
        return res.status(400).json({ error: "Cannot change password for OAuth accounts" });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword,
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: error.message || "Failed to change password" });
    }
  });

  // Change email endpoint
  app.put("/api/auth/email", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { newEmail, password } = req.body;

      // Validate email format
      if (!newEmail || !newEmail.trim()) {
        return res.status(400).json({ error: "New email is required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }

      const normalizedEmail = newEmail.trim().toLowerCase();

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if new email is same as current
      if (normalizedEmail === user.email.toLowerCase()) {
        return res.status(400).json({ error: "New email must be different from current email" });
      }

      // Verify password for non-OAuth users
      if (user.password && !user.googleId) {
        if (!password) {
          return res.status(400).json({ error: "Password is required to change email" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Incorrect password" });
        }
      }

      // Check if email is already in use
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ error: "Email address is already in use" });
      }

      // Update user email
      const updatedUser = await storage.updateUser(userId, {
        email: normalizedEmail,
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update email" });
      }

      // Send verification email to new address
      try {
        const notificationService = new NotificationService(storage);
        await notificationService.sendEmailVerification(updatedUser);
        console.log(`[Auth] Email verification sent to ${normalizedEmail}`);
      } catch (emailError) {
        console.error('[Auth] Failed to send verification email:', emailError);
        // Don't fail the email change if verification email fails
      }

      res.json({
        success: true,
        message: "Email updated successfully. Please check your new email for verification.",
      });
    } catch (error: any) {
      console.error("Error changing email:", error);
      res.status(500).json({ error: error.message || "Failed to change email" });
    }
  });

  // Email verification endpoint
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }

      // Find user by verification token
      const user = await storage.getUserByEmailVerificationToken(token);

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }

      // Check if token is expired
      if (user.emailVerificationTokenExpiry && new Date() > user.emailVerificationTokenExpiry) {
        return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
      }

      // Update user - set emailVerified to true and clear verification token
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      });

      res.json({ success: true, message: "Email verified successfully!" });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: error.message || "Email verification failed" });
    }
  });

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token
      await storage.updateUser(userId, {
        emailVerificationToken,
        emailVerificationTokenExpiry,
      });

      // Send verification email
      const notificationService = new NotificationService(storage);
      const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}`;
      await notificationService.sendEmailNotification(
        user.email,
        'email_verification',
        {
          userName: user.firstName || user.username,
          verificationUrl,
          linkUrl: verificationUrl,
        }
      );

      res.json({ success: true, message: "Verification email sent successfully!" });
    } catch (error: any) {
      console.error("Resend verification email error:", error);
      res.status(500).json({ error: error.message || "Failed to send verification email" });
    }
  });

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);

      // Don't reveal if email exists or not for security
      if (!user) {
        return res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });
      }

      // Check if user has a password (OAuth users don't)
      if (!user.password) {
        return res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });
      }

      // Generate password reset token
      const passwordResetToken = crypto.randomBytes(32).toString('hex');
      const passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      await storage.updateUser(user.id, {
        passwordResetToken,
        passwordResetTokenExpiry,
      });

      // Send password reset email
      const notificationService = new NotificationService(storage);
      const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${passwordResetToken}`;
      await notificationService.sendEmailNotification(
        user.email,
        'password_reset',
        {
          userName: user.firstName || user.username,
          resetUrl,
          linkUrl: resetUrl,
        }
      );

      res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset password endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Find user by reset token
      const user = await storage.getUserByPasswordResetToken(token);

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (user.passwordResetTokenExpiry && new Date() > user.passwordResetTokenExpiry) {
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user - set new password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      });

      res.json({ success: true, message: "Password reset successfully!" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: error.message || "Password reset failed" });
    }
  });

  // GDPR/CCPA: Export user data
  app.get("/api/user/export-data", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Collect all user data
      const exportData: any = {
        exportDate: new Date().toISOString(),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };

      // Get profile data based on role
      if (user.role === 'creator') {
        const profile = await storage.getCreatorProfile(userId);
        if (profile) {
          exportData.creatorProfile = {
            bio: profile.bio,
            youtubeUrl: profile.youtubeUrl,
            tiktokUrl: profile.tiktokUrl,
            instagramUrl: profile.instagramUrl,
            youtubeFollowers: profile.youtubeFollowers,
            tiktokFollowers: profile.tiktokFollowers,
            instagramFollowers: profile.instagramFollowers,
            niches: profile.niches,
          };
        }

        // Get creator applications
        const applications = await storage.getApplicationsByCreator(userId);
        exportData.applications = applications.map(app => ({
          id: app.id,
          offerId: app.offerId,
          status: app.status,
          message: app.message,
          trackingCode: app.trackingCode,
          createdAt: app.createdAt,
          approvedAt: app.approvedAt,
          completedAt: app.completedAt,
        }));

        // Get creator analytics
        const analytics = await storage.getAnalyticsByCreator(userId);
        exportData.analytics = analytics;

        // Get creator reviews
        const reviews = await storage.getReviewsByCreator(userId);
        exportData.reviews = reviews;

        // Get creator favorites
        const favorites = await storage.getFavoritesByCreator(userId);
        exportData.favorites = favorites;

        // Get creator payments
        const payments = await storage.getPaymentsByCreator(userId);
        exportData.payments = payments.map(payment => ({
          id: payment.id,
          grossAmount: payment.grossAmount,
          platformFeeAmount: payment.platformFeeAmount,
          stripeFeeAmount: payment.stripeFeeAmount,
          netAmount: payment.netAmount,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          description: payment.description,
          initiatedAt: payment.initiatedAt,
          completedAt: payment.completedAt,
        }));

        // Get payment settings (sanitized)
        const paymentSettings = await storage.getPaymentSettings(userId);
        exportData.paymentSettings = paymentSettings.map(setting => ({
          id: setting.id,
          payoutMethod: setting.payoutMethod,
          payoutEmail: setting.payoutEmail,
          isDefault: setting.isDefault,
        }));
      } else if (user.role === 'company') {
        const profile = await storage.getCompanyProfile(userId);
        if (profile) {
          exportData.companyProfile = {
            legalName: profile.legalName,
            tradeName: profile.tradeName,
            industry: profile.industry,
            websiteUrl: profile.websiteUrl,
            companySize: profile.companySize,
            yearFounded: profile.yearFounded,
            description: profile.description,
            contactName: profile.contactName,
            phoneNumber: profile.phoneNumber,
            businessAddress: profile.businessAddress,
            status: profile.status,
            approvedAt: profile.approvedAt,
          };

          // Get company offers
          const offers = await storage.getOffersByCompany(profile.id);
          exportData.offers = offers.map(offer => ({
            id: offer.id,
            title: offer.title,
            productName: offer.productName,
            shortDescription: offer.shortDescription,
            fullDescription: offer.fullDescription,
            status: offer.status,
            commissionType: offer.commissionType,
            commissionAmount: offer.commissionAmount,
            commissionPercentage: offer.commissionPercentage,
            createdAt: offer.createdAt,
            approvedAt: offer.approvedAt,
          }));

          // Get company applications
          const applications = await storage.getApplicationsByCompany(profile.id);
          exportData.applications = applications;

          // Get company reviews
          const reviews = await storage.getReviewsByCompany(profile.id);
          exportData.reviews = reviews;
        }
      }

      // Get messages (all users)
      const conversations = await storage.getConversationsByUser(userId, user.role);
      const messages = [];
      for (const conv of conversations) {
        const convMessages = await storage.getMessages(conv.id);
        messages.push(...convMessages);
      }
      exportData.messages = messages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        content: msg.content,
        attachments: msg.attachments || [],
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        sentByMe: msg.senderId === userId,
      }));

      // Get notifications
      const notifications = await storage.getNotifications(userId);
      exportData.notifications = notifications;

      // Get notification preferences
      const notificationPreferences = await storage.getUserNotificationPreferences(userId);
      exportData.notificationPreferences = notificationPreferences;

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Export data error:", error);
      res.status(500).json({ error: error.message || "Failed to export data" });
    }
  });

  // GDPR/CCPA: Delete account
  app.post("/api/user/delete-account", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { password } = req.body;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent admin users from deleting their accounts
      if (user.role === 'admin') {
        return res.status(403).json({
          error: "Admin accounts cannot be deleted",
          details: "For security reasons, administrator accounts cannot be deleted through the settings page. Please contact system support if you need to deactivate an admin account."
        });
      }

      // Verify password for non-OAuth users
      if (user.password && !user.googleId) {
        if (!password) {
          return res.status(400).json({ error: "Password is required to delete your account" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Incorrect password" });
        }
      }

      // Check for active applications/contracts/retainers
      let applications = [];
      let activeItems: any = {
        applications: [],
        retainerContracts: [],
        retainerApplications: [],
        offers: [],
        pendingPayments: []
      };

      if (user.role === 'creator') {
        // Check for active applications
        applications = await storage.getApplicationsByCreator(userId);
        const activeApps = applications.filter(app =>
          app.status === 'active' || app.status === 'approved'
        );
        activeItems.applications = activeApps;

        // Check for active retainer contracts where creator is assigned
        const creatorContracts = await storage.getRetainerContractsByCreator(userId);
        const activeContracts = creatorContracts.filter(contract =>
          contract.status === 'in_progress' || contract.status === 'open'
        );
        activeItems.retainerContracts = activeContracts;

        // Check for pending retainer applications
        const retainerApplications = await storage.getRetainerApplicationsByCreator(userId);
        const pendingRetainerApps = retainerApplications.filter(app =>
          app.status === 'pending'
        );
        activeItems.retainerApplications = pendingRetainerApps;

        // Check for pending payments
        const payments = await storage.getPaymentsByCreator(userId);
        const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing');
        activeItems.pendingPayments = pendingPayments;

        // If there are any active items, return error with details
        const hasActiveItems = activeApps.length > 0 || activeContracts.length > 0 ||
                               pendingRetainerApps.length > 0 || pendingPayments.length > 0;

        if (hasActiveItems) {
          return res.status(400).json({
            error: "Cannot delete account with active activities",
            details: {
              applications: activeApps.length,
              retainerContracts: activeContracts.length,
              retainerApplications: pendingRetainerApps.length,
              pendingPayments: pendingPayments.length
            },
            activeItems: activeItems
          });
        }
      } else if (user.role === 'company') {
        const profile = await storage.getCompanyProfile(userId);
        if (profile) {
          // Check for active applications
          applications = await storage.getApplicationsByCompany(profile.id);
          const activeApps = applications.filter(app =>
            app.status === 'active' || app.status === 'approved'
          );
          activeItems.applications = activeApps;

          // Check for active offers with applications
          const offers = await storage.getOffersByCompany(profile.id);
          const offersWithApps = [];
          for (const offer of offers) {
            const offerApps = applications.filter(app => app.offerId === offer.id);
            if (offerApps.length > 0 && offer.status === 'approved') {
              offersWithApps.push({
                ...offer,
                applicationCount: offerApps.length
              });
            }
          }
          activeItems.offers = offersWithApps;

          // Check for active retainer contracts
          const companyContracts = await storage.getRetainerContractsByCompany(profile.id);
          const activeContracts = companyContracts.filter(contract =>
            contract.status === 'in_progress' || contract.status === 'open'
          );
          activeItems.retainerContracts = activeContracts;

          // Check for pending payments
          const { db } = await import('./db');
          const { retainerPayments } = await import('../shared/schema');
          const { eq } = await import('drizzle-orm');
          const payments = await db.select().from(retainerPayments).where(eq(retainerPayments.companyId, profile.id));
          const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing');
          activeItems.pendingPayments = pendingPayments;

          // If there are any active items, return error with details
          const hasActiveItems = activeApps.length > 0 || offersWithApps.length > 0 ||
                               activeContracts.length > 0 || pendingPayments.length > 0;

          if (hasActiveItems) {
            return res.status(400).json({
              error: "Cannot delete account with active activities",
              details: {
                applications: activeApps.length,
                offersWithApplications: offersWithApps.length,
                retainerContracts: activeContracts.length,
                pendingPayments: pendingPayments.length
              },
              activeItems: activeItems
            });
          }
        }
      }

      // Start account deletion process
      console.log(`[Account Deletion] Starting deletion for user ${userId} (${user.email})`);

      // Import ObjectStorageService to delete Cloudinary files
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorage = new ObjectStorageService();

      // 1. Delete ALL Cloudinary files/folders for this user
      console.log(`[Account Deletion] Deleting all Cloudinary files for user ${userId}`);

      try {
        // Delete user profile folder (contains profile images)
        await objectStorage.deleteFolder(`affiliatexchange/user-profiles/${userId}`);
        console.log(`[Account Deletion] Deleted user profile folder`);
      } catch (error: any) {
        console.error(`[Account Deletion] Error deleting user profile folder:`, error.message);
      }

      if (user.role === 'creator') {
        try {
          // Delete creator-specific folders
          const creatorProfile = await storage.getCreatorProfile(userId);
          if (creatorProfile) {
            // Delete retainer deliverables folder
            await objectStorage.deleteFolder(`affiliatexchange/retainer-deliverables/${userId}`);
            console.log(`[Account Deletion] Deleted creator retainer deliverables folder`);

            // Delete any creator-specific content
            await objectStorage.deleteFolder(`affiliatexchange/creator-content/${userId}`);
            console.log(`[Account Deletion] Deleted creator content folder`);
          }
        } catch (error: any) {
          console.error(`[Account Deletion] Error deleting creator folders:`, error.message);
        }

        // Delete message attachments for creator conversations
        try {
          const { db } = await import('./db');
          const { conversations, messages } = await import('../shared/schema');
          const { eq } = await import('drizzle-orm');

          const creatorConversations = await db.select().from(conversations).where(eq(conversations.creatorId, userId));

          for (const conversation of creatorConversations) {
            await objectStorage.deleteFolder(`affiliatexchange/messages/${conversation.id}`);
          }
          console.log(`[Account Deletion] Deleted creator message attachments`);
        } catch (error: any) {
          console.error(`[Account Deletion] Error deleting creator message folders:`, error.message);
        }

      } else if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (companyProfile) {
          try {
            // Delete company-specific folders
            await objectStorage.deleteFolder(`affiliatexchange/company-logos/${companyProfile.id}`);
            console.log(`[Account Deletion] Deleted company logo folder`);

            await objectStorage.deleteFolder(`affiliatexchange/verification-documents/${userId}`);
            console.log(`[Account Deletion] Deleted verification documents folder`);

            await objectStorage.deleteFolder(`affiliatexchange/offers/${companyProfile.id}`);
            console.log(`[Account Deletion] Deleted company offers folder`);

            await objectStorage.deleteFolder(`affiliatexchange/retainer-contracts/${companyProfile.id}`);
            console.log(`[Account Deletion] Deleted retainer contracts folder`);
          } catch (error: any) {
            console.error(`[Account Deletion] Error deleting company folders:`, error.message);
          }

          // Delete message attachments for company conversations
          try {
            const { db } = await import('./db');
            const { conversations } = await import('../shared/schema');
            const { eq } = await import('drizzle-orm');

            const companyConversations = await db.select().from(conversations).where(eq(conversations.companyId, companyProfile.id));

            for (const conversation of companyConversations) {
              await objectStorage.deleteFolder(`affiliatexchange/messages/${conversation.id}`);
            }
            console.log(`[Account Deletion] Deleted company message attachments`);
          } catch (error: any) {
            console.error(`[Account Deletion] Error deleting company message folders:`, error.message);
          }
        }
      }

      // Delete any other user-related folders
      try {
        await objectStorage.deleteFolder(`affiliatexchange/users/${userId}`);
        console.log(`[Account Deletion] Deleted general user folder`);
      } catch (error: any) {
        console.error(`[Account Deletion] Error deleting general user folder:`, error.message);
      }

      // 2. Anonymize reviews (keep review content but anonymize author)
      const reviews = user.role === 'creator'
        ? await storage.getReviewsByCreator(userId)
        : [];

      console.log(`[Account Deletion] Anonymizing ${reviews.length} reviews`);
      // Reviews will be cascade deleted or anonymized through foreign key constraints

      // 3. Anonymize messages (keep messages but anonymize sender)
      // Messages will be handled through cascade delete on conversations

      // 4. Delete personal information from user table
      await storage.updateUser(userId, {
        email: `deleted-${userId}@deleted.user`,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        password: null,
        googleId: null,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
        accountStatus: 'banned', // Mark as banned to prevent re-activation
      });

      // 5. Delete payment settings (cascade will handle)
      const paymentSettings = await storage.getPaymentSettings(userId);
      for (const setting of paymentSettings) {
        await storage.deletePaymentSetting(setting.id);
      }

      // 6. Delete favorites (cascade will handle)
      if (user.role === 'creator') {
        const favorites = await storage.getFavoritesByCreator(userId);
        for (const fav of favorites) {
          await storage.deleteFavorite(userId, fav.offerId);
        }
      }

      // 7. Delete applications (if no active ones)
      // These will be cascade deleted through database constraints

      // 8. Delete notifications
      const notifications = await storage.getNotifications(userId);
      for (const notif of notifications) {
        await storage.deleteNotification(notif.id);
      }

      // 9. Send confirmation email before final deletion
      try {
        const notificationService = new NotificationService(storage);
        await notificationService.sendEmailNotification(
          user.email, // Send to original email before it's deleted
          'system_announcement' as any,
          {
            userName: user.firstName || user.username,
            announcementTitle: 'Account Deletion Confirmation',
            announcementMessage: 'Your account has been successfully deleted. All your personal data has been removed from our systems in compliance with GDPR/CCPA regulations. If you did not request this deletion, please contact support immediately.',
          }
        );
        console.log(`[Account Deletion] Confirmation email sent to ${user.email}`);
      } catch (emailError) {
        console.error('[Account Deletion] Failed to send confirmation email:', emailError);
        // Don't fail the deletion if email fails
      }

      // 10. Logout user
      req.logout((err) => {
        if (err) {
          console.error("Logout error during account deletion:", err);
        }
      });

      console.log(`[Account Deletion] Successfully deleted account for user ${userId}`);

      res.json({
        success: true,
        message: "Your account has been successfully deleted. All personal data has been removed."
      });
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: error.message || "Failed to delete account" });
    }
  });
}