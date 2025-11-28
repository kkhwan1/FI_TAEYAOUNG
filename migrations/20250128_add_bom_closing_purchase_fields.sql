-- Migration: Add closing and purchase fields to BOM table
-- Date: 2025-01-28
-- Description: Add parent_closing_quantity, parent_closing_amount, child_purchase_quantity, child_purchase_amount columns to bom table

-- Add parent closing fields (모품목 마감수량, 마감금액)
ALTER TABLE bom
ADD COLUMN IF NOT EXISTS parent_closing_quantity NUMERIC(15, 2) NULL,
ADD COLUMN IF NOT EXISTS parent_closing_amount NUMERIC(15, 2) NULL;

-- Add child purchase fields (자품목 구매수량, 구매금액)
ALTER TABLE bom
ADD COLUMN IF NOT EXISTS child_purchase_quantity NUMERIC(15, 2) NULL,
ADD COLUMN IF NOT EXISTS child_purchase_amount NUMERIC(15, 2) NULL;

-- Add comments for documentation
COMMENT ON COLUMN bom.parent_closing_quantity IS '모품목 마감수량 (Excel F열)';
COMMENT ON COLUMN bom.parent_closing_amount IS '모품목 마감금액 (Excel G열)';
COMMENT ON COLUMN bom.child_purchase_quantity IS '자품목 구매수량 (Excel O열)';
COMMENT ON COLUMN bom.child_purchase_amount IS '자품목 구매금액 (Excel P열)';

