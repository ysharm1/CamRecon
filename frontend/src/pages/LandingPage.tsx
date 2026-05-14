import { Link } from 'react-router-dom';
import {
  Building2,
  Brain,
  Calculator,
  Receipt,
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <Hero />
      <FeaturesSection />
      <HowItWorks />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-semibold text-gray-900">PropDoc</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
          <a href="#features" className="hover:text-gray-900">
            Features
          </a>
          <a href="#pricing" className="hover:text-gray-900">
            Pricing
          </a>
          <Link to="/security" className="hover:text-gray-900">
            Security
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-gray-700 hover:text-gray-900 sm:inline"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-24 flex justify-center" aria-hidden="true">
        <div className="h-72 w-[40rem] rounded-full bg-gradient-to-br from-indigo-200 via-purple-200 to-transparent opacity-50 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" />
          Built for commercial property managers
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
          CAM reconciliation in minutes,{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            not days
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          AI reads your leases. The platform does the math. You ship tenant
          statements in an afternoon.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          No credit card required · Demo data included · Works with QuickBooks
        </p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: 'AI Lease Abstraction',
      body:
        'Upload a lease PDF. Our AI extracts commencement dates, base rent, CAM caps, and 8 other terms — each tagged with the source snippet it came from and a confidence score.',
    },
    {
      icon: Calculator,
      title: 'One-click Reconciliation',
      body:
        'Paste your expenses. Get per-tenant pro-rata allocations with plain-English variance explanations, ready to export as a PDF or Excel statement.',
    },
    {
      icon: Receipt,
      title: 'Works with QuickBooks',
      body:
        'We do not replace your accounting. PropDoc feeds clean reconciliation data into the systems you already use — expenses in, invoices out.',
    },
  ];

  return (
    <section id="features" className="bg-gray-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need for CAM true-ups. Nothing you don't.
          </h2>
          <p className="mt-4 text-gray-600">
            We built PropDoc around the workflow property managers actually do,
            not a kitchen sink of features you'll never touch.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Upload lease PDFs', body: 'Drag in one file or a batch. AI extracts terms in seconds.' },
    { n: '02', title: 'Run reconciliation', body: 'Pick a property and period. Paste expenses from Excel.' },
    { n: '03', title: 'Send statements', body: 'Generate per-tenant PDFs and email them in a click.' },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            From PDF to tenant statement
          </h2>
          <p className="mt-4 text-gray-600">
            A reconciliation that used to take a week now takes an afternoon.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-6">
              <p className="text-sm font-mono text-indigo-600">{s.n}</p>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: '$199',
      cadence: '/mo',
      description: 'For small portfolios that need to move off spreadsheets.',
      features: ['Up to 5 properties', 'Unlimited documents', 'AI lease abstraction', 'Email support'],
      cta: 'Start free trial',
      featured: false,
    },
    {
      name: 'Pro',
      price: '$499',
      cadence: '/mo',
      description: 'For growing firms running multiple reconciliations a year.',
      features: [
        'Up to 25 properties',
        'Unlimited reconciliations',
        'QuickBooks sync',
        'Variance + tenant statements',
        'Priority support',
      ],
      cta: 'Start free trial',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      cadence: '',
      description: 'For regional and national operators with custom needs.',
      features: [
        'Unlimited properties',
        'SSO + role-based access',
        'Custom integrations',
        'Dedicated support',
      ],
      cta: 'Contact sales',
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="bg-gray-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Simple pricing. Month-to-month.
          </h2>
          <p className="mt-4 text-gray-600">
            Start free for 14 days. No credit card required.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.featured
                  ? 'border-indigo-300 bg-white shadow-xl ring-1 ring-indigo-200'
                  : 'border-gray-200 bg-white shadow-sm'
              }`}
            >
              {plan.featured && (
                <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.cadence}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`mt-8 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold ${
                  plan.featured
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 px-8 py-16 text-center text-white shadow-xl">
        <ShieldCheck className="mx-auto h-10 w-10 opacity-90" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Stop wrestling with CAM spreadsheets.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-indigo-100">
          Try PropDoc with our sample portfolio. Finish a full reconciliation in
          under 15 minutes.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
        >
          Start free trial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <span>© {new Date().getFullYear()} PropDoc</span>
        </div>
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
          <Link to="/login" className="hover:text-gray-900">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
