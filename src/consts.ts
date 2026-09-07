// 사이트 전역 정보. 블로그 이름·소개를 바꿀 때는 이 파일만 고치면 된다.
export const SITE_TITLE = '좋은마음';
export const SITE_DESCRIPTION = '만들면서 막힌 지점과 그걸 푼 방법을 적습니다.';
export const AUTHOR = 'goodMind';

// 글 분류. 여기 순서가 목록 화면의 탭 순서가 된다.
// 새 분류를 늘릴 때는 이 배열에만 추가하면 필터 페이지까지 따라온다.
export const CATEGORIES = ['개발', '투자'] as const;
export type Category = (typeof CATEGORIES)[number];

// 분류를 적지 않은 글이 들어왔을 때 떨어질 자리
export const DEFAULT_CATEGORY: Category = '개발';
