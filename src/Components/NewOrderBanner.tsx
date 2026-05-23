interface NewOrderBannerProps {
  message: string;
  onViewOrder: () => void;
  actionLabel?: string;
  className?: string;
}

export function NewOrderBanner({
  message,
  onViewOrder,
  actionLabel = 'Ver pedido →',
  className = '',
}: NewOrderBannerProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#00ff66]" />
        <p className="text-sm font-semibold text-[#00ff66]">{message}</p>
      </div>
      <button
        type="button"
        onClick={onViewOrder}
        className="w-fit rounded-md bg-[#00ff66] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[#22ff7a]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
