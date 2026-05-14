import { CreditCard, TrendingUp, ArrowUpCircle, FileText, ExternalLink } from 'lucide-react';
import { useBilling } from '@/hooks/useBilling';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/lib/auth';

export function BillingPage() {
  const { user } = useAuth();
  const { plan, usage, invoices, isLoading, error, createCheckout } = useBilling();

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load billing information. Please try again.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Billing & Usage</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your subscription plan and monitor resource usage.
        </p>
      </div>

      {/* Current Plan */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2.5">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {plan?.plan.name || 'Starter'} Plan
              </h3>
              <p className="text-sm text-gray-500">{plan?.plan.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">
              ${((plan?.plan.priceMonthly || 0) / 100).toFixed(0)}
              <span className="text-sm font-normal text-gray-500">/mo</span>
            </p>
            {plan?.subscription && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                plan.subscription.status === 'active'
                  ? 'bg-green-50 text-green-700'
                  : plan.subscription.status === 'past_due'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {plan.subscription.status}
              </span>
            )}
          </div>
        </div>

        {/* Upgrade buttons */}
        {isAdmin && plan?.plan.id !== 'enterprise' && (
          <div className="mt-4 flex gap-3 border-t border-gray-100 pt-4">
            {plan?.availablePlans
              ?.filter((p) => p.id !== plan.plan.id && p.priceMonthly > (plan.plan.priceMonthly || 0))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => createCheckout(p.id)}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrade to {p.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Usage Meters */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Current Usage</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageMeter
            label="AI Calls"
            current={usage?.current.aiCalls || 0}
            limit={usage?.limits.maxAiCallsPerMonth || 0}
          />
          <UsageMeter
            label="Documents"
            current={usage?.current.documentUploads || 0}
            limit={usage?.limits.maxDocuments || 0}
          />
          <UsageMeter
            label="Properties"
            current={usage?.current.aiCalls !== undefined ? 0 : 0}
            limit={usage?.limits.maxProperties || 0}
            note="Counted from active properties"
          />
          <UsageMeter
            label="Storage"
            current={usage?.current.storageBytes || 0}
            limit={usage?.limits.maxStorageBytes || 0}
            formatFn={formatBytes}
          />
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Billing History</h3>
        </div>

        {invoices && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{invoice.description}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${(invoice.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-50 text-green-700'
                          : invoice.status === 'open'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No invoices yet.</p>
        )}
      </div>
    </div>
  );
}

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
  formatFn?: (value: number) => string;
  note?: string;
}

function UsageMeter({ label, current, limit, formatFn, note }: UsageMeterProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const format = formatFn || ((v: number) => v.toString());

  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="mt-2">
        <p className="text-lg font-semibold text-gray-900">
          {format(current)}
          <span className="text-sm font-normal text-gray-500">
            {' / '}
            {isUnlimited ? '∞' : format(limit)}
          </span>
        </p>
      </div>
      {!isUnlimited && (
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full transition-all ${
                isAtLimit
                  ? 'bg-red-500'
                  : isNearLimit
                  ? 'bg-yellow-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
      {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '∞';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
