import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { numberToWords } from '@/utils/numberToWords';
import { formatCurrency, formatDate, formatCPFCNPJ } from '@/utils/formatters';

const EMPRESA = {
  nome: 'PIXIFY COMPANY',
  cnpj: '46.669.221/0001-58',
};

const DADOS_PIX = {
  chave: '46.669.221/0001-58',
  banco: 'XP SA',
  agencia: '0001',
  cc: '18208395',
};

export interface ReceiptData {
  id: string;
  descricao: string;
  valor: number;
  clienteNome: string;
  clienteCnpj?: string;
  formaPagamento?: string;
  dataVencimento?: string;
  dataRecebimento?: string;
  dataPagamento?: string;
  tipo: 'receita' | 'despesa';
}

interface ReceiptGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

export function ReceiptGenerator({ open, onOpenChange, data }: ReceiptGeneratorProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const receiptNumber = `REC-${data.id.slice(-6).toUpperCase()}`;
  const valorExtenso = numberToWords(data.valor);
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const isReceita = data.tipo === 'receita';
  const isPix = data.formaPagamento?.toLowerCase().includes('pix');

  // For receitas: empresa é o recebedor, cliente é o pagador
  // For despesas: empresa é o pagador, cliente/fornecedor é o recebedor
  const emitenteLabel = isReceita ? 'Recebedor' : 'Pagador';
  const destinatarioLabel = isReceita ? 'Pagador' : 'Recebedor / Fornecedor';

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo ${receiptNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1a1a1a; }
          .receipt { max-width: 700px; margin: 0 auto; border: 2px solid #333; padding: 40px; }
          .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
          .header .number { font-size: 14px; color: #666; }
          .header .date { font-size: 13px; color: #666; margin-top: 4px; }
          .section { margin-bottom: 20px; }
          .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
          .section-value { font-size: 15px; }
          .section-sub { font-size: 13px; color: #555; margin-top: 2px; }
          .valor-box { background: #f5f5f5; padding: 16px; border-radius: 4px; margin: 24px 0; text-align: center; }
          .valor-box .amount { font-size: 28px; font-weight: 700; }
          .valor-box .extenso { font-size: 13px; color: #555; margin-top: 4px; font-style: italic; }
          .pix-box { background: #eef7ee; border: 1px solid #b5d8b5; padding: 16px; border-radius: 4px; margin: 20px 0; }
          .pix-box .pix-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; color: #2a6e2a; }
          .pix-box .pix-row { font-size: 13px; margin-bottom: 4px; }
          .pix-box .pix-label { color: #555; }
          .pix-box .pix-value { font-weight: 600; }
          .signature { margin-top: 60px; text-align: center; }
          .signature .line { border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 8px; }
          .signature .label { font-size: 12px; color: #666; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
          @media print { body { padding: 20px; } .receipt { border: 1px solid #ccc; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Recibo de {isReceita ? 'Recebimento' : 'Pagamento'}</span>
            <Button onClick={handlePrint} size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef}>
          <div className="receipt">
            <div className="header">
              <h1>RECIBO DE {isReceita ? 'RECEBIMENTO' : 'PAGAMENTO'}</h1>
              <div className="number">Nº {receiptNumber}</div>
              <div className="date">Data de emissão: {dataEmissao}</div>
            </div>

            <div className="parties">
              <div className="section">
                <div className="section-label">{emitenteLabel}</div>
                <div className="section-value">{EMPRESA.nome}</div>
                <div className="section-sub">CNPJ: {EMPRESA.cnpj}</div>
              </div>
              <div className="section">
                <div className="section-label">{destinatarioLabel}</div>
                <div className="section-value">{data.clienteNome}</div>
                {data.clienteCnpj && (
                  <div className="section-sub">CPF/CNPJ: {formatCPFCNPJ(data.clienteCnpj)}</div>
                )}
              </div>
            </div>

            <div className="section">
              <div className="section-label">Descrição</div>
              <div className="section-value">{data.descricao}</div>
            </div>

            <div className="valor-box">
              <div className="amount">{formatCurrency(data.valor)}</div>
              <div className="extenso">({valorExtenso})</div>
            </div>

            <div className="grid">
              {data.formaPagamento && (
                <div className="section">
                  <div className="section-label">Forma de Pagamento</div>
                  <div className="section-value">{data.formaPagamento}</div>
                </div>
              )}
              {data.dataVencimento && (
                <div className="section">
                  <div className="section-label">Data de Vencimento</div>
                  <div className="section-value">{formatDate(data.dataVencimento)}</div>
                </div>
              )}
              {(data.dataRecebimento || data.dataPagamento) && (
                <div className="section">
                  <div className="section-label">Data de {isReceita ? 'Recebimento' : 'Pagamento'}</div>
                  <div className="section-value">{formatDate((data.dataRecebimento || data.dataPagamento)!)}</div>
                </div>
              )}
            </div>

            {isPix && (
              <div className="pix-box">
                <div className="pix-title">Dados Bancários — PIX</div>
                <div className="pix-row"><span className="pix-label">Chave PIX: </span><span className="pix-value">{DADOS_PIX.chave}</span></div>
                <div className="pix-row"><span className="pix-label">Banco: </span><span className="pix-value">{DADOS_PIX.banco}</span></div>
                <div className="pix-row"><span className="pix-label">Agência: </span><span className="pix-value">{DADOS_PIX.agencia}</span></div>
                <div className="pix-row"><span className="pix-label">Conta Corrente: </span><span className="pix-value">{DADOS_PIX.cc}</span></div>
              </div>
            )}

            <div className="signature">
              <div className="line">Assinatura</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
