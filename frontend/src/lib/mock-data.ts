// Centralized mock data for the fraud detection app
export const KPI = {
  totalTx: 184_392,
  fraudDetected: 1_247,
  safeTx: 183_145,
  riskScore: 23,
  accuracy: 99.41,
  activeUsers: 8_421,
  alertsToday: 38,
  systemHealth: 98,
};

export const fraudTrend = Array.from({ length: 14 }).map((_, i) => ({
  day: `D${i + 1}`,
  fraud: Math.round(20 + Math.sin(i / 2) * 18 + Math.random() * 12),
  safe: Math.round(800 + Math.cos(i / 3) * 120 + Math.random() * 80),
}));

export const volumeData = Array.from({ length: 12 }).map((_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  volume: Math.round(40000 + Math.random() * 30000),
  fraud: Math.round(200 + Math.random() * 300),
}));

export const riskDistribution = [
  { name: "Low", value: 72, color: "oklch(0.72 0.18 155)" },
  { name: "Medium", value: 19, color: "oklch(0.8 0.17 75)" },
  { name: "High", value: 6, color: "oklch(0.7 0.2 30)" },
  { name: "Critical", value: 3, color: "oklch(0.66 0.24 25)" },
];

export const hourlyActivity = Array.from({ length: 24 }).map((_, h) => ({
  hour: `${h}:00`,
  value: Math.round(50 + Math.sin((h - 6) / 3) * 80 + Math.random() * 30),
}));

export const models = [
  { name: "Neural Network", acc: 99.41, prec: 98.7, rec: 97.9, f1: 98.3, time: "8m 22s", speed: "12ms", best: true },
  { name: "Random Forest", acc: 98.92, prec: 97.8, rec: 96.5, f1: 97.1, time: "3m 14s", speed: "6ms" },
  { name: "SVM", acc: 97.65, prec: 96.1, rec: 94.8, f1: 95.4, time: "12m 40s", speed: "21ms" },
  { name: "Logistic Regression", acc: 95.21, prec: 93.4, rec: 91.2, f1: 92.3, time: "0m 38s", speed: "2ms" },
  { name: "Decision Tree", acc: 94.78, prec: 92.6, rec: 90.4, f1: 91.5, time: "0m 51s", speed: "3ms" },
  { name: "KNN", acc: 93.12, prec: 91.0, rec: 88.7, f1: 89.8, time: "1m 12s", speed: "18ms" },
];

export const rocData = Array.from({ length: 21 }).map((_, i) => {
  const fpr = i / 20;
  return {
    fpr,
    nn: Math.min(1, Math.pow(fpr, 0.15)),
    rf: Math.min(1, Math.pow(fpr, 0.22)),
    svm: Math.min(1, Math.pow(fpr, 0.3)),
    lr: Math.min(1, Math.pow(fpr, 0.45)),
  };
});

const merchants = ["Amazon", "Uber", "Starbucks", "Apple", "Netflix", "Walmart", "Steam", "Booking", "Shell", "IKEA", "Spotify", "Zara"];
const countries = ["US", "UK", "DE", "FR", "JP", "BR", "IN", "CA", "AU", "MA", "NL", "SG"];
const categories = ["Retail", "Food", "Travel", "Entertainment", "Fuel", "Services", "Tech", "Fashion"];

export function makeTx(i: number) {
  const fraud = Math.random() < 0.12;
  const amount = +(Math.random() * (fraud ? 4200 : 350) + 12).toFixed(2);
  return {
    id: `TX-${(100000 + i).toString(36).toUpperCase()}`,
    user: `user_${(i % 240) + 1}`,
    merchant: merchants[i % merchants.length],
    category: categories[i % categories.length],
    country: countries[i % countries.length],
    amount,
    currency: "USD",
    time: new Date(Date.now() - i * 1000 * 60 * (Math.random() * 30 + 5)).toISOString(),
    risk: fraud ? Math.round(70 + Math.random() * 30) : Math.round(Math.random() * 60),
    status: fraud ? "fraud" : Math.random() < 0.08 ? "review" : "safe",
  };
}

export const transactions = Array.from({ length: 60 }).map((_, i) => makeTx(i));

export const alerts = Array.from({ length: 14 }).map((_, i) => ({
  id: `ALT-${1000 + i}`,
  severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  title: [
    "Unusual cross-border transaction",
    "Card-present anomaly detected",
    "Velocity threshold breached",
    "Suspicious merchant category",
    "Device fingerprint mismatch",
    "Geographic impossibility",
  ][i % 6],
  user: `user_${(i % 90) + 1}`,
  amount: +(Math.random() * 4500 + 80).toFixed(2),
  time: new Date(Date.now() - i * 1000 * 60 * 18).toISOString(),
  status: (["open", "investigating", "resolved"] as const)[i % 3],
}));

export const usersList = Array.from({ length: 24 }).map((_, i) => ({
  id: `usr_${1000 + i}`,
  name: ["Aisha Khan","Lucas Martin","Sofia Rossi","Yuki Tanaka","Omar Said","Emma Wilson","Noah Brown","Mei Chen","Liam Walker","Zara Ali","Diego Costa","Hana Park"][i % 12] + (i > 11 ? " " + (i+1) : ""),
  email: `user${i + 1}@bank.io`,
  role: i % 7 === 0 ? "Admin" : i % 5 === 0 ? "Analyst" : "User",
  status: i % 9 === 0 ? "suspended" : "active",
  risk: Math.round(Math.random() * 100),
  created: new Date(Date.now() - i * 86400000 * 3).toISOString(),
}));

export const geoFraud = [
  { country: "United States", value: 412, lat: 38, lon: -97 },
  { country: "Brazil", value: 248, lat: -10, lon: -55 },
  { country: "United Kingdom", value: 187, lat: 54, lon: -2 },
  { country: "Germany", value: 154, lat: 51, lon: 10 },
  { country: "India", value: 312, lat: 22, lon: 79 },
  { country: "Japan", value: 89, lat: 36, lon: 138 },
  { country: "Nigeria", value: 141, lat: 9, lon: 8 },
];
