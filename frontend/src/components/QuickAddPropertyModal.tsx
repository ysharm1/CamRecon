import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, ModalFooter } from './Modal';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { useCreateProperty } from '@/hooks/useProperties';

const PROPERTY_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'retail', label: 'Retail' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mixed', label: 'Mixed-use' },
];

const EMPTY = {
  name: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  totalSquareFootage: '',
  propertyType: 'commercial',
};

/**
 * Quick-create modal for a new property. Uses the import/execute endpoint
 * with a single row so we don't navigate away from the current page.
 */
export function QuickAddPropertyModal() {
  const { active, close } = useGlobalUI();
  const [values, setValues] = useState(EMPTY);
  const createMutation = useCreateProperty();

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function resetAndClose() {
    setValues(EMPTY);
    close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const sqft = Number(values.totalSquareFootage);
    if (!values.name.trim() || !values.street.trim() || !values.city.trim() || !values.state.trim() || !values.zip.trim() || !sqft) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      const property = await createMutation.mutateAsync({
        name: values.name.trim(),
        address: {
          street: values.street.trim(),
          city: values.city.trim(),
          state: values.state.trim(),
          zip: values.zip.trim(),
        },
        totalSquareFootage: sqft,
        propertyType: values.propertyType as 'commercial' | 'retail' | 'industrial' | 'mixed',
      });

      toast.success(`Property "${property.name}" created.`);
      resetAndClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create property.';
      toast.error(message);
    }
  }

  return (
    <Modal
      open={active === 'quickAddProperty'}
      onClose={resetAndClose}
      title="Add property"
      description="Create a new property in your portfolio."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Property name" required>
          <input
            type="text"
            autoFocus
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Main Street Plaza"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </FormField>

        <FormField label="Street address" required>
          <input
            type="text"
            value={values.street}
            onChange={(e) => update('street', e.target.value)}
            placeholder="123 Main St"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FormField label="City" required>
            <input
              type="text"
              value={values.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>
          <FormField label="State" required>
            <input
              type="text"
              value={values.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="CA"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>
          <FormField label="Zip" required>
            <input
              type="text"
              value={values.zip}
              onChange={(e) => update('zip', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Total area (sqft)" required>
            <input
              type="number"
              min={1}
              value={values.totalSquareFootage}
              onChange={(e) => update('totalSquareFootage', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </FormField>
          <FormField label="Property type" required>
            <select
              value={values.propertyType}
              onChange={(e) => update('propertyType', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
            {createMutation.isPending ? 'Creating...' : 'Create property'}
          </button>
        </ModalFooter>
      </form>
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
