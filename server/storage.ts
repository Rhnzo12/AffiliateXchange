async getApplicationsTimeSeriesByCompany(companyId: string, dateRange: string): Promise<any[]> {
  try {
    const companyProfile = await this.getCompanyProfile(companyId);
    if (!companyProfile) {
      return [];
    }
    const whereClauses: any[] = [eq(offers.companyId, companyProfile.id)];
    if (dateRange !== "all") {
      let daysBack = 30;
      if (dateRange === "7d") daysBack = 7;
      else if (dateRange === "30d") daysBack = 30;
      else if (dateRange === "90d") daysBack = 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      whereClauses.push(sql`${applications.createdAt} >= ${startDate}`);
    }
    const rows = await db
      .select({
        date: sql<string>`TO_CHAR(DATE(${applications.createdAt}), 'Mon DD')`,
        isoDate: sql<string>`TO_CHAR(DATE(${applications.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`COUNT(${applications.id})`,
        pending: sql<number>`SUM(CASE WHEN ${applications.status} = 'pending' THEN 1 ELSE 0 END)`,
        approved: sql<number>`SUM(CASE WHEN ${applications.status} = 'approved' THEN 1 ELSE 0 END)`,
        active: sql<number>`SUM(CASE WHEN ${applications.status} = 'active' THEN 1 ELSE 0 END)`,
        paused: sql<number>`SUM(CASE WHEN ${applications.status} = 'paused' THEN 1 ELSE 0 END)`,
        completed: sql<number>`SUM(CASE WHEN ${applications.status} = 'completed' THEN 1 ELSE 0 END)`,
      })
      .from(applications)
      .innerJoin(offers, eq(applications.offerId, offers.id))
      .where(and(...whereClauses))
      .groupBy(sql`DATE(${applications.createdAt})`)
      .orderBy(sql`DATE(${applications.createdAt})`);
    return rows || [];
  } catch (error) {
    if (isMissingRelationError(error, "applications")) {
      return [];
    }
    console.error("[getApplicationsTimeSeriesByCompany] Error:", error);
    return [];
  }
}

async getConversionFunnelByCompany(companyId: string): Promise<{
  applied: number;
  approved: number;
  active: number;
  paused: number;
  completed: number;
  conversions: number;
}> {
  try {
    const companyProfile = await this.getCompanyProfile(companyId);
    if (!companyProfile) {
      return {
        applied: 0,
        approved: 0,
        active: 0,
        paused: 0,
        completed: 0,
        conversions: 0,
      };
    }
    const offerIdsResult = await db
      .select({ id: offers.id })
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));
    if (offerIdsResult.length === 0) {
      return {
        applied: 0,
        approved: 0,
        active: 0,
        paused: 0,
        completed: 0,
        conversions: 0,
      };
    }
    const offerIds = offerIdsResult.map((o) => o.id);
    const [applicationCounts, conversionRows] = await Promise.all([
      db
        .select({
          applied: sql<number>`COUNT(${applications.id})`,
          approved: sql<number>`SUM(CASE WHEN ${applications.status} IN ('approved', 'active', 'completed') THEN 1 ELSE 0 END)`,
          active: sql<number>`SUM(CASE WHEN ${applications.status} = 'active' THEN 1 ELSE 0 END)`,
          paused: sql<number>`SUM(CASE WHEN ${applications.status} = 'paused' THEN 1 ELSE 0 END)`,
          completed: sql<number>`SUM(CASE WHEN ${applications.status} = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(applications)
        .where(inArray(applications.offerId, offerIds)),
      db
        .select({
          conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        })
        .from(analytics)
        .innerJoin(applications, eq(analytics.applicationId, applications.id))
        .where(inArray(applications.offerId, offerIds)),
    ]);
    return {
      applied: applicationCounts[0]?.applied || 0,
      approved: applicationCounts[0]?.approved || 0,
      active: applicationCounts[0]?.active || 0,
      paused: applicationCounts[0]?.paused || 0,
      completed: applicationCounts[0]?.completed || 0,
      conversions: conversionRows[0]?.conversions || 0,
    };
  } catch (error) {
    if (isMissingRelationError(error, "applications")) {
      return {
        applied: 0,
        approved: 0,
        active: 0,
        paused: 0,
        completed: 0,
        conversions: 0,
      };
    }
    console.error("[getConversionFunnelByCompany] Error:", error);
    return {
      applied: 0,
      approved: 0,
      active: 0,
      paused: 0,
      completed: 0,
      conversions: 0,
    };
  }
}

async getCreatorAcquisitionSourcesByCompany(companyId: string): Promise<{
  source: string;
  creators: number;
}[]> {
  try {
    const companyProfile = await this.getCompanyProfile(companyId);
    if (!companyProfile) {
      return [];
    }
    const applicationsForCompany = await db
      .select({ id: applications.id, creatorId: applications.creatorId })
      .from(applications)
      .innerJoin(offers, eq(applications.offerId, offers.id))
      .where(eq(offers.companyId, companyProfile.id));
    if (applicationsForCompany.length === 0) {
      return [];
    }
    const creatorIds = new Set(applicationsForCompany.map((app) => app.creatorId));
    const applicationIds = applicationsForCompany.map((app) => app.id);
    const clickRows = await db
      .select({
        creatorId: clickEvents.creatorId,
        utmSource: clickEvents.utmSource,
        timestamp: clickEvents.timestamp,
      })
      .from(clickEvents)
      .where(inArray(clickEvents.applicationId, applicationIds))
      .orderBy(asc(clickEvents.timestamp));
    const creatorSource = new Map<string, string>();
    clickRows.forEach((row) => {
      if (!creatorSource.has(row.creatorId)) {
        creatorSource.set(row.creatorId, row.utmSource || "Direct/Other");
      }
    });
    // Ensure every creator is represented
    creatorIds.forEach((creatorId) => {
      if (!creatorSource.has(creatorId)) {
        creatorSource.set(creatorId, "Direct/Other");
      }
    });
    const sourceCounts = new Map<string, number>();
    creatorSource.forEach((source) => {
      const key = source?.trim() || "Direct/Other";
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    });
    return Array.from(sourceCounts.entries()).map(([source, creators]) => ({
      source,
      creators,
    }));
  } catch (error) {
    if (
      isMissingRelationError(error, "click_events") ||
      isMissingColumnError(error, "click_events")
    ) {
      return [];
    }
    console.error("[getCreatorAcquisitionSourcesByCompany] Error:", error);
    return [];
  }
}

async getCreatorGeographyByCompany(companyId: string): Promise<{
  country: string;
  count: number;
}[]> {
  try {
    const companyProfile = await this.getCompanyProfile(companyId);
    if (!companyProfile) {
      return [];
    }
    const rows = await db
      .select({
        country: clickEvents.country,
        count: sql<number>`COUNT(${clickEvents.id})`,
      })
      .from(clickEvents)
      .innerJoin(applications, eq(clickEvents.applicationId, applications.id))
      .innerJoin(offers, eq(applications.offerId, offers.id))
      .where(eq(offers.companyId, companyProfile.id))
      .groupBy(clickEvents.country);
    return rows
      .filter((row) => !!row.country)
      .map((row) => ({
        country: row.country!,
        count: row.count,
      }));
  } catch (error) {
    if (
      isMissingRelationError(error, "click_events") ||
      isMissingColumnError(error, "click_events", ["country"])
    ) {
      return [];
    }
    console.error("[getCreatorGeographyByCompany] Error:", error);
    return [];
  }
}