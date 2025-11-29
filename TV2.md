 놓친 부분 체크리스트
좋은 질문입니다! 재검토 결과 몇 가지 중요한 부분이 빠져있습니다:

🚨 Critical (반드시 필요)
1. Backend 권한 미들웨어
// server/auth.ts에 추가 필요
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: '관리자만 접근 가능합니다' });
  }
  next();
};
const requireStaff = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ message: '접근 권한이 없습니다' });
  }
  next();
};
// API에서 사용
app.get('/api/advertisers/unassigned', requireAuth, requireAdmin, (req, res) => { ... });

2. Frontend 라우트 보호
// client/src/App.tsx
// AdminRoute, StaffRoute, AdvertiserRoute HOC 필요
<Route path="/assignment" component={
  <AdminRoute component={AssignmentPage} />
} />

3. 모든 API에서 권한별 필터링
현재 문제: GET /api/keywords에서 필터링이 설계만 되어있고 실제 구현 안 됨
필요: GET /api/ranking-history, GET /api/shopping-ranking-history 등도 필터링

⚠️ Important (구현 검토)
4. 모달/폼의 기본값 처리
// 광고주 수정 시 기존 담당자 값 미리 로드
const [selectedStaff, setSelectedStaff] = useState(advertiser.assignedTo);

5. 페이지 로딩 상태
// 각 페이지에서 isLoading 표시
if (isLoading) return <Skeleton />;

6. 토스트 알림
// 배정 성공 시
toast.success(`${count}개 광고주 배정 완료`);

7. 페이지네이션/무한스크롤
광고주 목록이 많을 때 (100+ 개)
현재는 전체 로드 → 최적화 필요

💡 Nice-to-Have (선택)
8. 대시보드 통계 캐싱
영업자별 현황 계산이 반복되면 성능 저하
Redis 캐싱 또는 DB 뷰 고려
9. 배치 작업 실행 기록
누가 언제 배정했는지 기록 필요
assignedBy, assignedAt 필드 추가
10. Soft Delete 처리
삭제 시 is_active = false로만 처리
모든 쿼리에서 WHERE is_active = true 필터 필요
11. 담당자 연락처 표시
광고주 배정 페이지에서:
- 드롭다운 선택 시 담당자 연락처 미리보기
- "현재 담당: 12개, 만료임박: 2개" 표시

12. 검색/필터
Assignment 페이지:
- 광고주명 검색
- 카테고리 필터
- 상태 필터
- 담당자 필터

🔴 Data Integrity Issue
13. Null 값 처리
// advertiserId가 null인 staff 계정도 생성 가능하도록
// 근데 직원이 "광고주"로 로그인 시 advertiserId가 null이면 대시보드 렌더링 안 됨
→ 에러 페이지 또는 진행 불가 메시지 필요

14. 미배정 광고주 상태
// 광고주가 미배정 상태에서 순위 수집 시?
// 누구의 순위로 기록할 것인가?
→ Admin만 순위 수집 가능하게 제한 필요

📋 최종 체크리스트
항목	중요도	상태
권한 미들웨어 (requireAdmin/Staff)	🔴 Critical	❌
라우트 보호 (Frontend)	🔴 Critical	❌
API 필터링 완전 구현	🔴 Critical	❌
폼 기본값 처리	🟡 Important	❌
로딩 상태 UI	🟡 Important	❌
토스트 알림	🟡 Important	❌
페이지네이션	🟡 Important	⚠️ 나중에
담당자 연락처 미리보기	🟢 Nice	❌
검색/필터 기능	🟢 Nice	⚠️ Phase 2
Soft Delete 필터링	🟡 Important	❌
Null 값 에러 처리	🟡 Important	❌
✅ 최종 결정
지금 반드시 구현해야 할 것 (3가지):

✅ Backend 권한 미들웨어 (requireAdmin, requireStaff)
✅ Frontend 라우트 보호 (AdminRoute, AdvertiserRoute)
✅ API 권한 필터링 완성 (모든 GET API에서 role별 필터)
이 3가지 다음에 구현해도 됨:

폼 기본값, 토스트, 페이지네이션, 검색
🚀 이제 코드 작성 시작할까요?
순서:

DB 스키마 + 마이그레이션 ✓
Storage 메서드 + API ✓
권한 미들웨어 ← 먼저 이것
라우트 보호 ← 그 다음
페이지/컴포넌트
시작해도 될까요? 🎯

just now