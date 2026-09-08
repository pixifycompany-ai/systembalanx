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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cartao_fatura_pagamentos: {
        Row: {
          conta_id: string
          created_at: string
          data_pagamento: string
          despesa_id: string | null
          fatura_id: string
          id: string
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
          updated_at?: string
          user_id?: string
          valor_pago?: number
          valor_total?: number
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"] | null
          id: string
          is_padrao: boolean
          nome: string
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          id?: string
          is_padrao?: boolean
          nome: string
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"] | null
          id?: string
          is_padrao?: boolean
          nome?: string
          tipo?: Database["public"]["Enums"]["categoria_tipo"]
          user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          empresa_fonte: Database["public"]["Enums"]["empresa_fonte"]
          endereco: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["cliente_status"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["cliente_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"]
          endereco?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["cliente_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_fonte?: Database["public"]["Enums"]["empresa_fonte"]
          endereco?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["cliente_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          tipo?: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
          user_id?: string
          vencimento_anchor?: string | null
        }
        Relationships: []
      }
      contrato_aditivos: {
        Row: {
          contrato_id: string
          created_at: string | null
          data_vigencia: string
          id: string
          motivo: string | null
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
          valor: number
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: Database["public"]["Enums"]["contrato_parcela_status"] | null
          valor: number
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: Database["public"]["Enums"]["contrato_parcela_status"] | null
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
        ]
      }
      contratos: {
        Row: {
          asaas_subscription_id: string | null
          cliente_id: string
          created_at: string
          data_fim: string | null
          data_inativacao: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number | null
          id: string
          recorrencia: Database["public"]["Enums"]["contrato_recorrencia"]
          status: Database["public"]["Enums"]["contrato_status"]
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          asaas_subscription_id?: string | null
          cliente_id: string
          created_at?: string
          data_fim?: string | null
          data_inativacao?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento?: number | null
          id?: string
          recorrencia?: Database["public"]["Enums"]["contrato_recorrencia"]
          status?: Database["public"]["Enums"]["contrato_status"]
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          asaas_subscription_id?: string | null
          cliente_id?: string
          created_at?: string
          data_fim?: string | null
          data_inativacao?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number | null
          id?: string
          recorrencia?: Database["public"]["Enums"]["contrato_recorrencia"]
          status?: Database["public"]["Enums"]["contrato_status"]
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
        ]
      }
      despesas: {
        Row: {
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
          recurrence_group_id: string | null
          status: Database["public"]["Enums"]["despesa_status"]
          tipo: Database["public"]["Enums"]["despesa_tipo"]
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
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
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
          tipo?: Database["public"]["Enums"]["despesa_tipo"]
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
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
          recurrence_group_id?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
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
        ]
      }
      metas: {
        Row: {
          created_at: string
          id: string
          periodo: string
          tipo: string
          updated_at: string
          user_id: string
          valor_meta: number
        }
        Insert: {
          created_at?: string
          id?: string
          periodo: string
          tipo: string
          updated_at?: string
          user_id: string
          valor_meta?: number
        }
        Update: {
          created_at?: string
          id?: string
          periodo?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_meta?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome: string | null
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        ]
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          data_transferencia: string
          descricao: string | null
          id: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      ],
      contrato_status: ["ativo", "cancelado", "encerrado"],
      despesa_status: ["pendente", "pago", "atrasado"],
      despesa_tipo: ["fixa", "variavel"],
      empresa_fonte: ["PIXIFY", "REVVUE", "CLARIO", "TABELIO"],
      receita_status: ["pendente", "recebido", "atrasado"],
    },
  },
} as const
