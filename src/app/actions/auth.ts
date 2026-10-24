"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { acceptInvite } from "@/lib/invite";
import { ROLE_HOME, TRADES, type Role } from "@/lib/constants";
import { SIDO, DAEGU_SIGUNGU } from "@/config/regions";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { echo, fieldErrors, type FormState } from "@/lib/forms";

const phone = z
  .string()
  .trim()
  .regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "연락처 형식을 확인해주세요. (예: 010-1234-5678)");
const email = z.string().trim().toLowerCase().email("이메일 형식을 확인해주세요.");
const password = z.string().min(8, "비밀번호는 8자 이상으로 정해주세요.");

async function emailTaken(address: string) {
  return (await db.user.count({ where: { email: address } })) > 0;
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  phone,
  email,
  password,
  address: z.string().trim().optional(),
});

export async function signupCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData);
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  if (await emailTaken(d.email)) return { errors: { email: "이미 가입된 이메일이에요. 로그인해주세요." }, values };

  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      name: d.name,
      phone: d.phone,
      role: "CUSTOMER",
      customerProfile: { create: {} },
    },
  });
  const invite = String(formData.get("invite") ?? "");
  if (invite) await acceptInvite(invite, user.id);
  await createSession({ userId: user.id, role: "CUSTOMER" });
  // 주소를 입력했다면 건물 등록 화면(마일스톤 2)에서 이어서 쓸 수 있게 넘긴다.
  redirect(d.address ? `/customer?address=${encodeURIComponent(d.address)}` : "/customer");
}

const contractorSchema = z.object({
  companyName: z.string().trim().min(1, "상호를 입력해주세요."),
  ceoName: z.string().trim().min(1, "대표자 이름을 입력해주세요."),
  bizRegNo: z
    .string()
    .trim()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, "사업자등록번호 10자리를 확인해주세요. (예: 123-45-67890)")
    .transform((v) => v.replace(/-/g, "").replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3")),
  phone,
  email,
  password,
  trades: z.array(z.enum(TRADES)).min(1, "시공 가능한 공종을 하나 이상 골라주세요."),
  regions: z.array(z.string()).min(1, "활동 권역을 하나 이상 골라주세요."),
  grRegistered: z.enum(["yes", "no"], { message: "GR 사업자 등록 여부를 골라주세요." }),
  grRegNo: z.string().trim().optional(),
  constructionLicense: z.string().trim().min(1, "건설업 등록·면허 종류를 입력해주세요."),
  licenseNo: z.string().trim().optional(),
  warrantyAvailable: z.enum(["yes", "no"], { message: "하자보증 가능 여부를 골라주세요." }),
  techStaffCount: z.coerce.number().int().min(0).max(999).default(0),
  externalProjectCount: z.coerce.number().int().min(0).max(9999).default(0),
  portfolio: z.string().trim().max(2000).optional(),
});

export async function signupContractor(_: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData);
  const raw = {
    ...Object.fromEntries(formData),
    trades: formData.getAll("trades"),
    regions: formData.getAll("regions"),
  };
  const parsed = contractorSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const regions = d.regions.filter((r) => r === "전체" || DAEGU_SIGUNGU.includes(r));
  if (regions.length === 0) return { errors: { regions: "활동 권역을 하나 이상 골라주세요." }, values };

  const grFile = formData.get("grCert");
  const hasGrFile = grFile instanceof File && grFile.size > 0;
  if (d.grRegistered === "yes") {
    if (!d.grRegNo) return { errors: { grRegNo: "GR 사업자 등록번호를 입력해주세요." }, values };
    if (!hasGrFile) return { errors: { grCert: "GR 사업자 등록 증빙 파일을 올려주세요." }, values };
  }
  if (hasGrFile) {
    const err = validateUpload(grFile);
    if (err) return { errors: { grCert: err }, values };
  }
  const licenseFile = formData.get("licenseDoc");
  const hasLicenseFile = licenseFile instanceof File && licenseFile.size > 0;
  if (hasLicenseFile) {
    const err = validateUpload(licenseFile);
    if (err) return { errors: { licenseDoc: err }, values };
  }

  if (await emailTaken(d.email)) return { errors: { email: "이미 가입된 이메일이에요. 로그인해주세요." }, values };
  if ((await db.contractorProfile.count({ where: { bizRegNo: d.bizRegNo } })) > 0)
    return { errors: { bizRegNo: "이미 등록된 사업자등록번호예요." }, values };

  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      name: d.ceoName,
      phone: d.phone,
      role: "CONTRACTOR",
      contractorProfile: {
        create: {
          companyName: d.companyName,
          ceoName: d.ceoName,
          bizRegNo: d.bizRegNo,
          phone: d.phone,
          grRegistered: d.grRegistered === "yes",
          grRegNo: d.grRegistered === "yes" ? d.grRegNo : null,
          constructionLicense: d.constructionLicense,
          licenseNo: d.licenseNo || null,
          warrantyAvailable: d.warrantyAvailable === "yes",
          techStaffCount: d.techStaffCount,
          externalProjectCount: d.externalProjectCount,
          portfolio: d.portfolio || null,
          trades: { create: d.trades.map((trade) => ({ trade })) },
          regions: { create: regions.map((sigungu) => ({ sido: SIDO, sigungu })) },
        },
      },
    },
    include: { contractorProfile: true },
  });

  const contractorId = user.contractorProfile!.id;
  const uploads: [File, string][] = [];
  if (hasGrFile) uploads.push([grFile, "GR_CERT"]);
  if (hasLicenseFile) uploads.push([licenseFile, "LICENSE"]);
  for (const [file, kind] of uploads) {
    const saved = await saveUpload(file);
    await db.document.create({ data: { ...saved, kind, ownerId: user.id, contractorId } });
  }

  await createSession({ userId: user.id, role: "CONTRACTOR" });
  redirect("/contractor");
}

const loginSchema = z.object({ email, password: z.string().min(1, "비밀번호를 입력해주세요.") });

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash)))
    return { message: "이메일 또는 비밀번호가 맞지 않아요.", values };
  await createSession({ userId: user.id, role: user.role as Role });
  redirect(ROLE_HOME[user.role as Role]);
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
