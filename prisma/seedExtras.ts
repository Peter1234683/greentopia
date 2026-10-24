/**
 * 추가 기능(P1~) 시드: 지원금 DB · 건물주 커뮤니티 · 사업자 라운지 · 안심 보장제 (대구)
 * - 지원금은 출처가 있는 항목만 넣는다. 공고문 원문 확인 전이라 verifiedAt 은 비워 둔다
 *   (화면에 "공고문 확인 필요" 배지). 대구시·구 지원사업은 출처 확인 후 운영자가 추가한다.
 * - 커뮤니티 글은 가상의 이웃 경험담이며, 제도 수치를 새로 만들어 넣지 않는다.
 */
import type { PrismaClient } from "@prisma/client";
import { CONTRACT_DEFAULTS } from "../src/config/contract";
import { splitAmounts } from "../src/lib/payments";
import { buildChecklist, passRate } from "../src/lib/inspection";

const json = (v: unknown) => JSON.stringify(v);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);


export async function seedExtras(db: PrismaClient, contractorId: Record<string, string>) {
  // ── 지원금 DB ──
  await db.subsidyProgram.create({
    data: {
      name: "2026 민간 건축물 그린리모델링 이자지원사업",
      provider: "국토교통부 · 국토안전관리원 그린리모델링 창조센터",
      region: "전국",
      targetBuildingTypesJson: json(["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"]),
      conditionsJson: json({
        minImprovementPct: 20, // 에너지 성능개선률 20% 이상 (20~30% 일반)
        preferentialImprovementPct: 30, // 30% 이상이면 우대
        preferentialBeneficiaries: ["NEWLYWED", "MULTI_CHILD", "SENIOR", "LOW_INCOME", "VETERAN"],
        detachedSimpleEvaluation: true, // 단독주택: 간이평가표 항목별 절감률 합계 20% 초과 시 승인 가능
        requiresEnergyWork: true,
      }),
      benefitJson: json({
        interestSupportPct: { general: 4.5, preferential: 5.5 },
        // 건축법상 다가구주택은 단독주택, 다세대주택은 공동주택으로 분류
        loanLimit: { MULTIPLEX: 30_000_000, DETACHED: 100_000_000, MULTI_HOUSEHOLD: 100_000_000 },
        maxRepayYears: 5,
      }),
      summary: "그린리모델링 공사비를 협약은행에서 대출받으면 이자 일부(일반 연 4.5%, 우대 연 5.5%)를 지원해요.",
      applyStepsJson: json([
        "시공 사업자와 공사계획을 세우고 온라인으로 신청",
        "사업확인서 발급",
        "협약은행 대출 심사",
        "공사 진행",
        "공사 완료 신청",
        "사업완료확인서 발급",
        "대출 실행 및 이자 보전",
      ]),
      applyPeriod: "공고문 확인 필요",
      applyUrl: "https://www.greenremodeling.or.kr",
      sourceUrl: "https://v.daum.net/v/20260326043356184",
      sourceNote: "2026.03 보도 기사 기준. 정확한 요건은 그린리모델링 창조센터 공고문으로 재확인이 필요해요.",
      status: "ACTIVE",
      verifiedAt: null,
    },
  });
  await db.subsidyProgram.create({
    data: {
      name: "2026 그린리모델링 컨설팅 지원사업",
      provider: "국토교통부 · 국토안전관리원 그린리모델링 창조센터",
      region: "전국",
      targetBuildingTypesJson: json(["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"]),
      conditionsJson: json({}),
      benefitJson: json({ services: ["전문가 방문 에너지 성능 판정", "공사비·냉난방비 절감 시뮬레이션", "이자지원 신청 서류·절차 대행"] }),
      summary: "전문가가 방문해 에너지 성능을 판정하고, 절감 시뮬레이션과 이자지원 신청 절차를 도와줘요.",
      applyStepsJson: json(["건축주 모집 공고 확인", "신청", "전문가 방문 컨설팅"]),
      applyPeriod: "건축주 모집 일정 공고 확인 필요",
      status: "UNVERIFIED", // 모집 일정 확인 전에는 고객에게 노출하지 않는다
    },
  });

  // ── 안심 보장제 · 배상책임보험 ──
  const pledges: [string, string[]][] = [
    ["contractor@demo.kr", ["NO_EXTRA_COST", "DELAY_PENALTY", "REDO_POOR_FINISH"]],
    ["c02@demo.kr", ["NO_EXTRA_COST", "DELAY_PENALTY", "REDO_POOR_FINISH"]],
    ["c09@demo.kr", ["NO_EXTRA_COST"]],
  ];
  for (const [email, items] of pledges) await db.safetyPledge.create({ data: { contractorId: contractorId[email], itemsJson: json(items) } });
  for (const email of ["contractor@demo.kr", "c02@demo.kr", "c03@demo.kr", "c05@demo.kr", "c06@demo.kr", "c09@demo.kr"])
    await db.contractorProfile.update({ where: { id: contractorId[email] }, data: { liabilityInsurance: true } });

  // ── 건물주 커뮤니티 ──
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@demo.kr" } });
  // 과거 공동공사를 마친 건물주 (시공 완료 인증 배지 대상)
  const doneOwners = await db.user.findMany({
    where: { role: "CUSTOMER", buildings: { some: { contracts: { some: { status: "SIGNED", project: { status: "COMPLETED" } } } } } },
    include: { buildings: true },
    take: 6,
  });
  const owners = await db.user.findMany({ where: { role: "CUSTOMER", email: { startsWith: "owner" } }, include: { buildings: true }, take: 40 });
  const pickOwner = (i: number) => owners[i % owners.length];
  const b0 = (u: { buildings: { sigungu: string; dong: string; usage: string; approvalDate: Date | null }[] }) => u.buildings[0];
  const age = (d: Date | null) => (d ? new Date().getFullYear() - d.getFullYear() : null);

  type PostSeed = {
    author: (typeof owners)[number];
    category: string;
    title: string;
    body: string;
    work?: string[];
    savings?: number;
    tips?: string[];
    recruit?: { trade: string; sigungu: string; dong: string };
    notice?: boolean;
    best?: boolean;
    days: number;
    comments?: [number, string][];
  };
  const P: PostSeed[] = [
    {
      author: doneOwners[0] ?? pickOwner(0), category: "REVIEW", best: true, days: 40, work: ["WINDOW"], savings: 2_400_000,
      title: "봉덕동 다세대, 이웃 6집이랑 창호 같이 바꾼 후기",
      body: "작년 봄에 같은 골목 여섯 집이 묶여서 창호를 바꿨어요. 혼자 견적 받을 때보다 금액이 확실히 낮았고, 업체가 하루에 한두 집씩 이어서 작업해서 골목 소음도 짧게 끝났습니다.\n겨울 지나 보니 창가 냉기가 거의 없어졌어요. 절감액은 저희 집 기준 개별 견적과 비교한 금액이에요.",
      tips: ["실측 날 창마다 열림 방향을 꼭 확인", "공사 순서는 업체 동선에 맡기면 빨라요", "준공 때 실리콘 마감 사진을 받아두세요"],
      comments: [[3, "저희도 봉덕동인데 그때 못 껴서 아쉬워요. 다음 묶음 있으면 꼭 알려주세요!"], [5, "실측 날 열림 방향 팁 좋네요."]],
    },
    {
      author: pickOwner(1), category: "TIP", days: 12, work: ["WINDOW"],
      title: "창호 교체 전 실측 날 꼭 확인할 3가지",
      body: "실측 날 업체 분이 오시면 창 크기만 재고 가시는 경우가 있어요. 저는 아래 세 가지를 같이 확인했더니 공사 날 추가 일이 없었어요.",
      tips: ["방충망 일체형인지 별도인지", "창틀 주변 벽 상태(조적이면 고정 방식)", "가구·커튼 이동이 필요한 창"],
      comments: [[7, "조적 벽이면 고정 방식이 달라지는군요. 몰랐어요."]],
    },
    {
      author: pickOwner(2), category: "SUBSIDY", days: 8, work: ["WINDOW", "EXT_INSULATION"],
      title: "이자지원은 공사 전에 공사계획부터 세워야 하더라고요",
      body: "공사 다 하고 신청하면 되는 줄 알았는데, 시공 업체랑 공사계획을 먼저 세워서 온라인으로 신청하고 사업확인서를 받은 뒤에 은행 심사로 넘어가는 순서였어요.\n정확한 요건과 일정은 공고문을 꼭 확인하세요. 앱의 '숨은 지원금 확인'에서 우리 집 해당 여부를 먼저 보면 편해요.",
      tips: ["공사 계약 전에 신청 순서부터 확인", "업체에 이자지원 서류 경험이 있는지 물어보기", "공고문 원문 확인은 필수"],
    },
    {
      author: pickOwner(3), category: "QNA", days: 5, work: ["EXT_INSULATION"],
      title: "다가구인데 외단열 하면 세입자분들께 뭘 안내해야 하나요?",
      body: "침산동 다가구(5세대) 집주인입니다. 외단열 공동시공을 고민 중인데, 공사 중에 세입자분들이 불편하실 것 같아서요. 경험 있으신 분 조언 부탁드려요.",
      comments: [[8, "저는 비계 설치 기간이랑 창문 못 여는 날을 미리 문자로 안내했어요."], [9, "업체에 공사 일정표를 받아서 현관에 붙여두니 문의가 줄었어요."]],
    },
    {
      author: pickOwner(4), category: "RECRUIT", days: 3, work: ["WINDOW"],
      title: "대명동 창호 같이 바꾸실 분 (내년 1~2월 희망)",
      body: "대명동 1990년대 다가구입니다. 창호가 오래돼서 겨울에 외풍이 심해요. 비슷한 시기에 하실 이웃분들 모이면 공동견적 받아보려고요. 관심 있으시면 아래 버튼 눌러주세요!",
      recruit: { trade: "WINDOW", sigungu: "남구", dong: "대명동" },
      comments: [[10, "관심 눌렀어요. 저희도 2월쯤 생각하고 있어요."]],
    },
    {
      author: pickOwner(5), category: "RECRUIT", days: 2, work: ["EXT_INSULATION"],
      title: "침산동 외단열 공동구매 관심 있으신 분",
      body: "외단열은 비계를 세워야 해서 이웃이 함께하면 고정비를 나눌 수 있다고 들었어요. 침산동 근처 다가구·다세대 집주인분들 같이 알아봐요.",
      recruit: { trade: "EXT_INSULATION", sigungu: "북구", dong: "침산동" },
    },
    {
      author: doneOwners[1] ?? pickOwner(6), category: "REVIEW", best: true, days: 60, work: ["WINDOW"], savings: 1_800_000,
      title: "만촌동 단독주택 창호 교체 전후 (사진)",
      body: "거실 큰 창이 특히 춥던 집이에요. 공사 후 거실 온도가 확실히 덜 떨어져요. 전후 사진 올려요.",
      tips: ["거실창은 대형 규격이라 단가가 달라요", "공사 전 바닥 보양 확인", "완료 후 개폐 테스트 같이 하기"],
    },
    {
      author: pickOwner(7), category: "TIP", days: 20, work: ["INT_INSULATION"],
      title: "결로 줄이려면 환기도 같이 챙기세요",
      body: "단열만 하고 환기를 안 하면 오히려 결로가 생길 수 있대요. 저는 공사 후 하루 두 번 10분씩 맞통풍을 시키고 있어요.",
      tips: ["아침·저녁 10분 맞통풍", "욕실 환풍기 타이머 사용", "가구는 벽에서 5cm 띄우기"],
    },
    {
      author: pickOwner(8), category: "QNA", days: 1, work: ["BOILER"],
      title: "보일러 교체, 겨울 전에 하는 게 낫나요?",
      body: "송현동 다세대입니다. 보일러가 12년 됐는데 겨울 전에 바꾸는 게 좋을지, 다른 공사랑 같이 하는 게 좋을지 고민이에요.",
      comments: [[11, "저는 성수기 전에 바꿨더니 일정 잡기가 편했어요."]],
    },
    {
      author: { ...admin, buildings: [] } as never, category: "NOTICE", notice: true, days: 30,
      title: "이웃 커뮤니티 이용 안내",
      body: "그린토피아 이웃 커뮤니티는 실제 시공 경험을 나누는 공간이에요.\n- 주소는 동 단위까지만 보여요\n- 특정 업체 비방·광고 글은 숨김 처리될 수 있어요\n- 지원금 정보는 공고문 원문을 꼭 확인하세요",
    },
  ];
  for (const p of P) {
    const b = p.author.buildings?.[0] ? b0(p.author) : null;
    const post = await db.communityPost.create({
      data: {
        boardType: "OWNER",
        authorId: p.author.id,
        category: p.category,
        title: p.title,
        body: p.body,
        sigungu: p.recruit?.sigungu ?? b?.sigungu ?? null,
        dong: p.recruit?.dong ?? b?.dong ?? null,
        buildingType: b?.usage ?? null,
        buildingAge: b ? age(b.approvalDate) : null,
        workTypesJson: json(p.work ?? []),
        savingsAmount: p.savings ?? null,
        keyTipsJson: json(p.tips ?? []),
        recruitJson: p.recruit ? json(p.recruit) : null,
        isNotice: !!p.notice,
        isBest: !!p.best,
        viewCount: 20 + p.title.length * 3,
        createdAt: daysAgo(p.days),
      },
    });
    for (const [i, body] of p.comments ?? [])
      await db.communityComment.create({ data: { postId: post.id, authorId: pickOwner(i).id, body, createdAt: daysAgo(Math.max(0, p.days - 1)) } });
    const likes = Math.min(owners.length, (p.best ? 9 : 2) + (p.title.length % 4));
    for (let i = 0; i < likes; i++)
      await db.communityReaction.create({ data: { postId: post.id, userId: owners[(i * 3 + p.days) % owners.length].id, kind: "LIKE" } }).catch(() => {});
  }

  // ── 사업자 라운지 ──
  const cu = async (email: string) => (await db.contractorProfile.findUniqueOrThrow({ where: { id: contractorId[email] } })).userId;
  const L: { email: string; category: string; title: string; body: string; days: number; notice?: boolean; comments?: [string, string][]; accept?: number; held?: string }[] = [
    {
      email: "c04@demo.kr", category: "TECH", days: 9,
      title: "조적조 창틀 고정, 어떤 앵커 쓰세요?",
      body: "1980년대 조적조 다가구 창호 교체 때 기존 벽돌이 약해서 앵커가 헛도는 경우가 있네요. 다들 어떤 방식으로 보강하시는지 궁금합니다.",
      comments: [["contractor@demo.kr", "저희는 케미컬 앵커로 바꾸고, 줄눈 쪽은 피해서 박습니다. 실측 때 벽 상태를 미리 사진으로 남겨두면 건물주 설명도 편해요."], ["c09@demo.kr", "벽돌이 많이 삭았으면 보강 프레임을 먼저 대는 게 안전했어요."]],
      accept: 0,
    },
    {
      email: "c09@demo.kr", category: "MATERIAL", days: 6,
      title: "PVC 프로파일 납기, 요즘 얼마나 걸리세요?",
      body: "겨울 성수기 앞두고 프로파일 납기가 길어지는 것 같아요. 공정표 잡을 때 참고하려고 대략적인 납기 경험 공유 부탁드려요. (단가·입찰 얘기는 규칙상 사양할게요)",
      comments: [["c02@demo.kr", "저희 쪽은 평소보다 1~2주 더 걸렸어요. 실측 끝나면 바로 발주 넣는 편입니다."]],
    },
    {
      email: "c02@demo.kr", category: "PAPERWORK", days: 15,
      title: "GR 사업자 등록 서류 준비 순서 정리",
      body: "처음 등록하시는 분들 질문이 많아서 제가 준비했던 순서를 적어요. 세부 요건은 창조센터 공고를 꼭 확인하세요.\n1) 건설업 등록증·면허 사본\n2) 기술인력 증빙\n3) 최근 시공 실적 자료\n4) 온라인 신청",
    },
    {
      email: "c06@demo.kr", category: "SAFETY", days: 22,
      title: "외단열 작업 중 비계 흔들림 아차사고 공유",
      body: "바람 부는 날 3층 비계 상단이 흔들려서 작업을 멈췄습니다. 벽 연결 간격을 다시 점검하고 재개했어요. 다들 강풍 기준 정해두고 계신가요?",
      comments: [["c03@demo.kr", "저희는 풍속 기준을 정해두고 넘으면 고소작업은 중단합니다."]],
    },
    {
      email: "c03@demo.kr", category: "HIRING", days: 4,
      title: "수성구 내단열 협력 기술자 구합니다",
      body: "다음 달 수성구 단독주택 내단열 작업에 함께하실 기술자분 찾습니다. 경력·가능 일정 댓글이나 쪽지 부탁드려요.",
    },
    {
      email: "admin", category: "NOTICE", notice: true, days: 30,
      title: "라운지 이용 규칙: 진행 중 입찰 논의 금지",
      body: "파트너 라운지는 시공 기술과 실무를 나누는 공간이에요.\n- 진행 중인 입찰의 가격·참여 여부는 논의할 수 없어요\n- 입찰 번호·금액으로 보이는 글은 자동으로 게시가 보류되고 운영자가 검토해요\n- 우수 답변 채택은 평판 점수에 반영되지 않고, 프로필에 '기술 공유' 배지로만 표시돼요",
    },
    {
      email: "c11@demo.kr", category: "MATERIAL", days: 0,
      title: "이번 서구 창호 건 다들 얼마 넣으세요?",
      body: "Cluster #7 창호 건 ㎡당 40만원대에 넣자는 얘기가 있던데 맞나요?",
      held: "진행 중 입찰 번호·가격으로 보이는 표현이 감지됐어요 (Cluster #7, ㎡당 40만원대)",
    },
  ];
  for (const l of L) {
    const authorId = l.email === "admin" ? admin.id : await cu(l.email);
    const post = await db.communityPost.create({
      data: {
        boardType: "CONTRACTOR", authorId, category: l.category, title: l.title, body: l.body, isNotice: !!l.notice,
        status: l.held ? "HELD" : "PUBLISHED", holdReason: l.held ?? null, viewCount: l.held ? 0 : 15 + l.title.length * 2, createdAt: daysAgo(l.days),
      },
    });
    let accepted: string | null = null;
    for (const [i, [email, body]] of (l.comments ?? []).entries()) {
      const c = await db.communityComment.create({ data: { postId: post.id, authorId: await cu(email), body, createdAt: daysAgo(Math.max(0, l.days - 1)) } });
      if (l.accept === i) accepted = c.id;
    }
    if (accepted) await db.communityPost.update({ where: { id: post.id }, data: { acceptedCommentId: accepted } });
    if (l.held)
      await db.collusionFlag.create({
        data: {
          source: "BOARD", kind: "BOARD_KEYWORD", postId: post.id,
          contractorIdsJson: json([contractorId[l.email]]), tenderIdsJson: json([]), detail: `라운지 글 게시 보류: ${l.held}`,
        },
      });
  }
  // 라운지 규칙 동의 (시드 업체)
  for (const email of ["contractor@demo.kr", "c02@demo.kr", "c03@demo.kr", "c04@demo.kr", "c06@demo.kr", "c09@demo.kr", "c11@demo.kr"])
    await db.contractorProfile.update({ where: { id: contractorId[email] }, data: { loungeAgreedAt: daysAgo(30) } });

  // 과거 완료 공사: 단계별 지급 기록(모두 승인)과 준공 검측(건물주 승인) — 교차 검증 비교 데이터
  const done = await db.contract.findMany({
    where: { status: "SIGNED", project: { status: "COMPLETED" } },
    include: { project: true, tender: { include: { cluster: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const [k, c] of done.entries()) {
    const amounts = splitAmounts(c.amount, CONTRACT_DEFAULTS.stages);
    const completedAt = c.project!.completedAt ?? daysAgo(120);
    const releaseAt = new Date(completedAt.getTime() + CONTRACT_DEFAULTS.retentionDays * 864e5);
    await db.paymentMilestone.createMany({
      data: CONTRACT_DEFAULTS.stages.map((st, i) => ({
        contractId: c.id, stage: st.code, seq: i + 1, ratio: st.ratio, amount: amounts[i], condition: st.condition,
        status: st.code === "RETENTION" && releaseAt > new Date() ? "LOCKED" : "RELEASED",
        approvedAt: st.code === "RETENTION" && releaseAt > new Date() ? null : completedAt,
        releaseAt: st.code === "RETENTION" ? releaseAt : null,
      })),
    });
    const trade = c.tender?.cluster.trade ?? "WINDOW";
    // 하자 이력이 있던 묶음(#3)은 일부 항목 미흡
    const defect = c.tender?.cluster.code === 3 && k % 2 === 0;
    const items = buildChecklist(trade, [], CONTRACT_DEFAULTS.checklist).map((x, i) => ({ ...x, ownerCheck: (defect && i === 0 ? "X" : "O") as "O" | "X" }));
    await db.completionInspection.create({
      data: {
        projectId: c.project!.id, checklistJson: json(items), source: "manual", provider: "rule",
        score: passRate(items), ownerApproved: true, ownerApprovedAt: completedAt,
      },
    });
  }
}
