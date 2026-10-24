import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBidTalk } from "../src/lib/community/guard";
import { hasExactAddress, maskName } from "../src/lib/community/mask";

test("라운지 가드: 입찰 번호·가격 맞추기는 잡고, 일반 기술·자재 이야기는 통과", () => {
  for (const t of [
    "Cluster #6 창호 건 다들 얼마 넣으세요?",
    "클러스터 12 이번엔 빠져주세요",
    "㎡당 40만원대로 맞추자",
    "4500만원에 넣자고 하던데",
    "이번 건은 양보할게요 다음에 순번 돌려요",
    "투찰가 다들 얼마예요",
  ])
    assert.equal(detectBidTalk(t).hit, true, t);
  for (const t of [
    "조적조 창틀 앵커 어떤 거 쓰세요?",
    "PVC 프로파일 납기가 2주 늦어요",
    "비계는 풍속 10m/s 넘으면 중단합니다",
    "외단열 100mm 시공 시 주의점 공유해요",
    "GR 사업자 등록 서류 순서 정리",
  ])
    assert.equal(detectBidTalk(t).hit, false, t);
});

test("이름 마스킹", () => {
  assert.equal(maskName("김그린"), "김*린");
  assert.equal(maskName("이수"), "이*");
  assert.equal(maskName("남궁민수"), "남**수");
});

test("정확한 주소 감지: 지번·도로명 번호·동호수는 잡고 동 이름·금액은 통과", () => {
  for (const t of ["대명동 123-4번지 사는데요", "중앙대로 412 근처", "달구벌대로 10-3", "101동 1203호입니다"]) assert.equal(hasExactAddress(t), true, t);
  for (const t of ["대명동 다세대에 살아요", "공동으로 10만원 아꼈어요", "창호로 30% 줄었어요", "남구 이웃 모집해요"]) assert.equal(hasExactAddress(t), false, t);
});
