// 대구광역시 구·군 및 시드 데이터용 대표 동 (좌표는 대략적인 중심점)
export type Dong = { name: string; lat: number; lng: number };
export type District = { sigungu: string; lat: number; lng: number; dongs: Dong[] };

export const SIDO = "대구광역시";

export const DAEGU_DISTRICTS: District[] = [
  {
    sigungu: "중구", lat: 35.8693, lng: 128.6062,
    dongs: [
      { name: "대봉동", lat: 35.8592, lng: 128.6037 },
      { name: "남산동", lat: 35.8634, lng: 128.5916 },
      { name: "삼덕동", lat: 35.8655, lng: 128.6098 },
    ],
  },
  {
    sigungu: "동구", lat: 35.8866, lng: 128.6357,
    dongs: [
      { name: "신암동", lat: 35.8835, lng: 128.6235 },
      { name: "효목동", lat: 35.8771, lng: 128.6386 },
      { name: "방촌동", lat: 35.8810, lng: 128.6620 },
    ],
  },
  {
    sigungu: "서구", lat: 35.8718, lng: 128.5592,
    dongs: [
      { name: "비산동", lat: 35.8810, lng: 128.5800 },
      { name: "평리동", lat: 35.8715, lng: 128.5640 },
      { name: "내당동", lat: 35.8590, lng: 128.5650 },
    ],
  },
  {
    sigungu: "남구", lat: 35.8460, lng: 128.5974,
    dongs: [
      { name: "대명동", lat: 35.8460, lng: 128.5850 },
      { name: "봉덕동", lat: 35.8440, lng: 128.6040 },
      { name: "이천동", lat: 35.8530, lng: 128.6030 },
    ],
  },
  {
    sigungu: "북구", lat: 35.8858, lng: 128.5828,
    dongs: [
      { name: "침산동", lat: 35.8930, lng: 128.5890 },
      { name: "산격동", lat: 35.8960, lng: 128.6040 },
      { name: "복현동", lat: 35.8950, lng: 128.6180 },
    ],
  },
  {
    sigungu: "수성구", lat: 35.8582, lng: 128.6306,
    dongs: [
      { name: "범어동", lat: 35.8590, lng: 128.6260 },
      { name: "만촌동", lat: 35.8700, lng: 128.6430 },
      { name: "황금동", lat: 35.8450, lng: 128.6290 },
    ],
  },
  {
    sigungu: "달서구", lat: 35.8299, lng: 128.5328,
    dongs: [
      { name: "송현동", lat: 35.8300, lng: 128.5560 },
      { name: "본리동", lat: 35.8370, lng: 128.5470 },
      { name: "두류동", lat: 35.8520, lng: 128.5600 },
    ],
  },
  {
    sigungu: "달성군", lat: 35.7746, lng: 128.4314,
    dongs: [
      { name: "화원읍", lat: 35.8020, lng: 128.5000 },
      { name: "다사읍", lat: 35.8620, lng: 128.4600 },
    ],
  },
];

export const DAEGU_SIGUNGU = DAEGU_DISTRICTS.map((d) => d.sigungu);
