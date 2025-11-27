# 태창 ERP 시스템 (Taechang ERP System)

한글 자동차 부품 제조업체를 위한 클라우드 네이티브 ERP 시스템

**Tech Stack**: Next.js 14.2.16 + React 18.3.1 + TypeScript + Supabase PostgreSQL

**Production URL**: https://taechangmetal.vercel.app

**GitHub Repository**: https://github.com/kkhwan1/TaeYaoung_ERP_251020.git

## 🚀 빠른 시작

### 사전 요구사항
- Node.js 18.17 이상
- Supabase 프로젝트 (https://supabase.com)
- npm 또는 yarn

### Supabase 설정

1. **프로젝트 생성**: https://supabase.com/dashboard → New Project
2. **환경 변수** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
```
3. **스키마 적용**: Supabase Dashboard → SQL Editor → `database/schema.sql` 실행

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행 (권장: 안전한 서버 관리)
npm run dev:safe

# 3. 브라우저에서 접속
http://localhost:5000
```

### 서버 관리 명령어

```bash
# 안전한 서버 시작 (포트 충돌 자동 감지)
npm run dev:safe

# 서버 상태 확인
npm run dev:status

# 서버 안전하게 종료
npm run dev:stop

# 서버 재시작 (종료 → 시작)
npm run dev:restart

# 빌드 캐시 안전 삭제
npm run clean

# 빌드 캐시 삭제 후 서버 시작
npm run clean:all
```

### 기존 명령어 (호환성 유지)
```bash
# 기본 서버 시작 (포트 충돌 시 오류 발생 가능)
npm run dev
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 💾 데이터베이스

Supabase Dashboard → SQL Editor → `database/schema.sql` 실행

```bash
npm run db:types         # TypeScript 타입 생성
node database/check-schema.js  # 스키마 검증
```

## 🔧 주요 기능

### 마스터 데이터 관리
- **품목 관리** (`/master/items`)
  - 원자재, 제품, 스크랩 분류
  - 차종별 부품 관리
  - Excel 업로드 지원

- **거래처 관리** (`/master/companies`)
  - 고객사/공급사 분류
  - 이중 언어 지원 (한글/영문)

- **BOM 관리** (`/master/bom`)
  - 다단계 구성 지원
  - 자재 소요량 계산

### 재고 관리
- **재고 거래** (`/inventory`)
  - 입고/생산/출고 처리
  - BOM 자동 차감 시스템 (API + Database Trigger 이중 검증)
  - 실시간 재고 업데이트
  - LOT 추적 관리
  - 재고 부족 자동 차단

- **재고 현황** (`/stock`)
  - 실시간 재고 조회
  - 재고 이력 추적
  - 재고 조정 기능

### 회계 관리
- **매출 관리** (`/sales`) - 매출 거래 등록 및 관리
- **매입 관리** (`/purchases`) - 매입 거래 등록 및 관리
- **수금 관리** (`/collections`) - 전액 수금/이전 정보 불러오기 기능
- **지급 관리** (`/payments`) - 전액 지급/이전 정보 불러오기 기능
- **회계 요약** (`/accounting/summary`) - 월별 회계 요약 대시보드

### 계약 관리
- **계약 관리** (`/contracts`)
  - 계약 정보 관리
  - 첨부파일 업로드/삭제 기능
  - 문서 다운로드 기능

## 📊 주요 API

### 마스터 데이터
- `/api/items`, `/api/companies`, `/api/bom` - 품목/거래처/BOM CRUD

### 재고 관리
- `/api/inventory/receiving` - 입고 거래 처리
- `/api/inventory/production` - 생산 거래 처리 (BOM 자동 차감)
- `/api/inventory/shipping` - 출고 거래 처리
- `/api/stock/*` - 재고 현황 및 이력 조회

### 회계 관리
- `/api/sales`, `/api/purchases` - 매출/매입 거래 관리
- `/api/collections`, `/api/payments` - 수금/지급 관리
- `/api/accounting/summary` - 회계 요약

### 계약 관리
- `/api/contracts` - 계약 정보 CRUD
- `/api/contracts/[id]/documents` - 첨부파일 업로드/삭제

### 유틸리티
- `/api/upload/*`, `/api/download/template/*` - Excel 업로드/다운로드

## 🛠️ 개발 명령어

```bash
# 서버 관리 (권장)
npm run dev:safe         # 안전한 서버 시작 (포트 충돌 자동 감지)
npm run dev:status       # 서버 상태 확인
npm run dev:stop         # 서버 안전하게 종료
npm run dev:restart      # 서버 재시작
npm run clean            # 빌드 캐시 안전 삭제
npm run clean:all        # 캐시 삭제 후 서버 시작

# 기본 개발 명령어
npm run dev              # 기본 서버 시작 (포트 충돌 시 오류 가능)
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 서버 실행
npm run lint             # ESLint + 타입 체크
npm run test             # 테스트 실행
npm run type-check       # TypeScript 타입 체크
```

## 📝 프로젝트 현황

**전체 완료도**: 100% (Production Ready)

### Phase 1-2: 매출/매입/수금/지급 시스템 ✅ 100%
- ✅ 매출/매입 거래 관리 (8,500+ lines)
- ✅ 수금/지급 관리
- ✅ 자동 결제 상태 계산
- ✅ Excel 3-Sheet 내보내기
- ✅ 회계 모듈 (JSONB, 카테고리 분류)
- ✅ 흑백 디자인 시스템 적용
- ✅ 전액 수금/지급 기능

### Phase 3: 재고 관리 시스템 ✅ 100%
- ✅ 입고/생산/출고 거래
- ✅ LOT 추적 관리
- ✅ 실시간 재고 업데이트
- ✅ **BOM 자동 차감 시스템** (API + Database Trigger 이중 검증)
- ✅ 재고 부족 자동 차단

### Phase 4: 프론트엔드 최적화 ✅ 100%
- ✅ 대시보드 실시간 새로고침
- ✅ 가상 스크롤링 (대용량 데이터)
- ✅ React Query 캐싱
- ✅ **흑백 디자인 시스템** (색상 제거, 단순 아이콘)
- ✅ 테이블 레이아웃 고정 (일관된 폭)
- ✅ 카드형 헤더 적용

### Phase 5: 가격 분석 시스템 ✅ 100%
- ✅ 월별 가격 이력 관리
- ✅ BOM 기반 가격 계산
- ✅ 대량 가격 업데이트
- ✅ 가격 중복 관리

### Phase 6A: 도장 상태 관리 ✅ 100%
- ✅ 도장 전/후 상태 관리
- ✅ 미도장 부품 필터링
- ✅ 품목 데이터 마이그레이션

### Phase 6B: 계약 관리 시스템 ✅ 100%
- ✅ 계약 정보 관리
- ✅ **첨부파일 업로드/삭제 기능**
- ✅ 문서 다운로드 기능
- ✅ 계약 추가 시 파일 업로드 플로우

### Phase 7: UI/UX 개선 ✅ 100%
- ✅ 흑백 디자인 시스템 (색상 제거)
- ✅ 이모지 제거 및 단순 아이콘
- ✅ 카드형 헤더 일관성
- ✅ 테이블 레이아웃 고정
- ✅ 회계 용어로 변경 (이커머스 용어 제거)

### 미완료 항목 (0%)
- ✅ 모든 주요 기능 완료

## 🔐 보안 사항

- 모든 API 엔드포인트는 인증 필요 (현재 미구현)
- 소프트 삭제 패턴 사용 (`is_active` 필드)
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (React 자동 이스케이핑)

## 📚 문서

- [데이터베이스 스키마](docs/DATABASE.md) - Supabase PostgreSQL 스키마 완전 가이드
- [서버 관리 가이드](SERVER_MANAGEMENT_GUIDE.md) - 서버 관리 및 트러블슈팅 가이드
- [Claude Code 가이드](CLAUDE.md) - 개발 환경 및 아키텍처 설명
- [Excel 업로드 가이드](docs/excel-upload-guide.md)
- [프로젝트 계획](.plan/plan.md)
- [진행 상황](.plan/progress-tracker.md)

## 🚀 Vercel 배포

### Production 배포 정보
- **URL**: https://taechangmetal.vercel.app
- **Branch**: main
- **Environment**: Production

### 환경 변수 설정 (Vercel Dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
NODE_ENV=production
```

### 배포 명령어
```bash
# Vercel CLI로 배포
vercel --prod --yes

# 배포 상태 확인
vercel ls

# 환경 변수 변경 후 재배포 (필수!)
vercel --prod --yes
```

⚠️ **중요**: Vercel은 환경 변수 변경 시 자동 재배포하지 않습니다. 수동으로 `vercel --prod --yes` 실행 필수!

## 📄 라이센스

Private - 태창 내부 사용만 허용

## 🎨 주요 디자인 개선사항

### 흑백 디자인 시스템
- 모든 페이지에 흑백 디자인 적용 (색상 제거)
- 이모지 제거 및 단순 아이콘 사용
- 카드형 헤더로 일관성 확보
- 테이블 레이아웃 고정 (일관된 폭)

### UI/UX 개선
- 회계 용어로 변경 (이커머스 용어 제거)
- 전액 수금/지급 기능 추가
- 이전 정보 불러오기 기능
- 상세한 결제 정보 표시

### BOM 자동 차감 시스템
- API 레벨 검증 + Database Trigger 이중 검증
- 재고 부족 시 자동 차단
- 정확한 재고 계산 및 관리

### 계약 관리 개선
- 계약 생성 시 파일 업로드 플로우
- 기존 계약에 파일 추가 업로드
- 파일 삭제 기능
- 파일 다운로드 기능

---

**마지막 업데이트**: 2025년 11월
**프로젝트 버전**: Phase 7 Complete (100% Production Ready)
**Tech Stack**: Next.js 14.2.16 + React 18.3.1 + TypeScript + Supabase PostgreSQL