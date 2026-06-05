export interface Transaction {
  id: string;
  type: 'transfer' | 'top-up' | 'payout' | 'eload' | 'receive';
  senderId: string;
  recipientId: string;
  senderName?: string;
  recipientName?: string;
  status: 'completed' | 'pending' | 'failed' | 'rejected' | 'succeeded';
  createdAt: any;
  amount: number;
  totalAmount?: number;
  feeAmount?: number;
  paymongoLinkId?: string;
  metadata?: {
    name?: string;
    account?: string;
    phone?: string;
    network?: string;
    bank?: string;
    bic?: string;
    networkFee?: number;
    batchId?: string;
    transferId?: string;
    failureCode?: string;
    failureMessage?: string;
    amount?: number;
  };
}
