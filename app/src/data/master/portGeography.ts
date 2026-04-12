export interface GeoPoint {
  lon: number
  lat: number
}

// 港名はゲーム都合のままにしつつ、描画座標は実際の沿岸/港湾寄りの位置を使う。
// 河川内陸都市は外洋へ近い港口側に寄せている。
export const PORT_GEO_COORDINATES: Record<string, GeoPoint> = {
  lisbon: { lon: -9.1393, lat: 38.7223 },
  seville: { lon: -6.353, lat: 36.7781 },
  london: { lon: -0.1278, lat: 51.5074 },
  amsterdam: { lon: 4.6, lat: 52.4633 },
  marseille: { lon: 5.3698, lat: 43.2965 },
  venice: { lon: 12.3155, lat: 45.4408 },
  istanbul: { lon: 28.9784, lat: 41.0082 },
  alexandria: { lon: 29.9187, lat: 31.2001 },
  tunis: { lon: 10.1815, lat: 36.8065 },
  genoa: { lon: 8.9463, lat: 44.4056 },
  cape_town: { lon: 18.4241, lat: -33.9249 },
  calicut: { lon: 75.7804, lat: 11.2588 },
  malacca: { lon: 102.2501, lat: 2.1896 },
  macau: { lon: 113.5439, lat: 22.1987 },
  nagasaki: { lon: 129.8737, lat: 32.7503 },
  santo_domingo: { lon: -69.9312, lat: 18.4861 },
  havana: { lon: -82.3666, lat: 23.1136 },
  bordeaux: { lon: -1.15, lat: 45.0 },
  naples: { lon: 14.2681, lat: 40.8518 },
  athens: { lon: 23.643, lat: 37.942 },
}
