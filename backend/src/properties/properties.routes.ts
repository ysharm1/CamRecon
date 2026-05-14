/**
 * Properties Routes
 *
 * GET /api/properties — List all properties for the authenticated user's organization
 * GET /api/properties/:id — Get property detail with tenants and documents
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import db from '../db';

const router = Router();

/**
 * POST /api/properties
 * Creates a new property in the authenticated user's organization.
 * Body: { name, address: { street, city, state, zip, country? }, totalSquareFootage, propertyType }
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { name, address, totalSquareFootage, propertyType } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property name is required');
    }
    if (!address || typeof address !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'address object is required');
    }
    const { street, city, state, zip } = address;
    if (!street || !city || !state || !zip) {
      throw new AppError(400, 'VALIDATION_ERROR', 'address must include street, city, state, and zip');
    }
    if (!totalSquareFootage || typeof totalSquareFootage !== 'number' || totalSquareFootage <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'totalSquareFootage must be a positive number');
    }
    const validTypes = ['commercial', 'retail', 'industrial', 'mixed'];
    if (!validTypes.includes(propertyType)) {
      throw new AppError(400, 'VALIDATION_ERROR', `propertyType must be one of: ${validTypes.join(', ')}`);
    }

    const id = uuidv4();
    await db('properties').insert({
      id,
      name: name.trim(),
      address: JSON.stringify({
        street: street.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip: zip.trim(),
        country: address.country || 'US',
      }),
      total_square_footage: Math.round(totalSquareFootage),
      property_type: propertyType,
      owner_id: req.user.organizationId,
    });

    // Log activity
    await db('activity_feed').insert({
      user_id: req.user.userId,
      organization_id: req.user.organizationId,
      property_id: id,
      action: 'property.created',
      description: `Created property "${name.trim()}"`,
    });

    const created = await db('properties').where({ id }).first();

    res.status(201).json({
      data: {
        id: created.id,
        name: created.name,
        address: typeof created.address === 'string' ? JSON.parse(created.address) : created.address,
        totalSquareFootage: created.total_square_footage,
        propertyType: created.property_type,
        ownerId: created.owner_id,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/properties
 * Returns all properties scoped to the authenticated user's organization.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const properties = await db('properties')
      .where({ owner_id: req.user.organizationId })
      .select('*')
      .orderBy('name', 'asc');

    const data = properties.map((p: {
      id: string;
      name: string;
      address: string;
      total_square_footage: number;
      property_type: string;
      owner_id: string;
      created_at: string;
      updated_at: string;
    }) => ({
      id: p.id,
      name: p.name,
      address: typeof p.address === 'string' ? JSON.parse(p.address) : p.address,
      totalSquareFootage: p.total_square_footage,
      propertyType: p.property_type,
      ownerId: p.owner_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/properties/:id
 * Returns property detail with tenants and documents.
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { id } = req.params;

    const property = await db('properties')
      .where({ id, owner_id: req.user.organizationId })
      .first();

    if (!property) {
      throw new AppError(404, 'NOT_FOUND', 'Property not found');
    }

    // Get tenants for this property
    const tenants = await db('tenants')
      .where({ property_id: id })
      .select('*')
      .orderBy('name', 'asc');

    // Get documents for this property
    const documents = await db('documents')
      .where({ property_id: id })
      .select('*')
      .orderBy('created_at', 'desc');

    const data = {
      id: property.id,
      name: property.name,
      address: typeof property.address === 'string' ? JSON.parse(property.address) : property.address,
      totalSquareFootage: property.total_square_footage,
      propertyType: property.property_type,
      ownerId: property.owner_id,
      createdAt: property.created_at,
      updatedAt: property.updated_at,
      tenants: tenants.map((t: {
        id: string;
        name: string;
        contact_email: string;
        suite_number: string;
        square_footage: number;
        status: string;
      }) => ({
        id: t.id,
        name: t.name,
        contactEmail: t.contact_email,
        suiteNumber: t.suite_number,
        squareFootage: t.square_footage,
        status: t.status,
      })),
      documents: documents.map((d: {
        id: string;
        title: string;
        document_type: string;
        current_version: number;
        mime_type: string;
        size_bytes: number;
        created_at: string;
      }) => ({
        id: d.id,
        title: d.title,
        documentType: d.document_type,
        currentVersion: d.current_version,
        mimeType: d.mime_type,
        sizeBytes: d.size_bytes,
        createdAt: d.created_at,
      })),
    };

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
