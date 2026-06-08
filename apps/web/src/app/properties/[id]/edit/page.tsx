import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { PropertyForm } from '@/components/properties/property-form';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';
  const { id } = await params;
  const property = await makeApi(agentId).properties.get(id);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href={`/properties/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft size={16} />
        {property.title}
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-8">Edit Property</h1>

      <PropertyForm initialData={property} propertyId={id} />
    </div>
  );
}
