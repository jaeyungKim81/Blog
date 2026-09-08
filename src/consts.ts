// 사이트 전역 정보. 블로그 이름·소개를 바꿀 때는 이 파일만 고치면 된다.
export const SITE_TITLE = '좋은마음';
export const SITE_DESCRIPTION = '만들면서 막힌 지점과 그걸 푼 방법, 그리고 매주 주식 일정을 적습니다.';
export const AUTHOR = 'goodMind';

// 글 분류. 여기 순서가 목록 화면의 탭 순서가 된다.
// 새 분류를 늘릴 때는 이 배열에만 추가하면 필터 페이지까지 따라온다.
export const CATEGORIES = ['개발', '투자'] as const;
export type Category = (typeof CATEGORIES)[number];

// 분류를 적지 않은 글이 들어왔을 때 떨어질 자리
export const DEFAULT_CATEGORY: Category = '개발';

// 주식 일정 뉴스레터. 구독 안내는 frontmatter 에 newsletter: true 를
// 적은 글에만 붙는다. 분류('투자')로 묶었더니 신도시 현황처럼 주식과
// 무관한 투자 글에도 따라붙었다.
// 구독 폼 주소. stib.ee/UTyM 은 발송본의 웹 버전이라 눌러도
// 구독이 안 된다. 지난 호를 보여줄 때만 쓸 것.
export const NEWSLETTER_URL = 'https://page.stibee.com/subscriptions/511811';
