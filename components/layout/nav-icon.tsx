import { cn } from "@/lib/utils";

export function NavIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[1rem] bg-[linear-gradient(145deg,#ffd9e3,#aaedff)] shadow-[0_12px_28px_rgba(160,57,100,0.18)] ring-2 ring-white/80",
        className,
      )}
      aria-hidden="true"
    >
      <svg className="size-7" viewBox="0 0 32 32" fill="none" role="img">
        <path
          d="M8.5 7.5C8.5 5.843 9.843 4.5 11.5 4.5H19.8L24.5 9.2V24.5C24.5 26.157 23.157 27.5 21.5 27.5H11.5C9.843 27.5 8.5 26.157 8.5 24.5V7.5Z"
          fill="white"
        />
        <path
          d="M19.5 5V9.3C19.5 9.962 20.038 10.5 20.7 10.5H24"
          stroke="#A03964"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16.1 22.4C15.3 21.7 11.8 18.6 11.8 16.25C11.8 14.9 12.83 13.85 14.12 13.85C14.9 13.85 15.62 14.25 16.05 14.88C16.48 14.25 17.2 13.85 17.98 13.85C19.27 13.85 20.3 14.9 20.3 16.25C20.3 18.6 16.8 21.7 16.1 22.4Z"
          fill="#D6628D"
        />
        <path d="M12.7 9.5H15.8" stroke="#006879" strokeWidth="2" strokeLinecap="round" />
        <path d="M12.7 12.4H17.1" stroke="#206963" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24.6" cy="6.4" r="2.2" fill="#ABEFE7" />
        <circle cx="8.2" cy="24.2" r="1.8" fill="#FFB0CA" />
      </svg>
    </span>
  );
}
