import * as React from "react";

import { cn } from "@/lib/utils";
import { paraPontoDecimal } from "@/lib/numeros";

const BASE_CLS = [
  "flex h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-foreground transition-colors duration-fast",
  "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  "placeholder:text-foreground-subtle",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-border-strong",
  "disabled:cursor-not-allowed disabled:opacity-50",
];

type InputProps = React.ComponentProps<"input">;

const comoTexto = (v: InputProps["value"]) => (v === undefined || v === null || v === "" ? "" : String(v).replace(".", ","));
const comoNumero = (t: string) => (t.trim() === "" ? NaN : Number(paraPontoDecimal(t)));

/**
 * Campo de valor com o teclado numérico com vírgula (celular). Mostra o que a
 * pessoa digitou ("12,5") e entrega ao onChange já com ponto ("12.5"), como o
 * input type="number" entregava — os formulários não precisam mudar.
 */
const DecimalInput = React.forwardRef<HTMLInputElement, InputProps>(({ value, onChange, className, min, ...props }, ref) => {
  const [texto, setTexto] = React.useState(comoTexto(value));
  React.useEffect(() => {
    const doPai = value === undefined || value === null || value === "" ? NaN : Number(value);
    const local = comoNumero(texto);
    if (!(doPai === local || (Number.isNaN(doPai) && Number.isNaN(local)))) setTexto(comoTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const aceitaNegativo = min === undefined || Number(min) < 0;
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      className={cn(BASE_CLS, className)}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^\d,.-]/g, "");
        if (!aceitaNegativo) raw = raw.replace(/-/g, "");
        setTexto(raw);
        const normal = paraPontoDecimal(raw);
        // Alvo "falso" com o valor já em ponto (o input real continua mostrando a vírgula).
        const real = e.target;
        const alvo = Object.create(real, {
          value: { value: normal, enumerable: true },
          name: { value: real.name, enumerable: true },
          id: { value: real.id, enumerable: true },
        }) as HTMLInputElement;
        onChange?.({ ...e, target: alvo, currentTarget: alvo } as React.ChangeEvent<HTMLInputElement>);
      }}
    />
  );
});
DecimalInput.displayName = "DecimalInput";

/**
 * Input padrão. Campos type="number" abrem o teclado numérico do celular:
 * com step decimal (ex.: "0.01") → teclado com vírgula; senão → só dígitos.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  if (type === "number" && !props.inputMode) {
    const step = props.step;
    const decimal = step !== undefined && step !== "any" && !Number.isInteger(Number(step));
    if (decimal) return <DecimalInput ref={ref} className={className} {...props} />;
    const { step: _s, min: _min, max: _max, onChange, ...rest } = props;
    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className={cn(BASE_CLS, className)}
        onChange={(e) => {
          const so = e.target.value.replace(/\D/g, "");
          if (so !== e.target.value) e.target.value = so;
          onChange?.(e);
        }}
      />
    );
  }
  return <input type={type} className={cn(BASE_CLS, className)} ref={ref} {...props} />;
});
Input.displayName = "Input";

export { Input };
