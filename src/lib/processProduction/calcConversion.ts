/**
 * 공정별 생산등록 - 중량/수량 환산 로직
 * 코일(kg) ↔ 블랭크(EA) 변환
 */

export interface ConversionParams {
  kgPerBlank: number;    // BOM의 quantity_required (블랭크 1개당 필요 kg)
  yieldRate?: number;    // 수율 (기본값 100%)
}

export interface ConversionResult {
  kgPerBlank: number;
  yieldRate: number;
  possibleEa?: number;   // 투입 kg 기준 가능 산출 EA
  requiredKg?: number;   // 산출 EA 기준 필요 kg
  formula: string;
}

/**
 * 투입 코일 중량(kg) → 가능 산출 블랭크 수량(EA) 계산
 */
export function calculatePossibleEa(
  inputKg: number,
  params: ConversionParams
): ConversionResult {
  const { kgPerBlank, yieldRate = 100 } = params;

  if (kgPerBlank <= 0) {
    throw new Error('kg/EA 값이 0보다 커야 합니다');
  }

  const yieldFactor = yieldRate / 100;
  const possibleEa = Math.floor((inputKg * yieldFactor) / kgPerBlank);

  return {
    kgPerBlank,
    yieldRate,
    possibleEa,
    formula: `floor((${inputKg} × ${yieldRate}%) ÷ ${kgPerBlank}) = ${possibleEa} EA`
  };
}

/**
 * 목표 산출 블랭크 수량(EA) → 필요 코일 중량(kg) 계산
 */
export function calculateRequiredKg(
  outputEa: number,
  params: ConversionParams
): ConversionResult {
  const { kgPerBlank, yieldRate = 100 } = params;

  if (kgPerBlank <= 0) {
    throw new Error('kg/EA 값이 0보다 커야 합니다');
  }

  const yieldFactor = yieldRate / 100;
  const requiredKg = (outputEa * kgPerBlank) / yieldFactor;

  return {
    kgPerBlank,
    yieldRate,
    requiredKg: Math.round(requiredKg * 100) / 100, // 소수점 2자리
    formula: `(${outputEa} × ${kgPerBlank}) ÷ ${yieldRate}% = ${requiredKg.toFixed(2)} kg`
  };
}

/**
 * 수율(효율) 계산
 */
export function calculateEfficiency(
  inputQuantity: number,
  outputQuantity: number,
  kgPerBlank?: number
): number {
  if (inputQuantity <= 0) return 0;

  // kg → EA 변환이 필요한 경우 (블랭킹)
  if (kgPerBlank && kgPerBlank > 0) {
    const theoreticalOutput = inputQuantity / kgPerBlank;
    return Math.round((outputQuantity / theoreticalOutput) * 10000) / 100;
  }

  // 같은 단위인 경우 (프레스, 용접)
  return Math.round((outputQuantity / inputQuantity) * 10000) / 100;
}

/**
 * 스크랩율 계산
 */
export function calculateScrapRate(
  outputQuantity: number,
  scrapQuantity: number
): number {
  if (outputQuantity <= 0) return 0;
  return Math.round((scrapQuantity / outputQuantity) * 10000) / 100;
}

/**
 * 공정 타입별 기본 설정
 */
export const PROCESS_DEFAULTS = {
  BLANKING: {
    inputUnit: 'kg',
    outputUnit: 'EA',
    requiresConversion: true,
    defaultYieldRate: 95
  },
  PRESS: {
    inputUnit: 'EA',
    outputUnit: 'EA',
    requiresConversion: false,
    defaultYieldRate: 98
  },
  WELD: {
    inputUnit: 'EA',
    outputUnit: 'EA',
    requiresConversion: false,
    defaultYieldRate: 99
  },
  PAINT: {
    inputUnit: 'EA',
    outputUnit: 'EA',
    requiresConversion: false,
    defaultYieldRate: 99
  }
} as const;

export type ProcessType = keyof typeof PROCESS_DEFAULTS;
