export interface TrendPoint {
  day: string;
  fraud: number;
  safe: number;
}

export interface VolumePoint {
  month: string;
  volume: number;
  fraud: number;
}

export interface GeoFraudPoint {
  country: string;
  value: number;
  lat: number;
  lon: number;
}
