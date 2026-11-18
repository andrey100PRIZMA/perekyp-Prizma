export type Tab =
  | 'home'
  | 'market'
  | 'zono'
  | 'official'
  | 'repair'
  | 'pc'
  | 'os'
  | 'ship'
  | 'bank'
  | 'biz'
  | 'black'
  | 'quests'
  | 'profile'
  | 'settings';

export type Source = 'market' | 'zono' | 'official' | 'black';
export type Theme = 'auto' | 'light' | 'dark';
export type Condition = 'new' | 'used';

export type Item = {
  id: number;
  name: string;
  category: string;
  base: number;
  condition: Condition;
  defect?: boolean;
  listPrice?: number;
  purchasePrice?: number;
  listedOn?: Source;
  pcPart?: string;
  brand?: string;
  speed?: number;
  reliability?: number;
  warrantyDays?: number;
  warrantyUntil?: number;
  broken?: boolean;
  /** Фото товара в виде data-URL (сжимается до 512px в images.ts). */
  photo?: string;
  note?: string;
  boughtDay?: number;
  soldPrice?: number;
  soldDay?: number;
};

export type Review = {
  id: number;
  platform: 'market' | 'zono';
  stars: number;
  text: string;
  author: string;
  kind: 'bot' | 'player';
  day: number;
};

export type Offer = {
  id: number;
  itemId: number;
  buyer: string;
  price: number;
  platform: 'market' | 'zono';
  expires: number;
};

export type Shipment = {
  id: number;
  item: string;
  status: 'В пути' | 'Доставлено';
  days: number;
};

export type OsProject = {
  name: string;
  version: string;
  kernel: string;
  features: string[];
  createdDay: number;
  users: number;
};

export type QuestKind =
  | 'buy'
  | 'sell'
  | 'profit'
  | 'repair'
  | 'review'
  | 'black'
  | 'pc'
  | 'os'
  | 'ship'
  | 'deposit';

export type Quest = {
  id: string;
  kind: QuestKind;
  title: string;
  desc: string;
  target: number;
  progress: number;
  reward: number;
  xp: number;
  day: number;
  claimed: boolean;
};

export type LogKind = 'info' | 'good' | 'bad' | 'money';

export type LogEntry = {
  id: number;
  day: number;
  hour: number;
  text: string;
  kind: LogKind;
};

export type HistoryPoint = { day: number; cash: number; profit: number };

export type Stats = {
  bought: number;
  sold: number;
  repaired: number;
  blackDeals: number;
  pcBuilt: number;
  osCreated: number;
  shipped: number;
  bestSale: number;
  promoUsed: number;
};

export type Profile = { nick: string; avatar?: string; bio: string };

export type Settings = {
  autosave: boolean;
  theme: Theme;
  reduceMotion: boolean;
  compact: boolean;
};

export type Save = {
  cash: number;
  day: number;
  hour: number;
  goal: number;
  mode: '30d' | '360d' | 'free';
  inventory: Item[];
  reviews: Review[];
  offers: Offer[];
  shipments: Shipment[];
  pcParts: Record<string, Item>;
  wanted: number;
  promoUsed: string[];
  reputation: number;
  dailyProfit: number;
  bizIncome: number;
  deposit: number;
  loan: number;
  returns: number;
  osProjects: OsProject[];
  settings: Settings;
  xp: number;
  achievements: string[];
  quests: Quest[];
  log: LogEntry[];
  history: HistoryPoint[];
  stats: Stats;
  profile: Profile;
};
