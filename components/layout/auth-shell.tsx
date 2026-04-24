export function AuthShell({
  title,
  description,
  children,
  asideTitle,
  asideDescription,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  asideTitle: string;
  asideDescription: string;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-80 w-80 rounded-full bg-primary-container/70 blur-[110px]" />
        <div className="absolute bottom-[-12%] right-[-8%] h-[28rem] w-[28rem] rounded-full bg-secondary-container/60 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-6xl">
        <div className="grid overflow-hidden rounded-[2.5rem] border-4 border-white/70 bg-white/80 shadow-[0_35px_90px_-35px_rgba(160,57,100,0.35)] backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-white px-12 py-14 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-10 inline-flex items-center gap-3 rounded-full bg-primary-container px-5 py-3 text-sm font-black text-on-primary-container">
                <span className="text-lg">Quét CV</span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  HR Suite
                </span>
              </div>
              <h1 className="max-w-lg text-5xl font-black leading-tight text-on-surface">
                {asideTitle}
              </h1>
              <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-on-surface-variant">
                {asideDescription}
              </p>
            </div>

            <div className="rounded-[2rem] bg-surface-container-low p-6">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
                Bộ công cụ tuyển dụng
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] bg-white p-5">
                  <p className="text-3xl font-black text-primary">AI</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface-variant">Scan và trích xuất CV</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-5">
                  <p className="text-3xl font-black text-secondary">12</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface-variant">Trạng thái pipeline</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-5">
                  <p className="text-3xl font-black text-tertiary">3</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface-variant">Vai trò workspace</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
            <div className="mx-auto max-w-md">
              <div className="mb-10">
                <p className="mb-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                  CV Scanner
                </p>
                <h2 className="text-4xl font-black text-on-surface">{title}</h2>
                <p className="mt-3 text-base font-medium leading-7 text-on-surface-variant">{description}</p>
              </div>
              {children}
            </div>
          </section>
        </div>

        <footer className="mt-5 text-center text-sm font-semibold text-on-surface-variant">
          Thiết kế và phát triển bởi{" "}
          <a
            href="https://www.facebook.com/tuhachiz/"
            target="_blank"
            rel="noreferrer"
            className="font-black text-primary hover:underline"
          >
            Hachi Tu
          </a>
          <span className="mx-2 text-primary" aria-hidden="true">
            ♥
          </span>
          <a
            href="https://www.facebook.com/emm.le.1"
            target="_blank"
            rel="noreferrer"
            className="font-black text-primary hover:underline"
          >
            Lệ Emm
          </a>
        </footer>
      </div>
    </main>
  );
}
