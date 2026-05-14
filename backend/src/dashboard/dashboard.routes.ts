/**
 * Dashboard Routes
 *
 * GET /api/dashboard — Returns all dashboard data scoped to the authenticated user's organization
 * POST /api/dashboard/renewal-risks — Returns renewal risk analysis for expiring leases
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { dashboardService } from './dashboard.service';
import db from '../db';

const router = Router();

/**
 * GET /api/dashboard
 * Returns aggregated dashboard data including metrics, lease expirations,
 * pending reconciliations, and overdue documents.
 *
 * All data is scoped to the authenticated user's organization.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const data = await dashboardService.getDashboardData(organizationId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export interface RenewalRisk {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  expirationDate: string;
  noticeDays: number;
  daysUntilExpiry: number;
  status: 'missed' | 'urgent' | 'upcoming';
  message: string;
}

/**
 * POST /api/dashboard/renewal-risks
 * For each lease expiring within 90 days, check if the notice period has passed.
 * Pure date math — no AI needed.
 */
router.post('/renewal-risks', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;

    // Get property IDs for this organization
    const propertyIds = await db('properties')
      .where({ owner_id: organizationId })
      .pluck('id');

    if (propertyIds.length === 0) {
      res.json({ data: { risks: [] } });
      return;
    }

    const now = new Date();
    const in90Days = new Date(now);
    in90Days.setDate(in90Days.getDate() + 90);

    // Get expiring leases with renewal options (which contain notice period info)
    const expiringLeases = await db('lease_abstractions as la')
      .join('tenants as t', 'la.tenant_id', 't.id')
      .join('properties as p', 't.property_id', 'p.id')
      .whereIn('t.property_id', propertyIds)
      .where('la.expiration_date', '>=', now.toISOString().split('T')[0])
      .where('la.expiration_date', '<=', in90Days.toISOString().split('T')[0])
      .select(
        'la.tenant_id',
        'la.expiration_date',
        'la.renewal_options',
        'la.extracted_terms',
        't.name as tenant_name',
        'p.name as property_name'
      )
      .orderBy('la.expiration_date', 'asc');

    const risks: RenewalRisk[] = expiringLeases.map((lease: {
      tenant_id: string;
      expiration_date: string;
      renewal_options: unknown;
      extracted_terms: unknown;
      tenant_name: string;
      property_name: string;
    }) => {
      const expirationDate = new Date(lease.expiration_date);
      const daysUntilExpiry = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Try to extract notice period from renewal_options or extracted_terms
      let noticeDays = 180; // Default commercial lease notice period

      // Check renewal_options for notice period
      if (lease.renewal_options) {
        try {
          const opts = typeof lease.renewal_options === 'string'
            ? JSON.parse(lease.renewal_options)
            : lease.renewal_options;
          if (Array.isArray(opts)) {
            for (const opt of opts) {
              if (typeof opt === 'object' && opt !== null && opt.noticeDays) {
                noticeDays = Number(opt.noticeDays);
                break;
              }
              // Try to parse notice period from string like "180 days notice"
              if (typeof opt === 'string') {
                const match = opt.match(/(\d+)\s*days?\s*notice/i);
                if (match) {
                  noticeDays = parseInt(match[1], 10);
                  break;
                }
              }
            }
          }
        } catch { /* use default */ }
      }

      // Determine status based on notice period vs days until expiry
      let status: 'missed' | 'urgent' | 'upcoming';
      let message: string;

      if (daysUntilExpiry < noticeDays) {
        // Notice window has already passed
        const daysMissed = noticeDays - daysUntilExpiry;
        status = 'missed';
        message = `Notice window closed ${daysMissed} days ago — contact tenant immediately`;
      } else if (daysUntilExpiry - noticeDays <= 30) {
        // Notice window closes within 30 days
        const daysLeft = daysUntilExpiry - noticeDays;
        status = 'urgent';
        message = `${daysLeft} days left to give notice`;
      } else {
        status = 'upcoming';
        message = `Notice due in ${daysUntilExpiry - noticeDays} days`;
      }

      return {
        tenantId: lease.tenant_id,
        tenantName: lease.tenant_name,
        propertyName: lease.property_name,
        expirationDate: lease.expiration_date,
        noticeDays,
        daysUntilExpiry,
        status,
        message,
      };
    });

    res.json({ data: { risks } });
  } catch (error) {
    next(error);
  }
});

export default router;
