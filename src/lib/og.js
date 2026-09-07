/**
 * 공유 미리보기(OG) 이미지 생성.
 *
 * 카카오톡·슬랙 등에 링크를 붙이면 여기서 만든 그림이 뜬다. 예전에는 템플릿 기본
 * 그림 하나를 모든 글이 공유해서, 어느 글을 붙여도 미리보기가 똑같았다.
 *
 * satori 로 글자를 배치해 SVG 를 만들고(글자가 path 로 변환된다) sharp 로 PNG 로 바꾼다.
 * 이 방식이면 빌드 서버에 한글 폰트가 깔려 있지 않아도 된다 — 폰트를 직접 넘기기 때문이다.
 * 폰트는 Noto Sans KR(OFL)을 고정 두께로 만들고 쓰는 글자 범위만 남겨 2.3MB 로 줄인 것.
 */
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'
import { SITE_TITLE } from '../consts.ts'

const FONT = fs.readFileSync(path.resolve('./src/assets/fonts/NotoSansKR-subset.ttf'))

const W = 1200
const H = 630
const INK = '#111827'
const DIM = '#6b7280'
const LINE = '#e5e7eb'
const ACCENT = { 개발: '#2563eb', 투자: '#059669' }

const text = (content, style) => ({ type: 'div', props: { style, children: content } })

export async function ogImage({ title, category, date, sub }) {
  const accent = ACCENT[category] || ACCENT['개발']
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: W, height: H, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#ffffff',
          padding: '64px 72px', fontFamily: 'Noto',
          // 왼쪽 세로 띠로 분류를 구분한다. 글자를 읽지 않아도 개발/투자가 갈린다.
          borderLeft: `16px solid ${accent}`,
        },
        children: [
          text(category || '', { fontSize: 30, color: accent, letterSpacing: '0.02em' }),
          // 제목이 길면 글자를 줄인다. 그래도 넘치면 잘린다 — 그만큼 길면 미리보기에서 다 못 읽는다.
          text(title, {
            fontSize: title.length > 34 ? 54 : 66,
            color: INK, lineHeight: 1.3, letterSpacing: '-0.02em',
            // 한글은 기본적으로 단어 중간에서 끊긴다('팝 / 업이'). 띄어쓰기에서만 끊기게 한다.
            wordBreak: 'keep-all',
            display: 'block', overflow: 'hidden', maxHeight: 330,
          }),
          sub
            ? text(sub, { fontSize: 32, color: DIM, lineHeight: 1.5, wordBreak: 'keep-all' })
            // 날짜가 없으면(사이트 공통 카드) 아래 줄을 쓰지 않는다 — 제목과 같은 말이 두 번 나온다.
            : {
                type: 'div',
                props: {
                  style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                           borderTop: `2px solid ${LINE}`, paddingTop: 28, fontSize: 30, color: DIM },
                  children: [text(SITE_TITLE, { color: INK }), text(date || '', {})],
                },
              },
        ],
      },
    },
    { width: W, height: H, fonts: [{ name: 'Noto', data: FONT, weight: 600, style: 'normal' }] },
  )
  return sharp(Buffer.from(svg)).png().toBuffer()
}
