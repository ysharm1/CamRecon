import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Property {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  totalSquareFootage: number;
  propertyType: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tenantCount?: number;
  occupancyRate?: number;
}

export interface PropertyDetail extends Property {
  tenants: PropertyTenant[];
  documents: PropertyDocument[];
}

export interface PropertyTenant {
  id: string;
  name: string;
  contactEmail: string;
  suiteNumber: string;
  squareFootage: number;
  status: string;
}

export interface PropertyDocument {
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  user_id: string | null;
  organization_id: string;
  property_id: string | null;
  tenant_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useProperties() {
  return useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await api.get<{ data: Property[] }>('/api/properties');
      return response.data;
    },
  });
}

export function useProperty(propertyId: string) {
  return useQuery<PropertyDetail>({
    queryKey: ['properties', propertyId],
    queryFn: async () => {
      const response = await api.get<{ data: PropertyDetail }>(`/api/properties/${propertyId}`);
      return response.data;
    },
    enabled: !!propertyId,
  });
}

export function usePropertyActivity(propertyId: string) {
  return useQuery<ActivityEntry[]>({
    queryKey: ['activity', 'property', propertyId],
    queryFn: async () => {
      const response = await api.get<{ data: ActivityEntry[] }>(`/api/activity/property/${propertyId}`);
      return response.data;
    },
    enabled: !!propertyId,
  });
}

export interface CreatePropertyInput {
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  totalSquareFootage: number;
  propertyType: 'commercial' | 'retail' | 'industrial' | 'mixed';
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePropertyInput) => {
      const response = await api.post<{ data: Property }>('/api/properties', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
