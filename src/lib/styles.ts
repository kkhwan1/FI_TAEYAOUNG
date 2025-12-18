/**
 * 공통 스타일 유틸리티
 * FITaeYoungERP UI 표준화를 위한 스타일 상수 정의
 */

// ============================================
// 버튼 스타일
// ============================================

export const buttonStyles = {
  // 기본 버튼 (Primary)
  primary: "bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed",

  // 보조 버튼 (Secondary)
  secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white",

  // 위험 버튼 (Danger)
  danger: "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors",

  // 성공 버튼 (Success)
  success: "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors",

  // 아웃라인 버튼
  outline: "border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg transition-colors dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-300",

  // 아이콘 버튼 (작은 크기)
  icon: "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",

  // 전체 너비 버튼
  fullWidth: "w-full",
} as const;

// 버튼 크기
export const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

// ============================================
// 폼 필드 스타일
// ============================================

export const formStyles = {
  // 입력 필드
  input: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-colors",

  // 선택 필드
  select: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-colors",

  // 텍스트 영역
  textarea: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-colors resize-none",

  // 레이블
  label: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1",

  // 필수 표시
  required: "text-red-500 ml-1",

  // 도움말 텍스트
  helpText: "text-sm text-gray-500 dark:text-gray-400 mt-1",

  // 에러 메시지
  error: "text-sm text-red-600 mt-1",

  // 에러 상태 입력 필드
  inputError: "w-full px-3 py-2 border border-red-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-800 dark:text-white",

  // 폼 그룹
  group: "space-y-1",

  // 폼 행 (2열 그리드)
  row: "grid grid-cols-1 md:grid-cols-2 gap-4",

  // 폼 행 (3열 그리드)
  row3: "grid grid-cols-1 md:grid-cols-3 gap-4",

  // 폼 행 (4열 그리드)
  row4: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
} as const;

// ============================================
// 카드/패널 스타일
// ============================================

export const cardStyles = {
  // 기본 카드
  base: "bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700",

  // 카드 패딩
  padding: "p-6",

  // 카드 헤더
  header: "border-b border-gray-200 dark:border-gray-700 pb-4 mb-4",

  // 카드 푸터
  footer: "border-t border-gray-200 dark:border-gray-700 pt-4 mt-4",

  // 정보 배너 (파란색)
  info: "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4",

  // 경고 배너 (노란색)
  warning: "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4",

  // 성공 배너 (녹색)
  success: "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4",

  // 오류 배너 (빨간색)
  error: "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4",

  // 중립 배너 (회색)
  neutral: "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4",
} as const;

// ============================================
// 테이블 스타일
// ============================================

export const tableStyles = {
  // 테이블 컨테이너
  container: "overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700",

  // 테이블
  table: "min-w-full divide-y divide-gray-200 dark:divide-gray-700",

  // 테이블 헤더
  thead: "bg-gray-100 dark:bg-gray-800",

  // 헤더 셀
  th: "px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300",

  // 테이블 바디
  tbody: "bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700",

  // 테이블 행
  tr: "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",

  // 선택된 행
  trSelected: "bg-blue-50 dark:bg-blue-900/30",

  // 테이블 셀
  td: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100",

  // 빈 상태
  empty: "px-4 py-8 text-center text-gray-500 dark:text-gray-400",
} as const;

// ============================================
// 레이아웃 스타일
// ============================================

export const layoutStyles = {
  // 페이지 컨테이너
  page: "p-6 space-y-6",

  // 섹션 간격
  section: "space-y-6",

  // 페이지 헤더
  pageHeader: "flex flex-col md:flex-row md:items-center md:justify-between gap-4",

  // 페이지 제목
  pageTitle: "text-2xl font-bold text-gray-900 dark:text-white",

  // 섹션 제목
  sectionTitle: "text-lg font-semibold text-gray-900 dark:text-white",

  // 그리드 레이아웃
  grid2: "grid grid-cols-1 md:grid-cols-2 gap-6",
  grid3: "grid grid-cols-1 md:grid-cols-3 gap-6",
  grid4: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",

  // Flex 레이아웃
  flexBetween: "flex items-center justify-between",
  flexCenter: "flex items-center justify-center",
  flexEnd: "flex items-center justify-end",
  flexGap: "flex items-center gap-4",
} as const;

// ============================================
// 탭 스타일
// ============================================

export const tabStyles = {
  // 탭 컨테이너
  container: "flex border-b border-gray-200 dark:border-gray-700",

  // 탭 버튼 (비활성)
  tab: "px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent transition-colors",

  // 탭 버튼 (활성)
  tabActive: "px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400",

  // 탭 패널
  panel: "pt-4",
} as const;

// ============================================
// 모달/다이얼로그 스타일
// ============================================

export const modalStyles = {
  // 오버레이
  overlay: "fixed inset-0 bg-black/50 flex items-center justify-center z-50",

  // 모달 컨테이너
  container: "bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden",

  // 모달 헤더
  header: "px-6 py-4 border-b border-gray-200 dark:border-gray-700",

  // 모달 제목
  title: "text-lg font-semibold text-gray-900 dark:text-white",

  // 모달 본문
  body: "px-6 py-4 overflow-y-auto",

  // 모달 푸터
  footer: "px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3",
} as const;

// ============================================
// 텍스트 스타일
// ============================================

export const textStyles = {
  // 제목
  h1: "text-3xl font-bold text-gray-900 dark:text-white",
  h2: "text-2xl font-bold text-gray-900 dark:text-white",
  h3: "text-xl font-semibold text-gray-900 dark:text-white",
  h4: "text-lg font-semibold text-gray-900 dark:text-white",

  // 본문
  body: "text-base text-gray-700 dark:text-gray-300",
  small: "text-sm text-gray-600 dark:text-gray-400",

  // 강조
  muted: "text-gray-500 dark:text-gray-400",

  // 상태 텍스트
  success: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
} as const;

// ============================================
// 배지/태그 스타일
// ============================================

export const badgeStyles = {
  // 기본 배지
  base: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",

  // 색상 변형
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
} as const;

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 여러 클래스를 조합하는 유틸리티 함수
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * 조건부 클래스 적용
 */
export function conditionalClass(
  condition: boolean,
  trueClass: string,
  falseClass: string = ''
): string {
  return condition ? trueClass : falseClass;
}
