import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PixifyLogo } from "@/components/shared/PixifyLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-[20px] border border-border bg-surface px-6 py-10 text-center md:rounded-3xl md:px-8">
        <PixifyLogo size="lg" iconOnly />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Erro 404</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">
          Página não <span className="font-serif italic font-normal tracking-normal">encontrada</span>
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
          O endereço que você abriu não existe ou foi movido.
        </p>
        <Button asChild className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
