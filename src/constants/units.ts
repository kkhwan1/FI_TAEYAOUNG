/**
 * Unit Constants
 * Shared unit options for item management
 */

export const UNIT_OPTIONS = ['EA', 'SET', 'KG', 'M', 'L', 'BOX', 'MM', 'CM', 'EV'] as const;

export type Unit = typeof UNIT_OPTIONS[number];

export const UNIT_LABELS: Record<Unit, string> = {
  EA: 'EA',
  SET: 'SET',
  KG: 'KG',
  M: 'M',
  L: 'L',
  BOX: 'BOX',
  MM: 'MM',
  CM: 'CM',
  EV: 'EV',
};
