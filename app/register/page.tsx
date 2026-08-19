import { redirect } from "next/navigation";

// 이메일 회원가입 폐지 — 가입·로그인은 구글 OAuth 단일 경로(/login)
export default function RegisterPage() {
  redirect("/login");
}
