interface KpiCardProps {
  label: string;
  value: string | number;
  valueClassName?: string;
}

export function KpiCard({
  label,
  value,
  valueClassName = 'text-white dark:text-white light:text-gray-900',
}: KpiCardProps) {
  return (
    <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
      <p className="text-gray-500 light:text-gray-400 text-sm">{label}</p>
      <h3 className={`text-2xl font-bold mt-1 ${valueClassName}`}>{value}</h3>
    </div>
  );
}
