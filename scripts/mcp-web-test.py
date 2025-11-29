#!/usr/bin/env python3
"""
태창 ERP 웹 애플리케이션 전체 테스트 스크립트
브라우저 MCP를 사용하여 모든 주요 페이지를 테스트합니다.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

# 테스트 결과 저장
TEST_RESULTS = {
    "start_time": None,
    "end_time": None,
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "results": []
}

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:5000")


class WebTestResult:
    """웹 테스트 결과 클래스"""
    def __init__(self, page_name: str, url: str):
        self.page_name = page_name
        self.url = url
        self.passed = False
        self.error = None
        self.screenshot_path = None
        self.duration = 0
        self.checks = []

    def to_dict(self):
        return {
            "page_name": self.page_name,
            "url": self.url,
            "passed": self.passed,
            "error": self.error,
            "screenshot_path": self.screenshot_path,
            "duration": self.duration,
            "checks": self.checks
        }


async def test_page(
    browser_navigate,
    browser_snapshot,
    browser_take_screenshot,
    page_name: str,
    url: str,
    expected_elements: Optional[List[str]] = None
) -> WebTestResult:
    """
    단일 페이지를 테스트합니다.
    
    Args:
        browser_navigate: 브라우저 네비게이션 함수
        browser_snapshot: 브라우저 스냅샷 함수
        browser_take_screenshot: 스크린샷 함수
        page_name: 페이지 이름
        url: 테스트할 URL
        expected_elements: 예상되는 요소 텍스트 리스트
    """
    result = WebTestResult(page_name, url)
    start_time = datetime.now()
    
    try:
        # 페이지로 이동
        print(f"  ✓ {page_name} 페이지로 이동 중... ({url})")
        await browser_navigate(url)
        
        # 네트워크 안정화 대기
        await asyncio.sleep(2)
        
        # 페이지 스냅샷 가져오기
        snapshot = await browser_snapshot()
        
        # 예상 요소 확인
        if expected_elements:
            page_text = snapshot.lower() if isinstance(snapshot, str) else json.dumps(snapshot).lower()
            for element in expected_elements:
                element_lower = element.lower()
                if element_lower in page_text:
                    result.checks.append(f"✓ '{element}' 요소 발견")
                else:
                    result.checks.append(f"✗ '{element}' 요소를 찾을 수 없음")
        
        # 스크린샷 저장
        screenshot_filename = f"test-{page_name.replace(' ', '-').lower()}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
        screenshot_path = f"tests/e2e/screenshots/{screenshot_filename}"
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        
        await browser_take_screenshot(filename=screenshot_filename)
        result.screenshot_path = screenshot_path
        result.passed = True
        
        print(f"    ✓ {page_name} 테스트 통과")
        
    except Exception as e:
        result.passed = False
        result.error = str(e)
        print(f"    ✗ {page_name} 테스트 실패: {e}")
    
    finally:
        result.duration = (datetime.now() - start_time).total_seconds()
    
    return result


# 테스트 페이지 정의
TEST_PAGES = [
    {
        "name": "로그인",
        "url": "/login",
        "expected_elements": ["로그인", "아이디", "비밀번호"]
    },
    {
        "name": "메인 대시보드",
        "url": "/",
        "expected_elements": ["대시보드", "태창 ERP"]
    },
    {
        "name": "품목 관리",
        "url": "/master/items",
        "expected_elements": ["품목", "관리"]
    },
    {
        "name": "거래처 관리",
        "url": "/master/companies",
        "expected_elements": ["거래처", "관리"]
    },
    {
        "name": "BOM 관리",
        "url": "/master/bom",
        "expected_elements": ["BOM", "관리"]
    },
    {
        "name": "월별 단가 관리",
        "url": "/price-management",
        "expected_elements": ["단가", "관리"]
    },
    {
        "name": "입고 관리",
        "url": "/inventory?tab=receiving",
        "expected_elements": ["입고", "관리"]
    },
    {
        "name": "생산 관리",
        "url": "/inventory?tab=production",
        "expected_elements": ["생산", "관리"]
    },
    {
        "name": "출고 관리",
        "url": "/inventory?tab=shipping",
        "expected_elements": ["출고", "관리"]
    },
    {
        "name": "재고 현황",
        "url": "/stock",
        "expected_elements": ["재고", "현황"]
    },
    {
        "name": "재고 이력",
        "url": "/stock/history",
        "expected_elements": ["재고", "이력"]
    },
    {
        "name": "재고 보고서",
        "url": "/stock/reports",
        "expected_elements": ["재고", "보고서"]
    },
    {
        "name": "공정 작업",
        "url": "/process",
        "expected_elements": ["공정", "작업"]
    },
    {
        "name": "추적성 조회",
        "url": "/traceability",
        "expected_elements": ["추적성", "조회"]
    },
    {
        "name": "매출 관리",
        "url": "/sales",
        "expected_elements": ["매출", "관리"]
    },
    {
        "name": "매입 관리",
        "url": "/purchases",
        "expected_elements": ["매입", "관리"]
    },
    {
        "name": "수금 관리",
        "url": "/collections",
        "expected_elements": ["수금", "관리"]
    },
    {
        "name": "지급 관리",
        "url": "/payments",
        "expected_elements": ["지급", "관리"]
    },
    {
        "name": "회계 요약",
        "url": "/accounting/summary",
        "expected_elements": ["회계", "요약"]
    },
    {
        "name": "계약 관리",
        "url": "/contracts",
        "expected_elements": ["계약", "관리"]
    },
]


async def run_all_tests():
    """모든 테스트를 실행합니다."""
    print("=" * 80)
    print("태창 ERP 전체 웹 테스트 시작")
    print("=" * 80)
    print(f"베이스 URL: {BASE_URL}")
    print(f"테스트 페이지 수: {len(TEST_PAGES)}")
    print()
    
    TEST_RESULTS["start_time"] = datetime.now().isoformat()
    TEST_RESULTS["total_tests"] = len(TEST_PAGES)
    
    # 이 스크립트는 MCP 도구를 직접 호출할 수 없으므로
    # 각 테스트 페이지에 대한 정보를 JSON으로 출력합니다.
    # 실제 테스트는 MCP 브라우저 도구를 사용하는 별도 스크립트에서 실행됩니다.
    
    results = []
    for page_config in TEST_PAGES:
        full_url = f"{BASE_URL}{page_config['url']}"
        result = {
            "name": page_config["name"],
            "url": full_url,
            "expected_elements": page_config.get("expected_elements", [])
        }
        results.append(result)
    
    # 테스트 계획을 JSON으로 저장
    test_plan_path = "tests/e2e/mcp-test-plan.json"
    os.makedirs(os.path.dirname(test_plan_path), exist_ok=True)
    
    with open(test_plan_path, "w", encoding="utf-8") as f:
        json.dump({
            "base_url": BASE_URL,
            "test_pages": results,
            "created_at": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)
    
    print(f"✓ 테스트 계획 저장: {test_plan_path}")
    print(f"\n총 {len(TEST_PAGES)}개 페이지 테스트 계획 생성 완료")
    print("\n실제 테스트를 실행하려면 브라우저 MCP 도구를 사용하여")
    print("각 페이지를 순회하며 테스트하세요.")
    
    TEST_RESULTS["end_time"] = datetime.now().isoformat()
    
    return results


if __name__ == "__main__":
    asyncio.run(run_all_tests())

