// 港名はゲーム都合のままにしつつ、描画座標は実際の沿岸/港湾寄りの位置を使う。
// 河川内陸都市は外洋へ近い港口側に寄せている。
export const PORT_GEO_COORDINATES: Record<string, GeoPoint> = {
  lisbon: { lon: -9.2, lat: 38.7 }, // Adjusted west for Tagus estuary mouth
  seville: { lon: -6.45, lat: 36.72 }, // Adjusted southwest for Guadalquivir estuary
  london: { lon: -0.15, lat: 51.48 }, // Adjusted southeast towards Thames estuary
  amsterdam: { lon: 4.4, lat: 52.45 }, // Adjusted west towards North Sea canal
  marseille: { lon: 5.35, lat: 43.28 }, // Adjusted south-southwest towards harbor
  venice: { lon: 12.35, lat: 45.435 }, // Adjusted east for lagoon entrance
  istanbul: { lon: 28.98, lat: 41.005 }, // Refined for Golden Horn entrance
  alexandria: { lon: 29.95, lat: 31.22 }, // Adjusted east for harbor position
  tunis: { lon: 10.22, lat: 36.78 }, // Adjusted southeast
  genoa: { lon: 8.96, lat: 44.41 }, // Adjusted east-southeast
  cape_town: { lon: 18.45, lat: -33.91 }, // Adjusted for Table Bay harbor
  calicut: { lon: 75.76, lat: 11.26 }, // Adjusted for harbor entrance
  malacca: { lon: 102.27, lat: 2.19 }, // Adjusted for strait position
  macau: { lon: 113.55, lat: 22.20 }, // Adjusted for harbor mouth
  nagasaki: { lon: 129.89, lat: 32.745 }, // Adjusted for harbor entrance
  santo_domingo: { lon: -69.91, lat: 18.47 }, // Adjusted for Ozama river mouth
  havana: { lon: -82.4, lat: 23.12 }, // Adjusted west slightly
  bordeaux: { lon: -1.2, lat: 44.98 }, // Adjusted west for Gironde estuary
  naples: { lon: 14.25, lat: 40.83 }, // Adjusted for harbor position
  athens: { lon: 23.63, lat: 37.95 }, // Adjusted for Piraeus position
}

export interface GeoPoint {
  lon: number
  lat: number
}