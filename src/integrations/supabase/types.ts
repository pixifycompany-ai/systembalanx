export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      anexos_lixeira: {
        Row: {
          created_at: string
          id: string
          path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_lixeira_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json | null
          result: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          result?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          result?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      cartao_fatura_pagamentos: {
        Row: {
          conta_id: string
          created_at: string
          data_pagamento: string
          despesa_id: string | null
          fatura_id: string
          id: string
          tenant_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string
          data_pagamento: string
          despesa_id?: string | null
          fatura_id: string
          id?: string
          tenant_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string
          data_pagamento?: string
          despesa_id?: string | null
          fatura_id?: string
          id?: string
          tenant_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartao_fatura_pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "cartao_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartao_fatura_pagamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cartao_faturas: {
        Row: {
          cartao_id: string
          competencia: string
          created_at: string
          data_fechamento: string
          data_vencimento: string
          despesa_id: string | null
          id: string
          status: Database["public"]["Enums"]["cartao_fatura_status"]
          tenant_id: string | null
          updated_at: string
          user_id: string
          valor_pago: number
          valor_total: number
        }
        Insert: {
          cartao_id: string
          competencia: string
          created_at?: string
          data_fechamento: string
          data_vencimento: string
          despesa_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cartao_fatura_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          cartao_id?: string
          competencia?: string
          created_at?: string
          data_fechamento?: string
          data_vencimento?: string
          despesa_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cartao_fatura_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartao_faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"] | null
          grupo_dre: string | null
          id: string
          is_padrao: boolean
          nome: string
          tenant_id: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          grupo_dre?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          tenant_id?: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          grupo_dre?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["categoria_tipo"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          asaas_customer_id: string | null
          canal_cobranca: string
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"]
          endereco: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["cliente_status"]
          telefone: string | null
          tenant_id: string | null
          tipo: Database["public"]["Enums"]["cliente_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          canal_cobranca?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"]
          endereco?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["cliente_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          canal_cobranca?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"]
          endereco?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["cliente_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_config: {
        Row: {
          asaas_account_name: string | null
          asaas_api_key: string | null
          asaas_env: string
          auto_envio_fim_semana: boolean
          auto_wpp_antes_dias: number
          auto_wpp_atraso_diario: boolean
          auto_wpp_atraso_max_dias: number
          auto_wpp_enabled: boolean
          auto_wpp_no_dia: boolean
          email_assunto: string | null
          email_corpo: string | null
          pix_chave: string | null
          pix_titular: string | null
          updated_at: string
          user_id: string
          webhook_token: string | null
          whatsapp_template: string | null
          whatsapp_template_pix: string | null
        }
        Insert: {
          asaas_account_name?: string | null
          asaas_api_key?: string | null
          asaas_env?: string
          auto_envio_fim_semana?: boolean
          auto_wpp_antes_dias?: number
          auto_wpp_atraso_diario?: boolean
          auto_wpp_atraso_max_dias?: number
          auto_wpp_enabled?: boolean
          auto_wpp_no_dia?: boolean
          email_assunto?: string | null
          email_corpo?: string | null
          pix_chave?: string | null
          pix_titular?: string | null
          updated_at?: string
          user_id: string
          webhook_token?: string | null
          whatsapp_template?: string | null
          whatsapp_template_pix?: string | null
        }
        Update: {
          asaas_account_name?: string | null
          asaas_api_key?: string | null
          asaas_env?: string
          auto_envio_fim_semana?: boolean
          auto_wpp_antes_dias?: number
          auto_wpp_atraso_diario?: boolean
          auto_wpp_atraso_max_dias?: number
          auto_wpp_enabled?: boolean
          auto_wpp_no_dia?: boolean
          email_assunto?: string | null
          email_corpo?: string | null
          pix_chave?: string | null
          pix_titular?: string | null
          updated_at?: string
          user_id?: string
          webhook_token?: string | null
          whatsapp_template?: string | null
          whatsapp_template_pix?: string | null
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          asaas_customer_id: string | null
          asaas_customer_nome: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          auto_email_ultimo_dia: string | null
          auto_wpp_ultimo_dia: string | null
          cliente_id: string | null
          conta_id: string | null
          contrato_id: string | null
          created_at: string
          data_pagamento: string | null
          descricao: string | null
          enviar_fim_semana: boolean | null
          envio_pix: boolean
          exigir_nf: boolean
          forma_pagamento: string
          id: string
          invoice_url: string | null
          nota_fiscal_enviada: boolean
          nota_fiscal_nome: string | null
          nota_fiscal_path: string | null
          notas_fiscais: Json
          receita_id: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_customer_nome?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          auto_email_ultimo_dia?: string | null
          auto_wpp_ultimo_dia?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao?: string | null
          enviar_fim_semana?: boolean | null
          envio_pix?: boolean
          exigir_nf?: boolean
          forma_pagamento?: string
          id?: string
          invoice_url?: string | null
          nota_fiscal_enviada?: boolean
          nota_fiscal_nome?: string | null
          nota_fiscal_path?: string | null
          notas_fiscais?: Json
          receita_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor: number
          vencimento: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_customer_nome?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          auto_email_ultimo_dia?: string | null
          auto_wpp_ultimo_dia?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao?: string | null
          enviar_fim_semana?: boolean | null
          envio_pix?: boolean
          exigir_nf?: boolean
          forma_pagamento?: string
          id?: string
          invoice_url?: string | null
          nota_fiscal_enviada?: boolean
          nota_fiscal_nome?: string | null
          nota_fiscal_path?: string | null
          notas_fiscais?: Json
          receita_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          ativa: boolean
          banco: string | null
          bandeira: string | null
          conta_pagamento_padrao_id: string | null
          cor: string
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          limite: number | null
          nome: string
          saldo_inicial: number
          tenant_id: string | null
          tipo: Database["public"]["Enums"]["conta_tipo"]
          updated_at: string
          user_id: string
          vencimento_anchor: string | null
        }
        Insert: {
          ativa?: boolean
          banco?: string | null
          bandeira?: string | null
          conta_pagamento_padrao_id?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome: string
          saldo_inicial?: number
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
          user_id: string
          vencimento_anchor?: string | null
        }
        Update: {
          ativa?: boolean
          banco?: string | null
          bandeira?: string | null
          conta_pagamento_padrao_id?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome?: string
          saldo_inicial?: number
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
          user_id?: string
          vencimento_anchor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_aditivos: {
        Row: {
          contrato_id: string
          created_at: string | null
          data_vigencia: string
          id: string
          motivo: string | null
          tenant_id: string | null
          user_id: string
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          data_vigencia: string
          id?: string
          motivo?: string | null
          tenant_id?: string | null
          user_id: string
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          data_vigencia?: string
          id?: string
          motivo?: string | null
          tenant_id?: string | null
          user_id?: string
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_aditivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_parcelas: {
        Row: {
          contrato_id: string
          created_at: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          status: Database["public"]["Enums"]["contrato_parcela_status"] | null
          tenant_id: string | null
          valor: number
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: Database["public"]["Enums"]["contrato_parcela_status"] | null
          tenant_id?: string | null
          valor: number
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: Database["public"]["Enums"]["contrato_parcela_status"] | null
          tenant_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_parcelas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_parcelas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          asaas_subscription_id: string | null
          cliente_id: string
          cobranca_auto_antes_dias: number | null
          cobranca_auto_atraso_diario: boolean | null
          cobranca_auto_modo: string
          cobranca_auto_no_dia: boolean | null
          created_at: string
          data_fim: string | null
          data_inativacao: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number | null
          envio_pix: boolean
          exigir_nf: boolean
          gerar_receitas: boolean
          id: string
          recorrencia: Database["public"]["Enums"]["contrato_recorrencia"]
          status: Database["public"]["Enums"]["contrato_status"]
          tenant_id: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          asaas_subscription_id?: string | null
          cliente_id: string
          cobranca_auto_antes_dias?: number | null
          cobranca_auto_atraso_diario?: boolean | null
          cobranca_auto_modo?: string
          cobranca_auto_no_dia?: boolean | null
          created_at?: string
          data_fim?: string | null
          data_inativacao?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento?: number | null
          envio_pix?: boolean
          exigir_nf?: boolean
          gerar_receitas?: boolean
          id?: string
          recorrencia?: Database["public"]["Enums"]["contrato_recorrencia"]
          status?: Database["public"]["Enums"]["contrato_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          asaas_subscription_id?: string | null
          cliente_id?: string
          cobranca_auto_antes_dias?: number | null
          cobranca_auto_atraso_diario?: boolean | null
          cobranca_auto_modo?: string
          cobranca_auto_no_dia?: boolean | null
          created_at?: string
          data_fim?: string | null
          data_inativacao?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number | null
          envio_pix?: boolean
          exigir_nf?: boolean
          gerar_receitas?: boolean
          id?: string
          recorrencia?: Database["public"]["Enums"]["contrato_recorrencia"]
          status?: Database["public"]["Enums"]["contrato_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          anexos: Json
          categoria_id: string | null
          cliente_id: string | null
          conta_id: string | null
          conta_pagamento: string | null
          created_at: string
          data_competencia: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"] | null
          fatura_id: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          origem_despesa_id: string | null
          origem_receita_id: string | null
          parcela_grupo_id: string | null
          parcela_num: number | null
          parcela_total: number | null
          recurrence_group_id: string | null
          status: Database["public"]["Enums"]["despesa_status"]
          tenant_id: string | null
          tipo: Database["public"]["Enums"]["despesa_tipo"]
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          anexos?: Json
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          conta_pagamento?: string | null
          created_at?: string
          data_competencia: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          fatura_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          origem_despesa_id?: string | null
          origem_receita_id?: string | null
          parcela_grupo_id?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["despesa_tipo"]
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          anexos?: Json
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          conta_pagamento?: string | null
          created_at?: string
          data_competencia?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          fatura_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          origem_despesa_id?: string | null
          origem_receita_id?: string | null
          parcela_grupo_id?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
          tenant_id?: string | null
          tipo?: Database["public"]["Enums"]["despesa_tipo"]
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_origem_despesa_id_fkey"
            columns: ["origem_despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_origem_receita_id_fkey"
            columns: ["origem_receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_envios: {
        Row: {
          assunto: string | null
          cobranca_id: string | null
          created_at: string
          erro: string | null
          id: string
          origem: string
          para: string
          resend_id: string | null
          status: string
          updated_at: string
          user_id: string
          visto: boolean
        }
        Insert: {
          assunto?: string | null
          cobranca_id?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          origem?: string
          para: string
          resend_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          visto?: boolean
        }
        Update: {
          assunto?: string | null
          cobranca_id?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          origem?: string
          para?: string
          resend_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          visto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_envios_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      iara_uso_diario: {
        Row: {
          dia: string
          qtd: number
          user_id: string
        }
        Insert: {
          dia?: string
          qtd?: number
          user_id: string
        }
        Update: {
          dia?: string
          qtd?: number
          user_id?: string
        }
        Relationships: []
      }
      lp_chat_uso: {
        Row: {
          dia: string
          ip: string
          qtd: number
        }
        Insert: {
          dia?: string
          ip: string
          qtd?: number
        }
        Update: {
          dia?: string
          ip?: string
          qtd?: number
        }
        Relationships: []
      }
      metas: {
        Row: {
          created_at: string
          id: string
          periodo: string
          tenant_id: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor_meta: number
        }
        Insert: {
          created_at?: string
          id?: string
          periodo: string
          tenant_id?: string | null
          tipo: string
          updated_at?: string
          user_id: string
          valor_meta?: number
        }
        Update: {
          created_at?: string
          id?: string
          periodo?: string
          tenant_id?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_meta?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias_ignoradas: {
        Row: {
          chave: string
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          chave: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          chave?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_ignoradas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plataforma_config: {
        Row: {
          id: boolean
          preco_anual_parcela: number
          preco_mensal: number
          require_mfa_admins: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          preco_anual_parcela?: number
          preco_mensal?: number
          require_mfa_admins?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          preco_anual_parcela?: number
          preco_mensal?: number
          require_mfa_admins?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_tenant_id: string | null
          id: string
          nome: string | null
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          id?: string
          nome?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          id?: string
          nome?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_tenant_id_fkey"
            columns: ["current_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          platform: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          platform?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          categoria_id: string | null
          cliente_id: string | null
          conta_id: string | null
          conta_pagamento: string | null
          contrato_id: string | null
          created_at: string
          data_competencia: string
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"] | null
          forma_pagamento: string | null
          id: string
          origem_despesa_id: string | null
          origem_receita_id: string | null
          recurrence_group_id: string | null
          status: Database["public"]["Enums"]["receita_status"]
          tenant_id: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          conta_pagamento?: string | null
          contrato_id?: string | null
          created_at?: string
          data_competencia: string
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          forma_pagamento?: string | null
          id?: string
          origem_despesa_id?: string | null
          origem_receita_id?: string | null
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          conta_pagamento?: string | null
          contrato_id?: string | null
          created_at?: string
          data_competencia?: string
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          forma_pagamento?: string | null
          id?: string
          origem_despesa_id?: string | null
          origem_receita_id?: string | null
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["receita_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_origem_despesa_id_fkey"
            columns: ["origem_despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_origem_receita_id_fkey"
            columns: ["origem_receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          papel: string
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          papel?: string
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          papel?: string
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          papel: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          acesso_liberado_ate: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          ciclo: string | null
          cortesia: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
          plano: string
          status_assinatura: string
          tipo: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          acesso_liberado_ate?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          ciclo?: string | null
          cortesia?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          plano?: string
          status_assinatura?: string
          tipo?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          acesso_liberado_ate?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          ciclo?: string | null
          cortesia?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          plano?: string
          status_assinatura?: string
          tipo?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          data_transferencia: string
          descricao: string | null
          id: string
          tenant_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          data_transferencia: string
          descricao?: string | null
          id?: string
          tenant_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          data_transferencia?: string
          descricao?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_tenant_with_owner: {
        Args: { p_nome: string; p_tipo?: string }
        Returns: string
      }
      gerar_receitas_contratos: {
        Args: { p_contrato?: string; p_simular?: boolean }
        Returns: {
          cliente: string
          contrato: string
          descricao: string
          valor: number
          vencimento: string
        }[]
      }
      iara_registrar_uso: { Args: { p_limite?: number }; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { tid: string }; Returns: boolean }
      tenant_role: { Args: { tid: string }; Returns: string }
      user_tem_acesso: { Args: { uid: string }; Returns: boolean }
      user_tenant_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      cartao_fatura_status: "aberta" | "fechada" | "paga" | "parcialmente_paga"
      categoria_tipo: "receita" | "despesa"
      cliente_status: "ativo" | "inativo"
      cliente_tipo: "PF" | "PJ"
      conta_tipo:
        | "corrente"
        | "poupanca"
        | "investimento"
        | "cartao_credito"
        | "cartao_debito"
      contrato_parcela_status: "pendente" | "recebido" | "atrasado"
      contrato_recorrencia:
        | "mensal"
        | "trimestral"
        | "semestral"
        | "anual"
        | "unico"
        | "semanal"
        | "quinzenal"
      contrato_status: "ativo" | "cancelado" | "encerrado"
      despesa_status: "pendente" | "pago" | "atrasado"
      despesa_tipo: "fixa" | "variavel"
      empresa_fonte: "PIXIFY" | "REVVUE" | "CLARIO" | "TABELIO"
      receita_status: "pendente" | "recebido" | "atrasado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cartao_fatura_status: ["aberta", "fechada", "paga", "parcialmente_paga"],
      categoria_tipo: ["receita", "despesa"],
      cliente_status: ["ativo", "inativo"],
      cliente_tipo: ["PF", "PJ"],
      conta_tipo: [
        "corrente",
        "poupanca",
        "investimento",
        "cartao_credito",
        "cartao_debito",
      ],
      contrato_parcela_status: ["pendente", "recebido", "atrasado"],
      contrato_recorrencia: [
        "mensal",
        "trimestral",
        "semestral",
        "anual",
        "unico",
        "semanal",
        "quinzenal",
      ],
      contrato_status: ["ativo", "cancelado", "encerrado"],
      despesa_status: ["pendente", "pago", "atrasado"],
      despesa_tipo: ["fixa", "variavel"],
      empresa_fonte: ["PIXIFY", "REVVUE", "CLARIO", "TABELIO"],
      receita_status: ["pendente", "recebido", "atrasado"],
    },
  },
} as const
