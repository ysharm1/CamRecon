import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface PlanLimits {
  maxProperties: number;
  maxDocuments: number;
  maxAiCallsPerMonth: number;
  maxStorageBytes: number;
}

interface PlanInfo {
  id: string;
  name: string;
  description: string;
  limits: PlanLimits;
  priceMonthly: number;
}

interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string | null;
}

interface PlanResponse {
  data: {
    plan: PlanInfo;
    subscription: Subscription | null;
    availablePlans: PlanInfo[];
  };
}

interface UsageResponse {
  data: {
    current: {
      aiCalls: number;
      camRuns: number;
      documentUploads: number;
      storageBytes: number;
      activeUsers: number;
    };
    limits: PlanLimits;
    planId: string;
    planName: string;
    monthly: Array<{
      eventType: string;
      totalQuantity: number;
      eventCount: number;
    }>;
  };
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
  pdfUrl: string | null;
}

interface InvoicesResponse {
  data: Invoice[];
}

interface CheckoutResponse {
  data: {
    sessionId: string;
    checkoutUrl: string;
  };
}

export function useBilling() {
  const queryClient = useQueryClient();

  const planQuery = useQuery<PlanResponse>({
    queryKey: ['billing', 'plan'],
    queryFn: () => api.get('/api/billing/plan'),
  });

  const usageQuery = useQuery<UsageResponse>({
    queryKey: ['billing', 'usage'],
    queryFn: () => api.get('/api/billing/usage'),
  });

  const invoicesQuery = useQuery<InvoicesResponse>({
    queryKey: ['billing', 'invoices'],
    queryFn: () => api.get('/api/billing/invoices'),
  });

  const checkoutMutation = useMutation<CheckoutResponse, Error, string>({
    mutationFn: (planId: string) =>
      api.post('/api/billing/create-checkout', { planId }),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create checkout session');
    },
  });

  return {
    plan: planQuery.data?.data,
    usage: usageQuery.data?.data,
    invoices: invoicesQuery.data?.data,
    isLoading: planQuery.isLoading || usageQuery.isLoading || invoicesQuery.isLoading,
    error: planQuery.error || usageQuery.error || invoicesQuery.error,
    createCheckout: (planId: string) => checkoutMutation.mutate(planId),
    isCheckoutLoading: checkoutMutation.isPending,
  };
}
