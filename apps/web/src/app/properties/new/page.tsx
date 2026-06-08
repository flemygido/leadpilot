import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PropertyForm } from '@/components/properties/property-form';

export default function NewPropertyPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/properties"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft size={16} />
        Properties
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-8">Add New Property</h1>

      <PropertyForm />
    </div>
  );
}
