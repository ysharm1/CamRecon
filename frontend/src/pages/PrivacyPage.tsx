import { Link } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-indigo-600" />
            <span className="text-lg font-semibold text-gray-900">PropDoc</span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm mt-10 max-w-none text-gray-700">
          <h2 className="mt-8 text-xl font-semibold text-gray-900">1. What we collect</h2>
          <p>We collect three categories of data:</p>
          <ul>
            <li>
              <strong>Account data</strong> — name, email, organization, role, and
              password hash.
            </li>
            <li>
              <strong>Customer data</strong> — property, tenant, lease, and
              reconciliation data you upload.
            </li>
            <li>
              <strong>Usage data</strong> — log events, request IDs, and diagnostic
              telemetry used to operate and improve the Service.
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">2. How we use data</h2>
          <p>
            We use account and customer data to deliver the Service. We use usage
            data to monitor performance, troubleshoot, and secure our systems. We
            do not sell personal information, and we do not use customer data to
            train foundation models.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">3. Sharing with subprocessors</h2>
          <p>
            We share data only with the subprocessors listed on our{' '}
            <Link to="/security" className="font-medium text-indigo-600 hover:text-indigo-500">
              Security page
            </Link>
            . Each subprocessor is bound by a data-processing agreement.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">4. AI processing</h2>
          <p>
            Lease abstraction sends document text to our AI provider for analysis.
            Where the provider offers a zero-retention endpoint we use it; otherwise
            the provider is contractually prohibited from using your data to train
            models.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">5. Retention</h2>
          <p>
            We retain customer data for as long as your subscription is active, plus
            30 days after termination for recovery. You can request export or
            deletion of your organization's data at any time.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">6. Your rights</h2>
          <p>
            Subject to applicable law, you have the right to access, correct,
            delete, or port your personal information. Contact us at the address
            below to exercise these rights.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">7. Security</h2>
          <p>
            We use AES-256 encryption at rest and TLS 1.3 in transit. See our{' '}
            <Link to="/security" className="font-medium text-indigo-600 hover:text-indigo-500">
              Security page
            </Link>{' '}
            for detail.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">8. Contact</h2>
          <p>
            Privacy questions can be directed to{' '}
            <a
              href="mailto:privacy@propdoc.example.com"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              privacy@propdoc.example.com
            </a>
            .
          </p>

          <p className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            This is placeholder text. Consult legal counsel before relying on it in
            production.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <span className="text-sm text-gray-500">© {new Date().getFullYear()} PropDoc</span>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link to="/security" className="hover:text-gray-900">Security</Link>
            <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-900">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
