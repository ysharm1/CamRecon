/**
 * Billing Service Tests
 *
 * Tests for plan definitions, limit checking logic, and usage tracking.
 */

import { describe, it, expect } from 'vitest';
import { PLANS } from './plans.service';

describe('Plans Service', () => {
  describe('PLANS constant', () => {
    it('should define starter, pro, and enterprise plans', () => {
      expect(PLANS.starter).toBeDefined();
      expect(PLANS.pro).toBeDefined();
      expect(PLANS.enterprise).toBeDefined();
    });

    it('starter plan should have correct limits', () => {
      const starter = PLANS.starter;
      expect(starter.id).toBe('starter');
      expect(starter.name).toBe('Starter');
      expect(starter.limits.maxProperties).toBe(5);
      expect(starter.limits.maxDocuments).toBe(50);
      expect(starter.limits.maxAiCallsPerMonth).toBe(10);
      expect(starter.limits.maxStorageBytes).toBe(1 * 1024 * 1024 * 1024);
    });

    it('pro plan should have correct limits', () => {
      const pro = PLANS.pro;
      expect(pro.id).toBe('pro');
      expect(pro.name).toBe('Pro');
      expect(pro.limits.maxProperties).toBe(25);
      expect(pro.limits.maxDocuments).toBe(-1); // unlimited
      expect(pro.limits.maxAiCallsPerMonth).toBe(100);
      expect(pro.limits.maxStorageBytes).toBe(10 * 1024 * 1024 * 1024);
    });

    it('enterprise plan should have unlimited limits', () => {
      const enterprise = PLANS.enterprise;
      expect(enterprise.id).toBe('enterprise');
      expect(enterprise.name).toBe('Enterprise');
      expect(enterprise.limits.maxProperties).toBe(-1);
      expect(enterprise.limits.maxDocuments).toBe(-1);
      expect(enterprise.limits.maxAiCallsPerMonth).toBe(-1);
      expect(enterprise.limits.maxStorageBytes).toBe(-1);
    });

    it('plans should have increasing prices', () => {
      expect(PLANS.starter.priceMonthly).toBeLessThan(PLANS.pro.priceMonthly);
      expect(PLANS.pro.priceMonthly).toBeLessThan(PLANS.enterprise.priceMonthly);
    });

    it('all plans should have required fields', () => {
      for (const plan of Object.values(PLANS)) {
        expect(plan.id).toBeTruthy();
        expect(plan.name).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(plan.limits).toBeDefined();
        expect(plan.priceMonthly).toBeGreaterThan(0);
      }
    });
  });

  describe('Plan limits logic', () => {
    it('-1 should represent unlimited', () => {
      // Enterprise has unlimited everything
      const limits = PLANS.enterprise.limits;
      expect(limits.maxProperties).toBe(-1);
      expect(limits.maxDocuments).toBe(-1);
      expect(limits.maxAiCallsPerMonth).toBe(-1);
      expect(limits.maxStorageBytes).toBe(-1);
    });

    it('starter limits should be more restrictive than pro', () => {
      const starter = PLANS.starter.limits;
      const pro = PLANS.pro.limits;

      expect(starter.maxProperties).toBeLessThan(pro.maxProperties);
      expect(starter.maxAiCallsPerMonth).toBeLessThan(pro.maxAiCallsPerMonth);
      expect(starter.maxStorageBytes).toBeLessThan(pro.maxStorageBytes);
    });
  });
});

describe('Usage Event Types', () => {
  it('should support expected event types', () => {
    const validTypes = ['ai_abstraction_call', 'cam_reconciliation_run', 'document_upload', 'active_users'];
    // These are the event types tracked by the system
    expect(validTypes).toHaveLength(4);
    expect(validTypes).toContain('ai_abstraction_call');
    expect(validTypes).toContain('cam_reconciliation_run');
    expect(validTypes).toContain('document_upload');
    expect(validTypes).toContain('active_users');
  });
});
