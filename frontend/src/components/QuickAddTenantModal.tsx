import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, ModalFooter } from './Modal';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { useProperties } from '@/hooks/useProperties';
import { useCreateTenant } from '@/hooks/useTenants';

const EMPTY = {
  name: '',
  contactEmail: '',
  propertyId: '',
  suiteNumber: '',
  squareFootage: '',
};

/**
 * Quick-create modal for a new tenant. Prefills property via global UI context
 * when opened from a property detail page.
 */
export function QuickAddTenantModal() {
  const { active, contexts, close } = useGlobalUI();
  const [values, setValues] = useState(EMPTY);
  const { data: properties } = useProperties();
  const createMutation = useCreateTenant();

  // Prefill propertyId from context when the modal opens.
  useEffect(() => {
    if (active === 'quickAddTenant') {
      setValues({ ...EMPTY, propertyId: contexts.quickAddTenant?.propertyId ?? '' });
    }
  }, [active, contexts]);

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function resetAndClose() {
    setValues(EMPTY);
    close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const sqft = Number(values.squareFootage);
    if (!values.name.trim() || !values.contactEmail.trim() || !values.propertyId || !values.suiteNumber.trim() || !sqft) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const property = properties?.find((p) => p.id === values.propertyId);
    if (!property) {
      toast.error('Selected property could not be found.');
      return;
    }

    try {
      const tenant = await createMutation.mutateAsync({
        name: values.name.trim(),
        contactEmail: values.contactEmail.trim(),
        propertyId: values.propertyId,
        suiteNumber: values.suiteNumber.trim(),
        squareFootage: sqft,
      });

      toast.success(`Tenant "${tenant.name}" added to ${property.name}.`);
      resetAndClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create tenant.';
      toast.error(message);
    }
  }

  const hasProperties = (properties?.length ?? 0) > 0;

  return (
    <Modal
      open={active === 'quickAddTenant'}
      onClose={resetAndClose}
      title="Add tenant"
      description="Add a tenant to an existing property."
    >
      {!hasProperties ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You need to create a property first.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Tenant name" required>
            <input
              type="text"
              autoFocus
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Acme Retail Inc."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>

          <FormField label="Contact email" required>
            <input
              type="email"
              value={values.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)}
              placeholder="billing@tenant.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>

          <FormField label="Property" required>
            <select
              value={values.propertyId}
              onChange={(e) => update('propertyId', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a property...</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Suite" required>
              <input
                type="text"
                value={values.suiteNumber}
                onChange={(e) => update('suiteNumber', e.target.value)}
                placeholder="101"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </FormField>
            <FormField label="Area (sqft)" required>
              <input
                type="number"
                min={1}
                value={values.squareFootage}
                onChange={(e) => update('squareFootage', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </FormField>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add tenant'}
            </button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
