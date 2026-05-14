/**
 * Tenants Routes
 *
 * GET /api/tenants — List all tenants (optionally filtered by propertyId)
 * GET /api/tenants/:id — Get tenant detail with lease info and documents
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import db from '../db';

const router = Router();

/**
 * POST /api/tenants
 * Creates a new tenant under a property in the user's organization.
 * Body: { name, contactEmail, propertyId, suiteNumber, squareFootage }
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { name, contactEmail, propertyId, suiteNumber, squareFootage } = req.body;

    if (!name || !name.toString().trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Tenant name is required');
    }
    if (!contactEmail || !contactEmail.toString().includes('@')) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A valid contact email is required');
    }
    if (!propertyId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'propertyId is required');
    }
    if (!suiteNumber || !suiteNumber.toString().trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'suiteNumber is required');
    }
    if (!squareFootage || typeof squareFootage !== 'number' || squareFootage <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'squareFootage must be a positive number');
    }

    // Verify property belongs to the user's organization
    const property = await db('properties')
      .where({ id: propertyId, owner_id: req.user.organizationId })
      .first();

    if (!property) {
      throw new AppError(404, 'NOT_FOUND', 'Property not found');
    }

    const id = uuidv4();
    await db('tenants').insert({
      id,
      name: name.toString().trim(),
      contact_email: contactEmail.toString().trim().toLowerCase(),
      property_id: propertyId,
      suite_number: suiteNumber.toString().trim(),
      square_footage: Math.round(squareFootage),
      status: 'active',
    });

    // Log activity
    await db('activity_feed').insert({
      user_id: req.user.userId,
      organization_id: req.user.organizationId,
      property_id: propertyId,
      tenant_id: id,
      action: 'tenant.created',
      description: `Added tenant "${name.toString().trim()}" to ${property.name}`,
    });

    const created = await db('tenants').where({ id }).first();

    res.status(201).json({
      data: {
        id: created.id,
        name: created.name,
        contactEmail: created.contact_email,
        propertyId: created.property_id,
        propertyName: property.name,
        suiteNumber: created.suite_number,
        squareFootage: created.square_footage,
        status: created.status,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants
 * Returns all tenants scoped to the authenticated user's organization.
 * Optional query param: ?propertyId=<uuid>
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { propertyId } = req.query;

    // Get property IDs for this organization
    const propertyIds = await db('properties')
      .where({ owner_id: req.user.organizationId })
      .pluck('id');

    if (propertyIds.length === 0) {
      return res.json({ data: [] });
    }

    let query = db('tenants as t')
      .join('properties as p', 't.property_id', 'p.id')
      .whereIn('t.property_id', propertyIds)
      .select(
        't.id',
        't.name',
        't.contact_email',
        't.property_id',
        'p.name as property_name',
        't.suite_number',
        't.square_footage',
        't.status',
        't.created_at',
        't.updated_at'
      )
      .orderBy('t.name', 'asc');

    if (propertyId && typeof propertyId === 'string') {
      query = query.where('t.property_id', propertyId);
    }

    const tenants = await query;

    const data = tenants.map((t: {
      id: string;
      name: string;
      contact_email: string;
      property_id: string;
      property_name: string;
      suite_number: string;
      square_footage: number;
      status: string;
      created_at: string;
      updated_at: string;
    }) => ({
      id: t.id,
      name: t.name,
      contactEmail: t.contact_email,
      propertyId: t.property_id,
      propertyName: t.property_name,
      suiteNumber: t.suite_number,
      squareFootage: t.square_footage,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants/:id
 * Returns tenant detail with lease info and documents.
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { id } = req.params;

    // Get tenant with property verification
    const tenant = await db('tenants as t')
      .join('properties as p', 't.property_id', 'p.id')
      .where('t.id', id)
      .where('p.owner_id', req.user.organizationId)
      .select(
        't.id',
        't.name',
        't.contact_email',
        't.property_id',
        'p.name as property_name',
        't.suite_number',
        't.square_footage',
        't.status',
        't.created_at',
        't.updated_at'
      )
      .first();

    if (!tenant) {
      throw new AppError(404, 'NOT_FOUND', 'Tenant not found');
    }

    // Get lease abstraction for this tenant
    const lease = await db('lease_abstractions')
      .where({ tenant_id: id })
      .orderBy('created_at', 'desc')
      .first();

    // Get documents for this tenant
    const documents = await db('documents')
      .where({ tenant_id: id })
      .select('*')
      .orderBy('created_at', 'desc');

    const data = {
      id: tenant.id,
      name: tenant.name,
      contactEmail: tenant.contact_email,
      propertyId: tenant.property_id,
      propertyName: tenant.property_name,
      suiteNumber: tenant.suite_number,
      squareFootage: tenant.square_footage,
      status: tenant.status,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
      lease: lease
        ? {
            id: lease.id,
            documentId: lease.document_id,
            commencementDate: lease.commencement_date,
            expirationDate: lease.expiration_date,
            baseRentCents: lease.base_rent_cents,
            rentEscalation: typeof lease.rent_escalation === 'string'
              ? JSON.parse(lease.rent_escalation)
              : lease.rent_escalation,
            camCapCents: lease.cam_cap_cents,
            securityDepositCents: lease.security_deposit_cents,
            confidenceScore: lease.confidence_score,
            reviewStatus: lease.review_status,
          }
        : null,
      documents: documents.map((d: {
        id: string;
        title: string;
        document_type: string;
        current_version: number;
        created_at: string;
      }) => ({
        id: d.id,
        title: d.title,
        documentType: d.document_type,
        currentVersion: d.current_version,
        createdAt: d.created_at,
      })),
    };

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
