📋 상세 구현 계획 (DB → Backend → Frontend)
코드 작성 전에 전체 아키텍처를 명확히 정리하겠습니다.

1️⃣ 데이터베이스 설계
1.1 현재 상태 확인
-- 현재 users 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  display_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
-- 현재 advertisers 테이블
CREATE TABLE advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  category TEXT,
  advertiser_name TEXT,
  ... 기타 필드
)

1.2 필요한 변경사항
users 테이블 추가 컬럼
// shared/schema.ts
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull(), // "admin" | "staff" | "advertiser"
  display_name: varchar("display_name"),
  phone: varchar("phone"), // ★ 신규 (nullable)
  advertiser_id: varchar("advertiser_id"), // ★ 신규 (nullable, FK to advertisers)
  is_active: boolean("is_active").default(true),
  last_login_at: timestamp("last_login_at"), // ★ 신규
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
// Foreign Key: advertiser_id → advertisers.id
// Constraint: advertiser_id는 role='advertiser'인 경우에만 사용

advertisers 테이블 추가 컬럼
export const advertisers = pgTable("advertisers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").references(() => users.id), // 기존: 광고주 소유자
  assigned_to: varchar("assigned_to").references(() => users.id), // ★ 신규: 담당 영업자
  assigned_at: timestamp("assigned_at"), // ★ 신규: 할당 시간
  display_number: text("display_number"),
  category: text("category"), // "place" | "shopping"
  advertiser_name: text("advertiser_name"),
  advertiser_group: text("advertiser_group"),
  url: text("url"),
  place_id: text("place_id"),
  thumbnail_url: text("thumbnail_url"),
  place_keywords: text("place_keywords").array(),
  shopping_keywords: text("shopping_keywords").array(),
  plus_rank: text("plus_rank"),
  contract_period: integer("contract_period"),
  start_date: timestamp("start_date"),
  end_date: timestamp("end_date"),
  notes: text("notes"),
  is_active: boolean("is_active").default(true), // ★ 신규
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

1.3 DB 마이그레이션 전략
# 1단계: shared/schema.ts에 컬럼 추가
# 2단계: npm run db:push로 자동 마이그레이션
# 3단계: 실패 시 npm run db:push --force

2️⃣ Backend API 설계
2.1 Storage 인터페이스 (server/storage.ts)
interface IStorage {
  // ★ 신규 메서드 추가
  
  // 영업자별 광고주 조회
  getAdvertisersByAssignedTo(staffId: string): Promise<Advertiser[]>;
  
  // 미배정 광고주 조회
  getUnassignedAdvertisers(): Promise<Advertiser[]>;
  
  // 광고주 배정 (일괄)
  bulkAssignAdvertisers(advertiserIds: string[], staffId: string | null): Promise<void>;
  
  // 영업자 목록 (배정용)
  getStaffList(): Promise<User[]>;
  
  // 광고주의 담당자 정보 조회
  getManagerByAdvertiserId(advertiserId: string): Promise<User | null>;
  
  // 영업자별 통계
  getStaffSummary(): Promise<Array<{
    staffId: string;
    displayName: string | null;
    email: string;
    phone: string | null;
    placeCount: number;
    shoppingCount: number;
    expiringCount: number;
    totalCount: number;
  }>>;
  
  // 사용자가 관리하는 광고주 (권한 필터링)
  getAdvertisersByUserId(userId: string): Promise<Advertiser[]>;
}

2.2 API 엔드포인트 (server/routes.ts)
신규 API 4개
메서드	URL	권한	설명
GET	/api/staff	Admin	영업자 목록
GET	/api/staff/summary	Admin	영업자별 통계 (이미 구현)
GET	/api/advertisers/unassigned	Admin	미배정 광고주
POST	/api/advertisers/assign	Admin	광고주 일괄 배정
GET	/api/my/manager	Advertiser	내 담당자 정보
기존 API 수정 (권한 필터링)
// GET /api/advertisers
// - Admin: 전체 광고주 반환
// - Staff: 자신이 할당받은 광고주만 (assigned_to = userId)
// - Advertiser: 자신의 광고주만 (user_id = userId)
app.get('/api/advertisers', requireAuth, async (req, res) => {
  const user = req.user as any;
  
  if (user.role === 'admin') {
    // 전체
  } else if (user.role === 'staff') {
    // assigned_to = user.id
  } else if (user.role === 'advertiser') {
    // user_id = user.id
  }
});
// 마찬가지로 /api/keywords, /api/ranking-history 등도 필터링

3️⃣ Frontend 페이지/컴포넌트 설계
3.1 라우팅 맵
// client/src/App.tsx
<Router>
  {!isLoggedIn ? (
    <Route path="/login" component={Login} />
  ) : user.role === 'advertiser' ? (
    <>
      <Route path="/my-dashboard" component={AdvertiserDashboard} />
      <Route path="*" component={NotFound} />
    </>
  ) : (
    <>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/place" component={PlacePage} />
      <Route path="/shopping" component={ShoppingPage} />
      
      {user.role === 'admin' && (
        <>
          <Route path="/keywords" component={KeywordsPage} />
          <Route path="/users" component={Users} />
          <Route path="/assignment" component={AssignmentPage} /> ★ 신규
        </>
      )}
      
      <Route path="*" component={NotFound} />
    </>
  )}
</Router>

3.2 사이드바 구조
// client/src/components/app-sidebar.tsx
const sidebarItems = user.role === 'admin' 
  ? [
      { label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
      { label: '플레이스', icon: MapPin, path: '/place' },
      { label: '쇼핑', icon: ShoppingBag, path: '/shopping' },
      { label: '키워드 관리', icon: Key, path: '/keywords' },
      { separator: true },
      { label: '사용자 관리', icon: Users, path: '/users' },
      { 
        label: '광고주 배정', 
        icon: Layers, 
        path: '/assignment',
        badge: unassignedCount // ★ 미배정 수 표시
      },
    ]
  : user.role === 'staff'
  ? [
      { label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
      { label: '플레이스', icon: MapPin, path: '/place' },
      { label: '쇼핑', icon: ShoppingBag, path: '/shopping' },
    ]
  : [
      { label: '내 현황', icon: LayoutDashboard, path: '/my-dashboard' },
    ];

3.3 페이지별 상세 설계
4️⃣ 페이지 상세 설계
A. 관리자 대시보드 (/dashboard)
┌─────────────────────────────────────────────────┐
│ 대시보드          [필터: 플레이스 ▼] [30일 ▼]   │
├─────────────────────────────────────────────────┤
📊 상태별 카드 (5개)
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ 전체 │ │ 진행 │ │ 만료 │ │ 만료 │ │ 신규 │
│ 45   │ │ 38   │ │ 5🔴  │ │ 2    │ │ 3    │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
📌 영업자별 현황 카드 (클릭 가능)
┌──────────────────────────────────┐
│ 👤 김영업 (담당)                  │
│ • 광고주 12개                     │
│ • 진행중 10개 | 만료 2개          │
│ • TOP3: 8개                       │
│ ✏️ 클릭 → 이 영업자의 광고주 목록│
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ 👤 박영업 (담당)                  │
│ • 광고주 8개                      │
│ • 진행중 8개 | 만료 0개           │
│ • TOP3: 5개                       │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ ⚠️ 미배정                         │
│ • 광고주 3개                      │
│ 클릭 → /assignment 페이지로 이동  │
└──────────────────────────────────┘
📊 광고주 목록 테이블
┌─────────────────────────────────────────┐
│ # │ 광고주  │ 카테고리 │ 담당자 │ 상태  │ 종료 │
├─────────────────────────────────────────┤
│ 1 │ 메이커스│ 플레이스 │ 김영업│ 진행  │ 12/15│
│ 2 │ 벨로아  │ 쇼핑     │ 미배정│ 만료🔴│ 11/29│
└─────────────────────────────────────────┘

Query:

// 1. 전체 광고주 수
const total = await storage.getAllAdvertisers();
// 2. 상태별 필터링 (계약기간 기준)
const active = total.filter(a => isActive(a));
const expiring = total.filter(a => isExpiring(a)); // 3일 이내
// 3. 영업자별 통계
const staffSummary = await storage.getStaffSummary();
// 결과: { staffId, displayName, phone, placeCount, shoppingCount, expiringCount, totalCount }
// 4. 미배정 수
const unassigned = await storage.getUnassignedAdvertisers();

B. 광고주 배정 페이지 (/assignment)
┌─────────────────────────────────────────┐
│ 광고주 배정 관리                         │
├─────────────────────────────────────────┤
[🔍 미배정만] [담당자: 전체 ▼] [검색...]
┌──────────────────────────────────────────┐
│ ☐ │광고주│카테고리│담당자      │상태    │
├──────────────────────────────────────────┤
│ ☑ │메이커│플레이스│[김영업 ▼]  │진행    │
│ ☑ │벨로아│쇼핑   │[미배정 ▼]  │만료🔴  │
│ ☐ │아이백│쇼핑   │[박영업 ▼]  │진행    │
└──────────────────────────────────────────┘
선택: 2개
┌─────────────────────────────────────────┐
│ 영업자 정보 (선택된 항목의 담당자)       │
│ 👤 김영업 (배정 대상)                    │
│ 📞 010-1234-5678                        │
│ ✉️ kim@example.com                      │
│ 현재 관리: 12개 | 만료임박: 2개         │
└─────────────────────────────────────────┘
[일괄 배정: 김영업 ▼] [취소] [확인]

상호작용:

테이블에서 광고주 선택 (checkbox)
각 행의 "담당자" 드롭다운으로 개별 변경 가능
드롭다운 선택 → 아래 "영업자 정보" 업데이트
"일괄 배정" 클릭 → POST /api/advertisers/assign 호출
Query:

// 1. 광고주 목록 (미배정 필터 옵션)
const advertisers = await storage.getUnassignedAdvertisers();
// 2. 영업자 목록 (드롭다운)
const staffList = await storage.getStaffList();
// 3. 배정 시
await storage.bulkAssignAdvertisers(selectedIds, selectedStaffId);

C. 영업자 대시보드 (/dashboard - staff용)
┌─────────────────────────────────────────┐
│ 대시보드    [광고주 필터: 전체 ▼] 🔄     │
├─────────────────────────────────────────┤
📊 내 담당 (4개)
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ 전체 │ │ 진행 │ │ 만료 │ │ TOP3 │
│ 12   │ │ 10   │ │ 2🔴  │ │ 8    │
└──────┘ └──────┘ └──────┘ └──────┘
🎯 광고주 필터 (드릴다운)
[메이커스 ▼]
  └─ 클릭 시: 해당 광고주의 키워드만 표시
📊 키워드 순위 테이블
┌─────────────────────────────────────┐
│ 키워드  │ 순위 │ 전일 │ 최고 │ 상태 │
├─────────────────────────────────────┤
│ 가방    │ 3위 │ ▲2  │ 2위 │ 👍   │
│ 백팩    │ 7위 │ ▼1  │ 5위 │ 😐   │
└─────────────────────────────────────┘

로직:

// 1. 내 담당 광고주 조회
const myAdvertisers = await storage.getAdvertisersByAssignedTo(userId);
// 2. 선택한 광고주의 키워드 필터링
const selectedAdvertiserId = state.selectedAdvertiser;
const keywords = await storage.getKeywordsByAdvertiserId(selectedAdvertiserId);
// 3. 각 키워드의 순위 이력
const rankings = await storage.getRankingHistory(keywordId);

D. 광고주 전용 대시보드 (/my-dashboard)
┌─────────────────────────────────────┐
│ 내 현황                              │
├─────────────────────────────────────┤
┌──────────────┐  ┌──────────────┐
│ 담당자 정보  │  │ 계약 정보    │
├──────────────┤  ├──────────────┤
│ 👤 김영업    │  │ 시작: 11/01  │
│ 📞 010-1234  │  │ 종료: 12/01  │
│ ✉️ kim@...  │  │ D-5 🔴        │
└──────────────┘  └──────────────┘
📈 7일 순위 변화 그래프
  순위
   1  ─┬────────────────
   3  ─┼────●──●──●
   5  ─┼─────────────
  10  ─┼─────────────
      └─ 11/20 11/21 ... 11/26
🛒 내 상품 순위
┌────────────────────────────┐
│ 상품  │ 순위 │ 전일 │ 최고 │
├────────────────────────────┤
│ 가죽백│ 3위 │ ▲2  │ 2위  │
│ 캔버스│ 7위 │ ▼1  │ 5위  │
└────────────────────────────┘

Query:

// 1. 내 광고주
const myAdvertiser = await storage.getAdvertiserByUserId(userId);
// 2. 내 담당자 정보
const manager = await storage.getManagerByAdvertiserId(myAdvertiser.id);
// 3. 7일 순위 그래프
const rankings = await storage.getRankingHistory(keywordId, { days: 7 });
// 4. 현재 상품 순위
const shoppingRankings = await storage.getShoppingRankingHistory(keywordId);

5️⃣ 컴포넌트/함수 설계
Backend 구현 파일
server/
├── storage.ts          ← 신규 메서드 7개 추가
├── routes.ts           ← API 엔드포인트 4개 추가 + 권한 필터링
└── auth.ts             ← 기존 (수정 불필요)

Frontend 구현 파일
client/src/
├── pages/
│   ├── Dashboard.tsx         ← 수정 (영업자별 현황 + 드릴다운)
│   ├── PlacePage.tsx         ← 수정 (권한 필터링)
│   ├── ShoppingPage.tsx      ← 수정 (권한 필터링)
│   ├── AdvertiserDashboard.tsx  ← ★ 신규
│   └── AssignmentPage.tsx    ← ★ 신규
│
├── components/
│   ├── app-sidebar.tsx       ← 수정 (역할별 메뉴)
│   └── ui-custom/
│       ├── StaffSummaryCard.tsx  ← ★ 신규
│       └── AssignmentTable.tsx   ← ★ 신규

6️⃣ 데이터 흐름 예시
시나리오: 광고주 배정
1️⃣ Admin이 /assignment 페이지 방문
   ↓ GET /api/advertisers/unassigned
   ↓ 미배정 광고주 목록 + 영업자 드롭다운 로드
   
2️⃣ Admin이 광고주 선택 + 영업자 선택
   ↓ POST /api/advertisers/assign
   ↓ { advertiserIds: [...], assignedTo: 'staff-id' }
   
3️⃣ Backend에서:
   ↓ bulkAssignAdvertisers() 호출
   ↓ advertisers 테이블 assigned_to 업데이트
   ↓ Response: { success: true, updated: 2 }
   
4️⃣ Frontend:
   ↓ React Query cache invalidation
   ↓ Dashboard의 미배정 배지 업데이트
   ↓ 사이드바 배지 갱신

7️⃣ 체크리스트
 DB: users, advertisers 테이블 컬럼 추가
 Storage: 신규 메서드 7개 구현
 Routes: API 4개 추가 + 권한 필터링
 Pages: 신규 2개 페이지 + 기존 3개 수정
 Components: 신규 2개 + 사이드바 수정
 Testing: 각 역할별 동작 확인
✅ 이 계획으로 진행할까요?
확인 사항:

DB 컬럼 추가 → migration 필요 (phone, advertiser_id, assigned_to 등)
API 4개 신규 + 기존 API 권한 필터링
페이지 2개 신규 + 컴포넌트 개선
승인하시면:
→ Build 모드로 코드 작성 시작
→ 순서대로: DB → Storage → Routes → Frontend

수정 사항 있으신가요? 🎯

just now
Add detailed plan for campaign management dashboard developm