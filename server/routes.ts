import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { parse as parseCookie } from "cookie";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { db } from "./db";
import { offerVideos, applications, analytics } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { checkClickFraud, logFraudDetection } from "./fraudDetection";
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
} from "../shared/schema";

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

  // Initialize notification service
  const notificationService = new NotificationService(storage);

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

      console.log("[Profile Update] User role:", user.role);
      console.log("[Profile Update] Request body:", req.body);

      if (user.role === 'creator') {
        const validated = insertCreatorProfileSchema.partial().parse(req.body);
        console.log("[Profile Update] Validated data:", validated);
        const profile = await storage.updateCreatorProfile(userId, validated);
        console.log("[Profile Update] Updated profile:", profile);
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
      const userId = (req.user as any).id;

      // Get creator profile with niches
      const creatorProfile = await storage.getCreatorProfile(userId);
      if (!creatorProfile) {
        console.log('[Recommendations] Profile not found for user:', userId);
        return res.status(404).json({
          error: 'profile_not_found',
          message: 'Creator profile not found. Please complete your profile first.'
        });
      }

  const creatorNiches = (creatorProfile.niches || []).map((n: string) => (n || '').toString().trim()).filter(Boolean);
  console.log('[Recommendations] User niches:', creatorNiches);

      // Check if user has set any niches
      if (creatorNiches.length === 0) {
        console.log('[Recommendations] No niches set for user:', userId);
        return res.status(200).json({
          error: 'no_niches',
          message: 'Please set your content niches in your profile to get personalized recommendations.'
        });
      }

      // Normalize niches for case-insensitive comparison
      const creatorNichesNorm = creatorNiches.map((n: string) => n.toLowerCase());

      // Get all approved offers
      const allOffers = await storage.getOffers({ status: 'approved' });
      console.log('[Recommendations] Total approved offers:', allOffers.length);
      console.log('[Recommendations] Sample offer niches:', allOffers.slice(0, 3).map(o => ({
        id: o.id,
        title: o.title,
        primaryNiche: o.primaryNiche,
        additionalNiches: o.additionalNiches
      })));

      // Get creator's past applications
      const pastApplications = await db
        .select({
          offerId: applications.offerId,
          status: applications.status,
        })
        .from(applications)
        .where(eq(applications.creatorId, userId));

      const appliedOfferIds = new Set(pastApplications.map(app => app.offerId));

      // Get creator's performance by niche
      const performanceByNiche: Record<string, number> = {};

      if (pastApplications.length > 0) {
        const approvedAppIds = pastApplications
          .filter(app => app.status === 'approved' || app.status === 'active')
          .map(app => app.offerId);

        if (approvedAppIds.length > 0) {
          // Get analytics for approved applications
          const performanceData = await db
            .select({
              offerId: analytics.offerId,
              totalConversions: sql<number>`SUM(${analytics.conversions})`,
              totalClicks: sql<number>`SUM(${analytics.clicks})`,
            })
            .from(analytics)
            .where(eq(analytics.creatorId, userId))
            .groupBy(analytics.offerId);

          // Map performance to niches
          for (const perf of performanceData) {
            const offer = allOffers.find(o => o.id === perf.offerId);
            if (offer) {
              const conversionRate = perf.totalClicks > 0
                ? (Number(perf.totalConversions) / Number(perf.totalClicks)) * 100
                : 0;

              // Track performance for primary niche (normalized key)
              if (offer.primaryNiche) {
                const key = (offer.primaryNiche || '').toString().toLowerCase();
                performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
              }

              // Track performance for additional niches (normalized keys)
              if (offer.additionalNiches) {
                for (const niche of offer.additionalNiches) {
                  const key = (niche || '').toString().toLowerCase();
                  performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
                }
              }
            }
          }
        }
      }

      // Score each offer - ONLY include offers with at least one matching niche
      const scoredOffers = allOffers
        .filter(offer => !appliedOfferIds.has(offer.id))
        .map(offer => {
          let score = 0;

          // 1. Niche matching (0-100 points)
          // Build raw and normalized niche lists for the offer
          const offerNichesRaw = [offer.primaryNiche, ...(offer.additionalNiches || [])].filter(Boolean);
          const offerNichesNorm = offerNichesRaw.map((n: string) => n.toString().toLowerCase());

          // Determine matching niches by normalized intersection
          const matchingNiches = offerNichesRaw.filter((n: string, idx: number) => creatorNichesNorm.includes(offerNichesNorm[idx]));

          // IMPORTANT: If no niche match, mark this offer as invalid
          if (matchingNiches.length === 0) {
            return null; // Will be filtered out later
          }

          // Primary niche match = 50 points, additional niche match = 25 points each
          if (offer.primaryNiche && creatorNichesNorm.includes((offer.primaryNiche || '').toString().toLowerCase())) {
            score += 50;
          }

          const additionalMatches = matchingNiches.filter(niche => niche !== offer.primaryNiche).length;
          score += additionalMatches * 25;

          // Cap niche score at 100
          const nicheScore = Math.min(score, 100);

          // 2. Performance in similar niches (0-50 points)
          let performanceScore = 0;
          for (const nicheNorm of offerNichesNorm) {
            if (performanceByNiche[nicheNorm]) {
              performanceScore += performanceByNiche[nicheNorm];
            }
          }
          performanceScore = Math.min(performanceScore, 50);

          // 3. Offer popularity (0-30 points)
          const viewScore = Math.min((offer.viewCount || 0) / 10, 15);
          const applicationScore = Math.min((offer.applicationCount || 0) / 5, 15);
          const popularityScore = viewScore + applicationScore;

          // 4. Commission attractiveness (0-20 points)
          let commissionScore = 0;
          if (offer.commissionType === 'per_sale' && offer.commissionAmount) {
            commissionScore = Math.min(Number(offer.commissionAmount) / 10, 20);
          } else if (offer.commissionType === 'per_sale' && offer.commissionPercentage) {
            commissionScore = Math.min(Number(offer.commissionPercentage) / 2, 20);
          } else if (offer.commissionType === 'monthly_retainer' && offer.retainerAmount) {
            commissionScore = Math.min(Number(offer.retainerAmount) / 100, 20);
          } else if (offer.commissionType === 'per_click') {
            commissionScore = 10; // Base score for per-click
          } else if (offer.commissionType === 'per_lead') {
            commissionScore = 12; // Base score for per-lead
          }

          const totalScore = nicheScore + performanceScore + popularityScore + commissionScore;

          return {
            offer,
            score: totalScore,
            matchingNiches: matchingNiches.length,
          };
        })
        .filter(item => item !== null) // Remove offers with no niche match
        .sort((a, b) => b!.score - a!.score);

      console.log('[Recommendations] Total scored offers with matching niches:', scoredOffers.length);
      console.log('[Recommendations] Top 3 scored offers:', scoredOffers.slice(0, 3).map(s => ({
        title: s!.offer.title,
        score: s!.score,
        matchingNiches: s!.matchingNiches,
        primaryNiche: s!.offer.primaryNiche
      })));

      // If no niche matches, fallback to popular offers
      let topOffers = scoredOffers.slice(0, 10).map(item => item!.offer);

      if (topOffers.length === 0) {
        console.log('[Recommendations] No niche matches found. Falling back to popular offers.');
        // Return popular offers that user hasn't applied to yet
        topOffers = allOffers
          .filter(offer => !appliedOfferIds.has(offer.id))
          .sort((a, b) => {
            const scoreA = (a.viewCount || 0) + (a.applicationCount || 0) * 2;
            const scoreB = (b.viewCount || 0) + (b.applicationCount || 0) * 2;
            return scoreB - scoreA;
          })
          .slice(0, 10);
        console.log('[Recommendations] Returning', topOffers.length, 'popular offers as fallback');
      } else {
        console.log('[Recommendations] Returning', topOffers.length, 'niche-matched offers');
      }

      res.json(topOffers);
    } catch (error: any) {
      console.error('[Recommendations] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Dev-only: debug recommendations for a specific user (bypass auth)
  // Usage: /api/debug/recommendations?userId=<userId>
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug/recommendations", async (req, res) => {
      try {
        const userId = String(req.query.userId || '');
        if (!userId) return res.status(400).json({ error: 'missing_userId' });

        // Reuse recommendation logic from /api/offers/recommended but bypass auth
        const creatorProfile = await storage.getCreatorProfile(userId);
        if (!creatorProfile) {
          return res.status(404).json({ error: 'profile_not_found' });
        }

        const creatorNiches = (creatorProfile.niches || []).map((n: string) => (n || '').toString().trim()).filter(Boolean);
        if (creatorNiches.length === 0) {
          return res.status(200).json({ error: 'no_niches' });
        }
        const creatorNichesNorm = creatorNiches.map((n: string) => n.toLowerCase());

        const allOffers = await storage.getOffers({ status: 'approved' });

        // Get creator's past applications
        const pastApplications = await db
          .select({ offerId: applications.offerId, status: applications.status })
          .from(applications)
          .where(eq(applications.creatorId, userId));

        const appliedOfferIds = new Set(pastApplications.map(app => app.offerId));

        // Compute performance by niche for this user
        const performanceByNiche: Record<string, number> = {};
        if (pastApplications.length > 0) {
          const approvedAppIds = pastApplications
            .filter(app => app.status === 'approved' || app.status === 'active')
            .map(app => app.offerId);

          if (approvedAppIds.length > 0) {
            const performanceData = await db
              .select({ offerId: analytics.offerId, totalConversions: sql<number>`SUM(${analytics.conversions})`, totalClicks: sql<number>`SUM(${analytics.clicks})` })
              .from(analytics)
              .where(eq(analytics.creatorId, userId))
              .groupBy(analytics.offerId);

            for (const perf of performanceData) {
              const offer = allOffers.find(o => o.id === perf.offerId);
              if (!offer) continue;
              const conversionRate = perf.totalClicks > 0 ? (Number(perf.totalConversions) / Number(perf.totalClicks)) * 100 : 0;
              if (offer.primaryNiche) {
                const key = (offer.primaryNiche || '').toString().toLowerCase();
                performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
              }
              if (offer.additionalNiches) {
                for (const niche of offer.additionalNiches) {
                  const key = (niche || '').toString().toLowerCase();
                  performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
                }
              }
            }
          }
        }

        const scoredOffers = allOffers
          .filter(offer => !appliedOfferIds.has(offer.id))
          .map(offer => {
            let score = 0;
            const offerNichesRaw = [offer.primaryNiche, ...(offer.additionalNiches || [])].filter(Boolean);
            const offerNichesNorm = offerNichesRaw.map((n: string) => n.toString().toLowerCase());
            const matchingNiches = offerNichesRaw.filter((n: string, idx: number) => creatorNichesNorm.includes(offerNichesNorm[idx]));
            if (matchingNiches.length === 0) return null;
            if (offer.primaryNiche && creatorNichesNorm.includes((offer.primaryNiche || '').toString().toLowerCase())) score += 50;
            const additionalMatches = matchingNiches.filter(n => n !== offer.primaryNiche).length;
            score += additionalMatches * 25;
            const nicheScore = Math.min(score, 100);
            let performanceScore = 0;
            for (const nicheNorm of offerNichesNorm) {
              if (performanceByNiche[nicheNorm]) performanceScore += performanceByNiche[nicheNorm];
            }
            performanceScore = Math.min(performanceScore, 50);
            const viewScore = Math.min((offer.viewCount || 0) / 10, 15);
            const applicationScore = Math.min((offer.applicationCount || 0) / 5, 15);
            const popularityScore = viewScore + applicationScore;
            let commissionScore = 0;
            if (offer.commissionType === 'per_sale' && offer.commissionAmount) {
              commissionScore = Math.min(Number(offer.commissionAmount) / 10, 20);
            } else if (offer.commissionType === 'per_sale' && offer.commissionPercentage) {
              commissionScore = Math.min(Number(offer.commissionPercentage) / 2, 20);
            } else if (offer.commissionType === 'monthly_retainer' && offer.retainerAmount) {
              commissionScore = Math.min(Number(offer.retainerAmount) / 100, 20);
            } else if (offer.commissionType === 'per_click') {
              commissionScore = 10;
            } else if (offer.commissionType === 'per_lead') {
              commissionScore = 12;
            }
            const totalScore = nicheScore + performanceScore + popularityScore + commissionScore;
            return { offer, score: totalScore };
          })
          .filter(item => item !== null)
          .sort((a, b) => b!.score - a!.score);

        const topOffers = scoredOffers.slice(0, 10).map(item => item!.offer);
        return res.json(topOffers);
      } catch (error: any) {
        console.error('[Debug Recommendations] Error:', error);
        res.status(500).send(error.message);
      }
    });
  }

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

      // Set ACL for featured image if provided
      let featuredImagePath = validated.featuredImageUrl;
      if (featuredImagePath) {
        const objectStorageService = new ObjectStorageService();
        featuredImagePath = await objectStorageService.trySetObjectEntityAclPolicy(
          featuredImagePath,
          {
            owner: userId,
            visibility: "public",
          },
        );
      }

      const offer = await storage.createOffer({
        ...validated,
        featuredImageUrl: featuredImagePath,
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

      // Set ACL for featured image if it's being updated
      if (validated.featuredImageUrl) {
        const objectStorageService = new ObjectStorageService();
        validated.featuredImageUrl = await objectStorageService.trySetObjectEntityAclPolicy(
          validated.featuredImageUrl,
          {
            owner: userId,
            visibility: "public",
          },
        );
      }

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

  // ✅ NEW: Get single application by ID
  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applicationId = req.params.id;

      // Get the application
      const application = await storage.getApplication(applicationId);
      
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the user owns this application
      if (application.creatorId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // Fetch offer and company details
      const offer = await storage.getOffer(application.offerId);
      const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;

      res.json({
        ...application,
        offer: offer ? { ...offer, company } : null
      });
    } catch (error: any) {
      console.error('[GET /api/applications/:id] Error:', error);
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

      // 🆕 GET OFFER, CREATOR, AND COMPANY INFO FOR NOTIFICATION
      const offer = await storage.getOffer(application.offerId);
      const creator = await storage.getUserById(application.creatorId);
      
      if (offer && creator) {
        const company = await storage.getCompanyProfileById(offer.companyId);
        
        if (company) {
          // 🆕 SEND NOTIFICATION TO COMPANY
          await notificationService.sendNotification(
            company.userId,
            'new_application',
            'New Application Received! 📩',
            `${creator.firstName || creator.username} has applied to your offer "${offer.title}". Review their application now.`,
            {
              userName: company.contactName || 'there',
              offerTitle: offer.title,
              applicationId: application.id,
            }
          );
          console.log(`[Notification] Sent new application notification to company ${company.legalName}`);
        }
      }

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

      // Generate tracking link and code (must be unique per application)
      const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${application.id.substring(0, 8)}`;
      const port = process.env.PORT || 3000;
      const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
      const trackingLink = `${baseURL}/go/${trackingCode}`;

      const approved = await storage.approveApplication(
        application.id,
        trackingLink,
        trackingCode
      );

      // 🆕 GET OFFER AND CREATOR INFO FOR NOTIFICATION
      const offer = await storage.getOffer(application.offerId);
      const creator = await storage.getUserById(application.creatorId);

      // 🆕 SEND NOTIFICATION TO CREATOR
      if (offer && creator) {
        await notificationService.sendNotification(
          application.creatorId,
          'application_status_change',
          'Your application has been approved! 🎉',
          `Congratulations! Your application for "${offer.title}" has been approved. You can now start promoting this offer.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            trackingLink: trackingLink,
            applicationId: application.id,
            applicationStatus: 'approved',
          }
        );
        console.log(`[Notification] Sent approval notification to creator ${creator.username}`);
      }

      res.json(approved);
    } catch (error: any) {
      console.error('[Approve Application] Error:', error);
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

      // 🆕 GET CREATOR INFO FOR NOTIFICATION
      const creator = await storage.getUserById(application.creatorId);

      // 🆕 SEND NOTIFICATION TO CREATOR
      if (creator) {
        await notificationService.sendNotification(
          application.creatorId,
          'application_status_change',
          'Application Update',
          `Your application for "${offer.title}" was not approved at this time. Don't worry - there are many other great offers available!`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            linkUrl: `/browse`,
            applicationStatus: 'rejected',
          }
        );
        console.log(`[Notification] Sent rejection notification to creator ${creator.username}`);
      }

      res.json(rejected);
    } catch (error: any) {
      console.error('[Reject Application] Error:', error);
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

      // Automatically create payment when work is completed
      // Calculate payment amounts based on offer commission
      let grossAmount = 0;
      if (offer.commissionType === 'percentage' && offer.commissionPercentage) {
        // For percentage-based, use a base amount (this should come from actual sale data)
        // For now, we'll use a placeholder - in production, this would come from tracked conversions
        const baseAmount = parseFloat(req.body.saleAmount || '100');
        grossAmount = baseAmount * (parseFloat(offer.commissionPercentage.toString()) / 100);
      } else if (offer.commissionType === 'fixed' && offer.commissionAmount) {
        grossAmount = parseFloat(offer.commissionAmount.toString());
      }

      // Calculate fees (platform 4%, processing 3%)
      const platformFeeAmount = grossAmount * 0.04;
      const stripeFeeAmount = grossAmount * 0.03;
      const netAmount = grossAmount - platformFeeAmount - stripeFeeAmount;

      // Create payment record
      const payment = await storage.createPayment({
        applicationId: application.id,
        creatorId: application.creatorId,
        companyId: companyProfile.id,
        offerId: offer.id,
        grossAmount: grossAmount.toFixed(2),
        platformFeeAmount: platformFeeAmount.toFixed(2),
        stripeFeeAmount: stripeFeeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        status: 'pending',
        description: `Payment for ${offer.title}`,
      });

      console.log(`[Payment] Created payment ${payment.id} for application ${application.id}`);

      // Send notification to creator
      const creator = await storage.getUserById(application.creatorId);
      if (creator) {
        await notificationService.sendNotification(
          application.creatorId,
          'payment_pending',
          'Work Completed - Payment Pending 💰',
          `Your work for "${offer.title}" has been marked as complete! Payment of $${netAmount.toFixed(2)} is pending company approval.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            amount: `$${netAmount.toFixed(2)}`,
            linkUrl: `/creator/payment-settings`,
          }
        );
      }

      res.json({ application: completed, payment });
    } catch (error: any) {
      console.error('[Complete Application] Error:', error);
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
      console.log(`[Tracking] Received tracking code: ${trackingCode}`);

      // Look up application by tracking code
      const application = await storage.getApplicationByTrackingCode(trackingCode);
      if (!application) {
        console.error(`[Tracking] Application not found for tracking code: ${trackingCode}`);
        return res.status(404).send("Tracking link not found");
      }

      console.log(`[Tracking] Found application: ${application.id}, status: ${application.status}`);

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

      // Parse UTM parameters from query string
      const utmSource = req.query.utm_source as string | undefined;
      const utmMedium = req.query.utm_medium as string | undefined;
      const utmCampaign = req.query.utm_campaign as string | undefined;
      const utmTerm = req.query.utm_term as string | undefined;
      const utmContent = req.query.utm_content as string | undefined;

      // Perform fraud detection check
      const fraudCheck = await checkClickFraud(clientIp, userAgent, referer, application.id);

      // Log fraud detection result
      if (!fraudCheck.isValid) {
        logFraudDetection(trackingCode, clientIp, fraudCheck);
      }

      // Log the click asynchronously (don't block redirect)
      // Note: We still log even if fraud is detected, but mark it with fraud score
      console.log(`[Tracking] Logging click for application ${application.id}, IP: ${clientIp}, fraud score: ${fraudCheck.fraudScore}`);
      storage.logTrackingClick(application.id, {
        ip: clientIp,
        userAgent,
        referer,
        timestamp: new Date(),
        fraudScore: fraudCheck.fraudScore,
        fraudFlags: fraudCheck.flags.join(','),
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
      }).then(() => {
        console.log(`[Tracking] Successfully logged click for application ${application.id}`);
      }).catch(err => {
        console.error('[Tracking] Error logging click:', err);
        console.error('[Tracking] Error stack:', err.stack);
      });

      // Always redirect to maintain good UX
      // Even fraudulent clicks get redirected (but won't count toward analytics if fraud score > 50)
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

      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // 💰 PROCESS ACTUAL PAYMENT WHEN MARKING AS COMPLETED
      if (status === 'completed') {
        console.log(`[Payment] Processing payment ${id} to send $${payment.netAmount} to creator`);

        // Import payment processor
        const { paymentProcessor } = await import('./paymentProcessor');

        // Validate creator has payment settings configured
        const validation = await paymentProcessor.validateCreatorPaymentSettings(payment.creatorId);
        if (!validation.valid) {
          return res.status(400).send(validation.error);
        }

        // Actually send the money via PayPal/bank/crypto/etc.
        const paymentResult = await paymentProcessor.processPayment(id);

        if (!paymentResult.success) {
          // Payment failed - update status to failed
          await storage.updatePaymentStatus(id, 'failed', {
            description: `Payment failed: ${paymentResult.error}`,
          });

          return res.status(400).json({
            error: paymentResult.error,
            message: "Failed to process payment. Status updated to 'failed'."
          });
        }

        // Payment succeeded - update with transaction details
        const updatedPayment = await storage.updatePaymentStatus(id, 'completed', {
          providerTransactionId: paymentResult.transactionId,
          providerResponse: paymentResult.providerResponse,
          completedAt: new Date(),
        });

        console.log(`[Payment] SUCCESS - Sent $${payment.netAmount} to creator. TX ID: ${paymentResult.transactionId}`);

        // Send notification to creator
        const creator = await storage.getUserById(payment.creatorId);
        const offer = await storage.getOffer(payment.offerId);

        if (creator && offer) {
          await notificationService.sendNotification(
            payment.creatorId,
            'payment_received',
            'Payment Received! 💰',
            `You've received a payment of $${payment.netAmount} for your work on "${offer.title}". Transaction ID: ${paymentResult.transactionId}`,
            {
              userName: creator.firstName || creator.username,
              offerTitle: offer.title,
              amount: `$${payment.netAmount}`,
              linkUrl: `/creator/payment-settings`,
            }
          );
          console.log(`[Notification] Sent payment notification to creator ${creator.username}`);
        }

        res.json(updatedPayment);
      } else {
        // For other status changes (not completed), just update status
        const updatedPayment = await storage.updatePaymentStatus(id, status);
        res.json(updatedPayment);
      }

    } catch (error: any) {
      console.error('[Update Payment Status] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company payment approval
  app.post("/api/company/payments/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Verify the payment belongs to this company
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      if (payment.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Update payment status to processing
      const updatedPayment = await storage.updatePaymentStatus(payment.id, 'processing');

      // Send notification to creator
      const creator = await storage.getUserById(payment.creatorId);
      const offer = await storage.getOffer(payment.offerId);

      if (creator && offer) {
        await notificationService.sendNotification(
          payment.creatorId,
          'payment_approved',
          'Payment Approved! 🎉',
          `Great news! Your payment of $${payment.netAmount} for "${offer.title}" has been approved and is being processed.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            amount: `$${payment.netAmount}`,
            linkUrl: `/creator/payment-settings`,
          }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Approve Payment] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company payment dispute
  app.post("/api/company/payments/:id/dispute", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { reason } = req.body;
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Verify the payment belongs to this company
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      if (payment.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Update payment status to failed with reason
      const updatedPayment = await storage.updatePaymentStatus(payment.id, 'failed', {
        description: `Disputed: ${reason || 'No reason provided'}`,
      });

      // Send notification to creator
      const creator = await storage.getUserById(payment.creatorId);
      const offer = await storage.getOffer(payment.offerId);

      if (creator && offer) {
        await notificationService.sendNotification(
          payment.creatorId,
          'payment_disputed',
          'Payment Disputed',
          `Your payment for "${offer.title}" has been disputed. Reason: ${reason || 'Not specified'}. Please contact the company for more information.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            amount: `$${payment.netAmount}`,
            linkUrl: `/messages`,
          }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Dispute Payment] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Retainer payment routes
  // Get retainer payments for creator
  app.get("/api/retainer-payments/creator", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const payments = await storage.getRetainerPaymentsByCreator(userId);
      res.json(payments);
    } catch (error: any) {
      console.error('[Retainer Payments] Error fetching creator payments:', error);
      res.status(500).send(error.message);
    }
  });

  // Get retainer payments for a specific contract (admin/company)
  app.get("/api/retainer-payments/contract/:contractId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = (req.user as any).role;
      const { contractId } = req.params;

      // Get contract to verify permissions
      const contract = await storage.getRetainerContract(contractId);
      if (!contract) {
        return res.status(404).send("Contract not found");
      }

      // Check permissions
      if (userRole === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (!companyProfile || contract.companyId !== companyProfile.id) {
          return res.status(403).send("Unauthorized");
        }
      } else if (userRole === 'creator') {
        if (contract.assignedCreatorId !== userId) {
          return res.status(403).send("Unauthorized");
        }
      } else if (userRole !== 'admin') {
        return res.status(403).send("Unauthorized");
      }

      const payments = await storage.getRetainerPaymentsByContract(contractId);
      res.json(payments);
    } catch (error: any) {
      console.error('[Retainer Payments] Error fetching contract payments:', error);
      res.status(500).send(error.message);
    }
  });

  // Admin: Process monthly retainer payments for all active contracts
  app.post("/api/admin/retainer-payments/process-monthly", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { retainerPaymentScheduler } = await import('./retainerPaymentScheduler');

      console.log('[Admin] Manually triggering monthly retainer payment processing...');
      const results = await retainerPaymentScheduler.processMonthlyRetainerPayments();

      res.json({
        success: true,
        message: 'Monthly retainer payment processing completed',
        results,
      });
    } catch (error: any) {
      console.error('[Admin] Error processing monthly retainer payments:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Admin: Process monthly payment for a specific contract
  app.post("/api/admin/retainer-payments/process-contract/:contractId", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { contractId } = req.params;
      const { retainerPaymentScheduler } = await import('./retainerPaymentScheduler');

      console.log(`[Admin] Manually processing payment for contract ${contractId}...`);
      const result = await retainerPaymentScheduler.processContractMonthlyPayment(contractId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Monthly payment processed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error(`[Admin] Error processing contract payment:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Admin: Update retainer payment status (e.g., mark as completed, failed)
  app.patch("/api/admin/retainer-payments/:id/status", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).send("Status is required");
      }

      // If marking as completed, process the payment
      if (status === 'completed') {
        const { paymentProcessor } = await import('./paymentProcessor');

        const payment = await storage.getRetainerPayment(id);
        if (!payment) {
          return res.status(404).send("Payment not found");
        }

        // Validate creator has payment settings
        const validation = await paymentProcessor.validateCreatorPaymentSettings(payment.creatorId);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        // Process the payment
        const paymentResult = await paymentProcessor.processRetainerPayment(id);

        if (!paymentResult.success) {
          await storage.updateRetainerPaymentStatus(id, 'failed', {
            description: `Payment failed: ${paymentResult.error}`,
            failedAt: new Date(),
          });
          return res.status(400).json({ error: paymentResult.error });
        }

        // Update as completed with transaction details
        const updatedPayment = await storage.updateRetainerPaymentStatus(id, 'completed', {
          providerTransactionId: paymentResult.transactionId,
          providerResponse: paymentResult.providerResponse,
          completedAt: new Date(),
        });

        res.json(updatedPayment);
      } else {
        // Just update the status
        const updatedPayment = await storage.updateRetainerPaymentStatus(id, status);
        res.json(updatedPayment);
      }
    } catch (error: any) {
      console.error('[Admin] Error updating retainer payment status:', error);
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

  // Fix tracking codes for existing approved applications (admin only)
  app.post("/api/admin/fix-tracking-codes", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      console.log('[Admin] Starting tracking code fix...');

      // Get all approved applications
      const allApprovedApplications = await db
        .select()
        .from(applications)
        .where(eq(applications.status, 'approved'));

      let fixed = 0;
      let skipped = 0;

      for (const application of allApprovedApplications) {
        // Check if tracking code is missing or invalid
        if (!application.trackingCode || !application.trackingLink) {
          console.log(`[Admin] Fixing tracking code for application ${application.id}`);

          // Generate new tracking code
          const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${application.id.substring(0, 8)}`;
          const port = process.env.PORT || 3000;
          const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
          const trackingLink = `${baseURL}/go/${trackingCode}`;

          // Update the application
          await db
            .update(applications)
            .set({
              trackingCode,
              trackingLink,
              updatedAt: new Date(),
            })
            .where(eq(applications.id, application.id));

          fixed++;
        } else {
          skipped++;
        }
      }

      console.log(`[Admin] Tracking code fix complete. Fixed: ${fixed}, Skipped: ${skipped}`);
      res.json({
        success: true,
        fixed,
        skipped,
        total: allApprovedApplications.length,
      });
    } catch (error: any) {
      console.error('[Admin] Error fixing tracking codes:', error);
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

  // Database migration endpoint (admin only)
  app.post("/api/admin/run-migration-007", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      console.log('[Admin] Running migration 007...');

      const { db } = await import('./db');
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Read migration SQL
      const migrationPath = join(__dirname, '..', 'db', 'migrations', '007_add_payment_processing.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // Execute migration
      await db.execute(migrationSQL);

      console.log('[Admin] Migration 007 completed successfully!');

      res.json({
        success: true,
        message: 'Migration 007 applied successfully',
        changes: [
          'Created platform_funding_accounts table',
          'Added provider_transaction_id and provider_response to payments table',
          'Enhanced retainer_payments table with payment processing columns',
          'Added indexes for performance'
        ]
      });
    } catch (error: any) {
      console.error('[Admin] Migration 007 failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Audit Log routes
  app.get("/api/admin/audit-logs", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;

      const logs = await storage.getAuditLogs({
        userId,
        action,
        entityType,
        entityId,
        limit,
        offset,
      });

      res.json(logs);
    } catch (error: any) {
      console.error('[Audit Logs] Error fetching logs:', error);
      res.status(500).send(error.message);
    }
  });

  // Platform Settings routes
  app.get("/api/admin/settings", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const settings = category
        ? await storage.getPlatformSettingsByCategory(category)
        : await storage.getAllPlatformSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('[Platform Settings] Error fetching settings:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/settings/:key", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const setting = await storage.getPlatformSetting(req.params.key);
      if (!setting) {
        return res.status(404).send("Setting not found");
      }
      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error fetching setting:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/settings/:key", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).send("Value is required");
      }

      const setting = await storage.updatePlatformSetting(req.params.key, value.toString(), userId);

      // Log the settings change
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.UPDATE_PLATFORM_SETTINGS,
        entityType: EntityTypes.PLATFORM_SETTINGS,
        entityId: req.params.key,
        changes: { value },
        reason: req.body.reason,
      }, req);

      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error updating setting:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/settings", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { key, value, description, category } = req.body;

      if (!key || value === undefined || value === null) {
        return res.status(400).send("Key and value are required");
      }

      const setting = await storage.createPlatformSetting({
        key,
        value: value.toString(),
        description: description || null,
        category: category || null,
        updatedBy: userId,
      });

      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error creating setting:', error);
      res.status(500).send(error.message);
    }
  });

  // Platform Funding Accounts routes
  app.get("/api/admin/funding-accounts", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const accounts = await storage.getAllPlatformFundingAccounts();
      res.json(accounts);
    } catch (error: any) {
      console.error('[Funding Accounts] Error fetching accounts:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const account = await storage.getPlatformFundingAccount(req.params.id);
      if (!account) {
        return res.status(404).send("Funding account not found");
      }
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error fetching account:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/funding-accounts", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const account = await storage.createPlatformFundingAccount({
        ...req.body,
        createdBy: userId,
      });
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error creating account:', error);
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const account = await storage.updatePlatformFundingAccount(req.params.id, req.body);
      if (!account) {
        return res.status(404).send("Funding account not found");
      }
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error updating account:', error);
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.deletePlatformFundingAccount(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Funding Accounts] Error deleting account:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/funding-accounts/:id/set-primary", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.setPrimaryFundingAccount(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Funding Accounts] Error setting primary account:', error);
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
    const folder = req.body.folder || undefined; // Optional folder parameter
    console.log('[Upload API] Requested folder:', req.body.folder);
    console.log('[Upload API] Folder parameter passed to service:', folder);
    const uploadParams = await objectStorageService.getObjectEntityUploadURL(folder);
    console.log('[Upload API] Upload params returned:', uploadParams);
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

      // Set ACL for the thumbnail if provided
      let thumbnailPath = thumbnailUrl || null;
      if (thumbnailPath) {
        thumbnailPath = await objectStorageService.trySetObjectEntityAclPolicy(
          thumbnailPath,
          {
            owner: userId,
            visibility: "public",
          },
        );
      }

      // Create video record in database
      const video = await storage.createOfferVideo({
        offerId,
        videoUrl: objectPath,
        title,
        description: description || null,
        creatorCredit: creatorCredit || null,
        originalPlatform: originalPlatform || null,
        thumbnailUrl: thumbnailPath,
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

  // Creator: Resubmit deliverable (for revisions)
  app.patch("/api/creator/retainer-deliverables/:id/resubmit", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deliverable = await storage.getRetainerDeliverable(req.params.id);

      if (!deliverable) return res.status(404).send("Deliverable not found");
      if (deliverable.creatorId !== userId) return res.status(403).send("Forbidden");
      if (deliverable.status !== 'revision_requested') {
        return res.status(400).send("Can only resubmit deliverables with revision_requested status");
      }

      // Delete old video from Cloudinary
      const oldVideoUrl = deliverable.videoUrl;
      if (oldVideoUrl) {
        try {
          const objectStorageService = new ObjectStorageService();
          const publicId = objectStorageService.extractPublicIdFromUrl(oldVideoUrl);
          if (publicId) {
            console.log(`[Resubmit] Deleting old video from Cloudinary: ${publicId}`);
            await objectStorageService.deleteVideo(publicId);
            console.log(`[Resubmit] Successfully deleted old video`);
          }
        } catch (error) {
          console.error(`[Resubmit] Error deleting old video:`, error);
          // Continue even if deletion fails - we don't want to block the resubmission
        }
      }

      // Update deliverable with new video and reset status to pending_review
      const updated = await storage.updateRetainerDeliverable(req.params.id, {
        videoUrl: req.body.videoUrl,
        platformUrl: req.body.platformUrl,
        title: req.body.title,
        description: req.body.description,
        status: 'pending_review',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewNotes: null,
      } as any);

      res.json(updated);
    } catch (error: any) {
      console.error('[Resubmit Deliverable] Error:', error);
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

      // Calculate fees (4% platform fee, 3% processing fee)
      const grossAmount = paymentPerVideo;
      const platformFeeAmount = grossAmount * 0.04;
      const processingFeeAmount = grossAmount * 0.03;
      const netAmount = grossAmount - platformFeeAmount - processingFeeAmount;

      // Create payment for the approved deliverable
      const payment = await storage.createRetainerPayment({
        contractId: contract.id,
        deliverableId: deliverable.id,
        creatorId: deliverable.creatorId,
        companyId: contract.companyId,
        monthNumber: deliverable.monthNumber,
        paymentType: 'deliverable',
        grossAmount: grossAmount.toFixed(2),
        platformFeeAmount: platformFeeAmount.toFixed(2),
        processingFeeAmount: processingFeeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        amount: grossAmount.toFixed(2), // For backwards compatibility
        status: 'pending',
        description: `Retainer payment for ${contract.title} - Month ${deliverable.monthNumber}, Video ${deliverable.videoNumber}`,
        initiatedAt: new Date(),
      });

      console.log(`[Retainer Payment] Created payment ${payment.id} of $${netAmount.toFixed(2)} (net) for creator ${deliverable.creatorId}`);

      // 💰 PROCESS ACTUAL PAYMENT VIA PAYMENT PROCESSOR
      const { paymentProcessor } = await import('./paymentProcessor');

      // Validate creator has payment settings
      const validation = await paymentProcessor.validateCreatorPaymentSettings(deliverable.creatorId);
      if (!validation.valid) {
        console.warn(`[Retainer Payment] Creator ${deliverable.creatorId} has no payment method configured - payment created but not processed`);

        // Update payment with warning
        await storage.updateRetainerPaymentStatus(payment.id, 'pending', {
          description: `${payment.description}. PENDING: ${validation.error}`,
        });
      } else {
        // Process the payment
        const paymentResult = await paymentProcessor.processRetainerPayment(payment.id);

        if (paymentResult.success) {
          // Update payment as completed with transaction details
          await storage.updateRetainerPaymentStatus(payment.id, 'completed', {
            providerTransactionId: paymentResult.transactionId,
            providerResponse: paymentResult.providerResponse,
            completedAt: new Date(),
          });

          console.log(`[Retainer Payment] Successfully processed payment ${payment.id} - Transaction ID: ${paymentResult.transactionId}`);

          // 🆕 SEND NOTIFICATION TO CREATOR ABOUT PAYMENT
          const creator = await storage.getUserById(deliverable.creatorId);
          if (creator) {
            await notificationService.sendNotification(
              deliverable.creatorId,
              'payment_received',
              'Retainer Payment Sent! 💰',
              `$${netAmount.toFixed(2)} has been sent to your payment method for your approved deliverable on "${contract.title}". Transaction ID: ${paymentResult.transactionId}`,
              {
                userName: creator.firstName || creator.username,
                offerTitle: contract.title,
                amount: `$${netAmount.toFixed(2)}`,
                linkUrl: `/creator/retainer-contracts`,
              }
            );
            console.log(`[Notification] Sent retainer payment notification to creator ${creator.username}`);
          }
        } else {
          // Payment failed - update status
          await storage.updateRetainerPaymentStatus(payment.id, 'failed', {
            failedAt: new Date(),
            description: `${payment.description}. FAILED: ${paymentResult.error}`,
          });

          console.error(`[Retainer Payment] Failed to process payment ${payment.id}: ${paymentResult.error}`);
        }
      }

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

      // 🆕 SEND NOTIFICATION TO CREATOR ABOUT REJECTION
      const creator = await storage.getUserById(deliverable.creatorId);
      if (creator) {
        await notificationService.sendNotification(
          deliverable.creatorId,
          'deliverable_rejected',
          'Deliverable Rejected',
          `Your deliverable for "${contract.title}" (Month ${deliverable.monthNumber}, Video #${deliverable.videoNumber}) has been rejected. Please review the feedback.`,
          {
            userName: creator.firstName || creator.username,
            contractTitle: contract.title,
            reason: req.body.reviewNotes,
            linkUrl: `/retainers/${contract.id}`,
          }
        );
        console.log(`[Notification] Sent deliverable rejection notification to creator ${creator.username}`);
      }

      res.json(rejected);
    } catch (error: any) {
      console.error('[Reject Deliverable] Error:', error);
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

      // 🆕 SEND NOTIFICATION TO CREATOR ABOUT REVISION REQUEST
      const creator = await storage.getUserById(deliverable.creatorId);
      if (creator) {
        await notificationService.sendNotification(
          deliverable.creatorId,
          'revision_requested',
          'Revision Requested',
          `A revision has been requested for your deliverable on "${contract.title}" (Month ${deliverable.monthNumber}, Video #${deliverable.videoNumber}). Please review the feedback and resubmit.`,
          {
            userName: creator.firstName || creator.username,
            contractTitle: contract.title,
            revisionInstructions: req.body.reviewNotes,
            linkUrl: `/retainers/${contract.id}`,
          }
        );
        console.log(`[Notification] Sent revision request notification to creator ${creator.username}`);
      }

      res.json(revised);
    } catch (error: any) {
      console.error('[Request Revision] Error:', error);
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({
    noServer: true // We'll handle the upgrade manually for authentication
  });

  // Store connected clients
  const clients = new Map<string, WebSocket>();

  // Handle WebSocket upgrade with authentication
  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parseUrl(req.url || '', true);

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // Get session from cookie
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
    const sessionId = cookies['connect.sid'];

    if (!sessionId) {
      console.log('[WebSocket] No session cookie found');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Create a mock request/response to use express-session
    const mockReq: any = Object.create(req);
    mockReq.session = null;
    mockReq.sessionStore = null;
    mockReq.user = null;
    mockReq.isAuthenticated = function() {
      return !!this.user;
    };

    const mockRes: any = {
      getHeader: () => {},
      setHeader: () => {},
      end: () => {}
    };

    // Use the session middleware from the app
    const sessionMiddleware = (app as any)._router.stack
      .find((layer: any) => layer.name === 'session')?.handle;

    if (!sessionMiddleware) {
      console.error('[WebSocket] Session middleware not found');
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
      return;
    }

    sessionMiddleware(mockReq, mockRes, () => {
      passport.initialize()(mockReq, mockRes, () => {
        passport.session()(mockReq, mockRes, () => {
          if (!mockReq.user || !mockReq.isAuthenticated()) {
            console.log('[WebSocket] User not authenticated');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // User is authenticated, complete the WebSocket handshake
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, mockReq);
          });
        });
      });
    });
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    const userId = req.user?.id;

    if (!userId) {
      console.log('[WebSocket] No user ID found after authentication');
      ws.close();
      return;
    }

    console.log(`[WebSocket] User ${userId} connected`);
    clients.set(userId, ws);

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
        console.log(`[WebSocket] User ${userId} disconnected`);
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

              // 🆕 SEND NOTIFICATION FOR AUTO-APPROVED APPLICATION
              const offer = await storage.getOffer(application.offerId);
              const creator = await storage.getUserById(application.creatorId);

              if (offer && creator) {
                await notificationService.sendNotification(
                  application.creatorId,
                  'application_status_change',
                  'Your application has been approved! 🎉',
                  `Congratulations! Your application for "${offer.title}" has been auto-approved. You can now start promoting this offer.`,
                  {
                    userName: creator.firstName || creator.username,
                    offerTitle: offer.title,
                    trackingLink: trackingLink,
                    applicationId: application.id,
                    applicationStatus: 'approved',
                  }
                );
                console.log(`[Auto-Approval] Sent notification to creator ${creator.username}`);
              }
              
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