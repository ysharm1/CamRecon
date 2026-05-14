import { Link } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';

export function TermsPage() {
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

        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm mt-10 max-w-none text-gray-700">
          <h2 className="mt-8 text-xl font-semibold text-gray-900">1. Agreement</h2>
          <p>
            By accessing or using PropDoc ("Service"), you agree to be bound by these
            Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">2. The Service</h2>
          <p>
            PropDoc provides software for commercial property management, including
            AI-powered lease abstraction, CAM reconciliation, document management,
            and related reporting tools. PropDoc does not provide legal, accounting,
            or tax advice; output should be reviewed by qualified professionals.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">3. Accounts</h2>
          <p>
            You are responsible for the activity of user accounts under your
            organization, for keeping credentials confidential, and for notifying us
            promptly of unauthorized use.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">4. Subscription and billing</h2>
          <p>
            Subscription fees are billed monthly or annually in advance. Fees are
            non-refundable except as required by law. You may cancel at any time;
            cancellation takes effect at the end of the current billing period.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">5. Customer data</h2>
          <p>
            You retain ownership of all data you upload to the Service. You grant
            PropDoc a limited license to process that data for the purpose of
            operating and improving the Service, subject to our Privacy Policy.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">6. Acceptable use</h2>
          <p>
            You agree not to (a) reverse engineer the Service, (b) use it to
            infringe intellectual-property rights or violate laws, (c) probe or
            test its security without written permission, or (d) upload malicious
            code.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">7. Warranty disclaimer</h2>
          <p>
            The Service is provided "as is" without warranties of any kind, express
            or implied, including merchantability, fitness for a particular
            purpose, and non-infringement.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">8. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, PropDoc's aggregate liability
            under these Terms will not exceed the fees paid to PropDoc in the 12
            months preceding the claim.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">9. Changes</h2>
          <p>
            We may update these Terms from time to time. Material changes will be
            communicated at least 30 days before they take effect. Continued use of
            the Service after that date constitutes acceptance of the updated Terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">10. Contact</h2>
          <p>
            Questions about these Terms? Reach us at{' '}
            <a
              href="mailto:legal@propdoc.example.com"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              legal@propdoc.example.com
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
