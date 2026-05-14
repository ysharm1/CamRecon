import { Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-10 w-10 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900">PropDoc</span>
          </div>
          <p className="text-sm text-gray-500">Property Document Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
