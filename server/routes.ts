import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { db } from "./db";
import { offerVideos } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { NotificationService } from "./notifications/notificationService";
import {
  insertCreatorProfileSchema,
  insertCompanyProfileSchema,
  insertOfferSchema,
  createOfferSchema,
  insertOfferVideoSchema,
  insertApplicationSchema,
  insertMessageSchema,
  insertReviewSchema,
  insertFavoriteSchema,
  insertPaymentSettingSchema,
  adminReviewUpdateSchema,
  adminNoteSchema,
  createRetainerContractSchema,
  insertRetainerApplicationSchema,
  insertRetainerDeliverableSchema,
} from "@shared/schema";

// Alias for convenience
const requireAuth = isAuthenticated;

// Middleware to ensure user has specific role
function requireRole(...roles: string[]) {
  return (req: Request, res: any, next: any) => {
    if (!req.user || !roles.includes((req.user as any).role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Local Auth
  await setupAuth(app);

  // Profile routes
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;

      if (user.role === 'creator') {
        const profile = await storage.getCreatorProfile(userId);
        if (!profile) {
          // Create default profile if doesn't exist
          const newProfile = await storage.createCreatorProfile({ userId });
          return res.json(newProfile);
        }
        return res.json(profile);
      } else if (user.role === 'company') {
        const profile = await storage.getCompanyProfile(userId);
        return res.json(profile);
      }

      res.json(null);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;

      if (user.role === 'creator') {
        const validated = insertCreatorProfileSchema.partial().parse(req.body);
        const profile = await storage.updateCreatorProfile(userId, validated);
        return res.json(profile);
      } else if (user.role === 'company') {
        const validated = insertCompanyProfileSchema.partial().parse(req.body);
        const profile = await storage.updateCompanyProfile(userId, validated);
        return res.json(profile);
      }

      res.status(400).send("Invalid role");
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator stats
  app.get("/api/creator/stats", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getApplicationsByCreator(userId);
      const analyticsData = await storage.getAnalyticsByCreator(userId);

      const stats = {
        totalEarnings: analyticsData?.totalEarnings || 0,
        monthlyEarnings: 0, // TODO: Calculate monthly
        activeOffers: applications.filter(a => a.status === 'active').length,
        pendingApplications: applications.filter(a => a.status === 'pending').length,
        totalClicks: analyticsData?.totalClicks || 0,
        monthlyClicks: 0, // TODO: Calculate monthly
        unreadMessages: 0, // TODO: Calculate from messages
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Offers routes
  app.get("/api/offers", requireAuth, async (req, res) => {
    try {
      const offers = await storage.getOffers(req.query);
      res.json(offers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/offers/recommended", requireAuth, async (req, res) => {
    try {
      // TODO: Implement recommendation algorithm
      const offers = await storage.getOffers({});
      res.json(offers.slice(0, 3));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/offers/:id", requireAuth, async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const videos = await storage.getOfferVideos(offer.id);
      const company = await storage.getCompanyProfileById(offer.companyId);

      res.json({ ...offer, videos, company });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get reviews for an offer (public endpoint)
  app.get("/api/offers/:id/reviews", async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      // Get reviews for the company that owns this offer
      const reviews = await storage.getReviewsByCompany(offer.companyId);

      // Filter out hidden reviews for non-admin users
      const visibleReviews = reviews.filter(review => !review.isHidden);

      res.json(visibleReviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching offer reviews:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/offers", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      
      if (!companyProfile || companyProfile.status !== 'approved') {
        return res.status(403).send("Company not approved");
      }

      const validated = createOfferSchema.parse(req.body);
      const offer = await storage.createOffer({
        ...validated,
        companyId: companyProfile.id,
        status: 'pending_review',
      });

      res.json(offer);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[offers] Error creating offer:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/offers/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      const validated = insertOfferSchema.partial().parse(req.body);
      const updatedOffer = await storage.updateOffer(offerId, validated);
      res.json(updatedOffer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // DELETE offer endpoint - FIXED
  app.delete("/api/offers/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      // Check for active applications
      const applications = await storage.getApplicationsByOffer(offerId);
      const hasActiveApplications = applications.some(
        app => app.status === 'active' || app.status === 'approved'
      );

      if (hasActiveApplications) {
        return res.status(400).json({
          error: "Cannot delete offer with active applications",
          message: "This offer has active applications. Please complete or reject them first."
        });
      }

      // Delete the offer (cascades to videos, applications, favorites per DB constraints)
      await storage.deleteOffer(offerId);

      res.json({ success: true, message: "Offer deleted successfully" });
    } catch (error: any) {
      console.error('[DELETE /api/offers/:id] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Applications routes
  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getApplicationsByCreator(userId);

      // Fetch offer details for each application
      const applicationsWithOffers = await Promise.all(
        applications.map(async (app) => {
          const offer = await storage.getOffer(app.offerId);
          const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;
          return { ...app, offer: offer ? { ...offer, company } : null };
        })
      );

      res.json(applicationsWithOffers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/applications", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertApplicationSchema.parse({
        ...req.body,
        creatorId: userId,
        status: 'pending',
      });

      const application = await storage.createApplication(validated);

      // TODO: Schedule auto-approval job for 7 minutes later

      res.json(application);
    } catch (error: any) {
      console.error('[POST /api/applications] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/applications/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Generate tracking link and code
      const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}`;
      const port = process.env.PORT || 3000;
      const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
      const trackingLink = `${baseURL}/go/${trackingCode}`;

      const approved = await storage.approveApplication(
        application.id,
        trackingLink,
        trackingCode
      );

      res.json(approved);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/applications/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the application belongs to one of the company's offers
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Verify ownership
      if (offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      const rejected = await storage.updateApplication(application.id, {
        status: 'rejected',
      });

      res.json(rejected);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/applications/:id/complete", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the application belongs to one of the company's offers
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Compare offer.companyId against companyProfile.id (not userId)
      if (offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Verify application is approved before marking complete
      if (application.status !== 'approved' && application.status !== 'active') {
        return res.status(400).send("Only approved applications can be marked as complete");
      }

      const completed = await storage.completeApplication(application.id);
      res.json(completed);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/company/applications", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      console.log('[/api/company/applications] userId:', userId);
      const companyProfile = await storage.getCompanyProfile(userId);
      console.log('[/api/company/applications] companyProfile:', companyProfile);
      if (!companyProfile) {
        console.log('[/api/company/applications] No company profile found for user:', userId);
        return res.status(404).send("Company profile not found");
      }
      
      // Pass company profile ID, not user ID
      const applications = await storage.getApplicationsByCompany(companyProfile.id);
      console.log('[/api/company/applications] Found', applications.length, 'applications');
      res.json(applications);
    } catch (error: any) {
      console.error('[/api/company/applications] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Favorites routes
  app.get("/api/favorites", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const favorites = await storage.getFavoritesByCreator(userId);

      // Fetch offer details for each favorite
      const favoritesWithOffers = await Promise.all(
        favorites.map(async (fav) => {
          const offer = await storage.getOffer(fav.offerId);
          const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;
          return { ...fav, offer: offer ? { ...offer, company } : null };
        })
      );

      res.json(favoritesWithOffers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/favorites/:offerId", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const isFav = await storage.isFavorite(userId, req.params.offerId);
      res.json(isFav);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/favorites", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertFavoriteSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const favorite = await storage.createFavorite(validated);
      res.json(favorite);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/favorites/:offerId", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.deleteFavorite(userId, req.params.offerId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Tracking & Redirect System
  app.get("/go/:code", async (req, res) => {
    try {
      const trackingCode = req.params.code;
      
      // Look up application by tracking code
      const application = await storage.getApplicationByTrackingCode(trackingCode);
      if (!application) {
        return res.status(404).send("Tracking link not found");
      }

      // Get offer details for product URL
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      // Extract client IP (normalize for proxies/load balancers)
      let clientIp = 'unknown';
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // X-Forwarded-For can be comma-separated, take first (client) IP
        const forwardedIpValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        const ips = String(forwardedIpValue).split(',').map(ip => ip.trim());
        clientIp = ips[0];
      } else if (req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      } else if (req.ip) {
        clientIp = req.ip;
      }
      
      // Clean IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 → 192.168.1.1)
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }

      const userAgent = req.headers['user-agent'] || 'unknown';
      const refererRaw = req.headers['referer'] || req.headers['referrer'];
      const referer = Array.isArray(refererRaw) ? refererRaw[0] : (refererRaw || 'direct');
      
      // Log the click asynchronously (don't block redirect)
      storage.logTrackingClick(application.id, {
        ip: clientIp,
        userAgent,
        referer,
        timestamp: new Date(),
      }).catch(err => console.error('[Tracking] Error logging click:', err));

      // Redirect to product URL
      res.redirect(302, offer.productUrl);
    } catch (error: any) {
      console.error('[Tracking] Error:', error);
      res.status(500).send("Internal server error");
    }
  });

  // Record conversion (companies can report sales/conversions)
  app.post("/api/conversions/:applicationId", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { saleAmount } = req.body;

      // Verify the application belongs to an offer owned by this company
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Forbidden: You don't own this offer" });
      }

      // Record the conversion and calculate earnings
      await storage.recordConversion(applicationId, saleAmount ? parseFloat(saleAmount) : undefined);

      res.json({
        success: true,
        message: "Conversion recorded successfully"
      });
    } catch (error: any) {
      console.error('[Record Conversion] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Analytics routes
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const dateRange = (req.query.range as string) || '30d';
      const analyticsData = await storage.getAnalyticsByCreator(userId);
      const applications = await storage.getApplicationsByCreator(userId);
      const chartData = await storage.getAnalyticsTimeSeriesByCreator(userId, dateRange);

      const stats = {
        totalEarnings: analyticsData?.totalEarnings || 0,
        activeOffers: applications.filter(a => a.status === 'active' || a.status === 'approved').length,
        totalClicks: analyticsData?.totalClicks || 0,
        uniqueClicks: analyticsData?.uniqueClicks || 0,
        conversions: analyticsData?.conversions || 0,
        conversionRate: analyticsData?.totalClicks > 0 
          ? ((analyticsData?.conversions || 0) / analyticsData.totalClicks * 100).toFixed(1)
          : 0,
        chartData: chartData,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Messages routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;
      const userRole = user.role;
      
      // Get company profile ID if user is a company
      let companyProfileId = null;
      if (userRole === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        companyProfileId = companyProfile?.id;
      }
      
      const conversations = await storage.getConversationsByUser(userId, userRole, companyProfileId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/messages/:conversationId", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error: any) {
      console.error('[GET /api/messages/:conversationId] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });

      const message = await storage.createMessage(validated);
      res.json(message);
    } catch (error: any) {
      console.error('[POST /api/messages] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Get or create conversation for an application
  app.post("/api/conversations/start", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { applicationId } = req.body;

      if (!applicationId) {
        return res.status(400).json({ error: "applicationId is required" });
      }

      // Get the application
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Get user role and company profile
      const user = req.user as any;
      let companyId: string | null = null;
      let companyProfileId: string | null = null;

      if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        companyId = companyProfile?.id || null;
        companyProfileId = companyProfile?.id || null;
      } else {
        // If creator, get company from offer
        const offer = await storage.getOffer(application.offerId);
        companyId = offer?.companyId || null;
      }

      if (!companyId) {
        return res.status(400).json({ error: "Could not determine company" });
      }

      // Find existing conversation for this application
      const existingConversations = await storage.getConversationsByUser(userId, user.role, companyProfileId);
      const existingConversation = existingConversations.find(
        (c: any) => c.applicationId === applicationId
      );

      if (existingConversation) {
        return res.json({ conversationId: existingConversation.id });
      }

      // Create new conversation
      const conversation = await storage.createConversation({
        applicationId,
        creatorId: application.creatorId,
        companyId,
        offerId: application.offerId,
        lastMessageAt: new Date(),
      });

      res.json({ conversationId: conversation.id });
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      res.status(500).send(error.message);
    }
  });

  // Reviews routes
  app.post("/api/reviews", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertReviewSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const review = await storage.createReview(validated);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get reviews by creator (creator only)
  app.get("/api/user/reviews", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const reviews = await storage.getReviewsByCreator(userId);
      res.json(reviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching creator reviews:', error);
      res.status(500).send(error.message);
    }
  });

  // Get reviews for a company (company only)
  app.get("/api/company/reviews", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const reviews = await storage.getReviewsByCompany(companyProfile.id);
      res.json(reviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching company reviews:', error);
      res.status(500).send(error.message);
    }
  });

  // Add company response to a review (company only)
  app.patch("/api/reviews/:id/respond", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const reviewId = req.params.id;
      const { response } = req.body;

      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        return res.status(400).send("Response text is required");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Verify the review belongs to this company
      const review = await storage.getReview(reviewId);
      if (!review) {
        return res.status(404).send("Review not found");
      }

      if (review.companyId !== companyProfile.id) {
        return res.status(403).send("You can only respond to reviews for your company");
      }

      // Update the review with company response
      const updatedReview = await storage.updateReview(reviewId, {
        companyResponse: response.trim(),
        companyRespondedAt: new Date(),
      });

      res.json(updatedReview);
    } catch (error: any) {
      console.error('[Reviews] Error adding company response:', error);
      res.status(500).send(error.message);
    }
  });

  // Payment Settings routes
  app.get("/api/payment-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const settings = await storage.getPaymentSettings(userId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/payment-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertPaymentSettingSchema.parse({
        ...req.body,
        userId,
      });

      const setting = await storage.createPaymentSetting(validated);
      res.json(setting);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Payment routes for creators
  app.get("/api/payments/creator", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const payments = await storage.getPaymentsByCreator(userId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Payment routes for companies
  app.get("/api/payments/company", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const payments = await storage.getPaymentsByCompany(companyProfile.id);
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Payment routes for admins
  app.get("/api/payments/all", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Update payment status (admin only)
  app.patch("/api/payments/:id/status", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).send("Status is required");
      }

      const payment = await storage.updatePaymentStatus(id, status);
      res.json(payment);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company routes
  app.get("/api/company/offers", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const offers = await storage.getOffersByCompany(companyProfile.id);
      res.json(offers);
    } catch (error: any) {
      console.error('[company/offers] Error getting company offers:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/company/stats", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      
      if (!companyProfile) {
        return res.json({
          activeCreators: 0,
          pendingApplications: 0,
          liveOffers: 0,
          draftOffers: 0,
          totalApplications: 0,
          totalClicks: 0,
          conversions: 0,
          companyProfile: null,
        });
      }

      const offers = await storage.getOffersByCompany(companyProfile.id);
      let totalApplications = 0;

      for (const offer of offers) {
        const apps = await storage.getApplicationsByOffer(offer.id);
        totalApplications += apps.length;
      }

      const stats = {
        activeCreators: 0, // TODO: Count unique active creators
        pendingApplications: 0, // TODO: Count pending applications
        liveOffers: offers.filter(o => o.status === 'approved').length,
        draftOffers: offers.filter(o => o.status === 'draft').length,
        totalApplications,
        totalClicks: 0, // TODO: Aggregate from analytics
        conversions: 0, // TODO: Aggregate from analytics
        companyProfile,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Initialize notification service
  const notificationService = new NotificationService(storage);

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/unread", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const notifications = await storage.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/unread/count", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.clearAllNotifications(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Notification preferences routes
  app.get("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      let preferences = await storage.getUserNotificationPreferences(userId);
      
      if (!preferences) {
        preferences = await storage.createUserNotificationPreferences({ userId });
      }
      
      res.json(preferences);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const preferences = await storage.updateUserNotificationPreferences(userId, req.body);
      res.json(preferences);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/subscribe-push", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { subscription } = req.body;
      
      await storage.updateUserNotificationPreferences(userId, {
        pushSubscription: subscription,
        pushNotifications: true,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/vapid-public-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  // Admin routes
  app.get("/api/admin/stats", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const pendingCompanies = await storage.getPendingCompanies();
      const pendingOffers = await storage.getPendingOffers();

      const stats = {
        totalUsers: 0, // TODO: Count all users
        newUsersThisWeek: 0, // TODO: Count users created this week
        pendingCompanies: pendingCompanies.length,
        pendingOffers: pendingOffers.length,
        activeOffers: 0, // TODO: Count approved offers
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/companies", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companies = await storage.getPendingCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/companies/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const company = await storage.approveCompany(req.params.id);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/companies/:id/reject", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { reason } = req.body;
      const company = await storage.rejectCompany(req.params.id, reason);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/offers", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offers = await storage.getPendingOffers();
      res.json(offers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/offers/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offer = await storage.approveOffer(req.params.id);
      res.json(offer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/creators", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creators = await storage.getCreatorsForAdmin();
      res.json(creators);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/suspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.suspendCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/unsuspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.unsuspendCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/ban", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.banCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Admin review routes
  app.get("/api/admin/reviews", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/reviews/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const validated = adminReviewUpdateSchema.parse(req.body);
      const review = await storage.updateReview(req.params.id, validated);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/hide", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const review = await storage.hideReview(req.params.id);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/reviews/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/note", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = adminNoteSchema.parse(req.body);
      const review = await storage.updateAdminNote(req.params.id, validated.note, userId);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const review = await storage.approveReview(req.params.id, userId);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Object Storage routes
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    console.log("🔍 Requested object path:", req.path);
    const userId = (req.user as any)?.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      const publicId = req.path.replace("/objects/", "");
      objectStorageService.downloadObject(publicId, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadParams = await objectStorageService.getObjectEntityUploadURL();
    res.json(uploadParams);
  });

  app.put("/api/company-logos", requireAuth, requireRole('company'), async (req, res) => {
    if (!req.body.logoUrl) {
      return res.status(400).json({ error: "logoUrl is required" });
    }
    const userId = (req.user as any).id;
    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.logoUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );
      const companyProfile = await storage.getCompanyProfile(userId);
      if (companyProfile) {
        await storage.updateCompanyProfile(userId, { logoUrl: objectPath });
      }
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting company logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Offer Videos endpoints
  app.get("/api/offers/:offerId/videos", requireAuth, async (req, res) => {
    try {
      const videos = await storage.getOfferVideos(req.params.offerId);
      res.json(videos);
    } catch (error: any) {
      console.error("Error fetching offer videos:", error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/offers/:offerId/videos", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.offerId;
      
      // Verify the offer belongs to this company
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Check video count (max 12)
      const existingVideos = await storage.getOfferVideos(offerId);
      if (existingVideos.length >= 12) {
        return res.status(400).json({ error: "Maximum 12 videos allowed per offer" });
      }

      const { videoUrl, title, description, creatorCredit, originalPlatform, thumbnailUrl } = req.body;
      if (!videoUrl || !title) {
        return res.status(400).json({ error: "videoUrl and title are required" });
      }

      // Set ACL for the video
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        videoUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );

      // Create video record in database
      const video = await storage.createOfferVideo({
        offerId,
        videoUrl: objectPath,
        title,
        description: description || null,
        creatorCredit: creatorCredit || null,
        originalPlatform: originalPlatform || null,
        thumbnailUrl: thumbnailUrl || null,
        orderIndex: existingVideos.length, // Auto-increment order
      });

      res.json(video);
    } catch (error: any) {
      console.error("Error creating offer video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/offer-videos/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const videoId = req.params.id;
      
      // Get the video to verify ownership
      const videos = await db.select().from(offerVideos).where(eq(offerVideos.id, videoId)).limit(1);
      const video = videos[0];
      
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Verify the offer belongs to this company
      const offer = await storage.getOffer(video.offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Delete the video
      await storage.deleteOfferVideo(videoId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting offer video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =====================================================
  // RETAINER CONTRACTS ROUTES
  // =====================================================

  // Get all retainer contracts for creator (open contracts + contracts assigned to them)
  app.get("/api/retainer-contracts", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;

      // Get open contracts (for browsing/applying)
      const openContracts = await storage.getOpenRetainerContracts();

      // Get contracts assigned to this creator (their approved contracts)
      const myContracts = await storage.getRetainerContractsByCreator(userId);

      // Combine and deduplicate (in case a contract is both open and assigned)
      const contractMap = new Map();

      // Add my contracts first (higher priority)
      myContracts.forEach(contract => {
        contractMap.set(contract.id, contract);
      });

      // Add open contracts (only if not already in map)
      openContracts.forEach(contract => {
        if (!contractMap.has(contract.id)) {
          contractMap.set(contract.id, contract);
        }
      });

      // Convert map back to array
      const allContracts = Array.from(contractMap.values());

      res.json(allContracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get specific retainer contract
  app.get("/api/retainer-contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract) return res.status(404).send("Not found");
      res.json(contract);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Get their retainer contracts
  app.get("/api/company/retainer-contracts", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contracts = await storage.getRetainerContractsByCompany(companyProfile.id);
      res.json(contracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Create retainer contract
  app.post("/api/company/retainer-contracts", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const validated = createRetainerContractSchema.parse(req.body);
      const contract = await storage.createRetainerContract({ ...validated, companyId: companyProfile.id });
      res.json(contract);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Update retainer contract
  app.patch("/api/company/retainer-contracts/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const validated = createRetainerContractSchema.partial().parse(req.body);
      const updated = await storage.updateRetainerContract(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Delete retainer contract
  app.delete("/api/company/retainer-contracts/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      await storage.deleteRetainerContract(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get assigned contracts
  app.get("/api/creator/retainer-contracts", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const contracts = await storage.getRetainerContractsByCreator(userId);
      res.json(contracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get applications for a contract
  app.get("/api/retainer-contracts/:id/applications", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const applications = await storage.getRetainerApplicationsByContract(req.params.id);
      res.json(applications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get their applications
  app.get("/api/creator/retainer-applications", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getRetainerApplicationsByCreator(userId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Apply to contract
  app.post("/api/creator/retainer-contracts/:id/apply", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const body = {
        ...req.body,
        proposedStartDate: req.body.proposedStartDate ? new Date(req.body.proposedStartDate) : undefined,
      };
      const validated = insertRetainerApplicationSchema.omit({ creatorId: true, contractId: true }).parse(body);
      const application = await storage.createRetainerApplication({ ...validated, contractId: req.params.id, creatorId: userId });
      res.json(application);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Approve application
  app.patch("/api/company/retainer-applications/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const application = await storage.getRetainerApplication(req.params.id);
      if (!application) return res.status(404).send("Application not found");
      const contract = await storage.getRetainerContract(application.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const approved = await storage.approveRetainerApplication(req.params.id, application.contractId, application.creatorId);
      res.json(approved);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Reject application
  app.patch("/api/company/retainer-applications/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const application = await storage.getRetainerApplication(req.params.id);
      if (!application) return res.status(404).send("Application not found");
      const contract = await storage.getRetainerContract(application.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const rejected = await storage.rejectRetainerApplication(req.params.id);
      res.json(rejected);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get deliverables for contract
  app.get("/api/retainer-contracts/:id/deliverables", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract) return res.status(404).send("Contract not found");
      if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (!companyProfile || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      } else if (user.role === 'creator') {
        if (contract.assignedCreatorId !== userId) return res.status(403).send("Forbidden");
      }
      const deliverables = await storage.getRetainerDeliverablesByContract(req.params.id);
      res.json(deliverables);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get their deliverables
  app.get("/api/creator/retainer-deliverables", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deliverables = await storage.getRetainerDeliverablesByCreator(userId);
      res.json(deliverables);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Submit deliverable
  app.post("/api/creator/retainer-deliverables", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertRetainerDeliverableSchema.omit({ creatorId: true }).parse(req.body);
      const contract = await storage.getRetainerContract(validated.contractId);
      if (!contract || contract.assignedCreatorId !== userId) return res.status(403).send("Forbidden");
      const deliverable = await storage.createRetainerDeliverable({ ...validated, creatorId: userId });
      res.json(deliverable);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Approve deliverable
  app.patch("/api/company/retainer-deliverables/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");

      // Approve the deliverable
      const approved = await storage.approveRetainerDeliverable(req.params.id, req.body.reviewNotes);

      // Calculate payment amount per video (monthly amount / videos per month)
      const monthlyAmount = parseFloat(contract.monthlyAmount);
      const videosPerMonth = contract.videosPerMonth || 1;
      const paymentPerVideo = monthlyAmount / videosPerMonth;

      // Create payment for the approved deliverable
      await storage.createRetainerPayment({
        contractId: contract.id,
        deliverableId: deliverable.id,
        creatorId: deliverable.creatorId,
        companyId: contract.companyId,
        amount: paymentPerVideo.toFixed(2),
        status: 'pending',
        description: `Retainer payment for ${contract.title} - Month ${deliverable.monthNumber}, Video ${deliverable.videoNumber}`,
      });

      console.log(`[Retainer Payment] Created payment of $${paymentPerVideo.toFixed(2)} for creator ${deliverable.creatorId}`);

      res.json(approved);
    } catch (error: any) {
      console.error('[Approve Deliverable] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company: Reject deliverable
  app.patch("/api/company/retainer-deliverables/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      if (!req.body.reviewNotes) return res.status(400).send("Review notes required");
      const rejected = await storage.rejectRetainerDeliverable(req.params.id, req.body.reviewNotes);
      res.json(rejected);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Request revision
  app.patch("/api/company/retainer-deliverables/:id/request-revision", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      if (!req.body.reviewNotes) return res.status(400).send("Review notes required");
      const revised = await storage.requestRevision(req.params.id, req.body.reviewNotes);
      res.json(revised);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connected clients
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket, req: any) => {
    const userId = req.user?.id; // This would need proper auth integration
    
    if (userId) {
      clients.set(userId, ws);
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat_message') {
          // Save message to database
          const savedMessage = await storage.createMessage({
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
          });

          // Find all participants in the conversation
          const conversation = await storage.getConversation(message.conversationId);
          
          // Send to all participants
          const recipientIds = [conversation.creatorId, conversation.companyId];
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'new_message',
                message: savedMessage,
              }));
            }
          }
        } else if (message.type === 'typing_start') {
          // Broadcast typing indicator to other participants
          const conversation = await storage.getConversation(message.conversationId);
          const recipientIds = [conversation.creatorId, conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'user_typing',
                conversationId: message.conversationId,
                userId: userId,
              }));
            }
          }
        } else if (message.type === 'typing_stop') {
          // Broadcast stop typing indicator
          const conversation = await storage.getConversation(message.conversationId);
          const recipientIds = [conversation.creatorId, conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'user_stop_typing',
                conversationId: message.conversationId,
                userId: userId,
              }));
            }
          }
        } else if (message.type === 'mark_read') {
          // Mark messages as read
          await storage.markMessagesAsRead(message.conversationId, userId);
          
          // Notify the sender that messages have been read
          const conversation = await storage.getConversation(message.conversationId);
          const recipientIds = [conversation.creatorId, conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'messages_read',
                conversationId: message.conversationId,
                readBy: userId,
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  // Auto-approval scheduler - runs every minute to check for applications that need auto-approval
  const runAutoApprovalScheduler = async () => {
    try {
      const pendingApplications = await storage.getAllPendingApplications();
      const now = new Date();
      let processedCount = 0;
      
      for (const application of pendingApplications) {
        // Only process pending applications with scheduled auto-approval time
        if (application.status === 'pending' && application.autoApprovalScheduledAt) {
          const scheduledTime = new Date(application.autoApprovalScheduledAt);
          
          // Check if the application is past its 7-minute auto-approval window
          if (now >= scheduledTime) {
            try {
              const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${Date.now()}`;
              const port = process.env.PORT || 3000;
              const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
              const trackingLink = `${baseURL}/go/${trackingCode}`;
              
              await storage.approveApplication(
                application.id,
                trackingLink,
                trackingCode
              );
              
              processedCount++;
              console.log(`[Auto-Approval] ✓ Approved application ${application.id} (${processedCount} total)`);
            } catch (error) {
              console.error(`[Auto-Approval] ✗ Failed to approve application ${application.id}:`, error);
            }
          }
        }
      }
      
      if (processedCount > 0) {
        console.log(`[Auto-Approval] Processed ${processedCount} applications successfully`);
      }
    } catch (error) {
      console.error('[Auto-Approval] Scheduler error:', error);
    }
  };

  // Run scheduler every minute
  console.log('[Auto-Approval] Scheduler started - checking every 60 seconds');
  setInterval(runAutoApprovalScheduler, 60000);
  
  // Run once immediately on startup
  runAutoApprovalScheduler();

  return httpServer;
}