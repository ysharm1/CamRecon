import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Link2,
  Unlink,
  FileSignature,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useIntegrations,
  useConnectIntegration,
  useDisconnectIntegration,
  Integration,
} from '@/hooks/useIntegrations';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { isFeatureEnabled } from '@/lib/features';

const QUICKBOOKS_FEATURES = [
  'Sync CAM charges as invoices',
  'Import expenses for reconciliation',
  'Map chart of accounts to expense categories',
  'Export journal entries from reconciliations',
];

const DOCUSIGN_FEATURES = [
  'Send lease amendments for e-signature',
  'Track signature status in real-time',
  'Store signed documents as new versions',
];

export function IntegrationsPage() {
  const [searchParams] = useSearchParams();
  const { data: integrations, isLoading, error } = useIntegrations();
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();

  const docusignEnabled = isFeatureEnabled('docusign');

  // Handle OAuth redirect callback
  useEffect(() => {
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    if (provider && status === 'connected') {
      toast.success(`Successfully connected to ${provider}`);
    }
  }, [searchParams]);

  function handleConnect(provider: string) {
    connectMutation.mutate(provider, {
      onSuccess: (data) => {
        toast.success(data.message || `Connected to ${provider}`);
      },
      onError: () => {
        toast.error(`Failed to connect to ${provider}`);
      },
    });
  }

  function handleDisconnect(provider: string) {
    disconnectMutation.mutate(provider, {
      onSuccess: () => {
        toast.success(`Disconnected from ${provider}`);
      },
      onError: () => {
        toast.error(`Failed to disconnect from ${provider}`);
      },
    });
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">Failed to load integrations. Please try again.</p>
      </div>
    );
  }

  const quickbooks = integrations?.find((i) => i.id === 'quickbooks');
  const docusign = integrations?.find((i) => i.id === 'docusign');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Integrations</h2>
        <p className="mt-1 text-sm text-gray-600">
          PropDoc plays nicely with the systems you already use. Hook up QuickBooks
          to keep your books and CAM data in sync.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Primary: QuickBooks */}
          {quickbooks && (
            <QuickBooksCard
              integration={quickbooks}
              onConnect={() => handleConnect('quickbooks')}
              onDisconnect={() => handleDisconnect('quickbooks')}
              connecting={connectMutation.isPending}
              disconnecting={disconnectMutation.isPending}
            />
          )}

          {/* DocuSign — Coming Soon */}
          {docusignEnabled && docusign ? (
            <LiveDocuSignCard
              integration={docusign}
              onConnect={() => handleConnect('docusign')}
              onDisconnect={() => handleDisconnect('docusign')}
              connecting={connectMutation.isPending}
              disconnecting={disconnectMutation.isPending}
            />
          ) : (
            <ComingSoonCard />
          )}
        </div>
      )}
    </div>
  );
}

function QuickBooksCard({
  integration,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
  disconnecting: boolean;
}) {
  return (
    <div className="relative rounded-lg border-2 border-indigo-200 bg-white p-6 shadow-sm">
      <span className="absolute -top-2 left-6 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        <Sparkles className="h-3 w-3" />
        Recommended
      </span>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-50 p-2.5 text-green-600">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
            <p className="text-sm text-gray-500">{integration.description}</p>
          </div>
        </div>
        <StatusBadge connected={integration.connected} mode={integration.mode} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {QUICKBOOKS_FEATURES.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>

      {integration.connected && integration.lastSyncAt && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
        {integration.connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Unlink className="h-4 w-4" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            Connect now
          </button>
        )}
        {integration.connected && (
          <span className="text-xs text-gray-500">
            Mode: <span className="font-medium">{integration.mode}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ComingSoonCard() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2.5 text-gray-400">
            <FileSignature className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-500">DocuSign</h3>
            <p className="text-sm text-gray-400">
              E-signature for lease amendments and estoppel certificates.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
          Coming soon
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {DOCUSIGN_FEATURES.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-gray-200 pt-4">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400"
        >
          <Link2 className="h-4 w-4" />
          Coming soon
        </button>
      </div>
    </div>
  );
}

function LiveDocuSignCard({
  integration,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
  disconnecting: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-yellow-50 p-2.5 text-yellow-600">
            <FileSignature className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
            <p className="text-sm text-gray-500">{integration.description}</p>
          </div>
        </div>
        <StatusBadge connected={integration.connected} mode={integration.mode} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {DOCUSIGN_FEATURES.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
        {integration.connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Unlink className="h-4 w-4" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ connected, mode }: { connected: boolean; mode: string }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Connected{mode === 'demo' ? ' (Demo)' : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <XCircle className="h-3 w-3" />
      Not connected
    </span>
  );
}
