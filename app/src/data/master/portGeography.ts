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
  porto: { lon: -8.72, lat: 41.14 },
  santander: { lon: -3.8, lat: 43.46 },
  bilbao: { lon: -3.03, lat: 43.35 },
  nantes: { lon: -2.18, lat: 47.22 },
  rouen: { lon: 0.1, lat: 49.48 },
  antwerp: { lon: 4.23, lat: 51.32 },
  hamburg: { lon: 8.78, lat: 53.88 },
  copenhagen: { lon: 12.6, lat: 55.68 },
  danzig: { lon: 18.67, lat: 54.36 },
  barcelona: { lon: 2.18, lat: 41.36 },
  valencia: { lon: -0.32, lat: 39.44 },
  palma: { lon: 2.64, lat: 39.56 },
  syracuse: { lon: 15.29, lat: 37.06 },
  ragusa: { lon: 18.08, lat: 42.65 },
  candia: { lon: 25.14, lat: 35.34 },
  cyprus: { lon: 33.64, lat: 34.92 },
  beirut: { lon: 35.5, lat: 33.9 },
  jaffa: { lon: 34.75, lat: 32.05 },
  algiers: { lon: 3.05, lat: 36.78 },
  ceuta: { lon: -5.31, lat: 35.9 },
  tripoli: { lon: 13.19, lat: 32.89 },
  arguin: { lon: -16.43, lat: 20.6 },
  sierra_leone: { lon: -13.23, lat: 8.49 },
  sao_jorge: { lon: -1.35, lat: 5.09 },
  luanda: { lon: 13.23, lat: -8.81 },
  sofala: { lon: 34.73, lat: -20.16 },
  mombasa: { lon: 39.67, lat: -4.05 },
  zanzibar: { lon: 39.2, lat: -6.16 },
  aden: { lon: 45.03, lat: 12.79 },
  muscat: { lon: 58.57, lat: 23.62 },
  hormuz: { lon: 56.43, lat: 27.08 },
  goa: { lon: 73.82, lat: 15.49 },
  cochin: { lon: 76.24, lat: 9.97 },
  diu: { lon: 70.98, lat: 20.71 },
  cambay: { lon: 72.62, lat: 22.31 },
  san_juan: { lon: -66.11, lat: 18.47 },
  jamaica: { lon: -76.79, lat: 17.97 },
  cartagena: { lon: -75.53, lat: 10.4 },
  veracruz: { lon: -96.13, lat: 19.18 },
}

export interface GeoPoint {
  lon: number
  lat: number
}
