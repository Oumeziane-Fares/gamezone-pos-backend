export type ConsoleType = 'PS4' | 'PS5';

export type ConsoleStatus = 'available' | 'in-use' | 'maintenance' | 'reserved';

export type SessionStatus = 'active' | 'paused' | 'ended';

export type GamingMode = '1v1' | '2v2';

export interface Console {
  id: string;
  name: string;
  type: ConsoleType;
  status: ConsoleStatus;
  hourlyRate: number;         // Base hourly rate (1v1 rate)
  hourlyRate2v2: number;      // 2v2 hourly rate
  hourly_rate: number;        // Database format (required) - 1v1 rate
  hourly_rate_2v2: number;    // Database format (required) - 2v2 rate
  createdAt?: string;         // Frontend format
  updatedAt?: string;         // Frontend format
  created_at?: string;        // Database format
  updated_at?: string;        // Database format
}

export interface Session {
  id: string;
  consoleId: string;
  consoleName: string;
  consoleType: ConsoleType;
  status: SessionStatus;
  gamingMode: GamingMode;     // NEW: Gaming mode for the session
  startTime: Date;
  endTime?: Date;
  pausedAt?: Date;
  totalPausedDuration: number;
  hourlyRate: number;         // The actual rate being used (based on gaming mode)
  baseHourlyRate: number;     // Console's base 1v1 rate
  hourlyRate2v2: number;      // Console's 2v2 rate
  finalCost: number;
  games: GameActivity[];
  inventoryItems: InventoryItem[];
}

export interface GameActivity {
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  barcode?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Receipt {
  id: string;
  sessionId?: string;
  consoleUsage?: {
    consoleName: string;
    consoleType: string;
    gamingMode: GamingMode; // NEW: Gaming mode used
    duration: number;
    rate: number;           // The actual hourly rate used
    baseRate: number;       // Console's base 1v1 rate
    rate2v2: number;        // Console's 2v2 rate
    calculatedCost: number; // Original calculated cost
    finalCost: number;      // Manual override amount
    subtotal: number;       // What we actually charge (finalCost)
  };
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  timestamp: Date;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export type NewUser = Pick<User, 'username'> & { password: string };

// NEW: Interface for gaming mode selection
export interface GamingModeOption {
  mode: GamingMode;
  label: string;
  description: string;
  icon: string; // For UI icons
}

// NEW: Gaming mode options constant
export const GAMING_MODE_OPTIONS: GamingModeOption[] = [
  {
    mode: '1v1',
    label: '1v1',
    description: 'Single player or 1 vs 1',
    icon: 'user'
  },
  {
    mode: '2v2',
    label: '2v2', 
    description: '2 vs 2 or up to 4 players',
    icon: 'users'
  }
];