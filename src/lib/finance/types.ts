export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'other';
export type AccountKind = 'asset' | 'liability';
export type TransactionType = 'income' | 'expense' | 'transfer';

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  kind: AccountKind;
  starting_balance: number;
  business_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  transfer_to_account_id: string | null;
  type: TransactionType;
  amount: number;
  occurred_on: string; // ISO date YYYY-MM-DD
  description: string;
  business_id: string | null;
  category_id: string | null;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  kind: TransactionType;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type AccountWithBalance = Account & {
  current_balance: number;
};

export type TransactionWithRelations = Transaction & {
  account: { id: string; name: string; kind: AccountKind } | null;
  transfer_to_account: { id: string; name: string } | null;
};
