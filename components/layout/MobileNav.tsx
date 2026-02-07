"use client";

interface MobileNavProps {
  onOpen: () => void;
}

export function MobileNav({ onOpen }: MobileNavProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="md:hidden fixed left-3 top-3 z-50 rounded-lg bg-slate-900 text-white px-3 py-2 min-h-[44px]"
      aria-label="Open navigation"
    >
      Menu
    </button>
  );
}
