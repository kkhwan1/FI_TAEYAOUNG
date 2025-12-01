/**
 * 중량 관리 유틸리티 함수
 * 원소재(코일/시트) 입고 및 재고 관리용
 */

/**
 * kg → ton 변환
 */
export function kgToTon(kg: number): number {
  return kg / 1000;
}

/**
 * ton → kg 변환
 */
export function tonToKg(ton: number): number {
  return ton * 1000;
}

/**
 * 규격 문자열 생성 (두께 x 폭)
 * @param thickness 두께 (mm)
 * @param width 폭 (mm)
 * @returns "1.5 x 630" 형식
 */
export function formatSpec(thickness: number, width: number): string {
  return `${thickness} x ${width}`;
}

/**
 * 규격 문자열 파싱
 * @param spec "1.5 x 630" 형식
 * @returns { thickness, width } 또는 null
 */
export function parseSpec(spec: string): { thickness: number; width: number } | null {
  const match = spec.match(/^([\d.]+)\s*[xX×]\s*([\d.]+)$/);
  if (!match) return null;
  return {
    thickness: parseFloat(match[1]),
    width: parseFloat(match[2]),
  };
}

/**
 * 코일 중량 계산 (이론 중량)
 * @param thickness 두께 (mm)
 * @param width 폭 (mm)
 * @param length 길이 (mm)
 * @param specificGravity 비중 (기본값: 7.85 for steel)
 * @returns 중량 (kg)
 */
export function calculateCoilWeight(
  thickness: number,
  width: number,
  length: number,
  specificGravity: number = 7.85
): number {
  // 중량(kg) = 두께(mm) × 폭(mm) × 길이(mm) × 비중 / 1,000,000
  return (thickness * width * length * specificGravity) / 1000000;
}

/**
 * 중량 포맷팅 (천 단위 구분)
 * @param weight 중량
 * @param unit 단위 ('kg' | 'ton')
 * @returns "2,500 kg" 형식
 */
export function formatWeight(weight: number, unit: 'kg' | 'ton' = 'kg'): string {
  const formatted = weight.toLocaleString('ko-KR', {
    minimumFractionDigits: unit === 'ton' ? 3 : 0,
    maximumFractionDigits: unit === 'ton' ? 3 : 0,
  });
  return `${formatted} ${unit}`;
}

/**
 * 중량 단위 변환 (표시용)
 * 1000kg 이상이면 ton으로 표시
 */
export function autoFormatWeight(weightKg: number): string {
  if (weightKg >= 1000) {
    return formatWeight(kgToTon(weightKg), 'ton');
  }
  return formatWeight(weightKg, 'kg');
}

/**
 * 중량 입력값 정규화 (단위 통일)
 * @param weight 입력 중량
 * @param unit 입력 단위
 * @returns kg 단위로 변환된 중량
 */
export function normalizeWeightToKg(weight: number, unit: 'kg' | 'ton'): number {
  return unit === 'ton' ? tonToKg(weight) : weight;
}
