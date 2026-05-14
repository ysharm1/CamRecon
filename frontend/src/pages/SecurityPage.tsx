import { Link } from 'react-router-dom';
import {
  Building2,
  Lock,
  ShieldCheck,
  Users,
  FileText,
  Globe,
  Cloud,
  ArrowLeft,
} from 'lucide-react';

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
          Security at PropDoc
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          We take the protection of your portfolio data seriously. Here's how we
          secure it at every layer.
        </p>

        <div className="mt-10 space-y-8">
          <Section icon={Lock} title="Encryption">
            <p>
              All customer data is encrypted at rest using <strong>AES-256</strong>.
              In transit, everything moves over <strong>TLS 1.3</strong> — including
              document uploads, API calls, and reconciliation results.
            </p>
          </Section>

          <Section icon={Users} title="Role-based access control">
            <p>
              PropDoc supports four roles out of the box: Admin, Property Manager,
              Accountant, and Read-Only. Each user sees only what their role allows,
              with granular permissions on documents, reconciliations, and reports.
            </p>
          </Section>

          <Section icon={FileText} title="Complete audit trail">
            <p>
              Every document upload, version change, abstraction approval, and
              reconciliation action is captured in an immutable audit log. You can
              see who did what, when, and why — down to the row level.
            </p>
          </Section>

          <Section icon={ShieldCheck} title="Compliance roadmap">
            <p>
              We are pursuing <strong>SOC 2 Type II</strong> certification.
              Controls for access management, change management, incident response,
              and vendor risk are in place today; the formal audit is in progress.
            </p>
          </Section>

          <Section icon={Globe} title="Data residency">
            <p>
              All customer data is stored in the <strong>United States</strong>. We
              do not replicate customer data to other regions, and we do not use
              offshore processing for primary workloads.
            </p>
          </Section>

          <Section icon={Cloud} title="Subprocessors">
            <p>
              We rely on a small list of trusted vendors to deliver PropDoc. Our
              subprocessors are:
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <strong>AWS</strong> — infrastructure hosting (us-east-1, us-west-2)
              </li>
              <li>
                <strong>OpenAI</strong> — AI lease abstraction (data is not used
                to train models; zero-retention endpoints where available)
              </li>
              <li>
                <strong>QuickBooks (Intuit)</strong> — accounting sync
              </li>
              <li>
                <strong>Stripe</strong> — payment processing for PropDoc
                subscriptions
              </li>
            </ul>
          </Section>
        </div>

        <div className="mt-14 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-700">
            Have a security question or need our trust packet?
          </p>
          <a
            href="mailto:security@propdoc.example.com"
            className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            security@propdoc.example.com
          </a>
        </div>
      </main>

      <SimpleFooter />
    </div>
  );
}

function TopNav() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-semibold text-gray-900">PropDoc</span>
        </Link>
        <Link
          to="/login"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">{children}</div>
    </div>
  );
}

function SimpleFooter() {
  return (
    <footer className="border-t border-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
        <span className="text-sm text-gray-500">© {new Date().getFullYear()} PropDoc</span>
        <nav className="flex items-center gap-5 text-sm text-gray-500">
          <Link to="/security" className="hover:text-gray-900">
            Security
          </Link>
          <Link to="/privacy" className="hover:text-gray-900">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-gray-900">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
